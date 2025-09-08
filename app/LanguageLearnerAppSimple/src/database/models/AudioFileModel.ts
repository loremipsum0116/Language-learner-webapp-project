// src/database/models/AudioFileModel.ts
// 오디오 파일 데이터 모델

import { BaseModel } from './BaseModel';
import { AudioFile } from '../../types/OfflineDataTypes';
import RNFS from 'react-native-fs';
import crypto from 'crypto';

export interface AudioFileRecord extends AudioFile {
  id: number;
}

export class AudioFileModel extends BaseModel<AudioFileRecord> {
  private audioDirectory: string;

  constructor() {
    super('audio_files');
    this.audioDirectory = `${RNFS.DocumentDirectoryPath}/audio`;
    this.ensureAudioDirectory();
  }

  // Create table schema
  public getCreateTableSQL(): string {
    return `
      CREATE TABLE IF NOT EXISTS audio_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id TEXT UNIQUE,
        vocab_id INTEGER NOT NULL,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL DEFAULT 0,
        duration INTEGER, -- seconds
        quality TEXT NOT NULL CHECK (quality IN ('low', 'medium', 'high')) DEFAULT 'medium',
        format TEXT NOT NULL CHECK (format IN ('mp3', 'wav', 'm4a')) DEFAULT 'mp3',
        download_url TEXT NOT NULL,
        is_downloaded INTEGER NOT NULL DEFAULT 0,
        download_date TEXT,
        checksum TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        synced_at TEXT,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (vocab_id) REFERENCES vocabularies (id)
      )
    `;
  }

  // Get indexes for performance
  public getIndexes(): string[] {
    return [
      'CREATE INDEX IF NOT EXISTS idx_audio_files_vocab_id ON audio_files(vocab_id)',
      'CREATE INDEX IF NOT EXISTS idx_audio_files_is_downloaded ON audio_files(is_downloaded)',
      'CREATE INDEX IF NOT EXISTS idx_audio_files_quality ON audio_files(quality)',
      'CREATE INDEX IF NOT EXISTS idx_audio_files_format ON audio_files(format)',
      'CREATE INDEX IF NOT EXISTS idx_audio_files_synced_at ON audio_files(synced_at)',
    ];
  }

  // Ensure audio directory exists
  private async ensureAudioDirectory(): Promise<void> {
    try {
      const exists = await RNFS.exists(this.audioDirectory);
      if (!exists) {
        await RNFS.mkdir(this.audioDirectory);
        console.log('Audio directory created:', this.audioDirectory);
      }
    } catch (error) {
      console.error('Error creating audio directory:', error);
    }
  }

  // Get audio files for vocabulary
  public async getAudioForVocab(vocabId: number): Promise<AudioFileRecord[]> {
    try {
      const sql = `
        SELECT * FROM ${this.tableName} 
        WHERE vocab_id = ? AND is_deleted = 0
        ORDER BY quality DESC, created_at DESC
      `;
      
      const [result] = await this.database.executeSql(sql, [vocabId]);
      const audioFiles: AudioFileRecord[] = [];

      for (let i = 0; i < result.rows.length; i++) {
        audioFiles.push(result.rows.item(i));
      }

      return audioFiles;
    } catch (error) {
      console.error('Error getting audio for vocab:', error);
      return [];
    }
  }

  // Get downloaded audio files
  public async getDownloadedAudioFiles(): Promise<AudioFileRecord[]> {
    try {
      const sql = `
        SELECT * FROM ${this.tableName} 
        WHERE is_downloaded = 1 AND is_deleted = 0
        ORDER BY download_date DESC
      `;
      
      const [result] = await this.database.executeSql(sql);
      const audioFiles: AudioFileRecord[] = [];

      for (let i = 0; i < result.rows.length; i++) {
        const audioFile = result.rows.item(i);
        // Verify file still exists
        const fileExists = await RNFS.exists(audioFile.file_path);
        if (fileExists) {
          audioFiles.push(audioFile);
        } else {
          // Mark as not downloaded if file is missing
          await this.update(audioFile.id, {
            is_downloaded: 0,
            download_date: null,
          });
        }
      }

      return audioFiles;
    } catch (error) {
      console.error('Error getting downloaded audio files:', error);
      return [];
    }
  }

