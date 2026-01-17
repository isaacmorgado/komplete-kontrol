/**
 * MCP (Model Context Protocol) Type Definitions
 *
 * This file contains all type definitions for MCP integration including
 * tools, servers, clients, and protocol messages.
 */

/**
 * MCP protocol JSON-RPC message base
 */
export interface MCPJSONRPCMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * MCP initialization request
 */
export interface MCPInitializeRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: 'initialize';
  params: {
    protocolVersion: string;
    capabilities: {
      tools: boolean;
      resources?: boolean;
      prompts?: boolean;
    };
    clientInfo: {
      name: string;
      version: string;
    };
  };
}

/**
 * MCP initialization response
 */
export interface MCPInitializeResponse {
  jsonrpc: '2.0';
  id: string | number;
  result: {
    protocolVersion: string;
    capabilities: {
      tools: boolean;
      resources?: boolean;
      prompts?: boolean;
    };
    serverInfo: {
      name: string;
      version: string;
    };
  };
}

/**
 * MCP tool definition
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
      default?: unknown;
    }>;
    required?: string[];
  };
}

/**
 * MCP tools list request
 */
export interface MCPToolsListRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: 'tools/list';
  params?: {};
}

/**
 * MCP tools list response
 */
export interface MCPToolsListResponse {
  jsonrpc: '2.0';
  id: string | number;
  result: {
    tools: MCPTool[];
  };
}

/**
 * MCP tool call request
 */
export interface MCPToolCallRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: 'tools/call';
  params: {
    name: string;
    arguments?: Record<string, unknown>;
  };
}

/**
 * MCP tool call response
 */
export interface MCPToolCallResponse {
  jsonrpc: '2.0';
  id: string | number;
  result: {
    content: Array<{
      type: 'text' | 'image' | 'resource';
      text?: string;
      data?: string;
      uri?: string;
    }>;
    isError?: boolean;
  };
}

/**
 * MCP server configuration
 */
export interface MCPServerConfig {
  id: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  disabled?: boolean;
}

/**
 * MCP server state
 */
export interface MCPServerState {
  id: string;
  config: MCPServerConfig;
  status: 'stopped' | 'starting' | 'running' | 'stopping' | 'error';
  pid?: number;
  tools: MCPTool[];
  lastError?: string;
  startTime?: Date;
}

/**
 * MCP client configuration
 */
export interface MCPClientConfig {
  serverId: string;
  timeout?: number;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

/**
 * MCP connection state
 */
export interface MCPConnectionState {
  connected: boolean;
  initialized: boolean;
  protocolVersion?: string;
  serverInfo?: {
    name: string;
    version: string;
  };
  lastActivity?: Date;
}

/**
 * MCP tool execution result
 */
export interface MCPToolResult {
  success: boolean;
  content?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * MCP registry statistics
 */
export interface MCPRegistryStats {
  totalServers: number;
  activeServers: number;
  totalTools: number;
  serversByStatus: Record<string, number>;
}

/**
 * MCP error types
 */
export enum MCPErrorCode {
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
  SERVER_ERROR = -32000,
  INITIALIZATION_FAILED = -32001,
  TIMEOUT = -32002,
}

/**
 * MCP error class
 */
export class MCPError extends Error {
  constructor(
    message: string,
    public code: MCPErrorCode,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

/**
 * MCP server error class
 */
export class MCPServerError extends MCPError {
  constructor(
    message: string,
    public serverId: string,
    details?: Record<string, unknown>
  ) {
    super(message, MCPErrorCode.SERVER_ERROR, details);
    this.name = 'MCPServerError';
  }
}

/**
 * MCP client error class
 */
export class MCPClientError extends MCPError {
  constructor(
    message: string,
    public serverId: string,
    details?: Record<string, unknown>
  ) {
    super(message, MCPErrorCode.SERVER_ERROR, details);
    this.name = 'MCPClientError';
  }
}

/**
 * MCP bridge error class
 */
export class MCPBridgeError extends MCPError {
  constructor(
    message: string,
    public serverId: string,
    details?: Record<string, unknown>
  ) {
    super(message, MCPErrorCode.INTERNAL_ERROR, details);
    this.name = 'MCPBridgeError';
  }
}
