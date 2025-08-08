// server/routes/my-wordbook.js
const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prismaClient');
const { ok, fail } = require('../lib/resp'); // fail 헬퍼 임포트

// GET /my-wordbook (기존 코드 유지)
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

// POST /my-wordbook/add (기존 코드 유지)
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

// POST /my-wordbook/add-many (기존 코드 유지)
router.post('/add-many', async (req, res) => {
    const { vocabIds } = req.body;
    if (!Array.isArray(vocabIds) || vocabIds.length === 0) {
        return fail(res, 400, 'vocabIds must be a non-empty array');
    }

    const userId = req.user.id;
    const idsToProcess = vocabIds.map(Number).filter(id => !isNaN(id));

    try {
        const existing = await prisma.userVocab.findMany({
            where: { userId, vocabId: { in: idsToProcess } },
            select: { vocabId: true }
        });
        const existingIds = new Set(existing.map(e => e.vocabId));

        const newData = idsToProcess
            .filter(id => !existingIds.has(id))
            .map(vocabId => ({ userId, vocabId }));

        if (newData.length > 0) {
            const result = await prisma.userVocab.createMany({ data: newData });
            return ok(res, { count: result.count });
        }

        return ok(res, { count: 0 });
    } catch (e) {
        console.error('POST /my-wordbook/add-many failed:', e);
        return fail(res, 500, 'Failed to add words');
    }
});


// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
// ★★★★★      이 부분이 문제를 해결합니다     ★★★★★
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

// POST /my-wordbook/remove-many (✅ 누락된 삭제 라우트 추가)
router.post('/remove-many', async (req, res) => {
    const { vocabIds } = req.body;
    if (!Array.isArray(vocabIds) || vocabIds.length === 0) {
        return fail(res, 400, 'vocabIds must be a non-empty array');
    }

    const userId = req.user.id;
    const idsToDelete = vocabIds.map(Number).filter(id => !isNaN(id));

    try {
        const result = await prisma.userVocab.deleteMany({
            where: {
                userId: userId,
                vocabId: { in: idsToDelete }
            }
        });

        // 삭제된 개수를 반환합니다.
        return ok(res, { count: result.count });

    } catch (e) {
        console.error('POST /my-wordbook/remove-many failed:', e);
        return fail(res, 500, 'Failed to remove words from wordbook');
    }
});

module.exports = router;
