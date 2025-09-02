// Core type definitions for the Language Learner application

export interface User {
  id: number;
  email: string;
  password: string;
  role: 'user' | 'admin';
  createdAt: Date;
  updatedAt?: Date;
  lastLoginAt?: Date;
  preferences?: UserPreferences;
  totalWords?: number | null;
  studyStreak?: number | null;
  lastStudyDate?: Date | null;
  level?: string | null;
  subscriptionType?: string | null;
  subscriptionExpiresAt?: Date | null;
  registrationSource?: string;
  deletedAt?: Date;
}

export interface UserPreferences {
  dailyGoal?: number;
  reminderTime?: string;
  notifications?: boolean;
  offlineSync?: boolean;
  audioAutoDownload?: boolean;
  theme?: 'light' | 'dark' | 'system';
  language?: string;
  [key: string]: any;
}

export interface Vocab {
  id: number;
  lemma: string;
  pos: string;
  levelCEFR: string;
  frequency?: number;
  source?: string;
  createdAt: Date;
  updatedAt?: Date;
  dictentry?: DictEntry;
  categories?: Category[];
  userProgress?: UserProgress[];
}

export interface DictEntry {
  id: number;
  vocabId: number;
  definition?: string;
  pronunciation?: string;
  audioLocal?: string;
  examples?: Example[];
  createdAt: Date;
  updatedAt?: Date;
}

export interface Example {
  id: number;
  dictEntryId: number;
  kind: 'gloss' | 'example' | 'usage';
  en: string;
  ko?: string;
  chirpScript?: string;
  createdAt: Date;
}

export interface Category {
  id: number;
  name: string;
  color?: string;
  description?: string;
  createdAt: Date;
  vocabs?: Vocab[];
}

export interface UserProgress {
  id: number;
  userId: number;
  vocabId: number;
  isLearned: boolean;
  difficulty: 'easy' | 'medium' | 'hard';
  lastStudiedAt?: Date;
  studyCount: number;
  totalStudyTime: number;
  createdAt: Date;
  updatedAt?: Date;
  user?: User;
  vocab?: Vocab;
}

export interface SrsCard {
  id: number;
  userId: number;
  vocabId: number;
  level: number;
  status: 'AVAILABLE' | 'WAITING' | 'MASTERED' | 'FAILED';
  nextDue: Date;
  lastStudied?: Date;
  correctCount: number;
  incorrectCount: number;
  totalResponseTime: number;
  totalStudyTime: number;
  studyCount: number;
  createdAt: Date;
  updatedAt?: Date;
  user?: User;
  vocab?: Vocab;
}

export interface RefreshToken {
  id: number;
  token: string;
  userId: number;
  expiresAt: Date;
  createdAt: Date;
  lastUsedAt?: Date;
  isRevoked: boolean;
  deviceInfo?: DeviceInfo;
  user?: User;
}

export interface DeviceInfo {
  platform?: string;
  appVersion?: string;
  deviceModel?: string;
  osVersion?: string;
  userAgent?: string;
  lastLoginAt?: Date;
  registeredAt?: Date;
  lastUsedAt?: Date;
  [key: string]: any;
}

export interface UserDevice {
  id: number;
  userId: number;
  deviceId: string;
  deviceName: string;
  platform: 'ios' | 'android' | 'web';
  osVersion?: string;
  appVersion?: string;
  pushToken?: string;
  deviceModel?: string;
  screenSize?: string;
  timezone?: string;
  isActive: boolean;
  notificationSettings?: string;
  createdAt: Date;
  updatedAt?: Date;
  lastActiveAt?: Date;
  deactivatedAt?: Date;
  user?: User;
}

export interface PushNotification {
  id: number;
  userId: number;
  deviceId?: string;
  title: string;
  message: string;
  type: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  createdAt: Date;
  sentAt?: Date;
  readAt?: Date;
  user?: User;
}

export interface UserDailyStats {
  id: number;
  userId: number;
  date: string; // YYYY-MM-DD format
  cardsCompleted: number;
  studyTime: number; // in seconds
  accuracy?: number;
  createdAt: Date;
  updatedAt?: Date;
  user?: User;
}

