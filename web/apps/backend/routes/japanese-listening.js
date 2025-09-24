// server/routes/japanese-listening.js
console.log('🌟 [JAPANESE LISTENING ROUTES] Japanese listening routes file loaded!');
const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prismaClient');
const authMiddleware = require('../middleware/auth');

// 모든 요청 로깅 미들웨어
router.use((req, res, next) => {
    console.log(`🔗🚨 [JAPANESE LISTENING ROUTER] ${req.method} ${req.path} - ACCESSED!`);
    next();
});

// 일본어 리스닝 답안 제출 및 오답노트 저장
router.post('/submit', async (req, res) => {
    console.log('🚨🚨🚨 [JAPANESE LISTENING SUBMIT] API CALLED! 🚨🚨🚨');
    console.log(`🚀🎯 [JAPANESE LISTENING SUBMIT] 답안 제출 시작!`);
    console.log(`📝🎯 [REQUEST BODY]`, req.body);
    console.log(`🔐🎯 [REQ.USER]`, req.user);

    try {
        const {
            questionId, level, isCorrect, userAnswer, correctAnswer,
            question, script, topic, options, audioFile
        } = req.body;

        // JWT 토큰에서 사용자 ID 추출 (cross-origin 환경 지원)
        const jwt = require('jsonwebtoken');
        let userId = null;

        try {
            // Authorization 헤더에서 토큰 확인
            const authHeader = req.headers.authorization;
            let token = null;

            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7);
            } else if (req.cookies && req.cookies.token) {
                // 쿠키에서 토큰 확인 (fallback)
                token = req.cookies.token;
            }

            if (token) {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                userId = decoded.userId || decoded.id;
            }
        } catch (error) {
            console.log('[JAPANESE LISTENING SUBMIT] Token verification failed, continuing without user');
        }

        if (!userId) {
            console.log('❌🎯 [AUTH ERROR] No userId found in req.user');
            return res.status(401).json({ error: 'Authentication required' });
        }

        console.log(`👤🎯 [USER INFO] userId: ${userId}, questionId: ${questionId}, isCorrect: ${isCorrect}`);

        if (!questionId || !level || typeof isCorrect !== 'boolean') {
            console.log(`❌🎯 [VALIDATION ERROR] Missing fields`);
            return res.status(400).json({
                error: 'Missing required fields: questionId, level, isCorrect'
            });
        }

        // itemId 생성 (일본어 리스닝은 7000번대 사용)
        // N3_L_001 -> extract "001" -> convert to number -> add 7000
        const questionNumMatch = questionId.match(/_(\d+)$/);
        if (!questionNumMatch) {
            console.error(`[ERROR] Could not extract number from questionId: "${questionId}"`);
            return res.status(400).json({ error: 'Invalid questionId format - no number found' });
        }

        const questionNum = parseInt(questionNumMatch[1]);
        const itemId = questionNum + 7000; // 일본어 리스닝 전용 ID 범위

        // 기존 기록 찾기 (통합 오답노트 시스템)
        console.log(`🔍 [EXISTING SEARCH] 기존 기록 검색 시작: userId=${userId}, questionId=${questionId}, itemId=${itemId}`);

        const allUserJapaneseListeningRecords = await prisma.wronganswer.findMany({
            where: {
                userId: userId,
                itemType: 'japanese-listening'
            }
        });

        console.log(`📚 [EXISTING SEARCH] 찾은 전체 japanese-listening 기록: ${allUserJapaneseListeningRecords.length}개`);

        const existingRecord = allUserJapaneseListeningRecords.find(record =>
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
            script: script || "스크립트 정보 없음",
            topic: topic || "일본어 리스닝 문제",
            options: options || {},
            audioFile: audioFile || `${level}_Listening_mix/${questionId}.mp3`
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
                        script: recordData.script,
                        topic: recordData.topic,
                        options: recordData.options,
                        audioFile: recordData.audioFile,
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
                    itemType: 'japanese-listening',
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
            console.log(`✅ [JAPANESE LISTENING SUBMIT] User ${userId} - Question ${questionId} - CORRECT (첫 번째 시도) - 오답노트에 저장하지 않음`);
            result = null;
        }

        if (result) {
            console.log(`✅ [JAPANESE LISTENING SUBMIT] User ${userId} - Question ${questionId} - ${isCorrect ? 'CORRECT' : 'WRONG'} - Saved to wronganswer table`);
        }

        res.json({
            success: true,
            data: result,
            message: result
                ? `Japanese listening ${isCorrect ? 'correct' : 'incorrect'} answer saved successfully`
                : `Correct answer recorded (not saved to wrong answer table)`
        });

    } catch (error) {
        console.error('❌ [JAPANESE LISTENING SUBMIT ERROR]:', error);
        res.status(500).json({ error: 'Failed to submit Japanese listening answer' });
    }
});

