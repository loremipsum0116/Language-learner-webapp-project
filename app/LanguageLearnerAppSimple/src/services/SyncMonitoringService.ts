// src/services/SyncMonitoringService.ts
// 동기화 모니터링 및 복구 시스템

import AsyncStorage from '@react-native-async-storage/async-storage';
import { database } from '../database/sqlite/Database';
import { syncOrchestrationService, SyncSession, SyncOperation } from './SyncOrchestrationService';
import { DataSyncResult } from '../types/OfflineDataTypes';

export interface SyncHealthMetrics {
  successRate: number; // 0-1
  averageResponseTime: number; // ms
  lastSuccessfulSync: string;
  failureCount: number;
  conflictRate: number;
  queueSize: number;
  dataIntegrityScore: number; // 0-1
}

export interface SyncAlert {
  id: string;
  type: 'error' | 'warning' | 'info';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  timestamp: string;
  resolved: boolean;
  resolvedAt?: string;
  metadata: {
    sessionId?: string;
    operationId?: string;
    tableName?: string;
    errorCode?: string;
    retryCount?: number;
  };
}

export interface RecoveryAction {
  id: string;
  type: 'retry' | 'reset' | 'manual_intervention' | 'data_repair';
  description: string;
  automated: boolean;
  priority: number;
  conditions: string[];
  action: () => Promise<boolean>;
}

export interface SyncDiagnostics {
  timestamp: string;
  healthMetrics: SyncHealthMetrics;
  activeAlerts: SyncAlert[];
  recommendedActions: RecoveryAction[];
  systemStatus: 'healthy' | 'degraded' | 'critical';
  dataIntegrityIssues: string[];
  performanceIssues: string[];
}

export class SyncMonitoringService {
  private static instance: SyncMonitoringService;
  private healthMetrics: SyncHealthMetrics = {
    successRate: 0,
    averageResponseTime: 0,
    lastSuccessfulSync: '',
    failureCount: 0,
    conflictRate: 0,
    queueSize: 0,
    dataIntegrityScore: 1,
  };
  private alerts: SyncAlert[] = [];
  private recoveryActions: RecoveryAction[] = [];
  private monitoringTimer: NodeJS.Timeout | null = null;
  private readonly MONITORING_INTERVAL = 60000; // 1 minute
  private readonly MAX_ALERTS = 100;
  private readonly MAX_RECOVERY_ATTEMPTS = 3;

  private constructor() {
    this.initializeRecoveryActions();
    this.loadStoredData();
  }

  public static getInstance(): SyncMonitoringService {
    if (!SyncMonitoringService.instance) {
      SyncMonitoringService.instance = new SyncMonitoringService();
    }
    return SyncMonitoringService.instance;
  }

  // Initialize monitoring
  public async initialize(): Promise<void> {
    try {
      await this.updateHealthMetrics();
      this.startMonitoring();
      console.log('SyncMonitoringService initialized');
    } catch (error) {
      console.error('Error initializing SyncMonitoringService:', error);
    }
  }

