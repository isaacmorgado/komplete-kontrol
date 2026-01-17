/**
 * Rate Limiter with Token Bucket Algorithm
 *
 * Provides rate limiting for provider requests using the token bucket algorithm,
 * with configurable limits, burst capacity, and per-provider tracking.
 */

import type { AIProvider, Message, CompletionOptions, CompletionResult, StreamChunk } from '../../../types';
import { ProviderError } from '../../../types';
import { Logger } from '../../../utils/logger';

/**
 * Token bucket state
 */
export interface TokenBucket {
  tokens: number;
  lastRefill: Date;
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  tokensPerSecond: number;
  maxTokens: number;
  enableRateLimiting: boolean;
  enableBurst: boolean;
  enablePerProvider: boolean;
  enablePerModel: boolean;
}

/**
 * Rate limit statistics
 */
export interface RateLimitStatistics {
  totalRequests: number;
  allowedRequests: number;
  deniedRequests: number;
  currentTokens: number;
  averageTokensPerSecond: number;
  peakTokensPerSecond: number;
  requestsByProvider: Record<string, number>;
  requestsByModel: Record<string, number>;
}

/**
 * Rate limiter
 *
 * Provides rate limiting using the token bucket algorithm.
 * Supports per-provider and per-model rate limiting.
 */
export class RateLimiter {
  private logger: Logger;
  private config: RateLimitConfig;
  private globalBucket: TokenBucket;
  private providerBuckets: Map<string, TokenBucket> = new Map();
  private modelBuckets: Map<string, TokenBucket> = new Map();
  private stats: RateLimitStatistics = {
    totalRequests: 0,
    allowedRequests: 0,
    deniedRequests: 0,
    currentTokens: 0,
    averageTokensPerSecond: 0,
    peakTokensPerSecond: 0,
    requestsByProvider: {},
    requestsByModel: {},
  };
  private requestHistory: Array<{ timestamp: number; tokens: number }> = [];
  private historySize: number = 1000;

  constructor(config?: Partial<RateLimitConfig>, logger?: Logger) {
    this.config = {
      tokensPerSecond: 10,
      maxTokens: 100,
      enableRateLimiting: true,
      enableBurst: true,
      enablePerProvider: false,
      enablePerModel: false,
      ...config,
    };
    this.logger = logger?.child('RateLimiter') ?? new Logger().child('RateLimiter');

    this.globalBucket = {
      tokens: this.config.maxTokens,
      lastRefill: new Date(),
    };

    this.logger.info('Rate limiter initialized', {
      tokensPerSecond: this.config.tokensPerSecond,
      maxTokens: this.config.maxTokens,
    });
  }

  /**
   * Refill tokens in a bucket
   */
  private refillBucket(bucket: TokenBucket): void {
    const now = new Date();
    const elapsed = (now.getTime() - bucket.lastRefill.getTime()) / 1000; // seconds

    if (elapsed > 0) {
      const tokensToAdd = elapsed * this.config.tokensPerSecond;
      bucket.tokens = Math.min(bucket.tokens + tokensToAdd, this.config.maxTokens);
      bucket.lastRefill = now;
    }
  }

  /**
   * Get or create provider bucket
   */
  private getProviderBucket(provider: string): TokenBucket {
    if (!this.providerBuckets.has(provider)) {
      this.providerBuckets.set(provider, {
        tokens: this.config.maxTokens,
        lastRefill: new Date(),
      });
    }
    return this.providerBuckets.get(provider)!;
  }

  /**
   * Get or create model bucket
   */
  private getModelBucket(model: string): TokenBucket {
    if (!this.modelBuckets.has(model)) {
      this.modelBuckets.set(model, {
        tokens: this.config.maxTokens,
        lastRefill: new Date(),
      });
    }
    return this.modelBuckets.get(model)!;
  }

  /**
   * Try to consume tokens from a bucket
   */
  private tryConsume(bucket: TokenBucket, tokens: number): boolean {
    this.refillBucket(bucket);

    if (bucket.tokens >= tokens) {
      bucket.tokens -= tokens;
      return true;
    }

    return false;
  }

