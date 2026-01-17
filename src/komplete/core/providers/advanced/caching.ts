/**
 * Caching Layer with TTL and Invalidation
 *
 * Provides caching for provider responses with TTL-based expiration,
 * cache invalidation strategies, and cache statistics.
 */

import type { AIProvider, Message, CompletionOptions, CompletionResult } from '../../../types';
import { Logger, LoggerLike } from '../../../utils/logger';

/**
 * Cache key
 */
export interface CacheKey {
  provider: string;
  model: string;
  messages: string;
  options: string;
}

/**
 * Cache entry
 */
export interface CacheEntry {
  key: CacheKey;
  result: CompletionResult;
  createdAt: Date;
  expiresAt: Date;
  hits: number;
  size: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  maxSize: number;
  defaultTTL: number;
  maxTTL: number;
  enableCache: boolean;
  enableCompression: boolean;
  enableStats: boolean;
}

/**
 * Cache statistics
 */
export interface CacheStatistics {
  hits: number;
  misses: number;
  hitRate: number;
  entries: number;
  totalSize: number;
  evictions: number;
  averageEntrySize: number;
  oldestEntry?: Date;
  newestEntry?: Date;
}

/**
 * Cache invalidation strategy
 */
export type InvalidationStrategy = 'ttl' | 'lru' | 'lfu' | 'size' | 'manual';

/**
 * Cache invalidation options
 */
export interface InvalidationOptions {
  strategy: InvalidationStrategy;
  maxAge?: number;
  maxEntries?: number;
  maxSize?: number;
}

/**
 * Response cache
 *
 * Provides caching for provider responses with TTL-based expiration
 * and multiple invalidation strategies.
 */
