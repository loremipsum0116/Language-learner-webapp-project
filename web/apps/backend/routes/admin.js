// server/routes/admin.js
const express = require('express');
const router = express.Router();
const { ok, fail } = require('../lib/resp');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const { prisma } = require('../lib/prismaClient');
const multer = require('multer');
const { parse } = require('csv-parse');
const fs = require('fs');
const path = require('path');

// multer 설정 - 메모리 저장
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB 제한
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['text/csv', 'application/json', 'text/plain'];
    if (allowedMimes.includes(file.mimetype) || 
        file.originalname.endsWith('.csv') || 
        file.originalname.endsWith('.json')) {
      cb(null, true);
    } else {
      cb(new Error('지원되지 않는 파일 형식입니다.'), false);
    }
  }
});

// GET /admin/dashboard/overview - Super Admin 대시보드 개요 정보
router.get('/dashboard/overview', auth, adminOnly, async (req, res) => {
    try {
        const [totalUsers, activeUsers, totalCards, pendingReports] = await Promise.all([
            prisma.user.count(),
            prisma.user.count({
                where: {
                    lastStudiedAt: {
                        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                    }
                }
            }),
            prisma.srscard.count(),
            prisma.cardReport.count({
                where: { status: 'PENDING' }
            })
        ]);

        // 학습 완료율 계산 (예시)
        const completionRate = totalCards > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0;

        return ok(res, {
            totalUsers,
            activeUsers,
            totalCards,
            pendingReports,
            completionRate
        });
    } catch (e) {
        console.error('[ADMIN] Dashboard overview error:', e);
        return fail(res, 500, 'Failed to load dashboard overview');
    }
});

// GET /admin/dashboard - 관리자 대시보드 정보
router.get('/dashboard', auth, adminOnly, async (req, res) => {
    try {
        // 시스템 통계 조회
        const [
            userCount,
            totalSrsCardCount,
            activeSrsCardCount,
            totalWrongAnswerCount,
            activeWrongAnswerCount,
            vocabularyCount,
            overdueCardCount
        ] = await Promise.all([
            prisma.user.count(),
            prisma.srscard.count(),
            prisma.srscard.count({
                where: {
                    OR: [
                        { stage: { gt: 0 } },
                        { correctTotal: { gt: 0 } },
                        { wrongTotal: { gt: 0 } }
                    ]
                }
            }),
            prisma.wronganswer.count(),
            prisma.wronganswer.count({
                where: {
                    isCompleted: false,
                    reviewWindowStart: { lte: new Date() },
                    reviewWindowEnd: { gte: new Date() }
                }
            }),
            prisma.vocab.count(),
            prisma.srscard.count({ where: { isOverdue: true } })
        ]);

        // 최근 등록된 사용자 (5명)
        const recentUsers = await prisma.user.findMany({
            take: 5,
            orderBy: { id: 'desc' },
            select: {
                id: true,
                email: true,
                createdAt: true
            }
        });

        // 시간 오프셋 정보
        const { getTimeOffset, getOffsetDate } = require('./timeMachine');
        const currentOffset = getTimeOffset();
        const originalTime = new Date();
        const offsetTime = getOffsetDate(originalTime);

        return ok(res, {
            stats: {
                userCount,
                srsCardCount: activeSrsCardCount,
                totalSrsCardCount,
                wrongAnswerCount: activeWrongAnswerCount,
                totalWrongAnswerCount,
                vocabularyCount,
                overdueCardCount
            },
            recentUsers,
            timeMachine: {
                dayOffset: currentOffset,
                originalTime: originalTime.toISOString(),
                offsetTime: offsetTime.toISOString(),
                isActive: currentOffset !== 0
            }
        });
    } catch (e) {
        console.error('[ADMIN] Dashboard error:', e);
        return fail(res, 500, 'Failed to load admin dashboard');
    }
});

// GET /admin/users - 사용자 목록
router.get('/users', auth, adminOnly, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 20);
        const skip = (page - 1) * limit;

        const [users, totalCount] = await Promise.all([
            prisma.user.findMany({
                skip,
                take: limit,
                orderBy: { id: 'desc' },
                select: {
                    id: true,
                    email: true,
                    username: true,
                    createdAt: true,
                    _count: {
                        select: {
                            srsCards: true,
                            wrongAnswers: true
                        }
                    }
                }
            }),
            prisma.user.count()
        ]);

        return ok(res, {
            users,
            pagination: {
                page,
                limit,
                totalCount,
                totalPages: Math.ceil(totalCount / limit),
                hasNext: skip + limit < totalCount,
                hasPrev: page > 1
            }
        });
    } catch (e) {
        console.error('[ADMIN] Users list error:', e);
        return fail(res, 500, 'Failed to load users');
    }
});

