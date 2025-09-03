// src/database/models/BaseModel.ts
// 데이터베이스 모델 기본 클래스

import { database } from '../sqlite/Database';

export interface BaseRecord {
  id?: number;
  server_id?: number;
  created_at?: string;
  updated_at?: string;
  synced_at?: string;
  is_deleted?: number;
}

export abstract class BaseModel<T extends BaseRecord> {
  protected tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  // Create new record
  async create(data: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<T> {
    const now = new Date().toISOString();
    const insertData = {
      ...data,
      created_at: now,
      updated_at: now,
    };

    const columns = Object.keys(insertData);
    const placeholders = columns.map(() => '?').join(', ');
    const values = Object.values(insertData);

    const sql = `
      INSERT INTO ${this.tableName} (${columns.join(', ')})
      VALUES (${placeholders})
    `;

    try {
      const [result] = await database.executeSql(sql, values);
      const insertId = result.insertId;
      
      // Add to sync queue
      await this.addToSyncQueue(insertId, 'insert', insertData);
      
      return await this.findById(insertId);
    } catch (error) {
      console.error(`Error creating ${this.tableName} record:`, error);
      throw error;
    }
  }

  // Find record by ID
  async findById(id: number): Promise<T | null> {
    try {
      const [result] = await database.executeSql(
        `SELECT * FROM ${this.tableName} WHERE id = ? AND is_deleted = 0`,
        [id]
      );

      if (result.rows.length > 0) {
        return result.rows.item(0) as T;
      }
      return null;
    } catch (error) {
      console.error(`Error finding ${this.tableName} by ID:`, error);
      throw error;
    }
  }

  // Find record by server ID
  async findByServerId(serverId: number): Promise<T | null> {
    try {
      const [result] = await database.executeSql(
        `SELECT * FROM ${this.tableName} WHERE server_id = ? AND is_deleted = 0`,
        [serverId]
      );

      if (result.rows.length > 0) {
        return result.rows.item(0) as T;
      }
      return null;
    } catch (error) {
      console.error(`Error finding ${this.tableName} by server ID:`, error);
      throw error;
    }
  }

  // Find all records
  async findAll(options?: {
    where?: string;
    params?: any[];
    orderBy?: string;
    limit?: number;
    offset?: number;
  }): Promise<T[]> {
    try {
      let sql = `SELECT * FROM ${this.tableName} WHERE is_deleted = 0`;
      const params: any[] = [];

      if (options?.where) {
        sql += ` AND ${options.where}`;
        if (options.params) {
          params.push(...options.params);
        }
      }

      if (options?.orderBy) {
        sql += ` ORDER BY ${options.orderBy}`;
      }

      if (options?.limit) {
        sql += ` LIMIT ${options.limit}`;
        if (options?.offset) {
          sql += ` OFFSET ${options.offset}`;
        }
      }

      const [result] = await database.executeSql(sql, params);
      const records: T[] = [];

      for (let i = 0; i < result.rows.length; i++) {
        records.push(result.rows.item(i) as T);
      }

      return records;
    } catch (error) {
      console.error(`Error finding all ${this.tableName} records:`, error);
      throw error;
    }
  }

  // Update record
  async update(id: number, data: Partial<Omit<T, 'id' | 'created_at'>>): Promise<T> {
    const updateData = {
      ...data,
      updated_at: new Date().toISOString(),
    };

    const columns = Object.keys(updateData);
    const setClause = columns.map(col => `${col} = ?`).join(', ');
    const values = [...Object.values(updateData), id];

    const sql = `
      UPDATE ${this.tableName}
      SET ${setClause}
      WHERE id = ?
    `;

    try {
      await database.executeSql(sql, values);
      
      // Add to sync queue
      await this.addToSyncQueue(id, 'update', updateData);
      
      return await this.findById(id);
    } catch (error) {
      console.error(`Error updating ${this.tableName} record:`, error);
      throw error;
    }
  }

  // Soft delete record
  async delete(id: number): Promise<boolean> {
    try {
      const updateData = {
        is_deleted: 1,
        updated_at: new Date().toISOString(),
      };

      await database.executeSql(
        `UPDATE ${this.tableName} SET is_deleted = 1, updated_at = ? WHERE id = ?`,
        [updateData.updated_at, id]
      );
      
      // Add to sync queue
      await this.addToSyncQueue(id, 'delete', updateData);
      
      return true;
    } catch (error) {
      console.error(`Error deleting ${this.tableName} record:`, error);
      throw error;
    }
  }

  // Hard delete record (permanent)
  async hardDelete(id: number): Promise<boolean> {
    try {
      await database.executeSql(`DELETE FROM ${this.tableName} WHERE id = ?`, [id]);
      return true;
    } catch (error) {
      console.error(`Error hard deleting ${this.tableName} record:`, error);
      throw error;
    }
  }

  // Count records
  async count(where?: string, params?: any[]): Promise<number> {
    try {
      let sql = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE is_deleted = 0`;
      const queryParams: any[] = [];

      if (where) {
        sql += ` AND ${where}`;
        if (params) {
          queryParams.push(...params);
        }
      }

      const [result] = await database.executeSql(sql, queryParams);
      return result.rows.item(0).count;
    } catch (error) {
      console.error(`Error counting ${this.tableName} records:`, error);
      throw error;
    }
  }

  // Batch insert
  async batchInsert(records: Array<Omit<T, 'id' | 'created_at' | 'updated_at'>>): Promise<void> {
    if (records.length === 0) return;

    const now = new Date().toISOString();
    const queries = records.map(record => {
      const insertData = {
        ...record,
        created_at: now,
        updated_at: now,
      };

      const columns = Object.keys(insertData);
      const placeholders = columns.map(() => '?').join(', ');
      const values = Object.values(insertData);

      return {
        sql: `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
        params: values,
      };
    });

