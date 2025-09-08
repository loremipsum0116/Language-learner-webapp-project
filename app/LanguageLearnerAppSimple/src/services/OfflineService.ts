// src/services/OfflineService.ts
// 오프라인 기능 관리 서비스

import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { database } from '../database/sqlite/Database';
import { vocabularyModel } from '../database/models/VocabularyModel';
import { cardModel, CardWithVocab } from '../database/models/CardModel';
import { studySessionModel, StudySessionRecord } from '../database/models/StudySessionModel';
import { userProgressModel, UserProgressRecord } from '../database/models/UserProgressModel';
import { audioFileModel, AudioFileRecord } from '../database/models/AudioFileModel';
import { syncService } from './SyncService';
import {
  OfflineData, 
  OfflineDataSummary, 
  OfflineStorageConfig,
  DataSyncResult,
  StudySession,
  UserProgress,
  AudioFile
} from '../types/OfflineDataTypes';

interface OfflineState {
  isOffline: boolean;
  lastOnlineTime: string;
  pendingSyncItems: number;
  offlineCapabilities: string[];
  storageConfig: OfflineStorageConfig;
}

interface OfflineQuizSession {
  id: string;
  cards: CardWithVocab[];
  answers: OfflineQuizAnswer[];
  startedAt: string;
  completedAt?: string;
  type: 'srs' | 'review' | 'practice';
}

interface OfflineQuizAnswer {
  cardId: number;
  vocabId: number;
  question: string;
  userAnswer?: string;
  correctAnswer: string;
  isCorrect: boolean;
  timeTaken: number; // milliseconds
  answeredAt: string;
}

export class OfflineService {
  private static instance: OfflineService;
  private isOffline: boolean = false;
  private lastOnlineTime: string = new Date().toISOString();
  private offlineCapabilities: Set<string> = new Set();
  private currentQuizSession: OfflineQuizSession | null = null;
  private storageConfig: OfflineStorageConfig = {
    maxVocabularies: 10000,
    maxStudySessions: 500,
    maxAudioFiles: 1000,
    audioQuality: 'medium',
    autoDownloadAudio: false,
    syncFrequency: 30,
    retentionDays: 30,
    compressionEnabled: true,
  };

  private constructor() {
    this.initializeOfflineCapabilities();
    this.initializeNetworkMonitoring();
  }

  public static getInstance(): OfflineService {
    if (!OfflineService.instance) {
      OfflineService.instance = new OfflineService();
    }
    return OfflineService.instance;
  }

  // Initialize service
  public async initialize(): Promise<void> {
    try {
      // Restore offline state and config
      await this.restoreOfflineState();
      await this.loadStorageConfig();
      
      // Initialize database
      await database.initialize();
      
      // Initialize all models
      await studySessionModel.createTable();
      await userProgressModel.createTable();
      await audioFileModel.createTable();
      
      console.log('OfflineService initialized with enhanced data management');
    } catch (error) {
      console.error('OfflineService initialization failed:', error);
      throw error;
    }
  }

  // Get current offline state
  public getOfflineState(): OfflineState {
    return {
      isOffline: this.isOffline,
      lastOnlineTime: this.lastOnlineTime,
      pendingSyncItems: 0, // TODO: Get from sync queue
      offlineCapabilities: Array.from(this.offlineCapabilities),
      storageConfig: this.storageConfig,
    };
  }

  // Update storage configuration
  public async updateStorageConfig(config: Partial<OfflineStorageConfig>): Promise<void> {
    this.storageConfig = { ...this.storageConfig, ...config };
    await this.saveStorageConfig();
    console.log('Storage config updated:', this.storageConfig);
  }

  // Get comprehensive offline data
  public async getOfflineData(): Promise<OfflineData> {
    try {
      const vocabularies = await vocabularyModel.search({ limit: this.storageConfig.maxVocabularies });
      const studySessions = await studySessionModel.getCompletedSessions({ limit: this.storageConfig.maxStudySessions });
      const currentProgress = await userProgressModel.getCurrentProgress();
      const audioFiles = await audioFileModel.getDownloadedAudioFiles();

      return {
        vocabularies: vocabularies as any[],
        studySessions: studySessions as StudySession[],
        userProgress: currentProgress as UserProgress || this.createDefaultProgress(),
        audioFiles: audioFiles as AudioFile[],
      };
    } catch (error) {
      console.error('Error getting offline data:', error);
      return {
        vocabularies: [],
        studySessions: [],
        userProgress: this.createDefaultProgress(),
        audioFiles: [],
      };
    }
  }

