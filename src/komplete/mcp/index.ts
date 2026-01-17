/**
 * MCP (Model Context Protocol) Integration
 *
 * Exports all MCP components including types, registry, client,
 * stdio bridge, and servers.
 */

// Types
export * from './types';

// Registry
export {
  MCPRegistry,
  getMCPRegistry,
  setMCPRegistry,
  createMCPRegistry,
} from './registry';

// Client
export {
  MCPClient,
  createMCPClient,
  connectToMCPServer,
} from './client';

// Stdio Bridge
export {
  StdioBridge,
  createStdioBridge,
} from './stdio-bridge';

// Servers
export {
  EchoMCPServer,
  startEchoServer,
} from './servers/echo-server';

// Tool Discovery
export {
  ToolDiscovery,
  initToolDiscovery,
  getToolDiscovery,
  type DiscoveredTool,
  type ToolDiscoveryConfig,
  type ToolDiscoveryResult,
} from './discovery';

// Agent Executor
export {
  AgentExecutor,
  initAgentExecutor,
  getAgentExecutor,
  type ToolExecutionOptions,
  type ToolExecutionContext,
  type ToolExecutionResult,
  type ParameterTransformResult,
} from './agent-executor';

// Result Handler
export {
  ResultHandler,
  initResultHandler,
  getResultHandler,
  type ResultTransformationOptions,
  type TransformedResult,
  type ErrorHandlingOptions,
  type ErrorHandlingResult,
  type ErrorPattern,
} from './result-handler';
