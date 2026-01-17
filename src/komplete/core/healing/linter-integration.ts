/**
 * Linter Integration
 *
 * Integrates linters and type checkers for automatic code validation
 * with support for ESLint, TypeScript, and other language linters.
 */

import { z } from 'zod';
import { Logger } from '../../utils/logger';
import { spawn } from 'bun';

/**
 * Linter type
 */
export enum LinterType {
  /**
   * ESLint (JavaScript/TypeScript)
   */
  ESLINT = 'eslint',

  /**
   * TypeScript compiler
   */
  TSC = 'tsc',

  /**
   * Biome (fast linter)
   */
  BIOME = 'biome',

  /**
   * Prettier (code formatter)
   */
  PRETTIER = 'prettier',

  /**
   * Python (ruff, flake8, mypy)
   */
  PYTHON = 'python',

  /**
   * Go (golint, gofmt)
   */
  GO = 'go',

  /**
   * Rust (clippy, rustfmt)
   */
  RUST = 'rust',
}

/**
 * Lint severity
 */
export enum LintSeverity {
  /**
   * Error - must be fixed
   */
  ERROR = 'error',

  /**
   * Warning - should be reviewed
   */
  WARNING = 'warning',

  /**
   * Info - informational
   */
  INFO = 'info',

  /**
   * Hint - suggestion
   */
  HINT = 'hint',
}

/**
 * Lint result
 */
export interface LintResult {
  /**
   * Success (no errors)
   */
  success: boolean;

  /**
   * Linter used
   */
  linter: LinterType;

  /**
   * File path
   */
  file: string;

  /**
   * Issues found
   */
  issues: LintIssue[];

  /**
   * Error count
   */
  errorCount: number;

  /**
   * Warning count
   */
  warningCount: number;

  /**
   * Execution time (ms)
   */
  executionTime: number;

  /**
   * Raw output
   */
  rawOutput: string;
}

/**
 * Lint issue
 */
export interface LintIssue {
  /**
   * Issue ID
   */
  id: string;

  /**
   * Rule ID
   */
  ruleId?: string;

  /**
   * Severity
   */
  severity: LintSeverity;

  /**
   * Message
   */
  message: string;

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
   * End line
   */
  endLine?: number;

  /**
   * End column
   */
  endColumn?: number;

  /**
   * Fix available
   */
  fixable?: boolean;

  /**
   * Suggested fix
   */
  fix?: string;

  /**
   * Source code
   */
  source?: string;
}

/**
 * Type check result
 */
export interface TypeCheckResult {
  /**
   * Success (no type errors)
   */
  success: boolean;

  /**
   * Type checker used
   */
  checker: string;

  /**
   * Errors found
   */
  errors: TypeCheckError[];

  /**
   * Error count
   */
  errorCount: number;

  /**
   * Execution time (ms)
   */
  executionTime: number;

  /**
   * Raw output
   */
  rawOutput: string;
}

/**
 * Type check error
 */
export interface TypeCheckError {
  /**
   * Error code
   */
  code: string;

  /**
   * Message
   */
  message: string;

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
  column: number;

  /**
   * Category
   */
  category: string;
}

/**
 * Linter integration options
 */
export interface LinterIntegrationOptions {
  /**
   * Enable auto-fix
   */
  autoFix?: boolean;

  /**
   * Linters to use
   */
  linters?: LinterType[];

  /**
   * Enable type checking
   */
  enableTypeCheck?: boolean;

  /**
   * Type checker
   */
  typeChecker?: 'tsc' | 'mypy' | 'go' | 'cargo';

  /**
   * Working directory
   */
  workingDirectory?: string;

  /**
   * Timeout (ms)
   */
  timeout?: number;

  /**
   * Fail on warnings
   */
  failOnWarnings?: boolean;

  /**
   * Custom config path
   */
  configPath?: string;

  /**
   * Ignore patterns
   */
  ignorePatterns?: string[];
}

/**
 * Auto-fix result
 */
export interface AutoFixResult {
  /**
   * Success
   */
  success: boolean;

  /**
   * Issues fixed
   */
  fixedCount: number;

  /**
   * Issues remaining
   */
  remainingCount: number;

  /**
   * Modified files
   */
  modifiedFiles: string[];

  /**
   * Details
   */
  details: string;
}

/**
 * Linter Integration class
 *
 * Integrates linters and type checkers for code validation.
 */
export class LinterIntegration {
  private logger: Logger;
  private options: Required<LinterIntegrationOptions>;