export class ResponseCache {
  private logger: LoggerLike;
  private config: CacheConfig;
  private cache: Map<string, CacheEntry> = new Map();
  private stats: CacheStatistics = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    entries: 0,
    totalSize: 0,
    evictions: 0,
    averageEntrySize: 0,
  };

  constructor(config?: Partial<CacheConfig>, logger?: LoggerLike) {
    this.config = {
      maxSize: 100 * 1024 * 1024, // 100 MB
      defaultTTL: 5 * 60 * 1000, // 5 minutes
      maxTTL: 60 * 60 * 1000, // 1 hour
      enableCache: true,
      enableCompression: false,
      enableStats: true,
      ...config,
    };
    this.logger = logger?.child('ResponseCache') ?? new Logger().child('ResponseCache');

    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(
    provider: string,
    model: string,
    messages: Message[],
    options?: CompletionOptions
  ): string {
    const key: CacheKey = {
      provider,
      model,
      messages: JSON.stringify(messages),
      options: JSON.stringify(options ?? {}),
    };

    // Simple hash for cache key
    const hash = this.hash(JSON.stringify(key));
    return `${provider}:${model}:${hash}`;
  }

  /**
   * Simple hash function
   */
  private hash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Estimate entry size
   */
  private estimateEntrySize(entry: CacheEntry): number {
    return JSON.stringify(entry).length;
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() >= entry.expiresAt.getTime();
  }

  /**
   * Get cache entry
   */
  private getEntry(key: string): CacheEntry | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.stats.entries--;
      this.stats.totalSize -= entry.size;
      return undefined;
    }

    return entry;
  }

  /**
   * Add cache entry
   */
  private addEntry(key: string, entry: CacheEntry): void {
    // Check if we need to evict entries
    this.evictIfNeeded(entry.size);

    this.cache.set(key, entry);
    this.stats.entries++;
    this.stats.totalSize += entry.size;

    this.logger.debug('Cache entry added', {
      key,
      size: entry.size,
      ttl: `${(entry.expiresAt.getTime() - Date.now()) / 1000}s`,
    });
  }

  /**
   * Evict entries if needed
   */
  private evictIfNeeded(newEntrySize: number): void {
    const projectedSize = this.stats.totalSize + newEntrySize;

    if (projectedSize <= this.config.maxSize) {
      return;
    }

    this.logger.info('Evicting cache entries', {
      currentSize: this.stats.totalSize,
      maxSize: this.config.maxSize,
      needed: projectedSize - this.config.maxSize,
    });

    // Evict expired entries first
    for (const [key, entry] of this.cache) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        this.stats.entries--;
        this.stats.totalSize -= entry.size;
        this.stats.evictions++;

        if (this.stats.totalSize + newEntrySize <= this.config.maxSize) {
          break;
        }
      }
    }

    // If still over limit, evict by LRU
    if (this.stats.totalSize + newEntrySize > this.config.maxSize) {
      const entries = Array.from(this.cache.entries()).sort((a, b) =>
        a[1].createdAt.getTime() - b[1].createdAt.getTime()
      );

      for (const [key, entry] of entries) {
        this.cache.delete(key);
        this.stats.entries--;
        this.stats.totalSize -= entry.size;
        this.stats.evictions++;

        if (this.stats.totalSize + newEntrySize <= this.config.maxSize) {
          break;
        }
      }
    }
  }

  /**
   * Invalidate cache entries
   */
  invalidate(options: InvalidationOptions): number {
    let invalidated = 0;

    switch (options.strategy) {
      case 'ttl':
        invalidated = this.invalidateByTTL(options.maxAge);
        break;
      case 'lru':
        invalidated = this.invalidateByLRU(options.maxEntries);
        break;
      case 'lfu':
        invalidated = this.invalidateByLFU(options.maxEntries);
        break;
      case 'size':
        invalidated = this.invalidateBySize(options.maxSize);
        break;
      case 'manual':
        // Manual invalidation requires explicit keys
        break;
    }

    this.logger.info('Cache invalidated', {
      strategy: options.strategy,
      invalidated,
      remaining: this.stats.entries,
    });

    return invalidated;
  }

  /**
   * Invalidate by TTL
   */
  private invalidateByTTL(maxAge?: number): number {
    let invalidated = 0;
    const now = Date.now();
    const maxAgeMs = maxAge ?? this.config.defaultTTL;

    // If maxAge is 0, invalidate all entries
    if (maxAge === 0) {
      const count = this.cache.size;
      this.cache.clear();
      this.stats.entries = 0;
      this.stats.totalSize = 0;
      return count;
    }

    for (const [key, entry] of this.cache) {
      if (entry.expiresAt.getTime() <= now) {
        this.cache.delete(key);
        this.stats.entries--;
        this.stats.totalSize -= entry.size;
        invalidated++;
      }
    }

    return invalidated;
  }

  /**
   * Invalidate by LRU (Least Recently Used)
   */
  private invalidateByLRU(maxEntries?: number): number {
    const targetSize = maxEntries ?? Math.floor(this.cache.size * 0.75);
    let invalidated = 0;

    if (this.cache.size <= targetSize) {
      return 0;
    }

    const entries = Array.from(this.cache.entries()).sort((a, b) =>
      a[1].createdAt.getTime() - b[1].createdAt.getTime()
    );

    for (let i = 0; i < entries.length - targetSize; i++) {
      const [key, entry] = entries[i];
      this.cache.delete(key);
      this.stats.entries--;
      this.stats.totalSize -= entry.size;
      invalidated++;
    }

    return invalidated;
  }

  /**
   * Invalidate by LFU (Least Frequently Used)
   */
  private invalidateByLFU(maxEntries?: number): number {
    const targetSize = maxEntries ?? Math.floor(this.cache.size * 0.75);
    let invalidated = 0;

    if (this.cache.size <= targetSize) {
      return 0;
    }

    const entries = Array.from(this.cache.entries()).sort((a, b) =>
      a[1].hits - b[1].hits
    );

    for (let i = 0; i < entries.length - targetSize; i++) {
      const [key, entry] = entries[i];
      this.cache.delete(key);
      this.stats.entries--;
      this.stats.totalSize -= entry.size;
      invalidated++;
    }

    return invalidated;
  }

  /**
   * Invalidate by size
   */
  private invalidateBySize(maxSize?: number): number {
    const targetSize = maxSize ?? Math.floor(this.config.maxSize * 0.75);
    let invalidated = 0;

    if (this.stats.totalSize <= targetSize) {
      return 0;
    }

    const entries = Array.from(this.cache.entries()).sort((a, b) =>
      a[1].createdAt.getTime() - b[1].createdAt.getTime()
    );

    for (const [key, entry] of entries) {
      if (this.stats.totalSize <= targetSize) {
        break;
      }

      this.cache.delete(key);
      this.stats.entries--;
      this.stats.totalSize -= entry.size;
      invalidated++;
    }

    return invalidated;
  }

  /**
   * Invalidate by key pattern
   */
  invalidateByPattern(pattern: RegExp): number {
    let invalidated = 0;

    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        const entry = this.cache.get(key);
        if (entry) {
          this.cache.delete(key);
          this.stats.entries--;
          this.stats.totalSize -= entry.size;
          invalidated++;
        }
      }
    }

    this.logger.info('Cache invalidated by pattern', {
      pattern: pattern.toString(),
      invalidated,
    });

    return invalidated;
  }

  /**
   * Invalidate by provider
   */
  invalidateByProvider(provider: string): number {
    return this.invalidateByPattern(new RegExp(`^${provider}:`));
  }

  /**
   * Invalidate by model
   */
  invalidateByModel(model: string): number {
    return this.invalidateByPattern(new RegExp(`:[^:]+:${model}:`));
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.stats.entries = 0;
    this.stats.totalSize = 0;
    this.logger.info('Cache cleared');
  }

  /**
   * Get cached result
   */
  get(
    provider: string,
    model: string,
    messages: Message[],
    options?: CompletionOptions
  ): CompletionResult | undefined {
    if (!this.config.enableCache) {
      return undefined;
    }

    const key = this.generateCacheKey(provider, model, messages, options);
    const entry = this.getEntry(key);

    if (entry) {
      entry.hits++;
      this.stats.hits++;

      this.logger.debug('Cache hit', {
        key,
        hits: entry.hits,
      });

      return entry.result;
    }

    this.stats.misses++;
    this.logger.debug('Cache miss', { key });

    return undefined;
  }

  /**
   * Set cached result
   */
  set(
    provider: string,
    model: string,
    messages: Message[],
    result: CompletionResult,
    options?: CompletionOptions,
    ttl?: number
  ): void {
    if (!this.config.enableCache) {
      return;
    }

    const key = this.generateCacheKey(provider, model, messages, options);
    const now = Date.now();

    const entry: CacheEntry = {
      key: {
        provider,
        model,
        messages: JSON.stringify(messages),
        options: JSON.stringify(options ?? {}),
      },
      result,
      createdAt: new Date(now),
      expiresAt: new Date(now + (ttl ?? this.config.defaultTTL)),
      hits: 0,
      size: 0, // Will be set after estimation
    };

    entry.size = this.estimateEntrySize(entry);
    this.addEntry(key, entry);
  }

  /**
   * Check if result is cached
   */
  has(
    provider: string,
    model: string,
    messages: Message[],
    options?: CompletionOptions
  ): boolean {
    if (!this.config.enableCache) {
      return false;
    }

    const key = this.generateCacheKey(provider, model, messages, options);
    return this.getEntry(key) !== undefined;
  }

  /**
   * Start cleanup interval
   */
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  private startCleanupInterval(): void {
    // Clean up expired entries every minute
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, 60000);
  }

  /**
   * Stop cleanup interval
   */
  private stopCleanupInterval(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanupExpired(): void {
    let cleaned = 0;

    for (const [key, entry] of this.cache) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        this.stats.entries--;
        this.stats.totalSize -= entry.size;
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug('Expired entries cleaned up', {
        cleaned,
        remaining: this.stats.entries,
      });
    }
  }

  /**
   * Get statistics
   */
  getStatistics(): CacheStatistics {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
    this.stats.averageEntrySize =
      this.stats.entries > 0 ? this.stats.totalSize / this.stats.entries : 0;

    // Find oldest and newest entries
    const entries = Array.from(this.cache.values());
    if (entries.length > 0) {
      const sorted = entries.sort((a, b) =>
        a.createdAt.getTime() - b.createdAt.getTime()
      );
      this.stats.oldestEntry = sorted[0].createdAt;
      this.stats.newestEntry = sorted[sorted.length - 1].createdAt;
    } else {
      this.stats.oldestEntry = undefined;
      this.stats.newestEntry = undefined;
    }

    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStatistics(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      entries: this.stats.entries,
      totalSize: this.stats.totalSize,
      evictions: this.stats.evictions,
      averageEntrySize: 0,
    };
    this.logger.info('Cache statistics reset');
  }

  /**
   * Get configuration
   */
  getConfig(): Readonly<CacheConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('Cache configuration updated');
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopCleanupInterval();
    this.clear();
    this.logger.info('Cache destroyed');
  }
}

