// src/services/OfflineDataExportService.ts
// 오프라인 데이터 내보내기 및 동기화 준비 서비스

import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { database } from '../database/sqlite/Database';
import { studySessionModel } from '../database/models/StudySessionModel';
import { userProgressModel } from '../database/models/UserProgressModel';
import { vocabularyModel } from '../database/models/VocabularyModel';
import { cardModel } from '../database/models/CardModel';
import { audioFileModel } from '../database/models/AudioFileModel';
import { offlineStatsService } from './OfflineStatsService';

export interface ExportOptions {
  includeStats: boolean;
  includeStudySessions: boolean;
  includeProgress: boolean;
  includeVocabulary: boolean;
  includeCards: boolean;
  includeAudioMetadata: boolean;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  format: 'json' | 'csv' | 'sqlite';
  compression: boolean;
}

export interface ExportResult {
  success: boolean;
  filePath?: string;
  fileSize: number;
  recordCounts: {
    stats: number;
    studySessions: number;
    progress: number;
    vocabulary: number;
    cards: number;
    audioFiles: number;
  };
  exportTime: number;
  errors: string[];
}

export interface SyncPreparation {
  pendingUploads: {
    studySessions: any[];
    userProgress: any[];
    vocabulary: any[];
    cards: any[];
    audioMetadata: any[];
  };
  conflicts: {
    count: number;
    items: any[];
  };
  dataIntegrity: {
    isValid: boolean;
    issues: string[];
  };
  estimatedSyncTime: number;
  estimatedDataSize: number;
}

export class OfflineDataExportService {
  private static instance: OfflineDataExportService;
  private exportDir: string;

  private constructor() {
    this.exportDir = `${RNFS.DocumentDirectoryPath}/exports`;
    this.initializeExportDirectory();
  }

  public static getInstance(): OfflineDataExportService {
    if (!OfflineDataExportService.instance) {
      OfflineDataExportService.instance = new OfflineDataExportService();
    }
    return OfflineDataExportService.instance;
  }

  // Initialize export directory
  private async initializeExportDirectory(): Promise<void> {
    try {
      const exists = await RNFS.exists(this.exportDir);
      if (!exists) {
        await RNFS.mkdir(this.exportDir);
      }
    } catch (error) {
      console.error('Error initializing export directory:', error);
    }
  }

  // Export offline data
  public async exportData(options: ExportOptions): Promise<ExportResult> {
    const startTime = Date.now();
    
    const result: ExportResult = {
      success: false,
      fileSize: 0,
      recordCounts: {
        stats: 0,
        studySessions: 0,
        progress: 0,
        vocabulary: 0,
        cards: 0,
        audioFiles: 0,
      },
      exportTime: 0,
      errors: [],
    };

    try {
      console.log('Starting offline data export...');
      
      // Collect data based on options
      const exportData: any = {};

      if (options.includeStats) {
        const statsData = await this.collectStatsData(options.dateRange);
        exportData.stats = statsData;
        result.recordCounts.stats = statsData.snapshots?.length || 0;
      }

      if (options.includeStudySessions) {
        const sessionsData = await this.collectStudySessionsData(options.dateRange);
        exportData.studySessions = sessionsData;
        result.recordCounts.studySessions = sessionsData.length;
      }

      if (options.includeProgress) {
        const progressData = await this.collectUserProgressData(options.dateRange);
        exportData.userProgress = progressData;
        result.recordCounts.progress = progressData.length;
      }

      if (options.includeVocabulary) {
        const vocabularyData = await this.collectVocabularyData();
        exportData.vocabulary = vocabularyData;
        result.recordCounts.vocabulary = vocabularyData.length;
      }

      if (options.includeCards) {
        const cardsData = await this.collectCardsData();
        exportData.cards = cardsData;
        result.recordCounts.cards = cardsData.length;
      }

      if (options.includeAudioMetadata) {
        const audioData = await this.collectAudioMetadata();
        exportData.audioFiles = audioData;
        result.recordCounts.audioFiles = audioData.length;
      }

      // Add export metadata
      exportData.exportMetadata = {
        exportedAt: new Date().toISOString(),
        appVersion: '1.0.0', // Would be dynamic
        dataVersion: '1.0',
        options,
        deviceInfo: {
          platform: 'react-native',
          // Would include more device info
        },
      };

      // Save to file
      const fileName = this.generateFileName(options.format);
      const filePath = `${this.exportDir}/${fileName}`;

      await this.saveExportData(exportData, filePath, options);

      // Get file size
      const fileStat = await RNFS.stat(filePath);
      result.fileSize = fileStat.size;
      result.filePath = filePath;

      result.success = true;
      result.exportTime = Date.now() - startTime;

      console.log(`Data export completed: ${result.fileSize} bytes in ${result.exportTime}ms`);
      
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Data export failed:', error);
      result.errors.push(errorMessage);
      result.exportTime = Date.now() - startTime;
      return result;
    }
  }

