/**
 * Model Router
 *
 * Handles prefix-based routing of model strings to appropriate providers.
 * Model format: <prefix>/<model-name>
 * Example: oai/gpt-4o, anthropic/claude-3.5-sonnet, ollama/llama3
 */

import type { ProviderPrefix, AIProvider } from '../../types';
import { ProviderError } from '../../types';
import { Logger } from '../../utils/logger';
import { getProviderRegistry } from './registry';

/**
 * Parsed model information
 */
export interface ParsedModel {
  prefix: ProviderPrefix;
  modelName: string;
  fullModel: string;
}

/**
 * Model router configuration
 */
export interface RouterConfig {
  defaultPrefix?: ProviderPrefix;
  defaultModel?: string;
}

/**
 * Model Router class
 *
 * Routes model strings to the appropriate provider based on prefix.
 */
export class ModelRouter {
  private logger: Logger;
  private config: RouterConfig;

  constructor(config: RouterConfig = {}, logger?: Logger) {
    this.logger = logger ?? new Logger().child('ModelRouter');
    this.config = config;
  }

  /**
   * Parse a model string into prefix and model name
   *
   * @param model - Model string (e.g., "oai/gpt-4o" or "gpt-4o")
   * @returns Parsed model information
   * @throws {ProviderError} If model string is invalid
   */
  parseModel(model: string): ParsedModel {
    if (!model || model.trim().length === 0) {
      throw new ProviderError('Model string cannot be empty', 'ModelRouter', { model });
    }

    const trimmed = model.trim();

    // Check if model has a prefix
    const match = trimmed.match(/^([a-z]+)\/(.+)$/i);

    if (match) {
      const prefix = match[1].toLowerCase() as ProviderPrefix;
      const modelName = match[2];

      // Validate prefix
      const validPrefixes: ProviderPrefix[] = ['or', 'g', 'oai', 'anthropic', 'ollama', 'fl'];
      if (!validPrefixes.includes(prefix)) {
        throw new ProviderError(
          `Invalid provider prefix: ${prefix}`,
          'ModelRouter',
          { model, prefix, validPrefixes }
        );
      }

      this.logger.debug(`Parsed model with prefix: ${prefix}/${modelName}`, 'ModelRouter');

      return {
        prefix,
        modelName,
        fullModel: trimmed,
      };
    }

    // No prefix - use default
    const defaultPrefix = this.config.defaultPrefix ?? 'oai';
    const defaultModel = this.config.defaultModel ?? 'gpt-4o';

    this.logger.debug(`No prefix found, using default: ${defaultPrefix}/${trimmed}`, 'ModelRouter');

    return {
      prefix: defaultPrefix,
      modelName: trimmed,
      fullModel: `${defaultPrefix}/${trimmed}`,
    };
  }

  /**
   * Get the provider for a model string
   *
   * @param model - Model string
   * @returns AI provider instance
   * @throws {ProviderError} If provider is not registered
   */
  getProvider(model: string): AIProvider {
    const parsed = this.parseModel(model);
    const registry = getProviderRegistry();

    const provider = registry.get(parsed.prefix);

    if (!provider) {
      throw new ProviderError(
        `Provider '${parsed.prefix}' is not registered`,
        'ModelRouter',
        { model, prefix: parsed.prefix }
      );
    }

    this.logger.debug(`Routed model ${model} to provider ${provider.name}`, 'ModelRouter');

    return provider;
  }

  /**
   * Get the provider prefix for a model string
   *
   * @param model - Model string
   * @returns Provider prefix
   */
  getPrefix(model: string): ProviderPrefix {
    return this.parseModel(model).prefix;
  }

  /**
   * Get the model name without prefix
   *
   * @param model - Model string
   * @returns Model name
   */
  getModelName(model: string): string {
    return this.parseModel(model).modelName;
  }

  /**
   * Get the full model string with prefix
   *
   * @param model - Model string
   * @returns Full model string
   */
  getFullModel(model: string): string {
    return this.parseModel(model).fullModel;
  }

  /**
   * Check if a model string has a prefix
   *
   * @param model - Model string
   * @returns True if prefix is present
   */
  hasPrefix(model: string): boolean {
    return /^([a-z]+)\/(.+)$/i.test(model.trim());
  }

  /**
   * Set default prefix
   *
   * @param prefix - Default provider prefix
   */
  setDefaultPrefix(prefix: ProviderPrefix): void {
    this.config.defaultPrefix = prefix;
    this.logger.debug(`Default prefix set to: ${prefix}`, 'ModelRouter');
  }

  /**
   * Set default model
   *
   * @param model - Default model name
   */
  setDefaultModel(model: string): void {
    this.config.defaultModel = model;
    this.logger.debug(`Default model set to: ${model}`, 'ModelRouter');
  }

  /**
   * Get router configuration
   *
   * @returns Current router configuration
   */
  getConfig(): Readonly<RouterConfig> {
    return { ...this.config };
  }
}

/**
 * Global model router instance
 */
let globalModelRouter: ModelRouter | null = null;

/**
 * Initialize global model router
 *
 * @param config - Router configuration
 * @param logger - Logger instance
 * @returns Model router instance
 */
export function initModelRouter(config?: RouterConfig, logger?: Logger): ModelRouter {
  globalModelRouter = new ModelRouter(config ?? {}, logger);
  return globalModelRouter;
}

/**
 * Get global model router
 *
 * @returns Model router instance
 */
export function getModelRouter(): ModelRouter {
  if (!globalModelRouter) {
    globalModelRouter = new ModelRouter();
  }
  return globalModelRouter;
}
