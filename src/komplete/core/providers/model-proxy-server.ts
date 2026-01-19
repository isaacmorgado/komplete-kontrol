/**
 * Universal Tool Calling Model Proxy Server
 *
 * Provides XML/JSON emulation for models that don't natively support tool calling.
 * Supports 13+ models including abliterated Featherless models.
 *
 * Architecture from ARCHITECTURE-SYNTHESIS-ENHANCED.md
 */

import type {
  Message,
  CompletionOptions,
  CompletionResult,
  StreamChunk,
  Tool,
} from '../../types';
import { Logger, LoggerLike } from '../../utils/logger';

/**
 * Model capabilities for routing
 */
export interface ModelCapabilities {
  supportsNativeToolCalling: boolean;
  supportsVision: boolean;
  isAbliterated: boolean;
  isMultilingual: boolean;
  maxContextLength: number;
  provider: string;
}

/**
 * Tool call extracted from XML/JSON emulation
 */
export interface ExtractedToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * Model proxy configuration
 */
export interface ModelProxyConfig {
  // Featherless API
  featherlessApiKey?: string;
  featherlessBaseUrl?: string;

  // Google Gemini
  geminiApiKey?: string;
  geminiBaseUrl?: string;

  // GLM (Z.AI)
  glmApiKey?: string;
  glmBaseUrl?: string;

  // Kimi
  kimiApiKey?: string;
  kimiBaseUrl?: string;

  // Timeout
  timeout?: number;
}

/**
 * Universal Tool Calling Model Proxy
 *
 * Routes requests to appropriate providers and handles tool calling emulation
 * for models that don't natively support it.
 */
export class ModelProxyServer {
  private logger: LoggerLike;
  private config: ModelProxyConfig;
  private modelCapabilities: Map<string, ModelCapabilities>;

  constructor(config: ModelProxyConfig, logger?: LoggerLike) {
    this.logger = logger ?? new Logger().child('ModelProxyServer');
    this.config = config;
    this.modelCapabilities = this.initializeModelCapabilities();
  }

  /**
   * Initialize model capabilities registry
   */
  private initializeModelCapabilities(): Map<string, ModelCapabilities> {
    const capabilities = new Map<string, ModelCapabilities>();

    // Anthropic Claude (native tool calling)
    capabilities.set('claude-sonnet-4.5', {
      supportsNativeToolCalling: true,
      supportsVision: true,
      isAbliterated: false,
      isMultilingual: true,
      maxContextLength: 200000,
      provider: 'anthropic',
    });

    capabilities.set('claude-opus-4.5', {
      supportsNativeToolCalling: true,
      supportsVision: true,
      isAbliterated: false,
      isMultilingual: true,
      maxContextLength: 200000,
      provider: 'anthropic',
    });

    // Google Gemini (native tool calling)
    capabilities.set('gemini-2.0-flash', {
      supportsNativeToolCalling: true,
      supportsVision: true,
      isAbliterated: false,
      isMultilingual: true,
      maxContextLength: 1000000,
      provider: 'google',
    });

    capabilities.set('gemini-pro', {
      supportsNativeToolCalling: true,
      supportsVision: true,
      isAbliterated: false,
      isMultilingual: true,
      maxContextLength: 2097152,
      provider: 'google',
    });

    // GLM (Z.AI) - native tool calling
    capabilities.set('glm-4.7', {
      supportsNativeToolCalling: true,
      supportsVision: false,
      isAbliterated: false,
      isMultilingual: true,
      maxContextLength: 131072,
      provider: 'glm',
    });

    // Kimi K2 (native tool calling)
    capabilities.set('kimi-k2', {
      supportsNativeToolCalling: true,
      supportsVision: false,
      isAbliterated: false,
      isMultilingual: true,
      maxContextLength: 1048576,
      provider: 'kimi',
    });

    // Featherless Abliterated Models (XML/JSON emulation)
    capabilities.set('dolphin-3-venice-24b', {
      supportsNativeToolCalling: false,
      supportsVision: false,
      isAbliterated: true,
      isMultilingual: true,
      maxContextLength: 32768,
      provider: 'featherless',
    });

    capabilities.set('qwen-2.5-72b', {
      supportsNativeToolCalling: false,
      supportsVision: false,
      isAbliterated: true,
      isMultilingual: true,
      maxContextLength: 131072,
      provider: 'featherless',
    });

    capabilities.set('whiterabbitneo-8b', {
      supportsNativeToolCalling: false,
      supportsVision: false,
      isAbliterated: true,
      isMultilingual: false,
      maxContextLength: 8192,
      provider: 'featherless',
    });

    capabilities.set('llama-3-70b', {
      supportsNativeToolCalling: false,
      supportsVision: false,
      isAbliterated: true,
      isMultilingual: true,
      maxContextLength: 8192,
      provider: 'featherless',
    });

    capabilities.set('llama-3-8b-v3', {
      supportsNativeToolCalling: false,
      supportsVision: false,
      isAbliterated: true,
      isMultilingual: true,
      maxContextLength: 8192,
      provider: 'featherless',
    });

    return capabilities;
  }

