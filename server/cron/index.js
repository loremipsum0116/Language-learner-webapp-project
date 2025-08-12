// server/cron/index.js
const cron = require('node-cron');
const { sixHourlyNotify, midnightRoll, manageOverdueCards } = require('../services/srsJobs');
const { scheduleStreakReset } = require('./streak-reset');

// overdue 기반 6시간 간격 알림 — 매일 KST
cron.schedule('0 */6 * * *', () => sixHourlyNotify().catch(console.error), { timezone: 'Asia/Seoul' });
// 테스트용 1분 간격 (운영에서는 위 줄만 사용)
// cron.schedule('*/1 * * * *', () => sixHourlyNotify().catch(console.error), { timezone: 'Asia/Seoul' });

// 자정 00:05 롤업 — 매일 KST
cron.schedule('5 0 * * *', () => midnightRoll().catch(console.error), { timezone: 'Asia/Seoul' });

// Overdue 카드 관리 - 매 10분마다 실행
cron.schedule('*/10 * * * *', () => manageOverdueCards().catch(console.error), { timezone: 'Asia/Seoul' });

// Streak 리셋 및 오답노트 정리 스케줄러 시작
scheduleStreakReset();

console.log('[cron] schedules registered (KST) - overdue-based notification system enabled');
