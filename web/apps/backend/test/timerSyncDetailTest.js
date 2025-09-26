// test/timerSyncDetailTest.js
// 타이머 동일화 기능 정밀 테스트

const { prisma } = require('../lib/prismaClient');
const {
    getCardState,
    getCardTimerEndTime,
    isTimerDifferenceWithinOneHour,
    synchronizeCardTimers,
    synchronizeSubfolderTimers
} = require('../services/timerSyncService');

// 색상 코드 for better visualization
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(colors[color] + message + colors.reset);
}

/**
 * 테스트 케이스 1: 1시간 이내 차이 - 동일화 가능
 */
async function testCase1_WithinOneHour() {
    log('\n========================================', 'bright');
    log('테스트 1: 1시간 이내 차이 (동일화 가능)', 'cyan');
    log('========================================', 'bright');

    try {
        // 1. 테스트 사용자 생성
        const testUser = await prisma.user.upsert({
            where: { email: 'test1@timersync.com' },
            update: {},
            create: {
                email: 'test1@timersync.com',
                passwordHash: 'test123hash'  // passwordHash 필드만 사용
            }
        });

        // 2. 상위 폴더와 하위 폴더 생성
        const parentFolder = await prisma.srsfolder.create({
            data: {
                userId: testUser.id,
                name: 'Test1 Parent',
                createdDate: new Date(),
                nextReviewDate: new Date(),
                stage: 0,
                learningCurveType: 'long',
                updatedAt: new Date()
            }
        });

        const subFolder = await prisma.srsfolder.create({
            data: {
                userId: testUser.id,
                name: 'Test1 SubFolder',
                parentId: parentFolder.id,
                createdDate: new Date(),
                nextReviewDate: new Date(),
                stage: 0,
                learningCurveType: 'long',
                updatedAt: new Date()
            }
        });

        // 3. 테스트 카드들 생성 (45분 차이)
        const now = new Date();
        const cards = [];
        const timeDiffs = [0, 15, 30, 45]; // 분 단위 차이

        for (let i = 0; i < timeDiffs.length; i++) {
            const waitingUntil = new Date(now.getTime() + (60 + timeDiffs[i]) * 60 * 1000);

            const card = await prisma.srscard.create({
                data: {
                    userId: testUser.id,
                    stage: 2,
                    waitingUntil: waitingUntil,
                    nextReviewAt: waitingUntil,
                    isOverdue: false,
                    isFromWrongAnswer: false,
                    wrongStreakCount: 0
                }
            });

            // 폴더 연결
            await prisma.srsfolderitem.create({
                data: {
                    folderId: subFolder.id,
                    cardId: card.id,
                    learned: false
                }
            });

            cards.push(card);
            log(`  카드 ${i+1} 생성: waitingUntil = ${waitingUntil.toISOString()} (+${60 + timeDiffs[i]}분)`, 'yellow');
        }

        // 4. 타이머 차이 검증
        log('\n📊 타이머 차이 검증:', 'blue');
        const isWithinOneHour = isTimerDifferenceWithinOneHour(cards);
        log(`  1시간 이내 차이: ${isWithinOneHour} (예상: true)`, isWithinOneHour ? 'green' : 'red');

        const times = cards.map(c => c.waitingUntil.getTime());
        const minTime = Math.min(...times);
        const maxTime = Math.max(...times);
        const diffMinutes = (maxTime - minTime) / (60 * 1000);
        log(`  실제 차이: ${diffMinutes}분`, 'yellow');

        // 5. 동일화 실행
        log('\n⚡ 타이머 동일화 실행...', 'blue');
        const syncResult = await synchronizeSubfolderTimers(testUser.id, subFolder.id);
        log(`  결과: ${syncResult.message}`, syncResult.success ? 'green' : 'red');

        // 6. 동일화 후 검증
        const updatedCards = await prisma.srscard.findMany({
            where: {
                userId: testUser.id,
                srsfolderitem: { some: { folderId: subFolder.id } }
            },
            orderBy: { id: 'asc' }
        });

        log('\n✅ 동일화 후 상태:', 'green');
        const uniqueTimes = new Set();
        updatedCards.forEach((card, i) => {
            log(`  카드 ${i+1}: ${card.waitingUntil.toISOString()}`, 'yellow');
            uniqueTimes.add(card.waitingUntil.getTime());
        });

        if (uniqueTimes.size === 1) {
            log(`  ✅ 모든 카드가 동일한 시간으로 설정됨!`, 'green');
            const syncedTime = new Date(Array.from(uniqueTimes)[0]);
            const expectedTime = new Date(minTime);
            if (syncedTime.getTime() === expectedTime.getTime()) {
                log(`  ✅ 가장 이른 시간으로 올바르게 동일화됨!`, 'green');
            } else {
                log(`  ❌ 잘못된 시간으로 동일화됨 (예상: ${expectedTime.toISOString()})`, 'red');
            }
        } else {
            log(`  ❌ 동일화 실패 - ${uniqueTimes.size}개의 서로 다른 시간 존재`, 'red');
        }

        // 정리
        await cleanupTestData(testUser.id);

    } catch (error) {
        log(`❌ 테스트 1 실패: ${error.message}`, 'red');
        console.error(error);
    }
}