// GET /admin/system-logs - 시스템 로그 (간단한 구현)
router.get('/system-logs', auth, adminOnly, async (req, res) => {
    try {
        // 실제 로그 시스템이 있다면 여기서 조회
        // 현재는 기본적인 정보만 제공
        const logs = [
            {
                timestamp: new Date().toISOString(),
                level: 'INFO',
                message: 'Admin dashboard accessed',
                user: req.user.email
            }
        ];

        return ok(res, { logs });
    } catch (e) {
        console.error('[ADMIN] System logs error:', e);
        return fail(res, 500, 'Failed to load system logs');
    }
});

// POST /admin/cleanup-data - 데이터 정리
router.post('/cleanup-data', auth, adminOnly, async (req, res) => {
    try {
        const { type } = req.body;

        let result = { message: 'No action taken' };

        switch (type) {
            case 'orphaned_wrong_answers':
                // 폴더가 없는 오답노트 정리
                const orphanedCount = await prisma.wronganswer.deleteMany({
                    where: {
                        vocabId: {
                            notIn: await prisma.srscard.findMany({
                                select: { itemId: true },
                                where: { itemType: 'vocab' }
                            }).then(cards => cards.map(c => c.itemId))
                        }
                    }
                });
                result = { message: `Deleted ${orphanedCount.count} orphaned wrong answers` };
                break;

            case 'old_sessions':
                // 오래된 세션 정리 (실제 세션 테이블이 있다면)
                result = { message: 'Session cleanup not implemented' };
                break;

            default:
                return fail(res, 400, 'Invalid cleanup type');
        }

        console.log(`[ADMIN] Data cleanup performed by ${req.user.email}: ${result.message}`);
        return ok(res, result);
    } catch (e) {
        console.error('[ADMIN] Data cleanup error:', e);
        return fail(res, 500, 'Failed to cleanup data');
    }
});

// POST /admin/upload/vocab - 어휘 CSV 업로드
router.post('/upload/vocab', auth, adminOnly, upload.single('vocabFile'), async (req, res) => {
    try {
        if (!req.file) {
            return fail(res, 400, 'CSV 파일이 필요합니다.');
        }

        const csvContent = req.file.buffer.toString('utf-8');
        const records = parse(csvContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true
        });

        console.log(`[ADMIN] Processing ${records.length} vocabulary records`);
        
        let insertCount = 0;
        let updateCount = 0;
        let errorCount = 0;
        const errors = [];

        for (let i = 0; i < records.length; i++) {
            const record = records[i];
            try {
                // 필수 필드 검증
                if (!record.lemma || !record.pos || !record.levelCEFR) {
                    errors.push(`Row ${i + 1}: Missing required fields (lemma, pos, levelCEFR)`);
                    errorCount++;
                    continue;
                }

                // 중복 확인 및 upsert
                const existing = await prisma.vocab.findUnique({
                    where: {
                        lemma_pos: {
                            lemma: record.lemma,
                            pos: record.pos
                        }
                    }
                });

                const vocabData = {
                    lemma: record.lemma,
                    pos: record.pos,
                    plural: record.plural || null,
                    levelCEFR: record.levelCEFR,
                    freq: record.freq ? parseInt(record.freq) : null,
                    source: record.source || 'admin_upload'
                };

                if (existing) {
                    await prisma.vocab.update({
                        where: { id: existing.id },
                        data: vocabData
                    });
                    updateCount++;
                } else {
                    await prisma.vocab.create({
                        data: vocabData
                    });
                    insertCount++;
                }

            } catch (error) {
                console.error(`[ADMIN] Error processing row ${i + 1}:`, error);
                errors.push(`Row ${i + 1}: ${error.message}`);
                errorCount++;
            }
        }

        console.log(`[ADMIN] Vocab upload completed by ${req.user.email}: ${insertCount} inserted, ${updateCount} updated, ${errorCount} errors`);
        
        return ok(res, {
            message: `어휘 업로드 완료: ${insertCount}개 추가, ${updateCount}개 업데이트`,
            stats: { insertCount, updateCount, errorCount, totalProcessed: records.length },
            errors: errors.slice(0, 10) // 최대 10개 에러만 반환
        });

    } catch (e) {
        console.error('[ADMIN] Vocab upload error:', e);
        return fail(res, 500, 'Failed to upload vocabulary data');
    }
});

