// test/srsLogicTest.js
// SRS 로직 단위 테스트 (데이터베이스 없이 로직만 검증)

const { 
  computeWaitingUntil, 
  computeWrongAnswerWaitingUntil,
  computeOverdueDeadline,
  STAGE_DELAYS,
  delayDaysFor
} = require('../services/srsSchedule');

// 테스트 결과를 저장할 배열
const testResults = [];

// 테스트 헬퍼 함수
function test(name, testFn) {
  try {
    console.log(`\n🧪 Testing: ${name}`);
    const result = testFn();
    if (result.passed) {
      console.log(`✅ PASSED`);
      testResults.push({ name, passed: true, ...result });
    } else {
      console.log(`❌ FAILED: ${result.message}`);
      console.log(`   Details:`, result.details);
      testResults.push({ name, passed: false, ...result });
    }
  } catch (error) {
    console.log(`💥 ERROR: ${error.message}`);
    testResults.push({ name, passed: false, error: error.message });
  }
}

// 시간 계산 헬퍼
function hoursFrom(baseDate, targetDate) {
  return (targetDate - baseDate) / (1000 * 60 * 60);
}

function daysFrom(baseDate, targetDate) {
  return hoursFrom(baseDate, targetDate) / 24;
}

console.log('🚀 SRS Logic Unit Tests Starting...\n');
console.log('📋 Testing Configuration:');
console.log('Stage Delays:', STAGE_DELAYS, 'days');
console.log('Expected Waiting Periods: [48, 144, 312, 696, 1416, 2856] hours');

// 테스트 1: Stage별 대기 시간 계산
test('Stage Waiting Period Calculations', () => {
  const baseTime = new Date('2025-01-01T12:00:00Z');
  const expectedWaitingHours = [
    48,   // Stage 1: 3일 - 1일 = 2일 = 48시간
    144,  // Stage 2: 7일 - 1일 = 6일 = 144시간
    312,  // Stage 3: 14일 - 1일 = 13일 = 312시간
    696,  // Stage 4: 30일 - 1일 = 29일 = 696시간
    1416, // Stage 5: 60일 - 1일 = 59일 = 1416시간
    2856  // Stage 6: 120일 - 1일 = 119일 = 2856시간
  ];
  
  let allCorrect = true;
  const details = [];
  
  for (let stage = 1; stage <= 6; stage++) {
    const waitingUntil = computeWaitingUntil(baseTime, stage);
    const actualHours = hoursFrom(baseTime, waitingUntil);
    const expectedHours = expectedWaitingHours[stage - 1];
    const isCorrect = Math.abs(actualHours - expectedHours) < 1;
    
    details.push({
      stage,
      expectedHours,
      actualHours,
      correct: isCorrect,
      reviewDays: STAGE_DELAYS[stage - 1]
    });
    
    console.log(`   Stage ${stage}: ${actualHours}h (expected ${expectedHours}h) - ${isCorrect ? '✅' : '❌'}`);
    
    if (!isCorrect) allCorrect = false;
  }
  
  return {
    passed: allCorrect,
    message: allCorrect ? 'All stage waiting periods correct' : 'Some stage waiting periods incorrect',
    details
  };
});

// 테스트 2: 오답 단어 24시간 대기
test('Wrong Answer 24-hour Waiting', () => {
  const baseTime = new Date('2025-01-01T12:00:00Z');
  const waitingUntil = computeWrongAnswerWaitingUntil(baseTime);
  const actualHours = hoursFrom(baseTime, waitingUntil);
  
  const isCorrect = Math.abs(actualHours - 24) < 0.1;
  
  console.log(`   Expected: 24h, Actual: ${actualHours}h`);
  
  return {
    passed: isCorrect,
    message: isCorrect ? 'Wrong answer waiting period correct' : 'Wrong answer waiting period incorrect',
    details: { expectedHours: 24, actualHours }
  };
});

