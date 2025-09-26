// test/timerSyncUnitTest.js
// 타이머 동일화 핵심 로직 단위 테스트 (DB 연결 없이)

const {
    getCardState,
    getCardTimerEndTime,
    isTimerDifferenceWithinOneHour
} = require('../services/timerSyncService');

// 색상 코드
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
 * 테스트 1: 카드 상태 분류 테스트
 */
function testCardStateClassification() {
    log('\n========================================', 'bright');
    log('테스트 1: 카드 상태 분류', 'cyan');
    log('========================================', 'bright');

    const now = new Date();
    const future = new Date(now.getTime() + 60 * 60 * 1000); // 1시간 후
    const past = new Date(now.getTime() - 60 * 60 * 1000); // 1시간 전

    const testCases = [
        {
            name: '동결 카드',
            card: { frozenUntil: future },
            expected: 'frozen'
        },
        {
            name: '연체 카드',
            card: { isOverdue: true, overdueDeadline: future },
            expected: 'overdue'
        },
        {
            name: '정답 대기 카드',
            card: { waitingUntil: future, isFromWrongAnswer: false },
            expected: 'waiting_correct'
        },
        {
            name: '오답 대기 카드',
            card: { waitingUntil: future, isFromWrongAnswer: true },
            expected: 'waiting_wrong'
        },
        {
            name: '즉시 복습 가능 카드',
            card: { waitingUntil: null, isOverdue: false },
            expected: 'ready'
        },
        {
            name: '대기 시간 끝난 카드',
            card: { waitingUntil: past, isOverdue: false },
            expected: 'ready'
        }
    ];

    let passed = 0;
    for (const testCase of testCases) {
        const result = getCardState(testCase.card);
        if (result === testCase.expected) {
            log(`  ✅ ${testCase.name}: ${result}`, 'green');
            passed++;
        } else {
            log(`  ❌ ${testCase.name}: 예상 ${testCase.expected}, 실제 ${result}`, 'red');
        }
    }

    log(`\n결과: ${passed}/${testCases.length} 통과`, passed === testCases.length ? 'green' : 'red');
    return passed === testCases.length;
}

/**
 * 테스트 2: 타이머 종료 시각 계산
 */
function testCardTimerEndTime() {
    log('\n========================================', 'bright');
    log('테스트 2: 타이머 종료 시각 계산', 'cyan');
    log('========================================', 'bright');

    const future = new Date(Date.now() + 60 * 60 * 1000);

    const testCases = [
        {
            name: '동결 카드',
            card: { frozenUntil: future },
            expected: future
        },
        {
            name: '연체 카드',
            card: { isOverdue: true, overdueDeadline: future },
            expected: future
        },
        {
            name: '대기 카드',
            card: { waitingUntil: future, isFromWrongAnswer: false },
            expected: future
        },
        {
            name: '즉시 복습 카드',
            card: { waitingUntil: null, isOverdue: false },
            expected: null
        }
    ];

    let passed = 0;
    for (const testCase of testCases) {
        const result = getCardTimerEndTime(testCase.card);
        const isEqual = (result && testCase.expected) ?
            result.getTime() === testCase.expected.getTime() :
            result === testCase.expected;

        if (isEqual) {
            log(`  ✅ ${testCase.name}: ${result ? result.toISOString() : 'null'}`, 'green');
            passed++;
        } else {
            log(`  ❌ ${testCase.name}: 예상 ${testCase.expected}, 실제 ${result}`, 'red');
        }
    }

    log(`\n결과: ${passed}/${testCases.length} 통과`, passed === testCases.length ? 'green' : 'red');
    return passed === testCases.length;
}

/**
 * 테스트 3: 1시간 이내 차이 검증
 */
