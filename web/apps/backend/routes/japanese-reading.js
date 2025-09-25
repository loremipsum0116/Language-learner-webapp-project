// server/routes/japanese-reading.js
console.log('🌟 [JAPANESE READING ROUTES] Japanese reading routes file loaded!');
const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prismaClient');
const authMiddleware = require('../middleware/auth');

// 모든 요청 로깅 미들웨어
router.use((req, res, next) => {
    console.log(`🔗 [JAPANESE READING ROUTER] ${req.method} ${req.path} - ${new Date().toISOString()}`);
    next();
});


// GET /japanese-reading/level/:level - 레벨별 Japanese reading 데이터 개수 조회
router.get('/level/:level', async (req, res) => {
    console.log(`🚨🚨🚨 [JAPANESE READING LEVEL] API CALLED! Level: ${req.params.level} 🚨🚨🚨`);
    console.log(`🔥 [JAPANESE READING LEVEL] Request URL: ${req.originalUrl}`);
    console.log(`🔥 [JAPANESE READING LEVEL] Request method: ${req.method}`);
    try {
        const { level } = req.params;
        // 일본어 리딩 데이터 ID 범위 설정
        let idRangeStart = 6001;
        if (level.toUpperCase() === 'N1') {
            idRangeStart = 6901; // N1은 6901부터 시작
        } else if (level.toUpperCase() === 'N2') {
            idRangeStart = 6601; // N2는 6601부터 시작
        } else if (level.toUpperCase() === 'N3') {
            idRangeStart = 6401; // N3은 6401부터 시작
        } else if (level.toUpperCase() === 'N4') {
            idRangeStart = 6201; // N4는 6201부터 시작
        } else if (level.toUpperCase() === 'N5') {
            idRangeStart = 6001; // N5는 6001부터 시작
        }

        const count = await prisma.reading.count({
            where: {
                levelCEFR: level.toUpperCase(),
                id: {
                    gte: idRangeStart
                }
            }
        });

        console.log(`🔍 [JAPANESE READING] Level: ${level}, ID range start: ${idRangeStart}, Count: ${count}`);
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
        // 일본어 리딩 데이터 ID 범위 설정
        let idRangeStart = 6001;
        if (level.toUpperCase() === 'N1') {
            idRangeStart = 6901; // N1은 6901부터 시작
        } else if (level.toUpperCase() === 'N2') {
            idRangeStart = 6601; // N2는 6601부터 시작
        } else if (level.toUpperCase() === 'N3') {
            idRangeStart = 6401; // N3은 6401부터 시작
        } else if (level.toUpperCase() === 'N4') {
            idRangeStart = 6201; // N4는 6201부터 시작
        } else if (level.toUpperCase() === 'N5') {
            idRangeStart = 6001; // N5는 6001부터 시작
        }

        const readings = await prisma.reading.findMany({
            where: {
                levelCEFR: level.toUpperCase(),
                id: {
                    gte: idRangeStart
                }
            },
            orderBy: { id: 'asc' }
        });

        // 같은 지문의 문제들을 그룹화
        const passageGroups = new Map();
        let passageOrder = 0;

        readings.forEach((reading) => {
            const passage = reading.body; // body 필드가 passage 내용임

            // 지문의 처음 100자를 키로 사용 (완전히 같은 텍스트 매칭 대신)
            let passageKey = passage.substring(0, 100);

            // 기존 그룹 찾기
            let existingKey = null;
            for (const [key, group] of passageGroups) {
                if (group.passage === passage) {
                    existingKey = key;
                    break;
                }
            }

            if (existingKey) {
                // 기존 그룹에 추가
                passageGroups.get(existingKey).questions.push({
                    dbId: reading.id,
                    question: reading.glosses?.question || 'No question',
                    options: reading.glosses?.options || {},
                    correctAnswer: reading.glosses?.correctAnswer || reading.glosses?.answer || 'A',
                    explanation: reading.glosses?.explanation || 'No explanation'
                });
            } else {
                // 새 그룹 생성
                passageOrder++;
                passageGroups.set(passageKey, {
                    passage: passage,
                    order: passageOrder,
                    questions: [{
                        dbId: reading.id,
                        question: reading.glosses?.question || 'No question',
                        options: reading.glosses?.options || {},
                        correctAnswer: reading.glosses?.correctAnswer || reading.glosses?.answer || 'A',
                        explanation: reading.glosses?.explanation || 'No explanation'
                    }]
                });
            }
        });

        // 그룹화된 지문들을 배열로 변환
        const groupedQuestions = Array.from(passageGroups.values())
            .sort((a, b) => a.order - b.order)
            .map((group, index) => ({
                id: `${level}_JR_${String(index + 1).padStart(3, '0')}`,
                passage: group.passage,
                firstDbId: group.questions[0]?.dbId, // 번역 매핑을 위한 첫 번째 문제 DB ID
                questions: group.questions.map((q, qIndex) => ({
                    questionId: `${level}_JR_${String(index + 1).padStart(3, '0')}_Q${qIndex + 1}`,
                    dbId: q.dbId,
                    question: q.question,
                    options: q.options,
                    correctAnswer: q.correctAnswer,
                    explanation: q.explanation
                })),
                isMultiQuestion: group.questions.length > 1
            }));

        console.log(`🔍 [JAPANESE READING] Grouped ${readings.length} questions into ${groupedQuestions.length} passages`);
        groupedQuestions.forEach((group, i) => {
            console.log(`  📖 Passage ${i + 1}: ${group.questions.length} questions`);
        });

        return res.json({ data: groupedQuestions });
    } catch (e) {
        console.error(`GET /japanese-reading/practice/${req.params.level} Error:`, e);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 일본어 리딩 답안 제출 및 오답노트 저장
router.post('/submit', authMiddleware, async (req, res) => {
    console.log('🚨🚨🚨 [JAPANESE READING SUBMIT] API CALLED! 🚨🚨🚨');
    console.log(`🚀🎯 [JAPANESE READING SUBMIT] 답안 제출 시작!`);
    console.log(`📝🎯 [REQUEST BODY]`, req.body);
    console.log(`🔐🎯 [REQ.USER]`, req.user);

    try {

        const {
            questionId, dbId, level, isCorrect, userAnswer, correctAnswer,
            passage, question, options, explanation
        } = req.body;

        // authMiddleware가 설정한 req.user 사용
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

        // itemId로 dbId 직접 사용 (복수 문제 구조에서 더 정확)
        const itemId = dbId || (() => {
            // dbId가 없는 경우 기존 로직 사용 (호환성)
            const questionNumMatch = questionId.match(/_(\d+)(_Q\d+)?$/);
            if (!questionNumMatch) {
                console.error(`[ERROR] Could not extract number from questionId: "${questionId}"`);
                return null;
            }
            const questionNum = parseInt(questionNumMatch[1]);
            return questionNum + 2000;
        })();

        if (!itemId) {
            console.error(`[ERROR] Could not determine itemId for questionId: "${questionId}"`);
            return res.status(400).json({ error: 'Invalid questionId format - no number found' });
        }

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
            // 정답이고 기존 기록이 없는 경우 - 첫 번째 정답도 통계로 기록
            console.log(`✅ [JAPANESE READING SUBMIT] User ${userId} - Question ${questionId} - CORRECT (첫 번째 시도) - 통계 기록 생성`);

            result = await prisma.wronganswer.create({
                data: {
                    userId: userId,
                    itemType: 'japanese-reading',
                    itemId: itemId,
                    attempts: 1, // 첫 시도
                    wrongAt: finalTime,
                    wrongData: {
                        ...recordData,
                        correctCount: 1, // 첫 정답
                        incorrectCount: 0, // 오답 없음
                        totalAttempts: 1,
                        lastResult: 'correct'
                    },
                    isCompleted: true, // 정답이므로 완료
                    reviewWindowStart: finalTime,
                    reviewWindowEnd: new Date(finalTime.getTime() + 24 * 60 * 60 * 1000)
                }
            });
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
router.get('/history/:level', authMiddleware, async (req, res) => {
    console.log('🚨🚨🚨 [JAPANESE READING HISTORY] API CALLED! 🚨🚨🚨');
    try {
        const { level } = req.params;
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        // 해당 레벨의 모든 일본어 리딩 학습 기록 조회
        console.log(`🔍 [JAPANESE READING DEBUG] Searching for records: userId=${userId}, level=${level}`);

        // wronganswer 테이블에서 조회 (개별 문제와 지문 통계 모두)
        const wrongAnswerRecords = await prisma.wronganswer.findMany({
            where: {
                userId: userId,
                itemType: {
                    in: ['japanese-reading', 'japanese-reading-passage']
                }
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
            if (record.itemType === 'japanese-reading-passage') {
                // 지문 통계 (복수 문제)
                const passageId = record.wrongData?.passageId;
                if (passageId) {
                    console.log(`🔍 [PASSAGE DEBUG] Adding passage stats: passageId=${passageId}`);
                    combinedRecords[passageId] = {
                        questionId: passageId,
                        isCorrect: record.wrongData?.isCorrect || record.isCompleted,
                        solvedAt: record.wrongAt.toISOString(),
                        isCompleted: record.isCompleted,
                        attempts: record.attempts,
                        wrongData: record.wrongData,
                        source: 'passage'
                    };
                }
            } else {
                // 개별 문제 기록
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

// 테스트 라우트 추가
router.post('/test-passage', (req, res) => {
    console.log('🔥 [TEST PASSAGE] Route working!');
    res.json({ message: 'Test route working!' });
});

// 복수 문제 지문 단위 통계 제출 및 저장
router.post('/submit-passage', authMiddleware, async (req, res) => {
    console.log('🚨🚨🚨 [PASSAGE SUBMIT] API CALLED! 🚨🚨🚨');
    try {
        const { passageId, level, isCorrect, questionCount, correctCount, passage } = req.body;
        const userId = req.user.userId || req.user.id;

        if (!userId || !passageId || !level || typeof isCorrect !== 'boolean') {
            return res.status(400).json({
                error: 'Missing required fields: passageId, level, isCorrect'
            });
        }

        console.log(`🚀🎯 [PASSAGE SUBMIT] passageId: ${passageId}, isCorrect: ${isCorrect}`);

        // 기존 지문 통계 기록 찾기 - JavaScript 필터링 방식 사용
        const allPassageRecords = await prisma.wronganswer.findMany({
            where: {
                userId: userId,
                itemType: 'japanese-reading-passage'
            }
        });

        const existingRecord = allPassageRecords.find(record =>
            record.wrongData && record.wrongData.passageId === passageId
        );

        const now = new Date();

        if (existingRecord) {
            // 기존 기록 업데이트 - 누적 통계
            const currentData = existingRecord.wrongData || {};
            const newCorrectCount = (currentData.correctCount || 0) + (isCorrect ? 1 : 0);
            const newIncorrectCount = (currentData.incorrectCount || 0) + (isCorrect ? 0 : 1);
            const newTotalAttempts = existingRecord.attempts + 1;

            console.log(`📊 [PASSAGE STATS] Before: correct=${currentData.correctCount || 0}, incorrect=${currentData.incorrectCount || 0}`);
            console.log(`📊 [PASSAGE STATS] After: correct=${newCorrectCount}, incorrect=${newIncorrectCount}`);

            await prisma.wronganswer.update({
                where: { id: existingRecord.id },
                data: {
                    attempts: newTotalAttempts,
                    wrongAt: now,
                    isCompleted: isCorrect,
                    wrongData: {
                        ...currentData,
                        passageId: passageId,
                        level: level,
                        isCorrect: isCorrect,
                        correctCount: newCorrectCount,
                        incorrectCount: newIncorrectCount,
                        totalAttempts: newTotalAttempts,
                        questionCount: questionCount,
                        passage: passage,
                        recordedAt: now.toISOString()
                    }
                }
            });

            console.log(`✅ [PASSAGE SUBMIT] Updated passage stats for ${passageId}`);
        } else {
            // 새 지문 통계 기록 생성
            await prisma.wronganswer.create({
                data: {
                    userId: userId,
                    itemType: 'japanese-reading-passage',
                    itemId: parseInt(passageId.match(/_(\d+)$/)?.[1] || '0', 10), // passageId에서 숫자 추출
                    attempts: 1,
                    wrongAt: now,
                    isCompleted: isCorrect,
                    reviewWindowStart: now,
                    reviewWindowEnd: new Date(now.getTime() + 24 * 60 * 60 * 1000),
                    wrongData: {
                        passageId: passageId,
                        level: level,
                        isCorrect: isCorrect,
                        correctCount: isCorrect ? 1 : 0,
                        incorrectCount: isCorrect ? 0 : 1,
                        totalAttempts: 1,
                        questionCount: questionCount,
                        passage: passage,
                        recordedAt: now.toISOString()
                    }
                }
            });

            console.log(`✅ [PASSAGE SUBMIT] Created new passage stats for ${passageId}`);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('❌ [PASSAGE SUBMIT ERROR]:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;