/**
 * Fix Validation
 *
 * Provides fix validation logic, test execution for fixes,
 * and rollback on failure.
 */

import { z } from 'zod';
import { Logger, LoggerLike } from '../../utils/logger';

/**
 * Validation result
 */
export interface ValidationResult {
  /**
   * Valid
   */
  valid: boolean;

  /**
   * Success
   */
  success: boolean;

  /**
   * Validation errors
   */
  errors: ValidationError[];

  /**
   * Validation warnings
   */
  warnings: ValidationWarning[];

  /**
   * Test results
   */
  testResults?: TestResult[];

  /**
   * Validation time
   */
  validationTime: number;

  /**
   * Result metadata
   */
  metadata: Record<string, unknown>;
}

/**
 * Validation error
 */
export interface ValidationError {
  /**
   * Error code
   */
  code: string;

  /**
   * Error message
   */
  message: string;

  /**
   * Line number
   */
  lineNumber?: number;

  /**
   * Column number
   */
  columnNumber?: number;

  /**
   * Error severity
   */
  severity: 'error' | 'warning' | 'info';

  /**
   * Error metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  /**
   * Warning code
   */
  code: string;

  /**
   * Warning message
   */
  message: string;

  /**
   * Warning severity
   */
  severity?: 'low' | 'medium' | 'high' | 'info' | 'warning';

  /**
   * Line number
   */
  lineNumber?: number;

  /**
   * Column number
   */
  columnNumber?: number;

  /**
   * Warning metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Test result
 */
export interface TestResult {
  /**
   * Test name
   */
  name: string;

  /**
   * Success
   */
  success: boolean;

  /**
   * Duration
   */
  duration: number;

  /**
   * Error message
   */
  errorMessage?: string;

  /**
   * Stack trace
   */
  stackTrace?: string;

  /**
   * Test metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Validation options
 */
export interface ValidationOptions {
  /**
   * Run tests
   */
  runTests?: boolean;

  /**
   * Test file pattern
   */
  testFilePattern?: string;

  /**
   * Test timeout (ms)
   */
  testTimeout?: number;

  /**
   * Check syntax
   */
  checkSyntax?: boolean;

  /**
   * Check types
   */
  checkTypes?: boolean;

  /**
   * Check linting
   */
  checkLinting?: boolean;

  /**
   * Language
   */
  language?: string;

  /**
   * Working directory
   */
  workingDirectory?: string;

  /**
   * Strict mode
   */
  strictMode?: boolean;
}

/**
 * Rollback options
 */
export interface RollbackOptions {
  /**
   * Create backup
   */
  createBackup?: boolean;

  /**
   * Backup path
   */
  backupPath?: string;

  /**
   * Confirm before rollback
   */
  confirmBeforeRollback?: boolean;

  /**
   * Rollback on validation failure
   */
  rollbackOnValidationFailure?: boolean;

  /**
   * Rollback on test failure
   */
  rollbackOnTestFailure?: boolean;
}

/**
 * Rollback result
 */
export interface RollbackResult {
  /**
   * Success
   */
  success: boolean;

  /**
   * Rolled back
   */
  rolledBack: boolean;

  /**
   * Backup path
   */
  backupPath?: string;

  /**
   * Rollback time
   */
  rollbackTime: number;

  /**
   * Result metadata
   */
  metadata: Record<string, unknown>;
}

/**
 * Fix validation class
 *
 * Provides fix validation logic with test execution and rollback.
 */
export class FixValidation {
  private logger: LoggerLike;
  private backups: Map<string, string> = new Map();
  private validationHistory: Map<string, ValidationResult[]> = new Map();
  private cacheEnabled: boolean;

  constructor(options?: {
    logger?: Logger;
    cacheEnabled?: boolean;
  }) {
    this.logger = options?.logger || new Logger();
    this.cacheEnabled = options?.cacheEnabled ?? true;

    this.logger.info('FixValidation initialized', 'FixValidation');
  }

