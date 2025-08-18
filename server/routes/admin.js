// server/routes/admin.js
const express = require('express');
const router = express.Router();
const { ok, fail } = require('../lib/resp');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const { prisma } = require('../lib/prismaClient');

// GET /admin/dashboard - 관리자 대시보드 정보
router.get('/dashboard', auth, adminOnly, async (req, res) => {
    try {
        // 시스템 통계 조회
        const [
            userCount,
            srsCardCount,
            wrongAnswerCount,
            vocabularyCount,
            overdueCardCount
        ] = await Promise.all([
            prisma.user.count(),
            prisma.srscard.count(),
            prisma.wronganswer.count(),
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
                srsCardCount,
                wrongAnswerCount,
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

module.exports = router;