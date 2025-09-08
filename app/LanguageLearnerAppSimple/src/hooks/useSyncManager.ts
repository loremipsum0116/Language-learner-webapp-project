// src/hooks/useSyncManager.ts
// 통합 동기화 관리 훅

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useOfflineStatus } from './useOfflineStatus';
import { syncOrchestrationService, SyncMode, SyncSession } from '../services/SyncOrchestrationService';
import { syncMonitoringService, SyncHealthMetrics, SyncAlert, SyncDiagnostics } from '../services/SyncMonitoringService';
import { conflictResolutionService } from '../services/ConflictResolutionService';
import { DataSyncResult } from '../types/OfflineDataTypes';

export interface SyncManagerState {
  // Current sync state
  isOnline: boolean;
  currentMode: SyncMode;
  isSyncing: boolean;
  currentSession: SyncSession | null;
  lastSyncResult: DataSyncResult | null;
  
  // Health monitoring
  healthMetrics: SyncHealthMetrics;
  activeAlerts: SyncAlert[];
  systemStatus: 'healthy' | 'degraded' | 'critical';
  
  // Progress tracking
  syncProgress: number;
  currentOperation: string;
  eta: number; // estimated seconds remaining
}

export interface SyncManagerActions {
  // Manual sync operations
  performFullSync: () => Promise<DataSyncResult | null>;
  performQuickSync: () => Promise<DataSyncResult | null>;
  cancelCurrentSync: () => Promise<boolean>;
  
  // Recovery operations
  executeRecoveryAction: (actionId: string) => Promise<boolean>;
  resolveAlert: (alertId: string) => Promise<boolean>;
  
  // Configuration
  updateSyncSettings: (settings: {
    autoSyncEnabled?: boolean;
    syncInterval?: number;
    conflictStrategy?: 'automatic' | 'manual';
  }) => Promise<void>;
  
  // Diagnostics
  refreshDiagnostics: () => Promise<void>;
  exportSyncLogs: () => Promise<string>;
  resetSyncState: () => Promise<boolean>;
}

