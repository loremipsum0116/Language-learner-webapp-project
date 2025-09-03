// src/services/OfflineStatsService.ts
// 오프라인 학습 통계 추적 서비스

import AsyncStorage from '@react-native-async-storage/async-storage';
import { database } from '../database/sqlite/Database';
import { studySessionModel, StudySessionRecord } from '../database/models/StudySessionModel';
import { userProgressModel, UserProgressRecord } from '../database/models/UserProgressModel';
import { vocabularyModel } from '../database/models/VocabularyModel';
import { cardModel } from '../database/models/CardModel';

export interface OfflineStatsSnapshot {
  id: string;
  timestamp: string;
  sessionType: 'daily' | 'weekly' | 'monthly' | 'custom';
  period: {
    startDate: string;
    endDate: string;
  };
  learningStats: {
    totalStudyTime: number; // seconds
    totalSessions: number;
    averageSessionTime: number;
    totalQuestions: number;
    correctAnswers: number;
    wrongAnswers: number;
    overallAccuracy: number;
    streakDays: number;
    uniqueWordsStudied: number;
    newWordsLearned: number;
    wordsReviewed: number;
    wordsMastered: number;
  };
  performanceStats: {
    averageResponseTime: number; // milliseconds
    difficultyDistribution: {
      beginner: number;
      intermediate: number;
      advanced: number;
    };
    sessionTypeDistribution: {
      srs: number;
      review: number;
      practice: number;
      vocabulary_browse: number;
    };
    timeOfDayStats: {
      morning: number; // 6-12
      afternoon: number; // 12-18
      evening: number; // 18-24
      night: number; // 0-6
    };
    weekdayStats: {
      [key: string]: number; // Sunday-Saturday
    };
  };
  progressStats: {
    levelProgression: Array<{ date: string; level: number; xp: number }>;
    skillProgression: {
      vocabulary: number;
      listening: number;
      pronunciation: number;
      reading: number;
    };
    goalsProgress: {
      daily: { target: number; achieved: number; percentage: number };
      weekly: { target: number; achieved: number; percentage: number };
      monthly: { target: number; achieved: number; percentage: number };
    };
  };
  engagementStats: {
    activeMinutes: number;
    idleMinutes: number;
    sessionCompletionRate: number;
    averageBreakDuration: number;
    mostActiveHour: number;
    mostActiveDay: string;
    consistencyScore: number; // 0-100
  };
  offlineSpecificStats: {
    totalOfflineTime: number;
    offlineSessionsCount: number;
    syncPendingItems: number;
    cacheHitRate: number;
    audioFilesUsed: number;
    dataUsageSaved: number; // estimated bytes
  };
}

export interface LearningPattern {
  id: string;
  type: 'time_preference' | 'difficulty_preference' | 'session_length' | 'break_pattern';
  description: string;
  confidence: number; // 0-1
  recommendation: string;
  dataPoints: Array<{ date: string; value: number }>;
}