  constructor(options: LinterIntegrationOptions = {}) {
    this.logger = new Logger();

    this.options = {
      autoFix: options.autoFix ?? false,
      linters: options.linters || [LinterType.ESLINT],
      enableTypeCheck: options.enableTypeCheck ?? true,
      typeChecker: options.typeChecker || 'tsc',
      workingDirectory: options.workingDirectory || process.cwd(),
      timeout: options.timeout || 30000,
      failOnWarnings: options.failOnWarnings ?? false,
      configPath: options.configPath || '',
      ignorePatterns: options.ignorePatterns || [],
    };

    this.logger.info('LinterIntegration initialized', 'LinterIntegration');
  }

  /**
   * Lint file or directory
   *
   * @param path - File or directory path
   * @param linter - Linter to use (optional)
   * @returns Lint result
   */
  async lint(path: string, linter?: LinterType): Promise<LintResult> {
    const startTime = Date.now();
    const linterType = linter || this.options.linters[0]!;

    try {
      switch (linterType) {
        case LinterType.ESLINT:
          return await this.lintESLint(path, startTime);
        case LinterType.TSC:
          return await this.lintTypeScript(path, startTime);
        case LinterType.BIOME:
          return await this.lintBiome(path, startTime);
        case LinterType.PRETTIER:
          return await this.lintPrettier(path, startTime);
        default:
          throw new Error(`Unsupported linter: ${linterType}`);
      }
    } catch (error) {
      this.logger.error('Lint failed', 'LinterIntegration', {
        linter: linterType,
        error: (error as Error).message,
      });

      return {
        success: false,
        linter: linterType,
        file: path,
        issues: [],
        errorCount: 1,
        warningCount: 0,
        executionTime: Date.now() - startTime,
        rawOutput: (error as Error).message,
      };
    }
  }

  /**
   * Run type checker
   *
   * @param path - File or directory path
   * @returns Type check result
   */
  async typeCheck(path?: string): Promise<TypeCheckResult> {
    const startTime = Date.now();

    try {
      switch (this.options.typeChecker) {
        case 'tsc':
          return await this.typeCheckTypeScript(path, startTime);
        case 'mypy':
          return await this.typeCheckPython(path, startTime);
        default:
          throw new Error(`Unsupported type checker: ${this.options.typeChecker}`);
      }
    } catch (error) {
      this.logger.error('Type check failed', 'LinterIntegration', {
        checker: this.options.typeChecker,
        error: (error as Error).message,
      });

      return {
        success: false,
        checker: this.options.typeChecker,
        errors: [],
        errorCount: 1,
        executionTime: Date.now() - startTime,
        rawOutput: (error as Error).message,
      };
    }
  }

  /**
   * Auto-fix issues
   *
   * @param path - File or directory path
   * @param linter - Linter to use
   * @returns Auto-fix result
   */
  async autoFix(path: string, linter?: LinterType): Promise<AutoFixResult> {
    const linterType = linter || this.options.linters[0]!;

    try {
      // Get initial issues
      const beforeResult = await this.lint(path, linterType);
      const beforeCount = beforeResult.errorCount + beforeResult.warningCount;

      // Run auto-fix
      await this.runAutoFix(path, linterType);

      // Get remaining issues
      const afterResult = await this.lint(path, linterType);
      const afterCount = afterResult.errorCount + afterResult.warningCount;

      const fixedCount = Math.max(0, beforeCount - afterCount);

      return {
        success: afterCount === 0,
        fixedCount,
        remainingCount: afterCount,
        modifiedFiles: [path],
        details: `Fixed ${fixedCount} issues, ${afterCount} remaining`,
      };
    } catch (error) {
      this.logger.error('Auto-fix failed', 'LinterIntegration', {
        linter: linterType,
        error: (error as Error).message,
      });

      return {
        success: false,
        fixedCount: 0,
        remainingCount: 0,
        modifiedFiles: [],
        details: (error as Error).message,
      };
    }
  }

  /**
   * Lint with ESLint
   *
   * @param path - File or directory path
   * @param startTime - Start time
   * @returns Lint result
   */
  private async lintESLint(path: string, startTime: number): Promise<LintResult> {
    const args = ['eslint', '--format=json'];

    if (this.options.autoFix) {
      args.push('--fix');
    }

    if (this.options.configPath) {
      args.push('--config', this.options.configPath);
    }

    args.push(path);

    const result = await this.runCommand('bunx', args);

    const issues = this.parseESLintOutput(result.stdout);

    return {
      success: result.exitCode === 0,
      linter: LinterType.ESLINT,
      file: path,
      issues,
      errorCount: issues.filter((i) => i.severity === LintSeverity.ERROR).length,
      warningCount: issues.filter((i) => i.severity === LintSeverity.WARNING).length,
      executionTime: Date.now() - startTime,
      rawOutput: result.stdout,
    };
  }

