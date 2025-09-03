// src/services/ConflictResolutionService.ts
// 데이터 충돌 해결 알고리즘 서비스

import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  ConflictResolutionStrategy,
  Vocab,
  StudySession,
  UserProgress,
  AudioFile
} from '../types/OfflineDataTypes';

export interface DataConflict<T = any> {
  id: string;
  tableName: string;
  localRecord: T;
  serverRecord: T;
  conflictType: 'update' | 'delete' | 'create';
  lastSyncTime?: string;
  conflictFields: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  autoResolvable: boolean;
}

export interface ConflictResolutionResult<T = any> {
  resolved: boolean;
  resolvedRecord?: T;
  strategy: string;
  requiresManualReview: boolean;
  backupRecord?: T;
  resolutionMetadata: {
    timestamp: string;
    algorithm: string;
    confidence: number; // 0-1
    fieldResolutions: { [field: string]: 'local' | 'server' | 'merged' | 'manual' };
  };
}

export class ConflictResolutionService {
  private static instance: ConflictResolutionService;
  private resolutionStrategy: ConflictResolutionStrategy = {
    vocabularies: 'merge',
    studySessions: 'client',
    userProgress: 'merge',
    audioFiles: 'server',
  };

  private constructor() {
    this.loadResolutionStrategy();
  }

  public static getInstance(): ConflictResolutionService {
    if (!ConflictResolutionService.instance) {
      ConflictResolutionService.instance = new ConflictResolutionService();
    }
    return ConflictResolutionService.instance;
  }

  // Main conflict resolution method
  public async resolveConflict<T>(conflict: DataConflict<T>): Promise<ConflictResolutionResult<T>> {
    try {
      console.log(`Resolving conflict for ${conflict.tableName}:${conflict.id}`, conflict.conflictType);

      const strategy = this.getStrategyForTable(conflict.tableName);
      const result = await this.applyResolutionStrategy(conflict, strategy);

      // Log resolution for audit trail
      await this.logConflictResolution(conflict, result);

      return result;
    } catch (error) {
      console.error('Error resolving conflict:', error);
      return {
        resolved: false,
        strategy: 'error',
        requiresManualReview: true,
        resolutionMetadata: {
          timestamp: new Date().toISOString(),
          algorithm: 'error_fallback',
          confidence: 0,
          fieldResolutions: {},
        },
      };
    }
  }

  // Apply specific resolution strategy
  private async applyResolutionStrategy<T>(
    conflict: DataConflict<T>, 
    strategy: 'server' | 'client' | 'merge' | 'manual'
  ): Promise<ConflictResolutionResult<T>> {
    switch (strategy) {
      case 'server':
        return this.resolveWithServerWins(conflict);
      case 'client':
        return this.resolveWithClientWins(conflict);
      case 'merge':
        return this.resolveWithMerge(conflict);
      case 'manual':
        return this.requireManualResolution(conflict);
      default:
        return this.resolveWithMerge(conflict); // Default fallback
    }
  }

  // Server wins strategy
  private resolveWithServerWins<T>(conflict: DataConflict<T>): ConflictResolutionResult<T> {
    return {
      resolved: true,
      resolvedRecord: conflict.serverRecord,
      strategy: 'server_wins',
      requiresManualReview: false,
      backupRecord: conflict.localRecord,
      resolutionMetadata: {
        timestamp: new Date().toISOString(),
        algorithm: 'server_priority',
        confidence: 0.9,
        fieldResolutions: this.createFieldResolutions(conflict, 'server'),
      },
    };
  }

  // Client wins strategy
  private resolveWithClientWins<T>(conflict: DataConflict<T>): ConflictResolutionResult<T> {
    return {
      resolved: true,
      resolvedRecord: conflict.localRecord,
      strategy: 'client_wins',
      requiresManualReview: false,
      backupRecord: conflict.serverRecord,
      resolutionMetadata: {
        timestamp: new Date().toISOString(),
        algorithm: 'client_priority',
        confidence: 0.8,
        fieldResolutions: this.createFieldResolutions(conflict, 'local'),
      },
    };
  }

  // Intelligent merge strategy
  private resolveWithMerge<T>(conflict: DataConflict<T>): ConflictResolutionResult<T> {
    const mergeResult = this.performIntelligentMerge(conflict);
    
    return {
      resolved: true,
      resolvedRecord: mergeResult.mergedRecord,
      strategy: 'intelligent_merge',
      requiresManualReview: mergeResult.confidence < 0.7,
      backupRecord: conflict.localRecord,
      resolutionMetadata: {
        timestamp: new Date().toISOString(),
        algorithm: mergeResult.algorithm,
        confidence: mergeResult.confidence,
        fieldResolutions: mergeResult.fieldResolutions,
      },
    };
  }

