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
 * 안정적으로 MCQ 퀴즈 데이터를 생성하는 함수
 */
async function generateMcqQuizItems(prisma, userId, vocabIds) {
    if (!vocabIds || vocabIds.length === 0) return [];

    const ids = vocabIds.map(Number).filter(Number.isFinite);
    if (ids.length === 0) return [];

    const [vocabs, cards, distractorPool] = await Promise.all([
        prisma.vocab.findMany({ where: { id: { in: ids } }, include: { dictentry: true } }),
        prisma.srscard.findMany({ where: { userId, itemType: 'vocab', itemId: { in: ids } }, select: { id: true, itemId: true } }),
        prisma.vocab.findMany({ where: { id: { notIn: ids }, dictentry: { isNot: null } }, include: { dictentry: true }, take: 500 }),
    ]);

    const cardIdMap = new Map(cards.map(c => [c.itemId, c.id]));
    const distractorGlosses = new Set();
    distractorPool.forEach(v => {
        // 여러 스키마 구조에 대응하여 안정적으로 뜻을 추출
        const examples = Array.isArray(v.dictentry?.examples) ? v.dictentry.examples : [];
        const glossEntry = examples.find(ex => ex.kind === 'gloss' && ex.ko) || examples.find(ex => ex.definitions?.[0]?.ko_def);
        let gloss = glossEntry?.ko || glossEntry?.definitions?.[0]?.ko_def;
        if (gloss) distractorGlosses.add(gloss.split(';')[0].split(',')[0].trim());
    });

    const quizItems = [];
    for (const vocab of vocabs) {
        if (!vocab.dictentry) continue;

        const examples = Array.isArray(vocab.dictentry.examples) ? vocab.dictentry.examples : [];
        const glossEntry = examples.find(ex => ex.kind === 'gloss' && ex.ko) || examples.find(ex => ex.definitions?.[0]?.ko_def);
        const correct = glossEntry?.ko || glossEntry?.definitions?.[0]?.ko_def;

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

module.exports = { generateMcqQuizItems, shuffleArray };