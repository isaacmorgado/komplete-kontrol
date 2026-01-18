/**
 * Universal Tool Calling Type Definitions
 *
 * This module defines all types for the universal tool calling system that enables
 * any AI model to use tools, regardless of whether it has native tool calling support.
 * Models with native support (Claude, GPT-4, Gemini) use their built-in capabilities,
 * while models without native support use XML/JSON emulation.
 *
 * Part of Phase 03: Universal Tool Calling
 */

// ============================================================================
// Section 1.1: Base Tool Interface
// ============================================================================

/**
 * JSON Schema type for tool parameter definitions.
 * Follows JSON Schema Draft-07 specification for compatibility with all providers.
 */
export interface JsonSchemaProperty {
  /** The type of the parameter */
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'null';

  /** Human-readable description of the parameter */
  description?: string;

  /** Default value for optional parameters */
  default?: unknown;

  /** Allowed values for enum constraints */
  enum?: unknown[];

  /** For array types, schema of array items */
  items?: JsonSchemaProperty;

  /** For object types, schema of object properties */
  properties?: Record<string, JsonSchemaProperty>;

  /** For object types, list of required property names */
  required?: string[];

  /** Additional properties allowed for object types */
  additionalProperties?: boolean | JsonSchemaProperty;

  /** Minimum value for number/integer types */
  minimum?: number;

  /** Maximum value for number/integer types */
  maximum?: number;

  /** Minimum length for string/array types */
  minLength?: number;

  /** Maximum length for string/array types */
  maxLength?: number;

  /** Pattern for string validation (regex) */
  pattern?: string;

  /** Format hint for string types (e.g., 'uri', 'email', 'date-time') */
  format?: string;
}

/**
 * JSON Schema for tool parameters.
 * Defines the input schema for tool invocations.
 */
export interface ToolParameterSchema {
  /** Schema type - always 'object' for tool parameters */
  type: 'object';

  /** Parameter definitions */
  properties: Record<string, JsonSchemaProperty>;

  /** List of required parameter names */
  required?: string[];

  /** Whether additional properties are allowed */
  additionalProperties?: boolean;
}

/**
 * Tool definition interface.
 * Defines a tool that can be invoked by AI models.
 */
export interface Tool {
  /** Unique identifier for the tool (e.g., 'read_file', 'execute_command') */
  name: string;

  /** Human-readable description of what the tool does */
  description: string;

  /** JSON Schema defining the tool's parameters */
  parameters: ToolParameterSchema;

  /** Optional category for grouping tools (e.g., 'file', 'shell', 'mcp') */
  category?: string;

  /** Whether this tool requires user confirmation before execution */
  requiresConfirmation?: boolean;

  /** Whether this tool is dangerous and should be treated with extra caution */
  isDangerous?: boolean;

  /** Tool groups this tool belongs to (for mode-based restrictions) */
  groups?: string[];
}

// ============================================================================
// Section 1.1: Tool Call Interface
// ============================================================================

/**
 * Tool call interface.
 * Represents a request to invoke a tool from an AI model.
 */
export interface ToolCall {
  /** Unique identifier for this specific tool invocation */
  id: string;

  /** Name of the tool being invoked */
  name: string;

  /** Arguments passed to the tool (as key-value pairs) */
  arguments: Record<string, unknown>;

  /** Timestamp when the call was initiated */
  timestamp?: number;
}

// ============================================================================
// Section 1.1: Tool Result Interface
// ============================================================================

/**
 * Tool result interface.
 * Represents the outcome of a tool execution.
 */
export interface ToolResult {
  /** ID of the tool call this result corresponds to */
  toolCallId: string;

  /** Whether the tool execution succeeded */
  success: boolean;

  /** The result content (string for text, object for structured data) */
  content: string | Record<string, unknown>;

  /** Error message if the execution failed */
  error?: string;

  /** Error code for programmatic handling */
  errorCode?: string;

  /** Execution duration in milliseconds */
  durationMs?: number;

