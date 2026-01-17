/**
 * Tool Discovery and Registration
 *
 * Provides automatic tool discovery from MCP servers and registration
 * in the agent registry with tool metadata and capabilities.
 */

import { z } from 'zod';
import { Logger } from '../utils/logger';
import { getMCPRegistry } from './registry';
import { MCPClient, createMCPClient } from './client';
import type { MCPTool, MCPServerConfig } from './types';

/**
 * Tool metadata with extended information
 */
export interface DiscoveredTool extends MCPTool {
  /**
   * Server ID providing this tool
   */
  serverId: string;

  /**
   * Server name
   */
  serverName: string;

  /**
   * Tool capabilities extracted from description
   */
  capabilities: string[];

  /**
   * Discovery timestamp
   */
  discoveredAt: Date;

  /**
   * Last successful execution
   */
  lastUsedAt?: Date;

  /**
   * Success rate (0-1)
   */
  successRate?: number;

  /**
   * Average execution time in milliseconds
   */
  avgExecutionTimeMs?: number;
}

/**
 * Tool discovery configuration
 */
export interface ToolDiscoveryConfig {
  /**
   * Auto-discover on initialization
   */
  autoDiscover?: boolean;

  /**
   * Refresh interval in milliseconds
   */
  refreshIntervalMs?: number;

  /**
   * Enable tool capability extraction
   */
  extractCapabilities?: boolean;

  /**
   * Minimum success rate to keep tool
   */
  minSuccessRate?: number;
}

/**
 * Tool discovery result
 */
export interface ToolDiscoveryResult {
  /**
   * Number of servers discovered
   */
  serversDiscovered: number;

  /**
   * Number of tools discovered
   */
  toolsDiscovered: number;

  /**
   * Number of tools registered
   */
  toolsRegistered: number;

  /**
   * Discovery duration in milliseconds
   */
  durationMs: number;
}

/**
 * Tool Discovery class
 *
 * Manages automatic tool discovery from MCP servers and
 * registration of tools with metadata and capabilities.
 */
export class ToolDiscovery {
  private config: Required<ToolDiscoveryConfig>;
  private logger: Logger;
  private discoveredTools: Map<string, DiscoveredTool> = new Map();
  private clients: Map<string, MCPClient> = new Map();
  private refreshTimer: Timer | null = null;

  constructor(config: ToolDiscoveryConfig = {}, logger?: Logger) {
    this.config = {
      autoDiscover: config.autoDiscover ?? true,
      refreshIntervalMs: config.refreshIntervalMs ?? 600000, // 10 minutes
      extractCapabilities: config.extractCapabilities ?? true,
      minSuccessRate: config.minSuccessRate ?? 0.3,
    };
    this.logger = logger || new Logger();
    this.logger.info('ToolDiscovery initialized', 'ToolDiscovery', this.config);

    if (this.config.autoDiscover) {
      this.scheduleRefresh();
    }
  }

  /**
   * Discover tools from all registered MCP servers
   *
   * @returns Discovery result
   */
  async discover(): Promise<ToolDiscoveryResult> {
    const startTime = Date.now();
    this.logger.info('Starting tool discovery', 'ToolDiscovery');

    const registry = getMCPRegistry();
    const servers = registry.list();

    let serversDiscovered = 0;
    let toolsDiscovered = 0;
    let toolsRegistered = 0;

    for (const server of servers) {
      if (server.disabled) {
        this.logger.debug(`Skipping disabled server: ${server.id}`, 'ToolDiscovery');
        continue;
      }

      try {
        const serverTools = await this.discoverServerTools(server);
        serversDiscovered++;

        for (const tool of serverTools) {
          toolsDiscovered++;
          if (this.registerTool(tool)) {
            toolsRegistered++;
          }
        }
      } catch (error) {
        this.logger.error(
          `Failed to discover tools from server: ${server.id}`,
          'ToolDiscovery',
          { error: (error as Error).message }
        );
      }
    }

    const durationMs = Date.now() - startTime;

    const result: ToolDiscoveryResult = {
      serversDiscovered,
      toolsDiscovered,
      toolsRegistered,
      durationMs,
    };

    this.logger.info(
      'Tool discovery completed',
      'ToolDiscovery',
      result
    );

    return result;
  }

  /**
   * Discover tools from a specific server
   *
   * @param server - Server configuration
   * @returns Array of discovered tools
   */
  private async discoverServerTools(
    server: MCPServerConfig
  ): Promise<DiscoveredTool[]> {
    this.logger.debug(
      `Discovering tools from server: ${server.id}`,
      'ToolDiscovery'
    );

    const client = await this.getClient(server.id);
    const tools = client.listTools();

    return tools.map((tool) => ({
      ...tool,
      serverId: server.id,
      serverName: server.name,
      capabilities: this.config.extractCapabilities
        ? this.extractCapabilities(tool)
        : [],
      discoveredAt: new Date(),
    }));
  }

