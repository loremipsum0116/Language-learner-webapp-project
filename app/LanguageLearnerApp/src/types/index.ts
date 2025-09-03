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

// New types for missing functionality

// Quiz System Types
export interface Quiz {
  id: number;
  title: string;
  description?: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questions: QuizQuestion[];
  timeLimit?: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuizResult {
  id: number;
  userId: number;
  quizId: number;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  timeSpent: number;
  completedAt: string;
  answers: QuizAnswer[];
}

export interface QuizAnswer {
  questionId: number;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  timeSpent: number;
}

// Reading Comprehension Types
export interface ReadingPassage {
  id: number;
  title: string;
  content: string;
  level: string;
  category: string;
  author?: string;
  questions: ReadingQuestion[];
  wordCount: number;
  estimatedTime: number;
  createdAt: string;
}

export interface ReadingQuestion {
  id: number;
  passageId: number;
  question: string;
  type: 'multiple-choice' | 'true-false' | 'fill-blank' | 'short-answer';
  options?: string[];
  correctAnswer: string;
  explanation?: string;
}

export interface ReadingProgress {
  id: number;
  userId: number;
  passageId: number;
  completed: boolean;
  score?: number;
  timeSpent: number;
  answers: ReadingAnswer[];
  completedAt?: string;
}

export interface ReadingAnswer {
  questionId: number;
  userAnswer: string;
  isCorrect: boolean;
}

// Listening Comprehension Types
export interface ListeningExercise {
  id: number;
  title: string;
  description?: string;
  level: string;
  category: string;
  audioUrl: string;
  transcript?: string;
  duration: number;
  questions: ListeningQuestion[];
  createdAt: string;
}

export interface ListeningQuestion {
  id: number;
  exerciseId: number;
  question: string;
  type: 'multiple-choice' | 'true-false' | 'fill-blank';
  options?: string[];
  correctAnswer: string;
  timestamp?: number;
  explanation?: string;
}

export interface ListeningProgress {
  id: number;
  userId: number;
  exerciseId: number;
  completed: boolean;
  score?: number;
  timeSpent: number;
  answers: ListeningAnswer[];
  completedAt?: string;
}

export interface ListeningAnswer {
  questionId: number;
  userAnswer: string;
  isCorrect: boolean;
}

// Dictionary Types
export interface DictionaryEntry {
  id: number;
  word: string;
  pronunciation?: string;
  phonetic?: string;
  partOfSpeech: string;
  definitions: Definition[];
  examples: string[];
  audioUrl?: string;
  frequency?: number;
  level?: string;
}

export interface Definition {
  id: number;
  meaning: string;
  translation?: string;
  synonyms?: string[];
  antonyms?: string[];
  usage?: string;
}

export interface DictionarySearchResult {
  entries: DictionaryEntry[];
  suggestions?: string[];
  totalFound: number;
}

// Exam Vocabulary Types
export interface ExamCategory {
  id: number;
  name: string;
  description?: string;
  examType: 'TOEFL' | 'IELTS' | 'SAT' | 'GRE' | 'TOEIC';
  level?: string;
}

export interface ExamVocab {
  id: number;
  word: string;
  definition: string;
  pronunciation?: string;
  partOfSpeech: string;
  examCategory: ExamCategory;
  frequency: number;
  difficulty: number;
  examples: string[];
  audioUrl?: string;
}

// Idioms and Phrasal Verbs Types
export interface Idiom {
  id: number;
  phrase: string;
  meaning: string;
  translation?: string;
  category: string;
  usage: string;
  examples: string[];
  audioUrl?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  frequency?: number;
}

export interface PhrasalVerb {
  id: number;
  verb: string;
  particle: string;
  meaning: string;
  translation?: string;
  type: 'separable' | 'inseparable' | 'both';
  examples: string[];
  audioUrl?: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

// Personal Collections Types
export interface Wordbook {
  id: number;
  userId: number;
  name: string;
  description?: string;
  isPublic: boolean;
  words: WordbookEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface WordbookEntry {
  id: number;
  wordbookId: number;
  vocabId: number;
  vocab: Vocab;
  notes?: string;
  mastered: boolean;
  addedAt: string;
}

export interface IdiomCollection {
  id: number;
  userId: number;
  name: string;
  description?: string;
  isPublic: boolean;
  idioms: IdiomCollectionEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface IdiomCollectionEntry {
  id: number;
  collectionId: number;
  idiomId: number;
  idiom: Idiom;
  notes?: string;
  mastered: boolean;
  addedAt: string;
}

// Device Management Types
export interface DeviceSession {
  id: string;
  userId: number;
  deviceId: string;
  deviceName: string;
  platform: string;
  osVersion?: string;
  appVersion?: string;
  lastActive: string;
  isCurrentDevice: boolean;
  location?: string;
  ipAddress: string;
}

// Enhanced SRS Types
export interface SRSFolder {
  id: number;
  userId: number;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  cardCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SRSCard {
  id: number;
  vocabId: number;
  vocab: Vocab;
  folderId?: number;
  folder?: SRSFolder;
  stage: number;
  nextReview: string;
  correctStreak: number;
  wrongCount: number;
  easeFactor: number;
  interval: number;
  createdAt: string;
  lastReviewed?: string;
}

export interface SRSReview {
  cardId: number;
  difficulty: 'easy' | 'medium' | 'hard';
  responseTime: number;
  isCorrect: boolean;
}

export interface SRSDashboard {
  totalCards: number;
  reviewsToday: number;
  newCardsToday: number;
  accuracy: number;
  streak: number;
  folders: SRSFolder[];
  upcomingReviews: SRSCard[];
}

// Audio System Types
export interface AudioFile {
  id: number;
  filename: string;
  url: string;
  compressedUrl?: string;
  bitrate: number;
  duration?: number;
  size: number;
  level?: string;
  category: 'vocab' | 'sentence' | 'dialogue' | 'pronunciation';
  createdAt: string;
}

export interface AudioPlaybackState {
  isPlaying: boolean;
  currentAudio?: AudioFile;
  position: number;
  duration: number;
  speed: number;
  volume: number;
}

// API Request/Response Types
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface SearchFilters {
  level?: string;
  category?: string;
  difficulty?: string;
  partOfSpeech?: string;
  limit?: number;
  offset?: number;
}