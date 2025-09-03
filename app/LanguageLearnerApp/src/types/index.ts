// Core types for the Language Learner mobile app
export interface User {
  id: number;
  email: string;
  role: string;
  preferences?: UserPreferences;
  totalWords?: number;
  studyStreak?: number;
  level?: string;
}

export interface UserPreferences {
  dailyGoal?: number;
  reminderTime?: string;
  notifications?: boolean;
  offlineSync?: boolean;
  audioAutoDownload?: boolean;
  theme?: 'light' | 'dark' | 'system';
  language?: string;
}

export interface Vocab {
  id: number;
  lemma: string;
  pos: string;
  levelCEFR: string;
  frequency?: number;
  dictentry?: DictEntry;
}

export interface DictEntry {
  id: number;
  vocabId: number;
  definition?: string;
  pronunciation?: string;
  audioLocal?: string;
  examples?: Example[];
}

export interface Example {
  id: number;
  kind: 'gloss' | 'example' | 'usage';
  en: string;
  ko?: string;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  error: string | null;
}

export interface VocabState {
  vocabularies: Vocab[];
  currentVocab: Vocab | null;
  isLoading: boolean;
  error: string | null;
}

export interface ApiResponse<T = any> {
  data: T | null;
  error: string | null;
  meta: {
    timestamp: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      hasNext: boolean;
    };
  };
}

export interface LoginRequest {
  email: string;
  password: string;
  deviceInfo?: DeviceInfo;
}

export interface DeviceInfo {
  platform?: string;
  appVersion?: string;
  deviceModel?: string;
  osVersion?: string;
  deviceId?: string;
}

export interface QuizQuestion {
  id: number;
  word: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  audioUrl?: string;
}

export interface StudySession {
  id: string;
  userId: number;
  vocabIds: number[];
  startedAt: Date;
  completedAt?: Date;
  accuracy?: number;
  totalTime?: number;
}