  // Prepare data for sync
  public async prepareSyncData(): Promise<SyncPreparation> {
    try {
      console.log('Preparing data for synchronization...');

      const preparation: SyncPreparation = {
        pendingUploads: {
          studySessions: [],
          userProgress: [],
          vocabulary: [],
          cards: [],
          audioMetadata: [],
        },
        conflicts: {
          count: 0,
          items: [],
        },
        dataIntegrity: {
          isValid: true,
          issues: [],
        },
        estimatedSyncTime: 0,
        estimatedDataSize: 0,
      };

      // Collect pending uploads
      preparation.pendingUploads.studySessions = await this.getPendingStudySessions();
      preparation.pendingUploads.userProgress = await this.getPendingUserProgress();
      preparation.pendingUploads.vocabulary = await this.getPendingVocabulary();
      preparation.pendingUploads.cards = await this.getPendingCards();
      preparation.pendingUploads.audioMetadata = await this.getPendingAudioMetadata();

      // Check data integrity
      preparation.dataIntegrity = await this.checkDataIntegrity();

      // Detect potential conflicts
      preparation.conflicts = await this.detectPotentialConflicts();

      // Estimate sync requirements
      preparation.estimatedDataSize = this.calculateDataSize(preparation.pendingUploads);
      preparation.estimatedSyncTime = this.estimateSyncTime(preparation);

      console.log('Sync preparation completed:', {
        pendingItems: Object.values(preparation.pendingUploads)
          .reduce((sum, items) => sum + items.length, 0),
        conflicts: preparation.conflicts.count,
        dataSize: preparation.estimatedDataSize,
      });

      return preparation;

    } catch (error) {
      console.error('Error preparing sync data:', error);
      throw error;
    }
  }

