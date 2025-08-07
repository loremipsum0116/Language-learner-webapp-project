// server/routes/my-wordbook.js
const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prismaClient');

// GET /my-wordbook
router.get('/', async (req, res) => {
    try {
        const { categoryId } = req.query;
        const where = { userId: req.user.id };

        if (categoryId === 'none') {
            where.categoryId = null;
        } else if (categoryId) {
            where.categoryId = parseInt(categoryId);
        }

        const items = await prisma.userVocab.findMany({
            where,
            include: { vocab: { include: { dictMeta: true } } },
            orderBy: { createdAt: 'desc' }
        });

        // ko_gloss를 추가하는 데이터 가공 로직
        const processedItems = items.map(item => {
            if (!item.vocab) return item;
            const examples = item.vocab.dictMeta?.examples || [];
            let gloss = null;
            if (examples[0]?.definitions?.[0]) {
                gloss = examples[0].definitions[0].ko_def || null;
            }
            return { ...item, vocab: { ...item.vocab, ko_gloss: gloss } };
        });

        return res.json({ data: processedItems });
    } catch (e) {
        console.error('GET /my-wordbook failed:', e);
        return res.status(500).json({ error: 'Failed to load wordbook' });
    }
});

// POST /my-wordbook/add-many (✅ 이 부분이 오류를 해결합니다)
router.post('/add-many', async (req, res) => {
    try {
        const { vocabIds } = req.body;
        if (!Array.isArray(vocabIds) || vocabIds.length === 0) {
            return res.status(400).json({ error: 'vocabIds must be a non-empty array' });
        }

        const userId = req.user.id;
        const idsToProcess = vocabIds.map(Number);

        const existing = await prisma.userVocab.findMany({
            where: { userId, vocabId: { in: idsToProcess } },
            select: { vocabId: true }
        });
        const existingIds = new Set(existing.map(e => e.vocabId));

        const newData = idsToProcess
            .filter(id => !existingIds.has(id))
            .map(vocabId => ({ userId, vocabId }));

        if (newData.length > 0) {
            await prisma.userVocab.createMany({ data: newData });
        }

        return res.status(201).json({ data: { count: newData.length } });
    } catch (e) {
        console.error('POST /my-wordbook/add-many failed:', e);
        return res.status(500).json({ error: 'Failed to add words' });
    }
});
// POST /my-wordbook/add (✅ 이 라우트가 오류를 해결합니다)
router.post('/add', async (req, res) => {
    try {
        const { vocabId } = req.body;
        if (!vocabId) {
            return res.status(400).json({ error: 'vocabId is required' });
        }

        const userId = req.user.id;
        const id = parseInt(vocabId);

        const existing = await prisma.userVocab.findUnique({
            where: {
                userId_vocabId: { userId, vocabId: id }
            }
        });

        if (existing) {
            return res.status(200).json({ data: existing, meta: { already: true } });
        }

        const newItem = await prisma.userVocab.create({
            data: { userId, vocabId: id }
        });

        return res.status(201).json({ data: newItem, meta: { created: true } });
    } catch (e) {
        console.error('POST /my-wordbook/add failed:', e);
        return res.status(500).json({ error: 'Failed to add word to wordbook' });
    }
});

// ... (향후 /my-wordbook/remove-many, /my-wordbook/assign 등 다른 라우트도 여기에 추가)

module.exports = router;