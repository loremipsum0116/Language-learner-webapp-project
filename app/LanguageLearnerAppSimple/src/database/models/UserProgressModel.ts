// src/database/models/UserProgressModel.ts
// 사용자 진도 데이터 모델

import { BaseModel } from './BaseModel';
import { UserProgress } from '../../types/OfflineDataTypes';

export interface UserProgressRecord extends UserProgress {
  id: number;
}

export class UserProgressModel extends BaseModel<UserProgressRecord> {
  constructor() {
    super('user_progress');
  }

  // Create table schema
  public getCreateTableSQL(): string {
    return `
      CREATE TABLE IF NOT EXISTS user_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id TEXT UNIQUE,
        user_id TEXT,
        date TEXT NOT NULL, -- YYYY-MM-DD format
        total_studied INTEGER NOT NULL DEFAULT 0,
        new_words_learned INTEGER NOT NULL DEFAULT 0,
        review_completed INTEGER NOT NULL DEFAULT 0,
        correct_rate REAL NOT NULL DEFAULT 0.0,
        study_time INTEGER NOT NULL DEFAULT 0,
        streak_days INTEGER NOT NULL DEFAULT 0,
        level INTEGER NOT NULL DEFAULT 1,
        experience_points INTEGER NOT NULL DEFAULT 0,
        mastered_vocabs INTEGER NOT NULL DEFAULT 0,
        learning_vocabs INTEGER NOT NULL DEFAULT 0,
        new_vocabs INTEGER NOT NULL DEFAULT 0,
        weekly_goal_progress REAL NOT NULL DEFAULT 0.0,
        monthly_goal_progress REAL NOT NULL DEFAULT 0.0,
        achievements_unlocked TEXT, -- JSON array
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        synced_at TEXT,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        UNIQUE(user_id, date)
      )
    `;
  }

  // Get indexes for performance
  public getIndexes(): string[] {
    return [
      'CREATE INDEX IF NOT EXISTS idx_user_progress_date ON user_progress(date)',
      'CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_user_progress_level ON user_progress(level)',
      'CREATE INDEX IF NOT EXISTS idx_user_progress_synced_at ON user_progress(synced_at)',
    ];
  }

  // Transform data for storage
  protected transformForStorage(data: Partial<UserProgressRecord>): any {
    return {
      ...data,
      achievements_unlocked: data.achievements_unlocked 
        ? JSON.stringify(data.achievements_unlocked) 
        : null,
    };
  }

  // Transform data from storage
  protected transformFromStorage(data: any): UserProgressRecord {
    return {
      ...data,
      achievements_unlocked: data.achievements_unlocked 
        ? JSON.parse(data.achievements_unlocked) 
        : [],
    };
  }

  // Get progress for specific date
  public async getProgressByDate(date: string, userId?: string): Promise<UserProgressRecord | null> {
    try {
      let sql = `SELECT * FROM ${this.tableName} WHERE date = ? AND is_deleted = 0`;
      const params: any[] = [date];

      if (userId) {
        sql += ' AND user_id = ?';
        params.push(userId);
      }

      const [result] = await this.database.executeSql(sql, params);
      
      if (result.rows.length > 0) {
        return this.transformFromStorage(result.rows.item(0));
      }

      return null;
    } catch (error) {
      console.error('Error getting progress by date:', error);
      return null;
    }
  }

  // Get current progress (today)
  public async getCurrentProgress(userId?: string): Promise<UserProgressRecord | null> {
    const today = new Date().toISOString().split('T')[0];
    return await this.getProgressByDate(today, userId);
  }

  // Update or create today's progress
  public async updateTodayProgress(
    progressData: Partial<UserProgress>,
    userId?: string
  ): Promise<UserProgressRecord> {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    try {
      const existing = await this.getProgressByDate(today, userId);

      if (existing) {
        // Update existing progress
        const updated = await this.update(existing.id, {
          ...progressData,
          updated_at: now,
        });
        return updated!;
      } else {
        // Create new progress record
        const created = await this.create({
          user_id: userId,
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
          ...progressData,
          created_at: now,
          updated_at: now,
          is_deleted: 0,
        });
        return created;
      }
    } catch (error) {
      console.error('Error updating today progress:', error);
      throw error;
    }
  }