  /**
   * Extract capabilities from tool description
   *
   * @param tool - MCP tool
   * @returns Array of capability keywords
   */
  private extractCapabilities(tool: MCPTool): string[] {
    const capabilities: string[] = [];
    const text = `${tool.name} ${tool.description}`.toLowerCase();

    // Common capability keywords
    const capabilityPatterns = [
      { regex: /\b(search|find|query|lookup)\b/gi, capability: 'search' },
      { regex: /\b(read|get|fetch|retrieve)\b/gi, capability: 'read' },
      { regex: /\b(write|create|add|insert)\b/gi, capability: 'write' },
      { regex: /\b(update|modify|edit|change)\b/gi, capability: 'update' },
      { regex: /\b(delete|remove|erase)\b/gi, capability: 'delete' },
      { regex: /\b(list|enumerate|show)\b/gi, capability: 'list' },
      { regex: /\b(execute|run|invoke|call)\b/gi, capability: 'execute' },
      { regex: /\b(analyze|parse|process)\b/gi, capability: 'analyze' },
      { regex: /\b(transform|convert|format)\b/gi, capability: 'transform' },
      { regex: /\b(validate|check|verify)\b/gi, capability: 'validate' },
      { regex: /\b(files?|filesystem|fs)\b/gi, capability: 'filesystem' },
      { regex: /\b(http|web|api|request)\b/gi, capability: 'http' },
      { regex: /\b(database|db|sql)\b/gi, capability: 'database' },
      { regex: /\b(git|version|control)\b/gi, capability: 'git' },
      { regex: /\b(test|spec|assert)\b/gi, capability: 'test' },
      { regex: /\b(code|source|program)\b/gi, capability: 'code' },
      { regex: /\b(document|doc|readme)\b/gi, capability: 'documentation' },
    ];

    for (const pattern of capabilityPatterns) {
      if (pattern.regex.test(text)) {
        capabilities.push(pattern.capability);
      }
    }

    return [...new Set(capabilities)]; // Remove duplicates
  }

  /**
   * Register a discovered tool
   *
   * @param tool - Discovered tool
   * @returns True if tool was registered (new or updated)
   */
  private registerTool(tool: DiscoveredTool): boolean {
    const key = `${tool.serverId}:${tool.name}`;
    const existing = this.discoveredTools.get(key);

    if (existing) {
      // Update existing tool
      this.discoveredTools.set(key, {
        ...existing,
        ...tool,
        lastUsedAt: existing.lastUsedAt,
        successRate: existing.successRate,
        avgExecutionTimeMs: existing.avgExecutionTimeMs,
      });
      return false;
    }

    // Register new tool
    this.discoveredTools.set(key, tool);
    this.logger.debug(
      `Registered tool: ${tool.name} from ${tool.serverId}`,
      'ToolDiscovery',
      { capabilities: tool.capabilities }
    );
    return true;
  }

  /**
   * Get discovered tool by server and name
   *
   * @param serverId - Server ID
   * @param toolName - Tool name
   * @returns Discovered tool or undefined
   */
  getTool(serverId: string, toolName: string): DiscoveredTool | undefined {
    return this.discoveredTools.get(`${serverId}:${toolName}`);
  }

  /**
   * Get all discovered tools
   *
   * @param filter - Optional filter options
   * @returns Array of discovered tools
   */
  getAllTools(filter?: {
    serverId?: string;
    capability?: string;
    minSuccessRate?: number;
  }): DiscoveredTool[] {
    let tools = Array.from(this.discoveredTools.values());

    if (filter) {
      if (filter.serverId) {
        tools = tools.filter((t) => t.serverId === filter.serverId);
      }
      if (filter.capability) {
        tools = tools.filter((t) =>
          t.capabilities.includes(filter.capability!)
        );
      }
      if (filter.minSuccessRate !== undefined) {
        tools = tools.filter(
          (t) => (t.successRate ?? 1.0) >= filter.minSuccessRate!
        );
      }
    }

    return tools;
  }

  /**
   * Get tools by capability
   *
   * @param capability - Capability to filter by
   * @returns Array of tools with the capability
   */
  getToolsByCapability(capability: string): DiscoveredTool[] {
    return this.getAllTools({ capability });
  }

