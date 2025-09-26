// check-railway-db.js
// Railway 프로덕션 데이터베이스 직접 연결

const { PrismaClient } = require('@prisma/client');

// Railway 데이터베이스 URL (실제 Railway 환경의 URL을 사용해야 함)
// 이 URL은 Railway 대시보드에서 확인할 수 있습니다
const RAILWAY_DATABASE_URL = process.env.RAILWAY_DATABASE_URL ||
    "mysql://root:password@railway.app:3306/railway"; // 실제 Railway URL로 교체 필요

async function checkRailwayDatabase() {
    console.log('🚂 Connecting to Railway database...');

    // Railway 데이터베이스에 직접 연결
    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: RAILWAY_DATABASE_URL
            }
        }
    });

    try {
        // 연결 테스트
        await prisma.$connect();
        console.log('✅ Connected to Railway database successfully!');

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

            // 사용자의 Stage 2 카드들 확인
            const stage2Cards = await prisma.srscard.findMany({
                where: {
                    stage: 2,
                    nextReviewAt: { not: null }, // 올바른 필드명 사용
                    srsfolderitem: {
                        some: {
                            srsfolder: {
                                userId: user.id,
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

            console.log(`📚 Found ${stage2Cards.length} Stage 2 cards with timers`);

            if (stage2Cards.length > 0) {
                console.log('\n📋 Sample cards:');
                for (const card of stage2Cards.slice(0, 5)) {
                    const folder = card.srsfolderitem[0]?.srsfolder;
                    const now = new Date();
                    const reviewTime = new Date(card.nextReviewAt);
                    const minutesLeft = Math.floor((reviewTime - now) / 1000 / 60);

                    console.log(`   📌 Card ${card.id} in ${folder?.name}`);
                    console.log(`      Stage: ${card.stage}, Review in: ${minutesLeft} minutes`);
                }

                // 동일화 가능한 그룹 확인
                const groups = {};
                for (const card of stage2Cards) {
                    const folder = card.srsfolderitem[0]?.srsfolder;
                    const key = folder?.parentId;
                    if (!groups[key]) groups[key] = [];
                    groups[key].push(card);
                }

                console.log('\n🔍 Synchronization analysis:');
                for (const [parentId, cards] of Object.entries(groups)) {
                    if (cards.length > 1) {
                        const times = cards.map(c => new Date(c.nextReviewAt).getTime());
                        const diffMinutes = (Math.max(...times) - Math.min(...times)) / 1000 / 60;

                        console.log(`   🗂️  Parent Folder ${parentId}: ${cards.length} cards, ${diffMinutes.toFixed(1)} min difference`);

                        if (diffMinutes > 0 && diffMinutes <= 60) {
                            console.log(`      ✅ ELIGIBLE FOR SYNC!`);
                        }
                    }
                }
            }

        } else {
            console.log('❌ User sst7050@naver.com not found in Railway database');

            // 다른 이메일 패턴으로 검색
            const similarUsers = await prisma.user.findMany({
                where: {
                    OR: [
                        { email: { contains: 'sst' } },
                        { email: { contains: '7050' } }
                    ]
                },
                select: { id: true, email: true }
            });

            if (similarUsers.length > 0) {
                console.log('\n🔍 Similar users found:');
                for (const u of similarUsers) {
                    console.log(`   👤 ID: ${u.id}, Email: ${u.email}`);
                }
            }
        }

    } catch (error) {
        console.error('❌ Railway database error:', error.message);

        if (error.message.includes('ENOTFOUND') || error.message.includes('connect')) {
            console.log('💡 Make sure you have the correct Railway DATABASE_URL');
            console.log('   You can get it from Railway dashboard > Variables');
        }
    } finally {
        await prisma.$disconnect();
    }
}

checkRailwayDatabase();