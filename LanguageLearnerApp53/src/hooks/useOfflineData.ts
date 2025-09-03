// src/hooks/useOfflineData.ts
// 오프라인 데이터 관리 훅

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useOfflineStatus } from './useOfflineStatus';
import { offlineService } from '../services/OfflineService';
import { coreDataSyncService } from '../services/CoreDataSyncService';
import { 
  OfflineData, 
  OfflineDataSummary, 
  DataSyncResult,
  OfflineStorageConfig
} from '../types/OfflineDataTypes';

interface OfflineDataState {
  data: OfflineData | null;
  summary: OfflineDataSummary | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastUpdated: string | null;
}

interface SyncState {
  isSyncing: boolean;
  lastSyncResult: DataSyncResult | null;
  syncProgress: number;
  syncError: string | null;
}

export const useOfflineData = (options: {
  autoRefresh?: boolean;
  refreshInterval?: number; // minutes
  syncOnAppForeground?: boolean;
  syncOnNetworkReconnect?: boolean;
} = {}) => {
  const {
    autoRefresh = true,
    refreshInterval = 30,
    syncOnAppForeground = true,
    syncOnNetworkReconnect = true,
  } = options;

  const offlineStatus = useOfflineStatus();
  const appState = useRef(AppState.currentState);
  
  const [dataState, setDataState] = useState<OfflineDataState>({
    data: null,
    summary: null,
    isLoading: true,
    isRefreshing: false,
    error: null,
    lastUpdated: null,
  });

  const [syncState, setSyncState] = useState<SyncState>({
    isSyncing: false,
    lastSyncResult: null,
    syncProgress: 0,
    syncError: null,
  });

  const [storageConfig, setStorageConfig] = useState<OfflineStorageConfig | null>(null);
  
  // Load initial data
  useEffect(() => {
    loadOfflineData();
  }, []);

  // Setup auto refresh
  useEffect(() => {
    if (!autoRefresh || refreshInterval <= 0) return;

    const interval = setInterval(() => {
      refreshData();
    }, refreshInterval * 60 * 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  // Handle app state changes
  useEffect(() => {
    if (!syncOnAppForeground) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground
        refreshData();
        
        if (offlineStatus.isOnline && !syncState.isSyncing) {
          syncAllData();
        }
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [syncOnAppForeground, offlineStatus.isOnline, syncState.isSyncing]);

  // Handle network reconnection
  useEffect(() => {
    if (!syncOnNetworkReconnect) return;

    const wasOffline = useRef(offlineStatus.isOffline);
    
    if (wasOffline.current && !offlineStatus.isOffline) {
      // Network reconnected
      setTimeout(() => {
        refreshData();
        syncAllData();
      }, 2000); // Wait a bit for connection to stabilize
    }
    
    wasOffline.current = offlineStatus.isOffline;
  }, [offlineStatus.isOffline, syncOnNetworkReconnect]);

  // Load offline data and summary
  const loadOfflineData = useCallback(async () => {
    try {
      setDataState(prev => ({ ...prev, isLoading: true, error: null }));

      const [data, summary, config] = await Promise.all([
        offlineService.getOfflineData(),
        offlineService.getOfflineDataSummary(),
        offlineService.getOfflineState().then(state => state.storageConfig),
      ]);

      setDataState(prev => ({
        ...prev,
        data,
        summary,
        isLoading: false,
        lastUpdated: new Date().toISOString(),
      }));

      setStorageConfig(config);
    } catch (error) {
      console.error('Error loading offline data:', error);
      setDataState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load offline data',
      }));
    }
  }, []);

  // Refresh data (lighter than full reload)
  const refreshData = useCallback(async () => {
    try {
      setDataState(prev => ({ ...prev, isRefreshing: true, error: null }));

      const summary = await offlineService.getOfflineDataSummary();
      
      setDataState(prev => ({
        ...prev,
        summary,
        isRefreshing: false,
        lastUpdated: new Date().toISOString(),
      }));
    } catch (error) {
      console.error('Error refreshing offline data:', error);
      setDataState(prev => ({
        ...prev,
        isRefreshing: false,
        error: error instanceof Error ? error.message : 'Failed to refresh data',
      }));
    }
  }, []);

  // Sync all core data
  const syncAllData = useCallback(async (options: {
    forceFull?: boolean;
    priority?: string[];
  } = {}) => {
    if (offlineStatus.isOffline) {
      setSyncState(prev => ({
        ...prev,
        syncError: 'Cannot sync while offline',
      }));
      return null;
    }

    if (syncState.isSyncing) {
      console.warn('Sync already in progress');
      return null;
    }

    try {
      setSyncState(prev => ({
        ...prev,
        isSyncing: true,
        syncProgress: 0,
        syncError: null,
      }));

      console.log('Starting comprehensive data sync...');
      
      const result = await coreDataSyncService.syncAllCoreData(options);
      
      setSyncState(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncResult: result,
        syncProgress: 100,
        syncError: result.success ? null : result.errors.join('; '),
      }));

      // Refresh data after successful sync
      if (result.success) {
        await refreshData();
      }

      console.log('Data sync completed:', result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sync failed';
      console.error('Error syncing data:', error);
      
      setSyncState(prev => ({
        ...prev,
        isSyncing: false,
        syncError: errorMessage,
        syncProgress: 0,
      }));
      
      return null;
    }
  }, [offlineStatus.isOffline, syncState.isSyncing]);

  // Download data for offline use
  const downloadOfflineData = useCallback(async (options: {
    vocabularyCount?: number;
    cardCount?: number;
    includeAudio?: boolean;
    audioQuality?: 'low' | 'medium' | 'high';
  } = {}) => {
    try {
      setDataState(prev => ({ ...prev, isRefreshing: true }));

      // Download vocabulary and card data
      const downloadResult = await offlineService.downloadForOfflineUse({
        vocabularyCount: options.vocabularyCount,
        cardCount: options.cardCount,
      });

      // Download audio files if requested
      if (options.includeAudio) {
        await offlineService.downloadAudioFiles({
          quality: options.audioQuality || 'medium',
          maxFiles: 50,
        });
      }

      await refreshData();
      
      console.log('Offline download completed:', downloadResult);
      return downloadResult;
    } catch (error) {
      console.error('Error downloading offline data:', error);
      throw error;
    } finally {
      setDataState(prev => ({ ...prev, isRefreshing: false }));
    }
  }, []);

  // Clean up old offline data
  const cleanupOfflineData = useCallback(async () => {
    try {
      const cleanupResult = await offlineService.cleanupOfflineData();
      await refreshData();
      
      console.log('Offline data cleanup completed:', cleanupResult);
      return cleanupResult;
    } catch (error) {
      console.error('Error cleaning up offline data:', error);
      throw error;
    }
  }, []);

  // Update storage configuration
  const updateStorageConfig = useCallback(async (config: Partial<OfflineStorageConfig>) => {
    try {
      await offlineService.updateStorageConfig(config);
      setStorageConfig(prev => prev ? { ...prev, ...config } : null);
      
      console.log('Storage config updated:', config);
    } catch (error) {
      console.error('Error updating storage config:', error);
      throw error;
    }
  }, []);

  // Get sync statistics
  const getSyncStats = useCallback(() => {
    return coreDataSyncService.getSyncStats();
  }, []);

  // Cancel ongoing sync (if supported)
  const cancelSync = useCallback(() => {
    if (syncState.isSyncing) {
      // Note: Actual cancellation would depend on implementation
      setSyncState(prev => ({
        ...prev,
        isSyncing: false,
        syncError: 'Sync cancelled by user',
        syncProgress: 0,
      }));
    }
  }, [syncState.isSyncing]);

  // Force reload all data
  const reloadAllData = useCallback(async () => {
    await loadOfflineData();
  }, [loadOfflineData]);

  return {
    // Data state
    data: dataState.data,
    summary: dataState.summary,
    isLoading: dataState.isLoading,
    isRefreshing: dataState.isRefreshing,
    error: dataState.error,
    lastUpdated: dataState.lastUpdated,
    
    // Sync state
    isSyncing: syncState.isSyncing,
    syncProgress: syncState.syncProgress,
    syncError: syncState.syncError,
    lastSyncResult: syncState.lastSyncResult,
    
    // Configuration
    storageConfig,
    
    // Actions
    refreshData,
    syncAllData,
    downloadOfflineData,
    cleanupOfflineData,
    updateStorageConfig,
    reloadAllData,
    cancelSync,
    getSyncStats,
    
    // Status
    canSync: offlineStatus.isOnline && !syncState.isSyncing,
    hasOfflineData: !!dataState.data && (
      dataState.data.vocabularies.length > 0 ||
      dataState.data.studySessions.length > 0
    ),
  };
};

export default useOfflineData;