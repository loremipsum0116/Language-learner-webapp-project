// src/types/OfflineDataTypes.ts
// 오프라인 학습 데이터 타입 정의

export interface Vocab {
  id: number;
  server_id?: string;
  lemma: string;
  definition: string;
  pronunciation?: string;
  part_of_speech?: string;
  difficulty_level: number;
  frequency_rank?: number;
  example?: string;
  translation?: string;
  audio_url?: string;
  audio_file_path?: string;
  image_url?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
  synced_at?: string;
  is_deleted: number;
}

export interface StudySession {
  id: number;
  server_id?: string;
  session_type: 'srs' | 'review' | 'practice' | 'vocabulary_browse';
  started_at: string;
  completed_at?: string;
  total_questions: number;
  correct_answers: number;
  wrong_answers: number;
  accuracy_rate: number;
  time_spent: number; // seconds
  vocab_ids: number[];
  card_ids: number[];
  answers: StudyAnswer[];
  user_id?: string;
  created_at: string;
  updated_at: string;
  synced_at?: string;
  is_deleted: number;
}

export interface StudyAnswer {
  vocab_id: number;
  card_id: number;
  question: string;
  user_answer?: string;
  correct_answer: string;
  is_correct: boolean;
  time_taken: number; // milliseconds
  answered_at: string;
  hint_used: boolean;
  difficulty_adjustment?: number;
}

export interface UserProgress {
  id: number;
  server_id?: string;
  user_id?: string;
  date: string; // YYYY-MM-DD format
  total_studied: number;
  new_words_learned: number;
  review_completed: number;
  correct_rate: number;
  study_time: number; // seconds
  streak_days: number;
  level: number;
  experience_points: number;
  mastered_vocabs: number;
  learning_vocabs: number;
  new_vocabs: number;
  weekly_goal_progress: number; // percentage
  monthly_goal_progress: number; // percentage
  achievements_unlocked?: string[];
  created_at: string;
  updated_at: string;
  synced_at?: string;
  is_deleted: number;
}

export interface AudioFile {
  id: number;
  server_id?: string;
  vocab_id: number;
  file_name: string;
  file_path: string;
  file_size: number;
  duration?: number; // seconds
  quality: 'low' | 'medium' | 'high';
  format: 'mp3' | 'wav' | 'm4a';
  download_url: string;
  is_downloaded: boolean;
  download_date?: string;
  checksum?: string;
  created_at: string;
  updated_at: string;
  synced_at?: string;
  is_deleted: number;
}

export interface OfflineData {
  vocabularies: Vocab[];
  studySessions: StudySession[];
  userProgress: UserProgress;
  audioFiles: AudioFile[];
}

export interface OfflineDataSummary {
  vocabularies: {
    total: number;
    new: number;
    learning: number;
    mastered: number;
    lastUpdated: string;
  };
  studySessions: {
    total: number;
    thisWeek: number;
    thisMonth: number;
    averageAccuracy: number;
    totalStudyTime: number;
  };
  userProgress: {
    currentLevel: number;
    experiencePoints: number;
    streakDays: number;
    weeklyGoalProgress: number;
    monthlyGoalProgress: number;
  };
  audioFiles: {
    total: number;
    downloaded: number;
    totalSize: number;
    availableOffline: number;
  };
  lastSyncTime: string;
  pendingSyncItems: number;
  storageUsed: number; // bytes
}

export interface SyncQueueItem {
  id: number;
  table_name: string;
  record_id: number;
  action: 'insert' | 'update' | 'delete';
  data: any;
  priority: number;
  retry_count: number;
  max_retries: number;
  created_at: string;
  updated_at: string;
  error_message?: string;
}

export interface DataSyncResult {
  success: boolean;
  syncedItems: {
    vocabularies: { uploaded: number; downloaded: number; conflicts: number };
    studySessions: { uploaded: number; downloaded: number; conflicts: number };
    userProgress: { uploaded: number; downloaded: number; conflicts: number };
    audioFiles: { uploaded: number; downloaded: number; conflicts: number };
  };
  errors: string[];
  warnings: string[];
  totalTime: number;
  timestamp: string;
}

export interface OfflineStorageConfig {
  maxVocabularies: number;
  maxStudySessions: number;
  maxAudioFiles: number;
  audioQuality: 'low' | 'medium' | 'high';
  autoDownloadAudio: boolean;
  syncFrequency: number; // minutes
  retentionDays: number;
  compressionEnabled: boolean;
}

export interface ConflictResolutionStrategy {
  vocabularies: 'server' | 'client' | 'merge' | 'manual';
  studySessions: 'server' | 'client' | 'merge' | 'manual';
  userProgress: 'server' | 'client' | 'merge' | 'manual';
  audioFiles: 'server' | 'client' | 'merge' | 'manual';
}