  // Get progress for date range
  public async getProgressRange(
    startDate: string, 
    endDate: string, 
    userId?: string
  ): Promise<UserProgressRecord[]> {
    try {
      let sql = `
        SELECT * FROM ${this.tableName} 
        WHERE date >= ? AND date <= ? AND is_deleted = 0
      `;
      const params: any[] = [startDate, endDate];

      if (userId) {
        sql += ' AND user_id = ?';
        params.push(userId);
      }

      sql += ' ORDER BY date ASC';

      const [result] = await this.database.executeSql(sql, params);
      const progressRecords: UserProgressRecord[] = [];

      for (let i = 0; i < result.rows.length; i++) {
        progressRecords.push(this.transformFromStorage(result.rows.item(i)));
      }

      return progressRecords;
    } catch (error) {
      console.error('Error getting progress range:', error);
      return [];
    }
  }

  // Get weekly progress
  public async getWeeklyProgress(userId?: string): Promise<UserProgressRecord[]> {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
    
    const startDate = weekStart.toISOString().split('T')[0];
    const endDate = today.toISOString().split('T')[0];

    return await this.getProgressRange(startDate, endDate, userId);
  }

  // Get monthly progress
  public async getMonthlyProgress(userId?: string): Promise<UserProgressRecord[]> {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const startDate = monthStart.toISOString().split('T')[0];
    const endDate = today.toISOString().split('T')[0];

    return await this.getProgressRange(startDate, endDate, userId);
  }

  // Calculate and update streak
  public async updateStreak(userId?: string): Promise<number> {
    try {
      // Get last 30 days of progress
      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30);
      
      const startDate = thirtyDaysAgo.toISOString().split('T')[0];
      const endDate = today.toISOString().split('T')[0];

      const progressRecords = await this.getProgressRange(startDate, endDate, userId);
      
      // Calculate streak
      let currentStreak = 0;
      const todayStr = today.toISOString().split('T')[0];
      
      for (let i = 0; i <= 30; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() - i);
        const checkDateStr = checkDate.toISOString().split('T')[0];
        
        const dayProgress = progressRecords.find(p => p.date === checkDateStr);
        
        if (dayProgress && dayProgress.total_studied > 0) {
          currentStreak++;
        } else if (i === 0 && checkDateStr !== todayStr) {
          // If today has no progress yet, continue checking
          continue;
        } else {
          // Streak broken
          break;
        }
      }

      // Update today's progress with streak
      await this.updateTodayProgress({ streak_days: currentStreak }, userId);
      