// GET /japanese-listening/history/:level - 레벨별 학습 기록 조회
console.log('🌟 [JAPANESE LISTENING ROUTES] /history/:level route registered!');
router.get('/history/:level', authMiddleware, async (req, res) => {
    console.log('🚨🚨🚨 [JAPANESE LISTENING HISTORY] API CALLED! 🚨🚨🚨');
    try {
        const { level } = req.params;
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        // 해당 레벨의 모든 일본어 리스닝 학습 기록 조회
        console.log(`🔍 [JAPANESE LISTENING DEBUG] Searching for records: userId=${userId}, level=${level}`);

        // wronganswer 테이블에서 조회
        const wrongAnswerRecords = await prisma.wronganswer.findMany({
            where: {
                userId: userId,
                itemType: 'japanese-listening'
            },
            orderBy: { wrongAt: 'desc' }
        });

        console.log(`🔍 [JAPANESE LISTENING DEBUG] Found ${wrongAnswerRecords.length} wrongAnswer records`);

        // wrongAnswer에서 레벨 필터링
        const filteredWrongRecords = wrongAnswerRecords.filter(record =>
            record.wrongData?.level === level || record.wrongData?.level === level.toUpperCase()
        );

        console.log(`🔍 [JAPANESE LISTENING DEBUG] After level filtering: ${filteredWrongRecords.length} wrongAnswer records`);

        // 데이터 변환
        const combinedRecords = {};

        // wrongAnswer 기록 추가
        filteredWrongRecords.forEach(record => {
            const questionId = record.wrongData?.questionId;
            if (questionId) {
                console.log(`🔍 [JAPANESE LISTENING DEBUG] Adding wrongAnswer: questionId=${questionId}, isCorrect=${record.wrongData?.isCorrect}`);
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

        console.log(`🔍 [JAPANESE LISTENING DEBUG] Combined ${Object.keys(combinedRecords).length} unique Japanese listening records for user ${userId}, level ${level}`);
        Object.values(combinedRecords).forEach(record => {
            console.log(`🔍 [JAPANESE LISTENING DEBUG] Final record: questionId=${record.questionId}, isCorrect=${record.isCorrect}, source=${record.source}`);
        });

        console.log(`✅ [JAPANESE LISTENING HISTORY] User ${userId} - Level ${level} - ${Object.keys(combinedRecords).length} unique records`);
        return res.json({ data: combinedRecords });

    } catch (e) {
        console.error(`❌ [JAPANESE LISTENING HISTORY ERROR] GET /japanese-listening/history/${req.params.level} Error:`, e);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 별칭으로 /record 엔드포인트 추가 (기존 프론트엔드 코드 호환성을 위해)
router.post('/record', async (req, res) => {
    console.log('🚨🚨🚨 [JAPANESE LISTENING RECORD] API CALLED (alias for /submit)! 🚨🚨🚨');

    try {
        const {
            questionId, level, isCorrect, userAnswer, correctAnswer,
            question, script, topic, options, audioFile
        } = req.body;

        const userId = req.user.userId || req.user.id;

        if (!userId) {
            console.log('❌🎯 [AUTH ERROR] No userId found in req.user');
            return res.status(401).json({ error: 'Authentication required' });
        }

        console.log(`👤🎯 [USER INFO] userId: ${userId}, questionId: ${questionId}, isCorrect: ${isCorrect}`);

        if (!questionId || !level || typeof isCorrect !== 'boolean') {
            console.log(`❌🎯 [VALIDATION ERROR] Missing fields`);
            return res.status(400).json({
                error: 'Missing required fields: questionId, level, isCorrect'
            });
        }

        // itemId 생성 (일본어 리스닝은 7000번대 사용)
        const questionNumMatch = questionId.match(/_(\d+)$/);
        if (!questionNumMatch) {
            console.error(`[ERROR] Could not extract number from questionId: "${questionId}"`);
            return res.status(400).json({ error: 'Invalid questionId format - no number found' });
        }

        const questionNum = parseInt(questionNumMatch[1]);
        const itemId = questionNum + 7000;

        // 기존 기록 찾기
        console.log(`🔍 [EXISTING SEARCH] 기존 기록 검색 시작: userId=${userId}, questionId=${questionId}, itemId=${itemId}`);

        const allUserJapaneseListeningRecords = await prisma.wronganswer.findMany({
            where: {
                userId: userId,
                itemType: 'japanese-listening'
            }
        });

        const existingRecord = allUserJapaneseListeningRecords.find(record =>
            record.itemId === itemId ||
            (record.wrongData && record.wrongData.questionId === questionId)
        );

        const now = new Date();
        const recordData = {
            questionId: questionId,
            level: level,
            isCorrect: isCorrect,
            userAnswer: userAnswer,
            correctAnswer: correctAnswer,
            recordedAt: now.toISOString(),
            question: question || "질문 정보 없음",
            script: script || "스크립트 정보 없음",
            topic: topic || "일본어 리스닝 문제",
            options: options || {},
            audioFile: audioFile || `${level}_Listening_mix/${questionId}.mp3`
        };

        let result;
        if (existingRecord) {
            // 기존 기록의 통계 계산
            const currentWrongData = existingRecord.wrongData || {};
            const correctCount = (currentWrongData.correctCount || 0) + (isCorrect ? 1 : 0);
            const incorrectCount = (currentWrongData.incorrectCount || 0) + (isCorrect ? 0 : 1);
            const totalAttempts = existingRecord.attempts + 1;

            result = await prisma.wronganswer.update({
                where: { id: existingRecord.id },
                data: {
                    attempts: totalAttempts,
                    wrongAt: now,
                    wrongData: {
                        ...currentWrongData,
                        ...recordData,
                        isCorrect: isCorrect,
                        correctCount: correctCount,
                        incorrectCount: incorrectCount,
                        totalAttempts: totalAttempts,
                        lastResult: isCorrect ? 'correct' : 'incorrect'
                    },
                    isCompleted: isCorrect,
                    reviewWindowStart: now,
                    reviewWindowEnd: new Date(now.getTime() + 24 * 60 * 60 * 1000)
                }
            });
        } else if (!isCorrect) {
            // 오답인 경우 새 기록 생성
            result = await prisma.wronganswer.create({
                data: {
                    userId: userId,
                    itemType: 'japanese-listening',
                    itemId: itemId,
                    attempts: 1,
                    wrongAt: now,
                    wrongData: {
                        ...recordData,
                        correctCount: 0,
                        incorrectCount: 1,
                        totalAttempts: 1,
                        lastResult: 'incorrect'
                    },
                    isCompleted: false,
                    reviewWindowStart: now,
                    reviewWindowEnd: new Date(now.getTime() + 24 * 60 * 60 * 1000)
                }
            });
        } else {
            // 정답이고 기존 기록이 없는 경우
            console.log(`✅ [JAPANESE LISTENING RECORD] User ${userId} - Question ${questionId} - CORRECT (첫 번째 시도) - 오답노트에 저장하지 않음`);
            result = null;
        }

        if (result) {
            console.log(`✅ [JAPANESE LISTENING RECORD] User ${userId} - Question ${questionId} - ${isCorrect ? 'CORRECT' : 'WRONG'} - Saved to wronganswer table`);
        }

        res.json({
            success: true,
            data: result,
            message: result
                ? `Japanese listening ${isCorrect ? 'correct' : 'incorrect'} answer recorded successfully`
                : `Correct answer recorded (not saved to wrong answer table)`
        });

    } catch (error) {
        console.error('❌ [JAPANESE LISTENING RECORD ERROR]:', error);
        res.status(500).json({ error: 'Failed to record Japanese listening answer' });
    }
});

module.exports = router;