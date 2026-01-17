/**
 * Shadow Mode - Speculative Executor
 *
 * Executes code changes speculatively in the background to:
 * - Run tests without blocking
 * - Detect conflicts early
 * - Compare performance impacts
 * - Enable safe experimentation
 */

import { Logger } from '../../utils/logger';
import type { ExecutionResult } from './loop';

/**
 * Shadow execution state
 */
export enum ShadowState {
  /** Idle - no speculation running */
  IDLE = 'idle',
  /** Running - speculation in progress */
  RUNNING = 'running',
  /** Analyzing - comparing results */
  ANALYZING = 'analyzing',
  /** Complete - results ready */
  COMPLETE = 'complete',
  /** Failed - speculation failed */
  FAILED = 'failed',
}

/**
 * Shadow execution options
 */
export interface ShadowExecutionOptions {
  /** Working directory */
  workingDirectory: string;
  /** Test command to run */
  testCommand?: string;
  /** Timeout (ms) */
  timeout?: number;
  /** Run in parallel with main execution */
  parallel?: boolean;
  /** Compare performance */
  comparePerformance?: boolean;
  /** Auto-apply if successful */
  autoApply?: boolean;
}

/**
 * Shadow execution result
 */
export interface ShadowExecutionResult {
  /** Execution ID */
  executionId: string;
  /** State */
  state: ShadowState;
  /** Original result (baseline) */
  originalResult?: ExecutionResult;
  /** Speculative result */
  speculativeResult?: ExecutionResult;
  /** Test results */
  testResults?: {
    passed: boolean;
    output: string;
    duration: number;
  };
  /** Performance comparison */
  performanceComparison?: {
    originalTime: number;
    speculativeTime: number;
    improvement: number; // percentage
  };
  /** Conflicts detected */
  conflicts: string[];
  /** Can apply safely */
  canApply: boolean;
  /** Recommendation */
  recommendation: 'apply' | 'discard' | 'review';
  /** Reason for recommendation */
  reason: string;
  /** Timestamp */
  timestamp: number;
}

/**
 * Shadow Mode Manager
 *
 * Manages speculative code execution in the background.
 */
export class ShadowMode {
  private logger: Logger;
  private activeExecutions = new Map<string, ShadowExecutionResult>();
  private executionHistory: ShadowExecutionResult[] = [];
  private maxHistorySize = 100;

  constructor() {
    this.logger = new Logger().child('ShadowMode');
    this.logger.info('Shadow Mode initialized');
  }

