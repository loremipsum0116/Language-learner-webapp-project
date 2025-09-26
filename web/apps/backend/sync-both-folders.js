// DAY1과 DAY2 폴더 모두 타이머 동기화 실행
const { PrismaClient } = require('@prisma/client');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

async function syncBothFolders() {
    const PROD_URL = "mysql://root:mdsooQRAMNBnvXHjTyMYwpQvmXUtlZsG@shuttle.proxy.rlwy.net:25466/railway";

    const prisma = new PrismaClient({
        datasources: { db: { url: PROD_URL } }
    });

    try {
        await prisma.$connect();
        console.log('🎯 DAY1 & DAY2 폴더 타이머 동기화 시작...');
        console.log('현재 시간(KST):', dayjs().tz('Asia/Seoul').format('YYYY-MM-DD HH:mm:ss'));
        console.log('===================================');

        // 폴더 정보
        const folders = [
            { id: 75, name: 'DAY1' },
            { id: 76, name: 'DAY2' }
        ];

        for (const folder of folders) {
            console.log(`\n📁 ${folder.name} 폴더 처리 중...`);
            console.log('─'.repeat(40));

            // 해당 폴더의 모든 Stage 2 카드 조회
            const cards = await prisma.srscard.findMany({
                where: {
                    userId: 4,
                    folderId: folder.id,
                    stage: 2,
                    nextReviewAt: { not: null }
                },
                select: {
                    id: true,
                    nextReviewAt: true
                },
                orderBy: {
                    nextReviewAt: 'asc'
                }
            });

            console.log(`📚 Stage 2 카드: ${cards.length}개`);

            if (cards.length <= 1) {
                console.log('✅ 동기화할 카드가 충분하지 않습니다.');
                continue;
            }

            // 시간 차이 계산
            const times = cards.map(c => new Date(c.nextReviewAt).getTime());
            const minTime = Math.min(...times);
            const maxTime = Math.max(...times);
            const diffMs = maxTime - minTime;
            const diffMinutes = Math.round(diffMs / (60 * 1000));
            const diffSeconds = Math.round((diffMs % (60 * 1000)) / 1000);

            console.log(`⏰ 현재 시간 차이: ${diffMinutes}분 ${diffSeconds}초`);

            if (diffMs === 0) {
                console.log('✅ 이미 완벽하게 동기화되어 있습니다.');
                continue;
            }

            if (diffMinutes > 60) {
                console.log('❌ 시간 차이가 1시간을 초과합니다. 안전상 동기화를 중단합니다.');
                continue;
            }

            // 가장 이른 시간으로 모든 카드 동기화
            const earliestTime = new Date(minTime);
            const earliestTimeKST = dayjs.utc(earliestTime).tz('Asia/Seoul').format('YYYY-MM-DD HH:mm:ss');

            console.log(`🎯 목표 시간: ${earliestTimeKST} (KST)`);
            console.log(`📝 동기화할 카드 수: ${cards.length}개`);

            // 실제 동기화 실행
            const updateResult = await prisma.srscard.updateMany({
                where: {
                    id: { in: cards.map(c => c.id) }
                },
                data: {
                    nextReviewAt: earliestTime
                }
            });

            console.log(`✅ 동기화 완료! ${updateResult.count}개 카드 업데이트됨`);

            // 결과 검증
            const verifyCards = await prisma.srscard.findMany({
                where: {
                    userId: 4,
                    folderId: folder.id,
                    stage: 2,
                    nextReviewAt: { not: null }
                },
                select: {
                    id: true,
                    nextReviewAt: true
                }
            });

            const verifyTimes = verifyCards.map(c => new Date(c.nextReviewAt).getTime());
            const verifyMinTime = Math.min(...verifyTimes);
            const verifyMaxTime = Math.max(...verifyTimes);
            const verifyDiffMs = verifyMaxTime - verifyMinTime;
            const verifyDiffMinutes = Math.round(verifyDiffMs / (60 * 1000));
            const verifyDiffSeconds = Math.round((verifyDiffMs % (60 * 1000)) / 1000);

            console.log(`📊 동기화 후 시간 차이: ${verifyDiffMinutes}분 ${verifyDiffSeconds}초`);

            if (verifyDiffMs === 0) {
                console.log(`🎉 ${folder.name} 폴더 완벽 동기화 성공!`);
            } else {
                console.log(`⚠️ 여전히 ${verifyDiffMinutes}분 ${verifyDiffSeconds}초 차이가 남아있습니다.`);
            }
        }

        console.log('\n🎊 모든 폴더 동기화 완료!');
        console.log('===================================');

        // 최종 전체 상태 확인
        console.log('\n📈 최종 상태 확인:');

        for (const folder of folders) {
            const finalCards = await prisma.srscard.findMany({
                where: {
                    userId: 4,
                    folderId: folder.id,
                    stage: 2,
                    nextReviewAt: { not: null }
                },
                select: {
                    nextReviewAt: true
                }
            });

            if (finalCards.length > 0) {
                const finalTimes = finalCards.map(c => new Date(c.nextReviewAt).getTime());
                const finalMin = Math.min(...finalTimes);
                const finalMax = Math.max(...finalTimes);
                const finalDiff = Math.round((finalMax - finalMin) / (60 * 1000));

                console.log(`📁 ${folder.name}: ${finalCards.length}개 카드, ${finalDiff}분 차이`);
            }
        }

    } catch (error) {
        console.error('❌ 동기화 실패:', error);
    } finally {
        await prisma.$disconnect();
    }
}

syncBothFolders();