/**
 * Provider Load Balancer with Health Monitoring
 *
 * Provides load balancing across multiple providers with health monitoring,
 * automatic failover, and weighted distribution.
 */

import type { AIProvider, Message, CompletionOptions, CompletionResult, StreamChunk } from '../../../types';
import { ProviderError } from '../../../types';
import { Logger } from '../../../utils/logger';

/**
 * Load balancing strategy
 */
export type LoadBalancingStrategy =
  | 'round-robin'
  | 'least-connections'
  | 'weighted'
  | 'health-first'
  | 'random';

/**
 * Provider weight configuration
 */
export interface ProviderWeight {
  provider: AIProvider;
  weight: number;
  maxConnections: number;
  currentConnections: number;
}

/**
 * Load balancer configuration
 */
export interface LoadBalancerConfig {
  providers: ProviderWeight[];
  strategy: LoadBalancingStrategy;
  healthCheckIntervalMs: number;
  healthCheckTimeoutMs: number;
  unhealthyThreshold: number;
  recoveryThreshold: number;
  enableHealthChecks: boolean;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  provider: string;
  healthy: boolean;
  latency: number;
  error?: Error;
  timestamp: Date;
}

/**
 * Provider health status
 */
export interface ProviderHealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  lastCheck: Date;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  averageLatency: number;
  latencyHistory: number[];
}

/**
 * Provider load balancer
 *
 * Distributes requests across multiple providers with health monitoring
 * and automatic failover capabilities.
 */
export class ProviderLoadBalancer {
  private logger: Logger;
  private config: LoadBalancerConfig;
  private currentRoundRobinIndex: number = 0;
  private providerHealth: Map<string, ProviderHealthStatus> = new Map();
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  private requestCount: Map<string, number> = new Map();

  constructor(config: LoadBalancerConfig, logger?: Logger) {
    this.config = config;
    this.logger = logger?.child('ProviderLoadBalancer') ?? new Logger().child('ProviderLoadBalancer');

    // Initialize health status for all providers
    for (const pw of config.providers) {
      this.providerHealth.set(pw.provider.name, {
        status: 'healthy',
        lastCheck: new Date(),
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
        averageLatency: 0,
        latencyHistory: [],
      });
    }

    if (config.enableHealthChecks) {
      this.startHealthChecks();
    }
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    if (this.healthCheckTimer) return;

    this.logger.info('Starting health checks', {
      interval: `${this.config.healthCheckIntervalMs}ms`,
    });

    this.healthCheckTimer = setInterval(() => {
      this.performHealthChecks();
    }, this.config.healthCheckIntervalMs);
  }

