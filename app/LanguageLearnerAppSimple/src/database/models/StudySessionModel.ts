// src/database/models/StudySessionModel.ts
// 학습 세션 데이터 모델

import { BaseModel } from './BaseModel';
import { StudySession, StudyAnswer } from '../../types/OfflineDataTypes';

export interface StudySessionRecord extends StudySession {
  id: number;
}

export class StudySessionModel extends BaseModel<StudySessionRecord> {
  constructor() {
    super('study_sessions');
  }

  // Create table schema
  public getCreateTableSQL(): string {
    return `
      CREATE TABLE IF NOT EXISTS study_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id TEXT UNIQUE,
        session_type TEXT NOT NULL CHECK (session_type IN ('srs', 'review', 'practice', 'vocabulary_browse')),
        started_at TEXT NOT NULL,
        completed_at TEXT,
        total_questions INTEGER NOT NULL DEFAULT 0,
        correct_answers INTEGER NOT NULL DEFAULT 0,
        wrong_answers INTEGER NOT NULL DEFAULT 0,
        accuracy_rate REAL NOT NULL DEFAULT 0.0,
        time_spent INTEGER NOT NULL DEFAULT 0,
        vocab_ids TEXT, -- JSON array
        card_ids TEXT,  -- JSON array
        answers TEXT,   -- JSON array of StudyAnswer objects
        user_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        synced_at TEXT,
        is_deleted INTEGER NOT NULL DEFAULT 0
      )
    `;
  }

  // Get indexes for performance
  public getIndexes(): string[] {
    return [
      'CREATE INDEX IF NOT EXISTS idx_study_sessions_session_type ON study_sessions(session_type)',
      'CREATE INDEX IF NOT EXISTS idx_study_sessions_started_at ON study_sessions(started_at)',
      'CREATE INDEX IF NOT EXISTS idx_study_sessions_completed_at ON study_sessions(completed_at)',
      'CREATE INDEX IF NOT EXISTS idx_study_sessions_user_id ON study_sessions(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_study_sessions_synced_at ON study_sessions(synced_at)',
    ];
  }

  // Transform data for storage
  protected transformForStorage(data: Partial<StudySessionRecord>): any {
    return {
      ...data,
      vocab_ids: data.vocab_ids ? JSON.stringify(data.vocab_ids) : null,
      card_ids: data.card_ids ? JSON.stringify(data.card_ids) : null,
      answers: data.answers ? JSON.stringify(data.answers) : null,
    };
  }

  // Transform data from storage
  protected transformFromStorage(data: any): StudySessionRecord {
    return {
      ...data,
      vocab_ids: data.vocab_ids ? JSON.parse(data.vocab_ids) : [],
      card_ids: data.card_ids ? JSON.parse(data.card_ids) : [],
      answers: data.answers ? JSON.parse(data.answers) : [],
    };
  }

  // Get active (ongoing) sessions
  public async getActiveSessions(userId?: string): Promise<StudySessionRecord[]> {
    try {
      let sql = `
        SELECT * FROM ${this.tableName} 
        WHERE is_deleted = 0 AND completed_at IS NULL
      `;
      const params: any[] = [];

      if (userId) {
        sql += ' AND user_id = ?';
        params.push(userId);
      }

      sql += ' ORDER BY started_at DESC';

      const [result] = await this.database.executeSql(sql, params);
      const sessions: StudySessionRecord[] = [];

      for (let i = 0; i < result.rows.length; i++) {
        sessions.push(this.transformFromStorage(result.rows.item(i)));
      }

      return sessions;
    } catch (error) {
      console.error('Error getting active sessions:', error);
      return [];
    }
  }

