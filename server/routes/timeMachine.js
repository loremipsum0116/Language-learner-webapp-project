const express = require('express');
const router = express.Router();
const { ok, fail } = require('../lib/resp');
const auth = require('../middleware/auth');
const { prisma } = require('../lib/prismaClient');

// 전역 시간 오프셋 저장 (메모리에 저장, 서버 재시작시 리셋됨)
let globalTimeOffset = 0; // 일 단위

/**
 * 현재 시간 오프셋을 가져오는 함수
 */
function getTimeOffset() {
    return globalTimeOffset;
}

/**
 * 오프셋이 적용된 현재 시간을 반환
 */
function getOffsetDate(baseDate = new Date()) {
    const offset = getTimeOffset();
    return new Date(baseDate.getTime() + offset * 24 * 60 * 60 * 1000);
}

/**
 * 타임머신 리셋 시 모든 SRS 카드의 타이머를 현재 시간 기준으로 재계산
 */
async function resetAllSrsCardTimers() {
    const now = new Date(); // 타임머신 리셋 후이므로 실제 현재 시간 사용
    
    console.log('[TIME MACHINE] Starting SRS card timer reset...');
    
    // 미래 시간으로 설정된 카드들 및 overdue 상태인 모든 카드들 조회
    const futureCards = await prisma.sRSCard.findMany({
        where: {
            OR: [
                { waitingUntil: { gt: now } },
                { nextReviewAt: { gt: now } },
                { overdueDeadline: { gt: now } },
                { isOverdue: true } // overdue 상태인 모든 카드도 포함
            ]
        },
        select: {
            id: true,
            stage: true,
            waitingUntil: true,
            nextReviewAt: true,
            isOverdue: true,
            overdueDeadline: true,
            isFromWrongAnswer: true
        }
    });
    
    console.log(`[TIME MACHINE] Found ${futureCards.length} cards with future timers to reset`);
    
    for (const card of futureCards) {
        let updateData = {
            isOverdue: false,
            overdueDeadline: null,
            overdueStartAt: null
        };
        
        if (card.isFromWrongAnswer) {
            // 오답 카드: 24시간 대기 설정
            const waitingUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            updateData.waitingUntil = waitingUntil;
            updateData.nextReviewAt = waitingUntil;
        } else if (card.stage === 0) {
            // Stage 0 일반 카드: 즉시 복습 가능
            updateData.waitingUntil = null;
            updateData.nextReviewAt = null;
        } else {
            // Stage 1 이상 일반 카드: 해당 stage의 대기 시간 재계산
            const { computeWaitingUntil } = require('../services/srsSchedule');
            const waitingUntil = computeWaitingUntil(now, card.stage);
            updateData.waitingUntil = waitingUntil;
            updateData.nextReviewAt = waitingUntil;
        }
        
        await prisma.sRSCard.update({
            where: { id: card.id },
            data: updateData
        });
    }
    
    console.log(`[TIME MACHINE] Reset ${futureCards.length} SRS card timers to current time baseline`);
}

// POST /time-machine/direct-fix - 직접 DB 수정 (인증 불필요)
router.post('/direct-fix', async (req, res) => {
    try {
        const { prisma } = require('../lib/prismaClient');
        
        // 현재 시간 (24시간 후로 설정)
        const now = new Date();
        const fixedDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        
        // 모든 overdue 카드를 강제로 24시간으로 설정
        const result = await prisma.sRSCard.updateMany({
            where: { isOverdue: true },
            data: { 
                overdueDeadline: fixedDeadline,
                overdueStartAt: now
            }
        });
        
        console.log(`[DIRECT FIX] Updated ${result.count} cards:`);
        console.log(`  - Now: ${now.toISOString()}`);
        console.log(`  - Fixed deadline: ${fixedDeadline.toISOString()}`);
        console.log(`  - Hours: 24`);
        
        // 수정된 카드들 확인
        const updatedCards = await prisma.sRSCard.findMany({
            where: { isOverdue: true },
            select: { id: true, overdueDeadline: true, overdueStartAt: true }
        });
        
        return res.json({
            success: true,
            message: `Direct fixed ${result.count} overdue cards to exactly 24 hours`,
            fixedCount: result.count,
            now: now.toISOString(),
            fixedDeadline: fixedDeadline.toISOString(),
            updatedCards: updatedCards.slice(0, 3) // 첫 3개만 표시
        });
    } catch (e) {
        console.error('[DIRECT FIX] Error:', e);
        return res.status(500).json({ success: false, error: e.message });
    }
});

