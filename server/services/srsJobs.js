// server/services/srsJobs.js
// Six-hourly notify & midnight roll logic for flat SRS (nextReviewDate + alarmActive).

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const tz = require('dayjs/plugin/timezone');
dayjs.extend(utc); dayjs.extend(tz);

const { prisma } = require('../lib/prismaClient');
const KST = 'Asia/Seoul';

function kstStartOfDay(d) { 
  // 타임머신 시간 오프셋 적용
  try {
    const { getOffsetDate } = require('../routes/timeMachine');
    const baseDate = d || dayjs(getOffsetDate());
    return baseDate.tz(KST).startOf('day');
  } catch {
    const baseDate = d || dayjs();
    return baseDate.tz(KST).startOf('day');
  }
}

function kstNow() { 
  // 타임머신 시간 오프셋 적용
  try {
    const { getOffsetDate } = require('../routes/timeMachine');
    return dayjs(getOffsetDate()).tz(KST);
  } catch {
    return dayjs().tz(KST);
  }
}

/**
 * overdue 기반 6시간 간격 알림
 * overdue 카드가 있는 사용자들에게만 알림 전송
 */
async function sixHourlyNotify(logger = console) {
  // 타임머신 시간 적용
  const { getOffsetDate } = require('../routes/timeMachine');
  const now = getOffsetDate();
  
  try {
    // 1. 모든 사용자의 overdue 상태 업데이트
    await updateAllUsersOverdueStatus(logger);
    
    // 2. overdue 카드가 있는 사용자들에게 알림 설정
    await setOverdueAlarms(logger);
    
    // 3. 현재 알림 시각이 된 사용자들 조회
    const usersToNotify = await prisma.user.findMany({
      where: {
        hasOverdueCards: true,
        nextOverdueAlarm: { lte: now }
      },
      select: { id: true, nextOverdueAlarm: true }
    });
    
    if (usersToNotify.length === 0) {
      return logger.info('[srsJobs] sixHourlyNotify: no users with overdue cards to notify');
    }
    
    // 4. 알림을 받을 사용자들의 nextOverdueAlarm 업데이트 (다음 6시간 후)
    const nextAlarmTime = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    
    await prisma.user.updateMany({
      where: {
        id: { in: usersToNotify.map(u => u.id) },
        hasOverdueCards: true
      },
      data: {
        nextOverdueAlarm: nextAlarmTime
      }
    });
    
    logger.info(`[srsJobs] sixHourlyNotify: set alarms for ${usersToNotify.length} users with overdue cards`);
    logger.info(`[srsJobs] Next alarm time: ${nextAlarmTime.toISOString()}`);
    
  } catch (error) {
    logger.error('[srsJobs] Error in sixHourlyNotify:', error);
  }
}

/**
 * 자정 컷오프: overdue 상태 전반적 정리 및 알림 상태 리셋
 */
async function midnightRoll(logger = console) {
  try {
    // 타임머신 시간 적용
    const { getOffsetDate } = require('../routes/timeMachine');
    const now = getOffsetDate();
    
    // 1. 기존 폴더 시스템 알림 정리 (호환성)
    const yesterday = kstStartOfDay(dayjs(now).tz(KST).subtract(1,'day')).toDate();
    const res = await prisma.srsfolder.updateMany({
      where: { nextReviewDate: yesterday, completedAt: null, alarmActive: true },
      data: { alarmActive: false, nextAlarmAt: null },
    });
    
    // 2. 모든 사용자의 overdue 상태 업데이트
    await updateAllUsersOverdueStatus(logger);
    
    // 3. overdue 알림 상태 리셋
    await setOverdueAlarms(logger);
    
    logger.info(`[srsJobs] midnightRoll: disabled ${res.count} stale folder alarms and updated overdue status`);
    
  } catch (error) {
    logger.error('[srsJobs] Error in midnightRoll:', error);
  }
}