    try {
      await database.transaction(queries);
      console.log(`Batch inserted ${records.length} records into ${this.tableName}`);
    } catch (error) {
      console.error(`Error batch inserting ${this.tableName} records:`, error);
      throw error;
    }
  }

  // Batch update
  async batchUpdate(updates: Array<{ id: number; data: Partial<Omit<T, 'id' | 'created_at'>> }>): Promise<void> {
    if (updates.length === 0) return;

    const now = new Date().toISOString();
    const queries = updates.map(({ id, data }) => {
      const updateData = {
        ...data,
        updated_at: now,
      };

      const columns = Object.keys(updateData);
      const setClause = columns.map(col => `${col} = ?`).join(', ');
      const values = [...Object.values(updateData), id];

      return {
        sql: `UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`,
        params: values,
      };
    });

    try {
      await database.transaction(queries);
      console.log(`Batch updated ${updates.length} records in ${this.tableName}`);
    } catch (error) {
      console.error(`Error batch updating ${this.tableName} records:`, error);
      throw error;
    }
  }

  // Clear table
  async clear(): Promise<void> {
    try {
      await database.clearTable(this.tableName);
      console.log(`Cleared all records from ${this.tableName}`);
    } catch (error) {
      console.error(`Error clearing ${this.tableName} table:`, error);
      throw error;
    }
  }

  // Add record to sync queue
  protected async addToSyncQueue(
    recordId: number,
    action: 'insert' | 'update' | 'delete',
    data: any,
    priority: number = 1
  ): Promise<void> {
    try {
      await database.executeSql(
        `INSERT INTO sync_queue (table_name, record_id, action, data, priority) VALUES (?, ?, ?, ?, ?)`,
        [this.tableName, recordId, action, JSON.stringify(data), priority]
      );
    } catch (error) {
      console.error('Error adding to sync queue:', error);
      // Don't throw - sync queue errors shouldn't break the main operation
    }
  }

  // Get records that need syncing
  async getUnsyncedRecords(limit: number = 50): Promise<T[]> {
    try {
      const [result] = await database.executeSql(
        `SELECT * FROM ${this.tableName} WHERE synced_at IS NULL OR updated_at > synced_at ORDER BY updated_at ASC LIMIT ?`,
        [limit]
      );

      const records: T[] = [];
      for (let i = 0; i < result.rows.length; i++) {
        records.push(result.rows.item(i) as T);
      }

      return records;
    } catch (error) {
      console.error(`Error getting unsynced ${this.tableName} records:`, error);
      throw error;
    }
  }

  // Mark record as synced
  async markAsSynced(id: number, serverId?: number): Promise<void> {
    try {
      const params = [new Date().toISOString(), id];
      let sql = `UPDATE ${this.tableName} SET synced_at = ?`;
      
      if (serverId !== undefined) {
        sql += `, server_id = ?`;
        params.splice(1, 0, serverId);
      }
      
      sql += ` WHERE id = ?`;
      
      await database.executeSql(sql, params);
    } catch (error) {
      console.error(`Error marking ${this.tableName} record as synced:`, error);
      throw error;
    }
  }
}

export default BaseModel;