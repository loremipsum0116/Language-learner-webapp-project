// src/services/SyncOrchestrationService.ts
// 동기화 오케스트레이션 서비스 (온라인/오프라인 로직 관리)

import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import { database } from '../database/sqlite/Database';
import { vocabularyModel } from '../database/models/VocabularyModel';
import { cardModel } from '../database/models/CardModel';
import { studySessionModel } from '../database/models/StudySessionModel';
import { userProgressModel } from '../database/models/UserProgressModel';
import { audioFileModel } from '../database/models/AudioFileModel';
import { conflictResolutionService, DataConflict } from './ConflictResolutionService';
import { syncService } from './SyncService';
import { 
  DataSyncResult,
  SyncQueueItem,
  OfflineStorageConfig
} from '../types/OfflineDataTypes';

export interface SyncMode {
  mode: 'online' | 'offline' | 'hybrid';
  reason: 'network_available' | 'network_unavailable' | 'user_preference' | 'error_fallback';
  capabilities: string[];
}

export interface SyncOperation {
  id: string;
  type: 'upload' | 'download' | 'conflict_resolution';
  tableName: string;
  priority: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  metadata: {
    recordCount?: number;
    conflictCount?: number;
    retryCount: number;
    maxRetries: number;
  };
}

export interface SyncSession {
  id: string;
  startedAt: string;
  completedAt?: string;
  mode: SyncMode;
  operations: SyncOperation[];
  result?: DataSyncResult;
  totalRecords: number;
  processedRecords: number;
  errors: string[];
  warnings: string[];
}

export class SyncOrchestrationService {
  private static instance: SyncOrchestrationService;
  private currentMode: SyncMode = { 
    mode: 'offline', 
    reason: 'network_unavailable', 
    capabilities: [] 
  };
  private isOnline: boolean = false;
  private currentSession: SyncSession | null = null;
  private syncQueue: SyncQueueItem[] = [];
  private operationQueue: SyncOperation[] = [];
  private appStateSubscription: any = null;
  private networkSubscription: any = null;
  private syncTimer: NodeJS.Timeout | null = null;
  
  private config = {
    autoSyncInterval: 30 * 60 * 1000, // 30 minutes
    maxRetries: 3,
    retryDelay: 5000,
    batchSize: 50,
    conflictResolutionTimeout: 30000,
    offlineQueueMaxSize: 1000,
  };

  private constructor() {
    this.initializeListeners();
    this.loadSyncQueue();
  }

  public static getInstance(): SyncOrchestrationService {
    if (!SyncOrchestrationService.instance) {
      SyncOrchestrationService.instance = new SyncOrchestrationService();
    }
    return SyncOrchestrationService.instance;
  }

  // Initialize the service
  public async initialize(): Promise<void> {
    try {
      // Check initial network state
      const networkState = await NetInfo.fetch();
      this.isOnline = networkState.isConnected ?? false;
      
      // Set initial mode
      this.currentMode = await this.determineOptimalSyncMode();
      
      // Process any pending operations
      await this.processPendingOperations();
      
      // Start auto-sync timer
      this.startAutoSync();
      
      console.log('SyncOrchestrationService initialized with mode:', this.currentMode.mode);
    } catch (error) {
      console.error('Error initializing SyncOrchestrationService:', error);
    }
  }

  // Determine optimal sync mode based on current conditions
  private async determineOptimalSyncMode(): Promise<SyncMode> {
    try {
      const networkState = await NetInfo.fetch();
      const isConnected = networkState.isConnected ?? false;
      const connectionType = networkState.type;
      const isInternetReachable = networkState.isInternetReachable;

      if (!isConnected || isInternetReachable === false) {
        return {
          mode: 'offline',
          reason: 'network_unavailable',
          capabilities: [
            'local_storage',
            'offline_queries', 
            'queue_operations',
            'local_progress_tracking'
          ],
        };
      }

      // Check connection quality
      const connectionQuality = this.assessConnectionQuality(connectionType, networkState);
      
      if (connectionQuality === 'poor') {
        return {
          mode: 'hybrid',
          reason: 'network_available',
          capabilities: [
            'local_storage',
            'limited_sync',
            'priority_uploads',
            'background_downloads'
          ],
        };
      }

      return {
        mode: 'online',
        reason: 'network_available',
        capabilities: [
          'full_sync',
          'real_time_updates',
          'bulk_operations',
          'conflict_resolution',
          'media_downloads'
        ],
      };
    } catch (error) {
      console.error('Error determining sync mode:', error);
      return {
        mode: 'offline',
        reason: 'error_fallback',
        capabilities: ['local_storage'],
      };
    }
  }