  // Import previously exported data
  public async importData(filePath: string): Promise<{
    success: boolean;
    importedCounts: { [key: string]: number };
    errors: string[];
  }> {
    try {
      console.log('Importing data from:', filePath);

      const result = {
        success: false,
        importedCounts: {} as { [key: string]: number },
        errors: [] as string[],
      };

      // Check if file exists
      const exists = await RNFS.exists(filePath);
      if (!exists) {
        throw new Error('Export file not found');
      }

      // Read and parse data
      const fileContent = await RNFS.readFile(filePath, 'utf8');
      const importData = JSON.parse(fileContent);

      // Validate data structure
      if (!importData.exportMetadata) {
        throw new Error('Invalid export file format');
      }

      // Import each data type
      if (importData.studySessions) {
        const imported = await this.importStudySessions(importData.studySessions);
        result.importedCounts.studySessions = imported;
      }

      if (importData.userProgress) {
        const imported = await this.importUserProgress(importData.userProgress);
        result.importedCounts.userProgress = imported;
      }

      if (importData.vocabulary) {
        const imported = await this.importVocabulary(importData.vocabulary);
        result.importedCounts.vocabulary = imported;
      }

      if (importData.cards) {
        const imported = await this.importCards(importData.cards);
        result.importedCounts.cards = imported;
      }

      result.success = true;
      console.log('Data import completed:', result.importedCounts);

      return result;

    } catch (error) {
      console.error('Error importing data:', error);
      return {
        success: false,
        importedCounts: {},
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  // Get available export files
  public async getExportFiles(): Promise<Array<{
    fileName: string;
    filePath: string;
    size: number;
    createdAt: string;
    metadata?: any;
  }>> {
    try {
      const files = await RNFS.readDir(this.exportDir);
      const exportFiles = [];

      for (const file of files) {
        if (file.name.endsWith('.json') || file.name.endsWith('.csv')) {
          try {
            // Try to read metadata from JSON files
            let metadata;
            if (file.name.endsWith('.json')) {
              const content = await RNFS.readFile(file.path, 'utf8');
              const data = JSON.parse(content);
              metadata = data.exportMetadata;
            }

            exportFiles.push({
              fileName: file.name,
              filePath: file.path,
              size: file.size,
              createdAt: file.mtime?.toISOString() || new Date().toISOString(),
              metadata,
            });
          } catch (error) {
            console.warn(`Error reading export file ${file.name}:`, error);
          }
        }
      }

      return exportFiles.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    } catch (error) {
      console.error('Error getting export files:', error);
      return [];
    }
  }

  // Delete export file
  public async deleteExportFile(filePath: string): Promise<boolean> {
    try {
      const exists = await RNFS.exists(filePath);
      if (exists) {
        await RNFS.unlink(filePath);
        console.log('Export file deleted:', filePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting export file:', error);
      return false;
    }
  }

  // Private helper methods
  private async collectStatsData(dateRange?: { startDate: string; endDate: string }): Promise<any> {
    try {
      return await offlineStatsService.exportStatsForSync();
    } catch (error) {
      console.error('Error collecting stats data:', error);
      return { snapshots: [], patterns: [], achievements: [] };
    }
  }

  private async collectStudySessionsData(dateRange?: { startDate: string; endDate: string }): Promise<any[]> {
    try {
      const options: any = { limit: 1000 };
      if (dateRange) {
        options.startDate = dateRange.startDate;
        options.endDate = dateRange.endDate;
      }
      
      return await studySessionModel.getCompletedSessions(options);
    } catch (error) {
      console.error('Error collecting study sessions data:', error);
      return [];
    }
  }

  private async collectUserProgressData(dateRange?: { startDate: string; endDate: string }): Promise<any[]> {
    try {
      if (dateRange) {
        return await userProgressModel.getProgressRange(
          dateRange.startDate,
          dateRange.endDate
        );
      } else {
        // Get last 30 days by default
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        
        return await userProgressModel.getProgressRange(
          startDate.toISOString().split('T')[0],
          endDate
        );
      }
    } catch (error) {
      console.error('Error collecting user progress data:', error);
      return [];
    }
  }

  private async collectVocabularyData(): Promise<any[]> {
    try {
      return await vocabularyModel.search({ limit: 10000 });
    } catch (error) {
      console.error('Error collecting vocabulary data:', error);
      return [];
    }
  }

  private async collectCardsData(): Promise<any[]> {
    try {
      // Get all cards - would implement pagination for large datasets
      const [result] = await database.executeSql('SELECT * FROM cards WHERE is_deleted = 0 LIMIT 10000');
      const cards = [];
      
      for (let i = 0; i < result.rows.length; i++) {
        cards.push(result.rows.item(i));
      }
      
      return cards;
    } catch (error) {
      console.error('Error collecting cards data:', error);
      return [];
    }
  }

  private async collectAudioMetadata(): Promise<any[]> {
    try {
      return await audioFileModel.getDownloadedAudioFiles();
    } catch (error) {
      console.error('Error collecting audio metadata:', error);
      return [];
    }
  }

  private generateFileName(format: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    return `offline_data_export_${timestamp}.${format}`;
  }

  private async saveExportData(data: any, filePath: string, options: ExportOptions): Promise<void> {
    switch (options.format) {
      case 'json':
        await RNFS.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
        break;
      case 'csv':
        const csv = this.convertToCSV(data);
        await RNFS.writeFile(filePath, csv, 'utf8');
        break;
      case 'sqlite':
        // Would implement SQLite export
        throw new Error('SQLite export not yet implemented');
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }

    if (options.compression) {
      // Would implement compression
      console.log('Compression requested but not yet implemented');
    }
  }

  private convertToCSV(data: any): string {
    // Simple CSV conversion - would be more sophisticated in practice
    let csv = '';
    
    for (const [tableName, records] of Object.entries(data)) {
      if (Array.isArray(records) && records.length > 0) {
        csv += `\n# ${tableName}\n`;
        const headers = Object.keys(records[0]);
        csv += headers.join(',') + '\n';
        
        for (const record of records) {
          const values = headers.map(header => {
            const value = record[header];
            return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
          });
          csv += values.join(',') + '\n';
        }
      }
    }
    
    return csv;
  }

  private async getPendingStudySessions(): Promise<any[]> {
    try {
      // Get sessions that haven't been synced
      const [result] = await database.executeSql(`
        SELECT * FROM study_sessions 
        WHERE is_deleted = 0 AND (synced_at IS NULL OR updated_at > synced_at)
        ORDER BY created_at DESC
      `);
      
      const sessions = [];
      for (let i = 0; i < result.rows.length; i++) {
        sessions.push(result.rows.item(i));
      }
      
      return sessions;
    } catch (error) {
      console.error('Error getting pending study sessions:', error);
      return [];
    }
  }

  private async getPendingUserProgress(): Promise<any[]> {
    try {
      // Get progress records that haven't been synced
      const [result] = await database.executeSql(`
        SELECT * FROM user_progress 
        WHERE is_deleted = 0 AND (synced_at IS NULL OR updated_at > synced_at)
        ORDER BY date DESC
      `);
      
      const progress = [];
      for (let i = 0; i < result.rows.length; i++) {
        progress.push(result.rows.item(i));
      }
      
      return progress;
    } catch (error) {
      console.error('Error getting pending user progress:', error);
      return [];
    }
  }

  private async getPendingVocabulary(): Promise<any[]> {
    // Most vocabulary would come from server, but user might add custom entries
    return [];
  }

  private async getPendingCards(): Promise<any[]> {
    try {
      // Get cards with local modifications
      const [result] = await database.executeSql(`
        SELECT * FROM cards 
        WHERE is_deleted = 0 AND (synced_at IS NULL OR updated_at > synced_at)
        ORDER BY updated_at DESC
      `);
      
      const cards = [];
      for (let i = 0; i < result.rows.length; i++) {
        cards.push(result.rows.item(i));
      }
      
      return cards;
    } catch (error) {
      console.error('Error getting pending cards:', error);
      return [];
    }
  }

  private async getPendingAudioMetadata(): Promise<any[]> {
    // Audio metadata usually comes from server
    return [];
  }

  private async checkDataIntegrity(): Promise<{ isValid: boolean; issues: string[] }> {
    const issues: string[] = [];
    
    try {
      // Check for orphaned cards
      const [orphanedCards] = await database.executeSql(`
        SELECT COUNT(*) as count FROM cards c 
        LEFT JOIN vocabularies v ON c.vocab_id = v.id 
        WHERE v.id IS NULL AND c.is_deleted = 0
      `);
      
      if (orphanedCards.rows.item(0).count > 0) {
        issues.push(`${orphanedCards.rows.item(0).count} orphaned cards found`);
      }

      // Check for missing required fields
      const [incompleteProgress] = await database.executeSql(`
        SELECT COUNT(*) as count FROM user_progress 
        WHERE date IS NULL OR date = ''
      `);
      
      if (incompleteProgress.rows.item(0).count > 0) {
        issues.push(`${incompleteProgress.rows.item(0).count} progress records missing dates`);
      }

    } catch (error) {
      console.error('Error checking data integrity:', error);
      issues.push('Unable to perform complete integrity check');
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  private async detectPotentialConflicts(): Promise<{ count: number; items: any[] }> {
    // This would detect potential conflicts based on sync timestamps and modification dates
    // For now, return empty as this would integrate with the conflict resolution service
    return {
      count: 0,
      items: [],
    };
  }

  private calculateDataSize(pendingUploads: any): number {
    let totalSize = 0;
    
    for (const [key, items] of Object.entries(pendingUploads)) {
      if (Array.isArray(items)) {
        // Rough estimate: 1KB per record
        totalSize += items.length * 1024;
      }
    }
    
    return totalSize;
  }

  private estimateSyncTime(preparation: SyncPreparation): number {
    const totalItems = Object.values(preparation.pendingUploads)
      .reduce((sum, items) => sum + items.length, 0);
    
    // Rough estimate: 100ms per item + base overhead
    return Math.max(5000, totalItems * 100); // minimum 5 seconds
  }

  // Import methods (simplified)
  private async importStudySessions(sessions: any[]): Promise<number> {
    let imported = 0;
    for (const session of sessions) {
      try {
        await studySessionModel.create(session);
        imported++;
      } catch (error) {
        console.warn('Error importing study session:', error);
      }
    }
    return imported;
  }

  private async importUserProgress(progressRecords: any[]): Promise<number> {
    let imported = 0;
    for (const progress of progressRecords) {
      try {
        await userProgressModel.create(progress);
        imported++;
      } catch (error) {
        console.warn('Error importing user progress:', error);
      }
    }
    return imported;
  }

  private async importVocabulary(vocabulary: any[]): Promise<number> {
    let imported = 0;
    for (const vocab of vocabulary) {
      try {
        await vocabularyModel.create(vocab);
        imported++;
      } catch (error) {
        console.warn('Error importing vocabulary:', error);
      }
    }
    return imported;
  }

  private async importCards(cards: any[]): Promise<number> {
    let imported = 0;
    for (const card of cards) {
      try {
        await cardModel.create(card);
        imported++;
      } catch (error) {
        console.warn('Error importing card:', error);
      }
    }
    return imported;
  }
}

// Export singleton instance
export const offlineDataExportService = OfflineDataExportService.getInstance();
export default OfflineDataExportService;