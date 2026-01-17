/**
 * Task Executor - Task Execution Framework
 *
 * Provides task execution capabilities including:
 * - Parallel task execution
 * - Task status tracking
 * - Result collection
 * - Error handling and retry
 */

import { Logger } from '../../utils/logger';
import type { Task, TaskPriority, TaskStatus } from '../../types';
import type { TaskPlan, Subtask } from './planner';

/**
 * Task execution context
 */
export interface TaskExecutionContext {
  /** Task being executed */
  task: Task;
  /** Execution ID */
  executionId: string;
  /** Start timestamp */
  startTime: number;
  /** Agent ID executing the task */
  agentId?: string;
  /** Additional context data */
  context?: Record<string, unknown>;
}

/**
 * Task execution result
 */
export interface TaskExecutionResult {
  /** Task ID */
  taskId: string;
  /** Execution ID */
  executionId: string;
  /** Execution status */
  status: TaskExecutionStatus;
  /** Result data */
  result?: unknown;
  /** Error if failed */
  error?: Error;
  /** Execution duration in milliseconds */
  duration: number;
  /** Tokens used */
  tokensUsed?: number;
  /** Subtask results */
  subtaskResults?: Map<string, TaskExecutionResult>;
}

/**
 * Task execution status
 */
export type TaskExecutionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout';

/**
 * Task execution configuration
 */
export interface TaskExecutionConfig {
  /** Maximum concurrent tasks */
  maxConcurrent?: number;
  /** Default task timeout in milliseconds */
  defaultTimeout?: number;
  /** Enable task retry on failure */
  enableRetry?: boolean;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Retry delay in milliseconds */
  retryDelay?: number;
}

/**
 * Task execution options
 */
export interface TaskExecutionOptions {
  /** Override timeout for this task */
  timeout?: number;
  /** Agent ID to execute task */
  agentId?: string;
  /** Additional context */
  context?: Record<string, unknown>;
  /** Priority for execution */
  priority?: TaskPriority;
}

/**
 * Task executor for executing tasks
 *
 * Features:
 * - Parallel execution of independent tasks
 * - Status tracking and updates
 * - Result aggregation
 * - Error handling with retry
 * - Timeout management
 */
export class TaskExecutor {
  private logger: Logger;
  private config: TaskExecutionConfig;
  private activeExecutions = new Map<string, TaskExecutionContext>();
  private executionHistory: TaskExecutionResult[] = [];
  private executionCounter = 0;

  constructor(config?: TaskExecutionConfig, logger?: Logger) {
    this.config = {
      maxConcurrent: 5,
      defaultTimeout: 30000,
      enableRetry: true,
      maxRetries: 3,
      retryDelay: 1000,
      ...config,
    };
    this.logger = logger?.child('TaskExecutor') ?? new Logger().child('TaskExecutor');
  }

