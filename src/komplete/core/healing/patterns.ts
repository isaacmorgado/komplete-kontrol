/**
 * Error Pattern Matching
 *
 * Provides error pattern database, pattern matching engine,
 * and suggestion generation for self-healing loop.
 */

import { z } from 'zod';
import { Logger } from '../../utils/logger';

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
   * Import/Module error
   */
  MODULE = 'module',

  /**
   * Runtime error
   */
  RUNTIME = 'runtime',

  /**
   * Compilation error
   */
  COMPILATION = 'compilation',

  /**
   * Lint error
   */
  LINT = 'lint',

  /**
   * Test error
   */
  TEST = 'test',

  /**
   * Unknown error
   */
  UNKNOWN = 'unknown',
}

/**
 * Error severity
 */
export enum ErrorSeverity {
  /**
   * Critical severity
   */
  CRITICAL = 'critical',

  /**
   * High severity
   */
  HIGH = 'high',

  /**
   * Medium severity
   */
  MEDIUM = 'medium',

  /**
   * Low severity
   */
  LOW = 'low',

  /**
   * Info severity
   */
  INFO = 'info',
}

/**
 * Error pattern
 */
export interface ErrorPattern {
  /**
   * Pattern ID
   */
  id: string;

  /**
   * Pattern name
   */
  name: string;

  /**
   * Pattern regex
   */
  pattern: RegExp;

  /**
   * Error category
   */
  category: ErrorCategory;

  /**
   * Error severity
   */
  severity: ErrorSeverity;

  /**
   * Suggested fixes
   */
  suggestedFixes: string[];

  /**
   * Confidence score (0-1)
   */
  confidence: number;

  /**
   * Pattern metadata
   */
  metadata: Record<string, unknown>;
}

/**
 * Pattern match result
 */
export interface PatternMatch {
  /**
   * Pattern ID
   */
  patternId: string;

  /**
   * Pattern name
   */
  name: string;

  /**
   * Pattern regex
   */
  pattern: RegExp;

  /**
   * Matched text
   */
  matchedText: string;

  /**
   * Line number
   */
  lineNumber?: number;

  /**
   * Column number
   */
  columnNumber?: number;

  /**
   * Confidence score (0-1)
   */
  confidence: number;

  /**
   * Suggested fixes
   */
  suggestedFixes: string[];

  /**
   * Match metadata
   */
  metadata: Record<string, unknown>;
}

/**
 * Pattern database entry
 */
export interface PatternDatabaseEntry {
  /**
   * Pattern ID
   */
  id: string;

  /**
   * Pattern name
   */
  name: string;

  /**
   * Pattern regex string
   */
  pattern: string;

  /**
   * Error category
   */
  category: ErrorCategory;

  /**
   * Error severity
   */
  severity: ErrorSeverity;

  /**
   * Suggested fixes
   */
  suggestedFixes: string[];

  /**
   * Language (optional)
   */
  language?: string;

  /**
   * Entry metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Pattern matching options
 */
export interface PatternMatchingOptions {
  /**
   * Include category filter
   */
  includeCategories?: ErrorCategory[];

  /**
   * Exclude category filter
   */
  excludeCategories?: ErrorCategory[];

  /**
   * Include severity filter
   */
  includeSeverities?: ErrorSeverity[];

  /**
   * Exclude severity filter
   */
  excludeSeverities?: ErrorSeverity[];

  /**
   * Language filter
   */
  language?: string;

  /**
   * Minimum confidence
   */
  minConfidence?: number;

  /**
   * Max results
   */
  maxResults?: number;
}

/**
 * Error pattern matching class
 *
 * Provides error pattern matching and suggestion generation.
 */
export class ErrorPatternMatching {
  private logger: Logger;
  private patterns: Map<string, ErrorPattern> = new Map();
  private database: PatternDatabaseEntry[] = [];
  private cacheEnabled: boolean;

  constructor(options?: {
    logger?: Logger;
    database?: PatternDatabaseEntry[];
    cacheEnabled?: boolean;
  }) {
    this.logger = options?.logger || new Logger();
    this.cacheEnabled = options?.cacheEnabled ?? true;

    // Initialize with default patterns
    this.initializeDefaultPatterns();

    // Load custom database if provided
    if (options?.database) {
      this.loadDatabase(options.database);
    }

    this.logger.info('ErrorPatternMatching initialized', 'ErrorPatternMatching', {
      patternsCount: this.patterns.size,
    });
  }