// POST /admin/upload/grammar - 문법 JSON 업로드
router.post('/upload/grammar', auth, adminOnly, upload.single('grammarFile'), async (req, res) => {
    try {
        if (!req.file) {
            return fail(res, 400, 'JSON 파일이 필요합니다.');
        }

        const jsonContent = req.file.buffer.toString('utf-8');
        const data = JSON.parse(jsonContent);

        if (!Array.isArray(data)) {
            return fail(res, 400, 'JSON 파일은 배열 형태여야 합니다.');
        }

        console.log(`[ADMIN] Processing ${data.length} grammar items`);
        
        let insertCount = 0;
        let updateCount = 0;
        let errorCount = 0;
        const errors = [];

        for (let i = 0; i < data.length; i++) {
            const item = data[i];
            try {
                if (item.topicId && item.topic && item.levelCEFR && item.items) {
                    // GrammarExercise 테이블에 저장
                    const existing = await prisma.grammarexercise.findUnique({
                        where: { topicId: item.topicId }
                    });

                    const exerciseData = {
                        topicId: item.topicId,
                        topic: item.topic,
                        levelCEFR: item.levelCEFR,
                        items: item.items
                    };

                    if (existing) {
                        await prisma.grammarexercise.update({
                            where: { topicId: item.topicId },
                            data: exerciseData
                        });
                        updateCount++;
                    } else {
                        await prisma.grammarexercise.create({
                            data: exerciseData
                        });
                        insertCount++;
                    }
                } else if (item.topic && item.rule && item.examples) {
                    // GrammarItem 테이블에 저장
                    await prisma.grammaritem.create({
                        data: {
                            topic: item.topic,
                            rule: item.rule,
                            examples: item.examples
                        }
                    });
                    insertCount++;
                } else {
                    errors.push(`Item ${i + 1}: Missing required fields`);
                    errorCount++;
                }

            } catch (error) {
                console.error(`[ADMIN] Error processing grammar item ${i + 1}:`, error);
                errors.push(`Item ${i + 1}: ${error.message}`);
                errorCount++;
            }
        }

        console.log(`[ADMIN] Grammar upload completed by ${req.user.email}: ${insertCount} inserted, ${updateCount} updated, ${errorCount} errors`);
        
        return ok(res, {
            message: `문법 업로드 완료: ${insertCount}개 추가, ${updateCount}개 업데이트`,
            stats: { insertCount, updateCount, errorCount, totalProcessed: data.length },
            errors: errors.slice(0, 10)
        });

    } catch (e) {
        console.error('[ADMIN] Grammar upload error:', e);
        return fail(res, 500, 'Failed to upload grammar data');
    }
});

// POST /admin/upload/reading - 리딩 JSON 업로드
router.post('/upload/reading', auth, adminOnly, upload.single('readingFile'), async (req, res) => {
    try {
        if (!req.file) {
            return fail(res, 400, 'JSON 파일이 필요합니다.');
        }

        const jsonContent = req.file.buffer.toString('utf-8');
        const data = JSON.parse(jsonContent);

        if (!Array.isArray(data)) {
            return fail(res, 400, 'JSON 파일은 배열 형태여야 합니다.');
        }

        console.log(`[ADMIN] Processing ${data.length} reading items`);
        
        let insertCount = 0;
        let errorCount = 0;
        const errors = [];

        for (let i = 0; i < data.length; i++) {
            const item = data[i];
            try {
                if (!item.title || !item.body || !item.levelCEFR) {
                    errors.push(`Item ${i + 1}: Missing required fields (title, body, levelCEFR)`);
                    errorCount++;
                    continue;
                }

                await prisma.reading.create({
                    data: {
                        title: item.title,
                        body: item.body,
                        levelCEFR: item.levelCEFR,
                        glosses: item.glosses || []
                    }
                });
                insertCount++;

            } catch (error) {
                console.error(`[ADMIN] Error processing reading item ${i + 1}:`, error);
                errors.push(`Item ${i + 1}: ${error.message}`);
                errorCount++;
            }
        }

        console.log(`[ADMIN] Reading upload completed by ${req.user.email}: ${insertCount} inserted, ${errorCount} errors`);
        
        return ok(res, {
            message: `리딩 업로드 완료: ${insertCount}개 추가`,
            stats: { insertCount, errorCount, totalProcessed: data.length },
            errors: errors.slice(0, 10)
        });

    } catch (e) {
        console.error('[ADMIN] Reading upload error:', e);
        return fail(res, 500, 'Failed to upload reading data');
    }
});