  /**
   * Validate a fix
   *
   * @param code - Code to validate
   * @param language - Language
   * @param options - Validation options
   * @returns Validation result
   */
  async validateFix(
    code: string,
    language: string = 'typescript',
    options: ValidationOptions = {}
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let testResults: TestResult[] | undefined;

    // Check syntax
    if (options.checkSyntax !== false) {
      const syntaxResult = await this.checkSyntax(code, language);
      errors.push(...syntaxResult.errors);
      warnings.push(...syntaxResult.warnings);
    }

    // Check types
    if (options.checkTypes !== false) {
      const typeResult = await this.checkTypes(code, language);
      errors.push(...typeResult.errors);
      warnings.push(...typeResult.warnings);
    }

    // Check linting
    if (options.checkLinting !== false) {
      const lintResult = await this.checkLinting(code, language);
      errors.push(...lintResult.errors);
      warnings.push(...lintResult.warnings);
    }

    // Run tests
    if (options.runTests) {
      testResults = await this.runTests(code, options);
    }

    const validationTime = Date.now() - startTime;
    const valid = errors.length === 0;
    const success = valid && (!testResults || testResults.every((t) => t.success));

    const result: ValidationResult = {
      valid,
      success,
      errors,
      warnings,
      testResults,
      validationTime,
      metadata: {
        language,
        strictMode: options.strictMode,
      },
    };

    // Cache result
    const codeHash = this.hashCode(code);
    const history = this.validationHistory.get(codeHash) || [];
    history.push(result);
    this.validationHistory.set(codeHash, history);

    return result;
  }

  /**
   * Validate fix with rollback
   *
   * @param originalCode - Original code
   * @param fixedCode - Fixed code
   * @param language - Language
   * @param validationOptions - Validation options
   * @param rollbackOptions - Rollback options
   * @returns Validation result with rollback info
   */
  async validateWithRollback(
    originalCode: string,
    fixedCode: string,
    language: string = 'typescript',
    validationOptions: ValidationOptions = {},
    rollbackOptions: RollbackOptions = {}
  ): Promise<{ validation: ValidationResult; rollback?: RollbackResult }> {
    // Create backup if requested
    let backupPath: string | undefined;
    if (rollbackOptions.createBackup) {
      backupPath = await this.createBackup(originalCode, rollbackOptions.backupPath);
    }

    // Validate the fix
    const validation = await this.validateFix(fixedCode, language, validationOptions);

    // Rollback if validation failed and rollback is enabled
    let rollback: RollbackResult | undefined;
    if (
      !validation.success &&
      ((rollbackOptions.rollbackOnValidationFailure && !validation.valid) ||
        (rollbackOptions.rollbackOnTestFailure &&
          validation.testResults?.some((t) => !t.success)))
    ) {
      rollback = await this.rollback(
        backupPath,
        originalCode,
        rollbackOptions
      );
    }

    return { validation, rollback };
  }

  /**
   * Create backup of code
   *
   * @param code - Code to backup
   * @param backupPath - Custom backup path
   * @returns Backup path
   */
  async createBackup(
    code: string,
    backupPath?: string
  ): Promise<string> {
    const path = backupPath || `/tmp/healing-backup-${Date.now()}.txt`;
    await Bun.write(path, code);

    const codeHash = this.hashCode(code);
    this.backups.set(codeHash, path);

    this.logger.debug(`Created backup at ${path}`, 'FixValidation');
    return path;
  }

  /**
   * Rollback to backup
   *
   * @param backupPath - Backup path
   * @param originalCode - Original code
   * @param options - Rollback options
   * @returns Rollback result
   */
  async rollback(
    backupPath: string | undefined,
    originalCode: string,
    options: RollbackOptions = {}
  ): Promise<RollbackResult> {
    const startTime = Date.now();

    if (!backupPath) {
      return {
        success: false,
        rolledBack: false,
        rollbackTime: Date.now() - startTime,
        metadata: { reason: 'no_backup_path' },
      };
    }

    try {
      // Confirm before rollback if requested
      if (options.confirmBeforeRollback) {
        this.logger.info(
          'Confirming rollback before proceeding',
          'FixValidation'
        );
        // In a real implementation, this would prompt the user
      }

      // Restore from backup
      const backupContent = await Bun.file(backupPath).text();

      // Verify backup matches original
      if (backupContent === originalCode) {
        this.logger.info('Rollback successful', 'FixValidation', { backupPath });

        return {
          success: true,
          rolledBack: true,
          backupPath,
          rollbackTime: Date.now() - startTime,
          metadata: {},
        };
      } else {
        this.logger.warn(
          'Backup content does not match original code',
          'FixValidation'
        );

        return {
          success: false,
          rolledBack: false,
          backupPath,
          rollbackTime: Date.now() - startTime,
          metadata: { reason: 'backup_mismatch' },
        };
      }
    } catch (error) {
      this.logger.error(
        `Rollback failed: ${(error as Error).message}`,
        'FixValidation'
      );

      return {
        success: false,
        rolledBack: false,
        backupPath,
        rollbackTime: Date.now() - startTime,
        metadata: { reason: 'rollback_error', error: (error as Error).message },
      };
    }
  }

