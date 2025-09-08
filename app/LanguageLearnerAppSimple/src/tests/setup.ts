// setup.ts - Jest 테스트 설정
import 'react-native-gesture-handler/jestSetup';

// Mock console methods in tests
global.console = {
  ...console,
  // 테스트 중 불필요한 로그 숨기기
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// React Navigation 매치 함수 Mock
jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
      dispatch: jest.fn(),
      setOptions: jest.fn(),
      isFocused: jest.fn(() => true),
      addListener: jest.fn(),
    }),
    useRoute: () => ({
      params: {},
    }),
    useFocusEffect: jest.fn(),
    useIsFocused: jest.fn(() => true),
  };
});

// AsyncStorage Mock
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// React Native Reanimated Mock
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');

  // 필요한 경우 추가 mock 함수들
  Reanimated.default.call = () => {};

  return Reanimated;
});

// Expo Audio Mock
jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn(() => Promise.resolve({
        sound: {
          playAsync: jest.fn(),
          unloadAsync: jest.fn(),
        }
      })),
    },
    setAudioModeAsync: jest.fn(),
  },
}));

// React Native Gesture Handler Mock
jest.mock('react-native-gesture-handler', () => {
  const View = require('react-native/Libraries/Components/View/View');
  return {
    Swipeable: View,
    DrawerLayout: View,
    State: {},
    ScrollView: View,
    Slider: View,
    Switch: View,
    TextInput: View,
    ToolbarAndroid: View,
    ViewPagerAndroid: View,
    DrawerLayoutAndroid: View,
    WebView: View,
    NativeViewGestureHandler: View,
    TapGestureHandler: View,
    FlingGestureHandler: View,
    ForceTouchGestureHandler: View,
    LongPressGestureHandler: View,
    PanGestureHandler: View,
    PinchGestureHandler: View,
    RotationGestureHandler: View,
    RawButton: View,
    BaseButton: View,
    RectButton: View,
    BorderlessButton: View,
    FlatList: View,
    gestureHandlerRootHOC: jest.fn((component) => component),
    Directions: {},
  };
});

// FastImage Mock
jest.mock('react-native-fast-image', () => {
  const mockComponent = require('react-native/Libraries/Image/Image');
  return {
    __esModule: true,
    default: mockComponent,
    preload: jest.fn(),
    clearMemoryCache: jest.fn(),
    clearDiskCache: jest.fn(),
    resizeMode: {
      contain: 'contain',
      cover: 'cover',
      stretch: 'stretch',
      center: 'center',
    },
    priority: {
      low: 'low',
      normal: 'normal',
      high: 'high',
    },
    cacheControl: {
      immutable: 'immutable',
      web: 'web',
      cacheOnly: 'cacheOnly',
    },
  };
});

// FlashList Mock
jest.mock('@shopify/flash-list', () => {
  const { FlatList } = require('react-native');
  return {
    FlashList: FlatList,
  };
});

// Dimensions Mock with fixed values
const mockDimensions = {
  get: jest.fn(() => ({
    width: 375,
    height: 667,
    scale: 2,
    fontScale: 1,
  })),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};

jest.mock('react-native/Libraries/Utilities/Dimensions', () => mockDimensions);

// Remove problematic DeviceEventEmitter mock
// jest.mock('react-native', () => ({
//   ...jest.requireActual('react-native'),
//   DeviceEventEmitter: {
//     addListener: jest.fn(),
//     removeListener: jest.fn(),
//     emit: jest.fn(),
//   },
// }));

// Platform Mock
jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  OS: 'ios',
  select: (platforms) => platforms.ios,
  Version: '14.0',
}));

// InteractionManager Mock
jest.mock('react-native/Libraries/Interaction/InteractionManager', () => ({
  runAfterInteractions: (callback) => {
    return { cancel: jest.fn() };
  },
  createInteractionHandle: jest.fn(() => 1),
  clearInteractionHandle: jest.fn(),
}));

// Linking Mock
jest.mock('react-native/Libraries/Linking/Linking', () => ({
  openURL: jest.fn(() => Promise.resolve()),
  canOpenURL: jest.fn(() => Promise.resolve(true)),
  getInitialURL: jest.fn(() => Promise.resolve(null)),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
}));

// Alert Mock
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
  prompt: jest.fn(),
}));

// 글로벌 테스트 유틸리티
global.flushPromises = () => new Promise(setImmediate);

// 타이머 Mock 설정
jest.useFakeTimers();

// 테스트 정리 함수
afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});