  // Manual resolution required
  private requireManualResolution<T>(conflict: DataConflict<T>): ConflictResolutionResult<T> {
    return {
      resolved: false,
      strategy: 'manual_required',
      requiresManualReview: true,
      resolutionMetadata: {
        timestamp: new Date().toISOString(),
        algorithm: 'manual_review',
        confidence: 0,
        fieldResolutions: {},
      },
    };
  }

  // Intelligent merge algorithm
  private performIntelligentMerge<T>(conflict: DataConflict<T>): {
    mergedRecord: T;
    confidence: number;
    algorithm: string;
    fieldResolutions: { [field: string]: 'local' | 'server' | 'merged' | 'manual' };
  } {
    const local = conflict.localRecord as any;
    const server = conflict.serverRecord as any;
    const merged = { ...local };
    const fieldResolutions: { [field: string]: 'local' | 'server' | 'merged' | 'manual' } = {};
    let confidence = 1.0;
    const confidenceDecrease = 0.1;

    // Table-specific merge logic
    switch (conflict.tableName) {
      case 'vocabularies':
        return this.mergeVocabulary(conflict as DataConflict<Vocab>);
      case 'study_sessions':
        return this.mergeStudySession(conflict as DataConflict<StudySession>);
      case 'user_progress':
        return this.mergeUserProgress(conflict as DataConflict<UserProgress>);
      case 'audio_files':
        return this.mergeAudioFile(conflict as DataConflict<AudioFile>);
      default:
        return this.performGenericMerge(conflict);
    }
  }

  // Vocabulary-specific merge logic
  private mergeVocabulary(conflict: DataConflict<Vocab>): {
    mergedRecord: Vocab;
    confidence: number;
    algorithm: string;
    fieldResolutions: { [field: string]: 'local' | 'server' | 'merged' | 'manual' };
  } {
    const local = conflict.localRecord;
    const server = conflict.serverRecord;
    const merged = { ...local };
    const fieldResolutions: { [field: string]: 'local' | 'server' | 'merged' | 'manual' } = {};
    let confidence = 1.0;

    // Core vocabulary data (prefer server)
    if (server.lemma && server.lemma !== local.lemma) {
      merged.lemma = server.lemma;
      fieldResolutions.lemma = 'server';
    }

    if (server.definition && server.definition !== local.definition) {
      merged.definition = server.definition;
      fieldResolutions.definition = 'server';
    }

    // Pronunciation and audio (prefer server)
    if (server.pronunciation) {
      merged.pronunciation = server.pronunciation;
      fieldResolutions.pronunciation = 'server';
    }

    if (server.audio_url) {
      merged.audio_url = server.audio_url;
      fieldResolutions.audio_url = 'server';
    }

    // User-specific data (prefer local)
    if (local.audio_file_path) {
      merged.audio_file_path = local.audio_file_path;
      fieldResolutions.audio_file_path = 'local';
    }

    // Merge tags intelligently
    if (server.tags && local.tags) {
      const mergedTags = [...new Set([...local.tags, ...server.tags])];
      merged.tags = mergedTags;
      fieldResolutions.tags = 'merged';
    } else if (server.tags) {
      merged.tags = server.tags;
      fieldResolutions.tags = 'server';
    }

    // Timestamps (prefer most recent)
    const localTime = new Date(local.updated_at);
    const serverTime = new Date(server.updated_at);
    
    if (serverTime > localTime) {
      merged.updated_at = server.updated_at;
      confidence -= 0.05; // Slight confidence decrease for timestamp conflicts
    }

    return {
      mergedRecord: merged,
      confidence,
      algorithm: 'vocabulary_intelligent_merge',
      fieldResolutions,
    };
  }

  // Study session merge logic
  private mergeStudySession(conflict: DataConflict<StudySession>): {
    mergedRecord: StudySession;
    confidence: number;
    algorithm: string;
    fieldResolutions: { [field: string]: 'local' | 'server' | 'merged' | 'manual' };
  } {
    const local = conflict.localRecord;
    const server = conflict.serverRecord;
    const fieldResolutions: { [field: string]: 'local' | 'server' | 'merged' | 'manual' } = {};

    // For study sessions, local data is usually more complete and recent
    // Server should only override if it has newer completion data

    if (server.completed_at && !local.completed_at) {
      // Server has completion data that local doesn't
      return {
        mergedRecord: server,
        confidence: 0.8,
        algorithm: 'study_session_server_completion',
        fieldResolutions: { '*': 'server' },
      };
    }

    // Local data wins for study sessions (client authoritative)
    return {
      mergedRecord: local,
      confidence: 0.9,
      algorithm: 'study_session_client_authoritative',
      fieldResolutions: { '*': 'local' },
    };
  }

