/**
 * Core type definitions for KOMPLETE-KONTROL CLI
 *
 * This file contains all shared type definitions used across the application.
 */

/**
 * Task complexity levels
 */
export type TaskComplexity = 'simple' | 'medium' | 'complex' | 'critical';

/**
 * Task priority levels
 */
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * Task status
 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

/**
 * Task definition
 */
export interface Task {
  /**
   * Task ID
   */
  id: string;
  /**
   * Task description
   */
  description: string;
  /**
   * Task complexity
   */
  complexity: TaskComplexity;
  /**
   * Task priority
   */
  priority: TaskPriority;
  /**
   * Task status
   */
  status: TaskStatus;
  /**
   * Estimated duration in milliseconds
   */
  estimatedDuration?: number;
}

/**
 * Message role types for AI interactions
 */
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

/**
 * Content types for messages
 */
export type ContentType = 'text' | 'image' | 'tool_use' | 'tool_result';

/**
 * Base message content interface
 * This is a discriminated union type for proper narrowing in TypeScript
 */
export type MessageContent = TextContent | ImageContent | ToolUseContent | ToolResultContent;

/**
 * Text content
 */
export interface TextContent {
  type: 'text';
  text: string;
}

/**
 * Image content
 */
export interface ImageContent {
  type: 'image';
  source: {
    type: 'url' | 'base64';
    data: string;
    media_type?: string;
  };
}

/**
 * Tool use content
 */
export interface ToolUseContent {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Tool result content
 */
export interface ToolResultContent {
  type: 'tool_result';
  tool_use_id: string;
  content?: string | Array<TextContent | ImageContent | ToolUseContent>;
  is_error?: boolean;
}

/**
 * Complete message structure
 */
export interface Message {
  role: MessageRole;
  content: MessageContent | Array<MessageContent>;
}

/**
 * Tool definition
 */
export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /**
   * Optional execute function for tool implementation
   * When provided, allows the tool to be executed directly
   */
  execute?: (args: Record<string, unknown>) => Promise<ToolResult>;
}

// ============================================================================
// Section 2.1: Base Types (Tool Calling)
// ============================================================================

/**
 * Tool call interface for AI-initiated tool invocations
 * Used when an AI model requests to execute a tool
 */
export interface ToolCall {
  /**
   * Unique identifier for this tool call
   */
  id: string;
  /**
   * Name of the tool being called
   */
  name: string;
  /**
   * Arguments to pass to the tool (JSON-serializable)
   */
  arguments: Record<string, unknown>;
}

/**
 * Result of a tool execution
 */
export interface ToolResult {
  /**
   * ID of the tool call this result corresponds to
   */
  toolCallId: string;
  /**
   * Whether the tool execution succeeded
   */
  success: boolean;
  /**
   * Result content (string or structured data)
   */
  content: string | Record<string, unknown>;
  /**
   * Error message if the tool execution failed
   */
  error?: string;
}

/**
 * Enhanced Message interface with tool_calls support
 * Extends the base Message for AI tool calling workflows
 */
export interface MessageWithToolCalls extends Message {
  /**
   * Tool calls requested by the assistant
   * Present when role is 'assistant' and AI wants to invoke tools
   */
  tool_calls?: ToolCall[];
}

/**
 * Completion response interface (alias for CompletionResult)
 * Provides a cleaner name matching the spec
 */
export type CompletionResponse = CompletionResult;

/**
 * Provider prefix types
 */
export type ProviderPrefix =
  | 'or'   // OpenRouter
  | 'g'    // Groq
  | 'oai'  // OpenAI
  | 'anthropic'  // Anthropic
  | 'ollama'  // Ollama
  | 'fl';  // Featherless

/**
 * Model configuration
 */
export interface ModelConfig {
  name: string;
  prefix: ProviderPrefix;
  maxTokens: number;
  supportsVision: boolean;
  supportsTools: boolean;
  costPer1kTokens: number;
}

/**
 * Provider capabilities
 */