// Export additional utility functions needed by other modules
function startOfKstDay(d) {
  // 타임머신 시간 오프셋 적용
  try {
    const { getOffsetDate } = require('../routes/timeMachine');
    const baseDate = d || getOffsetDate();
    const dayjsObj = dayjs.isDayjs(baseDate) ? baseDate : dayjs(baseDate);
    return dayjsObj.tz(KST).startOf('day');
  } catch {
    const baseDate = d || dayjs();
    const dayjsObj = dayjs.isDayjs(baseDate) ? baseDate : dayjs(baseDate);
    return dayjsObj.tz(KST).startOf('day');
  }
}

function addKstDays(kstDate, days) {
  // kstDate가 Date 객체인 경우 dayjs로 변환
  const dayjsObj = dayjs.isDayjs(kstDate) ? kstDate : dayjs(kstDate);
  return dayjsObj.add(days, 'day');
}

/**
 * 새로운 SRS 시스템의 overdue 카드 관리
 * 1. 대기 시간이 끝난 카드들을 overdue 상태로 변경
 * 2. overdue 데드라인이 지난 카드들을 stage 0으로 리셋
 * 3. 사용자별 overdue 상태 업데이트
 */
async function manageOverdueCards(logger = console) {
  // 타임머신 시간 적용
  const { getOffsetDate } = require('../routes/timeMachine');
  const now = getOffsetDate();
  const affectedUsers = new Set();
  
  // 시간 가속 팩터 확인
  try {
    const { getAccelerationFactor } = require('../routes/timeAccelerator');
    const factor = getAccelerationFactor();
    logger.info(`[srsJobs] Starting overdue management with ${factor}x acceleration at ${now.toISOString()}`);
  } catch (e) {
    logger.info(`[srsJobs] Starting overdue management at ${now.toISOString()}`);
  }
  
  try {
    // 0. 기존 overdue 카드 수정 로직 비활성화 (타임머신에서 처리하므로)
    // 타임머신 이동 후 중복 수정을 방지하기 위해 비활성화
    /*
    const allOverdueCards = await prisma.srscard.findMany({
      where: { isOverdue: true },
      select: { id: true, userId: true, overdueStartAt: true, overdueDeadline: true }
    });
    
    for (const card of allOverdueCards) {
      const correctDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      await prisma.srscard.update({
        where: { id: card.id },
        data: { overdueDeadline: correctDeadline, overdueStartAt: now }
      });
      affectedUsers.add(card.userId);
    }
    */
    
    // 1. 대기 시간이 끝난 카드들을 overdue 상태로 설정
    const cardsToMarkOverdue = await prisma.srscard.findMany({
      where: {
        waitingUntil: { lte: now },
        isOverdue: false
      },
      select: { id: true, userId: true, waitingUntil: true, isFromWrongAnswer: true, stage: true }
    });

    for (const card of cardsToMarkOverdue) {
      // overdue 상태로 변경하고 24시간 데드라인 설정
      // 수정: overdue 시작 시점(now)에서 24시간 후로 설정 (모든 stage 동일)
      const overdueDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      logger.info(`[srsJobs] Card ${card.id} marked overdue:`);
      logger.info(`  - waitingUntil: ${card.waitingUntil.toISOString()}`);
      logger.info(`  - now (time machine): ${now.toISOString()}`);
      logger.info(`  - overdueDeadline: ${overdueDeadline.toISOString()}`);
      logger.info(`  - hours until deadline: ${Math.round((overdueDeadline.getTime() - now.getTime()) / (60 * 60 * 1000))}`);
      
      await prisma.srscard.update({
        where: { id: card.id },
        data: {
          isOverdue: true,
          waitingUntil: null, // 대기 종료
          overdueDeadline: overdueDeadline,
          overdueStartAt: now // overdue 시작 시각 기록
        }
      });
      
      affectedUsers.add(card.userId);
    }

    if (cardsToMarkOverdue.length > 0) {
      logger.info(`[srsJobs] Marked ${cardsToMarkOverdue.length} cards as overdue (waiting period ended)`);
    }

    // 2. overdue 데드라인이 지난 카드들을 24시간 동결 상태로 전환
    // 단, 자동학습 카드들과 자율학습모드 카드들은 제외
    const cardsToFreeze = await prisma.srscard.findMany({
      where: {
        isOverdue: true,
        overdueDeadline: { lte: now },
        // 자동학습 카드와 자율학습모드 카드 제외
        NOT: {
          OR: [
            // 자동학습 카드 (nextReviewAt: null, isFromWrongAnswer: false)
            {
              AND: [
                { nextReviewAt: null },
                { isFromWrongAnswer: false }
              ]
            },
            // 자율학습모드 폴더의 카드들
            {
              srsfolderitem: {
                some: {
                  srsfolder: {
                    learningCurveType: 'free'
                  }
                }
              }
            }
          ]
        }
      },
      select: { id: true, userId: true, overdueDeadline: true, isFromWrongAnswer: true, wrongStreakCount: true, stage: true }
    });

    for (const card of cardsToFreeze) {
      // 24시간 동결 상태로 전환 (가속 적용)
      let frozenUntil;
      try {
        const { getAccelerated24Hours } = require('../routes/timeAccelerator');
        frozenUntil = new Date(now.getTime() + getAccelerated24Hours());
      } catch (e) {
        // 가속 시스템 실패 시 원본 로직 사용
        frozenUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      }
      
      await prisma.srscard.update({
        where: { id: card.id },
        data: {
          // stage: 현재 stage 유지 (동결 중에는 stage 변경 없음)
          nextReviewAt: null,
          isOverdue: false,
          waitingUntil: null,
          overdueDeadline: null,
          overdueStartAt: null,
          frozenUntil: frozenUntil, // 24시간 동결 설정
          wrongStreakCount: { increment: 1 }, // 미응시로 인한 페널티
        }
      });
      
      logger.info(`[srsJobs] Card ${card.id} frozen for 24h due to overdue deadline exceeded (stage ${card.stage} preserved)`);
      logger.info(`  - Frozen until: ${frozenUntil.toISOString()}`);
      
      affectedUsers.add(card.userId);
    }

    if (cardsToFreeze.length > 0) {
      logger.info(`[srsJobs] Frozen ${cardsToFreeze.length} cards for 24h (overdue deadline exceeded)`);
    }

    // 3. 동결 시간이 끝난 카드들을 overdue 상태로 복귀
    const cardsToUnfreeze = await prisma.srscard.findMany({
      where: {
        frozenUntil: { lte: now }
      },
      select: { id: true, userId: true, frozenUntil: true, stage: true }
    });

    for (const card of cardsToUnfreeze) {
      // 동결 해제 후 즉시 overdue 상태로 복귀 (새로운 24시간 창 시작, 가속 적용)
      let newOverdueDeadline;
      try {
        const { getAccelerated24Hours } = require('../routes/timeAccelerator');
        newOverdueDeadline = new Date(now.getTime() + getAccelerated24Hours());
      } catch (e) {
        // 가속 시스템 실패 시 원본 로직 사용
        newOverdueDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      }
      
      await prisma.srscard.update({
        where: { id: card.id },
        data: {
          frozenUntil: null, // 동결 해제
          waitingUntil: null, // 대기 상태 해제 (즉시 overdue로)
          isOverdue: true, // 즉시 overdue 상태로 복귀
          overdueDeadline: newOverdueDeadline, // 새로운 24시간 창 시작
          overdueStartAt: now
        }
      });
      
      logger.info(`[srsJobs] Card ${card.id} unfrozen and returned to overdue (new 24h window)`);
      logger.info(`  - New overdue deadline: ${newOverdueDeadline.toISOString()}`);
      
      affectedUsers.add(card.userId);
    }

    if (cardsToUnfreeze.length > 0) {
      logger.info(`[srsJobs] Unfrozen ${cardsToUnfreeze.length} cards and returned to overdue`);
    }
    
    // 4. 영향받은 사용자들의 overdue 상태 업데이트
    for (const userId of affectedUsers) {
      const hasOverdue = await hasOverdueCards(userId);
      await prisma.user.update({
        where: { id: userId },
        data: {
          hasOverdueCards: hasOverdue,
          lastOverdueCheck: now
        }
      });
    }
    
    if (affectedUsers.size > 0) {
      logger.info(`[srsJobs] Updated overdue status for ${affectedUsers.size} affected users`);
    }

  } catch (error) {
    logger.error(`[srsJobs] Error managing overdue cards:`, error);
  }
}

