/**
 * MCP Client
 *
 * Provides high-level client interface for interacting with MCP servers.
 * Manages connections, tool discovery, and tool execution.
 */

import { Logger } from '../utils/logger';
import { getMCPRegistry } from './registry';
import {
  StdioBridge,
  createStdioBridge,
  type StdioBridgeConfig,
} from './stdio-bridge';
import {
  MCPServerConfig,
  MCPClientConfig,
  MCPTool,
  MCPToolResult,
  MCPClientError,
  MCPConnectionState,
} from './types';

/**
 * MCP Client class
 */
export class MCPClient {
  private config: MCPClientConfig;
  private logger: Logger;
  private bridge: StdioBridge | null = null;
  private tools: MCPTool[] = [];
  private connected: boolean = false;

  constructor(config: MCPClientConfig, logger?: Logger) {
    this.config = config;
    this.logger = logger || new Logger();
  }

  /**
   * Connect to MCP server
   *
   * @returns Promise that resolves when connected
   * @throws {MCPClientError} If connection fails
   */
  async connect(): Promise<void> {
    this.logger.info(
      `Connecting to MCP server: ${this.config.serverId}`,
      'MCPClient'
    );

    const registry = getMCPRegistry();
    const serverState = registry.get(this.config.serverId);

    if (!serverState) {
      throw new MCPClientError(
        `Server '${this.config.serverId}' not found in registry`,
        this.config.serverId
      );
    }

    // Update server status to starting
    registry.setStatus(this.config.serverId, 'starting');

    try {
      // Create stdio bridge
      const bridgeConfig: StdioBridgeConfig = {
        serverId: this.config.serverId,
        config: serverState.config,
        timeout: this.config.timeout,
        logger: this.logger,
      };

      this.bridge = createStdioBridge(bridgeConfig);

      // Connect to server
      await this.bridge.connect();

      // Initialize server
      await this.bridge.initialize({
        name: 'komplete-kontrol-cli',
        version: '1.0.0',
      });

      // List available tools
      const toolsResponse = await this.bridge.listTools();
      this.tools = toolsResponse.result?.tools || [];

      // Update server state with tools
      registry.updateTools(this.config.serverId, this.tools);

      // Update server status to running
      registry.updateState(this.config.serverId, {
        status: 'running',
        pid: this.bridge.getPid(),
      });

      this.connected = true;

      this.logger.info(
        `Connected to MCP server: ${this.config.serverId}`,
        'MCPClient',
        {
          tools: this.tools.length,
          serverInfo: this.bridge.getConnectionState().serverInfo,
        }
      );

    } catch (error) {
      // Update server status to error
      registry.setError(
        this.config.serverId,
        (error as Error).message
      );

      throw new MCPClientError(
        `Failed to connect to server: ${(error as Error).message}`,
        this.config.serverId,
        { error }
      );
    }
  }

  /**
   * Disconnect from MCP server
   */
  async disconnect(): Promise<void> {
    this.logger.info(
      `Disconnecting from MCP server: ${this.config.serverId}`,
      'MCPClient'
    );

    if (this.bridge) {
      await this.bridge.disconnect();
      this.bridge = null;
    }

    this.tools = [];
    this.connected = false;

    // Update server status in registry
    const registry = getMCPRegistry();
    if (registry.has(this.config.serverId)) {
      registry.setStatus(this.config.serverId, 'stopped');
    }

    this.logger.debug(
      `Disconnected from MCP server: ${this.config.serverId}`,
      'MCPClient'
    );
  }

  /**
   * List available tools
   *
   * @returns Array of available tools
   */
  listTools(): MCPTool[] {
    return [...this.tools];
  }

  /**
   * Get a tool by name
   *
   * @param toolName - Name of the tool
   * @returns Tool or undefined if not found
   */
  getTool(toolName: string): MCPTool | undefined {
    return this.tools.find((tool) => tool.name === toolName);
  }