  /**
   * Check if request is allowed
   */
  async checkRateLimit(
    provider: string,
    model: string,
    tokens: number = 1
  ): Promise<{ allowed: boolean; waitTime: number }> {
    if (!this.config.enableRateLimiting) {
      return { allowed: true, waitTime: 0 };
    }

    this.stats.totalRequests++;

    // Track requests
    this.stats.requestsByProvider[provider] =
      (this.stats.requestsByProvider[provider] ?? 0) + 1;
    this.stats.requestsByModel[model] =
      (this.stats.requestsByModel[model] ?? 0) + 1;

    // Track token usage
    this.requestHistory.push({
      timestamp: Date.now(),
      tokens,
    });

    // Trim history
    if (this.requestHistory.length > this.historySize) {
      this.requestHistory.shift();
    }

    // Check provider bucket (when per-provider rate limiting is enabled)
    if (this.config.enablePerProvider) {
      const providerBucket = this.getProviderBucket(provider);
      if (!this.tryConsume(providerBucket, tokens)) {
        this.stats.deniedRequests++;
        const waitTime = this.calculateWaitTime(providerBucket, tokens);
        this.logger.debug('Rate limit exceeded (provider)', {
          provider,
          model,
          tokens,
          waitTime: `${waitTime.toFixed(0)}ms`,
        });
        return { allowed: false, waitTime };
      }
    }

    // Check model bucket (when per-model rate limiting is enabled)
    if (this.config.enablePerModel) {
      const modelBucket = this.getModelBucket(model);
      if (!this.tryConsume(modelBucket, tokens)) {
        // Refund provider bucket if applicable
        if (this.config.enablePerProvider) {
          const providerBucket = this.getProviderBucket(provider);
          providerBucket.tokens += tokens;
        }
        this.stats.deniedRequests++;
        const waitTime = this.calculateWaitTime(modelBucket, tokens);
        this.logger.debug('Rate limit exceeded (model)', {
          provider,
          model,
          tokens,
          waitTime: `${waitTime.toFixed(0)}ms`,
        });
        return { allowed: false, waitTime };
      }
    }

    // Check global bucket (only if not using per-provider or per-model rate limiting)
    if (!this.config.enablePerProvider && !this.config.enablePerModel) {
      if (!this.tryConsume(this.globalBucket, tokens)) {
        this.stats.deniedRequests++;
        const waitTime = this.calculateWaitTime(this.globalBucket, tokens);
        this.logger.debug('Rate limit exceeded (global)', {
          provider,
          model,
          tokens,
          waitTime: `${waitTime.toFixed(0)}ms`,
        });
        return { allowed: false, waitTime };
      }
    }

    this.stats.allowedRequests++;
    this.stats.currentTokens = this.globalBucket.tokens;

    return { allowed: true, waitTime: 0 };
  }

  /**
   * Calculate wait time for tokens
   */
  private calculateWaitTime(bucket: TokenBucket, tokens: number): number {
    const needed = tokens - bucket.tokens;
    const waitTime = (needed / this.config.tokensPerSecond) * 1000;
    return Math.max(waitTime, 0);
  }

