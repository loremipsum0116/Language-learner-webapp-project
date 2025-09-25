// server/routes/reading.js
console.log('🌟 [READING ROUTES] Reading routes file loaded!');
const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prismaClient');
const authMiddleware = require('../middleware/auth');

// 간단한 테스트 엔드포인트
router.get('/test', (req, res) => {
    console.log('🚨🚨🚨 [READING TEST] API CALLED! 🚨🚨🚨');
    res.json({ message: 'Reading API is working!', timestamp: new Date() });
});

// GET /reading/list
console.log('🌟 [READING ROUTES] /list route registered!');
router.get('/list', async (req, res) => {
    console.log('🚨🚨🚨 [READING LIST] API CALLED! 🚨🚨🚨');
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

        // 지문별로 문제 그룹화
        const passageGroups = new Map();

        readings.forEach((reading) => {
            const passage = reading.glosses?.fullPassage || reading.glosses?.passage || reading.body;

            if (!passageGroups.has(passage)) {
                passageGroups.set(passage, []);
            }

            passageGroups.get(passage).push({
                dbId: reading.id,
                question: reading.glosses?.question || reading.question || 'No question',
                options: reading.glosses?.options || reading.options || {},
                correctAnswer: reading.glosses?.correctAnswer || reading.glosses?.answer || reading.answer || 'A',
                explanation: reading.glosses?.explanation || reading.glosses?.explanation_ko || reading.explanation_ko || 'No explanation'
            });
        });

        // 그룹화된 문제들을 변환
        const questions = [];
        let questionIndex = 1;

        for (const [passage, groupedQuestions] of passageGroups) {
            if (groupedQuestions.length === 1) {
                // 단일 문제인 경우 기존 방식
                questions.push({
                    id: `${level}_R_${String(questionIndex).padStart(3, '0')}`,
                    dbId: groupedQuestions[0].dbId,
                    passage: passage,
                    question: groupedQuestions[0].question,
                    options: groupedQuestions[0].options,
                    correctAnswer: groupedQuestions[0].correctAnswer,
                    explanation: groupedQuestions[0].explanation,
                    isMultiQuestion: false
                });
                questionIndex++;
            } else {
                // 복수 문제인 경우 그룹으로 처리
                questions.push({
                    id: `${level}_R_${String(questionIndex).padStart(3, '0')}`,
                    dbIds: groupedQuestions.map(q => q.dbId),
                    passage: passage,
                    questions: groupedQuestions.map((q, idx) => ({
                        questionNumber: idx + 1,
                        question: q.question,
                        options: q.options,
                        correctAnswer: q.correctAnswer,
                        explanation: q.explanation
                    })),
                    isMultiQuestion: true,
                    totalQuestions: groupedQuestions.length
                });
                questionIndex++;
            }
        }

        return res.json({ data: questions });
    } catch (e) {
        console.error(`GET /reading/practice/${req.params.level} Error:`, e);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 리딩 문제 해결 기록 저장 (통합 오답노트 시스템 사용)
console.log('🌟 [READING ROUTER] /record route registered!');
router.post('/record', async (req, res) => {
    console.log('🚨🚨🚨 [READING RECORD] API CALLED! 🚨🚨🚨');
    try {
        console.log(`🚀🎯 [READING RECORD START] 기록 저장 시작!`);
        console.log(`📝🎯 [REQUEST BODY]`, req.body);
        
        const {
            questionId, level, isCorrect, userAnswer, correctAnswer, timeTaken,
            question, passage, options, explanation
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
            console.log('[READING RECORD] Token verification failed, continuing without user');
        }

        if (!userId) {
            console.log('❌🎯 [AUTH ERROR] No userId found');
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        console.log(`👤🎯 [USER INFO] userId: ${userId}, questionId: ${questionId}, isCorrect: ${isCorrect}`);
        console.log(`🔍🎯 [FIELD DEBUG] question: "${question}", passage: "${passage ? passage.substring(0,50) + '...' : 'null'}"`);
        console.log(`🔍🎯 [FIELD TYPES] question type: ${typeof question}, passage type: ${typeof passage}`);

        if (!questionId || !level || typeof isCorrect !== 'boolean') {
            console.log(`❌🎯 [VALIDATION ERROR] Missing fields`);
            return res.status(400).json({ 
                error: 'Missing required fields: questionId, level, isCorrect' 
            });
        }

        // itemId 생성 (리딩은 1000번대)
        // A1_R_001 -> extract "001" -> convert to number -> add 1000
        const questionNumMatch = questionId.match(/_(\d+)$/);
        if (!questionNumMatch) {
            console.error(`[ERROR] Could not extract number from questionId: "${questionId}"`);
            return res.status(400).json({ error: 'Invalid questionId format - no number found' });
        }
        
        const questionNum = parseInt(questionNumMatch[1]);
        const itemId = questionNum + 1000;
        
        // 기존 기록 찾기 (통합 오답노트 시스템)
        // questionId 기반으로 더 정확한 중복 검사
        console.log(`🔍 [EXISTING SEARCH] 기존 기록 검색 시작: userId=${userId}, questionId=${questionId}, itemId=${itemId}`);
        
        const allUserReadingRecords = await prisma.wronganswer.findMany({
            where: {
                userId: userId,
                itemType: 'reading'
            }
        });
        
        console.log(`📚 [EXISTING SEARCH] 찾은 전체 reading 기록: ${allUserReadingRecords.length}개`);
        allUserReadingRecords.forEach((record, index) => {
            console.log(`📝 [RECORD ${index}] itemId: ${record.itemId}, questionId: ${record.wrongData?.questionId}, id: ${record.id}`);
        });
        
        const existingRecord = allUserReadingRecords.find(record => 
            record.itemId === itemId || 
            (record.wrongData && record.wrongData.questionId === questionId)
        );

        console.log(`🎯 [EXISTING FOUND] 기존 기록 매칭 결과:`, existingRecord ? `found (id: ${existingRecord.id})` : 'not found');

        // readingRecord 테이블에서도 기존 기록 찾기 (정답 횟수 보존을 위해)
        const existingReadingRecord = await prisma.readingRecord.findFirst({
            where: {
                userId,
                questionId: String(questionNum - 1),
                level
            }
        });
        
        console.log(`📖 [LEGACY SEARCH] readingRecord 기록:`, existingReadingRecord ? `found (id: ${existingReadingRecord.id}, isCorrect: ${existingReadingRecord.isCorrect})` : 'not found');

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
                    wrongAt: finalTime, // 마지막 학습 시간으로 변경 (KST)
                    wrongData: {
                        ...currentWrongData, // 기존 데이터 먼저 보존
                        // recordData에서 통계에 영향주지 않는 필드만 추가
                        questionId: recordData.questionId,
                        level: recordData.level,
                        userAnswer: recordData.userAnswer,
                        correctAnswer: recordData.correctAnswer,
                        timeTaken: recordData.timeTaken,
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
            // 오답인 경우 새 기록 생성 (기존 readingRecord의 모든 기록 고려)
            // readingRecord에서 해당 문제의 총 시도 횟수를 조회
            const allReadingRecordsForQuestion = await prisma.readingRecord.findMany({
                where: {
                    userId: userId,
                    questionId: String(questionNum - 1),
                    level: level
                }
            });
            
            // 총 시도 횟수와 정답/오답 횟수 계산
            let totalCorrectCount = 0;
            let totalIncorrectCount = 0;
            let totalAttempts = allReadingRecordsForQuestion.length;
            
            allReadingRecordsForQuestion.forEach(record => {
                if (record.isCorrect) {
                    totalCorrectCount++;
                } else {
                    totalIncorrectCount++;
                }
            });
            
            // 현재 오답 추가
            totalIncorrectCount += 1;
            totalAttempts += 1;
            
            console.log(`📝 [NEW WRONG RECORD] 기존 readingRecord 통계 - 정답: ${totalCorrectCount}회, 오답: ${totalIncorrectCount}회, 총 시도: ${totalAttempts}회`);
            
            result = await prisma.wronganswer.create({
                data: {
                    userId: userId,
                    itemType: 'reading',
                    itemId: itemId,
                    attempts: totalAttempts, // 총 시도 횟수 (기존 + 현재)
                    wrongAt: finalTime,
                    wrongData: {
                        ...recordData,
                        correctCount: totalCorrectCount, // 총 정답 기록
                        incorrectCount: totalIncorrectCount, // 총 오답 기록 (현재 포함)
                        totalAttempts: totalAttempts,
                        lastResult: 'incorrect'
                    },
                    isCompleted: false, // 오답이므로 미완료
                    reviewWindowStart: finalTime,
                    reviewWindowEnd: new Date(finalTime.getTime() + 24 * 60 * 60 * 1000)
                }
            });
        } else if (existingReadingRecord) {
            // 정답이지만 기존에 readingRecord에 기록이 있는 경우 - wronganswer 테이블에 통합 기록 생성
            // readingRecord에서 해당 문제의 총 시도 횟수를 조회
            const allReadingRecordsForQuestion = await prisma.readingRecord.findMany({
                where: {
                    userId: userId,
                    questionId: String(questionNum - 1),
                    level: level
                }
            });
            
            // 총 시도 횟수와 정답/오답 횟수 계산
            let totalCorrectCount = 0;
            let totalIncorrectCount = 0;
            let totalAttempts = allReadingRecordsForQuestion.length;
            
            allReadingRecordsForQuestion.forEach(record => {
                if (record.isCorrect) {
                    totalCorrectCount++;
                } else {
                    totalIncorrectCount++;
                }
            });
            
            // 현재 정답 추가
            totalCorrectCount += 1;
            totalAttempts += 1;
            
            console.log(`✅ [READING RECORD] 정답 + 기존 기록 있음 - 통계: 정답: ${totalCorrectCount}회, 오답: ${totalIncorrectCount}회, 총 시도: ${totalAttempts}회`);
            result = await prisma.wronganswer.create({
                data: {
                    userId: userId,
                    itemType: 'reading',
                    itemId: itemId,
                    attempts: totalAttempts, // 총 시도 횟수
                    wrongAt: finalTime,
                    wrongData: {
                        ...recordData,
                        correctCount: totalCorrectCount, // 총 정답 기록 (현재 포함)
                        incorrectCount: totalIncorrectCount, // 총 오답 기록
                        totalAttempts: totalAttempts,
                        lastResult: 'correct'
                    },
                    isCompleted: true, // 정답이므로 완료
                    reviewWindowStart: finalTime,
                    reviewWindowEnd: new Date(finalTime.getTime() + 24 * 60 * 60 * 1000)
                }
            });
        } else {
            // 정답이고 기존 기록이 없는 경우 - 첫 번째 정답도 통계로 기록
            console.log(`✅ [READING RECORD] User ${userId} - Question ${questionId} - CORRECT (첫 번째 시도) - 통계 기록 생성`);

            result = await prisma.wronganswer.create({
                data: {
                    userId: userId,
                    itemType: 'reading',
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

        // 기존 readingRecord 테이블에도 호환성을 위해 저장 (선택적)
        try {
            console.log(`🔍 [READING LEGACY] Saving to readingRecord: userId=${userId}, questionIndex=${questionNum - 1}, level=${level}`);
            
            const existingReadingRecord = await prisma.readingRecord.findFirst({
                where: {
                    userId,
                    questionId: String(questionNum - 1), // readingRecord는 questionId 필드 사용
                    level
                }
            });

            if (existingReadingRecord) {
                console.log(`🔍 [READING LEGACY] Updating existing readingRecord: id=${existingReadingRecord.id}`);
                await prisma.readingRecord.update({
                    where: { id: existingReadingRecord.id },
                    data: {
                        isCorrect,
                        userAnswer: String(userAnswer),
                        correctAnswer: String(correctAnswer),
                        solvedAt: finalTime
                    }
                });
            } else {
                console.log(`🔍 [READING LEGACY] Creating new readingRecord`);
                await prisma.readingRecord.create({
                    data: {
                        userId,
                        questionId: String(questionNum - 1), // questionId 필드 사용
                        level,
                        isCorrect,
                        userAnswer: String(userAnswer),
                        correctAnswer: String(correctAnswer),
                        solvedAt: finalTime
                    }
                });
            }
            console.log(`✅ [READING LEGACY] Successfully saved to readingRecord table`);
        } catch (legacyError) {
            console.warn('❌ [READING LEGACY] Legacy readingRecord 저장 실패:', legacyError.message);
        }

        if (result) {
            console.log(`✅ [READING RECORD] User ${userId} - Question ${questionId} - ${isCorrect ? 'CORRECT' : 'WRONG'} - Saved to wronganswer table`);
        }
        res.json({ 
            success: true, 
            data: result,
            message: result 
                ? `Reading record ${isCorrect ? 'correct' : 'incorrect'} saved successfully` 
                : `Correct answer recorded (not saved to wrong answer table)`
        });

    } catch (error) {
        console.error('❌ [READING RECORD ERROR]:', error);
        res.status(500).json({ error: 'Failed to save reading record' });
    }
});

// GET /reading/history/:level - 레벨별 학습 기록 조회
console.log('🌟 [READING ROUTES] /history/:level route registered!');
router.get('/history/:level', authMiddleware, async (req, res) => {
    console.log('🚨🚨🚨 [READING HISTORY] API CALLED! 🚨🚨🚨');
    try {
        const { level } = req.params;
        const userId = req.user?.id;
        
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        // 해당 레벨의 모든 리딩 학습 기록 조회 (두 테이블 모두 확인)
        console.log(`🔍 [READING DEBUG] Searching for reading records: userId=${userId}, level=${level}`);
        
        // 1. wronganswer 테이블에서 조회
        const wrongAnswerRecords = await prisma.wronganswer.findMany({
            where: {
                userId: userId,
                itemType: 'reading'
            },
            orderBy: { wrongAt: 'desc' }
        });
        
        // 2. readingRecord 테이블에서도 조회 (삭제된 항목들의 학습 기록)
        const readingRecords = await prisma.readingRecord.findMany({
            where: {
                userId: userId,
                level: level
            },
            orderBy: { solvedAt: 'desc' }
        });
        
        console.log(`🔍 [READING DEBUG] Found ${wrongAnswerRecords.length} wrongAnswer records, ${readingRecords.length} readingRecord records`);
        
        // wrongAnswer에서 레벨 필터링
        const filteredWrongRecords = wrongAnswerRecords.filter(record => 
            record.wrongData?.level === level || record.wrongData?.level === level.toUpperCase()
        );
        
        console.log(`🔍 [READING DEBUG] After level filtering: ${filteredWrongRecords.length} wrongAnswer records`);
        
        // 두 테이블의 데이터를 통합
        const combinedRecords = {};
        
        // wrongAnswer 기록 우선 추가
        filteredWrongRecords.forEach(record => {
            const questionId = record.wrongData?.questionId;
            if (questionId) {
                console.log(`🔍 [READING DEBUG] Adding wrongAnswer: questionId=${questionId}, isCorrect=${record.wrongData?.isCorrect}`);
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
        
        // readingRecord 기록 추가 (wrongAnswer에 없는 것만)
        readingRecords.forEach(record => {
            // readingRecord의 questionId를 표준 형태로 변환
            const questionIndex = parseInt(record.questionId); // questionId는 "0", "1", "2" 형태
            const questionId = `${level}_R_${String(questionIndex + 1).padStart(3, '0')}`;
            if (!combinedRecords[questionId]) {
                console.log(`🔍 [READING DEBUG] Adding readingRecord: questionId=${record.questionId} -> standardId=${questionId}, isCorrect=${record.isCorrect}`);
                
                // 백업된 통계가 있는지 확인 (userAnswer 필드에서)
                let backupStats = null;
                if (record.userAnswer?.startsWith('STATS:')) {
                    try {
                        const statsJson = record.userAnswer.substring(6); // "STATS:" 제거
                        backupStats = JSON.parse(statsJson);
                        console.log(`📊 [READING DEBUG] Found backup stats for ${questionId}:`, backupStats);
                    } catch (e) {
                        console.warn(`❌ [READING DEBUG] Failed to parse backup stats for ${questionId}:`, e);
                    }
                }
                
                combinedRecords[questionId] = {
                    questionId: questionId,
                    isCorrect: record.isCorrect,
                    solvedAt: record.solvedAt ? record.solvedAt.toISOString() : null,
                    isCompleted: record.isCorrect,
                    attempts: backupStats?.totalAttempts || 1,
                    wrongData: {
                        questionId: questionId,
                        isCorrect: record.isCorrect,
                        correctCount: backupStats?.correctCount || (record.isCorrect ? 1 : 0),
                        incorrectCount: backupStats?.incorrectCount || (record.isCorrect ? 0 : 1),
                        totalAttempts: backupStats?.totalAttempts || 1,
                        lastResult: record.isCorrect ? 'correct' : 'incorrect'
                    },
                    source: backupStats ? 'readingRecord+backup' : 'readingRecord'
                };
            }
        });

        console.log(`🔍 [READING DEBUG] Combined ${Object.keys(combinedRecords).length} unique reading records for user ${userId}, level ${level}`);
        Object.values(combinedRecords).forEach(record => {
            console.log(`🔍 [READING DEBUG] Final record: questionId=${record.questionId}, isCorrect=${record.isCorrect}, source=${record.source}`);
        });

        console.log(`✅ [READING HISTORY] User ${userId} - Level ${level} - ${Object.keys(combinedRecords).length} unique records`);
        return res.json({ data: combinedRecords });
        
    } catch (e) {
        console.error(`❌ [READING HISTORY ERROR] GET /reading/history/${req.params.level} Error:`, e);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 임시 디버그 엔드포인트 - readingRecord 테이블 확인
router.get('/debug/records/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const readingRecords = await prisma.readingRecord.findMany({
            where: {
                userId: parseInt(userId)
            },
            orderBy: { solvedAt: 'desc' },
            take: 10
        });
        
        console.log(`🔍 [DEBUG] ReadingRecord table for user ${userId}:`, readingRecords);
        
        res.json({
            userId,
            count: readingRecords.length,
            records: readingRecords
        });
    } catch (e) {
        console.error('Debug endpoint error:', e);
        res.status(500).json({ error: e.message });
    }
});

// GET /reading/translation/:level - 레벨별 번역 데이터 조회
router.get('/translation/:level', async (req, res) => {
    try {
        const { level } = req.params;
        const fs = require('fs').promises;
        const path = require('path');

        // 번역 파일 경로 설정
        const translationPath = path.join(__dirname, `../${level}/${level}_Reading/${level}_Translation.json`);

        // 파일 존재 여부 확인 후 읽기
        try {
            const data = await fs.readFile(translationPath, 'utf8');
            const translations = JSON.parse(data);
            console.log(`✅ [번역 데이터 로드] ${level}: ${translations.length}개 번역 제공`);
            return res.json(translations);
        } catch (fileError) {
            console.warn(`번역 파일 없음: ${translationPath}`);
            return res.json([]);
        }
    } catch (error) {
        console.error(`GET /reading/translation/${req.params.level} Error:`, error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;