// src/services/SyncService.ts
// 데이터 동기화 서비스

import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { database } from '../database/sqlite/Database';
import { vocabularyModel } from '../database/models/VocabularyModel';
import { cardModel } from '../database/models/CardModel';
import { studySessionModel } from '../database/models/StudySessionModel';
import { userProgressModel } from '../database/models/UserProgressModel';
import { audioFileModel } from '../database/models/AudioFileModel';

// Sync configuration
interface SyncConfig {
  maxRetries: number;
  retryDelay: number;
  batchSize: number;
  autoSyncInterval: number; // minutes
  syncOnAppForeground: boolean;
  syncOnNetworkReconnect: boolean;
}

const DEFAULT_SYNC_CONFIG: SyncConfig = {
  maxRetries: 3,
  retryDelay: 5000, // 5 seconds
  batchSize: 50,
  autoSyncInterval: 30, // 30 minutes
  syncOnAppForeground: true,
  syncOnNetworkReconnect: true,
};

// Sync result types
interface SyncResult {
  success: boolean;
  syncedTables: string[];
  errors: string[];
  uploadedRecords: number;
  downloadedRecords: number;
  conflictsResolved: number;
  timestamp: string;
}

interface ConflictResolution {
  strategy: 'server' | 'client' | 'merge';
  record: any;
  serverRecord: any;
  clientRecord: any;
}

export class SyncService {
  private static instance: SyncService;
  private isOnline: boolean = false;
  private isSyncing: boolean = false;
  private syncConfig: SyncConfig = DEFAULT_SYNC_CONFIG;
  private autoSyncTimer: NodeJS.Timeout | null = null;
  private apiBaseUrl: string = '';
  private authToken: string = '';

  private constructor() {
    this.initializeNetworkListener();
  }

  public static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  // Initialize service
  public async initialize(apiBaseUrl: string, authToken?: string): Promise<void> {
    this.apiBaseUrl = apiBaseUrl;
    if (authToken) {
      this.authToken = authToken;
    }

    // Load sync config
    await this.loadSyncConfig();
    
    // Check network status
    const networkState = await NetInfo.fetch();
    this.isOnline = networkState.isConnected ?? false;

    // Setup auto sync if enabled
    if (this.syncConfig.autoSyncInterval > 0) {
      this.startAutoSync();
    }

    console.log('SyncService initialized');
  }

  // Set authentication token
  public setAuthToken(token: string): void {
    this.authToken = token;
  }

  // Update sync configuration
  public updateConfig(config: Partial<SyncConfig>): void {
    this.syncConfig = { ...this.syncConfig, ...config };
    this.saveSyncConfig();
    
    // Restart auto sync if interval changed
    if (config.autoSyncInterval !== undefined) {
      this.stopAutoSync();
      if (config.autoSyncInterval > 0) {
        this.startAutoSync();
      }
    }
  }

  // Check if online
  public isOnlineMode(): boolean {
    return this.isOnline;
  }

  // Check if currently syncing
  public isSyncInProgress(): boolean {
    return this.isSyncing;
  }

