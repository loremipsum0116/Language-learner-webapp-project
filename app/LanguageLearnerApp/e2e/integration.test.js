// e2e/integration.test.js - 통합 테스트
const { device, expect, element, by, waitFor } = require('detox');

describe('통합 테스트 - 언어 학습 앱', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  describe('사용자 인증 플로우', () => {
    it('전체 로그인 프로세스가 정상 작동해야 함', async () => {
      // 1. 랜딩 페이지 확인
      await waitFor(element(by.id('landing-page')))
        .toBeVisible()
        .withTimeout(10000);

      // 2. 로그인 버튼 클릭
      await element(by.id('login-button')).tap();

      // 3. 로그인 화면 표시 확인
      await waitFor(element(by.id('login-screen')))
        .toBeVisible()
        .withTimeout(5000);

      // 4. 사용자명과 비밀번호 입력
      await element(by.id('username-input')).typeText('testuser');
      await element(by.id('password-input')).typeText('testpass');

      // 5. 로그인 버튼 클릭
      await element(by.id('login-submit-button')).tap();

      // 6. 홈 화면으로 이동 확인
      await waitFor(element(by.id('home-screen')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('잘못된 인증 정보로 로그인 실패를 처리해야 함', async () => {
      await element(by.id('login-button')).tap();
      await waitFor(element(by.id('login-screen'))).toBeVisible();

      await element(by.id('username-input')).typeText('wronguser');
      await element(by.id('password-input')).typeText('wrongpass');
      await element(by.id('login-submit-button')).tap();

      // 에러 메시지 확인
      await waitFor(element(by.text('로그인에 실패했습니다')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });

  describe('네비게이션 테스트', () => {
    beforeEach(async () => {
      // 로그인된 상태로 설정
      await element(by.id('login-button')).tap();
      await element(by.id('username-input')).typeText('testuser');
      await element(by.id('password-input')).typeText('testpass');
      await element(by.id('login-submit-button')).tap();
      await waitFor(element(by.id('home-screen'))).toBeVisible();
    });

    it('모든 탭 네비게이션이 정상 작동해야 함', async () => {
      // 홈 탭
      await element(by.id('home-tab')).tap();
      await expect(element(by.id('home-screen'))).toBeVisible();

      // 학습 탭
      await element(by.id('learn-tab')).tap();
      await expect(element(by.id('learn-screen'))).toBeVisible();

      // 관리자 탭
      await element(by.id('admin-tab')).tap();
      await expect(element(by.id('admin-screen'))).toBeVisible();

      // 뒤로 가기
      await element(by.id('back-button')).tap();
      await expect(element(by.id('home-screen'))).toBeVisible();
    });

    it('스택 네비게이션이 올바르게 작동해야 함', async () => {
      // 홈에서 학습 화면으로
      await element(by.id('start-learning-button')).tap();
      await expect(element(by.id('learn-vocab-screen'))).toBeVisible();

      // 단어 학습에서 퀴즈로
      await element(by.id('start-quiz-button')).tap();
      await expect(element(by.id('mini-quiz-screen'))).toBeVisible();

      // 퀴즈에서 뒤로 가기
      await element(by.id('back-button')).tap();
      await expect(element(by.id('learn-vocab-screen'))).toBeVisible();

      // 홈으로 뒤로 가기
      await element(by.id('back-button')).tap();
      await expect(element(by.id('home-screen'))).toBeVisible();
    });
  });

  describe('데이터 플로우 테스트', () => {
    beforeEach(async () => {
      // 로그인
      await element(by.id('login-button')).tap();
      await element(by.id('username-input')).typeText('testuser');
      await element(by.id('password-input')).typeText('testpass');
      await element(by.id('login-submit-button')).tap();
      await waitFor(element(by.id('home-screen'))).toBeVisible();
    });

    it('단어 목록 로딩과 표시가 정상 작동해야 함', async () => {
      // 학습 화면으로 이동
      await element(by.id('learn-tab')).tap();
      await expect(element(by.id('learn-screen'))).toBeVisible();

      // 단어 학습 시작
      await element(by.id('vocab-learning-button')).tap();
      await waitFor(element(by.id('learn-vocab-screen'))).toBeVisible();

      // 단어 목록 로딩 확인
      await waitFor(element(by.id('word-list')))
        .toBeVisible()
        .withTimeout(10000);

      // 첫 번째 단어 확인
      await expect(element(by.id('word-card')).atIndex(0)).toBeVisible();
    });

    it('퀴즈 기능이 정상 작동해야 함', async () => {
      // 학습 화면으로 이동
      await element(by.id('learn-tab')).tap();
      await element(by.id('vocab-learning-button')).tap();
      await waitFor(element(by.id('learn-vocab-screen'))).toBeVisible();

      // 퀴즈 시작
      await element(by.id('start-quiz-button')).tap();
      await waitFor(element(by.id('mini-quiz-screen'))).toBeVisible();

      // 문제 확인
      await expect(element(by.id('quiz-question'))).toBeVisible();
      await expect(element(by.id('quiz-options'))).toBeVisible();

      // 답안 선택
      await element(by.id('option-1')).tap();

      // 결과 확인
      await waitFor(element(by.id('quiz-result')))
        .toBeVisible()
        .withTimeout(3000);
    });
  });

  describe('상태 관리 테스트', () => {
    it('앱 상태가 화면 전환 시 유지되어야 함', async () => {
      // 로그인
      await element(by.id('login-button')).tap();
      await element(by.id('username-input')).typeText('testuser');
      await element(by.id('password-input')).typeText('testpass');
      await element(by.id('login-submit-button')).tap();
      await waitFor(element(by.id('home-screen'))).toBeVisible();

      // 학습 진행
      await element(by.id('learn-tab')).tap();
      await element(by.id('vocab-learning-button')).tap();
      await waitFor(element(by.id('learn-vocab-screen'))).toBeVisible();

      // 앱 백그라운드로 전환
      await device.sendToHome();
      await device.launchApp();

      // 상태 유지 확인
      await expect(element(by.id('learn-vocab-screen'))).toBeVisible();
    });

    it('로그아웃 시 상태가 초기화되어야 함', async () => {
      // 로그인
      await element(by.id('login-button')).tap();
      await element(by.id('username-input')).typeText('testuser');
      await element(by.id('password-input')).typeText('testpass');
      await element(by.id('login-submit-button')).tap();
      await waitFor(element(by.id('home-screen'))).toBeVisible();

      // 로그아웃
      await element(by.id('admin-tab')).tap();
      await element(by.id('logout-button')).tap();

      // 초기 화면 확인
      await expect(element(by.id('landing-page'))).toBeVisible();
    });
  });

  describe('성능 테스트', () => {
    it('앱 시작 시간이 적절해야 함', async () => {
      const startTime = Date.now();
      await device.launchApp();
      
      await waitFor(element(by.id('landing-page')))
        .toBeVisible()
        .withTimeout(5000);
      
      const launchTime = Date.now() - startTime;
      expect(launchTime).toBeLessThan(5000); // 5초 이내
    });

    it('화면 전환이 부드러워야 함', async () => {
      await element(by.id('login-button')).tap();
      await element(by.id('username-input')).typeText('testuser');
      await element(by.id('password-input')).typeText('testpass');
      await element(by.id('login-submit-button')).tap();
      await waitFor(element(by.id('home-screen'))).toBeVisible();

      const startTime = Date.now();
      await element(by.id('learn-tab')).tap();
      await waitFor(element(by.id('learn-screen'))).toBeVisible();
      const navigationTime = Date.now() - startTime;

      expect(navigationTime).toBeLessThan(1000); // 1초 이내
    });
  });
});