  // User progress merge logic
  private mergeUserProgress(conflict: DataConflict<UserProgress>): {
    mergedRecord: UserProgress;
    confidence: number;
    algorithm: string;
    fieldResolutions: { [field: string]: 'local' | 'server' | 'merged' | 'manual' };
  } {
    const local = conflict.localRecord;
    const server = conflict.serverRecord;
    const merged = { ...local };
    const fieldResolutions: { [field: string]: 'local' | 'server' | 'merged' | 'manual' } = {};
    let confidence = 0.8;

    // Use highest values for cumulative stats
    if (server.total_studied > local.total_studied) {
      merged.total_studied = server.total_studied;
      fieldResolutions.total_studied = 'server';
    }

    if (server.experience_points > local.experience_points) {
      merged.experience_points = server.experience_points;
      merged.level = server.level; // Level should correspond to XP
      fieldResolutions.experience_points = 'server';
      fieldResolutions.level = 'server';
    }

    // Use longest streak
    if (server.streak_days > local.streak_days) {
      merged.streak_days = server.streak_days;
      fieldResolutions.streak_days = 'server';
    }

    // Merge achievements
    if (server.achievements_unlocked && local.achievements_unlocked) {
      const mergedAchievements = [...new Set([
        ...local.achievements_unlocked,
        ...server.achievements_unlocked
      ])];
      merged.achievements_unlocked = mergedAchievements;
      fieldResolutions.achievements_unlocked = 'merged';
    }

    return {
      mergedRecord: merged,
      confidence,
      algorithm: 'user_progress_cumulative_merge',
      fieldResolutions,
    };
  }

  // Audio file merge logic
  private mergeAudioFile(conflict: DataConflict<AudioFile>): {
    mergedRecord: AudioFile;
    confidence: number;
    algorithm: string;
    fieldResolutions: { [field: string]: 'local' | 'server' | 'merged' | 'manual' };
  } {
    const local = conflict.localRecord;
    const server = conflict.serverRecord;
    const merged = { ...server }; // Prefer server for audio metadata
    const fieldResolutions: { [field: string]: 'local' | 'server' | 'merged' | 'manual' } = {};

    // Keep local download status and file path
    merged.is_downloaded = local.is_downloaded;
    merged.download_date = local.download_date;
    merged.file_path = local.file_path;
    
    fieldResolutions.is_downloaded = 'local';
    fieldResolutions.download_date = 'local';
    fieldResolutions.file_path = 'local';

    // Server data for metadata
    fieldResolutions.download_url = 'server';
    fieldResolutions.file_size = 'server';
    fieldResolutions.duration = 'server';
    fieldResolutions.checksum = 'server';

    return {
      mergedRecord: merged,
      confidence: 0.9,
      algorithm: 'audio_file_metadata_local_status',
      fieldResolutions,
    };
  }

  // Generic merge for unknown tables
  private performGenericMerge<T>(conflict: DataConflict<T>): {
    mergedRecord: T;
    confidence: number;
    algorithm: string;
    fieldResolutions: { [field: string]: 'local' | 'server' | 'merged' | 'manual' };
  } {
    const local = conflict.localRecord as any;
    const server = conflict.serverRecord as any;
    const merged = { ...local };
    const fieldResolutions: { [field: string]: 'local' | 'server' | 'merged' | 'manual' } = {};
    let confidence = 0.6; // Lower confidence for generic merge

    // Basic timestamp-based merge
    const commonFields = ['updated_at', 'created_at', 'synced_at'];
    
    for (const field of commonFields) {
      if (server[field] && local[field]) {
        const serverTime = new Date(server[field]);
        const localTime = new Date(local[field]);
        
        if (field === 'updated_at' && serverTime > localTime) {
          // Use server data for more recent updates
          Object.keys(server).forEach(key => {
            if (server[key] !== null && server[key] !== undefined) {
              merged[key] = server[key];
              fieldResolutions[key] = 'server';
            }
          });
          confidence -= 0.1;
        }
      }
    }

    return {
      mergedRecord: merged,
      confidence,
      algorithm: 'generic_timestamp_merge',
      fieldResolutions,
    };
  }

  // Batch conflict resolution
  public async resolveConflicts<T>(conflicts: DataConflict<T>[]): Promise<ConflictResolutionResult<T>[]> {
    const results: ConflictResolutionResult<T>[] = [];
    
    // Sort conflicts by priority
    const sortedConflicts = conflicts.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    for (const conflict of sortedConflicts) {
      try {
        const result = await this.resolveConflict(conflict);
        results.push(result);
        
        // Add delay between resolutions to prevent overwhelming
        if (conflicts.length > 10) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(`Error resolving conflict ${conflict.id}:`, error);
        results.push({
          resolved: false,
          strategy: 'batch_error',
          requiresManualReview: true,
          resolutionMetadata: {
            timestamp: new Date().toISOString(),
            algorithm: 'batch_error_handling',
            confidence: 0,
            fieldResolutions: {},
          },
        });
      }
    }

    return results;
  }

