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
  levelCEFR?: string;
  ko_gloss?: string;
  source?: string;
  frequency?: number;
  dictMeta?: {
    ipa?: string;
    ipaKo?: string;
  };
  dictentry?: DictEntry;
}

export interface DictEntry {
  id?: number;
  vocabId?: number;
  definition?: string;
  pronunciation?: string;
  audioLocal?: string;
  examples?: Example[];
}

export interface Example {
  id?: number;
  kind: 'gloss' | 'example' | 'usage';
  en?: string;
  ko?: string;
  chirpScript?: string;
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

// Component-specific types
export interface Card {
  id: number;
  stage: number;
  isMastered: boolean;
  masterCycles: number;
  masteredAt?: string;
  correctTotal: number;
  wrongTotal: number;
  isOverdue: boolean;
  overdueDeadline?: string;
  frozenUntil?: string;
  waitingUntil?: string;
  isFromWrongAnswer: boolean;
  folderId?: number;
  cardId?: number;
}

export interface VocabCardProps {
  vocab: Vocab;
  card?: Card | null;
  onPress?: () => void;
  style?: any;
  showProgress?: boolean;
  size?: 'medium' | 'large';
  onPlayAudio?: (vocab: Vocab) => void;
  playingAudio?: {
    type: string;
    id: number;
  } | null;
}

export interface RainbowStarProps {
  size?: 'small' | 'medium' | 'large' | 'xl';
  cycles?: number;
  style?: any;
  animated?: boolean;
  tooltip?: boolean;
}

export interface PronProps {
  ipa?: string;
  ipaKo?: string;
}

export interface QuizItem {
  question: string;
  answer: string;
  options?: string[];
  pron?: {
    ipa?: string;
    ipaKo?: string;
  };
  folderId?: number;
  cardId?: number;
}

export interface MiniQuizProps {
  batch: QuizItem[];
  onDone: () => void;
  folderId?: number;
  isReviewQuiz?: boolean;
}

export type SeverityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ReportType {
  value: string;
  label: string;
  description: string;
}

export interface CardReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  vocabId: number;
  vocabLemma: string;
  onReportSubmitted?: () => void;
}

// Common UI Component Props
export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  style?: any;
}

export interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
  style?: any;
}

export interface AlertBannerProps {
  type: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
  onClose?: () => void;
  style?: any;
}