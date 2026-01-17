/**
 * Token Counter for KOMPLETE-KONTROL CLI
 *
 * Provides accurate token counting using tiktoken for OpenAI models
 * and provider-specific algorithms for other providers.
 */

import { getEncoding, encodingForModel, type TiktokenEncoding, type Tiktoken } from 'js-tiktoken';
import type { Message, MessageContent, TextContent, ToolUseContent, ToolResultContent } from '../../../types';
import { Logger } from '../../../utils/logger';

/**
 * Token count result
 */
export interface TokenCountResult {
  /**
   * Number of tokens
   */
  tokens: number;

  /**
   * Encoding used
   */
  encoding: string;

  /**
   * Model name if applicable
   */
  model?: string;

  /**
   * Whether result was from cache
   */
  cached: boolean;
}

/**
 * Token counter configuration
 */
export interface TokenCounterConfig {
  /**
   * Default encoding to use
   */
  defaultEncoding: TiktokenEncoding;

  /**
   * Enable caching of token counts
   */
  enableCache: boolean;

  /**
   * Maximum cache size
   */
  cacheMaxSize: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: TokenCounterConfig = {
  defaultEncoding: 'cl100k_base',
  enableCache: true,
  cacheMaxSize: 1000,
};

/**
 * Model to encoding mapping
 */
const MODEL_ENCODINGS: Record<string, TiktokenEncoding> = {
  // GPT-4 models
  'gpt-4': 'cl100k_base',
  'gpt-4-turbo': 'cl100k_base',
  'gpt-4-turbo-preview': 'cl100k_base',
  'gpt-4o': 'o200k_base',
  'gpt-4o-mini': 'o200k_base',
  'gpt-4-32k': 'cl100k_base',
  // GPT-3.5 models
  'gpt-3.5-turbo': 'cl100k_base',
  'gpt-3.5-turbo-16k': 'cl100k_base',
  // Text models
  'text-davinci-003': 'p50k_base',
  'text-davinci-002': 'p50k_base',
  'text-curie-001': 'r50k_base',
  'text-babbage-001': 'r50k_base',
  'text-ada-001': 'r50k_base',
  // Embedding models
  'text-embedding-ada-002': 'cl100k_base',
  'text-embedding-3-small': 'cl100k_base',
  'text-embedding-3-large': 'cl100k_base',
};

/**
 * Tiktoken-based token counter
 *
 * Provides accurate token counting for OpenAI models using tiktoken.
 */
export class TiktokenCounter {
  private logger: Logger;
  private config: TokenCounterConfig;
  private encoderCache: Map<TiktokenEncoding, Tiktoken> = new Map();
  private tokenCache: Map<string, number> = new Map();

  constructor(config: Partial<TokenCounterConfig> = {}, logger?: Logger) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = logger?.child('TiktokenCounter') ?? new Logger().child('TiktokenCounter');
    this.logger.debug('TiktokenCounter initialized', 'TiktokenCounter', {
      defaultEncoding: this.config.defaultEncoding,
    });
  }

  /**
   * Get encoder for a specific encoding
   */
  private getEncoder(encoding: TiktokenEncoding): Tiktoken {
    let encoder = this.encoderCache.get(encoding);

    if (!encoder) {
      encoder = getEncoding(encoding);
      this.encoderCache.set(encoding, encoder);
      this.logger.debug(`Created encoder for encoding: ${encoding}`, 'TiktokenCounter');
    }

    return encoder;
  }

  /**
   * Get encoding for a model
   */
  getEncodingForModel(model: string): TiktokenEncoding {
    // Remove provider prefix if present (e.g., "oai/gpt-4" -> "gpt-4")
    const cleanModel = model.includes('/') ? model.split('/')[1]! : model;

    // Check exact match
    if (MODEL_ENCODINGS[cleanModel]) {
      return MODEL_ENCODINGS[cleanModel];
    }

    // Check prefix match
    for (const [modelPrefix, encoding] of Object.entries(MODEL_ENCODINGS)) {
      if (cleanModel.startsWith(modelPrefix)) {
        return encoding;
      }
    }

    // Default to cl100k_base (most common for modern models)
    this.logger.debug(`Unknown model ${model}, using default encoding`, 'TiktokenCounter');
    return this.config.defaultEncoding;
  }