  // Main synchronization method
  public async performSync(options: {
    forced?: boolean;
    priority?: string[];
    maxDuration?: number;
    conflictStrategy?: 'automatic' | 'manual';
  } = {}): Promise<DataSyncResult> {
    const { 
      forced = false, 
      priority = [], 
      maxDuration = 300000, // 5 minutes
      conflictStrategy = 'automatic' 
    } = options;

    if (this.currentSession && !forced) {
      throw new Error('Sync session already in progress');
    }

    // Create new sync session
    this.currentSession = this.createSyncSession();
    
    try {
      console.log(`Starting sync session ${this.currentSession.id} in ${this.currentMode.mode} mode`);
      
      const syncResult = await this.executeSyncSession(
        this.currentSession,
        { priority, maxDuration, conflictStrategy }
      );

      this.currentSession.result = syncResult;
      this.currentSession.completedAt = new Date().toISOString();
      
      // Save session for audit
      await this.saveSyncSession(this.currentSession);
      
      console.log('Sync session completed:', syncResult);
      return syncResult;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Sync session failed:', error);
      
      if (this.currentSession) {
        this.currentSession.errors.push(errorMessage);
        this.currentSession.completedAt = new Date().toISOString();
        await this.saveSyncSession(this.currentSession);
      }
      
      throw error;
    } finally {
      this.currentSession = null;
    }
  }

