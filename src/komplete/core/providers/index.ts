/**
 * Provider System Exports
 *
 * Exports all provider system components including:
 * - Base provider abstraction
 * - Model router
 * - Provider registry
 * - Individual provider implementations
 */

// Base provider abstraction
export {
  BaseProvider,
  type BaseProviderConfig,
} from './base';

// Model router
export {
  ModelRouter,
  type ParsedModel,
  type RouterConfig,
  initModelRouter,
  getModelRouter,
} from './router';

// Provider registry
export {
  ProviderRegistry,
  type ProviderEntry,
  type RegistryConfig,
  initProviderRegistry,
  getProviderRegistry,
} from './registry';

// Provider implementations
export {
  OpenAIProvider,
  type OpenAIConfig,
} from './openai';

export {
  AnthropicProvider,
  type AnthropicConfig,
} from './anthropic';

export {
  OllamaProvider,
  type OllamaConfig,
} from './ollama';

/**
 * Initialize all default providers
 *
 * Registers OpenAI, Anthropic, and Ollama providers
 * with configuration from the config manager.
 *
 * @param config - Configuration object with provider settings
 * @param logger - Logger instance
 */
export async function initializeProviders(
  config: {
    openai?: { apiKey?: string; baseUrl?: string; defaultModel?: string };
    anthropic?: { apiKey?: string; baseUrl?: string; defaultModel?: string };
    ollama?: { baseUrl?: string; defaultModel?: string };
  },
  logger?: any
): Promise<void> {
  const { getProviderRegistry } = await import('./registry');

  const registry = getProviderRegistry();

  // Register OpenAI provider if API key is available
  if (config.openai?.apiKey) {
    const { OpenAIProvider } = await import('./openai');
    registry.register(
      new OpenAIProvider(
        {
          apiKey: config.openai.apiKey,
          baseUrl: config.openai.baseUrl,
          defaultModel: config.openai.defaultModel ?? 'gpt-4o',
        },
        logger
      ),
      10 // Priority
    );
  }

  // Register Anthropic provider if API key is available
  if (config.anthropic?.apiKey) {
    const { AnthropicProvider } = await import('./anthropic');
    registry.register(
      new AnthropicProvider(
        {
          apiKey: config.anthropic.apiKey,
          baseUrl: config.anthropic.baseUrl,
          defaultModel: config.anthropic.defaultModel ?? 'claude-3.5-sonnet',
        },
        logger
      ),
      10 // Priority
    );
  }

  // Register Ollama provider if base URL is available
  if (config.ollama?.baseUrl) {
    const { OllamaProvider } = await import('./ollama');
    registry.register(
      new OllamaProvider(
        {
          baseUrl: config.ollama.baseUrl,
          defaultModel: config.ollama.defaultModel ?? 'llama3',
        },
        logger
      ),
      5 // Lower priority for local provider
    );
  }
}