  // Download audio file
  public async downloadAudioFile(
    audioFileId: number,
    onProgress?: (progress: number) => void
  ): Promise<boolean> {
    try {
      const audioFile = await this.findById(audioFileId);
      if (!audioFile) {
        throw new Error(`Audio file ${audioFileId} not found`);
      }

      if (audioFile.is_downloaded) {
        // Check if file still exists
        const fileExists = await RNFS.exists(audioFile.file_path);
        if (fileExists) {
          console.log('Audio file already downloaded:', audioFile.file_name);
          return true;
        }
      }

      const localPath = `${this.audioDirectory}/${audioFile.file_name}`;
      
      console.log('Downloading audio file:', audioFile.download_url, 'to', localPath);

      // Download file
      const downloadResult = await RNFS.downloadFile({
        fromUrl: audioFile.download_url,
        toFile: localPath,
        progress: onProgress ? (res) => {
          const progress = (res.bytesWritten / res.contentLength) * 100;
          onProgress(progress);
        } : undefined,
      }).promise;

      if (downloadResult.statusCode === 200) {
        // Get file stats
        const fileStat = await RNFS.stat(localPath);
        const checksum = await this.calculateFileChecksum(localPath);

        // Update database
        await this.update(audioFileId, {
          file_path: localPath,
          file_size: fileStat.size,
          is_downloaded: 1,
          download_date: new Date().toISOString(),
          checksum,
        });

        console.log('Audio file downloaded successfully:', audioFile.file_name);
        return true;
      } else {
        console.error('Audio download failed with status:', downloadResult.statusCode);
        return false;
      }
    } catch (error) {
      console.error('Error downloading audio file:', error);
      return false;
    }
  }

