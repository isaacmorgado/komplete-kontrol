/**
 * Self-Healing Loop
 *
 * Provides Prompt → Code → Execute → Stderr Analysis → Fix → Retry loop
 * with loop state management and termination conditions.
 */

import { z } from 'zod';
import { Logger } from '../../utils/logger';
import { ErrorPatternMatching, getErrorPatternMatching } from './patterns';
import { AutoSuggestionSystem, getAutoSuggestionSystem } from './suggestions';
import { FixValidation, getFixValidation } from './validation';

/**
 * Loop stage
 */
export enum LoopStage {
  /**
   * Prompt stage
   */
  PROMPT = 'prompt',

  /**
   * Code generation stage
   */
  CODE = 'code',

  /**
   * Execution stage
   */
  EXECUTE = 'execute',

  /**
   * Stderr analysis stage
   */
  ANALYZE = 'analyze',

  /**
   * Fix generation stage
   */
  FIX = 'fix',

  /**
   * Retry stage
   */
  RETRY = 'retry',

  /**
   * Completed stage
   */
  COMPLETED = 'completed',

  /**
   * Failed stage
   */
  FAILED = 'failed',
}

/**
 * Loop state
 */
export interface LoopState {
  /**
   * Loop ID
   */
  id: string;

  /**
   * Current stage
   */
  stage: LoopStage;

  /**
   * Iteration count
   */
  iteration: number;

  /**
   * Max iterations
   */
  maxIterations: number;

  /**
   * Original prompt
   */
  prompt: string;

  /**
   * Generated code
   */
  code: string;

  /**
   * Execution result
   */
  executionResult?: ExecutionResult;

  /**
   * Analysis result
   */
  analysisResult?: AnalysisResult;

  /**
   * Applied fixes
   */
  appliedFixes: AppliedFix[];

  /**
   * Current code
   */
  currentCode: string;

  /**
   * Error history
   */
  errorHistory: ErrorInfo[];

  /**
   * Loop metadata
   */
  metadata: Record<string, unknown>;
}

/**
 * Execution result
 */
export interface ExecutionResult {
  /**
   * Success
   */
  success: boolean;

  /**
   * Exit code
   */
  exitCode?: number;

  /**
   * Stdout
   */
  stdout: string;

  /**
   * Stderr
   */
  stderr: string;

  /**
   * Execution time
   */
  executionTime: number;

  /**
   * Error
   */
  error?: Error;
}

/**
 * Analysis result
 */
export interface AnalysisResult {
  /**
   * Has errors
   */
  hasErrors: boolean;

  /**
   * Error patterns found
   */
  patterns: string[];

  /**
   * Confidence score
   */
  confidence: number;

  /**
   * Suggested fixes
   */
  suggestedFixes: string[];

  /**
   * Analysis time
   */
  analysisTime: number;
}

/**
 * Applied fix
 */
export interface AppliedFix {
  /**
   * Fix ID
   */
  id: string;

  /**
   * Fix description
   */
  description: string;

  /**
   * Original code
   */
  originalCode: string;

  /**
   * Fixed code
   */
  fixedCode: string;

  /**
   * Line number
   */
  lineNumber?: number;

  /**
   * Applied at iteration
   */
  iteration: number;

  /**
   * Success
   */
  success: boolean;
}

/**
 * Error info
 */
export interface ErrorInfo {
  /**
   * Error message
   */
  message: string;

  /**
   * Error type
   */
  type: string;

  /**
   * Line number
   */
  lineNumber?: number;

  /**
   * Column number
   */
  columnNumber?: number;

  /**
   * Timestamp
   */
  timestamp: number;

  /**
   * Pattern matched
   */
  pattern?: string;
}

/**
 * Termination condition
 */
export enum TerminationCondition {
  /**
   * Success termination
   */
  SUCCESS = 'success',

  /**
   * Max iterations reached
   */
  MAX_ITERATIONS = 'max_iterations',

  /**
   * No more fixes available
   */
  NO_MORE_FIXES = 'no_more_fixes',

  /**
   * Manual stop
   */
  MANUAL = 'manual',

  /**
   * Error during execution
   */
  ERROR = 'error',
}

/**
 * Loop result
 */
export interface LoopResult {
  /**
   * Loop ID
   */
  id: string;

  /**
   * Success
   */
  success: boolean;

  /**
   * Termination condition
   */
  terminationCondition: TerminationCondition;

  /**
   * Final code
   */
  finalCode: string;

  /**
   * Iterations
   */
  iterations: number;

  /**
   * Applied fixes
   */
  appliedFixes: AppliedFix[];

  /**
   * Error history
   */
  errorHistory: ErrorInfo[];

  /**
   * Total execution time
   */
  totalExecutionTime: number;

