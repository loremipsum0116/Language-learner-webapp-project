// src/services/AudioCacheService.ts
// 로컬 음성 파일 캐싱 및 용량 관리 서비스

import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { audioFileModel, AudioFileRecord } from '../database/models/AudioFileModel';
import { vocabularyModel } from '../database/models/VocabularyModel';

export interface AudioCacheConfig {
  maxCacheSize: number; // bytes
  maxFilesPerQuality: number;
  defaultQuality: 'low' | 'medium' | 'high';
  autoCleanupEnabled: boolean;
  cleanupThreshold: number; // percentage
  retentionDays: number;
  preloadCount: number; // number of files to preload
}

export interface AudioCacheStats {
  totalFiles: number;
  totalSize: number;
  availableSpace: number;
  cacheHitRate: number;
  downloadSpeed: number; // bytes per second
  lastCleanup: string;
  qualityDistribution: {
    low: number;
    medium: number;
    high: number;
  };
  compressionRatio: number;
}

export interface CacheOperation {
  id: string;
  type: 'download' | 'delete' | 'cleanup' | 'preload';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: number; // 0-100
  audioFileId: number;
  fileName: string;
  size: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export class AudioCacheService {
  private static instance: AudioCacheService;
  private cacheDir: string;
  private tempDir: string;
  private config: AudioCacheConfig = {
    maxCacheSize: 500 * 1024 * 1024, // 500MB
    maxFilesPerQuality: 500,
    defaultQuality: 'medium',
    autoCleanupEnabled: true,
    cleanupThreshold: 90, // Start cleanup at 90% full
    retentionDays: 30,
    preloadCount: 50,
  };
  private operations: Map<string, CacheOperation> = new Map();
  private downloadQueue: number[] = [];
  private isProcessingQueue = false;
  private stats: AudioCacheStats = {
    totalFiles: 0,
    totalSize: 0,
    availableSpace: 0,
    cacheHitRate: 0,
    downloadSpeed: 0,
    lastCleanup: '',
    qualityDistribution: { low: 0, medium: 0, high: 0 },
    compressionRatio: 0,
  };

  private constructor() {
    this.cacheDir = `${RNFS.DocumentDirectoryPath}/audio_cache`;
    this.tempDir = `${RNFS.DocumentDirectoryPath}/audio_temp`;
    this.initializeDirectories();
    this.loadConfig();
    this.updateStats();
  }

  public static getInstance(): AudioCacheService {
    if (!AudioCacheService.instance) {
      AudioCacheService.instance = new AudioCacheService();
    }
    return AudioCacheService.instance;
  }

  // Initialize cache directories
  private async initializeDirectories(): Promise<void> {
    try {
      await Promise.all([
        this.ensureDirectory(this.cacheDir),
        this.ensureDirectory(this.tempDir),
        this.ensureDirectory(`${this.cacheDir}/low`),
        this.ensureDirectory(`${this.cacheDir}/medium`),
        this.ensureDirectory(`${this.cacheDir}/high`),
      ]);
      console.log('Audio cache directories initialized');
    } catch (error) {
      console.error('Error initializing cache directories:', error);
    }
  }

  // Ensure directory exists
  private async ensureDirectory(path: string): Promise<void> {
    try {
      const exists = await RNFS.exists(path);
      if (!exists) {
        await RNFS.mkdir(path);
      }
    } catch (error) {
      console.error(`Error creating directory ${path}:`, error);
    }
  }

  // Cache audio file with progress tracking
  public async cacheAudioFile(
    audioFileId: number,
    options: {
      priority?: 'low' | 'normal' | 'high';
      quality?: 'low' | 'medium' | 'high';
      onProgress?: (progress: number) => void;
    } = {}
  ): Promise<boolean> {
    const { priority = 'normal', quality, onProgress } = options;

    try {
      const audioFile = await audioFileModel.findById(audioFileId);
      if (!audioFile) {
        throw new Error(`Audio file ${audioFileId} not found`);
      }

      // Check if already cached
      if (await this.isFileCached(audioFile)) {
        console.log(`Audio file ${audioFile.file_name} already cached`);
        return true;
      }

      // Check cache space
      if (!(await this.hasSpaceForFile(audioFile.file_size))) {
        const freed = await this.freeUpSpace(audioFile.file_size);
        if (!freed) {
          throw new Error('Insufficient storage space');
        }
      }

      // Create cache operation
      const operation: CacheOperation = {
        id: `cache_${audioFileId}_${Date.now()}`,
        type: 'download',
        status: 'pending',
        progress: 0,
        audioFileId,
        fileName: audioFile.file_name,
        size: audioFile.file_size,
        startedAt: new Date().toISOString(),
      };

      this.operations.set(operation.id, operation);

      // Add to download queue based on priority
      if (priority === 'high') {
        this.downloadQueue.unshift(audioFileId);
      } else {
        this.downloadQueue.push(audioFileId);
      }

      // Process queue
      this.processDownloadQueue();

      return await this.waitForOperation(operation.id, onProgress);
    } catch (error) {
      console.error(`Error caching audio file ${audioFileId}:`, error);
      return false;
    }
  }

  // Process download queue
  private async processDownloadQueue(): Promise<void> {
    if (this.isProcessingQueue || this.downloadQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.downloadQueue.length > 0) {
      const audioFileId = this.downloadQueue.shift()!;
      
      try {
        await this.downloadAudioFile(audioFileId);
      } catch (error) {
        console.error(`Error downloading audio file ${audioFileId}:`, error);
      }

      // Small delay to prevent overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.isProcessingQueue = false;
  }

  // Download individual audio file
  private async downloadAudioFile(audioFileId: number): Promise<boolean> {
    try {
      const audioFile = await audioFileModel.findById(audioFileId);
      if (!audioFile) return false;

      const operation = Array.from(this.operations.values())
        .find(op => op.audioFileId === audioFileId && op.status === 'pending');

      if (!operation) return false;

      operation.status = 'in_progress';

      const quality = audioFile.quality;
      const qualityDir = `${this.cacheDir}/${quality}`;
      const tempPath = `${this.tempDir}/${audioFile.file_name}`;
      const finalPath = `${qualityDir}/${audioFile.file_name}`;

      const startTime = Date.now();

      // Download to temp directory first
      const downloadResult = await RNFS.downloadFile({
        fromUrl: audioFile.download_url,
        toFile: tempPath,
        progress: (res) => {
          const progress = (res.bytesWritten / res.contentLength) * 100;
          operation.progress = progress;
        },
      }).promise;

      if (downloadResult.statusCode !== 200) {
        throw new Error(`Download failed with status: ${downloadResult.statusCode}`);
      }

      // Verify file integrity
      const fileStat = await RNFS.stat(tempPath);
      if (Math.abs(fileStat.size - audioFile.file_size) > 1024) {
        throw new Error('File size mismatch');
      }

      // Move to final location
      await RNFS.moveFile(tempPath, finalPath);

      // Update database
      await audioFileModel.update(audioFileId, {
        file_path: finalPath,
        is_downloaded: 1,
        download_date: new Date().toISOString(),
      });

      // Update operation
      operation.status = 'completed';
      operation.progress = 100;
      operation.completedAt = new Date().toISOString();

      // Update stats
      const downloadTime = (Date.now() - startTime) / 1000;
      this.updateDownloadSpeed(audioFile.file_size, downloadTime);
      await this.updateStats();

      console.log(`Audio file cached: ${audioFile.file_name}`);
      return true;

    } catch (error) {
      const operation = Array.from(this.operations.values())
        .find(op => op.audioFileId === audioFileId);

      if (operation) {
        operation.status = 'failed';
        operation.error = error instanceof Error ? error.message : String(error);
      }

      console.error(`Error downloading audio file ${audioFileId}:`, error);
      return false;
    }
  }

  // Check if file is cached
  public async isFileCached(audioFile: AudioFileRecord): Promise<boolean> {
    try {
      if (!audioFile.is_downloaded || !audioFile.file_path) {
        return false;
      }

      const exists = await RNFS.exists(audioFile.file_path);
      
      if (!exists) {
        // File missing - update database
        await audioFileModel.update(audioFile.id, {
          is_downloaded: 0,
          file_path: '',
          download_date: null,
        });
        return false;
      }

      // Verify file integrity
      const fileStat = await RNFS.stat(audioFile.file_path);
      if (Math.abs(fileStat.size - audioFile.file_size) > 1024) {
        console.warn(`File size mismatch for ${audioFile.file_name}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking cache status:', error);
      return false;
    }
  }

  // Get cached audio file path
  public async getCachedFilePath(audioFileId: number): Promise<string | null> {
    try {
      const audioFile = await audioFileModel.findById(audioFileId);
      if (!audioFile) return null;

      if (await this.isFileCached(audioFile)) {
        return audioFile.file_path;
      }

      return null;
    } catch (error) {
      console.error('Error getting cached file path:', error);
      return null;
    }
  }

  // Batch cache multiple files
  public async batchCacheFiles(
    audioFileIds: number[],
    options: {
      quality?: 'low' | 'medium' | 'high';
      onProgress?: (completed: number, total: number) => void;
      maxConcurrent?: number;
    } = {}
  ): Promise<{ successful: number; failed: number; skipped: number }> {
    const { quality, onProgress, maxConcurrent = 3 } = options;
    
    let successful = 0;
    let failed = 0;
    let skipped = 0;
    let completed = 0;

    // Process in chunks to avoid overwhelming
    const chunks = this.chunkArray(audioFileIds, maxConcurrent);

    for (const chunk of chunks) {
      const promises = chunk.map(async (audioFileId) => {
        try {
          const audioFile = await audioFileModel.findById(audioFileId);
          if (!audioFile) return 'failed';

          if (await this.isFileCached(audioFile)) {
            return 'skipped';
          }

          const result = await this.cacheAudioFile(audioFileId, { quality });
          return result ? 'successful' : 'failed';
        } catch (error) {
          console.error(`Error caching file ${audioFileId}:`, error);
          return 'failed';
        }
      });

      const results = await Promise.all(promises);
      
      results.forEach(result => {
        switch (result) {
          case 'successful': successful++; break;
          case 'failed': failed++; break;
          case 'skipped': skipped++; break;
        }
        completed++;
      });

      if (onProgress) {
        onProgress(completed, audioFileIds.length);
      }
    }

    console.log(`Batch cache completed: ${successful} successful, ${failed} failed, ${skipped} skipped`);
    
    return { successful, failed, skipped };
  }

  // Smart preloading based on user patterns
  public async preloadRelevantAudio(
    vocabIds: number[],
    options: {
      quality?: 'low' | 'medium' | 'high';
      maxFiles?: number;
    } = {}
  ): Promise<number> {
    const { quality = this.config.defaultQuality, maxFiles = this.config.preloadCount } = options;

    try {
      // Get audio files for vocabularies
      const audioFiles: AudioFileRecord[] = [];
      
      for (const vocabId of vocabIds.slice(0, maxFiles)) {
        const vocabAudioFiles = await audioFileModel.getAudioForVocab(vocabId);
        const qualityFile = vocabAudioFiles.find(f => f.quality === quality);
        if (qualityFile && !(await this.isFileCached(qualityFile))) {
          audioFiles.push(qualityFile);
        }
      }

      if (audioFiles.length === 0) {
        return 0;
      }

      // Sort by vocabulary difficulty (easier words first)
      const sortedFiles = await this.sortByPriority(audioFiles);
      const filesToCache = sortedFiles.slice(0, maxFiles);

      // Cache files
      const result = await this.batchCacheFiles(
        filesToCache.map(f => f.id),
        { quality, maxConcurrent: 2 }
      );

      console.log(`Preloaded ${result.successful} audio files`);
      return result.successful;
    } catch (error) {
      console.error('Error preloading audio:', error);
      return 0;
    }
  }

  // Clean up cache to free space
  public async cleanupCache(
    options: {
      aggressive?: boolean;
      targetFreeSpace?: number; // bytes
    } = {}
  ): Promise<number> {
    const { aggressive = false, targetFreeSpace } = options;

    try {
      let totalFreed = 0;
      const now = new Date();
      const cutoffDate = new Date(now.getTime() - this.config.retentionDays * 24 * 60 * 60 * 1000);

      // Get all cached files
      const cachedFiles = await audioFileModel.getDownloadedAudioFiles();
      
      // Sort by last access time (oldest first)
      const sortedFiles = cachedFiles.sort((a, b) => {
        const aTime = new Date(a.download_date || 0);
        const bTime = new Date(b.download_date || 0);
        return aTime.getTime() - bTime.getTime();
      });

      for (const audioFile of sortedFiles) {
        const shouldDelete = aggressive ||
                           (audioFile.download_date && new Date(audioFile.download_date) < cutoffDate) ||
                           (targetFreeSpace && totalFreed < targetFreeSpace);

        if (shouldDelete) {
          try {
            if (audioFile.file_path && await RNFS.exists(audioFile.file_path)) {
              const fileStat = await RNFS.stat(audioFile.file_path);
              await RNFS.unlink(audioFile.file_path);
              
              // Update database
              await audioFileModel.update(audioFile.id, {
                is_downloaded: 0,
                file_path: '',
                download_date: null,
              });

              totalFreed += fileStat.size;
              console.log(`Deleted cached file: ${audioFile.file_name} (${fileStat.size} bytes)`);
            }
          } catch (error) {
            console.error(`Error deleting file ${audioFile.file_name}:`, error);
          }
        }

        if (targetFreeSpace && totalFreed >= targetFreeSpace) {
          break;
        }
      }

      // Update stats
      await this.updateStats();
      
      // Save cleanup timestamp
      this.stats.lastCleanup = new Date().toISOString();
      await this.saveStats();

      console.log(`Cache cleanup freed ${totalFreed} bytes`);
      return totalFreed;
    } catch (error) {
      console.error('Error during cache cleanup:', error);
      return 0;
    }
  }

  // Get cache statistics
  public async getCacheStats(): Promise<AudioCacheStats> {
    await this.updateStats();
    return { ...this.stats };
  }

  // Update cache statistics
  private async updateStats(): Promise<void> {
    try {
      const cachedFiles = await audioFileModel.getDownloadedAudioFiles();
      const totalSize = cachedFiles.reduce((sum, file) => sum + file.file_size, 0);
      
      // Get device storage info
      const fsInfo = await RNFS.getFSInfo();
      
      // Quality distribution
      const qualityDistribution = cachedFiles.reduce((dist, file) => {
        dist[file.quality]++;
        return dist;
      }, { low: 0, medium: 0, high: 0 });

      this.stats = {
        ...this.stats,
        totalFiles: cachedFiles.length,
        totalSize,
        availableSpace: fsInfo.freeSpace,
        qualityDistribution,
      };
    } catch (error) {
      console.error('Error updating cache stats:', error);
    }
  }

  // Helper methods
  private async hasSpaceForFile(fileSize: number): Promise<boolean> {
    try {
      const fsInfo = await RNFS.getFSInfo();
      const requiredSpace = fileSize * 1.1; // 10% buffer
      
      return fsInfo.freeSpace >= requiredSpace &&
             (this.stats.totalSize + fileSize) <= this.config.maxCacheSize;
    } catch (error) {
      console.error('Error checking available space:', error);
      return false;
    }
  }

  private async freeUpSpace(requiredSpace: number): Promise<boolean> {
    if (!this.config.autoCleanupEnabled) {
      return false;
    }

    const freed = await this.cleanupCache({ targetFreeSpace: requiredSpace * 1.5 });
    return freed >= requiredSpace;
  }

  private async waitForOperation(
    operationId: string,
    onProgress?: (progress: number) => void
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const checkOperation = () => {
        const operation = this.operations.get(operationId);
        
        if (!operation) {
          resolve(false);
          return;
        }

        if (onProgress) {
          onProgress(operation.progress);
        }

        if (operation.status === 'completed') {
          resolve(true);
        } else if (operation.status === 'failed') {
          resolve(false);
        } else {
          setTimeout(checkOperation, 100);
        }
      };

      checkOperation();
    });
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private async sortByPriority(audioFiles: AudioFileRecord[]): Promise<AudioFileRecord[]> {
    // Sort by vocabulary difficulty and frequency
    const withVocab = await Promise.all(
      audioFiles.map(async (file) => {
        const vocab = await vocabularyModel.findById(file.vocab_id);
        return {
          file,
          difficulty: vocab?.difficulty_level || 5,
          frequency: vocab?.frequency_rank || 99999,
        };
      })
    );

    return withVocab
      .sort((a, b) => a.difficulty - b.difficulty || a.frequency - b.frequency)
      .map(item => item.file);
  }

  private updateDownloadSpeed(bytes: number, seconds: number): void {
    const speed = bytes / seconds;
    this.stats.downloadSpeed = this.stats.downloadSpeed
      ? (this.stats.downloadSpeed + speed) / 2
      : speed;
  }

  // Configuration management
  public updateConfig(newConfig: Partial<AudioCacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.saveConfig();
  }

  public getConfig(): AudioCacheConfig {
    return { ...this.config };
  }

  private async loadConfig(): Promise<void> {
    try {
      const configStr = await AsyncStorage.getItem('@audio_cache_config');
      if (configStr) {
        const config = JSON.parse(configStr);
        this.config = { ...this.config, ...config };
      }
    } catch (error) {
      console.error('Error loading cache config:', error);
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      await AsyncStorage.setItem('@audio_cache_config', JSON.stringify(this.config));
    } catch (error) {
      console.error('Error saving cache config:', error);
    }
  }

  private async saveStats(): Promise<void> {
    try {
      await AsyncStorage.setItem('@audio_cache_stats', JSON.stringify(this.stats));
    } catch (error) {
      console.error('Error saving cache stats:', error);
    }
  }

  // Cleanup
  public destroy(): void {
    this.downloadQueue = [];
    this.operations.clear();
  }
}

// Export singleton instance
export const audioCacheService = AudioCacheService.getInstance();
export default AudioCacheService;