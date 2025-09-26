// 모든 Stage 카드들의 타이머 상태 확인
const mysql = require('mysql2/promise');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const relativeTime = require('dayjs/plugin/relativeTime');

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

async function checkAllStages() {
    const connection = await mysql.createConnection({
        host: 'shuttle.proxy.rlwy.net',
        port: 25466,
        user: 'root',
        password: 'mdsooQRAMNBnvXHjTyMYwpQvmXUtlZsG',
        database: 'railway'
    });

    try {
        console.log('🔍 모든 Stage 타이머 상태 확인 시작...');
        console.log('현재 시간(KST):', dayjs().tz('Asia/Seoul').format('YYYY-MM-DD HH:mm:ss'));
        console.log('===================================');

        // DAY1, DAY2 폴더별 모든 Stage 확인
        const folders = [
            { id: 75, name: 'DAY1' },
            { id: 76, name: 'DAY2' }
        ];

        for (const folder of folders) {
            console.log(`\n📁 ${folder.name} 폴더 분석:`);
            console.log('─'.repeat(50));

            // Stage별 카드 수와 타이머 차이 확인
            const [stageInfo] = await connection.execute(`
                SELECT
                    stage,
                    COUNT(*) as cardCount,
                    MIN(nextReviewAt) as minTime,
                    MAX(nextReviewAt) as maxTime
                FROM srscard
                WHERE userId = 4
                AND folderId = ${folder.id}
                AND nextReviewAt IS NOT NULL
                GROUP BY stage
                ORDER BY stage
            `);

            const now = dayjs().tz('Asia/Seoul');

            for (const stage of stageInfo) {
                const minTime = dayjs.utc(stage.minTime).tz('Asia/Seoul');
                const maxTime = dayjs.utc(stage.maxTime).tz('Asia/Seoul');
                const diffMs = maxTime.diff(minTime);
                const diffMinutes = Math.round(diffMs / (60 * 1000));
                const diffSeconds = Math.round((diffMs % (60 * 1000)) / 1000);

                console.log(`  Stage ${stage.stage}: ${stage.cardCount}개 카드`);
                console.log(`    최조: ${minTime.format('HH:mm:ss')} (${minTime.from(now)})`);
                console.log(`    최종: ${maxTime.format('HH:mm:ss')} (${maxTime.from(now)})`);
                console.log(`    차이: ${diffMinutes}분 ${diffSeconds}초`);

                if (diffMs === 0) {
                    console.log(`    ✅ 완벽 동기화`);
                } else if (diffMinutes <= 1) {
                    console.log(`    🟡 거의 동기화 (1분 이내)`);
                } else {
                    console.log(`    ❌ 동기화 필요`);
                }
                console.log('');
            }

            // 특정 카드들의 상세 정보 (사용자가 보고한 카드들)
            console.log(`  📋 ${folder.name} 주요 카드들 상세 정보:`);

            const [detailCards] = await connection.execute(`
                SELECT
                    sc.id,
                    sc.stage,
                    sc.nextReviewAt,
                    sc.waitingUntil,
                    sc.frozenUntil,
                    sc.isOverdue,
                    sc.overdueDeadline,
                    sc.isFromWrongAnswer,
                    v.lemma
                FROM srscard sc
                LEFT JOIN vocab v ON sc.itemId = v.id
                WHERE sc.userId = 4
                AND sc.folderId = ${folder.id}
                AND sc.nextReviewAt IS NOT NULL
                ORDER BY sc.nextReviewAt
                LIMIT 10
            `);

            detailCards.forEach((card, index) => {
                const nextReview = dayjs.utc(card.nextReviewAt).tz('Asia/Seoul');
                const diffFromNow = nextReview.from(now);

                let status = '';
                if (card.frozenUntil) status += '❄️동결 ';
                if (card.isOverdue) status += '⚠️지연 ';
                if (card.isFromWrongAnswer) status += '❌오답 ';
                if (card.waitingUntil) status += '⏳대기 ';

                console.log(`    ${index + 1}. ${card.lemma || `Card${card.id}`} (Stage ${card.stage})`);
                console.log(`       타이머: ${nextReview.format('HH:mm:ss')} (${diffFromNow})`);
                console.log(`       상태: ${status || '일반'}`);
            });
        }

        // 전체 요약
        console.log('\n📊 전체 요약:');
        console.log('─'.repeat(50));

        const [totalInfo] = await connection.execute(`
            SELECT
                sf.name as folderName,
                sc.stage,
                COUNT(*) as cardCount,
                MIN(sc.nextReviewAt) as minTime,
                MAX(sc.nextReviewAt) as maxTime
            FROM srscard sc
            JOIN srsfolder sf ON sc.folderId = sf.id
            WHERE sc.userId = 4
            AND sf.id IN (75, 76)
            AND sc.nextReviewAt IS NOT NULL
            GROUP BY sf.name, sc.stage
            ORDER BY sf.name, sc.stage
        `);

        totalInfo.forEach(info => {
            const minTime = dayjs.utc(info.minTime).tz('Asia/Seoul');
            const maxTime = dayjs.utc(info.maxTime).tz('Asia/Seoul');
            const diffMs = maxTime.diff(minTime);
            const diffMinutes = Math.round(diffMs / (60 * 1000));

            console.log(`${info.folderName} Stage ${info.stage}: ${info.cardCount}개, ${diffMinutes}분 차이`);
        });

    } catch (error) {
        console.error('❌ 확인 실패:', error);
    } finally {
        await connection.end();
    }
}

checkAllStages();