  /**
   * Result metadata
   */
  metadata: Record<string, unknown>;
}

/**
 * Loop options
 */
export interface LoopOptions {
  /**
   * Maximum iterations
   */
  maxIterations?: number;

  /**
   * Execution timeout (ms)
   */
  executionTimeout?: number;

  /**
   * Auto-apply fixes
   */
  autoApplyFixes?: boolean;

  /**
   * Validate fixes
   */
  validateFixes?: boolean;

  /**
   * Stop on first error
   */
  stopOnFirstError?: boolean;

  /**
   * Preserve comments
   */
  preserveComments?: boolean;

  /**
   * Language
   */
  language?: string;

  /**
   * Working directory
   */
  workingDirectory?: string;
}

/**
 * Self-healing loop class
 *
 * Provides the self-healing loop for automatic code fixing.
 */
export class SelfHealingLoop {
  private logger: Logger;
  private patternMatching: ErrorPatternMatching;
  private suggestionSystem: AutoSuggestionSystem;
  private fixValidation: FixValidation;
  private loops: Map<string, LoopState> = new Map();
  private cacheEnabled: boolean;

  constructor(options?: {
    logger?: Logger;
    patternMatching?: ErrorPatternMatching;
    suggestionSystem?: AutoSuggestionSystem;
    fixValidation?: FixValidation;
    cacheEnabled?: boolean;
  }) {
    this.logger = options?.logger || new Logger();
    this.patternMatching = options?.patternMatching || getErrorPatternMatching();
    this.suggestionSystem = options?.suggestionSystem || getAutoSuggestionSystem();
    this.fixValidation = options?.fixValidation || getFixValidation();
    this.cacheEnabled = options?.cacheEnabled ?? true;

    this.logger.info('SelfHealingLoop initialized', 'SelfHealingLoop');
  }

  /**
   * Start a self-healing loop
   *
   * @param prompt - Original prompt
   * @param options - Loop options
   * @returns Loop result
   */
  async startLoop(
    prompt: string,
    options: LoopOptions = {}
  ): Promise<LoopResult> {
    const loopId = `loop_${Date.now()}`;
    const maxIterations = options.maxIterations || 10;

    const state: LoopState = {
      id: loopId,
      stage: LoopStage.PROMPT,
      iteration: 0,
      maxIterations,
      prompt,
      code: '',
      currentCode: '',
      appliedFixes: [],
      errorHistory: [],
      metadata: {},
    };

    this.loops.set(loopId, state);

    const startTime = Date.now();

    try {
      // Generate initial code from prompt
      state.stage = LoopStage.CODE;
      state.code = await this.generateCode(prompt, options);
      state.currentCode = state.code;

      // Run the loop
      while (state.iteration < state.maxIterations) {
        state.iteration++;

        // Execute code
        state.stage = LoopStage.EXECUTE;
        const executionResult = await this.executeCode(
          state.currentCode,
          options
        );
        state.executionResult = executionResult;

        // Check if execution was successful
        if (executionResult.success) {
          state.stage = LoopStage.COMPLETED;
          return this.createSuccessResult(state, startTime);
        }

        // Analyze errors
        state.stage = LoopStage.ANALYZE;
        const analysisResult = await this.analyzeErrors(
          executionResult.stderr,
          state.currentCode
        );
        state.analysisResult = analysisResult;

        // Extract error info
        const errorInfo = this.extractErrorInfo(
          executionResult.stderr,
          analysisResult
        );
        state.errorHistory.push(errorInfo);

        // Check if we should stop
        if (options.stopOnFirstError) {
          state.stage = LoopStage.FAILED;
          return this.createFailureResult(
            state,
            TerminationCondition.ERROR,
            startTime
          );
        }

        // Generate fixes
        state.stage = LoopStage.FIX;
        const fixes = await this.generateFixes(
          errorInfo,
          state.currentCode,
          options
        );

        if (fixes.length === 0) {
          state.stage = LoopStage.FAILED;
          return this.createFailureResult(
            state,
            TerminationCondition.NO_MORE_FIXES,
            startTime
          );
        }

        // Apply fixes
        for (const fix of fixes) {
          if (options.autoApplyFixes !== false) {
            const appliedFix = await this.applyFix(
              fix,
              state.currentCode,
              state.iteration
            );
            state.appliedFixes.push(appliedFix);
            state.currentCode = appliedFix.fixedCode;
          }
        }

        // Validate fixes if enabled
        if (options.validateFixes) {
          const isValid = await this.fixValidation.validateFix(
            state.currentCode,
            options.language || 'typescript'
          );

          if (!isValid) {
            this.logger.warn(
              `Fix validation failed at iteration ${state.iteration}`,
              'SelfHealingLoop'
            );
          }
        }

        // Retry
        state.stage = LoopStage.RETRY;
      }

      // Max iterations reached
      state.stage = LoopStage.FAILED;
      return this.createFailureResult(
        state,
        TerminationCondition.MAX_ITERATIONS,
        startTime
      );
    } catch (error) {
      state.stage = LoopStage.FAILED;
      return this.createFailureResult(
        state,
        TerminationCondition.ERROR,
        startTime,
        error as Error
      );
    }
  }

