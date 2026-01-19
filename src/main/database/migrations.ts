/**
 * Database Migrations
 * Handles schema updates for new Kilocode features
 */

import Database from "better-sqlite3";
import path from "path";
import { app } from "electron";

export function runMigrations(): void {
  const userDataPath = app.getPath("userData");
  const dbPath = path.join(userDataPath, "maestro-re.db");

  const db = new Database(dbPath);

  // Get current version
  const currentVersion = db.pragma("user_version", { simple: true }) as number;

  console.log(`Current database version: ${currentVersion}`);

  // Run migrations
  if (currentVersion < 2) {
    migrateToV2(db);
  }

  if (currentVersion < 3) {
    migrateToV3(db);
  }

  console.log("Database migrations complete");
  db.close();
}

/**
 * Version 2: Add skills tables
 */
function migrateToV2(db: Database.Database): void {
  console.log("Running migration to v2 (skills support)");

  db.exec(`
    -- Skills cache table (optional, skills are file-based)
    CREATE TABLE IF NOT EXISTS skills_cache (
      name TEXT PRIMARY KEY,
      description TEXT,
      path TEXT,
      source TEXT,
      mode TEXT,
      updated_at INTEGER
    );
  `);

  db.pragma("user_version = 2");
}

/**
 * Version 3: Add semantic search tables
 */
function migrateToV3(db: Database.Database): void {
  console.log("Running migration to v3 (semantic search)");

  // Note: Vector tables are created separately in SQLiteVectorStore
  // This just adds configuration tables

  db.exec(`
    -- Embedding configuration
    CREATE TABLE IF NOT EXISTS embedding_config (
      workspace_path TEXT PRIMARY KEY,
      embedder_provider TEXT,
      model TEXT,
      dimensions INTEGER,
      updated_at INTEGER
    );

    -- Indexing status
    CREATE TABLE IF NOT EXISTS indexing_status (
      workspace_path TEXT PRIMARY KEY,
      status TEXT,
      total_files INTEGER,
      processed_files INTEGER,
      started_at INTEGER,
      completed_at INTEGER
    );

    -- Memory bank for context management
    CREATE TABLE IF NOT EXISTS memory_bank (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      workspace_path TEXT NOT NULL,
      memory_type TEXT NOT NULL,
      content TEXT NOT NULL,
      tokens_saved INTEGER NOT NULL,
      relevance_score REAL DEFAULT 1.0,
      access_count INTEGER DEFAULT 0,
      last_accessed INTEGER,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_memory_session
      ON memory_bank(session_id);

    CREATE INDEX IF NOT EXISTS idx_memory_workspace
      ON memory_bank(workspace_path);

    CREATE INDEX IF NOT EXISTS idx_memory_type
      ON memory_bank(memory_type);

    CREATE INDEX IF NOT EXISTS idx_memory_created
      ON memory_bank(created_at);
  `);

  db.pragma("user_version = 3");
}

export { migrateToV2, migrateToV3 };
