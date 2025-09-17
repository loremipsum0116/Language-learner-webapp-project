// server/services/quizService.js
const _ = require('lodash'); // lodash 같은 유틸리티 라이브러리 활용

/**
 * 배열을 무작위로 섞는 함수
 * @param {Array} array
 */
function shuffleArray(array) {
    return _.shuffle(array);
}

/**
 * 언어 코드에 따라 단어 언어를 판별하는 함수
 */
function detectLanguage(vocab) {
    // JLPT 레벨이 있으면 일본어
    if (vocab.levelJLPT) {
        return 'ja';
    }

    // source가 jlpt_vocabs이면 일본어
    if (vocab.source === 'jlpt_vocabs') {
        return 'ja';
    }

    // dictentry의 examples에 일본어 데이터가 있으면 일본어
    if (vocab.dictentry && vocab.dictentry.examples) {
        const examples = Array.isArray(vocab.dictentry.examples) ? vocab.dictentry.examples : [];
        const hasJapanese = examples.some(ex => ex.ja || ex.source === 'jlpt_vocabs');
        if (hasJapanese) {
            return 'ja';
        }
    }

    // 기본값은 영어
    return 'en';
}

/**
 * 안정적으로 MCQ 퀴즈 데이터를 생성하는 함수
 */
async function generateMcqQuizItems(prisma, userId, vocabIds) {
    if (!vocabIds || vocabIds.length === 0) return [];

    const ids = vocabIds.map(Number).filter(Number.isFinite);
    if (ids.length === 0) return [];

    const [vocabs, cards, distractorPool] = await Promise.all([
        prisma.vocab.findMany({
            where: { id: { in: ids } },
            include: {
                dictentry: true,
                translations: {
                    where: { languageId: 2 }, // Korean language ID
                    select: { translation: true }
                }
            }
        }),
        prisma.srscard.findMany({ where: { userId, itemType: 'vocab', itemId: { in: ids } }, select: { id: true, itemId: true } }),
        prisma.vocab.findMany({
            where: { id: { notIn: ids }, dictentry: { isNot: null } },
            include: {
                dictentry: true,
                translations: {
                    where: { languageId: 2 }, // Korean language ID
                    select: { translation: true }
                }
            },
            take: 500
        }),
    ]);

    const cardIdMap = new Map(cards.map(c => [c.itemId, c.id]));
    const distractorGlosses = new Set();
    distractorPool.forEach(v => {
        // VocabTranslation 테이블에서 한국어 번역 추출 (일본어 단어 지원)
        let gloss = null;

        // 1. VocabTranslation 테이블에서 한국어 번역 확인
        if (v.translations && v.translations.length > 0) {
            gloss = v.translations[0].translation;
        }

        // 2. 기존 dictentry.examples에서 추출 (영어 단어용)
        if (!gloss) {
            const examples = Array.isArray(v.dictentry?.examples) ? v.dictentry.examples : [];
            const glossEntry = examples.find(ex => ex.kind === 'gloss' && ex.ko) || examples.find(ex => ex.definitions?.[0]?.ko_def);
            gloss = glossEntry?.ko || glossEntry?.definitions?.[0]?.ko_def;
        }

        if (gloss) distractorGlosses.add(gloss.split(';')[0].split(',')[0].trim());
    });

    const quizItems = [];
    for (const vocab of vocabs) {
        if (!vocab.dictentry) continue;

        // VocabTranslation 테이블에서 한국어 번역 추출 (일본어 단어 지원)
        let correct = null;

        // 1. VocabTranslation 테이블에서 한국어 번역 확인
        if (vocab.translations && vocab.translations.length > 0) {
            correct = vocab.translations[0].translation;
        }

        // 2. 기존 dictentry.examples에서 추출 (영어 단어용)
        if (!correct) {
            const examples = Array.isArray(vocab.dictentry.examples) ? vocab.dictentry.examples : [];
            const glossEntry = examples.find(ex => ex.kind === 'gloss' && ex.ko) || examples.find(ex => ex.definitions?.[0]?.ko_def);
            correct = glossEntry?.ko || glossEntry?.definitions?.[0]?.ko_def;
        }

        if (!correct) continue;

        const localDistractors = new Set(distractorGlosses);
        localDistractors.delete(correct);
        const wrongOptions = _.sampleSize(Array.from(localDistractors), 3); // lodash 사용으로 간결화
        const options = [correct, ...wrongOptions];

        // 선택지가 4개 미만일 경우 대체 텍스트 추가
        while (options.length < 4) {
            options.push("관련 없는 뜻");
        }

        // 일본어 단어인 경우 히라가나 정보 추출
        let hiragana = null;
        let romaji = null;

        // JLPT 단어 감지
        const isJapanese = vocab.levelJLPT || vocab.source === 'jlpt_vocabs';

        if (isJapanese && vocab.dictentry) {
            // 히라가나는 dictentry.ipa에 저장됨 (seed-jlpt-vocabs.js:151)
            hiragana = vocab.dictentry.ipa;

            // 로마자는 dictentry.ipaKo에 저장됨 (seed-jlpt-vocabs.js:152)
            romaji = vocab.dictentry.ipaKo;

            console.log(`[MCQ QUIZ DEBUG] Japanese word ${vocab.lemma}: hiragana=${hiragana}, romaji=${romaji}`);
        }

        quizItems.push({
            cardId: cardIdMap.get(vocab.id) || null,
            vocabId: vocab.id,
            question: vocab.lemma,
            answer: correct, // 정답(한글 뜻)
            quizType: 'mcq',
            options: shuffleArray(options),
            pron: {
                ipa: vocab.dictentry.ipa,
                ipaKo: vocab.dictentry.ipaKo,
                hiragana: hiragana, // 일본어 히라가나 추가
                romaji: romaji // 일본어 로마자 추가
            },
            levelCEFR: vocab.levelCEFR,
            pos: vocab.pos, // 품사 정보 추가
            vocab: vocab, // ★★★ 단어의 모든 상세 정보(예문 포함)를 통째로 전달
        });
    }
    return quizItems;
}

