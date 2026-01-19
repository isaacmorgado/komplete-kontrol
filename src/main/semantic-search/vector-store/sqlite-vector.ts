/**
 * Simple SQLite Vector Store
 * Uses in-memory cosine similarity for vector search (can be upgraded to sqlite-vec later)
 */

import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import { CodeBlock, EmbeddedCodeBlock, SearchResult, SearchOptions, VectorStoreConfig } from "../types";
import { IEmbedder } from "../embedders/base";

export class SQLiteVectorStore {
  private db: Database.Database;
  private embedder: IEmbedder;
  private config: VectorStoreConfig;

  constructor(dbPath: string, embedder: IEmbedder, config: VectorStoreConfig) {
    this.db = new Database(dbPath);
    this.embedder = embedder;
    this.config = config;
    this.initialize();
  }

  private initialize(): void {
    // Create embeddings table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS code_embeddings (
        id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL,
        workspace_path TEXT NOT NULL,
        embedding BLOB NOT NULL,
        chunk_text TEXT NOT NULL,
        start_line INTEGER,
        end_line INTEGER,
        language TEXT,
        hash TEXT,
        indexed_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      CREATE INDEX IF NOT EXISTS idx_embeddings_file
        ON code_embeddings(file_path);

      CREATE INDEX IF NOT EXISTS idx_embeddings_workspace
        ON code_embeddings(workspace_path);

      CREATE INDEX IF NOT EXISTS idx_embeddings_hash
        ON code_embeddings(hash);
    `);
  }

  /**
   * Store embedded code blocks
   */
  async store(blocks: EmbeddedCodeBlock[], workspacePath: string): Promise<void> {
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO code_embeddings
      (id, file_path, workspace_path, embedding, chunk_text, start_line, end_line, language, hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((blocks: EmbeddedCodeBlock[]) => {
      for (const block of blocks) {
        const id = uuidv4();
        const embeddingBuffer = Buffer.from(block.embedding.buffer);
        insert.run(
          id,
          block.filePath,
          workspacePath,
          embeddingBuffer,
          block.content,
          block.startLine,
          block.endLine,
          block.language,
          block.hash
        );
      }
    });

    insertMany(blocks);
  }

  /**
   * Search for similar code using in-memory cosine similarity
   * Note: This is a simple implementation. For production use with large datasets,
   * consider using sqlite-vec extension for better performance.
   */
  async search(
    queryEmbedding: Float32Array,
    workspacePath: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const { maxResults = 10, minScore = 0.7 } = options;

    // Get all embeddings for the workspace
    const rows = this.db.prepare(`
      SELECT id, file_path, chunk_text, start_line, end_line, language, embedding
      FROM code_embeddings
      WHERE workspace_path = ?
    `).all(workspacePath) as Array<{
      id: string;
      file_path: string;
      chunk_text: string;
      start_line: number;
      end_line: number;
      language: string;
      embedding: Buffer;
    }>;

    // Calculate cosine similarity in-memory
    const results: Array<{ filePath: string; chunkText: string; startLine: number; endLine: number; score: number; language: string }> = [];

    for (const row of rows) {
      const storedEmbedding = new Float32Array(row.embedding.buffer);
      const score = this.cosineSimilarity(queryEmbedding, storedEmbedding);

      if (score >= minScore) {
        results.push({
          filePath: row.file_path,
          chunkText: row.chunk_text,
          startLine: row.start_line,
          endLine: row.end_line,
          score,
          language: row.language,
        });
      }
    }

    // Sort by score and return top results
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) {
      return 0;
    }

    return dotProduct / denominator;
  }

  /**
   * Delete all embeddings for a file
   */
  async deleteFile(filePath: string): Promise<void> {
    this.db.prepare("DELETE FROM code_embeddings WHERE file_path = ?").run(filePath);
  }

  /**
   * Clear all embeddings for a workspace
   */
  async clearWorkspace(workspacePath: string): Promise<void> {
    this.db.prepare("DELETE FROM code_embeddings WHERE workspace_path = ?").run(workspacePath);
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }
}
