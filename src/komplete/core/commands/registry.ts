/**
 * Slash Command Registry for komplete-kontrol-cli
 * 
 * This module manages loading, storing, and retrieving slash commands,
 * similar to Claude Code's command system.
 */

import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { Logger, LoggerLike } from '../../utils/logger.js';
import { ErrorHandler } from '../../utils/error-handler.js';
import { CommandParser } from './parser.js';
import type {
  SlashCommand,
  CommandRegistryEntry,
  CommandListOptions,
  CommandResolution,
  CommandExecutionContext,
  CommandExecutionResult,
  CommandDirectories,
} from './types.js';

/**
 * Slash Command Registry
 * 
 * Manages loading and retrieving slash commands from multiple sources.
 */
export class CommandRegistry {
  private logger: LoggerLike;
  private errorHandler: ErrorHandler;
  private parser: CommandParser;
  private directories: CommandDirectories;
  private commands: Map<string, SlashCommand>;
  private initialized: boolean;

  constructor(
    logger: LoggerLike,
    errorHandler: ErrorHandler,
    parser: CommandParser,
    directories?: Partial<CommandDirectories>
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.parser = parser;
    this.commands = new Map();
    this.initialized = false;

    // Set default directories
    const homeDir = homedir();
    this.directories = {
      builtin: directories?.builtin || join(process.cwd(), 'src', 'core', 'commands', 'builtin'),
      user: directories?.user || join(homeDir, '.komplete', 'commands'),
      project: directories?.project || join(process.cwd(), '.komplete', 'commands'),
    };
  }

  /**
   * Initialize the registry by loading all commands
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      this.logger.warn('Command registry already initialized');
      return;
    }

    this.logger.info('Initializing command registry');

    // Load built-in commands
    await this.loadCommandsFromDirectory(this.directories.builtin, true);

    // Load user commands
    await this.loadCommandsFromDirectory(this.directories.user, false);

    // Load project commands
    await this.loadCommandsFromDirectory(this.directories.project, false);

    this.initialized = true;
    this.logger.info(`Command registry initialized with ${this.commands.size} commands`);
  }

  /**
   * Load commands from a directory
   * 
   * @param directory - Directory to load from
   * @param isBuiltin - Whether commands are built-in
   */
  private async loadCommandsFromDirectory(
    directory: string,
    isBuiltin: boolean
  ): Promise<void> {
    try {
      const dirStat = await stat(directory);
      if (!dirStat.isDirectory()) {
        return;
      }
    } catch {
      // Directory doesn't exist, skip
      return;
    }

    await this.loadCommandsRecursive(directory, isBuiltin, '');
  }

  /**
   * Recursively load commands from directory
   * 
   * @param directory - Directory to scan
   * @param isBuiltin - Whether commands are built-in
   * @param namespace - Current namespace
   */
  private async loadCommandsRecursive(
    directory: string,
    isBuiltin: boolean,
    namespace: string
  ): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(directory, entry.name);

