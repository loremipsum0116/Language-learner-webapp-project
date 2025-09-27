// DAY1 즉시 동기화 실행
const { PrismaClient } = require('@prisma/client');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

async function immediateSyncDAY1() {
    const PROD_URL = "mysql://root:mdsooQRAMNBnvXHjTyMYwpQvmXUtlZsG@shuttle.proxy.rlwy.net:25466/railway";

    const prisma = new PrismaClient({
        datasources: { db: { url: PROD_URL } }
    });

    try {
        await prisma.$connect();
        console.log('🚀 DAY1 즉시 동기화 실행');
        console.log('현재 시간:', dayjs().tz('Asia/Seoul').format('YYYY-MM-DD HH:mm:ss'));
        console.log('='.repeat(60));

        // DAY1 폴더 ID: 75
        const stages = [2, 3]; // Stage 2와 3 모두 처리

        for (const stage of stages) {
            console.log(`\n📁 DAY1 - Stage ${stage} 처리 중...`);

            // 해당 Stage의 모든 카드 조회
            const cards = await prisma.srscard.findMany({
                where: {
                    userId: 4,
                    folderId: 75,
                    stage: stage,
                    nextReviewAt: { not: null }
                },
                select: {
                    id: true,
                    nextReviewAt: true,
                    waitingUntil: true
                },
                orderBy: {
                    nextReviewAt: 'asc'
                }
            });

            console.log(`  발견된 카드: ${cards.length}개`);

            if (cards.length <= 1) {
                console.log('  ✅ 동기화할 카드가 충분하지 않음');
                continue;
            }

            // 시간 차이 계산
            const times = cards.map(c => new Date(c.nextReviewAt).getTime());
            const minTime = Math.min(...times);
            const maxTime = Math.max(...times);
            const diffMs = maxTime - minTime;
            const diffMinutes = Math.floor(diffMs / 60000);
            const diffSeconds = Math.floor((diffMs % 60000) / 1000);

            console.log(`  현재 차이: ${diffMinutes}분 ${diffSeconds}초`);

            if (diffMs === 0) {
                console.log('  ✅ 이미 완벽 동기화됨');
                continue;
            }

            // 가장 이른 시간으로 동기화
            const earliestTime = new Date(minTime);
            const earliestTimeKST = dayjs.utc(earliestTime).tz('Asia/Seoul').format('MM-DD HH:mm:ss');
            console.log(`  목표 시간: ${earliestTimeKST}`);

            // nextReviewAt 동기화
            const updateNextReview = await prisma.srscard.updateMany({
                where: {
                    id: { in: cards.map(c => c.id) }
                },
                data: {
                    nextReviewAt: earliestTime
                }
            });

            console.log(`  ✅ nextReviewAt 동기화: ${updateNextReview.count}개 완료`);

            // waitingUntil이 있는 카드들 동기화
            const cardsWithWaiting = cards.filter(c => c.waitingUntil);
            if (cardsWithWaiting.length > 0) {
                // waitingUntil도 가장 이른 시간으로 동기화
                const waitingTimes = cardsWithWaiting.map(c => new Date(c.waitingUntil).getTime());
                const minWaitingTime = Math.min(...waitingTimes);
                const earliestWaitingTime = new Date(minWaitingTime);

                const updateWaiting = await prisma.srscard.updateMany({
                    where: {
                        id: { in: cardsWithWaiting.map(c => c.id) }
                    },
                    data: {
                        waitingUntil: earliestWaitingTime
                    }
                });

                console.log(`  ✅ waitingUntil 동기화: ${updateWaiting.count}개 완료`);
            }

            // 검증
            const verifyCards = await prisma.srscard.findMany({
                where: {
                    userId: 4,
                    folderId: 75,
                    stage: stage,
                    nextReviewAt: { not: null }
                },
                select: {
                    nextReviewAt: true,
                    waitingUntil: true
                }
            });

            const verifyTimes = verifyCards.map(c => new Date(c.nextReviewAt).getTime());
            const verifyMin = Math.min(...verifyTimes);
            const verifyMax = Math.max(...verifyTimes);
            const verifyDiff = verifyMax - verifyMin;

            console.log(`  📊 검증: ${verifyDiff === 0 ? '✅ 완벽 동기화' : `❌ ${Math.floor(verifyDiff/60000)}분 차이`}`);
        }

        console.log('\n🎊 DAY1 동기화 완료!');

    } catch (error) {
        console.error('❌ 동기화 실패:', error);
    } finally {
        await prisma.$disconnect();
    }
}

immediateSyncDAY1();