  /**
   * Match patterns in error text
   *
   * @param errorText - Error text to match
   * @param options - Matching options
   * @returns Array of pattern matches
   */
  matchPatterns(
    errorText: string,
    options: PatternMatchingOptions = {}
  ): PatternMatch[] {
    const matches: PatternMatch[] = [];

    for (const [patternId, pattern] of this.patterns.entries()) {
      // Apply filters
      if (!this.matchesFilters(pattern, options)) {
        continue;
      }

      // Try to match pattern
      const match = errorText.match(pattern.pattern);

      if (match) {
        const patternMatch: PatternMatch = {
          patternId,
          name: pattern.name,
          pattern: pattern.pattern,
          matchedText: match[0],
          confidence: pattern.confidence,
          suggestedFixes: pattern.suggestedFixes,
          metadata: pattern.metadata,
        };

        // Extract line and column if available
        const lineMatch = match[0].match(/:(\d+):(\d+)/);
        if (lineMatch) {
          patternMatch.lineNumber = parseInt(lineMatch[1] || "0", 10);
          patternMatch.columnNumber = parseInt(lineMatch[2] || "0", 10);
        }

        matches.push(patternMatch);
      }
    }

    // Sort by confidence
    matches.sort((a, b) => b.confidence - a.confidence);

    // Apply max results limit
    const maxResults = options.maxResults ?? 10;
    return matches.slice(0, maxResults);
  }

  /**
   * Get pattern by ID
   *
   * @param patternId - Pattern ID
   * @returns Pattern or undefined
   */
  getPattern(patternId: string): ErrorPattern | undefined {
    return this.patterns.get(patternId);
  }

  /**
   * Get all patterns
   *
   * @returns Map of pattern IDs to patterns
   */
  getAllPatterns(): Map<string, ErrorPattern> {
    return new Map(this.patterns);
  }

  /**
   * Add pattern
   *
   * @param pattern - Pattern to add
   */
  addPattern(pattern: ErrorPattern): void {
    this.patterns.set(pattern.id, pattern);
    this.logger.debug(`Added pattern: ${pattern.id}`, 'ErrorPatternMatching');
  }

  /**
   * Remove pattern
   *
   * @param patternId - Pattern ID
   * @returns Success
   */
  removePattern(patternId: string): boolean {
    const removed = this.patterns.delete(patternId);
    if (removed) {
      this.logger.debug(`Removed pattern: ${patternId}`, 'ErrorPatternMatching');
    }
    return removed;
  }

  /**
   * Load pattern database
   *
   * @param database - Pattern database entries
   */
  loadDatabase(database: PatternDatabaseEntry[]): void {
    for (const entry of database) {
      const pattern: ErrorPattern = {
        id: entry.id,
        name: entry.name,
        pattern: new RegExp(entry.pattern, 'gi'),
        category: entry.category,
        severity: entry.severity,
        suggestedFixes: entry.suggestedFixes,
        confidence: 0.8,
        metadata: entry.metadata || {},
      };

      this.patterns.set(entry.id, pattern);
    }

    this.logger.info(
      `Loaded ${database.length} patterns from database`,
      'ErrorPatternMatching'
    );
  }

  /**
   * Get pattern database
   *
   * @returns Pattern database entries
   */
  getDatabase(): PatternDatabaseEntry[] {
    return [...this.database];
  }

  /**
   * Export pattern database
   *
   * @returns Pattern database entries
   */
  exportDatabase(): PatternDatabaseEntry[] {
    const entries: PatternDatabaseEntry[] = [];

    for (const pattern of this.patterns.values()) {
      entries.push({
        id: pattern.id,
        name: pattern.name,
        pattern: pattern.pattern.source,
        category: pattern.category,
        severity: pattern.severity,
        suggestedFixes: pattern.suggestedFixes,
        metadata: pattern.metadata,
      });
    }

    return entries;
  }

  /**
   * Search patterns by category
   *
   * @param category - Error category
   * @returns Array of patterns
   */
  searchByCategory(category: ErrorCategory): ErrorPattern[] {
    return Array.from(this.patterns.values()).filter(
      (p) => p.category === category
    );
  }

  /**
   * Search patterns by severity
   *
   * @param severity - Error severity
   * @returns Array of patterns
   */
  searchBySeverity(severity: ErrorSeverity): ErrorPattern[] {
    return Array.from(this.patterns.values()).filter(
      (p) => p.severity === severity
    );
  }

  /**
   * Search patterns by name
   *
   * @param name - Pattern name (partial match)
   * @returns Array of patterns
   */
  searchByName(name: string): ErrorPattern[] {
    const lowerName = name.toLowerCase();
    return Array.from(this.patterns.values()).filter((p) =>
      p.name.toLowerCase().includes(lowerName)
    );
  }

