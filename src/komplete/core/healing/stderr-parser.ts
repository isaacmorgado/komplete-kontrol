/**
 * Stderr Parser
 *
 * Parses stderr output to detect and categorize errors with
 * enhanced pattern matching, stack trace parsing, and error context extraction.
 */

import { z } from 'zod';
import { Logger } from '../../utils/logger';
import type { ErrorInfo } from './loop';

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  /**
   * Critical error - execution cannot continue
   */
  CRITICAL = 'critical',

  /**
   * Error - serious issue that affects functionality
   */
  ERROR = 'error',

  /**
   * Warning - potential issue that should be reviewed
   */
  WARNING = 'warning',

  /**
   * Info - informational message
   */
  INFO = 'info',
}

/**
 * Error category
 */
export enum ErrorCategory {
  /**
   * Syntax error
   */
  SYNTAX = 'syntax',

  /**
   * Type error
   */
  TYPE = 'type',

  /**
   * Reference error
   */
  REFERENCE = 'reference',

  /**
   * Runtime error
   */
  RUNTIME = 'runtime',

  /**
   * Module/Import error
   */
  MODULE = 'module',

  /**
   * Network error
   */
  NETWORK = 'network',

  /**
   * File system error
   */
  FILESYSTEM = 'filesystem',

  /**
   * Permission error
   */
  PERMISSION = 'permission',

  /**
   * Memory error
   */
  MEMORY = 'memory',

  /**
   * Timeout error
   */
  TIMEOUT = 'timeout',

  /**
   * Assertion error
   */
  ASSERTION = 'assertion',

  /**
   * Unknown error
   */
  UNKNOWN = 'unknown',
}

/**
 * Parsed error
 */
export interface ParsedError {
  /**
   * Error ID
   */
  id: string;

  /**
   * Raw error message
   */
  raw: string;

  /**
   * Cleaned error message
   */
  message: string;

  /**
   * Error type
   */
  type: string;

  /**
   * Error category
   */
  category: ErrorCategory;

  /**
   * Severity
   */
  severity: ErrorSeverity;

  /**
   * File path
   */
  file?: string;

  /**
   * Line number
   */
  line?: number;

  /**
   * Column number
   */
  column?: number;

  /**
   * Stack trace
   */
  stackTrace?: StackFrame[];

  /**
   * Error code
   */
  errorCode?: string;

  /**
   * Suggestions
   */
  suggestions?: string[];

  /**
   * Context lines
   */
  context?: {
    before: string[];
    line: string;
    after: string[];
  };

  /**
   * Timestamp
   */
  timestamp: number;
}

/**
 * Stack frame
 */
export interface StackFrame {
  /**
   * Function name
   */
  function?: string;

  /**
   * File path
   */
  file: string;

  /**
   * Line number
   */
  line: number;

  /**
   * Column number
   */
  column?: number;

  /**
   * Source code
   */
  source?: string;
}

/**
 * Parser options
 */
export interface StderrParserOptions {
  /**
   * Enable stack trace parsing
   */
  parseStackTraces?: boolean;

  /**
   * Enable context extraction
   */
  extractContext?: boolean;

  /**
   * Context lines (before/after)
   */
  contextLines?: number;

  /**
   * Enable suggestions
   */
  enableSuggestions?: boolean;

  /**
   * Custom error patterns
   */
  customPatterns?: ErrorPattern[];

  /**
   * Ignore patterns
   */
  ignorePatterns?: RegExp[];
}

/**
 * Error pattern
 */
export interface ErrorPattern {
  /**
   * Pattern regex
   */
  pattern: RegExp;

  /**
   * Error type
   */
  type: string;

  /**
   * Error category
   */
  category: ErrorCategory;

  /**
   * Severity
   */
  severity: ErrorSeverity;

  /**
   * Suggestion generator
   */
  suggestionGenerator?: (match: RegExpMatchArray) => string[];
}