  // Execute sync session based on current mode
  private async executeSyncSession(
    session: SyncSession,
    options: {
      priority: string[];
      maxDuration: number;
      conflictStrategy: 'automatic' | 'manual';
    }
  ): Promise<DataSyncResult> {
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
      switch (session.mode.mode) {
        case 'online':
          await this.executeOnlineSync(session, result, options);
          break;
        case 'offline':
          await this.executeOfflineSync(session, result);
          break;
        case 'hybrid':
          await this.executeHybridSync(session, result, options);
          break;
      }

      result.success = result.errors.length === 0;
      result.totalTime = Date.now() - startTime;
      
      return result;
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : String(error));
      result.totalTime = Date.now() - startTime;
      throw error;
    }
  }

  // Online sync execution
  private async executeOnlineSync(
    session: SyncSession,
    result: DataSyncResult,
    options: { priority: string[]; conflictStrategy: 'automatic' | 'manual' }
  ): Promise<void> {
    // 1. Upload pending local changes
    await this.uploadPendingChanges(session, result);
    
    // 2. Download server updates
    await this.downloadServerUpdates(session, result);
    
    // 3. Resolve conflicts
    if (options.conflictStrategy === 'automatic') {
      await this.resolveConflictsAutomatically(session, result);
    } else {
      await this.queueConflictsForManualResolution(session, result);
    }
    
    // 4. Sync audio files if enabled
    if (session.mode.capabilities.includes('media_downloads')) {
      await this.syncAudioFiles(session, result);
    }
  }

  // Offline sync execution (local operations only)
  private async executeOfflineSync(
    session: SyncSession,
    result: DataSyncResult
  ): Promise<void> {
    // In offline mode, we only perform local operations
    
    // 1. Process local data operations
    await this.processLocalOperations(session, result);
    
    // 2. Queue operations for later sync
    await this.queueOperationsForLaterSync(session, result);
    
    // 3. Optimize local storage
    await this.optimizeLocalStorage(session, result);
    
    session.warnings.push('Operating in offline mode - server sync deferred');
  }

  // Hybrid sync execution (limited online operations)
  private async executeHybridSync(
    session: SyncSession,
    result: DataSyncResult,
    options: { priority: string[] }
  ): Promise<void> {
    // Hybrid mode: prioritize critical operations only
    
    // 1. Upload only high-priority changes
    await this.uploadHighPriorityChanges(session, result, options.priority);
    
    // 2. Download critical updates only
    await this.downloadCriticalUpdates(session, result);
    
    // 3. Defer non-critical operations
    await this.deferNonCriticalOperations(session, result);
    
    session.warnings.push('Operating in hybrid mode - limited sync performed');
  }

  // Upload pending changes to server
  private async uploadPendingChanges(
    session: SyncSession,
    result: DataSyncResult
  ): Promise<void> {
    try {
      // Process sync queue
      const pendingItems = await this.getPendingSyncItems();
      
      for (const item of pendingItems) {
        try {
          await this.uploadSyncItem(item, result);
          await this.removeSyncItem(item.id);
          session.processedRecords++;
        } catch (error) {
          console.error(`Error uploading sync item ${item.id}:`, error);
          result.errors.push(`Upload failed for ${item.table_name}:${item.record_id}`);
        }
      }
    } catch (error) {
      console.error('Error uploading pending changes:', error);
      result.errors.push('Failed to upload pending changes');
    }
  }

  // Download server updates
  private async downloadServerUpdates(
    session: SyncSession,
    result: DataSyncResult
  ): Promise<void> {
    try {
      const tables = ['vocabularies', 'user_progress', 'audio_files'];
      
      for (const tableName of tables) {
        try {
          const downloadResult = await this.downloadTableUpdates(tableName);
          
          // Update result based on table
          switch (tableName) {
            case 'vocabularies':
              result.syncedItems.vocabularies.downloaded = downloadResult.downloaded;
              break;
            case 'user_progress':
              result.syncedItems.userProgress.downloaded = downloadResult.downloaded;
              break;
            case 'audio_files':
              result.syncedItems.audioFiles.downloaded = downloadResult.downloaded;
              break;
          }
          
          session.processedRecords += downloadResult.downloaded;
        } catch (error) {
          console.error(`Error downloading ${tableName} updates:`, error);
          result.errors.push(`Download failed for ${tableName}`);
        }
      }
    } catch (error) {
      console.error('Error downloading server updates:', error);
      result.errors.push('Failed to download server updates');
    }
  }

  // Resolve conflicts automatically
  private async resolveConflictsAutomatically(
    session: SyncSession,
    result: DataSyncResult
  ): Promise<void> {
    try {
      const conflicts = await this.detectConflicts();
      
      if (conflicts.length === 0) {
        return;
      }

      console.log(`Resolving ${conflicts.length} conflicts automatically`);
      
      const resolutions = await conflictResolutionService.resolveConflicts(conflicts);
      let resolvedCount = 0;
      let manualReviewCount = 0;

      for (const resolution of resolutions) {
        if (resolution.resolved && !resolution.requiresManualReview) {
          await this.applyResolution(resolution);
          resolvedCount++;
        } else {
          await this.queueForManualReview(resolution);
          manualReviewCount++;
        }
      }

      // Update result with conflict resolution stats
      Object.keys(result.syncedItems).forEach(key => {
        (result.syncedItems as any)[key].conflicts = 
          conflicts.filter(c => c.tableName === key).length;
      });

      if (manualReviewCount > 0) {
        session.warnings.push(
          `${manualReviewCount} conflicts require manual review`
        );
      }

      console.log(`Conflicts resolved: ${resolvedCount}, Manual review: ${manualReviewCount}`);
    } catch (error) {
      console.error('Error resolving conflicts:', error);
      result.errors.push('Failed to resolve conflicts automatically');
    }
  }

  // Network state and app state listeners
  private initializeListeners(): void {
    // Network state listener
    this.networkSubscription = NetInfo.addEventListener(async (state) => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected ?? false;

      if (!wasOnline && this.isOnline) {
        // Network reconnected
        console.log('Network reconnected - switching sync mode');
        this.currentMode = await this.determineOptimalSyncMode();
        
        // Trigger sync after connection stabilizes
        setTimeout(() => {
          this.performSync({ forced: false }).catch(console.error);
        }, 3000);
      } else if (wasOnline && !this.isOnline) {
        // Network disconnected
        console.log('Network disconnected - switching to offline mode');
        this.currentMode = {
          mode: 'offline',
          reason: 'network_unavailable',
          capabilities: ['local_storage', 'queue_operations'],
        };
      }
    });

    // App state listener
    this.appStateSubscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && this.isOnline) {
        // App became active and online - perform sync
        setTimeout(() => {
          this.performSync({ forced: false }).catch(console.error);
        }, 1000);
      }
    });
  }

  // Helper methods
  private createSyncSession(): SyncSession {
    return {
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      startedAt: new Date().toISOString(),
      mode: { ...this.currentMode },
      operations: [],
      totalRecords: 0,
      processedRecords: 0,
      errors: [],
      warnings: [],
    };
  }

  private assessConnectionQuality(
    connectionType: string | null,
    networkState: any
  ): 'excellent' | 'good' | 'poor' {
    if (!connectionType) return 'poor';
    
    switch (connectionType.toLowerCase()) {
      case 'wifi':
        return 'excellent';
      case '5g':
      case '4g':
        return 'good';
      case '3g':
        return 'poor';
      case '2g':
      case 'edge':
      case 'gprs':
        return 'poor';
      default:
        return 'good';
    }
  }

  // Auto-sync management
  private startAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(async () => {
      if (this.isOnline && !this.currentSession) {
        try {
          await this.performSync({ forced: false });
        } catch (error) {
          console.error('Auto-sync failed:', error);
        }
      }
    }, this.config.autoSyncInterval);
  }

  private stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  // Placeholder methods for actual sync operations
  private async getPendingSyncItems(): Promise<SyncQueueItem[]> {
    // Implementation would retrieve pending sync items from database
    return [];
  }

  private async uploadSyncItem(item: SyncQueueItem, result: DataSyncResult): Promise<void> {
    // Implementation would upload individual sync item to server
  }

  private async removeSyncItem(id: number): Promise<void> {
    // Implementation would remove sync item from queue
  }

  private async downloadTableUpdates(tableName: string): Promise<{ downloaded: number }> {
    // Implementation would download updates for specific table
    return { downloaded: 0 };
  }

  private async detectConflicts(): Promise<DataConflict[]> {
    // Implementation would detect conflicts between local and server data
    return [];
  }

  private async applyResolution(resolution: any): Promise<void> {
    // Implementation would apply conflict resolution
  }

  private async queueForManualReview(resolution: any): Promise<void> {
    // Implementation would queue conflict for manual review
  }

  private async processLocalOperations(session: SyncSession, result: DataSyncResult): Promise<void> {
    // Implementation for offline-only operations
  }

  private async queueOperationsForLaterSync(session: SyncSession, result: DataSyncResult): Promise<void> {
    // Implementation to queue operations for when online
  }

  private async optimizeLocalStorage(session: SyncSession, result: DataSyncResult): Promise<void> {
    // Implementation for local storage optimization
  }

  private async uploadHighPriorityChanges(session: SyncSession, result: DataSyncResult, priority: string[]): Promise<void> {
    // Implementation for priority uploads in hybrid mode
  }

  private async downloadCriticalUpdates(session: SyncSession, result: DataSyncResult): Promise<void> {
    // Implementation for critical downloads in hybrid mode
  }

  private async deferNonCriticalOperations(session: SyncSession, result: DataSyncResult): Promise<void> {
    // Implementation for deferring operations in hybrid mode
  }

  private async syncAudioFiles(session: SyncSession, result: DataSyncResult): Promise<void> {
    // Implementation for audio file synchronization
  }

  private async processPendingOperations(): Promise<void> {
    // Implementation to process pending operations on startup
  }

  // Storage methods
  private async loadSyncQueue(): Promise<void> {
    try {
      const queueStr = await AsyncStorage.getItem('@sync_queue');
      if (queueStr) {
        this.syncQueue = JSON.parse(queueStr);
      }
    } catch (error) {
      console.error('Error loading sync queue:', error);
    }
  }

  private async saveSyncSession(session: SyncSession): Promise<void> {
    try {
      await AsyncStorage.setItem(`@sync_session_${session.id}`, JSON.stringify(session));
    } catch (error) {
      console.error('Error saving sync session:', error);
    }
  }

  // Public getters and configuration
  public getCurrentMode(): SyncMode {
    return { ...this.currentMode };
  }

  public getCurrentSession(): SyncSession | null {
    return this.currentSession ? { ...this.currentSession } : null;
  }

  public isCurrentlySyncing(): boolean {
    return this.currentSession !== null;
  }

  public updateConfig(config: Partial<typeof this.config>): void {
    this.config = { ...this.config, ...config };
  }

  // Cleanup
  public destroy(): void {
    this.stopAutoSync();
    
    if (this.networkSubscription) {
      this.networkSubscription();
    }
    
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
  }
}

// Export singleton instance
export const syncOrchestrationService = SyncOrchestrationService.getInstance();
export default SyncOrchestrationService;