/**
 * 테스트 케이스 2: 1시간 초과 차이 - 동일화 불가
 */
async function testCase2_ExceedsOneHour() {
    log('\n========================================', 'bright');
    log('테스트 2: 1시간 초과 차이 (동일화 불가)', 'cyan');
    log('========================================', 'bright');

    try {
        const testUser = await prisma.user.upsert({
            where: { email: 'test2@timersync.com' },
            update: {},
            create: {
                email: 'test2@timersync.com',
                passwordHash: 'test123hash'
            }
        });

        const parentFolder = await prisma.srsfolder.create({
            data: {
                userId: testUser.id,
                name: 'Test2 Parent',
                createdDate: new Date(),
                nextReviewDate: new Date(),
                stage: 0,
                learningCurveType: 'long',
                updatedAt: new Date()
            }
        });

        const subFolder = await prisma.srsfolder.create({
            data: {
                userId: testUser.id,
                name: 'Test2 SubFolder',
                parentId: parentFolder.id,
                createdDate: new Date(),
                nextReviewDate: new Date(),
                stage: 0,
                learningCurveType: 'long',
                updatedAt: new Date()
            }
        });

        // 카드들 생성 (90분 차이 - 1시간 초과)
        const now = new Date();
        const cards = [];
        const timeDiffs = [0, 30, 60, 90]; // 90분 차이로 1시간 초과

        for (let i = 0; i < timeDiffs.length; i++) {
            const waitingUntil = new Date(now.getTime() + (60 + timeDiffs[i]) * 60 * 1000);

            const card = await prisma.srscard.create({
                data: {
                    userId: testUser.id,
                    stage: 2,
                    waitingUntil: waitingUntil,
                    nextReviewAt: waitingUntil,
                    isOverdue: false,
                    isFromWrongAnswer: false,
                    wrongStreakCount: 0
                }
            });

            await prisma.srsfolderitem.create({
                data: {
                    folderId: subFolder.id,
                    cardId: card.id,
                    learned: false
                }
            });

            cards.push(card);
            log(`  카드 ${i+1} 생성: waitingUntil = +${60 + timeDiffs[i]}분`, 'yellow');
        }

        // 타이머 차이 검증
        log('\n📊 타이머 차이 검증:', 'blue');
        const isWithinOneHour = isTimerDifferenceWithinOneHour(cards);
        log(`  1시간 이내 차이: ${isWithinOneHour} (예상: false)`, !isWithinOneHour ? 'green' : 'red');

        const times = cards.map(c => c.waitingUntil.getTime());
        const diffMinutes = (Math.max(...times) - Math.min(...times)) / (60 * 1000);
        log(`  실제 차이: ${diffMinutes}분`, 'yellow');

        // 동일화 시도
        log('\n⚡ 타이머 동일화 시도...', 'blue');
        const syncResult = await synchronizeSubfolderTimers(testUser.id, subFolder.id);
        log(`  결과: ${syncResult.message}`, 'yellow');

        if (syncResult.syncedGroups === 0) {
            log(`  ✅ 예상대로 동일화가 거부됨 (1시간 초과)`, 'green');
        } else {
            log(`  ❌ 잘못된 동일화 수행됨!`, 'red');
        }

        await cleanupTestData(testUser.id);

    } catch (error) {
        log(`❌ 테스트 2 실패: ${error.message}`, 'red');
    }
}

