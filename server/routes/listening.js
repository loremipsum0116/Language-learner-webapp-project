const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prismaClient');
const authMiddleware = require('../middleware/auth');

// 리스닝 문제 해결 기록 저장
router.post('/record', authMiddleware, async (req, res) => {
    try {
        const { questionId, level, isCorrect, userAnswer, correctAnswer } = req.body;
        const userId = req.user.id;

        if (!questionId || !level || typeof isCorrect !== 'boolean') {
            return res.status(400).json({ 
                error: 'Missing required fields: questionId, level, isCorrect' 
            });
        }

        // 기존 기록이 있는지 확인
        const existingRecord = await prisma.listeningRecord.findFirst({
            where: {
                userId,
                questionId: String(questionId),
                level
            }
        });

        let record;
        if (existingRecord) {
            // 기존 기록 업데이트
            record = await prisma.listeningRecord.update({
                where: { id: existingRecord.id },
                data: {
                    isCorrect,
                    userAnswer: String(userAnswer),
                    correctAnswer: String(correctAnswer),
                    solvedAt: new Date()
                }
            });
        } else {
            // 새 기록 생성
            record = await prisma.listeningRecord.create({
                data: {
                    userId,
                    questionId: String(questionId),
                    level,
                    isCorrect,
                    userAnswer: String(userAnswer),
                    correctAnswer: String(correctAnswer),
                    solvedAt: new Date()
                }
            });
        }

        console.log(`✅ [LISTENING RECORD] User ${userId} - Question ${questionId} - ${isCorrect ? 'CORRECT' : 'WRONG'}`);
        res.json({ success: true, record });

    } catch (error) {
        console.error('❌ [LISTENING RECORD ERROR]:', error);
        res.status(500).json({ error: 'Failed to save listening record' });
    }
});

// 사용자의 리스닝 문제 해결 기록 조회
router.get('/history/:level', authMiddleware, async (req, res) => {
    try {
        const { level } = req.params;
        const userId = req.user.id;

        if (!level) {
            return res.status(400).json({ error: 'Level parameter is required' });
        }

        const records = await prisma.listeningRecord.findMany({
            where: {
                userId,
                level
            },
            orderBy: {
                solvedAt: 'desc'
            }
        });

        console.log(`✅ [LISTENING HISTORY] User ${userId} - Level ${level} - ${records.length} records`);
        res.json(records);

    } catch (error) {
        console.error('❌ [LISTENING HISTORY ERROR]:', error);
        res.status(500).json({ error: 'Failed to fetch listening history' });
    }
});

// 리스닝 레벨별 통계 조회
router.get('/stats/:level', authMiddleware, async (req, res) => {
    try {
        const { level } = req.params;
        const userId = req.user.id;

        const stats = await prisma.listeningRecord.groupBy({
            by: ['isCorrect'],
            where: {
                userId,
                level
            },
            _count: {
                isCorrect: true
            }
        });

        const result = {
            level,
            totalAttempted: stats.reduce((sum, stat) => sum + stat._count.isCorrect, 0),
            correctCount: stats.find(stat => stat.isCorrect)?._count.isCorrect || 0,
            incorrectCount: stats.find(stat => !stat.isCorrect)?._count.isCorrect || 0
        };

        result.accuracy = result.totalAttempted > 0 
            ? Math.round((result.correctCount / result.totalAttempted) * 100) 
            : 0;

        console.log(`✅ [LISTENING STATS] User ${userId} - Level ${level}:`, result);
        res.json(result);

    } catch (error) {
        console.error('❌ [LISTENING STATS ERROR]:', error);
        res.status(500).json({ error: 'Failed to fetch listening stats' });
    }
});

module.exports = router;