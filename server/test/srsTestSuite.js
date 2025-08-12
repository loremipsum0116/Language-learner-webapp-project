// test/srsTestSuite.js
// SRS 로직 종합 테스트 시스템

const { prisma } = require('../lib/prismaClient');
const { markAnswer, getSrsStatus } = require('../services/srsService');
const { 
  computeWaitingUntil, 
  computeWrongAnswerWaitingUntil,
  computeOverdueDeadline,
  STAGE_DELAYS 
} = require('../services/srsSchedule');
const { manageOverdueCards, hasOverdueCards } = require('../services/srsJobs');

// 테스트용 시간 조작 클래스
class MockTimeManager {
  constructor() {
    this.currentTime = new Date();
    this.originalDateNow = Date.now;
    this.originalDateConstructor = Date;
  }

  // 현재 시간 설정
  setTime(time) {
    this.currentTime = new Date(time);
    console.log(`⏰ Mock time set to: ${this.currentTime.toISOString()}`);
  }

  // 시간 이동 (시간 단위)
  addHours(hours) {
    this.currentTime = new Date(this.currentTime.getTime() + hours * 60 * 60 * 1000);
    console.log(`⏰ Time advanced by ${hours} hours to: ${this.currentTime.toISOString()}`);
  }

  // 시간 이동 (일 단위)
  addDays(days) {
    this.addHours(days * 24);
  }

  // Mock 활성화
  activate() {
    const mockTime = this.currentTime;
    global.Date = class extends Date {
      constructor(...args) {
        if (args.length === 0) {
          super(mockTime);
        } else {
          super(...args);
        }
      }
      static now() {
        return mockTime.getTime();
      }
    };
    console.log('🎭 Mock time system activated');
  }

  // Mock 비활성화
  deactivate() {
    global.Date = this.originalDateConstructor;
    console.log('🎭 Mock time system deactivated');
  }

  getCurrentTime() {
    return new Date(this.currentTime);
  }
}

// 테스트 케이스 클래스
class SRSTestSuite {
  constructor() {
    this.mockTime = new MockTimeManager();
    this.testResults = [];
    this.testUserId = null;
    this.testCardId = null;
  }

  async setup() {
    console.log('🚀 Setting up SRS Test Suite...');
    
    // Mock 시간 시스템 활성화
    this.mockTime.activate();
    
    // 테스트용 사용자 생성
    const testUser = await prisma.user.upsert({
      where: { email: 'test@srs.com' },
      update: {},
      create: {
        email: 'test@srs.com',
        passwordHash: 'test',
        role: 'USER'
      }
    });
    this.testUserId = testUser.id;
    
    // 테스트용 단어 생성
    const testVocab = await prisma.vocab.upsert({
      where: { lemma: 'test_word' },
      update: {},
      create: {
        lemma: 'test_word',
        pos: 'noun',
        levelCEFR: 'A1',
        source: 'test'
      }
    });
    
    // 테스트용 SRS 카드 생성
    const testCard = await prisma.sRSCard.upsert({
      where: {
        userId_itemType_itemId: {
          userId: this.testUserId,
          itemType: 'vocab',
          itemId: testVocab.id
        }
      },
      update: {
        stage: 0,
        isOverdue: false,
        waitingUntil: null,
        overdueDeadline: null,
        isFromWrongAnswer: false,
        wrongStreakCount: 0
      },
      create: {
        userId: this.testUserId,
        itemType: 'vocab',
        itemId: testVocab.id,
        stage: 0
      }
    });
    this.testCardId = testCard.id;
    
    console.log(`✅ Test setup complete - User: ${this.testUserId}, Card: ${this.testCardId}`);
  }

  async cleanup() {
    console.log('🧹 Cleaning up test data...');
    
    // 테스트 데이터 정리
    await prisma.sRSCard.deleteMany({
      where: { userId: this.testUserId }
    });
    
    await prisma.user.delete({
      where: { id: this.testUserId }
    });
    
    await prisma.vocab.delete({
      where: { lemma: 'test_word' }
    });
    
    // Mock 시간 시스템 비활성화
    this.mockTime.deactivate();
    
    console.log('✅ Cleanup complete');
  }