  /**
   * Stop a running loop
   *
   * @param loopId - Loop ID
   * @returns Success
   */
  stopLoop(loopId: string): boolean {
    const state = this.loops.get(loopId);

    if (!state) {
      return false;
    }

    state.stage = LoopStage.FAILED;
    state.metadata['terminated'] = true;
    state.metadata['terminationReason'] = 'manual_stop';

    return true;
  }

  /**
   * Get loop state
   *
   * @param loopId - Loop ID
   * @returns Loop state or undefined
   */
  getLoopState(loopId: string): LoopState | undefined {
    return this.loops.get(loopId);
  }

  /**
   * Get all loop states
   *
   * @returns Map of loop IDs to states
   */
  getAllLoopStates(): Map<string, LoopState> {
    return new Map(this.loops);
  }

  /**
   * Clear all loops
   */
  clearLoops(): void {
    this.loops.clear();
    this.logger.debug('All loops cleared', 'SelfHealingLoop');
  }

  /**
   * Generate code from prompt
   *
   * @param prompt - Prompt
   * @param options - Loop options
   * @returns Generated code
   */
  private async generateCode(
    prompt: string,
    options: LoopOptions
  ): Promise<string> {
    // This would integrate with the code generation system
    // For now, return a placeholder
    this.logger.debug('Generating code from prompt', 'SelfHealingLoop', {
      prompt: prompt.substring(0, 100),
    });

    return `// Generated code for: ${prompt.substring(0, 50)}...\n`;
  }