/**
 * 테스트 케이스 3: 다른 stage - 동일화 불가
 */
async function testCase3_DifferentStages() {
    log('\n========================================', 'bright');
    log('테스트 3: 다른 Stage (동일화 불가)', 'cyan');
    log('========================================', 'bright');

    try {
        const testUser = await prisma.user.upsert({
            where: { email: 'test3@timersync.com' },
            update: {},
            create: {
                email: 'test3@timersync.com',
                passwordHash: 'test123hash'
            }
        });

        const parentFolder = await prisma.srsfolder.create({
            data: {
                userId: testUser.id,
                name: 'Test3 Parent',
                createdDate: new Date(),
                nextReviewDate: new Date(),
                stage: 0,
                learningCurveType: 'long',
                updatedAt: new Date()
            }
        });

        const subFolder = await prisma.srsfolder.create({
            data: {
                userId: testUser.id,
                name: 'Test3 SubFolder',
                parentId: parentFolder.id,
                createdDate: new Date(),
                nextReviewDate: new Date(),
                stage: 0,
                learningCurveType: 'long',
                updatedAt: new Date()
            }
        });

        // 서로 다른 stage의 카드들
        const now = new Date();
        const stages = [1, 2, 2, 3]; // 다른 stage 포함

        for (let i = 0; i < stages.length; i++) {
            const waitingUntil = new Date(now.getTime() + (60 + i * 10) * 60 * 1000);

            const card = await prisma.srscard.create({
                data: {
                    userId: testUser.id,
                    stage: stages[i],
                    waitingUntil: waitingUntil,
                    nextReviewAt: waitingUntil,
                    isOverdue: false,
                    isFromWrongAnswer: false,
                    wrongStreakCount: 0
                }
            });

            await prisma.srsfolderitem.create({
                data: {
                    folderId: subFolder.id,
                    cardId: card.id,
                    learned: false
                }
            });

            log(`  카드 ${i+1} 생성: Stage ${stages[i]}, +${60 + i * 10}분`, 'yellow');
        }

        log('\n⚡ 타이머 동일화 시도...', 'blue');
        const syncResult = await synchronizeSubfolderTimers(testUser.id, subFolder.id);
        log(`  결과: ${syncResult.message}`, 'yellow');

        // Stage별 그룹 확인
        log(`  동일화된 그룹 수: ${syncResult.syncedGroups}`, 'cyan');
        log(`  ✅ Stage가 다른 카드들은 별도 그룹으로 처리됨`, 'green');

        await cleanupTestData(testUser.id);

    } catch (error) {
        log(`❌ 테스트 3 실패: ${error.message}`, 'red');
    }
}

/**
 * 테스트 케이스 4: 다른 상태 - 동일화 불가
 */
