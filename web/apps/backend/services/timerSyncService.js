// services/timerSyncService.js
// SRS 타이머 동일화 서비스

const { prisma } = require('../lib/prismaClient');

/**
 * 카드의 현재 상태를 정확히 분류하는 함수
 * @param {Object} card - SRS 카드 객체
 * @returns {string} - 카드 상태 ('waiting_correct', 'waiting_wrong', 'frozen', 'overdue', 'ready')
 */
function getCardState(card) {
    // 타임머신 시간 적용
    let now;
    try {
        const { getOffsetDate } = require('../routes/timeMachine');
        now = getOffsetDate();
    } catch {
        now = new Date();
    }

    // 1. 동결 상태 (최우선)
    if (card.frozenUntil && new Date(card.frozenUntil) > now) {
        return 'frozen';
    }

    // 2. 연체 상태
    if (card.isOverdue) {
        return 'overdue';
    }

    // 3. 대기 상태 확인
    if (card.waitingUntil && new Date(card.waitingUntil) > now) {
        // 오답 카드 대기
        if (card.isFromWrongAnswer) {
            return 'waiting_wrong';
        }
        // 정답 카드 대기
        return 'waiting_correct';
    }

    // 4. 즉시 복습 가능
    return 'ready';
}

/**
 * 카드 상태별 타이머 값을 가져오는 함수
 * @param {Object} card - SRS 카드 객체
 * @returns {Date|null} - 타이머 종료 시각
 */
function getCardTimerEndTime(card) {
    const state = getCardState(card);

    switch (state) {
        case 'frozen':
            return card.frozenUntil;
        case 'overdue':
            return card.overdueDeadline;
        case 'waiting_correct':
        case 'waiting_wrong':
            return card.waitingUntil;
        case 'ready':
            return null; // 즉시 복습 가능
        default:
            return null;
    }
}

/**
 * 같은 하위 폴더 내에서 stage와 상태가 동일한 카드들을 찾는 함수
 * @param {number} userId - 사용자 ID
 * @param {number} subfolderId - 하위 폴더 ID
 * @param {number} stage - SRS Stage
 * @param {string} cardState - 카드 상태
 * @returns {Array} - 해당 조건에 맞는 카드들
 */
async function getCardsInSameSubfolderWithSameStageAndState(userId, subfolderId, stage, cardState) {
    try {
        // 같은 하위 폴더 내의 모든 카드 조회
        // parentId가 subfolderId인 폴더들에 속한 카드들 조회
        const cards = await prisma.srscard.findMany({
            where: {
                userId: userId,
                srsfolderitem: {
                    some: {
                        srsfolder: {
                            parentId: subfolderId // 하위 폴더 조건
                        }
                    }
                },
                stage: stage
            },
            include: {
                srsfolderitem: {
                    include: {
                        srsfolder: true
                    }
                }
            }
        });

        // 같은 상태인 카드들만 필터링
        const filteredCards = cards.filter(card => {
            const state = getCardState(card);
            return state === cardState;
        });

        return filteredCards;
    } catch (error) {
        console.error('[TIMER SYNC] Error finding cards:', error);
        return [];
    }
}

/**
 * 카드들의 타이머 차이가 1시간 이내인지 확인
 * @param {Array} cards - 카드 배열
 * @returns {boolean} - 1시간 이내 차이인지 여부
 */
function isTimerDifferenceWithinOneHour(cards) {
    if (cards.length <= 1) return true;

    const timerEndTimes = cards
        .map(card => getCardTimerEndTime(card))
        .filter(time => time !== null)
        .map(time => new Date(time).getTime());

    if (timerEndTimes.length <= 1) return true;

    const minTime = Math.min(...timerEndTimes);
    const maxTime = Math.max(...timerEndTimes);
    const timeDifferenceMs = maxTime - minTime;
    const oneHourMs = 60 * 60 * 1000;

    return timeDifferenceMs <= oneHourMs;
}

/**
 * 카드들의 타이머를 동일화하는 함수 (가장 이른 시간으로 통일 - 가장 타이머가 많이 지난 단어 기준)
 * @param {Array} cards - 동일화할 카드들
 * @returns {boolean} - 성공 여부
 */