  /**
   * Stop periodic health checks
   */
  stopHealthChecks(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
      this.logger.info('Health checks stopped');
    }
  }

  /**
   * Perform health checks on all providers
   */
  private async performHealthChecks(): Promise<void> {
    const results: HealthCheckResult[] = [];

    for (const pw of this.config.providers) {
      const result = await this.checkProviderHealth(pw.provider);
      results.push(result);
      this.updateProviderHealth(pw.provider.name, result);
    }

    this.logHealthCheckSummary(results);
  }

  /**
   * Check health of a single provider
   */
  private async checkProviderHealth(provider: AIProvider): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Simple health check - count tokens for a minimal message
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), this.config.healthCheckTimeoutMs);
      });

      const result = await Promise.race([
        provider.countTokens([{ role: 'user', content: 'Health check' }]),
        timeoutPromise,
      ]);

      const latency = Date.now() - startTime;

      return {
        provider: provider.name,
        healthy: true,
        latency,
        timestamp: new Date(),
      };
    } catch (error) {
      const latency = Date.now() - startTime;

      return {
        provider: provider.name,
        healthy: false,
        latency,
        error: error as Error,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Update provider health status based on check result
   */
  private updateProviderHealth(providerName: string, result: HealthCheckResult): void {
    const health = this.providerHealth.get(providerName);
    if (!health) return;

    health.lastCheck = result.timestamp;

    if (result.healthy) {
      health.consecutiveFailures = 0;
      health.consecutiveSuccesses++;

      // Update latency history (keep last 10)
      health.latencyHistory.push(result.latency);
      if (health.latencyHistory.length > 10) {
        health.latencyHistory.shift();
      }

      // Calculate average latency
      health.averageLatency =
        health.latencyHistory.reduce((sum, lat) => sum + lat, 0) / health.latencyHistory.length;

      // Update status
      if (health.status === 'unhealthy' && health.consecutiveSuccesses >= this.config.recoveryThreshold) {
        health.status = 'healthy';
        this.logger.info(`Provider ${providerName} recovered`, {
          consecutiveSuccesses: health.consecutiveSuccesses,
        });
      } else if (health.status === 'degraded') {
        health.status = 'healthy';
      }
    } else {
      health.consecutiveSuccesses = 0;
      health.consecutiveFailures++;

      // Update status
      if (health.consecutiveFailures >= this.config.unhealthyThreshold) {
        health.status = 'unhealthy';
        this.logger.warn(`Provider ${providerName} marked unhealthy`, {
          consecutiveFailures: health.consecutiveFailures,
          error: result.error?.message,
        });
      } else if (health.consecutiveFailures >= 2) {
        health.status = 'degraded';
      }
    }
  }

  /**
   * Log health check summary
   */
  private logHealthCheckSummary(results: HealthCheckResult[]): void {
    const healthy = results.filter(r => r.healthy).length;
    const unhealthy = results.filter(r => !r.healthy).length;

    if (unhealthy > 0) {
      this.logger.warn('Health check summary', {
        total: results.length,
        healthy,
        unhealthy,
      });
    } else {
      this.logger.debug('Health check summary', {
        total: results.length,
        healthy,
      });
    }
  }

  /**
   * Get healthy providers
   */
  private getHealthyProviders(): ProviderWeight[] {
    return this.config.providers.filter(pw => {
      const health = this.providerHealth.get(pw.provider.name);
      return health && health.status !== 'unhealthy';
    });
  }

  /**
   * Get all providers
   */
  getAllProviders(): ProviderWeight[] {
    return [...this.config.providers];
  }

  /**
   * Get provider health status
   */
  getProviderHealth(providerName: string): ProviderHealthStatus | undefined {
    return this.providerHealth.get(providerName);
  }

  /**
   * Get all provider health statuses
   */
  getAllProviderHealth(): Map<string, ProviderHealthStatus> {
    return new Map(this.providerHealth);
  }

  /**
   * Select provider based on strategy
   */
  private selectProvider(): ProviderWeight {
    const healthyProviders = this.getHealthyProviders();

    if (healthyProviders.length === 0) {
      this.logger.error('No healthy providers available');
      throw new ProviderError('No healthy providers available', 'ProviderLoadBalancer');
    }

    switch (this.config.strategy) {
      case 'round-robin':
        return this.selectRoundRobin(healthyProviders);
      case 'least-connections':
        return this.selectLeastConnections(healthyProviders);
      case 'weighted':
        return this.selectWeighted(healthyProviders);
      case 'health-first':
        return this.selectHealthFirst(healthyProviders);
      case 'random':
        return this.selectRandom(healthyProviders);
      default:
        return this.selectRoundRobin(healthyProviders);
    }
  }

  /**
   * Round-robin selection
   */
  private selectRoundRobin(providers: ProviderWeight[]): ProviderWeight {
    const provider = providers[this.currentRoundRobinIndex % providers.length];
    this.currentRoundRobinIndex++;
    return provider;
  }

  /**
   * Least connections selection
   */
  private selectLeastConnections(providers: ProviderWeight[]): ProviderWeight {
    return providers.reduce((min, pw) =>
      pw.currentConnections < min.currentConnections ? pw : min
    );
  }

  /**
   * Weighted selection
   */
  private selectWeighted(providers: ProviderWeight[]): ProviderWeight {
    const totalWeight = providers.reduce((sum, pw) => sum + pw.weight, 0);
    let random = Math.random() * totalWeight;

    for (const pw of providers) {
      random -= pw.weight;
      if (random <= 0) {
        return pw;
      }
    }

    return providers[0];
  }

  /**
   * Health-first selection (lowest latency)
   */
  private selectHealthFirst(providers: ProviderWeight[]): ProviderWeight {
    return providers.reduce((best, pw) => {
      const bestHealth = this.providerHealth.get(best.provider.name);
      const pwHealth = this.providerHealth.get(pw.provider.name);

      if (!bestHealth || !pwHealth) return best;
      if (pwHealth.averageLatency < bestHealth.averageLatency) {
        return pw;
      }
      return best;
    });
  }

  /**
   * Random selection
   */
  private selectRandom(providers: ProviderWeight[]): ProviderWeight {
    const index = Math.floor(Math.random() * providers.length);
    return providers[index];
  }

  /**
   * Increment connection count for a provider
   */
  private incrementConnection(providerName: string): void {
    const pw = this.config.providers.find(pw => pw.provider.name === providerName);
    if (pw) {
      pw.currentConnections++;
    }
  }

  /**
   * Decrement connection count for a provider
   */
  private decrementConnection(providerName: string): void {
    const pw = this.config.providers.find(pw => pw.provider.name === providerName);
    if (pw && pw.currentConnections > 0) {
      pw.currentConnections--;
    }
  }

  /**
   * Increment request count
   */
  private incrementRequestCount(providerName: string): void {
    const count = this.requestCount.get(providerName) ?? 0;
    this.requestCount.set(providerName, count + 1);
  }

  /**
   * Execute completion with load balancing
   */
  async complete(
    model: string,
    messages: Message[],
    options?: CompletionOptions
  ): Promise<CompletionResult> {
    const provider = this.selectProvider();

    this.incrementConnection(provider.provider.name);
    this.incrementRequestCount(provider.provider.name);

    this.logger.debug(`Routing to ${provider.provider.name}`, {
      strategy: this.config.strategy,
      currentConnections: provider.currentConnections,
    });

    try {
      const result = await provider.provider.complete(model, messages, options);
      this.decrementConnection(provider.provider.name);
      return result;
    } catch (error) {
      this.decrementConnection(provider.provider.name);

      // Mark as failed in health
      const health = this.providerHealth.get(provider.provider.name);
      if (health) {
        health.consecutiveFailures++;
        if (health.consecutiveFailures >= this.config.unhealthyThreshold) {
          health.status = 'unhealthy';
          this.logger.warn(`Provider ${provider.provider.name} marked unhealthy after failure`, {
            error: (error as Error).message,
          });
        }
      }

      throw error;
    }
  }

  /**
   * Execute stream with load balancing
   */
  async *stream(
    model: string,
    messages: Message[],
    options?: CompletionOptions
  ): AsyncGenerator<StreamChunk> {
    const provider = this.selectProvider();

    this.incrementConnection(provider.provider.name);
    this.incrementRequestCount(provider.provider.name);

    this.logger.debug(`Streaming to ${provider.provider.name}`, {
      strategy: this.config.strategy,
    });

    try {
      for await (const chunk of provider.provider.stream(model, messages, options)) {
        yield chunk;
      }
      this.decrementConnection(provider.provider.name);
    } catch (error) {
      this.decrementConnection(provider.provider.name);

      // Mark as failed in health
      const health = this.providerHealth.get(provider.provider.name);
      if (health) {
        health.consecutiveFailures++;
        if (health.consecutiveFailures >= this.config.unhealthyThreshold) {
          health.status = 'unhealthy';
          this.logger.warn(`Provider ${provider.provider.name} marked unhealthy after streaming failure`, {
            error: (error as Error).message,
          });
        }
      }

      throw error;
    }
  }

  /**
   * Count tokens (use first available provider)
   */
  async countTokens(messages: Message[]): Promise<number> {
    const healthyProviders = this.getHealthyProviders();

    if (healthyProviders.length === 0) {
      throw new ProviderError('No healthy providers available', 'ProviderLoadBalancer');
    }

    // Use first healthy provider
    return await healthyProviders[0].provider.countTokens(messages);
  }

  /**
   * Get statistics
   */
  getStatistics(): LoadBalancerStatistics {
    const stats: LoadBalancerStatistics = {
      totalProviders: this.config.providers.length,
      healthyProviders: 0,
      unhealthyProviders: 0,
      degradedProviders: 0,
      totalRequests: 0,
      requestsByProvider: {},
      currentConnections: {},
      averageLatencyByProvider: {},
    };

    for (const [name, health] of this.providerHealth) {
      if (health.status === 'healthy') {
        stats.healthyProviders++;
      } else if (health.status === 'unhealthy') {
        stats.unhealthyProviders++;
      } else {
        stats.degradedProviders++;
      }

      stats.averageLatencyByProvider[name] = health.averageLatency;
    }

    for (const [name, count] of this.requestCount) {
      stats.requestsByProvider[name] = count;
      stats.totalRequests += count;
    }

    for (const pw of this.config.providers) {
      stats.currentConnections[pw.provider.name] = pw.currentConnections;
    }

    return stats;
  }

  /**
   * Reset connection counts
   */
  resetConnectionCounts(): void {
    for (const pw of this.config.providers) {
      pw.currentConnections = 0;
    }
    this.logger.info('Connection counts reset');
  }

  /**
   * Reset request counts
   */
  resetRequestCounts(): void {
    this.requestCount.clear();
    this.logger.info('Request counts reset');
  }

  /**
   * Reset all statistics
   */
  resetStatistics(): void {
    this.resetConnectionCounts();
    this.resetRequestCounts();

    for (const health of this.providerHealth.values()) {
      health.consecutiveFailures = 0;
      health.consecutiveSuccesses = 0;
      health.latencyHistory = [];
      health.averageLatency = 0;
      health.status = 'healthy';
    }

    this.logger.info('All statistics reset');
  }

  /**
   * Get configuration
   */
  getConfig(): Readonly<LoadBalancerConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<LoadBalancerConfig>): void {
    const wasEnabled = this.config.enableHealthChecks;

    this.config = { ...this.config, ...config };

    // Restart health checks if needed
    if (this.config.enableHealthChecks && !wasEnabled) {
      this.startHealthChecks();
    } else if (!this.config.enableHealthChecks && wasEnabled) {
      this.stopHealthChecks();
    }

    this.logger.info('Load balancer configuration updated');
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopHealthChecks();
    this.providerHealth.clear();
    this.requestCount.clear();
    this.logger.info('Load balancer destroyed');
  }
}

