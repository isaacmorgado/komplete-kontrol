/**
 * Agent-MCP Tool Integration
 *
 * Provides integration between agents and MCP tools, enabling agents to discover,
 * match capabilities with tools, and execute tools through the MCP client.
 */

import { z } from 'zod';
import { Logger, LoggerLike } from '../../utils/logger';
import { AgentError } from '../../types';
import { getMCPRegistry } from '../../mcp';
import { MCPClient, createMCPClient } from '../../mcp';
import type { MCPTool, MCPToolResult } from '../../mcp';

/**
 * Tool capability match score
 */
export interface ToolCapabilityMatch {
  /**
   * Tool name
   */
  toolName: string;

  /**
   * Server ID providing the tool
   */
  serverId: string;

  /**
   * Match score (0-1, higher is better)
   */
  score: number;

  /**
   * Match reason
   */
  reason: string;
}

/**
 * Tool match result
 */
export interface ToolMatchResult {
  /**
   * The matched tool
   */
  tool: MCPTool;

  /**
   * Match score (0-1)
   */
  score: number;

  /**
   * Server ID providing the tool
   */
  serverId: string;
}

/**
 * Tool match options
 */
export interface ToolMatchOptions {
  /**
   * Minimum score threshold
   */
  minScore?: number;

  /**
   * Maximum number of results
   */
  maxResults?: number;

  /**
   * Include metadata in results
   */
  includeMetadata?: boolean;
}

/**
 * Agent-MCP integration configuration
 */
export interface AgentMCPIntegrationConfig {
  /**
   * Enable automatic tool discovery
   */
  autoDiscover?: boolean;

  /**
   * Minimum match score for tool selection
   */
  minMatchScore?: number;

  /**
   * Maximum number of tools to return for a capability
   */
  maxToolsPerCapability?: number;

  /**
   * Enable tool caching
   */
  enableCache?: boolean;

  /**
   * Cache TTL in milliseconds
   */
  cacheTtlMs?: number;

  /**
   * Cache TTL in milliseconds (alias for cacheTtlMs)
   */
  cacheTTL?: number;
}

/**
 * Cached tool entry
 */
interface CachedTool {
  tool: MCPTool;
  serverId: string;
  expiresAt: number;
}

/**
 * Agent-MCP Integration class
 *
 * Manages the integration between agents and MCP tools, including
 * tool discovery, capability matching, and tool execution.
 */
export class AgentMCPIntegration {
  private config: Required<AgentMCPIntegrationConfig>;
  private logger: LoggerLike;
  private toolCache: Map<string, CachedTool> = new Map();
  private clients: Map<string, MCPClient> = new Map();
  private cacheHits: number = 0;
  private cacheMisses: number = 0;
  private totalMatches: number = 0;
  private matchScores: number[] = [];

  constructor(config: AgentMCPIntegrationConfig = {}, logger?: LoggerLike) {
    const cacheTtl = config.cacheTtlMs ?? config.cacheTTL ?? 300000; // 5 minutes
    this.config = {
      autoDiscover: config.autoDiscover ?? true,
      minMatchScore: config.minMatchScore ?? 0.3,
      maxToolsPerCapability: config.maxToolsPerCapability ?? 5,
      enableCache: config.enableCache ?? true,
      cacheTtlMs: cacheTtl,
      cacheTTL: cacheTtl,
    };
    this.logger = logger || new Logger();
    this.logger.info('AgentMCPIntegration initialized', 'AgentMCPIntegration', this.config);
  }

  /**
   * Discover tools from all active MCP servers
   *
   * @returns Map of server IDs to their tools
   */
  async discoverTools(): Promise<Map<string, MCPTool[]>> {
    this.logger.debug('Discovering tools from MCP servers', 'AgentMCPIntegration');

    const registry = getMCPRegistry();
    const servers = registry.listByStatus('running');
    const toolsMap = new Map<string, MCPTool[]>();

    for (const server of servers) {
      const tools = server.tools;
      if (tools && tools.length > 0) {
        toolsMap.set(server.id, tools);

        if (this.config.enableCache) {
          for (const tool of tools) {
            this.toolCache.set(
              `${server.id}:${tool.name}`,
              {
                tool,
                serverId: server.id,
                expiresAt: Date.now() + this.config.cacheTtlMs,
              }
            );
          }
        }
      }
    }

    this.logger.info(
      `Discovered ${toolsMap.size} servers with tools`,
      'AgentMCPIntegration',
      { totalTools: Array.from(toolsMap.values()).flat().length }
    );

    return toolsMap;
  }

