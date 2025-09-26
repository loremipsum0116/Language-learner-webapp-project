// find-real-data.js
// 실제 사용자 데이터 찾기

const { prisma } = require('./lib/prismaClient');

async function findRealData() {
    console.log('🔍 실제 사용자 데이터 찾기');

    try {
        // 1. 전체 데이터베이스 상황 파악
        console.log('\n=== 1. 전체 데이터베이스 현황 ===');

        const userCount = await prisma.user.count();
        const cardCount = await prisma.srscard.count();
        const folderCount = await prisma.srsfolder.count();

        console.log(`👤 전체 사용자: ${userCount}명`);
        console.log(`📚 전체 SRS 카드: ${cardCount}개`);
        console.log(`📁 전체 SRS 폴더: ${folderCount}개`);

        // 2. Stage별 카드 분포
        console.log('\n=== 2. Stage별 카드 분포 ===');

        for (let stage = 0; stage <= 5; stage++) {
            const count = await prisma.srscard.count({
                where: { stage: stage }
            });
            console.log(`   Stage ${stage}: ${count}개`);
        }

        // 3. nextReviewAt이 있는 카드들
        console.log('\n=== 3. 타이머 설정된 카드들 ===');

        const cardsWithTimer = await prisma.srscard.count({
            where: { nextReviewAt: { not: null } }
        });
        console.log(`⏰ nextReviewAt이 설정된 카드: ${cardsWithTimer}개`);

        // 4. 사용자별 카드 현황
        console.log('\n=== 4. 사용자별 카드 현황 ===');

        const usersWithCards = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                _count: {
                    select: {
                        srscard: true,
                        srsfolder: true
                    }
                }
            },
            where: {
                srscard: {
                    some: {}
                }
            }
        });

        for (const user of usersWithCards) {
            console.log(`👤 User ${user.id} (${user.email}): ${user._count.srscard}개 카드, ${user._count.srsfolder}개 폴더`);

            // 이 사용자의 Stage별 분포
            const stageDistribution = await prisma.srscard.groupBy({
                by: ['stage'],
                where: { userId: user.id },
                _count: { id: true }
            });

            console.log(`   Stage 분포: ${stageDistribution.map(s => `Stage${s.stage}:${s._count.id}`).join(', ')}`);

            // 타이머가 있는 카드들
            const timerCards = await prisma.srscard.count({
                where: {
                    userId: user.id,
                    nextReviewAt: { not: null }
                }
            });
            console.log(`   타이머 카드: ${timerCards}개`);
        }

        // 5. 실제 동일화 대상 후보 찾기
        console.log('\n=== 5. 동일화 대상 후보 분석 ===');

        // 각 사용자의 하위 폴더별로 같은 stage 카드가 2개 이상 있는 경우
        for (const user of usersWithCards) {
            console.log(`\n🔍 User ${user.id} 동일화 후보 분석:`);

            // 하위 폴더들 조회
            const subfolders = await prisma.srsfolder.findMany({
                where: {
                    userId: user.id,
                    parentId: { not: null }
                },
                select: { id: true, name: true, parentId: true }
            });

            console.log(`   📁 하위 폴더: ${subfolders.length}개`);

            for (const subfolder of subfolders.slice(0, 3)) { // 최대 3개만
                console.log(`\n   📂 "${subfolder.name}" (ID: ${subfolder.id}, Parent: ${subfolder.parentId})`);

                // 이 하위 폴더의 카드들을 stage별로 그룹화
                const cardsInFolder = await prisma.srscard.findMany({
                    where: {
                        userId: user.id,
                        srsfolderitem: {
                            some: {
                                srsfolder: {
                                    parentId: subfolder.parentId
                                }
                            }
                        }
                    },
                    select: {
                        id: true,
                        stage: true,
                        nextReviewAt: true,
                        waitingUntil: true,
                        isOverdue: true,
                        frozenUntil: true
                    }
                });

                // Stage별 그룹화
                const stageGroups = {};
                for (const card of cardsInFolder) {
                    if (!stageGroups[card.stage]) {
                        stageGroups[card.stage] = [];
                    }
                    stageGroups[card.stage].push(card);
                }

                for (const [stage, cards] of Object.entries(stageGroups)) {
                    if (cards.length <= 1) continue;

                    console.log(`      🎯 Stage ${stage}: ${cards.length}개 카드`);

                    // nextReviewAt이 있는 카드들만 필터링
                    const cardsWithNextReview = cards.filter(c => c.nextReviewAt);

                    if (cardsWithNextReview.length > 1) {
                        console.log(`         ⏰ nextReviewAt 있는 카드: ${cardsWithNextReview.length}개`);

                        // 타이머 차이 계산
                        const times = cardsWithNextReview.map(c => new Date(c.nextReviewAt).getTime());
                        const diffMs = Math.max(...times) - Math.min(...times);
                        const diffMin = diffMs / 1000 / 60;

                        console.log(`         ⏱️  타이머 차이: ${diffMin.toFixed(1)}분`);

                        if (diffMin > 0 && diffMin <= 60) {
                            console.log(`         ✅ 동일화 가능! (${diffMin.toFixed(1)}분 차이)`);

                            // 샘플 카드 정보
                            for (const card of cardsWithNextReview.slice(0, 2)) {
                                const now = new Date();
                                const reviewTime = new Date(card.nextReviewAt);
                                const minutesLeft = Math.floor((reviewTime - now) / 1000 / 60);
                                console.log(`            📌 Card ${card.id}: ${minutesLeft}분 후 복습`);
                            }
                        } else if (diffMin > 60) {
                            console.log(`         ❌ 차이 너무 큼 (${diffMin.toFixed(1)}분 > 60분)`);
                        } else {
                            console.log(`         ✅ 이미 동일화됨 (${diffMin.toFixed(1)}분 차이)`);
                        }
                    }
                }
            }
        }

    } catch (error) {
        console.error('❌ 데이터 조회 오류:', error);
    }

    await prisma.$disconnect();
}

findRealData();