/**
 * 일본어 단어 → 한국어 뜻 퀴즈 생성 함수
 */
async function generateJapaneseToKoreanQuiz(prisma, userId, vocabIds) {
    if (!vocabIds || vocabIds.length === 0) return [];

    const ids = vocabIds.map(Number).filter(Number.isFinite);
    if (ids.length === 0) return [];

    const [vocabs, cards, distractorPool] = await Promise.all([
        prisma.vocab.findMany({
            where: {
                id: { in: ids },
                // 일본어 단어 필터링
                OR: [
                    { levelJLPT: { not: null } },
                    { source: 'jlpt_vocabs' }
                ]
            },
            include: {
                dictentry: true,
                translations: {
                    where: { languageId: 2 }, // Korean language ID
                    select: { translation: true }
                }
            }
        }),
        prisma.srscard.findMany({
            where: { userId, itemType: 'vocab', itemId: { in: ids } },
            select: { id: true, itemId: true }
        }),
        prisma.vocab.findMany({
            where: {
                id: { notIn: ids },
                OR: [
                    { levelJLPT: { not: null } },
                    { source: 'jlpt_vocabs' }
                ],
                translations: {
                    some: { languageId: 2 }
                }
            },
            include: {
                translations: {
                    where: { languageId: 2 },
                    select: { translation: true }
                }
            },
            take: 200
        }),
    ]);

    const cardIdMap = new Map(cards.map(c => [c.itemId, c.id]));

    // 일본어 단어의 한국어 뜻들을 distractor로 수집
    const distractorMeanings = new Set();
    distractorPool.forEach(v => {
        if (v.translations && v.translations.length > 0) {
            const meaning = v.translations[0].translation;
            if (meaning) {
                // 여러 뜻이 ; 또는 , 로 구분되어 있을 경우 첫 번째만 사용
                const cleanMeaning = meaning.split(';')[0].split(',')[0].trim();
                distractorMeanings.add(cleanMeaning);
            }
        }
    });

    const quizItems = [];
    for (const vocab of vocabs) {
        // 한국어 번역 추출
        let koreanMeaning = null;
        if (vocab.translations && vocab.translations.length > 0) {
            koreanMeaning = vocab.translations[0].translation;
        }

        if (!koreanMeaning) continue;

        // 정답에서 첫 번째 뜻만 사용
        const correctAnswer = koreanMeaning.split(';')[0].split(',')[0].trim();

        // Distractor 선택 (정답 제외)
        const availableDistractors = Array.from(distractorMeanings).filter(
            meaning => meaning !== correctAnswer
        );
        const wrongOptions = _.sampleSize(availableDistractors, 3);
        const options = [correctAnswer, ...wrongOptions];

        // 선택지가 4개 미만일 경우 기본 distractor 추가
        while (options.length < 4) {
            options.push("관련 없는 뜻");
        }

        // 일본어 표시 형태 결정 - 체크한 단어의 lemma를 그대로 사용
        let questionText = vocab.lemma;
        let hiragana = null;
        let romaji = null;

        // examples에서 보조 정보만 추출 (히라가나, 로마자)
        console.log(`[JP-KO QUIZ] Processing vocab ${vocab.id} (${vocab.lemma})`);

        if (vocab.dictentry && vocab.dictentry.examples) {
            let examples = vocab.dictentry.examples;

            // examples가 배열인지 객체인지 확인
            if (Array.isArray(examples)) {
                // 배열인 경우
                const japaneseExample = examples.find(ex => ex.ja);
                if (japaneseExample) {
                    if (japaneseExample.romaji) {
                        romaji = japaneseExample.romaji;
                    } else if (japaneseExample.pronunciation) {
                        romaji = japaneseExample.pronunciation;
                    }
                    if (japaneseExample.hiragana) {
                        hiragana = japaneseExample.hiragana;
                    } else if (japaneseExample.kana) {
                        hiragana = japaneseExample.kana;
                    }
                }
            } else if (examples && typeof examples === 'object') {
                // 객체인 경우: 보조 정보만 추출
                if (examples.romaji) {
                    romaji = examples.romaji;
                }
                if (examples.kana) {
                    hiragana = examples.kana;
                }
            }

            console.log(`[JP-KO QUIZ] Final result - question: ${questionText}, romaji: ${romaji}, hiragana: ${hiragana}`);
        }

        // dictentry.ipa와 ipaKo에서 히라가나와 로마자 정보 가져오기 (fallback)
        if (!hiragana && vocab.dictentry?.ipa) {
            // ipa 필드에 히라가나가 저장됨 (seed-jlpt-vocabs.js:151)
            hiragana = vocab.dictentry.ipa;
        }

        if (!romaji && vocab.dictentry?.ipaKo) {
            // ipaKo 필드에 로마자가 저장됨 (seed-jlpt-vocabs.js:152)
            romaji = vocab.dictentry.ipaKo;
        }

        console.log(`[JP-KO QUIZ] Final result - question: ${questionText}, romaji: ${romaji}, hiragana: ${hiragana}`);

        quizItems.push({
            cardId: cardIdMap.get(vocab.id) || null,
            vocabId: vocab.id,
            question: questionText,
            answer: correctAnswer,
            quizType: 'jp_word_to_ko_meaning',
            options: shuffleArray(options),
            pron: {
                romaji: romaji,
                hiragana: hiragana
            },
            jlptLevel: vocab.levelJLPT || extractJlptLevel(vocab.source),
            pos: vocab.pos,
            language: 'ja',
            vocab: vocab
        });
    }

    return quizItems;
}

