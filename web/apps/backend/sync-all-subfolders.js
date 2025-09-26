// sync-all-subfolders.js
// 모든 하위 폴더 동일화 실행

const { PrismaClient } = require('@prisma/client');

async function syncAllSubfolders() {
    console.log('🚀 SYNC ALL SUBFOLDERS - NO LIMITS');

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

        // 모든 하위 폴더 조회
        const subfolders = await prisma.srsfolder.findMany({
            where: {
                userId: user.id,
                parentId: { not: null }
            },
            select: { id: true, name: true }
        });

        console.log(`🗂️  Processing ALL ${subfolders.length} subfolders...`);

        let totalSynced = 0;

        for (const subfolder of subfolders) {
            // 이 하위 폴더의 Stage 2 카드들
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
                // 타이머 차이 확인
                const times = cards.map(c => new Date(c.nextReviewAt).getTime());
                const diffMs = Math.max(...times) - Math.min(...times);
                const diffMin = diffMs / 1000 / 60;

                if (diffMin > 0) {
                    // 무조건 동일화 (제한 없음)
                    const earliestTime = new Date(Math.min(...times));

                    const updateResult = await prisma.srscard.updateMany({
                        where: { id: { in: cards.map(c => c.id) } },
                        data: { nextReviewAt: earliestTime }
                    });

                    console.log(`📂 "${subfolder.name}": ${updateResult.count} cards synced (${diffMin.toFixed(1)} min difference)`);
                    totalSynced += updateResult.count;
                }
            }
        }

        console.log(`\n🎉 TOTAL SYNCHRONIZED: ${totalSynced} cards across all subfolders`);

        await prisma.$disconnect();

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

syncAllSubfolders();