// POST /admin/validate - 데이터 검증
router.post('/validate', auth, adminOnly, async (req, res) => {
    try {
        console.log('[ADMIN] Validation request from:', req.user.email, 'body:', req.body);
        const { type } = req.body; // 'vocab', 'grammar', 'reading', 'all'
        
        const results = {
            vocab: null,
            grammar: null,
            reading: null,
            summary: {
                totalIssues: 0,
                criticalIssues: 0,
                warnings: 0
            }
        };

        if (type === 'vocab' || type === 'all') {
            console.log('[ADMIN] Starting vocab validation...');
            // 어휘 데이터 검증
            const vocabIssues = [];
            
            let missingFields = [];
            try {
                // 1. 필수 필드 누락 검사
                console.log('[ADMIN] Checking vocab missing fields...');
                missingFields = await prisma.vocab.findMany({
                    where: {
                        OR: [
                            { lemma: '' },
                            { pos: '' },
                            { levelCEFR: '' }
                        ]
                    },
                    select: { id: true, lemma: true, pos: true, levelCEFR: true }
                });
                console.log('[ADMIN] Found', missingFields.length, 'missing field records');
            } catch (vocabError) {
                console.error('[ADMIN] Error in vocab missing fields check:', vocabError);
                throw new Error(`Vocab validation failed: ${vocabError.message}`);
            }
            
            missingFields.forEach(item => {
                vocabIssues.push({
                    type: 'critical',
                    message: `Vocab ID ${item.id}: Missing required fields`,
                    data: item
                });
            });

            try {
                // 2. 중복 lemma+pos 검사
                console.log('[ADMIN] Checking vocab duplicates...');
                const vocabItems = await prisma.vocab.findMany({
                    select: { id: true, lemma: true, pos: true }
                });
                console.log('[ADMIN] Got', vocabItems.length, 'vocab items for duplicate check');
                
                // 중복 검사를 JavaScript로 처리
                const duplicateMap = new Map();
                vocabItems.forEach(item => {
                    const key = `${item.lemma}:${item.pos}`;
                    if (!duplicateMap.has(key)) {
                        duplicateMap.set(key, []);
                    }
                    duplicateMap.get(key).push(item.id);
                });
                
                duplicateMap.forEach((ids, key) => {
                    if (ids.length > 1) {
                        const [lemma, pos] = key.split(':');
                        vocabIssues.push({
                            type: 'warning',
                            message: `Duplicate lemma+pos: ${lemma} (${pos}) - ${ids.length} occurrences`,
                            data: { lemma, pos, ids: ids.join(',') }
                        });
                    }
                });
            } catch (dupError) {
                console.error('[ADMIN] Error in vocab duplicate check:', dupError);
                throw new Error(`Vocab duplicate check failed: ${dupError.message}`);
            }

            let invalidCEFR = [];
            try {
                // 3. 잘못된 CEFR 레벨 검사
                console.log('[ADMIN] Checking invalid CEFR levels...');
                invalidCEFR = await prisma.vocab.findMany({
                    where: {
                        NOT: {
                            levelCEFR: {
                                in: ['A1', 'A2', 'B1', 'B2', 'C1']
                            }
                        }
                    },
                    select: { id: true, lemma: true, levelCEFR: true }
                });
                console.log('[ADMIN] Found', invalidCEFR.length, 'invalid CEFR records');
            } catch (cefrError) {
                console.error('[ADMIN] Error in CEFR check:', cefrError);
                throw new Error(`CEFR validation failed: ${cefrError.message}`);
            }
            
            invalidCEFR.forEach(item => {
                vocabIssues.push({
                    type: 'warning',
                    message: `Invalid CEFR level: ${item.levelCEFR}`,
                    data: item
                });
            });

            try {
                console.log('[ADMIN] Getting vocab count...');
                const vocabCount = await prisma.vocab.count();
                console.log('[ADMIN] Total vocab count:', vocabCount);
                
                results.vocab = {
                    totalItems: vocabCount,
                    issues: vocabIssues,
                    issueCount: vocabIssues.length
                };
                console.log('[ADMIN] Vocab validation completed with', vocabIssues.length, 'issues');
            } catch (countError) {
                console.error('[ADMIN] Error getting vocab count:', countError);
                throw new Error(`Vocab count failed: ${countError.message}`);
            }
        }

        if (type === 'grammar' || type === 'all') {
            // 문법 데이터 검증
            const grammarIssues = [];
            
            // 1. GrammarExercise 검증
            const exerciseIssues = await prisma.grammarexercise.findMany({
                where: {
                    OR: [
                        { topic: '' },
                        { levelCEFR: '' }
                    ]
                },
                select: { id: true, topicId: true, topic: true, levelCEFR: true }
            });
            
            exerciseIssues.forEach(item => {
                grammarIssues.push({
                    type: 'critical',
                    message: `Grammar Exercise ID ${item.id}: Missing required fields`,
                    data: item
                });
            });

            // 2. 중복 topicId 검사
            const grammarExercises = await prisma.grammarexercise.findMany({
                select: { topicId: true }
            });
            
            // 중복 검사를 JavaScript로 처리
            const topicIdCounts = new Map();
            grammarExercises.forEach(exercise => {
                const count = topicIdCounts.get(exercise.topicId) || 0;
                topicIdCounts.set(exercise.topicId, count + 1);
            });
            
            topicIdCounts.forEach((count, topicId) => {
                if (count > 1) {
                    grammarIssues.push({
                        type: 'critical',
                        message: `Duplicate topicId: ${topicId}`,
                        data: { topicId, count }
                    });
                }
            });

            results.grammar = {
                exerciseCount: await prisma.grammarexercise.count(),
                itemCount: await prisma.grammaritem.count(),
                issues: grammarIssues,
                issueCount: grammarIssues.length
            };
        }

        if (type === 'reading' || type === 'all') {
            // 리딩 데이터 검증
            const readingIssues = [];
            
            const missingFields = await prisma.reading.findMany({
                where: {
                    OR: [
                        { title: '' },
                        { body: '' },
                        { levelCEFR: '' }
                    ]
                },
                select: { id: true, title: true, levelCEFR: true }
            });
            
            missingFields.forEach(item => {
                readingIssues.push({
                    type: 'critical',
                    message: `Reading ID ${item.id}: Missing required fields`,
                    data: item
                });
            });

            results.reading = {
                totalItems: await prisma.reading.count(),
                issues: readingIssues,
                issueCount: readingIssues.length
            };
        }

        // 요약 계산
        Object.values(results).forEach(section => {
            if (section && section.issues) {
                section.issues.forEach(issue => {
                    results.summary.totalIssues++;
                    if (issue.type === 'critical') {
                        results.summary.criticalIssues++;
                    } else if (issue.type === 'warning') {
                        results.summary.warnings++;
                    }
                });
            }
        });

        console.log(`[ADMIN] Data validation completed by ${req.user.email}: ${results.summary.totalIssues} total issues found`);
        
        return ok(res, {
            message: `데이터 검증 완료: ${results.summary.totalIssues}개 이슈 발견`,
            results,
            validatedAt: new Date().toISOString()
        });

    } catch (e) {
        console.error('[ADMIN] Data validation error:', e);
        console.error('[ADMIN] Error message:', e.message);
        console.error('[ADMIN] Stack trace:', e.stack);
        console.error('[ADMIN] Request user:', req.user);
        console.error('[ADMIN] Request body:', req.body);
        return fail(res, 500, `Failed to validate data: ${e.message}`);
    }
});