  /**
   * Execute a single task
   *
   * @param task - Task to execute
   * @param options - Execution options
   * @returns Execution result
   */
  async executeTask(
    task: Task,
    options: TaskExecutionOptions = {}
  ): Promise<TaskExecutionResult> {
    const executionId = this.generateExecutionId();
    const startTime = Date.now();

    const context: TaskExecutionContext = {
      task,
      executionId,
      startTime,
      agentId: options.agentId,
      context: options.context,
    };

    this.activeExecutions.set(executionId, context);
    this.logger.info(`Executing task: ${task.id} (${executionId})`);

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(
        task,
        options.timeout ?? this.config.defaultTimeout,
        options
      );

      const duration = Date.now() - startTime;

      const executionResult: TaskExecutionResult = {
        taskId: task.id,
        executionId,
        status: 'completed',
        result,
        duration,
      };

      this.executionHistory.push(executionResult);
      this.activeExecutions.delete(executionId);

      this.logger.info(
        `Task completed: ${task.id} in ${duration}ms`
      );

      return executionResult;
    } catch (error) {
      const duration = Date.now() - startTime;

      const executionResult: TaskExecutionResult = {
        taskId: task.id,
        executionId,
        status: error instanceof TimeoutError ? 'timeout' : 'failed',
        error: error instanceof Error ? error : new Error(String(error)),
        duration,
      };

      this.executionHistory.push(executionResult);
      this.activeExecutions.delete(executionId);

      this.logger.error(
        `Task failed: ${task.id} - ${error instanceof Error ? error.message : String(error)}`
      );

      return executionResult;
    }
  }

  /**
   * Execute a task plan with subtasks
   *
   * @param plan - Task plan to execute
   * @param options - Execution options
   * @returns Execution result with subtask results
   */
  async executePlan(
    plan: TaskPlan,
    options: TaskExecutionOptions = {}
  ): Promise<TaskExecutionResult> {
    this.logger.info(
      `Executing plan: ${plan.task.id} with ${plan.subtasks.length} subtasks`
    );

    const subtaskResults = new Map<string, TaskExecutionResult>();
    const startTime = Date.now();

    try {
      // Execute subtasks in dependency order
      for (const subtaskId of plan.executionOrder) {
        const subtask = plan.subtasks.find(st => st.id === subtaskId);
        if (!subtask) {
          this.logger.warn(`Subtask not found: ${subtaskId}`);
          continue;
        }

        // Check if dependencies are satisfied
        const deps = plan.dependencies.filter(d => d.taskId === subtaskId);
        const depsSatisfied = deps.every(dep => {
          // If dependency is the original task, it's implicitly satisfied
          if (dep.dependsOn[0] === plan.task.id) {
            return true;
          }
          // Otherwise check if dependency has been executed
          return subtaskResults.has(dep.dependsOn[0]);
        });

        if (!depsSatisfied) {
          this.logger.warn(`Dependencies not satisfied for: ${subtaskId}`);
          continue;
        }

        // Execute subtask
        const result = await this.executeSubtask(subtask, options);
        subtaskResults.set(subtaskId, result);

        // Check if failed
        if (result.status === 'failed' || result.status === 'timeout') {
          this.logger.error(`Subtask failed: ${subtaskId}, stopping execution`);
          break;
        }
      }

      const duration = Date.now() - startTime;

      // Aggregate results
      const aggregatedResult = this.aggregateSubtaskResults(
        subtaskResults,
        plan.subtasks
      );

      const executionResult: TaskExecutionResult = {
        taskId: plan.task.id,
        executionId: this.generateExecutionId(),
        status: 'completed',
        result: aggregatedResult,
        duration,
        subtaskResults,
      };

      this.executionHistory.push(executionResult);

      this.logger.info(
        `Plan completed: ${plan.task.id} in ${duration}ms`
      );

      return executionResult;
    } catch (error) {
      const duration = Date.now() - startTime;

      const executionResult: TaskExecutionResult = {
        taskId: plan.task.id,
        executionId: this.generateExecutionId(),
        status: 'failed',
        error: error instanceof Error ? error : new Error(String(error)),
        duration,
        subtaskResults,
      };

      this.executionHistory.push(executionResult);

      return executionResult;
    }
  }

  /**
   * Execute multiple tasks in parallel
   *
   * @param tasks - Tasks to execute
   * @param options - Execution options
   * @returns Array of execution results
   */
  async executeParallel(
    tasks: Task[],
    options: TaskExecutionOptions = {}
  ): Promise<TaskExecutionResult[]> {
    this.logger.info(`Executing ${tasks.length} tasks in parallel`);

    // Limit concurrent executions
    const maxConcurrent = this.config.maxConcurrent ?? 5;
    const results: TaskExecutionResult[] = [];

    for (let i = 0; i < tasks.length; i += maxConcurrent) {
      const batch = tasks.slice(i, i + maxConcurrent);
      const batchResults = await Promise.all(
        batch.map(task => this.executeTask(task, options))
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Execute a subtask with retry
   *
   * @param subtask - Subtask to execute
   * @param options - Execution options
   * @returns Execution result
   */
  private async executeSubtask(
    subtask: Subtask,
    options: TaskExecutionOptions
  ): Promise<TaskExecutionResult> {
    const task: Task = {
      ...subtask,
      id: subtask.id,
    };

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= (this.config.maxRetries ?? 3); attempt++) {
      try {
        return await this.executeTask(task, options);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < (this.config.maxRetries ?? 3)) {
          this.logger.warn(
            `Subtask retry ${attempt + 1}/${this.config.maxRetries}: ${subtask.id}`
          );

          // Wait before retry
          await this.sleep(this.config.retryDelay ?? 1000);
        }
      }
    }

    // All retries failed
    throw lastError ?? new Error('Unknown error');
  }

  /**
   * Execute task with timeout
   *
   * @param task - Task to execute
   * @param timeout - Timeout in milliseconds
   * @param options - Execution options
   * @returns Task result
   */
  private async executeWithTimeout(
    task: Task,
    timeout: number,
    options: TaskExecutionOptions
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new TimeoutError(`Task timeout after ${timeout}ms`));
      }, timeout);

      // In a real implementation, this would call the agent
      // For now, simulate execution
      this.simulateTaskExecution(task, options)
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Simulate task execution (placeholder)
   *
   * @param task - Task to execute
   * @param options - Execution options
   * @returns Simulated result
   */
  private async simulateTaskExecution(
    task: Task,
    options: TaskExecutionOptions
  ): Promise<unknown> {
    // Simulate execution time based on task complexity
    const duration = this.getSimulatedDuration(task);
    await this.sleep(duration);

    return {
      taskId: task.id,
      description: task.description,
      completedAt: new Date().toISOString(),
      agentId: options.agentId,
    };
  }

  /**
   * Get simulated duration for task
   *
   * @param task - Task
   * @returns Duration in milliseconds
   */
  private getSimulatedDuration(task: Task): number {
    switch (task.complexity) {
      case 'simple':
        return 100;
      case 'medium':
        return 200;
      case 'complex':
        return 400;
      case 'critical':
        return 600;
      default:
        return 1000;
    }
  }

  /**
   * Aggregate subtask results
   *
   * @param subtaskResults - Map of subtask results
   * @param subtasks - Array of subtasks
   * @returns Aggregated result
   */
  private aggregateSubtaskResults(
    subtaskResults: Map<string, TaskExecutionResult>,
    subtasks: Subtask[]
  ): unknown {
    const completedResults = Array.from(subtaskResults.values())
      .filter(r => r.status === 'completed');

    return {
      totalSubtasks: subtasks.length,
      completedSubtasks: completedResults.length,
      failedSubtasks: subtasks.length - completedResults.length,
      results: completedResults.map(r => r.result),
      summary: this.generateSummary(completedResults),
    };
  }

  /**
   * Generate execution summary
   *
   * @param results - Execution results
   * @returns Summary string
   */
  private generateSummary(results: TaskExecutionResult[]): string {
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    const avgDuration = totalDuration / results.length;

    return `${results.length} subtasks completed, ` +
      `total: ${totalDuration}ms, ` +
      `average: ${avgDuration.toFixed(0)}ms`;
  }

  /**
   * Generate execution ID
   */
  private generateExecutionId(): string {
    return `exec-${Date.now()}-${++this.executionCounter}`;
  }

  /**
   * Sleep for specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get active executions
   */
  getActiveExecutions(): TaskExecutionContext[] {
    return Array.from(this.activeExecutions.values());
  }

  /**
   * Get execution history
   */
  getExecutionHistory(): TaskExecutionResult[] {
    return [...this.executionHistory];
  }

  /**
   * Clear execution history
   */
  clearHistory(): void {
    this.executionHistory = [];
    this.logger.debug('Execution history cleared');
  }

  /**
   * Get execution statistics
   */
  getStatistics(): {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageDuration: number;
  } {
    const successful = this.executionHistory.filter(
      r => r.status === 'completed'
    ).length;
    const failed = this.executionHistory.filter(
      r => r.status === 'failed' || r.status === 'timeout'
    ).length;
    const totalDuration = this.executionHistory.reduce(
      (sum, r) => sum + r.duration,
      0
    );

    return {
      totalExecutions: this.executionHistory.length,
      successfulExecutions: successful,
      failedExecutions: failed,
      averageDuration: totalDuration / this.executionHistory.length || 0,
    };
  }
}

/**
 * Timeout error class
 */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Create a task executor instance
 *
 * @param config - Executor configuration
 * @param logger - Logger instance
 * @returns Task executor instance
 */
export function createTaskExecutor(
  config?: TaskExecutionConfig,
  logger?: Logger
): TaskExecutor {
  return new TaskExecutor(config, logger);
}

/**
 * Get global task executor instance
 *
 * @returns Global task executor
 */
let globalTaskExecutor: TaskExecutor | null = null;

export function getTaskExecutor(): TaskExecutor {
  if (!globalTaskExecutor) {
    globalTaskExecutor = createTaskExecutor();
  }
  return globalTaskExecutor;
}
