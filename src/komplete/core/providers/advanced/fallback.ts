/**
 * Provider Fallback with Exponential Backoff Retry
 *
 * Provides automatic fallback to alternative providers when primary fails,
 * with exponential backoff retry logic for transient errors.
 */

import type { AIProvider, Message, CompletionOptions, CompletionResult, StreamChunk } from '../../../types';
import { ProviderError } from '../../../types';
import { Logger, LoggerLike } from '../../../utils/logger';

/**
 * Fallback strategy type
 */
export type FallbackStrategy = 'sequential' | 'parallel' | 'best-effort';

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

/**
 * Fallback provider configuration
 */
export interface FallbackProviderConfig {
  provider: AIProvider;
  priority: number;
  enabled: boolean;
}

/**
 * Fallback manager configuration
 */
export interface FallbackManagerConfig {
  primaryProvider: AIProvider;
  fallbackProviders: FallbackProviderConfig[];
  strategy: FallbackStrategy;
  retry: RetryConfig;
  enableFallback: boolean;
}

/**
 * Provider health status
 */
export interface ProviderHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  successCount: number;
  failureCount: number;
  lastUsed: Date;
  lastSuccess: Date;
  lastFailure?: Date;
  consecutiveFailures: number;
}

/**
 * Retry attempt information
 */
interface RetryAttempt {
  attempt: number;
  provider: string;
  delay: number;
  error?: Error;
}

/**
 * Provider Fallback Manager
 *
 * Manages provider fallback with exponential backoff retry logic.
 * Supports multiple fallback strategies and configurable retry behavior.
 */
export class ProviderFallbackManager {
  private logger: LoggerLike;
  private config: FallbackManagerConfig;
  private retryHistory: Map<string, RetryAttempt[]> = new Map();
  private providerHealth: Map<string, ProviderHealth> = new Map();

  constructor(config: FallbackManagerConfig, logger?: LoggerLike) {
    this.config = config;
    this.logger = logger?.child('ProviderFallbackManager') ?? new Logger().child('ProviderFallbackManager');
    this.initializeProviderHealth();
  }

  /**
   * Initialize health tracking for all providers
   */
  private initializeProviderHealth(): void {
    this.setProviderHealth(this.config.primaryProvider.name, {
      status: 'healthy',
      successCount: 0,
      failureCount: 0,
      lastUsed: new Date(),
      lastSuccess: new Date(),
      lastFailure: undefined,
      consecutiveFailures: 0,
    });

    for (const fallback of this.config.fallbackProviders) {
      if (fallback.enabled) {
        this.setProviderHealth(fallback.provider.name, {
          status: 'healthy',
          successCount: 0,
          failureCount: 0,
          lastUsed: new Date(),
          lastSuccess: new Date(),
          lastFailure: undefined,
          consecutiveFailures: 0,
        });
      }
    }
  }

  /**
   * Set provider health status
   */
  private setProviderHealth(providerName: string, health: ProviderHealth): void {
    this.providerHealth.set(providerName, health);
    this.logger.debug(`Provider health updated: ${providerName}`, {
      status: health.status,
      successCount: health.successCount,
      failureCount: health.failureCount,
    });
  }

  /**
   * Get provider health status
   */
  getProviderHealth(providerName: string): ProviderHealth | undefined {
    return this.providerHealth.get(providerName);
  }

  /**
   * Get all provider health statuses
   */
  getAllProviderHealth(): Map<string, ProviderHealth> {
    return new Map(this.providerHealth);
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    // Check if error message indicates non-retryable
    if (error.message.includes('Non-retryable')) {
      return false;
    }

    if (error instanceof ProviderError) {
      // Check if error code is in retryable list
      return this.config.retry.retryableErrors.includes(error.code);
    }
    // Network errors and timeouts are generally retryable
    return (
      error.name === 'TimeoutError' ||
      error.name === 'NetworkError' ||
      error.message.includes('timeout') ||
      error.message.includes('network') ||
      error.message.includes('ECONNRESET') ||
      error.message.includes('ETIMEDOUT')
    );
  }

  /**
   * Calculate delay with exponential backoff
   */
  private calculateDelay(attempt: number): number {
    const delay = Math.min(
      this.config.retry.initialDelayMs * Math.pow(this.config.retry.backoffMultiplier, attempt - 1),
      this.config.retry.maxDelayMs
    );
    // Add jitter to avoid thundering herd
    const jitter = delay * 0.1 * Math.random();
    return delay + jitter;
  }

