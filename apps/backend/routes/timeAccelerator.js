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
 * @param {number} stage - SRS Stage
 * @param {string} learningCurveType - "long" 또는 "short"
 * @returns {number} - 가속된 대기시간 (밀리초)
 */
function getAcceleratedStageWaitTime(stage, learningCurveType = "long") {
    try {
        // srsSchedule.js의 계산 함수를 사용하여 정확한 대기시간 가져오기
        const { computeWaitingPeriod } = require('../services/srsSchedule');
        const originalHours = computeWaitingPeriod(stage, learningCurveType);
        const originalMs = originalHours * 60 * 60 * 1000;
        return getAcceleratedTime(originalMs);
    } catch (e) {
        console.error('[TIME ACCELERATOR] Failed to get waiting period from srsSchedule:', e);
        
        // 폴백: 기존 로직 사용
        let originalDays = 0;
        
        if (learningCurveType === "short") {
            // 단기 스퍼트 곡선: [1시간, 24h, 48h, 48h, ...]
            const SHORT_CURVE_HOURS = [1, 24, 48, 48, 48, 48, 48, 48, 48, 48];
            const originalHours = SHORT_CURVE_HOURS[stage - 1] || 48;
            return getAcceleratedTime(originalHours * 60 * 60 * 1000);
        } else {
            // 장기 학습 곡선: [1시간, 24h, 72h, 168h, 312h, 696h, 1440h]
            const LONG_CURVE_HOURS = [1, 24, 72, 168, 312, 696, 1440];
            const originalHours = LONG_CURVE_HOURS[stage - 1] || 1440;
            return getAcceleratedTime(originalHours * 60 * 60 * 1000);
        }
    }
}

/**
 * 24시간을 가속 적용하여 계산 (overdue 데드라인 등)
 * @returns {number} - 가속된 24시간 (밀리초)
 */
function getAccelerated24Hours() {
    const original24h = 24 * 60 * 60 * 1000;
    return getAcceleratedTime(original24h);
}

/**
 * 오답 대기시간을 가속 적용하여 계산
 * stage0에서만 1시간, 이외는 24시간
 * @param {number} currentStage - 현재 카드의 stage
 * @returns {number} - 가속된 오답 대기시간 (밀리초)
 */
function getAcceleratedWrongAnswerWaitTime(currentStage = 0) {
    // stage0에서 틀렸을 경우에만 1시간, 이외는 24시간
    const waitingHours = currentStage === 0 ? 1 : 24;
    const originalMs = waitingHours * 60 * 60 * 1000;
    return getAcceleratedTime(originalMs);
}

