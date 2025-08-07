// server/routes/reading.js
const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prismaClient');

// GET /reading/list
router.get('/list', async (req, res) => {
    try {
        // 현재는 DB에 있는 모든 Reading 자료를 가져옵니다.
        const readings = await prisma.reading.findMany({
            take: 5, // 우선 5개만 가져오도록 제한
            orderBy: { id: 'asc' }
        });
        return res.json({ data: readings });
    } catch (e) {
        console.error('GET /reading/list Error:', e);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;