// POST /time-machine/emergency-fix - 긴급 모든 overdue 카드 24시간 리셋 (인증 불필요)
router.post('/emergency-fix', auth, async (req, res) => {
    try {
        const { prisma } = require('../lib/prismaClient');
        const now = getOffsetDate();
        
        const result = await prisma.sRSCard.updateMany({
            where: { isOverdue: true },
            data: { 
                overdueDeadline: new Date(now.getTime() + 24 * 60 * 60 * 1000),
                overdueStartAt: now
            }
        });
        
        console.log(`[EMERGENCY FIX] Reset ${result.count} overdue cards to 24h`);
        
        return ok(res, {
            message: `Emergency fixed ${result.count} overdue cards to 24 hours`,
            fixedCount: result.count
        });
    } catch (e) {
        console.error('[EMERGENCY FIX] Error:', e);
        return fail(res, 500, 'Failed to emergency fix');
    }
});

// GET /time-machine/status - 현재 시간 오프셋 상태 조회 (인증 불필요)
router.get('/status', (req, res) => {
    try {
        const now = new Date();
        const offsetDate = getOffsetDate(now);
        
        return ok(res, {
            dayOffset: globalTimeOffset,
            originalTime: now.toISOString(),
            offsetTime: offsetDate.toISOString(),
            isActive: globalTimeOffset !== 0
        });
    } catch (e) {
        return fail(res, 500, 'Failed to get time machine status');
    }
});

// POST /time-machine/set - 시간 오프셋 설정 (인증 필요)
router.post('/set', auth, async (req, res) => {
    try {
        const { dayOffset } = req.body;
        
        if (typeof dayOffset !== 'number' || isNaN(dayOffset)) {
            return fail(res, 400, 'dayOffset must be a valid number');
        }
        
        // 안전을 위해 오프셋 범위 제한 (-3650일 ~ +3650일, 약 10년)
        if (dayOffset < -3650 || dayOffset > 3650) {
            return fail(res, 400, 'dayOffset must be between -3650 and 3650 days');
        }
        
        globalTimeOffset = dayOffset;
        
        const now = new Date();
        const offsetDate = getOffsetDate(now);
        
        // 타임머신 설정 즉시 모든 overdue 카드를 24시간으로 강제 리셋 (실제 현재 시간 기준)
        try {
            const { prisma } = require('../lib/prismaClient');
            const result = await prisma.sRSCard.updateMany({
                where: { isOverdue: true },
                data: { 
                    overdueDeadline: new Date(now.getTime() + 24 * 60 * 60 * 1000), // offsetDate가 아닌 now 사용
                    overdueStartAt: now // 실제 현재 시간으로 설정
                }
            });
            console.log(`[TIME MACHINE] Immediately force reset ${result.count} overdue cards to 24h`);
        } catch (e) {
            console.error(`[TIME MACHINE] Failed to immediate reset:`, e);
        }
        
        console.log(`[TIME MACHINE] Time offset set to ${dayOffset} days`);
        console.log(`[TIME MACHINE] Original time: ${now.toISOString()}`);
        console.log(`[TIME MACHINE] Offset time: ${offsetDate.toISOString()}`);
        
        // 타임머신 설정 후 즈시 overdue 상태 업데이트 및 데드라인 수정
        try {
            const { updateAllUsersOverdueStatus, manageOverdueCards } = require('../services/srsJobs');
            const { prisma } = require('../lib/prismaClient');
            
            // 순서 1: 먼저 새로운 overdue 카드들을 생성
            await manageOverdueCards(console);
            
            // 순서 2: 모든 overdue 카드들의 데드라인을 무조건 24시간으로 강제 설정
            const allOverdueCards = await prisma.sRSCard.findMany({
                where: { isOverdue: true },
                select: { id: true, overdueStartAt: true, overdueDeadline: true }
            });
            
            console.log(`[TIME MACHINE] Found ${allOverdueCards.length} overdue cards to force fix after manage`);
            
            // 모든 overdue 카드의 데드라인을 무조건 24시간으로 설정 (실제 현재 시간 기준)
            for (const card of allOverdueCards) {
                const correctDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000); // offsetDate가 아닌 now 사용
                const currentHoursLeft = card.overdueDeadline ? 
                    Math.round((card.overdueDeadline.getTime() - now.getTime()) / (60 * 60 * 1000)) : 0;
                
                await prisma.sRSCard.update({
                    where: { id: card.id },
                    data: { 
                        overdueDeadline: correctDeadline,
                        overdueStartAt: now // 실제 현재 시간으로 설정
                    }
                });
                console.log(`[TIME MACHINE] Force fixed ALL overdue card ${card.id}: ${currentHoursLeft}h -> 24h`);
            }
            
            // 순서 3: 사용자 상태 업데이트
            await updateAllUsersOverdueStatus(console);
            console.log(`[TIME MACHINE] Updated overdue status and force fixed all deadlines to 24h`);
        } catch (e) {
            console.error(`[TIME MACHINE] Failed to update overdue status:`, e);
        }
        
        return ok(res, {
            dayOffset: globalTimeOffset,
            originalTime: now.toISOString(),
            offsetTime: offsetDate.toISOString(),
            message: `Time offset set to ${dayOffset} days`
        });
    } catch (e) {
        console.error('[TIME MACHINE] Set error:', e);
        return fail(res, 500, 'Failed to set time offset');
    }
});