  /**
   * Count tokens in a string
   */
  countString(text: string, model?: string): TokenCountResult {
    const encoding = model ? this.getEncodingForModel(model) : this.config.defaultEncoding;
    const cacheKey = this.config.enableCache ? `${encoding}:${text}` : '';

    // Check cache
    if (this.config.enableCache && this.tokenCache.has(cacheKey)) {
      return {
        tokens: this.tokenCache.get(cacheKey)!,
        encoding,
        model,
        cached: true,
      };
    }

    // Count tokens
    const encoder = this.getEncoder(encoding);
    const tokens = encoder.encode(text).length;

    // Cache result
    if (this.config.enableCache) {
      if (this.tokenCache.size >= this.config.cacheMaxSize) {
        // Clear oldest entries (simple FIFO)
        const firstKey = this.tokenCache.keys().next().value;
        if (firstKey) {
          this.tokenCache.delete(firstKey);
        }
      }
      this.tokenCache.set(cacheKey, tokens);
    }

    return {
      tokens,
      encoding,
      model,
      cached: false,
    };
  }

  /**
   * Count tokens in message content
   */
  countContent(content: MessageContent | Array<MessageContent>, model?: string): number {
    if (!Array.isArray(content)) {
      return this.countSingleContent(content, model);
    }

    return content.reduce((total, c) => total + this.countSingleContent(c, model), 0);
  }

  /**
   * Count tokens in a single content block
   */
  private countSingleContent(content: MessageContent, model?: string): number {
    switch (content.type) {
      case 'text':
        return this.countString((content as TextContent).text, model).tokens;

      case 'tool_use': {
        const toolUse = content as ToolUseContent;
        // Count tool name + JSON stringified input
        const toolText = `${toolUse.name}\n${JSON.stringify(toolUse.input)}`;
        return this.countString(toolText, model).tokens + 10; // Add overhead for tool structure
      }

      case 'tool_result': {
        const toolResult = content as ToolResultContent;
        const resultContent = toolResult.content;
        if (typeof resultContent === 'string') {
          return this.countString(resultContent, model).tokens + 5; // Add overhead
        }
        if (Array.isArray(resultContent)) {
          return resultContent.reduce((total, c) => total + this.countSingleContent(c, model), 0) + 5;
        }
        return 5; // Just overhead
      }

      case 'image':
        // Images have a fixed token cost in most models
        // This is an approximation; actual cost depends on image size
        return 85; // Low-res image default

      default:
        return 0;
    }
  }

  /**
   * Count tokens in messages
   */
  countMessages(messages: Message[], model?: string): number {
    let total = 0;

    for (const message of messages) {
      // Add message overhead (role, formatting)
      total += 4; // Approximation for message structure tokens

      // Count content
      total += this.countContent(message.content, model);
    }

    // Add conversation overhead
    total += 3; // Beginning/end tokens

    return total;
  }

  /**
   * Clear token cache
   */
  clearCache(): void {
    this.tokenCache.clear();
    this.logger.debug('Token cache cleared', 'TiktokenCounter');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
  } {
    return {
      size: this.tokenCache.size,
      maxSize: this.config.cacheMaxSize,
      hitRate: 0, // Would need to track hits/misses for accurate rate
    };
  }
}

/**
 * Provider-aware token counter
 *
 * Routes token counting to appropriate method based on provider.
 */
export class ProviderTokenCounter {
  private logger: Logger;
  private tiktokenCounter: TiktokenCounter;

  constructor(logger?: Logger) {
    this.logger = logger?.child('ProviderTokenCounter') ?? new Logger().child('ProviderTokenCounter');
    this.tiktokenCounter = new TiktokenCounter({}, this.logger);
  }

