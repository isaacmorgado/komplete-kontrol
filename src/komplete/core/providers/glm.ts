/**
 * GLM (Z.AI) Provider
 *
 * Supports GLM-4.7 model with native tool calling:
 * - glm-4.7 (131K context, multilingual, Chinese-optimized)
 */

import type {
  Message,
  MessageContent,
  CompletionOptions,
  CompletionResult,
  StreamChunk,
  ProviderCapabilities,
  ProviderPrefix,
  Tool,
} from '../../types';
import { ProviderError } from '../../types';
import { BaseProvider, BaseProviderConfig } from './base';
import { LoggerLike } from '../../utils/logger';

/**
 * GLM provider configuration
 */
export interface GLMConfig extends BaseProviderConfig {
  apiKey: string;
  baseUrl?: string;
}

/**
 * GLM message format (OpenAI-compatible)
 */
interface GLMMessage {
  role: string;
  content: string;
}

/**
 * GLM tool format (OpenAI-compatible)
 */
interface GLMTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/**
 * GLM response format
 */
interface GLMResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

/**
 * GLM Provider Implementation
 *
 * Provides access to GLM models via Z.AI endpoint with native tool calling support.
 */
export class GLMProvider extends BaseProvider {
  private readonly defaultBaseUrl = 'https://open.bigmodel.cn/api/paas/v4';

  constructor(config: GLMConfig, logger?: LoggerLike) {
    super(config, logger, 'GLM');
    this.validateApiKey();
  }

  get name(): string {
    return 'GLM';
  }

  get prefix(): ProviderPrefix {
    return 'glm' as ProviderPrefix;
  }

  protected initializeCapabilities(): ProviderCapabilities {
    return {
      streaming: true,
      tools: true,
      vision: false,
      maxTokens: 131072, // GLM-4.7 max context
    };
  }

  /**
   * Generate completion with native tool calling
   */
  async complete(
    model: string,
    messages: Message[],
    options?: CompletionOptions
  ): Promise<CompletionResult> {
    this.validateMessages(messages);
    this.validateOptions(options);

    try {
      const response = await this.makeRequest(model, messages, options);
      return this.parseResponse(response);
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Generate streaming completion with native tool calling
   */
  async *stream(
    model: string,
    messages: Message[],
    options?: CompletionOptions
  ): AsyncGenerator<StreamChunk> {
    this.validateMessages(messages);
    this.validateOptions(options);

    try {
      for await (const chunk of this.makeStreamRequest(model, messages, options)) {
        yield chunk;
      }
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Count tokens (approximate for GLM)
   */
  async countTokens(messages: Message[]): Promise<number> {
    // Approximate token count: 1 token ≈ 4 characters
    const text = messages
      .map((msg) => this.extractText(msg.content))
      .join(' ');

    return Math.ceil(text.length / 4);
  }

  /**
   * Make HTTP request to GLM API
   */
  private async makeRequest(
    model: string,
    messages: Message[],
    options?: CompletionOptions
  ): Promise<GLMResponse> {
    const baseUrl = this.config.baseUrl ?? this.defaultBaseUrl;
    const url = `${baseUrl}/chat/completions`;

    const payload: Record<string, unknown> = {
      model: this.mapModelName(model),
      messages: this.convertMessages(messages),
      max_tokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature ?? 0.7,
      top_p: options?.topP ?? 1.0,
      stream: false,
    };

    if (options?.tools && options.tools.length > 0) {
      payload.tools = this.convertTools(options.tools);
    }

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
      throw new Error(`GLM API error (${response.status}): ${errorText}`);
    }

    return await response.json() as GLMResponse;
  }

  /**
   * Make streaming HTTP request to GLM API
   */
  private async *makeStreamRequest(
    model: string,
    messages: Message[],
    options?: CompletionOptions
  ): AsyncGenerator<StreamChunk> {
    const baseUrl = this.config.baseUrl ?? this.defaultBaseUrl;
    const url = `${baseUrl}/chat/completions`;

    const payload: Record<string, unknown> = {
      model: this.mapModelName(model),
      messages: this.convertMessages(messages),
      max_tokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature ?? 0.7,
      top_p: options?.topP ?? 1.0,
      stream: true,
    };

    if (options?.tools && options.tools.length > 0) {
      payload.tools = this.convertTools(options.tools);
    }

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
      throw new Error(`GLM API error (${response.status}): ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';

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
              yield {
                done: true,
              };
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices[0]?.delta;

              if (delta?.content) {
                fullContent += delta.content;
                yield {
                  delta: delta.content,
                  done: false,
                };
              }

              // Check for completion
              if (parsed.choices[0]?.finish_reason) {
                yield {
                  done: true,
                  usage: parsed.usage ? {
                    inputTokens: parsed.usage.prompt_tokens,
                    outputTokens: parsed.usage.completion_tokens,
                    totalTokens: parsed.usage.total_tokens,
                  } : undefined,
                };
                return;
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
   * Parse GLM response into CompletionResult
   */
  private parseResponse(response: GLMResponse): CompletionResult {
    const choice = response.choices[0];
    if (!choice) {
      throw new Error('No choices in GLM response');
    }

    const content: MessageContent[] = [];
    let stopReason: string | undefined;

    // Add text content
    if (choice.message.content) {
      content.push({ type: 'text', text: choice.message.content });
    }

    // Add tool calls if present
    if (choice.message.tool_calls) {
      for (const toolCall of choice.message.tool_calls) {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          content.push({
            type: 'tool_use',
            id: toolCall.id,
            name: toolCall.function.name,
            input: args,
          });
        } catch (error) {
          this.logger.warn('Failed to parse tool call arguments', { error, toolCall });
        }
      }
    }

    if (choice.finish_reason) {
      stopReason = choice.finish_reason === 'stop' ? 'end_turn' : choice.finish_reason;
    }

    return {
      content: content.length === 1 ? content[0] : content,
      model: response.model,
      stopReason,
      usage: response.usage ? {
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      } : undefined,
    };
  }

  /**
   * Map model name to GLM API format
   */
  private mapModelName(model: string): string {
    const modelMap: Record<string, string> = {
      'glm-4.7': 'glm-4-flash',
      'glm-4': 'glm-4',
      'glm-4-flash': 'glm-4-flash',
    };

    return modelMap[model] ?? model;
  }

  /**
   * Convert messages to GLM format (OpenAI-compatible)
   */
  private convertMessages(messages: Message[]): GLMMessage[] {
    return messages.map((msg) => ({
      role: msg.role,
      content: this.extractText(msg.content),
    }));
  }

  /**
   * Convert tools to GLM format (OpenAI-compatible)
   */
  protected convertTools(tools?: Tool[]): GLMTool[] | undefined {
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
