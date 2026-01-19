/**
 * 4-Signal Reciprocal Rank Fusion (RRF) Memory System
 *
 * Implements hybrid search with 4 ranking signals:
 * 1. BM25 (lexical matching)
 * 2. Vector similarity (semantic matching)
 * 3. Recency (temporal decay)
 * 4. Importance (confidence/priority)
 *
 * Based on ARCHITECTURE-SYNTHESIS-ENHANCED.md Section: Advanced Memory Architecture
 */

import type { Message } from '../../types';
import { Logger, LoggerLike } from '../../utils/logger';

/**
 * Memory entry with metadata
 */
export interface MemoryEntry {
  id: string;
  content: string;
  embedding?: number[]; // 384-dim vector for semantic search
  timestamp: Date;
  importance: number; // 0.0-1.0 confidence/priority
  metadata?: Record<string, unknown>;
  tags?: string[];
}

/**
 * Search result with scores
 */
export interface SearchResult {
  entry: MemoryEntry;
  scores: {
    bm25: number;
    vector: number;
    recency: number;
    importance: number;
    combined: number;
  };
  rank: number;
}

/**
 * RRF configuration
 */
export interface RRFConfig {
  k: number; // RRF constant (default: 60)
  weights?: {
    bm25?: number;
    vector?: number;
    recency?: number;
    importance?: number;
  };
  recencyDecayFactor?: number; // Default: 0.1
}

/**
 * BM25 parameters
 */
interface BM25Params {
  k1: number; // term frequency saturation (default: 1.5)
  b: number; // length normalization (default: 0.75)
}

/**
 * 4-Signal RRF Memory System
 *
 * Provides hybrid search with multiple ranking signals combined using
 * Reciprocal Rank Fusion for optimal retrieval accuracy.
 */
export class RRFMemory {
  private logger: LoggerLike;
  private entries: Map<string, MemoryEntry>;
  private config: Required<RRFConfig>;
  private bm25Params: BM25Params;

  // BM25 document stats
  private avgDocLength: number = 0;
  private termDocFreq: Map<string, number> = new Map();
  private termFreqInDoc: Map<string, Map<string, number>> = new Map();

  constructor(config: Partial<RRFConfig> = {}, logger?: LoggerLike) {
    this.logger = logger ?? new Logger().child('RRFMemory');
    this.entries = new Map();

    this.config = {
      k: config.k ?? 60,
      weights: {
        bm25: config.weights?.bm25 ?? 1.0,
        vector: config.weights?.vector ?? 1.0,
        recency: config.weights?.recency ?? 1.0,
        importance: config.weights?.importance ?? 1.0,
      },
      recencyDecayFactor: config.recencyDecayFactor ?? 0.1,
    };

    this.bm25Params = {
      k1: 1.5,
      b: 0.75,
    };

    this.logger.debug('RRF Memory initialized', { config: this.config });
  }

  /**
   * Add entry to memory
   */
  async addEntry(entry: Omit<MemoryEntry, 'id'>): Promise<string> {
    const id = this.generateId();
    const fullEntry: MemoryEntry = {
      id,
      ...entry,
    };

    this.entries.set(id, fullEntry);

    // Update BM25 stats
    this.updateBM25Stats(id, entry.content);

    // Generate embedding if not provided
    if (!fullEntry.embedding) {
      fullEntry.embedding = await this.generateEmbedding(entry.content);
    }

    this.logger.debug('Memory entry added', { id, contentLength: entry.content.length });

    return id;
  }

  /**
   * Update existing entry
   */
  async updateEntry(id: string, updates: Partial<Omit<MemoryEntry, 'id'>>): Promise<void> {
    const entry = this.entries.get(id);
    if (!entry) {
      throw new Error(`Entry not found: ${id}`);
    }

    // Update entry
    Object.assign(entry, updates);

    // Regenerate embedding if content changed
    if (updates.content) {
      entry.embedding = await this.generateEmbedding(updates.content);
      this.updateBM25Stats(id, updates.content);
    }

    this.logger.debug('Memory entry updated', { id });
  }

  /**
   * Remove entry from memory
   */
  removeEntry(id: string): boolean {
    const removed = this.entries.delete(id);
    if (removed) {
      this.removeBM25Stats(id);
      this.logger.debug('Memory entry removed', { id });
    }
    return removed;
  }