  // Start continuous monitoring
  private startMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }

    this.monitoringTimer = setInterval(async () => {
      try {
        await this.performHealthCheck();
        await this.checkForRecoveryTriggers();
      } catch (error) {
        console.error('Error during monitoring cycle:', error);
      }
    }, this.MONITORING_INTERVAL);
  }

  // Perform comprehensive health check
  private async performHealthCheck(): Promise<void> {
    try {
      // Update health metrics
      await this.updateHealthMetrics();
      
      // Check for issues
      await this.detectSyncIssues();
      
      // Evaluate system status
      const systemStatus = this.evaluateSystemStatus();
      
      // Create alerts for critical issues
      if (systemStatus === 'critical') {
        await this.createAlert({
          type: 'error',
          severity: 'critical',
          title: 'Critical Sync Issues Detected',
          message: 'Multiple sync failures detected. System requires immediate attention.',
          metadata: {
            errorCode: 'SYNC_CRITICAL_FAILURE',
          },
        });
      } else if (systemStatus === 'degraded') {
        await this.createAlert({
          type: 'warning',
          severity: 'medium',
          title: 'Sync Performance Degraded',
          message: 'Sync performance is below normal levels.',
          metadata: {
            errorCode: 'SYNC_PERFORMANCE_DEGRADED',
          },
        });
      }

      // Clean up resolved alerts
      await this.cleanupResolvedAlerts();
      
    } catch (error) {
      console.error('Error performing health check:', error);
    }
  }

  // Update health metrics
  private async updateHealthMetrics(): Promise<void> {
    try {
      // Get sync history from last 24 hours
      const syncHistory = await this.getSyncHistory(24);
      
      if (syncHistory.length === 0) {
        return;
      }

      // Calculate success rate
      const successful = syncHistory.filter(s => s.result?.success).length;
      this.healthMetrics.successRate = successful / syncHistory.length;

      // Calculate average response time
      const responseTimes = syncHistory
        .filter(s => s.completedAt && s.result?.totalTime)
        .map(s => s.result!.totalTime);
      
      this.healthMetrics.averageResponseTime = responseTimes.length > 0
        ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
        : 0;

      // Find last successful sync
      const lastSuccessful = syncHistory
        .filter(s => s.result?.success)
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];
      
      if (lastSuccessful) {
        this.healthMetrics.lastSuccessfulSync = lastSuccessful.startedAt;
      }

      // Count failures
      this.healthMetrics.failureCount = syncHistory.filter(s => !s.result?.success).length;

      // Calculate conflict rate
      const totalConflicts = syncHistory.reduce((sum, s) => {
        if (s.result) {
          return sum + Object.values(s.result.syncedItems)
            .reduce((conflicts, item) => conflicts + item.conflicts, 0);
        }
        return sum;
      }, 0);
      
      const totalOperations = syncHistory.reduce((sum, s) => {
        if (s.result) {
          return sum + Object.values(s.result.syncedItems)
            .reduce((ops, item) => ops + item.uploaded + item.downloaded, 0);
        }
        return sum;
      }, 0);

      this.healthMetrics.conflictRate = totalOperations > 0 ? totalConflicts / totalOperations : 0;

      // Get queue size
      this.healthMetrics.queueSize = await this.getSyncQueueSize();

      // Calculate data integrity score
      this.healthMetrics.dataIntegrityScore = await this.calculateDataIntegrityScore();

      // Save updated metrics
      await this.saveHealthMetrics();

    } catch (error) {
      console.error('Error updating health metrics:', error);
    }
  }

  // Detect sync issues
  private async detectSyncIssues(): Promise<void> {
    const issues = [];

    // Check for stale sync
    if (this.healthMetrics.lastSuccessfulSync) {
      const lastSync = new Date(this.healthMetrics.lastSuccessfulSync);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      if (lastSync < oneHourAgo) {
        issues.push('Sync has not succeeded in over 1 hour');
        await this.createAlert({
          type: 'warning',
          severity: 'medium',
          title: 'Stale Sync Detected',
          message: 'No successful sync in over 1 hour',
          metadata: { errorCode: 'SYNC_STALE' },
        });
      }
    }

    // Check for high failure rate
    if (this.healthMetrics.successRate < 0.5) {
      issues.push('Success rate below 50%');
      await this.createAlert({
        type: 'error',
        severity: 'high',
        title: 'High Failure Rate',
        message: `Sync success rate is ${(this.healthMetrics.successRate * 100).toFixed(1)}%`,
        metadata: { errorCode: 'SYNC_HIGH_FAILURE_RATE' },
      });
    }

    // Check for large queue size
    if (this.healthMetrics.queueSize > 500) {
      issues.push('Large sync queue detected');
      await this.createAlert({
        type: 'warning',
        severity: 'medium',
        title: 'Large Sync Queue',
        message: `${this.healthMetrics.queueSize} items in sync queue`,
        metadata: { errorCode: 'SYNC_LARGE_QUEUE' },
      });
    }

    // Check for high conflict rate
    if (this.healthMetrics.conflictRate > 0.1) {
      issues.push('High conflict rate detected');
      await this.createAlert({
        type: 'warning',
        severity: 'medium',
        title: 'High Conflict Rate',
        message: `${(this.healthMetrics.conflictRate * 100).toFixed(1)}% of operations result in conflicts`,
        metadata: { errorCode: 'SYNC_HIGH_CONFLICT_RATE' },
      });
    }

    // Check for data integrity issues
    if (this.healthMetrics.dataIntegrityScore < 0.9) {
      issues.push('Data integrity concerns detected');
      await this.createAlert({
        type: 'error',
        severity: 'high',
        title: 'Data Integrity Issues',
        message: `Data integrity score: ${(this.healthMetrics.dataIntegrityScore * 100).toFixed(1)}%`,
        metadata: { errorCode: 'DATA_INTEGRITY_LOW' },
      });
    }
  }

  // Evaluate overall system status
  private evaluateSystemStatus(): 'healthy' | 'degraded' | 'critical' {
    const criticalIssues = [
      this.healthMetrics.successRate < 0.3,
      this.healthMetrics.dataIntegrityScore < 0.8,
      this.healthMetrics.failureCount > 10,
    ].filter(Boolean).length;

    const degradedIssues = [
      this.healthMetrics.successRate < 0.7,
      this.healthMetrics.averageResponseTime > 30000,
      this.healthMetrics.conflictRate > 0.15,
      this.healthMetrics.queueSize > 200,
    ].filter(Boolean).length;

    if (criticalIssues > 0) {
      return 'critical';
    } else if (degradedIssues > 1) {
      return 'degraded';
    }

    return 'healthy';
  }

  // Check for recovery triggers and execute recovery actions
  private async checkForRecoveryTriggers(): Promise<void> {
    try {
      for (const action of this.recoveryActions) {
        if (this.shouldExecuteRecoveryAction(action)) {
          console.log(`Executing recovery action: ${action.description}`);
          
          try {
            const success = await action.action();
            
            if (success) {
              await this.createAlert({
                type: 'info',
                severity: 'low',
                title: 'Recovery Action Successful',
                message: `Successfully executed: ${action.description}`,
                metadata: { 
                  actionId: action.id,
                  actionType: action.type 
                },
              });
            } else {
              await this.createAlert({
                type: 'warning',
                severity: 'medium',
                title: 'Recovery Action Failed',
                message: `Failed to execute: ${action.description}`,
                metadata: { 
                  actionId: action.id,
                  actionType: action.type 
                },
              });
            }
          } catch (error) {
            console.error(`Recovery action ${action.id} failed:`, error);
            await this.createAlert({
              type: 'error',
              severity: 'high',
              title: 'Recovery Action Error',
              message: `Error executing: ${action.description}`,
              metadata: { 
                actionId: action.id,
                errorMessage: error instanceof Error ? error.message : String(error)
              },
            });
          }
        }
      }
    } catch (error) {
      console.error('Error checking recovery triggers:', error);
    }
  }

  // Check if recovery action should be executed
  private shouldExecuteRecoveryAction(action: RecoveryAction): boolean {
    if (!action.automated) {
      return false;
    }

    // Check conditions
    for (const condition of action.conditions) {
      if (!this.evaluateCondition(condition)) {
        return false;
      }
    }

    return true;
  }

  // Evaluate recovery condition
  private evaluateCondition(condition: string): boolean {
    switch (condition) {
      case 'high_failure_rate':
        return this.healthMetrics.successRate < 0.5;
      case 'large_queue':
        return this.healthMetrics.queueSize > 500;
      case 'stale_sync':
        if (!this.healthMetrics.lastSuccessfulSync) return true;
        const lastSync = new Date(this.healthMetrics.lastSuccessfulSync);
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        return lastSync < twoHoursAgo;
      case 'data_integrity_low':
        return this.healthMetrics.dataIntegrityScore < 0.9;
      default:
        return false;
    }
  }

  // Initialize default recovery actions
  private initializeRecoveryActions(): void {
    this.recoveryActions = [
      {
        id: 'retry_failed_sync',
        type: 'retry',
        description: 'Retry failed synchronization',
        automated: true,
        priority: 1,
        conditions: ['high_failure_rate'],
        action: async () => {
          try {
            const result = await syncOrchestrationService.performSync({ forced: true });
            return result.success;
          } catch (error) {
            console.error('Retry sync failed:', error);
            return false;
          }
        },
      },
      {
        id: 'clear_sync_queue',
        type: 'reset',
        description: 'Clear and rebuild sync queue',
        automated: true,
        priority: 2,
        conditions: ['large_queue'],
        action: async () => {
          try {
            await this.clearSyncQueue();
            await this.rebuildSyncQueue();
            return true;
          } catch (error) {
            console.error('Clear sync queue failed:', error);
            return false;
          }
        },
      },
      {
        id: 'force_full_sync',
        type: 'retry',
        description: 'Force full data synchronization',
        automated: false,
        priority: 3,
        conditions: ['stale_sync', 'data_integrity_low'],
        action: async () => {
          try {
            const result = await syncOrchestrationService.performSync({ 
              forced: true,
              priority: ['user_progress', 'vocabularies', 'study_sessions']
            });
            return result.success;
          } catch (error) {
            console.error('Force full sync failed:', error);
            return false;
          }
        },
      },
    ];
  }

  // Create alert
  private async createAlert(alertData: {
    type: 'error' | 'warning' | 'info';
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    message: string;
    metadata: any;
  }): Promise<void> {
    // Check if similar alert already exists
    const existingAlert = this.alerts.find(a => 
      !a.resolved && 
      a.title === alertData.title && 
      a.metadata.errorCode === alertData.metadata.errorCode
    );

    if (existingAlert) {
      return; // Don't create duplicate alerts
    }

    const alert: SyncAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...alertData,
      timestamp: new Date().toISOString(),
      resolved: false,
    };

    this.alerts.push(alert);

    // Keep only recent alerts
    if (this.alerts.length > this.MAX_ALERTS) {
      this.alerts = this.alerts.slice(-this.MAX_ALERTS);
    }

    await this.saveAlerts();
    console.log(`Alert created: ${alert.severity} - ${alert.title}`);
  }

  // Get comprehensive diagnostics
  public async getDiagnostics(): Promise<SyncDiagnostics> {
    await this.updateHealthMetrics();
    
    const systemStatus = this.evaluateSystemStatus();
    const activeAlerts = this.alerts.filter(a => !a.resolved);
    const recommendedActions = this.getRecommendedActions();
    const dataIntegrityIssues = await this.checkDataIntegrity();
    const performanceIssues = this.checkPerformanceIssues();

    return {
      timestamp: new Date().toISOString(),
      healthMetrics: { ...this.healthMetrics },
      activeAlerts: [...activeAlerts],
      recommendedActions,
      systemStatus,
      dataIntegrityIssues,
      performanceIssues,
    };
  }

  // Get recommended recovery actions
  private getRecommendedActions(): RecoveryAction[] {
    return this.recoveryActions.filter(action => {
      return action.conditions.some(condition => this.evaluateCondition(condition));
    }).sort((a, b) => a.priority - b.priority);
  }

  // Check data integrity
  private async checkDataIntegrity(): Promise<string[]> {
    const issues: string[] = [];

    try {
      // Check for orphaned records
      const orphanedCards = await database.executeSql(`
        SELECT COUNT(*) as count FROM cards c 
        LEFT JOIN vocabularies v ON c.vocab_id = v.id 
        WHERE v.id IS NULL AND c.is_deleted = 0
      `);
      
      if (orphanedCards[0].rows.item(0).count > 0) {
        issues.push(`${orphanedCards[0].rows.item(0).count} orphaned cards found`);
      }

      // Check for missing required fields
      const incompleteVocabs = await database.executeSql(`
        SELECT COUNT(*) as count FROM vocabularies 
        WHERE (lemma IS NULL OR lemma = '' OR definition IS NULL OR definition = '') 
        AND is_deleted = 0
      `);
      
      if (incompleteVocabs[0].rows.item(0).count > 0) {
        issues.push(`${incompleteVocabs[0].rows.item(0).count} incomplete vocabulary records found`);
      }

    } catch (error) {
      console.error('Error checking data integrity:', error);
      issues.push('Unable to perform data integrity check');
    }

    return issues;
  }

  // Check performance issues
  private checkPerformanceIssues(): string[] {
    const issues: string[] = [];

    if (this.healthMetrics.averageResponseTime > 30000) {
      issues.push('Slow sync response times detected');
    }

    if (this.healthMetrics.queueSize > 100) {
      issues.push('Large sync queue may cause delays');
    }

    if (this.healthMetrics.conflictRate > 0.1) {
      issues.push('High conflict rate may impact performance');
    }

    return issues;
  }

  // Utility methods
  private async getSyncHistory(hours: number): Promise<SyncSession[]> {
    try {
      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
      // Implementation would retrieve sync sessions from storage
      return [];
    } catch (error) {
      console.error('Error getting sync history:', error);
      return [];
    }
  }

  private async getSyncQueueSize(): Promise<number> {
    try {
      const result = await database.executeSql('SELECT COUNT(*) as count FROM sync_queue');
      return result[0].rows.item(0).count;
    } catch (error) {
      console.error('Error getting sync queue size:', error);
      return 0;
    }
  }

  private async calculateDataIntegrityScore(): Promise<number> {
    try {
      // Simple integrity score calculation
      const issues = await this.checkDataIntegrity();
      const maxScore = 1.0;
      const penaltyPerIssue = 0.1;
      
      return Math.max(0, maxScore - (issues.length * penaltyPerIssue));
    } catch (error) {
      console.error('Error calculating data integrity score:', error);
      return 0;
    }
  }

  private async clearSyncQueue(): Promise<void> {
    try {
      await database.executeSql('DELETE FROM sync_queue');
    } catch (error) {
      console.error('Error clearing sync queue:', error);
    }
  }

  private async rebuildSyncQueue(): Promise<void> {
    // Implementation would rebuild sync queue based on unsent changes
  }

  private async cleanupResolvedAlerts(): Promise<void> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.alerts = this.alerts.filter(alert => {
      if (alert.resolved && alert.resolvedAt) {
        return new Date(alert.resolvedAt) > oneDayAgo;
      }
      return true;
    });
    await this.saveAlerts();
  }

  // Storage methods
  private async loadStoredData(): Promise<void> {
    try {
      const [metricsStr, alertsStr] = await Promise.all([
        AsyncStorage.getItem('@sync_health_metrics'),
        AsyncStorage.getItem('@sync_alerts'),
      ]);

      if (metricsStr) {
        this.healthMetrics = { ...this.healthMetrics, ...JSON.parse(metricsStr) };
      }

      if (alertsStr) {
        this.alerts = JSON.parse(alertsStr);
      }
    } catch (error) {
      console.error('Error loading stored data:', error);
    }
  }

  private async saveHealthMetrics(): Promise<void> {
    try {
      await AsyncStorage.setItem('@sync_health_metrics', JSON.stringify(this.healthMetrics));
    } catch (error) {
      console.error('Error saving health metrics:', error);
    }
  }

  private async saveAlerts(): Promise<void> {
    try {
      await AsyncStorage.setItem('@sync_alerts', JSON.stringify(this.alerts));
    } catch (error) {
      console.error('Error saving alerts:', error);
    }
  }

  // Public interface
  public getHealthMetrics(): SyncHealthMetrics {
    return { ...this.healthMetrics };
  }

  public getActiveAlerts(): SyncAlert[] {
    return this.alerts.filter(a => !a.resolved);
  }

  public async resolveAlert(alertId: string): Promise<boolean> {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = new Date().toISOString();
      await this.saveAlerts();
      return true;
    }
    return false;
  }

  public async executeManualRecovery(actionId: string): Promise<boolean> {
    const action = this.recoveryActions.find(a => a.id === actionId);
    if (action) {
      try {
        return await action.action();
      } catch (error) {
        console.error(`Manual recovery action ${actionId} failed:`, error);
        return false;
      }
    }
    return false;
  }

  // Cleanup
  public destroy(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }
  }
}

// Export singleton instance
export const syncMonitoringService = SyncMonitoringService.getInstance();
export default SyncMonitoringService;