/**
 * Slash Command Parser for komplete-kontrol-cli
 * 
 * This module handles parsing slash command files with YAML frontmatter,
 * similar to Claude Code's command format.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { Logger } from '../../utils/logger.js';
import { ErrorHandler } from '../../utils/error-handler.js';
import type {
  CommandFrontmatter,
  SlashCommand,
  CommandExecutionContext,
  CommandExecutionResult,
} from './types.js';

/**
 * Slash Command Parser
 * 
 * Parses markdown files with YAML frontmatter into executable commands.
 */
export class CommandParser {
  private logger: Logger;
  private errorHandler: ErrorHandler;

  constructor(logger: Logger, errorHandler: ErrorHandler) {
    this.logger = logger;
    this.errorHandler = errorHandler;
  }

  /**
   * Parse a command file
   * 
   * @param path - Path to command file
   * @returns Parsed command or null if parsing fails
   */
  async parseCommandFile(path: string, isBuiltin: boolean = false): Promise<SlashCommand | null> {
    try {
      const content = await readFile(path, 'utf-8');
      return this.parseCommandContent(content, path, isBuiltin);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to parse command file: ${path}`, err.message);
      return null;
    }
  }

  /**
   * Parse command content from string
   * 
   * @param content - Command file content
   * @param path - Path to command file
   * @param isBuiltin - Whether command is built-in
   * @returns Parsed command
   */
  parseCommandContent(content: string, path: string, isBuiltin: boolean = false): SlashCommand | null {
    try {
      // Extract frontmatter and body
      const { frontmatter, body } = this.extractFrontmatter(content);

      // Extract command name from path
      const name = this.extractCommandName(path);
      const namespace = this.extractNamespace(path);

      return {
        name,
        namespace,
        path,
        frontmatter: frontmatter || {},
        content: body.trim(),
        isBuiltin,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to parse command content from ${path}`, err.message);
      return null;
    }
  }

  /**
   * Extract YAML frontmatter from markdown content
   * 
   * @param content - Markdown content
   * @returns Frontmatter and body
   */
  private extractFrontmatter(content: string): { frontmatter: CommandFrontmatter; body: string } {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      return { frontmatter: {}, body: content };
    }

    const frontmatterStr = match[1] ?? '';
    const body = match[2] ?? '';

    // Parse YAML frontmatter
    const frontmatter = this.parseYaml(frontmatterStr);

    return { frontmatter, body };
  }

  /**
   * Parse simple YAML frontmatter
   * 
   * @param yaml - YAML string
   * @returns Parsed frontmatter object
   */
  private parseYaml(yaml: string): CommandFrontmatter {
    const frontmatter: CommandFrontmatter = {};
    const lines = yaml.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const colonIndex = trimmed.indexOf(':');
      if (colonIndex === -1) continue;

      const key = trimmed.slice(0, colonIndex).trim();
      let value = trimmed.slice(colonIndex + 1).trim();

      // Parse value
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1);
      } else if (value === 'true') {
        (frontmatter as any)[this.camelCase(key)] = true;
        continue;
      } else if (value === 'false') {
        (frontmatter as any)[this.camelCase(key)] = false;
        continue;
      } else if (value.startsWith('[') && value.endsWith(']')) {
        // Parse array
        const arrayContent = value.slice(1, -1);
        const items = arrayContent.split(',').map(item => item.trim().replace(/['"]/g, ''));
        (frontmatter as any)[this.camelCase(key)] = items;
        continue;
      }

      (frontmatter as any)[this.camelCase(key)] = value;
    }

    return frontmatter;
  }

  /**
   * Convert kebab-case to camelCase
   * 
   * @param str - Kebab-case string
   * @returns camelCase string
   */
  private camelCase(str: string): string {
    return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  /**
   * Extract command name from file path
   * 
   * @param path - File path
   * @returns Command name
   */
  private extractCommandName(path: string): string {
    const filename = path.split('/').pop() || '';
    return filename.replace(/\.md$/, '');
  }

  /**
   * Extract namespace from file path
   * 
   * @param path - File path
   * @returns Namespace or undefined
   */
  private extractNamespace(path: string): string | undefined {
    const parts = path.split('/');
    // Look for 'commands' directory
    const commandsIndex = parts.findIndex(p => p === 'commands');
    if (commandsIndex === -1 || commandsIndex + 1 >= parts.length) {
      return undefined;
    }
    // Check if next part is a namespace (subdirectory)
    const potentialNamespace = parts[commandsIndex + 1];
    // If it's a directory (not the file itself), it's a namespace
    if (potentialNamespace && !potentialNamespace.endsWith('.md')) {
      return potentialNamespace;
    }
    return undefined;
  }

  /**
   * Process command content by replacing variables
   * 
   * @param command - Command to process
   * @param context - Execution context
   * @returns Processed content
   */
  processCommand(command: SlashCommand, context: CommandExecutionContext): string {
    let content = command.content;

    // Replace $ARGUMENTS with all arguments joined
    content = content.replace(/\$ARGUMENTS/g, context.arguments.join(' '));

    // Replace $1, $2, $3, etc. with positional arguments
    content = content.replace(/\$(\d+)/g, (_, index) => {
      const argIndex = parseInt(index, 10) - 1;
      return context.arguments[argIndex] || '';
    });

    // Replace $IF(condition, then, else) pattern
    content = content.replace(/\$IF\(([^,]+),\s*([^,]+),\s*([^)]+)\)/g, (_, condition, thenClause, elseClause) => {
      const conditionValue = condition.trim();
      // Simple truthy check
      if (conditionValue && conditionValue !== 'false' && conditionValue !== '0') {
        return thenClause.trim();
      }
      return elseClause.trim();
    });

    // Replace bash execution patterns !`command`
    // Note: This is a placeholder - actual execution happens separately
    content = content.replace(/!`([^`]+)`/g, (_, bashCommand) => {
      return `[BASH:${bashCommand}]`;
    });

    // Replace file references @path
    // Note: This is a placeholder - actual file reading happens separately
    content = content.replace(/@([^\s\n]+)/g, (_, filePath) => {
      return `[FILE:${filePath}]`;
    });

    return content;
  }

  /**
   * Validate command frontmatter
   * 
   * @param frontmatter - Frontmatter to validate
   * @returns Whether frontmatter is valid
   */
  validateFrontmatter(frontmatter: CommandFrontmatter): boolean {
    // Validate model if specified
    if (frontmatter.model && !['haiku', 'sonnet', 'opus'].includes(frontmatter.model)) {
      this.logger.warn(`Invalid model specified: ${frontmatter.model}`);
      return false;
    }

    // Validate allowed-tools if specified
    if (frontmatter.allowedTools) {
      const tools = Array.isArray(frontmatter.allowedTools)
        ? frontmatter.allowedTools
        : frontmatter.allowedTools.split(',').map(t => t.trim());
      
      const validTools = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Ask'];
      for (const tool of tools) {
        const toolName = tool.split('(')[0]?.trim() ?? '';
        if (!validTools.includes(toolName)) {
          this.logger.warn(`Unknown tool in allowed-tools: ${toolName}`);
        }
      }
    }

    return true;
  }
}

/**
 * Create a command parser instance
 * 
 * @param logger - Logger instance
 * @param errorHandler - Error handler instance
 * @returns Command parser instance
 */
export function createCommandParser(
  logger: Logger,
  errorHandler: ErrorHandler
): CommandParser {
  return new CommandParser(logger, errorHandler);
}
