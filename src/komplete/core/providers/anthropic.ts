/**
 * Anthropic Provider Implementation
 *
 * Provides integration with Anthropic's API for completions and streaming.
 */

import Anthropic from '@anthropic-ai/sdk';
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
 * Anthropic provider configuration
 */
export interface AnthropicConfig extends BaseProviderConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
  timeout?: number;
  version?: string;
}

/**
 * Anthropic Provider class
 *
 * Implements AI provider interface using Anthropic's API.
 */
export class AnthropicProvider extends BaseProvider {
  private client: Anthropic;
  private version: string;

  constructor(config: AnthropicConfig, logger?: LoggerLike) {
    super(config, logger);
    this.version = config.version ?? '2023-06-01';

    this.validateApiKey();

    // Initialize Anthropic client
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      timeout: config.timeout ?? 30000,
      maxRetries: 3,
      defaultHeaders: {
        'anthropic-version': this.version,
      },
    });

    this.logger.info('Anthropic provider initialized', 'AnthropicProvider', {
      baseUrl: config.baseUrl,
      defaultModel: config.defaultModel,
      version: this.version,
    });
  }

  /**
   * Get provider name
   */
  get name(): string {
    return 'Anthropic';
  }

  /**
   * Get provider prefix
   */
  get prefix(): 'anthropic' {
    return 'anthropic';
  }

  /**
   * Initialize provider capabilities
   */
  protected initializeCapabilities() {
    return {
      streaming: true,
      tools: true,
      vision: true,
      maxTokens: 200000,
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

    this.logger.debug('Starting Anthropic completion', 'AnthropicProvider', {
      model,
      messageCount: messages.length,
      options,
    });

    try {
      const { system, anthropicMessages } = this.convertMessages(messages);

      const response = await this.client.messages.create({
        model,
        messages: anthropicMessages,
        system,
        max_tokens: options?.maxTokens ?? 4096,
        temperature: options?.temperature,
        top_p: options?.topP,
        tools: this.convertTools(options?.tools),
        stream: false,
      });

      const content = this.parseContent(response.content);

      const result: CompletionResult = {
        content,
        model: response.model,
        stopReason: response.stop_reason ?? undefined,
        usage: response.usage
          ? {
              inputTokens: response.usage.input_tokens,
              outputTokens: response.usage.output_tokens,
              totalTokens: response.usage.input_tokens + response.usage.output_tokens,
            }
          : undefined,
      };

      this.logger.debug('Anthropic completion successful', 'AnthropicProvider', {
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

    this.logger.debug('Starting Anthropic streaming', 'AnthropicProvider', {
      model,
      messageCount: messages.length,
      options,
    });

    try {
      const { system, anthropicMessages } = this.convertMessages(messages);

      const stream = await this.client.messages.create({
        model,
        messages: anthropicMessages,
        system,
        max_tokens: options?.maxTokens ?? 4096,
        temperature: options?.temperature,
        top_p: options?.topP,
        tools: this.convertTools(options?.tools),
        stream: true,
      });

      let fullContent = '';
      let usageInfo: { inputTokens: number; outputTokens: number; totalTokens: number } | undefined;
      let stopReason: string | undefined;

      for await (const event of stream) {
        if (event.type === 'message_start' && event.message) {
          // Capture initial usage info from message_start
          if (event.message.usage) {
            usageInfo = {
              inputTokens: event.message.usage.input_tokens,
              outputTokens: event.message.usage.output_tokens,
              totalTokens: event.message.usage.input_tokens + event.message.usage.output_tokens,
            };
          }
          stopReason = event.message.stop_reason ?? undefined;
        } else if (event.type === 'message_delta' && 'delta' in event) {
          // Capture final usage from message_delta
          const delta = event.delta as { stop_reason?: string | null };
          if (delta.stop_reason) {
            stopReason = delta.stop_reason;
          }
          const eventUsage = (event as { usage?: { output_tokens: number } }).usage;
          if (eventUsage && usageInfo) {
            usageInfo.outputTokens = eventUsage.output_tokens;
            usageInfo.totalTokens = usageInfo.inputTokens + eventUsage.output_tokens;
          }
        } else if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta' && event.delta.text) {
            fullContent += event.delta.text;

            const streamChunk: StreamChunk = {
              content: { type: 'text', text: event.delta.text } as TextContent,
              delta: event.delta.text,
              done: false,
            };

            yield streamChunk;
          }
        } else if (event.type === 'message_stop') {
          const finalChunk: StreamChunk = {
            content: { type: 'text', text: fullContent } as TextContent,
            delta: '',
            done: true,
            usage: usageInfo,
          };

          yield finalChunk;

          this.logger.debug('Anthropic streaming complete', 'AnthropicProvider', {
            model,
            stopReason,
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
    // Anthropic provides a token counting method
    const { anthropicMessages, system } = this.convertMessages(messages);

    try {
      const count = await this.client.messages.countTokens({
        model: this.getDefaultModel(),
        messages: anthropicMessages,
        system,
      });

      this.logger.debug('Token count', 'AnthropicProvider', {
        messageCount: messages.length,
        tokens: count.input_tokens,
      });

      return count.input_tokens;
    } catch (error) {
      // Fallback to approximation if token counting fails
      this.logger.warn('Token counting failed, using approximation', 'AnthropicProvider', { error });
      const text = this.extractTextFromMessages(messages);
      return Math.ceil(text.length / 4);
    }
  }

  /**
   * Convert messages to Anthropic format
   *
   * @param messages - Array of messages
   * @returns Anthropic message format with system prompt
   */
  private convertMessages(messages: Message[]): {
    system: string | undefined;
    anthropicMessages: Anthropic.MessageParam[];
  } {
    const systemMessages: string[] = [];
    const anthropicMessages: Anthropic.MessageParam[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        const text = this.extractText(msg.content);
        if (text) {
          systemMessages.push(text);
        }
      } else {
        anthropicMessages.push({
          role: msg.role as 'user' | 'assistant',
          content: this.convertContent(msg.content),
        });
      }
    }

    return {
      system: systemMessages.length > 0 ? systemMessages.join('\n\n') : undefined,
      anthropicMessages,
    };
  }

  /**
   * Convert content to Anthropic format
   *
   * @param content - Message content
   * @returns Anthropic message content (not ContentBlock which is for responses)
   */
  private convertContent(content: Message['content']): Anthropic.Messages.ContentBlockParam[] {
    if (typeof content === 'string') {
      return [{ type: 'text', text: content }];
    }

    if (Array.isArray(content)) {
      return content.map((item): Anthropic.Messages.ContentBlockParam => {
        if (typeof item === 'string') {
          return { type: 'text', text: item };
        }
        if (item.type === 'text') {
          return { type: 'text', text: item.text };
        }
        if (item.type === 'image') {
          return {
            type: 'image',
            source: item.source.type === 'url'
              ? { type: 'url', url: item.source.data }
              : { type: 'base64', media_type: (item.source.media_type || 'image/png') as Anthropic.Messages.Base64ImageSource['media_type'], data: item.source.data },
          };
        }
        if (item.type === 'tool_use') {
          return {
            type: 'tool_use',
            id: item.id,
            name: item.name,
            input: item.input,
          };
        }
        if (item.type === 'tool_result') {
          return {
            type: 'tool_result',
            tool_use_id: item.tool_use_id,
            content: this.convertToolResultContent(item.content ?? { type: 'text', text: '' }),
            is_error: item.is_error,
          };
        }
        return { type: 'text', text: '' };
      });
    }

    if (typeof content === 'object' && content !== null) {
      if (content.type === 'text') {
        return [{ type: 'text', text: content.text }];
      }
      if (content.type === 'image') {
        return [
          {
            type: 'image',
            source: content.source.type === 'url'
              ? { type: 'url', url: content.source.data }
              : { type: 'base64', media_type: (content.source.media_type || 'image/png') as Anthropic.Messages.Base64ImageSource['media_type'], data: content.source.data },
          },
        ];
      }
      if (content.type === 'tool_use') {
        return [
          {
            type: 'tool_use',
            id: content.id,
            name: content.name,
            input: content.input,
          },
        ];
      }
      if (content.type === 'tool_result') {
        return [
          {
            type: 'tool_result',
            tool_use_id: content.tool_use_id,
            content: this.convertToolResultContent(content.content ?? { type: 'text', text: '' }),
            is_error: content.is_error,
          },
        ];
      }
    }

    return [{ type: 'text', text: '' }];
  }

  /**
   * Convert tool result content to Anthropic format
   * @param content - Tool result content (string, MessageContent, or array)
   */
  private convertToolResultContent(content: string | MessageContent | MessageContent[]): Anthropic.Messages.ToolResultBlockParam['content'] {
    // Handle string content directly
    if (typeof content === 'string') {
      return content;
    }
    // Handle array content
    if (Array.isArray(content)) {
      // Map to Anthropic format and filter to text only
      const textBlocks: Anthropic.Messages.TextBlockParam[] = [];
      for (const item of content) {
        if (item.type === 'text') {
          textBlocks.push({ type: 'text', text: item.text });
        }
      }
      return textBlocks;
    }
    // Handle single MessageContent
    if (content.type === 'text') {
      return content.text;
    }
    // Default fallback
    return '';
  }

  /**
   * Parse content from Anthropic response
   *
   * @param content - Content from Anthropic
   * @returns Parsed message content (single or array)
   */
  private parseContent(content: Anthropic.ContentBlock[]): MessageContent | MessageContent[] {
    if (content.length === 0) {
      return { type: 'text', text: '' };
    }

    if (content.length === 1) {
      const block = content[0];

      if (block.type === 'text') {
        return { type: 'text', text: block.text };
      }

      // Map tool_use blocks to our format
      if (block.type === 'tool_use') {
        return {
          type: 'tool_use',
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        };
      }

      return { type: 'text', text: '' };
    }

    // Multiple content blocks - map each appropriately
    return content.map((block): MessageContent => {
      if (block.type === 'text') {
        return { type: 'text', text: block.text };
      }
      if (block.type === 'tool_use') {
        return {
          type: 'tool_use',
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        };
      }
      return { type: 'text', text: '' };
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
   * Convert tools to Anthropic format
   *
   * @param tools - Array of tools
   * @returns Anthropic tool format
   */
  protected convertTools(tools?: any[]): Anthropic.Tool[] | undefined {
    if (!tools || tools.length === 0) {
      return undefined;
    }

    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    }));
  }
}
