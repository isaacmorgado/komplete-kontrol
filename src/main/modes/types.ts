/**
 * Mode System Type Definitions
 *
 * Ported from Roo Code (Apache 2.0 license) with extensions for Komplete-Kontrol.
 *
 * This module defines all types for the operational mode system that allows
 * agents to operate in specialized configurations with per-mode tool restrictions,
 * model preferences, and system prompts.
 *
 * Part of Phase 02: Mode System Integration
 */

import type { EventEmitter } from 'events';

// ============================================================================
// Section 1.1: Mode Type Definitions
// ============================================================================

/**
 * Operational mode type union
 * Defines the available behavioral modes for the AI agent
 */
export type OperationalMode =
  | 'architect'         // High-level design and planning
  | 'code'              // Code generation and modification
  | 'debug'             // Debugging and troubleshooting
  | 'test'              // Test generation and execution
  | 'reverse-engineer'  // Reverse engineering and analysis
  | 'ask';              // Q&A and information retrieval

/**
 * Tool group type union
 * Groups of tools that can be enabled/disabled together per mode
 */
export type ToolGroup =
  | 'read'      // File reading: read_file, search_files, list_files, codebase_search
  | 'edit'      // File editing: apply_diff, write_to_file, edit_file
  | 'browser'   // Web browsing: browser_action, screenshot, navigate, click, type
  | 'command'   // Shell commands: execute_command, run_tests
  | 'mcp'       // MCP integration: use_mcp_tool, access_mcp_resource
  | 'modes';    // Mode switching: switch_mode, new_task, handoff_to_agent

/**
 * Tool calling method for AI models
 * Determines how tool invocations are formatted
 */
export type ToolCallingMethod = 'native' | 'emulated' | 'xml' | 'json';

/**
 * Mode configuration interface
 * Defines the complete configuration for an operational mode
 */
export interface ModeConfig {
  /** Mode identifier slug */
  slug: OperationalMode;

  /** Human-readable display name */
  displayName: string;

  /** Role definition / system prompt for this mode */
  roleDefinition: string;

  /** Custom instructions appended to roleDefinition */
  customInstructions?: string;

  /** Tool groups available in this mode */
  toolGroups: ToolGroup[];

  /** Specific tools that are disabled even if their group is enabled */
  disabledTools?: string[];

  /** Preferred model for this mode */
  preferredModel: string;

  /** Fallback models to use if preferred model is unavailable */
  fallbackModels?: string[];

  /** Tool calling method for this mode */
  toolCallingMethod: ToolCallingMethod;

  /** Temperature setting for this mode (0-2) */
  temperature: number;

  /** Maximum tokens per request */
  maxTokens?: number;

  /** Modes this mode can hand off to */
  canHandoffTo: OperationalMode[];

  /** Whether this is a custom user-defined mode */
  isCustom?: boolean;

  /** Icon identifier for UI display */
  icon?: string;

  /** Short description of what this mode does */
  shortDescription?: string;
}

/**
 * Mode state interface for runtime state tracking
 */
export interface ModeState {
  /** Currently active mode */
  currentMode: OperationalMode;

  /** Previously active mode (for history tracking) */
  previousMode?: OperationalMode;

  /** Mode history (most recent first, limited to 10) */
  modeHistory: OperationalMode[];

  /** Currently allowed tools based on mode restrictions */
  allowedTools: Set<string>;

  /** Timestamp when mode was last changed */
  lastModeChangeAt: Date;

  /** Number of mode switches in current session */
  switchCount: number;

  /** Custom modes registered at runtime */
  customModes: Map<string, ModeConfig>;
}

/**
 * Mode transition interface for mode switching events
 */
export interface ModeTransition {
  /** Mode transitioning from */
  from: OperationalMode;

  /** Mode transitioning to */
  to: OperationalMode;

  /** Configuration of the new mode */
  config: ModeConfig;