// GET /admin/reports - 시스템 리포트
router.get('/reports', auth, adminOnly, async (req, res) => {
    try {
        const { type } = req.query; // 'performance', 'users', 'all'
        
        const reports = {};
        
        // 공통 날짜 변수
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        if (type === 'performance' || type === 'all') {
            // 아이템 정답률 및 난이도 분석
            const vocabStats = await prisma.$queryRaw`
                SELECT 
                    COUNT(*) as totalCards,
                    AVG(correctTotal / (correctTotal + wrongTotal)) as avgCorrectRate,
                    SUM(CASE WHEN correctTotal > wrongTotal THEN 1 ELSE 0 END) as passedCards
                FROM srscard 
                WHERE itemType = 'vocab' AND (correctTotal + wrongTotal) > 0
            `;

            const grammarStats = await prisma.$queryRaw`
                SELECT 
                    COUNT(*) as totalCards,
                    AVG(correctTotal / (correctTotal + wrongTotal)) as avgCorrectRate,
                    SUM(CASE WHEN correctTotal > wrongTotal THEN 1 ELSE 0 END) as passedCards
                FROM srscard 
                WHERE itemType = 'grammar' AND (correctTotal + wrongTotal) > 0
            `;

            // 오답 유형 TOP
            const topWrongVocab = await prisma.$queryRaw`
                SELECT v.lemma, v.pos, v.levelCEFR, COUNT(wa.id) as wrongCount
                FROM wronganswer wa
                JOIN vocab v ON wa.vocabId = v.id
                GROUP BY wa.vocabId, v.lemma, v.pos, v.levelCEFR
                ORDER BY wrongCount DESC
                LIMIT 10
            `;

            reports.performance = {
                vocab: {
                    totalCards: Number(vocabStats[0]?.totalCards || 0),
                    avgCorrectRate: Number(vocabStats[0]?.avgCorrectRate || 0) * 100,
                    passedCards: Number(vocabStats[0]?.passedCards || 0)
                },
                grammar: {
                    totalCards: Number(grammarStats[0]?.totalCards || 0),
                    avgCorrectRate: Number(grammarStats[0]?.avgCorrectRate || 0) * 100,
                    passedCards: Number(grammarStats[0]?.passedCards || 0)
                },
                topWrongVocab: topWrongVocab.map(item => ({
                    lemma: item.lemma,
                    pos: item.pos,
                    level: item.levelCEFR,
                    wrongCount: Number(item.wrongCount)
                }))
            };
        }


        if (type === 'users' || type === 'all') {
            // 사용자 활동 통계
            const userStats = await prisma.user.aggregate({
                _count: { id: true },
                _avg: { streak: true }
            });

            const activeUsers = await prisma.$queryRaw`
                SELECT COUNT(DISTINCT userId) as count
                FROM dailystudystat 
                WHERE date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            `;

            const newUsersThisWeek = await prisma.user.count({
                where: {
                    createdAt: {
                        gte: weekAgo
                    }
                }
            });

            const topStreaks = await prisma.user.findMany({
                where: { streak: { gt: 0 } },
                orderBy: { streak: 'desc' },
                take: 5,
                select: { email: true, streak: true }
            });

            reports.users = {
                total: userStats._count.id || 0,
                avgStreak: Math.round(userStats._avg.streak || 0),
                activeThisWeek: Number(activeUsers[0]?.count || 0),
                newThisWeek: newUsersThisWeek,
                topStreaks: topStreaks
            };
        }

        console.log(`[ADMIN] Reports generated by ${req.user.email} - type: ${type || 'all'}`);
        
        return ok(res, {
            reports,
            generatedAt: new Date().toISOString(),
            type: type || 'all'
        });

    } catch (e) {
        console.error('[ADMIN] Reports error:', e);
        console.error('[ADMIN] Reports error message:', e.message);
        console.error('[ADMIN] Reports stack trace:', e.stack);
        console.error('[ADMIN] Reports request query:', req.query);
        return fail(res, 500, `Failed to generate reports: ${e.message}`);
    }
});

