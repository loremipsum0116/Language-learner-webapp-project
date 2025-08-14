const express = require('express');
const router = express.Router();
const { ok, fail } = require('../lib/resp');
const auth = require('../middleware/auth');

// 전역 가속 팩터 저장 (메모리에 저장, 서버 재시작시 리셋됨)
let globalAccelerationFactor = 1; // 1x = 정상 시간

/**
 * 현재 가속 팩터를 가져오는 함수
 */
function getAccelerationFactor() {
    return globalAccelerationFactor;
}

/**
 * 가속된 대기 시간을 계산하는 함수
 * @param {number} originalMs - 원본 밀리초
 * @returns {number} - 가속된 밀리초
 */
function getAcceleratedTime(originalMs) {
    const factor = getAccelerationFactor();
    return Math.max(1000, Math.floor(originalMs / factor)); // 최소 1초
}

/**
 * 가속된 DateTime을 생성하는 함수 
 * @param {Date} baseDate - 기준 시간 (기본값: 현재 시간)
 * @param {number} originalMs - 원본 밀리초 오프셋
 * @returns {Date} - 가속된 미래 시간
 */
function getAcceleratedDateTime(baseDate = new Date(), originalMs) {
    const acceleratedMs = getAcceleratedTime(originalMs);
    return new Date(baseDate.getTime() + acceleratedMs);
}

/**
 * Stage별 대기시간을 가속 적용하여 계산
 * @param {number} stage - SRS Stage (1-6)
 * @returns {number} - 가속된 대기시간 (밀리초)
 */
function getAcceleratedStageWaitTime(stage) {
    const STAGE_DAYS = [0, 3, 7, 14, 30, 60, 120]; // Stage 0-6
    const originalDays = STAGE_DAYS[stage] || 0;
    const originalMs = originalDays * 24 * 60 * 60 * 1000;
    return getAcceleratedTime(originalMs);
}

/**
 * 24시간을 가속 적용하여 계산 (오답 대기, overdue 데드라인 등)
 * @returns {number} - 가속된 24시간 (밀리초)
 */
function getAccelerated24Hours() {
    const original24h = 24 * 60 * 60 * 1000;
    return getAcceleratedTime(original24h);
}

// GET /time-accelerator/status - 현재 가속 상태 조회
router.get('/status', (req, res) => {
    try {
        const factor = getAccelerationFactor();
        
        // 예시 계산
        const original24h = 24 * 60 * 60 * 1000;
        const accelerated24h = getAccelerated24Hours();
        const realMinutes = Math.round(accelerated24h / (60 * 1000));
        
        const exampleStage3 = getAcceleratedStageWaitTime(3); // Stage 3 = 14일
        const stage3Minutes = Math.round(exampleStage3 / (60 * 1000));
        
        return ok(res, {
            accelerationFactor: factor,
            isActive: factor > 1,
            examples: {
                originalWrongAnswerWait: '24시간',
                acceleratedWrongAnswerWait: `${realMinutes}분`,
                originalStage3Wait: '14일',
                acceleratedStage3Wait: `${stage3Minutes}분`
            },
            presets: {
                realtime: { factor: 1, description: '실시간 (1일 = 1일)' },
                fast: { factor: 60, description: '빠름 (1일 = 24분)' },
                veryfast: { factor: 1440, description: '매우빠름 (1일 = 1분)' },
                extreme: { factor: 10080, description: '극한 (1주일 = 1분)' }
            }
        });
    } catch (e) {
        return fail(res, 500, 'Failed to get acceleration status');
    }
});

// POST /time-accelerator/set - 가속 팩터 설정
router.post('/set', auth, async (req, res) => {
    try {
        const { factor } = req.body;
        
        if (typeof factor !== 'number' || isNaN(factor) || factor < 1) {
            return fail(res, 400, 'factor must be a number >= 1');
        }
        
        // 안전을 위해 최대 가속 제한 (1주일 = 1분)
        if (factor > 10080) {
            return fail(res, 400, 'factor must be <= 10080 (1 week = 1 minute)');
        }
        
        const previousFactor = globalAccelerationFactor;
        globalAccelerationFactor = factor;
        
        console.log(`[TIME ACCELERATOR] Factor changed: ${previousFactor}x -> ${factor}x`);
        
        // 가속 팩터 변경 시 모든 활성 타이머를 새로운 팩터로 재계산
        try {
            await recalculateAllActiveTimers();
            console.log(`[TIME ACCELERATOR] Recalculated all active timers with new factor: ${factor}x`);
        } catch (e) {
            console.error(`[TIME ACCELERATOR] Failed to recalculate timers:`, e);
        }
        
        // 크론잡 주기도 즉시 업데이트
        try {
            const { updateOverdueCronFrequency } = require('../cron/index');
            if (typeof updateOverdueCronFrequency === 'function') {
                updateOverdueCronFrequency();
                console.log(`[TIME ACCELERATOR] Updated cron frequency for ${factor}x acceleration`);
            }
        } catch (e) {
            console.error(`[TIME ACCELERATOR] Failed to update cron frequency:`, e);
        }
        
        return ok(res, {
            factor: globalAccelerationFactor,
            message: `Acceleration factor set to ${factor}x`,
            previousFactor: previousFactor
        });
    } catch (e) {
        console.error('[TIME ACCELERATOR] Set error:', e);
        return fail(res, 500, 'Failed to set acceleration factor');
    }
});

