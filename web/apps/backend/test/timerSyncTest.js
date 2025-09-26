// test/timerSyncTest.js
// 타이머 동일화 기능 테스트 스크립트

const { prisma } = require('../lib/prismaClient');
const {
    getCardState,
    synchronizeSubfolderTimers,
    isTimerDifferenceWithinOneHour
} = require('../services/timerSyncService');

/**
 * 테스트용 SRS 카드 데이터 생성
 */
async function createTestData() {
    try {
        console.log('\n=== 테스트 데이터 생성 시작 ===');

        // 1. 테스트 사용자 생성 (또는 기존 사용자 사용)
        let testUser = await prisma.user.findFirst({
            where: { email: 'test@timersync.com' }
        });

        if (!testUser) {
            testUser = await prisma.user.create({
                data: {
                    email: 'test@timersync.com',
                    username: 'TimerSyncTestUser',
                    hashedPassword: 'test123',
                    isActive: true
                }
            });
            console.log(`✅ 테스트 사용자 생성: ${testUser.id}`);
        } else {
            console.log(`✅ 기존 테스트 사용자 사용: ${testUser.id}`);
        }

        // 2. 상위 폴더 생성
        const parentFolder = await prisma.srsfolder.create({
            data: {
                userId: testUser.id,
                name: 'Timer Sync Test Parent',
                createdDate: new Date(),
                nextReviewDate: new Date(),
                cycleAnchorAt: new Date(),
                kind: 'manual',
                autoCreated: false,
                alarmActive: false,
                stage: 0,
                learningCurveType: 'long'
            }
        });
        console.log(`✅ 상위 폴더 생성: ${parentFolder.id}`);

        // 3. 하위 폴더들 생성
        const subFolder1 = await prisma.srsfolder.create({
            data: {
                userId: testUser.id,
                name: 'Timer Sync Test Sub 1',
                parentId: parentFolder.id,
                createdDate: new Date(),
                nextReviewDate: new Date(),
                cycleAnchorAt: new Date(),
                kind: 'manual',
                autoCreated: false,
                alarmActive: false,
                stage: 0,
                learningCurveType: 'long'
            }
        });

        const subFolder2 = await prisma.srsfolder.create({
            data: {
                userId: testUser.id,
                name: 'Timer Sync Test Sub 2',
                parentId: parentFolder.id,
                createdDate: new Date(),
                nextReviewDate: new Date(),
                cycleAnchorAt: new Date(),
                kind: 'manual',
                autoCreated: false,
                alarmActive: false,
                stage: 0,
                learningCurveType: 'long'
            }
        });

        console.log(`✅ 하위 폴더들 생성: ${subFolder1.id}, ${subFolder2.id}`);

        // 4. 테스트용 단어들 생성
        const testVocabs = [];
        for (let i = 1; i <= 10; i++) {
            const vocab = await prisma.vocab.create({
                data: {
                    word: `testword${i}`,
                    meaning: `테스트 단어 ${i}`,
                    pronunciation: `test${i}`,
                    language: 'english'
                }
            });
            testVocabs.push(vocab);
        }
        console.log(`✅ 테스트 단어 ${testVocabs.length}개 생성`);

        // 5. SRS 카드들 생성 (같은 stage, 다른 타이머)
        const now = new Date();
        const testCards = [];

        // 첫 번째 하위 폴더에 카드들 추가
        for (let i = 0; i < 5; i++) {
            // Stage 1, 정답 대기 상태 카드들 (타이머 차이 30분 이내)
            const waitingUntil = new Date(now.getTime() + (60 + i * 5) * 60 * 1000); // 60분 + 5분 간격

            const card = await prisma.srscard.create({
                data: {
                    userId: testUser.id,
                    stage: 1,
                    waitingUntil: waitingUntil,
                    nextReviewAt: waitingUntil,
                    isOverdue: false,
                    isFromWrongAnswer: false,
                    isMastered: false,
                    wrongStreakCount: 0
                }
            });

            // 폴더 아이템 연결
            await prisma.srsfolderitem.create({
                data: {
                    folderId: subFolder1.id,
                    cardId: card.id,
                    vocabId: testVocabs[i].id,
                    learned: false
                }
            });

            testCards.push(card);
        }

        // 두 번째 하위 폴더에 카드들 추가 (타이머 차이 2시간 - 동일화 불가)
        for (let i = 5; i < 8; i++) {
            const waitingUntil = new Date(now.getTime() + (60 + (i-5) * 60) * 60 * 1000); // 60분, 120분, 180분

            const card = await prisma.srscard.create({
                data: {
                    userId: testUser.id,
                    stage: 1,
                    waitingUntil: waitingUntil,
                    nextReviewAt: waitingUntil,
                    isOverdue: false,
                    isFromWrongAnswer: false,
                    isMastered: false,
                    wrongStreakCount: 0
                }
            });

            await prisma.srsfolderitem.create({
                data: {
                    folderId: subFolder2.id,
                    cardId: card.id,
                    vocabId: testVocabs[i].id,
                    learned: false
                }
            });

            testCards.push(card);
        }

        console.log(`✅ SRS 카드 ${testCards.length}개 생성`);

        return {
            userId: testUser.id,
            parentFolderId: parentFolder.id,
            subFolder1Id: subFolder1.id,
            subFolder2Id: subFolder2.id,
            testCards
        };

    } catch (error) {
        console.error('❌ 테스트 데이터 생성 실패:', error);
        throw error;
    }
}

