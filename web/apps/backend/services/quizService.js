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

        quizItems.push({
            cardId: cardIdMap.get(vocab.id) || null,
            vocabId: vocab.id,
            question: vocab.lemma,
            answer: correct, // 정답(한글 뜻)
            quizType: 'mcq',
            options: shuffleArray(options),
            pron: { ipa: vocab.dictentry.ipa, ipaKo: vocab.dictentry.ipaKo },
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

        // 일본어 표시 형태 결정 - dictentry.examples에서 추출
        let questionText = vocab.lemma;
        let hiragana = null;
        let romaji = null;

        // examples에서 일본어 데이터 추출
        console.log(`[JP-KO QUIZ] Processing vocab ${vocab.id} (${vocab.lemma})`);
        console.log(`[JP-KO QUIZ] - dictentry:`, vocab.dictentry ? 'exists' : 'null');
        console.log(`[JP-KO QUIZ] - dictentry.ipa:`, vocab.dictentry?.ipa);
        console.log(`[JP-KO QUIZ] - dictentry.examples type:`, typeof vocab.dictentry?.examples);

        if (vocab.dictentry && vocab.dictentry.examples) {
            let examples = vocab.dictentry.examples;
            console.log(`[JP-KO QUIZ] Processing vocab ${vocab.id}, examples type: ${typeof examples}`);
            console.log(`[JP-KO QUIZ] Raw examples:`, JSON.stringify(examples, null, 2));

            // examples가 배열인지 객체인지 확인
            if (Array.isArray(examples)) {
                // 배열인 경우: 기존 로직
                const japaneseExample = examples.find(ex => ex.ja);
                if (japaneseExample) {
                    if (japaneseExample.ja) {
                        questionText = japaneseExample.ja;
                    }
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
                // 객체인 경우: 직접 접근
                if (examples.kanji) {
                    questionText = examples.kanji;
                } else if (examples.kana) {
                    questionText = examples.kana;
                }
                // 로마자 추출
                if (examples.romaji) {
                    romaji = examples.romaji;
                }
                // 히라가나 추출
                if (examples.kana) {
                    hiragana = examples.kana;
                }
                console.log(`[JP-KO QUIZ] Object format - kanji: ${examples.kanji}, kana: ${examples.kana}, romaji: ${examples.romaji}`);
            }

            console.log(`[JP-KO QUIZ] Final result - question: ${questionText}, romaji: ${romaji}, hiragana: ${hiragana}`);
        }

        // 로마자가 없으면 ipa 필드에서 시도 (fallback)
        if (!romaji && vocab.dictentry?.ipa) {
            // ipa 필드가 일본어 문자가 아닌 로마자인지 확인
            const ipaField = vocab.dictentry.ipa;
            // 간단한 로마자 패턴 체크 (알파벳만 포함)
            if (/^[a-zA-Z\s\-']+$/.test(ipaField)) {
                romaji = ipaField;
            }
        }

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
        let displayText = vocab.lemma;
        let romaji = null;
        let hiragana = null;

        if (vocab.dictentry && vocab.dictentry.examples) {
            const examples = vocab.dictentry.examples;
            console.log(`[KO-JP QUIZ] Processing distractor vocab ${vocab.id}, examples type: ${typeof examples}`);

            if (examples && typeof examples === 'object') {
                // 표시할 일본어 단어 결정
                if (examples.kanji) {
                    displayText = examples.kanji;
                } else if (examples.kana) {
                    displayText = examples.kana;
                }
                // 로마자와 히라가나 추출
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
 * 일본어 단어 → 로마자 발음 퀴즈 생성 함수
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

    // 로마자 발음들을 distractor로 수집
    const distractorRomaji = new Set();
    distractorPool.forEach(v => {
        if (v.dictentry && v.dictentry.examples && v.dictentry.examples.romaji) {
            distractorRomaji.add(v.dictentry.examples.romaji);
        }
    });

    const quizItems = [];
    console.log(`[JP ROMAJI QUIZ] Processing ${vocabs.length} vocabs`);

    for (const vocab of vocabs) {
        console.log(`[JP ROMAJI QUIZ] Processing vocab ID ${vocab.id}, lemma: ${vocab.lemma}`);

        // dictentry.examples에서 로마자 추출
        let romajiAnswer = null;
        let japaneseLemma = vocab.lemma;

        if (vocab.dictentry && vocab.dictentry.examples) {
            const examples = vocab.dictentry.examples;
            console.log(`[JP ROMAJI QUIZ] Found examples:`, examples);

            if (examples.romaji) {
                romajiAnswer = examples.romaji;
                japaneseLemma = examples.kanji || examples.kana || vocab.lemma;
                console.log(`[JP ROMAJI QUIZ] Found romaji: ${romajiAnswer}, ja: ${japaneseLemma}`);
            } else {
                console.log(`[JP ROMAJI QUIZ] No romaji found in examples`);
            }
        } else {
            console.log(`[JP ROMAJI QUIZ] No dictentry.examples found`);
        }

        if (!romajiAnswer) {
            console.log(`[JP ROMAJI QUIZ] Skipping vocab ${vocab.id} - no romaji`);
            continue;
        }

        const questionText = japaneseLemma;
        const correctAnswer = romajiAnswer;

        // Distractor 선택 (정답 제외)
        const availableDistractors = Array.from(distractorRomaji).filter(
            romaji => romaji !== correctAnswer
        );
        const wrongOptions = _.sampleSize(availableDistractors, 3);
        const options = [correctAnswer, ...wrongOptions];

        while (options.length < 4) {
            options.push("unknown");
        }

        quizItems.push({
            cardId: cardIdMap.get(vocab.id) || null,
            vocabId: vocab.id,
            question: questionText,
            answer: correctAnswer,
            quizType: 'jp_word_to_romaji',
            options: shuffleArray(options),
            pron: {
                romaji: vocab.romaji,
                hiragana: vocab.kana || null
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
            if (examples.example && examples.koExample) {
                targetExample = examples.example;
                koExample = examples.koExample; // 한국어 해석 저장
                targetWord = examples.kanji || examples.kana || vocab.lemma;
                hiragana = examples.kana || null;
                romaji = examples.romaji || null;
            }
        }

        if (!targetExample || !targetWord) continue;

        // 빈칸 처리된 예문 생성 (모든 형태의 정답을 빈칸으로 처리)
        let contextBlank = targetExample;

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

        // 모든 형태의 정답을 빈칸으로 교체 (긴 것부터 먼저 교체하여 부분 교체 방지)
        const allAnswers = [...acceptableAnswers].sort((a, b) => b.length - a.length);
        for (const answer of allAnswers) {
            if (answer) {
                // 정확한 단어 경계를 고려하여 교체 (부분 문자열 교체 방지)
                const regex = new RegExp(answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
                contextBlank = contextBlank.replace(regex, '___');
            }
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

        // 디버깅: 데이터 로깅
        console.log('Japanese Fill-in-Blank Quiz Item:', {
            vocabId: vocab.id,
            targetWord: targetWord,
            contextTranslation: koExample,
            answerTranslation: koreanTranslation,
            cleanedTranslation: koreanTranslation ? koreanTranslation.replace(/^[a-zA-Z]+\.\s*/, '') : null,
            highlightedTranslation: highlightedTranslation,
            vocab: {
                lemma: vocab.lemma,
                translations: vocab.translations?.map(t => t.translation)
            }
        });

        quizItems.push({
            cardId: cardIdMap.get(vocab.id) || null,
            vocabId: vocab.id,
            question: contextBlank,
            answer: targetWord, // 기본 정답
            quizType: 'jp_fill_in_blank',
            contextSentence: targetExample,
            contextBlank: contextBlank,
            contextTranslation: highlightedTranslation, // 강조 마킹이 포함된 한국어 해석
            answerTranslation: koreanTranslation, // 정답의 한국어 번역
            acceptableAnswers: acceptableAnswers,
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