  /**
   * Execute code speculatively
   *
   * @param code - Code to execute
   * @param options - Execution options
   * @returns Execution ID
   */
  async executeSpeculative(
    code: string,
    options: ShadowExecutionOptions
  ): Promise<string> {
    const executionId = `shadow_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const result: ShadowExecutionResult = {
      executionId,
      state: ShadowState.RUNNING,
      conflicts: [],
      canApply: false,
      recommendation: 'review',
      reason: 'Speculation in progress',
      timestamp: Date.now(),
    };

    this.activeExecutions.set(executionId, result);

    this.logger.info('Starting speculative execution', {
      executionId,
      parallel: options.parallel,
    });

    // Run speculative execution in background
    if (options.parallel) {
      this.runSpeculativeExecution(executionId, code, options).catch((error) => {
        this.logger.error('Speculative execution failed', {
          executionId,
          error: (error as Error).message,
        });
        result.state = ShadowState.FAILED;
        result.reason = (error as Error).message;
      });
    } else {
      await this.runSpeculativeExecution(executionId, code, options);
    }

    return executionId;
  }

  /**
   * Get execution result
   *
   * @param executionId - Execution ID
   * @returns Execution result or undefined
   */
  getResult(executionId: string): ShadowExecutionResult | undefined {
    return this.activeExecutions.get(executionId);
  }

  /**
   * Wait for execution to complete
   *
   * @param executionId - Execution ID
   * @param timeout - Maximum wait time (ms)
   * @returns Execution result
   */
  async waitForCompletion(
    executionId: string,
    timeout = 30000
  ): Promise<ShadowExecutionResult> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const result = this.activeExecutions.get(executionId);

      if (!result) {
        throw new Error(`Execution not found: ${executionId}`);
      }

      if (
        result.state === ShadowState.COMPLETE ||
        result.state === ShadowState.FAILED
      ) {
        return result;
      }

      // Wait 100ms before checking again
      await Bun.sleep(100);
    }

    throw new Error(`Execution timeout: ${executionId}`);
  }

  /**
   * Apply speculative changes
   *
   * @param executionId - Execution ID
   * @returns Success
   */
  async apply(executionId: string): Promise<boolean> {
    const result = this.activeExecutions.get(executionId);

    if (!result) {
      this.logger.error('Execution not found', { executionId });
      return false;
    }

    if (result.state !== ShadowState.COMPLETE) {
      this.logger.error('Execution not complete', {
        executionId,
        state: result.state,
      });
      return false;
    }

    if (!result.canApply) {
      this.logger.error('Cannot apply: conflicts or failures detected', {
        executionId,
        conflicts: result.conflicts,
      });
      return false;
    }

    this.logger.info('Applying speculative changes', { executionId });

    // In real implementation, this would apply the changes to the actual codebase
    // For now, we just mark it as applied
    this.moveToHistory(executionId);
    return true;
  }

  /**
   * Discard speculative changes
   *
   * @param executionId - Execution ID
   */
  discard(executionId: string): void {
    const result = this.activeExecutions.get(executionId);

    if (result) {
      this.logger.info('Discarding speculative changes', { executionId });
      this.moveToHistory(executionId);
    }
  }

  /**
   * Get all active executions
   *
   * @returns Array of active execution results
   */
  getActiveExecutions(): ShadowExecutionResult[] {
    return Array.from(this.activeExecutions.values());
  }

  /**
   * Get execution history
   *
   * @param limit - Maximum number of items to return
   * @returns Array of historical execution results
   */
  getHistory(limit = 10): ShadowExecutionResult[] {
    return this.executionHistory.slice(-limit);
  }

  /**
   * Clear execution history
   */
  clearHistory(): void {
    this.executionHistory = [];
    this.logger.debug('Execution history cleared');
  }

  /**
   * Run speculative execution
   *
   * @param executionId - Execution ID
   * @param code - Code to execute
   * @param options - Execution options
   */
  private async runSpeculativeExecution(
    executionId: string,
    code: string,
    options: ShadowExecutionOptions
  ): Promise<void> {
    const result = this.activeExecutions.get(executionId);
    if (!result) return;

    try {
      // Step 1: Execute the speculative code
      result.speculativeResult = await this.executeCode(code, options);

      // Step 2: Run tests if specified
      if (options.testCommand) {
        result.testResults = await this.runTests(options.testCommand, options);
      }

      // Step 3: Compare performance if enabled
      if (options.comparePerformance) {
        result.performanceComparison = await this.comparePerformance(
          result.originalResult,
          result.speculativeResult
        );
      }

      // Step 4: Detect conflicts
      result.conflicts = await this.detectConflicts(
        result.originalResult,
        result.speculativeResult
      );

      // Step 5: Analyze and make recommendation
      result.state = ShadowState.ANALYZING;
      this.analyzeResults(result, options);

      result.state = ShadowState.COMPLETE;
      this.logger.info('Speculative execution complete', {
        executionId,
        recommendation: result.recommendation,
        canApply: result.canApply,
      });
    } catch (error) {
      result.state = ShadowState.FAILED;
      result.reason = (error as Error).message;
      result.canApply = false;
      result.recommendation = 'discard';

      this.logger.error('Speculative execution failed', {
        executionId,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Execute code
   *
   * @param code - Code to execute
   * @param options - Execution options
   * @returns Execution result
   */
  private async executeCode(
    code: string,
    options: ShadowExecutionOptions
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // Write code to temporary file
      const tempFile = `/tmp/shadow-${Date.now()}.ts`;
      await Bun.write(tempFile, code);

      // Execute the code
      const proc = Bun.spawn({
        cmd: ['bun', 'run', tempFile],
        cwd: options.workingDirectory,
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
        stderr: (error as Error).message,
        executionTime,
        error: error as Error,
      };
    }
  }

  /**
   * Run tests
   *
   * @param testCommand - Test command
   * @param options - Execution options
   * @returns Test results
   */
  private async runTests(
    testCommand: string,
    options: ShadowExecutionOptions
  ): Promise<{ passed: boolean; output: string; duration: number }> {
    const startTime = Date.now();

    try {
      const proc = Bun.spawn({
        cmd: testCommand.split(' '),
        cwd: options.workingDirectory,
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;

      const duration = Date.now() - startTime;
      const output = stdout + stderr;

      return {
        passed: exitCode === 0,
        output,
        duration,
      };
    } catch (error) {
      return {
        passed: false,
        output: (error as Error).message,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Compare performance
   *
   * @param original - Original result
   * @param speculative - Speculative result
   * @returns Performance comparison
   */
  private async comparePerformance(
    original?: ExecutionResult,
    speculative?: ExecutionResult
  ): Promise<{
    originalTime: number;
    speculativeTime: number;
    improvement: number;
  }> {
    if (!original || !speculative) {
      return {
        originalTime: 0,
        speculativeTime: 0,
        improvement: 0,
      };
    }

    const originalTime = original.executionTime;
    const speculativeTime = speculative.executionTime;
    const improvement = ((originalTime - speculativeTime) / originalTime) * 100;

    return {
      originalTime,
      speculativeTime,
      improvement,
    };
  }

  /**
   * Detect conflicts
   *
   * @param original - Original result
   * @param speculative - Speculative result
   * @returns Array of conflict descriptions
   */
  private async detectConflicts(
    original?: ExecutionResult,
    speculative?: ExecutionResult
  ): Promise<string[]> {
    const conflicts: string[] = [];

    if (!original || !speculative) {
      return conflicts;
    }

    // Check if speculative version failed but original succeeded
    if (original.success && !speculative.success) {
      conflicts.push('Speculative version introduces failures');
    }

    // Check if output differs significantly
    if (original.stdout !== speculative.stdout) {
      conflicts.push('Output differs from original');
    }

    // Check for stderr in speculative version
    if (speculative.stderr && speculative.stderr.length > 0) {
      conflicts.push('Speculative version produces errors');
    }

    return conflicts;
  }

  /**
   * Analyze results and make recommendation
   *
   * @param result - Execution result
   * @param options - Execution options
   */
  private analyzeResults(
    result: ShadowExecutionResult,
    options: ShadowExecutionOptions
  ): void {
    // Default: cannot apply if there are conflicts
    if (result.conflicts.length > 0) {
      result.canApply = false;
      result.recommendation = 'discard';
      result.reason = `Conflicts detected: ${result.conflicts.join(', ')}`;
      return;
    }

    // Cannot apply if speculative execution failed
    if (result.speculativeResult && !result.speculativeResult.success) {
      result.canApply = false;
      result.recommendation = 'discard';
      result.reason = 'Speculative execution failed';
      return;
    }

    // Cannot apply if tests failed
    if (result.testResults && !result.testResults.passed) {
      result.canApply = false;
      result.recommendation = 'discard';
      result.reason = 'Tests failed';
      return;
    }

    // Can apply if all checks passed
    result.canApply = true;

    // Auto-apply if enabled
    if (options.autoApply) {
      result.recommendation = 'apply';
      result.reason = 'All checks passed, auto-apply enabled';
    } else {
      result.recommendation = 'review';
      result.reason = 'All checks passed, manual review recommended';
    }

    // Consider performance improvement
    if (result.performanceComparison) {
      if (result.performanceComparison.improvement > 10) {
        result.reason += ` (${result.performanceComparison.improvement.toFixed(1)}% faster)`;
      } else if (result.performanceComparison.improvement < -10) {
        result.reason += ` (${Math.abs(result.performanceComparison.improvement).toFixed(1)}% slower)`;
      }
    }
  }

  /**
   * Move execution to history
   *
   * @param executionId - Execution ID
   */
  private moveToHistory(executionId: string): void {
    const result = this.activeExecutions.get(executionId);

    if (result) {
      this.executionHistory.push(result);

      // Trim history if needed
      if (this.executionHistory.length > this.maxHistorySize) {
        this.executionHistory = this.executionHistory.slice(-this.maxHistorySize);
      }

      this.activeExecutions.delete(executionId);
    }
  }
}

/**
 * Global shadow mode instance
 */
let globalShadowMode: ShadowMode | null = null;

/**
 * Initialize global shadow mode
 *
 * @returns The global shadow mode instance
 */
export function initShadowMode(): ShadowMode {
  globalShadowMode = new ShadowMode();
  return globalShadowMode;
}

/**
 * Get global shadow mode
 *
 * @returns The global shadow mode instance
 */
export function getShadowMode(): ShadowMode {
  if (!globalShadowMode) {
    globalShadowMode = new ShadowMode();
  }
  return globalShadowMode;
}
