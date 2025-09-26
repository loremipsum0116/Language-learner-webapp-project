// 직접 MySQL 연결로 타이머 상태 확인
const mysql = require('mysql2/promise');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

async function checkTimerDirect() {
    const connection = await mysql.createConnection({
        host: 'shuttle.proxy.rlwy.net',
        port: 25466,
        user: 'root',
        password: 'mdsooQRAMNBnvXHjTyMYwpQvmXUtlZsG',
        database: 'railway'
    });

    try {
        console.log('🔍 Railway DB 타이머 상태 확인 시작...');
        console.log('현재 시간(KST):', dayjs().tz('Asia/Seoul').format('YYYY-MM-DD HH:mm:ss'));
        console.log('===================================');

        // User ID 4의 DAY1, DAY2 폴더 확인
        const [folders] = await connection.execute(`
            SELECT id, name FROM srsfolder
            WHERE userId = 4 AND name IN ('DAY1', 'DAY2')
            ORDER BY name
        `);

        console.log('📁 발견된 폴더:', folders.map(f => `${f.name}(${f.id})`).join(', '));

        if (folders.length === 0) {
            console.log('❌ DAY1, DAY2 폴더를 찾을 수 없습니다.');
            return;
        }

        const folderIds = folders.map(f => f.id);

        // 먼저 테이블 구조 확인
        console.log('📋 테이블 구조 확인:');
        const [srsCardCols] = await connection.execute('DESCRIBE srscard');
        console.log('srscard 컬럼:', srsCardCols.map(c => c.Field).join(', '));

        // 폴더별로 카드들을 정확히 조회 (folderId 컬럼 사용)
        const [cards] = await connection.execute(`
            SELECT
                sc.id,
                sc.folderId,
                sc.nextReviewAt,
                sc.stage,
                sc.userId,
                sf.name as folderName
            FROM srscard sc
            LEFT JOIN srsfolder sf ON sc.folderId = sf.id
            WHERE sc.userId = 4
            AND sc.folderId IN (${folderIds.join(',')})
            AND sc.nextReviewAt IS NOT NULL
            ORDER BY sc.folderId, sc.nextReviewAt
        `);

        console.log(`📊 발견된 카드 수: ${cards.length}개`);
        console.log('');

        if (cards.length === 0) {
            console.log('❌ 타이머가 설정된 카드를 찾을 수 없습니다.');
            return;
        }

        // 폴더별로 그룹화
        const cardsByFolder = {};
        cards.forEach(card => {
            const folderName = card.folderName;
            if (!cardsByFolder[folderName]) {
                cardsByFolder[folderName] = [];
            }
            cardsByFolder[folderName].push(card);
        });

        const now = dayjs().tz('Asia/Seoul');

        for (const [folderName, folderCards] of Object.entries(cardsByFolder)) {
            console.log(`\n📁 ${folderName} 폴더 (${folderCards.length}개 카드):`);
            console.log('─'.repeat(60));

            // 시간 분석
            const times = folderCards.map(card => {
                const nextReview = dayjs.utc(card.nextReviewAt).tz('Asia/Seoul');
                const diffMs = nextReview.diff(now);
                const diffMinutes = Math.round(diffMs / (60 * 1000));
                const diffSeconds = Math.round((diffMs % (60 * 1000)) / 1000);

                return {
                    card: card.lemma || `Card${card.id}`,
                    nextReviewAt: card.nextReviewAt,
                    nextReviewKST: nextReview.format('HH:mm:ss'),
                    diffMs: diffMs,
                    diffMinutes: diffMinutes,
                    diffSeconds: diffSeconds,
                    stage: card.stage
                };
            });

            // 최소/최대 시간 계산
            const minTime = times.reduce((min, curr) => curr.diffMs < min.diffMs ? curr : min);
            const maxTime = times.reduce((max, curr) => curr.diffMs > max.diffMs ? curr : max);
            const timeDiffMs = maxTime.diffMs - minTime.diffMs;
            const timeDiffMinutes = Math.round(timeDiffMs / (60 * 1000));
            const timeDiffSeconds = Math.round((timeDiffMs % (60 * 1000)) / 1000);

            console.log(`⏰ 최조 복습 시간: ${minTime.nextReviewKST} (${minTime.card})`);
            console.log(`⏰ 최종 복습 시간: ${maxTime.nextReviewKST} (${maxTime.card})`);
            console.log(`📊 폴더 내 시간 차이: ${timeDiffMinutes}분 ${timeDiffSeconds}초`);

            // 동기화 상태 판단
            if (timeDiffMs === 0) {
                console.log('✅ 완벽하게 동기화됨');
            } else if (timeDiffMs <= 60000) { // 1분 이내
                console.log('🟡 거의 동기화됨 (1분 이내 차이)');
            } else {
                console.log('❌ 동기화 필요');
            }

            // 상위 5개 카드 표시
            console.log('\n📋 상세 타이머 정보 (처음 5개):');
            times.slice(0, 5).forEach((item, index) => {
                const sign = item.diffMinutes >= 0 ? '+' : '';
                console.log(`  ${index + 1}. ${item.card} (Stage ${item.stage}): ${item.nextReviewKST} (${sign}${item.diffMinutes}분 ${item.diffSeconds}초)`);
            });

            if (times.length > 5) {
                console.log(`  ... 외 ${times.length - 5}개 더`);
            }
        }

        // 전체 통계
        console.log('\n📈 전체 통계:');
        console.log('─'.repeat(60));

        const allTimes = Object.values(cardsByFolder).flat().map(card => {
            const nextReview = dayjs.utc(card.nextReviewAt).tz('Asia/Seoul');
            return {
                time: nextReview,
                diffMs: nextReview.diff(now)
            };
        });

        if (allTimes.length > 0) {
            const globalMin = allTimes.reduce((min, curr) => curr.diffMs < min.diffMs ? curr : min);
            const globalMax = allTimes.reduce((max, curr) => curr.diffMs > max.diffMs ? curr : max);
            const globalDiffMs = globalMax.diffMs - globalMin.diffMs;
            const globalDiffMinutes = Math.round(globalDiffMs / (60 * 1000));
            const globalDiffSeconds = Math.round((globalDiffMs % (60 * 1000)) / 1000);

            console.log(`⏰ 전체 최조 시간: ${globalMin.time.format('HH:mm:ss')}`);
            console.log(`⏰ 전체 최종 시간: ${globalMax.time.format('HH:mm:ss')}`);
            console.log(`📊 전체 시간 차이: ${globalDiffMinutes}분 ${globalDiffSeconds}초`);

            // 최종 동기화 상태
            if (globalDiffMs === 0) {
                console.log('✅ 모든 카드가 완벽하게 동기화됨');
            } else if (globalDiffMs <= 60000) {
                console.log('🟡 거의 동기화됨 (1분 이내 차이)');
            } else {
                console.log('❌ 동기화가 필요함');
                console.log('');
                console.log('🔧 문제: 프론트엔드에서 보이는 5-6분 차이가 실제 DB에도 존재함');
                console.log('💡 해결책: 타이머 동기화 스크립트를 다시 실행해야 함');
            }
        }

    } catch (error) {
        console.error('❌ 체크 실패:', error);
    } finally {
        await connection.end();
    }
}

checkTimerDirect();