// GET /admin/logs - 시스템 로그
router.get('/logs', auth, adminOnly, async (req, res) => {
    try {
        const { type, limit = 50, offset = 0 } = req.query;
        
        const logs = [];
        

        // 사용자 활동 로그 (최근 로그인 등)
        if (!type || type === 'user_activity') {
            const recentUsers = await prisma.user.findMany({
                where: {
                    lastStudiedAt: {
                        not: null
                    }
                },
                take: parseInt(limit),
                orderBy: { lastStudiedAt: 'desc' },
                select: {
                    email: true,
                    lastStudiedAt: true,
                    streak: true
                }
            });

            recentUsers.forEach(user => {
                logs.push({
                    timestamp: user.lastStudiedAt,
                    type: 'user_activity',
                    level: 'INFO',
                    message: `User study session - streak: ${user.streak}`,
                    user: user.email,
                    data: {
                        streak: user.streak
                    }
                });
            });
        }


        // 시간순 정렬
        logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // 제한된 수만 반환
        const limitedLogs = logs.slice(0, parseInt(limit));

        console.log(`[ADMIN] Logs accessed by ${req.user.email} - type: ${type || 'all'}, count: ${limitedLogs.length}`);
        
        return ok(res, {
            logs: limitedLogs,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                total: logs.length,
                hasMore: logs.length > parseInt(limit)
            },
            generatedAt: new Date().toISOString()
        });

    } catch (e) {
        console.error('[ADMIN] Logs error:', e);
        return fail(res, 500, 'Failed to retrieve logs');
    }
});

