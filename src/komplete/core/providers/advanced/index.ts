/**
 * Advanced Provider Features Module
 *
 * Provides advanced provider capabilities including:
 * - Fallback with exponential backoff retry
 * - Load balancing with health monitoring
 * - Streaming response handling
 * - Caching with TTL and invalidation
 * - Rate limiting with token bucket algorithm
 */

export * from './fallback';
export * from './load-balancer';
export * from './streaming';
export * from './caching';
export * from './rate-limiter';
export * from './token-counter';
export * from './embeddings';
export * from './persistent-cache';
export * from './cost-tracker';

/**
 * Create a fully-featured provider with all advanced features
 *
 * Combines fallback, load balancing, streaming, caching, and rate limiting
 * into a single provider interface.
 */
import type { AIProvider } from '../../../types';
import {
  ProviderFallbackManager,
  createProviderFallbackManager,
  type FallbackManagerConfig,
} from './fallback';
import {
  ProviderLoadBalancer,
  createProviderLoadBalancer,
  type LoadBalancerConfig,
} from './load-balancer';
import {
  ResponseCache,
  createResponseCache,
  CachedProvider,
  createCachedProvider,
  type CacheConfig,
} from './caching';
import {
  RateLimiter,
  createRateLimiter,
  RateLimitedProvider,
  createRateLimitedProvider,
  type RateLimitConfig,
} from './rate-limiter';

/**
 * Advanced provider configuration
 */
export interface AdvancedProviderConfig {
  fallback?: FallbackManagerConfig;
  loadBalancer?: LoadBalancerConfig;
  cache?: CacheConfig;
  rateLimiter?: RateLimitConfig;
}

/**
 * Create an advanced provider with all features enabled
 *
 * @param providers - Array of providers to use
 * @param config - Configuration for advanced features
 * @returns A provider with fallback, load balancing, caching, and rate limiting
 */
export function createAdvancedProvider(
  providers: AIProvider[],
  config?: AdvancedProviderConfig
): AIProvider {
  const primaryProvider = providers[0];
  if (!primaryProvider) {
    throw new Error('At least one provider is required');
  }

  let provider: AIProvider = primaryProvider;

  // Add rate limiting
  if (config?.rateLimiter) {
    const rateLimiter = createRateLimiter(config.rateLimiter);
    provider = createRateLimitedProvider(provider, rateLimiter);
  }

  // Add caching
  if (config?.cache) {
    const cache = createResponseCache(config.cache);
    provider = createCachedProvider(provider, cache);
  }

  // Add load balancing if multiple providers
  if (providers.length > 1) {
    const loadBalancer = createProviderLoadBalancer(providers, config?.loadBalancer);
    provider = loadBalancer as unknown as AIProvider;
  }

  // Add fallback if multiple providers
  if (providers.length > 1 && config?.fallback) {
    const fallbackManager = createProviderFallbackManager(
      primaryProvider,
      providers.slice(1),
      config.fallback
    );
    provider = fallbackManager as unknown as AIProvider;
  }

  return provider;
}

/**
 * Create an advanced provider with specific features
 *
 * @param provider - Base provider to enhance
 * @param features - Features to enable
 * @returns Enhanced provider
 */
export function enhanceProvider(
  provider: AIProvider,
  features: {
    enableRateLimiting?: boolean;
    enableCaching?: boolean;
    enableFallback?: boolean;
    fallbackProviders?: AIProvider[];
  }
): AIProvider {
  let enhancedProvider: AIProvider = provider;

  // Add rate limiting
  if (features.enableRateLimiting) {
    const rateLimiter = createRateLimiter();
    enhancedProvider = createRateLimitedProvider(enhancedProvider, rateLimiter);
  }

  // Add caching
  if (features.enableCaching) {
    const cache = createResponseCache();
    enhancedProvider = createCachedProvider(enhancedProvider, cache);
  }

  // Add fallback
  if (features.enableFallback && features.fallbackProviders) {
    const fallbackManager = createProviderFallbackManager(
      enhancedProvider,
      features.fallbackProviders
    );
    enhancedProvider = fallbackManager as unknown as AIProvider;
  }

  return enhancedProvider;
}
