// src/navigation/NavigationService.ts
// 네비게이션 서비스 (전역 네비게이션 제어)

import { createNavigationContainerRef, CommonActions, StackActions } from '@react-navigation/native';
import { RootStackParamList, DeepLinkParams } from './types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BackHandler, Platform } from 'react-native';

// Navigation reference
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

// Storage keys
const LAST_ROUTE_KEY = '@last_route';
const NAVIGATION_HISTORY_KEY = '@navigation_history';

// Navigation history for back button handling
let navigationHistory: string[] = [];
const MAX_HISTORY_SIZE = 10;

// Navigation Service Class
class NavigationService {
  // Basic navigation methods
  navigate = (name: string, params?: any) => {
    if (navigationRef.isReady()) {
      navigationRef.navigate(name as never, params as never);
      this.addToHistory(name);
    }
  };

  goBack = () => {
    if (navigationRef.isReady() && navigationRef.canGoBack()) {
      navigationRef.goBack();
      this.removeFromHistory();
    } else {
      // Handle Android back button when can't go back
      if (Platform.OS === 'android') {
        BackHandler.exitApp();
      }
    }
  };

  reset = (routeName: string, params?: any) => {
    if (navigationRef.isReady()) {
      navigationRef.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: routeName as never, params }],
        })
      );
      this.clearHistory();
      this.addToHistory(routeName);
    }
  };

  replace = (routeName: string, params?: any) => {
    if (navigationRef.isReady()) {
      navigationRef.dispatch(StackActions.replace(routeName as never, params));
      this.replaceInHistory(routeName);
    }
  };

  push = (routeName: string, params?: any) => {
    if (navigationRef.isReady()) {
      navigationRef.dispatch(StackActions.push(routeName as never, params));
      this.addToHistory(routeName);
    }
  };

  pop = (count: number = 1) => {
    if (navigationRef.isReady()) {
      navigationRef.dispatch(StackActions.pop(count));
      this.removeFromHistory(count);
    }
  };

  popToTop = () => {
    if (navigationRef.isReady()) {
      navigationRef.dispatch(StackActions.popToTop());
      this.clearHistory();
    }
  };

  // Utility methods
  getCurrentRoute = () => {
    if (navigationRef.isReady()) {
      return navigationRef.getCurrentRoute();
    }
    return null;
  };

  getCurrentRouteName = (): string | null => {
    const route = this.getCurrentRoute();
    return route?.name || null;
  };

  getState = () => {
    if (navigationRef.isReady()) {
      return navigationRef.getState();
    }
    return null;
  };

  canGoBack = (): boolean => {
    return navigationRef.isReady() && navigationRef.canGoBack();
  };

  // App-specific navigation methods
  navigateToAuth = (screen?: 'Login' | 'Register' | 'ForgotPassword') => {
    this.navigate('App', {
      screen: 'Auth',
      params: screen ? { screen } : undefined,
    });
  };

  navigateToMain = (tab?: 'Home' | 'Study' | 'Progress' | 'Settings') => {
    this.navigate('App', {
      screen: 'Main',
      params: tab ? { screen: tab } : undefined,
    });
  };

  navigateToStudy = (screen?: 'StudyMode' | 'SrsQuiz', params?: any) => {
    this.navigate('App', {
      screen: 'StudyFlow',
      params: {
        screen: screen || 'StudyMode',
        params,
      },
    });
  };

  openModal = (component: 'CardReport' | 'VocabDetail' | 'Settings', params?: any) => {
    this.navigate('App', {
      screen: 'Modal',
      params: {
        component,
        params,
      },
    });
  };

  // Deep linking handlers
  handleDeepLink = async (url: string) => {
    try {
      const parsedLink = this.parseDeepLinkParams(url);
      
      if (parsedLink.vocab) {
        this.openModal('VocabDetail', { vocabId: parsedLink.vocab.id });
      } else if (parsedLink.quiz) {
        this.navigateToStudy('SrsQuiz', {
          folderId: parsedLink.quiz.folderId,
          reviewMode: parsedLink.quiz.mode === 'review',
        });
      } else if (parsedLink.notification) {
        await this.handleNotificationLink(parsedLink.notification);
      } else {
        // Default fallback
        this.navigateToMain();
      }
    } catch (error) {
      console.error('Deep link handling error:', error);
      this.navigateToMain();
    }
  };

  private parseDeepLinkParams = (url: string): DeepLinkParams => {
    // Simple URL parsing for deep link parameters
    const urlObj = new URL(url);
    const params: DeepLinkParams = {};
    
    if (url.includes('/vocab/')) {
      const vocabId = parseInt(url.split('/vocab/')[1], 10);
      if (!isNaN(vocabId)) {
        params.vocab = { id: vocabId };
      }
    }
    
    if (url.includes('/quiz/')) {
      const folderId = url.split('/quiz/')[1];
      params.quiz = { folderId, mode: url.includes('review') ? 'review' : 'study' };
    }
    
    // Parse query parameters
    urlObj.searchParams.forEach((value, key) => {
      if (key === 'notificationId') {
        params.notification = { id: value, type: 'general' };
      }
    });
    
    return params;
  };

  private handleNotificationLink = async (notification: { id: string; type: string }) => {
    // Handle different notification types
    switch (notification.type) {
      case 'quiz_reminder':
        this.navigateToStudy('StudyMode');
        break;
      case 'streak_reminder':
        this.navigateToMain('Home');
        break;
      case 'achievement':
        this.navigateToMain('Progress');
        break;
      default:
        this.navigateToMain();
    }
  };

  // History management
  private addToHistory = (routeName: string) => {
    navigationHistory.push(routeName);
    if (navigationHistory.length > MAX_HISTORY_SIZE) {
      navigationHistory = navigationHistory.slice(-MAX_HISTORY_SIZE);
    }
    this.saveNavigationHistory();
    this.saveLastRoute(routeName);
  };

  private removeFromHistory = (count: number = 1) => {
    navigationHistory = navigationHistory.slice(0, -count);
    this.saveNavigationHistory();
  };

  private replaceInHistory = (routeName: string) => {
    if (navigationHistory.length > 0) {
      navigationHistory[navigationHistory.length - 1] = routeName;
    } else {
      navigationHistory.push(routeName);
    }
    this.saveNavigationHistory();
    this.saveLastRoute(routeName);
  };

  private clearHistory = () => {
    navigationHistory = [];
    this.saveNavigationHistory();
  };

  // Persistence
  private saveLastRoute = async (routeName: string) => {
    try {
      await AsyncStorage.setItem(LAST_ROUTE_KEY, routeName);
    } catch (error) {
      console.error('Failed to save last route:', error);
    }
  };

  private saveNavigationHistory = async () => {
    try {
      await AsyncStorage.setItem(NAVIGATION_HISTORY_KEY, JSON.stringify(navigationHistory));
    } catch (error) {
      console.error('Failed to save navigation history:', error);
    }
  };

  restoreNavigationState = async () => {
    try {
      const lastRoute = await AsyncStorage.getItem(LAST_ROUTE_KEY);
      const historyJson = await AsyncStorage.getItem(NAVIGATION_HISTORY_KEY);
      
      if (historyJson) {
        navigationHistory = JSON.parse(historyJson);
      }
      
      return lastRoute;
    } catch (error) {
      console.error('Failed to restore navigation state:', error);
      return null;
    }
  };

  // Android back button handling
  handleAndroidBackButton = (): boolean => {
    const currentRoute = this.getCurrentRouteName();
    
    // Special handling for certain screens
    if (currentRoute === 'SrsQuiz') {
      // Don't allow back during quiz - could show confirmation dialog
      return true; // Prevent default back action
    }
    
    if (this.canGoBack()) {
      this.goBack();
      return true; // Handled by us
    }
    
    // Let system handle (exit app)
    return false;
  };

  // Debug helpers
  getNavigationHistory = () => navigationHistory;
  
  logNavigationState = () => {
    if (__DEV__) {
      const state = this.getState();
      const currentRoute = this.getCurrentRoute();
      console.log('Navigation State:', state);
      console.log('Current Route:', currentRoute);
      console.log('History:', navigationHistory);
    }
  };
}

// Export singleton instance
export const navigationService = new NavigationService();

// Export individual methods for convenience
export const {
  navigate,
  goBack,
  reset,
  replace,
  push,
  pop,
  popToTop,
  getCurrentRoute,
  getCurrentRouteName,
  canGoBack,
  navigateToAuth,
  navigateToMain,
  navigateToStudy,
  openModal,
  handleDeepLink,
  handleAndroidBackButton,
  restoreNavigationState,
  logNavigationState,
} = navigationService;

export default navigationService;