function testTimerDifferenceValidation() {
    log('\n========================================', 'bright');
    log('테스트 3: 1시간 이내 차이 검증', 'cyan');
    log('========================================', 'bright');

    const now = new Date();

    const testCases = [
        {
            name: '30분 차이 (동일화 가능)',
            cards: [
                { waitingUntil: new Date(now.getTime() + 60 * 60 * 1000) }, // +60분
                { waitingUntil: new Date(now.getTime() + 90 * 60 * 1000) }  // +90분 (30분 차이)
            ],
            expected: true
        },
        {
            name: '정확히 1시간 차이 (경계값)',
            cards: [
                { waitingUntil: new Date(now.getTime() + 60 * 60 * 1000) },  // +60분
                { waitingUntil: new Date(now.getTime() + 120 * 60 * 1000) }  // +120분 (60분 차이)
            ],
            expected: true
        },
        {
            name: '1시간 1분 차이 (동일화 불가)',
            cards: [
                { waitingUntil: new Date(now.getTime() + 60 * 60 * 1000) },  // +60분
                { waitingUntil: new Date(now.getTime() + 121 * 60 * 1000) }  // +121분 (61분 차이)
            ],
            expected: false
        },
        {
            name: '2시간 차이 (동일화 불가)',
            cards: [
                { waitingUntil: new Date(now.getTime() + 60 * 60 * 1000) },  // +60분
                { waitingUntil: new Date(now.getTime() + 180 * 60 * 1000) }  // +180분 (120분 차이)
            ],
            expected: false
        },
        {
            name: '카드 1개 (항상 동일화 가능)',
            cards: [
                { waitingUntil: new Date(now.getTime() + 60 * 60 * 1000) }
            ],
            expected: true
        },
        {
            name: '카드 없음 (항상 동일화 가능)',
            cards: [],
            expected: true
        }
    ];

    let passed = 0;
    for (const testCase of testCases) {
        const result = isTimerDifferenceWithinOneHour(testCase.cards);
        if (result === testCase.expected) {
            log(`  ✅ ${testCase.name}: ${result}`, 'green');
            passed++;
        } else {
            log(`  ❌ ${testCase.name}: 예상 ${testCase.expected}, 실제 ${result}`, 'red');
        }
    }

    log(`\n결과: ${passed}/${testCases.length} 통과`, passed === testCases.length ? 'green' : 'red');
    return passed === testCases.length;
}

/**
 * 테스트 4: 복합 시나리오 테스트
 */