  /**
   * Update tool usage statistics
   *
   * @param serverId - Server ID
   * @param toolName - Tool name
   * @param success - Whether execution was successful
   * @param executionTimeMs - Execution time in milliseconds
   */
  updateToolUsage(
    serverId: string,
    toolName: string,
    success: boolean,
    executionTimeMs: number
  ): void {
    const key = `${serverId}:${toolName}`;
    const tool = this.discoveredTools.get(key);

    if (!tool) {
      return;
    }

    const currentSuccessRate = tool.successRate ?? 1.0;
    const currentAvgTime = tool.avgExecutionTimeMs ?? executionTimeMs;

    // Exponential moving average for success rate
    const newSuccessRate = currentSuccessRate * 0.9 + (success ? 1.0 : 0.0) * 0.1;

    // Exponential moving average for execution time
    const newAvgTime = currentAvgTime * 0.9 + executionTimeMs * 0.1;

    this.discoveredTools.set(key, {
      ...tool,
      lastUsedAt: new Date(),
      successRate: newSuccessRate,
      avgExecutionTimeMs: newAvgTime,
    });
  }

  /**
   * Remove tools with low success rate
   *
   * @returns Number of tools removed
   */
  pruneLowSuccessTools(): number {
    let removed = 0;

    for (const [key, tool] of this.discoveredTools.entries()) {
      if (tool.successRate !== undefined && tool.successRate < this.config.minSuccessRate) {
        this.discoveredTools.delete(key);
        removed++;
        this.logger.debug(
          `Pruned low success tool: ${tool.name}`,
          'ToolDiscovery',
          { successRate: tool.successRate }
        );
      }
    }

    return removed;
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
   * Schedule periodic refresh
   */
  private scheduleRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    this.refreshTimer = setInterval(() => {
      this.discover().catch((error) => {
        this.logger.error(
          'Scheduled tool discovery failed',
          'ToolDiscovery',
          { error: (error as Error).message }
        );
      });
    }, this.config.refreshIntervalMs);
  }

  /**
   * Clear discovered tools
   */
  clear(): void {
    this.discoveredTools.clear();
    this.logger.debug('Discovered tools cleared', 'ToolDiscovery');
  }

  /**
   * Disconnect all MCP clients
   */
  async disconnect(): Promise<void> {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }

    const disconnectPromises = Array.from(this.clients.values()).map((client) =>
      client.disconnect()
    );

    await Promise.all(disconnectPromises);
    this.clients.clear();
  }

  /**
   * Get discovery statistics
   *
   * @returns Statistics about discovered tools
   */
  getStatistics(): {
    totalTools: number;
    totalServers: number;
    toolsByServer: Record<string, number>;
    capabilitiesDistribution: Record<string, number>;
    avgSuccessRate: number;
  } {
    const tools = Array.from(this.discoveredTools.values());
    const toolsByServer: Record<string, number> = {};
    const capabilitiesDistribution: Record<string, number> = {};

    for (const tool of tools) {
      toolsByServer[tool.serverId] = (toolsByServer[tool.serverId] || 0) + 1;

      for (const capability of tool.capabilities) {
        capabilitiesDistribution[capability] =
          (capabilitiesDistribution[capability] || 0) + 1;
      }
    }

    const successRates = tools
      .map((t) => t.successRate)
      .filter((r): r is number => r !== undefined);
    const avgSuccessRate =
      successRates.length > 0
        ? successRates.reduce((a, b) => a + b, 0) / successRates.length
        : 1.0;

    return {
      totalTools: tools.length,
      totalServers: Object.keys(toolsByServer).length,
      toolsByServer,
      capabilitiesDistribution,
      avgSuccessRate,
    };
  }
}

/**
 * Schema for tool discovery configuration
 */
export const ToolDiscoveryConfigSchema = z.object({
  autoDiscover: z.boolean().optional(),
  refreshIntervalMs: z.number().min(1000).optional(),
  extractCapabilities: z.boolean().optional(),
  minSuccessRate: z.number().min(0).max(1).optional(),
});

/**
 * Global tool discovery instance
 */
let globalToolDiscovery: ToolDiscovery | null = null;

/**
 * Initialize global tool discovery
 *
 * @param config - Discovery configuration
 * @param logger - Optional logger instance
 * @returns The global tool discovery
 */
export function initToolDiscovery(
  config?: ToolDiscoveryConfig,
  logger?: Logger
): ToolDiscovery {
  globalToolDiscovery = new ToolDiscovery(config, logger);
  return globalToolDiscovery;
}

/**
 * Get global tool discovery
 *
 * @returns The global tool discovery
 */
export function getToolDiscovery(): ToolDiscovery {
  if (!globalToolDiscovery) {
    globalToolDiscovery = new ToolDiscovery();
  }
  return globalToolDiscovery;
}
