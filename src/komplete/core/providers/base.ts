/**
 * AI Provider Abstraction Layer
 *
 * Provides the base interface and abstract class for all AI providers.
 * This abstraction allows for consistent interaction with different AI services.
 */

import type {
  AIProvider,
  Message,
  CompletionOptions,
  CompletionResult,
  StreamChunk,
  ProviderCapabilities,
  ProviderPrefix,
  Tool,
} from '../../types';
import { ProviderError } from '../../types';
import { Logger, LoggerLike } from '../../utils/logger';

/**
 * Base provider configuration
 */
export interface BaseProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  timeout?: number;
}

/**
 * Abstract base class for all AI providers
 *
 * Implementations must provide:
 * - complete(): Generate a full completion
 * - stream(): Generate a streaming completion
 * - countTokens(): Count tokens in messages
 *
 * @abstract
 */
export abstract class BaseProvider implements AIProvider {
  protected logger: LoggerLike;
  protected config: BaseProviderConfig;
  /** Provider capabilities - public to satisfy AIProvider interface */
  public capabilities: ProviderCapabilities;

  /**
   * Create a new base provider instance
   *
   * @param config - Provider configuration
   * @param logger - Logger instance
   * @param providerName - Provider name for logging context
   */
  constructor(config: BaseProviderConfig, logger?: LoggerLike, providerName: string = 'BaseProvider') {
    this.config = config;
    this.logger = logger?.child(providerName) ?? new Logger().child(providerName);
    this.capabilities = this.initializeCapabilities();
  }

  /**
   * Get provider name
   */
  abstract get name(): string;

  /**
   * Get provider prefix
   */
  abstract get prefix(): ProviderPrefix;

  /**
   * Get provider capabilities
   */
  getCapabilities(): ProviderCapabilities {
    return this.capabilities;
  }

  /**
   * Initialize provider capabilities
   * Override this method to customize capabilities
   */
  protected initializeCapabilities(): ProviderCapabilities {
    return {
      streaming: false,
      tools: false,
      vision: false,
      maxTokens: 4096,
    };
  }

  /**
   * Generate a complete completion
   *
   * @param model - Model identifier
   * @param messages - Array of messages
   * @param options - Completion options
   * @returns Completion result
   */
  abstract complete(
    model: string,
    messages: Message[],
    options?: CompletionOptions
  ): Promise<CompletionResult>;

  /**
   * Generate a streaming completion
   *
   * @param model - Model identifier
   * @param messages - Array of messages
   * @param options - Completion options
   * @returns Async generator of stream chunks
   */
  abstract stream(
    model: string,
    messages: Message[],
    options?: CompletionOptions
  ): AsyncGenerator<StreamChunk>;

  /**
   * Count tokens in messages
   *
   * @param messages - Array of messages
   * @returns Token count
   */
  abstract countTokens(messages: Message[]): Promise<number>;

  /**
   * Validate API key is present
   *
   * @throws {ProviderError} If API key is missing
   */
  protected validateApiKey(): void {
    if (!this.config.apiKey && this.requiresApiKey()) {
      throw new ProviderError(
        'API key is required for this provider',
        this.name,
        'AUTH_ERROR',
        { provider: this.name }
      );
    }
  }

  /**
   * Check if provider requires API key
   * Override this for providers that don't require API keys (e.g., Ollama)
   */
  protected requiresApiKey(): boolean {
    return true;
  }

  /**
   * Validate messages array
   *
   * @param messages - Messages to validate
   * @throws {ProviderError} If messages are invalid
   */
  protected validateMessages(messages: Message[]): void {
    if (!messages || messages.length === 0) {
      throw new ProviderError(
        'Messages array cannot be empty',
        this.name,
        'VALIDATION_ERROR',
        { messages }
      );
    }

    for (const msg of messages) {
      if (!msg.role || !msg.content) {
        throw new ProviderError(
          'Each message must have role and content',
          this.name,
          'VALIDATION_ERROR',
          { message: msg }
        );
      }
    }
  }

  /**
   * Validate completion options
   *
   * @param options - Options to validate
   * @throws {ProviderError} If options are invalid
   */
  protected validateOptions(options?: CompletionOptions): void {
    if (!options) {
      return;
    }

    if (options.maxTokens !== undefined && options.maxTokens <= 0) {
      throw new ProviderError(
        'maxTokens must be greater than 0',
        this.name,
        'VALIDATION_ERROR',
        { maxTokens: options.maxTokens }
      );
    }

    if (options.temperature !== undefined && (options.temperature < 0 || options.temperature > 2)) {
      throw new ProviderError(
        'temperature must be between 0 and 2',
        this.name,
        'VALIDATION_ERROR',
        { temperature: options.temperature }
      );
    }

    if (options.topP !== undefined && (options.topP < 0 || options.topP > 1)) {
      throw new ProviderError(
        'topP must be between 0 and 1',
        this.name,
        'VALIDATION_ERROR',
        { topP: options.topP }
      );
    }

    if (options.tools && !this.capabilities.tools) {
      throw new ProviderError(
        'This provider does not support tools',
        this.name,
        'CAPABILITY_ERROR',
        { provider: this.name }
      );
    }
  }

  /**
   * Extract text from message content
   *
   * @param content - Message content
   * @returns Extracted text
   */
  protected extractText(content: Message['content']): string {
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .map((item) => {
          if (typeof item === 'string') {
            return item;
          }
          if (item.type === 'text') {
            return item.text;
          }
          return '';
        })
        .join('');
    }

    if (typeof content === 'object' && content !== null) {
      if (content.type === 'text') {
        return content.text;
      }
    }

    return '';
  }

  /**
   * Convert tools to provider-specific format
   *
   * @param tools - Array of tools
   * @returns Provider-specific tool format
   */
  protected convertTools(tools?: Tool[]): unknown {
    if (!tools || tools.length === 0) {
      return undefined;
    }

    // Default implementation - override for provider-specific format
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    }));
  }

  /**
   * Handle provider-specific errors
   *
   * @param error - Error from provider SDK
   * @throws {ProviderError} Wrapped error
   */
  protected handleError(error: unknown): never {
    if (error instanceof Error) {
      throw new ProviderError(
        error.message,
        this.name,
        'PROVIDER_ERROR',
        {
          originalError: error.name,
          stack: error.stack,
        }
      );
    }

    throw new ProviderError(
      String(error),
      this.name,
      'PROVIDER_ERROR',
      { error }
    );
  }

  /**
   * Get default model for this provider
   *
   * @returns Default model name
   */
  getDefaultModel(): string {
    return this.config.defaultModel ?? 'default';
  }

  /**
   * Get base URL for this provider
   *
   * @returns Base URL
   */
  getBaseUrl(): string | undefined {
    return this.config.baseUrl;
  }

  /**
   * Get timeout in milliseconds
   *
   * @returns Timeout value
   */
  getTimeout(): number {
    return this.config.timeout ?? 30000; // Default 30 seconds
  }
}
