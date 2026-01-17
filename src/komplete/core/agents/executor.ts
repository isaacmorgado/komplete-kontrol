/**
 * Agent Executor for KOMPLETE-KONTROL CLI
 *
 * Provides the actual execution engine for agents, connecting them to:
 * - AI Providers (for LLM completions)
 * - MCP Servers (for tool execution)
 * - Context Management (for message history)
 *
 * This replaces the placeholder in AgentOrchestrator.performTaskExecution()
 */

import type {
  AgentDefinition,
  AgentTask,
  AgentTaskResult,
  Message,
  MessageContent,
  Tool,
  ToolUseContent,
  ToolResultContent,
  TextContent,
  CompletionOptions,
  CompletionResult,
  ProviderPrefix,
} from '../../types';
import { AgentError } from '../../types';
import { Logger } from '../../utils/logger';
import { getProviderRegistry } from '../providers/registry';
import { getModelRouter } from '../providers/router';
import { getMCPRegistry } from '../../mcp/registry';
import { MCPClient, createMCPClient } from '../../mcp/client';
import { getAgentRegistry } from './registry';

/**
 * Agent executor configuration
 */
export interface AgentExecutorConfig {
  /**
   * Default provider prefix (e.g., 'anthropic', 'oai')
   */
  defaultProvider: ProviderPrefix;

  /**
   * Default model to use
   */
  defaultModel: string;

  /**
   * Maximum iterations in the agentic loop
   */
  maxIterations: number;

  /**
   * Execution timeout in milliseconds
   */
  executionTimeoutMs: number;

  /**
   * Enable tool use (MCP integration)
   */
  enableToolUse: boolean;

  /**
   * Enable streaming responses
   */
  enableStreaming: boolean;

  /**
   * Maximum tokens per request
   */
  maxTokensPerRequest: number;

  /**
   * Temperature for completions
   */
  temperature: number;
}

/**
 * Default executor configuration
 */
const DEFAULT_CONFIG: AgentExecutorConfig = {
  defaultProvider: 'anthropic',
  defaultModel: 'anthropic/claude-3-5-sonnet-20241022',
  maxIterations: 10,
  executionTimeoutMs: 120000, // 2 minutes
  enableToolUse: true,
  enableStreaming: false,
  maxTokensPerRequest: 4096,
  temperature: 0.7,
};

/**
 * Execution context for an agent task
 */
export interface ExecutionContext {
  /**
   * Agent ID
   */
  agentId: string;

  /**
   * Agent definition
   */
  agent: AgentDefinition;

  /**
   * Task being executed
   */
  task: AgentTask;

  /**
   * Conversation messages
   */
  messages: Message[];

  /**
   * Available tools from MCP servers
   */
  tools: Tool[];

  /**
   * Session ID for tracking
   */
  sessionId: string;

  /**
   * Variables for execution
   */
  variables: Map<string, unknown>;
}

/**
 * Record of a tool call during execution
 */
export interface ToolCallRecord {
  /**
   * Tool name
   */
  toolName: string;

  /**
   * Tool use ID
   */
  toolUseId: string;

  /**
   * Input arguments
   */
  input: Record<string, unknown>;

  /**
   * Output result
   */
  output: string;

  /**
   * Whether the call succeeded
   */
  success: boolean;

  /**
   * Error message if failed
   */
  error?: string;

  /**
   * Duration in milliseconds
   */
  durationMs: number;
}

/**
 * Result of agent execution
 */
export interface ExecutionResult {
  /**
   * Task ID
   */
  taskId: string;

  /**
   * Agent ID
   */
  agentId: string;

  /**
   * Whether execution succeeded
   */
  success: boolean;

  /**
   * Final output from the agent
   */
  output: unknown;

  /**
   * All messages from execution
   */
  messages: Message[];

  /**
   * All tool calls made during execution
   */
  toolCalls: ToolCallRecord[];

  /**
   * Token usage
   */
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };

  /**
   * Number of iterations completed
   */
  iterations: number;

  /**
   * Total duration in milliseconds
   */
  durationMs: number;

  /**
   * Error if execution failed
   */
  error?: Error;
}

/**
 * Agent Executor class
 *
 * Executes agent tasks using AI providers and MCP tools.
 * Implements the agentic loop: LLM call → tool use → tool result → repeat
 */
export class AgentExecutor {
  private logger: Logger;
  private config: AgentExecutorConfig;
  private mcpClients: Map<string, MCPClient> = new Map();