  /**
   * Lint with TypeScript
   *
   * @param path - File or directory path
   * @param startTime - Start time
   * @returns Lint result
   */
  private async lintTypeScript(path: string, startTime: number): Promise<LintResult> {
    const args = ['tsc', '--noEmit'];

    if (path) {
      args.push(path);
    }

    const result = await this.runCommand('bunx', args);

    const issues = this.parseTypeScriptOutput(result.stdout + result.stderr);

    return {
      success: result.exitCode === 0,
      linter: LinterType.TSC,
      file: path,
      issues,
      errorCount: issues.filter((i) => i.severity === LintSeverity.ERROR).length,
      warningCount: issues.filter((i) => i.severity === LintSeverity.WARNING).length,
      executionTime: Date.now() - startTime,
      rawOutput: result.stdout + result.stderr,
    };
  }

  /**
   * Lint with Biome
   *
   * @param path - File or directory path
   * @param startTime - Start time
   * @returns Lint result
   */
  private async lintBiome(path: string, startTime: number): Promise<LintResult> {
    const args = ['biome', 'lint', '--json'];

    if (this.options.autoFix) {
      args.push('--apply');
    }

    args.push(path);

    const result = await this.runCommand('bunx', args);

    const issues = this.parseBiomeOutput(result.stdout);

    return {
      success: result.exitCode === 0,
      linter: LinterType.BIOME,
      file: path,
      issues,
      errorCount: issues.filter((i) => i.severity === LintSeverity.ERROR).length,
      warningCount: issues.filter((i) => i.severity === LintSeverity.WARNING).length,
      executionTime: Date.now() - startTime,
      rawOutput: result.stdout,
    };
  }

  /**
   * Lint with Prettier
   *
   * @param path - File or directory path
   * @param startTime - Start time
   * @returns Lint result
   */
  private async lintPrettier(path: string, startTime: number): Promise<LintResult> {
    const args = ['prettier', '--check'];

    if (this.options.autoFix) {
      args[1] = '--write';
    }

    args.push(path);

    const result = await this.runCommand('bunx', args);

    return {
      success: result.exitCode === 0,
      linter: LinterType.PRETTIER,
      file: path,
      issues: [],
      errorCount: result.exitCode === 0 ? 0 : 1,
      warningCount: 0,
      executionTime: Date.now() - startTime,
      rawOutput: result.stdout,
    };
  }

  /**
   * Type check TypeScript
   *
   * @param path - File or directory path
   * @param startTime - Start time
   * @returns Type check result
   */
  private async typeCheckTypeScript(
    path: string | undefined,
    startTime: number
  ): Promise<TypeCheckResult> {
    const args = ['tsc', '--noEmit'];

    if (path) {
      args.push(path);
    }

    const result = await this.runCommand('bunx', args);

    const errors = this.parseTypeScriptErrors(result.stdout + result.stderr);

    return {
      success: result.exitCode === 0,
      checker: 'tsc',
      errors,
      errorCount: errors.length,
      executionTime: Date.now() - startTime,
      rawOutput: result.stdout + result.stderr,
    };
  }

  /**
   * Type check Python
   *
   * @param path - File or directory path
   * @param startTime - Start time
   * @returns Type check result
   */
  private async typeCheckPython(
    path: string | undefined,
    startTime: number
  ): Promise<TypeCheckResult> {
    const args = ['mypy'];

    if (path) {
      args.push(path);
    } else {
      args.push('.');
    }

    const result = await this.runCommand('mypy', args);

    const errors = this.parseMypyErrors(result.stdout);

    return {
      success: result.exitCode === 0,
      checker: 'mypy',
      errors,
      errorCount: errors.length,
      executionTime: Date.now() - startTime,
      rawOutput: result.stdout,
    };
  }

  /**
   * Run auto-fix
   *
   * @param path - File or directory path
   * @param linter - Linter type
   */
  private async runAutoFix(path: string, linter: LinterType): Promise<void> {
    switch (linter) {
      case LinterType.ESLINT:
        await this.runCommand('bunx', ['eslint', '--fix', path]);
        break;
      case LinterType.BIOME:
        await this.runCommand('bunx', ['biome', 'lint', '--apply', path]);
        break;
      case LinterType.PRETTIER:
        await this.runCommand('bunx', ['prettier', '--write', path]);
        break;
      default:
        throw new Error(`Auto-fix not supported for ${linter}`);
    }
  }

