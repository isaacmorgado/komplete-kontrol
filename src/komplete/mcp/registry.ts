/**
 * MCP Server Registry
 *
 * Manages registration, discovery, and lifecycle of MCP servers.
 */

import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger';
import { MCPError, MCPServerConfig, MCPServerState, MCPRegistryStats } from './types';

/**
 * MCP Server Registry class
 */
export class MCPRegistry {
  private servers: Map<string, MCPServerState> = new Map();
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
  }

  /**
   * Register an MCP server
   *
   * @param config - Server configuration
   * @returns The registered server state
   * @throws {MCPError} If server with same ID already exists
   */
  register(config: MCPServerConfig): MCPServerState {
    this.logger.info(`Registering MCP server: ${config.id}`, 'MCPRegistry', { config });

    if (this.servers.has(config.id)) {
      throw new MCPError(
        `Server with ID '${config.id}' already exists`,
        -32000,
        { serverId: config.id }
      );
    }

    const state: MCPServerState = {
      id: config.id,
      config,
      status: 'stopped',
      tools: [],
    };

    this.servers.set(config.id, state);
    this.logger.debug(`Server '${config.id}' registered successfully`, 'MCPRegistry');

    return state;
  }

  /**
   * Unregister an MCP server
   *
   * @param serverId - Server ID to unregister
   * @returns True if server was unregistered, false if not found
   */
  unregister(serverId: string): boolean {
    this.logger.info(`Unregistering MCP server: ${serverId}`, 'MCPRegistry');

    const server = this.servers.get(serverId);
    if (!server) {
      this.logger.warn(`Server '${serverId}' not found`, 'MCPRegistry');
      return false;
    }

    if (server.status === 'running') {
      throw new MCPError(
        `Cannot unregister running server '${serverId}'. Stop it first.`,
        -32000,
        { serverId }
      );
    }

    this.servers.delete(serverId);
    this.logger.debug(`Server '${serverId}' unregistered successfully`, 'MCPRegistry');

    return true;
  }

  /**
   * Get a server by ID
   *
   * @param serverId - Server ID to get
   * @returns Server state or undefined if not found
   */
  get(serverId: string): MCPServerState | undefined {
    return this.servers.get(serverId);
  }

  /**
   * List all registered servers
   *
   * @returns Array of all server states
   */
  list(): MCPServerState[] {
    return Array.from(this.servers.values());
  }

  /**
   * List servers by status
   *
   * @param status - Status to filter by
   * @returns Array of server states with the specified status
   */
  listByStatus(status: MCPServerState['status']): MCPServerState[] {
    return this.list().filter((server) => server.status === status);
  }

  /**
   * Update server state
   *
   * @param serverId - Server ID to update
   * @param updates - Partial state updates
   * @returns Updated server state
   * @throws {MCPError} If server not found
   */
  updateState(serverId: string, updates: Partial<MCPServerState>): MCPServerState {
    const server = this.servers.get(serverId);

    if (!server) {
      throw new MCPError(
        `Server '${serverId}' not found`,
        -32000,
        { serverId }
      );
    }

    const updatedState = { ...server, ...updates };
    this.servers.set(serverId, updatedState);

    this.logger.debug(
      `Server '${serverId}' state updated`,
      'MCPRegistry',
      { updates }
    );

    return updatedState;
  }

  /**
   * Update server tools
   *
   * @param serverId - Server ID to update tools for
   * @param tools - Array of tools
   * @returns Updated server state
   * @throws {MCPError} If server not found
   */
  updateTools(serverId: string, tools: MCPServerState['tools']): MCPServerState {
    return this.updateState(serverId, { tools });
  }

  /**
   * Set server status
   *
   * @param serverId - Server ID to update status for
   * @param status - New status
   * @returns Updated server state
   * @throws {MCPError} If server not found
   */
  setStatus(serverId: string, status: MCPServerState['status']): MCPServerState {
    const updates: Partial<MCPServerState> = { status };

    if (status === 'running') {
      updates.startTime = new Date();
      updates.lastError = undefined;
    }

    if (status === 'error') {
      updates.startTime = undefined;
    }

    return this.updateState(serverId, updates);
  }

  /**
   * Set server error
   *
   * @param serverId - Server ID to set error for
   * @param error - Error message
   * @returns Updated server state
   * @throws {MCPError} If server not found
   */
  setError(serverId: string, error: string): MCPServerState {
    return this.updateState(serverId, {
      status: 'error',
      lastError: error,
      startTime: undefined,
    });
  }

  /**
   * Check if server exists
   *
   * @param serverId - Server ID to check
   * @returns True if server exists
   */
  has(serverId: string): boolean {
    return this.servers.has(serverId);
  }

  /**
   * Get all tools from all active servers
   *
   * @returns Map of server ID to tools
   */
  getAllTools(): Map<string, MCPServerState['tools']> {
    const toolsMap = new Map<string, MCPServerState['tools']>();

    for (const [serverId, state] of this.servers.entries()) {
      if (state.status === 'running') {
        toolsMap.set(serverId, state.tools);
      }
    }

    return toolsMap;
  }

  /**
   * Get registry statistics
   *
   * @returns Registry statistics
   */
  getStatistics(): MCPRegistryStats {
    const servers = this.list();
    const serversByStatus: Record<string, number> = {};

    for (const server of servers) {
      serversByStatus[server.status] = (serversByStatus[server.status] || 0) + 1;
    }

    const activeServers = servers.filter((s) => s.status === 'running').length;
    const totalTools = servers.reduce((sum, s) => sum + s.tools.length, 0);

    return {
      totalServers: servers.length,
      activeServers,
      totalTools,
      serversByStatus,
    };
  }

  /**
   * Clear all servers
   *
   * @throws {MCPError} If any server is running
   */
  clear(): void {
    const runningServers = this.listByStatus('running');

    if (runningServers.length > 0) {
      throw new MCPError(
        `Cannot clear registry while servers are running. Stop ${runningServers.length} server(s) first.`,
        -32000,
        { runningServers: runningServers.map((s) => s.id) }
      );
    }

    this.servers.clear();
    this.logger.info('Registry cleared', 'MCPRegistry');
  }

  /**
   * Load servers from configuration
   *
   * @param configs - Array of server configurations
   */
  loadFromConfig(configs: MCPServerConfig[]): void {
    this.logger.info(
      `Loading ${configs.length} servers from configuration`,
      'MCPRegistry'
    );

    for (const config of configs) {
      if (!config.disabled) {
        try {
          this.register(config);
        } catch (error) {
          this.logger.error(
            `Failed to register server '${config.id}'`,
            'MCPRegistry',
            { error }
          );
        }
      }
    }
  }

  /**
   * Export server configurations
   *
   * @returns Array of server configurations
   */
  exportConfigs(): MCPServerConfig[] {
    return this.list().map((state) => state.config);
  }
}

/**
 * Global registry instance
 */
let globalRegistry: MCPRegistry | null = null;

/**
 * Get global MCP registry
 *
 * @returns Global registry instance
 */
export function getMCPRegistry(): MCPRegistry {
  if (!globalRegistry) {
    globalRegistry = new MCPRegistry();
  }
  return globalRegistry;
}

/**
 * Set global MCP registry
 *
 * @param registry - Registry instance to set as global
 */
export function setMCPRegistry(registry: MCPRegistry): void {
  globalRegistry = registry;
}

/**
 * Create MCP registry
 *
 * @param logger - Optional logger instance
 * @returns New registry instance
 */
export function createMCPRegistry(logger?: Logger): MCPRegistry {
  return new MCPRegistry(logger);
}
