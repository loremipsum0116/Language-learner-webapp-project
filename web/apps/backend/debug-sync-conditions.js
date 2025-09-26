// debug-sync-conditions.js
// 동일화 조건 확인 디버그 스크립트

const { prisma } = require('./lib/prismaClient');

async function debugSyncConditions() {
    console.log('🔍 Debugging synchronization conditions...');

    try {
        // 1. 예시 카드들 조회 (일본어 N5)
        const sampleCards = await prisma.srscard.findMany({
            where: {
                srsfolderitem: {
                    some: {
                        srsfolder: {
                            userId: 2, // 주요 사용자
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
            take: 20
        });

        console.log(`📋 Found ${sampleCards.length} sample cards`);

        // 2. 카드별 상태 분석
        for (const card of sampleCards.slice(0, 5)) {
            const folder = card.srsfolderitem[0]?.srsfolder;

            console.log(`\n📌 Card ID: ${card.id}`);
            console.log(`   Folder: ${folder?.name} (ID: ${folder?.id}, Parent: ${folder?.parentId})`);
            console.log(`   Stage: ${card.stage}`);
            console.log(`   Next Review: ${card.nextReviewDate}`);
            console.log(`   Wrong Count: ${card.wrongCount}`);

            // 타이머 상태 계산
            const now = new Date();
            const reviewTime = new Date(card.nextReviewDate);
            const timeDiff = Math.floor((reviewTime - now) / 1000 / 60); // 분 단위

            console.log(`   Time until review: ${timeDiff} minutes`);

            if (timeDiff <= 0) {
                console.log(`   Status: ⏰ Ready for review`);
            } else {
                console.log(`   Status: ⏳ Waiting (${timeDiff} minutes left)`);
            }
        }

        // 3. 하위 폴더별 카드 그룹 분석
        const folderGroups = {};

        for (const card of sampleCards) {
            const folder = card.srsfolderitem[0]?.srsfolder;
            if (!folder?.parentId) continue;

            const key = `${folder.parentId}_${card.stage}`;
            if (!folderGroups[key]) {
                folderGroups[key] = [];
            }
            folderGroups[key].push(card);
        }

        console.log('\n📊 Folder groups analysis:');
        for (const [key, cards] of Object.entries(folderGroups)) {
            const [parentId, stage] = key.split('_');
            console.log(`\n🗂️  Parent Folder ${parentId}, Stage ${stage}: ${cards.length} cards`);

            if (cards.length > 1) {
                const times = cards.map(c => new Date(c.nextReviewDate).getTime());
                const minTime = Math.min(...times);
                const maxTime = Math.max(...times);
                const diffMinutes = (maxTime - minTime) / 1000 / 60;

                console.log(`   ⏱️  Timer difference: ${diffMinutes.toFixed(1)} minutes`);

                if (diffMinutes <= 60) {
                    console.log(`   ✅ Eligible for synchronization (< 60 minutes)`);
                } else {
                    console.log(`   ❌ Not eligible (> 60 minutes difference)`);
                }
            }
        }

    } catch (error) {
        console.error('❌ Debug error:', error);
    }

    await prisma.$disconnect();
}

debugSyncConditions();