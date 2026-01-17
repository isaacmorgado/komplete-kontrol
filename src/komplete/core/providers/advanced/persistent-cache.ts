/**
 * Persistent Cache for KOMPLETE-KONTROL CLI
 *
 * Provides SQLite-backed persistent caching for LLM responses.
 * Extends the in-memory ResponseCache with persistence layer.
 */

import { Database } from 'bun:sqlite';
import { Logger, LoggerLike } from '../../../utils/logger';
import type { CompletionResult, Message } from '../../../types';
import { createHash } from 'crypto';

/**
 * Persistent cache configuration
 */
export interface PersistentCacheConfig {
  /**
   * Path to SQLite database file
   */
  dbPath: string;

  /**
   * Default TTL in milliseconds
   */
  ttlMs: number;

  /**
   * Maximum cache entries
   */
  maxEntries: number;

  /**
   * Enable compression for stored content
   */
  enableCompression: boolean;

  /**
   * Cleanup interval in milliseconds
   */
  cleanupIntervalMs: number;

  /**
   * Enable L1 memory cache
   */
  enableMemoryCache: boolean;

  /**
   * Memory cache max size
   */
  memoryCacheMaxSize: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: PersistentCacheConfig = {
  dbPath: '.komplete-cache.db',
  ttlMs: 1000 * 60 * 60, // 1 hour
  maxEntries: 10000,
  enableCompression: false,
  cleanupIntervalMs: 1000 * 60 * 5, // 5 minutes
  enableMemoryCache: true,
  memoryCacheMaxSize: 500,
};

/**
 * Cache entry structure
 */
export interface PersistentCacheEntry {
  /**
   * Cache key (hash)
   */
  key: string;

  /**
   * Provider used
   */
  provider: string;

  /**
   * Model used
   */
  model: string;

  /**
   * Cached result (JSON)
   */
  result: string;

  /**
   * Creation timestamp
   */
  createdAt: number;

  /**
   * Expiration timestamp
   */
  expiresAt: number;

  /**
   * Hit count
   */
  hitCount: number;

  /**
   * Last accessed timestamp
   */
  lastAccessedAt: number;

  /**
   * Size in bytes
   */
  sizeBytes: number;
}

/**
 * Cache statistics
 */
export interface PersistentCacheStats {
  /**
   * Total entries
   */
  totalEntries: number;

  /**
   * Total size in bytes
   */
  totalSizeBytes: number;

  /**
   * Cache hits
   */
  hits: number;

  /**
   * Cache misses
   */
  misses: number;

  /**
   * Hit rate (0-1)
   */
  hitRate: number;

  /**
   * Expired entries
   */
  expiredEntries: number;

  /**
   * Memory cache stats (if enabled)
   */
  memoryCache?: {
    entries: number;
    maxSize: number;
  };
}

/**
 * Persistent Response Cache
 *
 * SQLite-backed cache with optional L1 memory cache.
 */
export class PersistentResponseCache {
  private logger: LoggerLike;
  private config: PersistentCacheConfig;
  private db: Database;
  private memoryCache: Map<string, { result: CompletionResult; expiresAt: number }> = new Map();
  private hits: number = 0;
  private misses: number = 0;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<PersistentCacheConfig> = {}, logger?: LoggerLike) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = logger?.child('PersistentResponseCache') ?? new Logger().child('PersistentResponseCache');

    // Initialize database
    this.db = new Database(this.config.dbPath);
    this.initializeDatabase();

    // Start cleanup interval
    this.startCleanupInterval();

