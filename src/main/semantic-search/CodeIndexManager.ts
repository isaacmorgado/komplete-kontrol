/**
 * Code Index Manager
 * Main orchestrator for semantic code search
 * Adapted from: kilocode/src/services/code-index/manager.ts
 */

import { EventEmitter } from "events";
import path from "path";
import { createEmbedder, DEFAULT_EMBEDDER_MODELS } from "./embedders/registry";
import { SQLiteVectorStore } from "./vector-store/sqlite-vector";
import { CodeScanner } from "./processors/scanner";
import { IEmbedder } from "./embedders/base";
import {
  CodeIndexConfig,
  IndexingProgress,
  SearchResult,
  SearchOptions,
  CodeBlock,
  EmbeddedCodeBlock,
} from "./types";

export class CodeIndexManager extends EventEmitter {
  private embedder: IEmbedder;
  private vectorStore: SQLiteVectorStore;
  private scanner: CodeScanner;
  private config: CodeIndexConfig;
  private workspacePath: string;
  private isIndexing = false;

  constructor(workspacePath: string, config: Partial<CodeIndexConfig> = {}) {
    super();

    this.workspacePath = workspacePath;
    this.config = {
      embedder: {
        provider: "openai",
        model: "text-embedding-3-small",
        dimensions: 1536,
        ...config.embedder,
      },
      vectorStore: {
        type: "sqlite",
        path: path.join(workspacePath, ".komplete-kontrol", "embeddings.db"),
        ...config.vectorStore,
      },
      ignoredPatterns: ["**/node_modules/**", "**/dist/**", "**/.git/**"],
      maxFileSize: 1024 * 1024,
      batchSize: 100,
      ...config,
    };

    this.embedder = createEmbedder(this.config.embedder);
    this.vectorStore = new SQLiteVectorStore(
      this.config.vectorStore.path!,
      this.embedder,
      this.config.vectorStore
    );
    this.scanner = new CodeScanner({
      ignoredPatterns: this.config.ignoredPatterns,
      maxFileSize: this.config.maxFileSize,
    });
  }

  /**
   * Start indexing the workspace
   */
  async startIndexing(): Promise<void> {
    if (this.isIndexing) {
      throw new Error("Indexing already in progress");
    }

    this.isIndexing = true;

    try {
      this.emit("progress", {
        total: 0,
        processed: 0,
        failed: 0,
        status: "indexing" as const,
      });

      // Scan directory
      const blocks = await this.scanner.scanDirectory(this.workspacePath);

      this.emit("progress", {
        total: blocks.length,
        processed: 0,
        failed: 0,
        status: "indexing" as const,
      });

      // Process in batches
      let processed = 0;
      let failed = 0;

      for (let i = 0; i < blocks.length; i += this.config.batchSize) {
        const batch = blocks.slice(i, i + this.config.batchSize);

        try {
          // Generate embeddings
          const texts = batch.map((b) => b.content);
          const response = await this.embedder.createEmbeddings(texts);

          // Create embedded blocks
          const embeddedBlocks: EmbeddedCodeBlock[] = batch.map((block, idx) => ({
            ...block,
            embedding: response.embeddings[idx],
          }));

          // Store in vector database
          await this.vectorStore.store(embeddedBlocks, this.workspacePath);

          processed += batch.length;

          this.emit("progress", {
            total: blocks.length,
            processed,
            failed,
            status: "indexing" as const,
            currentFile: batch[batch.length - 1].filePath,
          });
        } catch (error) {
          failed += batch.length;
          console.error("Failed to process batch:", error);
        }
      }

      this.emit("progress", {
        total: blocks.length,
        processed,
        failed,
        status: "completed" as const,
      });
    } finally {
      this.isIndexing = false;
    }
  }

  /**
   * Search for similar code
   */
  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    // Generate query embedding
    const response = await this.embedder.createEmbeddings([query]);
    const queryEmbedding = response.embeddings[0];

    // Search vector store
    return await this.vectorStore.search(queryEmbedding, this.workspacePath, options);
  }

  /**
   * Get indexing status
   */
  getStatus(): { isIndexing: boolean } {
    return {
      isIndexing: this.isIndexing,
    };
  }

  /**
   * Clear all embeddings
   */
  async clearIndex(): Promise<void> {
    await this.vectorStore.clearWorkspace(this.workspacePath);
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.vectorStore.close();
    this.removeAllListeners();
  }
}

// Singleton map per workspace
const managers = new Map<string, CodeIndexManager>();

export function getCodeIndexManager(
  workspacePath: string,
  config?: Partial<CodeIndexConfig>
): CodeIndexManager {
  let manager = managers.get(workspacePath);

  if (!manager) {
    manager = new CodeIndexManager(workspacePath, config);
    managers.set(workspacePath, manager);
  }

  return manager;
}