  // Get offline data summary
  public async getOfflineDataSummary(): Promise<OfflineDataSummary> {
    try {
      // Vocabulary stats
      const vocabStats = await vocabularyModel.getStatistics();
      const cardStats = await cardModel.getStatistics();
      
      // Study session stats
      const sessionStats = await studySessionModel.getSessionStatistics({ days: 30 });
      
      // User progress
      const currentProgress = await userProgressModel.getCurrentProgress();
      const progressStats = await userProgressModel.getProgressStatistics(7);
      
      // Audio file stats
      const audioStats = await audioFileModel.getAudioStorageStats();
      
      // Storage usage
      const storageUsed = await this.calculateStorageUsage();
      
      return {
        vocabularies: {
          total: vocabStats.total,
          new: cardStats.new,
          learning: cardStats.learning,
          mastered: cardStats.mastered,
          lastUpdated: new Date().toISOString(),
        },
        studySessions: {
          total: sessionStats.totalSessions,
          thisWeek: sessionStats.dailyStats.length,
          thisMonth: sessionStats.totalSessions,
          averageAccuracy: sessionStats.averageAccuracy,
          totalStudyTime: sessionStats.totalStudyTime,
        },
        userProgress: {
          currentLevel: currentProgress?.level || 1,
          experiencePoints: currentProgress?.experience_points || 0,
          streakDays: currentProgress?.streak_days || 0,
          weeklyGoalProgress: currentProgress?.weekly_goal_progress || 0,
          monthlyGoalProgress: currentProgress?.monthly_goal_progress || 0,
        },
        audioFiles: {
          total: audioStats.totalFiles,
          downloaded: audioStats.downloadedFiles,
          totalSize: audioStats.totalSize,
          availableOffline: audioStats.downloadedFiles,
        },
        lastSyncTime: this.lastOnlineTime,
        pendingSyncItems: 0, // TODO: Get from sync queue
        storageUsed,
      };
    } catch (error) {
      console.error('Error getting offline data summary:', error);
      return this.getDefaultDataSummary();
    }
  }

  // Check if feature is available offline
  public isFeatureAvailable(feature: string): boolean {
    return this.offlineCapabilities.has(feature);
  }

  // Download data for offline use
  public async downloadForOfflineUse(options: {
    vocabularyCount?: number;
    cardCount?: number;
    includeDefinitions?: boolean;
    includeExamples?: boolean;
    difficultyLevels?: number[];
  } = {}): Promise<{
    vocabularies: number;
    cards: number;
    totalSize: number;
  }> {
    const {
      vocabularyCount = 1000,
      cardCount = 500,
      includeDefinitions = true,
      includeExamples = true,
      difficultyLevels = [1, 2, 3],
    } = options;

    try {
      console.log('Starting offline data download...');
      
      let downloadedVocabs = 0;
      let downloadedCards = 0;

      // Download vocabularies if online
      if (!this.isOffline) {
        // TODO: Implement API call to download vocabularies
        // For now, we'll use mock data or existing local data
        const existingVocabs = await vocabularyModel.count();
        console.log(`${existingVocabs} vocabularies already available offline`);
        downloadedVocabs = existingVocabs;
      }

      // Download cards if online
      if (!this.isOffline) {
        // TODO: Implement API call to download user's cards
        // For now, we'll use existing local data
        const existingCards = await cardModel.count();
        console.log(`${existingCards} cards already available offline`);
        downloadedCards = existingCards;
      }

      // Calculate approximate size
      const totalSize = this.estimateDataSize(downloadedVocabs, downloadedCards);

      // Save download info
      await this.saveOfflineDataInfo({
        vocabularies: downloadedVocabs,
        cards: downloadedCards,
        downloadedAt: new Date().toISOString(),
        totalSize,
      });

      console.log('Offline data download completed');
      
      return {
        vocabularies: downloadedVocabs,
        cards: downloadedCards,
        totalSize,
      };
    } catch (error) {
      console.error('Error downloading offline data:', error);
      throw error;
    }
  }

