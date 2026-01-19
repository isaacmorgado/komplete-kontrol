/**
 * Google Gemini Provider
 *
 * Supports Gemini 2.0 Flash and Gemini Pro with native tool calling:
 * - gemini-2.0-flash (1M context, fast, vision)
 * - gemini-pro (2M context, quality, vision)
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
 * Gemini provider configuration
 */
export interface GeminiConfig extends BaseProviderConfig {
  apiKey: string;
  baseUrl?: string;
}

/**
 * Gemini content part types
 */
interface GeminiTextPart {
  text: string;
}

interface GeminiInlineData {
  mimeType: string;
  data: string;
}

interface GeminiInlineDataPart {
  inlineData: GeminiInlineData;
}

interface GeminiFunctionCall {
  name: string;
  args: Record<string, unknown>;
}

interface GeminiFunctionCallPart {
  functionCall: GeminiFunctionCall;
}

interface GeminiFunctionResponse {
  name: string;
  response: Record<string, unknown>;
}

interface GeminiFunctionResponsePart {
  functionResponse: GeminiFunctionResponse;
}

type GeminiPart = GeminiTextPart | GeminiInlineDataPart | GeminiFunctionCallPart | GeminiFunctionResponsePart;

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

interface GeminiTool {
  functionDeclarations: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>;
}

interface GeminiCandidate {
  content: {
    parts: GeminiPart[];
    role: string;
  };
  finishReason?: string;
}

interface GeminiResponse {
  candidates: GeminiCandidate[];
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

/**
 * Google Gemini Provider Implementation
 *
 * Provides access to Google's Gemini models with native tool calling support.
 */
export class GeminiProvider extends BaseProvider {
  private readonly defaultBaseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(config: GeminiConfig, logger?: LoggerLike) {
    super(config, logger, 'Gemini');
    this.validateApiKey();
  }

  get name(): string {
    return 'Gemini';
  }

  get prefix(): ProviderPrefix {
    return 'g' as ProviderPrefix;
  }

  protected initializeCapabilities(): ProviderCapabilities {
    return {
      streaming: true,
      tools: true,
      vision: true,
      maxTokens: 2097152, // Gemini Pro max context
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
   * Count tokens (approximate for Gemini)
   */
  async countTokens(messages: Message[]): Promise<number> {
    // Approximate token count: 1 token ≈ 4 characters
    const text = messages
      .map((msg) => this.extractText(msg.content))
      .join(' ');

    return Math.ceil(text.length / 4);
  }

  /**
   * Make HTTP request to Gemini API
   */
  private async makeRequest(
    model: string,
    messages: Message[],
    options?: CompletionOptions
  ): Promise<GeminiResponse> {
    const baseUrl = this.config.baseUrl ?? this.defaultBaseUrl;
    const modelName = this.mapModelName(model);
    const url = `${baseUrl}/models/${modelName}:generateContent?key=${this.config.apiKey}`;

    const { systemInstruction, contents } = this.convertMessages(messages);
    const tools = this.convertTools(options?.tools);

    const payload: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        topP: options?.topP ?? 1.0,
        maxOutputTokens: options?.maxTokens ?? 4096,
      },
    };

    if (systemInstruction) {
      payload.systemInstruction = systemInstruction;
    }

    if (tools) {
      payload.tools = [tools];
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this.getTimeout()),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errorText}`);
    }

    return await response.json() as GeminiResponse;
  }

  /**
   * Make streaming HTTP request to Gemini API
   */
  private async *makeStreamRequest(
    model: string,
    messages: Message[],
    options?: CompletionOptions
  ): AsyncGenerator<StreamChunk> {
    const baseUrl = this.config.baseUrl ?? this.defaultBaseUrl;
    const modelName = this.mapModelName(model);
    const url = `${baseUrl}/models/${modelName}:streamGenerateContent?key=${this.config.apiKey}&alt=sse`;

    const { systemInstruction, contents } = this.convertMessages(messages);
    const tools = this.convertTools(options?.tools);

    const payload: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        topP: options?.topP ?? 1.0,
        maxOutputTokens: options?.maxTokens ?? 4096,
      },
    };

    if (systemInstruction) {
      payload.systemInstruction = systemInstruction;
    }

    if (tools) {
      payload.tools = [tools];
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this.getTimeout()),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errorText}`);
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