  /**
   * Record retry attempt
   */
  private recordRetryAttempt(requestId: string, attempt: RetryAttempt): void {
    const history = this.retryHistory.get(requestId) ?? [];
    history.push(attempt);
    this.retryHistory.set(requestId, history);
  }

  /**
   * Get retry history for a request
   */
  getRetryHistory(requestId: string): RetryAttempt[] {
    return this.retryHistory.get(requestId) ?? [];
  }

  /**
   * Clear retry history for a request
   */
  private clearRetryHistory(requestId: string): void {
    this.retryHistory.delete(requestId);
  }

  /**
   * Update provider health after attempt
   */
  private updateProviderHealth(provider: AIProvider, success: boolean, error?: Error): void {
    const health = this.providerHealth.get(provider.name);
    if (!health) return;

    health.lastUsed = new Date();

    if (success) {
      health.successCount++;
      health.lastSuccess = new Date();
      health.consecutiveFailures = 0;
      health.status = 'healthy';
    } else {
      health.failureCount++;
      health.lastFailure = new Date();
      health.consecutiveFailures++;

      // Mark as degraded after 3 consecutive failures
      if (health.consecutiveFailures >= 3) {
        health.status = 'degraded';
      }
      // Mark as unhealthy after 5 consecutive failures
      if (health.consecutiveFailures >= 5) {
        health.status = 'unhealthy';
      }
    }

    this.logger.debug(`Provider health updated after attempt: ${provider.name}`, {
      success,
      status: health.status,
      consecutiveFailures: health.consecutiveFailures,
    });
  }

  /**
   * Get available providers sorted by priority and health
   */
  private getAvailableProviders(): AIProvider[] {
    const providers: AIProvider[] = [];

    // Add primary if healthy
    const primaryHealth = this.providerHealth.get(this.config.primaryProvider.name);
    if (primaryHealth && primaryHealth.status !== 'unhealthy') {
      providers.push(this.config.primaryProvider);
    }

    // Add enabled fallbacks sorted by priority
    const enabledFallbacks = this.config.fallbackProviders
      .filter(f => f.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const fallback of enabledFallbacks) {
      const health = this.providerHealth.get(fallback.provider.name);
      if (health && health.status !== 'unhealthy') {
        providers.push(fallback.provider);
      }
    }

    return providers;
  }

  /**
   * Execute with retry logic on a single provider
   */
  private async executeWithRetry<T>(
    provider: AIProvider,
    requestId: string,
    executor: () => Promise<T>
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.config.retry.maxAttempts; attempt++) {
      const delay = this.calculateDelay(attempt);

      if (attempt > 1) {
        this.logger.info(`Retrying with ${provider.name} (attempt ${attempt}/${this.config.retry.maxAttempts})`, {
          requestId,
          delay: `${delay.toFixed(0)}ms`,
        });
        await this.sleep(delay);
      }

      try {
        const result = await executor();
        this.updateProviderHealth(provider, true);
        this.recordRetryAttempt(requestId, {
          attempt,
          provider: provider.name,
          delay,
        });
        return result;
      } catch (error) {
        lastError = error as Error;
        this.recordRetryAttempt(requestId, {
          attempt,
          provider: provider.name,
          delay,
          error: lastError,
        });

        this.updateProviderHealth(provider, false, lastError);

        // Check if error is retryable
        if (!this.isRetryableError(lastError)) {
          this.logger.warn(`Non-retryable error from ${provider.name}`, {
            requestId,
            error: lastError.message,
          });
          throw lastError;
        }

        this.logger.warn(`Error from ${provider.name} (attempt ${attempt}/${this.config.retry.maxAttempts})`, {
          requestId,
          error: lastError.message,
        });
      }
    }

    // All retries exhausted
    this.logger.error(`All retry attempts exhausted for ${provider.name}`, {
      requestId,
      attempts: this.config.retry.maxAttempts,
      error: lastError?.message,
    });

