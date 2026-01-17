/**
 * Ollama Provider Implementation
 *
 * Provides integration with Ollama's API for completions and streaming.
 * Uses Bun's fetch for HTTP requests to Ollama's local API.
 */

import type {
  Message,
  CompletionOptions,
  CompletionResult,
  StreamChunk,
  MessageContent,
  TextContent,
} from '../../types';
import { BaseProvider, BaseProviderConfig } from './base';
import { Logger } from '../../utils/logger';

/**
 * Ollama provider configuration
 */
export interface OllamaConfig extends BaseProviderConfig {
  baseUrl: string;
  defaultModel?: string;
  timeout?: number;
}

/**
 * Ollama API response types
 */
interface OllamaMessage {
  role: string;
  content: string;
  images?: string[];
}

interface OllamaCompletionResponse {
  model: string;
  message: OllamaMessage;
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

interface OllamaStreamChunk {
  model: string;
  created_at: string;
  message?: OllamaMessage;
  done?: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

/**
 * Ollama Provider class
 *
 * Implements AI provider interface using Ollama's local API.
 */
export class OllamaProvider extends BaseProvider {
  private baseUrl: string;

  constructor(config: OllamaConfig, logger?: Logger) {
    super(config, logger);
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash

    this.logger.info('Ollama provider initialized', 'OllamaProvider', {
      baseUrl: this.baseUrl,
      defaultModel: config.defaultModel,
    });
  }

  /**
   * Get provider name
   */
  get name(): string {
    return 'Ollama';
  }

  /**
   * Get provider prefix
   */
  get prefix(): 'ollama' {
    return 'ollama';
  }

  /**
   * Initialize provider capabilities
   */
  protected initializeCapabilities() {
    return {
      streaming: true,
      tools: false,
      vision: true,
      maxTokens: 128000,
    };
  }

  /**
   * Ollama doesn't require API key (local instance)
   */
  protected requiresApiKey(): boolean {
    return false;
  }

  /**
   * Generate a complete completion
   *
   * @param model - Model identifier
   * @param messages - Array of messages
   * @param options - Completion options
   * @returns Completion result
   */
  async complete(
    model: string,
    messages: Message[],
    options?: CompletionOptions
  ): Promise<CompletionResult> {
    this.validateMessages(messages);
    this.validateOptions(options);

    this.logger.debug('Starting Ollama completion', 'OllamaProvider', {
      model,
      messageCount: messages.length,
      options,
    });

    try {
      const ollamaMessages = this.convertMessages(messages);

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: ollamaMessages,
          stream: false,
          options: {
            temperature: options?.temperature,
            top_p: options?.topP,
            num_predict: options?.maxTokens,
          },
        }),
        signal: AbortSignal.timeout(this.getTimeout()),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} ${errorText}`);
      }

      const data: OllamaCompletionResponse = await response.json();

      const content: MessageContent = {
        type: 'text',
        text: data.message.content,
      };

      const result: CompletionResult = {
        content,
        model: data.model,
        stopReason: data.done ? 'stop' : undefined,
        usage: data.eval_count !== undefined
          ? {
              inputTokens: data.prompt_eval_count ?? 0,
              outputTokens: data.eval_count,
              totalTokens: (data.prompt_eval_count ?? 0) + data.eval_count,
            }
          : undefined,
      };

      this.logger.debug('Ollama completion successful', 'OllamaProvider', {
        model: result.model,
        stopReason: result.stopReason,
        usage: result.usage,
      });

      return result;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Generate a streaming completion
   *
   * @param model - Model identifier
   * @param messages - Array of messages
   * @param options - Completion options
   * @returns Async generator of stream chunks
   */
  async *stream(
    model: string,
    messages: Message[],
    options?: CompletionOptions
  ): AsyncGenerator<StreamChunk> {
    this.validateMessages(messages);
    this.validateOptions(options);

    this.logger.debug('Starting Ollama streaming', 'OllamaProvider', {
      model,
      messageCount: messages.length,
      options,
    });

    try {
      const ollamaMessages = this.convertMessages(messages);

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: ollamaMessages,
          stream: true,
          options: {
            temperature: options?.temperature,
            top_p: options?.topP,
            num_predict: options?.maxTokens,
          },
        }),
        signal: AbortSignal.timeout(this.getTimeout()),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} ${errorText}`);
      }

      if (!response.body) {
        throw new Error('No response body from Ollama API');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter((line) => line.trim());

        for (const line of lines) {
          try {
            const data: OllamaStreamChunk = JSON.parse(line);

            if (data.message?.content) {
              fullContent += data.message.content;

              const streamChunk: StreamChunk = {
                content: { type: 'text', text: data.message.content } as TextContent,
                delta: data.message.content,
                done: false,
              };

              yield streamChunk;
            }

            if (data.done) {
              const finalChunk: StreamChunk = {
                content: { type: 'text', text: fullContent } as TextContent,
                delta: '',
                done: true,
                usage: data.eval_count !== undefined
                  ? {
                      inputTokens: data.prompt_eval_count ?? 0,
                      outputTokens: data.eval_count,
                      totalTokens: (data.prompt_eval_count ?? 0) + data.eval_count,
                    }
                  : undefined,
              };

              yield finalChunk;

              this.logger.debug('Ollama streaming complete', 'OllamaProvider', {
                model,
                usage: finalChunk.usage,
              });

              return;
            }
          } catch (parseError) {
            // Skip invalid JSON lines
            this.logger.debug('Failed to parse Ollama stream line', 'OllamaProvider', {
              line,
              error: parseError,
            });
          }
        }
      }
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Count tokens in messages
   *
   * @param messages - Array of messages
   * @returns Token count
   */
  async countTokens(messages: Message[]): Promise<number> {
    // Ollama doesn't provide a direct token counting API
    // Use a simple approximation: ~4 characters per token
    const text = this.extractTextFromMessages(messages);
    const approxTokens = Math.ceil(text.length / 4);

    this.logger.debug('Token count (approximated)', 'OllamaProvider', {
      messageCount: messages.length,
      textLength: text.length,
      approxTokens,
    });

    return approxTokens;
  }

  /**
   * Convert messages to Ollama format
   *
   * @param messages - Array of messages
   * @returns Ollama message format
   */
  private convertMessages(messages: Message[]): OllamaMessage[] {
    return messages.map((msg) => {
      const content = this.extractText(msg.content);

      return {
        role: msg.role,
        content,
      };
    });
  }

  /**
   * Extract text from all messages
   *
   * @param messages - Array of messages
   * @returns Combined text
   */
  private extractTextFromMessages(messages: Message[]): string {
    return messages.map((msg) => this.extractText(msg.content)).join('');
  }

  /**
   * List available models from Ollama
   *
   * @returns Array of model names
   */
  async listModels(): Promise<string[]> {
    this.logger.debug('Listing Ollama models', 'OllamaProvider');

    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(this.getTimeout()),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();

      return data.models?.map((m: { name: string }) => m.name) ?? [];
    } catch (error) {
      this.logger.warn('Failed to list Ollama models', 'OllamaProvider', { error });
      return [];
    }
  }

  /**
   * Check if Ollama server is accessible
   *
   * @returns True if server is accessible
   */
  async checkConnection(): Promise<boolean> {
    this.logger.debug('Checking Ollama connection', 'OllamaProvider');

    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      return response.ok;
    } catch (error) {
      this.logger.warn('Ollama connection check failed', 'OllamaProvider', { error });
      return false;
    }
  }
}