  /**
   * Get entry by ID
   */
  getEntry(id: string): MemoryEntry | undefined {
    return this.entries.get(id);
  }

  /**
   * Search with 4-signal RRF
   */
  async search(query: string, limit: number = 10): Promise<SearchResult[]> {
    const queryEmbedding = await this.generateEmbedding(query);
    const queryTerms = this.tokenize(query);

    const results: SearchResult[] = [];

    // Compute individual signal scores
    for (const entry of this.entries.values()) {
      const bm25Score = this.computeBM25Score(queryTerms, entry.id, entry.content);
      const vectorScore = this.computeVectorSimilarity(queryEmbedding, entry.embedding ?? []);
      const recencyScore = this.computeRecencyScore(entry.timestamp);
      const importanceScore = entry.importance;

      results.push({
        entry,
        scores: {
          bm25: bm25Score,
          vector: vectorScore,
          recency: recencyScore,
          importance: importanceScore,
          combined: 0, // Will be computed in RRF
        },
        rank: 0,
      });
    }

    // Apply RRF
    const rankedResults = this.applyRRF(results, limit);

    this.logger.debug('Search completed', {
      query,
      resultCount: rankedResults.length,
      limit,
    });

    return rankedResults;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries.clear();
    this.termDocFreq.clear();
    this.termFreqInDoc.clear();
    this.avgDocLength = 0;
    this.logger.debug('Memory cleared');
  }

  /**
   * Get memory stats
   */
  getStats(): {
    entryCount: number;
    avgDocLength: number;
    vocabularySize: number;
  } {
    return {
      entryCount: this.entries.size,
      avgDocLength: this.avgDocLength,
      vocabularySize: this.termDocFreq.size,
    };
  }

  /**
   * Export entries
   */
  exportEntries(): MemoryEntry[] {
    return Array.from(this.entries.values());
  }

  /**
   * Import entries
   */
  async importEntries(entries: MemoryEntry[]): Promise<void> {
    this.clear();

    for (const entry of entries) {
      this.entries.set(entry.id, entry);
      this.updateBM25Stats(entry.id, entry.content);

      if (!entry.embedding) {
        entry.embedding = await this.generateEmbedding(entry.content);
      }
    }

    this.logger.info('Entries imported', { count: entries.length });
  }

  /**
   * Apply Reciprocal Rank Fusion
   */
  private applyRRF(results: SearchResult[], limit: number): SearchResult[] {
    const { k, weights } = this.config;

    // Rank by each signal
    const bm25Ranked = [...results].sort((a, b) => b.scores.bm25 - a.scores.bm25);
    const vectorRanked = [...results].sort((a, b) => b.scores.vector - a.scores.vector);
    const recencyRanked = [...results].sort((a, b) => b.scores.recency - a.scores.recency);
    const importanceRanked = [...results].sort((a, b) => b.scores.importance - a.scores.importance);

    // Compute RRF scores
    const rrfScores = new Map<string, number>();

    for (let i = 0; i < results.length; i++) {
      const id = results[i].entry.id;
      let combinedScore = 0;

      // BM25 contribution
      const bm25Rank = bm25Ranked.findIndex(r => r.entry.id === id);
      combinedScore += (weights.bm25 ?? 1.0) * (1 / (bm25Rank + k));

      // Vector contribution
      const vectorRank = vectorRanked.findIndex(r => r.entry.id === id);
      combinedScore += (weights.vector ?? 1.0) * (1 / (vectorRank + k));

      // Recency contribution
      const recencyRank = recencyRanked.findIndex(r => r.entry.id === id);
      combinedScore += (weights.recency ?? 1.0) * (1 / (recencyRank + k));

      // Importance contribution
      const importanceRank = importanceRanked.findIndex(r => r.entry.id === id);
      combinedScore += (weights.importance ?? 1.0) * (1 / (importanceRank + k));

      rrfScores.set(id, combinedScore);
      results[i].scores.combined = combinedScore;
    }

    // Sort by combined RRF score
    const sorted = results.sort((a, b) => {
      const scoreA = rrfScores.get(a.entry.id) ?? 0;
      const scoreB = rrfScores.get(b.entry.id) ?? 0;
      return scoreB - scoreA;
    });

    // Assign ranks
    for (let i = 0; i < sorted.length; i++) {
      sorted[i].rank = i + 1;
    }

    return sorted.slice(0, limit);
  }