// GET /admin/users/learning-analytics - 유저별 학습 현황
router.get('/users/learning-analytics', auth, adminOnly, async (req, res) => {
    try {
        const { userId, page = 1, limit = 20, sortBy = 'recent', dateFrom, dateTo } = req.query;

        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(50, parseInt(limit));
        const skip = (pageNum - 1) * limitNum;

        let users;
        let totalCount;

        // 날짜 범위 설정 (기본값: 최근 30일)
        const endDate = dateTo ? new Date(dateTo) : new Date();
        const startDate = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        if (userId) {
            // 특정 사용자의 상세 학습 현황
            const user = await prisma.user.findUnique({
                where: { id: parseInt(userId) },
                include: {
                    _count: {
                        select: {
                            srscard: true,
                            wronganswer: true,
                            studySessions: true
                        }
                    }
                }
            });

            if (!user) {
                return fail(res, 404, 'User not found');
            }

            // 단어 학습 통계
            const vocabStats = await prisma.srscard.aggregate({
                where: {
                    userId: parseInt(userId),
                    itemType: 'vocab'
                },
                _count: { id: true },
                _sum: {
                    correctTotal: true,
                    wrongTotal: true
                },
                _avg: {
                    correctTotal: true,
                    wrongTotal: true
                }
            });

            // 최근 학습한 단어들 (최근 7일)
            const recentVocabStudied = await prisma.srscard.findMany({
                where: {
                    userId: parseInt(userId),
                    itemType: 'vocab',
                    lastReviewedAt: {
                        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                    }
                },
                take: 20,
                orderBy: { lastReviewedAt: 'desc' },
                include: {
                    vocab: {
                        select: {
                            id: true,
                            lemma: true,
                            pos: true,
                            levelCEFR: true,
                            translations: {
                                where: { languageId: 2 }, // Korean translations
                                select: { translation: true }
                            }
                        }
                    }
                }
            });

            // 리딩 학습 통계
            const readingStats = await prisma.readingRecord.groupBy({
                by: ['level'],
                where: {
                    userId: parseInt(userId),
                    solvedAt: {
                        gte: startDate,
                        lte: endDate
                    }
                },
                _count: { id: true },
                _sum: {
                    isCorrect: true
                }
            });

            // 리스닝 학습 통계
            const listeningStats = await prisma.listeningRecord.groupBy({
                by: ['level'],
                where: {
                    userId: parseInt(userId),
                    solvedAt: {
                        gte: startDate,
                        lte: endDate
                    }
                },
                _count: { id: true },
                _sum: {
                    isCorrect: true
                }
            });

            // 최근 리딩/리스닝 문제 풀이 내역
            const recentReading = await prisma.readingRecord.findMany({
                where: {
                    userId: parseInt(userId),
                    solvedAt: {
                        gte: startDate,
                        lte: endDate
                    }
                },
                take: 10,
                orderBy: { solvedAt: 'desc' },
                select: {
                    questionId: true,
                    level: true,
                    isCorrect: true,
                    solvedAt: true
                }
            });

            const recentListening = await prisma.listeningRecord.findMany({
                where: {
                    userId: parseInt(userId),
                    solvedAt: {
                        gte: startDate,
                        lte: endDate
                    }
                },
                take: 10,
                orderBy: { solvedAt: 'desc' },
                select: {
                    questionId: true,
                    level: true,
                    isCorrect: true,
                    solvedAt: true
                }
            });

            // 일별 학습 통계
            const dailyStats = await prisma.dailystudystat.findMany({
                where: {
                    userId: parseInt(userId),
                    date: {
                        gte: startDate,
                        lte: endDate
                    }
                },
                orderBy: { date: 'desc' },
                take: 30
            });

            // 잘못 답한 단어들 (TOP 10)
            const topWrongVocabs = await prisma.wronganswer.findMany({
                where: {
                    userId: parseInt(userId),
                    wrongAt: {
                        gte: startDate,
                        lte: endDate
                    }
                },
                include: {
                    vocab: {
                        select: {
                            id: true,
                            lemma: true,
                            pos: true,
                            levelCEFR: true,
                            translations: {
                                where: { languageId: 2 },
                                select: { translation: true }
                            }
                        }
                    }
                },
                take: 10,
                orderBy: { wrongAt: 'desc' }
            });

            const userDetail = {
                user: {
                    id: user.id,
                    email: user.email,
                    streak: user.streak,
                    createdAt: user.createdAt,
                    lastStudiedAt: user.lastStudiedAt,
                    totalCards: user._count.srscard,
                    totalWrongAnswers: user._count.wronganswer,
                    totalStudySessions: user._count.studySessions
                },
                vocabLearning: {
                    totalCards: vocabStats._count.id || 0,
                    totalCorrect: vocabStats._sum.correctTotal || 0,
                    totalWrong: vocabStats._sum.wrongTotal || 0,
                    avgCorrect: Math.round(vocabStats._avg.correctTotal || 0),
                    avgWrong: Math.round(vocabStats._avg.wrongTotal || 0),
                    accuracyRate: vocabStats._sum.correctTotal && vocabStats._sum.wrongTotal ?
                        Math.round((vocabStats._sum.correctTotal / (vocabStats._sum.correctTotal + vocabStats._sum.wrongTotal)) * 100) : 0,
                    recentStudied: recentVocabStudied.map(card => ({
                        vocabId: card.vocab?.id,
                        lemma: card.vocab?.lemma,
                        pos: card.vocab?.pos,
                        level: card.vocab?.levelCEFR,
                        meaning: card.vocab?.translations[0]?.translation || 'No translation',
                        correctCount: card.correctTotal,
                        wrongCount: card.wrongTotal,
                        lastReviewed: card.lastReviewedAt,
                        stage: card.stage
                    }))
                },
                readingLearning: {
                    byLevel: readingStats.map(stat => ({
                        level: stat.level,
                        totalSolved: stat._count.id,
                        correctCount: stat._sum.isCorrect || 0,
                        accuracyRate: Math.round(((stat._sum.isCorrect || 0) / stat._count.id) * 100)
                    })),
                    recentActivity: recentReading
                },
                listeningLearning: {
                    byLevel: listeningStats.map(stat => ({
                        level: stat.level,
                        totalSolved: stat._count.id,
                        correctCount: stat._sum.isCorrect || 0,
                        accuracyRate: Math.round(((stat._sum.isCorrect || 0) / stat._count.id) * 100)
                    })),
                    recentActivity: recentListening
                },
                dailyActivity: dailyStats,
                topWrongVocabs: topWrongVocabs.map(wrong => ({
                    vocabId: wrong.vocab?.id,
                    lemma: wrong.vocab?.lemma,
                    pos: wrong.vocab?.pos,
                    level: wrong.vocab?.levelCEFR,
                    meaning: wrong.vocab?.translations[0]?.translation || 'No translation',
                    wrongAt: wrong.wrongAt,
                    attempts: wrong.attempts,
                    isCompleted: wrong.isCompleted
                }))
            };

            return ok(res, userDetail);
        } else {
            // 모든 사용자의 학습 현황 요약
            const orderBy = (() => {
                switch (sortBy) {
                    case 'recent': return { lastStudiedAt: 'desc' };
                    case 'streak': return { streak: 'desc' };
                    case 'cards': return { srscard: { _count: 'desc' } };
                    default: return { id: 'desc' };
                }
            })();

            users = await prisma.user.findMany({
                skip,
                take: limitNum,
                orderBy,
                include: {
                    _count: {
                        select: {
                            srscard: true,
                            wronganswer: true,
                            studySessions: true
                        }
                    },
                    // 최근 일별 통계 1개만
                    dailystudystat: {
                        take: 1,
                        orderBy: { date: 'desc' }
                    }
                }
            });

            totalCount = await prisma.user.count();

            // 각 사용자의 추가 통계 계산
            const usersWithStats = await Promise.all(users.map(async (user) => {
                // 최근 30일간의 리딩/리스닝 통계
                const [readingCount, listeningCount, vocabAccuracy] = await Promise.all([
                    prisma.readingRecord.count({
                        where: {
                            userId: user.id,
                            solvedAt: {
                                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                            }
                        }
                    }),
                    prisma.listeningRecord.count({
                        where: {
                            userId: user.id,
                            solvedAt: {
                                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                            }
                        }
                    }),
                    prisma.srscard.aggregate({
                        where: {
                            userId: user.id,
                            itemType: 'vocab'
                        },
                        _sum: {
                            correctTotal: true,
                            wrongTotal: true
                        }
                    })
                ]);

                return {
                    id: user.id,
                    email: user.email,
                    streak: user.streak,
                    createdAt: user.createdAt,
                    lastStudiedAt: user.lastStudiedAt,
                    totalCards: user._count.srscard,
                    totalWrongAnswers: user._count.wronganswer,
                    totalStudySessions: user._count.studySessions,
                    recentActivity: {
                        readingProblems: readingCount,
                        listeningProblems: listeningCount,
                        lastDailyStudy: user.dailystudystat[0] || null
                    },
                    vocabAccuracy: vocabAccuracy._sum.correctTotal && vocabAccuracy._sum.wrongTotal ?
                        Math.round((vocabAccuracy._sum.correctTotal / (vocabAccuracy._sum.correctTotal + vocabAccuracy._sum.wrongTotal)) * 100) : 0
                };
            }));

            return ok(res, {
                users: usersWithStats,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    totalCount,
                    totalPages: Math.ceil(totalCount / limitNum),
                    hasNext: skip + limitNum < totalCount,
                    hasPrev: pageNum > 1
                },
                filters: {
                    sortBy,
                    dateFrom: startDate.toISOString(),
                    dateTo: endDate.toISOString()
                }
            });
        }

    } catch (e) {
        console.error('[ADMIN] Learning analytics error:', e);
        return fail(res, 500, 'Failed to load learning analytics');
    }
});

