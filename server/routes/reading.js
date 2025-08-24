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
            passage: reading.glosses?.fullPassage || reading.glosses?.passage || reading.body,
            question: reading.glosses?.question || 'No question',
            options: reading.glosses?.options || {},
            correctAnswer: reading.glosses?.correctAnswer || 'A',
            explanation: reading.glosses?.explanation || 'No explanation'
        }));
        
        return res.json({ data: questions });
    } catch (e) {
        console.error(`GET /reading/practice/${req.params.level} Error:`, e);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /reading/record - 리딩 문제 풀이 기록 저장 (정답/오답 모두)
router.post('/record', async (req, res) => {
    try {
        const { questionId, level, isCorrect, userAnswer, correctAnswer, timeTaken } = req.body;
        
        if (!questionId || !level || typeof isCorrect !== 'boolean') {
            return res.status(400).json({ error: 'questionId, level, isCorrect are required' });
        }

        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        // itemId 생성 (리딩은 1000번대)
        const itemId = parseInt(questionId) + 1000;
        
        // 기존 기록 찾기
        const existingRecord = await prisma.wronganswer.findFirst({
            where: {
                userId: userId,
                itemType: 'reading',
                itemId: itemId
            }
        });

        const now = new Date();
        const recordData = {
            questionId: questionId,
            level: level,
            isCorrect: isCorrect,
            userAnswer: userAnswer,
            correctAnswer: correctAnswer,
            timeTaken: timeTaken,
            recordedAt: now.toISOString()
        };

        let result;
        if (existingRecord) {
            // 기존 기록 업데이트
            result = await prisma.wronganswer.update({
                where: { id: existingRecord.id },
                data: {
                    attempts: existingRecord.attempts + 1,
                    wrongAt: now,
                    wrongData: recordData,
                    isCompleted: isCorrect, // 정답이면 완료로 표시
                    reviewWindowStart: now,
                    reviewWindowEnd: new Date(Date.now() + 24 * 60 * 60 * 1000)
                }
            });
        } else {
            // 새 기록 생성
            result = await prisma.wronganswer.create({
                data: {
                    userId: userId,
                    itemType: 'reading',
                    itemId: itemId,
                    attempts: 1,
                    wrongAt: now,
                    wrongData: recordData,
                    isCompleted: isCorrect, // 정답이면 완료로 표시
                    reviewWindowStart: now,
                    reviewWindowEnd: new Date(Date.now() + 24 * 60 * 60 * 1000)
                }
            });
        }

        return res.json({ 
            success: true, 
            data: result,
            message: `Reading record ${isCorrect ? 'correct' : 'incorrect'} saved successfully` 
        });
        
    } catch (e) {
        console.error('POST /reading/record Error:', e);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /reading/history/:level - 레벨별 학습 기록 조회
router.get('/history/:level', async (req, res) => {
    try {
        const { level } = req.params;
        const userId = req.user?.id;
        
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        // 해당 레벨의 모든 학습 기록 조회
        const records = await prisma.wronganswer.findMany({
            where: {
                userId: userId,
                itemType: 'reading',
                wrongData: {
                    path: ['level'],
                    equals: level.toUpperCase()
                }
            },
            orderBy: { wrongAt: 'desc' }
        });

        // questionId별로 최신 기록만 유지
        const latestRecords = {};
        records.forEach(record => {
            const questionId = record.wrongData?.questionId;
            if (questionId && (!latestRecords[questionId] || record.wrongAt > latestRecords[questionId].wrongAt)) {
                latestRecords[questionId] = record;
            }
        });

        return res.json({ data: latestRecords });
        
    } catch (e) {
        console.error(`GET /reading/history/${req.params.level} Error:`, e);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;