function testComplexScenarios() {
    log('\n========================================', 'bright');
    log('테스트 4: 복합 시나리오', 'cyan');
    log('========================================', 'bright');

    const now = new Date();

    // 시나리오 1: 같은 하위 폴더, 같은 stage, 같은 상태, 45분 차이
    log('\n📋 시나리오 1: 동일화 가능한 경우', 'blue');
    const scenario1Cards = [
        {
            stage: 2,
            waitingUntil: new Date(now.getTime() + 60 * 60 * 1000),
            isFromWrongAnswer: false,
            isOverdue: false
        },
        {
            stage: 2,
            waitingUntil: new Date(now.getTime() + 75 * 60 * 1000),
            isFromWrongAnswer: false,
            isOverdue: false
        },
        {
            stage: 2,
            waitingUntil: new Date(now.getTime() + 90 * 60 * 1000),
            isFromWrongAnswer: false,
            isOverdue: false
        },
        {
            stage: 2,
            waitingUntil: new Date(now.getTime() + 105 * 60 * 1000),
            isFromWrongAnswer: false,
            isOverdue: false
        }
    ];

    // 모든 카드가 같은 상태인지 확인
    const states1 = scenario1Cards.map(card => getCardState(card));
    const allSameState1 = states1.every(state => state === states1[0]);
    log(`  같은 상태: ${allSameState1} (모두 ${states1[0]})`, allSameState1 ? 'green' : 'red');

    // 1시간 이내 차이인지 확인
    const within1Hour1 = isTimerDifferenceWithinOneHour(scenario1Cards);
    log(`  1시간 이내 차이: ${within1Hour1} (45분 차이)`, within1Hour1 ? 'green' : 'red');

    // 시나리오 2: 같은 하위 폴더, 같은 stage, 다른 상태
    log('\n📋 시나리오 2: 다른 상태로 인한 동일화 불가', 'blue');
    const scenario2Cards = [
        {
            stage: 2,
            waitingUntil: new Date(now.getTime() + 60 * 60 * 1000),
            isFromWrongAnswer: false,  // 정답 대기
            isOverdue: false
        },
        {
            stage: 2,
            waitingUntil: new Date(now.getTime() + 75 * 60 * 1000),
            isFromWrongAnswer: true,   // 오답 대기
            isOverdue: false
        }
    ];

    const states2 = scenario2Cards.map(card => getCardState(card));
    const allSameState2 = states2.every(state => state === states2[0]);
    log(`  같은 상태: ${allSameState2} (${states2[0]} vs ${states2[1]})`, allSameState2 ? 'green' : 'red');

    // 시나리오 3: 1시간 초과 차이
    log('\n📋 시나리오 3: 1시간 초과 차이로 인한 동일화 불가', 'blue');
    const scenario3Cards = [
        {
            stage: 3,
            waitingUntil: new Date(now.getTime() + 60 * 60 * 1000),
            isFromWrongAnswer: false,
            isOverdue: false
        },
        {
            stage: 3,
            waitingUntil: new Date(now.getTime() + 150 * 60 * 1000), // 90분 차이
            isFromWrongAnswer: false,
            isOverdue: false
        }
    ];

    const states3 = scenario3Cards.map(card => getCardState(card));
    const allSameState3 = states3.every(state => state === states3[0]);
    const within1Hour3 = isTimerDifferenceWithinOneHour(scenario3Cards);
    log(`  같은 상태: ${allSameState3} (모두 ${states3[0]})`, allSameState3 ? 'green' : 'red');
    log(`  1시간 이내 차이: ${within1Hour3} (90분 차이)`, within1Hour3 ? 'green' : 'red');

    const scenario1Pass = allSameState1 && within1Hour1;
    const scenario2Pass = !allSameState2;
    const scenario3Pass = allSameState3 && !within1Hour3;

    log(`\n시나리오 결과:`, 'yellow');
    log(`  시나리오 1 (동일화 가능): ${scenario1Pass ? '✅' : '❌'}`, scenario1Pass ? 'green' : 'red');
    log(`  시나리오 2 (다른 상태): ${scenario2Pass ? '✅' : '❌'}`, scenario2Pass ? 'green' : 'red');
    log(`  시나리오 3 (1시간 초과): ${scenario3Pass ? '✅' : '❌'}`, scenario3Pass ? 'green' : 'red');

    return scenario1Pass && scenario2Pass && scenario3Pass;
}

/**
 * 모든 단위 테스트 실행
 */
function runAllUnitTests() {
    log('\n' + '='.repeat(50), 'bright');
    log('타이머 동일화 핵심 로직 단위 테스트', 'magenta');
    log('='.repeat(50), 'bright');

    const startTime = Date.now();

    const results = [
        testCardStateClassification(),
        testCardTimerEndTime(),
        testTimerDifferenceValidation(),
        testComplexScenarios()
    ];

    const passed = results.filter(r => r).length;
    const total = results.length;

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    log('\n' + '='.repeat(50), 'bright');
    log(`단위 테스트 완료: ${passed}/${total} 통과 (${duration}초)`, passed === total ? 'green' : 'red');
    log('='.repeat(50), 'bright');

    if (passed === total) {
        log('\n🎉 모든 핵심 로직이 정상 작동합니다!', 'green');
        log('\n핵심 검증 완료:', 'cyan');
        log('✅ 카드 상태 분류가 정확함', 'green');
        log('✅ 타이머 종료 시각 계산이 정확함', 'green');
        log('✅ 1시간 이내 차이 판정이 정확함', 'green');
        log('✅ 복합 시나리오 처리가 정확함', 'green');
        log('\n타이머 동일화 기능이 안전하게 구현되었습니다! 🚀', 'bright');
    } else {
        log('\n⚠️  일부 테스트가 실패했습니다. 코드를 검토해주세요.', 'red');
    }

    return passed === total;
}

// 테스트 실행
if (require.main === module) {
    runAllUnitTests();
}

module.exports = {
    runAllUnitTests,
    testCardStateClassification,
    testCardTimerEndTime,
    testTimerDifferenceValidation,
    testComplexScenarios
};