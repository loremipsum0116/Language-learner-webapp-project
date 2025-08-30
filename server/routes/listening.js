const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prismaClient');
const authMiddleware = require('../middleware/auth');

// 리스닝 문제 해결 기록 저장 (통합 오답노트 시스템 사용)
console.log('🌟 [LISTENING ROUTER] /record route registered!');
router.post('/record', authMiddleware, async (req, res) => {
    console.log('🚨🚨🚨 [LISTENING RECORD] API CALLED! 🚨🚨🚨');
    try {
        console.log(`🚀🎯 [LISTENING RECORD START] 기록 저장 시작!`);
        console.log(`📝🎯 [REQUEST BODY]`, req.body);
        
        const { 
            questionId, level, isCorrect, userAnswer, correctAnswer, timeTaken,
            question, script, topic, options, explanation 
        } = req.body;
        const userId = req.user.id;
        
        console.log(`👤🎯 [USER INFO] userId: ${userId}, questionId: ${questionId}, isCorrect: ${isCorrect}`);
        console.log(`🔍🎯 [FIELD DEBUG] question: "${question}", script: "${script}", topic: "${topic}"`);
        console.log(`🔍🎯 [FIELD TYPES] question type: ${typeof question}, script type: ${typeof script}, topic type: ${typeof topic}`);

        if (!questionId || !level || typeof isCorrect !== 'boolean') {
            console.log(`❌🎯 [VALIDATION ERROR] Missing fields`);
            return res.status(400).json({ 
                error: 'Missing required fields: questionId, level, isCorrect' 
            });
        }

        // itemId 생성 (리스닝은 2000번대)
        // A1_L_001 -> extract "001" -> convert to number -> add 2000
        const questionNumMatch = questionId.match(/_(\d+)$/);
        if (!questionNumMatch) {
            console.error(`[ERROR] Could not extract number from questionId: "${questionId}"`);
            return res.status(400).json({ error: 'Invalid questionId format - no number found' });
        }
        
        const questionNum = parseInt(questionNumMatch[1]);
        const itemId = questionNum + 2000;
        
        // 기존 기록 찾기 (통합 오답노트 시스템)
        // questionId 기반으로 더 정확한 중복 검사
        const allUserListeningRecords = await prisma.wronganswer.findMany({
            where: {
                userId: userId,
                itemType: 'listening'
            }
        });
        
        const existingRecord = allUserListeningRecords.find(record => 
            record.itemId === itemId || 
            (record.wrongData && record.wrongData.questionId === questionId)
        );

        // UTC 시간으로 저장 (프론트엔드에서 KST로 변환)
        const now = new Date();
        
        console.log(`🕐🎯 [TIME DEBUG] UTC: ${now.toISOString()}`);
        console.log(`🕐🎯 [TIME DEBUG] KST Preview: ${now.toLocaleString('ko-KR', {timeZone: 'Asia/Seoul'})}`);
        
        const finalTime = now;
        const recordData = {
            questionId: questionId,
            level: level,
            isCorrect: isCorrect,
            userAnswer: userAnswer,
            correctAnswer: correctAnswer,
            timeTaken: timeTaken,
            recordedAt: finalTime.toISOString(),
            // 추가 데이터 포함
            question: question || "질문 정보 없음",
            script: script || "스크립트 정보 없음",
            topic: topic || "리스닝 문제",
            options: options || {},
            explanation: explanation || "",
            audioFile: `${questionId}.mp3`
        };

        let result;
        if (existingRecord) {
            // 기존 기록의 통계 계산
            const currentWrongData = existingRecord.wrongData || {};
            const correctCount = (currentWrongData.correctCount || 0) + (isCorrect ? 1 : 0);
            const incorrectCount = (currentWrongData.incorrectCount || 0) + (isCorrect ? 0 : 1);
            const totalAttempts = existingRecord.attempts + 1;
            
            console.log(`📊 [STATS UPDATE] Before: correct=${currentWrongData.correctCount || 0}, incorrect=${currentWrongData.incorrectCount || 0}, total=${existingRecord.attempts}`);
            console.log(`📊 [STATS UPDATE] After: correct=${correctCount}, incorrect=${incorrectCount}, total=${totalAttempts}, isCorrect=${isCorrect}`);
            
            // 기존 기록 업데이트 - 통계 보존
            result = await prisma.wronganswer.update({
                where: { id: existingRecord.id },
                data: {
                    attempts: totalAttempts,
                    wrongAt: finalTime, // 마지막 학습 시간으로 변경 (KST)
                    wrongData: {
                        ...currentWrongData, // 기존 데이터 먼저 보존
                        ...recordData,       // 새 답안 정보 추가
                        correctCount: correctCount,    // 누적 통계 덮어쓰기
                        incorrectCount: incorrectCount,
                        totalAttempts: totalAttempts,
                        lastResult: isCorrect ? 'correct' : 'incorrect'
                    },
                    isCompleted: isCorrect, // 정답이면 완료로 표시
                    reviewWindowStart: finalTime,
                    reviewWindowEnd: new Date(finalTime.getTime() + 24 * 60 * 60 * 1000)
                }
            });
        } else if (!isCorrect) {
            // 오답인 경우에만 새 기록 생성
            result = await prisma.wronganswer.create({
                data: {
                    userId: userId,
                    itemType: 'listening',
                    itemId: itemId,
                    attempts: 1,
                    wrongAt: finalTime,
                    wrongData: {
                        ...recordData,
                        correctCount: 0,
                        incorrectCount: 1,
                        totalAttempts: 1,
                        lastResult: 'incorrect'
                    },
                    isCompleted: false, // 오답이므로 미완료
                    reviewWindowStart: finalTime,
                    reviewWindowEnd: new Date(finalTime.getTime() + 24 * 60 * 60 * 1000)
                }
            });
        } else {
            // 정답이고 기존 기록이 없는 경우 - 아무것도 하지 않음
            console.log(`✅ [LISTENING RECORD] User ${userId} - Question ${questionId} - CORRECT (첫 번째 시도) - 오답노트에 저장하지 않음`);
            result = null;
        }

        // 기존 listeningRecord 테이블에도 호환성을 위해 저장 (선택적)
        try {
            const existingListeningRecord = await prisma.listeningRecord.findFirst({
                where: {
                    userId,
                    questionId: String(questionId),
                    level
                }
            });

            if (existingListeningRecord) {
                await prisma.listeningRecord.update({
                    where: { id: existingListeningRecord.id },
                    data: {
                        isCorrect,
                        userAnswer: String(userAnswer),
                        correctAnswer: String(correctAnswer),
                        solvedAt: finalTime
                    }
                });
            } else {
                await prisma.listeningRecord.create({
                    data: {
                        userId,
                        questionId: String(questionId),
                        level,
                        isCorrect,
                        userAnswer: String(userAnswer),
                        correctAnswer: String(correctAnswer),
                        solvedAt: finalTime
                    }
                });
            }
        } catch (legacyError) {
            console.warn('⚠️ Legacy listeningRecord 저장 실패 (무시됨):', legacyError.message);
        }

        if (result) {
            console.log(`✅ [LISTENING RECORD] User ${userId} - Question ${questionId} - ${isCorrect ? 'CORRECT' : 'WRONG'} - Saved to wronganswer table`);
        }
        res.json({ 
            success: true, 
            data: result,
            message: result 
                ? `Listening record ${isCorrect ? 'correct' : 'incorrect'} saved successfully` 
                : `Correct answer recorded (not saved to wrong answer table)`
        });

    } catch (error) {
        console.error('❌ [LISTENING RECORD ERROR]:', error);
        res.status(500).json({ error: 'Failed to save listening record' });
    }
});