  // Batch download audio files
  public async batchDownloadAudio(
    audioFileIds: number[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<{ successful: number; failed: number; results: { id: number; success: boolean }[] }> {
    const results: { id: number; success: boolean }[] = [];
    let successful = 0;
    let failed = 0;

    for (let i = 0; i < audioFileIds.length; i++) {
      try {
        const success = await this.downloadAudioFile(audioFileIds[i]);
        results.push({ id: audioFileIds[i], success });
        
        if (success) {
          successful++;
        } else {
          failed++;
        }

        if (onProgress) {
          onProgress(i + 1, audioFileIds.length);
        }
      } catch (error) {
        console.error(`Error downloading audio file ${audioFileIds[i]}:`, error);
        results.push({ id: audioFileIds[i], success: false });
        failed++;
      }
    }

    console.log(`Batch download completed: ${successful} successful, ${failed} failed`);
    
    return { successful, failed, results };
  }

  // Delete downloaded audio file
  public async deleteDownloadedAudio(audioFileId: number): Promise<boolean> {
    try {
      const audioFile = await this.findById(audioFileId);
      if (!audioFile) {
        return false;
      }

      if (audioFile.is_downloaded && audioFile.file_path) {
        const fileExists = await RNFS.exists(audioFile.file_path);
        if (fileExists) {
          await RNFS.unlink(audioFile.file_path);
        }

        // Update database
        await this.update(audioFileId, {
          is_downloaded: 0,
          download_date: null,
          file_size: 0,
        });

        console.log('Audio file deleted:', audioFile.file_name);
      }

      return true;
    } catch (error) {
      console.error('Error deleting audio file:', error);
      return false;
    }
  }

  // Get audio storage statistics
  public async getAudioStorageStats(): Promise<{
    totalFiles: number;
    downloadedFiles: number;
    totalSize: number;
    downloadedSize: number;
    availableSpace: number;
    audiosByQuality: { [quality: string]: number };
    audiosByFormat: { [format: string]: number };
  }> {
    try {
      // Basic counts and sizes
      const [totalResult] = await this.database.executeSql(`
        SELECT 
          COUNT(*) as total_files,
          COALESCE(SUM(file_size), 0) as total_size
        FROM ${this.tableName} 
        WHERE is_deleted = 0
      `);

      const [downloadedResult] = await this.database.executeSql(`
        SELECT 
          COUNT(*) as downloaded_files,
          COALESCE(SUM(file_size), 0) as downloaded_size
        FROM ${this.tableName} 
        WHERE is_downloaded = 1 AND is_deleted = 0
      `);

      // Audio by quality
      const [qualityResult] = await this.database.executeSql(`
        SELECT quality, COUNT(*) as count
        FROM ${this.tableName} 
        WHERE is_deleted = 0
        GROUP BY quality
      `);

      const audiosByQuality: { [quality: string]: number } = {};
      for (let i = 0; i < qualityResult.rows.length; i++) {
        const row = qualityResult.rows.item(i);
        audiosByQuality[row.quality] = row.count;
      }

      // Audio by format
      const [formatResult] = await this.database.executeSql(`
        SELECT format, COUNT(*) as count
        FROM ${this.tableName} 
        WHERE is_deleted = 0
        GROUP BY format
      `);

      const audiosByFormat: { [format: string]: number } = {};
      for (let i = 0; i < formatResult.rows.length; i++) {
        const row = formatResult.rows.item(i);
        audiosByFormat[row.format] = row.count;
      }

      // Available space
      const freeSpace = await RNFS.getFSInfo();

      return {
        totalFiles: totalResult.rows.item(0).total_files || 0,
        downloadedFiles: downloadedResult.rows.item(0).downloaded_files || 0,
        totalSize: totalResult.rows.item(0).total_size || 0,
        downloadedSize: downloadedResult.rows.item(0).downloaded_size || 0,
        availableSpace: freeSpace.freeSpace,
        audiosByQuality,
        audiosByFormat,
      };
    } catch (error) {
      console.error('Error getting audio storage stats:', error);
      return {
        totalFiles: 0,
        downloadedFiles: 0,
        totalSize: 0,
        downloadedSize: 0,
        availableSpace: 0,
        audiosByQuality: {},
        audiosByFormat: {},
      };
    }
  }

  // Clean up missing audio files
  public async cleanupMissingAudio(): Promise<number> {
    try {
      const downloadedFiles = await this.getDownloadedAudioFiles();
      let cleanedUp = 0;

      for (const audioFile of downloadedFiles) {
        const fileExists = await RNFS.exists(audioFile.file_path);
        if (!fileExists) {
          await this.update(audioFile.id, {
            is_downloaded: 0,
            download_date: null,
            file_size: 0,
          });
          cleanedUp++;
        }
      }

      console.log(`Cleaned up ${cleanedUp} missing audio files`);
      return cleanedUp;
    } catch (error) {
      console.error('Error cleaning up missing audio:', error);
      return 0;
    }
  }

  // Clean up old audio files
  public async cleanupOldAudio(retentionDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // Get old downloaded files
      const sql = `
        SELECT * FROM ${this.tableName} 
        WHERE is_downloaded = 1 
        AND download_date < ? 
        AND is_deleted = 0
      `;

      const [result] = await this.database.executeSql(sql, [cutoffDate.toISOString()]);
      let cleanedUp = 0;

      for (let i = 0; i < result.rows.length; i++) {
        const audioFile = result.rows.item(i);
        
        // Delete file from storage
        try {
          const fileExists = await RNFS.exists(audioFile.file_path);
          if (fileExists) {
            await RNFS.unlink(audioFile.file_path);
          }

          // Update database
          await this.update(audioFile.id, {
            is_downloaded: 0,
            download_date: null,
            file_size: 0,
          });

          cleanedUp++;
        } catch (fileError) {
          console.error(`Error deleting old audio file ${audioFile.file_name}:`, fileError);
        }
      }

      console.log(`Cleaned up ${cleanedUp} old audio files`);
      return cleanedUp;
    } catch (error) {
      console.error('Error cleaning up old audio:', error);
      return 0;
    }
  }

  // Calculate file checksum
  private async calculateFileChecksum(filePath: string): Promise<string> {
    try {
      const fileData = await RNFS.readFile(filePath, 'base64');
      return crypto.createHash('md5').update(fileData, 'base64').digest('hex');
    } catch (error) {
      console.error('Error calculating checksum:', error);
      return '';
    }
  }

  // Verify audio file integrity
  public async verifyAudioFile(audioFileId: number): Promise<boolean> {
    try {
      const audioFile = await this.findById(audioFileId);
      if (!audioFile || !audioFile.is_downloaded) {
        return false;
      }

      const fileExists = await RNFS.exists(audioFile.file_path);
      if (!fileExists) {
        // Mark as not downloaded
        await this.update(audioFileId, {
          is_downloaded: 0,
          download_date: null,
        });
        return false;
      }

      // Verify checksum if available
      if (audioFile.checksum) {
        const currentChecksum = await this.calculateFileChecksum(audioFile.file_path);
        if (currentChecksum !== audioFile.checksum) {
          console.warn('Audio file checksum mismatch:', audioFile.file_name);
          return false;
        }
      }

      // Verify file size
      const fileStat = await RNFS.stat(audioFile.file_path);
      if (Math.abs(fileStat.size - audioFile.file_size) > 1024) { // Allow 1KB difference
        console.warn('Audio file size mismatch:', audioFile.file_name);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error verifying audio file:', error);
      return false;
    }
  }

  // Get audio files needing download
  public async getAudioFilesNeedingDownload(
    quality?: 'low' | 'medium' | 'high',
    limit?: number
  ): Promise<AudioFileRecord[]> {
    try {
      let sql = `
        SELECT af.* FROM ${this.tableName} af
        INNER JOIN vocabularies v ON af.vocab_id = v.id
        WHERE af.is_downloaded = 0 AND af.is_deleted = 0 AND v.is_deleted = 0
      `;
      
      const params: any[] = [];

      if (quality) {
        sql += ' AND af.quality = ?';
        params.push(quality);
      }

      sql += ' ORDER BY v.difficulty_level ASC, af.created_at ASC';

      if (limit) {
        sql += ' LIMIT ?';
        params.push(limit);
      }

      const [result] = await this.database.executeSql(sql, params);
      const audioFiles: AudioFileRecord[] = [];

      for (let i = 0; i < result.rows.length; i++) {
        audioFiles.push(result.rows.item(i));
      }

      return audioFiles;
    } catch (error) {
      console.error('Error getting audio files needing download:', error);
      return [];
    }
  }
}

export const audioFileModel = new AudioFileModel();