            try {
              const parsed = JSON.parse(data) as GeminiResponse;
              const candidate = parsed.candidates[0];

              if (candidate?.content?.parts) {
                for (const part of candidate.content.parts) {
                  if ('text' in part && part.text) {
                    fullContent += part.text;
                    yield {
                      delta: part.text,
                      done: false,
                    };
                  }
                }
              }

              // Check for completion
              if (candidate?.finishReason) {
                yield {
                  done: true,
                  usage: parsed.usageMetadata ? {
                    inputTokens: parsed.usageMetadata.promptTokenCount,
                    outputTokens: parsed.usageMetadata.candidatesTokenCount,
                    totalTokens: parsed.usageMetadata.totalTokenCount,
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
   * Parse Gemini response into CompletionResult
   */
  private parseResponse(response: GeminiResponse): CompletionResult {
    const candidate = response.candidates[0];
    if (!candidate) {
      throw new Error('No candidates in Gemini response');
    }

    const content: MessageContent[] = [];
    let stopReason: string | undefined;

    for (const part of candidate.content.parts) {
      if ('text' in part) {
        content.push({ type: 'text', text: part.text });
      } else if ('functionCall' in part) {
        content.push({
          type: 'tool_use',
          id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: part.functionCall.name,
          input: part.functionCall.args,
        });
      }
    }

    if (candidate.finishReason) {
      stopReason = candidate.finishReason === 'STOP' ? 'end_turn' : candidate.finishReason.toLowerCase();
    }

    return {
      content: content.length === 1 ? content[0] : content,
      model: this.mapModelName(response.candidates[0]?.content?.role || 'model'),
      stopReason,
      usage: response.usageMetadata ? {
        inputTokens: response.usageMetadata.promptTokenCount,
        outputTokens: response.usageMetadata.candidatesTokenCount,
        totalTokens: response.usageMetadata.totalTokenCount,
      } : undefined,
    };
  }

  /**
   * Map model name to Gemini API format
   */
  private mapModelName(model: string): string {
    const modelMap: Record<string, string> = {
      'gemini-2.0-flash': 'gemini-2.0-flash-exp',
      'gemini-pro': 'gemini-1.5-pro-latest',
      'gemini-1.5-pro': 'gemini-1.5-pro-latest',
      'gemini-1.5-flash': 'gemini-1.5-flash-latest',
    };

    return modelMap[model] ?? model;
  }

  /**
   * Convert messages to Gemini format
   */
  private convertMessages(messages: Message[]): {
    systemInstruction?: { parts: GeminiTextPart[] };
    contents: GeminiContent[];
  } {
    const systemMessages: string[] = [];
    const contents: GeminiContent[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        const text = this.extractText(msg.content);
        if (text) {
          systemMessages.push(text);
        }
      } else {
        const parts = this.convertContentToParts(msg.content);
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts,
        });
      }
    }

    return {
      systemInstruction: systemMessages.length > 0
        ? { parts: [{ text: systemMessages.join('\n\n') }] }
        : undefined,
      contents,
    };
  }

  /**
   * Convert content to Gemini parts
   */
  private convertContentToParts(content: Message['content']): GeminiPart[] {
    const parts: GeminiPart[] = [];

    if (Array.isArray(content)) {
      for (const item of content) {
        if (item.type === 'text') {
          parts.push({ text: item.text });
        } else if (item.type === 'image') {
          parts.push({
            inlineData: {
              mimeType: item.source.media_type || 'image/png',
              data: item.source.type === 'base64' ? item.source.data : item.source.data,
            },
          });
        } else if (item.type === 'tool_use') {
          parts.push({
            functionCall: {
              name: item.name,
              args: item.input,
            },
          });
        } else if (item.type === 'tool_result') {
          const responseData = typeof item.content === 'string'
            ? { result: item.content }
            : { result: JSON.stringify(item.content) };

          parts.push({
            functionResponse: {
              name: item.tool_use_id,
              response: responseData,
            },
          });
        }
      }
    } else {
      if (content.type === 'text') {
        parts.push({ text: content.text });
      } else if (content.type === 'image') {
        parts.push({
          inlineData: {
            mimeType: content.source.media_type || 'image/png',
            data: content.source.type === 'base64' ? content.source.data : content.source.data,
          },
        });
      } else if (content.type === 'tool_use') {
        parts.push({
          functionCall: {
            name: content.name,
            args: content.input,
          },
        });
      } else if (content.type === 'tool_result') {
        const responseData = typeof content.content === 'string'
          ? { result: content.content }
          : { result: JSON.stringify(content.content) };

        parts.push({
          functionResponse: {
            name: content.tool_use_id,
            response: responseData,
          },
        });
      }
    }

    return parts.length > 0 ? parts : [{ text: '' }];
  }

  /**
   * Convert tools to Gemini format
   */
  protected convertTools(tools?: Tool[]): GeminiTool | undefined {
    if (!tools || tools.length === 0) {
      return undefined;
    }

    return {
      functionDeclarations: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      })),
    };
  }
}