  /**
   * Compute BM25 score
   */
  private computeBM25Score(queryTerms: string[], docId: string, content: string): number {
    const { k1, b } = this.bm25Params;
    const docTerms = this.tokenize(content);
    const docLength = docTerms.length;
    const N = this.entries.size;

    let score = 0;

    for (const term of queryTerms) {
      const df = this.termDocFreq.get(term) ?? 0;
      if (df === 0) continue;

      const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);

      const termFreq = this.termFreqInDoc.get(docId)?.get(term) ?? 0;
      const numerator = termFreq * (k1 + 1);
      const denominator = termFreq + k1 * (1 - b + b * (docLength / this.avgDocLength));

      score += idf * (numerator / denominator);
    }

    return score;
  }

  /**
   * Compute vector similarity (cosine)
   */
  private computeVectorSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length === 0 || vec2.length === 0) return 0;
    if (vec1.length !== vec2.length) return 0;

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Compute recency score with temporal decay
   */
  private computeRecencyScore(timestamp: Date): number {
    const now = new Date();
    const daysAgo = (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60 * 24);
    return 1 / (1 + this.config.recencyDecayFactor * daysAgo);
  }

  /**
   * Update BM25 statistics
   */
  private updateBM25Stats(docId: string, content: string): void {
    const terms = this.tokenize(content);
    const termCounts = new Map<string, number>();

    // Count term frequencies in document
    for (const term of terms) {
      termCounts.set(term, (termCounts.get(term) ?? 0) + 1);

      // Update document frequency
      const currentDf = this.termDocFreq.get(term) ?? 0;
      this.termDocFreq.set(term, currentDf + 1);
    }

    this.termFreqInDoc.set(docId, termCounts);

    // Update average document length
    const totalLength = Array.from(this.termFreqInDoc.values())
      .reduce((sum, counts) => sum + Array.from(counts.values()).reduce((a, b) => a + b, 0), 0);
    this.avgDocLength = this.termFreqInDoc.size > 0 ? totalLength / this.termFreqInDoc.size : 0;
  }

  /**
   * Remove BM25 statistics for deleted document
   */
  private removeBM25Stats(docId: string): void {
    const termCounts = this.termFreqInDoc.get(docId);
    if (!termCounts) return;

    // Decrease document frequencies
    for (const term of termCounts.keys()) {
      const currentDf = this.termDocFreq.get(term) ?? 0;
      if (currentDf > 1) {
        this.termDocFreq.set(term, currentDf - 1);
      } else {
        this.termDocFreq.delete(term);
      }
    }

    this.termFreqInDoc.delete(docId);

    // Recalculate average document length
    const totalLength = Array.from(this.termFreqInDoc.values())
      .reduce((sum, counts) => sum + Array.from(counts.values()).reduce((a, b) => a + b, 0), 0);
    this.avgDocLength = this.termFreqInDoc.size > 0 ? totalLength / this.termFreqInDoc.size : 0;
  }

  /**
   * Tokenize text
   */
  private tokenize(text: string): string[] {
    // Simple tokenization: lowercase, split on non-alphanumeric, filter empty
    return text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(token => token.length > 0);
  }

  /**
   * Generate embedding (placeholder - would use actual model)
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    // Placeholder: In production, would use all-MiniLM-L6-v2 or similar
    // For now, generate random 384-dim vector
    const dim = 384;
    const embedding = new Array(dim).fill(0).map(() => Math.random() - 0.5);

    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / norm);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Global RRF memory instance
 */
let globalRRFMemory: RRFMemory | null = null;

/**
 * Initialize global RRF memory
 */
export function initRRFMemory(config?: Partial<RRFConfig>, logger?: LoggerLike): RRFMemory {
  globalRRFMemory = new RRFMemory(config, logger);
  return globalRRFMemory;
}

/**
 * Get global RRF memory
 */
export function getRRFMemory(): RRFMemory {
  if (!globalRRFMemory) {
    globalRRFMemory = new RRFMemory();
  }
  return globalRRFMemory;
}