  /**
   * Get model capabilities
   */
  getModelCapabilities(model: string): ModelCapabilities | undefined {
    return this.modelCapabilities.get(model);
  }

  /**
   * Generate tool calling prompt for XML/JSON emulation
   */
  private generateToolCallingPrompt(tools: Tool[]): string {
    const toolSchemas = tools.map((tool) => {
      return `{
  "name": "${tool.name}",
  "description": "${tool.description}",
  "parameters": ${JSON.stringify(tool.inputSchema, null, 2)}
}`;
    }).join(',\n');

    return `# Available Tools

You have access to the following tools. To use a tool, respond with XML tags:

<tool_call>
{"name": "tool_name", "arguments": {"param1": "value1"}}
</tool_call>

IMPORTANT: You can call multiple tools IN PARALLEL by including multiple
<tool_call> blocks in a single response.

## Tool Schemas

[${toolSchemas}]

## Examples

Example 1 - Single tool call:
<tool_call>
{"name": "read_file", "arguments": {"path": "./src/app.ts"}}
</tool_call>

Example 2 - PARALLEL tool calls (recommended):
<tool_call>
{"name": "read_file", "arguments": {"path": "./src/app.ts"}}
</tool_call>
<tool_call>
{"name": "read_file", "arguments": {"path": "./src/utils.ts"}}
</tool_call>

Example 3 - Using Task tool (spawning agents):
<tool_call>
{"name": "Task", "arguments": {"subagent_type": "Explore", "prompt": "Find authentication code"}}
</tool_call>

Example 4 - Using MCP tools (browser automation):
<tool_call>
{"name": "mcp__claude-in-chrome__navigate", "arguments": {"url": "https://example.com", "tabId": 1}}
</tool_call>

Example 5 - Using Skills (slash commands):
<tool_call>
{"name": "Skill", "arguments": {"skill": "checkpoint", "args": "Save progress"}}
</tool_call>

Example 6 - Multiple capabilities in parallel:
<tool_call>
{"name": "Grep", "arguments": {"pattern": "async function", "output_mode": "files_with_matches"}}
</tool_call>
<tool_call>
{"name": "Glob", "arguments": {"pattern": "**/*.test.ts"}}
</tool_call>
<tool_call>
{"name": "Bash", "arguments": {"command": "npm test", "description": "Run test suite"}}
</tool_call>

## Your Task

Respond to the user's request. If you need to use tools, include the <tool_call> blocks in your response.
`;
  }

  /**
   * Extract tool calls from XML/JSON emulated response
   */
  private extractToolCalls(response: string): ExtractedToolCall[] {
    const toolCalls: ExtractedToolCall[] = [];
    const regex = /<tool_call>\s*(\{[\s\S]*?\})\s*<\/tool_call>/g;

    let match;
    let callIndex = 0;
    while ((match = regex.exec(response)) !== null) {
      try {
        const json = JSON.parse(match[1]);
        toolCalls.push({
          id: `call_${Date.now()}_${callIndex++}_${Math.random().toString(36).substr(2, 9)}`,
          name: json.name,
          arguments: json.arguments,
        });
      } catch (error) {
        this.logger.warn('Failed to parse tool call JSON', { error, json: match[1] });
      }
    }

    return toolCalls;
  }

