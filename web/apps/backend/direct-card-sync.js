// direct-card-sync.js
// 직접 현재 보이는 카드들 찾아서 동일화

const { PrismaClient } = require('@prisma/client');

async function directCardSync() {
    console.log('🎯 Direct card synchronization');

    const PROD_URL = "mysql://root:mdsooQRAMNBnvXHjTyMYwpQvmXUtlZsG@shuttle.proxy.rlwy.net:25466/railway";

    try {
        const prisma = new PrismaClient({
            datasources: { db: { url: PROD_URL } }
        });

        await prisma.$connect();

        const user = await prisma.user.findUnique({
            where: { email: 'sst7050@naver.com' }
        });

        console.log(`✅ Found user: ID ${user.id}`);

        // 현재 시간 기준으로 1시간 이내에 복습 예정인 Stage 2 카드들 찾기
        const now = new Date();
        const oneHourLater = new Date(now.getTime() + 70 * 60 * 1000); // 70분 후

        console.log(`🔍 Looking for Stage 2 cards due within next 70 minutes...`);

        const cards = await prisma.srscard.findMany({
            where: {
                userId: user.id,
                stage: 2,
                nextReviewAt: {
                    gte: now,
                    lte: oneHourLater
                },
                srsfolderitem: {
                    some: {
                        srsfolder: {
                            parentId: { not: null }
                        }
                    }
                }
            },
            include: {
                srsfolderitem: {
                    include: {
                        srsfolder: {
                            select: { id: true, name: true, parentId: true }
                        }
                    }
                }
            },
            orderBy: { nextReviewAt: 'asc' }
        });

        console.log(`📚 Found ${cards.length} Stage 2 cards due within 70 minutes`);

        if (cards.length === 0) {
            console.log('❌ No cards found in the expected time range');
            return;
        }

        // 카드들의 실제 타이머 확인
        console.log('\n📋 Current card timers:');
        for (const card of cards.slice(0, 10)) {
            const folder = card.srsfolderitem[0]?.srsfolder;
            const reviewTime = new Date(card.nextReviewAt);
            const minutesLeft = Math.floor((reviewTime - now) / 1000 / 60);

            console.log(`   Card ${card.id} in "${folder?.name}": ${minutesLeft} minutes left`);
        }

        // 하위 폴더별로 그룹화
        const folderGroups = {};

        for (const card of cards) {
            const folder = card.srsfolderitem[0]?.srsfolder;
            if (!folder?.id) continue;

            if (!folderGroups[folder.id]) {
                folderGroups[folder.id] = {
                    name: folder.name,
                    parentId: folder.parentId,
                    cards: []
                };
            }
            folderGroups[folder.id].cards.push(card);
        }

        console.log('\n🗂️  Processing by subfolder:');

        let totalSynced = 0;

        for (const [folderId, group] of Object.entries(folderGroups)) {
            console.log(`\n📂 "${group.name}" (ID: ${folderId}, Parent: ${group.parentId})`);
            console.log(`   ${group.cards.length} cards`);

            if (group.cards.length > 1) {
                // 타이머 차이 계산
                const times = group.cards.map(c => new Date(c.nextReviewAt).getTime());
                const diffMs = Math.max(...times) - Math.min(...times);
                const diffMin = diffMs / 1000 / 60;

                console.log(`   ⏱️  Timer difference: ${diffMin.toFixed(1)} minutes`);

                if (diffMin > 0.1) { // 0.1분 이상 차이가 있으면
                    console.log(`   🚀 SYNCING ${group.cards.length} cards...`);

                    const earliestTime = new Date(Math.min(...times));
                    console.log(`   📅 Syncing to: ${earliestTime.toLocaleString()}`);

                    try {
                        const updateResult = await prisma.srscard.updateMany({
                            where: { id: { in: group.cards.map(c => c.id) } },
                            data: { nextReviewAt: earliestTime }
                        });

                        console.log(`   ✅ Successfully synchronized ${updateResult.count} cards!`);
                        totalSynced += updateResult.count;

                        // 검증
                        const verifyCards = await prisma.srscard.findMany({
                            where: { id: { in: group.cards.map(c => c.id) } },
                            select: { id: true, nextReviewAt: true }
                        });

                        const verifyTimes = verifyCards.map(c => new Date(c.nextReviewAt).getTime());
                        const verifyDiff = Math.max(...verifyTimes) - Math.min(...verifyTimes);
                        const verifyDiffMin = verifyDiff / 1000 / 60;

                        console.log(`   🔍 Verification: ${verifyDiffMin.toFixed(1)} minutes difference after sync`);

                    } catch (syncError) {
                        console.log(`   ❌ Sync error: ${syncError.message}`);
                    }
                } else {
                    console.log(`   ✅ Already synchronized (${diffMin.toFixed(1)} min difference)`);
                }
            }
        }

        console.log(`\n🎉 TOTAL SYNCHRONIZED: ${totalSynced} cards`);

        if (totalSynced > 0) {
            console.log('\n🔄 Refresh your browser to see the synchronized timers!');
        }

        await prisma.$disconnect();

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

directCardSync();