// 사용자의 리스닝 문제 해결 기록 조회 (통합 오답노트 시스템)
router.get('/history/:level', authMiddleware, async (req, res) => {
    try {
        const { level } = req.params;
        const userId = req.user?.id;
        
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        if (!level) {
            return res.status(400).json({ error: 'Level parameter is required' });
        }

        // 해당 레벨의 모든 리스닝 학습 기록 조회 (두 테이블 모두 확인)
        console.log(`[DEBUG] Searching for listening records: userId=${userId}, level=${level}`);
        
        // 1. wronganswer 테이블에서 조회
        const wrongAnswerRecords = await prisma.wronganswer.findMany({
            where: {
                userId: userId,
                itemType: 'listening'
            },
            orderBy: { wrongAt: 'desc' }
        });
        
        // 2. listeningRecord 테이블에서도 조회 (삭제된 항목들의 학습 기록)
        const listeningRecords = await prisma.listeningRecord.findMany({
            where: {
                userId: userId,
                level: level
            },
            orderBy: { solvedAt: 'desc' }
        });
        
        console.log(`[DEBUG] Found ${wrongAnswerRecords.length} wrongAnswer records, ${listeningRecords.length} listeningRecord records`);
        
        // wrongAnswer에서 레벨 필터링
        const filteredWrongRecords = wrongAnswerRecords.filter(record => 
            record.wrongData?.level === level || record.wrongData?.level === level.toUpperCase()
        );
        
        // 두 테이블의 데이터를 통합
        const combinedRecords = {};
        
        // wrongAnswer 기록 우선 추가
        filteredWrongRecords.forEach(record => {
            const questionId = record.wrongData?.questionId;
            if (questionId) {
                combinedRecords[questionId] = {
                    questionId: questionId,
                    isCorrect: record.wrongData?.isCorrect || record.isCompleted,
                    solvedAt: record.wrongAt.toISOString(),
                    isCompleted: record.isCompleted,
                    attempts: record.attempts,
                    wrongData: record.wrongData,
                    source: 'wrongAnswer'
                };
            }
        });
        
        // listeningRecord 기록 추가 (wrongAnswer에 없는 것만)
        listeningRecords.forEach(record => {
            const questionId = record.questionId;
            if (questionId && !combinedRecords[questionId]) {
                console.log(`[DEBUG] Adding listeningRecord: ${questionId}, solvedAt: ${record.solvedAt}, isCorrect: ${record.isCorrect}`);
                combinedRecords[questionId] = {
                    questionId: questionId,
                    isCorrect: record.isCorrect,
                    solvedAt: record.solvedAt ? record.solvedAt.toISOString() : null,
                    isCompleted: record.isCorrect,
                    attempts: 1,
                    wrongData: null,
                    source: 'listeningRecord'
                };
            }
        });

        console.log(`[DEBUG] Combined ${Object.keys(combinedRecords).length} unique listening records for user ${userId}, level ${level}`);
        Object.values(combinedRecords).forEach(record => {
            console.log(`[DEBUG] Record: questionId=${record.questionId}, isCorrect=${record.isCorrect}, source=${record.source}`);
        });

        console.log(`✅ [LISTENING HISTORY] User ${userId} - Level ${level} - ${Object.keys(combinedRecords).length} unique records`);
        res.json({ data: combinedRecords });

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