// POST /time-accelerator/preset - 미리 정의된 가속 프리셋 설정
router.post('/preset', auth, async (req, res) => {
    try {
        const { preset } = req.body;
        
        const presets = {
            realtime: 1,
            fast: 60,        // 1일 = 24분
            veryfast: 1440,  // 1일 = 1분  
            extreme: 10080   // 1주일 = 1분
        };
        
        if (!presets[preset]) {
            return fail(res, 400, `Invalid preset. Available: ${Object.keys(presets).join(', ')}`);
        }
        
        const factor = presets[preset];
        const previousFactor = globalAccelerationFactor;
        globalAccelerationFactor = factor;
        
        console.log(`[TIME ACCELERATOR] Preset '${preset}' applied: ${previousFactor}x -> ${factor}x`);
        
        // 타이머 재계산
        try {
            await recalculateAllActiveTimers();
            console.log(`[TIME ACCELERATOR] Recalculated all timers for preset '${preset}'`);
        } catch (e) {
            console.error(`[TIME ACCELERATOR] Failed to recalculate timers:`, e);
        }
        
        // 크론잡 주기도 즉시 업데이트
        try {
            const { updateOverdueCronFrequency } = require('../cron/index');
            if (typeof updateOverdueCronFrequency === 'function') {
                updateOverdueCronFrequency();
                console.log(`[TIME ACCELERATOR] Updated cron frequency for preset '${preset}' (${factor}x acceleration)`);
            }
        } catch (e) {
            console.error(`[TIME ACCELERATOR] Failed to update cron frequency:`, e);
        }
        
        return ok(res, {
            preset: preset,
            factor: factor,
            message: `Applied preset '${preset}' (${factor}x acceleration)`,
            previousFactor: previousFactor
        });
    } catch (e) {
        console.error('[TIME ACCELERATOR] Preset error:', e);
        return fail(res, 500, 'Failed to apply preset');
    }
});

/**
 * 모든 활성 타이머를 새로운 가속 팩터로 재계산
 */
async function recalculateAllActiveTimers() {
    const { prisma } = require('../lib/prismaClient');
    const now = new Date();
    
    console.log('[TIME ACCELERATOR] Starting timer recalculation...');
    
    // 1. 대기 중인 카드들 재계산
    const waitingCards = await prisma.sRSCard.findMany({
        where: {
            waitingUntil: { gt: now },
            isOverdue: false
        },
        select: { 
            id: true, 
            stage: true, 
            isFromWrongAnswer: true,
            waitingUntil: true 
        }
    });
    
    console.log(`[TIME ACCELERATOR] Found ${waitingCards.length} waiting cards to recalculate`);
    
    for (const card of waitingCards) {
        let newWaitingUntil;
        
        if (card.isFromWrongAnswer) {
            // 오답 카드: 24시간 대기를 가속 적용
            newWaitingUntil = new Date(now.getTime() + getAccelerated24Hours());
        } else {
            // 정답 카드: stage별 대기시간을 가속 적용
            const acceleratedWaitTime = getAcceleratedStageWaitTime(card.stage);
            newWaitingUntil = new Date(now.getTime() + acceleratedWaitTime);
        }
        
        await prisma.sRSCard.update({
            where: { id: card.id },
            data: {
                waitingUntil: newWaitingUntil,
                nextReviewAt: newWaitingUntil
            }
        });
    }
    
    // 2. Overdue 카드들의 데드라인 재계산
    const overdueCards = await prisma.sRSCard.findMany({
        where: {
            isOverdue: true,
            overdueDeadline: { gt: now }
        },
        select: { id: true, overdueDeadline: true }
    });
    
    console.log(`[TIME ACCELERATOR] Found ${overdueCards.length} overdue cards to recalculate`);
    
    for (const card of overdueCards) {
        // 새로운 24시간 데드라인으로 설정
        const newDeadline = new Date(now.getTime() + getAccelerated24Hours());
        
        await prisma.sRSCard.update({
            where: { id: card.id },
            data: {
                overdueDeadline: newDeadline,
                overdueStartAt: now
            }
        });
    }
    
    // 3. 동결 카드들 재계산
    const frozenCards = await prisma.sRSCard.findMany({
        where: {
            frozenUntil: { gt: now }
        },
        select: { id: true, frozenUntil: true }
    });
    
    console.log(`[TIME ACCELERATOR] Found ${frozenCards.length} frozen cards to recalculate`);
    
    for (const card of frozenCards) {
        // 새로운 24시간 동결 시간으로 설정
        const newFrozenUntil = new Date(now.getTime() + getAccelerated24Hours());
        
        await prisma.sRSCard.update({
            where: { id: card.id },
            data: {
                frozenUntil: newFrozenUntil
            }
        });
    }
    
    console.log(`[TIME ACCELERATOR] Recalculated ${waitingCards.length + overdueCards.length + frozenCards.length} total timers`);
}

module.exports = { 
    router, 
    getAccelerationFactor,
    getAcceleratedTime,
    getAcceleratedDateTime,
    getAcceleratedStageWaitTime,
    getAccelerated24Hours
};