  /**
   * Remove tool calls from response text
   */
  private removeToolCalls(response: string): string {
    return response.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '').trim();
  }

  /**
   * Inject tool calling prompt into messages for emulation
   */
  private injectToolCallingPrompt(messages: Message[], tools: Tool[]): Message[] {
    const toolPrompt = this.generateToolCallingPrompt(tools);

    // Add tool prompt as system message if first message is not system
    if (messages.length === 0 || messages[0].role !== 'system') {
      return [
        {
          role: 'system',
          content: { type: 'text', text: toolPrompt },
        },
        ...messages,
      ];
    }

    // Append to existing system message
    const systemMessage = messages[0];
    const existingText = Array.isArray(systemMessage.content)
      ? systemMessage.content.find((c): c is { type: 'text'; text: string } => c.type === 'text')?.text ?? ''
      : systemMessage.content.type === 'text'
      ? systemMessage.content.text
      : '';

    return [
      {
        ...systemMessage,
        content: { type: 'text', text: `${existingText}\n\n${toolPrompt}` },
      },
      ...messages.slice(1),
    ];
  }

  /**
   * Process response from emulated tool calling model
   */
  processEmulatedResponse(response: string): {
    text: string;
    toolCalls: ExtractedToolCall[];
  } {
    const toolCalls = this.extractToolCalls(response);
    const text = this.removeToolCalls(response);

    return { text, toolCalls };
  }

  /**
   * Check if model needs tool calling emulation
   */
  needsToolCallingEmulation(model: string, tools?: Tool[]): boolean {
    if (!tools || tools.length === 0) {
      return false;
    }

    const capabilities = this.getModelCapabilities(model);
    if (!capabilities) {
      this.logger.warn(`Unknown model: ${model}, assuming native tool calling`);
      return false;
    }

    return !capabilities.supportsNativeToolCalling;
  }

  /**
   * Prepare messages for model (with emulation if needed)
   */
  prepareMessages(
    model: string,
    messages: Message[],
    options?: CompletionOptions
  ): Message[] {
    if (this.needsToolCallingEmulation(model, options?.tools)) {
      return this.injectToolCallingPrompt(messages, options!.tools!);
    }

    return messages;
  }

  /**
   * Auto-select model based on requirements
   */
  autoSelectModel(requirements: {
    requires_unrestricted?: boolean;
    requires_chinese?: boolean;
    requires_vision?: boolean;
    priority?: 'speed' | 'quality' | 'cost';
  }): string {
    // Unrestricted content -> abliterated models
    if (requirements.requires_unrestricted) {
      if (requirements.priority === 'quality') {
        return 'qwen-2.5-72b'; // Best unrestricted reasoning
      }
      return 'dolphin-3-venice-24b'; // Good balance
    }

    // Chinese/multilingual -> GLM-4.7
    if (requirements.requires_chinese) {
      return 'glm-4.7';
    }

    // Vision -> Gemini or Claude
    if (requirements.requires_vision) {
      if (requirements.priority === 'speed') {
        return 'gemini-2.0-flash';
      }
      return 'claude-sonnet-4.5';
    }

    // Default routing by priority
    switch (requirements.priority) {
      case 'speed':
        return 'gemini-2.0-flash';
      case 'quality':
        return 'claude-opus-4.5';
      case 'cost':
        return 'gemini-2.0-flash';
      default:
        return 'claude-sonnet-4.5';
    }
  }

  /**
   * Get list of all supported models
   */
  getSupportedModels(): string[] {
    return Array.from(this.modelCapabilities.keys());
  }

  /**
   * Get models by capability
   */
  getModelsByCapability(capability: keyof ModelCapabilities): string[] {
    return Array.from(this.modelCapabilities.entries())
      .filter(([_, caps]) => caps[capability] === true)
      .map(([model, _]) => model);
  }
}

/**
 * Global model proxy instance
 */
let globalModelProxy: ModelProxyServer | null = null;

/**
 * Initialize global model proxy
 */
export function initModelProxy(config: ModelProxyConfig, logger?: LoggerLike): ModelProxyServer {
  globalModelProxy = new ModelProxyServer(config, logger);
  return globalModelProxy;
}

/**
 * Get global model proxy
 */
export function getModelProxy(): ModelProxyServer {
  if (!globalModelProxy) {
    globalModelProxy = new ModelProxyServer({});
  }
  return globalModelProxy;
}
