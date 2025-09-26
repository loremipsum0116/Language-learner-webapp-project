// check-user-cards.js
// sst7050@naver.com 사용자의 SRS 카드 확인

const { prisma } = require('./lib/prismaClient');

async function checkUserCards() {
    console.log('🔍 Checking Railway database for sst7050@naver.com user...');

    try {
        // 1. 사용자 정보 확인
        const user = await prisma.user.findUnique({
            where: { email: 'sst7050@naver.com' },
            select: {
                id: true,
                email: true,
                personalizedSRS: true
            }
        });

        if (!user) {
            console.log('❌ User not found: sst7050@naver.com');
            return;
        }

        console.log(`✅ Found user: ID ${user.id}, Email: ${user.email}`);
        console.log(`📋 PersonalizedSRS settings:`, user.personalizedSRS);

        // 2. 사용자의 SRS 폴더 구조 확인
        const folders = await prisma.srsfolder.findMany({
            where: { userId: user.id },
            select: {
                id: true,
                name: true,
                parentId: true,
                _count: {
                    select: {
                        srsfolderitem: true
                    }
                }
            },
            orderBy: { id: 'asc' }
        });

        console.log(`\n📁 User's SRS folders (${folders.length} total):`);
        const parentFolders = folders.filter(f => f.parentId === null);
        const subfolders = folders.filter(f => f.parentId !== null);

        console.log(`\n🗂️  Parent folders (${parentFolders.length}):`);
        for (const folder of parentFolders) {
            console.log(`   📁 ${folder.name} (ID: ${folder.id}) - ${folder._count.srsfolderitem} items`);
        }

        console.log(`\n📂 Subfolders (${subfolders.length}):`);
        for (const folder of subfolders) {
            const parent = parentFolders.find(p => p.id === folder.parentId);
            console.log(`   📁 ${folder.name} (ID: ${folder.id}, Parent: ${parent?.name}) - ${folder._count.srsfolderitem} items`);
        }

        // 3. Stage 2 카드들 확인 (타이머가 있는 것들)
        console.log(`\n🔍 Checking Stage 2 cards with timers...`);

        const stage2Cards = await prisma.srscard.findMany({
            where: {
                stage: 2,
                nextReviewDate: { not: null },
                srsfolderitem: {
                    some: {
                        srsfolder: {
                            userId: user.id,
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

        console.log(`📊 Found ${stage2Cards.length} Stage 2 cards with timers`);

        if (stage2Cards.length > 0) {
            // 하위 폴더별 그룹화
            const groups = {};
            for (const card of stage2Cards) {
                const folder = card.srsfolderitem[0]?.srsfolder;
                if (!folder?.parentId) continue;

                const key = folder.parentId;
                if (!groups[key]) {
                    groups[key] = {
                        folderName: folder.name.split(' ')[0], // 첫 단어만
                        cards: []
                    };
                }
                groups[key].cards.push(card);
            }

            console.log(`\n📊 Grouping by parent folder:`);
            for (const [parentId, group] of Object.entries(groups)) {
                const cards = group.cards;
                console.log(`\n🗂️  Parent Folder ${parentId} (${group.folderName}...): ${cards.length} Stage 2 cards`);

                if (cards.length > 1) {
                    // 타이머 차이 계산
                    const times = cards.map(c => new Date(c.nextReviewDate).getTime());
                    const minTime = Math.min(...times);
                    const maxTime = Math.max(...times);
                    const diffMinutes = (maxTime - minTime) / 1000 / 60;

                    console.log(`   ⏱️  Timer difference: ${diffMinutes.toFixed(1)} minutes`);

                    if (diffMinutes > 0 && diffMinutes <= 60) {
                        console.log(`   ✅ ELIGIBLE FOR SYNC! (${diffMinutes.toFixed(1)} min difference)`);

                        // 카드 세부 정보 (처음 3개만)
                        console.log(`   📋 Sample cards:`);
                        for (const card of cards.slice(0, 3)) {
                            const reviewTime = new Date(card.nextReviewDate);
                            const now = new Date();
                            const minutesLeft = Math.floor((reviewTime - now) / 1000 / 60);
                            console.log(`      - Card ${card.id}: ${minutesLeft} minutes left (${reviewTime.toLocaleTimeString()})`);
                        }
                    } else if (diffMinutes > 60) {
                        console.log(`   ❌ Not eligible (${diffMinutes.toFixed(1)} min > 60 min limit)`);
                    } else {
                        console.log(`   ✅ Already synchronized (${diffMinutes.toFixed(1)} min difference)`);
                    }
                }
            }
        }

        // 4. 전체 카드 상태 요약
        const cardStats = await prisma.srscard.aggregate({
            where: {
                srsfolderitem: {
                    some: {
                        srsfolder: {
                            userId: user.id
                        }
                    }
                }
            },
            _count: { id: true }
        });

        const timerCards = await prisma.srscard.count({
            where: {
                nextReviewDate: { not: null },
                srsfolderitem: {
                    some: {
                        srsfolder: {
                            userId: user.id
                        }
                    }
                }
            }
        });

        console.log(`\n📊 User's card statistics:`);
        console.log(`   Total cards: ${cardStats._count.id}`);
        console.log(`   Cards with timers: ${timerCards}`);
        console.log(`   Cards without timers: ${cardStats._count.id - timerCards}`);

    } catch (error) {
        console.error('❌ Database error:', error);
    }

    await prisma.$disconnect();
}

checkUserCards();