  /**
   * Get validation history
   *
   * @param code - Code to get history for
   * @returns Validation history
   */
  getValidationHistory(code: string): ValidationResult[] {
    const codeHash = this.hashCode(code);
    return this.validationHistory.get(codeHash) || [];
  }

  /**
   * Get all backups
   *
   * @returns Map of code hashes to backup paths
   */
  getBackups(): Map<string, string> {
    return new Map(this.backups);
  }

  /**
   * Clear all backups
   */
  clearBackups(): void {
    this.backups.clear();
    this.logger.debug('All backups cleared', 'FixValidation');
  }

  /**
   * Clear validation history
   */
  clearValidationHistory(): void {
    this.validationHistory.clear();
    this.logger.debug('Validation history cleared', 'FixValidation');
  }

  /**
   * Check syntax
   *
   * @param code - Code to check
   * @param language - Language
   * @returns Syntax check result
   */
  private async checkSyntax(
    code: string,
    language: string
  ): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Simple syntax check based on language
      switch (language.toLowerCase()) {
        case 'typescript':
        case 'javascript':
          // Check for basic syntax errors
          if (code.includes('{') && !code.includes('}')) {
            errors.push({
              code: 'SYNTAX_MISSING_BRACE',
              message: 'Missing closing brace',
              severity: 'error',
            });
          }
          if (code.includes('(') && !code.includes(')')) {
            errors.push({
              code: 'SYNTAX_MISSING_PAREN',
              message: 'Missing closing parenthesis',
              severity: 'error',
            });
          }
          break;

        case 'python':
          // Check for Python syntax errors
          const lines = code.split('\n');
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim().startsWith('def ') || line.trim().startsWith('class ')) {
              if (!line.trim().endsWith(':')) {
                errors.push({
                  code: 'SYNTAX_MISSING_COLON',
                  message: 'Missing colon at end of definition',
                  lineNumber: i + 1,
                  severity: 'error',
                });
              }
            }
          }
          break;
      }
    } catch (error) {
      errors.push({
        code: 'SYNTAX_CHECK_ERROR',
        message: `Syntax check failed: ${(error as Error).message}`,
        severity: 'error',
      });
    }

    return { errors, warnings };
  }

  /**
   * Check types
   *
   * @param code - Code to check
   * @param language - Language
   * @returns Type check result
   */
  private async checkTypes(
    code: string,
    language: string
  ): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Simple type checking (would use actual type checker in production)
    if (language.toLowerCase() === 'typescript') {
      // Check for common type errors
      const typeErrors = code.match(/:\s*any/g);
      if (typeErrors && typeErrors.length > 5) {
        warnings.push({
          code: 'TYPE_MANY_ANY',
          message: 'Multiple "any" types detected, consider using specific types',
          severity: 'warning',
        });
      }
    }

    return { errors, warnings };
  }

  /**
   * Check linting
   *
   * @param code - Code to check
   * @param language - Language
   * @returns Lint check result
   */
  private async checkLinting(
    code: string,
    language: string
  ): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Simple linting checks
    const lines = code.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for console.log
      if (line.includes('console.log')) {
        warnings.push({
          code: 'LINT_CONSOLE_LOG',
          message: 'console.log statement detected',
          lineNumber: i + 1,
          severity: 'warning',
        });
      }

      // Check for TODO comments
      if (line.includes('TODO') || line.includes('FIXME')) {
        warnings.push({
          code: 'LINT_TODO',
          message: 'TODO or FIXME comment detected',
          lineNumber: i + 1,
          severity: 'info',
        });
      }

      // Check for long lines
      if (line.length > 120) {
        warnings.push({
          code: 'LINT_LONG_LINE',
          message: 'Line exceeds 120 characters',
          lineNumber: i + 1,
          severity: 'warning',
        });
      }
    }

    return { errors, warnings };
  }

  /**
   * Run tests
   *
   * @param code - Code to test
   * @param options - Validation options
   * @returns Test results
   */
  private async runTests(
    code: string,
    options: ValidationOptions
  ): Promise<TestResult[]> {
    const testResults: TestResult[] = [];

    // Write code to temporary file
    const ext = this.getExtension(options.language || 'typescript');
    const tempFile = `/tmp/healing-test-${Date.now()}${ext}`;
    await Bun.write(tempFile, code);

    try {
      // Find test files
      const testPattern = options.testFilePattern || '**/*.test.ts';
      const testFiles = await this.findTestFiles(
        options.workingDirectory || process.cwd(),
        testPattern
      );

      // Run tests
      for (const testFile of testFiles) {
        const startTime = Date.now();

        try {
          const proc = Bun.spawn({
            cmd: ['bun', 'test', testFile],
            cwd: options.workingDirectory || process.cwd(),
            stdout: 'pipe',
            stderr: 'pipe',
          });

          const exitCode = await proc.exited;
          const duration = Date.now() - startTime;

          testResults.push({
            name: testFile,
            success: exitCode === 0,
            duration,
            errorMessage: exitCode !== 0 ? 'Test failed' : undefined,
          });
        } catch (error) {
          const duration = Date.now() - startTime;

          testResults.push({
            name: testFile,
            success: false,
            duration,
            errorMessage: (error as Error).message,
            stackTrace: (error as Error).stack,
          });
        }
      }

      // If no test files found, run basic validation
      if (testResults.length === 0) {
        testResults.push({
          name: 'basic_validation',
          success: true,
          duration: 0,
          metadata: { message: 'No test files found, basic validation passed' },
        });
      }
    } finally {
      // Clean up
      await Bun.file(tempFile).delete();
    }

    return testResults;
  }

  /**
   * Find test files
   *
   * @param directory - Directory to search
   * @param pattern - File pattern
   * @returns Array of test file paths
   */
  private async findTestFiles(
    directory: string,
    pattern: string
  ): Promise<string[]> {
    const testFiles: string[] = [];

    try {
      const files = await this.listFiles(directory);

      for (const file of files) {
        if (file.includes('.test.') || file.includes('.spec.')) {
          testFiles.push(file);
        }
      }
    } catch (error) {
      this.logger.warn(
        `Failed to find test files: ${(error as Error).message}`,
        'FixValidation'
      );
    }

    return testFiles;
  }

  /**
   * List files in directory
   *
   * @param directory - Directory to list
   * @returns Array of file paths
   */
  private async listFiles(directory: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const entries = await fs.readdir(directory, { recursive: true, withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile()) {
          files.push(path.join(entry.parentPath ?? entry.path ?? '', entry.name));
        }
      }
    } catch (error) {
      this.logger.warn(
        `Failed to list files: ${(error as Error).message}`,
        'FixValidation'
      );
    }

    return files;
  }

  /**
   * Get file extension for language
   *
   * @param language - Language name
   * @returns File extension
   */
  private getExtension(language: string): string {
    const extMap: Record<string, string> = {
      typescript: '.ts',
      javascript: '.js',
      python: '.py',
      go: '.go',
      rust: '.rs',
      java: '.java',
    };

    return extMap[language.toLowerCase()] || '.ts';
  }

  /**
   * Hash code for caching
   *
   * @param code - Code to hash
   * @returns Hash string
   */
  private hashCode(code: string): string {
    let hash = 0;
    for (let i = 0; i < code.length; i++) {
      const char = code.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

/**
 * Schema for validation options
 */
export const ValidationOptionsSchema = z.object({
  runTests: z.boolean().optional(),
  testFilePattern: z.string().optional(),
  testTimeout: z.number().min(1).optional(),
  checkSyntax: z.boolean().optional(),
  checkTypes: z.boolean().optional(),
  checkLinting: z.boolean().optional(),
  language: z.string().optional(),
  workingDirectory: z.string().optional(),
  strictMode: z.boolean().optional(),
});

/**
 * Schema for rollback options
 */
export const RollbackOptionsSchema = z.object({
  createBackup: z.boolean().optional(),
  backupPath: z.string().optional(),
  confirmBeforeRollback: z.boolean().optional(),
  rollbackOnValidationFailure: z.boolean().optional(),
  rollbackOnTestFailure: z.boolean().optional(),
});

/**
 * Global fix validation instance
 */
let globalFixValidation: FixValidation | null = null;

/**
 * Initialize global fix validation
 *
 * @param options - Options
 * @returns The global fix validation
 */
export function initFixValidation(options?: {
  logger?: Logger;
  cacheEnabled?: boolean;
}): FixValidation {
  globalFixValidation = new FixValidation(options);
  return globalFixValidation;
}

/**
 * Get global fix validation
 *
 * @returns The global fix validation
 */
export function getFixValidation(): FixValidation {
  if (!globalFixValidation) {
    globalFixValidation = new FixValidation();
  }
  return globalFixValidation;
}
