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
    const res = await prisma.srsFolder.updateMany({
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
  
  try {
    // 0. 기존 overdue 카드들의 데드라인을 타임머신 시간 기준으로 재계산
    // 타임머신 이동 시 기존 overdue 카드들이 올바르게 동결될 수 있도록 데드라인 검증
    const allOverdueCards = await prisma.sRSCard.findMany({
      where: { 
        isOverdue: true,
        isFrozen: false // 이미 동결된 카드는 제외
      },
      select: { id: true, userId: true, overdueStartAt: true, overdueDeadline: true, stage: true }
    });
    
    logger.info(`[srsJobs] ⏰ Time machine check: Current time: ${now.toISOString()}`);
    
    logger.info(`[srsJobs] Found ${allOverdueCards.length} overdue cards to check for time machine freeze`);
    
    for (const card of allOverdueCards) {
      logger.info(`[srsJobs] Checking card ${card.id}:`);
      logger.info(`  - stage: ${card.stage}`);
      logger.info(`  - overdueStartAt: ${card.overdueStartAt?.toISOString()}`);
      logger.info(`  - overdueDeadline: ${card.overdueDeadline?.toISOString()}`);
      logger.info(`  - current time (time machine): ${now.toISOString()}`);
      
      // 기존 overdueStartAt에서 24시간 후가 현재 타임머신 시간보다 이전인 경우 즉시 동결 처리
      if (card.overdueStartAt && card.overdueDeadline) {
        const originalDeadline = new Date(card.overdueDeadline);
        const hoursLeft = Math.round((originalDeadline.getTime() - now.getTime()) / (60 * 60 * 1000));
        
        logger.info(`  - hours left until deadline: ${hoursLeft}`);
        
        // 데드라인이 현재 타임머신 시간을 이미 지났다면 동결 상태로 전환
        if (originalDeadline <= now) {
          // 동결은 실제 시간 기준으로 24시간 (타임머신과 무관한 페널티)
          const realNow = new Date();
          const frozenUntil = new Date(realNow.getTime() + 24 * 60 * 60 * 1000);
          
          logger.info(`[srsJobs] ❄️  FREEZING Card ${card.id} due to expired deadline (time machine)`);
          logger.info(`  - original deadline: ${originalDeadline.toISOString()}`);
          logger.info(`  - current time: ${now.toISOString()}`);
          logger.info(`  - frozenUntil: ${frozenUntil.toISOString()}`);
          
          await prisma.sRSCard.update({
            where: { id: card.id },
            data: {
              isOverdue: false,
              isFrozen: true,
              frozenUntil: frozenUntil,
              overdueDeadline: null,
              overdueStartAt: null,
              waitingUntil: null,
              nextReviewAt: null
            }
          });
          
          affectedUsers.add(card.userId);
        } else {
          logger.info(`  - deadline not expired yet, no freeze needed`);
        }
      } else {
        logger.info(`  - missing overdueStartAt or overdueDeadline, skipping`);
      }
    }
    
    // 1. overdue 상태로 변경해야 할 카드들 찾기
    // 1-1. waitingUntil 기반 (오답 처리 후 대기)
    const cardsToMarkOverdueWaiting = await prisma.sRSCard.findMany({
      where: {
        waitingUntil: { lte: now },
        isOverdue: false
      },
      select: { id: true, userId: true, waitingUntil: true, isFromWrongAnswer: true, stage: true }
    });

    // 1-2. nextReviewAt 기반 (정답 후 다음 복습일)
    // nextReviewAt - 24시간이 현재 시간을 지났지만 아직 isOverdue가 false인 카드들
    const cardsToMarkOverdueNext = await prisma.sRSCard.findMany({
      where: {
        nextReviewAt: { not: null },
        isOverdue: false,
        waitingUntil: null, // waitingUntil이 있는 카드는 위에서 이미 처리됨
      },
      select: { id: true, userId: true, nextReviewAt: true, isFromWrongAnswer: true, stage: true }
    });

    // nextReviewAt 카드들 중 overdue 시작 시간(nextReviewAt - 24시간)이 지난 것들만 필터링
    const cardsToMarkOverdueNextFiltered = cardsToMarkOverdueNext.filter(card => {
      const overdueStartTime = new Date(card.nextReviewAt.getTime() - 24 * 60 * 60 * 1000);
      return overdueStartTime <= now;
    });

    const cardsToMarkOverdue = [...cardsToMarkOverdueWaiting, ...cardsToMarkOverdueNextFiltered];

    for (const card of cardsToMarkOverdue) {
      // overdue 상태로 변경하고 24시간 데드라인 설정
      // 수정: overdue 시작 시점(now)에서 24시간 후로 설정 (모든 stage 동일)
      const overdueDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      logger.info(`[srsJobs] Card ${card.id} marked overdue:`);
      if (card.waitingUntil) {
        logger.info(`  - waitingUntil: ${card.waitingUntil.toISOString()}`);
      } else if (card.nextReviewAt) {
        logger.info(`  - nextReviewAt: ${card.nextReviewAt.toISOString()}`);
      }
      logger.info(`  - now (time machine): ${now.toISOString()}`);
      logger.info(`  - overdueDeadline: ${overdueDeadline.toISOString()}`);
      logger.info(`  - hours until deadline: ${Math.round((overdueDeadline.getTime() - now.getTime()) / (60 * 60 * 1000))}`);
      
      await prisma.sRSCard.update({
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

    // 2. overdue 데드라인이 지난 카드들을 동결 상태로 전환 (24시간 페널티)
    const cardsToFreeze = await prisma.sRSCard.findMany({
      where: {
        isOverdue: true,
        overdueDeadline: { lte: now }
      },
      select: { id: true, userId: true, overdueDeadline: true, isFromWrongAnswer: true, wrongStreakCount: true, stage: true }
    });

    for (const card of cardsToFreeze) {
      // 동결 상태로 전환 (24시간 페널티)
      // 동결은 실제 시간 기준으로 24시간 (타임머신과 무관한 페널티)
      const realNow = new Date();
      const frozenUntil = new Date(realNow.getTime() + 24 * 60 * 60 * 1000);
      
      await prisma.sRSCard.update({
        where: { id: card.id },
        data: {
          isOverdue: false,
          isFrozen: true, // 동결 상태 설정
          frozenUntil: frozenUntil, // 24시간 후 해제
          overdueDeadline: null,
          overdueStartAt: null,
          waitingUntil: null,
          nextReviewAt: null
        }
      });
      
      logger.info(`[srsJobs] Card ${card.id} frozen for 24h due to overdue deadline exceeded`);
      logger.info(`  - frozenUntil: ${frozenUntil.toISOString()}`);
      
      affectedUsers.add(card.userId);
    }

    if (cardsToFreeze.length > 0) {
      logger.info(`[srsJobs] Froze ${cardsToFreeze.length} cards for overdue deadline exceeded`);
    }
    
    // 3. 동결 해제된 카드들을 다시 overdue 상태로 전환
    // 동결 해제는 실제 시간 기준으로 처리 (타임머신과 무관)
    const realNow = new Date();
    const cardsToUnfreeze = await prisma.sRSCard.findMany({
      where: {
        isFrozen: true,
        frozenUntil: { lte: realNow }
      },
      select: { id: true, userId: true, frozenUntil: true, stage: true }
    });

    for (const card of cardsToUnfreeze) {
      // 동결 해제 후 즉시 overdue 상태로 전환 (새로운 24시간 응시 창)
      // overdue 데드라인은 타임머신 시간 기준 24시간 후로 설정 (학습 스케줄)
      const overdueDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      await prisma.sRSCard.update({
        where: { id: card.id },
        data: {
          isFrozen: false,
          frozenUntil: null,
          isOverdue: true,
          overdueDeadline: overdueDeadline,
          overdueStartAt: now, // 타임머신 시간 기준으로 overdue 시작
          waitingUntil: null,
          nextReviewAt: overdueDeadline // overdue 데드라인을 nextReviewAt으로 설정하여 타이머 표시
        }
      });
      
      logger.info(`[srsJobs] Card ${card.id} unfrozen and marked overdue with new 24h deadline`);
      logger.info(`  - new overdueDeadline: ${overdueDeadline.toISOString()}`);
      
      affectedUsers.add(card.userId);
    }

    if (cardsToUnfreeze.length > 0) {
      logger.info(`[srsJobs] Unfroze ${cardsToUnfreeze.length} cards and marked them overdue`);
    }
    
    // 3. 영향받은 사용자들의 overdue 상태 업데이트
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
  if (!card.isFrozen) return false;
  // 동결 해제는 실제 시간 기준 (타임머신과 무관한 페널티)
  const realNow = new Date();
  return card.frozenUntil && realNow < new Date(card.frozenUntil);
}

/**
 * 사용자에게 overdue 카드가 있는지 확인합니다.
 */
async function hasOverdueCards(userId) {
  // 타임머신 시간 적용
  const { getOffsetDate } = require('../routes/timeMachine');
  const now = getOffsetDate();
  
  const count = await prisma.sRSCard.count({
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