/**
 * Stderr Parser class
 *
 * Parses stderr output to extract and categorize errors.
 */
export class StderrParser {
  private logger: Logger;
  private options: Required<StderrParserOptions>;
  private patterns: ErrorPattern[];

  constructor(options: StderrParserOptions = {}) {
    this.logger = new Logger();

    this.options = {
      parseStackTraces: options.parseStackTraces ?? true,
      extractContext: options.extractContext ?? true,
      contextLines: options.contextLines || 2,
      enableSuggestions: options.enableSuggestions ?? true,
      customPatterns: options.customPatterns || [],
      ignorePatterns: options.ignorePatterns || [],
    };

    this.patterns = this.initializePatterns();

    this.logger.info('StderrParser initialized', 'StderrParser');
  }

  /**
   * Parse stderr output
   *
   * @param stderr - Stderr output
   * @param sourceCode - Optional source code for context
   * @returns Array of parsed errors
   */
  parse(stderr: string, sourceCode?: string): ParsedError[] {
    if (!stderr || stderr.trim().length === 0) {
      return [];
    }

    const errors: ParsedError[] = [];

    // Split stderr into lines
    const lines = stderr.split('\n');

    let currentError: Partial<ParsedError> | null = null;
    let stackTraceLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!.trim();

      // Skip empty lines
      if (line.length === 0) {
        continue;
      }

      // Check ignore patterns
      if (this.shouldIgnore(line)) {
        continue;
      }

      // Try to match error patterns
      const pattern = this.matchPattern(line);

      if (pattern) {
        // Save previous error if exists
        if (currentError) {
          errors.push(this.finalizeError(currentError, stackTraceLines, sourceCode));
          stackTraceLines = [];
        }

        // Start new error
        currentError = {
          id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          raw: line,
          type: pattern.type,
          category: pattern.category,
          severity: pattern.severity,
          timestamp: Date.now(),
        };

        // Extract error details
        this.extractErrorDetails(currentError, line, pattern);
      } else if (currentError && this.isStackTraceLine(line)) {
        // Collect stack trace lines
        stackTraceLines.push(line);
      }
    }

    // Finalize last error
    if (currentError) {
      errors.push(this.finalizeError(currentError, stackTraceLines, sourceCode));
    }

