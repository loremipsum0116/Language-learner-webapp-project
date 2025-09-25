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
            select: {
                id: true,
                lemma: true,
                pos: true, // 품사 정보 포함
                translations: {
                    where: { languageId: 2 },
                    select: { translation: true }
                }
            },
            take: 500 // distractor 풀 크기 증가
        }),
    ]);

    const cardIdMap = new Map(cards.map(c => [c.itemId, c.id]));

    // 품사별로 일본어 단어의 한국어 뜻들을 distractor로 수집
    const distractorsByPos = new Map();
    distractorPool.forEach(v => {
        if (v.translations && v.translations.length > 0 && v.pos) {
            const meaning = v.translations[0].translation;
            if (meaning && meaning.trim() !== '') {
                // 여러 뜻 처리: 80자 이내면 여러 뜻 포함, 초과하면 첫 번째 뜻만
                let cleanMeaning;
                if (meaning.length <= 80) {
                    // 짧으면 전체 뜻 사용 (세미콜론은 쉼표로 변경)
                    cleanMeaning = meaning.replace(/;/g, ', ').trim();
                } else {
                    // 길면 첫 번째 뜻만 사용
                    cleanMeaning = meaning.split(';')[0].split(',')[0].trim();
                }

                // 빈 문자열이 아닌 경우만 추가
                if (cleanMeaning !== '') {
                    if (!distractorsByPos.has(v.pos)) {
                        distractorsByPos.set(v.pos, new Set());
                    }
                    distractorsByPos.get(v.pos).add(cleanMeaning);
                }
            }
        }
    });

    // 기본 distractor 풀 (품사별 distractor가 부족할 때 사용)
    const allDistractors = new Set();
    distractorPool.forEach(v => {
        if (v.translations && v.translations.length > 0) {
            const meaning = v.translations[0].translation;
            if (meaning && meaning.trim() !== '') {
                // 여러 뜻 처리: 80자 이내면 여러 뜻 포함, 초과하면 첫 번째 뜻만
                let cleanMeaning;
                if (meaning.length <= 80) {
                    cleanMeaning = meaning.replace(/;/g, ', ').trim();
                } else {
                    cleanMeaning = meaning.split(';')[0].split(',')[0].trim();
                }
                // 빈 문자열이 아닌 경우만 추가
                if (cleanMeaning !== '') {
                    allDistractors.add(cleanMeaning);
                }
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

        // 정답 처리: 80자 이내면 여러 뜻 포함, 초과하면 첫 번째 뜻만
        let correctAnswer;
        if (koreanMeaning.length <= 80) {
            correctAnswer = koreanMeaning.replace(/;/g, ', ').trim();
        } else {
            correctAnswer = koreanMeaning.split(';')[0].split(',')[0].trim();
        }

        // 품사별 Distractor 선택 (정답 제외)
        const vocabPos = vocab.pos || 'unknown';
        let availableDistractors = [];

        // 먼저 같은 품사의 distractor를 사용
        if (distractorsByPos.has(vocabPos)) {
            availableDistractors = Array.from(distractorsByPos.get(vocabPos)).filter(
                meaning => meaning !== correctAnswer
            );
        }

        // 같은 품사의 distractor가 부족하면 전체 풀에서 보충
        if (availableDistractors.length < 3) {
            const allAvailable = Array.from(allDistractors).filter(
                meaning => meaning !== correctAnswer && !availableDistractors.includes(meaning)
            );
            availableDistractors = [...availableDistractors, ...allAvailable];
        }

        const wrongOptions = _.sampleSize(availableDistractors, 3);
        let options = [correctAnswer, ...wrongOptions];

        // 빈 문자열이나 undefined인 선택지 제거
        options = options.filter(option => option && option.trim() !== '');

        // 선택지가 4개 미만일 경우 기본 distractor 추가
        const fallbackOptions = ["기타 의미", "관련 없는 뜻", "다른 뜻", "추가 선택지", "기본 선택지"];
        while (options.length < 4) {
            const fallback = fallbackOptions[options.length - 1] || `선택지 ${options.length + 1}`;
            if (!options.includes(fallback)) {
                options.push(fallback);
            } else {
                options.push(`선택지 ${options.length + 1}`);
            }
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
            select: {
                id: true,
                lemma: true,
                pos: true, // 품사 정보 포함
                dictentry: true
            },
            take: 500 // distractor 풀 크기 증가
        }),
    ]);

    const cardIdMap = new Map(cards.map(c => [c.itemId, c.id]));

    // 각 일본어 단어의 표시 형태와 로마자 정보를 함께 추출하는 함수
    function getJapaneseDisplayInfo(vocab) {
        let displayText = vocab.lemma; // lemma를 그대로 사용
        let romaji = null;
        let hiragana = null;

        if (vocab.dictentry) {
            // dictentry.ipaKo와 dictentry.ipa에서 romaji와 hiragana 정보 추출
            if (vocab.dictentry.ipaKo) {
                romaji = vocab.dictentry.ipaKo;
            }
            if (vocab.dictentry.ipa) {
                hiragana = vocab.dictentry.ipa;
            }

            // examples 객체에서도 확인 (fallback)
            if (vocab.dictentry.examples && typeof vocab.dictentry.examples === 'object') {
                if (!romaji && vocab.dictentry.examples.romaji) {
                    romaji = vocab.dictentry.examples.romaji;
                }
                if (!hiragana && vocab.dictentry.examples.kana) {
                    hiragana = vocab.dictentry.examples.kana;
                }
            }

            console.log(`[KO-JP QUIZ] Processing vocab ${vocab.id} (${vocab.lemma}): romaji=${romaji}, hiragana=${hiragana}`);
        }

        return { displayText, romaji, hiragana };
    }

    // 품사별로 distractor용 일본어 단어들을 로마자 정보와 함께 수집
    const distractorsByPos = new Map();
    const allDistractorOptions = [];

    distractorPool.forEach(v => {
        const info = getJapaneseDisplayInfo(v);
        if (info.displayText && v.pos) {
            const option = {
                text: info.displayText,
                romaji: info.romaji,
                pos: v.pos
            };

            // 품사별 분류
            if (!distractorsByPos.has(v.pos)) {
                distractorsByPos.set(v.pos, []);
            }
            distractorsByPos.get(v.pos).push(option);

            // 전체 풀에도 추가
            allDistractorOptions.push(option);
        }
    });

    const quizItems = [];
    for (const vocab of vocabs) {
        let koreanMeaning = null;
        if (vocab.translations && vocab.translations.length > 0) {
            koreanMeaning = vocab.translations[0].translation;
        }

        if (!koreanMeaning) continue;

        // 질문 텍스트 처리: 80자 이내면 여러 뜻 포함, 초과하면 첫 번째 뜻만
        let questionText;
        if (koreanMeaning.length <= 80) {
            questionText = koreanMeaning.replace(/;/g, ', ').trim();
        } else {
            questionText = koreanMeaning.split(';')[0].split(',')[0].trim();
        }
        const correctInfo = getJapaneseDisplayInfo(vocab);
        const correctAnswer = correctInfo.displayText;

        console.log(`[KO-JP QUIZ] Processing vocab ${vocab.id}:`);
        console.log(`[KO-JP QUIZ] Question: ${questionText}`);
        console.log(`[KO-JP QUIZ] Correct answer: ${correctAnswer} (${correctInfo.romaji})`);

        // 품사별 Distractor 선택 (정답 제외)
        const vocabPos = vocab.pos || 'unknown';
        let availableDistractors = [];

        // 먼저 같은 품사의 distractor를 사용
        if (distractorsByPos.has(vocabPos)) {
            availableDistractors = distractorsByPos.get(vocabPos).filter(
                option => option.text !== correctAnswer
            );
        }

        // 같은 품사의 distractor가 부족하면 전체 풀에서 보충
        if (availableDistractors.length < 3) {
            const additionalDistractors = allDistractorOptions.filter(
                option => option.text !== correctAnswer &&
                !availableDistractors.some(ad => ad.text === option.text)
            );
            availableDistractors = [...availableDistractors, ...additionalDistractors];
        }

        const wrongOptions = _.sampleSize(availableDistractors, 3);

        // 선택지를 로마자 정보와 함께 구성
        const options = [
            { text: correctAnswer, romaji: correctInfo.romaji },
            ...wrongOptions
        ];

        // 선택지가 4개 미만일 경우 기본 distractor 추가
        while (options.length < 4) {
            const fallbackOptions = ["関連ない", "その他", "別の語"];
            options.push({
                text: fallbackOptions[options.length - 4] || `選択肢${options.length}`,
                romaji: null
            });
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
            select: {
                id: true,
                lemma: true,
                pos: true, // 품사 정보 포함
                dictentry: true
            },
            take: 500 // distractor 풀 크기 증가
        }),
    ]);

    const cardIdMap = new Map(cards.map(c => [c.itemId, c.id]));

    // 품사별로 일본어 단어들을 distractor로 수집
    const distractorsByPos = new Map();
    const allDistractorWords = new Set();

    distractorPool.forEach(v => {
        if (v.lemma && v.pos) {
            // 품사별 분류
            if (!distractorsByPos.has(v.pos)) {
                distractorsByPos.set(v.pos, new Set());
            }
            distractorsByPos.get(v.pos).add(v.lemma);

            // 전체 풀에도 추가
            allDistractorWords.add(v.lemma);
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

        // 품사별 Distractor 선택 (정답 제외)
        const vocabPos = vocab.pos || 'unknown';
        let availableDistractors = [];

        // 먼저 같은 품사의 distractor를 사용
        if (distractorsByPos.has(vocabPos)) {
            availableDistractors = Array.from(distractorsByPos.get(vocabPos)).filter(
                word => word !== correctAnswer
            );
        }

        // 같은 품사의 distractor가 부족하면 전체 풀에서 보충
        if (availableDistractors.length < 3) {
            const additionalDistractors = Array.from(allDistractorWords).filter(
                word => word !== correctAnswer && !availableDistractors.includes(word)
            );
            availableDistractors = [...availableDistractors, ...additionalDistractors];
        }

        const wrongOptions = _.sampleSize(availableDistractors, 3);
        const options = [correctAnswer, ...wrongOptions];

        while (options.length < 4) {
            const fallbackOptions = ["未知", "不明", "その他"];
            options.push(fallbackOptions[options.length - 4] || `選択${options.length}`);
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

        // 무조건 뜻 표시 모드로 통일
        let useExample = false;
        let contextBlank = null;

        console.log(`[FILL IN BLANK] Using hint mode (meaning only) for vocab ${vocab.id}`);
        // 예문 사용하지 않고 항상 뜻만 표시

        // 한국어 번역 추출
        const koreanTranslation = vocab.translations && vocab.translations[0]
            ? vocab.translations[0].translation
            : null;

        // 예문 해석은 사용하지 않음 (뜻 표시 모드로 통일)
        let highlightedTranslation = null;

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
            question: koreanTranslation || '의미 없음', // 항상 뜻만 표시
            answer: targetWord, // 기본 정답
            quizType: 'jp_fill_in_blank',
            contextSentence: null, // 예문 사용하지 않음
            contextBlank: null, // 빈칸 사용하지 않음
            contextTranslation: null, // 예문 해석 사용하지 않음
            answerTranslation: koreanTranslation, // 정답의 한국어 번역
            acceptableAnswers: acceptableAnswers,
            useExample: false, // 항상 false로 통일
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