/**
 * 대기 중인 카드들의 복습 상태를 확인합니다.
 * 대기 중에는 아무런 상태 변화가 없습니다.
 */
function isCardInWaitingPeriod(card) {
  if (!card.waitingUntil) return false;
  // 타임머신 시간 적용
  const { getOffsetDate } = require('../routes/timeMachine');
  const now = getOffsetDate();
  return now < new Date(card.waitingUntil);
}

/**
 * 카드가 overdue 상태인지 확인합니다.
 */
function isCardOverdue(card) {
  // overdue 상태인 카드는 데드라인과 관계없이 항상 정답/오답 처리 가능
  // 데드라인은 크론잡의 자동 stage 리셋을 위한 것이지, 사용자 입력을 막는 것이 아님
  return card.isOverdue === true;
}

/**
 * 카드가 동결 상태인지 확인합니다.
 */
function isCardFrozen(card) {
  if (!card.frozenUntil) return false;
  // 타임머신 시간 적용
  const { getOffsetDate } = require('../routes/timeMachine');
  const now = getOffsetDate();
  return now < new Date(card.frozenUntil);
}

/**
 * 사용자에게 overdue 카드가 있는지 확인합니다.
 */
async function hasOverdueCards(userId) {
  // 타임머신 시간 적용
  const { getOffsetDate } = require('../routes/timeMachine');
  const now = getOffsetDate();
  
  const count = await prisma.srscard.count({
    where: {
      userId: userId,
      isOverdue: true,
      overdueDeadline: { gt: now }
    }
  });
  
  return count > 0;
}