// GET /time-accelerator/status - 현재 가속 상태 조회
router.get('/status', async (req, res) => {
    try {
        const factor = getAccelerationFactor();
        
        // 다양한 예시 계산
        const original24h = 24 * 60 * 60 * 1000;
        const accelerated24h = getAccelerated24Hours();
        const realMinutes = Math.round(accelerated24h / (60 * 1000));
        
        // 다양한 stage별 예시
        const stage1Long = getAcceleratedStageWaitTime(1, "long"); // 1시간
        const stage2Long = getAcceleratedStageWaitTime(2, "long"); // 24시간  
        const stage3Long = getAcceleratedStageWaitTime(3, "long"); // 144시간 (6일)
        const stage4Long = getAcceleratedStageWaitTime(4, "long"); // 312시간 (13일)
        
        const stage1Short = getAcceleratedStageWaitTime(1, "short"); // 1시간
        const stage2Short = getAcceleratedStageWaitTime(2, "short"); // 24시간
        const stage3Short = getAcceleratedStageWaitTime(3, "short"); // 48시간
        
        const wrongStage0 = getAcceleratedWrongAnswerWaitTime(0); // 1시간
        const wrongStage1 = getAcceleratedWrongAnswerWaitTime(1); // 24시간
        
        return ok(res, {
            accelerationFactor: factor,
            isActive: factor > 1,
            examples: {
                longCurve: {
                    stage1: { original: '1시간', accelerated: `${Math.round(stage1Long / (60 * 1000))}분` },
                    stage2: { original: '24시간(1일)', accelerated: `${Math.round(stage2Long / (60 * 1000))}분` },
                    stage3: { original: '144시간(6일)', accelerated: `${Math.round(stage3Long / (60 * 1000))}분` },
                    stage4: { original: '312시간(13일)', accelerated: `${Math.round(stage4Long / (60 * 1000))}분` }
                },
                shortCurve: {
                    stage1: { original: '1시간', accelerated: `${Math.round(stage1Short / (60 * 1000))}분` },
                    stage2: { original: '24시간(1일)', accelerated: `${Math.round(stage2Short / (60 * 1000))}분` },
                    stage3: { original: '48시간(2일)', accelerated: `${Math.round(stage3Short / (60 * 1000))}분` }
                },
                wrongAnswer: {
                    stage0: { original: '1시간', accelerated: `${Math.round(wrongStage0 / (60 * 1000))}분` },
                    stageOther: { original: '24시간', accelerated: `${Math.round(wrongStage1 / (60 * 1000))}분` }
                },
                overdue: { original: '24시간', accelerated: `${realMinutes}분` }
            },
            presets: {
                realtime: { factor: 1, description: '실시간 (1일 = 1일)' },
                fast: { factor: 60, description: '빠름 (1일 = 24분)' },
                veryfast: { factor: 1440, description: '매우빠름 (1일 = 1분)' },
                extreme: { factor: 10080, description: '극한 (1주일 = 1분)' }
            },
            stats: await getAccelerationStats()
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

// 즉시 크론잡 실행 엔드포인트
router.post('/trigger-cron', async (req, res) => {
    try {
        const { manageOverdueCards } = require('../services/srsJobs');
        
        console.log('[TIME ACCELERATOR] Manual cron trigger requested');
        
        // 즉시 overdue 관리 실행
        await manageOverdueCards();
        
        // 크론잡 주기도 즉시 업데이트
        try {
            const { updateOverdueCronFrequency } = require('../cron/index');
            if (typeof updateOverdueCronFrequency === 'function') {
                updateOverdueCronFrequency();
                console.log('[TIME ACCELERATOR] Updated cron frequency after manual trigger');
            }
        } catch (e) {
            console.error('[TIME ACCELERATOR] Failed to update cron frequency:', e);
        }
        
        return ok(res, {
            message: 'Cron job executed successfully',
            timestamp: new Date().toISOString()
        });
    } catch (e) {
        console.error('[TIME ACCELERATOR] Manual cron trigger error:', e);
        return fail(res, 500, 'Failed to execute cron job');
    }
});

/**
 * 모든 활성 타이머를 새로운 가속 팩터로 재계산
 */
async function recalculateAllActiveTimers() {
    const { prisma } = require('../lib/prismaClient');
    const now = new Date();
    
    console.log('[TIME ACCELERATOR] Starting timer recalculation...');
    
    // 1. 대기 중인 카드들 재계산 (학습곡선 정보 포함)
    const waitingCards = await prisma.srscard.findMany({
        where: {
            waitingUntil: { gt: now },
            isOverdue: false
        },
        select: { 
            id: true, 
            stage: true, 
            isFromWrongAnswer: true,
            waitingUntil: true,
            srsfolderitem: {
                select: {
                    srsfolder: {
                        select: {
                            learningCurveType: true
                        }
                    }
                }
            }
        }
    });
    
    console.log(`[TIME ACCELERATOR] Found ${waitingCards.length} waiting cards to recalculate`);
    
    for (const card of waitingCards) {
        let newWaitingUntil;
        
        // 카드가 속한 폴더의 학습 곡선 타입 가져오기
        const learningCurveType = card.srsfolderitem?.[0]?.srsfolder?.learningCurveType || "long";
        
        // Stage 1 카드는 특별 처리: 무조건 1시간 대기시간으로 설정 (오답/정답 무관)
        if (card.stage === 1) {
            const oneHourMs = 60 * 60 * 1000; // 1시간
            const acceleratedOneHour = getAcceleratedTime(oneHourMs);
            newWaitingUntil = new Date(now.getTime() + acceleratedOneHour);
            console.log(`[TIME ACCELERATOR] Card ${card.id}: Stage 1 reset to 1 hour (${Math.round(acceleratedOneHour / (60 * 1000))} minutes with acceleration)`);
        } else {
            // 다른 Stage들은 원래 로직: 카드 타입에 따라 새로운 타이머로 재설정
            if (card.isFromWrongAnswer) {
                // 오답 카드: stage에 따라 1시간 또는 24시간 대기를 가속 적용
                const acceleratedWrongWaitTime = getAcceleratedWrongAnswerWaitTime(card.stage);
                newWaitingUntil = new Date(now.getTime() + acceleratedWrongWaitTime);
            } else {
                // 정답 카드: stage별 대기시간을 학습 곡선 타입에 따라 가속 적용
                const acceleratedWaitTime = getAcceleratedStageWaitTime(card.stage, learningCurveType);
                newWaitingUntil = new Date(now.getTime() + acceleratedWaitTime);
            }
        }
        
        console.log(`[TIME ACCELERATOR] Card ${card.id}: Stage ${card.stage}, Curve: ${learningCurveType}, Wrong: ${card.isFromWrongAnswer}`);
        
        await prisma.srscard.update({
            where: { id: card.id },
            data: {
                waitingUntil: newWaitingUntil,
                nextReviewAt: newWaitingUntil
            }
        });
    }
    
    // 2. Overdue 카드들의 데드라인 재계산
    const overdueCards = await prisma.srscard.findMany({
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
        
        await prisma.srscard.update({
            where: { id: card.id },
            data: {
                overdueDeadline: newDeadline,
                overdueStartAt: now
            }
        });
    }
    
    // 3. 동결 카드들 재계산
    const frozenCards = await prisma.srscard.findMany({
        where: {
            frozenUntil: { gt: now }
        },
        select: { id: true, frozenUntil: true }
    });
    
    console.log(`[TIME ACCELERATOR] Found ${frozenCards.length} frozen cards to recalculate`);
    
    for (const card of frozenCards) {
        // 새로운 24시간 동결 시간으로 설정
        const newFrozenUntil = new Date(now.getTime() + getAccelerated24Hours());
        
        await prisma.srscard.update({
            where: { id: card.id },
            data: {
                frozenUntil: newFrozenUntil
            }
        });
    }
    
    console.log(`[TIME ACCELERATOR] Recalculated ${waitingCards.length + overdueCards.length + frozenCards.length} total timers`);
}

/**
 * 현재 가속 상태 통계 정보
 */
async function getAccelerationStats() {
    try {
        const { prisma } = require('../lib/prismaClient');
        const now = new Date();
        
        // 전체 카드 통계
        const totalCards = await prisma.srscard.count();
        
        // 대기 중인 카드들
        const waitingCards = await prisma.srscard.count({
            where: {
                waitingUntil: { gt: now },
                isOverdue: false
            }
        });
        
        // overdue 카드들
        const overdueCards = await prisma.srscard.count({
            where: {
                isOverdue: true
            }
        });
        
        // 동결 카드들
        const frozenCards = await prisma.srscard.count({
            where: {
                frozenUntil: { gt: now }
            }
        });
        
        // 마스터 완료 카드들
        const masteredCards = await prisma.srscard.count({
            where: {
                isMastered: true
            }
        });
        
        return {
            totalCards,
            waitingCards,
            overdueCards,
            frozenCards,
            masteredCards,
            readyForReview: overdueCards
        };
    } catch (e) {
        console.error('[TIME ACCELERATOR] Failed to get stats:', e);
        return {
            totalCards: 0,
            waitingCards: 0,
            overdueCards: 0,
            frozenCards: 0,
            masteredCards: 0,
            readyForReview: 0
        };
    }
}

module.exports = { 
    router, 
    getAccelerationFactor,
    getAcceleratedTime,
    getAcceleratedDateTime,
    getAcceleratedStageWaitTime,
    getAccelerated24Hours,
    getAcceleratedWrongAnswerWaitTime
};