/**
 * MCP Stdio Bridge
 *
 * Manages communication with MCP servers via stdio (stdin/stdout).
 * Handles spawning processes, sending JSON-RPC messages, and receiving responses.
 */

import { spawn, type ChildProcess } from 'child_process';
import { Logger, LoggerLike } from '../utils/logger';
import {
  MCPJSONRPCMessage,
  MCPInitializeRequest,
  MCPInitializeResponse,
  MCPToolsListRequest,
  MCPToolsListResponse,
  MCPToolCallRequest,
  MCPToolCallResponse,
  MCPServerConfig,
  MCPConnectionState,
  MCPBridgeError,
  MCPErrorCode,
} from './types';

/**
 * Stdio bridge configuration
 */
export interface StdioBridgeConfig {
  serverId: string;
  config: MCPServerConfig;
  timeout?: number;
  logger?: LoggerLike;
}

/**
 * Message handler type
 */
export type MessageHandler = (message: MCPJSONRPCMessage) => void;

/**
 * Stdio Bridge class for MCP servers
 */
export class StdioBridge {
  private config: StdioBridgeConfig;
  private logger: LoggerLike;
  private process: ChildProcess | null = null;
  private messageId: number = 0;
  private pendingRequests: Map<string | number, {
    resolve: (value: MCPJSONRPCMessage) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  private messageHandlers: Set<MessageHandler> = new Set();
  private connectionState: MCPConnectionState = {
    connected: false,
    initialized: false,
  };
  private stdoutBuffer: string = '';

  constructor(config: StdioBridgeConfig) {
    this.config = config;
    this.logger = config.logger || new Logger();
  }

  /**
   * Connect to the MCP server by spawning the process
   *
   * @returns Promise that resolves when connection is established
   * @throws {MCPBridgeError} If connection fails
   */
  async connect(): Promise<void> {
    this.logger.info(
      `Connecting to MCP server: ${this.config.serverId}`,
      'StdioBridge',
      { command: this.config.config.command, args: this.config.config.args }
    );

    if (this.process) {
      throw new MCPBridgeError(
        'Already connected to server',
        this.config.serverId
      );
    }

    try {
      // Spawn the MCP server process
      this.process = spawn(this.config.config.command, this.config.config.args || [], {
        env: {
          ...process.env,
          ...this.config.config.env,
        },
        cwd: this.config.config.cwd || process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Set up stdout handler
      if (this.process.stdout) {
        this.process.stdout.on('data', (data: Buffer) => {
          this.handleStdoutData(data);
        });
      }

      // Set up stderr handler
      if (this.process.stderr) {
        this.process.stderr.on('data', (data: Buffer) => {
          this.handleStderrData(data);
        });
      }

      // Handle process exit
      this.process.on('exit', (code, signal) => {
        this.logger.info(
          `MCP server process exited: ${this.config.serverId}`,
          'StdioBridge',
          { code, signal }
        );
        this.connectionState.connected = false;
        this.connectionState.initialized = false;
        this.rejectAllPendingRequests(
          new Error('Server process exited')
        );
      });

      // Handle process error
      this.process.on('error', (error) => {
        this.logger.error(
          `MCP server process error: ${this.config.serverId}`,
          'StdioBridge',
          { error }
        );
        this.rejectAllPendingRequests(error);
      });

      this.connectionState.connected = true;
      this.connectionState.lastActivity = new Date();

      this.logger.debug(
        `Connected to MCP server: ${this.config.serverId}`,
        'StdioBridge',
        { pid: this.process.pid }
      );

    } catch (error) {
      throw new MCPBridgeError(
        `Failed to connect to server: ${(error as Error).message}`,
        this.config.serverId,
        { error }
      );
    }
  }

  /**
   * Initialize the MCP server
   *
   * @param clientInfo - Client information to send to server
   * @returns Promise that resolves with initialization response
   * @throws {MCPBridgeError} If initialization fails
   */
  async initialize(clientInfo: {
    name: string;
    version: string;
  }): Promise<MCPInitializeResponse> {
    this.logger.info(
      `Initializing MCP server: ${this.config.serverId}`,
      'StdioBridge',
      { clientInfo }
    );

    const request: MCPInitializeRequest = {
      jsonrpc: '2.0',
      id: this.getNextMessageId(),
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: true,
          resources: false,
          prompts: false,
        },
        clientInfo,
      },
    };

    const response = await this.sendRequest<MCPInitializeResponse>(request);

    if (response.result) {
      this.connectionState.initialized = true;
      this.connectionState.protocolVersion = response.result.protocolVersion;
      this.connectionState.serverInfo = response.result.serverInfo;

      this.logger.info(
        `MCP server initialized: ${this.config.serverId}`,
        'StdioBridge',
        {
          protocolVersion: response.result.protocolVersion,
          serverInfo: response.result.serverInfo,
        }
      );
    }

    return response;
  }

  /**
   * List available tools from the server
   *
   * @returns Promise that resolves with tools list
   * @throws {MCPBridgeError} If request fails
   */
  async listTools(): Promise<MCPToolsListResponse> {
    this.logger.debug(
      `Listing tools from MCP server: ${this.config.serverId}`,
      'StdioBridge'
    );

    const request: MCPToolsListRequest = {
      jsonrpc: '2.0',
      id: this.getNextMessageId(),
      method: 'tools/list',
    };

    return this.sendRequest<MCPToolsListResponse>(request);
  }

  /**
   * Call a tool on the server
   *
   * @param toolName - Name of the tool to call
   * @param args - Arguments to pass to the tool
   * @returns Promise that resolves with tool call result
   * @throws {MCPBridgeError} If request fails
   */
  async callTool(
    toolName: string,
    args?: Record<string, unknown>
  ): Promise<MCPToolCallResponse> {
    this.logger.debug(
      `Calling tool on MCP server: ${this.config.serverId}`,
      'StdioBridge',
      { toolName, args }
    );

    const request: MCPToolCallRequest = {
      jsonrpc: '2.0',
      id: this.getNextMessageId(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
    };

    return this.sendRequest<MCPToolCallResponse>(request);
  }

  /**
   * Send a JSON-RPC request to the server
   *
   * @param request - Request to send
   * @returns Promise that resolves with response
   * @throws {MCPBridgeError} If request fails or times out
   */
  private async sendRequest<T extends MCPJSONRPCMessage>(
    request: MCPJSONRPCMessage
  ): Promise<T> {
    if (!this.process || !this.process.stdin) {
      throw new MCPBridgeError(
        'Not connected to server',
        this.config.serverId
      );
    }

    const timeout = this.config.timeout || 30000; // 30 seconds default

    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(request.id!);
        reject(
          new MCPBridgeError(
            `Request timeout after ${timeout}ms`,
            this.config.serverId,
            { requestId: request.id }
          )
        );
      }, timeout);

      this.pendingRequests.set(request.id!, {
        resolve: resolve as (value: MCPJSONRPCMessage) => void,
        reject,
        timeout: timeoutId,
      });

      try {
        const message = JSON.stringify(request) + '\n';
        this.process.stdin.write(message);
        this.logger.debug(
          `Sent message to MCP server: ${this.config.serverId}`,
          'StdioBridge',
          { message: request.method }
        );
      } catch (error) {
        clearTimeout(timeoutId);
        this.pendingRequests.delete(request.id!);
        reject(
          new MCPBridgeError(
            `Failed to send message: ${(error as Error).message}`,
            this.config.serverId,
            { error }
          )
        );
      }
    });
  }

  /**
   * Handle stdout data from the process
   *
   * @param data - Data received from stdout
   */
  private handleStdoutData(data: Buffer): void {
    this.stdoutBuffer += data.toString();

    // Process complete lines
    const lines = this.stdoutBuffer.split('\n');
    this.stdoutBuffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line) as MCPJSONRPCMessage;
          this.handleMessage(message);
        } catch (error) {
          this.logger.error(
            `Failed to parse message from MCP server: ${this.config.serverId}`,
            'StdioBridge',
            { line, error }
          );
        }
      }
    }
  }

  /**
   * Handle stderr data from the process
   *
   * @param data - Data received from stderr
   */
  private handleStderrData(data: Buffer): void {
    const stderr = data.toString();
    this.logger.debug(
      `MCP server stderr: ${this.config.serverId}`,
      'StdioBridge',
      { stderr }
    );
  }

  /**
   * Handle incoming JSON-RPC message
   *
   * @param message - Received message
   */
  private handleMessage(message: MCPJSONRPCMessage): void {
    this.logger.debug(
      `Received message from MCP server: ${this.config.serverId}`,
      'StdioBridge',
      { message: message.method || message.id }
    );

    // Check if this is a response to a pending request
    if (message.id !== undefined && this.pendingRequests.has(message.id)) {
      const pending = this.pendingRequests.get(message.id)!;
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(message.id);

      if (message.error) {
        pending.reject(
          new MCPBridgeError(
            message.error.message,
            this.config.serverId,
            { code: message.error.code, data: message.error.data }
          )
        );
      } else {
        pending.resolve(message);
      }
    } else {
      // This is a notification or unsolicited message
      for (const handler of this.messageHandlers) {
        try {
          handler(message);
        } catch (error) {
          this.logger.error(
            `Message handler error: ${this.config.serverId}`,
            'StdioBridge',
            { error }
          );
        }
      }
    }

    this.connectionState.lastActivity = new Date();
  }

  /**
   * Reject all pending requests
   *
   * @param error - Error to reject with
   */
  private rejectAllPendingRequests(error: Error): void {
    for (const [id, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }

  /**
   * Get the next message ID
   *
   * @returns Next message ID
   */
  private getNextMessageId(): number {
    return ++this.messageId;
  }

  /**
   * Add a message handler
   *
   * @param handler - Handler function
   * @returns Unsubscribe function
   */
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  /**
   * Get connection state
   *
   * @returns Current connection state
   */
  getConnectionState(): MCPConnectionState {
    return { ...this.connectionState };
  }

  /**
   * Check if connected
   *
   * @returns True if connected
   */
  isConnected(): boolean {
    return this.connectionState.connected && this.process !== null;
  }

  /**
   * Check if initialized
   *
   * @returns True if initialized
   */
  isInitialized(): boolean {
    return this.connectionState.initialized;
  }

  /**
   * Disconnect from the server
   */
  async disconnect(): Promise<void> {
    this.logger.info(
      `Disconnecting from MCP server: ${this.config.serverId}`,
      'StdioBridge'
    );

    this.rejectAllPendingRequests(
      new Error('Connection closed')
    );

    if (this.process) {
      this.process.kill('SIGTERM');

      // Wait for process to exit
      await new Promise<void>((resolve) => {
        if (this.process) {
          this.process.once('exit', () => resolve());
          setTimeout(() => {
            // Force kill if it doesn't exit gracefully
            if (this.process) {
              this.process.kill('SIGKILL');
            }
            resolve();
          }, 5000);
        } else {
          resolve();
        }
      });

      this.process = null;
    }

    this.connectionState.connected = false;
    this.connectionState.initialized = false;
    this.stdoutBuffer = '';

    this.logger.debug(
      `Disconnected from MCP server: ${this.config.serverId}`,
      'StdioBridge'
    );
  }

  /**
   * Get process ID
   *
   * @returns Process ID or undefined if not connected
   */
  getPid(): number | undefined {
    return this.process?.pid;
  }
}

/**
 * Create stdio bridge
 *
 * @param config - Bridge configuration
 * @returns New stdio bridge instance
 */
export function createStdioBridge(config: StdioBridgeConfig): StdioBridge {
  return new StdioBridge(config);
}