  /**
   * Get pattern statistics
   *
   * @returns Pattern statistics
   */
  getStatistics(): {
    totalPatterns: number;
    patternsByCategory: Record<ErrorCategory, number>;
    patternsBySeverity: Record<ErrorSeverity, number>;
  } {
    const patternsByCategory: Record<ErrorCategory, number> = {
      [ErrorCategory.SYNTAX]: 0,
      [ErrorCategory.TYPE]: 0,
      [ErrorCategory.REFERENCE]: 0,
      [ErrorCategory.MODULE]: 0,
      [ErrorCategory.RUNTIME]: 0,
      [ErrorCategory.COMPILATION]: 0,
      [ErrorCategory.LINT]: 0,
      [ErrorCategory.TEST]: 0,
      [ErrorCategory.UNKNOWN]: 0,
    };

    const patternsBySeverity: Record<ErrorSeverity, number> = {
      [ErrorSeverity.CRITICAL]: 0,
      [ErrorSeverity.HIGH]: 0,
      [ErrorSeverity.MEDIUM]: 0,
      [ErrorSeverity.LOW]: 0,
      [ErrorSeverity.INFO]: 0,
    };

    for (const pattern of this.patterns.values()) {
      patternsByCategory[pattern.category]++;
      patternsBySeverity[pattern.severity]++;
    }

    return {
      totalPatterns: this.patterns.size,
      patternsByCategory,
      patternsBySeverity,
    };
  }

  /**
   * Clear all patterns
   */
  clearPatterns(): void {
    this.patterns.clear();
    this.initializeDefaultPatterns();
    this.logger.debug('Patterns cleared and reinitialized', 'ErrorPatternMatching');
  }

  /**
   * Check if pattern matches filters
   *
   * @param pattern - Pattern to check
   * @param options - Matching options
   * @returns True if matches filters
   */
  private matchesFilters(
    pattern: ErrorPattern,
    options: PatternMatchingOptions
  ): boolean {
    // Category filters
    if (options.includeCategories) {
      if (!options.includeCategories.includes(pattern.category)) {
        return false;
      }
    }

    if (options.excludeCategories) {
      if (options.excludeCategories.includes(pattern.category)) {
        return false;
      }
    }

    // Severity filters
    if (options.includeSeverities) {
      if (!options.includeSeverities.includes(pattern.severity)) {
        return false;
      }
    }

    if (options.excludeSeverities) {
      if (options.excludeSeverities.includes(pattern.severity)) {
        return false;
      }
    }

    // Confidence filter
    if (options.minConfidence) {
      if (pattern.confidence < options.minConfidence) {
        return false;
      }
    }

    return true;
  }

