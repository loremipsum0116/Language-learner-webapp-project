// 현재 동기화 상태 실시간 확인
const mysql = require('mysql2/promise');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

async function checkCurrentSyncState() {
    const connection = await mysql.createConnection({
        host: 'shuttle.proxy.rlwy.net',
        port: 25466,
        user: 'root',
        password: 'mdsooQRAMNBnvXHjTyMYwpQvmXUtlZsG',
        database: 'railway'
    });

    try {
        console.log('🔍 실시간 동기화 상태 확인');
        console.log('현재 시간:', dayjs().tz('Asia/Seoul').format('YYYY-MM-DD HH:mm:ss'));
        console.log('='.repeat(60));

        // Stage별 타이머 분석
        const [cards] = await connection.execute(`
            SELECT
                sf.name as folderName,
                sc.stage,
                COUNT(*) as count,
                MIN(sc.nextReviewAt) as minTime,
                MAX(sc.nextReviewAt) as maxTime,
                MIN(sc.waitingUntil) as minWaiting,
                MAX(sc.waitingUntil) as maxWaiting
            FROM srscard sc
            JOIN srsfolder sf ON sc.folderId = sf.id
            WHERE sc.userId = 4
            AND sf.name IN ('DAY1', 'DAY2')
            AND sc.nextReviewAt IS NOT NULL
            GROUP BY sf.name, sc.stage
            ORDER BY sf.name, sc.stage
        `);

        for (const row of cards) {
            console.log(`\n📁 ${row.folderName} - Stage ${row.stage} (${row.count}개)`);

            // nextReviewAt 분석
            if (row.minTime && row.maxTime) {
                const minTime = dayjs.utc(row.minTime).tz('Asia/Seoul');
                const maxTime = dayjs.utc(row.maxTime).tz('Asia/Seoul');
                const diffMs = maxTime.diff(minTime);
                const diffMinutes = Math.floor(diffMs / 60000);
                const diffSeconds = Math.floor((diffMs % 60000) / 1000);

                console.log(`  nextReviewAt:`);
                console.log(`    최소: ${minTime.format('MM-DD HH:mm:ss')}`);
                console.log(`    최대: ${maxTime.format('MM-DD HH:mm:ss')}`);
                console.log(`    차이: ${diffMinutes}분 ${diffSeconds}초`);

                if (diffMs === 0) {
                    console.log(`    ✅ 완벽 동기화`);
                } else if (diffMinutes < 5) {
                    console.log(`    ⚠️ 미세한 차이 존재`);
                } else {
                    console.log(`    ❌ 동기화 필요`);
                }
            }

            // waitingUntil 분석
            if (row.minWaiting && row.maxWaiting) {
                const minWaiting = dayjs.utc(row.minWaiting).tz('Asia/Seoul');
                const maxWaiting = dayjs.utc(row.maxWaiting).tz('Asia/Seoul');
                const diffMs = maxWaiting.diff(minWaiting);
                const diffMinutes = Math.floor(diffMs / 60000);
                const diffSeconds = Math.floor((diffMs % 60000) / 1000);

                console.log(`  waitingUntil:`);
                console.log(`    최소: ${minWaiting.format('MM-DD HH:mm:ss')}`);
                console.log(`    최대: ${maxWaiting.format('MM-DD HH:mm:ss')}`);
                console.log(`    차이: ${diffMinutes}분 ${diffSeconds}초`);
            }
        }

        // 최근 업데이트 확인
        const [recentUpdates] = await connection.execute(`
            SELECT
                COUNT(*) as count,
                MAX(lastReviewedAt) as lastUpdate
            FROM srscard sc
            JOIN srsfolder sf ON sc.folderId = sf.id
            WHERE sc.userId = 4
            AND sf.name IN ('DAY1', 'DAY2')
            AND lastReviewedAt > DATE_SUB(NOW(), INTERVAL 10 MINUTE)
        `);

        console.log('\n📊 최근 활동:');
        if (recentUpdates[0].count > 0) {
            const lastUpdate = dayjs.utc(recentUpdates[0].lastUpdate).tz('Asia/Seoul');
            console.log(`  최근 10분내 업데이트: ${recentUpdates[0].count}개`);
            console.log(`  마지막 업데이트: ${lastUpdate.format('HH:mm:ss')} (${lastUpdate.fromNow()})`);
        } else {
            console.log(`  최근 10분내 업데이트 없음`);
        }

    } catch (error) {
        console.error('❌ 확인 실패:', error);
    } finally {
        await connection.end();
    }
}

checkCurrentSyncState();