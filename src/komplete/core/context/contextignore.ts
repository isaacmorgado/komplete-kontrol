/**
 * Context Ignore - .contextignore File Support
 *
 * Provides .contextignore file parsing and matching capabilities
 * to exclude files/directories from context gathering.
 */

import { Logger, LoggerLike } from '../../utils/logger';
import { glob } from 'glob';

/**
 * Context ignore pattern
 */
export interface ContextIgnorePattern {
  /** Original pattern */
  pattern: string;
  /** Is negation (starts with !) */
  isNegation: boolean;
  /** Is directory pattern */
  isDirectory: boolean;
  /** Regex for matching */
  regex: RegExp;
}

/**
 * Context ignore options
 */
export interface ContextIgnoreOptions {
  /** Working directory */
  cwd?: string;
  /** Include default patterns */
  includeDefaults?: boolean;
  /** Custom default patterns */
  customDefaults?: string[];
}

/**
 * Default ignore patterns (similar to .gitignore)
 */
const DEFAULT_PATTERNS = [
  'node_modules/',
  '.git/',
  '.hg/',
  '.svn/',
  '.DS_Store',
  'Thumbs.db',
  '*.log',
  '*.tmp',
  '.env',
  '.env.*',
  'dist/',
  'build/',
  'coverage/',
  '.next/',
  '.nuxt/',
  '.cache/',
  'out/',
  '.turbo/',
  '.vercel/',
  '.netlify/',
  '__pycache__/',
  '*.pyc',
  'venv/',
  '.venv/',
  '.idea/',
  '.vscode/',
  '*.swp',
  '*.swo',
  '*~',
];

/**
 * Context Ignore Manager
 *
 * Manages .contextignore file parsing and file matching.
 */
export class ContextIgnore {
  private logger: LoggerLike;
  private patterns: ContextIgnorePattern[] = [];
  private options: Required<ContextIgnoreOptions>;

  constructor(options: ContextIgnoreOptions = {}) {
    this.logger = new Logger().child('ContextIgnore');
    this.options = {
      cwd: options.cwd ?? process.cwd(),
      includeDefaults: options.includeDefaults ?? true,
      customDefaults: options.customDefaults ?? [],
    };

    // Add default patterns
    if (this.options.includeDefaults) {
      this.addPatterns(DEFAULT_PATTERNS);
    }

    // Add custom defaults
    if (this.options.customDefaults.length > 0) {
      this.addPatterns(this.options.customDefaults);
    }

    this.logger.debug('ContextIgnore initialized', {
      cwd: this.options.cwd,
      patternCount: this.patterns.length,
    });
  }

