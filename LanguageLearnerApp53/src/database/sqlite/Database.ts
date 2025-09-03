// src/database/sqlite/Database.ts
// SQLite 데이터베이스 설정 및 관리

import SQLite, { SQLiteDatabase, SQLError } from 'react-native-sqlite-storage';

// Database configuration
const DATABASE_NAME = 'LanguageLearner.db';
const DATABASE_VERSION = '1.0';
const DATABASE_DISPLAY_NAME = 'Language Learner Local Database';
const DATABASE_SIZE = 10 * 1024 * 1024; // 10MB

// Enable debugging for development
if (__DEV__) {
  SQLite.DEBUG(true);
  SQLite.enablePromise(true);
}

export interface DatabaseConfig {
  name: string;
  version: string;
  displayName: string;
  size: number;
}

export class Database {
  private static instance: Database;
  private db: SQLiteDatabase | null = null;
  private isInitialized: boolean = false;

  private constructor() {}

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  // Initialize database connection
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('Initializing SQLite database...');
      
      this.db = await SQLite.openDatabase({
        name: DATABASE_NAME,
        version: DATABASE_VERSION,
        displayName: DATABASE_DISPLAY_NAME,
        size: DATABASE_SIZE,
        location: 'default',
      });

      console.log('Database opened successfully');
      
      // Run migrations
      await this.runMigrations();
      