// GET /admin/users/analytics - 사용자 분석 데이터
router.get('/users/analytics', auth, adminOnly, async (req, res) => {
    try {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const [dailyRetention, weeklyRetention, monthlyRetention, avgSessionTime] = await Promise.all([
            // 일일 리텐션 (오늘 활동한 사용자 / 어제 활동한 사용자)
            Promise.all([
                prisma.user.count({
                    where: {
                        lastStudiedAt: {
                            gte: new Date(now.getTime() - 24 * 60 * 60 * 1000)
                        }
                    }
                }),
                prisma.user.count({
                    where: {
                        lastStudiedAt: {
                            gte: new Date(now.getTime() - 48 * 60 * 60 * 1000)
                        }
                    }
                })
            ]).then(([today, yesterday]) => yesterday > 0 ? Math.round((today / yesterday) * 100) : 0),

            // 주간 리텐션
            Promise.all([
                prisma.user.count({
                    where: {
                        lastStudiedAt: {
                            gte: weekAgo
                        }
                    }
                }),
                prisma.user.count()
            ]).then(([active, total]) => total > 0 ? Math.round((active / total) * 100) : 0),

            // 월간 리텐션
            Promise.all([
                prisma.user.count({
                    where: {
                        lastStudiedAt: {
                            gte: monthAgo
                        }
                    }
                }),
                prisma.user.count()
            ]).then(([active, total]) => total > 0 ? Math.round((active / total) * 100) : 0),

            // 평균 세션 시간 (mock data)
            15
        ]);

        return ok(res, {
            retention: {
                daily: dailyRetention,
                weekly: weeklyRetention,
                monthly: monthlyRetention
            },
            averageSessionTime: avgSessionTime
        });
    } catch (e) {
        console.error('[ADMIN] Users analytics error:', e);
        return fail(res, 500, 'Failed to load users analytics');
    }
});

// GET /admin/content/quality-metrics - 컨텐츠 품질 메트릭
router.get('/content/quality-metrics', auth, adminOnly, async (req, res) => {
    try {
        // Mock data for content quality metrics
        const audioQuality = {
            good: 1500,
            issues: 50,
            missing: 10
        };

        const translations = {
            verified: 2000,
            pending: 100,
            reported: 25
        };

        return ok(res, {
            audioQuality,
            translations
        });
    } catch (e) {
        console.error('[ADMIN] Content quality metrics error:', e);
        return fail(res, 500, 'Failed to load content quality metrics');
    }
});

module.exports = router;