/**
 * Tool Execution with Agents
 *
 * Provides agents with the ability to execute tools via MCP,
 * including parameter validation, transformation, and error recovery.
 */

import { z } from 'zod';
import { Logger, LoggerLike } from '../utils/logger';
import { AgentError } from '../types';
import { getMCPRegistry } from './registry';
import { MCPClient, createMCPClient } from './client';
import type { MCPTool, MCPToolResult } from './types';

/**
 * Parameter transformation result
 */
export interface ParameterTransformResult {
  /**
   * Transformed parameters
   */
  params: Record<string, unknown>;

  /**
   * Whether transformation was successful
   */
  success: boolean;

  /**
   * Transformation errors
   */
  errors: string[];
}

/**
 * Tool execution options
 */
export interface ToolExecutionOptions {
  /**
   * Validate parameters before execution
   */
  validateParams?: boolean;

  /**
   * Transform parameters before execution
   */
  transformParams?: boolean;

  /**
   * Retry on failure
   */
  retryOnFailure?: boolean;

  /**
   * Maximum retry attempts
   */
  maxRetries?: number;

  /**
   * Retry delay in milliseconds
   */
  retryDelayMs?: number;

  /**
   * Execution timeout in milliseconds
   */
  timeoutMs?: number;
}

/**
 * Tool execution context
 */
export interface ToolExecutionContext {
  /**
   * Agent ID executing the tool
   */
  agentId: string;

  /**
   * Task ID
   */
  taskId?: string;

  /**
   * Execution timestamp
   */
  timestamp: Date;

  /**
   * Additional context data
   */
  context?: Record<string, unknown>;
}

/**
 * Tool execution result with metadata
 */
export interface ToolExecutionResult extends MCPToolResult {
  /**
   * Server ID
   */
  serverId: string;

  /**
   * Tool name
   */
  toolName: string;

  /**
   * Execution context
   */
  context?: ToolExecutionContext;

  /**
   * Number of attempts
   */
  attempts: number;

  /**
   * Execution duration in milliseconds
   */
  durationMs: number;

  /**
   * Transformed parameters
   */
  transformedParams?: Record<string, unknown>;
}

/**
 * Parameter transformation rule
 */
interface ParameterTransformationRule {
  /**
   * Parameter name pattern (regex)
   */
  pattern: RegExp;

  /**
   * Transformation function
   */
  transform: (value: unknown) => unknown;
}

/**
 * Agent Executor class
 *
 * Manages tool execution through MCP for agents, including
 * parameter validation, transformation, and error recovery.
 */
export class AgentExecutor {
  private config: Required<ToolExecutionOptions>;
  private logger: LoggerLike;
  private clients: Map<string, MCPClient> = new Map();
  private transformationRules: ParameterTransformationRule[] = [];

  constructor(config: ToolExecutionOptions = {}, logger?: LoggerLike) {
    this.config = {
      validateParams: config.validateParams ?? true,
      transformParams: config.transformParams ?? true,
      retryOnFailure: config.retryOnFailure ?? true,
      maxRetries: config.maxRetries ?? 3,
      retryDelayMs: config.retryDelayMs ?? 1000,
      timeoutMs: config.timeoutMs ?? 30000,
    };
    this.logger = logger || new Logger();
    this.logger.info('AgentExecutor initialized', 'AgentExecutor', this.config);

    this.initializeDefaultTransformations();
  }

  /**
   * Execute a tool through MCP
   *
   * @param serverId - Server ID
   * @param toolName - Tool name
   * @param args - Tool arguments
   * @param context - Execution context
   * @returns Tool execution result
   * @throws {AgentError} If execution fails after retries
   */
  async executeTool(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>,
    context?: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    let attempts = 0;
    let lastError: Error | undefined;
    let transformedArgs = args;

    this.logger.info(
      `Executing tool: ${toolName} on server: ${serverId}`,
      'AgentExecutor',
      { args, context }
    );

    // Get tool schema
    const tool = await this.getTool(serverId, toolName);
    if (!tool) {
      throw new AgentError(
        `Tool '${toolName}' not found on server '${serverId}'`,
        serverId,
        { toolName, args }
      );
    }

    // Validate parameters
    if (this.config.validateParams) {
      const validation = this.validateParameters(tool, args);
      if (!validation.success) {
        throw new AgentError(
          `Parameter validation failed: ${validation.errors.join(', ')}`,
          serverId,
          { toolName, args, errors: validation.errors }
        );
      }
    }

    // Transform parameters
    if (this.config.transformParams) {
      const transformResult = this.transformParameters(args);
      transformedArgs = transformResult.params;

      if (!transformResult.success) {
        this.logger.warn(
          `Parameter transformation had errors: ${transformResult.errors.join(', ')}`,
          'AgentExecutor'
        );
      }
    }

    // Execute with retry logic
    while (attempts <= this.config.maxRetries) {
      attempts++;

      try {
        const client = await this.getClient(serverId);
        const result = await this.executeWithTimeout(
          client,
          toolName,
          transformedArgs
        );

        const durationMs = Date.now() - startTime;

        this.logger.info(
          `Tool executed successfully: ${toolName}`,
          'AgentExecutor',
          { attempts, durationMs }
        );

        return {
          ...result,
          serverId,
          toolName,
          context,
          attempts,
          durationMs,
          transformedParams: this.config.transformParams ? transformedArgs : undefined,
        };
      } catch (error) {
        lastError = error as Error;

        this.logger.warn(
          `Tool execution attempt ${attempts} failed: ${toolName}`,
          'AgentExecutor',
          { error: (error as Error).message }
        );

        if (attempts < this.config.maxRetries && this.config.retryOnFailure) {
          await this.delay(this.config.retryDelayMs);
        }
      }
    }

    // All retries exhausted
    const durationMs = Date.now() - startTime;
    throw new AgentError(
      `Tool execution failed after ${attempts} attempts: ${(lastError as Error).message}`,
      serverId,
      { toolName, args, attempts, durationMs, error: lastError }
    );
  }

