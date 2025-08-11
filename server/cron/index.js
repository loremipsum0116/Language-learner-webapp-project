// server/cron/index.js
const cron = require('node-cron');
const { sixHourlyNotify, midnightRoll } = require('../services/srsJobs');
const { scheduleStreakReset } = require('./streak-reset');

// 6시간 간격(정시) — 매일 KST
// cron.schedule('0 */6 * * *', () => sixHourlyNotify().catch(console.error), { timezone: 'Asia/Seoul' });
cron.schedule('*/1 * * * *', () => sixHourlyNotify().catch(console.error), { timezone: 'Asia/Seoul' });

// 자정 00:05 롤업 — 매일 KST
cron.schedule('5 0 * * *', () => midnightRoll().catch(console.error), { timezone: 'Asia/Seoul' });

// Streak 리셋 및 오답노트 정리 스케줄러 시작
scheduleStreakReset();

console.log('[cron] schedules registered (KST)');