export interface UserSyncLog {
  id: number;
  userId: number;
  syncType: 'download' | 'upload' | 'full';
  itemCount?: number;
  status: 'success' | 'error' | 'partial_success';
  errorMessage?: string;
  createdAt: Date;
  user?: User;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
  apiVersion?: string;
  meta?: ApiResponseMeta;
}

export interface ApiResponseMeta {
  pagination?: PaginationInfo;
  total?: number;
  [key: string]: any;
}

export interface PaginationInfo {
  offset: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

// Mobile API specific types
export interface MobileApiResponse<T = any> extends ApiResponse<T> {
  deviceInfo?: DeviceInfo | null;
}

export interface BatchRequest {
  requests: Array<{
    method: string;
    url: string;
    body?: any;
  }>;
}

export interface BatchResponse {
  responses: Array<{
    status: number;
    data?: any;
    error?: string;
  }>;
}

// SRS Algorithm Types
export interface SrsAlgorithmConfig {
  initialInterval: number;
  easyFactor: number;
  hardFactor: number;
  maxInterval: number;
  minInterval: number;
}

export interface SrsReviewResult {
  cardId: number;
  correct: boolean;
  responseTime?: number;
  studyTime?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
}

// Authentication Types
export interface LoginRequest {
  email: string;
  password: string;
  deviceInfo?: DeviceInfo;
}

export interface LoginResponse {
  user: Omit<User, 'password'>;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
  deviceRegistered?: boolean;
}

export interface RegisterRequest {
  email: string;
  password: string;
  preferences?: UserPreferences;
  deviceInfo?: DeviceInfo;
}

export interface JwtPayload {
  userId: number;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

// Quiz and Learning Types
export interface QuizQuestion {
  id: number;
  word: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  audioUrl?: string;
}

export interface QuizResult {
  questionId: number;
  selectedAnswer: string;
  isCorrect: boolean;
  responseTime: number;
}

// Sync Types
export interface SyncChanges {
  srsCompletions?: SrsReviewResult[];
  progressUpdates?: Array<{
    vocabId: number;
    isLearned: boolean;
    difficulty: string;
    lastStudiedAt: Date;
    studyCount: number;
    totalStudyTime: number;
  }>;
  newFolders?: Array<{
    name: string;
    vocabIds: number[];
    settings?: any;
  }>;
}

export interface IncrementalSyncResponse {
  vocabs: Array<{
    id: number;
    word: string;
    level: string;
    pos: string;
    frequency: number;
    definition: string;
    pronunciation: string;
    examples: Example[];
    audio: any;
    categories: Category[];
    action: 'created' | 'updated';
    lastModified: Date;
  }>;
  srsCards: Array<{
    id: number;
    vocabId: number;
    word: string;
    level: number;
    status: string;
    nextDue: Date;
    lastStudied?: Date;
    correctCount: number;
    incorrectCount: number;
    action: 'created' | 'updated';
    lastModified: Date;
  }>;
  progress: Array<{
    id: number;
    vocabId: number;
    word: string;
    isLearned: boolean;
    difficulty: string;
    lastStudiedAt?: Date;
    studyCount: number;
    totalStudyTime: number;
    action: 'created' | 'updated';
    lastModified: Date;
  }>;
  deletedItems: Array<{
    id: number;
    type: 'vocab' | 'srsCard' | 'progress';
    deletedAt: Date;
  }>;
  syncTime: string;
  hasMore: boolean;
}

// Utility Types
export type CreateUserData = Omit<User, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateUserData = Partial<Omit<User, 'id' | 'email' | 'createdAt'>>;
export type UserWithoutPassword = Omit<User, 'password'>;

// Express Request Extensions
export interface AuthenticatedRequest extends Request {
  user: UserWithoutPassword;
}

export interface MobileRequest extends AuthenticatedRequest {
  deviceInfo?: DeviceInfo;
  networkType?: string;
  optimizeForSlowNetwork?: boolean;
  isBatchRequest?: boolean;
  batchRequests?: any[];
}

// Service Response Types
export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Error Types
export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

// Configuration Types
export interface AppConfig {
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  corsOrigin: string[];
  nodeEnv: 'development' | 'production' | 'test';
  redisUrl?: string;
  googleCloudKeyFile?: string;
}

export interface DatabaseConfig {
  url: string;
  maxConnections: number;
  connectionTimeout: number;
}

export interface RedisConfig {
  url: string;
  maxRetries: number;
  retryDelayMs: number;
}