export interface ProviderCapabilities {
  streaming: boolean;
  tools: boolean;
  vision: boolean;
  maxTokens: number;
}

/**
 * AI Provider interface
 */
export interface AIProvider {
  /** Unique provider identifier */
  id?: string;
  name: string;
  prefix: ProviderPrefix;
  /** Provider capabilities - can be accessed via getter */
  capabilities: ProviderCapabilities;
  /** Get provider capabilities (alternative to direct property access) */
  getCapabilities?(): ProviderCapabilities;
  complete(model: string, messages: Message[], options?: CompletionOptions): Promise<CompletionResult>;
  stream(model: string, messages: Message[], options?: CompletionOptions): AsyncGenerator<StreamChunk>;
  countTokens(messages: Message[]): Promise<number>;
}

// ============================================================================
// Section 2.4: Provider Types
// ============================================================================

/**
 * Provider configuration for initializing AI providers
 */
export interface ProviderConfig {
  /** API key for authentication */
  apiKey?: string;
  /** Base URL for the API (for self-hosted or proxied endpoints) */
  baseUrl?: string;
  /** Model identifier to use */
  modelId?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Custom headers to include in requests */
  headers?: Record<string, string>;
  /** Organization ID (for providers that support it) */
  organization?: string;
}

/**
 * Model capabilities interface
 * Detailed capability information for a specific model
 */
export interface ModelCapabilities {
  /** Whether the model supports native tool/function calling */
  nativeToolCalling: boolean;
  /** Maximum input tokens supported */
  maxInputTokens: number;
  /** Maximum output tokens supported */
  maxOutputTokens: number;
  /** Maximum total context window */
  maxContextWindow: number;
  /** Whether the model supports vision/image input */
  supportsVision: boolean;
  /** Whether the model supports streaming responses */
  supportsStreaming: boolean;
  /** Whether the model supports JSON mode */
  supportsJsonMode: boolean;
  /** Whether the model supports system messages */
  supportsSystemMessage: boolean;
  /** Cost per 1K input tokens (USD) */
  inputCostPer1k?: number;
  /** Cost per 1K output tokens (USD) */
  outputCostPer1k?: number;
}

/**
 * Extended token usage tracking
 * More detailed than the basic TokenUsage interface
 */
export interface DetailedTokenUsage {
  /** Number of tokens in the prompt/input */
  promptTokens: number;
  /** Number of tokens in the completion/output */
  completionTokens: number;
  /** Total tokens used (prompt + completion) */
  totalTokens: number;
  /** Cached tokens (if using prompt caching) */
  cachedTokens?: number;
  /** Cost breakdown */
  cost?: {
    inputCost: number;
    outputCost: number;
    totalCost: number;
    currency: string;
  };
}

/**
 * Completion options
 */
export interface CompletionOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  tools?: Tool[];
  stream?: boolean;
}

/**
 * Completion result
 */
export interface CompletionResult {
  content: MessageContent | Array<MessageContent>;
  model: string;
  stopReason?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

/**
 * Stream chunk
 */
export interface StreamChunk {
  content?: MessageContent;
  delta?: string;
  done?: boolean;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  /** Stream metadata */
  metadata?: Record<string, unknown>;
  /** Tokens streamed so far */
  tokens?: number;
}

/**
 * Agent definition
 */
export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  systemPrompt: string;
  dependencies?: string[];
  tags?: string[];
}

// ============================================================================
// Section 2.2: Agent Types
// ============================================================================

/**
 * Agent state enumeration
 * Represents the current execution state of an agent
 */
export enum AgentState {
  /** Agent is ready and waiting for input */
  Idle = 'idle',
  /** Agent is processing/reasoning about the task */
  Thinking = 'thinking',
  /** Agent is executing a tool or action */
  Executing = 'executing',
  /** Agent encountered an error */
  Error = 'error',
  /** Agent has completed its task */
  Complete = 'complete',
}

/**
 * Agent configuration extending Maestro's base with mode support
 */