  // Force sync now
  public async syncNow(tables?: string[]): Promise<SyncResult> {
    if (this.isSyncing) {
      throw new Error('Sync already in progress');
    }

    if (!this.isOnline) {
      throw new Error('No internet connection available');
    }

    this.isSyncing = true;

    try {
      console.log('Starting manual sync...');
      const result = await this.performSync(tables);
      
      // Log sync result
      await this.logSyncResult('manual', result);
      
      return result;
    } catch (error) {
      console.error('Manual sync failed:', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  // Perform full sync
  private async performSync(tables?: string[]): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      syncedTables: [],
      errors: [],
      uploadedRecords: 0,
      downloadedRecords: 0,
      conflictsResolved: 0,
      timestamp: new Date().toISOString(),
    };

    try {
      // Get tables to sync
      const tablesToSync = tables || ['vocabularies', 'cards', 'study_sessions', 'user_progress', 'audio_files'];

      for (const tableName of tablesToSync) {
        try {
          console.log(`Syncing table: ${tableName}`);
          
          // Upload local changes
          const uploadResult = await this.uploadTableChanges(tableName);
          result.uploadedRecords += uploadResult.uploaded;
          result.conflictsResolved += uploadResult.conflicts;

          // Download server changes
          const downloadResult = await this.downloadTableChanges(tableName);
          result.downloadedRecords += downloadResult.downloaded;

          result.syncedTables.push(tableName);
          
          console.log(`Table ${tableName} synced successfully`);
        } catch (tableError) {
          const errorMsg = `Failed to sync table ${tableName}: ${tableError}`;
          console.error(errorMsg);
          result.errors.push(errorMsg);
        }
      }

      // Clear sync queue for successful uploads
      await this.clearSyncQueue();

      result.success = result.errors.length === 0;
      
      console.log('Sync completed:', result);
      return result;
    } catch (error) {
      console.error('Sync failed:', error);
      result.errors.push(error instanceof Error ? error.message : String(error));
      return result;
    }
  }

  // Upload local changes to server
  private async uploadTableChanges(tableName: string): Promise<{ uploaded: number; conflicts: number }> {
    let uploaded = 0;
    let conflicts = 0;

    try {
      // Get pending sync items from queue
      const [result] = await database.executeSql(
        'SELECT * FROM sync_queue WHERE table_name = ? ORDER BY priority DESC, created_at ASC LIMIT ?',
        [tableName, this.syncConfig.batchSize]
      );

      if (result.rows.length === 0) {
        return { uploaded: 0, conflicts: 0 };
      }

      const syncItems = [];
      for (let i = 0; i < result.rows.length; i++) {
        syncItems.push(result.rows.item(i));
      }

      // Group by action type
      const groupedItems = this.groupSyncItemsByAction(syncItems);

      // Upload inserts
      if (groupedItems.insert.length > 0) {
        const insertResult = await this.uploadInserts(tableName, groupedItems.insert);
        uploaded += insertResult.uploaded;
        conflicts += insertResult.conflicts;
      }

      // Upload updates
      if (groupedItems.update.length > 0) {
        const updateResult = await this.uploadUpdates(tableName, groupedItems.update);
        uploaded += updateResult.uploaded;
        conflicts += updateResult.conflicts;
      }

      // Upload deletes
      if (groupedItems.delete.length > 0) {
        const deleteResult = await this.uploadDeletes(tableName, groupedItems.delete);
        uploaded += deleteResult.uploaded;
        conflicts += deleteResult.conflicts;
      }

      return { uploaded, conflicts };
    } catch (error) {
      console.error(`Error uploading ${tableName} changes:`, error);
      throw error;
    }
  }

  // Download server changes
  private async downloadTableChanges(tableName: string): Promise<{ downloaded: number }> {
    try {
      // Get last sync timestamp for this table
      const lastSyncTime = await this.getLastSyncTimestamp(tableName);
      
      const response = await fetch(`${this.apiBaseUrl}/sync/${tableName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({
          since: lastSyncTime,
          limit: this.syncConfig.batchSize,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success || !data.records) {
        throw new Error(data.message || 'Invalid response format');
      }

      // Process downloaded records
      let downloaded = 0;
      
      if (data.records.length > 0) {
        downloaded = await this.processDownloadedRecords(tableName, data.records);
        
        // Update last sync timestamp
        await this.updateLastSyncTimestamp(tableName, new Date().toISOString());
      }

      return { downloaded };
    } catch (error) {
      console.error(`Error downloading ${tableName} changes:`, error);
      throw error;
    }
  }

  // Process downloaded records
  private async processDownloadedRecords(tableName: string, records: any[]): Promise<number> {
    let processed = 0;

    for (const record of records) {
      try {
        const model = this.getModelForTable(tableName);
        if (!model) continue;

        const existing = record.id ? await model.findByServerId(record.id) : null;
        
        if (existing) {
          // Check for conflicts
          const conflict = this.detectConflict(existing, record);
          if (conflict) {
            await this.resolveConflict(tableName, conflict);
          } else {
            // Update existing record
            await model.update(existing.id!, this.transformServerRecord(record));
          }
        } else {
          // Create new record
          await model.create({
            ...this.transformServerRecord(record),
            server_id: record.id,
          });
        }

        processed++;
      } catch (recordError) {
        console.error(`Error processing record ${record.id}:`, recordError);
      }
    }

    return processed;
  }

  // Initialize network listener
  private initializeNetworkListener(): void {
    NetInfo.addEventListener(state => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected ?? false;
      
      console.log(`Network status changed: ${this.isOnline ? 'online' : 'offline'}`);

      // Auto sync on network reconnection
      if (!wasOnline && this.isOnline && this.syncConfig.syncOnNetworkReconnect) {
        this.scheduleAutoSync(5000); // Sync after 5 seconds
      }
    });
  }

  // Start auto sync
  private startAutoSync(): void {
    if (this.autoSyncTimer) {
      this.stopAutoSync();
    }

    const intervalMs = this.syncConfig.autoSyncInterval * 60 * 1000;
    this.autoSyncTimer = setInterval(() => {
      this.scheduleAutoSync();
    }, intervalMs);

    console.log(`Auto sync started with ${this.syncConfig.autoSyncInterval} minute interval`);
  }

  // Stop auto sync
  private stopAutoSync(): void {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
      console.log('Auto sync stopped');
    }
  }

  // Schedule auto sync
  private scheduleAutoSync(delay: number = 0): void {
    setTimeout(async () => {
      if (this.isOnline && !this.isSyncing) {
        try {
          console.log('Starting auto sync...');
          const result = await this.performSync();
          await this.logSyncResult('auto', result);
        } catch (error) {
          console.error('Auto sync failed:', error);
        }
      }
    }, delay);
  }

  // Helper methods
  private groupSyncItemsByAction(items: any[]): { insert: any[]; update: any[]; delete: any[] } {
    return items.reduce((groups, item) => {
      groups[item.action].push(item);
      return groups;
    }, { insert: [], update: [], delete: [] });
  }

  private getModelForTable(tableName: string): any {
    switch (tableName) {
      case 'vocabularies':
        return vocabularyModel;
      case 'cards':
        return cardModel;
      case 'study_sessions':
        return studySessionModel;
      case 'user_progress':
        return userProgressModel;
      case 'audio_files':
        return audioFileModel;
      default:
        return null;
    }
  }

  private transformServerRecord(record: any): any {
    // Remove server-specific fields and transform as needed
    const { id, ...transformedRecord } = record;
    return transformedRecord;
  }

  private detectConflict(localRecord: any, serverRecord: any): ConflictResolution | null {
    const localModified = new Date(localRecord.updated_at);
    const serverModified = new Date(serverRecord.updated_at);
    
    // Check if both have been modified since last sync
    if (localRecord.synced_at) {
      const lastSync = new Date(localRecord.synced_at);
      if (localModified > lastSync && serverModified > lastSync) {
        return {
          strategy: 'server', // Default to server wins
          record: serverRecord,
          serverRecord,
          clientRecord: localRecord,
        };
      }
    }

    return null;
  }

  private async resolveConflict(tableName: string, conflict: ConflictResolution): Promise<void> {
    // Implement conflict resolution based on strategy
    const model = this.getModelForTable(tableName);
    if (!model) return;

    switch (conflict.strategy) {
      case 'server':
        // Server record wins
        await model.update(conflict.clientRecord.id, this.transformServerRecord(conflict.serverRecord));
        break;
      case 'client':
        // Client record wins - do nothing, will be uploaded
        break;
      case 'merge':
        // Implement merge logic based on table
        const mergedRecord = this.mergeRecords(conflict.clientRecord, conflict.serverRecord);
        await model.update(conflict.clientRecord.id, mergedRecord);
        break;
    }
  }

  private mergeRecords(clientRecord: any, serverRecord: any): any {
    // Simple merge strategy - take newest non-null values
    const merged = { ...clientRecord };
    
    for (const [key, value] of Object.entries(serverRecord)) {
      if (value !== null && value !== undefined && value !== '') {
        if (merged[key] === null || merged[key] === undefined || merged[key] === '') {
          merged[key] = value;
        }
      }
    }

    return merged;
  }

  // Storage helpers
  private async loadSyncConfig(): Promise<void> {
    try {
      const configStr = await AsyncStorage.getItem('@sync_config');
      if (configStr) {
        const config = JSON.parse(configStr);
        this.syncConfig = { ...DEFAULT_SYNC_CONFIG, ...config };
      }
    } catch (error) {
      console.error('Error loading sync config:', error);
    }
  }

  private async saveSyncConfig(): Promise<void> {
    try {
      await AsyncStorage.setItem('@sync_config', JSON.stringify(this.syncConfig));
    } catch (error) {
      console.error('Error saving sync config:', error);
    }
  }

  private async getLastSyncTimestamp(tableName: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(`@last_sync_${tableName}`);
    } catch (error) {
      console.error('Error getting last sync timestamp:', error);
      return null;
    }
  }

  private async updateLastSyncTimestamp(tableName: string, timestamp: string): Promise<void> {
    try {
      await AsyncStorage.setItem(`@last_sync_${tableName}`, timestamp);
    } catch (error) {
      console.error('Error updating last sync timestamp:', error);
    }
  }

  private async clearSyncQueue(): Promise<void> {
    try {
      await database.executeSql('DELETE FROM sync_queue WHERE retry_count < max_retries');
    } catch (error) {
      console.error('Error clearing sync queue:', error);
    }
  }

  private async logSyncResult(type: 'manual' | 'auto', result: SyncResult): Promise<void> {
    try {
      await database.executeSql(
        'INSERT INTO sync_log (action, table_name, record_count, status, completed_at) VALUES (?, ?, ?, ?, ?)',
        [type, result.syncedTables.join(','), result.uploadedRecords + result.downloadedRecords, result.success ? 'success' : 'error', result.timestamp]
      );
    } catch (error) {
      console.error('Error logging sync result:', error);
    }
  }

  // Placeholder methods for upload operations
  private async uploadInserts(tableName: string, items: any[]): Promise<{ uploaded: number; conflicts: number }> {
    // Implementation for uploading new records
    return { uploaded: items.length, conflicts: 0 };
  }

  private async uploadUpdates(tableName: string, items: any[]): Promise<{ uploaded: number; conflicts: number }> {
    // Implementation for uploading updated records
    return { uploaded: items.length, conflicts: 0 };
  }

  private async uploadDeletes(tableName: string, items: any[]): Promise<{ uploaded: number; conflicts: number }> {
    // Implementation for uploading deleted records
    return { uploaded: items.length, conflicts: 0 };
  }
}

// Export singleton instance
export const syncService = SyncService.getInstance();
export default SyncService;