  /**
   * Wait for rate limit to allow request
   */
  async waitForRateLimit(
    provider: string,
    model: string,
    tokens: number = 1
  ): Promise<void> {
    const check = await this.checkRateLimit(provider, model, tokens);

    if (!check.allowed) {
      this.logger.info('Waiting for rate limit', {
        provider,
        model,
        waitTime: `${check.waitTime.toFixed(0)}ms`,
      });
      await this.sleep(check.waitTime);
      await this.waitForRateLimit(provider, model, tokens);
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current tokens for a bucket
   */
  getTokens(provider?: string, model?: string): number {
    if (model && this.config.enablePerModel) {
      const bucket = this.getModelBucket(model);
      this.refillBucket(bucket);
      return bucket.tokens;
    }

    if (provider && this.config.enablePerProvider) {
      const bucket = this.getProviderBucket(provider);
      this.refillBucket(bucket);
      return bucket.tokens;
    }

    this.refillBucket(this.globalBucket);
    return this.globalBucket.tokens;
  }

  /**
   * Reset rate limit
   */
  reset(provider?: string, model?: string): void {
    if (model && this.config.enablePerModel) {
      const bucket = this.getModelBucket(model);
      bucket.tokens = this.config.maxTokens;
      bucket.lastRefill = new Date();
      this.logger.debug('Rate limit reset (model)', { model });
    } else if (provider && this.config.enablePerProvider) {
      const bucket = this.getProviderBucket(provider);
      bucket.tokens = this.config.maxTokens;
      bucket.lastRefill = new Date();
      this.logger.debug('Rate limit reset (provider)', { provider });
    } else {
      this.globalBucket.tokens = this.config.maxTokens;
      this.globalBucket.lastRefill = new Date();

      for (const bucket of this.providerBuckets.values()) {
        bucket.tokens = this.config.maxTokens;
        bucket.lastRefill = new Date();
      }

      for (const bucket of this.modelBuckets.values()) {
        bucket.tokens = this.config.maxTokens;
        bucket.lastRefill = new Date();
      }

      this.logger.info('Rate limit reset (all)');
    }
  }

  /**
   * Get statistics
   */
  getStatistics(): RateLimitStatistics {
    // Calculate average tokens per second
    const now = Date.now();
    const oneSecondAgo = now - 1000;

    const recentRequests = this.requestHistory.filter(r => r.timestamp > oneSecondAgo);
    const tokensPerSecond = recentRequests.reduce((sum, r) => sum + r.tokens, 0);

    this.stats.averageTokensPerSecond = tokensPerSecond;
    this.stats.peakTokensPerSecond = Math.max(
      this.stats.peakTokensPerSecond,
      tokensPerSecond
    );

    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStatistics(): void {
    this.stats = {
      totalRequests: 0,
      allowedRequests: 0,
      deniedRequests: 0,
      currentTokens: this.globalBucket.tokens,
      averageTokensPerSecond: 0,
      peakTokensPerSecond: 0,
      requestsByProvider: {},
      requestsByModel: {},
    };
    this.requestHistory = [];
    this.logger.info('Rate limiter statistics reset');
  }

  /**
   * Get configuration
   */
  getConfig(): Readonly<RateLimitConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('Rate limiter configuration updated');
  }
}

/**
 * Rate-limited provider wrapper
 *
 * Wraps a provider with rate limiting capabilities.
 */
export class RateLimitedProvider implements AIProvider {
  private provider: AIProvider;
  private rateLimiter: RateLimiter;
  private logger: Logger;

  constructor(provider: AIProvider, rateLimiter: RateLimiter, logger?: Logger) {
    this.provider = provider;
    this.rateLimiter = rateLimiter;
    this.logger = logger?.child('RateLimitedProvider') ?? new Logger().child('RateLimitedProvider');
  }

  get name(): string {
    return this.provider.name;
  }

  async complete(
    model: string,
    messages: Message[],
    options?: CompletionOptions
  ): Promise<CompletionResult> {
    // Estimate tokens for rate limiting
    const estimatedTokens = this.estimateTokens(messages);

    // Wait for rate limit
    await this.rateLimiter.waitForRateLimit(this.name, model, estimatedTokens);

    // Call provider
    return await this.provider.complete(model, messages, options);
  }

  async *stream(
    model: string,
    messages: Message[],
    options?: CompletionOptions
  ): AsyncGenerator<StreamChunk> {
    // Estimate tokens for rate limiting
    const estimatedTokens = this.estimateTokens(messages);

    // Wait for rate limit
    await this.rateLimiter.waitForRateLimit(this.name, model, estimatedTokens);

    // Stream from provider
    yield* this.provider.stream(model, messages, options);
  }

  async countTokens(messages: Message[]): Promise<number> {
    return await this.provider.countTokens(messages);
  }

  /**
   * Estimate token count for rate limiting
   */
  private estimateTokens(messages: Message[]): number {
    // Rough estimate: 4 characters per token
    const text = messages.map(m => m.content).join(' ');
    return Math.ceil(text.length / 4);
  }
}

/**
 * Default rate limit configuration
 */
export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  tokensPerSecond: 10,
  maxTokens: 100,
  enableRateLimiting: true,
  enableBurst: true,
  enablePerProvider: false,
  enablePerModel: false,
};

/**
 * Create a rate limiter with default configuration
 */
export function createRateLimiter(config?: Partial<RateLimitConfig>): RateLimiter {
  return new RateLimiter(config);
}

/**
 * Create a rate-limited provider
 */
export function createRateLimitedProvider(
  provider: AIProvider,
  rateLimiter?: RateLimiter
): RateLimitedProvider {
  const limiter = rateLimiter ?? createRateLimiter();
  return new RateLimitedProvider(provider, limiter);
}
