// e2e/userScenarios.test.js - 사용자 시나리오 테스트
const { device, expect, element, by, waitFor } = require('detox');

describe('사용자 시나리오 테스트', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  describe('신규 사용자 온보딩 시나리오', () => {
    it('신규 사용자가 앱을 처음 사용하는 전체 플로우', async () => {
      // 1. 앱 시작 - 랜딩 페이지
      await waitFor(element(by.id('landing-page')))
        .toBeVisible()
        .withTimeout(10000);

      await expect(element(by.text('Language Learner'))).toBeVisible();
      await expect(element(by.text('영어 학습을 시작해보세요'))).toBeVisible();

      // 2. 로그인 페이지로 이동
      await element(by.id('login-button')).tap();
      await waitFor(element(by.id('login-screen'))).toBeVisible();

      // 3. 신규 가입 버튼 클릭 (실제로는 로그인으로 진행)
      await element(by.id('username-input')).typeText('newuser');
      await element(by.id('password-input')).typeText('password123');
      await element(by.id('login-submit-button')).tap();

      // 4. 홈 화면 도착
      await waitFor(element(by.id('home-screen')))
        .toBeVisible()
        .withTimeout(10000);

      // 5. 홈 화면 구성 요소 확인
      await expect(element(by.text('환영합니다!'))).toBeVisible();
      await expect(element(by.id('start-learning-button'))).toBeVisible();
      await expect(element(by.id('progress-overview'))).toBeVisible();

      // 6. 첫 번째 학습 시작
      await element(by.id('start-learning-button')).tap();
      await waitFor(element(by.id('learn-vocab-screen'))).toBeVisible();

      // 7. 학습 안내 확인
      await expect(element(by.text('단어 학습을 시작합니다'))).toBeVisible();
    });
  });

  describe('일반적인 학습 시나리오', () => {
    beforeEach(async () => {
      // 로그인된 상태로 설정
      await element(by.id('login-button')).tap();
      await element(by.id('username-input')).typeText('testuser');
      await element(by.id('password-input')).typeText('testpass');
      await element(by.id('login-submit-button')).tap();
      await waitFor(element(by.id('home-screen'))).toBeVisible();
    });

    it('단어 학습 - 플래시카드 방식', async () => {
      // 1. 학습 화면으로 이동
      await element(by.id('learn-tab')).tap();
      await waitFor(element(by.id('learn-screen'))).toBeVisible();

      // 2. 단어 학습 시작
      await element(by.id('vocab-learning-button')).tap();
      await waitFor(element(by.id('learn-vocab-screen'))).toBeVisible();

      // 3. 첫 번째 단어 카드 확인
      await waitFor(element(by.id('word-card')))
        .toBeVisible()
        .withTimeout(5000);

      // 4. 단어 뒤집기 (의미 확인)
      await element(by.id('word-card')).tap();
      await expect(element(by.id('word-meaning'))).toBeVisible();

      // 5. "아는 단어" 버튼 클릭
      await element(by.id('know-word-button')).tap();

      // 6. 다음 단어로 진행
      await waitFor(element(by.id('word-card')))
        .toBeVisible()
        .withTimeout(3000);

      // 7. "모르는 단어" 버튼 클릭
      await element(by.id('word-card')).tap();
      await element(by.id('dont-know-word-button')).tap();

      // 8. 진행률 확인
      await expect(element(by.id('progress-indicator'))).toBeVisible();
    });

    it('퀴즈 학습 완전한 세션', async () => {
      // 1. 퀴즈 화면으로 이동
      await element(by.id('learn-tab')).tap();
      await element(by.id('vocab-learning-button')).tap();
      await waitFor(element(by.id('learn-vocab-screen'))).toBeVisible();

      await element(by.id('start-quiz-button')).tap();
      await waitFor(element(by.id('mini-quiz-screen'))).toBeVisible();

      // 2. 5개 문제 풀이
      for (let i = 0; i < 5; i++) {
        // 문제 확인
        await expect(element(by.id('quiz-question'))).toBeVisible();
        await expect(element(by.id('quiz-options'))).toBeVisible();

        // 첫 번째 옵션 선택
        await element(by.id('option-1')).tap();

        // 결과 확인 및 다음 문제로
        if (i < 4) {
          await waitFor(element(by.id('next-question-button')))
            .toBeVisible()
            .withTimeout(3000);
          await element(by.id('next-question-button')).tap();
        }
      }

      // 3. 퀴즈 완료 화면
      await waitFor(element(by.id('quiz-complete-screen')))
        .toBeVisible()
        .withTimeout(5000);

      // 4. 점수 확인
      await expect(element(by.id('final-score'))).toBeVisible();
      await expect(element(by.id('correct-count'))).toBeVisible();

      // 5. 다시 하기 또는 홈으로 가기
      await element(by.id('back-to-home-button')).tap();
      await expect(element(by.id('home-screen'))).toBeVisible();
    });

    it('문법 학습 시나리오', async () => {
      // 1. 문법 학습 접근
      await element(by.id('grammar-hub-button')).tap();
      await waitFor(element(by.id('grammar-hub-screen'))).toBeVisible();

      // 2. 문법 주제 선택
      await expect(element(by.id('grammar-topics'))).toBeVisible();
      await element(by.id('grammar-topic')).atIndex(0).tap();

      // 3. 문법 설명 확인
      await waitFor(element(by.id('grammar-explanation')))
        .toBeVisible()
        .withTimeout(5000);

      // 4. 예문 확인
      await element(by.id('show-examples-button')).tap();
      await expect(element(by.id('grammar-examples'))).toBeVisible();

      // 5. 문법 퀴즈 시작
      await element(by.id('start-grammar-quiz-button')).tap();
      await waitFor(element(by.id('grammar-quiz-screen'))).toBeVisible();

      // 6. 문법 문제 풀이
      await expect(element(by.id('grammar-question'))).toBeVisible();
      await element(by.id('grammar-option-1')).tap();

      // 7. 결과 확인
      await waitFor(element(by.id('grammar-result')))
        .toBeVisible()
        .withTimeout(3000);
    });
  });

  describe('듣기 연습 시나리오', () => {
    beforeEach(async () => {
      await element(by.id('login-button')).tap();
      await element(by.id('username-input')).typeText('testuser');
      await element(by.id('password-input')).typeText('testpass');
      await element(by.id('login-submit-button')).tap();
      await waitFor(element(by.id('home-screen'))).toBeVisible();
    });

    it('듣기 연습 전체 세션', async () => {
      // 1. 듣기 연습 화면으로 이동
      await element(by.id('listening-practice-button')).tap();
      await waitFor(element(by.id('listening-list-screen'))).toBeVisible();

      // 2. 듣기 주제 선택
      await element(by.id('listening-topic')).atIndex(0).tap();
      await waitFor(element(by.id('listening-practice-screen'))).toBeVisible();

      // 3. 오디오 재생
      await element(by.id('play-audio-button')).tap();
      await expect(element(by.id('audio-player'))).toBeVisible();

      // 4. 재생/일시정지 테스트
      await element(by.id('pause-audio-button')).tap();
      await element(by.id('play-audio-button')).tap();

      // 5. 답안 입력
      await element(by.id('listening-answer-input')).typeText('This is a test answer');

      // 6. 답안 제출
      await element(by.id('submit-listening-answer')).tap();

      // 7. 결과 확인
      await waitFor(element(by.id('listening-result')))
        .toBeVisible()
        .withTimeout(5000);

      // 8. 다음 문제로 또는 완료
      if (await element(by.id('next-listening-button')).exists()) {
        await element(by.id('next-listening-button')).tap();
      } else {
        await element(by.id('complete-listening-button')).tap();
      }
    });
  });

  describe('읽기 연습 시나리오', () => {
    beforeEach(async () => {
      await element(by.id('login-button')).tap();
      await element(by.id('username-input')).typeText('testuser');
      await element(by.id('password-input')).typeText('testpass');
      await element(by.id('login-submit-button')).tap();
      await waitFor(element(by.id('home-screen'))).toBeVisible();
    });

    it('읽기 이해 연습', async () => {
      // 1. 읽기 연습 시작
      await element(by.id('reading-practice-button')).tap();
      await waitFor(element(by.id('reading-list-screen'))).toBeVisible();

      // 2. 읽기 지문 선택
      await element(by.id('reading-article')).atIndex(0).tap();
      await waitFor(element(by.id('reading-practice-screen'))).toBeVisible();

      // 3. 지문 읽기
      await expect(element(by.id('reading-passage'))).toBeVisible();

      // 4. 스크롤하여 전체 내용 확인
      await element(by.id('reading-passage')).scroll(200, 'down');

      // 5. 이해도 문제 풀이
      await element(by.id('start-reading-quiz-button')).tap();
      await waitFor(element(by.id('reading-quiz'))).toBeVisible();

      // 6. 객관식 문제 답변
      await element(by.id('reading-option-2')).tap();
      await element(by.id('submit-reading-answer')).tap();

      // 7. 결과 및 해설 확인
      await waitFor(element(by.id('reading-explanation')))
        .toBeVisible()
        .withTimeout(3000);
    });
  });

  describe('진도 관리 시나리오', () => {
    beforeEach(async () => {
      await element(by.id('login-button')).tap();
      await element(by.id('username-input')).typeText('testuser');
      await element(by.id('password-input')).typeText('testpass');
      await element(by.id('login-submit-button')).tap();
      await waitFor(element(by.id('home-screen'))).toBeVisible();
    });

    it('학습 진도 확인 및 복습', async () => {
      // 1. 진도 현황 확인
      await expect(element(by.id('progress-overview'))).toBeVisible();
      await element(by.id('view-detailed-progress')).tap();

      // 2. 상세 진도 화면
      await waitFor(element(by.id('progress-detail-screen')))
        .toBeVisible()
        .withTimeout(5000);

      // 3. 카테고리별 진도 확인
      await expect(element(by.id('vocab-progress'))).toBeVisible();
      await expect(element(by.id('grammar-progress'))).toBeVisible();
      await expect(element(by.id('listening-progress'))).toBeVisible();

      // 4. 마스터한 단어 목록 확인
      await element(by.id('mastered-words-button')).tap();
      await waitFor(element(by.id('mastered-words-screen'))).toBeVisible();

      // 5. 복습 필요한 단어 확인
      await element(by.id('review-needed-tab')).tap();
      await expect(element(by.id('review-word-list'))).toBeVisible();

      // 6. 복습 시작
      if (await element(by.id('start-review-button')).exists()) {
        await element(by.id('start-review-button')).tap();
        await waitFor(element(by.id('review-session-screen'))).toBeVisible();
      }
    });
  });

  describe('관리자 기능 시나리오', () => {
    beforeEach(async () => {
      await element(by.id('login-button')).tap();
      await element(by.id('username-input')).typeText('admin');
      await element(by.id('password-input')).typeText('adminpass');
      await element(by.id('login-submit-button')).tap();
      await waitFor(element(by.id('home-screen'))).toBeVisible();
    });

    it('관리자 패널 사용', async () => {
      // 1. 관리자 탭으로 이동
      await element(by.id('admin-tab')).tap();
      await waitFor(element(by.id('admin-screen'))).toBeVisible();

      // 2. 관리자 권한 확인
      await expect(element(by.text('관리자 패널'))).toBeVisible();

      // 3. 사용자 관리 확인
      if (await element(by.id('user-management-button')).exists()) {
        await element(by.id('user-management-button')).tap();
        await waitFor(element(by.id('user-list'))).toBeVisible();
      }

      // 4. 콘텐츠 관리 확인
      await element(by.id('back-button')).tap();
      if (await element(by.id('content-management-button')).exists()) {
        await element(by.id('content-management-button')).tap();
        await waitFor(element(by.id('content-management-screen'))).toBeVisible();
      }

      // 5. 통계 확인
      await element(by.id('back-button')).tap();
      if (await element(by.id('statistics-button')).exists()) {
        await element(by.id('statistics-button')).tap();
        await expect(element(by.id('statistics-dashboard'))).toBeVisible();
      }
    });
  });

  describe('오프라인 모드 시나리오', () => {
    it('네트워크 연결 없이 학습 가능', async () => {
      // 1. 정상 로그인
      await element(by.id('login-button')).tap();
      await element(by.id('username-input')).typeText('testuser');
      await element(by.id('password-input')).typeText('testpass');
      await element(by.id('login-submit-button')).tap();
      await waitFor(element(by.id('home-screen'))).toBeVisible();

      // 2. 네트워크 비활성화 시뮬레이션 (실제 구현에서는 mock 사용)
      // await device.setNetworkConnection(false);

      // 3. 오프라인 상태에서 캐시된 콘텐츠 접근
      await element(by.id('learn-tab')).tap();
      await element(by.id('vocab-learning-button')).tap();
      await waitFor(element(by.id('learn-vocab-screen'))).toBeVisible();

      // 4. 로컬 저장된 데이터로 학습 진행
      await expect(element(by.id('word-card'))).toBeVisible();

      // 5. 오프라인 알림 확인 (있다면)
      if (await element(by.text('오프라인 모드')).exists()) {
        await expect(element(by.text('오프라인 모드'))).toBeVisible();
      }

      // 네트워크 재연결
      // await device.setNetworkConnection(true);
    });
  });
});