async function synchronizeCardTimers(cards) {
    if (cards.length <= 1) return true;

    try {
        // 가장 이른 타이머 시간 찾기 (가장 타이머가 많이 지난 단어)
        const timerEndTimes = cards
            .map(card => getCardTimerEndTime(card))
            .filter(time => time !== null);

        if (timerEndTimes.length === 0) return true;

        const earliestTime = new Date(Math.min(...timerEndTimes.map(t => new Date(t).getTime())));
        console.log(`[TIMER SYNC] Synchronizing ${cards.length} cards to earliest time: ${earliestTime.toISOString()}`);

        // 모든 카드의 타이머를 가장 이른 시간으로 설정
        for (const card of cards) {
            const state = getCardState(card);
            let updateData = {};

            switch (state) {
                case 'frozen':
                    updateData.frozenUntil = earliestTime;
                    break;
                case 'overdue':
                    updateData.overdueDeadline = earliestTime;
                    break;
                case 'waiting_correct':
                case 'waiting_wrong':
                    updateData.waitingUntil = earliestTime;
                    updateData.nextReviewAt = earliestTime;
                    break;
                default:
                    continue; // ready 상태는 동일화 대상이 아님
            }

            await prisma.srscard.update({
                where: { id: card.id },
                data: updateData
            });

            console.log(`[TIMER SYNC] Updated card ${card.id} (state: ${state}) to ${earliestTime.toISOString()}`);
        }

        return true;
    } catch (error) {
        console.error('[TIMER SYNC] Error synchronizing timers:', error);
        return false;
    }
}

/**
 * 특정 하위 폴더의 타이머 동일화를 실행하는 메인 함수
 * @param {number} userId - 사용자 ID
 * @param {number} subfolderId - 하위 폴더 ID
 * @returns {Object} - 실행 결과
 */
async function synchronizeSubfolderTimers(userId, subfolderId) {
    try {
        console.log(`[TIMER SYNC] Starting synchronization for user ${userId}, subfolder ${subfolderId}`);

        // 해당 하위 폴더의 모든 카드 조회
        const allCards = await prisma.srscard.findMany({
            where: {
                userId: userId,
                srsfolderitem: {
                    some: {
                        srsfolder: {
                            parentId: subfolderId
                        }
                    }
                }
            },
            include: {
                srsfolderitem: {
                    include: {
                        srsfolder: true
                    }
                }
            }
        });

        if (allCards.length === 0) {
            return { success: true, message: 'No cards found in subfolder', syncedGroups: 0 };
        }

        // Stage와 상태별로 카드 그룹화
        const cardGroups = {};

        for (const card of allCards) {
            const state = getCardState(card);
            const groupKey = `stage_${card.stage}_state_${state}`;

            if (!cardGroups[groupKey]) {
                cardGroups[groupKey] = [];
            }
            cardGroups[groupKey].push(card);
        }

        let syncedGroups = 0;
        let totalSyncedCards = 0;

        // 각 그룹별로 타이머 동일화 검사 및 실행
        for (const [groupKey, cards] of Object.entries(cardGroups)) {
            if (cards.length <= 1) continue;

            console.log(`[TIMER SYNC] Checking group ${groupKey} with ${cards.length} cards`);

            // 1시간 이내 차이 확인
            if (isTimerDifferenceWithinOneHour(cards)) {
                console.log(`[TIMER SYNC] Group ${groupKey} is within 1 hour difference, synchronizing...`);

                const success = await synchronizeCardTimers(cards);
                if (success) {
                    syncedGroups++;
                    totalSyncedCards += cards.length;
                    console.log(`[TIMER SYNC] Successfully synchronized ${cards.length} cards in group ${groupKey}`);
                }
            } else {
                console.log(`[TIMER SYNC] Group ${groupKey} has timer difference > 1 hour, skipping synchronization`);
            }
        }

        return {
            success: true,
            message: `Synchronized ${syncedGroups} groups with ${totalSyncedCards} total cards`,
            syncedGroups,
            totalSyncedCards,
            totalCards: allCards.length
        };

    } catch (error) {
        console.error('[TIMER SYNC] Error in synchronizeSubfolderTimers:', error);
        return {
            success: false,
            message: `Error: ${error.message}`,
            syncedGroups: 0,
            totalSyncedCards: 0
        };
    }
}

module.exports = {
    getCardState,
    getCardTimerEndTime,
    getCardsInSameSubfolderWithSameStageAndState,
    isTimerDifferenceWithinOneHour,
    synchronizeCardTimers,
    synchronizeSubfolderTimers
};