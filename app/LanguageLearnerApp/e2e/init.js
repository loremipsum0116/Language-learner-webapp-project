// e2e/init.js - Detox 초기화 설정
const { device, expect, element, by, waitFor } = require('detox');

const adapter = require('detox/runners/jest/adapter');
const specReporter = require('detox/runners/jest/specReporter');

// Jest 설정
jest.setTimeout(300000);
jasmine.getEnv().addReporter(adapter);

// 스펙 리포터 설정
jasmine.getEnv().addReporter(specReporter);

beforeAll(async () => {
  await device.launchApp();
});

beforeEach(async () => {
  await adapter.beforeEach();
});

afterAll(async () => {
  await adapter.afterAll();
});

// 글로벌 함수들
global.device = device;
global.expect = expect;
global.element = element;
global.by = by;
global.waitFor = waitFor;