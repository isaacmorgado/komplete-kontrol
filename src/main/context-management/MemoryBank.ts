/**
 * Memory Bank
 * Persistent context storage and retrieval
 * Adapted from: kilocode memory bank documentation
 */

import Database from "better-sqlite3";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { MemoryEntry, RetrieveOptions } from "./types";

export class MemoryBank {
  private db: Database.Database;

  constructor(workspacePath: string) {
    const dbPath = path.join(workspacePath, ".komplete-kontrol", "memory.db");
    this.db = new Database(dbPath);
    this.initialize();
  }

  private initialize(): void {
    this.db.exec(`
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
  }

  /**
   * Store a memory entry
   */
  store(entry: Omit<MemoryEntry, "id" | "createdAt">): MemoryEntry {
    const id = uuidv4();
    const now = Math.floor(Date.now() / 1000);

    const memoryEntry: MemoryEntry = {
      id,
      createdAt: now,
      ...entry,
    };

    this.db.prepare(`
      INSERT INTO memory_bank
      (id, session_id, workspace_path, memory_type, content, tokens_saved, relevance_score)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      memoryEntry.id,
      memoryEntry.sessionId,
      memoryEntry.workspacePath,
      memoryEntry.memoryType,
      memoryEntry.content,
      memoryEntry.tokensSaved,
      memoryEntry.relevanceScore
    );

    return memoryEntry;
  }

  /**
   * Retrieve relevant memories
   */
  retrieve(options: RetrieveOptions): MemoryEntry[] {
    const { workspacePath, maxTokens } = options;

    // Simple keyword-based retrieval (can be enhanced with semantic search)
    const results = this.db.prepare(`
      SELECT * FROM memory_bank
      WHERE workspace_path = ?
      ORDER BY
        relevance_score DESC,
        last_accessed DESC
      LIMIT ?
    `).all(workspacePath, 10) as MemoryEntry[];

    // Update access count and timestamp
    for (const result of results) {
      this.db.prepare(`
        UPDATE memory_bank
        SET access_count = access_count + 1,
            last_accessed = strftime('%s', 'now')
        WHERE id = ?
      `).run(result.id);
    }

    return results;
  }

  /**
   * Get memories by session
   */
  getBySession(sessionId: string): MemoryEntry[] {
    return this.db.prepare(`
      SELECT * FROM memory_bank
      WHERE session_id = ?
      ORDER BY created_at DESC
    `).all(sessionId) as MemoryEntry[];
  }

  /**
   * Delete old memories
   */
  cleanup(olderThanDays: number = 30): number {
    const cutoff = Math.floor(Date.now() / 1000) - (olderThanDays * 24 * 60 * 60);

    const result = this.db.prepare(`
      DELETE FROM memory_bank
      WHERE created_at < ?
    `).run(cutoff);

    return result.changes;
  }

  /**
   * Close the database
   */
  close(): void {
    this.db.close();
  }
}
