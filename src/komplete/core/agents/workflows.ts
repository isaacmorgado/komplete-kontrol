/**
 * Multi-Agent Workflows
 *
 * Provides workflow definition and execution for multi-agent systems,
 * including sequential and parallel workflows with state management.
 */

import { z } from 'zod';
import { Logger } from '../../utils/logger';
import { AgentError } from '../../types';
import { CoordinationPattern, type PatternExecutionResult } from './patterns';

/**
 * Workflow step type
 */
export enum WorkflowStepType {
  /**
   * Execute agent
   */
  EXECUTE = 'execute',

  /**
   * Wait for condition
   */
  WAIT = 'wait',

  /**
   * Branch based on condition
   */
  BRANCH = 'branch',

  /**
   * Loop until condition
   */
  LOOP = 'loop',

  /**
   * Parallel execution
   */
  PARALLEL = 'parallel',

  /**
   * Merge results
   */
  MERGE = 'merge',
}

/**
 * Workflow state
 */
export enum WorkflowState {
  /**
   * Workflow is pending
   */
  PENDING = 'pending',

  /**
   * Workflow is running
   */
  RUNNING = 'running',

  /**
   * Workflow is paused
   */
  PAUSED = 'paused',

  /**
   * Workflow completed successfully
   */
  COMPLETED = 'completed',

  /**
   * Workflow failed
   */
  FAILED = 'failed',

  /**
   * Workflow was cancelled
   */
  CANCELLED = 'cancelled',
}

/**
 * Workflow step
 */
export interface WorkflowStep {
  /**
   * Step ID
   */
  stepId: string;

  /**
   * Step type
   */
  type: WorkflowStepType;

  /**
   * Agent ID to execute
   */
  agentId?: string;

  /**
   * Task/prompt for agent
   */
  task?: string;

  /**
   * Wait condition
   */
  waitCondition?: string;

  /**
   * Branch conditions
   */
  branches?: Map<string, string>;

  /**
   * Loop condition
   */
  loopCondition?: string;

  /**
   * Max iterations
   */
  maxIterations?: number;

  /**
   * Parallel steps
   */
  parallelSteps?: string[];

  /**
   * Merge strategy
   */
  mergeStrategy?: 'concat' | 'merge' | 'custom';

  /**
   * Next step ID
   */
  nextStep?: string;

  /**
   * On failure step ID
   */
  onFailure?: string;

  /**
   * Timeout in milliseconds
   */
  timeoutMs?: number;
}

/**
 * Workflow configuration
 */
export interface WorkflowConfig {
  /**
   * Workflow ID
   */
  workflowId: string;

  /**
   * Workflow name
   */
  name: string;

  /**
   * Workflow description
   */
  description?: string;

  /**
   * Workflow steps
   */
  steps: WorkflowStep[];

  /**
   * Start step ID
   */
  startStepId: string;

  /**
   * Execution mode
   */
  executionMode: 'sequential' | 'parallel' | 'mixed';

  /**
   * State persistence
   */
  persistState?: boolean;

  /**
   * Retry failed steps
   */
  retryOnFailure?: boolean;

  /**
   * Max retries per step
   */
  maxRetries?: number;

  /**
   * Timeout for entire workflow
   */
  timeoutMs?: number;
}

/**
 * Workflow execution context
 */
export interface WorkflowExecutionContext {
  /**
   * Workflow ID
   */
  workflowId: string;

  /**
   * Execution ID
   */
  executionId: string;

  /**
   * Current step ID
   */
  currentStepId: string;

  /**
   * Workflow state
   */
  state: WorkflowState;

  /**
   * Step results
   */
  stepResults: Map<string, unknown>;

  /**
   * Shared variables
   */
  variables: Map<string, unknown>;

  /**
   * Execution timestamp
   */
  startedAt: Date;

  /**
   * Current iteration (for loops)
   */
  iteration: number;

  /**
   * Error if failed
   */
  error?: Error;
}

/**
 * Workflow execution result
 */
export interface WorkflowExecutionResult {
  /**
   * Workflow ID
   */
  workflowId: string;

  /**
   * Execution ID
   */
  executionId: string;

  /**
   * Success status
   */
  success: boolean;

  /**
   * Final workflow state
   */
  state: WorkflowState;

  /**
   * Execution duration in milliseconds
   */
  durationMs: number;

  /**
   * Number of steps executed
   */
  stepsExecuted: number;