/**
 * 한국어 뜻 → 일본어 단어 퀴즈 생성 함수
 */
async function generateKoreanToJapaneseQuiz(prisma, userId, vocabIds) {
    if (!vocabIds || vocabIds.length === 0) return [];

    const ids = vocabIds.map(Number).filter(Number.isFinite);
    if (ids.length === 0) return [];

    const [vocabs, cards, distractorPool] = await Promise.all([
        prisma.vocab.findMany({
            where: {
                id: { in: ids },
                OR: [
                    { levelJLPT: { not: null } },
                    { source: 'jlpt_vocabs' }
                ]
            },
            include: {
                dictentry: true,
                translations: {
                    where: { languageId: 2 },
                    select: { translation: true }
                }
            }
        }),
        prisma.srscard.findMany({
            where: { userId, itemType: 'vocab', itemId: { in: ids } },
            select: { id: true, itemId: true }
        }),
        prisma.vocab.findMany({
            where: {
                id: { notIn: ids },
                OR: [
                    { levelJLPT: { not: null } },
                    { source: 'jlpt_vocabs' }
                ]
            },
            include: {
                dictentry: true
            },
            take: 200
        }),
    ]);

    const cardIdMap = new Map(cards.map(c => [c.itemId, c.id]));

    // 각 일본어 단어의 표시 형태와 로마자 정보를 함께 추출하는 함수
    function getJapaneseDisplayInfo(vocab) {
        let displayText = vocab.lemma; // lemma를 그대로 사용
        let romaji = null;
        let hiragana = null;

        if (vocab.dictentry && vocab.dictentry.examples) {
            const examples = vocab.dictentry.examples;
            console.log(`[KO-JP QUIZ] Processing vocab ${vocab.id} (${vocab.lemma}), examples type: ${typeof examples}`);

            if (examples && typeof examples === 'object') {
                // 보조 정보만 추출 (로마자, 히라가나)
                if (examples.romaji) {
                    romaji = examples.romaji;
                }
                if (examples.kana) {
                    hiragana = examples.kana;
                }
            }
        }

        return { displayText, romaji, hiragana };
    }

    // distractor용 일본어 단어들을 로마자 정보와 함께 수집
    const distractorOptions = [];
    distractorPool.forEach(v => {
        const info = getJapaneseDisplayInfo(v);
        if (info.displayText) {
            distractorOptions.push({
                text: info.displayText,
                romaji: info.romaji
            });
        }
    });

    const quizItems = [];
    for (const vocab of vocabs) {
        let koreanMeaning = null;
        if (vocab.translations && vocab.translations.length > 0) {
            koreanMeaning = vocab.translations[0].translation;
        }

        if (!koreanMeaning) continue;

        const questionText = koreanMeaning.split(';')[0].split(',')[0].trim();
        const correctInfo = getJapaneseDisplayInfo(vocab);
        const correctAnswer = correctInfo.displayText;

        console.log(`[KO-JP QUIZ] Processing vocab ${vocab.id}:`);
        console.log(`[KO-JP QUIZ] Question: ${questionText}`);
        console.log(`[KO-JP QUIZ] Correct answer: ${correctAnswer} (${correctInfo.romaji})`);

        // Distractor 선택 (정답 제외)
        const availableDistractors = distractorOptions.filter(
            option => option.text !== correctAnswer
        );
        const wrongOptions = _.sampleSize(availableDistractors, 3);

        // 선택지를 로마자 정보와 함께 구성
        const options = [
            { text: correctAnswer, romaji: correctInfo.romaji },
            ...wrongOptions
        ];

        // 선택지가 4개 미만일 경우 기본 distractor 추가
        while (options.length < 4) {
            options.push({ text: "関連ない", romaji: null });
        }

        console.log(`[KO-JP QUIZ] Final options:`, options);

        quizItems.push({
            cardId: cardIdMap.get(vocab.id) || null,
            vocabId: vocab.id,
            question: questionText,
            answer: correctAnswer,
            quizType: 'ko_meaning_to_jp_word',
            options: shuffleArray(options), // 로마자 정보가 포함된 options
            optionsWithRomaji: true, // 프론트엔드에 로마자 정보가 포함되어 있음을 알림
            pron: {
                romaji: correctInfo.romaji,
                hiragana: correctInfo.hiragana
            },
            jlptLevel: vocab.levelJLPT,
            pos: vocab.pos,
            language: 'ja',
            vocab: vocab
        });
    }

    return quizItems;
}