  /** Additional metadata about the execution */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Section 1.1: Tool Executor Type
// ============================================================================

/**
 * Tool executor function type.
 * Executes a tool with the given arguments and returns the result.
 */
export type ToolExecutor = (
  args: Record<string, unknown>,
  context?: ToolExecutionContext
) => Promise<ToolResult>;

/**
 * Context provided to tool executors.
 * Contains runtime information about the execution environment.
 */
export interface ToolExecutionContext {
  /** Current working directory */
  cwd?: string;

  /** Session ID for the current session */
  sessionId?: string;

  /** ID of the tool call being executed */
  toolCallId: string;

  /** Timeout in milliseconds for the execution */
  timeout?: number;

  /** Whether to run in sandbox mode */
  sandbox?: boolean;

  /** Environment variables */
  env?: Record<string, string>;

  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;
}

// ============================================================================
// Section 1.1: Tool Validation Result Interface
// ============================================================================

/**
 * Validation error for a specific parameter.
 */
export interface ParameterValidationError {
  /** Name of the parameter that failed validation */
  parameter: string;

  /** Description of the validation error */
  message: string;

  /** Expected type or value */
  expected?: string;

  /** Actual value received */
  actual?: unknown;

  /** Path to nested property if applicable (e.g., 'config.options.timeout') */
  path?: string;
}

/**
 * Tool validation result interface.
 * Contains the outcome of validating a tool call against a tool definition.
 */
export interface ToolValidationResult {
  /** Whether the validation passed */
  valid: boolean;

  /** List of validation errors (empty if valid) */
  errors: ParameterValidationError[];

  /** Warnings that don't prevent execution but should be noted */
  warnings?: string[];

  /** The validated and potentially coerced arguments */
  validatedArgs?: Record<string, unknown>;
}

// ============================================================================
// Tool Calling Method Types
// ============================================================================

/**
 * Method used for tool calling.
 * Determines how tool invocations are formatted and parsed.
 */
export type ToolCallingMethod = 'native' | 'xml' | 'json';

/**
 * Format used for emulated tool calling.
 */
export type EmulationFormat = 'xml' | 'json';

// ============================================================================
// Tool Call Result Types
// ============================================================================

/**
 * Result of a tool calling operation.
 * Contains both the parsed tool calls and any text response.
 */
export interface ToolCallResult {
  /** Tool calls extracted from the response */
  toolCalls: ToolCall[];

  /** Non-tool-call text from the response */
  textContent?: string;

  /** Whether the response indicates completion (no more tool calls needed) */
  isComplete: boolean;

  /** Raw response from the model for debugging */
  rawResponse?: string;

  /** Method used to extract tool calls */
  method: ToolCallingMethod;
}

// ============================================================================
// Registered Tool Types
// ============================================================================

/**
 * Registered tool with its executor.
 * Combines the tool definition with its execution function.
 */
export interface RegisteredTool {
  /** Tool definition */
  tool: Tool;

  /** Function to execute the tool */
  executor: ToolExecutor;

  /** When the tool was registered */
  registeredAt: Date;

  /** Source of the registration (e.g., 'built-in', 'mcp:server-name', 'plugin') */
  source: string;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Type guard to check if a value is a valid Tool
 */
export function isTool(value: unknown): value is Tool {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.name === 'string' &&
    typeof obj.description === 'string' &&
    typeof obj.parameters === 'object' &&
    obj.parameters !== null
  );
}

/**
 * Type guard to check if a value is a valid ToolCall
 */
export function isToolCall(value: unknown): value is ToolCall {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.arguments === 'object' &&
    obj.arguments !== null
  );
}

/**
 * Type guard to check if a value is a valid ToolResult
 */
export function isToolResult(value: unknown): value is ToolResult {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.toolCallId === 'string' &&
    typeof obj.success === 'boolean' &&
    (typeof obj.content === 'string' || typeof obj.content === 'object')
  );
}

/**
 * Create a successful tool result
 */
export function createSuccessResult(
  toolCallId: string,
  content: string | Record<string, unknown>,
  metadata?: Record<string, unknown>
): ToolResult {
  return {
    toolCallId,
    success: true,
    content,
    metadata,
  };
}

/**
 * Create an error tool result
 */
export function createErrorResult(
  toolCallId: string,
  error: string,
  errorCode?: string
): ToolResult {
  return {
    toolCallId,
    success: false,
    content: '',
    error,
    errorCode,
  };
}