// 테스트 3: Overdue 데드라인 24시간
test('Overdue Deadline 24-hour Period', () => {
  const overdueStart = new Date('2025-01-01T12:00:00Z');
  const deadline = computeOverdueDeadline(overdueStart);
  const actualHours = hoursFrom(overdueStart, deadline);
  
  const isCorrect = Math.abs(actualHours - 24) < 0.1;
  
  console.log(`   Expected: 24h, Actual: ${actualHours}h`);
  
  return {
    passed: isCorrect,
    message: isCorrect ? 'Overdue deadline correct' : 'Overdue deadline incorrect',
    details: { expectedHours: 24, actualHours }
  };
});

// 테스트 4: 망각곡선 총 시간 검증 (대기 + overdue = 원래 망각곡선)
test('Total Forgetting Curve Time Verification', () => {
  const baseTime = new Date('2025-01-01T12:00:00Z');
  let allCorrect = true;
  const details = [];
  
  for (let stage = 1; stage <= 6; stage++) {
    const expectedTotalDays = STAGE_DELAYS[stage - 1];
    const expectedTotalHours = expectedTotalDays * 24;
    
    // 대기 시간 + overdue 시간 = 총 망각곡선 시간
    const waitingUntil = computeWaitingUntil(baseTime, stage);
    const waitingHours = hoursFrom(baseTime, waitingUntil);
    const overdueHours = 24; // 항상 24시간
    const totalHours = waitingHours + overdueHours;
    
    const isCorrect = Math.abs(totalHours - expectedTotalHours) < 1;
    
    details.push({
      stage,
      expectedTotalHours,
      waitingHours,
      overdueHours,
      actualTotalHours: totalHours,
      correct: isCorrect
    });
    
    console.log(`   Stage ${stage}: ${waitingHours}h + ${overdueHours}h = ${totalHours}h (expected ${expectedTotalHours}h) - ${isCorrect ? '✅' : '❌'}`);
    
    if (!isCorrect) allCorrect = false;
  }
  
  return {
    passed: allCorrect,
    message: allCorrect ? 'All forgetting curve totals correct' : 'Some forgetting curve totals incorrect',
    details
  };
});

// 테스트 5: Stage Delay 함수 검증
test('Stage Delay Function', () => {
  let allCorrect = true;
  const details = [];
  
  // Stage 0: 0일
  const stage0Days = delayDaysFor(0);
  const stage0Correct = stage0Days === 0;
  details.push({ stage: 0, expected: 0, actual: stage0Days, correct: stage0Correct });
  console.log(`   Stage 0: ${stage0Days} days (expected 0) - ${stage0Correct ? '✅' : '❌'}`);
  if (!stage0Correct) allCorrect = false;
  
  // Stage 1-6: STAGE_DELAYS 배열 값들
  for (let stage = 1; stage <= 6; stage++) {
    const actualDays = delayDaysFor(stage);
    const expectedDays = STAGE_DELAYS[stage - 1];
    const isCorrect = actualDays === expectedDays;
    
    details.push({ stage, expected: expectedDays, actual: actualDays, correct: isCorrect });
    console.log(`   Stage ${stage}: ${actualDays} days (expected ${expectedDays}) - ${isCorrect ? '✅' : '❌'}`);
    
    if (!isCorrect) allCorrect = false;
  }
  
  // Stage 7+ (최대값 제한)
  const stage7Days = delayDaysFor(7);
  const stage7Expected = STAGE_DELAYS[STAGE_DELAYS.length - 1]; // 마지막 값 (120일)
  const stage7Correct = stage7Days === stage7Expected;
  details.push({ stage: 7, expected: stage7Expected, actual: stage7Days, correct: stage7Correct });
  console.log(`   Stage 7+: ${stage7Days} days (expected ${stage7Expected}, capped) - ${stage7Correct ? '✅' : '❌'}`);
  if (!stage7Correct) allCorrect = false;
  
  return {
    passed: allCorrect,
    message: allCorrect ? 'All stage delays correct' : 'Some stage delays incorrect',
    details
  };
});

