// railway-immediate-sync.js
// Railway 서버에서 실행할 즉시 동일화 스크립트

const { runPeriodicAutoSync } = require('./services/autoTimerSyncService');
const { synchronizeSubfolderTimers } = require('./services/timerSyncService');
const { prisma } = require('./lib/prismaClient');

async function railwayImmediateSync() {
    console.log('🚂 Railway immediate synchronization starting...');

    try {
        // 1. sst7050@naver.com 사용자 찾기
        const user = await prisma.user.findUnique({
            where: { email: 'sst7050@naver.com' }
        });

        if (!user) {
            console.log('❌ User sst7050@naver.com not found');
            return;
        }

        console.log(`✅ Found user: ID ${user.id}`);

        // 2. 전체 자동 동일화 실행
        console.log('\n🔄 Running periodic auto sync for all users...');
        const globalResult = await runPeriodicAutoSync();
        console.log(`📊 Global sync result: ${globalResult.totalProcessed} subfolders, ${globalResult.totalSynced} cards synced`);

        // 3. 특정 사용자 대상 동일화 실행
        console.log(`\n🎯 Running targeted sync for user ${user.id}...`);
        const userResult = await runPeriodicAutoSync(user.id);
        console.log(`📊 User sync result: ${userResult.totalProcessed} subfolders, ${userResult.totalSynced} cards synced`);

        // 4. 사용자의 모든 하위 폴더에서 개별 동일화 실행
        console.log(`\n🗂️  Running individual subfolder sync...`);

        const subfolders = await prisma.srsfolder.findMany({
            where: {
                userId: user.id,
                parentId: { not: null }
            },
            select: { id: true, name: true, parentId: true }
        });

        console.log(`Found ${subfolders.length} subfolders`);

        let totalIndividualSynced = 0;

        for (const subfolder of subfolders) {
            console.log(`\n📁 Processing subfolder: ${subfolder.name} (Parent: ${subfolder.parentId})`);

            try {
                const result = await synchronizeSubfolderTimers(user.id, subfolder.parentId);

                if (result.success) {
                    console.log(`   ✅ Success: ${result.message}`);
                    console.log(`   📊 Synced groups: ${result.syncedGroups}, Total cards: ${result.totalSyncedCards || 0}`);
                    totalIndividualSynced += result.totalSyncedCards || 0;
                } else {
                    console.log(`   ❌ Failed: ${result.message}`);
                }
            } catch (error) {
                console.log(`   ❌ Error: ${error.message}`);
            }
        }

        console.log(`\n🎉 Individual sync completed: ${totalIndividualSynced} total cards synchronized`);

        // 5. 최종 확인 - Stage 2 카드들의 타이머 상태 체크
        console.log(`\n🔍 Final verification - checking Stage 2 cards...`);

        const stage2Cards = await prisma.srscard.findMany({
            where: {
                userId: user.id,
                stage: 2,
                nextReviewAt: { not: null },
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
                            select: { id: true, parentId: true, name: true }
                        }
                    }
                }
            },
            take: 20
        });

        if (stage2Cards.length > 0) {
            console.log(`📚 Found ${stage2Cards.length} Stage 2 cards after sync`);

            // 하위 폴더별 그룹화하여 타이머 차이 확인
            const groups = {};
            for (const card of stage2Cards) {
                const folder = card.srsfolderitem[0]?.srsfolder;
                if (!folder?.parentId) continue;

                const key = folder.parentId;
                if (!groups[key]) groups[key] = [];
                groups[key].push(card);
            }

            for (const [parentId, cards] of Object.entries(groups)) {
                if (cards.length <= 1) continue;

                const times = cards.map(c => new Date(c.nextReviewAt).getTime());
                const diffMinutes = (Math.max(...times) - Math.min(...times)) / 1000 / 60;

                console.log(`🗂️  Parent Folder ${parentId}: ${cards.length} cards, ${diffMinutes.toFixed(1)} min difference`);

                if (diffMinutes < 1) {
                    console.log(`   ✅ Successfully synchronized!`);
                } else if (diffMinutes <= 60) {
                    console.log(`   ⚠️  Still has timer difference (${diffMinutes.toFixed(1)} minutes)`);
                } else {
                    console.log(`   ❌ Timer difference too large (${diffMinutes.toFixed(1)} minutes)`);
                }
            }
        } else {
            console.log(`ℹ️  No Stage 2 cards found`);
        }

    } catch (error) {
        console.error('❌ Railway sync error:', error);
    }

    console.log('\n🏁 Railway immediate synchronization completed');
}

// 실행
if (require.main === module) {
    railwayImmediateSync().then(() => {
        process.exit(0);
    }).catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { railwayImmediateSync };