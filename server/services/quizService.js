const { prisma } = require('../lib/prismaClient');

// 헬퍼 함수: JSON 문자열을 안전하게 객체로 파싱
function safeParse(jsonString) {
    if (typeof jsonString === 'object') return jsonString;
    if (typeof jsonString !== 'string') return null;
    try {
        return JSON.parse(jsonString);
    } catch {
        return null;
    }
}

async function generateMcqQuizItems(userId, vocabIds) {
    const ids = (Array.isArray(vocabIds) ? vocabIds : [])
        .map(Number)
        .filter(Number.isFinite);

    if (ids.length === 0) {
        console.warn('[QuizGen] No valid vocabIds provided.');
        return [];
    }

    // 1. 핵심 단어 정보 조회
    const vocabs = await prisma.vocab.findMany({
        where: { id: { in: ids } },
        select: { id: true, lemma: true, pos: true, dictMeta: true },
    });

    // 2. 오답 보기를 위한 단어 풀 조회
    const distractorPool = await prisma.vocab.findMany({
        where: { id: { notIn: ids }, levelCEFR: { in: ['A1', 'A2', 'B1'] } },
        take: ids.length * 4,
        select: { id: true, dictMeta: true },
    });

    // 3. 퀴즈 아이템 생성
    const quizItems = [];
    for (const v of vocabs) {
        const meta = safeParse(v.dictMeta?.examples); // ✅ dictMeta.examples 필드 파싱
        
        const correctGloss = meta?.koGloss || '(정의 없음)';
        const examples = meta?.examples || [];
        const pron = meta?.ipa ? { ipa: meta.ipa, ipaKo: meta.ipaKo } : null;

        // 오답 보기 생성
        const distractors = distractorPool
            .filter(p => p.id !== v.id)
            .map(p => safeParse(p.dictMeta?.examples)?.koGloss)
            .filter(Boolean) // null이나 undefined 제외
            .sort(() => 0.5 - Math.random())
            .slice(0, 3);
        
        const options = [...new Set([correctGloss, ...distractors])].sort(() => 0.5 - Math.random());
        while (options.length < 4) options.push('(보기 부족)');

        // SRSCard ID 조회 또는 생성 (upsert 사용으로 간결화)
        const card = await prisma.sRSCard.upsert({
            where: { userId_itemId_itemType: { userId, itemId: v.id, itemType: 'vocab' } },
            update: {},
            create: { userId, itemId: v.id, itemType: 'vocab', stage: 0, nextReviewAt: new Date() },
            select: { id: true }
        });

        quizItems.push({
            question: v.lemma,
            answer: correctGloss,
            options: options,
            pron: pron,
            pos: v.pos,
            examples: examples,
            cardId: card.id,
            vocabId: v.id
        });
    }

    return quizItems;
}

module.exports = { generateMcqQuizItems };