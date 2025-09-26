// waitingUntil 값들 확인
const mysql = require('mysql2/promise');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const relativeTime = require('dayjs/plugin/relativeTime');

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

async function checkWaitingUntil() {
    const connection = await mysql.createConnection({
        host: 'shuttle.proxy.rlwy.net',
        port: 25466,
        user: 'root',
        password: 'mdsooQRAMNBnvXHjTyMYwpQvmXUtlZsG',
        database: 'railway'
    });

    try {
        console.log('🔍 waitingUntil 값 분석 시작...');
        console.log('현재 시간(KST):', dayjs().tz('Asia/Seoul').format('YYYY-MM-DD HH:mm:ss'));
        console.log('===================================');

        // DAY1, DAY2 폴더의 waitingUntil 값들 확인
        const [cards] = await connection.execute(`
            SELECT
                sf.name as folderName,
                sc.id,
                sc.stage,
                sc.nextReviewAt,
                sc.waitingUntil,
                v.lemma
            FROM srscard sc
            JOIN srsfolder sf ON sc.folderId = sf.id
            LEFT JOIN vocab v ON sc.itemId = v.id
            WHERE sc.userId = 4
            AND sf.id IN (75, 76)
            AND sc.nextReviewAt IS NOT NULL
            ORDER BY sf.name, sc.waitingUntil
            LIMIT 20
        `);

        console.log(`📊 발견된 카드 수: ${cards.length}개`);
        console.log('');

        const now = dayjs().tz('Asia/Seoul');

        // 폴더별로 분석
        const cardsByFolder = {};
        cards.forEach(card => {
            if (!cardsByFolder[card.folderName]) {
                cardsByFolder[card.folderName] = [];
            }
            cardsByFolder[card.folderName].push(card);
        });

        for (const [folderName, folderCards] of Object.entries(cardsByFolder)) {
            console.log(`📁 ${folderName} 폴더:`);
            console.log('─'.repeat(50));

            // waitingUntil 값들 분석
            const waitingTimes = folderCards
                .filter(card => card.waitingUntil)
                .map(card => {
                    const waitingTime = dayjs.utc(card.waitingUntil).tz('Asia/Seoul');
                    const nextReviewTime = dayjs.utc(card.nextReviewAt).tz('Asia/Seoul');
                    const diffFromNow = waitingTime.diff(now);
                    const diffMinutes = Math.round(diffFromNow / (60 * 1000));
                    const diffSeconds = Math.round((diffFromNow % (60 * 1000)) / 1000);

                    return {
                        card: card.lemma || `Card${card.id}`,
                        waitingUntil: card.waitingUntil,
                        waitingKST: waitingTime.format('HH:mm:ss'),
                        nextReviewKST: nextReviewTime.format('HH:mm:ss'),
                        diffMinutes,
                        diffSeconds,
                        stage: card.stage
                    };
                });

            if (waitingTimes.length > 0) {
                // 시간 차이 분석
                const waitingTimesMs = waitingTimes.map(wt => dayjs.utc(wt.waitingUntil).valueOf());
                const minWaitingTime = Math.min(...waitingTimesMs);
                const maxWaitingTime = Math.max(...waitingTimesMs);
                const totalDiffMs = maxWaitingTime - minWaitingTime;
                const totalDiffMinutes = Math.round(totalDiffMs / (60 * 1000));
                const totalDiffSeconds = Math.round((totalDiffMs % (60 * 1000)) / 1000);

                console.log(`⏰ waitingUntil 시간 차이: ${totalDiffMinutes}분 ${totalDiffSeconds}초`);
                console.log('');

                // 상위 5개 카드 표시
                console.log('📋 상세 waitingUntil 정보:');
                waitingTimes.slice(0, 5).forEach((item, index) => {
                    const sign = item.diffMinutes >= 0 ? '+' : '';
                    console.log(`  ${index + 1}. ${item.card} (Stage ${item.stage})`);
                    console.log(`     nextReviewAt: ${item.nextReviewKST}`);
                    console.log(`     waitingUntil: ${item.waitingKST} (${sign}${item.diffMinutes}분 ${item.diffSeconds}초)`);
                });

                if (waitingTimes.length > 5) {
                    console.log(`     ... 외 ${waitingTimes.length - 5}개 더`);
                }
            } else {
                console.log('waitingUntil 값이 없는 카드들입니다.');
            }
            console.log('');
        }

        // 전체 통계
        console.log('📈 전체 waitingUntil 통계:');
        console.log('─'.repeat(50));

        const allWaitingTimes = cards
            .filter(card => card.waitingUntil)
            .map(card => dayjs.utc(card.waitingUntil).valueOf());

        if (allWaitingTimes.length > 0) {
            const globalMin = Math.min(...allWaitingTimes);
            const globalMax = Math.max(...allWaitingTimes);
            const globalDiff = globalMax - globalMin;
            const globalDiffMinutes = Math.round(globalDiff / (60 * 1000));

            console.log(`전체 waitingUntil 시간 차이: ${globalDiffMinutes}분`);

            if (globalDiffMinutes === 0) {
                console.log('✅ waitingUntil 완벽 동기화');
            } else if (globalDiffMinutes <= 1) {
                console.log('🟡 waitingUntil 거의 동기화');
            } else {
                console.log('❌ waitingUntil 동기화 필요');
                console.log('');
                console.log('🔧 해결책: waitingUntil 값들도 동기화해야 함');
            }
        }

    } catch (error) {
        console.error('❌ 확인 실패:', error);
    } finally {
        await connection.end();
    }
}

checkWaitingUntil();