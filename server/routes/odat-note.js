// server/routes/odat-note.js
const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prismaClient');

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
    return items;
}

router.post('/resolve-many', async (req, res) => {
    try {
        const { cardIds } = req.body || {};
        if (!Array.isArray(cardIds) || cardIds.length === 0) {
            return res.status(400).json({ error: 'cardIds must be a non-empty array' });
        }
        const result = await prisma.sRSCard.updateMany({
            where: {
                userId: req.user.id,
                id: { in: cardIds.map(Number) }
            },
            data: {
                incorrectCount: 0,
                // 필요하다면 active: true로 변경하여 다시 SRS 큐에 포함시킬 수도 있습니다.
            }
        });
        return res.json({ data: { count: result.count } });
    } catch (e) {
        console.error('POST /odat-note/resolve-many failed:', e);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});


// POST /odat-note/quiz (✅ 누락된 라우트 추가)
router.post('/quiz', async (req, res) => {
    try {
        const { cardIds } = req.body || {};
        if (!Array.isArray(cardIds) || cardIds.length === 0) {
            return res.json({ data: [] });
        }

        const cards = await prisma.sRSCard.findMany({
            where: {
                userId: req.user.id,
                id: { in: cardIds.map(Number) }
            },
            select: { itemId: true }
        });

        const vocabIds = cards.map(c => c.itemId);
        const quizQueue = await generateMcqQuizItems(prisma, req.user.id, vocabIds);

        return res.json({ data: quizQueue });
    } catch (e) {
        console.error('POST /odat-note/quiz failed:', e);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});
// GET /odat-note/list
router.get('/list', async (req, res) => {
    try {
        const cards = await prisma.sRSCard.findMany({
            where: {
                userId: req.user.id,
                itemType: 'vocab',
                incorrectCount: { gt: 0 }
            },
            orderBy: { updatedAt: 'asc' },
            include: {
                // Vocab과의 관계를 직접 포함하여 필요한 정보를 가져옵니다.
                // 스키마에 SRSCard와 Vocab 간의 직접적인 관계 필드가 필요합니다.
                // 현재 스키마에서는 itemId를 통해 간접적으로 연결해야 합니다.
            }
        });

        // itemId를 기반으로 Vocab 정보를 가져와 데이터를 가공합니다.
        const vocabIds = cards.map(c => c.itemId);
        const vocabs = await prisma.vocab.findMany({
            where: { id: { in: vocabIds } },
            include: { dictMeta: true }
        });
        const vocabMap = new Map(vocabs.map(v => [v.id, v]));

        const responseData = cards.map(card => {
            const vocab = vocabMap.get(card.itemId);
            return {
                cardId: card.id,
                vocabId: card.itemId,
                lemma: vocab?.lemma || '',
                ko_gloss: vocab?.dictMeta?.examples?.find(ex => ex.kind === 'gloss')?.ko || null,
                // ... 프론트엔드에서 필요한 다른 필드들
            };
        });

        return res.json({ data: responseData });
    } catch (e) {
        console.error('GET /odat-note/list failed:', e);
        return res.status(500).json({ error: 'Failed to load incorrect answer notes' });
    }
});

// GET /odat-note/queue
// 이 라우트는 /srs/queue와 유사한 로직을 사용합니다.
// 필요시 /srs.js의 generateMcqQuizItems 헬퍼 함수를 공용 lib로 옮겨 재사용할 수 있습니다.
router.get('/queue', async (req, res) => {
    try {
        const incorrectCards = await prisma.sRSCard.findMany({
            where: { userId: req.user.id, itemType: 'vocab', incorrectCount: { gt: 0 } },
            take: 100
        });
        return res.json({ data: incorrectCards }); // 프론트엔드에 맞게 데이터 가공 필요
    } catch (e) {
        console.error('GET /odat-note/queue failed:', e);
        return res.status(500).json({ error: 'Failed to create quiz for incorrect notes' });
    }
});


module.exports = router;