// Core shared types for the Language Learner application

// Base Entity Type
export interface BaseEntity {
  id: number;
  createdAt: Date;
  updatedAt?: Date;
}

// User Domain Types
export interface User extends BaseEntity {
  email: string;
  passwordHash: string;
  role: UserRole;
  preferences?: UserPreferences;
  lastLoginAt?: Date;
  totalWords?: number;
  studyStreak?: number;
  lastStudyDate?: Date;
  level?: string;
  subscriptionType?: string;
  subscriptionExpiresAt?: Date;
  registrationSource?: string;
  deletedAt?: Date;
}

export type UserRole = 'USER' | 'ADMIN';

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

// Vocabulary Domain Types
export interface Vocab extends BaseEntity {
  lemma: string;
  pos: PartOfSpeech;
  levelCEFR: CEFRLevel;
  frequency?: number;
  source?: string;
  dictentry?: DictEntry;
  categories?: Category[];
}

export type PartOfSpeech = 
  | 'noun' | 'verb' | 'adjective' | 'adverb' 
  | 'pronoun' | 'preposition' | 'conjunction' 
  | 'interjection' | 'article' | 'other';

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface DictEntry extends BaseEntity {
  vocabId: number;
  definition?: string;
  pronunciation?: string;
  audioLocal?: string;
  examples?: Example[];
}

export interface Example extends BaseEntity {
  dictEntryId: number;
  kind: ExampleKind;
  en: string;
  ko?: string;
  chirpScript?: string;
}

export type ExampleKind = 'gloss' | 'example' | 'usage';

export interface Category extends BaseEntity {
  name: string;
  color?: string;
  description?: string;
}


// Progress Tracking Types
export interface UserProgress extends BaseEntity {
  userId: number;
  vocabId: number;
  isLearned: boolean;
  difficulty?: string;
  lastStudiedAt?: Date;
  studyCount: number;
  totalStudyTime: number;
  user?: User;
  vocab?: Vocab;
}

// Authentication Types
export interface LoginRequest {
  email: string;
  password: string;
  deviceInfo?: DeviceInfo;
}

export interface LoginResponse {
  user: Omit<User, 'passwordHash'>;
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

// Device and Mobile Types
export interface DeviceInfo {
  platform?: string;
  appVersion?: string;
  deviceModel?: string;
  osVersion?: string;
  userAgent?: string;
  lastLoginAt?: Date;
  registeredAt?: Date;
  lastUsedAt?: Date;
}

export interface UserDevice extends BaseEntity {
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
  lastActiveAt?: Date;
  deactivatedAt?: Date;
  user?: User;
}

export interface RefreshToken extends BaseEntity {
  token: string;
  userId: number;
  expiresAt: Date;
  lastUsedAt?: Date;
  isRevoked: boolean;
  deviceInfo?: DeviceInfo;
  user?: User;
}

export interface UserDailyStats extends BaseEntity {
  userId: number;
  date: string; // YYYY-MM-DD format
  cardsCompleted: number;
  studyTime: number; // in seconds
  accuracy?: number;
}

// Authentication Types
export interface RefreshToken extends BaseEntity {
  token: string;
  userId: number;
  expiresAt: Date;
  lastUsedAt?: Date;
  isRevoked: boolean;
  deviceInfo?: DeviceInfo;
}

export interface DeviceInfo {
  platform?: string;
  appVersion?: string;
  deviceModel?: string;
  osVersion?: string;
  userAgent?: string;
  deviceId?: string;
  isMobile?: boolean;
  isNativeApp?: boolean;
  timestamp?: string;
}

export interface JwtPayload {
  userId: number;
  email: string;
  role: string;
  deviceId?: string;
  iat: number;
  exp: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
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

export interface ApiResponseMeta {
  version?: string;
  pagination?: PaginationInfo;
  total?: number;
}

export interface PaginationInfo {
  offset: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

// Service Response Types
export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface BusinessRuleError {
  rule: string;
  message: string;
  context?: any;
}

// Domain Events
export interface DomainEvent {
  id: string;
  type: string;
  aggregateId: string;
  aggregateType: string;
  data: any;
  timestamp: Date;
  version: number;
}

// Use Case Types
export interface UseCase<TRequest = any, TResponse = any> {
  execute(request: TRequest): Promise<ServiceResponse<TResponse>>;
}

export interface Command {
  readonly timestamp: Date;
}

export interface Query {
  readonly timestamp: Date;
}

// Repository Interfaces (for dependency inversion)
export interface Repository<T extends BaseEntity> {
  findById(id: number): Promise<T | null>;
  findAll(options?: QueryOptions): Promise<T[]>;
  create(data: Omit<T, keyof BaseEntity>): Promise<T>;
  update(id: number, data: Partial<T>): Promise<T>;
  delete(id: number): Promise<boolean>;
}

export interface QueryOptions {
  offset?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, any>;
}

// Sync Types for offline support
export interface SyncChange {
  id: string;
  entityType: string;
  entityId: number;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  data: any;
  timestamp: Date;
  version: number;
}

export interface SyncBatch {
  changes: SyncChange[];
  timestamp: Date;
  checksum: string;
}

// Configuration Types
export interface CoreConfig {
  validation: ValidationConfig;
  sync: SyncConfig;
}

export interface ValidationConfig {
  strictMode: boolean;
  customRules: Record<string, any>;
}

export interface SyncConfig {
  batchSize: number;
  maxRetries: number;
  retryDelay: number;
}

// Utility Types
export type CreateEntity<T extends BaseEntity> = Omit<T, keyof BaseEntity>;
export type UpdateEntity<T extends BaseEntity> = Partial<Omit<T, 'id' | 'createdAt'>>;
export type EntityId = number;
export type Timestamp = Date;

// Type Guards
export const isUser = (obj: any): obj is User => {
  return obj && typeof obj.email === 'string' && typeof obj.role === 'string';
};

export const isVocab = (obj: any): obj is Vocab => {
  return obj && typeof obj.lemma === 'string' && typeof obj.pos === 'string';
};

