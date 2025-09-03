// src/navigation/types.ts
// 네비게이션 타입 정의

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';

// Auth Stack Params
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token: string };
};

// Study Stack Params
export type StudyStackParamList = {
  StudyMode: undefined;
  SrsQuiz: { folderId?: string; reviewMode?: boolean };
  VocabDetail: { vocabId: number; cardId?: number };
  QuizResult: { 
    score: number; 
    totalQuestions: number; 
    correctAnswers: number; 
    timeSpent: number;
    reviewItems?: any[];
  };
  ReviewSession: { reviewItems: any[] };
};

// Settings Stack Params
export type SettingsStackParamList = {
  SettingsMain: undefined;
  Profile: undefined;
  Account: undefined;
  Preferences: undefined;
  Theme: undefined;
  Notifications: undefined;
  Privacy: undefined;
  About: undefined;
  Help: undefined;
  Feedback: undefined;
};

// Tab Navigator Params
export type TabNavigatorParamList = {
  Home: undefined;
  Study: undefined;
  Progress: undefined;
  Settings: undefined;
};

// Main Stack Params (전체 앱 구조)
export type MainStackParamList = {
  Auth: { screen?: keyof AuthStackParamList };
  Main: undefined; // Tab Navigator
  StudyFlow: { screen?: keyof StudyStackParamList; params?: any };
  
  // 개별 스크린들 - 웹 라우팅과 동일하게 구성
  Dictionary: undefined;
  Wordbook: undefined;
  SrsDashboard: undefined;
  Reading: undefined;
  Listening: undefined;
  Quiz: undefined;
  
  Modal: {
    component: 'CardReport' | 'VocabDetail' | 'Settings';
    params?: any;
  };
};

// Root Stack Params (최상위 네비게이터)
export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  App: undefined; // Main Stack
  // Deep linking params
  DeepLink: {
    screen: string;
    params?: any;
  };
};

// Screen Props Types
export type AuthScreenProps<T extends keyof AuthStackParamList> = 
  NativeStackScreenProps<AuthStackParamList, T>;

export type StudyScreenProps<T extends keyof StudyStackParamList> = 
  NativeStackScreenProps<StudyStackParamList, T>;

export type SettingsScreenProps<T extends keyof SettingsStackParamList> = 
  NativeStackScreenProps<SettingsStackParamList, T>;

export type TabScreenProps<T extends keyof TabNavigatorParamList> = 
  CompositeScreenProps<
    BottomTabScreenProps<TabNavigatorParamList, T>,
    NativeStackScreenProps<MainStackParamList>
  >;

export type MainScreenProps<T extends keyof MainStackParamList> = 
  NativeStackScreenProps<MainStackParamList, T>;

export type RootScreenProps<T extends keyof RootStackParamList> = 
  NativeStackScreenProps<RootStackParamList, T>;

// Navigation State Types
export type NavigationState = {
  isAuthenticated: boolean;
  hasSeenOnboarding: boolean;
  lastActiveTab?: keyof TabNavigatorParamList;
  deepLinkHandled: boolean;
};

// Deep Link Types
export type DeepLinkParams = {
  vocab?: { id: number };
  quiz?: { folderId: string; mode?: 'review' | 'study' };
  folder?: { id: string };
  notification?: { id: string; type: string };
};

// Tab Icon Names
export type TabIconName = 'home' | 'study' | 'progress' | 'settings';

// Navigation Theme
export type NavigationTheme = {
  dark: boolean;
  colors: {
    primary: string;
    background: string;
    card: string;
    text: string;
    border: string;
    notification: string;
  };
};