export interface AgentConfig extends AgentDefinition {
  /**
   * Operational mode this agent operates in
   */
  mode?: OperationalMode;
  /**
   * Preferred model for this agent
   */
  preferredModel?: string;
  /**
   * Provider to use (if not using default)
   */
  provider?: ProviderPrefix;
  /**
   * Maximum iterations in agentic loop
   */
  maxIterations?: number;
  /**
   * Execution timeout in milliseconds
   */
  timeoutMs?: number;
  /**
   * Whether streaming is enabled
   */
  enableStreaming?: boolean;
  /**
   * Tool groups this agent can access
   */
  toolGroups?: ToolGroup[];
}

/**
 * Agent capabilities interface with feature flags
 */
export interface AgentCapabilities {
  /** Can read files from filesystem */
  fileRead: boolean;
  /** Can write/edit files */
  fileWrite: boolean;
  /** Can execute shell commands */
  shellExec: boolean;
  /** Can browse the web */
  webBrowse: boolean;
  /** Can use MCP tools */
  mcpTools: boolean;
  /** Can spawn sub-agents */
  subAgents: boolean;
  /** Supports vision/image input */
  vision: boolean;
  /** Supports streaming responses */
  streaming: boolean;
  /** Maximum context window size */
  maxContextTokens: number;
  /** Custom capabilities (extensible) */
  custom?: Record<string, boolean>;
}

/**
 * Agent runtime context
 * Contains all runtime state for an executing agent
 */
export interface AgentContext {
  /** Unique session identifier */
  sessionId: string;
  /** Agent identifier */
  agentId: string;
  /** Current operational mode */
  mode: OperationalMode;
  /** Current working directory */
  workingDirectory: string;
  /** Environment variables available to the agent */
  env: Record<string, string>;
  /** Message history for this context */
  messages: Message[];
  /** Available tools for this context */
  tools: Tool[];
  /** Current agent state */
  state: AgentState;
  /** Metadata for tracking/debugging */
  metadata: {
    startedAt: Date;
    lastActivityAt: Date;
    iterationCount: number;
    tokenUsage: {
      input: number;
      output: number;
      total: number;
    };
  };
}

/**
 * Agent task
 */
export interface AgentTask {
  id: string;
  agentId: string;
  description: string;
  type: 'cpu-bound' | 'io-bound' | 'isolated';
  priority: number;
  requiredCapability?: string;
  input: Record<string, unknown>;
}

/**
 * Agent task result
 */