  // Start offline quiz session
  public async startOfflineQuiz(type: 'srs' | 'review' | 'practice' = 'srs'): Promise<OfflineQuizSession> {
    try {
      let cards: CardWithVocab[] = [];

      switch (type) {
        case 'srs':
          // Get due cards for SRS
          const dueCards = await cardModel.getDueCards(20);
          const newCards = await cardModel.getNewCards(5);
          cards = [...dueCards, ...newCards];
          break;
        case 'review':
          // Get cards for review
          cards = await cardModel.getOverdueCards(20);
          break;
        case 'practice':
          // Get random cards for practice
          const reviewCards = await cardModel.getReviewCards(20);
          cards = reviewCards;
          break;
      }

      if (cards.length === 0) {
        throw new Error(`No cards available for ${type} quiz`);
      }

      // Create quiz session
      this.currentQuizSession = {
        id: this.generateSessionId(),
        cards,
        answers: [],
        startedAt: new Date().toISOString(),
        type,
      };

      console.log(`Started offline ${type} quiz with ${cards.length} cards`);
      
      return this.currentQuizSession;
    } catch (error) {
      console.error('Error starting offline quiz:', error);
      throw error;
    }
  }

  // Submit answer in offline quiz
  public async submitOfflineAnswer(
    cardId: number,
    userAnswer: string,
    isCorrect: boolean,
    timeTaken: number
  ): Promise<void> {
    if (!this.currentQuizSession) {
      throw new Error('No active quiz session');
    }

    try {
      const card = this.currentQuizSession.cards.find(c => c.id === cardId);
      if (!card) {
        throw new Error(`Card ${cardId} not found in current session`);
      }

      // Create answer record
      const answer: OfflineQuizAnswer = {
        cardId,
        vocabId: card.vocab_id,
        question: card.vocab_lemma, // Use lemma as question for now
        userAnswer,
        correctAnswer: card.vocab_definition || card.vocab_lemma,
        isCorrect,
        timeTaken,
        answeredAt: new Date().toISOString(),
      };

      // Add to session answers
      this.currentQuizSession.answers.push(answer);

      // Update card locally (offline SRS algorithm)
      await this.updateCardOffline(cardId, isCorrect);

      console.log(`Answer submitted for card ${cardId}: ${isCorrect ? 'correct' : 'incorrect'}`);
    } catch (error) {
      console.error('Error submitting offline answer:', error);
      throw error;
    }
  }

  // Complete offline quiz session
  public async completeOfflineQuiz(): Promise<{
    sessionId: string;
    totalQuestions: number;
    correctAnswers: number;
    wrongAnswers: number;
    accuracy: number;
    timeSpent: number;
  }> {
    if (!this.currentQuizSession) {
      throw new Error('No active quiz session');
    }

    try {
      // Mark session as completed
      this.currentQuizSession.completedAt = new Date().toISOString();

      // Calculate results
      const totalQuestions = this.currentQuizSession.answers.length;
      const correctAnswers = this.currentQuizSession.answers.filter(a => a.isCorrect).length;
      const wrongAnswers = totalQuestions - correctAnswers;
      const accuracy = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
      
      const startTime = new Date(this.currentQuizSession.startedAt);
      const endTime = new Date(this.currentQuizSession.completedAt);
      const timeSpent = Math.floor((endTime.getTime() - startTime.getTime()) / 1000); // seconds

      // Save session to database for sync
      await this.saveOfflineQuizSession(this.currentQuizSession);

      const result = {
        sessionId: this.currentQuizSession.id,
        totalQuestions,
        correctAnswers,
        wrongAnswers,
        accuracy: Math.round(accuracy * 100) / 100,
        timeSpent,
      };

      console.log('Offline quiz completed:', result);

      // Clear current session
      this.currentQuizSession = null;

      return result;
    } catch (error) {
      console.error('Error completing offline quiz:', error);
      throw error;
    }
  }

  // Get offline vocabulary for study
  public async getOfflineVocabulary(options: {
    limit?: number;
    difficulty?: number;
    hasCards?: boolean;
    searchQuery?: string;
  } = {}): Promise<any[]> {
    const {
      limit = 50,
      difficulty,
      hasCards,
      searchQuery,
    } = options;

    try {
      let vocabularies = await vocabularyModel.search({
        query: searchQuery,
        difficulty,
        limit,
      });

      if (hasCards) {
        // Filter vocabularies that have associated cards
        const vocabsWithCards = [];
        for (const vocab of vocabularies) {
          const cards = await cardModel.getByVocabId(vocab.id!);
          if (cards.length > 0) {
            vocabsWithCards.push({
              ...vocab,
              cards,
            });
          }
        }
        return vocabsWithCards;
      }

      return vocabularies;
    } catch (error) {
      console.error('Error getting offline vocabulary:', error);
      throw error;
    }
  }