  async getCardStatus() {
    const card = await prisma.sRSCard.findUnique({
      where: { id: this.testCardId },
      select: {
        id: true,
        stage: true,
        isOverdue: true,
        waitingUntil: true,
        overdueDeadline: true,
        isFromWrongAnswer: true,
        wrongStreakCount: true,
        correctTotal: true,
        wrongTotal: true
      }
    });
    return card;
  }

  async logCardStatus(message) {
    const card = await this.getCardStatus();
    console.log(`📊 ${message}:`);
    console.log(`   Stage: ${card.stage}`);
    console.log(`   IsOverdue: ${card.isOverdue}`);
    console.log(`   WaitingUntil: ${card.waitingUntil?.toISOString() || 'null'}`);
    console.log(`   OverdueDeadline: ${card.overdueDeadline?.toISOString() || 'null'}`);
    console.log(`   IsFromWrongAnswer: ${card.isFromWrongAnswer}`);
    console.log(`   WrongStreak: ${card.wrongStreakCount}`);
    console.log(`   Correct/Wrong: ${card.correctTotal}/${card.wrongTotal}`);
    return card;
  }

  // 테스트 1: 정답 처리 후 대기 시간 검증
  async testCorrectAnswerWaitingPeriod() {
    console.log('\n🧪 Test 1: Correct Answer Waiting Period');
    
    // Stage 0에서 정답
    await this.logCardStatus('Initial state');
    
    // overdue 상태로 만들기
    await prisma.sRSCard.update({
      where: { id: this.testCardId },
      data: {
        isOverdue: true,
        overdueDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    });
    
    const result = await markAnswer(this.testUserId, {
      cardId: this.testCardId,
      correct: true
    });
    
    const card = await this.logCardStatus('After correct answer');
    
    // 검증: Stage 1, 48시간 대기
    const expectedWaitingHours = (STAGE_DELAYS[0] - 1) * 24; // 3-1 = 2일 = 48시간
    const actualWaitingHours = (new Date(card.waitingUntil) - new Date()) / (1000 * 60 * 60);
    
    console.log(`✅ Expected waiting: ${expectedWaitingHours}h, Actual: ${actualWaitingHours.toFixed(1)}h`);
    
    return {
      test: 'testCorrectAnswerWaitingPeriod',
      passed: Math.abs(actualWaitingHours - expectedWaitingHours) < 1,
      details: { expectedWaitingHours, actualWaitingHours: actualWaitingHours.toFixed(1) }
    };
  }

  // 테스트 2: 오답 처리 후 24시간 대기 검증
  async testWrongAnswerWaitingPeriod() {
    console.log('\n🧪 Test 2: Wrong Answer Waiting Period');
    
    // 카드를 overdue 상태로 설정
    await prisma.sRSCard.update({
      where: { id: this.testCardId },
      data: {
        isOverdue: true,
        overdueDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
        stage: 2 // Stage 2에서 시작
      }
    });
    
    await this.logCardStatus('Before wrong answer');
    
    const result = await markAnswer(this.testUserId, {
      cardId: this.testCardId,
      correct: false
    });
    
    const card = await this.logCardStatus('After wrong answer');
    
    // 검증: Stage 0, 24시간 대기
    const expectedWaitingHours = 24;
    const actualWaitingHours = (new Date(card.waitingUntil) - new Date()) / (1000 * 60 * 60);
    
    console.log(`✅ Expected: Stage 0, 24h waiting. Actual: Stage ${card.stage}, ${actualWaitingHours.toFixed(1)}h`);
    
    return {
      test: 'testWrongAnswerWaitingPeriod',
      passed: card.stage === 0 && Math.abs(actualWaitingHours - 24) < 1,
      details: { expectedStage: 0, actualStage: card.stage, expectedWaitingHours, actualWaitingHours: actualWaitingHours.toFixed(1) }
    };
  }

  // 테스트 3: 대기 중 복습 시도 (상태 변화 없음)
  async testWaitingPeriodNoChange() {
    console.log('\n🧪 Test 3: No Change During Waiting Period');
    
    // 카드를 대기 상태로 설정
    const waitingUntil = new Date(Date.now() + 10 * 60 * 60 * 1000); // 10시간 후
    await prisma.sRSCard.update({
      where: { id: this.testCardId },
      data: {
        stage: 1,
        isOverdue: false,
        waitingUntil: waitingUntil,
        overdueDeadline: null
      }
    });
    
    const beforeCard = await this.logCardStatus('Before attempting review during waiting');
    
    const result = await markAnswer(this.testUserId, {
      cardId: this.testCardId,
      correct: true
    });
    
    const afterCard = await this.logCardStatus('After attempting review during waiting');
    
    // 검증: 상태 변화 없음
    const noChange = beforeCard.stage === afterCard.stage && 
                    beforeCard.waitingUntil?.getTime() === afterCard.waitingUntil?.getTime();
    
    console.log(`✅ Result status: ${result.status}`);
    console.log(`✅ No state change: ${noChange}`);
    
    return {
      test: 'testWaitingPeriodNoChange',
      passed: result.status === 'waiting' && noChange,
      details: { resultStatus: result.status, stateChanged: !noChange }
    };
  }

  // 테스트 4: Overdue 타이머 및 Stage 0 리셋
  async testOverdueToStage0Reset() {
    console.log('\n🧪 Test 4: Overdue → Stage 0 Reset');
    
    // 카드를 대기 상태로 설정 (곧 overdue가 될)
    const now = new Date();
    await prisma.sRSCard.update({
      where: { id: this.testCardId },
      data: {
        stage: 3,
        isOverdue: false,
        waitingUntil: new Date(now.getTime() + 1000), // 1초 후 대기 종료
        overdueDeadline: null
      }
    });
    
    await this.logCardStatus('Initial waiting state');
    
    // 2초 후로 시간 이동 (대기 시간 종료)
    this.mockTime.addHours(0.001); // 매우 짧은 시간 이동
    
    // Overdue 관리 실행
    await manageOverdueCards();
    
    const overdueCard = await this.logCardStatus('After becoming overdue');
    
    // 25시간 후로 시간 이동 (overdue 데드라인 초과)
    this.mockTime.addHours(25);
    
    // Overdue 관리 실행
    await manageOverdueCards();
    
    const resetCard = await this.logCardStatus('After overdue deadline passed');
    
    // 검증
    const correctTransition = overdueCard.isOverdue && 
                             resetCard.stage === 0 && 
                             !resetCard.isOverdue &&
                             resetCard.isFromWrongAnswer;
    
    console.log(`✅ Correct overdue → reset transition: ${correctTransition}`);
    
    return {
      test: 'testOverdueToStage0Reset',
      passed: correctTransition,
      details: {
        becameOverdue: overdueCard.isOverdue,
        resetToStage0: resetCard.stage === 0,
        resetOverdueFlag: !resetCard.isOverdue,
        markedAsWrongAnswer: resetCard.isFromWrongAnswer
      }
    };
  }

  // 테스트 5: 전체 Stage 진행 검증 (1→6까지)
  async testFullStageProgression() {
    console.log('\n🧪 Test 5: Full Stage Progression (0→6)');
    
    const stageResults = [];
    
    // Stage 0부터 6까지 진행
    for (let targetStage = 1; targetStage <= 6; targetStage++) {
      console.log(`\n--- Testing progression to Stage ${targetStage} ---`);
      
      // 카드를 overdue 상태로 설정
      await prisma.sRSCard.update({
        where: { id: this.testCardId },
        data: {
          isOverdue: true,
          overdueDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      });
      
      const result = await markAnswer(this.testUserId, {
        cardId: this.testCardId,
        correct: true
      });
      
      const card = await this.logCardStatus(`After advancing to stage ${targetStage}`);
      
      // 대기 시간 검증
      const expectedDelayDays = STAGE_DELAYS[targetStage - 1];
      const expectedWaitingHours = (expectedDelayDays - 1) * 24;
      const actualWaitingHours = (new Date(card.waitingUntil) - new Date()) / (1000 * 60 * 60);
      
      const isCorrect = card.stage === targetStage && 
                       Math.abs(actualWaitingHours - expectedWaitingHours) < 1;
      
      stageResults.push({
        targetStage,
        actualStage: card.stage,
        expectedWaitingHours,
        actualWaitingHours: actualWaitingHours.toFixed(1),
        correct: isCorrect
      });
      
      console.log(`✅ Stage ${targetStage}: Expected ${expectedWaitingHours}h wait, Got ${actualWaitingHours.toFixed(1)}h`);
    }
    
    const allCorrect = stageResults.every(r => r.correct);
    console.log(`\n✅ All stage progressions correct: ${allCorrect}`);
    
    return {
      test: 'testFullStageProgression',
      passed: allCorrect,
      details: stageResults
    };
  }

  // 테스트 6: 알림 시스템 검증
  async testNotificationSystem() {
    console.log('\n🧪 Test 6: Notification System');
    
    // 카드를 overdue 상태로 설정
    await prisma.sRSCard.update({
      where: { id: this.testCardId },
      data: {
        isOverdue: true,
        overdueDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    });
    
    // 사용자 overdue 상태 확인
    const hasOverdueBefore = await hasOverdueCards(this.testUserId);
    console.log(`User has overdue cards: ${hasOverdueBefore}`);
    
    // 복습 완료
    await markAnswer(this.testUserId, {
      cardId: this.testCardId,
      correct: true
    });
    
    // 사용자 overdue 상태 재확인
    const hasOverdueAfter = await hasOverdueCards(this.testUserId);
    console.log(`User has overdue cards after review: ${hasOverdueAfter}`);
    
    // 사용자 테이블 확인
    const user = await prisma.user.findUnique({
      where: { id: this.testUserId },
      select: { hasOverdueCards: true, lastOverdueCheck: true }
    });
    
    console.log(`User table hasOverdueCards: ${user.hasOverdueCards}`);
    
    return {
      test: 'testNotificationSystem',
      passed: hasOverdueBefore && !hasOverdueAfter && !user.hasOverdueCards,
      details: {
        hasOverdueBefore,
        hasOverdueAfter,
        userTableUpdated: !user.hasOverdueCards
      }
    };
  }

  // 모든 테스트 실행
  async runAllTests() {
    console.log('🚀 Starting SRS Logic Comprehensive Test Suite\n');
    
    try {
      await this.setup();
      
      // 모든 테스트 실행
      const tests = [
        () => this.testCorrectAnswerWaitingPeriod(),
        () => this.testWrongAnswerWaitingPeriod(),
        () => this.testWaitingPeriodNoChange(),
        () => this.testOverdueToStage0Reset(),
        () => this.testFullStageProgression(),
        () => this.testNotificationSystem()
      ];
      
      for (const test of tests) {
        try {
          const result = await test();
          this.testResults.push(result);
          
          if (result.passed) {
            console.log(`✅ ${result.test} PASSED`);
          } else {
            console.log(`❌ ${result.test} FAILED`);
            console.log(`   Details:`, JSON.stringify(result.details, null, 2));
          }
        } catch (error) {
          console.error(`💥 ${test.name} ERROR:`, error);
          this.testResults.push({
            test: test.name,
            passed: false,
            error: error.message
          });
        }
      }
      
      // 결과 요약
      console.log('\n📊 TEST RESULTS SUMMARY');
      console.log('='.repeat(50));
      
      const passedTests = this.testResults.filter(r => r.passed).length;
      const totalTests = this.testResults.length;
      
      console.log(`Total Tests: ${totalTests}`);
      console.log(`Passed: ${passedTests}`);
      console.log(`Failed: ${totalTests - passedTests}`);
      console.log(`Success Rate: ${(passedTests / totalTests * 100).toFixed(1)}%`);
      
      if (passedTests === totalTests) {
        console.log('\n🎉 ALL TESTS PASSED! Your SRS logic is working correctly! 🎉');
      } else {
        console.log('\n⚠️  Some tests failed. Please check the details above.');
      }
      
      return this.testResults;
      
    } finally {
      await this.cleanup();
    }
  }
}

// 테스트 실행 함수
async function runSRSTests() {
  const testSuite = new SRSTestSuite();
  return await testSuite.runAllTests();
}

module.exports = { SRSTestSuite, runSRSTests };

// 직접 실행 시
if (require.main === module) {
  runSRSTests()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test suite failed:', error);
      process.exit(1);
    });
}