/**
 * Load balancer statistics
 */
export interface LoadBalancerStatistics {
  totalProviders: number;
  healthyProviders: number;
  unhealthyProviders: number;
  degradedProviders: number;
  totalRequests: number;
  requestsByProvider: Record<string, number>;
  currentConnections: Record<string, number>;
  averageLatencyByProvider: Record<string, number>;
}

/**
 * Default load balancer configuration
 */
export const DEFAULT_LOAD_BALANCER_CONFIG: LoadBalancerConfig = {
  providers: [],
  strategy: 'health-first',
  healthCheckIntervalMs: 30000, // 30 seconds
  healthCheckTimeoutMs: 5000, // 5 seconds
  unhealthyThreshold: 3, // 3 consecutive failures
  recoveryThreshold: 2, // 2 consecutive successes
  enableHealthChecks: true,
};

/**
 * Create a provider load balancer with default configuration
 */
export function createProviderLoadBalancer(
  providers: AIProvider[],
  config?: Partial<LoadBalancerConfig>
): ProviderLoadBalancer {
  const fullConfig: LoadBalancerConfig = {
    ...DEFAULT_LOAD_BALANCER_CONFIG,
    providers: providers.map(p => ({
      provider: p,
      weight: 1,
      maxConnections: 100,
      currentConnections: 0,
    })),
    ...config,
  };

  return new ProviderLoadBalancer(fullConfig);
}
