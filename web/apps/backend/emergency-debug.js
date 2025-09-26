// emergency-debug.js
// 동일화 시스템이 작동하지 않는 근본 원인 파악

const { prisma } = require('./lib/prismaClient');

async function emergencyDebug() {
    console.log('🚨 EMERGENCY DEBUG: Why sync system is NOT working');

    try {
        // 1. 실제 sst7050@naver.com 사용자가 있는지 확인
        console.log('\n=== 1. User verification ===');

        const allUsers = await prisma.user.findMany({
            select: { id: true, email: true },
            take: 20
        });

        console.log('All users in database:');
        for (const user of allUsers) {
            console.log(`  ${user.id}: ${user.email}`);
            if (user.email && user.email.includes('sst')) {
                console.log(`  ^^^^^ FOUND SST USER! ^^^^^`);
            }
        }

        // sst7050@naver.com 직접 검색
        const targetUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: 'sst7050@naver.com' },
                    { email: { contains: 'sst7050' } }
                ]
            }
        });

        if (!targetUser) {
            console.log('❌ CRITICAL: sst7050@naver.com user does NOT exist in database!');
            console.log('❌ This means we are checking wrong database or user account');
            return;
        }

        console.log(`✅ Found target user: ID ${targetUser.id}, Email: ${targetUser.email}`);

        // 2. 해당 사용자의 실제 카드 데이터 확인
        console.log('\n=== 2. User card verification ===');

        const userCards = await prisma.srscard.count({
            where: { userId: targetUser.id }
        });

        console.log(`User ${targetUser.id} has ${userCards} total SRS cards`);

        // Stage 2 카드들 확인
        const stage2Cards = await prisma.srscard.findMany({
            where: {
                userId: targetUser.id,
                stage: 2
            },
            select: {
                id: true,
                stage: true,
                nextReviewAt: true,
                srsfolderitem: true
            },
            take: 30
        });

        console.log(`Found ${stage2Cards.length} Stage 2 cards for user ${targetUser.id}`);

        if (stage2Cards.length === 0) {
            console.log('❌ CRITICAL: No Stage 2 cards found!');
            console.log('❌ The Japanese cards shown in UI do not exist in database');
            return;
        }

        // 3. 타이머 데이터 확인
        console.log('\n=== 3. Timer data verification ===');

        const cardsWithTimers = stage2Cards.filter(c => c.nextReviewAt);
        console.log(`Cards with nextReviewAt: ${cardsWithTimers.length}/${stage2Cards.length}`);

        if (cardsWithTimers.length === 0) {
            console.log('❌ CRITICAL: No cards with timers found!');
            return;
        }

        // 실제 타이머 값들 확인
        for (const card of cardsWithTimers.slice(0, 5)) {
            const now = new Date();
            const reviewTime = new Date(card.nextReviewAt);
            const minutesLeft = Math.floor((reviewTime - now) / 1000 / 60);
            console.log(`  Card ${card.id}: ${minutesLeft} minutes (${reviewTime.toISOString()})`);
        }

        // 4. 하위 폴더 구조 확인
        console.log('\n=== 4. Folder structure verification ===');

        // 각 카드의 폴더 정보 확인
        for (const card of cardsWithTimers.slice(0, 3)) {
            const folderItems = await prisma.srsfolderitem.findMany({
                where: { srscardId: card.id },
                include: {
                    srsfolder: {
                        select: { id: true, parentId: true, name: true }
                    }
                }
            });

            console.log(`Card ${card.id} folders:`);
            for (const item of folderItems) {
                const folder = item.srsfolder;
                console.log(`  - Folder "${folder.name}" (ID: ${folder.id}, Parent: ${folder.parentId})`);
            }
        }

        // 5. 동일화 함수가 실제로 호출되는지 확인
        console.log('\n=== 5. Sync function test ===');

        try {
            const { synchronizeSubfolderTimers } = require('./services/timerSyncService');

            // 첫 번째 카드의 하위 폴더에 대해 동일화 시도
            const firstCard = cardsWithTimers[0];
            const folderItems = await prisma.srsfolderitem.findMany({
                where: { srscardId: firstCard.id },
                include: { srsfolder: true }
            });

            if (folderItems.length > 0) {
                const folder = folderItems[0].srsfolder;
                if (folder.parentId) {
                    console.log(`Testing sync for parent folder ${folder.parentId}...`);

                    const result = await synchronizeSubfolderTimers(targetUser.id, folder.parentId);
                    console.log('Sync result:', result);

                    if (!result.success) {
                        console.log('❌ SYNC FAILED:', result.message);
                    } else if (result.totalSyncedCards === 0) {
                        console.log('❌ NO CARDS SYNCED:', result.message);
                    } else {
                        console.log('✅ SYNC SUCCESS:', result.totalSyncedCards, 'cards synced');
                    }
                } else {
                    console.log('❌ Card is not in a subfolder (no parentId)');
                }
            }

        } catch (syncError) {
            console.log('❌ SYNC FUNCTION ERROR:', syncError.message);
        }

        // 6. 크론잡 설정 확인
        console.log('\n=== 6. Cron job verification ===');

        try {
            const { runPeriodicAutoSync } = require('./services/autoTimerSyncService');
            console.log('Testing periodic auto sync...');

            const cronResult = await runPeriodicAutoSync(targetUser.id);
            console.log('Cron result:', cronResult);
        } catch (cronError) {
            console.log('❌ CRON FUNCTION ERROR:', cronError.message);
        }

    } catch (error) {
        console.error('❌ EMERGENCY DEBUG ERROR:', error);
    }

    await prisma.$disconnect();
}

emergencyDebug();