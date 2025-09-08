// src/database/models/VocabularyModel.ts
// 단어장 데이터 모델

import { BaseModel, BaseRecord } from './BaseModel';
import { database } from '../sqlite/Database';

export interface VocabularyRecord extends BaseRecord {
  lemma: string;
  pos?: string; // Part of speech
  definition?: string;
  example?: string;
  pronunciation?: string;
  pronunciation_ko?: string;
  difficulty?: number;
  source?: string;
}

export interface VocabularySearchOptions {
  query?: string;
  difficulty?: number;
  pos?: string;
  source?: string;
  hasDefinition?: boolean;
  hasExample?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'lemma' | 'difficulty' | 'created_at' | 'updated_at';
  sortOrder?: 'ASC' | 'DESC';
}

export class VocabularyModel extends BaseModel<VocabularyRecord> {
  constructor() {
    super('vocabularies');
  }

  // Search vocabularies with advanced options
  async search(options: VocabularySearchOptions = {}): Promise<VocabularyRecord[]> {
    const {
      query,
      difficulty,
      pos,
      source,
      hasDefinition,
      hasExample,
      limit = 50,
      offset = 0,
      sortBy = 'lemma',
      sortOrder = 'ASC',
    } = options;

    let sql = `SELECT * FROM ${this.tableName} WHERE is_deleted = 0`;
    const params: any[] = [];

    // Text search
    if (query) {
      sql += ` AND (lemma LIKE ? OR definition LIKE ? OR example LIKE ?)`;
      const searchTerm = `%${query}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Filter by difficulty
    if (difficulty !== undefined) {
      sql += ` AND difficulty = ?`;
      params.push(difficulty);
    }

    // Filter by part of speech
    if (pos) {
      sql += ` AND pos = ?`;
      params.push(pos);
    }

    // Filter by source
    if (source) {
      sql += ` AND source = ?`;
      params.push(source);
    }

    // Filter by definition existence
    if (hasDefinition !== undefined) {
      if (hasDefinition) {
        sql += ` AND definition IS NOT NULL AND definition != ''`;
      } else {
        sql += ` AND (definition IS NULL OR definition = '')`;
      }
    }

    // Filter by example existence
    if (hasExample !== undefined) {
      if (hasExample) {
        sql += ` AND example IS NOT NULL AND example != ''`;
      } else {
        sql += ` AND (example IS NULL OR example = '')`;
      }
    }

    // Sorting
    sql += ` ORDER BY ${sortBy} ${sortOrder}`;

    // Pagination
    sql += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    try {
      const [result] = await database.executeSql(sql, params);
      const vocabularies: VocabularyRecord[] = [];

      for (let i = 0; i < result.rows.length; i++) {
        vocabularies.push(result.rows.item(i) as VocabularyRecord);
      }

      return vocabularies;
    } catch (error) {
      console.error('Error searching vocabularies:', error);
      throw error;
    }
  }

  // Find vocabulary by lemma
  async findByLemma(lemma: string): Promise<VocabularyRecord | null> {
    try {
      const [result] = await database.executeSql(
        `SELECT * FROM ${this.tableName} WHERE lemma = ? AND is_deleted = 0`,
        [lemma]
      );

      if (result.rows.length > 0) {
        return result.rows.item(0) as VocabularyRecord;
      }
      return null;
    } catch (error) {
      console.error('Error finding vocabulary by lemma:', error);
      throw error;
    }
  }

  // Get vocabularies by difficulty level
  async getByDifficulty(difficulty: number): Promise<VocabularyRecord[]> {
    return this.search({ difficulty });
  }

  // Get vocabularies by part of speech
  async getByPOS(pos: string): Promise<VocabularyRecord[]> {
    return this.search({ pos });
  }

  // Get random vocabularies for quiz
  async getRandomForQuiz(limit: number = 20, excludeIds: number[] = []): Promise<VocabularyRecord[]> {
    try {
      let sql = `
        SELECT * FROM ${this.tableName} 
        WHERE is_deleted = 0
      `;
      const params: any[] = [];

      if (excludeIds.length > 0) {
        const placeholders = excludeIds.map(() => '?').join(', ');
        sql += ` AND id NOT IN (${placeholders})`;
        params.push(...excludeIds);
      }

      sql += ` ORDER BY RANDOM() LIMIT ?`;
      params.push(limit);

      const [result] = await database.executeSql(sql, params);
      const vocabularies: VocabularyRecord[] = [];

      for (let i = 0; i < result.rows.length; i++) {
        vocabularies.push(result.rows.item(i) as VocabularyRecord);
      }

      return vocabularies;
    } catch (error) {
      console.error('Error getting random vocabularies for quiz:', error);
      throw error;
    }
  }

  // Get vocabulary statistics
  async getStatistics(): Promise<{
    total: number;
    byDifficulty: { [key: number]: number };
    byPOS: { [key: string]: number };
    withDefinition: number;
    withExample: number;
    withPronunciation: number;
  }> {
    try {
      // Total count
      const totalCount = await this.count();

      // By difficulty
      const [difficultyResult] = await database.executeSql(`
        SELECT difficulty, COUNT(*) as count 
        FROM ${this.tableName} 
        WHERE is_deleted = 0 
        GROUP BY difficulty
      `);

      const byDifficulty: { [key: number]: number } = {};
      for (let i = 0; i < difficultyResult.rows.length; i++) {
        const row = difficultyResult.rows.item(i);
        byDifficulty[row.difficulty] = row.count;
      }

      // By POS
      const [posResult] = await database.executeSql(`
        SELECT pos, COUNT(*) as count 
        FROM ${this.tableName} 
        WHERE is_deleted = 0 AND pos IS NOT NULL
        GROUP BY pos
      `);

      const byPOS: { [key: string]: number } = {};
      for (let i = 0; i < posResult.rows.length; i++) {
        const row = posResult.rows.item(i);
        byPOS[row.pos] = row.count;
      }

      // With definition
      const withDefinition = await this.count(
        `definition IS NOT NULL AND definition != ''`
      );

      // With example
      const withExample = await this.count(
        `example IS NOT NULL AND example != ''`
      );

      // With pronunciation
      const withPronunciation = await this.count(
        `pronunciation IS NOT NULL AND pronunciation != ''`
      );

      return {
        total: totalCount,
        byDifficulty,
        byPOS,
        withDefinition,
        withExample,
        withPronunciation,
      };
    } catch (error) {
      console.error('Error getting vocabulary statistics:', error);
      throw error;
    }
  }

  // Import vocabularies from server data
  async importFromServer(serverData: any[]): Promise<{
    imported: number;
    updated: number;
    skipped: number;
  }> {
    let imported = 0;
    let updated = 0;
    let skipped = 0;

    try {
      for (const item of serverData) {
        const existing = item.id ? await this.findByServerId(item.id) : null;

        if (existing) {
          // Update existing record
          await this.update(existing.id!, {
            lemma: item.lemma,
            pos: item.pos,
            definition: item.definition,
            example: item.example,
            pronunciation: item.pronunciation,
            pronunciation_ko: item.pronunciation_ko,
            difficulty: item.difficulty,
            source: item.source,
          });
          updated++;
        } else {
          // Create new record
          await this.create({
            server_id: item.id,
            lemma: item.lemma,
            pos: item.pos,
            definition: item.definition,
            example: item.example,
            pronunciation: item.pronunciation,
            pronunciation_ko: item.pronunciation_ko,
            difficulty: item.difficulty || 1,
            source: item.source,
          });
          imported++;
        }
      }

      console.log(`Vocabulary import completed: ${imported} imported, ${updated} updated, ${skipped} skipped`);
      
      return { imported, updated, skipped };
    } catch (error) {
      console.error('Error importing vocabularies:', error);
      throw error;
    }
  }

  // Export vocabularies for sync
  async exportForSync(): Promise<any[]> {
    try {
      const vocabularies = await this.getUnsyncedRecords();
      
      return vocabularies.map(vocab => ({
        id: vocab.server_id,
        local_id: vocab.id,
        lemma: vocab.lemma,
        pos: vocab.pos,
        definition: vocab.definition,
        example: vocab.example,
        pronunciation: vocab.pronunciation,
        pronunciation_ko: vocab.pronunciation_ko,
        difficulty: vocab.difficulty,
        source: vocab.source,
        created_at: vocab.created_at,
        updated_at: vocab.updated_at,
        is_deleted: vocab.is_deleted,
      }));
    } catch (error) {
      console.error('Error exporting vocabularies for sync:', error);
      throw error;
    }
  }

  // Get similar vocabularies (for learning recommendations)
  async getSimilar(vocabId: number, limit: number = 10): Promise<VocabularyRecord[]> {
    try {
      const vocab = await this.findById(vocabId);
      if (!vocab) return [];

      // Find similar vocabularies by POS and difficulty
      let sql = `
        SELECT * FROM ${this.tableName} 
        WHERE is_deleted = 0 AND id != ?
      `;
      const params: any[] = [vocabId];

      if (vocab.pos) {
        sql += ` AND pos = ?`;
        params.push(vocab.pos);
      }

      if (vocab.difficulty) {
        sql += ` AND ABS(difficulty - ?) <= 1`;
        params.push(vocab.difficulty);
      }

      sql += ` ORDER BY RANDOM() LIMIT ?`;
      params.push(limit);

      const [result] = await database.executeSql(sql, params);
      const vocabularies: VocabularyRecord[] = [];

      for (let i = 0; i < result.rows.length; i++) {
        vocabularies.push(result.rows.item(i) as VocabularyRecord);
      }

      return vocabularies;
    } catch (error) {
      console.error('Error getting similar vocabularies:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const vocabularyModel = new VocabularyModel();
export default VocabularyModel;