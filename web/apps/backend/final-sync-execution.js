// final-sync-execution.js
// 정확한 필드명으로 최종 동일화 실행

const { PrismaClient } = require('@prisma/client');

async function finalSyncExecution() {
    console.log('🚀 FINAL SYNC EXECUTION');

    const PROD_URL = "mysql://root:mdsooQRAMNBnvXHjTyMYwpQvmXUtlZsG@shuttle.proxy.rlwy.net:25466/railway";

    try {
        const prisma = new PrismaClient({
            datasources: { db: { url: PROD_URL } }
        });

        await prisma.$connect();
        console.log('✅ Connected to Railway production database');

        // sst7050@naver.com 사용자
        const user = await prisma.user.findUnique({
            where: { email: 'sst7050@naver.com' }
        });

        console.log(`✅ Found user: ID ${user.id}`);

        // 각 하위 폴더별로 동일화 실행
        const subfolders = await prisma.srsfolder.findMany({
            where: {
                userId: user.id,
                parentId: { not: null }
            },
            select: { id: true, name: true, parentId: true },
            take: 5 // 처음 5개만 테스트
        });

        console.log(`\n🗂️  Processing ${subfolders.length} subfolders...`);

        let totalSynced = 0;

        for (const subfolder of subfolders) {
            console.log(`\n📂 Processing: "${subfolder.name}" (ID: ${subfolder.id})`);

            // 이 하위 폴더에 속한 Stage 2 카드들 (올바른 쿼리)
            const cards = await prisma.srscard.findMany({
                where: {
                    userId: user.id,
                    stage: 2,
                    nextReviewAt: { not: null },
                    srsfolderitem: {
                        some: {
                            srsfolder: {
                                id: subfolder.id
                            }
                        }
                    }
                },
                select: {
                    id: true,
                    nextReviewAt: true
                }
            });

            console.log(`   📚 Found ${cards.length} Stage 2 cards with timers`);

            if (cards.length > 1) {
                // 타이머 차이 계산
                const times = cards.map(c => new Date(c.nextReviewAt).getTime());
                const minTime = Math.min(...times);
                const maxTime = Math.max(...times);
                const diffMs = maxTime - minTime;
                const diffMin = diffMs / 1000 / 60;

                console.log(`   ⏱️  Timer difference: ${diffMin.toFixed(1)} minutes`);

                if (diffMin > 0) {
                    // 타이머 차이가 있으면 무조건 동일화 (60분 제한 해제)
                    const earliestTime = new Date(minTime);
                    console.log(`   🔄 Syncing ${cards.length} cards to: ${earliestTime.toLocaleString()}`);

                    const updateResult = await prisma.srscard.updateMany({
                        where: {
                            id: { in: cards.map(c => c.id) }
                        },
                        data: {
                            nextReviewAt: earliestTime
                        }
                    });

                    console.log(`   🎉 Successfully synchronized ${updateResult.count} cards!`);
                    totalSynced += updateResult.count;

                } else {
                    console.log(`   ✅ Already synchronized (${diffMin.toFixed(1)} min difference)`);
                }
            } else {
                console.log(`   ℹ️  Only ${cards.length} cards - no sync needed`);
            }
        }

        console.log(`\n🏁 TOTAL SYNCHRONIZED: ${totalSynced} cards`);

        // 최종 검증 - 동일화 후 상태 확인
        console.log(`\n🔍 Post-sync verification...`);

        for (const subfolder of subfolders.slice(0, 3)) {
            const cards = await prisma.srscard.findMany({
                where: {
                    userId: user.id,
                    stage: 2,
                    nextReviewAt: { not: null },
                    srsfolderitem: {
                        some: {
                            srsfolder: { id: subfolder.id }
                        }
                    }
                },
                select: { id: true, nextReviewAt: true }
            });

            if (cards.length > 1) {
                const times = cards.map(c => new Date(c.nextReviewAt).getTime());
                const diffMs = Math.max(...times) - Math.min(...times);
                const diffMin = diffMs / 1000 / 60;

                console.log(`📂 "${subfolder.name}": ${cards.length} cards, ${diffMin.toFixed(1)} min difference`);

                if (diffMin < 0.1) {
                    console.log(`   ✅ Perfect synchronization!`);
                } else {
                    console.log(`   ⚠️  Still has difference: ${diffMin.toFixed(1)} minutes`);
                }
            }
        }

        await prisma.$disconnect();

    } catch (error) {
        console.error('❌ Final sync error:', error.message);
    }
}

finalSyncExecution();