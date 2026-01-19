/**
 * Featherless AI Provider
 *
 * Supports 5 abliterated models with XML/JSON tool calling emulation:
 * - dolphin-3-venice-24b (creative, unrestricted)
 * - qwen-2.5-72b (best reasoning, abliterated)
 * - whiterabbitneo-8b (pentesting, security)
 * - llama-3-70b (general purpose, large)
 * - llama-3-8b-v3 (fast, efficient)
 */

import type {
  Message,
  MessageContent,
  CompletionOptions,
  CompletionResult,
  StreamChunk,
  ProviderCapabilities,
  ProviderPrefix,
} from '../../types';
import { ProviderError } from '../../types';
import { BaseProvider, BaseProviderConfig } from './base';
import { LoggerLike } from '../../utils/logger';
import { getModelProxy } from './model-proxy-server';

/**
 * Featherless provider configuration
 */
export interface FeatherlessConfig extends BaseProviderConfig {
  apiKey: string;
  baseUrl?: string;
}

/**
 * Featherless AI Provider Implementation
 *
 * Provides access to abliterated models through Featherless API
 * with automatic XML/JSON tool calling emulation.
 */
export class FeatherlessProvider extends BaseProvider {
  private readonly defaultBaseUrl = 'https://api.featherless.ai/v1';

  constructor(config: FeatherlessConfig, logger?: LoggerLike) {
    super(config, logger, 'Featherless');
    this.validateApiKey();
  }

  get name(): string {
    return 'Featherless';
  }

  get prefix(): ProviderPrefix {
    return 'fl';
  }

  protected initializeCapabilities(): ProviderCapabilities {
    return {
      streaming: true,
      tools: true, // Via XML/JSON emulation
      vision: false,
      maxTokens: 131072, // Qwen 2.5 72B max context
    };
  }

  /**
   * Generate completion with tool calling emulation
   */
  async complete(
    model: string,
    messages: Message[],
    options?: CompletionOptions
  ): Promise<CompletionResult> {
    this.validateMessages(messages);
    this.validateOptions(options);

    const modelProxy = getModelProxy();

    // Prepare messages with tool calling emulation if needed
    const preparedMessages = modelProxy.prepareMessages(model, messages, options);

    try {
      const response = await this.makeRequest(model, preparedMessages, options);

      // Extract tool calls from XML/JSON response
      if (options?.tools && options.tools.length > 0) {
        const contentText = Array.isArray(response.content)
          ? response.content.find((c): c is { type: 'text'; text: string } => c.type === 'text')?.text ?? ''
          : response.content.type === 'text'
          ? response.content.text
          : '';

        const processed = modelProxy.processEmulatedResponse(contentText);

        // Build content array with text and tool uses
        const content: MessageContent[] = [];
        if (processed.text) {
          content.push({ type: 'text', text: processed.text });
        }
        processed.toolCalls.forEach((tc) => {
          content.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: tc.arguments,
          });
        });

        return {
          content,
          model: response.model,
          stopReason: processed.toolCalls.length > 0 ? 'tool_use' : 'end_turn',
          usage: response.usage,
        };
      }

      return response;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Generate streaming completion with tool calling emulation
   */
  async *stream(
    model: string,
    messages: Message[],
    options?: CompletionOptions
  ): AsyncGenerator<StreamChunk> {
    this.validateMessages(messages);
    this.validateOptions(options);

    const modelProxy = getModelProxy();
    const preparedMessages = modelProxy.prepareMessages(model, messages, options);

    try {
      let fullResponse = '';
      let isFirstChunk = true;

      for await (const chunk of this.makeStreamRequest(model, preparedMessages, options)) {
        if (chunk.delta) {
          fullResponse += chunk.delta;
        }
        yield chunk;
        isFirstChunk = false;
      }

      // After streaming complete, extract tool calls if any
      if (options?.tools && options.tools.length > 0) {
        const processed = modelProxy.processEmulatedResponse(fullResponse);

        if (processed.toolCalls.length > 0) {
          // Yield final chunks with tool uses
          for (const tc of processed.toolCalls) {
            yield {
              content: {
                type: 'tool_use',
                id: tc.id,
                name: tc.name,
                input: tc.arguments,
              },
              done: false,
            };
          }
        }
      }

      // Final done chunk
      yield {
        done: true,
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Count tokens (approximate for Featherless models)
   */
  async countTokens(messages: Message[]): Promise<number> {
    // Approximate token count: 1 token ≈ 4 characters
    const text = messages
      .map((msg) => this.extractText(msg.content))
      .join(' ');

    return Math.ceil(text.length / 4);
  }

  /**
   * Make HTTP request to Featherless API
   */
  private async makeRequest(
    model: string,
    messages: Message[],
    options?: CompletionOptions
  ): Promise<CompletionResult> {
    const baseUrl = this.config.baseUrl ?? this.defaultBaseUrl;
    const url = `${baseUrl}/chat/completions`;

    const payload = {
      model: this.mapModelName(model),
      messages: this.convertMessages(messages),
      max_tokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature ?? 0.7,
      top_p: options?.topP ?? 1.0,
      stream: false,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this.getTimeout()),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Featherless API error (${response.status}): ${errorText}`);
    }

    const data = await response.json() as {
      choices: Array<{
        message: { content: string };
        finish_reason: string;
      }>;
      usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      };
    };
    const choice = data.choices[0];

    return {
      content: { type: 'text', text: choice.message.content },
      model: this.mapModelName(model),
      stopReason: choice.finish_reason === 'stop' ? 'end_turn' : 'max_tokens',
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
      },
    };
  }

  /**
   * Make streaming HTTP request to Featherless API
   */
  private async *makeStreamRequest(
    model: string,
    messages: Message[],
    options?: CompletionOptions
  ): AsyncGenerator<StreamChunk> {
    const baseUrl = this.config.baseUrl ?? this.defaultBaseUrl;
    const url = `${baseUrl}/chat/completions`;

    const payload = {
      model: this.mapModelName(model),
      messages: this.convertMessages(messages),
      max_tokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature ?? 0.7,
      top_p: options?.topP ?? 1.0,
      stream: true,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this.getTimeout()),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Featherless API error (${response.status}): ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');

        // Keep last incomplete line in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            if (data === '[DONE]') {
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices[0]?.delta;

              if (delta?.content) {
                yield {
                  delta: delta.content,
                };
              }
            } catch (parseError) {
              this.logger.warn('Failed to parse SSE data', { data, error: parseError });
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Map model name to Featherless API format
   */
  private mapModelName(model: string): string {
    const modelMap: Record<string, string> = {
      'dolphin-3-venice-24b': 'dolphin-3-venice-24b',
      'qwen-2.5-72b': 'qwen-2.5-72b',
      'whiterabbitneo-8b': 'whiterabbitneo-8b',
      'llama-3-70b': 'llama-3-70b',
      'llama-3-8b-v3': 'llama-3-8b-v3',
    };

    return modelMap[model] ?? model;
  }

  /**
   * Convert messages to Featherless format
   */
  private convertMessages(messages: Message[]): Array<{
    role: string;
    content: string;
  }> {
    return messages.map((msg) => ({
      role: msg.role,
      content: this.extractText(msg.content),
    }));
  }
}
