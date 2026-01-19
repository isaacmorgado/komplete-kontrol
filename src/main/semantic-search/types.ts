/**
 * Semantic Search Type Definitions
 * Adapted from: kilocode/src/services/code-index/interfaces/
 */

export interface CodeBlock {
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  language: string;
  hash: string; // SHA-256 for deduplication
}

export interface EmbeddedCodeBlock extends CodeBlock {
  embedding: Float32Array;
}

export interface SearchResult {
  filePath: string;
  chunkText: string;
  startLine: number;
  endLine: number;
  score: number;
  language: string;
}

export interface EmbedderConfig {
  provider: "openai" | "ollama" | "gemini";
  model: string;
  dimensions: number;
  apiKey?: string;
  baseUrl?: string;
}

export interface VectorStoreConfig {
  type: "sqlite" | "lancedb";
  path?: string; // For SQLite
  uri?: string; // For LanceDB
}

export interface SearchOptions {
  maxResults?: number;
  minScore?: number;
  directoryFilter?: string[];
}

export interface IndexingProgress {
  total: number;
  processed: number;
  failed: number;
  currentFile?: string;
  status: "idle" | "indexing" | "completed" | "error";
  error?: string;
}

export interface CodeIndexConfig {
  embedder: EmbedderConfig;
  vectorStore: VectorStoreConfig;
  ignoredPatterns: string[];
  maxFileSize: number;
  batchSize: number;
}
