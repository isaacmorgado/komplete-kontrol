/**
 * Provider Registry
 *
 * Central registry for managing AI providers.
 * Allows registration, lookup, and listing of available providers.
 */

import type { AIProvider, ProviderPrefix } from '../../types';
import { ProviderError } from '../../types';
import { Logger } from '../../utils/logger';

/**
 * Provider entry in registry
 */
export interface ProviderEntry {
  provider: AIProvider;
  registeredAt: Date;
  priority: number;
}

/**
 * Provider registry configuration
 */
export interface RegistryConfig {
  autoRegister?: boolean;
}

/**
 * Provider Registry class
 *
 * Manages registration and retrieval of AI providers.
 */
export class ProviderRegistry {
  private logger: Logger;
  private providers: Map<ProviderPrefix, ProviderEntry> = new Map();
  private config: RegistryConfig;

  constructor(config: RegistryConfig = {}, logger?: Logger) {
    this.logger = logger ?? new Logger().child('ProviderRegistry');
    this.config = config;

    if (config.autoRegister !== false) {
      this.logger.info('Auto-registration enabled', 'ProviderRegistry');
    }
  }

  /**
   * Register a provider
   *
   * @param provider - Provider instance to register
   * @param priority - Priority for this provider (higher = preferred)
   * @throws {ProviderError} If provider is already registered
   */
  register(provider: AIProvider, priority: number = 0): void {
    const prefix = provider.prefix;

    if (this.providers.has(prefix)) {
      throw new ProviderError(
        `Provider with prefix '${prefix}' is already registered`,
        'ProviderRegistry',
        { prefix, existingProvider: this.providers.get(prefix)!.provider.name }
      );
    }

    const entry: ProviderEntry = {
      provider,
      registeredAt: new Date(),
      priority,
    };

    this.providers.set(prefix, entry);

    this.logger.info(
      `Registered provider: ${provider.name} (prefix: ${prefix}, priority: ${priority})`,
      'ProviderRegistry'
    );
  }

  /**
   * Unregister a provider
   *
   * @param prefix - Provider prefix to unregister
   * @returns True if provider was unregistered
   */
  unregister(prefix: ProviderPrefix): boolean {
    const entry = this.providers.get(prefix);

    if (!entry) {
      this.logger.warn(`Provider '${prefix}' not found, cannot unregister`, 'ProviderRegistry');
      return false;
    }

    this.providers.delete(prefix);

    this.logger.info(
      `Unregistered provider: ${entry.provider.name} (prefix: ${prefix})`,
      'ProviderRegistry'
    );

    return true;
  }

  /**
   * Get a provider by prefix
   *
   * @param prefix - Provider prefix
   * @returns Provider instance or undefined
   */
  get(prefix: ProviderPrefix): AIProvider | undefined {
    const entry = this.providers.get(prefix);
    return entry?.provider;
  }

  /**
   * Check if a provider is registered
   *
   * @param prefix - Provider prefix
   * @returns True if provider is registered
   */
  has(prefix: ProviderPrefix): boolean {
    return this.providers.has(prefix);
  }

  /**
   * Get all registered providers
   *
   * @returns Array of registered providers
   */
  getAll(): AIProvider[] {
    return Array.from(this.providers.values())
      .map((entry) => entry.provider);
  }

  /**
   * Get all registered prefixes
   *
   * @returns Array of provider prefixes
   */
  getPrefixes(): ProviderPrefix[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get provider entries with metadata
   *
   * @returns Array of provider entries
   */
  getEntries(): ProviderEntry[] {
    return Array.from(this.providers.values());
  }

  /**
   * List providers with their information
   *
   * @returns Array of provider information objects
   */
  list(): Array<{
    name: string;
    prefix: ProviderPrefix;
    capabilities: {
      streaming: boolean;
      tools: boolean;
      vision: boolean;
      maxTokens: number;
    };
    registeredAt: Date;
    priority: number;
  }> {
    return this.getEntries().map((entry) => ({
      name: entry.provider.name,
      prefix: entry.provider.prefix,
      capabilities: entry.provider.capabilities,
      registeredAt: entry.registeredAt,
      priority: entry.priority,
    }));
  }

  /**
   * Get provider statistics
   *
   * @returns Registry statistics
   */
  getStatistics(): {
    totalProviders: number;
    streamingProviders: number;
    toolsProviders: number;
    visionProviders: number;
    providersByPrefix: Record<string, string>;
  } {
    const entries = this.getEntries();

    return {
      totalProviders: entries.length,
      streamingProviders: entries.filter((e) => e.provider.capabilities.streaming).length,
      toolsProviders: entries.filter((e) => e.provider.capabilities.tools).length,
      visionProviders: entries.filter((e) => e.provider.capabilities.vision).length,
      providersByPrefix: entries.reduce(
        (acc, entry) => ({
          ...acc,
          [entry.provider.prefix]: entry.provider.name,
        }),
        {} as Record<string, string>
      ),
    };
  }

  /**
   * Clear all registered providers
   */
  clear(): void {
    const count = this.providers.size;
    this.providers.clear();

    this.logger.info(`Cleared ${count} providers from registry`, 'ProviderRegistry');
  }

  /**
   * Get registry configuration
   *
   * @returns Current configuration
   */
  getConfig(): Readonly<RegistryConfig> {
    return { ...this.config };
  }
}

/**
 * Global provider registry instance
 */
let globalProviderRegistry: ProviderRegistry | null = null;

/**
 * Initialize global provider registry
 *
 * @param config - Registry configuration
 * @param logger - Logger instance
 * @returns Provider registry instance
 */
export function initProviderRegistry(config?: RegistryConfig, logger?: Logger): ProviderRegistry {
  globalProviderRegistry = new ProviderRegistry(config ?? {}, logger);
  return globalProviderRegistry;
}

/**
 * Get global provider registry
 *
 * @returns Provider registry instance
 */
export function getProviderRegistry(): ProviderRegistry {
  if (!globalProviderRegistry) {
    globalProviderRegistry = new ProviderRegistry();
  }
  return globalProviderRegistry;
}