  /**
   * Initialize default error patterns
   */
  private initializeDefaultPatterns(): void {
    const defaultPatterns: PatternDatabaseEntry[] = [
      // Syntax errors
      {
        id: 'syntax_missing_semicolon',
        name: 'Missing Semicolon',
        pattern: 'Missing semicolon|Expected ";"|(\\s*\\)\\s*[\\w])',
        category: ErrorCategory.SYNTAX,
        severity: ErrorSeverity.HIGH,
        suggestedFixes: [
          'Add semicolon at the end of the statement',
          'Check for missing semicolons in the code',
        ],
        language: 'typescript',
      },
      {
        id: 'syntax_missing_bracket',
        name: 'Missing Bracket',
        pattern: 'Missing (?:closing)?bracket|Expected "}"|\\s+$|\\{\\s+$',
        category: ErrorCategory.SYNTAX,
        severity: ErrorSeverity.HIGH,
        suggestedFixes: [
          'Add missing closing bracket',
          'Check bracket matching',
        ],
        language: 'typescript',
      },
      {
        id: 'syntax_unexpected_token',
        name: 'Unexpected Token',
        pattern: 'Unexpected token|Unexpected identifier',
        category: ErrorCategory.SYNTAX,
        severity: ErrorSeverity.MEDIUM,
        suggestedFixes: [
          'Check for typos in the code',
          'Verify correct syntax',
        ],
        language: 'typescript',
      },

      // Type errors
      {
        id: 'type_undefined',
        name: 'Undefined Type',
        pattern: 'is not defined|Cannot find name|"(\\w+)" is not defined',
        category: ErrorCategory.TYPE,
        severity: ErrorSeverity.HIGH,
        suggestedFixes: [
          'Define the variable or import it',
          'Check for typos in the variable name',
        ],
        language: 'typescript',
      },
      {
        id: 'type_assignment',
        name: 'Type Assignment Error',
        pattern: 'Type "(\\w+)" is not assignable to type "(\\w+)"',
        category: ErrorCategory.TYPE,
        severity: ErrorSeverity.MEDIUM,
        suggestedFixes: [
          'Add type annotation',
          'Use type assertion',
          'Check variable types',
        ],
        language: 'typescript',
      },

      // Reference errors
      {
        id: 'reference_undefined',
        name: 'Undefined Reference',
        pattern: 'ReferenceError: (\\w+) is not defined|Cannot read property "(\\w+)" of undefined|Cannot find name "(\\w+)"|"(\\w+)" is not defined',
        category: ErrorCategory.REFERENCE,
        severity: ErrorSeverity.CRITICAL,
        suggestedFixes: [
          'Define the variable before use',
          'Check for typos in variable name',
          'Initialize the variable',
        ],
        language: 'typescript',
      },
      {
        id: 'reference_null',
        name: 'Null Reference',
        pattern: 'Cannot read property "(\\w+)" of (null|undefined)',
        category: ErrorCategory.REFERENCE,
        severity: ErrorSeverity.HIGH,
        suggestedFixes: [
          'Add null check',
          'Use optional chaining (?.)',
          'Provide default value',
        ],
        language: 'typescript',
      },

      // Module errors
      {
        id: 'module_not_found',
        name: 'Module Not Found',
        pattern: 'Cannot find module|Module not found|Cannot resolve module',
        category: ErrorCategory.MODULE,
        severity: ErrorSeverity.HIGH,
        suggestedFixes: [
          'Install the missing dependency',
          'Check import path',
          'Verify module name',
        ],
        language: 'typescript',
      },
      {
        id: 'module_export_not_found',
        name: 'Export Not Found',
        pattern: 'has no exported member|does not have an exported member',
        category: ErrorCategory.MODULE,
        severity: ErrorSeverity.MEDIUM,
        suggestedFixes: [
          'Check export name',
          'Verify module exports',
          'Use correct import syntax',
        ],
        language: 'typescript',
      },

      // Runtime errors
      {
        id: 'runtime_promise_rejection',
        name: 'Unhandled Promise Rejection',
        pattern: 'UnhandledPromiseRejectionWarning',
        category: ErrorCategory.RUNTIME,
        severity: ErrorSeverity.MEDIUM,
        suggestedFixes: [
          'Add .catch() handler',
          'Use try-catch with async/await',
        ],
        language: 'typescript',
      },
      {
        id: 'runtime_timeout',
        name: 'Timeout Error',
        pattern: 'Timeout|timed out',
        category: ErrorCategory.RUNTIME,
        severity: ErrorSeverity.LOW,
        suggestedFixes: [
          'Increase timeout value',
          'Optimize code execution',
        ],
        language: 'typescript',
      },

      // Compilation errors
      {
        id: 'compilation_duplicate_identifier',
        name: 'Duplicate Identifier',
        pattern: 'Duplicate identifier|"(\\w+)" is already declared',
        category: ErrorCategory.COMPILATION,
        severity: ErrorSeverity.MEDIUM,
        suggestedFixes: [
          'Rename one of the identifiers',
          'Use different variable names',
        ],
        language: 'typescript',
      },
    ];

    this.loadDatabase(defaultPatterns);
  }
}

/**
 * Schema for pattern matching options
 */
export const PatternMatchingOptionsSchema = z.object({
  includeCategories: z.array(z.nativeEnum(ErrorCategory)).optional(),
  excludeCategories: z.array(z.nativeEnum(ErrorCategory)).optional(),
  includeSeverities: z.array(z.nativeEnum(ErrorSeverity)).optional(),
  excludeSeverities: z.array(z.nativeEnum(ErrorSeverity)).optional(),
  language: z.string().optional(),
  minConfidence: z.number().min(0).max(1).optional(),
  maxResults: z.number().min(1).optional(),
});

/**
 * Global error pattern matching instance
 */
let globalErrorPatternMatching: ErrorPatternMatching | null = null;

/**
 * Initialize global error pattern matching
 *
 * @param options - Options
 * @returns The global error pattern matching
 */
export function initErrorPatternMatching(options?: {
  logger?: Logger;
  database?: PatternDatabaseEntry[];
  cacheEnabled?: boolean;
}): ErrorPatternMatching {
  globalErrorPatternMatching = new ErrorPatternMatching(options);
  return globalErrorPatternMatching;
}

/**
 * Get global error pattern matching
 *
 * @returns The global error pattern matching
 */
export function getErrorPatternMatching(): ErrorPatternMatching {
  if (!globalErrorPatternMatching) {
    globalErrorPatternMatching = new ErrorPatternMatching();
  }
  return globalErrorPatternMatching;
}
