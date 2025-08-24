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

// GET /reading/level/:level - 레벨별 reading 데이터 개수 조회
router.get('/level/:level', async (req, res) => {
    try {
        const { level } = req.params;
        const count = await prisma.reading.count({
            where: {
                levelCEFR: level.toUpperCase()
            }
        });
        return res.json({ level, count, available: count > 0 });
    } catch (e) {
        console.error(`GET /reading/level/${req.params.level} Error:`, e);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /reading/practice/:level - 레벨별 reading 문제들 조회
router.get('/practice/:level', async (req, res) => {
    try {
        const { level } = req.params;
        const readings = await prisma.reading.findMany({
            where: {
                levelCEFR: level.toUpperCase()
            },
            orderBy: { id: 'asc' }
        });
        
        // glosses에서 문제 형태로 변환
        const questions = readings.map(reading => ({
            id: reading.id,
            passage: reading.glosses.passage || reading.body,
            question: reading.glosses.question,
            options: reading.glosses.options,
            correctAnswer: reading.glosses.correctAnswer,
            explanation: reading.glosses.explanation
        }));
        
        return res.json({ data: questions });
    } catch (e) {
        console.error(`GET /reading/practice/${req.params.level} Error:`, e);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;