      return currentStreak;
    } catch (error) {
      console.error('Error updating streak:', error);
      return 0;
    }
  }

  // Add experience points
  public async addExperience(
    points: number, 
    userId?: string,
    source?: string
  ): Promise<{ newLevel: number; levelUp: boolean; totalXP: number }> {
    try {
      const currentProgress = await this.getCurrentProgress(userId);
      
      if (!currentProgress) {
        // Create initial progress if doesn't exist
        await this.updateTodayProgress({
          experience_points: points,
          level: this.calculateLevel(points),
        }, userId);
        
        return {
          newLevel: this.calculateLevel(points),
          levelUp: this.calculateLevel(points) > 1,
          totalXP: points,
        };
      }

      const oldLevel = currentProgress.level;
      const newXP = currentProgress.experience_points + points;
      const newLevel = this.calculateLevel(newXP);

      await this.updateTodayProgress({
        experience_points: newXP,
        level: newLevel,
      }, userId);

      return {
        newLevel,
        levelUp: newLevel > oldLevel,
        totalXP: newXP,
      };
    } catch (error) {
      console.error('Error adding experience:', error);
      return { newLevel: 1, levelUp: false, totalXP: 0 };
    }
  }

  // Calculate level from experience points
  private calculateLevel(xp: number): number {
    // Simple leveling formula: level = floor(sqrt(xp / 100)) + 1
    return Math.floor(Math.sqrt(xp / 100)) + 1;
  }

  // Calculate XP needed for next level
  public getXPForNextLevel(currentLevel: number): number {
    const nextLevel = currentLevel + 1;
    return Math.pow(nextLevel - 1, 2) * 100;
  }

  // Add achievement
  public async unlockAchievement(
    achievement: string, 
    userId?: string
  ): Promise<boolean> {
    try {
      const currentProgress = await this.getCurrentProgress(userId);
      
      if (!currentProgress) {
        await this.updateTodayProgress({
          achievements_unlocked: [achievement],
        }, userId);
        return true;
      }

      const achievements = currentProgress.achievements_unlocked || [];
      
      if (!achievements.includes(achievement)) {
        achievements.push(achievement);
        await this.updateTodayProgress({
          achievements_unlocked: achievements,
        }, userId);
        return true;
      }

      return false; // Already unlocked
    } catch (error) {
      console.error('Error unlocking achievement:', error);
      return false;
    }
  }

  // Get progress statistics
  public async getProgressStatistics(
    days: number = 30, 
    userId?: string
  ): Promise<{
    totalStudyDays: number;
    averageStudyTime: number;
    totalStudyTime: number;
    averageCorrectRate: number;
    bestStreak: number;
    currentStreak: number;
    totalWordsLearned: number;
    totalReviewsCompleted: number;
    levelProgression: { date: string; level: number }[];
    dailyAverages: {
      studyTime: number;
      wordsLearned: number;
      correctRate: number;
    };
  }> {
    try {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString().split('T')[0];

      const progressRecords = await this.getProgressRange(startDateStr, endDate, userId);

      if (progressRecords.length === 0) {
        return {
          totalStudyDays: 0,
          averageStudyTime: 0,
          totalStudyTime: 0,
          averageCorrectRate: 0,
          bestStreak: 0,
          currentStreak: 0,
          totalWordsLearned: 0,
          totalReviewsCompleted: 0,
          levelProgression: [],
          dailyAverages: {
            studyTime: 0,
            wordsLearned: 0,
            correctRate: 0,
          },
        };
      }

      const studyDays = progressRecords.filter(p => p.total_studied > 0).length;
      const totalStudyTime = progressRecords.reduce((sum, p) => sum + p.study_time, 0);
      const totalWordsLearned = progressRecords.reduce((sum, p) => sum + p.new_words_learned, 0);
      const totalReviewsCompleted = progressRecords.reduce((sum, p) => sum + p.review_completed, 0);
      
      const averageStudyTime = studyDays > 0 ? totalStudyTime / studyDays : 0;
      const averageCorrectRate = studyDays > 0 
        ? progressRecords.reduce((sum, p) => sum + p.correct_rate, 0) / studyDays 
        : 0;

      const bestStreak = Math.max(...progressRecords.map(p => p.streak_days), 0);
      const currentStreak = progressRecords[progressRecords.length - 1]?.streak_days || 0;

      const levelProgression = progressRecords.map(p => ({
        date: p.date,
        level: p.level,
      }));

      return {
        totalStudyDays: studyDays,
        averageStudyTime: Math.round(averageStudyTime),
        totalStudyTime,
        averageCorrectRate: Math.round(averageCorrectRate * 100) / 100,
        bestStreak,
        currentStreak,
        totalWordsLearned,
        totalReviewsCompleted,
        levelProgression,
        dailyAverages: {
          studyTime: Math.round(averageStudyTime),
          wordsLearned: Math.round(totalWordsLearned / Math.max(days, 1)),
          correctRate: Math.round(averageCorrectRate * 100) / 100,
        },
      };
    } catch (error) {
      console.error('Error getting progress statistics:', error);
      return {
        totalStudyDays: 0,
        averageStudyTime: 0,
        totalStudyTime: 0,
        averageCorrectRate: 0,
        bestStreak: 0,
        currentStreak: 0,
        totalWordsLearned: 0,
        totalReviewsCompleted: 0,
        levelProgression: [],
        dailyAverages: {
          studyTime: 0,
          wordsLearned: 0,
          correctRate: 0,
        },
      };
    }
  }

  // Update goal progress
  public async updateGoalProgress(
    weeklyProgress: number, 
    monthlyProgress: number, 
    userId?: string
  ): Promise<void> {
    try {
      await this.updateTodayProgress({
        weekly_goal_progress: Math.min(weeklyProgress, 100),
        monthly_goal_progress: Math.min(monthlyProgress, 100),
      }, userId);
    } catch (error) {
      console.error('Error updating goal progress:', error);
    }
  }

  // Clean up old progress records
  public async cleanupOldProgress(retentionDays: number = 365): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

      const sql = `
        UPDATE ${this.tableName} 
        SET is_deleted = 1, updated_at = ?
        WHERE date < ? AND is_deleted = 0
      `;

      const [result] = await this.database.executeSql(sql, [
        new Date().toISOString(),
        cutoffDateStr,
      ]);

      console.log(`Cleaned up ${result.rowsAffected} old progress records`);
      return result.rowsAffected;
    } catch (error) {
      console.error('Error cleaning up old progress:', error);
      return 0;
    }
  }
}

export const userProgressModel = new UserProgressModel();