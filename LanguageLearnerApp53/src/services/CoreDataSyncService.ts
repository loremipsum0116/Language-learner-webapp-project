// src/services/CoreDataSyncService.ts
// 핵심 학습 데이터 동기화 서비스

import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { vocabularyModel } from '../database/models/VocabularyModel';
import { cardModel } from '../database/models/CardModel';
import { studySessionModel } from '../database/models/StudySessionModel';
import { userProgressModel } from '../database/models/UserProgressModel';
import { audioFileModel } from '../database/models/AudioFileModel';
import { syncService } from './SyncService';
import {
  DataSyncResult,
  OfflineData,
  ConflictResolutionStrategy,
  SyncQueueItem
} from '../types/OfflineDataTypes';

interface SyncPriority {
  userProgress: number;
  studySessions: number;
  vocabularies: number;
  cards: number;
  audioFiles: number;
}

interface SyncStats {
  lastFullSync: string;
  lastPartialSync: string;
  syncFailures: number;
  totalSyncedItems: number;
  averageSyncTime: number;
}

export class CoreDataSyncService {
  private static instance: CoreDataSyncService;
  private isSyncing: boolean = false;
  private syncQueue: SyncQueueItem[] = [];
  private conflictStrategy: ConflictResolutionStrategy = {
    vocabularies: 'server',
    studySessions: 'client',
    userProgress: 'merge',
    audioFiles: 'server',
  };
  private syncPriority: SyncPriority = {
    userProgress: 10,
    studySessions: 8,
    vocabularies: 6,
    cards: 7,
    audioFiles: 3,
  };
  private syncStats: SyncStats = {
    lastFullSync: '',
    lastPartialSync: '',
    syncFailures: 0,
    totalSyncedItems: 0,
    averageSyncTime: 0,
  };

  private constructor() {
    this.loadSyncStats();
  }

  public static getInstance(): CoreDataSyncService {
    if (!CoreDataSyncService.instance) {
      CoreDataSyncService.instance = new CoreDataSyncService();
    }
    return CoreDataSyncService.instance;
  }