export interface OfflineAchievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt: string;
  category: 'study_time' | 'accuracy' | 'consistency' | 'offline_mastery';
  criteria: {
    type: string;
    threshold: number;
    period?: string;
  };
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export class OfflineStatsService {
  private static instance: OfflineStatsService;
  private currentSnapshot: OfflineStatsSnapshot | null = null;
  private patterns: LearningPattern[] = [];
  private achievements: OfflineAchievement[] = [];
  private sessionStartTime: Date | null = null;
  private sessionStats: any = null;

  private constructor() {
    this.loadStoredData();
    this.initializeAchievements();
  }

  public static getInstance(): OfflineStatsService {
    if (!OfflineStatsService.instance) {
      OfflineStatsService.instance = new OfflineStatsService();
    }
    return OfflineStatsService.instance;
  }

  // Start tracking a study session
  public async startSession(sessionType: 'srs' | 'review' | 'practice' | 'vocabulary_browse'): Promise<void> {
    this.sessionStartTime = new Date();
    this.sessionStats = {
      sessionType,
      startTime: this.sessionStartTime.toISOString(),
      questions: 0,
      correctAnswers: 0,
      responseTimesMs: [],
      wordsStudied: new Set(),
      pauseTime: 0,
      lastActiveTime: this.sessionStartTime,
    };
    
    console.log(`Started tracking ${sessionType} session`);
  }

  // Track question answered
  public async trackQuestionAnswer(data: {
    vocabId: number;
    cardId: number;
    isCorrect: boolean;
    responseTimeMs: number;
    difficulty: number;
  }): Promise<void> {
    if (!this.sessionStats) return;

    this.sessionStats.questions++;
    if (data.isCorrect) {
      this.sessionStats.correctAnswers++;
    }
    
    this.sessionStats.responseTimesMs.push(data.responseTimeMs);
    this.sessionStats.wordsStudied.add(data.vocabId);
    this.sessionStats.lastActiveTime = new Date();

    // Update real-time stats
    await this.updateRealTimeStats(data);
  }

  // Track session pause/resume
  public trackSessionPause(): void {
    if (!this.sessionStats) return;
    
    this.sessionStats.pauseStartTime = new Date();
  }

  public trackSessionResume(): void {
    if (!this.sessionStats || !this.sessionStats.pauseStartTime) return;
    
    const pauseDuration = new Date().getTime() - this.sessionStats.pauseStartTime.getTime();
    this.sessionStats.pauseTime += pauseDuration;
    delete this.sessionStats.pauseStartTime;
  }

  // End session and save stats
  public async endSession(): Promise<StudySessionRecord | null> {
    if (!this.sessionStartTime || !this.sessionStats) {
      return null;
    }

    const endTime = new Date();
    const totalTime = Math.floor((endTime.getTime() - this.sessionStartTime.getTime()) / 1000);
    const activeTime = totalTime - Math.floor(this.sessionStats.pauseTime / 1000);
    
    const accuracy = this.sessionStats.questions > 0 
      ? this.sessionStats.correctAnswers / this.sessionStats.questions 
      : 0;

    const averageResponseTime = this.sessionStats.responseTimesMs.length > 0
      ? this.sessionStats.responseTimesMs.reduce((a: number, b: number) => a + b, 0) / this.sessionStats.responseTimesMs.length
      : 0;

    // Create study session record
    const sessionData = {
      session_type: this.sessionStats.sessionType,
      started_at: this.sessionStats.startTime,
      completed_at: endTime.toISOString(),
      total_questions: this.sessionStats.questions,
      correct_answers: this.sessionStats.correctAnswers,
      wrong_answers: this.sessionStats.questions - this.sessionStats.correctAnswers,
      accuracy_rate: accuracy,
      time_spent: activeTime,
      vocab_ids: Array.from(this.sessionStats.wordsStudied),
      card_ids: [], // Would be populated based on actual cards used
      answers: [], // Would be populated with detailed answers
      created_at: this.sessionStats.startTime,
      updated_at: endTime.toISOString(),
      is_deleted: 0,
    };

    try {
      const session = await studySessionModel.create(sessionData);
      
      // Update user progress
      await this.updateUserProgress(sessionData);
      
      // Check for achievements
      await this.checkAchievements(sessionData);
      
      // Update patterns
      await this.updateLearningPatterns(sessionData);
      
      // Reset session tracking
      this.sessionStartTime = null;
      this.sessionStats = null;
      
      console.log(`Session completed: ${accuracy * 100}% accuracy, ${activeTime}s active time`);
      
      return session;
    } catch (error) {
      console.error('Error saving session:', error);
      return null;
    }
  }

  // Generate comprehensive stats snapshot
  public async generateSnapshot(
    period: {
      startDate: string;
      endDate: string;
    },
    sessionType: 'daily' | 'weekly' | 'monthly' | 'custom' = 'daily'
  ): Promise<OfflineStatsSnapshot> {
    try {
      const snapshot: OfflineStatsSnapshot = {
        id: `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        sessionType,
        period,
        learningStats: await this.calculateLearningStats(period),
        performanceStats: await this.calculatePerformanceStats(period),
        progressStats: await this.calculateProgressStats(period),
        engagementStats: await this.calculateEngagementStats(period),
        offlineSpecificStats: await this.calculateOfflineStats(period),
      };

      this.currentSnapshot = snapshot;
      await this.saveSnapshot(snapshot);
      
      return snapshot;
    } catch (error) {
      console.error('Error generating stats snapshot:', error);
      throw error;
    }
  }

  // Calculate learning statistics
  private async calculateLearningStats(period: { startDate: string; endDate: string }): Promise<any> {
    const sessions = await studySessionModel.getCompletedSessions({
      startDate: period.startDate,
      endDate: period.endDate,
    });

    const totalSessions = sessions.length;
    const totalStudyTime = sessions.reduce((sum, s) => sum + s.time_spent, 0);
    const totalQuestions = sessions.reduce((sum, s) => sum + s.total_questions, 0);
    const correctAnswers = sessions.reduce((sum, s) => sum + s.correct_answers, 0);
    const wrongAnswers = totalQuestions - correctAnswers;
    const overallAccuracy = totalQuestions > 0 ? correctAnswers / totalQuestions : 0;
    
    // Get unique words studied
    const allVocabIds = new Set<number>();
    sessions.forEach(s => s.vocab_ids?.forEach(id => allVocabIds.add(id)));
    const uniqueWordsStudied = allVocabIds.size;

    // Get progress data for streak calculation
    const progressRecords = await userProgressModel.getProgressRange(
      period.startDate,
      period.endDate
    );
    
    const streakDays = this.calculateStreak(progressRecords);

    return {
      totalStudyTime,
      totalSessions,
      averageSessionTime: totalSessions > 0 ? totalStudyTime / totalSessions : 0,
      totalQuestions,
      correctAnswers,
      wrongAnswers,
      overallAccuracy,
      streakDays,
      uniqueWordsStudied,
      newWordsLearned: 0, // Would calculate based on card creation dates
      wordsReviewed: uniqueWordsStudied,
      wordsMastered: 0, // Would calculate based on card mastery status
    };
  }

  // Calculate performance statistics
  private async calculatePerformanceStats(period: { startDate: string; endDate: string }): Promise<any> {
    const sessions = await studySessionModel.getCompletedSessions({
      startDate: period.startDate,
      endDate: period.endDate,
    });

    // Session type distribution
    const sessionTypeDistribution = sessions.reduce((dist, session) => {
      dist[session.session_type] = (dist[session.session_type] || 0) + 1;
      return dist;
    }, {} as any);

    // Time of day distribution
    const timeOfDayStats = sessions.reduce((stats, session) => {
      const hour = new Date(session.started_at).getHours();
      if (hour >= 6 && hour < 12) stats.morning++;
      else if (hour >= 12 && hour < 18) stats.afternoon++;
      else if (hour >= 18 && hour < 24) stats.evening++;
      else stats.night++;
      return stats;
    }, { morning: 0, afternoon: 0, evening: 0, night: 0 });

    // Weekday distribution
    const weekdayStats = sessions.reduce((stats, session) => {
      const dayName = new Date(session.started_at).toLocaleDateString('en', { weekday: 'long' });
      stats[dayName] = (stats[dayName] || 0) + 1;
      return stats;
    }, {} as any);

    return {
      averageResponseTime: 2000, // Would calculate from session answers
      difficultyDistribution: { beginner: 0, intermediate: 0, advanced: 0 },
      sessionTypeDistribution,
      timeOfDayStats,
      weekdayStats,
    };
  }

  // Calculate progress statistics
  private async calculateProgressStats(period: { startDate: string; endDate: string }): Promise<any> {
    const progressRecords = await userProgressModel.getProgressRange(
      period.startDate,
      period.endDate
    );

    const levelProgression = progressRecords.map(p => ({
      date: p.date,
      level: p.level,
      xp: p.experience_points,
    }));

    return {
      levelProgression,
      skillProgression: {
        vocabulary: 75, // Would calculate based on actual skill metrics
        listening: 60,
        pronunciation: 45,
        reading: 80,
      },
      goalsProgress: {
        daily: { target: 30, achieved: 25, percentage: 83.3 },
        weekly: { target: 200, achieved: 180, percentage: 90.0 },
        monthly: { target: 800, achieved: 720, percentage: 90.0 },
      },
    };
  }

  // Calculate engagement statistics
  private async calculateEngagementStats(period: { startDate: string; endDate: string }): Promise<any> {
    const sessions = await studySessionModel.getCompletedSessions({
      startDate: period.startDate,
      endDate: period.endDate,
    });

    const totalTime = sessions.reduce((sum, s) => sum + s.time_spent, 0);
    const completedSessions = sessions.filter(s => s.completed_at).length;
    const completionRate = sessions.length > 0 ? completedSessions / sessions.length : 0;

    // Find most active patterns
    const hourCounts = sessions.reduce((counts, session) => {
      const hour = new Date(session.started_at).getHours();
      counts[hour] = (counts[hour] || 0) + 1;
      return counts;
    }, {} as any);

    const mostActiveHour = Object.entries(hourCounts)
      .sort(([, a], [, b]) => (b as number) - (a as number))[0]?.[0] || '0';

    const dayCounts = sessions.reduce((counts, session) => {
      const day = new Date(session.started_at).toLocaleDateString('en', { weekday: 'long' });
      counts[day] = (counts[day] || 0) + 1;
      return counts;
    }, {} as any);

    const mostActiveDay = Object.entries(dayCounts)
      .sort(([, a], [, b]) => (b as number) - (a as number))[0]?.[0] || 'Monday';

    return {
      activeMinutes: Math.floor(totalTime / 60),
      idleMinutes: 0, // Would track pause times
      sessionCompletionRate: completionRate,
      averageBreakDuration: 0, // Would calculate from pause tracking
      mostActiveHour: parseInt(mostActiveHour),
      mostActiveDay,
      consistencyScore: this.calculateConsistencyScore(sessions),
    };
  }

  // Calculate offline-specific statistics
  private async calculateOfflineStats(period: { startDate: string; endDate: string }): Promise<any> {
    // This would integrate with the sync service to get offline-specific data
    return {
      totalOfflineTime: 3600, // seconds spent in offline mode
      offlineSessionsCount: 5,
      syncPendingItems: 12,
      cacheHitRate: 0.85,
      audioFilesUsed: 45,
      dataUsageSaved: 2.5 * 1024 * 1024, // 2.5MB saved by offline mode
    };
  }

  // Detect learning patterns
  public async detectLearningPatterns(): Promise<LearningPattern[]> {
    try {
      const sessions = await studySessionModel.getCompletedSessions({ limit: 100 });
      const patterns: LearningPattern[] = [];

      // Time preference pattern
      const timePreference = this.analyzeTimePreference(sessions);
      if (timePreference.confidence > 0.6) {
        patterns.push(timePreference);
      }

      // Session length pattern
      const sessionLengthPattern = this.analyzeSessionLength(sessions);
      if (sessionLengthPattern.confidence > 0.6) {
        patterns.push(sessionLengthPattern);
      }

      // Difficulty preference pattern
      const difficultyPattern = this.analyzeDifficultyPreference(sessions);
      if (difficultyPattern.confidence > 0.6) {
        patterns.push(difficultyPattern);
      }

      this.patterns = patterns;
      await this.savePatterns();

      return patterns;
    } catch (error) {
      console.error('Error detecting learning patterns:', error);
      return [];
    }
  }

  // Check for new achievements
  private async checkAchievements(sessionData: any): Promise<OfflineAchievement[]> {
    const newAchievements: OfflineAchievement[] = [];

    for (const achievement of this.getAchievementDefinitions()) {
      if (this.achievements.find(a => a.id === achievement.id)) {
        continue; // Already unlocked
      }

      const unlocked = await this.evaluateAchievementCriteria(achievement, sessionData);
      if (unlocked) {
        const newAchievement: OfflineAchievement = {
          ...achievement,
          unlockedAt: new Date().toISOString(),
        };
        
        this.achievements.push(newAchievement);
        newAchievements.push(newAchievement);
      }
    }

    if (newAchievements.length > 0) {
      await this.saveAchievements();
    }

    return newAchievements;
  }

  // Helper methods for pattern analysis
  private analyzeTimePreference(sessions: StudySessionRecord[]): LearningPattern {
    const hourCounts = sessions.reduce((counts, session) => {
      const hour = new Date(session.started_at).getHours();
      counts[hour] = (counts[hour] || 0) + 1;
      return counts;
    }, {} as { [hour: number]: number });

    const totalSessions = sessions.length;
    const maxHour = Object.entries(hourCounts)
      .sort(([, a], [, b]) => b - a)[0];

    const confidence = maxHour ? maxHour[1] / totalSessions : 0;
    
    return {
      id: 'time_preference',
      type: 'time_preference',
      description: `Most active at ${maxHour?.[0] || 0}:00`,
      confidence,
      recommendation: `Consider scheduling study sessions around ${maxHour?.[0] || 0}:00 for optimal performance.`,
      dataPoints: Object.entries(hourCounts).map(([hour, count]) => ({
        date: hour,
        value: count,
      })),
    };
  }

  private analyzeSessionLength(sessions: StudySessionRecord[]): LearningPattern {
    const avgLength = sessions.reduce((sum, s) => sum + s.time_spent, 0) / sessions.length;
    const variance = sessions.reduce((sum, s) => sum + Math.pow(s.time_spent - avgLength, 2), 0) / sessions.length;
    const confidence = variance < avgLength * 0.5 ? 0.8 : 0.4;

    return {
      id: 'session_length',
      type: 'session_length',
      description: `Prefers ${Math.round(avgLength / 60)} minute sessions`,
      confidence,
      recommendation: `Your optimal session length appears to be ${Math.round(avgLength / 60)} minutes.`,
      dataPoints: sessions.map(s => ({
        date: s.started_at,
        value: s.time_spent,
      })),
    };
  }

  private analyzeDifficultyPreference(sessions: StudySessionRecord[]): LearningPattern {
    // This would analyze vocabulary difficulty levels studied
    return {
      id: 'difficulty_preference',
      type: 'difficulty_preference',
      description: 'Prefers intermediate difficulty',
      confidence: 0.7,
      recommendation: 'Continue challenging yourself with intermediate vocabulary.',
      dataPoints: [],
    };
  }

  private calculateConsistencyScore(sessions: StudySessionRecord[]): number {
    if (sessions.length < 7) return 0;

    // Calculate daily study frequency over the period
    const dailyCount = sessions.reduce((days, session) => {
      const date = session.started_at.split('T')[0];
      days[date] = (days[date] || 0) + 1;
      return days;
    }, {} as any);

    const studyDays = Object.keys(dailyCount).length;
    const totalDays = 30; // Assume 30-day period
    
    return Math.min(100, (studyDays / totalDays) * 100);
  }

  private calculateStreak(progressRecords: UserProgressRecord[]): number {
    let streak = 0;
    const today = new Date().toISOString().split('T')[0];
    
    for (let i = 0; i <= 30; i++) {
      const checkDate = new Date();
      checkDate.setDate(checkDate.getDate() - i);
      const checkDateStr = checkDate.toISOString().split('T')[0];
      
      const dayProgress = progressRecords.find(p => p.date === checkDateStr);
      
      if (dayProgress && dayProgress.total_studied > 0) {
        streak++;
      } else if (i === 0 && checkDateStr !== today) {
        continue; // Skip today if no progress yet
      } else {
        break;
      }
    }

    return streak;
  }

  // Achievement system
  private getAchievementDefinitions(): any[] {
    return [
      {
        id: 'first_offline_session',
        title: '오프라인 학습 시작',
        description: '첫 번째 오프라인 학습 세션을 완료했습니다',
        icon: '🎯',
        category: 'offline_mastery',
        criteria: { type: 'offline_session_count', threshold: 1 },
        rarity: 'common',
      },
      {
        id: 'offline_streak_7',
        title: '오프라인 일주일',
        description: '7일 연속 오프라인에서 학습했습니다',
        icon: '🔥',
        category: 'consistency',
        criteria: { type: 'offline_streak', threshold: 7 },
        rarity: 'rare',
      },
      {
        id: 'accuracy_master',
        title: '정확도 마스터',
        description: '95% 이상의 정확도로 세션을 완료했습니다',
        icon: '🎯',
        category: 'accuracy',
        criteria: { type: 'session_accuracy', threshold: 0.95 },
        rarity: 'epic',
      },
    ];
  }

  private async evaluateAchievementCriteria(achievement: any, sessionData: any): Promise<boolean> {
    // Implementation would check various criteria based on achievement type
    switch (achievement.criteria.type) {
      case 'offline_session_count':
        const offlineSessionCount = await this.getOfflineSessionCount();
        return offlineSessionCount >= achievement.criteria.threshold;
      case 'session_accuracy':
        return sessionData.accuracy_rate >= achievement.criteria.threshold;
      default:
        return false;
    }
  }

  private async getOfflineSessionCount(): Promise<number> {
    // This would query sessions completed while offline
    return 1; // Placeholder
  }

  // Data persistence methods
  private async updateRealTimeStats(data: any): Promise<void> {
    // Update running statistics during session
  }

  private async updateUserProgress(sessionData: any): Promise<void> {
    await userProgressModel.updateTodayProgress({
      total_studied: sessionData.total_questions,
      correct_rate: sessionData.accuracy_rate,
      study_time: sessionData.time_spent,
    });
  }

  private async updateLearningPatterns(sessionData: any): Promise<void> {
    // Update detected patterns with new session data
  }

  private initializeAchievements(): void {
    // Initialize predefined achievements
  }

  private async loadStoredData(): Promise<void> {
    try {
      const [patternsStr, achievementsStr] = await Promise.all([
        AsyncStorage.getItem('@learning_patterns'),
        AsyncStorage.getItem('@offline_achievements'),
      ]);

      if (patternsStr) {
        this.patterns = JSON.parse(patternsStr);
      }

      if (achievementsStr) {
        this.achievements = JSON.parse(achievementsStr);
      }
    } catch (error) {
      console.error('Error loading stored data:', error);
    }
  }

  private async saveSnapshot(snapshot: OfflineStatsSnapshot): Promise<void> {
    try {
      await AsyncStorage.setItem(`@stats_snapshot_${snapshot.id}`, JSON.stringify(snapshot));
    } catch (error) {
      console.error('Error saving snapshot:', error);
    }
  }

  private async savePatterns(): Promise<void> {
    try {
      await AsyncStorage.setItem('@learning_patterns', JSON.stringify(this.patterns));
    } catch (error) {
      console.error('Error saving patterns:', error);
    }
  }

  private async saveAchievements(): Promise<void> {
    try {
      await AsyncStorage.setItem('@offline_achievements', JSON.stringify(this.achievements));
    } catch (error) {
      console.error('Error saving achievements:', error);
    }
  }

  // Public getters
  public getCurrentSnapshot(): OfflineStatsSnapshot | null {
    return this.currentSnapshot;
  }

  public getLearningPatterns(): LearningPattern[] {
    return [...this.patterns];
  }

  public getAchievements(): OfflineAchievement[] {
    return [...this.achievements];
  }

  public getUnlockedAchievements(): OfflineAchievement[] {
    return this.achievements.filter(a => a.unlockedAt);
  }

  // Export stats for sync
  public async exportStatsForSync(): Promise<{
    snapshots: OfflineStatsSnapshot[];
    patterns: LearningPattern[];
    achievements: OfflineAchievement[];
  }> {
    try {
      // Get all stored snapshots
      const keys = await AsyncStorage.getAllKeys();
      const snapshotKeys = keys.filter(key => key.startsWith('@stats_snapshot_'));
      
      const snapshots: OfflineStatsSnapshot[] = [];
      for (const key of snapshotKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          snapshots.push(JSON.parse(data));
        }
      }

      return {
        snapshots,
        patterns: this.patterns,
        achievements: this.achievements,
      };
    } catch (error) {
      console.error('Error exporting stats for sync:', error);
      return { snapshots: [], patterns: [], achievements: [] };
    }
  }
}

// Export singleton instance
export const offlineStatsService = OfflineStatsService.getInstance();
export default OfflineStatsService;