// 테스트 6: 실제 날짜로 검증 (Stage 1, 2, 3 샘플)
test('Real Date Examples', () => {
  const startDate = new Date('2025-08-12T09:00:00Z');
  const examples = [];
  
  // Stage 1 (3일 복습)
  const stage1Wait = computeWaitingUntil(startDate, 1);
  const stage1Overdue = computeOverdueDeadline(stage1Wait);
  examples.push({
    stage: 1,
    start: startDate.toISOString(),
    waitingEnd: stage1Wait.toISOString(),
    overdueEnd: stage1Overdue.toISOString(),
    totalDays: daysFrom(startDate, stage1Overdue)
  });
  
  // Stage 2 (7일 복습)  
  const stage2Wait = computeWaitingUntil(startDate, 2);
  const stage2Overdue = computeOverdueDeadline(stage2Wait);
  examples.push({
    stage: 2,
    start: startDate.toISOString(),
    waitingEnd: stage2Wait.toISOString(),
    overdueEnd: stage2Overdue.toISOString(),
    totalDays: daysFrom(startDate, stage2Overdue)
  });
  
  // Stage 6 (120일 복습)
  const stage6Wait = computeWaitingUntil(startDate, 6);
  const stage6Overdue = computeOverdueDeadline(stage6Wait);
  examples.push({
    stage: 6,
    start: startDate.toISOString(),
    waitingEnd: stage6Wait.toISOString(),
    overdueEnd: stage6Overdue.toISOString(),
    totalDays: daysFrom(startDate, stage6Overdue)
  });
  
  examples.forEach(ex => {
    console.log(`   Stage ${ex.stage}:`);
    console.log(`     Start: ${ex.start}`);
    console.log(`     Waiting ends: ${ex.waitingEnd}`);
    console.log(`     Overdue ends: ${ex.overdueEnd}`);
    console.log(`     Total: ${ex.totalDays.toFixed(1)} days`);
  });
  
  return {
    passed: true,
    message: 'Date examples calculated successfully',
    details: examples
  };
});

// 모든 테스트 실행 후 결과 요약
console.log('\n📊 TEST RESULTS SUMMARY');
console.log('='.repeat(60));

const passedTests = testResults.filter(r => r.passed).length;
const totalTests = testResults.length;
const successRate = (passedTests / totalTests * 100);

console.log(`Total Tests: ${totalTests}`);
console.log(`Passed: ${passedTests}`);
console.log(`Failed: ${totalTests - passedTests}`);
console.log(`Success Rate: ${successRate.toFixed(1)}%`);

if (passedTests === totalTests) {
  console.log('\n🎉 ALL TESTS PASSED! Your SRS timing logic is mathematically correct! 🎉');
  console.log('\n📈 Your SRS System Verification:');
  console.log('✅ Stage progression timing: CORRECT');
  console.log('✅ Wrong answer handling: CORRECT');
  console.log('✅ Overdue deadline management: CORRECT');
  console.log('✅ Forgetting curve preservation: CORRECT');
  console.log('✅ Mathematical accuracy: CORRECT');
} else {
  console.log('\n⚠️ Some tests failed. Please review the logic.');
  
  // 실패한 테스트 목록
  const failedTests = testResults.filter(r => !r.passed);
  console.log('\n❌ Failed Tests:');
  failedTests.forEach(test => {
    console.log(`   - ${test.name}: ${test.message || test.error}`);
  });
}

console.log('\n🔍 Logic Verification Complete!');
console.log('\nNext Steps:');
console.log('1. ✅ Run this test → Verify mathematical correctness');
console.log('2. 🗄️ Test with database → Verify data persistence');
console.log('3. 🌐 Test with API → Verify end-to-end flow');
console.log('4. 👥 Test with real users → Verify user experience');

// Export for potential use
module.exports = { testResults };