  /** Timestamp of the transition */
  timestamp: Date;

  /** Reason for the transition (optional) */
  reason?: string;

  /** Whether the transition was user-initiated or automatic */
  initiatedBy: 'user' | 'agent' | 'system';
}

/**
 * Mode error types for error handling
 */
export type ModeErrorType =
  | 'INVALID_MODE'
  | 'TRANSITION_NOT_ALLOWED'
  | 'TOOL_NOT_ALLOWED'
  | 'CUSTOM_MODE_EXISTS'
  | 'MODE_NOT_FOUND'
  | 'CONTROLLER_NOT_INITIALIZED';

/**
 * Mode error interface
 */
export interface ModeError {
  type: ModeErrorType;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Model profile interface for mode-specific model configurations
 */
export interface ModelProfile {
  /** Model identifier (provider/model format) */
  model: string;

  /** Tool calling method for this model */
  toolCallingMethod: ToolCallingMethod;

  /** Optional temperature override */
  temperature?: number;

  /** Optional max tokens override */
  maxTokens?: number;

  /** Whether this model supports streaming */
  supportsStreaming?: boolean;

  /** Whether this model supports native tool calling */
  supportsNativeTools?: boolean;
}

/**
 * Mode controller events
 */
export interface ModeControllerEvents {
  /** Emitted when mode changes */
  'mode-changed': (transition: ModeTransition) => void;

  /** Emitted when mode change fails */
  'mode-error': (error: ModeError) => void;

  /** Emitted when a custom mode is registered */
  'custom-mode-registered': (config: ModeConfig) => void;

  /** Emitted when tool restrictions are updated */
  'tools-updated': (allowedTools: string[]) => void;
}

/**
 * Type for mode controller with events
 */
export interface IModeController extends EventEmitter {
  getCurrentMode(): ModeConfig;
  getModeConfig(slug: OperationalMode): ModeConfig | undefined;
  switchMode(targetMode: OperationalMode, initiatedBy?: 'user' | 'agent' | 'system'): Promise<ModeTransition>;
  getModeHistory(): OperationalMode[];
  getSystemPrompt(): string;
  getPreferredModel(): string;
  getFallbackModels(): string[];
  getToolCallingMethod(): ToolCallingMethod;
  registerCustomMode(config: ModeConfig): void;
  getAllModes(): ModeConfig[];
  isToolAllowed(toolName: string): boolean;
  getAllowedTools(): string[];
}

/**
 * Tool manager interface for dependency injection
 */
export interface IToolManager {
  setAllowedTools(tools: string[]): void;
  getAllTools(): string[];
  isToolAllowed(toolName: string): boolean;
}

/**
 * Switch mode result interface
 */
export interface SwitchModeResult {
  success: boolean;
  previousMode?: OperationalMode;
  currentMode: OperationalMode;
  config?: ModeConfig;
  error?: string;
}

/**
 * New task result interface
 */
export interface NewTaskResult {
  success: boolean;
  taskId: string;
  mode: OperationalMode;
  description: string;
  error?: string;
}

/**
 * All operational modes array (for iteration)
 */
export const ALL_OPERATIONAL_MODES: OperationalMode[] = [
  'architect',
  'code',
  'debug',
  'test',
  'reverse-engineer',
  'ask',
];

/**
 * All tool groups array (for iteration)
 */
export const ALL_TOOL_GROUPS: ToolGroup[] = [
  'read',
  'edit',
  'browser',
  'command',
  'mcp',
  'modes',
];

/**
 * Type guard to check if a string is a valid OperationalMode
 */
export function isOperationalMode(value: string): value is OperationalMode {
  return ALL_OPERATIONAL_MODES.includes(value as OperationalMode);
}

/**
 * Type guard to check if a string is a valid ToolGroup
 */
export function isToolGroup(value: string): value is ToolGroup {
  return ALL_TOOL_GROUPS.includes(value as ToolGroup);
}
