// e2e/firstTest.test.js - 기본 Detox 테스트
const { device, expect, element, by, waitFor } = require('detox');

describe('Language Learner App', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('앱이 정상적으로 시작되어야 함', async () => {
    await expect(element(by.id('app-container'))).toBeVisible();
  });

  it('랜딩 페이지가 표시되어야 함', async () => {
    await waitFor(element(by.id('landing-page')))
      .toBeVisible()
      .withTimeout(10000);
  });

  it('로그인 화면으로 이동할 수 있어야 함', async () => {
    await element(by.id('login-button')).tap();
    await waitFor(element(by.id('login-screen')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('로그인 폼에 입력할 수 있어야 함', async () => {
    // 로그인 화면으로 이동
    await element(by.id('login-button')).tap();
    await waitFor(element(by.id('login-screen'))).toBeVisible();

    // 사용자 이름 입력
    await element(by.id('username-input')).typeText('testuser');
    await element(by.id('password-input')).typeText('testpass');

    // 입력값 확인
    await expect(element(by.id('username-input'))).toHaveText('testuser');
  });

  it('네비게이션이 정상 작동해야 함', async () => {
    // 홈 화면으로 이동 (로그인 후)
    await element(by.id('home-tab')).tap();
    await expect(element(by.id('home-screen'))).toBeVisible();

    // 학습 화면으로 이동
    await element(by.id('learn-tab')).tap();
    await expect(element(by.id('learn-screen'))).toBeVisible();

    // 관리자 화면으로 이동
    await element(by.id('admin-tab')).tap();
    await expect(element(by.id('admin-screen'))).toBeVisible();
  });
});