  /**
   * Load patterns from .contextignore file
   *
   * @param filePath - Path to .contextignore file
   * @returns Success
   */
  async loadFromFile(filePath: string): Promise<boolean> {
    try {
      const file = Bun.file(filePath);
      const exists = await file.exists();

      if (!exists) {
        this.logger.debug('.contextignore file not found', { filePath });
        return false;
      }

      const content = await file.text();
      const lines = content.split('\n');

      const patterns = lines
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith('#'));

      this.addPatterns(patterns);

      this.logger.info('.contextignore file loaded', {
        filePath,
        patternCount: patterns.length,
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to load .contextignore file', {
        filePath,
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Add patterns
   *
   * @param patterns - Array of patterns to add
   */
  addPatterns(patterns: string[]): void {
    for (const pattern of patterns) {
      const parsed = this.parsePattern(pattern);
      if (parsed) {
        this.patterns.push(parsed);
      }
    }

    this.logger.debug('Patterns added', { count: patterns.length });
  }

  /**
   * Add single pattern
   *
   * @param pattern - Pattern to add
   */
  addPattern(pattern: string): void {
    const parsed = this.parsePattern(pattern);
    if (parsed) {
      this.patterns.push(parsed);
    }
  }

  /**
   * Check if file should be ignored
   *
   * @param filePath - File path to check (relative to cwd)
   * @returns True if file should be ignored
   */
  shouldIgnore(filePath: string): boolean {
    // Normalize path
    const normalized = this.normalizePath(filePath);

    let ignored = false;

    // Check all patterns
    for (const pattern of this.patterns) {
      const matches = pattern.regex.test(normalized);

      if (matches) {
        if (pattern.isNegation) {
          // Negation pattern: un-ignore the file
          ignored = false;
        } else {
          // Normal pattern: ignore the file
          ignored = true;
        }
      }
    }

    return ignored;
  }

  /**
   * Filter file list
   *
   * @param files - Array of file paths
   * @returns Filtered array (non-ignored files)
   */
  filter(files: string[]): string[] {
    return files.filter((file) => !this.shouldIgnore(file));
  }

  /**
   * Get all matching files (glob)
   *
   * @param pattern - Glob pattern
   * @param options - Glob options
   * @returns Array of matching non-ignored files
   */
  async glob(pattern: string, options: any = {}): Promise<string[]> {
    const files = await glob(pattern, {
      ...options,
      cwd: this.options.cwd,
      ignore: this.patterns.filter((p) => !p.isNegation).map((p) => p.pattern),
    });

    return files;
  }

  /**
   * Get all patterns
   *
   * @returns Array of patterns
   */
  getPatterns(): ContextIgnorePattern[] {
    return [...this.patterns];
  }

  /**
   * Clear all patterns
   */
  clearPatterns(): void {
    this.patterns = [];
    this.logger.debug('All patterns cleared');
  }

  /**
   * Parse pattern
   *
   * @param pattern - Pattern string
   * @returns Parsed pattern or null if invalid
   */
  private parsePattern(pattern: string): ContextIgnorePattern | null {
    // Skip empty patterns
    if (!pattern || pattern.trim().length === 0) {
      return null;
    }

    // Check for negation
    const isNegation = pattern.startsWith('!');
    const cleanPattern = isNegation ? pattern.slice(1) : pattern;

    // Check if directory pattern
    const isDirectory = cleanPattern.endsWith('/');

    // Convert to regex
    const regex = this.patternToRegex(cleanPattern);

    return {
      pattern: cleanPattern,
      isNegation,
      isDirectory,
      regex,
    };
  }

  /**
   * Convert gitignore-style pattern to regex
   *
   * @param pattern - Pattern string
   * @returns Regex
   */
  private patternToRegex(pattern: string): RegExp {
    // Escape special regex characters except *, ?, [, ]
    let regexPattern = pattern
      .replace(/[.+^${}()|\\]/g, '\\$&')
      .replace(/\*\*/g, '<DOUBLESTAR>')
      .replace(/\*/g, '[^/]*')
      .replace(/<DOUBLESTAR>/g, '.*')
      .replace(/\?/g, '[^/]');

    // Handle directory pattern
    if (pattern.endsWith('/')) {
      regexPattern = regexPattern + '.*';
    }

    // Handle leading slash (absolute path)
    if (pattern.startsWith('/')) {
      regexPattern = '^' + regexPattern;
    } else {
      // Match anywhere in path
      regexPattern = '(^|/)' + regexPattern;
    }

    // Add end anchor if not directory pattern
    if (!pattern.endsWith('/') && !pattern.includes('*')) {
      regexPattern = regexPattern + '$';
    }

    return new RegExp(regexPattern);
  }

  /**
   * Normalize path
   *
   * @param filePath - File path
   * @returns Normalized path
   */
  private normalizePath(filePath: string): string {
    // Convert to forward slashes
    let normalized = filePath.replace(/\\/g, '/');

    // Remove leading ./
    if (normalized.startsWith('./')) {
      normalized = normalized.slice(2);
    }

    // Remove trailing slash (unless root)
    if (normalized.endsWith('/') && normalized.length > 1) {
      normalized = normalized.slice(0, -1);
    }

    return normalized;
  }
}

/**
 * Global context ignore instance
 */
let globalContextIgnore: ContextIgnore | null = null;

/**
 * Initialize global context ignore
 *
 * @param options - Options
 * @returns The global context ignore instance
 */
export function initContextIgnore(options?: ContextIgnoreOptions): ContextIgnore {
  globalContextIgnore = new ContextIgnore(options);
  return globalContextIgnore;
}

/**
 * Get global context ignore
 *
 * @returns The global context ignore instance
 */
export function getContextIgnore(): ContextIgnore {
  if (!globalContextIgnore) {
    globalContextIgnore = new ContextIgnore();
  }
  return globalContextIgnore;
}

/**
 * Load .contextignore from current directory
 *
 * @returns Success
 */
export async function loadContextIgnore(): Promise<boolean> {
  const contextIgnore = getContextIgnore();
  return await contextIgnore.loadFromFile('.contextignore');
}
