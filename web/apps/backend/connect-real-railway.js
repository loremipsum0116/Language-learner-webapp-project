// connect-real-railway.js
// 실제 Railway 프로덕션 데이터베이스 연결

const { PrismaClient } = require('@prisma/client');

async function connectRealRailway() {
    console.log('🚂 Connecting to real Railway production database...');
    console.log('🌐 Target: clever-elegance-production.up.railway.app');

    // Railway 프로덕션 환경에서는 DATABASE_URL이 자동으로 설정됨
    // 하지만 로컬에서 접근하려면 실제 Railway DATABASE_URL이 필요

    try {
        // 먼저 현재 연결 확인
        const prisma = new PrismaClient();
        await prisma.$connect();

        console.log('✅ Connected to database');

        // sst7050@naver.com 사용자 검색
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: 'sst7050@naver.com' },
                    { email: { contains: 'sst' } },
                    { email: { contains: '7050' } }
                ]
            },
            select: {
                id: true,
                email: true,
                personalizedSRS: true
            }
        });

        if (user) {
            console.log(`✅ Found user: ID ${user.id}, Email: ${user.email}`);

            // 사용자의 Stage 2 카드들 확인
            const stage2Cards = await prisma.srscard.findMany({
                where: {
                    userId: user.id,
                    stage: 2,
                    nextReviewAt: { not: null }
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

            console.log(`📚 Found ${stage2Cards.length} Stage 2 cards with timers`);

            if (stage2Cards.length > 0) {
                console.log('\n📋 Stage 2 cards:');
                for (const card of stage2Cards.slice(0, 10)) {
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

                for (const [parentId, group] of Object.entries(groups)) {
                    const cards = group.cards;
                    if (cards.length <= 1) continue;

                    console.log(`\n🗂️  Parent Folder ${parentId} (${group.folderName}): ${cards.length} cards`);

                    // 타이머 차이 계산
                    const times = cards.map(c => new Date(c.nextReviewAt).getTime());
                    const diffMinutes = (Math.max(...times) - Math.min(...times)) / 1000 / 60;

                    console.log(`   ⏱️  Timer difference: ${diffMinutes.toFixed(1)} minutes`);

                    if (diffMinutes > 0 && diffMinutes <= 60) {
                        console.log(`   ✅ ELIGIBLE FOR SYNC! (${diffMinutes.toFixed(1)} min difference)`);

                        console.log(`   📋 Cards to sync:`);
                        for (const card of cards.slice(0, 5)) {
                            const reviewTime = new Date(card.nextReviewAt);
                            const now = new Date();
                            const minutesLeft = Math.floor((reviewTime - now) / 1000 / 60);
                            console.log(`      - Card ${card.id}: ${minutesLeft} minutes left (${reviewTime.toLocaleTimeString()})`);
                        }

                        // 즉시 동일화 실행
                        console.log(`\n🚀 Executing immediate synchronization...`);
                        const { synchronizeSubfolderTimers } = require('./services/timerSyncService');

                        const result = await synchronizeSubfolderTimers(user.id, parseInt(parentId));
                        console.log(`📊 Sync result:`, result);
                    }
                }
            } else {
                console.log('ℹ️  No Stage 2 cards with timers found');

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
                console.log(`📊 Stage distribution:`, stageDistribution);
            }

        } else {
            console.log('❌ User sst7050@naver.com not found');

            // 모든 사용자 확인
            const allUsers = await prisma.user.findMany({
                select: { id: true, email: true },
                take: 10
            });

            console.log('\n👥 All users in database:');
            for (const u of allUsers) {
                console.log(`   👤 ID: ${u.id}, Email: ${u.email}`);
            }
        }

    } catch (error) {
        console.error('❌ Database connection error:', error.message);

        if (error.message.includes('ENOTFOUND') || error.message.includes('connect')) {
            console.log('\n💡 Need Railway DATABASE_URL from production environment');
            console.log('   Check Railway dashboard > Variables > DATABASE_URL');
        }
    }
}

connectRealRailway();