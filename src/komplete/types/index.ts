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
 */
export interface MessageContent {
  type: ContentType;
}

/**
 * Text content
 */
export interface TextContent extends MessageContent {
  type: 'text';
  text: string;
}

/**
 * Image content
 */
export interface ImageContent extends MessageContent {
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
export interface ToolUseContent extends MessageContent {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Tool result content
 */
export interface ToolResultContent extends MessageContent {
  type: 'tool_result';
  tool_use_id: string;
  content?: string | Array<MessageContent>;
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
}

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
  name: string;
  prefix: ProviderPrefix;
  capabilities: ProviderCapabilities;
  complete(model: string, messages: Message[], options?: CompletionOptions): Promise<CompletionResult>;
  stream(model: string, messages: Message[], options?: CompletionOptions): AsyncGenerator<StreamChunk>;
  countTokens(messages: Message[]): Promise<number>;
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
 * Abstract condenser interface
 */
export interface ICondenser {
  condense(messages: ContextMessage[], targetSize: number): ContextMessage[];
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
  preservedCount: number;
  summaryCount: number;
  tokenSavings: number;
  compressionRatio: number;
}

/**
 * Context optimization configuration
 */
export interface ContextOptimizationConfig {
  aggressiveMode: boolean;
  preserveSystemMessages: boolean;
  preserveToolResults: boolean;
  minMessageAge: number;
  maxSummaryLength: number;
  deduplicateContent: boolean;
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
 * Agent modes
 */
export type AgentMode =
  | 'general'
  | 'coder'
  | 'intense-research'
  | 'reverse-engineer'
  | 'spark';

/**
 * Mode configuration
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

/**
 * Configuration file structure
 */
export interface Config {
  // Provider settings
  providers: {
    openRouter?: {
      apiKey: string;
      baseUrl?: string;
    };
    groq?: {
      apiKey: string;
    };
    openai?: {
      apiKey: string;
      baseUrl?: string;
    };
    anthropic?: {
      apiKey: string;
    };
    ollama?: {
      baseUrl: string;
    };
    featherless?: {
      apiKey: string;
    };
  };

  // Model routing
  defaultModel: string;
  fallbackModels: string[];

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