  /**
   * Final result
   */
  result?: unknown;

  /**
   * All step results
   */
  stepResults: Map<string, unknown>;

  /**
   * Error if failed
   */
  error?: Error;
}

/**
 * Workflow executor function
 */
export type WorkflowExecutor = (
  agentId: string,
  task: string,
  context: WorkflowExecutionContext
) => Promise<unknown>;

/**
 * Workflows class
 *
 * Provides workflow definition and execution for multi-agent systems.
 */
export class Workflows {
  private logger: Logger;
  private workflows: Map<string, WorkflowConfig> = new Map();
  private executions: Map<string, WorkflowExecutionContext> = new Map();
  private executor: WorkflowExecutor;

  constructor(executor: WorkflowExecutor, logger?: Logger) {
    this.executor = executor;
    this.logger = logger || new Logger();
    this.logger.info('Workflows initialized', 'Workflows');
  }

  /**
   * Register a workflow
   *
   * @param config - Workflow configuration
   */
  registerWorkflow(config: WorkflowConfig): void {
    this.workflows.set(config.workflowId, config);

    this.logger.info(
      `Registered workflow: ${config.name}`,
      'Workflows',
      { workflowId: config.workflowId, steps: config.steps.length }
    );
  }

  /**
   * Get workflow configuration
   *
   * @param workflowId - Workflow ID
   * @returns Workflow configuration or undefined
   */
  getWorkflow(workflowId: string): WorkflowConfig | undefined {
    return this.workflows.get(workflowId);
  }

  /**
   * Get all workflows
   *
   * @returns Array of workflow configurations
   */
  getAllWorkflows(): WorkflowConfig[] {
    return Array.from(this.workflows.values());
  }

  /**
   * Execute a workflow
   *
   * @param workflowId - Workflow ID
   * @param initialVariables - Initial variables
   * @returns Workflow execution result
   */
  async executeWorkflow(
    workflowId: string,
    initialVariables: Map<string, unknown> = new Map()
  ): Promise<WorkflowExecutionResult> {
    const config = this.workflows.get(workflowId);

    if (!config) {
      throw new AgentError(
        `Workflow not found: ${workflowId}`,
        'Workflows',
        { workflowId }
      );
    }

    const executionId = this.generateExecutionId();
    const startTime = Date.now();

    this.logger.info(
      `Executing workflow: ${config.name}`,
      'Workflows',
      { workflowId, executionId }
    );

    try {
      // Create execution context
      const context: WorkflowExecutionContext = {
        workflowId,
        executionId,
        currentStepId: config.startStepId,
        state: WorkflowState.RUNNING,
        stepResults: new Map(),
        variables: new Map(initialVariables),
        startedAt: new Date(),
        iteration: 0,
      };

      // Store context
      this.executions.set(executionId, context);

      // Execute workflow with timeout
      const result = await this.executeWithTimeout(
        config,
        context,
        startTime
      );

      const durationMs = Date.now() - startTime;

      const executionResult: WorkflowExecutionResult = {
        workflowId,
        executionId,
        success: result.success,
        state: context.state,
        durationMs,
        stepsExecuted: context.stepResults.size,
        result: result.data,
        stepResults: context.stepResults,
        error: result.error,
      };

      this.logger.info(
        `Workflow execution completed: ${config.name}`,
        'Workflows',
        { executionId, durationMs, success: result.success }
      );

      return executionResult;
    } catch (error) {
      const durationMs = Date.now() - startTime;

      const executionResult: WorkflowExecutionResult = {
        workflowId,
        executionId,
        success: false,
        state: WorkflowState.FAILED,
        durationMs,
        stepsExecuted: 0,
        error: error as Error,
        stepResults: new Map(),
      };

      this.logger.error(
        `Workflow execution failed: ${config.name}`,
        'Workflows',
        { executionId, durationMs, error: (error as Error).message }
      );

      return executionResult;
    }
  }

