import { Platform } from 'react-native';

// Development configuration
const DEV_CONFIG = {
  // Use 10.0.2.2 for Android emulator, localhost for iOS
  API_URL: Platform.OS === 'android' 
    ? 'http://10.0.2.2:4000' 
    : 'http://localhost:4000',
  APP_VERSION: '1.0.0',
  ENVIRONMENT: 'development',
};

// Production configuration
const PROD_CONFIG = {
  API_URL: 'https://api.languagelearner.com',
  APP_VERSION: '1.0.0',
  ENVIRONMENT: 'production',
};

// Export configuration based on __DEV__ flag
export const Config = __DEV__ ? DEV_CONFIG : PROD_CONFIG;

// Export individual config values for convenience
export const API_URL = Config.API_URL;
export const APP_VERSION = Config.APP_VERSION;
export const ENVIRONMENT = Config.ENVIRONMENT;

// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  LOGOUT: '/auth/logout',
  REFRESH: '/auth/refresh',
  ME: '/me',
  
  // SRS
  SRS_DASHBOARD: '/srs/dashboard',
  SRS_STATUS: '/srs/status',
  SRS_AVAILABLE: '/srs/available',
  SRS_FOLDERS: '/srs/folders',
  SRS_CARDS: '/srs/cards',
  
  // Vocabulary
  VOCAB_LIST: '/vocab/list',
  VOCAB_TEST: '/vocab/test',
  
  // User
  USER_PROFILE: '/user/profile',
  
  // Mobile specific
  MOBILE_SYNC: '/api/mobile/sync',
  MOBILE_VOCAB: '/api/mobile/vocab/paginated',
  MOBILE_AUDIO: '/api/mobile/audio/compressed',
};

// Feature flags
export const FEATURES = {
  OFFLINE_MODE: true,
  HAPTIC_FEEDBACK: true,
  GESTURE_NAVIGATION: true,
  BIOMETRIC_AUTH: false, // Coming soon
  VOICE_RECOGNITION: false, // Coming soon
  DARK_MODE: true,
};

// Cache configuration
export const CACHE_CONFIG = {
  AUDIO_CACHE_SIZE_MB: 100,
  IMAGE_CACHE_SIZE_MB: 50,
  DATA_CACHE_DURATION_MS: 1000 * 60 * 5, // 5 minutes
  OFFLINE_SYNC_INTERVAL_MS: 1000 * 60 * 15, // 15 minutes
};

// UI configuration
export const UI_CONFIG = {
  ANIMATION_DURATION: 300,
  SWIPE_THRESHOLD: 0.3,
  HAPTIC_INTENSITY: 'medium',
  DEFAULT_PAGE_SIZE: 20,
  MAX_RETRY_ATTEMPTS: 3,
};