    throw lastError ?? new Error('All retry attempts exhausted');
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute completion with fallback and retry
   */
  async complete(
    model: string,
    messages: Message[],
    options?: CompletionOptions
  ): Promise<CompletionResult> {
    const requestId = `complete-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    if (!this.config.enableFallback) {
      // No fallback, just retry on primary
      return this.executeWithRetry(
        this.config.primaryProvider,
        requestId,
        () => this.config.primaryProvider.complete(model, messages, options)
      );
    }

    const providers = this.getAvailableProviders();

    if (providers.length === 0) {
      throw new ProviderError('No healthy providers available', 'ProviderFallbackManager');
    }

    if (this.config.strategy === 'parallel') {
      return this.executeParallelFallback(requestId, providers, model, messages, options);
    }

    return this.executeSequentialFallback(requestId, providers, model, messages, options);
  }

  /**
   * Execute sequential fallback strategy
   */
  private async executeSequentialFallback(
    requestId: string,
    providers: AIProvider[],
    model: string,
    messages: Message[],
    options?: CompletionOptions
  ): Promise<CompletionResult> {
    let lastError: Error | undefined;

    for (const provider of providers) {
      this.logger.info(`Attempting ${provider.name}`, { requestId });

      try {
        const result = await this.executeWithRetry(
          provider,
          requestId,
          () => provider.complete(model, messages, options)
        );
        this.logger.info(`Success with ${provider.name}`, { requestId });
        this.clearRetryHistory(requestId);
        return result;
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`Failed with ${provider.name}, trying next`, {
          requestId,
          error: lastError.message,
        });
      }
    }

    this.clearRetryHistory(requestId);
    throw lastError ?? new ProviderError('All providers failed', 'ProviderFallbackManager');
  }

  /**
   * Execute parallel fallback strategy (best-effort)
   */
  private async executeParallelFallback(
    requestId: string,
    providers: AIProvider[],
    model: string,
    messages: Message[],
    options?: CompletionOptions
  ): Promise<CompletionResult> {
    this.logger.info(`Executing parallel fallback with ${providers.length} providers`, { requestId });

    // Execute all providers in parallel
    const promises = providers.map(provider =>
      this.executeWithRetry(provider, requestId, () =>
        provider.complete(model, messages, options)
      ).catch(error => ({ provider, error: error as Error }))
    );

    const results = await Promise.all(promises);

    // Find first successful result
    const successResult = results.find(r => !(r as any).error);

    if (successResult && !(successResult as any).error) {
      const provider = (successResult as any).provider;
      this.logger.info(`Parallel fallback succeeded with ${provider.name}`, { requestId });
      this.clearRetryHistory(requestId);
      return successResult as CompletionResult;
    }

    // All failed, throw last error
    const lastResult = results[results.length - 1];
    this.clearRetryHistory(requestId);
    throw (lastResult as any).error ?? new ProviderError('All providers failed', 'ProviderFallbackManager');
  }

  /**
   * Execute stream with fallback and retry
   */
  async *stream(
    model: string,
    messages: Message[],
    options?: CompletionOptions
  ): AsyncGenerator<StreamChunk> {
    const requestId = `stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // For streaming, we only use sequential fallback
    // (parallel streaming would be complex to coordinate)
    const providers = this.getAvailableProviders();

    if (providers.length === 0) {
      throw new ProviderError('No healthy providers available', 'ProviderFallbackManager');
    }

    let lastError: Error | undefined;

    for (const provider of providers) {
      this.logger.info(`Streaming with ${provider.name}`, { requestId });

      try {
        // Use streaming retry instead of executeWithRetry
        for await (const chunk of this.executeWithRetryStream(
          provider,
          requestId,
          () => provider.stream(model, messages, options)
        )) {
          yield chunk;
        }
        this.logger.info(`Streaming success with ${provider.name}`, { requestId });
        this.clearRetryHistory(requestId);
        return;
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`Streaming failed with ${provider.name}, trying next`, {
          requestId,
          error: lastError.message,
        });
      }
    }