  /**
   * Match tools to agent capability
   *
   * @param capability - Agent capability to match
   * @param context - Optional context for better matching
   * @returns Array of matched tools with scores
   */
  async matchToolsToCapability(
    capability: string,
    context?: string
  ): Promise<ToolCapabilityMatch[]> {
    this.logger.debug(
      `Matching tools to capability: ${capability}`,
      'AgentMCPIntegration',
      { context }
    );

    const toolsMap = await this.discoverTools();
    const matches: ToolCapabilityMatch[] = [];

    for (const [serverId, tools] of toolsMap.entries()) {
      for (const tool of tools) {
        const score = this.calculateMatchScore(capability, tool, context);
        if (score >= this.config.minMatchScore) {
          matches.push({
            toolName: tool.name,
            serverId,
            score,
            reason: this.getMatchReason(score, capability, tool),
          });
        }
      }
    }

    // Sort by score descending
    matches.sort((a, b) => b.score - a.score);

    // Limit results
    const limitedMatches = matches.slice(0, this.config.maxToolsPerCapability);

    this.logger.debug(
      `Matched ${limitedMatches.length} tools for capability: ${capability}`,
      'AgentMCPIntegration',
      { matches: limitedMatches }
    );

    return limitedMatches;
  }

  /**
   * Calculate match score between capability and tool
   *
   * @param capability - Agent capability
   * @param tool - MCP tool
   * @param context - Optional context
   * @returns Match score (0-1)
   */
  calculateMatchScore(
    capability: string,
    tool: MCPTool,
    context?: string
  ): number {
    const capabilityLower = capability.toLowerCase();
    const toolNameLower = tool.name.toLowerCase();
    const toolDescLower = tool.description.toLowerCase();

    let score = 0;

    // Exact name match (highest priority, return early)
    if (toolNameLower === capabilityLower) {
      score = 1.0;
      // Track statistics and return early
      this.totalMatches++;
      this.matchScores.push(score);
      return score;
    }
    // Partial name match (tool name contains capability)
    else if (toolNameLower.includes(capabilityLower)) {
      score += 0.7;
    }
    // Capability in tool name (capability contains tool name)
    else if (capabilityLower.includes(toolNameLower)) {
      score += 0.5;
    }

    // Description match
    const descWords = toolDescLower.split(/\s+/);
    const capabilityWords = capabilityLower.split(/[-_\s]+/);

    for (const capWord of capabilityWords) {
      if (descWords.includes(capWord)) {
        score += 0.3;
      }
    }

    // Context boost
    if (context) {
      const contextLower = context.toLowerCase();
      const contextWords = contextLower.split(/\s+/);

      for (const contextWord of contextWords) {
        if (toolNameLower.includes(contextWord) || toolDescLower.includes(contextWord)) {
          score += 0.2;
        }
      }
    }

    // Normalize to 0-1 range, but cap partial matches at 0.95 to ensure exact matches are always higher
    const normalizedScore = Math.min(score, 0.95);

    // Track statistics (already done for exact match)
    this.totalMatches++;
    this.matchScores.push(normalizedScore);

    return normalizedScore;
  }

  /**
   * Get reason for match
   *
   * @param score - Match score
   * @param capability - Agent capability
   * @param tool - MCP tool
   * @returns Match reason string
   */
  private getMatchReason(
    score: number,
    capability: string,
    tool: MCPTool
  ): string {
    if (score >= 1.0) {
      return `Exact name match with ${tool.name}`;
    } else if (score >= 0.8) {
      return `Strong partial name match with ${tool.name}`;
    } else if (score >= 0.5) {
      return `Moderate match based on name and description`;
    } else {
      return `Weak match based on description keywords`;
    }
  }

  /**
   * Execute a tool through MCP
   *
   * @param serverId - Server ID
   * @param toolName - Tool name
   * @param args - Tool arguments
   * @returns Tool execution result
   * @throws {AgentError} If tool execution fails
   */
  async executeTool(
    serverId: string,
    toolName: string,
    args?: Record<string, unknown>
  ): Promise<MCPToolResult> {
    this.logger.debug(
      `Executing tool: ${toolName} on server: ${serverId}`,
      'AgentMCPIntegration',
      { args }
    );

    const client = await this.getClient(serverId);

    try {
      const result = await client.callTool(toolName, args);

      if (result.success) {
        this.logger.info(
          `Tool executed successfully: ${toolName}`,
          'AgentMCPIntegration',
          { serverId, durationMs: result.metadata?.durationMs }
        );
      } else {
        this.logger.warn(
          `Tool execution failed: ${toolName}`,
          'AgentMCPIntegration',
          { error: result.error }
        );
      }

      return result;
    } catch (error) {
      const errorMessage = (error as Error).message;
      this.logger.error(
        `Tool execution error: ${toolName}`,
        'AgentMCPIntegration',
        { error: errorMessage }
      );

      throw new AgentError(
        `Failed to execute tool '${toolName}': ${errorMessage}`,
        serverId,
        { toolName, args, error }
      );
    }
  }

  /**
   * Get or create MCP client for server
   *
   * @param serverId - Server ID
   * @returns MCP client instance
   */
  private async getClient(serverId: string): Promise<MCPClient> {
    // Check cache
    if (this.clients.has(serverId)) {
      const client = this.clients.get(serverId)!;
      if (client.isConnected()) {
        return client;
      }
    }

    // Create new client
    const client = createMCPClient({ serverId }, this.logger);
    await client.connect();
    this.clients.set(serverId, client);

    return client;
  }