  // Get completed sessions
  public async getCompletedSessions(
    options: {
      userId?: string;
      sessionType?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
    } = {}
  ): Promise<StudySessionRecord[]> {
    const { userId, sessionType, startDate, endDate, limit = 50 } = options;

    try {
      let sql = `
        SELECT * FROM ${this.tableName} 
        WHERE is_deleted = 0 AND completed_at IS NOT NULL
      `;
      const params: any[] = [];

      if (userId) {
        sql += ' AND user_id = ?';
        params.push(userId);
      }

      if (sessionType) {
        sql += ' AND session_type = ?';
        params.push(sessionType);
      }

      if (startDate) {
        sql += ' AND started_at >= ?';
        params.push(startDate);
      }

      if (endDate) {
        sql += ' AND started_at <= ?';
        params.push(endDate);
      }

      sql += ' ORDER BY started_at DESC LIMIT ?';
      params.push(limit);

      const [result] = await this.database.executeSql(sql, params);
      const sessions: StudySessionRecord[] = [];

      for (let i = 0; i < result.rows.length; i++) {
        sessions.push(this.transformFromStorage(result.rows.item(i)));
      }

      return sessions;
    } catch (error) {
      console.error('Error getting completed sessions:', error);
      return [];
    }
  }

  // Complete a study session
  public async completeSession(
    sessionId: number, 
    completionData: {
      completed_at: string;
      total_questions: number;
      correct_answers: number;
      wrong_answers: number;
      accuracy_rate: number;
      time_spent: number;
      answers: StudyAnswer[];
    }
  ): Promise<StudySessionRecord | null> {
    try {
      const updated = await this.update(sessionId, {
        ...completionData,
        updated_at: new Date().toISOString(),
      });

      console.log(`Study session ${sessionId} completed`);
      return updated;
    } catch (error) {
      console.error('Error completing study session:', error);
      return null;
    }
  }

  // Get session statistics
  public async getSessionStatistics(
    options: {
      userId?: string;
      sessionType?: string;
      days?: number;
    } = {}
  ): Promise<{
    totalSessions: number;
    completedSessions: number;
    averageAccuracy: number;
    totalStudyTime: number;
    averageSessionTime: number;
    bestAccuracy: number;
    streakDays: number;
    sessionsByType: { [key: string]: number };
    dailyStats: { date: string; sessions: number; accuracy: number; studyTime: number }[];
  }> {
    const { userId, sessionType, days = 30 } = options;

    try {
      let sql = `
        SELECT 
          COUNT(*) as total_sessions,
          COUNT(completed_at) as completed_sessions,
          AVG(CASE WHEN completed_at IS NOT NULL THEN accuracy_rate END) as avg_accuracy,
          SUM(time_spent) as total_study_time,
          AVG(CASE WHEN completed_at IS NOT NULL THEN time_spent END) as avg_session_time,
          MAX(accuracy_rate) as best_accuracy
        FROM ${this.tableName} 
        WHERE is_deleted = 0
      `;
      const params: any[] = [];

      if (userId) {
        sql += ' AND user_id = ?';
        params.push(userId);
      }

      if (sessionType) {
        sql += ' AND session_type = ?';
        params.push(sessionType);
      }

      if (days > 0) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        sql += ' AND started_at >= ?';
        params.push(cutoffDate.toISOString());
      }

      const [result] = await this.database.executeSql(sql, params);
      const basicStats = result.rows.item(0);

      // Get sessions by type
      let typeSQL = `
        SELECT session_type, COUNT(*) as count 
        FROM ${this.tableName} 
        WHERE is_deleted = 0 AND completed_at IS NOT NULL
      `;
      const typeParams = [];

      if (userId) {
        typeSQL += ' AND user_id = ?';
        typeParams.push(userId);
      }

      if (days > 0) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        typeSQL += ' AND started_at >= ?';
        typeParams.push(cutoffDate.toISOString());
      }

      typeSQL += ' GROUP BY session_type';

      const [typeResult] = await this.database.executeSql(typeSQL, typeParams);
      const sessionsByType: { [key: string]: number } = {};

      for (let i = 0; i < typeResult.rows.length; i++) {
        const row = typeResult.rows.item(i);
        sessionsByType[row.session_type] = row.count;
      }

      // Get daily statistics
      let dailySQL = `
        SELECT 
          DATE(started_at) as date,
          COUNT(*) as sessions,
          AVG(CASE WHEN completed_at IS NOT NULL THEN accuracy_rate END) as accuracy,
          SUM(time_spent) as study_time
        FROM ${this.tableName} 
        WHERE is_deleted = 0 AND completed_at IS NOT NULL
      `;
      const dailyParams = [];