/**
 * Cached provider wrapper
 *
 * Wraps a provider with caching capabilities.
 */
export class CachedProvider implements AIProvider {
  private provider: AIProvider;
  private cache: ResponseCache;
  private logger: LoggerLike;

  constructor(provider: AIProvider, cache: ResponseCache, logger?: LoggerLike) {
    this.provider = provider;
    this.cache = cache;
    this.logger = logger?.child('CachedProvider') ?? new Logger().child('CachedProvider');
  }

  get name(): string {
    return this.provider.name;
  }

  get prefix(): import('../../../types').ProviderPrefix {
    return this.provider.prefix;
  }

  get capabilities(): import('../../../types').ProviderCapabilities {
    return this.provider.capabilities;
  }

  async complete(
    model: string,
    messages: Message[],
    options?: CompletionOptions
  ): Promise<CompletionResult> {
    // Check cache first
    const cached = this.cache.get(this.name, model, messages, options);
    if (cached) {
      this.logger.debug('Returning cached result', { model });
      return cached;
    }

    // Call provider
    const result = await this.provider.complete(model, messages, options);

    // Cache result
    this.cache.set(this.name, model, messages, result, options);

    return result;
  }

  async *stream(
    model: string,
    messages: Message[],
    options?: CompletionOptions
  ): AsyncGenerator<import('../../../types').StreamChunk> {
    // Streaming is not cached
    yield* this.provider.stream(model, messages, options);
  }

  async countTokens(messages: Message[]): Promise<number> {
    return await this.provider.countTokens(messages);
  }
}

/**
 * Default cache configuration
 */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxSize: 100 * 1024 * 1024, // 100 MB
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  maxTTL: 60 * 60 * 1000, // 1 hour
  enableCache: true,
  enableCompression: false,
  enableStats: true,
};

/**
 * Create a response cache with default configuration
 */
export function createResponseCache(config?: Partial<CacheConfig>): ResponseCache {
  return new ResponseCache(config);
}

/**
 * Create a cached provider
 */
export function createCachedProvider(
  provider: AIProvider,
  cache?: ResponseCache
): CachedProvider {
  const cacheInstance = cache ?? createResponseCache();
  return new CachedProvider(provider, cacheInstance);
}
