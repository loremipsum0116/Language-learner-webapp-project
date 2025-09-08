// src/navigation/index.ts
// 네비게이션 시스템 통합 내보내기

// Main Navigators
export { default as RootNavigator } from './RootNavigator';
export { default as MainStackNavigator } from './MainStackNavigator';
export { default as AuthStackNavigator } from './AuthStackNavigator';
export { default as StudyStackNavigator } from './StudyStackNavigator';
export { default as SettingsStackNavigator } from './SettingsStackNavigator';
export { default as TabNavigator } from './TabNavigator';

// Navigation Service
export { default as navigationService } from './NavigationService';
export { navigationRef } from './NavigationService';
export {
  navigate,
  goBack,
  reset,
  replace,
  navigateToAuth,
  navigateToMain,
  navigateToStudy,
  openModal,
  handleDeepLink,
} from './NavigationService';

// Deep Linking
export { linkingConfig, createDeepLink, parseDeepLinkUrl, generateShareUrl } from './LinkingConfig';

// Back Button Handling
export {
  useBackButtonHandler,
  BackButtonHandler,
  GlobalBackButtonHandler,
  useQuizBackButtonHandler,
  useAuthBackButtonHandler,
  useModalBackButtonHandler,
  useDoubleTapExitHandler,
} from './BackButtonHandler';

// Navigation Components
export * from './components';

// Types
export * from './types';

// Default export - RootNavigator
export { default } from './RootNavigator';