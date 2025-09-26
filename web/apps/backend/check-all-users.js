// check-all-users.js
// Railway 데이터베이스의 모든 사용자 확인

const { prisma } = require('./lib/prismaClient');

async function checkAllUsers() {
    console.log('🔍 Checking all users in Railway database...');

    try {
        // 1. 모든 사용자 조회
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                personalizedSRS: true,
                _count: {
                    select: {
                        srsfolder: true
                    }
                }
            },
            orderBy: { id: 'asc' }
        });

        console.log(`📊 Found ${users.length} total users:`);

        for (const user of users) {
            console.log(`\n👤 User ID: ${user.id}`);
            console.log(`   📧 Email: ${user.email || 'No email'}`);
            console.log(`   📁 SRS Folders: ${user._count.srsfolder}`);
            console.log(`   ⚙️  Auto sync settings:`, user.personalizedSRS?.autoTimerSync || 'None');
        }

        // 2. sst로 시작하는 이메일 찾기
        const sameEmailPattern = await prisma.user.findMany({
            where: {
                email: { contains: 'sst' }
            },
            select: {
                id: true,
                email: true
            }
        });

        if (sameEmailPattern.length > 0) {
            console.log(`\n🔍 Users with 'sst' in email:`);
            for (const user of sameEmailPattern) {
                console.log(`   👤 ID: ${user.id}, Email: ${user.email}`);
            }
        }

        // 3. 가장 많은 SRS 폴더를 가진 사용자 (실제 사용자일 가능성)
        const activeUsers = users.filter(u => u._count.srsfolder > 0).sort((a, b) => b._count.srsfolder - a._count.srsfolder);

        if (activeUsers.length > 0) {
            console.log(`\n🎯 Most active users (with SRS folders):`);
            for (const user of activeUsers.slice(0, 3)) {
                console.log(`   👤 ID: ${user.id}, Email: ${user.email}, Folders: ${user._count.srsfolder}`);

                // 이 사용자의 Stage 2 카드 확인
                const stage2Count = await prisma.srscard.count({
                    where: {
                        stage: 2,
                        nextReviewDate: { not: null },
                        srsfolderitem: {
                            some: {
                                srsfolder: {
                                    userId: user.id,
                                    parentId: { not: null }
                                }
                            }
                        }
                    }
                });

                console.log(`   📚 Stage 2 cards with timers: ${stage2Count}`);
            }
        }

        // 4. 최근 활동 사용자 (Stage 2 카드가 많은)
        console.log(`\n🔍 Checking for users with Stage 2 cards...`);

        const usersWithStage2 = await prisma.user.findMany({
            where: {
                srsfolder: {
                    some: {
                        srsfolderitem: {
                            some: {
                                srscard: {
                                    stage: 2,
                                    nextReviewDate: { not: null }
                                }
                            }
                        }
                    }
                }
            },
            select: {
                id: true,
                email: true
            }
        });

        console.log(`📊 Users with Stage 2 cards: ${usersWithStage2.length}`);
        for (const user of usersWithStage2) {
            console.log(`   👤 ID: ${user.id}, Email: ${user.email}`);
        }

    } catch (error) {
        console.error('❌ Database error:', error);
    }

    await prisma.$disconnect();
}

checkAllUsers();