// correct-analysis.js
// 정확한 하위 폴더별 분석

const { PrismaClient } = require('@prisma/client');

async function correctAnalysis() {
    console.log('🔍 Correct analysis: Same subfolder timer differences');

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

        // 1. 사용자의 하위 폴더 구조 확인
        console.log('\n=== 1. Subfolder structure ===');

        const subfolders = await prisma.srsfolder.findMany({
            where: {
                userId: user.id,
                parentId: { not: null } // 하위 폴더만
            },
            include: {
                _count: {
                    select: {
                        srsfolderitem: true
                    }
                }
            },
            orderBy: { id: 'asc' }
        });

        console.log(`Found ${subfolders.length} subfolders:`);
        for (const folder of subfolders) {
            console.log(`  📁 "${folder.name}" (ID: ${folder.id}, Parent: ${folder.parentId}) - ${folder._count.srsfolderitem} items`);
        }

        // 2. 각 하위 폴더별로 Stage 2 카드 확인
        console.log('\n=== 2. Stage 2 cards by subfolder ===');

        for (const subfolder of subfolders.slice(0, 5)) { // 처음 5개만
            console.log(`\n📂 Subfolder: "${subfolder.name}" (ID: ${subfolder.id}, Parent: ${subfolder.parentId})`);

            // 이 하위 폴더에 속한 Stage 2 카드들
            const cards = await prisma.srscard.findMany({
                where: {
                    userId: user.id,
                    stage: 2,
                    nextReviewAt: { not: null },
                    srsfolderitem: {
                        some: {
                            srsfolderId: subfolder.id // 정확히 이 하위 폴더에 속한 카드들
                        }
                    }
                },
                select: {
                    id: true,
                    nextReviewAt: true
                }
            });

            console.log(`   📚 Found ${cards.length} Stage 2 cards with timers in this subfolder`);

            if (cards.length > 1) {
                // 이 하위 폴더 내 타이머 차이 계산
                const times = cards.map(c => new Date(c.nextReviewAt).getTime());
                const minTime = Math.min(...times);
                const maxTime = Math.max(...times);
                const diffMs = maxTime - minTime;
                const diffMin = diffMs / 1000 / 60;

                console.log(`   ⏱️  Timer difference in this subfolder: ${diffMin.toFixed(1)} minutes`);

                if (diffMin > 0 && diffMin <= 60) {
                    console.log(`   ✅ ELIGIBLE FOR SYNC! (${diffMin.toFixed(1)} min difference)`);

                    // 샘플 카드들 시간 표시
                    console.log(`   📋 Sample card timers:`);
                    for (const card of cards.slice(0, 5)) {
                        const now = new Date();
                        const reviewTime = new Date(card.nextReviewAt);
                        const minutesLeft = Math.floor((reviewTime - now) / 1000 / 60);
                        console.log(`      - Card ${card.id}: ${minutesLeft} minutes left`);
                    }

                    // 즉시 이 하위 폴더 동일화 실행
                    console.log(`   🚀 Executing sync for this subfolder...`);

                    try {
                        // 가장 이른 시간으로 동일화
                        const earliestTime = new Date(minTime);
                        console.log(`   📅 Syncing to: ${earliestTime.toISOString()}`);

                        const updateResult = await prisma.srscard.updateMany({
                            where: {
                                id: { in: cards.map(c => c.id) }
                            },
                            data: {
                                nextReviewAt: earliestTime
                            }
                        });

                        console.log(`   🎉 Successfully synchronized ${updateResult.count} cards!`);

                    } catch (syncError) {
                        console.error(`   ❌ Sync error:`, syncError.message);
                    }

                } else if (diffMin > 60) {
                    console.log(`   ❌ Timer difference too large: ${diffMin.toFixed(1)} minutes (> 60 min limit)`);
                } else {
                    console.log(`   ✅ Already synchronized: ${diffMin.toFixed(1)} minutes difference`);
                }
            } else {
                console.log(`   ℹ️  Only ${cards.length} cards - no sync needed`);
            }
        }

        await prisma.$disconnect();

    } catch (error) {
        console.error('❌ Analysis error:', error.message);
    }
}

correctAnalysis();