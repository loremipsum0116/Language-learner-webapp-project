// server/cron/streak-reset.js
const cron = require('node-cron');
const { resetStreaksForInactiveUsers } = require('../services/streakService');
const { cleanupExpiredReviewWindows } = require('../services/wrongAnswerService');

// 매일 자정(KST) 실행: 0 0 * * *
// 개발/테스트 시에는 더 자주 실행하려면 */5 * * * * (5분마다)로 변경 가능
const scheduleStreakReset = () => {
  // 매일 자정에 실행
  cron.schedule('0 0 * * *', async () => {
    console.log('[CRON] Starting daily streak reset and cleanup tasks...');
    
    try {
      // 1. 비활성 사용자들의 streak 리셋
      await resetStreaksForInactiveUsers();
      console.log('[CRON] Streak reset completed');
      
      // 2. 만료된 오답노트 정리
      await cleanupExpiredReviewWindows();
      console.log('[CRON] Wrong answer cleanup completed');
      
      console.log('[CRON] Daily maintenance tasks completed successfully');
    } catch (error) {
      console.error('[CRON] Daily maintenance tasks failed:', error);
    }
  }, {
    timezone: 'Asia/Seoul' // KST 기준으로 실행
  });
  
  console.log('[CRON] Streak reset scheduler initialized');
};

module.exports = { scheduleStreakReset };