  /**
   * Execute workflow with timeout
   *
   * @param config - Workflow configuration
   * @param context - Execution context
   * @param startTime - Start time
   * @returns Execution result
   */
  private async executeWithTimeout(
    config: WorkflowConfig,
    context: WorkflowExecutionContext,
    startTime: number
  ): Promise<{ success: boolean; data?: unknown; error?: Error }> {
    if (config.timeoutMs) {
      return Promise.race([
        this.executeWorkflowSteps(config, context),
        new Promise<{ success: boolean; error: Error }>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(`Workflow timeout after ${config.timeoutMs}ms`)
              ),
            config.timeoutMs
          )
        ),
      ]);
    }

    return this.executeWorkflowSteps(config, context);
  }

  /**
   * Execute workflow steps
   *
   * @param config - Workflow configuration
   * @param context - Execution context
   * @returns Execution result
   */
  private async executeWorkflowSteps(
    config: WorkflowConfig,
    context: WorkflowExecutionContext
  ): Promise<{ success: boolean; data?: unknown; error?: Error }> {
    let currentStepId: string | undefined = config.startStepId;
    const visitedSteps = new Set<string>();

    while (currentStepId && !visitedSteps.has(currentStepId)) {
      visitedSteps.add(currentStepId);
      const step = config.steps.find((s) => s.stepId === currentStepId);

      if (!step) {
        context.state = WorkflowState.FAILED;
        return {
          success: false,
          error: new Error(`Step not found: ${currentStepId}`),
        };
      }

      context.currentStepId = currentStepId;

      const stepResult = await this.executeStep(step, context, config);

      if (!stepResult.success) {
        // Handle failure
        if (step.onFailure) {
          currentStepId = step.onFailure;
          continue;
        }

        context.state = WorkflowState.FAILED;
        return {
          success: false,
          error: stepResult.error,
        };
      }

      // Store step result
      context.stepResults.set(currentStepId, stepResult.data);

      // Determine next step
      switch (step.type) {
        case WorkflowStepType.EXECUTE:
          currentStepId = step.nextStep;
          break;

        case WorkflowStepType.WAIT:
          if (step.waitCondition) {
            const shouldContinue = await this.evaluateCondition(
              step.waitCondition,
              context
            );
            if (shouldContinue) {
              currentStepId = step.nextStep;
            } else {
              // Keep waiting
              await this.delay(100);
            }
          } else {
            currentStepId = step.nextStep;
          }
          break;

        case WorkflowStepType.BRANCH:
          if (step.branches) {
            currentStepId = await this.selectBranch(step.branches, context);
          } else {
            currentStepId = step.nextStep;
          }
          break;

        case WorkflowStepType.LOOP:
          if (step.loopCondition) {
            const shouldLoop = await this.evaluateCondition(
              step.loopCondition,
              context
            );
            const maxIter = step.maxIterations ?? 10;
            if (shouldLoop && context.iteration < maxIter) {
              context.iteration++;
              // Stay on this step
            } else {
              currentStepId = step.nextStep;
              context.iteration = 0;
            }
          } else {
            currentStepId = step.nextStep;
          }
          break;

        case WorkflowStepType.PARALLEL:
          if (step.parallelSteps) {
            const parallelResults = await this.executeParallelSteps(
              step.parallelSteps,
              context,
              config
            );

            // Merge results
            if (step.mergeStrategy === 'concat') {
              context.variables.set(
                `parallel_${step.stepId}`,
                Array.from(parallelResults.values())
              );
            } else if (step.mergeStrategy === 'merge') {
              context.variables.set(
                `parallel_${step.stepId}`,
                Object.assign({}, ...parallelResults.values())
              );
            }

            currentStepId = step.nextStep;
          } else {
            currentStepId = step.nextStep;
          }
          break;

        case WorkflowStepType.MERGE:
          currentStepId = step.nextStep;
          break;

        default:
          currentStepId = step.nextStep;
      }
    }

    // Mark workflow as completed
    context.state = WorkflowState.COMPLETED;

    return {
      success: true,
      data: context.variables.get('result'),
    };
  }

  /**
   * Execute a single step
   *
   * @param step - Step to execute
   * @param context - Execution context
   * @param config - Workflow configuration
   * @returns Step execution result
   */
  private async executeStep(
    step: WorkflowStep,
    context: WorkflowExecutionContext,
    config: WorkflowConfig
  ): Promise<{ success: boolean; data?: unknown; error?: Error }> {
    try {
      if (step.type === WorkflowStepType.EXECUTE && step.agentId && step.task) {
        const result = await this.executor(step.agentId, step.task, context);

        context.variables.set(`step_${step.stepId}`, result);

        return { success: true, data: result };
      }

      return { success: true };
    } catch (error) {
      // Retry logic
      if (config.retryOnFailure && config.maxRetries) {
        const retries = context.variables.get(
          `retries_${step.stepId}`
        ) as number ?? 0;

        if (retries < config.maxRetries) {
          context.variables.set(`retries_${step.stepId}`, retries + 1);
          await this.delay(1000); // Retry delay
          return this.executeStep(step, context, config);
        }
      }

      return {
        success: false,
        error: error as Error,
      };
    }
  }

  /**
   * Execute parallel steps
   *
   * @param stepIds - Step IDs to execute
   * @param context - Execution context
   * @param config - Workflow configuration
   * @returns Map of step results
   */
  private async executeParallelSteps(
    stepIds: string[],
    context: WorkflowExecutionContext,
    config: WorkflowConfig
  ): Promise<Map<string, unknown>> {
    const results = new Map<string, unknown>();

    if (config.executionMode === 'parallel') {
      // Execute all in parallel
      const promises = stepIds.map(async (stepId) => {
        const step = config.steps.find((s) => s.stepId === stepId);
        if (!step) return { stepId, data: undefined };

        const result = await this.executeStep(step, context, config);
        return { stepId, data: result.data };
      });

      const parallelResults = await Promise.all(promises);
      parallelResults.forEach(({ stepId, data }) => {
        results.set(stepId, data);
      });
    } else {
      // Execute sequentially (mixed mode)
      for (const stepId of stepIds) {
        const step = config.steps.find((s) => s.stepId === stepId);
        if (!step) continue;

        const result = await this.executeStep(step, context, config);
        results.set(stepId, result.data);
      }
    }

    return results;
  }

  /**
   * Select branch based on conditions
   *
   * @param branches - Branch conditions
   * @param context - Execution context
   * @returns Selected step ID
   */
  private async selectBranch(
    branches: Map<string, string>,
    context: WorkflowExecutionContext
  ): Promise<string | undefined> {
    for (const [condition, stepId] of branches.entries()) {
      const shouldTake = await this.evaluateCondition(condition, context);
      if (shouldTake) {
        return stepId;
      }
    }
    return undefined;
  }

  /**
   * Evaluate a condition
   *
   * @param condition - Condition string
   * @param context - Execution context
   * @returns Whether condition is true
   */
  private async evaluateCondition(
    condition: string,
    context: WorkflowExecutionContext
  ): Promise<boolean> {
    // Simple condition evaluation
    // In production, this would use a proper expression parser

    // Check variable existence
    if (condition.startsWith('var:')) {
      const varName = condition.substring(4);
      return context.variables.has(varName);
    }

    // Check step result
    if (condition.startsWith('step:')) {
      const stepId = condition.substring(5);
      return context.stepResults.has(stepId);
    }

    // Check iteration count
    if (condition.startsWith('iteration:')) {
      const maxIter = parseInt(condition.substring(10), 10);
      return context.iteration < maxIter;
    }

    // Default to true
    return true;
  }

  /**
   * Get execution context
   *
   * @param executionId - Execution ID
   * @returns Execution context or undefined
   */
  getExecutionContext(executionId: string): WorkflowExecutionContext | undefined {
    return this.executions.get(executionId);
  }

  /**
   * Get all executions
   *
   * @param filter - Optional filter
   * @returns Array of execution contexts
   */
  getAllExecutions(filter?: {
    workflowId?: string;
    state?: WorkflowState;
  }): WorkflowExecutionContext[] {
    let executions = Array.from(this.executions.values());

    if (filter?.workflowId) {
      executions = executions.filter((e) => e.workflowId === filter.workflowId);
    }

    if (filter?.state) {
      executions = executions.filter((e) => e.state === filter.state);
    }

    return executions;
  }

  /**
   * Cancel a running workflow
   *
   * @param executionId - Execution ID
   * @returns True if cancelled
   */
  cancelWorkflow(executionId: string): boolean {
    const context = this.executions.get(executionId);

    if (context && context.state === WorkflowState.RUNNING) {
      context.state = WorkflowState.CANCELLED;

      this.logger.info(
        `Workflow cancelled: ${executionId}`,
        'Workflows'
      );

      return true;
    }

    return false;
  }

  /**
   * Pause a running workflow
   *
   * @param executionId - Execution ID
   * @returns True if paused
   */
  pauseWorkflow(executionId: string): boolean {
    const context = this.executions.get(executionId);

    if (context && context.state === WorkflowState.RUNNING) {
      context.state = WorkflowState.PAUSED;

      this.logger.info(
        `Workflow paused: ${executionId}`,
        'Workflows'
      );

      return true;
    }

    return false;
  }

  /**
   * Resume a paused workflow
   *
   * @param executionId - Execution ID
   * @returns True if resumed
   */
  resumeWorkflow(executionId: string): boolean {
    const context = this.executions.get(executionId);

    if (context && context.state === WorkflowState.PAUSED) {
      context.state = WorkflowState.RUNNING;

      this.logger.info(
        `Workflow resumed: ${executionId}`,
        'Workflows'
      );

      return true;
    }

    return false;
  }

  /**
   * Unregister a workflow
   *
   * @param workflowId - Workflow ID
   * @returns True if workflow was removed
   */
  unregisterWorkflow(workflowId: string): boolean {
    const removed = this.workflows.delete(workflowId);

    if (removed) {
      this.logger.info(
        `Unregistered workflow: ${workflowId}`,
        'Workflows'
      );
    }

    return removed;
  }

  /**
   * Clear all workflows
   */
  clearWorkflows(): void {
    this.workflows.clear();
    this.logger.debug('All workflows cleared', 'Workflows');
  }

  /**
   * Clear all executions
   */
  clearExecutions(): void {
    this.executions.clear();
    this.logger.debug('All executions cleared', 'Workflows');
  }

  /**
   * Get workflow statistics
   *
   * @returns Statistics about workflows
   */
  getStatistics(): {
    totalWorkflows: number;
    totalExecutions: number;
    activeExecutions: number;
    avgStepsPerWorkflow: number;
    successRate: number;
  } {
    const executions = Array.from(this.executions.values());
    const activeExecutions = executions.filter(
      (e) => e.state === WorkflowState.RUNNING
    ).length;
    const completedExecutions = executions.filter(
      (e) => e.state === WorkflowState.COMPLETED
    ).length;
    const successRate =
      executions.length > 0 ? completedExecutions / executions.length : 1.0;
    const avgStepsPerWorkflow =
      executions.length > 0
        ? executions.reduce((sum, e) => sum + e.stepResults.size, 0) /
          executions.length
        : 0;

    return {
      totalWorkflows: this.workflows.size,
      totalExecutions: this.executions.size,
      activeExecutions,
      avgStepsPerWorkflow,
      successRate,
    };
  }

  /**
   * Delay for retry
   *
   * @param ms - Milliseconds to delay
   * @returns Promise that resolves after delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Generate execution ID
   *
   * @returns Execution ID
   */
  private generateExecutionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `wf_exec_${timestamp}_${random}`;
  }
}

