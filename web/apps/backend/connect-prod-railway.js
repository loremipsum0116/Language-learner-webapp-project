// connect-prod-railway.js
// 실제 Railway 프로덕션 데이터베이스 연결

const { PrismaClient } = require('@prisma/client');

async function connectProdRailway() {
    console.log('🚂 Connecting to Railway production database...');

    // 실제 Railway 프로덕션 DATABASE_URL
    const PROD_DATABASE_URL = "mysql://root:mdsooQRAMNBnvXHjTyMYwpQvmXUtlZsG@mysql.railway.internal:3306/railway";

    try {
        // Railway 프로덕션 데이터베이스에 연결
        const prisma = new PrismaClient({
            datasources: {
                db: {
                    url: PROD_DATABASE_URL
                }
            }
        });

        await prisma.$connect();
        console.log('✅ Connected to Railway production database');

        // sst7050@naver.com 사용자 검색
        const user = await prisma.user.findUnique({
            where: { email: 'sst7050@naver.com' },
            select: {
                id: true,
                email: true,
                personalizedSRS: true
            }
        });

        if (user) {
            console.log(`✅ Found user: ID ${user.id}, Email: ${user.email}`);
            console.log(`⚙️ Auto sync settings:`, user.personalizedSRS?.autoTimerSync || 'None');

            // 사용자의 Stage 2 카드들 확인
            const stage2Cards = await prisma.srscard.findMany({
                where: {
                    userId: user.id,
                    stage: 2,
                    nextReviewAt: { not: null },
                    srsfolderitem: {
                        some: {
                            srsfolder: {
                                parentId: { not: null } // 하위 폴더만
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
                take: 30
            });

            console.log(`📚 Found ${stage2Cards.length} Stage 2 cards with timers in subfolders`);

            if (stage2Cards.length > 0) {
                console.log('\n📋 Stage 2 cards sample:');
                for (const card of stage2Cards.slice(0, 5)) {
                    const folder = card.srsfolderitem[0]?.srsfolder;
                    const now = new Date();
                    const reviewTime = new Date(card.nextReviewAt);
                    const minutesLeft = Math.floor((reviewTime - now) / 1000 / 60);

                    console.log(`   📌 Card ${card.id} in "${folder?.name}"`);
                    console.log(`      Stage: ${card.stage}, Review in: ${minutesLeft} minutes`);
                    console.log(`      Parent Folder: ${folder?.parentId}`);
                }

                // 동일화 가능한 그룹 분석
                console.log('\n🔍 Synchronization analysis:');
                const groups = {};

                for (const card of stage2Cards) {
                    const folder = card.srsfolderitem[0]?.srsfolder;
                    if (!folder?.parentId) continue;

                    const key = folder.parentId;
                    if (!groups[key]) {
                        groups[key] = {
                            folderName: folder.name,
                            cards: []
                        };
                    }
                    groups[key].cards.push(card);
                }

                let foundSyncCandidates = false;

                for (const [parentId, group] of Object.entries(groups)) {
                    const cards = group.cards;
                    if (cards.length <= 1) continue;

                    console.log(`\n🗂️  Parent Folder ${parentId} (${group.folderName}): ${cards.length} cards`);

                    // 타이머 차이 계산
                    const times = cards.map(c => new Date(c.nextReviewAt).getTime());
                    const diffMinutes = (Math.max(...times) - Math.min(...times)) / 1000 / 60;

                    console.log(`   ⏱️  Timer difference: ${diffMinutes.toFixed(1)} minutes`);

                    if (diffMinutes > 0 && diffMinutes <= 60) {
                        foundSyncCandidates = true;
                        console.log(`   ✅ ELIGIBLE FOR SYNC! (${diffMinutes.toFixed(1)} min difference)`);

                        console.log(`   📋 Cards to sync:`);
                        for (const card of cards.slice(0, 5)) {
                            const reviewTime = new Date(card.nextReviewAt);
                            const now = new Date();
                            const minutesLeft = Math.floor((reviewTime - now) / 1000 / 60);
                            console.log(`      - Card ${card.id}: ${minutesLeft} minutes left (${reviewTime.toLocaleTimeString()})`);
                        }

                        // 즉시 동일화 실행
                        console.log(`\n🚀 Executing immediate synchronization for parent folder ${parentId}...`);

                        try {
                            const { synchronizeSubfolderTimers } = require('./services/timerSyncService');
                            const result = await synchronizeSubfolderTimers(user.id, parseInt(parentId));

                            console.log(`📊 Sync result:`, result);

                            if (result.success && result.totalSyncedCards > 0) {
                                console.log(`🎉 Successfully synchronized ${result.totalSyncedCards} cards!`);
                            }
                        } catch (syncError) {
                            console.error('❌ Sync error:', syncError.message);
                        }
                    } else if (diffMinutes > 60) {
                        console.log(`   ❌ Not eligible (${diffMinutes.toFixed(1)} min > 60 min limit)`);
                    } else {
                        console.log(`   ✅ Already synchronized (${diffMinutes.toFixed(1)} min difference)`);
                    }
                }

                if (!foundSyncCandidates) {
                    console.log('\nℹ️  No synchronization candidates found (all groups already synchronized or exceed 60-minute limit)');
                }

            } else {
                console.log('ℹ️  No Stage 2 cards with timers found in subfolders');

                // 전체 카드 현황 확인
                const allCards = await prisma.srscard.count({
                    where: { userId: user.id }
                });

                const stageDistribution = await prisma.srscard.groupBy({
                    by: ['stage'],
                    where: { userId: user.id },
                    _count: { id: true }
                });

                console.log(`📊 User has ${allCards} total cards`);
                console.log(`📊 Stage distribution:`, stageDistribution.map(s => `Stage${s.stage}:${s._count.id}`).join(', '));

                // 타이머가 있는 카드들 확인
                const timerCards = await prisma.srscard.count({
                    where: {
                        userId: user.id,
                        nextReviewAt: { not: null }
                    }
                });
                console.log(`⏰ Cards with timers: ${timerCards}`);
            }

        } else {
            console.log('❌ User sst7050@naver.com not found in production database');

            // 모든 사용자 확인
            const allUsers = await prisma.user.findMany({
                select: { id: true, email: true },
                take: 10
            });

            console.log('\n👥 All users in production database:');
            for (const u of allUsers) {
                console.log(`   👤 ID: ${u.id}, Email: ${u.email}`);
            }
        }

        await prisma.$disconnect();

    } catch (error) {
        console.error('❌ Database connection error:', error.message);

        if (error.code === 'ENOTFOUND') {
            console.log('💡 Cannot resolve mysql.railway.internal from local machine');
            console.log('   This URL is only accessible from within Railway infrastructure');
        }
    }
}

connectProdRailway();