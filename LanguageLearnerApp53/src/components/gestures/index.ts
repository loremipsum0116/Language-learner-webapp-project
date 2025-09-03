// src/components/gestures/index.ts
// 제스처 컴포넌트 통합 export

// Screen Transitions
export {
  ScreenTransitionWrapper,
  useScreenTransition,
  FadeTransition,
  SlideTransition,
  ScaleTransition,
} from './ScreenTransitionWrapper';

// Pull to Refresh
export {
  PullToRefresh,
  PullToRefreshFlatList,
} from './PullToRefresh';

// Long Press Menu
export {
  LongPressMenu,
  useLongPressMenu,
  QuickActionButton,
  type MenuOption,
} from './LongPressMenu';

// Navigation Gesture Provider
export {
  NavigationGestureProvider,
  GestureScreen,
  useNavigationGestures,
  useGestureConfig,
  useScreenGestures,
} from './NavigationGestureProvider';

// Types
export interface GestureConfig {
  enableSwipeBack: boolean;
  enablePullToRefresh: boolean;
  enableLongPress: boolean;
  swipeBackThreshold: number;
  longPressDuration: number;
  refreshThreshold: number;
  hapticFeedback: boolean;
}

export interface ScreenGestureOptions {
  refreshHandler?: () => Promise<void> | void;
  contextMenuOptions?: MenuOption[];
  disableSwipeBack?: boolean;
  customTransition?: boolean;
}

// Gesture utilities
export const gestureUtils = {
  // 제스처 임계값 계산
  calculateThreshold: (screenSize: number, percentage: number = 0.3) => {
    return screenSize * percentage;
  },

  // 제스처 속도 계산
  calculateVelocity: (distance: number, time: number) => {
    return distance / time;
  },

  // 제스처 방향 계산
  calculateDirection: (dx: number, dy: number) => {
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    
    if (angle >= -45 && angle <= 45) return 'right';
    if (angle >= 45 && angle <= 135) return 'down';
    if (angle >= 135 || angle <= -135) return 'left';
    if (angle >= -135 && angle <= -45) return 'up';
    
    return 'unknown';
  },

  // 제스처 강도 계산
  calculateIntensity: (velocity: number, maxVelocity: number = 1000) => {
    return Math.min(Math.abs(velocity) / maxVelocity, 1);
  },

  // 제스처 애니메이션 지속시간 계산
  calculateDuration: (distance: number, velocity: number, minDuration: number = 150, maxDuration: number = 500) => {
    const calculatedDuration = Math.abs(distance / velocity);
    return Math.max(minDuration, Math.min(maxDuration, calculatedDuration));
  },
};

// 제스처 상수
export const GESTURE_CONSTANTS = {
  // 스와이프 관련
  SWIPE_THRESHOLD: 50,
  SWIPE_VELOCITY_THRESHOLD: 500,
  
  // 롱 프레스 관련
  LONG_PRESS_DURATION: 500,
  LONG_PRESS_MOVE_THRESHOLD: 10,
  
  // 당겨서 새로고침 관련
  PULL_TO_REFRESH_THRESHOLD: 80,
  PULL_TO_REFRESH_MAX_DISTANCE: 120,
  
  // 애니메이션 관련
  ANIMATION_DURATION_SHORT: 150,
  ANIMATION_DURATION_MEDIUM: 250,
  ANIMATION_DURATION_LONG: 350,
  
  // 터치 관련
  HIT_SLOP: { top: 10, bottom: 10, left: 10, right: 10 },
  EDGE_SWIPE_DETECTION_WIDTH: 20,
};

export default {
  ScreenTransitionWrapper,
  PullToRefresh,
  LongPressMenu,
  NavigationGestureProvider,
  GestureScreen,
  gestureUtils,
  GESTURE_CONSTANTS,
};