  constructor(config: Partial<AgentExecutorConfig> = {}, logger?: Logger) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = logger?.child('AgentExecutor') ?? new Logger().child('AgentExecutor');
    this.logger.info('AgentExecutor initialized', 'AgentExecutor', {
      defaultModel: this.config.defaultModel,
      maxIterations: this.config.maxIterations,
    });
  }

  /**
   * Execute an agent task
   *
   * @param context - Execution context
   * @returns Execution result
   */
  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const startTime = Date.now();
    const toolCalls: ToolCallRecord[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let iterations = 0;

    this.logger.info(`Starting execution for agent: ${context.agentId}`, 'AgentExecutor', {
      taskId: context.task.id,
      taskDescription: context.task.description,
    });

    try {
      // Get the provider
      const router = getModelRouter();
      const provider = router.getProvider(this.config.defaultModel);

      // Build initial messages with system prompt
      const messages: Message[] = [
        {
          role: 'system',
          content: { type: 'text', text: context.agent.systemPrompt } as TextContent,
        },
        ...context.messages,
        {
          role: 'user',
          content: {
            type: 'text',
            text: this.buildTaskPrompt(context.task),
          } as TextContent,
        },
      ];

      // Collect available tools from MCP servers
      const tools = this.config.enableToolUse ? await this.collectMCPTools() : [];

      // Agentic execution loop
      while (iterations < this.config.maxIterations) {
        iterations++;

        this.logger.debug(`Iteration ${iterations}/${this.config.maxIterations}`, 'AgentExecutor');

        // Call the provider
        const completionOptions: CompletionOptions = {
          maxTokens: this.config.maxTokensPerRequest,
          temperature: this.config.temperature,
          tools: tools.length > 0 ? tools : undefined,
        };

        const result: CompletionResult = await provider.complete(
          router.getModelName(this.config.defaultModel),
          messages,
          completionOptions
        );

        // Track token usage
        if (result.usage) {
          totalInputTokens += result.usage.inputTokens;
          totalOutputTokens += result.usage.outputTokens;
        }

        // Add assistant response to messages
        messages.push({
          role: 'assistant',
          content: result.content,
        });

        // Check for tool use
        const toolUses = this.extractToolUses(result.content);

        if (toolUses.length === 0) {
          // No tool use - execution complete
          this.logger.info('Execution complete - no more tool calls', 'AgentExecutor', {
            iterations,
          });

          const output = this.extractFinalOutput(result.content);

          return {
            taskId: context.task.id,
            agentId: context.agentId,
            success: true,
            output,
            messages,
            toolCalls,
            usage: {
              inputTokens: totalInputTokens,
              outputTokens: totalOutputTokens,
              totalTokens: totalInputTokens + totalOutputTokens,
            },
            iterations,
            durationMs: Date.now() - startTime,
          };
        }

        // Execute tool calls
        const toolResults: ToolResultContent[] = [];

        for (const toolUse of toolUses) {
          const callStart = Date.now();

          this.logger.debug(`Executing tool: ${toolUse.name}`, 'AgentExecutor', {
            toolUseId: toolUse.id,
            input: toolUse.input,
          });

          try {
            const result = await this.executeTool(toolUse);

            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: result,
              is_error: false,
            });

            toolCalls.push({
              toolName: toolUse.name,
              toolUseId: toolUse.id,
              input: toolUse.input,
              output: result,
              success: true,
              durationMs: Date.now() - callStart,
            });

            this.logger.debug(`Tool executed successfully: ${toolUse.name}`, 'AgentExecutor');
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: `Error: ${errorMessage}`,
              is_error: true,
            });

            toolCalls.push({
              toolName: toolUse.name,
              toolUseId: toolUse.id,
              input: toolUse.input,
              output: '',
              success: false,
              error: errorMessage,
              durationMs: Date.now() - callStart,
            });

            this.logger.warn(`Tool execution failed: ${toolUse.name}`, 'AgentExecutor', {
              error: errorMessage,
            });
          }
        }

        // Add tool results to messages
        messages.push({
          role: 'user',
          content: toolResults as unknown as MessageContent[],
        });
      }

      // Max iterations reached
      this.logger.warn('Max iterations reached', 'AgentExecutor', {
        maxIterations: this.config.maxIterations,
      });

      return {
        taskId: context.task.id,
        agentId: context.agentId,
        success: false,
        output: 'Max iterations reached without completion',
        messages,
        toolCalls,
        usage: {
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          totalTokens: totalInputTokens + totalOutputTokens,
        },
        iterations,
        durationMs: Date.now() - startTime,
        error: new Error('Max iterations reached'),
      };
    } catch (error) {
      const execError = error instanceof Error ? error : new Error(String(error));

      this.logger.error('Execution failed', 'AgentExecutor', {
        error: execError.message,
        agentId: context.agentId,
        taskId: context.task.id,
      });

      return {
        taskId: context.task.id,
        agentId: context.agentId,
        success: false,
        output: null,
        messages: context.messages,
        toolCalls,
        usage: {
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          totalTokens: totalInputTokens + totalOutputTokens,
        },
        iterations,
        durationMs: Date.now() - startTime,
        error: execError,
      };
    }
  }

  /**
   * Build task prompt from AgentTask
   */
  private buildTaskPrompt(task: AgentTask): string {
    let prompt = `Task: ${task.description}\n`;

    if (task.input && Object.keys(task.input).length > 0) {
      prompt += '\nInput:\n';
      for (const [key, value] of Object.entries(task.input)) {
        prompt += `- ${key}: ${JSON.stringify(value)}\n`;
      }
    }

    return prompt;
  }

  /**
   * Collect tools from all connected MCP servers
   */
  private async collectMCPTools(): Promise<Tool[]> {
    const tools: Tool[] = [];
    const registry = getMCPRegistry();

    // Get all running servers
    const servers = registry.listByStatus('running');

    for (const server of servers) {
      try {
        // Get or create client for this server
        let client = this.mcpClients.get(server.config.id);

        if (!client) {
          client = createMCPClient({
            serverId: server.config.id,
            timeout: 30000,
          });
          await client.connect();
          this.mcpClients.set(server.config.id, client);
        }

        // Get tools from server
        const serverTools = await client.listTools();

        for (const mcpTool of serverTools) {
          tools.push({
            name: `${server.config.id}__${mcpTool.name}`,
            description: mcpTool.description || '',
            inputSchema: mcpTool.inputSchema,
          });
        }

        this.logger.debug(`Collected ${serverTools.length} tools from ${server.config.id}`, 'AgentExecutor');
      } catch (error) {
        this.logger.warn(`Failed to collect tools from ${server.config.id}`, 'AgentExecutor', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return tools;
  }

  /**
   * Execute a tool via MCP
   *
   * @param toolUse - Tool use content from LLM response
   * @returns Tool execution result
   */
  private async executeTool(toolUse: ToolUseContent): Promise<string> {
    // Parse tool name to get server ID and actual tool name
    // Format: serverId__toolName
    const parts = toolUse.name.split('__');

    if (parts.length !== 2) {
      throw new Error(`Invalid tool name format: ${toolUse.name}. Expected: serverId__toolName`);
    }

    const [serverId, toolName] = parts;

    // Get MCP client
    const client = this.mcpClients.get(serverId!);

    if (!client) {
      throw new Error(`MCP client not found for server: ${serverId}`);
    }

    // Call the tool
    const result = await client.callTool(toolName!, toolUse.input);

    if (!result.success) {
      throw new Error(result.error || 'Tool execution failed');
    }

    // Convert result content to string
    if (typeof result.content === 'string') {
      return result.content;
    }

    if (Array.isArray(result.content)) {
      return result.content
        .map((item) => {
          if (typeof item === 'string') return item;
          if (item.type === 'text' && 'text' in item) return item.text;
          return JSON.stringify(item);
        })
        .join('\n');
    }

    return JSON.stringify(result.content);
  }

  /**
   * Extract tool use content blocks from completion result
   */
  private extractToolUses(content: MessageContent | Array<MessageContent>): ToolUseContent[] {
    if (!Array.isArray(content)) {
      if (content.type === 'tool_use') {
        return [content as ToolUseContent];
      }
      return [];
    }

    return content.filter((c): c is ToolUseContent => c.type === 'tool_use');
  }

  /**
   * Extract final text output from completion result
   */
  private extractFinalOutput(content: MessageContent | Array<MessageContent>): string {
    if (!Array.isArray(content)) {
      if (content.type === 'text') {
        return (content as TextContent).text;
      }
      return '';
    }

    const textBlocks = content.filter((c): c is TextContent => c.type === 'text');
    return textBlocks.map((t) => t.text).join('\n');
  }

  /**
   * Build execution context for a task
   *
   * @param task - Agent task
   * @returns Execution context
   */
  async buildContext(task: AgentTask): Promise<ExecutionContext> {
    const agentRegistry = getAgentRegistry();
    const agent = agentRegistry.get(task.agentId);

    if (!agent) {
      throw new AgentError(`Agent not found: ${task.agentId}`, task.agentId);
    }

    return {
      agentId: task.agentId,
      agent,
      task,
      messages: [],
      tools: [],
      sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      variables: new Map(),
    };
  }

  /**
   * Disconnect all MCP clients
   */
  async disconnect(): Promise<void> {
    for (const [serverId, client] of this.mcpClients) {
      try {
        await client.disconnect();
        this.logger.debug(`Disconnected MCP client: ${serverId}`, 'AgentExecutor');
      } catch (error) {
        this.logger.warn(`Failed to disconnect MCP client: ${serverId}`, 'AgentExecutor', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    this.mcpClients.clear();
  }

  /**
   * Get executor configuration
   */
  getConfig(): Readonly<AgentExecutorConfig> {
    return { ...this.config };
  }

  /**
   * Update executor configuration
   */
  updateConfig(config: Partial<AgentExecutorConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.debug('Configuration updated', 'AgentExecutor', config);
  }
}

/**
 * Global agent executor instance
 */
let globalAgentExecutor: AgentExecutor | null = null;

/**
 * Initialize global agent executor
 *
 * @param config - Executor configuration
 * @param logger - Logger instance
 * @returns Agent executor instance
 */
export function initAgentExecutor(
  config?: Partial<AgentExecutorConfig>,
  logger?: Logger
): AgentExecutor {
  globalAgentExecutor = new AgentExecutor(config, logger);
  return globalAgentExecutor;
}

/**
 * Get global agent executor
 *
 * @returns Agent executor instance
 */
export function getAgentExecutor(): AgentExecutor {
  if (!globalAgentExecutor) {
    globalAgentExecutor = new AgentExecutor();
  }
  return globalAgentExecutor;
}
