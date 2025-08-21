// server/routes/categories.js
const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prismaClient');

// GET /categories
router.get('/', async (req, res) => {
    try {
        const cats = await prisma.category.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'asc' }
        });

        // 중복 제거하여 카운트 (DISTINCT vocabId 사용)
        const totals = await prisma.$queryRaw`
            SELECT categoryId, COUNT(DISTINCT vocabId) as count
            FROM uservocab 
            WHERE userId = ${req.user.id}
            GROUP BY categoryId
        `;

        const countMap = new Map(totals.map(t => [t.categoryId, Number(t.count)]));
        
        // 미분류 카테고리도 중복 제거하여 카운트
        const uncategorizedResult = await prisma.$queryRaw`
            SELECT COUNT(DISTINCT vocabId) as count
            FROM uservocab 
            WHERE userId = ${req.user.id} AND categoryId IS NULL
        `;
        const uncategorized = Number(uncategorizedResult[0]?.count || 0);

        const data = cats.map(c => ({ ...c, count: countMap.get(c.id) || 0 }));

        return res.json({ data: { categories: data, uncategorized } });
    } catch (e) {
        console.error('GET /categories failed:', e);
        return res.status(500).json({ error: 'Failed to load categories' });
    }
});

// POST /categories
router.post('/', async (req, res) => {
    try {
        const name = String(req.body?.name || '').trim();
        if (!name) return res.status(400).json({ error: 'name required' });

        const c = await prisma.category.create({
            data: { userId: req.user.id, name }
        });

        return res.status(201).json({ data: c });
    } catch (e) {
        console.error('POST /categories failed:', e);
        return res.status(500).json({ error: 'Failed to create category' });
    }
});

module.exports = router;