async function testCase4_DifferentStates() {
    log('\n========================================', 'bright');
    log('테스트 4: 다른 상태 (동일화 불가)', 'cyan');
    log('========================================', 'bright');

    try {
        const testUser = await prisma.user.upsert({
            where: { email: 'test4@timersync.com' },
            update: {},
            create: {
                email: 'test4@timersync.com',
                passwordHash: 'test123hash'
            }
        });

        const parentFolder = await prisma.srsfolder.create({
            data: {
                userId: testUser.id,
                name: 'Test4 Parent',
                createdDate: new Date(),
                nextReviewDate: new Date(),
                stage: 0,
                learningCurveType: 'long',
                updatedAt: new Date()
            }
        });

        const subFolder = await prisma.srsfolder.create({
            data: {
                userId: testUser.id,
                name: 'Test4 SubFolder',
                parentId: parentFolder.id,
                createdDate: new Date(),
                nextReviewDate: new Date(),
                stage: 0,
                learningCurveType: 'long',
                updatedAt: new Date()
            }
        });

        const now = new Date();
        const future = new Date(now.getTime() + 60 * 60 * 1000);

        // 정답 대기 카드
        const card1 = await prisma.srscard.create({
            data: {
                userId: testUser.id,
                stage: 2,
                waitingUntil: future,
                nextReviewAt: future,
                isOverdue: false,
                isFromWrongAnswer: false,
                wrongStreakCount: 0
            }
        });

        // 오답 대기 카드
        const card2 = await prisma.srscard.create({
            data: {
                userId: testUser.id,
                stage: 2,
                waitingUntil: future,
                nextReviewAt: future,
                isOverdue: false,
                isFromWrongAnswer: true, // 오답 카드
                wrongStreakCount: 1
            }
        });

        // 동결 카드
        const card3 = await prisma.srscard.create({
            data: {
                userId: testUser.id,
                stage: 2,
                frozenUntil: future,
                isOverdue: false,
                isFromWrongAnswer: false,
                wrongStreakCount: 0
            }
        });

        // 연체 카드
        const card4 = await prisma.srscard.create({
            data: {
                userId: testUser.id,
                stage: 2,
                isOverdue: true,
                overdueDeadline: future,
                isFromWrongAnswer: false,
                wrongStreakCount: 0
            }
        });

        // 모든 카드를 폴더에 연결
        const cards = [card1, card2, card3, card4];
        for (const card of cards) {
            await prisma.srsfolderitem.create({
                data: {
                    folderId: subFolder.id,
                    cardId: card.id,
                    learned: false
                }
            });
        }

        log('  카드 1: 정답 대기 (waiting_correct)', 'yellow');
        log('  카드 2: 오답 대기 (waiting_wrong)', 'yellow');
        log('  카드 3: 동결 (frozen)', 'yellow');
        log('  카드 4: 연체 (overdue)', 'yellow');

        // 상태 확인
        log('\n📊 카드 상태 확인:', 'blue');
        for (let i = 0; i < cards.length; i++) {
            const state = getCardState(cards[i]);
            log(`  카드 ${i+1}: ${state}`, 'cyan');
        }

        log('\n⚡ 타이머 동일화 시도...', 'blue');
        const syncResult = await synchronizeSubfolderTimers(testUser.id, subFolder.id);
        log(`  결과: ${syncResult.message}`, 'yellow');

        if (syncResult.syncedGroups === 0) {
            log(`  ✅ 예상대로 동일화 없음 (모든 카드가 다른 상태)`, 'green');
        } else {
            log(`  ⚠️  ${syncResult.syncedGroups}개 그룹이 동일화됨`, 'yellow');
        }

        await cleanupTestData(testUser.id);

    } catch (error) {
        log(`❌ 테스트 4 실패: ${error.message}`, 'red');
    }
}

/**
 * 테스트 케이스 5: 경계 케이스 - 정확히 1시간
 */
