// run-immediate-sync.js
// 즉시 자동 타이머 동일화 실행 스크립트

const { runPeriodicAutoSync } = require('./services/autoTimerSyncService');

async function runImmediateSync() {
    console.log('🚀 Starting immediate timer synchronization...');

    try {
        const result = await runPeriodicAutoSync();

        console.log('✅ Immediate synchronization completed!');
        console.log(`📊 Results: ${result.totalProcessed} subfolders processed, ${result.totalSynced} total cards synced`);

        if (result.totalSynced > 0) {
            console.log('🎯 Timer synchronization successful!');
        } else {
            console.log('ℹ️  No cards needed synchronization (all timers already aligned)');
        }

    } catch (error) {
        console.error('❌ Error during immediate synchronization:', error);
        process.exit(1);
    }

    process.exit(0);
}

// 즉시 실행
runImmediateSync();