export interface AgentTaskResult {
  taskId: string;
  success: boolean;
  output?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Context message with metadata
 */
export interface ContextMessage {
  id: string;
  role: MessageRole;
  content: MessageContent | Array<MessageContent>;
  timestamp?: Date;
  tokens?: number;
  priority?: number;
  message?: string;
}

/**
 * Context window configuration
 */
export interface ContextWindowConfig {
  maxTokens: number;
  maxMessages: number;
  preserveToolUse: boolean;
}

/**
 * Token counting method
 */
export type TokenCountMethod = 'char' | 'word' | 'model';

/**
 * Token pricing
 */
export interface TokenPricing {
  inputPrice: number;
  outputPrice: number;
  currency?: string;
}

/**
 * Token usage
 */
export interface TokenUsage {
  totalTokens: number;
  totalCost: number;
  sessions: number;
}

/**
 * Token budget configuration
 */
export interface TokenBudgetConfig {
  limit: number;
  alertThreshold?: number;
}

/**
 * Condensation result with metrics
 */
export interface CondensationResult {
  messages: ContextMessage[];
  originalCount: number;
  newCount: number;
  originalSize: number;
  newSize: number;
  tokensRemoved: number;
  clusters?: ContextMessage[][];
}

/**
 * Abstract condenser interface
 */
export interface ICondenser {
  condense(messages: ContextMessage[], targetSize: number): CondensationResult;
  shouldPreserve(message: ContextMessage): boolean;
  updateConfig(config: Partial<CondensationConfig>): void;
  getConfig(): CondensationConfig;
}

/**
 * Token-based condenser configuration
 */
export interface TokenBasedConfig extends CondensationConfig {
  strategy: 'token-based';
  minTokensPerMessage?: number;
  maxTokensPerMessage?: number;
  preferRecent?: boolean;
  recentWindowMs?: number;
}

/**
 * Semantic condenser configuration
 */
export interface SemanticConfig extends CondensationConfig {
  strategy: 'semantic';
  embeddingModel: string;
  similarityThreshold: number;
  clusterSize: number;
  preserveKeyMessages?: boolean;
  keyMessageKeywords?: string[];
}

/**
 * Context sharing configuration
 */
export interface ContextSharingConfig {
  enabled: boolean;
  shareAcrossSessions: boolean;
  shareKeywords: string[];
  maxSharedMessages: number;
  sharedMessageTtl: number;
}

/**
 * Shared context entry
 */
export interface SharedContextEntry {
  id: string;
  sourceSessionId: string;
  message: ContextMessage;
  relevanceScore: number;
  createdAt: Date;
  expiresAt: Date;
  keywords: string[];
}

/**
 * Tool selection criteria
 */
export interface ToolSelectionCriteria {
  contextKeywords: string[];
  recentToolUsage: Map<string, number>;
  toolSuccessRate: Map<string, number>;
  contextComplexity: 'simple' | 'medium' | 'complex';
  taskType?: string;
}

/**
 * Tool recommendation
 */
export interface ToolRecommendation {
  tool: string;
  confidence: number;
  reason: string;
  estimatedTokens: number;
}

/**
 * Context optimization result
 */
export interface ContextOptimizationResult {
  optimizedMessages: ContextMessage[];
  removedCount: number;
  preservedCount?: number;
  summaryCount?: number;
  tokenSavings?: number;
  compressionRatio?: number;
  /** Original messages before optimization */
  originalMessages?: ContextMessage[];
  /** Reduction percentage (0-100) */
  reductionPercentage?: number;
  /** Original token count */
  originalTokenCount?: number;
  /** Optimized token count */
  optimizedTokenCount?: number;
  /** Token reduction amount */
  tokenReduction?: number;
  /** Processing time in ms */
  processingTime?: number;
}

/**
 * Context optimization configuration
 */
export interface ContextOptimizationConfig {
  /** Aggressive optimization mode */
  aggressiveMode?: boolean;
  /** Preserve system messages */
  preserveSystemMessages?: boolean;
  /** Preserve tool results */
  preserveToolResults?: boolean;
  /** Minimum message age before optimization */
  minMessageAge?: number;
  /** Maximum summary length */
  maxSummaryLength?: number;
  /** Deduplicate identical content */
  deduplicateContent?: boolean;
  /** Enable deduplication optimization */
  enableDeduplication?: boolean;
  /** Enable relevance scoring */
  enableRelevanceScoring?: boolean;
  /** Maximum tokens to allow */
  maxTokens?: number;
  /** Target tokens after optimization */
  targetTokens?: number;
  /** Minimum relevance score threshold */
  minRelevanceScore?: number;
  /** Preserve this many recent messages */
  preserveRecentMessages?: number;
}

/**
 * Condensation strategy
 */
export type CondensationStrategy = 'fifo' | 'priority' | 'summarize' | 'hybrid' | 'token-based' | 'semantic';

/**
 * Condensation configuration
 */
export interface CondensationConfig {
  strategy: CondensationStrategy;
  targetSize: number;
  preserveToolUse: boolean;
  priorityKeywords: string[];
  summaryPriority?: number;
  minPriority?: number;
  summaryMaxLength?: number;
  preservePriority?: number;
  preserveRecentMs?: number;
  targetCompressionRatio?: number;
  semanticThreshold?: number;
  embeddingModel?: string;
}

/**
 * Context options
 */
export interface ContextOptions {
  maxTokens: number;
  modelContextLimit: number;
  condensationThreshold: number;
  preserveToolUse: boolean;
  ignorePatterns: string[];
}

/**
 * Context state
 */
export interface ContextState {
  messages: Message[];
  tokensUsed: number;
  tokensRemaining: number;
  lastCondensedAt?: Date;
}

/**
 * Session
 */
export interface Session {
  id: string;
  created: string;
  updated: string;
  agent: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  totalTokens?: number;
}

/**
 * Session configuration
 */
export interface SessionConfig {
  id: string;
  userId: string;
  createdAt: Date;
  messages: Message[];
  state: Record<string, unknown>;
  mode?: AgentMode;
}

/**
 * Agent modes (legacy - retained for backward compatibility)
 */
export type AgentMode =
  | 'general'
  | 'coder'
  | 'intense-research'
  | 'reverse-engineer'
  | 'spark';

/**
 * Mode configuration (legacy)
 */
export interface ModeConfig {
  mode: AgentMode;
  systemPrompt: string;
  capabilities: string[];
  resourceLimits: ResourceLimits;
}

/**
 * Resource limits
 */
export interface ResourceLimits {
  maxAgents: number;
  maxTokensPerRequest: number;
  maxCostPerCommand: number;
  timeoutMs: number;
}

// ============================================================================
// Section 2.3: Mode Types (Komplete-Kontrol Operational Modes)
// ============================================================================

/**
 * Operational mode for Komplete-Kontrol
 * Defines the behavioral mode of the AI agent
 */
export type OperationalMode =
  | 'architect'         // High-level design and planning
  | 'code'              // Code generation and modification
  | 'debug'             // Debugging and troubleshooting
  | 'test'              // Test generation and execution
  | 'reverse-engineer'  // Reverse engineering and analysis
  | 'ask';              // Q&A and information retrieval

/**
 * Tool group categories
 * Groups of tools that can be enabled/disabled together
 */
export type ToolGroup =
  | 'read'      // File reading, search, exploration
  | 'edit'      // File editing, creation, deletion
  | 'browser'   // Web browsing and HTTP requests
  | 'command'   // Shell command execution
  | 'mcp'       // MCP server tools
  | 'modes';    // Mode switching capabilities

/**
 * Tool group configuration
 * Defines which tools are available within a tool group
 */
export interface ToolGroupConfig {
  /** The tool group this config applies to */
  group: ToolGroup;
  /** List of enabled tool names in this group */
  tools: string[];
  /** Custom tools added to this group */
  customTools?: Tool[];
  /** Whether this group is enabled */
  enabled: boolean;
}

/**
 * Operational mode configuration (Komplete-Kontrol specific)
 * Defines behavior and capabilities for each operational mode
 */
export interface OperationalModeConfig {
  /** Mode identifier slug */
  slug: OperationalMode;
  /** Display name */
  displayName: string;
  /** Role definition / system prompt for this mode */
  roleDefinition: string;
  /** Tool groups available in this mode */
  toolGroups: ToolGroup[];
  /** Preferred model for this mode (optional) */
  preferredModel?: string;
  /** Temperature setting for this mode */
  temperature?: number;
  /** Maximum tokens per request */
  maxTokens?: number;
  /** Custom tool configurations */
  toolConfigs?: ToolGroupConfig[];
}

/**
 * Mode-specific configuration
 */
export interface ModeSpecificConfig {
  /** Temperature for this mode (0-2) */
  temperature?: number;
  /** Max tokens for responses in this mode */
  maxTokens?: number;
  /** Preferred model for this mode */
  preferredModel?: string;
  /** Tool groups available in this mode */
  toolGroups?: ToolGroup[];
}

/**
 * Provider-specific configuration
 */
export interface ProviderSpecificConfig {
  /** API key for authentication */
  apiKey?: string;
  /** Base URL for the API endpoint */
  baseUrl?: string;
  /** Organization ID (for providers that support it) */
  organization?: string;
  /** Default model for this provider */
  defaultModel?: string;
}

/**
 * Configuration file structure
 */
export interface Config {
  // Provider settings (Section 3.3)
  providers?: {
    openRouter?: ProviderSpecificConfig;
    groq?: ProviderSpecificConfig;
    openai?: ProviderSpecificConfig;
    anthropic?: ProviderSpecificConfig;
    ollama?: ProviderSpecificConfig;
    featherless?: ProviderSpecificConfig;
  };

