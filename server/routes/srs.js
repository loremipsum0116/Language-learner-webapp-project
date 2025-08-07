// server/routes/srs.js
const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prismaClient');

// 헬퍼 함수 (기존 server.js에서 가져옴)
function shuffleArray(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
    }
    return array;
}
async function generateMcqQuizItems(prisma, userId, vocabIds) {
    if (!vocabIds || vocabIds.length === 0) return [];

    const ids = vocabIds.map(Number).filter(Number.isFinite);
    if (ids.length === 0) return [];

    const [vocabs, cards] = await Promise.all([
        prisma.vocab.findMany({ where: { id: { in: ids } }, include: { dictMeta: true } }),
        prisma.sRSCard.findMany({ where: { userId, itemType: 'vocab', itemId: { in: ids } }, select: { id: true, itemId: true } }),
    ]);

    const cmap = new Map(cards.map(c => [c.itemId, c.id]));
    const distractorPool = await prisma.vocab.findMany({
        where: { id: { notIn: ids }, dictMeta: { isNot: null } },
        include: { dictMeta: true },
        take: 500,
    });

    const poolGlosses = new Set();
    distractorPool.forEach(d => {
        if (d.dictMeta && Array.isArray(d.dictMeta.examples)) {
            const meanings = d.dictMeta.examples;
            let gloss = null;
            if (meanings.length > 0 && meanings[0].definitions && meanings[0].definitions.length > 0) {
                gloss = meanings[0].definitions[0].ko_def;
            }
            if (!gloss) {
                const glossExample = meanings.find(ex => ex && ex.kind === 'gloss');
                if (glossExample) gloss = glossExample.ko;
            }
            if (gloss) poolGlosses.add(gloss);
        }
    });

    const pickN = (arr, n) => {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a.slice(0, n);
    };

    const items = [];
    for (const v of vocabs) {
        const meanings = Array.isArray(v.dictMeta?.examples) ? v.dictMeta.examples : [];
        let correct = null;
        if (meanings.length > 0 && meanings[0].definitions && meanings[0].definitions.length > 0) {
            correct = meanings[0].definitions[0].ko_def || null;
        }
        if (!correct) {
            const glossExample = meanings.find(ex => ex && ex.kind === 'gloss');
            if (glossExample) correct = glossExample.ko || null;
        }
        if (!correct) continue;

        const localWrongSet = new Set(poolGlosses);
        localWrongSet.delete(correct);
        const wrongs = pickN(Array.from(localWrongSet), 3);
        const options = [correct, ...wrongs];
        while (options.length < 4) {
            options.push(correct);
        }

        items.push({
            cardId: cmap.get(v.id) || null,
            vocabId: v.id,
            question: v.lemma,
            answer: correct,
            quizType: 'mcq',
            options: shuffleArray(options),
            pron: { ipa: v.dictMeta?.ipa || null, ipaKo: v.dictMeta?.ipaKo || null },
            levelCEFR: v.levelCEFR,
            pos: v.pos,
        });
    }
    return items;/* ... 기존 generateMcqQuizItems 함수 코드 ... */
}

// GET /srs/all-cards (✅ 추가된 부분)
router.get('/all-cards', async (req, res) => {
    try {
        const cards = await prisma.sRSCard.findMany({
            where: { userId: req.user.id, itemType: 'vocab', active: true },
            select: { id: true, itemId: true, nextReviewAt: true, stage: true }
        });

        if (cards.length === 0) return res.json({ data: [] });

        const vocabIds = cards.map(card => card.itemId);
        const vocabs = await prisma.vocab.findMany({
            where: { id: { in: vocabIds } },
            include: { dictMeta: true }
        });
        const vocabMap = new Map(vocabs.map(v => [v.id, v]));

        const result = cards.map(card => {
            const vocab = vocabMap.get(card.itemId);
            if (!vocab) return null;
            // 간단한 ko_gloss 추출 로직
            const gloss = Array.isArray(vocab.dictMeta?.examples)
                ? vocab.dictMeta.examples.find(ex => ex?.kind === 'gloss')?.ko
                : null;
            return {
                cardId: card.id,
                vocabId: card.itemId,
                lemma: vocab.lemma,
                ko_gloss: gloss,
                nextReviewAt: card.nextReviewAt,
                stage: card.stage,
                ipa: vocab.dictMeta?.ipa,
                ipaKo: vocab.dictMeta?.ipaKo
            };
        }).filter(Boolean); // null 값 제거

        return res.json({ data: result });
    } catch (e) {
        console.error('GET /srs/all-cards Error:', e);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ✅ '/create-many' 라우트 추가
router.post('/create-many', async (req, res) => {
    const { vocabIds } = req.body;
    if (!Array.isArray(vocabIds) || vocabIds.length === 0) {
        return res.status(400).json({ error: 'vocabIds must be a non-empty array' });
    }

    const userId = req.user.id;
    let createdCount = 0;
    try {
        for (const vocabId of vocabIds) {
            const existing = await prisma.sRSCard.findFirst({
                where: { userId, itemId: vocabId, itemType: 'vocab' }
            });
            if (!existing) {
                await prisma.sRSCard.create({
                    data: {
                        userId,
                        itemId: vocabId,
                        itemType: 'vocab',
                        stage: 0,
                        nextReviewAt: new Date(),
                    }
                });
                createdCount++;
            }
        }
        return res.json({ data: { count: createdCount } });
    } catch (e) {
        console.error('POST /srs/create-many failed:', e);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});
// GET /srs/queue
router.get('/queue', async (req, res) => {
    try {
        const limit = Math.min(Number(req.query.limit || 20), 100);
        const cards = await prisma.sRSCard.findMany({
            where: { userId: req.user.id, itemType: 'vocab', active: true, nextReviewAt: { lte: new Date() } },
            orderBy: { nextReviewAt: 'asc' },
            take: limit,
            select: { itemId: true },
        });
        if (cards.length === 0) return res.json({ data: [] });
        const vocabIds = cards.map(c => c.itemId);
        const queue = await generateMcqQuizItems(prisma, req.user.id, vocabIds);
        return res.json({ data: queue });
    } catch (e) {
        console.error('SRS Queue 생성 오류:', e);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 다른 /srs/* 관련 라우트들도 여기에 추가하면 됩니다.

module.exports = router;