      if (userId) {
        dailySQL += ' AND user_id = ?';
        dailyParams.push(userId);
      }

      if (days > 0) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        dailySQL += ' AND started_at >= ?';
        dailyParams.push(cutoffDate.toISOString());
      }

      dailySQL += ' GROUP BY DATE(started_at) ORDER BY date DESC';

      const [dailyResult] = await this.database.executeSql(dailySQL, dailyParams);
      const dailyStats: { date: string; sessions: number; accuracy: number; studyTime: number }[] = [];

      for (let i = 0; i < dailyResult.rows.length; i++) {
        const row = dailyResult.rows.item(i);
        dailyStats.push({
          date: row.date,
          sessions: row.sessions,
          accuracy: row.accuracy || 0,
          studyTime: row.study_time || 0,
        });
      }

      // Calculate streak days
      const streakDays = this.calculateStreakDays(dailyStats);

      return {
        totalSessions: basicStats.total_sessions || 0,
        completedSessions: basicStats.completed_sessions || 0,
        averageAccuracy: basicStats.avg_accuracy || 0,
        totalStudyTime: basicStats.total_study_time || 0,
        averageSessionTime: basicStats.avg_session_time || 0,
        bestAccuracy: basicStats.best_accuracy || 0,
        streakDays,
        sessionsByType,
        dailyStats,
      };
    } catch (error) {
      console.error('Error getting session statistics:', error);
      return {
        totalSessions: 0,
        completedSessions: 0,
        averageAccuracy: 0,
        totalStudyTime: 0,
        averageSessionTime: 0,
        bestAccuracy: 0,
        streakDays: 0,
        sessionsByType: {},
        dailyStats: [],
      };
    }
  }

  // Calculate study streak
  private calculateStreakDays(dailyStats: { date: string; sessions: number }[]): number {
    if (dailyStats.length === 0) return 0;

    let streak = 0;
    const today = new Date().toISOString().split('T')[0];
    
    for (let i = 0; i < dailyStats.length; i++) {
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() - i);
      const expectedDateStr = expectedDate.toISOString().split('T')[0];
      
      const dayData = dailyStats.find(stat => stat.date === expectedDateStr);
      
      if (dayData && dayData.sessions > 0) {
        streak++;
      } else if (i === 0 && expectedDateStr !== today) {
        // If we're checking today and there's no data for today, continue
        continue;
      } else {
        // Streak broken
        break;
      }
    }

    return streak;
  }

  // Get sessions for specific vocabulary
  public async getSessionsForVocab(vocabId: number, limit: number = 10): Promise<StudySessionRecord[]> {
    try {
      const sql = `
        SELECT * FROM ${this.tableName} 
        WHERE is_deleted = 0 AND vocab_ids LIKE ?
        ORDER BY started_at DESC LIMIT ?
      `;
      
      const [result] = await this.database.executeSql(sql, [`%"${vocabId}"%`, limit]);
      const sessions: StudySessionRecord[] = [];

      for (let i = 0; i < result.rows.length; i++) {
        const session = this.transformFromStorage(result.rows.item(i));
        // Double-check that vocabId is actually in the array
        if (session.vocab_ids.includes(vocabId)) {
          sessions.push(session);
        }
      }

      return sessions;
    } catch (error) {
      console.error('Error getting sessions for vocab:', error);
      return [];
    }
  }

  // Clean up old sessions
  public async cleanupOldSessions(retentionDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const sql = `
        UPDATE ${this.tableName} 
        SET is_deleted = 1, updated_at = ?
        WHERE completed_at < ? AND is_deleted = 0
      `;

      const [result] = await this.database.executeSql(sql, [
        new Date().toISOString(),
        cutoffDate.toISOString()
      ]);

      console.log(`Cleaned up ${result.rowsAffected} old study sessions`);
      return result.rowsAffected;
    } catch (error) {
      console.error('Error cleaning up old sessions:', error);
      return 0;
    }
  }
}

export const studySessionModel = new StudySessionModel();