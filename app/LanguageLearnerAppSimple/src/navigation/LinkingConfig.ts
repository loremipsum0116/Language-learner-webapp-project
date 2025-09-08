// src/navigation/LinkingConfig.ts
// 딥링킹 설정

import { LinkingOptions } from '@react-navigation/native';
import { RootStackParamList } from './types';

const config = {
  screens: {
    Splash: 'splash',
    Onboarding: 'onboarding',
    App: {
      screens: {
        Auth: {
          screens: {
            Login: 'auth/login',
            Register: 'auth/register',
            ForgotPassword: 'auth/forgot-password',
            ResetPassword: 'auth/reset-password/:token',
          },
        },
        Main: {
          screens: {
            Home: 'home',
            Study: {
              screens: {
                StudyMode: 'study',
                SrsQuiz: {
                  path: 'study/quiz/:folderId?',
                  parse: {
                    folderId: (folderId: string) => folderId || undefined,
                  },
                },
                VocabDetail: {
                  path: 'vocab/:vocabId',
                  parse: {
                    vocabId: (vocabId: string) => parseInt(vocabId, 10),
                  },
                },
                QuizResult: 'study/result',
                ReviewSession: 'study/review',
              },
            },
            Progress: 'progress',
            Settings: {
              screens: {
                SettingsMain: 'settings',
                Profile: 'settings/profile',
                Account: 'settings/account',
                Preferences: 'settings/preferences',
                Theme: 'settings/theme',
                Notifications: 'settings/notifications',
                Privacy: 'settings/privacy',
                About: 'settings/about',
                Help: 'settings/help',
                Feedback: 'settings/feedback',
              },
            },
          },
        },
        StudyFlow: {
          screens: {
            StudyMode: 'study-flow',
            SrsQuiz: 'study-flow/quiz/:folderId?',
            VocabDetail: 'study-flow/vocab/:vocabId',
            QuizResult: 'study-flow/result',
            ReviewSession: 'study-flow/review',
          },
        },
        Modal: {
          path: 'modal/:component',
          parse: {
            component: (component: string) => component as 'CardReport' | 'VocabDetail' | 'Settings',
          },
        },
      },
    },
    DeepLink: {
      path: 'link/:screen',
      parse: {
        screen: (screen: string) => screen,
      },
    },
  },
};

export const linkingConfig: LinkingOptions<RootStackParamList> = {
  prefixes: [
    // App scheme for deep linking
    'langlearner://',
    'com.langlearner.app://',
    // Universal links (웹사이트 도메인 설정 시 사용)
    'https://app.langlearner.com',
    'https://langlearner.app',
    // Development URLs
    'http://localhost:3000',
    'http://192.168.1.100:3000', // 로컬 네트워크 개발 서버
  ],
  config,
  
  // Deep link handling options
  async getInitialURL() {
    // Check if app was opened from a deep link
    const { Linking } = await import('react-native');
    const url = await Linking.getInitialURL();
    
    if (url != null) {
      return url;
    }
    
    // Check if app was opened from a notification
    const { default: notifee } = await import('@react-native-async-storage/async-storage');
    // TODO: Implement notification-based URL handling
    
    return null;
  },
  
  subscribe(listener) {
    const onReceiveURL = ({ url }: { url: string }) => {
      listener(url);
    };

    // Listen to incoming links from deep linking
    const { Linking } = require('react-native');
    const subscription = Linking.addEventListener('url', onReceiveURL);

    // TODO: Listen to push notifications
    // const unsubscribeNotification = messaging().onNotificationOpenedApp(remoteMessage => {
    //   if (remoteMessage?.data?.url) {
    //     listener(remoteMessage.data.url as string);
    //   }
    // });

    return () => {
      subscription?.remove();
      // unsubscribeNotification?.();
    };
  },
};

// Deep link URL generators
export const createDeepLink = {
  // Auth links
  login: () => 'langlearner://auth/login',
  register: () => 'langlearner://auth/register',
  resetPassword: (token: string) => `langlearner://auth/reset-password/${token}`,
  
  // Main app links
  home: () => 'langlearner://home',
  study: () => 'langlearner://study',
  progress: () => 'langlearner://progress',
  settings: () => 'langlearner://settings',
  
  // Study links
  quiz: (folderId?: string) => 
    folderId ? `langlearner://study/quiz/${folderId}` : 'langlearner://study/quiz',
  vocab: (vocabId: number) => `langlearner://vocab/${vocabId}`,
  review: () => 'langlearner://study/review',
  
  // Settings links
  profile: () => 'langlearner://settings/profile',
  theme: () => 'langlearner://settings/theme',
  notifications: () => 'langlearner://settings/notifications',
  
  // Modal links
  cardReport: (vocabId: number, vocabLemma: string) => 
    `langlearner://modal/CardReport?vocabId=${vocabId}&vocabLemma=${encodeURIComponent(vocabLemma)}`,
  vocabDetail: (vocabId: number) => 
    `langlearner://modal/VocabDetail?vocabId=${vocabId}`,
};

// URL parsing utilities
export const parseDeepLinkUrl = (url: string) => {
  try {
    const urlObj = new URL(url);
    const pathSegments = urlObj.pathname.split('/').filter(Boolean);
    const params = Object.fromEntries(urlObj.searchParams.entries());
    
    return {
      scheme: urlObj.protocol.replace(':', ''),
      host: urlObj.host,
      path: urlObj.pathname,
      segments: pathSegments,
      params,
      query: urlObj.search,
      hash: urlObj.hash,
    };
  } catch (error) {
    console.error('Invalid deep link URL:', url, error);
    return null;
  }
};

// Validation for deep links
export const isValidDeepLink = (url: string): boolean => {
  const validPrefixes = linkingConfig.prefixes || [];
  return validPrefixes.some(prefix => url.startsWith(prefix));
};

// Generate share links for specific content
export const generateShareUrl = (type: 'vocab' | 'quiz' | 'progress', id: string | number) => {
  const baseUrl = 'https://app.langlearner.com';
  
  switch (type) {
    case 'vocab':
      return `${baseUrl}/vocab/${id}`;
    case 'quiz':
      return `${baseUrl}/study/quiz/${id}`;
    case 'progress':
      return `${baseUrl}/progress`;
    default:
      return baseUrl;
  }
};

export default linkingConfig;