  // Default mode (Section 3.2)
  defaultMode: OperationalMode;

  // Model routing (Section 3.2)
  defaultModel: string;
  fallbackModels: string[];

  // Tool calling method (Section 3.2)
  toolCallingMethod: 'native' | 'xml' | 'json';

  // Mode-specific settings (Section 3.2)
  modes?: {
    architect?: ModeSpecificConfig;
    code?: ModeSpecificConfig;
    debug?: ModeSpecificConfig;
    test?: ModeSpecificConfig;
    'reverse-engineer'?: ModeSpecificConfig;
    ask?: ModeSpecificConfig;
  };

  // Context management
  context: {
    maxTokens: number;
    condensationThreshold: number;
    preserveToolUse: boolean;
  };

  // Agent settings
  agents: {
    maxParallel: number;
    timeoutMs: number;
  };

  // Cost budgeting
  budget: {
    maxCostPerCommand: number;
    maxDailyCost: number;
    alertThreshold: number;
  };

  // MCP settings
  mcp: {
    servers: MCPServerConfig[];
    enabled: boolean;
  };

  // Logging
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    file?: string;
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
  disabled?: boolean;
}

/**
 * MCP tool definition
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/**
 * Error types
 */
export class KompleteError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'KompleteError';
  }
}

/**
 * Provider error
 */