/**
 * 일본어 오디오 → 일본어 단어 매칭 퀴즈 생성 함수 (2025-09-17 수정)
 */
async function generateJapaneseToRomajiQuiz(prisma, userId, vocabIds) {
    if (!vocabIds || vocabIds.length === 0) return [];

    const ids = vocabIds.map(Number).filter(Number.isFinite);
    if (ids.length === 0) return [];

    const [vocabs, cards, distractorPool] = await Promise.all([
        prisma.vocab.findMany({
            where: {
                id: { in: ids },
                OR: [
                    { levelJLPT: { not: null } },
                    { source: 'jlpt_vocabs' }
                ]
            },
            include: {
                dictentry: true,
                translations: {
                    where: { languageId: 2 },
                    select: { translation: true }
                }
            }
        }),
        prisma.srscard.findMany({
            where: { userId, itemType: 'vocab', itemId: { in: ids } },
            select: { id: true, itemId: true }
        }),
        prisma.vocab.findMany({
            where: {
                id: { notIn: ids },
                OR: [
                    { levelJLPT: { not: null } },
                    { source: 'jlpt_vocabs' }
                ]
            },
            include: {
                dictentry: true
            },
            take: 200
        }),
    ]);

    const cardIdMap = new Map(cards.map(c => [c.itemId, c.id]));

    // 일본어 단어들을 distractor로 수집 (2025-09-17 수정)
    const distractorWords = new Set();
    distractorPool.forEach(v => {
        if (v.lemma) {
            distractorWords.add(v.lemma);
        }
    });

    const quizItems = [];
    console.log(`[JP ROMAJI QUIZ] Processing ${vocabs.length} vocabs`);

    for (const vocab of vocabs) {
        console.log(`[JP AUDIO QUIZ] Processing vocab ID ${vocab.id}, lemma: ${vocab.lemma}`);

        // 오디오 정보 추출 (2025-09-17 수정)
        let audioInfo = null;
        let japaneseLemma = vocab.lemma;

        if (vocab.dictentry && vocab.dictentry.audioLocal) {
            try {
                audioInfo = JSON.parse(vocab.dictentry.audioLocal);
                console.log(`[JP AUDIO QUIZ] Found audio info:`, audioInfo);
            } catch (e) {
                console.log(`[JP AUDIO QUIZ] Failed to parse audio info:`, e.message);
            }
        }

        if (!audioInfo || !audioInfo.word) {
            console.log(`[JP AUDIO QUIZ] Skipping vocab ${vocab.id} - no audio`);
            continue;
        }

        // 오디오는 질문, 일본어 단어가 정답 (2025-09-17 수정: / 추가)
        const questionAudio = `/${audioInfo.word}`; // 오디오 파일 경로
        const correctAnswer = japaneseLemma;

        // Distractor 선택 (정답 제외)
        const availableDistractors = Array.from(distractorWords).filter(
            word => word !== correctAnswer
        );
        const wrongOptions = _.sampleSize(availableDistractors, 3);
        const options = [correctAnswer, ...wrongOptions];

        while (options.length < 4) {
            options.push("未知");
        }

        quizItems.push({
            cardId: cardIdMap.get(vocab.id) || null,
            vocabId: vocab.id,
            question: null, // 오디오이므로 텍스트 질문 없음
            answer: correctAnswer,
            quizType: 'jp_word_to_romaji', // 타입명은 유지 (호환성)
            audioQuestion: questionAudio, // 오디오 파일 경로 추가
            options: shuffleArray(options),
            pron: {
                romaji: vocab.dictentry?.ipaKo || null,
                hiragana: vocab.dictentry?.ipa || null
            },
            jlptLevel: vocab.levelJLPT,
            pos: vocab.pos,
            language: 'ja',
            vocab: vocab
        });
    }

    return quizItems;
}