/**
 * 모든 사용자의 overdue 상태를 업데이트합니다.
 */
async function updateAllUsersOverdueStatus(logger = console) {
  try {
    // 타임머신 시간 적용
    const { getOffsetDate } = require('../routes/timeMachine');
    const now = getOffsetDate();
    
    // 모든 사용자 ID 조회
    const users = await prisma.user.findMany({
      select: { id: true }
    });
    
    for (const user of users) {
      const hasOverdue = await hasOverdueCards(user.id);
      
      await prisma.user.update({
        where: { id: user.id },
        data: {
          hasOverdueCards: hasOverdue,
          lastOverdueCheck: now
        }
      });
    }
    
    logger.info(`[srsJobs] Updated overdue status for ${users.length} users`);
    
  } catch (error) {
    logger.error(`[srsJobs] Error updating overdue status:`, error);
  }
}

/**
 * overdue 카드가 있는 사용자들에게 알림 시각을 설정합니다.
 */
async function setOverdueAlarms(logger = console) {
  try {
    // 타임머신 시간 적용
    const { getOffsetDate } = require('../routes/timeMachine');
    const now = getOffsetDate();
    const nextAlarmTime = new Date(now.getTime() + 6 * 60 * 60 * 1000); // 6시간 후
    
    // overdue 카드가 있는 사용자들의 알림 시각 설정
    const result = await prisma.user.updateMany({
      where: {
        hasOverdueCards: true,
        OR: [
          { nextOverdueAlarm: null },
          { nextOverdueAlarm: { lte: now } }
        ]
      },
      data: {
        nextOverdueAlarm: nextAlarmTime
      }
    });
    
    if (result.count > 0) {
      logger.info(`[srsJobs] Set overdue alarms for ${result.count} users at ${nextAlarmTime.toISOString()}`);
    }
    
    // overdue 카드가 없는 사용자들의 알림 비활성화
    const disabledResult = await prisma.user.updateMany({
      where: {
        hasOverdueCards: false,
        nextOverdueAlarm: { not: null }
      },
      data: {
        nextOverdueAlarm: null
      }
    });
    
    if (disabledResult.count > 0) {
      logger.info(`[srsJobs] Disabled overdue alarms for ${disabledResult.count} users`);
    }
    
  } catch (error) {
    logger.error(`[srsJobs] Error setting overdue alarms:`, error);
  }
}

module.exports = { 
  sixHourlyNotify, 
  midnightRoll, 
  startOfKstDay, 
  addKstDays, 
  manageOverdueCards,
  isCardInWaitingPeriod,
  isCardOverdue,
  isCardFrozen,
  hasOverdueCards,
  updateAllUsersOverdueStatus,
  setOverdueAlarms
};
