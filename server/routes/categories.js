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

        const totals = await prisma.uservocab.groupBy({
            by: ['categoryId'],
            where: { userId: req.user.id },
            _count: { _all: true }
        });

        const countMap = new Map(totals.map(t => [t.categoryId, t._count._all]));
        const uncategorized = (await prisma.uservocab.count({ where: { userId: req.user.id, categoryId: null }}));

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