    this.logger.info('PersistentResponseCache initialized', 'PersistentResponseCache', {
      dbPath: this.config.dbPath,
      maxEntries: this.config.maxEntries,
    });
  }

  /**
   * Initialize database schema
   */
  private initializeDatabase(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        result TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        hit_count INTEGER DEFAULT 0,
        last_accessed_at INTEGER NOT NULL,
        size_bytes INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_expires_at ON cache(expires_at);
      CREATE INDEX IF NOT EXISTS idx_provider_model ON cache(provider, model);
      CREATE INDEX IF NOT EXISTS idx_last_accessed ON cache(last_accessed_at);
    `);
  }

  /**
   * Start cleanup interval
   */
  private startCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupIntervalMs);
  }

  /**
   * Generate cache key from messages and options
   */
  generateKey(
    provider: string,
    model: string,
    messages: Message[],
    options?: Record<string, unknown>
  ): string {
    const content = JSON.stringify({
      provider,
      model,
      messages,
      options,
    });

    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get cached result
   */
  get(key: string): CompletionResult | undefined {
    // Check memory cache first
    if (this.config.enableMemoryCache) {
      const memEntry = this.memoryCache.get(key);
      if (memEntry && memEntry.expiresAt > Date.now()) {
        this.hits++;
        return memEntry.result;
      }
      if (memEntry) {
        this.memoryCache.delete(key);
      }
    }

    // Check persistent cache
    const stmt = this.db.prepare(`
      SELECT result, expires_at FROM cache WHERE key = ? AND expires_at > ?
    `);

    const row = stmt.get(key, Date.now()) as { result: string; expires_at: number } | undefined;

    if (!row) {
      this.misses++;
      return undefined;
    }

    // Update hit count and last accessed
    const updateStmt = this.db.prepare(`
      UPDATE cache SET hit_count = hit_count + 1, last_accessed_at = ? WHERE key = ?
    `);
    updateStmt.run(Date.now(), key);

    this.hits++;

    const result = JSON.parse(row.result) as CompletionResult;

    // Add to memory cache
    if (this.config.enableMemoryCache) {
      this.addToMemoryCache(key, result, row.expires_at);
    }

    return result;
  }

  /**
   * Set cached result
   */
  set(
    key: string,
    provider: string,
    model: string,
    result: CompletionResult,
    ttlMs?: number
  ): void {
    const now = Date.now();
    const expiresAt = now + (ttlMs ?? this.config.ttlMs);
    const resultJson = JSON.stringify(result);
    const sizeBytes = Buffer.byteLength(resultJson, 'utf8');

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO cache (key, provider, model, result, created_at, expires_at, hit_count, last_accessed_at, size_bytes)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
    `);

    stmt.run(key, provider, model, resultJson, now, expiresAt, now, sizeBytes);

    // Add to memory cache
    if (this.config.enableMemoryCache) {
      this.addToMemoryCache(key, result, expiresAt);
    }

    // Check if we need to evict
    this.enforceMaxEntries();

    this.logger.debug('Cache entry set', 'PersistentResponseCache', {
      key: key.substring(0, 16) + '...',
      provider,
      model,
      sizeBytes,
    });
  }

  /**
   * Add to memory cache
   */
  private addToMemoryCache(key: string, result: CompletionResult, expiresAt: number): void {
    if (this.memoryCache.size >= this.config.memoryCacheMaxSize) {
      // Remove oldest entry
      const oldestKey = this.memoryCache.keys().next().value;
      if (oldestKey) {
        this.memoryCache.delete(oldestKey);
      }
    }

    this.memoryCache.set(key, { result, expiresAt });
  }

  /**
   * Enforce max entries limit
   */
  private enforceMaxEntries(): void {
    const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM cache');
    const { count } = countStmt.get() as { count: number };

    if (count > this.config.maxEntries) {
      // Delete oldest entries (LRU)
      const deleteCount = count - this.config.maxEntries + 100; // Buffer
      const deleteStmt = this.db.prepare(`
        DELETE FROM cache WHERE key IN (
          SELECT key FROM cache ORDER BY last_accessed_at ASC LIMIT ?
        )
      `);
      deleteStmt.run(deleteCount);

      this.logger.debug(`Evicted ${deleteCount} cache entries`, 'PersistentResponseCache');
    }
  }

  /**
   * Delete cached entry
   */
  delete(key: string): boolean {
    this.memoryCache.delete(key);

    const stmt = this.db.prepare('DELETE FROM cache WHERE key = ?');
    const result = stmt.run(key);

    return result.changes > 0;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.memoryCache.clear();
    this.db.exec('DELETE FROM cache');
    this.hits = 0;
    this.misses = 0;

    this.logger.info('Cache cleared', 'PersistentResponseCache');
  }

  /**
   * Clear cache for specific provider/model
   */
  clearByProviderModel(provider: string, model?: string): number {
    // Clear memory cache (simplified - clears all)
    this.memoryCache.clear();

    let stmt: any;
    let result: any;

    if (model) {
      stmt = this.db.prepare('DELETE FROM cache WHERE provider = ? AND model = ?');
      result = stmt.run(provider, model);
    } else {
      stmt = this.db.prepare('DELETE FROM cache WHERE provider = ?');
      result = stmt.run(provider);
    }

    this.logger.debug(`Cleared ${result.changes} entries`, 'PersistentResponseCache', {
      provider,
      model,
    });

    return result.changes;
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): number {
    const now = Date.now();

    // Cleanup memory cache
    for (const [key, entry] of this.memoryCache) {
      if (entry.expiresAt <= now) {
        this.memoryCache.delete(key);
      }
    }

    // Cleanup persistent cache
    const stmt = this.db.prepare('DELETE FROM cache WHERE expires_at <= ?');
    const result = stmt.run(now);

    if (result.changes > 0) {
      this.logger.debug(`Cleaned up ${result.changes} expired entries`, 'PersistentResponseCache');
    }

    return result.changes;
  }

  /**
   * Get cache statistics
   */
  getStats(): PersistentCacheStats {
    const countStmt = this.db.prepare('SELECT COUNT(*) as count, SUM(size_bytes) as total_size FROM cache');
    const { count, total_size } = countStmt.get() as { count: number; total_size: number | null };

    const expiredStmt = this.db.prepare('SELECT COUNT(*) as count FROM cache WHERE expires_at <= ?');
    const { count: expiredCount } = expiredStmt.get(Date.now()) as { count: number };

    const totalRequests = this.hits + this.misses;

    return {
      totalEntries: count,
      totalSizeBytes: total_size || 0,
      hits: this.hits,
      misses: this.misses,
      hitRate: totalRequests > 0 ? this.hits / totalRequests : 0,
      expiredEntries: expiredCount,
      memoryCache: this.config.enableMemoryCache ? {
        entries: this.memoryCache.size,
        maxSize: this.config.memoryCacheMaxSize,
      } : undefined,
    };
  }

  /**
   * Warm cache with entries
   */
  warm(entries: Array<{
    provider: string;
    model: string;
    messages: Message[];
    result: CompletionResult;
    ttlMs?: number;
  }>): number {
    let count = 0;

    for (const entry of entries) {
      const key = this.generateKey(entry.provider, entry.model, entry.messages);
      this.set(key, entry.provider, entry.model, entry.result, entry.ttlMs);
      count++;
    }

    this.logger.info(`Warmed cache with ${count} entries`, 'PersistentResponseCache');

    return count;
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.db.close();
    this.logger.info('Cache closed', 'PersistentResponseCache');
  }

  /**
   * Vacuum database to reclaim space
   */
  vacuum(): void {
    this.db.exec('VACUUM');
    this.logger.debug('Database vacuumed', 'PersistentResponseCache');
  }
}

/**
 * Global persistent cache instance
 */
let globalPersistentCache: PersistentResponseCache | null = null;

/**
 * Initialize global persistent cache
 */
export function initPersistentCache(
  config?: Partial<PersistentCacheConfig>,
  logger?: Logger
): PersistentResponseCache {
  if (globalPersistentCache) {
    globalPersistentCache.close();
  }
  globalPersistentCache = new PersistentResponseCache(config, logger);
  return globalPersistentCache;
}

/**
 * Get global persistent cache
 */
export function getPersistentCache(): PersistentResponseCache {
  if (!globalPersistentCache) {
    globalPersistentCache = new PersistentResponseCache();
  }
  return globalPersistentCache;
}