  /**
   * Count tokens for a specific provider and model
   */
  async countTokens(
    messages: Message[],
    provider: string,
    model: string
  ): Promise<TokenCountResult> {
    switch (provider.toLowerCase()) {
      case 'oai':
      case 'openai':
        // Use tiktoken for OpenAI
        return {
          tokens: this.tiktokenCounter.countMessages(messages, model),
          encoding: this.tiktokenCounter.getEncodingForModel(model),
          model,
          cached: false,
        };

      case 'anthropic':
        // Anthropic uses similar tokenization to cl100k_base
        // But has its own API for exact counting
        return {
          tokens: this.tiktokenCounter.countMessages(messages, 'gpt-4'),
          encoding: 'cl100k_base',
          model,
          cached: false,
        };

      case 'ollama':
        // Ollama models vary - use approximation
        return {
          tokens: this.approximateTokens(messages),
          encoding: 'approximation',
          model,
          cached: false,
        };

      default:
        // Default to tiktoken cl100k_base
        return {
          tokens: this.tiktokenCounter.countMessages(messages, model),
          encoding: 'cl100k_base',
          model,
          cached: false,
        };
    }
  }

  /**
   * Approximate token count using character-based heuristic
   * Used as fallback when tiktoken isn't applicable
   */
  private approximateTokens(messages: Message[]): number {
    let charCount = 0;

    for (const message of messages) {
      charCount += this.countContentChars(message.content);
      charCount += 20; // Message overhead
    }

    // Approximation: ~4 characters per token on average
    return Math.ceil(charCount / 4);
  }

  /**
   * Count characters in message content
   */
  private countContentChars(content: MessageContent | Array<MessageContent>): number {
    if (!Array.isArray(content)) {
      return this.countSingleContentChars(content);
    }

    return content.reduce((total, c) => total + this.countSingleContentChars(c), 0);
  }

  /**
   * Count characters in single content block
   */
  private countSingleContentChars(content: MessageContent): number {
    switch (content.type) {
      case 'text':
        return (content as TextContent).text.length;

      case 'tool_use': {
        const toolUse = content as ToolUseContent;
        return toolUse.name.length + JSON.stringify(toolUse.input).length;
      }

      case 'tool_result': {
        const toolResult = content as ToolResultContent;
        if (typeof toolResult.content === 'string') {
          return toolResult.content.length;
        }
        if (Array.isArray(toolResult.content)) {
          return toolResult.content.reduce((t, c) => t + this.countSingleContentChars(c), 0);
        }
        return 0;
      }

      case 'image':
        return 1000; // Images have variable "character" equivalent

      default:
        return 0;
    }
  }

  /**
   * Get the tiktoken counter for direct access
   */
  getTiktokenCounter(): TiktokenCounter {
    return this.tiktokenCounter;
  }
}

/**
 * Global token counter instances
 */
let globalTiktokenCounter: TiktokenCounter | null = null;
let globalProviderTokenCounter: ProviderTokenCounter | null = null;

/**
 * Initialize global tiktoken counter
 */
export function initTiktokenCounter(
  config?: Partial<TokenCounterConfig>,
  logger?: Logger
): TiktokenCounter {
  globalTiktokenCounter = new TiktokenCounter(config, logger);
  return globalTiktokenCounter;
}

/**
 * Get global tiktoken counter
 */
export function getTiktokenCounter(): TiktokenCounter {
  if (!globalTiktokenCounter) {
    globalTiktokenCounter = new TiktokenCounter();
  }
  return globalTiktokenCounter;
}

/**
 * Initialize global provider token counter
 */
export function initProviderTokenCounter(logger?: Logger): ProviderTokenCounter {
  globalProviderTokenCounter = new ProviderTokenCounter(logger);
  return globalProviderTokenCounter;
}

/**
 * Get global provider token counter
 */
export function getProviderTokenCounter(): ProviderTokenCounter {
  if (!globalProviderTokenCounter) {
    globalProviderTokenCounter = new ProviderTokenCounter();
  }
  return globalProviderTokenCounter;
}