  /**
   * Execute tool with timeout
   *
   * @param client - MCP client
   * @param toolName - Tool name
   * @param args - Tool arguments
   * @returns Tool result
   * @throws {Error} If timeout occurs
   */
  private async executeWithTimeout(
    client: MCPClient,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<MCPToolResult> {
    return Promise.race([
      client.callTool(toolName, args),
      new Promise<MCPToolResult>((_, reject) =>
        setTimeout(() => reject(new Error('Tool execution timeout')), this.config.timeoutMs)
      ),
    ]);
  }

  /**
   * Validate parameters against tool schema
   *
   * @param tool - MCP tool
   * @param args - Parameters to validate
   * @returns Validation result
   */
  private validateParameters(
    tool: MCPTool,
    args: Record<string, unknown>
  ): ParameterTransformResult {
    const errors: string[] = [];
    const schema = tool.inputSchema;
    const required = schema.required || [];

    // Check required parameters
    for (const param of required) {
      if (!(param in args)) {
        errors.push(`Missing required parameter: ${param}`);
      }
    }

    // Check parameter types
    if (schema.properties) {
      for (const [name, value] of Object.entries(args)) {
        const propSchema = schema.properties[name];
        if (!propSchema) {
          errors.push(`Unknown parameter: ${name}`);
          continue;
        }

        const type = propSchema.type;
        const validation = this.validateType(value, type);

        if (!validation.valid) {
          errors.push(
            `Parameter '${name}' has invalid type: expected ${type}, got ${validation.actualType}`
          );
        }

        // Check enum values
        if (propSchema.enum && !propSchema.enum.includes(String(value))) {
          errors.push(
            `Parameter '${name}' has invalid value: must be one of ${propSchema.enum.join(', ')}`
          );
        }
      }
    }

    return {
      params: args,
      success: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate value against type
   *
   * @param value - Value to validate
   * @param type - Expected type
   * @returns Validation result
   */
  private validateType(
    value: unknown,
    type: string
  ): { valid: boolean; actualType: string } {
    const actualType = Array.isArray(value) ? 'array' : typeof value;

    switch (type) {
      case 'string':
        return { valid: actualType === 'string', actualType };
      case 'number':
        return { valid: actualType === 'number', actualType };
      case 'boolean':
        return { valid: actualType === 'boolean', actualType };
      case 'array':
        return { valid: actualType === 'array', actualType };
      case 'object':
        return { valid: actualType === 'object' && value !== null, actualType };
      default:
        return { valid: true, actualType };
    }
  }

  /**
   * Transform parameters using registered rules
   *
   * @param args - Parameters to transform
   * @returns Transformation result
   */
  private transformParameters(
    args: Record<string, unknown>
  ): ParameterTransformResult {
    const errors: string[] = [];
    const params: Record<string, unknown> = { ...args };

    for (const [name, value] of Object.entries(args)) {
      let transformed = value;

      for (const rule of this.transformationRules) {
        if (rule.pattern.test(name)) {
          try {
            transformed = rule.transform(transformed);
          } catch (error) {
            errors.push(
              `Failed to transform parameter '${name}': ${(error as Error).message}`
            );
          }
        }
      }

      params[name] = transformed;
    }

    return {
      params,
      success: errors.length === 0,
      errors,
    };
  }

  /**
   * Initialize default parameter transformation rules
   */
  private initializeDefaultTransformations(): void {
    // String trimming
    this.transformationRules.push({
      pattern: /.*_str$/,
      transform: (value: unknown) =>
        typeof value === 'string' ? value.trim() : value,
    });

    // Number parsing
    this.transformationRules.push({
      pattern: /.*_num$/,
      transform: (value: unknown) => {
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
          const parsed = parseFloat(value);
          return isNaN(parsed) ? value : parsed;
        }
        return value;
      },
    });

    // Boolean parsing
    this.transformationRules.push({
      pattern: /.*_bool$/,
      transform: (value: unknown) => {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
          const lower = value.toLowerCase();
          if (lower === 'true' || lower === '1' || lower === 'yes') return true;
          if (lower === 'false' || lower === '0' || lower === 'no') return false;
        }
        return value;
      },
    });

    // Array parsing (comma-separated)
    this.transformationRules.push({
      pattern: /.*_list$/,
      transform: (value: unknown) => {
        if (Array.isArray(value)) return value;
        if (typeof value === 'string') {
          return value.split(',').map((s) => s.trim());
        }
        return value;
      },
    });
  }

  /**
   * Add a parameter transformation rule
   *
   * @param pattern - Parameter name pattern
   * @param transform - Transformation function
   */
  addTransformationRule(
    pattern: RegExp,
    transform: (value: unknown) => unknown
  ): void {
    this.transformationRules.push({ pattern, transform });
    this.logger.debug(
      `Added transformation rule for pattern: ${pattern.source}`,
      'AgentExecutor'
    );
  }

  /**
   * Clear transformation rules
   */
  clearTransformationRules(): void {
    this.transformationRules = [];
    this.initializeDefaultTransformations();
    this.logger.debug('Transformation rules reset to defaults', 'AgentExecutor');
  }

  /**
   * Get tool from server
   *
   * @param serverId - Server ID
   * @param toolName - Tool name
   * @returns Tool or undefined
   */
  private async getTool(
    serverId: string,
    toolName: string
  ): Promise<MCPTool | undefined> {
    const registry = getMCPRegistry();
    const serverState = registry.get(serverId);

    if (!serverState) {
      return undefined;
    }

    return serverState.tools.find((t) => t.name === toolName);
  }

  /**
   * Get or create MCP client for server
   *
   * @param serverId - Server ID
   * @returns MCP client instance
   */
  private async getClient(serverId: string): Promise<MCPClient> {
    if (this.clients.has(serverId)) {
      const client = this.clients.get(serverId)!;
      if (client.isConnected()) {
        return client;
      }
    }

    const client = createMCPClient({ serverId }, this.logger);
    await client.connect();
    this.clients.set(serverId, client);

    return client;
  }

  /**
   * Delay for retry
   *
   * @param ms - Milliseconds to delay
   * @returns Promise that resolves after delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Disconnect all MCP clients
   */
  async disconnect(): Promise<void> {
    this.logger.info('Disconnecting all MCP clients', 'AgentExecutor');

    const disconnectPromises = Array.from(this.clients.values()).map((client) =>
      client.disconnect()
    );

    await Promise.all(disconnectPromises);
    this.clients.clear();
  }

  /**
   * Get executor statistics
   *
   * @returns Statistics about executor
   */
  getStatistics(): {
    activeClients: number;
    transformationRules: number;
    config: ToolExecutionOptions;
  } {
    return {
      activeClients: this.clients.size,
      transformationRules: this.transformationRules.length,
      config: this.config,
    };
  }
}

/**
 * Schema for tool execution options
 */
export const ToolExecutionOptionsSchema = z.object({
  validateParams: z.boolean().optional(),
  transformParams: z.boolean().optional(),
  retryOnFailure: z.boolean().optional(),
  maxRetries: z.number().min(0).optional(),
  retryDelayMs: z.number().min(0).optional(),
  timeoutMs: z.number().min(100).optional(),
});

/**
 * Schema for tool execution context
 */
export const ToolExecutionContextSchema = z.object({
  agentId: z.string(),
  taskId: z.string().optional(),
  timestamp: z.date(),
  context: z.record(z.unknown()).optional(),
});

/**
 * Global agent executor instance
 */
let globalAgentExecutor: AgentExecutor | null = null;

/**
 * Initialize global agent executor
 *
 * @param config - Executor configuration
 * @param logger - Optional logger instance
 * @returns The global agent executor
 */
export function initAgentExecutor(
  config?: ToolExecutionOptions,
  logger?: LoggerLike
): AgentExecutor {
  globalAgentExecutor = new AgentExecutor(config, logger);
  return globalAgentExecutor;
}

/**
 * Get global agent executor
 *
 * @returns The global agent executor
 */
export function getAgentExecutor(): AgentExecutor {
  if (!globalAgentExecutor) {
    globalAgentExecutor = new AgentExecutor();
  }
  return globalAgentExecutor;
}