  // Perform comprehensive sync of all core learning data
  public async syncAllCoreData(options: {
    forceFull?: boolean;
    priority?: string[];
    maxRetries?: number;
  } = {}): Promise<DataSyncResult> {
    const { forceFull = false, priority = [], maxRetries = 3 } = options;

    if (this.isSyncing) {
      throw new Error('Sync already in progress');
    }

    // Check network connectivity
    const networkState = await NetInfo.fetch();
    if (!networkState.isConnected) {
      throw new Error('No network connection available');
    }

    this.isSyncing = true;
    const startTime = Date.now();

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

    try {
      console.log('Starting comprehensive core data sync...');

      // Determine sync order based on priority
      const syncOrder = this.determineSyncOrder(priority);

      // Sync each data type
      for (const dataType of syncOrder) {
        try {
          console.log(`Syncing ${dataType}...`);
          
          const syncResult = await this.syncDataType(dataType, { forceFull, maxRetries });
          result.syncedItems[dataType] = syncResult;
          
          console.log(`${dataType} sync completed:`, syncResult);
        } catch (error) {
          const errorMessage = `Failed to sync ${dataType}: ${error}`;
          console.error(errorMessage);
          result.errors.push(errorMessage);
          this.syncStats.syncFailures++;
        }
      }

      // Process any remaining sync queue items
      await this.processSyncQueue();

      result.success = result.errors.length === 0;
      result.totalTime = Date.now() - startTime;

      // Update sync statistics
      this.updateSyncStats(result);

      console.log('Core data sync completed:', result);

      return result;
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : String(error));
      result.totalTime = Date.now() - startTime;
      this.syncStats.syncFailures++;
      
      console.error('Core data sync failed:', error);
      return result;
    } finally {
      this.isSyncing = false;
      await this.saveSyncStats();
    }
  }

  // Sync specific data type
  private async syncDataType(
    dataType: keyof DataSyncResult['syncedItems'],
    options: { forceFull?: boolean; maxRetries?: number } = {}
  ): Promise<{ uploaded: number; downloaded: number; conflicts: number }> {
    const { forceFull = false, maxRetries = 3 } = options;
    let retries = 0;

    while (retries < maxRetries) {
      try {
        switch (dataType) {
          case 'vocabularies':
            return await this.syncVocabularies(forceFull);
          case 'studySessions':
            return await this.syncStudySessions(forceFull);
          case 'userProgress':
            return await this.syncUserProgress(forceFull);
          case 'audioFiles':
            return await this.syncAudioFiles(forceFull);
          default:
            throw new Error(`Unknown data type: ${dataType}`);
        }
      } catch (error) {
        retries++;
        if (retries >= maxRetries) {
          throw error;
        }
        
        console.warn(`Sync attempt ${retries} failed for ${dataType}, retrying...`);
        await this.delay(1000 * retries); // Exponential backoff
      }
    }

    return { uploaded: 0, downloaded: 0, conflicts: 0 };
  }

  // Sync vocabularies
  private async syncVocabularies(forceFull: boolean): Promise<{ uploaded: number; downloaded: 0; conflicts: number }> {
    try {
      // Use existing SyncService for vocabularies
      const syncResult = await syncService.syncNow(['vocabularies']);
      
      return {
        uploaded: syncResult.uploadedRecords,
        downloaded: syncResult.downloadedRecords,
        conflicts: syncResult.conflictsResolved,
      };
    } catch (error) {
      console.error('Error syncing vocabularies:', error);
      throw error;
    }
  }

  // Sync study sessions
  private async syncStudySessions(forceFull: boolean): Promise<{ uploaded: number; downloaded: number; conflicts: number }> {
    try {
      let uploaded = 0;
      let downloaded = 0;
      let conflicts = 0;

      // Get unsynced study sessions
      const unsyncedSessions = await this.getUnsyncedStudySessions();
      
      if (unsyncedSessions.length > 0) {
        // Upload unsynced sessions
        const uploadResult = await this.uploadStudySessions(unsyncedSessions);
        uploaded = uploadResult.uploaded;
        conflicts += uploadResult.conflicts;
      }

      // Download server updates
      const lastSync = await this.getLastSyncTime('study_sessions');
      if (forceFull || !lastSync) {
        const downloadResult = await this.downloadStudySessions(lastSync);
        downloaded = downloadResult.downloaded;
        conflicts += downloadResult.conflicts;
      }

      return { uploaded, downloaded, conflicts };
    } catch (error) {
      console.error('Error syncing study sessions:', error);
      throw error;
    }
  }

  // Sync user progress
  private async syncUserProgress(forceFull: boolean): Promise<{ uploaded: number; downloaded: number; conflicts: number }> {
    try {
      let uploaded = 0;
      let downloaded = 0;
      let conflicts = 0;

      // Get recent progress records
      const recentProgress = await this.getUnsyncedProgress();
      
      if (recentProgress.length > 0) {
        // Upload recent progress
        const uploadResult = await this.uploadUserProgress(recentProgress);
        uploaded = uploadResult.uploaded;
        conflicts += uploadResult.conflicts;
      }

      // Download server progress updates
      const lastSync = await this.getLastSyncTime('user_progress');
      if (forceFull || !lastSync || this.shouldSyncProgress(lastSync)) {
        const downloadResult = await this.downloadUserProgress(lastSync);
        downloaded = downloadResult.downloaded;
        conflicts += downloadResult.conflicts;
      }

      return { uploaded, downloaded, conflicts };
    } catch (error) {
      console.error('Error syncing user progress:', error);
      throw error;
    }
  }

  // Sync audio files metadata
  private async syncAudioFiles(forceFull: boolean): Promise<{ uploaded: number; downloaded: number; conflicts: number }> {
    try {
      let uploaded = 0;
      let downloaded = 0;
      let conflicts = 0;

      // Sync audio file metadata (not actual files)
      const lastSync = await this.getLastSyncTime('audio_files');
      
      // Download new audio file records from server
      const downloadResult = await this.downloadAudioFileMetadata(lastSync);
      downloaded = downloadResult.downloaded;
      conflicts += downloadResult.conflicts;

      // Upload local audio file status updates
      const localUpdates = await this.getLocalAudioUpdates();
      if (localUpdates.length > 0) {
        const uploadResult = await this.uploadAudioFileUpdates(localUpdates);
        uploaded = uploadResult.uploaded;
      }

      return { uploaded, downloaded, conflicts };
    } catch (error) {
      console.error('Error syncing audio files:', error);
      throw error;
    }
  }

  // Helper methods
  private determineSyncOrder(priority: string[]): Array<keyof DataSyncResult['syncedItems']> {
    const defaultOrder: Array<keyof DataSyncResult['syncedItems']> = [
      'userProgress',
      'studySessions', 
      'vocabularies',
      'audioFiles'
    ];

    if (priority.length === 0) {
      return defaultOrder;
    }

    // Merge priority with default order
    const orderedTypes = [...priority, ...defaultOrder.filter(type => !priority.includes(type))];
    return orderedTypes as Array<keyof DataSyncResult['syncedItems']>;
  }

  private async processSyncQueue(): Promise<void> {
    try {
      // Process any queued sync items
      for (const item of this.syncQueue) {
        try {
          await this.processSyncQueueItem(item);
        } catch (error) {
          console.error(`Error processing sync queue item ${item.id}:`, error);
        }
      }
      this.syncQueue = [];
    } catch (error) {
      console.error('Error processing sync queue:', error);
    }
  }

  private async processSyncQueueItem(item: SyncQueueItem): Promise<void> {
    // Placeholder for sync queue item processing
    // This would handle individual sync operations that were queued
  }

  // Data retrieval methods (placeholders - would be implemented based on API)
  private async getUnsyncedStudySessions(): Promise<any[]> {
    // Get study sessions that haven't been synced to server
    return [];
  }

  private async getUnsyncedProgress(): Promise<any[]> {
    // Get progress records that haven't been synced
    return [];
  }

  private async getLocalAudioUpdates(): Promise<any[]> {
    // Get local audio file status updates
    return [];
  }

  // Upload methods (placeholders)
  private async uploadStudySessions(sessions: any[]): Promise<{ uploaded: number; conflicts: number }> {
    return { uploaded: sessions.length, conflicts: 0 };
  }

  private async uploadUserProgress(progress: any[]): Promise<{ uploaded: number; conflicts: number }> {
    return { uploaded: progress.length, conflicts: 0 };
  }

  private async uploadAudioFileUpdates(updates: any[]): Promise<{ uploaded: number }> {
    return { uploaded: updates.length };
  }

  // Download methods (placeholders)
  private async downloadStudySessions(since?: string): Promise<{ downloaded: number; conflicts: number }> {
    return { downloaded: 0, conflicts: 0 };
  }

  private async downloadUserProgress(since?: string): Promise<{ downloaded: number; conflicts: number }> {
    return { downloaded: 0, conflicts: 0 };
  }

  private async downloadAudioFileMetadata(since?: string): Promise<{ downloaded: number; conflicts: number }> {
    return { downloaded: 0, conflicts: 0 };
  }

  // Utility methods
  private async getLastSyncTime(table: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(`@last_sync_${table}`);
    } catch (error) {
      console.error(`Error getting last sync time for ${table}:`, error);
      return null;
    }
  }

  private shouldSyncProgress(lastSync: string): boolean {
    // Sync progress more frequently (e.g., if last sync was more than 1 hour ago)
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    return new Date(lastSync) < oneHourAgo;
  }

  private updateSyncStats(result: DataSyncResult): void {
    const now = new Date().toISOString();
    
    if (result.success) {
      this.syncStats.lastFullSync = now;
      this.syncStats.totalSyncedItems += Object.values(result.syncedItems)
        .reduce((sum, item) => sum + item.uploaded + item.downloaded, 0);
      
      // Update average sync time
      const totalSyncs = this.syncStats.totalSyncedItems > 0 ? Math.ceil(this.syncStats.totalSyncedItems / 10) : 1;
      this.syncStats.averageSyncTime = (
        (this.syncStats.averageSyncTime * (totalSyncs - 1) + result.totalTime) / totalSyncs
      );
    } else {
      this.syncStats.syncFailures++;
    }
    
    this.syncStats.lastPartialSync = now;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Storage methods
  private async loadSyncStats(): Promise<void> {
    try {
      const statsStr = await AsyncStorage.getItem('@sync_stats');
      if (statsStr) {
        this.syncStats = { ...this.syncStats, ...JSON.parse(statsStr) };
      }
    } catch (error) {
      console.error('Error loading sync stats:', error);
    }
  }

  private async saveSyncStats(): Promise<void> {
    try {
      await AsyncStorage.setItem('@sync_stats', JSON.stringify(this.syncStats));
    } catch (error) {
      console.error('Error saving sync stats:', error);
    }
  }

  // Public getters
  public getSyncStats(): SyncStats {
    return { ...this.syncStats };
  }

  public isSyncInProgress(): boolean {
    return this.isSyncing;
  }

  public updateConflictStrategy(strategy: Partial<ConflictResolutionStrategy>): void {
    this.conflictStrategy = { ...this.conflictStrategy, ...strategy };
  }

  public updateSyncPriority(priority: Partial<SyncPriority>): void {
    this.syncPriority = { ...this.syncPriority, ...priority };
  }
}

// Export singleton instance
export const coreDataSyncService = CoreDataSyncService.getInstance();
export default CoreDataSyncService;