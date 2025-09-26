// waitingUntil 값들도 동기화
const { PrismaClient } = require('@prisma/client');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

async function syncWaitingUntil() {
    const PROD_URL = "mysql://root:mdsooQRAMNBnvXHjTyMYwpQvmXUtlZsG@shuttle.proxy.rlwy.net:25466/railway";

    const prisma = new PrismaClient({
        datasources: { db: { url: PROD_URL } }
    });

    try {
        await prisma.$connect();
        console.log('🎯 waitingUntil 값 동기화 시작...');
        console.log('현재 시간(KST):', dayjs().tz('Asia/Seoul').format('YYYY-MM-DD HH:mm:ss'));
        console.log('===================================');

        // 폴더 정보
        const folders = [
            { id: 75, name: 'DAY1' },
            { id: 76, name: 'DAY2' }
        ];

        for (const folder of folders) {
            console.log(`\n📁 ${folder.name} 폴더 waitingUntil 동기화 중...`);
            console.log('─'.repeat(40));

            // 해당 폴더의 모든 waitingUntil이 있는 카드 조회
            const cards = await prisma.srscard.findMany({
                where: {
                    userId: 4,
                    folderId: folder.id,
                    stage: 2,
                    waitingUntil: { not: null }
                },
                select: {
                    id: true,
                    waitingUntil: true,
                    nextReviewAt: true
                },
                orderBy: {
                    waitingUntil: 'asc'
                }
            });

            console.log(`📚 waitingUntil이 있는 카드: ${cards.length}개`);

            if (cards.length <= 1) {
                console.log('✅ 동기화할 카드가 충분하지 않습니다.');
                continue;
            }

            // 시간 차이 계산
            const waitingTimes = cards.map(c => new Date(c.waitingUntil).getTime());
            const minWaitingTime = Math.min(...waitingTimes);
            const maxWaitingTime = Math.max(...waitingTimes);
            const diffMs = maxWaitingTime - minWaitingTime;
            const diffMinutes = Math.round(diffMs / (60 * 1000));
            const diffSeconds = Math.round((diffMs % (60 * 1000)) / 1000);

            console.log(`⏰ 현재 waitingUntil 차이: ${diffMinutes}분 ${diffSeconds}초`);

            if (diffMs === 0) {
                console.log('✅ 이미 완벽하게 동기화되어 있습니다.');
                continue;
            }

            if (diffMinutes > 60) {
                console.log('❌ 시간 차이가 1시간을 초과합니다. 안전상 동기화를 중단합니다.');
                continue;
            }

            // 가장 이른 waitingUntil 시간으로 모든 카드 동기화
            const earliestWaitingTime = new Date(minWaitingTime);
            const earliestWaitingTimeKST = dayjs.utc(earliestWaitingTime).tz('Asia/Seoul').format('YYYY-MM-DD HH:mm:ss');

            console.log(`🎯 목표 waitingUntil 시간: ${earliestWaitingTimeKST} (KST)`);
            console.log(`📝 동기화할 카드 수: ${cards.length}개`);

            // 실제 waitingUntil 동기화 실행
            const updateResult = await prisma.srscard.updateMany({
                where: {
                    id: { in: cards.map(c => c.id) }
                },
                data: {
                    waitingUntil: earliestWaitingTime
                }
            });

            console.log(`✅ waitingUntil 동기화 완료! ${updateResult.count}개 카드 업데이트됨`);

            // 결과 검증
            const verifyCards = await prisma.srscard.findMany({
                where: {
                    userId: 4,
                    folderId: folder.id,
                    stage: 2,
                    waitingUntil: { not: null }
                },
                select: {
                    id: true,
                    waitingUntil: true
                }
            });

            const verifyWaitingTimes = verifyCards.map(c => new Date(c.waitingUntil).getTime());
            const verifyMinTime = Math.min(...verifyWaitingTimes);
            const verifyMaxTime = Math.max(...verifyWaitingTimes);
            const verifyDiffMs = verifyMaxTime - verifyMinTime;
            const verifyDiffMinutes = Math.round(verifyDiffMs / (60 * 1000));
            const verifyDiffSeconds = Math.round((verifyDiffMs % (60 * 1000)) / 1000);

            console.log(`📊 동기화 후 waitingUntil 차이: ${verifyDiffMinutes}분 ${verifyDiffSeconds}초`);

            if (verifyDiffMs === 0) {
                console.log(`🎉 ${folder.name} 폴더 waitingUntil 완벽 동기화 성공!`);
            } else {
                console.log(`⚠️ 여전히 ${verifyDiffMinutes}분 ${verifyDiffSeconds}초 차이가 남아있습니다.`);
            }
        }

        console.log('\n🎊 모든 폴더 waitingUntil 동기화 완료!');
        console.log('===================================');

        // 최종 전체 상태 확인
        console.log('\n📈 최종 waitingUntil 상태 확인:');

        for (const folder of folders) {
            const finalCards = await prisma.srscard.findMany({
                where: {
                    userId: 4,
                    folderId: folder.id,
                    stage: 2,
                    waitingUntil: { not: null }
                },
                select: {
                    waitingUntil: true
                }
            });

            if (finalCards.length > 0) {
                const finalWaitingTimes = finalCards.map(c => new Date(c.waitingUntil).getTime());
                const finalMin = Math.min(...finalWaitingTimes);
                const finalMax = Math.max(...finalWaitingTimes);
                const finalDiff = Math.round((finalMax - finalMin) / (60 * 1000));

                console.log(`📁 ${folder.name}: ${finalCards.length}개 카드, waitingUntil ${finalDiff}분 차이`);
            }
        }

    } catch (error) {
        console.error('❌ waitingUntil 동기화 실패:', error);
    } finally {
        await prisma.$disconnect();
    }
}

syncWaitingUntil();