  /**
   * Run command
   *
   * @param command - Command to run
   * @param args - Arguments
   * @returns Command result
   */
  private async runCommand(
    command: string,
    args: string[]
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    const proc = spawn({
      cmd: [command, ...args],
      cwd: this.options.workingDirectory,
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    return { exitCode, stdout, stderr };
  }

  /**
   * Parse ESLint output
   *
   * @param output - ESLint JSON output
   * @returns Lint issues
   */
  private parseESLintOutput(output: string): LintIssue[] {
    try {
      const results = JSON.parse(output);
      const issues: LintIssue[] = [];

      for (const result of results) {
        for (const message of result.messages || []) {
          issues.push({
            id: `eslint_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            ruleId: message.ruleId,
            severity: message.severity === 2 ? LintSeverity.ERROR : LintSeverity.WARNING,
            message: message.message,
            file: result.filePath,
            line: message.line,
            column: message.column,
            endLine: message.endLine,
            endColumn: message.endColumn,
            fixable: message.fix != null,
          });
        }
      }

      return issues;
    } catch {
      return [];
    }
  }

  /**
   * Parse TypeScript output
   *
   * @param output - TypeScript output
   * @returns Lint issues
   */
  private parseTypeScriptOutput(output: string): LintIssue[] {
    const issues: LintIssue[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      const match = line.match(/(.+)\((\d+),(\d+)\):\s*(error|warning)\s+TS(\d+):\s*(.+)/);

      if (match) {
        issues.push({
          id: `ts_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          ruleId: `TS${match[5]}`,
          severity: match[4] === 'error' ? LintSeverity.ERROR : LintSeverity.WARNING,
          message: match[6]!,
          file: match[1]!,
          line: parseInt(match[2]!, 10),
          column: parseInt(match[3]!, 10),
          fixable: false,
        });
      }
    }

    return issues;
  }

  /**
   * Parse Biome output
   *
   * @param output - Biome JSON output
   * @returns Lint issues
   */
  private parseBiomeOutput(output: string): LintIssue[] {
    try {
      const result = JSON.parse(output);
      const issues: LintIssue[] = [];

      for (const diagnostic of result.diagnostics || []) {
        issues.push({
          id: `biome_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          ruleId: diagnostic.category,
          severity: diagnostic.severity === 'error' ? LintSeverity.ERROR : LintSeverity.WARNING,
          message: diagnostic.message,
          file: diagnostic.location?.path || '',
          line: diagnostic.location?.span?.start?.line || 0,
          column: diagnostic.location?.span?.start?.column || 0,
          fixable: false,
        });
      }

      return issues;
    } catch {
      return [];
    }
  }

  /**
   * Parse TypeScript errors
   *
   * @param output - TypeScript output
   * @returns Type check errors
   */
  private parseTypeScriptErrors(output: string): TypeCheckError[] {
    const errors: TypeCheckError[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      const match = line.match(/(.+)\((\d+),(\d+)\):\s*error\s+TS(\d+):\s*(.+)/);

      if (match) {
        errors.push({
          code: `TS${match[4]}`,
          message: match[5]!,
          file: match[1]!,
          line: parseInt(match[2]!, 10),
          column: parseInt(match[3]!, 10),
          category: 'error',
        });
      }
    }

    return errors;
  }

  /**
   * Parse mypy errors
   *
   * @param output - Mypy output
   * @returns Type check errors
   */
  private parseMypyErrors(output: string): TypeCheckError[] {
    const errors: TypeCheckError[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      const match = line.match(/(.+):(\d+):\s*error:\s*(.+)/);

      if (match) {
        errors.push({
          code: 'MYPY',
          message: match[3]!,
          file: match[1]!,
          line: parseInt(match[2]!, 10),
          column: 0,
          category: 'error',
        });
      }
    }

    return errors;
  }
}

/**
 * Schema for linter integration options
 */
export const LinterIntegrationOptionsSchema = z.object({
  autoFix: z.boolean().optional(),
  linters: z.array(z.nativeEnum(LinterType)).optional(),
  enableTypeCheck: z.boolean().optional(),
  typeChecker: z.enum(['tsc', 'mypy', 'go', 'cargo']).optional(),
  workingDirectory: z.string().optional(),
  timeout: z.number().min(1000).optional(),
  failOnWarnings: z.boolean().optional(),
  configPath: z.string().optional(),
  ignorePatterns: z.array(z.string()).optional(),
});

/**
 * Global linter integration instance
 */
let globalLinterIntegration: LinterIntegration | null = null;

/**
 * Initialize global linter integration
 *
 * @param options - Options
 * @returns The global linter integration
 */
export function initLinterIntegration(
  options?: LinterIntegrationOptions
): LinterIntegration {
  globalLinterIntegration = new LinterIntegration(options);
  return globalLinterIntegration;
}

/**
 * Get global linter integration
 *
 * @returns The global linter integration
 */
export function getLinterIntegration(): LinterIntegration {
  if (!globalLinterIntegration) {
    globalLinterIntegration = new LinterIntegration();
  }
  return globalLinterIntegration;
}