      this.isInitialized = true;
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw new Error(`Database initialization failed: ${error}`);
    }
  }

  // Get database instance
  public getDatabase(): SQLiteDatabase {
    if (!this.db || !this.isInitialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  // Close database connection
  public async close(): Promise<void> {
    if (this.db) {
      try {
        await this.db.close();
        console.log('Database closed successfully');
      } catch (error) {
        console.error('Error closing database:', error);
      } finally {
        this.db = null;
        this.isInitialized = false;
      }
    }
  }

  // Execute SQL query
  public async executeSql(
    sql: string,
    params: any[] = []
  ): Promise<[any]> {
    const db = this.getDatabase();
    
    try {
      console.log(`Executing SQL: ${sql}`, params);
      const result = await db.executeSql(sql, params);
      return result;
    } catch (error) {
      console.error('SQL execution error:', error);
      console.error('SQL:', sql);
      console.error('Params:', params);
      throw error;
    }
  }

  // Execute multiple SQL statements in transaction
  public async transaction(
    queries: Array<{ sql: string; params?: any[] }>
  ): Promise<any[]> {
    const db = this.getDatabase();
    
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      
      db.transaction(
        (tx) => {
          queries.forEach(({ sql, params = [] }, index) => {
            tx.executeSql(
              sql,
              params,
              (_, result) => {
                results[index] = result;
                if (results.length === queries.length) {
                  resolve(results);
                }
              },
              (_, error) => {
                console.error(`Transaction error at query ${index}:`, error);
                console.error('SQL:', sql);
                console.error('Params:', params);
                return true; // Rollback transaction
              }
            );
          });
        },
        (error) => {
          console.error('Transaction failed:', error);
          reject(error);
        }
      );
    });
  }

  // Check if table exists
  public async tableExists(tableName: string): Promise<boolean> {
    try {
      const [result] = await this.executeSql(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
        [tableName]
      );
      return result.rows.length > 0;
    } catch (error) {
      console.error(`Error checking if table ${tableName} exists:`, error);
      return false;
    }
  }

  // Get table schema
  public async getTableSchema(tableName: string): Promise<any[]> {
    try {
      const [result] = await this.executeSql(`PRAGMA table_info(${tableName})`);
      return result.rows.raw();
    } catch (error) {
      console.error(`Error getting schema for table ${tableName}:`, error);
      throw error;
    }
  }

  // Drop table
  public async dropTable(tableName: string): Promise<void> {
    try {
      await this.executeSql(`DROP TABLE IF EXISTS ${tableName}`);
      console.log(`Table ${tableName} dropped successfully`);
    } catch (error) {
      console.error(`Error dropping table ${tableName}:`, error);
      throw error;
    }
  }

  // Clear all data from table
  public async clearTable(tableName: string): Promise<void> {
    try {
      await this.executeSql(`DELETE FROM ${tableName}`);
      console.log(`Table ${tableName} cleared successfully`);
    } catch (error) {
      console.error(`Error clearing table ${tableName}:`, error);
      throw error;
    }
  }

  // Get database info
  public async getDatabaseInfo(): Promise<{
    name: string;
    version: string;
    size: number;
    tables: string[];
  }> {
    try {
      const [result] = await this.executeSql(
        `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
      );
      
      const tables = result.rows.raw().map((row: any) => row.name);
      
      return {
        name: DATABASE_NAME,
        version: DATABASE_VERSION,
        size: DATABASE_SIZE,
        tables,
      };
    } catch (error) {
      console.error('Error getting database info:', error);
      throw error;
    }
  }

  // Run database migrations
  private async runMigrations(): Promise<void> {
    console.log('Running database migrations...');
    
    try {
      // Create migrations table if it doesn't exist
      await this.executeSql(`
        CREATE TABLE IF NOT EXISTS migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Get list of executed migrations
      const [result] = await this.executeSql(
        'SELECT name FROM migrations ORDER BY id'
      );
      
      const executedMigrations = result.rows.raw().map((row: any) => row.name);
      
      // Run pending migrations
      const migrations = await this.getMigrations();
      
      for (const migration of migrations) {
        if (!executedMigrations.includes(migration.name)) {
          console.log(`Running migration: ${migration.name}`);
          
          await this.transaction([
            ...migration.queries,
            {
              sql: 'INSERT INTO migrations (name) VALUES (?)',
              params: [migration.name],
            },
          ]);
          
          console.log(`Migration ${migration.name} completed`);
        }
      }
      
      console.log('All migrations completed successfully');
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }

  // Get list of migrations
  private async getMigrations(): Promise<Array<{
    name: string;
    queries: Array<{ sql: string; params?: any[] }>;
  }>> {
    return [
      {
        name: '001_create_vocab_tables',
        queries: [
          {
            sql: `
              CREATE TABLE IF NOT EXISTS vocabularies (
                id INTEGER PRIMARY KEY,
                server_id INTEGER UNIQUE,
                lemma TEXT NOT NULL,
                pos TEXT,
                definition TEXT,
                example TEXT,
                pronunciation TEXT,
                pronunciation_ko TEXT,
                difficulty INTEGER DEFAULT 1,
                source TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                synced_at DATETIME,
                is_deleted INTEGER DEFAULT 0
              )
            `,
          },
          {
            sql: `
              CREATE INDEX IF NOT EXISTS idx_vocabularies_lemma 
              ON vocabularies(lemma)
            `,
          },
          {
            sql: `
              CREATE INDEX IF NOT EXISTS idx_vocabularies_server_id 
              ON vocabularies(server_id)
            `,
          },
        ],
      },
      {
        name: '002_create_cards_tables',
        queries: [
          {
            sql: `
              CREATE TABLE IF NOT EXISTS cards (
                id INTEGER PRIMARY KEY,
                server_id INTEGER UNIQUE,
                vocab_id INTEGER NOT NULL,
                user_id INTEGER,
                stage INTEGER DEFAULT 0,
                is_mastered INTEGER DEFAULT 0,
                master_cycles INTEGER DEFAULT 0,
                correct_total INTEGER DEFAULT 0,
                wrong_total INTEGER DEFAULT 0,
                last_review_at DATETIME,
                next_review_at DATETIME,
                waiting_until DATETIME,
                frozen_until DATETIME,
                is_overdue INTEGER DEFAULT 0,
                overdue_deadline DATETIME,
                is_from_wrong_answer INTEGER DEFAULT 0,
                mastered_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                synced_at DATETIME,
                is_deleted INTEGER DEFAULT 0,
                FOREIGN KEY (vocab_id) REFERENCES vocabularies (id)
              )
            `,
          },
          {
            sql: `
              CREATE INDEX IF NOT EXISTS idx_cards_vocab_id 
              ON cards(vocab_id)
            `,
          },
          {
            sql: `
              CREATE INDEX IF NOT EXISTS idx_cards_server_id 
              ON cards(server_id)
            `,
          },
          {
            sql: `
              CREATE INDEX IF NOT EXISTS idx_cards_next_review 
              ON cards(next_review_at)
            `,
          },
        ],
      },
      {
        name: '003_create_quiz_tables',
        queries: [
          {
            sql: `
              CREATE TABLE IF NOT EXISTS quiz_sessions (
                id INTEGER PRIMARY KEY,
                server_id INTEGER UNIQUE,
                user_id INTEGER,
                folder_id TEXT,
                type TEXT NOT NULL, -- 'srs', 'review', 'practice'
                total_questions INTEGER NOT NULL,
                correct_answers INTEGER DEFAULT 0,
                wrong_answers INTEGER DEFAULT 0,
                score REAL DEFAULT 0,
                time_spent INTEGER DEFAULT 0, -- in seconds
                started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                completed_at DATETIME,
                synced_at DATETIME,
                is_deleted INTEGER DEFAULT 0
              )
            `,
          },
          {
            sql: `
              CREATE TABLE IF NOT EXISTS quiz_answers (
                id INTEGER PRIMARY KEY,
                server_id INTEGER UNIQUE,
                session_id INTEGER NOT NULL,
                card_id INTEGER NOT NULL,
                vocab_id INTEGER NOT NULL,
                question TEXT NOT NULL,
                user_answer TEXT,
                correct_answer TEXT NOT NULL,
                is_correct INTEGER NOT NULL,
                time_taken INTEGER DEFAULT 0, -- in seconds
                answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                synced_at DATETIME,
                is_deleted INTEGER DEFAULT 0,
                FOREIGN KEY (session_id) REFERENCES quiz_sessions (id),
                FOREIGN KEY (card_id) REFERENCES cards (id),
                FOREIGN KEY (vocab_id) REFERENCES vocabularies (id)
              )
            `,
          },
          {
            sql: `
              CREATE INDEX IF NOT EXISTS idx_quiz_answers_session_id 
              ON quiz_answers(session_id)
            `,
          },
        ],
      },
      {
        name: '004_create_sync_tables',
        queries: [
          {
            sql: `
              CREATE TABLE IF NOT EXISTS sync_queue (
                id INTEGER PRIMARY KEY,
                table_name TEXT NOT NULL,
                record_id INTEGER NOT NULL,
                action TEXT NOT NULL, -- 'insert', 'update', 'delete'
                data TEXT, -- JSON data
                priority INTEGER DEFAULT 1, -- 1=low, 2=medium, 3=high
                retry_count INTEGER DEFAULT 0,
                max_retries INTEGER DEFAULT 3,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                error_message TEXT
              )
            `,
          },
          {
            sql: `
              CREATE INDEX IF NOT EXISTS idx_sync_queue_priority 
              ON sync_queue(priority DESC, created_at ASC)
            `,
          },
          {
            sql: `
              CREATE TABLE IF NOT EXISTS sync_log (
                id INTEGER PRIMARY KEY,
                action TEXT NOT NULL,
                table_name TEXT,
                record_count INTEGER DEFAULT 0,
                status TEXT NOT NULL, -- 'success', 'error', 'partial'
                started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                completed_at DATETIME,
                error_message TEXT
              )
            `,
          },
        ],
      },
    ];
  }
}

// Export singleton instance
export const database = Database.getInstance();
export default database;