  // Get offline progress data
  public async getOfflineProgress(): Promise<{
    studyStreak: number;
    totalStudied: number;
    masteredCards: number;
    accuracyRate: number;
    weeklyProgress: number[];
  }> {
    try {
      const cardStats = await cardModel.getStatistics();
      const currentProgress = await userProgressModel.getCurrentProgress();
      const progressStats = await userProgressModel.getProgressStatistics(7);
      
      const progress = {
        studyStreak: currentProgress?.streak_days || 0,
        totalStudied: cardStats.total - cardStats.new,
        masteredCards: cardStats.mastered,
        accuracyRate: cardStats.accuracy,
        weeklyProgress: progressStats.levelProgression.slice(-7).map(p => p.level),
      };

      return progress;
    } catch (error) {
      console.error('Error getting offline progress:', error);
      throw error;
    }
  }

  // Sync core learning data
  public async syncCoreData(): Promise<DataSyncResult> {
    const result: DataSyncResult = {
      success: false,
      syncedItems: {
        vocabularies: { uploaded: 0, downloaded: 0, conflicts: 0 },
        studySessions: { uploaded: 0, downloaded: 0, conflicts: 0 },
        userProgress: { uploaded: 0, downloaded: 0, conflicts: 0 },
        audioFiles: { uploaded: 0, downloaded: 0, conflicts: 0 },
      },
      errors: [],
      warnings: [],
      totalTime: 0,
      timestamp: new Date().toISOString(),
    };

    const startTime = Date.now();

    try {
      if (this.isOffline) {
        throw new Error('Cannot sync while offline');
      }

      // Sync vocabularies
      try {
        const vocabSync = await syncService.syncNow(['vocabularies']);
        result.syncedItems.vocabularies.uploaded = vocabSync.uploadedRecords;
        result.syncedItems.vocabularies.downloaded = vocabSync.downloadedRecords;
      } catch (error) {
        result.errors.push(`Vocabulary sync failed: ${error}`);
      }

      // Sync study sessions
      try {
        const sessionSync = await this.syncStudySessions();
        result.syncedItems.studySessions = sessionSync;
      } catch (error) {
        result.errors.push(`Study session sync failed: ${error}`);
      }

      // Sync user progress
      try {
        const progressSync = await this.syncUserProgress();
        result.syncedItems.userProgress = progressSync;
      } catch (error) {
        result.errors.push(`User progress sync failed: ${error}`);
      }

      // Sync audio files metadata (not actual files)
      try {
        const audioSync = await this.syncAudioMetadata();
        result.syncedItems.audioFiles = audioSync;
      } catch (error) {
        result.errors.push(`Audio metadata sync failed: ${error}`);
      }

      result.success = result.errors.length === 0;
      result.totalTime = Date.now() - startTime;

      console.log('Core data sync completed:', result);
      return result;
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : String(error));
      result.totalTime = Date.now() - startTime;
      console.error('Core data sync failed:', error);
      return result;
    }
  }

  // Download audio files for offline use
  public async downloadAudioFiles(
    options: {
      quality?: 'low' | 'medium' | 'high';
      maxFiles?: number;
      maxSize?: number; // bytes
    } = {},
    onProgress?: (completed: number, total: number) => void
  ): Promise<{ successful: number; failed: number; totalSize: number }> {
    const { quality = this.storageConfig.audioQuality, maxFiles = 50, maxSize = 100 * 1024 * 1024 } = options;

    try {
      const audioFilesToDownload = await audioFileModel.getAudioFilesNeedingDownload(quality, maxFiles);
      
      if (audioFilesToDownload.length === 0) {
        return { successful: 0, failed: 0, totalSize: 0 };
      }

      // Filter by size limit
      let currentSize = 0;
      const filteredFiles: AudioFileRecord[] = [];
      
      for (const audioFile of audioFilesToDownload) {
        if (currentSize + audioFile.file_size <= maxSize) {
          filteredFiles.push(audioFile);
          currentSize += audioFile.file_size;
        } else {
          break;
        }
      }

      console.log(`Starting download of ${filteredFiles.length} audio files`);
      
      const result = await audioFileModel.batchDownloadAudio(
        filteredFiles.map(f => f.id),
        onProgress
      );

      return {
        successful: result.successful,
        failed: result.failed,
        totalSize: currentSize,
      };
    } catch (error) {
      console.error('Error downloading audio files:', error);
      return { successful: 0, failed: 0, totalSize: 0 };
    }
  }

  // Clean up old offline data
  public async cleanupOfflineData(): Promise<{
    sessionsRemoved: number;
    progressRemoved: number;
    audioRemoved: number;
  }> {
    try {
      const sessionsRemoved = await studySessionModel.cleanupOldSessions(this.storageConfig.retentionDays);
      const progressRemoved = await userProgressModel.cleanupOldProgress(365); // Keep progress for 1 year
      const audioRemoved = await audioFileModel.cleanupOldAudio(this.storageConfig.retentionDays);

      console.log(`Cleanup completed: ${sessionsRemoved} sessions, ${progressRemoved} progress, ${audioRemoved} audio files`);
      
      return {
        sessionsRemoved,
        progressRemoved,
        audioRemoved,
      };
    } catch (error) {
      console.error('Error cleaning up offline data:', error);
      return {
        sessionsRemoved: 0,
        progressRemoved: 0,
        audioRemoved: 0,
      };
    }
  }

  // Private methods
  private initializeOfflineCapabilities(): void {
    // Define which features are available offline
    this.offlineCapabilities.add('vocabulary_browse');
    this.offlineCapabilities.add('srs_quiz');
    this.offlineCapabilities.add('review_quiz');
    this.offlineCapabilities.add('practice_quiz');
    this.offlineCapabilities.add('progress_view');
    this.offlineCapabilities.add('card_management');
    this.offlineCapabilities.add('study_statistics');
  }

  private initializeNetworkMonitoring(): void {
    NetInfo.addEventListener(state => {
      const wasOffline = this.isOffline;
      this.isOffline = !state.isConnected;

      if (this.isOffline && !wasOffline) {
        console.log('Device went offline');
        this.lastOnlineTime = new Date().toISOString();
        this.saveOfflineState();
      } else if (!this.isOffline && wasOffline) {
        console.log('Device came online');
        this.onNetworkReconnect();
      }
    });
  }

  private async onNetworkReconnect(): Promise<void> {
    try {
      // Attempt to sync pending data
      if (syncService.isOnlineMode()) {
        console.log('Attempting to sync offline changes...');
        await syncService.syncNow();
      }
    } catch (error) {
      console.error('Error syncing on reconnect:', error);
    }
  }

  private async updateCardOffline(cardId: number, isCorrect: boolean): Promise<void> {
    try {
      const card = await cardModel.findById(cardId);
      if (!card) return;

      // Simple offline SRS algorithm
      const nextReviewHours = this.calculateOfflineNextReview(card.stage, isCorrect);
      const nextReviewAt = new Date();
      nextReviewAt.setHours(nextReviewAt.getHours() + nextReviewHours);

      await cardModel.updateAfterAnswer(
        cardId,
        isCorrect,
        nextReviewAt.toISOString()
      );
    } catch (error) {
      console.error('Error updating card offline:', error);
    }
  }

  private calculateOfflineNextReview(stage: number, isCorrect: boolean): number {
    // Simplified SRS intervals for offline use
    const intervals = [1, 4, 24, 72, 168, 720, 2160]; // hours
    let newStage = isCorrect ? Math.min(stage + 1, 6) : Math.max(0, Math.floor(stage / 2));
    return intervals[newStage];
  }

  private generateSessionId(): string {
    return `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private estimateDataSize(vocabs: number, cards: number): number {
    // Rough estimate: 1KB per vocabulary, 500B per card
    return vocabs * 1024 + cards * 512;
  }

  private async saveOfflineQuizSession(session: OfflineQuizSession): Promise<void> {
    try {
      // Save to local storage for sync later
      await AsyncStorage.setItem(
        `@offline_session_${session.id}`,
        JSON.stringify(session)
      );
    } catch (error) {
      console.error('Error saving offline quiz session:', error);
    }
  }

  private async restoreOfflineState(): Promise<void> {
    try {
      const stateStr = await AsyncStorage.getItem('@offline_state');
      if (stateStr) {
        const state = JSON.parse(stateStr);
        this.lastOnlineTime = state.lastOnlineTime || new Date().toISOString();
      }
    } catch (error) {
      console.error('Error restoring offline state:', error);
    }
  }

  private async saveOfflineState(): Promise<void> {
    try {
      const state = {
        lastOnlineTime: this.lastOnlineTime,
        isOffline: this.isOffline,
      };
      await AsyncStorage.setItem('@offline_state', JSON.stringify(state));
    } catch (error) {
      console.error('Error saving offline state:', error);
    }
  }

  private async saveOfflineDataInfo(info: any): Promise<void> {
    try {
      await AsyncStorage.setItem('@offline_data_info', JSON.stringify(info));
    } catch (error) {
      console.error('Error saving offline data info:', error);
    }
  }

  // Private helper methods for enhanced functionality
  private createDefaultProgress(): UserProgress {
    const now = new Date().toISOString();
    const today = now.split('T')[0];
    
    return {
      id: 0,
      date: today,
      total_studied: 0,
      new_words_learned: 0,
      review_completed: 0,
      correct_rate: 0,
      study_time: 0,
      streak_days: 0,
      level: 1,
      experience_points: 0,
      mastered_vocabs: 0,
      learning_vocabs: 0,
      new_vocabs: 0,
      weekly_goal_progress: 0,
      monthly_goal_progress: 0,
      achievements_unlocked: [],
      created_at: now,
      updated_at: now,
      is_deleted: 0,
    };
  }

  private getDefaultDataSummary(): OfflineDataSummary {
    return {
      vocabularies: {
        total: 0,
        new: 0,
        learning: 0,
        mastered: 0,
        lastUpdated: new Date().toISOString(),
      },
      studySessions: {
        total: 0,
        thisWeek: 0,
        thisMonth: 0,
        averageAccuracy: 0,
        totalStudyTime: 0,
      },
      userProgress: {
        currentLevel: 1,
        experiencePoints: 0,
        streakDays: 0,
        weeklyGoalProgress: 0,
        monthlyGoalProgress: 0,
      },
      audioFiles: {
        total: 0,
        downloaded: 0,
        totalSize: 0,
        availableOffline: 0,
      },
      lastSyncTime: new Date().toISOString(),
      pendingSyncItems: 0,
      storageUsed: 0,
    };
  }

  private async calculateStorageUsage(): Promise<number> {
    try {
      const audioStats = await audioFileModel.getAudioStorageStats();
      // Rough estimate: vocabulary + cards + sessions + progress + audio
      const vocabSize = await vocabularyModel.count() * 2048; // ~2KB per vocabulary
      const cardSize = await cardModel.count() * 1024; // ~1KB per card
      const sessionSize = 1024 * 1024; // Rough estimate for all sessions
      const progressSize = 50 * 1024; // Rough estimate for progress data
      
      return vocabSize + cardSize + sessionSize + progressSize + audioStats.downloadedSize;
    } catch (error) {
      console.error('Error calculating storage usage:', error);
      return 0;
    }
  }

  private async syncStudySessions(): Promise<{ uploaded: number; downloaded: number; conflicts: number }> {
    // Placeholder for study session sync implementation
    // This would involve uploading local sessions and downloading server sessions
    return { uploaded: 0, downloaded: 0, conflicts: 0 };
  }

  private async syncUserProgress(): Promise<{ uploaded: number; downloaded: number; conflicts: number }> {
    // Placeholder for user progress sync implementation
    // This would involve uploading local progress and downloading server progress
    return { uploaded: 0, downloaded: 0, conflicts: 0 };
  }

  private async syncAudioMetadata(): Promise<{ uploaded: number; downloaded: number; conflicts: number }> {
    // Placeholder for audio metadata sync implementation
    // This would sync audio file records but not the actual audio files
    return { uploaded: 0, downloaded: 0, conflicts: 0 };
  }

  private async saveStorageConfig(): Promise<void> {
    try {
      await AsyncStorage.setItem('@storage_config', JSON.stringify(this.storageConfig));
    } catch (error) {
      console.error('Error saving storage config:', error);
    }
  }

  private async loadStorageConfig(): Promise<void> {
    try {
      const configStr = await AsyncStorage.getItem('@storage_config');
      if (configStr) {
        const config = JSON.parse(configStr);
        this.storageConfig = { ...this.storageConfig, ...config };
      }
    } catch (error) {
      console.error('Error loading storage config:', error);
    }
  }
}

// Export singleton instance
export const offlineService = OfflineService.getInstance();
export default OfflineService;