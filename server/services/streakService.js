// server/services/streakService.js
const { prisma } = require('../lib/prismaClient');
const dayjs = require('dayjs');

const REQUIRED_DAILY_QUIZZES = 10; // 연속 학습 유지를 위한 최소 퀴즈 개수

/**
 * 사용자의 연속 학습 일수를 업데이트합니다.
 * 10개 이상 퀴즈를 풀면 streak 증가, 그렇지 않으면 0으로 리셋
 */
async function updateUserStreak(userId) {
  // 타임머신 시간 오프셋 적용
  const { getOffsetDate } = require('../routes/timeMachine');
  const now = dayjs(getOffsetDate());
  const today = now.startOf('day');
  
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });
  
  if (!user) throw new Error('User not found');
  
  // 오늘 날짜와 마지막 퀴즈 날짜 비교
  const lastQuizDate = user.lastQuizDate ? dayjs(user.lastQuizDate).startOf('day') : null;
  const streakUpdatedAt = user.streakUpdatedAt ? dayjs(user.streakUpdatedAt).startOf('day') : null;
  
  let newStreak = user.streak;
  let newDailyQuizCount = user.dailyQuizCount;
  
  // 새로운 날이 시작되면 일일 퀴즈 카운트 리셋
  if (!lastQuizDate || !lastQuizDate.isSame(today)) {
    newDailyQuizCount = 0;
  }
  
  // 퀴즈 카운트 증가
  newDailyQuizCount += 1;
  
  // 연속 학습 일수 로직
  if (newDailyQuizCount >= REQUIRED_DAILY_QUIZZES) {
    // 10개 이상 풀었을 때
    if (!streakUpdatedAt || !streakUpdatedAt.isSame(today)) {
      // 오늘 아직 streak을 업데이트하지 않았다면
      if (streakUpdatedAt && streakUpdatedAt.isSame(today.subtract(1, 'day'))) {
        // 어제 연속으로 했다면 +1
        newStreak += 1;
      } else {
        // 연속이 끊어졌다면 1부터 시작
        newStreak = 1;
      }
    }
    // 이미 오늘 업데이트했다면 streak은 그대로 유지
  }
  
  // streak 업데이트 조건 체크: 하루가 지났는데 10개 이상 안 풀었으면 리셋
  if (streakUpdatedAt && 
      !streakUpdatedAt.isSame(today) && 
      !streakUpdatedAt.isSame(today.subtract(1, 'day')) &&
      newDailyQuizCount < REQUIRED_DAILY_QUIZZES) {
    newStreak = 0;
  }
  
  await prisma.user.update({
    where: { id: userId },
    data: {
      dailyQuizCount: newDailyQuizCount,
      lastQuizDate: now.toDate(),
      streak: newStreak,
      streakUpdatedAt: newDailyQuizCount >= REQUIRED_DAILY_QUIZZES ? now.toDate() : user.streakUpdatedAt
    }
  });
  
  return {
    streak: newStreak,
    dailyQuizCount: newDailyQuizCount,
    requiredDaily: REQUIRED_DAILY_QUIZZES
  };
}

/**
 * 자정에 실행되는 일일 리셋 작업
 * 전날에 10개 이상 퀴즈를 안 푼 사용자들의 streak을 0으로 리셋
 */
async function resetStreaksForInactiveUsers() {
  // 타임머신 시간 오프셋 적용
  const { getOffsetDate } = require('../routes/timeMachine');
  const yesterday = dayjs(getOffsetDate()).subtract(1, 'day').startOf('day');
  
  // 어제 10개 이상 퀴즈를 안 푼 사용자들 찾기
  const inactiveUsers = await prisma.user.findMany({
    where: {
      OR: [
        {
          // 어제 퀴즈를 안 푼 사용자
          lastQuizDate: {
            lt: yesterday.toDate()
          }
        },
        {
          // 퀴즈는 풀었지만 10개 미만인 사용자 (이건 실시간에서 처리하므로 여기서는 생략 가능)
          lastQuizDate: {
            gte: yesterday.toDate(),
            lt: yesterday.add(1, 'day').toDate()
          },
          dailyQuizCount: {
            lt: REQUIRED_DAILY_QUIZZES
          }
        }
      ],
      streak: {
        gt: 0 // streak이 0보다 큰 사용자들만
      }
    }
  });
  
  if (inactiveUsers.length > 0) {
    await prisma.user.updateMany({
      where: {
        id: {
          in: inactiveUsers.map(u => u.id)
        }
      },
      data: {
        streak: 0,
        dailyQuizCount: 0
      }
    });
    
    console.log(`Reset streaks for ${inactiveUsers.length} inactive users`);
  }
}

/**
 * 사용자 streak 정보 조회
 */
async function getUserStreakInfo(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      streak: true,
      dailyQuizCount: true,
      lastQuizDate: true,
      streakUpdatedAt: true
    }
  });
  
  if (!user) throw new Error('User not found');
  
  // 타임머신 시간 오프셋 적용
  const { getOffsetDate } = require('../routes/timeMachine');
  const today = dayjs(getOffsetDate()).startOf('day');
  const lastQuizDate = user.lastQuizDate ? dayjs(user.lastQuizDate).startOf('day') : null;
  
  // 오늘 퀴즈를 안 풀었으면 dailyQuizCount를 0으로 표시
  const currentDailyCount = lastQuizDate && lastQuizDate.isSame(today) ? user.dailyQuizCount : 0;
  
  return {
    streak: user.streak,
    dailyQuizCount: currentDailyCount,
    requiredDaily: REQUIRED_DAILY_QUIZZES,
    remainingForStreak: Math.max(0, REQUIRED_DAILY_QUIZZES - currentDailyCount),
    lastQuizDate: user.lastQuizDate
  };
}

module.exports = {
  updateUserStreak,
  resetStreaksForInactiveUsers,
  getUserStreakInfo,
  REQUIRED_DAILY_QUIZZES
};