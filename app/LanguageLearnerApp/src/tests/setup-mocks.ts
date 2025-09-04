// setup-mocks.ts - 전역 Mock 설정
import { NativeModules } from 'react-native';

// Native Modules Mock
NativeModules.StatusBarManager = {
  HEIGHT: 20,
  getHeight: jest.fn((callback) => callback({ height: 20 })),
};

// RNGestureHandlerModule Mock
NativeModules.RNGestureHandlerModule = {
  State: {},
  Direction: {},
  attachGestureHandler: jest.fn(),
  createGestureHandler: jest.fn(),
  dropGestureHandler: jest.fn(),
  updateGestureHandler: jest.fn(),
};

// RNCNetInfo Mock
NativeModules.RNCNetInfo = {
  getCurrentState: jest.fn(() => Promise.resolve({
    type: 'wifi',
    isConnected: true,
    isInternetReachable: true,
  })),
  addListener: jest.fn(),
  removeListeners: jest.fn(),
};

// RNSound Mock
NativeModules.RNSound = {
  playSoundFile: jest.fn(),
  prepareSound: jest.fn(),
  playSound: jest.fn(),
  stopSound: jest.fn(),
};

// AsyncStorage Module Mock
NativeModules.RNCAsyncStorage = {
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiSet: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
};

// 기타 Native Module Mocks
NativeModules.PlatformConstants = {
  forceTouchAvailable: false,
  interfaceIdiom: 'phone',
  isTesting: true,
};

NativeModules.DeviceInfo = {
  getConstants: () => ({}),
};

// Mock fetch if not available
if (!global.fetch) {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
    } as Response)
  );
}

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn((callback) => {
  setTimeout(callback, 0);
  return 1;
});

global.cancelAnimationFrame = jest.fn();

// Mock ResizeObserver if needed
if (typeof global.ResizeObserver === 'undefined') {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Mock performance.now
global.performance = global.performance || {};
global.performance.now = global.performance.now || jest.fn(() => Date.now());

// Mock Image
if (typeof global.Image === 'undefined') {
  global.Image = class Image {
    onload = null;
    onerror = null;
    src = '';
    
    constructor() {
      setTimeout(() => {
        if (this.onload) this.onload();
      }, 100);
    }
  };
}

export {};