    return errors;
  }

  /**
   * Parse single error line
   *
   * @param errorLine - Error line
   * @returns Parsed error or null
   */
  parseLine(errorLine: string): ParsedError | null {
    const pattern = this.matchPattern(errorLine);

    if (!pattern) {
      return null;
    }

    const error: Partial<ParsedError> = {
      id: `err_${Date.now()}`,
      raw: errorLine,
      type: pattern.type,
      category: pattern.category,
      severity: pattern.severity,
      timestamp: Date.now(),
    };

    this.extractErrorDetails(error, errorLine, pattern);

    return this.finalizeError(error, [], undefined);
  }

  /**
   * Extract error info (compatible with loop.ts)
   *
   * @param stderr - Stderr output
   * @returns Error info
   */
  extractErrorInfo(stderr: string): ErrorInfo {
    const errors = this.parse(stderr);

    if (errors.length === 0) {
      return {
        message: stderr.substring(0, 200),
        type: 'UnknownError',
        timestamp: Date.now(),
      };
    }

    const firstError = errors[0]!;

    return {
      message: firstError.message,
      type: firstError.type,
      lineNumber: firstError.line,
      columnNumber: firstError.column,
      timestamp: firstError.timestamp,
      pattern: firstError.category,
    };
  }

  /**
   * Get error statistics
   *
   * @param stderr - Stderr output
   * @returns Error statistics
   */
  getStatistics(stderr: string): {
    totalErrors: number;
    bySeverity: Record<ErrorSeverity, number>;
    byCategory: Record<ErrorCategory, number>;
    byType: Record<string, number>;
  } {
    const errors = this.parse(stderr);

    const stats = {
      totalErrors: errors.length,
      bySeverity: {} as Record<ErrorSeverity, number>,
      byCategory: {} as Record<ErrorCategory, number>,
      byType: {} as Record<string, number>,
    };

    // Initialize counts
    for (const severity of Object.values(ErrorSeverity)) {
      stats.bySeverity[severity] = 0;
    }

    for (const category of Object.values(ErrorCategory)) {
      stats.byCategory[category] = 0;
    }

    // Count errors
    for (const error of errors) {
      stats.bySeverity[error.severity]++;
      stats.byCategory[error.category]++;
      stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
    }

    return stats;
  }

  /**
   * Initialize error patterns
   *
   * @returns Array of error patterns
   */
  private initializePatterns(): ErrorPattern[] {
    const patterns: ErrorPattern[] = [
      // Syntax errors
      {
        pattern: /SyntaxError:\s*(.+)/i,
        type: 'SyntaxError',
        category: ErrorCategory.SYNTAX,
        severity: ErrorSeverity.ERROR,
        suggestionGenerator: () => [
          'Check for missing parentheses, brackets, or braces',
          'Verify proper use of quotes and commas',
          'Ensure valid JavaScript/TypeScript syntax',
        ],
      },

      // Type errors
      {
        pattern: /TypeError:\s*(.+)/i,
        type: 'TypeError',
        category: ErrorCategory.TYPE,
        severity: ErrorSeverity.ERROR,
        suggestionGenerator: () => [
          'Verify variable types match expected types',
          'Check for null or undefined values',
          'Ensure proper type annotations',
        ],
      },

      // Reference errors
      {
        pattern: /ReferenceError:\s*(.+)/i,
        type: 'ReferenceError',
        category: ErrorCategory.REFERENCE,
        severity: ErrorSeverity.ERROR,
        suggestionGenerator: (match) => [
          `Variable is not defined - check spelling and scope`,
          'Import the required module or variable',
          'Declare the variable before using it',
        ],
      },

      // Module errors
      {
        pattern: /Cannot find module\s+['"](.+)['"]/i,
        type: 'ModuleNotFoundError',
        category: ErrorCategory.MODULE,
        severity: ErrorSeverity.ERROR,
        suggestionGenerator: (match) => [
          `Install the missing module: bun install ${match[1]}`,
          'Check the module path is correct',
          'Verify the module is listed in package.json',
        ],
      },

      // Import errors
      {
        pattern: /Error:\s*Cannot find package\s+['"](.+)['"]/i,
        type: 'ImportError',
        category: ErrorCategory.MODULE,
        severity: ErrorSeverity.ERROR,
        suggestionGenerator: (match) => [
          `Install the missing package: bun install ${match[1]}`,
          'Check package.json for typos',
        ],
      },

      // File system errors
      {
        pattern: /ENOENT.*no such file or directory.*['"](.+)['"]/i,
        type: 'FileNotFoundError',
        category: ErrorCategory.FILESYSTEM,
        severity: ErrorSeverity.ERROR,
        suggestionGenerator: (match) => [
          `Create the missing file: ${match[1]}`,
          'Check the file path is correct',
          'Verify file permissions',
        ],
      },

      // Permission errors
      {
        pattern: /EACCES.*permission denied/i,
        type: 'PermissionError',
        category: ErrorCategory.PERMISSION,
        severity: ErrorSeverity.CRITICAL,
        suggestionGenerator: () => [
          'Check file/directory permissions',
          'Run with appropriate user privileges',
          'Verify ownership of files',
        ],
      },

      // Memory errors
      {
        pattern: /FATAL ERROR:.*out of memory/i,
        type: 'MemoryError',
        category: ErrorCategory.MEMORY,
        severity: ErrorSeverity.CRITICAL,
        suggestionGenerator: () => [
          'Increase Node.js memory limit: --max-old-space-size',
          'Check for memory leaks',
          'Optimize memory usage',
        ],
      },

      // Network errors
      {
        pattern: /ECONNREFUSED.*connect/i,
        type: 'ConnectionRefusedError',
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.ERROR,
        suggestionGenerator: () => [
          'Verify the server is running',
          'Check the port number',
          'Verify network connectivity',
        ],
      },

      // Timeout errors
      {
        pattern: /ETIMEDOUT|timeout/i,
        type: 'TimeoutError',
        category: ErrorCategory.TIMEOUT,
        severity: ErrorSeverity.WARNING,
        suggestionGenerator: () => [
          'Increase timeout duration',
          'Check network connection',
          'Optimize slow operations',
        ],
      },

      // Assertion errors
      {
        pattern: /AssertionError:\s*(.+)/i,
        type: 'AssertionError',
        category: ErrorCategory.ASSERTION,
        severity: ErrorSeverity.ERROR,
        suggestionGenerator: () => [
          'Review test expectations',
          'Check actual vs expected values',
          'Verify test data',
        ],
      },

      // TypeScript errors
      {
        pattern: /TS(\d+):\s*(.+)/,
        type: 'TypeScriptError',
        category: ErrorCategory.TYPE,
        severity: ErrorSeverity.ERROR,
        suggestionGenerator: () => [
          'Fix TypeScript type errors',
          'Add proper type annotations',
          'Check tsconfig.json settings',
        ],
      },

      // ESLint errors
      {
        pattern: /(.+):(\d+):(\d+):\s*error\s+(.+)/,
        type: 'ESLintError',
        category: ErrorCategory.SYNTAX,
        severity: ErrorSeverity.WARNING,
      },

      // Generic errors
      {
        pattern: /Error:\s*(.+)/i,
        type: 'Error',
        category: ErrorCategory.RUNTIME,
        severity: ErrorSeverity.ERROR,
      },
    ];

    // Add custom patterns
    return [...patterns, ...this.options.customPatterns];
  }

  /**
   * Match error pattern
   *
   * @param line - Line to match
   * @returns Matched pattern or null
   */
  private matchPattern(line: string): ErrorPattern | null {
    for (const pattern of this.patterns) {
      if (pattern.pattern.test(line)) {
        return pattern;
      }
    }

    return null;
  }

  /**
   * Check if line should be ignored
   *
   * @param line - Line to check
   * @returns Should ignore
   */
  private shouldIgnore(line: string): boolean {
    for (const pattern of this.options.ignorePatterns) {
      if (pattern.test(line)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Extract error details
   *
   * @param error - Partial error object
   * @param line - Error line
   * @param pattern - Matched pattern
   */
  private extractErrorDetails(
    error: Partial<ParsedError>,
    line: string,
    pattern: ErrorPattern
  ): void {
    const match = line.match(pattern.pattern);

    if (!match) {
      error.message = line;
      return;
    }

    // Extract message
    error.message = match[1] || line;

    // Extract file location (file:line:column format)
    const locationMatch = line.match(/([^:]+):(\d+):(\d+)/);
    if (locationMatch) {
      error.file = locationMatch[1];
      error.line = parseInt(locationMatch[2]!, 10);
      error.column = parseInt(locationMatch[3]!, 10);
    }

    // Extract error code
    const codeMatch = line.match(/[A-Z]+\d+/);
    if (codeMatch) {
      error.errorCode = codeMatch[0];
    }

    // Generate suggestions
    if (this.options.enableSuggestions && pattern.suggestionGenerator) {
      error.suggestions = pattern.suggestionGenerator(match);
    }
  }

  /**
   * Check if line is a stack trace line
   *
   * @param line - Line to check
   * @returns Is stack trace line
   */
  private isStackTraceLine(line: string): boolean {
    return (
      line.trim().startsWith('at ') ||
      /^\s+at\s+/.test(line) ||
      /^\s+\d+\s+\|/.test(line)
    );
  }

  /**
   * Parse stack trace
   *
   * @param lines - Stack trace lines
   * @returns Stack frames
   */
  private parseStackTrace(lines: string[]): StackFrame[] {
    const frames: StackFrame[] = [];

    for (const line of lines) {
      const frame = this.parseStackFrame(line);
      if (frame) {
        frames.push(frame);
      }
    }

    return frames;
  }

  /**
   * Parse stack frame
   *
   * @param line - Stack frame line
   * @returns Stack frame or null
   */
  private parseStackFrame(line: string): StackFrame | null {
    // Format: at functionName (file:line:column)
    const match1 = line.match(/at\s+([^(]+)\s+\((.+):(\d+):(\d+)\)/);
    if (match1) {
      return {
        function: match1[1]!.trim(),
        file: match1[2]!,
        line: parseInt(match1[3]!, 10),
        column: parseInt(match1[4]!, 10),
      };
    }

    // Format: at file:line:column
    const match2 = line.match(/at\s+(.+):(\d+):(\d+)/);
    if (match2) {
      return {
        file: match2[1]!,
        line: parseInt(match2[2]!, 10),
        column: parseInt(match2[3]!, 10),
      };
    }

    return null;
  }

  /**
   * Extract context around error line
   *
   * @param sourceCode - Source code
   * @param lineNumber - Error line number
   * @returns Context
   */
  private extractContextFromSource(
    sourceCode: string,
    lineNumber: number
  ): ParsedError['context'] {
    const lines = sourceCode.split('\n');
    const index = lineNumber - 1; // Convert to 0-indexed

    if (index < 0 || index >= lines.length) {
      return undefined;
    }

    const contextSize = this.options.contextLines;
    const before = lines.slice(
      Math.max(0, index - contextSize),
      index
    );
    const line = lines[index]!;
    const after = lines.slice(
      index + 1,
      Math.min(lines.length, index + 1 + contextSize)
    );

    return { before, line, after };
  }

  /**
   * Finalize error object
   *
   * @param error - Partial error
   * @param stackTraceLines - Stack trace lines
   * @param sourceCode - Optional source code
   * @returns Complete parsed error
   */
  private finalizeError(
    error: Partial<ParsedError>,
    stackTraceLines: string[],
    sourceCode?: string
  ): ParsedError {
    const finalError = error as ParsedError;

    // Parse stack trace
    if (this.options.parseStackTraces && stackTraceLines.length > 0) {
      finalError.stackTrace = this.parseStackTrace(stackTraceLines);
    }

    // Extract context
    if (
      this.options.extractContext &&
      sourceCode &&
      finalError.line
    ) {
      finalError.context = this.extractContextFromSource(
        sourceCode,
        finalError.line
      );
    }

    return finalError;
  }
}

/**
 * Schema for parser options
 */
export const StderrParserOptionsSchema = z.object({
  parseStackTraces: z.boolean().optional(),
  extractContext: z.boolean().optional(),
  contextLines: z.number().min(0).max(10).optional(),
  enableSuggestions: z.boolean().optional(),
  customPatterns: z.array(z.any()).optional(),
  ignorePatterns: z.array(z.any()).optional(),
});

/**
 * Global stderr parser instance
 */
let globalStderrParser: StderrParser | null = null;

/**
 * Initialize global stderr parser
 *
 * @param options - Options
 * @returns The global stderr parser
 */
export function initStderrParser(
  options?: StderrParserOptions
): StderrParser {
  globalStderrParser = new StderrParser(options);
  return globalStderrParser;
}

/**
 * Get global stderr parser
 *
 * @returns The global stderr parser
 */
export function getStderrParser(): StderrParser {
  if (!globalStderrParser) {
    globalStderrParser = new StderrParser();
  }
  return globalStderrParser;
}