      if (entry.isDirectory()) {
        // Recurse into subdirectory (namespace)
        const newNamespace = namespace ? `${namespace}/${entry.name}` : entry.name;
        await this.loadCommandsRecursive(fullPath, isBuiltin, newNamespace);
      } else if (entry.name.endsWith('.md')) {
        // Load command file
        const command = await this.parser.parseCommandFile(fullPath, isBuiltin);
        if (command) {
          // Override namespace from path
          if (namespace) {
            command.namespace = namespace;
          }
          this.registerCommand(command);
        }
      }
    }
  }

  /**
   * Register a command
   * 
   * @param command - Command to register
   */
  private registerCommand(command: SlashCommand): void {
    const fullName = command.namespace ? `${command.namespace}:${command.name}` : command.name;
    this.commands.set(fullName, command);
    this.logger.debug(`Registered command: ${fullName}`);
  }

  /**
   * Get a command by name
   * 
   * @param name - Command name (with optional namespace)
   * @returns Command or null if not found
   */
  getCommand(name: string): SlashCommand | null {
    // Try exact match first
    if (this.commands.has(name)) {
      return this.commands.get(name)!;
    }

    // Try to find without namespace
    for (const [key, command] of this.commands.entries()) {
      if (command.name === name) {
        return command;
      }
    }

    return null;
  }

  /**
   * Resolve a command from input string
   *
   * @param input - Input string (e.g., "command arg1 arg2" or "namespace:command arg1")
   * @returns Resolution result
   */
  resolveCommand(input: string): CommandResolution {
    const parts = input.trim().split(/\s+/);
    const commandPart = parts[0];
    const commandArgs = parts.slice(1);

    // Validate commandPart is not empty
    if (!commandPart) {
      throw new Error('Command name is required');
    }

    // Try exact match
    if (this.commands.has(commandPart)) {
      const cmd = this.commands.get(commandPart);
      if (!cmd) {
        throw new Error(`Command not found: ${commandPart}`);
      }
      return {
        command: cmd,
        arguments: commandArgs,
        exactMatch: true,
      };
    }

    // Try to find by name (ignoring namespace)
    let bestMatch: SlashCommand | null = null;
    let bestMatchNamespace: string | undefined;

    for (const [key, command] of this.commands.entries()) {
      if (command.name && command.name === commandPart) {
        // Prefer exact namespace match or first found
        if (!bestMatch || (command.namespace && command.namespace === 'common')) {
          bestMatch = command;
          bestMatchNamespace = command.namespace;
        }
      }
    }

    if (bestMatch) {
      return {
        command: bestMatch,
        arguments: commandArgs,
        exactMatch: false,
      };
    }

    throw new Error(`Command not found: ${commandPart}`);
  }

  /**
   * List all commands
   * 
   * @param options - Filter options
   * @returns List of command entries
   */
  listCommands(options: CommandListOptions = {}): CommandRegistryEntry[] {
    const entries: CommandRegistryEntry[] = [];

    for (const [key, command] of this.commands.entries()) {
      // Filter by namespace
      if (options.namespace && command.namespace !== options.namespace) {
        continue;
      }

      // Filter by tags
      if (options.tags && options.tags.length > 0) {
        const commandTags = command.frontmatter.tags || [];
        const hasAllTags = options.tags.every(tag => commandTags.includes(tag));
        if (!hasAllTags) {
          continue;
        }
      }

      // Filter by builtin/user
      if (options.includeBuiltin === false && command.isBuiltin) {
        continue;
      }
      if (options.includeUser === false && !command.isBuiltin) {
        continue;
      }

      entries.push({
        name: command.name,
        namespace: command.namespace,
        fullName: key,
        description: command.frontmatter.description ?? (command.content ?? '').split('\n')[0]?.slice(0, 60) ?? '',
        argumentHint: command.frontmatter.argumentHint,
        path: command.path,
        isBuiltin: command.isBuiltin,
        tags: command.frontmatter.tags,
      });
    }

    return entries.sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

  /**
   * Execute a command
   * 
   * @param command - Command to execute
   * @param context - Execution context
   * @returns Execution result
   */
  async executeCommand(
    command: SlashCommand,
    context: CommandExecutionContext
  ): Promise<CommandExecutionResult> {
    try {
      const commandName = command.name ?? 'unknown';
      this.logger.info(`Executing command: ${commandName}`, 'CommandRegistry', {
        args: context.arguments,
      });

      // Process command content
      const processedContent = this.parser.processCommand(command, context);

      // For now, just return the processed content
      // In a full implementation, this would execute the command
      // through the agent system or other mechanisms
      return {
        success: true,
        output: processedContent,
        metadata: {
          command: command.name ?? 'unknown',
          namespace: command.namespace,
          arguments: context.arguments,
        },
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Command execution failed: ${command.name}`, err.message);
      return {
        success: false,
        error: err.message,
      };
    }
  }

  /**
   * Reload all commands
   */
  async reload(): Promise<void> {
    this.logger.info('Reloading command registry');
    this.commands.clear();
    this.initialized = false;
    await this.initialize();
  }

  /**
   * Get command directories
   * 
   * @returns Command directories
   */
  getDirectories(): CommandDirectories {
    return { ...this.directories };
  }

  /**
   * Get command count
   * 
   * @returns Number of registered commands
   */
  getCommandCount(): number {
    return this.commands.size;
  }

  /**
   * Check if registry is initialized
   * 
   * @returns Whether registry is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

/**
 * Create a command registry instance
 * 
 * @param logger - Logger instance
 * @param errorHandler - Error handler instance
 * @param parser - Command parser instance
 * @param directories - Optional command directories
 * @returns Command registry instance
 */
export function createCommandRegistry(
  logger: LoggerLike,
  errorHandler: ErrorHandler,
  parser: CommandParser,
  directories?: Partial<CommandDirectories>
): CommandRegistry {
  return new CommandRegistry(logger, errorHandler, parser, directories);
}
