// connect-real-production.js
// 실제 Railway 프로덕션 데이터베이스 연결

const { PrismaClient } = require('@prisma/client');

async function connectRealProduction() {
    console.log('🚂 Connecting to REAL Railway production database...');

    // 실제 Railway 프로덕션 PUBLIC URL
    const PROD_URL = "mysql://root:mdsooQRAMNBnvXHjTyMYwpQvmXUtlZsG@shuttle.proxy.rlwy.net:25466/railway";

    try {
        // Railway 프로덕션 데이터베이스에 연결
        const prisma = new PrismaClient({
            datasources: {
                db: {
                    url: PROD_URL
                }
            }
        });

        await prisma.$connect();
        console.log('✅ Connected to Railway production database via public URL');

        // 1. sst7050@naver.com 사용자 검색
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

            // 2. 사용자의 Stage 2 카드들 확인
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
                take: 50
            });

            console.log(`📚 Found ${stage2Cards.length} Stage 2 cards with timers in subfolders`);

            if (stage2Cards.length > 0) {
                console.log('\n📋 Stage 2 cards sample:');
                for (const card of stage2Cards.slice(0, 10)) {
                    const folder = card.srsfolderitem[0]?.srsfolder;
                    const now = new Date();
                    const reviewTime = new Date(card.nextReviewAt);
                    const minutesLeft = Math.floor((reviewTime - now) / 1000 / 60);

                    console.log(`   📌 Card ${card.id} in "${folder?.name}"`);
                    console.log(`      Stage: ${card.stage}, Review in: ${minutesLeft} minutes`);
                    console.log(`      Parent Folder: ${folder?.parentId}`);
                }

                // 3. 동일화 가능한 그룹 분석
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

                        // 4. 즉시 동일화 실행
                        console.log(`\n🚀 Executing immediate synchronization for parent folder ${parentId}...`);

                        try {
                            // 프로덕션 데이터베이스를 사용하는 동일화 함수 생성
                            const { synchronizeSubfolderTimersWithDB } = await createSyncFunction(prisma);
                            const result = await synchronizeSubfolderTimersWithDB(user.id, parseInt(parentId));

                            console.log(`📊 Sync result:`, result);

                            if (result.success && result.totalSyncedCards > 0) {
                                console.log(`🎉 Successfully synchronized ${result.totalSyncedCards} cards!`);
                            }
                        } catch (syncError) {
                            console.error('❌ Sync error:', syncError.message);
                        }
                    }
                }

                if (!foundSyncCandidates) {
                    console.log('\nℹ️  No synchronization candidates found');
                }

            } else {
                console.log('ℹ️  No Stage 2 cards with timers found');
            }

        } else {
            console.log('❌ User sst7050@naver.com not found in production database');

            // 모든 사용자 확인
            const allUsers = await prisma.user.findMany({
                select: { id: true, email: true },
                take: 20
            });

            console.log('\n👥 All users in production database:');
            for (const u of allUsers) {
                console.log(`   👤 ID: ${u.id}, Email: ${u.email}`);
            }
        }

        await prisma.$disconnect();

    } catch (error) {
        console.error('❌ Database connection error:', error.message);
    }
}

// 프로덕션 DB를 사용하는 동일화 함수 생성
async function createSyncFunction(prisma) {
    // 기본 동일화 로직을 프로덕션 DB에서 실행
    async function synchronizeSubfolderTimersWithDB(userId, subfolderId) {
        try {
            console.log(`[PROD SYNC] Starting sync for user ${userId}, subfolder ${subfolderId}`);

            // 해당 하위 폴더의 모든 Stage 2 카드 조회
            const allCards = await prisma.srscard.findMany({
                where: {
                    userId: userId,
                    stage: 2,
                    nextReviewAt: { not: null },
                    srsfolderitem: {
                        some: {
                            srsfolder: {
                                parentId: subfolderId
                            }
                        }
                    }
                }
            });

            if (allCards.length <= 1) {
                return { success: true, message: 'Not enough cards to sync', totalSyncedCards: 0 };
            }

            // 타이머 차이 확인
            const times = allCards.map(c => new Date(c.nextReviewAt).getTime());
            const diffMs = Math.max(...times) - Math.min(...times);
            const diffMin = diffMs / 1000 / 60;

            if (diffMin > 60) {
                return { success: false, message: `Timer difference too large: ${diffMin.toFixed(1)} minutes` };
            }

            // 가장 이른 시간으로 동일화
            const earliestTime = new Date(Math.min(...times));
            console.log(`[PROD SYNC] Synchronizing ${allCards.length} cards to ${earliestTime.toISOString()}`);

            // 모든 카드의 nextReviewAt 업데이트
            await prisma.srscard.updateMany({
                where: {
                    id: { in: allCards.map(c => c.id) }
                },
                data: {
                    nextReviewAt: earliestTime
                }
            });

            return {
                success: true,
                message: `Synchronized ${allCards.length} cards`,
                totalSyncedCards: allCards.length,
                syncToTime: earliestTime
            };

        } catch (error) {
            console.error('[PROD SYNC] Error:', error);
            return { success: false, message: error.message };
        }
    }

    return { synchronizeSubfolderTimersWithDB };
}

connectRealProduction();