  /**
   * Check if a tool exists
   *
   * @param toolName - Name of the tool
   * @returns True if tool exists
   */
  hasTool(toolName: string): boolean {
    return this.getTool(toolName) !== undefined;
  }

  /**
   * Call a tool
   *
   * @param toolName - Name of the tool to call
   * @param args - Arguments to pass to the tool
   * @returns Promise that resolves with tool result
   * @throws {MCPClientError} If tool call fails
   */
  async callTool(
    toolName: string,
    args?: Record<string, unknown>
  ): Promise<MCPToolResult> {
    this.logger.debug(
      `Calling tool: ${toolName}`,
      'MCPClient',
      { serverId: this.config.serverId, args }
    );

    if (!this.connected || !this.bridge) {
      throw new MCPClientError(
        'Not connected to server',
        this.config.serverId
      );
    }

    if (!this.hasTool(toolName)) {
      throw new MCPClientError(
        `Tool '${toolName}' not found`,
        this.config.serverId,
        { availableTools: this.tools.map((t) => t.name) }
      );
    }

    try {
      const response = await this.bridge.callTool(toolName, args);

      const result: MCPToolResult = {
        success: !response.result?.isError,
        content: response.result?.content
          ?.map((c) => c.text)
          .join('\n'),
        error: response.result?.isError
          ? 'Tool execution failed'
          : undefined,
        metadata: {
          toolName,
          args,
          timestamp: new Date().toISOString(),
        },
      };

      if (result.success) {
        this.logger.debug(
          `Tool call successful: ${toolName}`,
          'MCPClient',
          { result }
        );
      } else {
        this.logger.error(
          `Tool call failed: ${toolName}`,
          'MCPClient',
          { result }
        );
      }

      return result;

    } catch (error) {
      this.logger.error(
        `Tool call error: ${toolName}`,
        'MCPClient',
        { error }
      );

      return {
        success: false,
        error: (error as Error).message,
        metadata: {
          toolName,
          args,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Get connection state
   *
   * @returns Current connection state
   */
  getConnectionState(): MCPConnectionState {
    if (this.bridge) {
      return this.bridge.getConnectionState();
    }

    return {
      connected: this.connected,
      initialized: false,
    };
  }

  /**
   * Check if connected
   *
   * @returns True if connected
   */
  isConnected(): boolean {
    return this.connected && this.bridge?.isConnected() || false;
  }

  /**
   * Check if initialized
   *
   * @returns True if initialized
   */
  isInitialized(): boolean {
    return this.connected && this.bridge?.isInitialized() || false;
  }

  /**
   * Get server ID
   *
   * @returns Server ID
   */
  getServerId(): string {
    return this.config.serverId;
  }

  /**
   * Get server configuration
   *
   * @returns Server configuration or undefined
   */
  getServerConfig(): MCPServerConfig | undefined {
    const registry = getMCPRegistry();
    const serverState = registry.get(this.config.serverId);
    return serverState?.config;
  }

  /**
   * Get tool count
   *
   * @returns Number of available tools
   */
  getToolCount(): number {
    return this.tools.length;
  }
}

/**
 * Create MCP client
 *
 * @param config - Client configuration
 * @param logger - Optional logger instance
 * @returns New MCP client instance
 */
export function createMCPClient(
  config: MCPClientConfig,
  logger?: Logger
): MCPClient {
  return new MCPClient(config, logger);
}

/**
 * Connect to MCP server and return client
 *
 * @param serverId - Server ID to connect to
 * @param timeout - Optional timeout in milliseconds
 * @param logger - Optional logger instance
 * @returns Connected MCP client
 * @throws {MCPClientError} If connection fails
 */
export async function connectToMCPServer(
  serverId: string,
  timeout?: number,
  logger?: Logger
): Promise<MCPClient> {
  const client = createMCPClient({ serverId, timeout }, logger);
  await client.connect();
  return client;
}