    this.clearRetryHistory(requestId);
    throw lastError ?? new ProviderError('All providers failed', 'ProviderFallbackManager');
  }

  /**
   * Execute with retry logic for streaming (AsyncGenerator)
   */
  private async *executeWithRetryStream<T>(
    provider: AIProvider,
    requestId: string,
    executor: () => AsyncGenerator<T>
  ): AsyncGenerator<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.config.retry.maxAttempts; attempt++) {
      const delay = this.calculateDelay(attempt);

      if (attempt > 1) {
        this.logger.info(`Retrying stream with ${provider.name} (attempt ${attempt}/${this.config.retry.maxAttempts})`, {
          requestId,
          delay: `${delay.toFixed(0)}ms`,
        });
        await this.sleep(delay);
      }

      try {
        const stream = executor();
        for await (const item of stream) {
          yield item;
        }
        this.updateProviderHealth(provider, true);
        this.recordRetryAttempt(requestId, {
          attempt,
          provider: provider.name,
          delay,
        });
        return;
      } catch (error) {
        lastError = error as Error;
        this.recordRetryAttempt(requestId, {
          attempt,
          provider: provider.name,
          delay,
          error: lastError,
        });

        this.updateProviderHealth(provider, false, lastError);

        // Check if error is retryable
        if (!this.isRetryableError(lastError)) {
          this.logger.warn(`Non-retryable error from ${provider.name}`, {
            requestId,
            error: lastError.message,
          });
          throw lastError;
        }

        this.logger.warn(`Error from ${provider.name} (attempt ${attempt}/${this.config.retry.maxAttempts})`, {
          requestId,
          error: lastError.message,
        });
      }
    }

    // All retries exhausted
    this.logger.error(`All retry attempts exhausted for ${provider.name}`, {
      requestId,
      attempts: this.config.retry.maxAttempts,
      error: lastError?.message,
    });

    throw lastError ?? new Error('All retry attempts exhausted');
  }

  /**
   * Count tokens with fallback
   */
  async countTokens(messages: Message[]): Promise<number> {
    try {
      return await this.config.primaryProvider.countTokens(messages);
    } catch (error) {
      this.logger.warn('Token counting failed on primary, trying fallback', { error });
      for (const fallback of this.config.fallbackProviders) {
        if (fallback.enabled) {
          try {
            return await fallback.provider.countTokens(messages);
          } catch (fallbackError) {
            this.logger.warn(`Token counting failed on ${fallback.provider.name}`, {
              error: fallbackError,
            });
          }
        }
      }
    }
    throw new ProviderError('Token counting failed on all providers', 'ProviderFallbackManager');
  }

  /**
   * Get statistics
   */
  getStatistics(): FallbackStatistics {
    const stats: FallbackStatistics = {
      totalRequests: 0,
      primarySuccesses: 0,
      fallbackSuccesses: 0,
      totalFailures: 0,
      averageAttempts: 0,
      providerHealth: {},
    };

    for (const [providerName, health] of this.providerHealth) {
      stats.providerHealth[providerName] = {
        status: health.status,
        successCount: health.successCount,
        failureCount: health.failureCount,
        successRate:
          health.successCount + health.failureCount > 0
            ? health.successCount / (health.successCount + health.failureCount)
            : 1,
      };
      stats.totalRequests += health.successCount + health.failureCount;
      stats.totalFailures += health.failureCount;
    }

    if (this.providerHealth.has(this.config.primaryProvider.name)) {
      stats.primarySuccesses =
        this.providerHealth.get(this.config.primaryProvider.name)!.successCount;
    }

    stats.fallbackSuccesses =
      stats.totalRequests - stats.primarySuccesses - stats.totalFailures;

    return stats;
  }

  /**
   * Reset all health statistics
   */
  resetHealth(): void {
    this.initializeProviderHealth();
    this.retryHistory.clear();
    this.logger.info('Provider health statistics reset');
  }

  /**
   * Get configuration
   */
  getConfig(): Readonly<FallbackManagerConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<FallbackManagerConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('Fallback manager configuration updated');
  }
}

/**
 * Fallback statistics
 */
export interface FallbackStatistics {
  totalRequests: number;
  primarySuccesses: number;
  fallbackSuccesses: number;
  totalFailures: number;
  averageAttempts: number;
  providerHealth: Record<string, ProviderHealthStats>;
}

/**
 * Provider health statistics
 */
export interface ProviderHealthStats {
  status: 'healthy' | 'degraded' | 'unhealthy';
  successCount: number;
  failureCount: number;
  successRate: number;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableErrors: [
    'RATE_LIMIT_EXCEEDED',
    'TEMPORARY_FAILURE',
    'SERVICE_UNAVAILABLE',
    'TIMEOUT',
  ],
};

/**
 * Create a provider fallback manager with default configuration
 */
export function createProviderFallbackManager(
  primaryProvider: AIProvider,
  fallbackProviders: AIProvider[],
  config?: Partial<FallbackManagerConfig>
): ProviderFallbackManager {
  const fullConfig: FallbackManagerConfig = {
    primaryProvider,
    fallbackProviders: fallbackProviders.map((p, i) => ({
      provider: p,
      priority: i + 1,
      enabled: true,
    })),
    strategy: 'sequential',
    retry: DEFAULT_RETRY_CONFIG,
    enableFallback: true,
    ...config,
  };

  return new ProviderFallbackManager(fullConfig);
}