/**
 * 예문 빈칸 스펠링 입력 퀴즈 생성 함수
 */
async function generateJapaneseFillInBlankQuiz(prisma, userId, vocabIds) {
    if (!vocabIds || vocabIds.length === 0) return [];

    const ids = vocabIds.map(Number).filter(Number.isFinite);
    if (ids.length === 0) return [];

    const [vocabs, cards] = await Promise.all([
        prisma.vocab.findMany({
            where: {
                id: { in: ids },
                OR: [
                    { levelJLPT: { not: null } },
                    { source: 'jlpt_vocabs' }
                ]
            },
            include: {
                dictentry: true,
                translations: {
                    where: { languageId: 2 },
                    select: { translation: true }
                }
            }
        }),
        prisma.srscard.findMany({
            where: { userId, itemType: 'vocab', itemId: { in: ids } },
            select: { id: true, itemId: true }
        })
    ]);

    const cardIdMap = new Map(cards.map(c => [c.itemId, c.id]));

    const quizItems = [];
    for (const vocab of vocabs) {
        // dictentry.examples에서 예문 및 일본어 정보 추출
        let targetExample = null;
        let koExample = null; // 한국어 해석 추가
        let targetWord = vocab.lemma;
        let hiragana = null;
        let romaji = null;

        if (vocab.dictentry && vocab.dictentry.examples) {
            const examples = vocab.dictentry.examples;

            // 새로운 하이브리드 구조 지원 (2025-09-17 수정)
            if (Array.isArray(examples)) {
                // 배열 구조인 경우: [{ kind: 'example', ja: ..., ko: ... }]
                const exampleItem = examples.find(item => item.kind === 'example');
                if (exampleItem && exampleItem.ja && exampleItem.ko) {
                    targetExample = exampleItem.ja;
                    koExample = exampleItem.ko;
                    targetWord = vocab.lemma;
                    // 일본어 음성 정보는 dictentry.ipa, dictentry.ipaKo에서 추출
                    hiragana = vocab.dictentry.ipa || null;
                    romaji = vocab.dictentry.ipaKo || null;
                }
            } else if (examples && typeof examples === 'object') {
                // 객체 구조인 경우 (기존 호환성)
                if (examples.example && examples.koExample) {
                    targetExample = examples.example;
                    koExample = examples.koExample;
                    targetWord = vocab.lemma;
                    hiragana = examples.kana || null;
                    romaji = examples.romaji || null;
                } else if (examples.definitions && Array.isArray(examples.definitions)) {
                    // SRS 폴더용 구조: definitions[].examples[]
                    const defExample = examples.definitions[0]?.examples?.[0];
                    if (defExample && defExample.ja && defExample.ko) {
                        targetExample = defExample.ja;
                        koExample = defExample.ko;
                        targetWord = vocab.lemma;
                        hiragana = vocab.dictentry.ipa || null;
                        romaji = vocab.dictentry.ipaKo || null;
                    }
                }
            }
        }

        // 허용되는 정답들 (한자, 히라가나, 로마자)
        const acceptableAnswers = [targetWord];
        if (hiragana && hiragana !== targetWord) {
            acceptableAnswers.push(hiragana);
        }
        if (romaji && romaji !== targetWord) {
            acceptableAnswers.push(romaji);
        }

        // vocab.lemma도 정답에 추가 (중복 제거)
        if (vocab.lemma && !acceptableAnswers.includes(vocab.lemma)) {
            acceptableAnswers.push(vocab.lemma);
        }

        // lemma와 예문에서 단어 형태가 다른지 확인
        let useExample = false;
        let contextBlank = null;

        if (targetExample) {
            // 예문에 lemma나 다른 정답 형태가 포함되어 있는지 확인
            const hasMatchInExample = acceptableAnswers.some(answer =>
                answer && targetExample.includes(answer)
            );

            if (hasMatchInExample) {
                // 예문에서 정답을 찾을 수 있으면 빈칸 처리
                contextBlank = targetExample;
                const allAnswers = [...acceptableAnswers].sort((a, b) => b.length - a.length);

                for (const answer of allAnswers) {
                    if (answer && contextBlank.includes(answer)) {
                        const escapedAnswer = answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const regex = new RegExp(escapedAnswer, 'g');
                        contextBlank = contextBlank.replace(regex, '___');
                        useExample = true;
                        console.log(`[FILL IN BLANK] Using example with blank: ${contextBlank}`);
                        break;
                    }
                }
            }
        }

        // 예문을 사용할 수 없는 경우, 힌트 방식 사용
        if (!useExample) {
            contextBlank = null; // 예문 사용하지 않음
            console.log(`[FILL IN BLANK] No matching word in example, using hint mode for vocab ${vocab.id}`);
        }

        // 한국어 번역 추출
        const koreanTranslation = vocab.translations && vocab.translations[0]
            ? vocab.translations[0].translation
            : null;

        // 한국어 해석에서 강조할 단어 찾기
        let highlightedTranslation = koExample;
        if (koExample && koreanTranslation) {
            // 품사 정보 제거 (n., v., adj. 등)
            const cleanedTranslation = koreanTranslation.replace(/^[a-zA-Z]+\.\s*/, '');

            // 정답 번역에서 가능한 모든 의미 추출
            const meanings = cleanedTranslation.split(/[,;\/]/).map(m => m.trim());

            let foundMatch = false;
            for (const meaning of meanings) {
                if (meaning && koExample.includes(meaning)) {
                    highlightedTranslation = koExample.replace(
                        new RegExp(meaning.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
                        `{{HIGHLIGHT_START}}${meaning}{{HIGHLIGHT_END}}`
                    );
                    foundMatch = true;
                    break;
                }
            }

            // 만약 직접 매칭되지 않으면 단어의 일부를 찾아보기
            if (!foundMatch && cleanedTranslation.length >= 1) {
                // 번역의 첫 글자라도 해석에 있는지 확인
                const firstChar = cleanedTranslation.charAt(0);
                if (koExample.includes(firstChar)) {
                    highlightedTranslation = koExample.replace(
                        new RegExp(firstChar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
                        `{{HIGHLIGHT_START}}${firstChar}{{HIGHLIGHT_END}}`
                    );
                }
            }
        }

        // 디버깅: 데이터 로깅 (2025-09-17 수정)
        console.log('Japanese Fill-in-Blank Quiz Item:', {
            vocabId: vocab.id,
            targetWord: targetWord,
            targetExample: targetExample,
            contextTranslation: koExample,
            answerTranslation: koreanTranslation,
            cleanedTranslation: koreanTranslation ? koreanTranslation.replace(/^[a-zA-Z]+\.\s*/, '') : null,
            highlightedTranslation: highlightedTranslation,
            exampleStructure: Array.isArray(vocab.dictentry?.examples) ? 'array' : 'object',
            useExample: useExample,
            vocab: {
                lemma: vocab.lemma,
                translations: vocab.translations?.map(t => t.translation)
            }
        });

        quizItems.push({
            cardId: cardIdMap.get(vocab.id) || null,
            vocabId: vocab.id,
            question: useExample ? contextBlank : (koreanTranslation || '의미 없음'),
            answer: targetWord, // 기본 정답
            quizType: 'jp_fill_in_blank',
            contextSentence: useExample ? targetExample : null,
            contextBlank: useExample ? contextBlank : null,
            contextTranslation: useExample ? highlightedTranslation : null, // 예문 모드에서만 해석 표시
            answerTranslation: koreanTranslation, // 정답의 한국어 번역
            acceptableAnswers: acceptableAnswers,
            useExample: useExample, // 프론트엔드에서 모드 구분용
            pron: {
                romaji: romaji,
                hiragana: hiragana
            },
            jlptLevel: vocab.levelJLPT,
            pos: vocab.pos,
            language: 'ja',
            vocab: vocab
        });
    }

    return quizItems;
}

/**
 * 일본어 혼합형 퀴즈 생성 (4가지 타입을 랜덤하게 섞어서 출제)
 */
async function generateJapaneseMixedQuiz(prisma, userId, vocabIds) {
    if (vocabIds.length === 0) return [];

    // 4가지 퀴즈 타입 배열
    const quizTypes = [
        'jp_word_to_ko_meaning',
        'ko_meaning_to_jp_word',
        'jp_word_to_romaji',
        'jp_fill_in_blank'
    ];

    const quizItems = [];

    for (const vocabId of vocabIds) {
        // 각 단어마다 랜덤하게 퀴즈 타입 선택
        const randomType = quizTypes[Math.floor(Math.random() * quizTypes.length)];

        let typeQuizItems = [];
        switch (randomType) {
            case 'jp_word_to_ko_meaning':
                typeQuizItems = await generateJapaneseToKoreanQuiz(prisma, userId, [vocabId]);
                break;
            case 'ko_meaning_to_jp_word':
                typeQuizItems = await generateKoreanToJapaneseQuiz(prisma, userId, [vocabId]);
                break;
            case 'jp_word_to_romaji':
                typeQuizItems = await generateJapaneseToRomajiQuiz(prisma, userId, [vocabId]);
                break;
            case 'jp_fill_in_blank':
                typeQuizItems = await generateJapaneseFillInBlankQuiz(prisma, userId, [vocabId]);
                break;
        }

        // 생성된 퀴즈 아이템들을 추가 (보통 1개씩 생성됨)
        quizItems.push(...typeQuizItems);
    }

    // 혼합형임을 표시하기 위해 quizType을 'jp_mixed'로 설정
    return quizItems.map(item => ({
        ...item,
        originalQuizType: item.quizType, // 원래 타입 보존
        quizType: 'jp_mixed' // 혼합형으로 표시
    }));
}

/**
 * JLPT 레벨 추출 함수
 */
function extractJlptLevel(categories) {
    if (!categories) return null;
    const match = categories.match(/N[1-5]/);
    return match ? match[0] : null;
}

/**
 * 언어별 퀴즈 생성 메인 함수
 */
async function generateQuizByLanguageAndType(prisma, userId, vocabIds, quizType, language = 'en') {
    if (language === 'ja') {
        switch (quizType) {
            case 'jp_word_to_ko_meaning':
                return generateJapaneseToKoreanQuiz(prisma, userId, vocabIds);
            case 'ko_meaning_to_jp_word':
                return generateKoreanToJapaneseQuiz(prisma, userId, vocabIds);
            case 'jp_word_to_romaji':
                return generateJapaneseToRomajiQuiz(prisma, userId, vocabIds);
            case 'jp_fill_in_blank':
                return generateJapaneseFillInBlankQuiz(prisma, userId, vocabIds);
            case 'jp_mixed':
                return generateJapaneseMixedQuiz(prisma, userId, vocabIds);
            default:
                return generateJapaneseToKoreanQuiz(prisma, userId, vocabIds); // 기본값
        }
    } else {
        // 영어 퀴즈는 기존 로직 사용
        return generateMcqQuizItems(prisma, userId, vocabIds);
    }
}

module.exports = {
    generateMcqQuizItems,
    shuffleArray,
    detectLanguage,
    generateJapaneseToKoreanQuiz,
    generateKoreanToJapaneseQuiz,
    generateJapaneseToRomajiQuiz,
    generateJapaneseFillInBlankQuiz,
    generateJapaneseMixedQuiz,
    generateQuizByLanguageAndType,
    extractJlptLevel
};