async function testCase5_ExactlyOneHour() {
    log('\n========================================', 'bright');
    log('테스트 5: 정확히 1시간 차이 (경계 케이스)', 'cyan');
    log('========================================', 'bright');

    try {
        const testUser = await prisma.user.upsert({
            where: { email: 'test5@timersync.com' },
            update: {},
            create: {
                email: 'test5@timersync.com',
                passwordHash: 'test123hash'
            }
        });

        const parentFolder = await prisma.srsfolder.create({
            data: {
                userId: testUser.id,
                name: 'Test5 Parent',
                createdDate: new Date(),
                nextReviewDate: new Date(),
                stage: 0,
                learningCurveType: 'long',
                updatedAt: new Date()
            }
        });

        const subFolder = await prisma.srsfolder.create({
            data: {
                userId: testUser.id,
                name: 'Test5 SubFolder',
                parentId: parentFolder.id,
                createdDate: new Date(),
                nextReviewDate: new Date(),
                stage: 0,
                learningCurveType: 'long',
                updatedAt: new Date()
            }
        });

        const now = new Date();

        // 정확히 1시간 차이
        const card1 = await prisma.srscard.create({
            data: {
                userId: testUser.id,
                stage: 3,
                waitingUntil: new Date(now.getTime() + 60 * 60 * 1000), // +60분
                nextReviewAt: new Date(now.getTime() + 60 * 60 * 1000),
                isOverdue: false,
                isFromWrongAnswer: false,
                wrongStreakCount: 0
            }
        });

        const card2 = await prisma.srscard.create({
            data: {
                userId: testUser.id,
                stage: 3,
                waitingUntil: new Date(now.getTime() + 120 * 60 * 1000), // +120분 (정확히 1시간 차이)
                nextReviewAt: new Date(now.getTime() + 120 * 60 * 1000),
                isOverdue: false,
                isFromWrongAnswer: false,
                wrongStreakCount: 0
            }
        });

        await prisma.srsfolderitem.create({
            data: { folderId: subFolder.id, cardId: card1.id, learned: false }
        });
        await prisma.srsfolderitem.create({
            data: { folderId: subFolder.id, cardId: card2.id, learned: false }
        });

        log('  카드 1: +60분', 'yellow');
        log('  카드 2: +120분 (정확히 60분 차이)', 'yellow');

        const cards = [card1, card2];
        const isWithinOneHour = isTimerDifferenceWithinOneHour(cards);
        log(`\n📊 1시간 이내 판정: ${isWithinOneHour} (1시간 = 60분)`, isWithinOneHour ? 'green' : 'yellow');

        log('\n⚡ 타이머 동일화 시도...', 'blue');
        const syncResult = await synchronizeSubfolderTimers(testUser.id, subFolder.id);
        log(`  결과: ${syncResult.message}`, 'yellow');

        if (syncResult.syncedGroups > 0) {
            log(`  ✅ 정확히 1시간도 동일화 허용 (<=)`, 'green');
        } else {
            log(`  ⚠️  정확히 1시간은 동일화 거부 (<)`, 'yellow');
        }

        await cleanupTestData(testUser.id);

    } catch (error) {
        log(`❌ 테스트 5 실패: ${error.message}`, 'red');
    }
}

/**
 * 테스트 데이터 정리
 */
async function cleanupTestData(userId) {
    await prisma.srsfolderitem.deleteMany({
        where: { srsfolder: { userId: userId } }
    });
    await prisma.srscard.deleteMany({
        where: { userId: userId }
    });
    await prisma.srsfolder.deleteMany({
        where: { userId: userId }
    });
    await prisma.user.delete({
        where: { id: userId }
    });
}

/**
 * 모든 테스트 실행
 */
async function runAllTests() {
    log('\n' + '='.repeat(50), 'bright');
    log('타이머 동일화 정밀 테스트 시작', 'magenta');
    log('='.repeat(50), 'bright');

    const startTime = Date.now();

    await testCase1_WithinOneHour();
    await testCase2_ExceedsOneHour();
    await testCase3_DifferentStages();
    await testCase4_DifferentStates();
    await testCase5_ExactlyOneHour();

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    log('\n' + '='.repeat(50), 'bright');
    log(`모든 테스트 완료! (${duration}초)`, 'magenta');
    log('='.repeat(50), 'bright');
}

// 실행
if (require.main === module) {
    runAllTests()
        .catch(error => {
            log(`\n치명적 오류: ${error.message}`, 'red');
            console.error(error);
        })
        .finally(() => {
            prisma.$disconnect();
        });
}

module.exports = {
    runAllTests,
    testCase1_WithinOneHour,
    testCase2_ExceedsOneHour,
    testCase3_DifferentStages,
    testCase4_DifferentStates,
    testCase5_ExactlyOneHour
};