// POST /time-machine/force-reset-all - 모든 overdue 카드 강제 24시간 리셋 (인증 필요)
router.post('/force-reset-all', auth, async (req, res) => {
    try {
        const { prisma } = require('../lib/prismaClient');
        const now = getOffsetDate();
        
        // 모든 overdue 카드 조회 (조건 없이)
        const allOverdueCards = await prisma.sRSCard.findMany({
            where: { isOverdue: true },
            select: { id: true, overdueStartAt: true, overdueDeadline: true }
        });
        
        console.log(`[FORCE RESET] Found ${allOverdueCards.length} overdue cards to force reset`);
        
        // 모든 overdue 카드를 무조건 24시간으로 설정
        for (const card of allOverdueCards) {
            const correctDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            
            await prisma.sRSCard.update({
                where: { id: card.id },
                data: { 
                    overdueDeadline: correctDeadline,
                    overdueStartAt: now
                }
            });
        }
        
        return ok(res, {
            message: `Force reset ${allOverdueCards.length} overdue cards to 24 hours`,
            resetCount: allOverdueCards.length
        });
    } catch (e) {
        console.error('[FORCE RESET] Error:', e);
        return fail(res, 500, 'Failed to force reset all overdue cards');
    }
});

// POST /time-machine/fix-deadlines - overdue 카드의 데드라인 강제 수정 (인증 필요)
router.post('/fix-deadlines', auth, async (req, res) => {
    try {
        const { prisma } = require('../lib/prismaClient');
        const now = getOffsetDate();
        
        // 모든 overdue 카드 조회 (데드라인 조건 없이 모든 overdue 카드)
        const overdueCards = await prisma.sRSCard.findMany({
            where: {
                isOverdue: true
                // overdueDeadline 조건 제거 - 모든 overdue 카드를 대상으로 함
            },
            select: { id: true, overdueStartAt: true, overdueDeadline: true }
        });
        
        let fixedCount = 0;
        
        for (const card of overdueCards) {
            const currentHoursLeft = Math.round((card.overdueDeadline.getTime() - now.getTime()) / (60 * 60 * 1000));
            
            // 강력한 수정: 현재 시간에서 무조건 24시간 후로 강제 설정
            const correctDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            
            await prisma.sRSCard.update({
                where: { id: card.id },
                data: { 
                    overdueDeadline: correctDeadline,
                    overdueStartAt: now // overdue 시작 시간도 현재로 업데이트
                }
            });
            
            fixedCount++;
            console.log(`[TIME MACHINE] Force fixed deadline for card ${card.id}: ${currentHoursLeft}h -> 24h`);
        }
        
        return ok(res, {
            message: `Fixed ${fixedCount} overdue card deadlines to 24 hours`,
            fixedCount: fixedCount
        });
    } catch (e) {
        console.error('[TIME MACHINE] Fix deadlines error:', e);
        return fail(res, 500, 'Failed to fix deadlines');
    }
});

// POST /time-machine/reset - 시간 오프셋 리셋 (인증 필요)
router.post('/reset', auth, async (req, res) => {
    try {
        globalTimeOffset = 0;
        
        console.log('[TIME MACHINE] Time offset reset to 0');
        
        // 타임머신 리셋 후 모든 SRS 카드 타이머 재계산
        try {
            await resetAllSrsCardTimers();
            const { updateAllUsersOverdueStatus, manageOverdueCards } = require('../services/srsJobs');
            await manageOverdueCards(console); // 먼저 카드 상태를 업데이트
            await updateAllUsersOverdueStatus(console); // 그 다음 사용자 상태 업데이트
            console.log(`[TIME MACHINE] Reset all SRS card timers and updated overdue status`);
        } catch (e) {
            console.error(`[TIME MACHINE] Failed to reset SRS cards after time machine reset:`, e);
        }
        
        return ok(res, {
            dayOffset: 0,
            message: 'Time offset reset to current time'
        });
    } catch (e) {
        console.error('[TIME MACHINE] Reset error:', e);
        return fail(res, 500, 'Failed to reset time offset');
    }
});

module.exports = { 
    router, 
    getTimeOffset, 
    getOffsetDate 
};