  /**
   * Execute code
   *
   * @param code - Code to execute
   * @param options - Loop options
   * @returns Execution result
   */
  private async executeCode(
    code: string,
    options: LoopOptions
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // Write code to temporary file
      const ext = this.getExtension(options.language || 'typescript');
      const tempFile = `/tmp/healing-loop-${Date.now()}${ext}`;
      await Bun.write(tempFile, code);

      // Execute the code
      const proc = Bun.spawn({
        cmd: ['bun', 'run', tempFile],
        cwd: options.workingDirectory || process.cwd(),
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();

      const exitCode = await proc.exited;

      // Clean up
      await Bun.file(tempFile).delete();

      const executionTime = Date.now() - startTime;

      return {
        success: exitCode === 0,
        exitCode,
        stdout,
        stderr,
        executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      return {
        success: false,
        stdout: '',
        stderr: '',
        executionTime,
        error: error as Error,
      };
    }
  }

  /**
   * Analyze errors
   *
   * @param stderr - Stderr output
   * @param code - Current code
   * @returns Analysis result
   */
  private async analyzeErrors(
    stderr: string,
    code: string
  ): Promise<AnalysisResult> {
    const startTime = Date.now();

    // Use pattern matching to analyze errors
    const patterns = this.patternMatching.matchPatterns(stderr);

    const hasErrors = patterns.length > 0 || stderr.length > 0;

    // Generate suggestions
    const suggestedFixes = await this.suggestionSystem.generateSuggestions(
      stderr,
      code
    );

    const analysisTime = Date.now() - startTime;

    return {
      hasErrors,
      patterns: patterns.map((p) => p.pattern.source),
      confidence: patterns.length > 0 ? patterns[0]!.confidence : 0,
      suggestedFixes: suggestedFixes.map((s) => s.description),
      analysisTime,
    };
  }

  /**
   * Extract error info
   *
   * @param stderr - Stderr output
   * @param analysisResult - Analysis result
   * @returns Error info
   */
  private extractErrorInfo(
    stderr: string,
    analysisResult: AnalysisResult
  ): ErrorInfo {
    // Parse error from stderr
    const errorMatch = stderr.match(/Error:\s*(.+)/i);
    const message = errorMatch ? errorMatch[1] : stderr.substring(0, 200);

    return {
      message,
      type: this.inferErrorType(stderr),
      timestamp: Date.now(),
      pattern: analysisResult.patterns[0] || undefined,
    };
  }

  /**
   * Generate fixes
   *
   * @param errorInfo - Error info
   * @param code - Current code
   * @param options - Loop options
   * @returns Array of fixes
   */
  private async generateFixes(
    errorInfo: ErrorInfo,
    code: string,
    options: LoopOptions
  ): Promise<string[]> {
    // Use suggestion system to generate fixes
    const suggestions = await this.suggestionSystem.generateSuggestions(
      errorInfo.message,
      code
    );

    return suggestions.map((s) => s.fix);
  }

  /**
   * Apply fix
   *
   * @param fix - Fix to apply
   * @param code - Current code
   * @param iteration - Current iteration
   * @returns Applied fix
   */
  private async applyFix(
    fix: string,
    code: string,
    iteration: number
  ): Promise<AppliedFix> {
    const fixId = `fix_${Date.now()}`;
    const originalCode = code;

    // Apply the fix (simplified version)
    const fixedCode = this.applyFixToCode(fix, code);

    return {
      id: fixId,
      description: fix,
      originalCode,
      fixedCode,
      iteration,
      success: fixedCode !== originalCode,
    };
  }

  /**
   * Apply fix to code
   *
   * @param fix - Fix to apply
   * @param code - Current code
   * @returns Fixed code
   */
  private applyFixToCode(fix: string, code: string): string {
    // Simple fix application (would be more sophisticated in production)
    const lines = code.split('\n');

    // Look for common patterns and apply fixes
    for (let i = 0; i < lines.length; i++) {
      // Add missing imports
      if (fix.includes('import') && !lines[i]!.includes('import')) {
        lines[i]! = fix + '\n' + lines[i]!;
        break;
      }

      // Fix syntax errors
      if (fix.includes('missing') && lines[i]!.includes('{')) {
        lines[i]! = lines[i]!.replace('{', '{\n' + fix);
        break;
      }
    }

    return lines.join('\n');
  }

  /**
   * Infer error type from stderr
   *
   * @param stderr - Stderr output
   * @returns Error type
   */
  private inferErrorType(stderr: string): string {
    if (stderr.includes('SyntaxError')) {
      return 'SyntaxError';
    }
    if (stderr.includes('ReferenceError')) {
      return 'ReferenceError';
    }
    if (stderr.includes('TypeError')) {
      return 'TypeError';
    }
    if (stderr.includes('Cannot find module')) {
      return 'ModuleNotFoundError';
    }
    return 'UnknownError';
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
   * Create success result
   *
   * @param state - Loop state
   * @param startTime - Start time
   * @returns Loop result
   */
  private createSuccessResult(
    state: LoopState,
    startTime: number
  ): LoopResult {
    return {
      id: state.id,
      success: true,
      terminationCondition: TerminationCondition.SUCCESS,
      finalCode: state.currentCode,
      iterations: state.iteration,
      appliedFixes: state.appliedFixes,
      errorHistory: state.errorHistory,
      totalExecutionTime: Date.now() - startTime,
      metadata: state.metadata,
    };
  }

  /**
   * Create failure result
   *
   * @param state - Loop state
   * @param condition - Termination condition
   * @param startTime - Start time
   * @param error - Error (optional)
   * @returns Loop result
   */
  private createFailureResult(
    state: LoopState,
    condition: TerminationCondition,
    startTime: number,
    error?: Error
  ): LoopResult {
    return {
      id: state.id,
      success: false,
      terminationCondition: condition,
      finalCode: state.currentCode,
      iterations: state.iteration,
      appliedFixes: state.appliedFixes,
      errorHistory: state.errorHistory,
      totalExecutionTime: Date.now() - startTime,
      metadata: {
        ...state.metadata,
        error: error?.message,
      },
    };
  }
}

/**
 * Schema for loop options
 */
export const LoopOptionsSchema = z.object({
  maxIterations: z.number().min(1).max(100).optional(),
  executionTimeout: z.number().min(1).optional(),
  autoApplyFixes: z.boolean().optional(),
  validateFixes: z.boolean().optional(),
  stopOnFirstError: z.boolean().optional(),
  preserveComments: z.boolean().optional(),
  language: z.string().optional(),
  workingDirectory: z.string().optional(),
});

/**
 * Global self-healing loop instance
 */
let globalSelfHealingLoop: SelfHealingLoop | null = null;

/**
 * Initialize global self-healing loop
 *
 * @param options - Options
 * @returns The global self-healing loop
 */
export function initSelfHealingLoop(options?: {
  logger?: Logger;
  patternMatching?: ErrorPatternMatching;
  suggestionSystem?: AutoSuggestionSystem;
  fixValidation?: FixValidation;
  cacheEnabled?: boolean;
}): SelfHealingLoop {
  globalSelfHealingLoop = new SelfHealingLoop(options);
  return globalSelfHealingLoop;
}

/**
 * Get global self-healing loop
 *
 * @returns The global self-healing loop
 */
export function getSelfHealingLoop(): SelfHealingLoop {
  if (!globalSelfHealingLoop) {
    globalSelfHealingLoop = new SelfHealingLoop();
  }
  return globalSelfHealingLoop;
}
