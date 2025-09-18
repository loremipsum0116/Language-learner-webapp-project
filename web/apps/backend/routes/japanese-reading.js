// server/routes/japanese-reading.js
console.log('🌟 [JAPANESE READING ROUTES] Japanese reading routes file loaded!');
const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prismaClient');
const authMiddleware = require('../middleware/auth');


// GET /japanese-reading/level/:level - 레벨별 Japanese reading 데이터 개수 조회
router.get('/level/:level', async (req, res) => {
    try {
        const { level } = req.params;
        const count = await prisma.reading.count({
            where: {
                levelCEFR: level.toUpperCase(),
                glosses: {
                    path: '$.language',
                    equals: 'japanese'
                }
            }
        });

        return res.json({ level, count, available: count > 0 });
    } catch (e) {
        console.error(`GET /japanese-reading/level/${req.params.level} Error:`, e);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /japanese-reading/practice/:level - 레벨별 Japanese reading 문제들 조회
router.get('/practice/:level', async (req, res) => {
    try {
        const { level } = req.params;
        const readings = await prisma.reading.findMany({
            where: {
                levelCEFR: level.toUpperCase(),
                glosses: {
                    path: '$.language',
                    equals: 'japanese'
                }
            },
            orderBy: { id: 'asc' }
        });

        // glosses에서 문제 형태로 변환
        const questions = readings.map((reading, index) => ({
            id: `${level}_JR_${String(index + 1).padStart(3, '0')}`, // N1_JR_001 형태로 표준화
            dbId: reading.id, // 원본 DB ID 보존
            passage: reading.glosses?.passage || reading.body,
            question: reading.glosses?.question || 'No question',
            options: reading.glosses?.options || {},
            answer: reading.glosses?.answer || 'A',
            explanation_ko: reading.glosses?.explanation || 'No explanation'
        }));

        return res.json({ data: questions });
    } catch (e) {
        console.error(`GET /japanese-reading/practice/${req.params.level} Error:`, e);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 일본어 리딩 답안 제출 및 오답노트 저장
router.post('/submit', async (req, res) => {
    console.log('🚨🚨🚨 [JAPANESE READING SUBMIT] API CALLED! 🚨🚨🚨');
    try {
        console.log(`🚀🎯 [JAPANESE READING SUBMIT] 답안 제출 시작!`);
        console.log(`📝🎯 [REQUEST BODY]`, req.body);

        const {
            questionId, level, isCorrect, userAnswer, correctAnswer,
            passage, question, options, explanation
        } = req.body;
        // 쿠키에서 사용자 ID 추출 (인증 미들웨어 우회)
        const jwt = require('jsonwebtoken');
        let userId = null;

        try {
            const token = req.cookies.token;
            if (token) {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                userId = decoded.userId;
            }
        } catch (error) {
            console.log('Token verification failed, continuing without user');
        }

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        console.log(`👤🎯 [USER INFO] userId: ${userId}, questionId: ${questionId}, isCorrect: ${isCorrect}`);

        if (!questionId || !level || typeof isCorrect !== 'boolean') {
            console.log(`❌🎯 [VALIDATION ERROR] Missing fields`);
            return res.status(400).json({
                error: 'Missing required fields: questionId, level, isCorrect'
            });
        }

        // itemId 생성 (일본어 리딩은 2000번대)
        // N1_JR_001 -> extract "001" -> convert to number -> add 2000
        const questionNumMatch = questionId.match(/_(\d+)$/);
        if (!questionNumMatch) {
            console.error(`[ERROR] Could not extract number from questionId: "${questionId}"`);
            return res.status(400).json({ error: 'Invalid questionId format - no number found' });
        }

        const questionNum = parseInt(questionNumMatch[1]);
        const itemId = questionNum + 2000;

        // 기존 기록 찾기 (통합 오답노트 시스템)
        console.log(`🔍 [EXISTING SEARCH] 기존 기록 검색 시작: userId=${userId}, questionId=${questionId}, itemId=${itemId}`);

        const allUserJapaneseReadingRecords = await prisma.wronganswer.findMany({
            where: {
                userId: userId,
                itemType: 'japanese-reading'
            }
        });

        console.log(`📚 [EXISTING SEARCH] 찾은 전체 japanese-reading 기록: ${allUserJapaneseReadingRecords.length}개`);

        const existingRecord = allUserJapaneseReadingRecords.find(record =>
            record.itemId === itemId ||
            (record.wrongData && record.wrongData.questionId === questionId)
        );

        console.log(`🎯 [EXISTING FOUND] 기존 기록 매칭 결과:`, existingRecord ? `found (id: ${existingRecord.id})` : 'not found');

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
            recordedAt: finalTime.toISOString(),
            // 추가 데이터 포함
            question: question || "질문 정보 없음",
            passage: passage || "지문 정보 없음",
            options: options || {},
            explanation: explanation || ""
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
                    wrongAt: finalTime, // 마지막 학습 시간으로 변경
                    wrongData: {
                        ...currentWrongData, // 기존 데이터 먼저 보존
                        // recordData에서 통계에 영향주지 않는 필드만 추가
                        questionId: recordData.questionId,
                        level: recordData.level,
                        userAnswer: recordData.userAnswer,
                        correctAnswer: recordData.correctAnswer,
                        recordedAt: recordData.recordedAt,
                        question: recordData.question,
                        passage: recordData.passage,
                        options: recordData.options,
                        explanation: recordData.explanation,
                        // 누적 통계는 별도로 계산한 값 사용
                        isCorrect: isCorrect,
                        correctCount: correctCount,
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
            // 오답인 경우 새 기록 생성
            console.log(`📝 [NEW WRONG RECORD] 새로운 오답 기록 생성`);

            result = await prisma.wronganswer.create({
                data: {
                    userId: userId,
                    itemType: 'japanese-reading',
                    itemId: itemId,
                    attempts: 1, // 첫 시도
                    wrongAt: finalTime,
                    wrongData: {
                        ...recordData,
                        correctCount: 0, // 첫 오답이므로 정답 없음
                        incorrectCount: 1, // 첫 오답
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
            console.log(`✅ [JAPANESE READING SUBMIT] User ${userId} - Question ${questionId} - CORRECT (첫 번째 시도) - 오답노트에 저장하지 않음`);
            result = null;
        }

        if (result) {
            console.log(`✅ [JAPANESE READING SUBMIT] User ${userId} - Question ${questionId} - ${isCorrect ? 'CORRECT' : 'WRONG'} - Saved to wronganswer table`);
        }

        res.json({
            success: true,
            data: result,
            message: result
                ? `Japanese reading ${isCorrect ? 'correct' : 'incorrect'} answer saved successfully`
                : `Correct answer recorded (not saved to wrong answer table)`
        });

    } catch (error) {
        console.error('❌ [JAPANESE READING SUBMIT ERROR]:', error);
        res.status(500).json({ error: 'Failed to submit Japanese reading answer' });
    }
});

// GET /japanese-reading/history/:level - 레벨별 학습 기록 조회
console.log('🌟 [JAPANESE READING ROUTES] /history/:level route registered!');
router.get('/history/:level', async (req, res) => {
    console.log('🚨🚨🚨 [JAPANESE READING HISTORY] API CALLED! 🚨🚨🚨');
    try {
        const { level } = req.params;

        // 쿠키에서 사용자 ID 추출 (인증 미들웨어 우회)
        const jwt = require('jsonwebtoken');
        let userId = null;

        try {
            const token = req.cookies.token;
            if (token) {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                userId = decoded.userId;
            }
        } catch (error) {
            console.log('Token verification failed for history request');
        }

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // 해당 레벨의 모든 일본어 리딩 학습 기록 조회
        console.log(`🔍 [JAPANESE READING DEBUG] Searching for records: userId=${userId}, level=${level}`);

        // wronganswer 테이블에서 조회
        const wrongAnswerRecords = await prisma.wronganswer.findMany({
            where: {
                userId: userId,
                itemType: 'japanese-reading'
            },
            orderBy: { wrongAt: 'desc' }
        });

        console.log(`🔍 [JAPANESE READING DEBUG] Found ${wrongAnswerRecords.length} wrongAnswer records`);

        // wrongAnswer에서 레벨 필터링
        const filteredWrongRecords = wrongAnswerRecords.filter(record =>
            record.wrongData?.level === level || record.wrongData?.level === level.toUpperCase()
        );

        console.log(`🔍 [JAPANESE READING DEBUG] After level filtering: ${filteredWrongRecords.length} wrongAnswer records`);

        // 데이터 변환
        const combinedRecords = {};

        // wrongAnswer 기록 추가
        filteredWrongRecords.forEach(record => {
            const questionId = record.wrongData?.questionId;
            if (questionId) {
                console.log(`🔍 [JAPANESE READING DEBUG] Adding wrongAnswer: questionId=${questionId}, isCorrect=${record.wrongData?.isCorrect}`);
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

        console.log(`🔍 [JAPANESE READING DEBUG] Combined ${Object.keys(combinedRecords).length} unique Japanese reading records for user ${userId}, level ${level}`);
        Object.values(combinedRecords).forEach(record => {
            console.log(`🔍 [JAPANESE READING DEBUG] Final record: questionId=${record.questionId}, isCorrect=${record.isCorrect}, source=${record.source}`);
        });

        console.log(`✅ [JAPANESE READING HISTORY] User ${userId} - Level ${level} - ${Object.keys(combinedRecords).length} unique records`);
        return res.json({ data: combinedRecords });

    } catch (e) {
        console.error(`❌ [JAPANESE READING HISTORY ERROR] GET /japanese-reading/history/${req.params.level} Error:`, e);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;