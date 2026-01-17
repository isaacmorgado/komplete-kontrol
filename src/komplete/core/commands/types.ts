/**
 * Slash Command Types for komplete-kontrol-cli
 * 
 * This module defines the types and interfaces for the slash command system,
 * inspired by Claude Code's command architecture.
 */

/**
 * Frontmatter configuration for slash commands
 */
export interface CommandFrontmatter {
  /** Brief description shown in help */
  description?: string;
  /** Specify which tools command can use */
  allowedTools?: string | string[];
  /** Specify model for command execution */
  model?: string;
  /** Document expected arguments for autocomplete */
  argumentHint?: string;
  /** Prevent programmatic command invocation */
  disableModelInvocation?: boolean;
  /** Command category for organization */
  category?: string;
  /** Command tags for filtering */
  tags?: string[];
}

/**
 * Parsed slash command with frontmatter and content
 */
export interface SlashCommand {
  /** Command name (filename without .md extension) */
  name: string;
  /** Command namespace (from directory structure) */
  namespace?: string;
  /** Full command path */
  path: string;
  /** Parsed frontmatter */
  frontmatter: CommandFrontmatter;
  /** Command content (markdown body) */
  content: string;
  /** Whether command is built-in or user-defined */
  isBuiltin: boolean;
}

/**
 * Command execution context
 */
export interface CommandExecutionContext {
  /** Arguments passed to command */
  arguments: string[];
  /** Current working directory */
  cwd: string;
  /** Session ID (if in session context) */
  sessionId?: string;
  /** Additional context variables */
  variables?: Record<string, string>;
}

/**
 * Command execution result
 */
export interface CommandExecutionResult {
  /** Whether execution was successful */
  success: boolean;
  /** Output from command execution */
  output?: string;
  /** Error message if failed */
  error?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Command registry entry
 */
export interface CommandRegistryEntry {
  /** Command name */
  name: string;
  /** Command namespace */
  namespace?: string;
  /** Full command name (namespace:name if namespaced) */
  fullName: string;
  /** Command description */
  description: string;
  /** Argument hint */
  argumentHint?: string;
  /** Command path */
  path: string;
  /** Whether command is built-in */
  isBuiltin: boolean;
  /** Tags */
  tags?: string[];
}

/**
 * Command list options
 */
export interface CommandListOptions {
  /** Filter by namespace */
  namespace?: string;
  /** Filter by tags */
  tags?: string[];
  /** Include built-in commands */
  includeBuiltin?: boolean;
  /** Include user commands */
  includeUser?: boolean;
}

/**
 * Command resolution result
 */
export interface CommandResolution {
  /** Resolved command */
  command: SlashCommand;
  /** Matched arguments */
  arguments: string[];
  /** Whether resolution was exact match */
  exactMatch: boolean;
}

/**
 * Command directories configuration
 */
export interface CommandDirectories {
  /** Built-in commands directory */
  builtin: string;
  /** User commands directory */
  user: string;
  /** Project commands directory */
  project: string;
}