export class ProviderError extends KompleteError {
  constructor(
    message: string,
    public provider: string,
    public code: string = 'PROVIDER_ERROR',
    details?: Record<string, unknown>
  ) {
    super(message, code, details);
    this.name = 'ProviderError';
  }
}

/**
 * Agent error
 */
export class AgentError extends KompleteError {
  constructor(
    message: string,
    public agentId: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'AGENT_ERROR', details);
    this.name = 'AgentError';
  }
}

/**
 * Context error
 */
export class ContextError extends KompleteError {
  constructor(
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'CONTEXT_ERROR', details);
    this.name = 'ContextError';
  }
}

/**
 * Configuration error
 */
export class ConfigError extends KompleteError {
  constructor(
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'CONFIG_ERROR', details);
    this.name = 'ConfigError';
  }
}

/**
 * Tool execution error
 * Thrown when a tool fails to execute properly
 */
export class ToolError extends KompleteError {
  constructor(
    message: string,
    public toolName: string,
    public code: string = 'TOOL_ERROR',
    details?: Record<string, unknown>
  ) {
    super(message, code, { ...details, toolName });
    this.name = 'ToolError';
  }
}

/**
 * Mode switching error
 * Thrown when mode switching fails
 */
export class ModeError extends KompleteError {
  constructor(
    message: string,
    public fromMode: OperationalMode | undefined,
    public toMode: OperationalMode,
    public code: string = 'MODE_ERROR',
    details?: Record<string, unknown>
  ) {
    super(message, code, { ...details, fromMode, toMode });
    this.name = 'ModeError';
  }
}

/**
 * Task execution result
 */
export interface TaskResult<T = unknown> {
  /** Whether the task completed successfully */
  success: boolean;
  /** Result data if successful */
  data?: T;
  /** Error if failed */
  error?: Error;
  /** Task ID */
  taskId?: string;
  /** Duration in milliseconds */
  durationMs?: number;
  /** Metadata from execution */
  metadata?: Record<string, unknown>;
}

/**
 * Task execution error
 */
export class TaskError extends KompleteError {
  constructor(
    message: string,
    public taskId: string,
    public code: string = 'TASK_ERROR',
    details?: Record<string, unknown>
  ) {
    super(message, code, { ...details, taskId });
    this.name = 'TaskError';
  }
}

/**
 * Record of a tool call during agent execution
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
 * Agent executor configuration
 */
export interface AgentExecutorConfig {
  /**
   * Default provider prefix
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

// Re-export Timer type from bun-shim for compatibility
export type { Timer } from './bun-shim';
