/**
 * OpenAI Provider Implementation
 *
 * Provides integration with OpenAI's API for completions and streaming.
 */

import OpenAI from 'openai';
import type {
  Message,
  CompletionOptions,
  CompletionResult,
  StreamChunk,
  MessageContent,
  TextContent,
} from '../../types';
import { BaseProvider, BaseProviderConfig } from './base';
import { Logger, LoggerLike } from '../../utils/logger';

/**
 * OpenAI provider configuration
 */
export interface OpenAIConfig extends BaseProviderConfig {
  apiKey: string;
  baseUrl?: string;
  organizationId?: string;
  defaultModel?: string;
  timeout?: number;
}

/**
 * OpenAI Provider class
 *
 * Implements AI provider interface using OpenAI's API.
 */
export class OpenAIProvider extends BaseProvider {
  private client: OpenAI;
  private organizationId?: string;

  constructor(config: OpenAIConfig, logger?: LoggerLike) {
    super(config, logger);
    this.organizationId = config.organizationId;

    this.validateApiKey();

    // Initialize OpenAI client
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      organization: config.organizationId,
      timeout: config.timeout ?? 30000,
      maxRetries: 3,
    });

    this.logger.info('OpenAI provider initialized', 'OpenAIProvider', {
      baseUrl: config.baseUrl,
      defaultModel: config.defaultModel,
    });
  }

  /**
   * Get provider name
   */
  get name(): string {
    return 'OpenAI';
  }

  /**
   * Get provider prefix
   */
  get prefix(): 'oai' {
    return 'oai';
  }

  /**
   * Initialize provider capabilities
   */
  protected initializeCapabilities() {
    return {
      streaming: true,
      tools: true,
      vision: true,
      maxTokens: 128000,
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
  async complete(
    model: string,
    messages: Message[],
    options?: CompletionOptions
  ): Promise<CompletionResult> {
    this.validateMessages(messages);
    this.validateOptions(options);

    this.logger.debug('Starting OpenAI completion', 'OpenAIProvider', {
      model,
      messageCount: messages.length,
      options,
    });

    try {
      const openaiMessages = this.convertMessages(messages);

      const response = await this.client.chat.completions.create({
        model,
        messages: openaiMessages,
        max_tokens: options?.maxTokens,
        temperature: options?.temperature,
        top_p: options?.topP,
        tools: this.convertTools(options?.tools),
        stream: false,
      });

      const content = this.parseContent(response.choices[0]?.message?.content);

      const result: CompletionResult = {
        content,
        model: response.model,
        stopReason: response.choices[0]?.finish_reason,
        usage: response.usage
          ? {
              inputTokens: response.usage.prompt_tokens,
              outputTokens: response.usage.completion_tokens,
              totalTokens: response.usage.total_tokens,
            }
          : undefined,
      };

      this.logger.debug('OpenAI completion successful', 'OpenAIProvider', {
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

    this.logger.debug('Starting OpenAI streaming', 'OpenAIProvider', {
      model,
      messageCount: messages.length,
      options,
    });

    try {
      const openaiMessages = this.convertMessages(messages);

      const stream = await this.client.chat.completions.create({
        model,
        messages: openaiMessages,
        max_tokens: options?.maxTokens,
        temperature: options?.temperature,
        top_p: options?.topP,
        tools: this.convertTools(options?.tools),
        stream: true,
      });

      let fullContent = '';

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;

        if (delta) {
          fullContent += delta;

          const streamChunk: StreamChunk = {
            content: { type: 'text', text: delta } as TextContent,
            delta,
            done: false,
          };

          yield streamChunk;
        }

        // Check for completion
        if (chunk.choices[0]?.finish_reason) {
          const finalChunk: StreamChunk = {
            content: { type: 'text', text: fullContent } as TextContent,
            delta: '',
            done: true,
            usage: chunk.usage
              ? {
                  inputTokens: chunk.usage.prompt_tokens,
                  outputTokens: chunk.usage.completion_tokens,
                  totalTokens: chunk.usage.total_tokens,
                }
              : undefined,
          };

          yield finalChunk;

          this.logger.debug('OpenAI streaming complete', 'OpenAIProvider', {
            model,
            stopReason: chunk.choices[0]?.finish_reason,
            usage: finalChunk.usage,
          });

          break;
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
    // OpenAI doesn't provide a direct token counting API
    // Use a simple approximation: ~4 characters per token
    const text = this.extractTextFromMessages(messages);
    const approxTokens = Math.ceil(text.length / 4);

    this.logger.debug('Token count (approximated)', 'OpenAIProvider', {
      messageCount: messages.length,
      textLength: text.length,
      approxTokens,
    });

    return approxTokens;
  }

  /**
   * Convert messages to OpenAI format
   *
   * @param messages - Array of messages
   * @returns OpenAI message format
   */
  private convertMessages(messages: Message[]): OpenAI.Chat.ChatCompletionMessageParam[] {
    return messages.map((msg) => {
      const content = this.convertContent(msg.content);

      return {
        role: msg.role,
        content,
      } as OpenAI.Chat.ChatCompletionMessageParam;
    });
  }

  /**
   * Convert content to OpenAI format
   *
   * @param content - Message content
   * @returns OpenAI content format
   */
  private convertContent(content: Message['content']): string | Array<OpenAI.Chat.ContentBlock> {
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      return content.map((item) => {
        if (typeof item === 'string') {
          return { type: 'text', text: item };
        }
        if (item.type === 'text') {
          return { type: 'text', text: item.text };
        }
        if (item.type === 'image') {
          return {
            type: 'image_url',
            image_url: {
              url: item.source.type === 'url'
                ? item.source.data
                : `data:${item.source.media_type || 'image/png'};base64,${item.source.data}`,
            },
          };
        }
        return { type: 'text', text: '' };
      });
    }

    if (typeof content === 'object' && content !== null) {
      if (content.type === 'text') {
        return content.text;
      }
      if (content.type === 'image') {
        return [
          {
            type: 'image_url',
            image_url: {
              url: content.source.type === 'url'
                ? content.source.data
                : `data:${content.source.media_type || 'image/png'};base64,${content.source.data}`,
            },
          },
        ];
      }
    }

    return '';
  }

  /**
   * Parse content from OpenAI response
   *
   * @param content - Content from OpenAI
   * @returns Parsed message content
   */
  private parseContent(content: string | null | undefined): MessageContent {
    if (!content) {
      return { type: 'text', text: '' };
    }
    return { type: 'text', text: content };
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
   * Convert tools to OpenAI format
   *
   * @param tools - Array of tools
   * @returns OpenAI tool format
   */
  protected convertTools(tools?: any[]): any[] | undefined {
    if (!tools || tools.length === 0) {
      return undefined;
    }

    return tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));
  }
}
