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

export {
  FeatherlessProvider,
  type FeatherlessConfig,
} from './featherless';

export {
  GeminiProvider,
  type GeminiConfig,
} from './gemini';

export {
  GLMProvider,
  type GLMConfig,
} from './glm';

// Model proxy server for universal tool calling
export {
  ModelProxyServer,
  type ModelProxyConfig,
  type ModelCapabilities,
  type ExtractedToolCall,
  initModelProxy,
  getModelProxy,
} from './model-proxy-server';

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
    featherless?: { apiKey?: string; baseUrl?: string; defaultModel?: string };
    gemini?: { apiKey?: string; baseUrl?: string; defaultModel?: string };
    glm?: { apiKey?: string; baseUrl?: string; defaultModel?: string };
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

  // Register Featherless provider if API key is available
  if (config.featherless?.apiKey) {
    const { FeatherlessProvider } = await import('./featherless');
    registry.register(
      new FeatherlessProvider(
        {
          apiKey: config.featherless.apiKey,
          baseUrl: config.featherless.baseUrl,
          defaultModel: config.featherless.defaultModel ?? 'dolphin-3-venice-24b',
        },
        logger
      ),
      8 // High priority for abliterated models
    );
  }

  // Register Gemini provider if API key is available
  if (config.gemini?.apiKey) {
    const { GeminiProvider } = await import('./gemini');
    registry.register(
      new GeminiProvider(
        {
          apiKey: config.gemini.apiKey,
          baseUrl: config.gemini.baseUrl,
          defaultModel: config.gemini.defaultModel ?? 'gemini-2.0-flash',
        },
        logger
      ),
      9 // High priority for fast, vision-capable models
    );
  }

  // Register GLM provider if API key is available
  if (config.glm?.apiKey) {
    const { GLMProvider } = await import('./glm');
    registry.register(
      new GLMProvider(
        {
          apiKey: config.glm.apiKey,
          baseUrl: config.glm.baseUrl,
          defaultModel: config.glm.defaultModel ?? 'glm-4.7',
        },
        logger
      ),
      7 // Priority for multilingual/Chinese support
    );
  }
}