export const useSyncManager = (options: {
  autoInitialize?: boolean;
  monitoringEnabled?: boolean;
  alertsEnabled?: boolean;
} = {}): [SyncManagerState, SyncManagerActions] => {
  const {
    autoInitialize = true,
    monitoringEnabled = true,
    alertsEnabled = true,
  } = options;

  const offlineStatus = useOfflineStatus();
  const appState = useRef(AppState.currentState);
  const initialized = useRef(false);

  const [state, setState] = useState<SyncManagerState>({
    isOnline: false,
    currentMode: { mode: 'offline', reason: 'network_unavailable', capabilities: [] },
    isSyncing: false,
    currentSession: null,
    lastSyncResult: null,
    healthMetrics: {
      successRate: 0,
      averageResponseTime: 0,
      lastSuccessfulSync: '',
      failureCount: 0,
      conflictRate: 0,
      queueSize: 0,
      dataIntegrityScore: 1,
    },
    activeAlerts: [],
    systemStatus: 'healthy',
    syncProgress: 0,
    currentOperation: '',
    eta: 0,
  });

  // Initialize services
  useEffect(() => {
    if (autoInitialize && !initialized.current) {
      initializeServices();
      initialized.current = true;
    }
  }, [autoInitialize]);

  // Monitor network status
  useEffect(() => {
    setState(prev => ({
      ...prev,
      isOnline: offlineStatus.isOnline,
      currentMode: syncOrchestrationService.getCurrentMode(),
    }));
  }, [offlineStatus.isOnline]);

  // Monitor app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground - refresh state
        refreshAllState();
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []);

  // Monitor sync sessions
  useEffect(() => {
    const monitorSyncSessions = () => {
      const currentSession = syncOrchestrationService.getCurrentSession();
      const isSyncing = syncOrchestrationService.isCurrentlySyncing();
      
      setState(prev => ({
        ...prev,
        currentSession,
        isSyncing,
        currentMode: syncOrchestrationService.getCurrentMode(),
      }));
    };

    const interval = setInterval(monitorSyncSessions, 1000);
    return () => clearInterval(interval);
  }, []);

  // Monitor health metrics and alerts
  useEffect(() => {
    if (!monitoringEnabled) return;

    const updateHealthData = async () => {
      try {
        const healthMetrics = syncMonitoringService.getHealthMetrics();
        const activeAlerts = alertsEnabled ? syncMonitoringService.getActiveAlerts() : [];
        const diagnostics = await syncMonitoringService.getDiagnostics();
        
        setState(prev => ({
          ...prev,
          healthMetrics,
          activeAlerts,
          systemStatus: diagnostics.systemStatus,
        }));
      } catch (error) {
        console.error('Error updating health data:', error);
      }
    };

    updateHealthData();
    const interval = setInterval(updateHealthData, 30000); // Update every 30 seconds
    
    return () => clearInterval(interval);
  }, [monitoringEnabled, alertsEnabled]);

  // Initialize services
  const initializeServices = useCallback(async () => {
    try {
      await syncOrchestrationService.initialize();
      
      if (monitoringEnabled) {
        await syncMonitoringService.initialize();
      }
      
      // Initial state update
      await refreshAllState();
      
      console.log('Sync manager services initialized');
    } catch (error) {
      console.error('Error initializing sync services:', error);
    }
  }, [monitoringEnabled]);

  // Refresh all state
  const refreshAllState = useCallback(async () => {
    try {
      const [healthMetrics, activeAlerts, diagnostics, currentSession] = await Promise.all([
        monitoringEnabled ? syncMonitoringService.getHealthMetrics() : Promise.resolve(state.healthMetrics),
        alertsEnabled ? syncMonitoringService.getActiveAlerts() : Promise.resolve([]),
        monitoringEnabled ? syncMonitoringService.getDiagnostics() : Promise.resolve({ systemStatus: 'healthy' } as SyncDiagnostics),
        Promise.resolve(syncOrchestrationService.getCurrentSession()),
      ]);

      setState(prev => ({
        ...prev,
        isOnline: offlineStatus.isOnline,
        currentMode: syncOrchestrationService.getCurrentMode(),
        isSyncing: syncOrchestrationService.isCurrentlySyncing(),
        currentSession,
        healthMetrics,
        activeAlerts,
        systemStatus: diagnostics.systemStatus,
      }));
    } catch (error) {
      console.error('Error refreshing state:', error);
    }
  }, [monitoringEnabled, alertsEnabled, offlineStatus.isOnline, state.healthMetrics]);

  // Actions implementation
  const performFullSync = useCallback(async (): Promise<DataSyncResult | null> => {
    try {
      console.log('Performing full sync...');
      
      const result = await syncOrchestrationService.performSync({
        forced: true,
        priority: ['user_progress', 'study_sessions', 'vocabularies', 'audio_files'],
        conflictStrategy: 'automatic',
      });

      setState(prev => ({ ...prev, lastSyncResult: result }));
      
      // Refresh state after sync
      setTimeout(refreshAllState, 1000);
      
      return result;
    } catch (error) {
      console.error('Full sync failed:', error);
      return null;
    }
  }, [refreshAllState]);

  const performQuickSync = useCallback(async (): Promise<DataSyncResult | null> => {
    try {
      console.log('Performing quick sync...');
      
      const result = await syncOrchestrationService.performSync({
        forced: false,
        priority: ['user_progress'],
        maxDuration: 30000, // 30 seconds max
        conflictStrategy: 'automatic',
      });

      setState(prev => ({ ...prev, lastSyncResult: result }));
      
      // Refresh state after sync
      setTimeout(refreshAllState, 1000);
      
      return result;
    } catch (error) {
      console.error('Quick sync failed:', error);
      return null;
    }
  }, [refreshAllState]);

  const cancelCurrentSync = useCallback(async (): Promise<boolean> => {
    try {
      // Note: Actual cancellation implementation would depend on sync service capabilities
      console.log('Cancelling current sync...');
      
      // For now, we just update state - actual implementation would need
      // to be added to syncOrchestrationService
      setState(prev => ({
        ...prev,
        isSyncing: false,
        currentSession: null,
        currentOperation: '',
        syncProgress: 0,
      }));
      
      return true;
    } catch (error) {
      console.error('Error cancelling sync:', error);
      return false;
    }
  }, []);

  const executeRecoveryAction = useCallback(async (actionId: string): Promise<boolean> => {
    try {
      const success = await syncMonitoringService.executeManualRecovery(actionId);
      
      if (success) {
        // Refresh state after recovery
        setTimeout(refreshAllState, 2000);
      }
      
      return success;
    } catch (error) {
      console.error('Error executing recovery action:', error);
      return false;
    }
  }, [refreshAllState]);

  const resolveAlert = useCallback(async (alertId: string): Promise<boolean> => {
    try {
      const success = await syncMonitoringService.resolveAlert(alertId);
      
      if (success) {
        // Update alerts in state
        setState(prev => ({
          ...prev,
          activeAlerts: prev.activeAlerts.filter(alert => alert.id !== alertId),
        }));
      }
      
      return success;
    } catch (error) {
      console.error('Error resolving alert:', error);
      return false;
    }
  }, []);

  const updateSyncSettings = useCallback(async (settings: {
    autoSyncEnabled?: boolean;
    syncInterval?: number;
    conflictStrategy?: 'automatic' | 'manual';
  }): Promise<void> => {
    try {
      // Update orchestration service config
      if (settings.syncInterval) {
        syncOrchestrationService.updateConfig({
          autoSyncInterval: settings.syncInterval * 60 * 1000, // convert minutes to ms
        });
      }

      // Update conflict resolution strategy
      if (settings.conflictStrategy) {
        const strategy = settings.conflictStrategy === 'automatic' ? 'merge' : 'manual';
        conflictResolutionService.updateResolutionStrategy({
          vocabularies: strategy,
          studySessions: strategy,
          userProgress: strategy,
          audioFiles: strategy,
        });
      }

      console.log('Sync settings updated:', settings);
    } catch (error) {
      console.error('Error updating sync settings:', error);
    }
  }, []);

  const refreshDiagnostics = useCallback(async (): Promise<void> => {
    if (!monitoringEnabled) return;

    try {
      const diagnostics = await syncMonitoringService.getDiagnostics();
      
      setState(prev => ({
        ...prev,
        healthMetrics: diagnostics.healthMetrics,
        activeAlerts: diagnostics.activeAlerts,
        systemStatus: diagnostics.systemStatus,
      }));
    } catch (error) {
      console.error('Error refreshing diagnostics:', error);
    }
  }, [monitoringEnabled]);

  const exportSyncLogs = useCallback(async (): Promise<string> => {
    try {
      // Implementation would export sync logs in a readable format
      const diagnostics = monitoringEnabled ? await syncMonitoringService.getDiagnostics() : null;
      const resolutionStats = await conflictResolutionService.getResolutionStats();
      
      const logData = {
        timestamp: new Date().toISOString(),
        syncMode: state.currentMode,
        healthMetrics: state.healthMetrics,
        activeAlerts: state.activeAlerts,
        systemStatus: state.systemStatus,
        resolutionStats,
        diagnostics,
      };
      
      return JSON.stringify(logData, null, 2);
    } catch (error) {
      console.error('Error exporting sync logs:', error);
      return JSON.stringify({ error: 'Failed to export logs' }, null, 2);
    }
  }, [monitoringEnabled, state]);

  const resetSyncState = useCallback(async (): Promise<boolean> => {
    try {
      console.log('Resetting sync state...');
      
      // Reset state
      setState(prev => ({
        ...prev,
        isSyncing: false,
        currentSession: null,
        lastSyncResult: null,
        syncProgress: 0,
        currentOperation: '',
        eta: 0,
      }));
      
      // Reinitialize services
      await initializeServices();
      
      return true;
    } catch (error) {
      console.error('Error resetting sync state:', error);
      return false;
    }
  }, [initializeServices]);

  const actions: SyncManagerActions = {
    performFullSync,
    performQuickSync,
    cancelCurrentSync,
    executeRecoveryAction,
    resolveAlert,
    updateSyncSettings,
    refreshDiagnostics,
    exportSyncLogs,
    resetSyncState,
  };

  return [state, actions];
};

export default useSyncManager;