  /**
   * Get all available tools
   *
   * @returns Array of all available tools with server info
   */
  async getAllTools(): Promise<Array<{ tool: MCPTool; serverId: string }>> {
    const toolsMap = await this.discoverTools();
    const allTools: Array<{ tool: MCPTool; serverId: string }> = [];

    for (const [serverId, tools] of toolsMap.entries()) {
      for (const tool of tools) {
        allTools.push({ tool, serverId });
      }
    }

    return allTools;
  }

  /**
   * Get tool by name
   *
   * @param toolName - Tool name
   * @returns Tool with server ID or undefined
   */
  async getToolByName(
    toolName: string
  ): Promise<{ tool: MCPTool; serverId: string } | undefined> {
    const allTools = await this.getAllTools();
    return allTools.find((t) => t.tool.name === toolName);
  }

  /**
   * Check if tool exists
   *
   * @param toolName - Tool name
   * @returns True if tool exists
   */
  async hasTool(toolName: string): Promise<boolean> {
    const tool = await this.getToolByName(toolName);
    return tool !== undefined;
  }

  /**
   * Cache a tool
   *
   * @param serverId - Server ID
   * @param tool - Tool to cache
   */
  cacheTool(serverId: string, tool: MCPTool): void {
    const cacheKey = `${serverId}:${tool.name}`;
    this.toolCache.set(cacheKey, {
      tool,
      serverId,
      expiresAt: Date.now() + this.config.cacheTtlMs,
    });
    this.logger.debug(`Cached tool: ${tool.name} from server: ${serverId}`, 'AgentMCPIntegration');
  }

  /**
   * Get cached tool
   *
   * @param serverId - Server ID
   * @param toolName - Tool name
   * @returns Cached tool entry or undefined
   */
  getCachedTool(serverId: string, toolName: string): CachedTool | undefined {
    const cacheKey = `${serverId}:${toolName}`;
    const cached = this.toolCache.get(cacheKey);

    if (!cached) {
      this.cacheMisses++;
      return undefined;
    }

    // Check if expired
    if (Date.now() > cached.expiresAt) {
      this.toolCache.delete(cacheKey);
      this.cacheMisses++;
      return undefined;
    }

    this.cacheHits++;
    return cached;
  }

  /**
   * Clear tool cache
   */
  clearCache(): void {
    this.toolCache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.logger.debug('Tool cache cleared', 'AgentMCPIntegration');
  }

  /**
   * Disconnect all MCP clients
   */
  async disconnect(): Promise<void> {
    this.logger.info('Disconnecting all MCP clients', 'AgentMCPIntegration');

    const disconnectPromises = Array.from(this.clients.values()).map((client) =>
      client.disconnect()
    );

    await Promise.all(disconnectPromises);
    this.clients.clear();
  }

  /**
   * Get integration statistics
   *
   * @returns Statistics about the integration
   */
  getStatistics(): {
    cachedTools: number;
    cacheHitRate: number;
    totalMatches: number;
    avgMatchScore: number;
    activeClients: number;
    totalServers: number;
    totalTools: number;
  } {
    const registry = getMCPRegistry();
    const servers = registry.listByStatus('running');

    const totalCacheLookups = this.cacheHits + this.cacheMisses;
    const cacheHitRate = totalCacheLookups > 0 ? this.cacheHits / totalCacheLookups : 0;
    const avgMatchScore = this.matchScores.length > 0
      ? this.matchScores.reduce((a, b) => a + b, 0) / this.matchScores.length
      : 0;

    return {
      cachedTools: this.toolCache.size,
      cacheHitRate,
      totalMatches: this.totalMatches,
      avgMatchScore,
      activeClients: this.clients.size,
      totalServers: servers.length,
      totalTools: this.toolCache.size,
    };
  }
}

/**
 * Schema for agent-MCP integration configuration
 */
export const AgentMCPIntegrationConfigSchema = z.object({
  autoDiscover: z.boolean().optional(),
  minMatchScore: z.number().min(0).max(1).optional(),
  maxToolsPerCapability: z.number().min(1).optional(),
  enableCache: z.boolean().optional(),
  cacheTtlMs: z.number().min(0).optional(),
});

/**
 * Global agent-MCP integration instance
 */
let globalAgentMCPIntegration: AgentMCPIntegration | null = null;

/**
 * Initialize global agent-MCP integration
 *
 * @param config - Integration configuration
 * @param logger - Optional logger instance
 * @returns The global agent-MCP integration
 */
export function initAgentMCPIntegration(
  config?: AgentMCPIntegrationConfig,
  logger?: Logger
): AgentMCPIntegration {
  globalAgentMCPIntegration = new AgentMCPIntegration(config, logger);
  return globalAgentMCPIntegration;
}

/**
 * Get global agent-MCP integration
 *
 * @returns The global agent-MCP integration
 */
export function getAgentMCPIntegration(): AgentMCPIntegration {
  if (!globalAgentMCPIntegration) {
    globalAgentMCPIntegration = new AgentMCPIntegration();
  }
  return globalAgentMCPIntegration;
}
