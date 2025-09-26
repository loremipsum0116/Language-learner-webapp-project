// DAY1 폴더만 타이머 동기화 실행
const { PrismaClient } = require('@prisma/client');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

async function syncDAY1Only() {
    const PROD_URL = "mysql://root:mdsooQRAMNBnvXHjTyMYwpQvmXUtlZsG@shuttle.proxy.rlwy.net:25466/railway";

    const prisma = new PrismaClient({
        datasources: { db: { url: PROD_URL } }
    });

    try {
        await prisma.$connect();
        console.log('🎯 DAY1 폴더 타이머 동기화 시작...');
        console.log('현재 시간(KST):', dayjs().tz('Asia/Seoul').format('YYYY-MM-DD HH:mm:ss'));
        console.log('===================================');

        // User ID 4, DAY1 폴더 (ID: 75) 카드들 조회
        const cards = await prisma.srscard.findMany({
            where: {
                userId: 4,
                folderId: 75, // DAY1 폴더 ID
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

        console.log(`📚 DAY1 폴더 Stage 2 카드: ${cards.length}개`);

        if (cards.length <= 1) {
            console.log('✅ 동기화할 카드가 충분하지 않습니다.');
            return;
        }

        // 시간 차이 계산
        const times = cards.map(c => new Date(c.nextReviewAt).getTime());
        const minTime = Math.min(...times);
        const maxTime = Math.max(...times);
        const diffMinutes = Math.round((maxTime - minTime) / (60 * 1000));

        console.log(`⏰ 현재 시간 차이: ${diffMinutes}분`);

        if (diffMinutes === 0) {
            console.log('✅ 이미 완벽하게 동기화되어 있습니다.');
            return;
        }

        if (diffMinutes > 60) {
            console.log('❌ 시간 차이가 1시간을 초과합니다. 안전상 동기화를 중단합니다.');
            return;
        }

        // 가장 이른 시간으로 모든 카드 동기화
        const earliestTime = new Date(minTime);
        const earliestTimeKST = dayjs.utc(earliestTime).tz('Asia/Seoul').format('YYYY-MM-DD HH:mm:ss');

        console.log(`🎯 목표 시간: ${earliestTimeKST} (KST)`);
        console.log(`📝 동기화할 카드 수: ${cards.length}개`);

        // 확인 메시지
        console.log('\n🚨 동기화 실행 전 확인:');
        console.log(`- 폴더: DAY1 (ID: 75)`);
        console.log(`- 대상: Stage 2 카드 ${cards.length}개`);
        console.log(`- 현재 시간 차이: ${diffMinutes}분`);
        console.log(`- 목표: 모든 카드를 ${earliestTimeKST}로 동기화`);

        // 3초 대기
        console.log('\n⏳ 3초 후 동기화 실행...');
        await new Promise(resolve => setTimeout(resolve, 3000));

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
                folderId: 75,
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
        const verifyDiffMinutes = Math.round((verifyMaxTime - verifyMinTime) / (60 * 1000));

        console.log('\n📊 동기화 결과 검증:');
        console.log(`- 검증된 카드 수: ${verifyCards.length}개`);
        console.log(`- 동기화 후 시간 차이: ${verifyDiffMinutes}분`);

        if (verifyDiffMinutes === 0) {
            console.log('🎉 DAY1 폴더 완벽 동기화 성공!');
        } else {
            console.log(`⚠️ 여전히 ${verifyDiffMinutes}분 차이가 남아있습니다.`);
        }

    } catch (error) {
        console.error('❌ 동기화 실패:', error);
    } finally {
        await prisma.$disconnect();
    }
}

syncDAY1Only();