  // Helper methods
  private getStrategyForTable(tableName: string): 'server' | 'client' | 'merge' | 'manual' {
    switch (tableName) {
      case 'vocabularies':
        return this.resolutionStrategy.vocabularies;
      case 'study_sessions':
        return this.resolutionStrategy.studySessions;
      case 'user_progress':
        return this.resolutionStrategy.userProgress;
      case 'audio_files':
        return this.resolutionStrategy.audioFiles;
      default:
        return 'merge';
    }
  }

  private createFieldResolutions<T>(
    conflict: DataConflict<T>, 
    strategy: 'local' | 'server'
  ): { [field: string]: 'local' | 'server' | 'merged' | 'manual' } {
    const resolutions: { [field: string]: 'local' | 'server' | 'merged' | 'manual' } = {};
    
    Object.keys(conflict.localRecord as any).forEach(field => {
      resolutions[field] = strategy;
    });
    
    return resolutions;
  }

  // Logging and persistence
  private async logConflictResolution<T>(
    conflict: DataConflict<T>, 
    result: ConflictResolutionResult<T>
  ): Promise<void> {
    try {
      const logEntry = {
        conflictId: conflict.id,
        tableName: conflict.tableName,
        conflictType: conflict.conflictType,
        strategy: result.strategy,
        resolved: result.resolved,
        confidence: result.resolutionMetadata.confidence,
        timestamp: result.resolutionMetadata.timestamp,
        requiresManualReview: result.requiresManualReview,
      };

      // Store in resolution log
      const existingLog = await AsyncStorage.getItem('@conflict_resolution_log');
      const log = existingLog ? JSON.parse(existingLog) : [];
      log.push(logEntry);
      
      // Keep only last 100 entries
      if (log.length > 100) {
        log.splice(0, log.length - 100);
      }
      
      await AsyncStorage.setItem('@conflict_resolution_log', JSON.stringify(log));
    } catch (error) {
      console.error('Error logging conflict resolution:', error);
    }
  }

  // Configuration management
  public updateResolutionStrategy(strategy: Partial<ConflictResolutionStrategy>): void {
    this.resolutionStrategy = { ...this.resolutionStrategy, ...strategy };
    this.saveResolutionStrategy();
  }

  public getResolutionStrategy(): ConflictResolutionStrategy {
    return { ...this.resolutionStrategy };
  }

  private async loadResolutionStrategy(): Promise<void> {
    try {
      const strategyStr = await AsyncStorage.getItem('@conflict_resolution_strategy');
      if (strategyStr) {
        const strategy = JSON.parse(strategyStr);
        this.resolutionStrategy = { ...this.resolutionStrategy, ...strategy };
      }
    } catch (error) {
      console.error('Error loading resolution strategy:', error);
    }
  }

  private async saveResolutionStrategy(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        '@conflict_resolution_strategy', 
        JSON.stringify(this.resolutionStrategy)
      );
    } catch (error) {
      console.error('Error saving resolution strategy:', error);
    }
  }

  // Get resolution statistics
  public async getResolutionStats(): Promise<{
    totalResolutions: number;
    successRate: number;
    averageConfidence: number;
    manualReviewRate: number;
    strategyCounts: { [strategy: string]: number };
  }> {
    try {
      const logStr = await AsyncStorage.getItem('@conflict_resolution_log');
      if (!logStr) {
        return {
          totalResolutions: 0,
          successRate: 0,
          averageConfidence: 0,
          manualReviewRate: 0,
          strategyCounts: {},
        };
      }

      const log = JSON.parse(logStr);
      const totalResolutions = log.length;
      const successful = log.filter((entry: any) => entry.resolved).length;
      const manualReview = log.filter((entry: any) => entry.requiresManualReview).length;
      
      const averageConfidence = log.reduce((sum: number, entry: any) => 
        sum + (entry.confidence || 0), 0) / totalResolutions;

      const strategyCounts = log.reduce((counts: any, entry: any) => {
        counts[entry.strategy] = (counts[entry.strategy] || 0) + 1;
        return counts;
      }, {});

      return {
        totalResolutions,
        successRate: totalResolutions > 0 ? successful / totalResolutions : 0,
        averageConfidence,
        manualReviewRate: totalResolutions > 0 ? manualReview / totalResolutions : 0,
        strategyCounts,
      };
    } catch (error) {
      console.error('Error getting resolution stats:', error);
      return {
        totalResolutions: 0,
        successRate: 0,
        averageConfidence: 0,
        manualReviewRate: 0,
        strategyCounts: {},
      };
    }
  }
}

// Export singleton instance
export const conflictResolutionService = ConflictResolutionService.getInstance();
export default ConflictResolutionService;