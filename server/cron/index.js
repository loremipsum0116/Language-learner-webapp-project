// server/cron/index.js
const cron = require('node-cron');
const { sixHourlyNotify, midnightRoll, manageOverdueCards } = require('../services/srsJobs');
const { scheduleStreakReset } = require('./streak-reset');

// 동적 크론잡 관리 객체
let dynamicManageOverdueTask = null;

// overdue 기반 6시간 간격 알림 — 매일 KST
cron.schedule('0 */6 * * *', () => sixHourlyNotify().catch(console.error), { timezone: 'Asia/Seoul' });

// 자정 00:05 롤업 — 매일 KST
cron.schedule('5 0 * * *', () => midnightRoll().catch(console.error), { timezone: 'Asia/Seoul' });

// 가속 팩터에 따른 동적 overdue 관리 크론잡 설정
function updateOverdueCronFrequency() {
    try {
        const { getAccelerationFactor } = require('../routes/timeAccelerator');
        const accelerationFactor = getAccelerationFactor();
        
        // 기존 태스크가 있다면 중지
        if (dynamicManageOverdueTask) {
            dynamicManageOverdueTask.stop();
            dynamicManageOverdueTask = null;
        }
        
        let cronPattern;
        let description;
        
        if (accelerationFactor >= 1440) {
            // 1440x 이상: 5초마다 실행
            cronPattern = '*/5 * * * * *'; 
            description = '5초마다 (극한 가속)';
        } else if (accelerationFactor >= 60) {
            // 60x 이상: 15초마다 실행
            cronPattern = '*/15 * * * * *';
            description = '15초마다 (고속 가속)';
        } else if (accelerationFactor > 1) {
            // 1x 초과: 30초마다 실행
            cronPattern = '*/30 * * * * *';
            description = '30초마다 (가속 모드)';
        } else {
            // 1x (실시간): 10분마다 실행 (기본값)
            cronPattern = '*/10 * * * *';
            description = '10분마다 (실시간)';
        }
        
        // 새로운 태스크 생성 및 시작
        dynamicManageOverdueTask = cron.schedule(cronPattern, () => {
            manageOverdueCards().catch(console.error);
        }, { 
            timezone: 'Asia/Seoul',
            scheduled: false // 수동으로 시작
        });
        
        dynamicManageOverdueTask.start();
        
        console.log(`[cron] Overdue management updated: ${description} (${accelerationFactor}x acceleration)`);
        
    } catch (e) {
        console.error('[cron] Failed to update overdue cron frequency:', e);
        // 에러 시 기본 크론잡 사용
        if (!dynamicManageOverdueTask) {
            dynamicManageOverdueTask = cron.schedule('*/10 * * * *', () => {
                manageOverdueCards().catch(console.error);
            }, { timezone: 'Asia/Seoul' });
        }
    }
}

// 초기 overdue 관리 크론잡 설정
updateOverdueCronFrequency();

// 5분마다 가속 팩터 확인하여 크론잡 주기 업데이트
cron.schedule('*/5 * * * *', () => {
    updateOverdueCronFrequency();
}, { timezone: 'Asia/Seoul' });

// Streak 리셋 및 오답노트 정리 스케줄러 시작
scheduleStreakReset();

console.log('[cron] Dynamic schedules registered (KST) - acceleration-aware overdue management enabled');

// Export functions for external access
module.exports = {
    updateOverdueCronFrequency
};