/**
 * 타이머 동일화 기능 테스트
 */
async function testTimerSync() {
    try {
        console.log('\n=== 타이머 동일화 기능 테스트 시작 ===\n');

        // 1. 테스트 데이터 생성
        const testData = await createTestData();
        const { userId, subFolder1Id, subFolder2Id } = testData;

        // 2. 첫 번째 하위 폴더 테스트 (동일화 가능)
        console.log('\n--- 첫 번째 하위 폴더 테스트 (동일화 가능) ---');

        // 동일화 전 상태 확인
        const beforeCards1 = await prisma.srscard.findMany({
            where: {
                userId: userId,
                srsfolderitem: { some: { folderId: subFolder1Id } }
            },
            include: { srsfolderitem: true }
        });

        console.log('동일화 전 카드 상태:');
        beforeCards1.forEach((card, index) => {
            console.log(`  카드 ${index + 1}: waitingUntil = ${card.waitingUntil?.toISOString()}`);
        });

        // 타이머 동일화 실행
        console.log('\n⚡ 타이머 동일화 실행...');
        const syncResult1 = await synchronizeSubfolderTimers(userId, subFolder1Id);
        console.log('동일화 결과:', syncResult1);

        // 동일화 후 상태 확인
        const afterCards1 = await prisma.srscard.findMany({
            where: {
                userId: userId,
                srsfolderitem: { some: { folderId: subFolder1Id } }
            },
            include: { srsfolderitem: true }
        });

        console.log('\n동일화 후 카드 상태:');
        afterCards1.forEach((card, index) => {
            console.log(`  카드 ${index + 1}: waitingUntil = ${card.waitingUntil?.toISOString()}`);
        });

        // 3. 두 번째 하위 폴더 테스트 (동일화 불가)
        console.log('\n--- 두 번째 하위 폴더 테스트 (동일화 불가) ---');

        const beforeCards2 = await prisma.srscard.findMany({
            where: {
                userId: userId,
                srsfolderitem: { some: { folderId: subFolder2Id } }
            },
            include: { srsfolderitem: true }
        });

        console.log('동일화 전 카드 상태 (2시간 차이):');
        beforeCards2.forEach((card, index) => {
            console.log(`  카드 ${index + 1}: waitingUntil = ${card.waitingUntil?.toISOString()}`);
        });

        const syncResult2 = await synchronizeSubfolderTimers(userId, subFolder2Id);
        console.log('동일화 결과:', syncResult2);

        // 4. 카드 상태 분류 테스트
        console.log('\n--- 카드 상태 분류 테스트 ---');
        const allTestCards = await prisma.srscard.findMany({
            where: { userId: userId },
            include: { srsfolderitem: true }
        });

        allTestCards.forEach(card => {
            const state = getCardState(card);
            console.log(`카드 ${card.id}: stage=${card.stage}, state=${state}, waitingUntil=${card.waitingUntil?.toISOString()}`);
        });

        console.log('\n✅ 모든 테스트 완료!');

    } catch (error) {
        console.error('❌ 테스트 실행 실패:', error);
    }
}

/**
 * 테스트 데이터 정리
 */
async function cleanupTestData() {
    try {
        console.log('\n=== 테스트 데이터 정리 ===');

        const testUser = await prisma.user.findFirst({
            where: { email: 'test@timersync.com' }
        });

        if (testUser) {
            // SRS 관련 데이터 삭제
            await prisma.srsfolderitem.deleteMany({
                where: {
                    srsfolder: { userId: testUser.id }
                }
            });

            await prisma.srscard.deleteMany({
                where: { userId: testUser.id }
            });

            await prisma.srsfolder.deleteMany({
                where: { userId: testUser.id }
            });

            // 테스트 단어들 삭제
            await prisma.vocab.deleteMany({
                where: { word: { startsWith: 'testword' } }
            });

            // 테스트 사용자 삭제
            await prisma.user.delete({
                where: { id: testUser.id }
            });

            console.log('✅ 테스트 데이터 정리 완료');
        }
    } catch (error) {
        console.error('❌ 테스트 데이터 정리 실패:', error);
    }
}

// 테스트 실행
async function runTest() {
    try {
        await testTimerSync();
    } finally {
        await cleanupTestData();
        await prisma.$disconnect();
    }
}

// 스크립트 직접 실행 시
if (require.main === module) {
    runTest().catch(console.error);
}

module.exports = {
    createTestData,
    testTimerSync,
    cleanupTestData
};