/**
 * Schema for workflow step
 */
export const WorkflowStepSchema = z.object({
  stepId: z.string(),
  type: z.nativeEnum(WorkflowStepType),
  agentId: z.string().optional(),
  task: z.string().optional(),
  waitCondition: z.string().optional(),
  branches: z.map(z.string(), z.string()).optional(),
  loopCondition: z.string().optional(),
  maxIterations: z.number().min(1).optional(),
  parallelSteps: z.array(z.string()).optional(),
  mergeStrategy: z.enum(['concat', 'merge', 'custom']).optional(),
  nextStep: z.string().optional(),
  onFailure: z.string().optional(),
  timeoutMs: z.number().min(0).optional(),
});

/**
 * Schema for workflow configuration
 */
export const WorkflowConfigSchema = z.object({
  workflowId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  steps: z.array(WorkflowStepSchema).min(1),
  startStepId: z.string(),
  executionMode: z.enum(['sequential', 'parallel', 'mixed']),
  persistState: z.boolean().optional(),
  retryOnFailure: z.boolean().optional(),
  maxRetries: z.number().min(0).optional(),
  timeoutMs: z.number().min(0).optional(),
});

/**
 * Global workflows instance
 */
let globalWorkflows: Workflows | null = null;

/**
 * Initialize global workflows
 *
 * @param executor - Workflow executor function
 * @param logger - Optional logger instance
 * @returns The global workflows
 */
export function initWorkflows(
  executor: WorkflowExecutor,
  logger?: Logger
): Workflows {
  globalWorkflows = new Workflows(executor, logger);
  return globalWorkflows;
}

/**
 * Get global workflows
 *
 * @returns The global workflows
 */
export function getWorkflows(): Workflows | null {
  return globalWorkflows;
}
