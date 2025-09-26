// analyze-sync-logic.js
// 동일화 로직 심층 분석

const { prisma } = require('./lib/prismaClient');

// 현재 구현된 getCardState 함수 복사
function getCardState(card) {
    let now;
    try {
        const { getOffsetDate } = require('./routes/timeMachine');
        now = getOffsetDate();
    } catch {
        now = new Date();
    }

    if (card.frozenUntil && new Date(card.frozenUntil) > now) {
        return 'frozen';
    }

    if (card.isOverdue) {
        return 'overdue';
    }

    if (card.waitingUntil && new Date(card.waitingUntil) > now) {
        if (card.isFromWrongAnswer) {
            return 'waiting_wrong';
        }
        return 'waiting_correct';
    }

    return 'ready';
}

function getCardTimerEndTime(card) {
    const state = getCardState(card);

    switch (state) {
        case 'frozen':
            return card.frozenUntil;
        case 'overdue':
            return card.overdueDeadline;
        case 'waiting_correct':
        case 'waiting_wrong':
            return card.waitingUntil;
        case 'ready':
            return null;
        default:
            return null;
    }
}

async function analyzeLogic() {
    console.log('🔍 심층 분석: SRS 타이머 동일화 로직');

    try {
        // 1. 실제 Stage 2 카드들의 데이터 구조 분석
        console.log('\n=== 1. 실제 데이터 구조 분석 ===');

        const sampleCards = await prisma.srscard.findMany({
            where: {
                stage: 2,
                srsfolderitem: {
                    some: {
                        srsfolder: {
                            parentId: { not: null }
                        }
                    }
                }
            },
            take: 10
        });

        console.log(`📊 Stage 2 카드 샘플: ${sampleCards.length}개`);

        for (const card of sampleCards.slice(0, 3)) {
            console.log(`\n📌 Card ID: ${card.id}`);
            console.log(`   nextReviewAt: ${card.nextReviewAt}`);
            console.log(`   waitingUntil: ${card.waitingUntil}`);
            console.log(`   frozenUntil: ${card.frozenUntil}`);
            console.log(`   isOverdue: ${card.isOverdue}`);
            console.log(`   overdueDeadline: ${card.overdueDeadline}`);
            console.log(`   isFromWrongAnswer: ${card.isFromWrongAnswer}`);

            // 현재 로직으로 상태 분석
            const state = getCardState(card);
            const timerEndTime = getCardTimerEndTime(card);

            console.log(`   📋 현재 로직 분석:`);
            console.log(`      상태: ${state}`);
            console.log(`      타이머 종료 시각: ${timerEndTime}`);

            // 실제 UI에서 보여지는 타이머는 nextReviewAt 기준
            if (card.nextReviewAt) {
                const now = new Date();
                const nextReview = new Date(card.nextReviewAt);
                const minutesLeft = Math.floor((nextReview - now) / 1000 / 60);
                console.log(`   🕐 실제 복습 타이머 (nextReviewAt): ${minutesLeft}분 후`);
            }
        }

        // 2. 로직 일치성 검증
        console.log('\n=== 2. 로직 일치성 검증 ===');

        let matchCount = 0;
        let mismatchCount = 0;

        for (const card of sampleCards) {
            const timerEndTime = getCardTimerEndTime(card);
            const nextReviewAt = card.nextReviewAt;

            // 두 값이 일치하는지 확인
            if (timerEndTime && nextReviewAt) {
                const diff = Math.abs(new Date(timerEndTime) - new Date(nextReviewAt));
                if (diff < 1000) { // 1초 이내 차이면 일치로 간주
                    matchCount++;
                } else {
                    mismatchCount++;
                    console.log(`❌ 불일치 발견 - Card ${card.id}:`);
                    console.log(`   로직 결과: ${timerEndTime}`);
                    console.log(`   실제 nextReviewAt: ${nextReviewAt}`);
                }
            } else if (!timerEndTime && !nextReviewAt) {
                matchCount++;
            } else {
                mismatchCount++;
                console.log(`❌ NULL 불일치 - Card ${card.id}:`);
                console.log(`   로직 결과: ${timerEndTime}`);
                console.log(`   실제 nextReviewAt: ${nextReviewAt}`);
            }
        }

        console.log(`\n📊 일치성 검증 결과:`);
        console.log(`   ✅ 일치: ${matchCount}개`);
        console.log(`   ❌ 불일치: ${mismatchCount}개`);

        // 3. 동일화 대상 그룹 분석
        console.log('\n=== 3. 동일화 대상 그룹 분석 ===');

        // 하위 폴더별 Stage 2 카드 그룹화
        const cardsByFolder = {};

        for (const card of sampleCards) {
            const folderItems = await prisma.srsfolderitem.findMany({
                where: { srscardId: card.id },
                include: { srsfolder: true }
            });

            for (const item of folderItems) {
                const folder = item.srsfolder;
                if (!folder.parentId) continue;

                const key = `parent_${folder.parentId}_stage_${card.stage}`;
                if (!cardsByFolder[key]) {
                    cardsByFolder[key] = [];
                }
                cardsByFolder[key].push(card);
            }
        }

        for (const [groupKey, cards] of Object.entries(cardsByFolder)) {
            if (cards.length <= 1) continue;

            console.log(`\n🗂️  그룹: ${groupKey} (${cards.length}개 카드)`);

            // 현재 로직으로 상태 분석
            const states = cards.map(card => getCardState(card));
            const uniqueStates = [...new Set(states)];
            console.log(`   상태들: ${uniqueStates.join(', ')}`);

            // nextReviewAt 기준 분석
            const nextReviewTimes = cards
                .filter(card => card.nextReviewAt)
                .map(card => new Date(card.nextReviewAt).getTime());

            if (nextReviewTimes.length > 1) {
                const diffMs = Math.max(...nextReviewTimes) - Math.min(...nextReviewTimes);
                const diffMin = diffMs / 1000 / 60;

                console.log(`   nextReviewAt 차이: ${diffMin.toFixed(1)}분`);

                if (diffMin <= 60) {
                    console.log(`   ✅ 동일화 가능 (60분 이내)`);

                    // 각 상태별 동일화 가능 여부
                    if (uniqueStates.length === 1) {
                        console.log(`   ✅ 모든 카드 같은 상태: ${uniqueStates[0]}`);
                    } else {
                        console.log(`   ❌ 다른 상태 존재: ${uniqueStates.join(', ')}`);
                    }
                } else {
                    console.log(`   ❌ 동일화 불가 (60분 초과)`);
                }
            }
        }

        // 4. 핵심 문제점 진단
        console.log('\n=== 4. 핵심 문제점 진단 ===');

        // 현재 로직이 실제로 동일화해야 할 카드들을 찾는지 확인
        const problemCards = sampleCards.filter(card => {
            const timerEndTime = getCardTimerEndTime(card);
            return timerEndTime === null && card.nextReviewAt !== null;
        });

        if (problemCards.length > 0) {
            console.log(`❌ 문제 발견: ${problemCards.length}개 카드가 동일화 로직에서 제외됨`);
            console.log(`   - nextReviewAt은 있지만 getCardTimerEndTime에서 null 반환`);

            for (const card of problemCards.slice(0, 2)) {
                console.log(`   📌 Card ${card.id}: state=${getCardState(card)}, nextReviewAt=${card.nextReviewAt}`);
            }
        }

        // 5. 권장 수정 방향
        console.log('\n=== 5. 권장 수정 방향 ===');

        if (mismatchCount > matchCount) {
            console.log(`🔧 권장사항 1: getCardTimerEndTime 로직이 nextReviewAt과 일치하지 않음`);
            console.log(`   → nextReviewAt 필드를 직접 사용하는 방향으로 수정 고려`);
        }

        if (problemCards.length > 0) {
            console.log(`🔧 권장사항 2: ready 상태 카드들도 nextReviewAt이 있으면 동일화 대상에 포함`);
            console.log(`   → getCardTimerEndTime에서 ready 상태일 때도 nextReviewAt 반환 고려`);
        }

        console.log(`🔧 권장사항 3: 상태 분류 단순화`);
        console.log(`   → Stage + nextReviewAt 존재 여부만으로 그룹화하는 방식 고려`);

    } catch (error) {
        console.error('❌ 분석 오류:', error);
    }

    await prisma.$disconnect();
}

analyzeLogic();