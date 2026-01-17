/**
 * Slash Commands Module
 *
 * This module provides a slash command system similar to Claude Code,
 * allowing users to define reusable commands as Markdown files with YAML frontmatter.
 *
 * Key features:
 * - Markdown-based command definitions
 * - YAML frontmatter for configuration
 * - Dynamic argument substitution ($1, $2, $ARGUMENTS)
 * - File references (@path)
 * - Bash execution (!`command`)
 * - Namespace support for organization
 *
 * @module core/commands
 */

import { Logger, LoggerLike } from '../../utils/logger';
import { ErrorHandler } from '../../utils/error-handler';
import { CommandParser } from './parser';
import { CommandRegistry } from './registry';
import type { CommandDirectories } from './types';

export * from './types.js';
export * from './parser.js';
export * from './registry.js';

/**
 * Create a new CommandRegistry instance
 *
 * @param logger - Logger instance for command registry
 * @param errorHandler - Error handler instance
 * @param parser - Command parser instance
 * @param directories - Optional command directories
 * @returns A new CommandRegistry instance
 */
export function createCommandRegistry(
  logger: LoggerLike,
  errorHandler: ErrorHandler,
  parser: CommandParser,
  directories?: Partial<CommandDirectories>
): CommandRegistry {
  return new CommandRegistry(logger, errorHandler, parser, directories);
}
