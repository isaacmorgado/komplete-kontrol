/**
 * Agent Orchestrator for KOMPLETE-KONTROL CLI
 *
 * Provides multi-agent orchestration capabilities including task distribution,
 * agent selection, and coordination across multiple agents.
 * Follows patterns from agent-swarm-kit with simplified architecture.
 */

import type { AgentDefinition, AgentError, AgentTask, AgentTaskResult } from '../../types';
import { Logger, LoggerLike } from '../../utils/logger';
import { ErrorHandler } from '../../utils/error-handler';
import { AgentRegistry, getAgentRegistry } from './registry';
import {
  AgentLifecycleManager,
  getAgentLifecycleManager,
  AgentLifecycleState,
} from './lifecycle';
import { AgentExecutor, getAgentExecutor } from './executor';

/**
 * Task priority levels
 */
export enum TaskPriority {
  /**
   * Low priority task
   */
  LOW = 0,
  /**
   * Normal priority task
   */
  NORMAL = 1,
  /**
   * High priority task
   */
  HIGH = 2,
  /**
   * Critical priority task
   */
  CRITICAL = 3,
}

/**
 * Task status
 */
export enum TaskStatus {
  /**
   * Task is pending
   */
  PENDING = 'pending',
  /**
   * Task is assigned to an agent
   */
  ASSIGNED = 'assigned',
  /**
   * Task is being executed
   */
  EXECUTING = 'executing',
  /**
   * Task completed successfully
   */
  COMPLETED = 'completed',
  /**
   * Task failed
   */
  FAILED = 'failed',
  /**
   * Task was cancelled
   */
  CANCELLED = 'cancelled',
}

/**
 * Orchestrated task
 */
export interface OrchestratedTask extends AgentTask {
  /**
   * Task ID
   */
  id: string;
  /**
   * Task priority
   */
  priority: TaskPriority;
  /**
   * Task status
   */
  status: TaskStatus;
  /**
   * Assigned agent ID
   */
  assignedAgent?: string;
  /**
   * Task creation time
   */
  createdAt: Date;
  /**
   * Task start time
   */
  startedAt?: Date;
  /**
   * Task completion time
   */
  completedAt?: Date;
  /**
   * Task error (if any)
   */
  error?: Error;
  /**
   * Retry count
   */
  retryCount: number;
  /**
   * Maximum retries
   */
  maxRetries: number;
}

/**
 * Agent selection strategy
 */
export enum AgentSelectionStrategy {
  /**
   * Select first available agent
   */
  FIRST_AVAILABLE = 'first_available',
  /**
   * Select agent with highest priority
   */
  HIGHEST_PRIORITY = 'highest_priority',
  /**
   * Select least recently used agent
   */
  LEAST_RECENTLY_USED = 'least_recently_used',
  /**
   * Round-robin selection
   */
  ROUND_ROBIN = 'round_robin',
}

/**
 * Agent selection criteria
 */
export interface AgentSelectionCriteria {
  /**
   * Required capability
   */
  capability?: string;
  /**
   * Required tag
   */
  tag?: string;
  /**
   * Selection strategy
   */
  strategy?: AgentSelectionStrategy;
  /**
   * Exclude specific agents
   */
  exclude?: string[];
}

/**
 * Orchestrator configuration
 */
export interface AgentOrchestratorConfig {
  /**
   * Maximum concurrent tasks
   */
  maxConcurrentTasks?: number;
  /**
   * Default task timeout in milliseconds
   */
  defaultTaskTimeout?: number;
  /**
   * Default task priority
   */
  defaultTaskPriority?: TaskPriority;
  /**
   * Default agent selection strategy
   */
  defaultSelectionStrategy?: AgentSelectionStrategy;
  /**
   * Enable task retry on failure
   */
  enableRetry?: boolean;
  /**
   * Maximum retry attempts
   */
  maxRetryAttempts?: number;
}

/**
 * Agent Orchestrator class
 *
 * Coordinates multiple agents for task distribution and execution.
 * Provides agent selection, task scheduling, and coordination capabilities.
 */
export class AgentOrchestrator {
  private tasks: Map<string, OrchestratedTask> = new Map();
  private taskQueue: OrchestratedTask[] = [];
  private executingTasks: Set<string> = new Set();
  private roundRobinIndex: number = 0;
  private logger: LoggerLike;
  private errorHandler: ErrorHandler;
  private registry: AgentRegistry;
  private lifecycleManager: AgentLifecycleManager;
  private config: Required<AgentOrchestratorConfig>;

  constructor(
    config: AgentOrchestratorConfig = {},
    logger?: Logger,
    errorHandler?: ErrorHandler,
    registry?: AgentRegistry,
    lifecycleManager?: AgentLifecycleManager
  ) {
    this.logger = logger || new Logger();
    this.errorHandler = errorHandler || new ErrorHandler();
    this.registry = registry || getAgentRegistry();
    this.lifecycleManager = lifecycleManager || getAgentLifecycleManager();
    this.config = {
      maxConcurrentTasks: config.maxConcurrentTasks ?? 5,
      defaultTaskTimeout: config.defaultTaskTimeout ?? 30000,
      defaultTaskPriority: config.defaultTaskPriority ?? TaskPriority.NORMAL,
      defaultSelectionStrategy: config.defaultSelectionStrategy ?? AgentSelectionStrategy.HIGHEST_PRIORITY,
      enableRetry: config.enableRetry ?? true,
      maxRetryAttempts: config.maxRetryAttempts ?? 3,
    };
    this.logger.info('AgentOrchestrator initialized', 'AgentOrchestrator');
  }

  /**
   * Submit a task for execution
   *
   * @param task - Task to submit
   * @param priority - Task priority (uses default if not specified)
   * @returns Task ID
   */
  submitTask(task: AgentTask, priority?: TaskPriority): string {
    const taskId = this.generateTaskId();

    const orchestratedTask: OrchestratedTask = {
      ...task,
      id: taskId,
      priority: priority ?? this.config.defaultTaskPriority,
      status: TaskStatus.PENDING,
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: this.config.maxRetryAttempts,
    };

    this.tasks.set(taskId, orchestratedTask);
    this.taskQueue.push(orchestratedTask);

    // Sort queue by priority (descending) then by creation time (ascending)
    this.taskQueue.sort((a, b) => {
      const priorityDiff = b.priority - a.priority;
      if (priorityDiff !== 0) return priorityDiff;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    this.logger.info(
      `Task submitted: ${taskId}`,
      'AgentOrchestrator',
      {
        description: task.description,
        priority: orchestratedTask.priority,
      }
    );

    // Process queue
    this.processQueue();

    return taskId;
  }

  /**
   * Get a task by ID
   *
   * @param taskId - ID of task to get
   * @returns Orchestrated task or undefined if not found
   */
  getTask(taskId: string): OrchestratedTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks
   *
   * @param status - Optional status filter
   * @returns Array of orchestrated tasks
   */
  getTasks(status?: TaskStatus): OrchestratedTask[] {
    const tasks = Array.from(this.tasks.values());

    if (status) {
      return tasks.filter((task) => task.status === status);
    }

    return tasks;
  }

  /**
   * Cancel a task
   *
   * @param taskId - ID of task to cancel
   * @returns True if task was cancelled, false if not found or already completed
   */
  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);

    if (!task) {
      this.logger.warn(`Task not found for cancellation: ${taskId}`, 'AgentOrchestrator');
      return false;
    }

    if (
      task.status === TaskStatus.COMPLETED ||
      task.status === TaskStatus.FAILED ||
      task.status === TaskStatus.CANCELLED
    ) {
      this.logger.debug(
        `Task already completed/failed/cancelled: ${taskId}`,
        'AgentOrchestrator'
      );
      return false;
    }

    // Remove from queue if pending
    if (task.status === TaskStatus.PENDING) {
      const index = this.taskQueue.indexOf(task);
      if (index > -1) {
        this.taskQueue.splice(index, 1);
      }
    }

    // Remove from executing set if executing
    if (task.status === TaskStatus.EXECUTING) {
      this.executingTasks.delete(taskId);
    }

    // Update task status
    task.status = TaskStatus.CANCELLED;
    task.completedAt = new Date();

    this.logger.info(`Task cancelled: ${taskId}`, 'AgentOrchestrator');

    // Process queue to potentially start next task
    this.processQueue();

    return true;
  }

  /**
   * Select an agent for task execution
   *
   * @param criteria - Agent selection criteria
   * @returns Selected agent ID or undefined if no agent available
   */
  selectAgent(criteria: AgentSelectionCriteria = {}): string | undefined {
    const {
      capability,
      tag,
      strategy = this.config.defaultSelectionStrategy,
      exclude = [],
    } = criteria;

    // Get available agents
    let agents = this.registry.list();

    // Filter by capability
    if (capability) {
      agents = agents.filter((agent) => agent.capabilities.includes(capability));
    }

    // Filter by tag
    if (tag) {
      agents = agents.filter((agent) => agent.tags?.includes(tag));
    }

    // Filter by active state
    agents = agents.filter((agent) => {
      const state = this.lifecycleManager.getState(agent.id);
      return state === AgentLifecycleState.RUNNING;
    });

    // Exclude specific agents
    agents = agents.filter((agent) => !exclude.includes(agent.id));

    if (agents.length === 0) {
      this.logger.warn(
        'No available agents matching criteria',
        'AgentOrchestrator',
        { capability, tag, exclude }
      );
      return undefined;
    }

    // Apply selection strategy
    switch (strategy) {
      case AgentSelectionStrategy.FIRST_AVAILABLE:
        return agents[0]!.id;

      case AgentSelectionStrategy.HIGHEST_PRIORITY:
        // Already sorted by priority in registry
        return agents[0]!.id;

      case AgentSelectionStrategy.LEAST_RECENTLY_USED:
        // Find agent with oldest lastUsed timestamp
        // For now, just return the first agent as a simplification
        // In a full implementation, we'd track lastUsed timestamps
        return agents[0]!.id;

      case AgentSelectionStrategy.ROUND_ROBIN:
        const selected = agents[this.roundRobinIndex % agents.length]!;
        this.roundRobinIndex++;
        return selected.id;

      default:
        return agents[0]!.id;
    }
  }

  /**
   * Process task queue
   */
  private processQueue(): void {
    // Check if we can execute more tasks
    while (
      this.taskQueue.length > 0 &&
      this.executingTasks.size < this.config.maxConcurrentTasks
    ) {
      const task = this.taskQueue.shift();
      if (!task) break;

      // Select an agent for the task
      const agentId = this.selectAgent({
        capability: task.requiredCapability,
      });

      if (!agentId) {
        // No agent available, put task back in queue
        this.taskQueue.unshift(task);
        break;
      }

      // Assign task to agent
      this.assignTask(task, agentId);
    }
  }

  /**
   * Assign a task to an agent
   *
   * @param task - Task to assign
   * @param agentId - Agent ID to assign to
   */
  private assignTask(task: OrchestratedTask, agentId: string): void {
    task.status = TaskStatus.ASSIGNED;
    task.assignedAgent = agentId;

    this.logger.info(
      `Task assigned: ${task.id} -> ${agentId}`,
      'AgentOrchestrator'
    );

    // Execute task
    this.executeTask(task);
  }

  /**
   * Execute a task
   *
   * @param task - Task to execute
   */
  private async executeTask(task: OrchestratedTask): Promise<void> {
    task.status = TaskStatus.EXECUTING;
    task.startedAt = new Date();
    this.executingTasks.add(task.id);

    this.logger.info(
      `Task executing: ${task.id}`,
      'AgentOrchestrator',
      { agentId: task.assignedAgent }
    );

    try {
      // Execute task with timeout
      const result = await this.executeWithTimeout(
        this.performTaskExecution(task),
        this.config.defaultTaskTimeout
      );

      // Mark task as completed
      task.status = TaskStatus.COMPLETED;
      task.completedAt = new Date();

      this.logger.info(
        `Task completed: ${task.id}`,
        'AgentOrchestrator',
        {
          agentId: task.assignedAgent,
          duration: task.completedAt.getTime() - task.startedAt!.getTime(),
        }
      );

      // Mark agent as used
      if (task.assignedAgent) {
        this.registry.markUsed(task.assignedAgent);
      }
    } catch (error) {
      task.error = error as Error;

      // Check if we should retry
      if (
        this.config.enableRetry &&
        task.retryCount < task.maxRetries
      ) {
        task.retryCount++;
        task.status = TaskStatus.PENDING;
        task.assignedAgent = undefined;
        task.startedAt = undefined;

        this.taskQueue.push(task);

        this.logger.warn(
          `Task failed, retrying (${task.retryCount}/${task.maxRetries}): ${task.id}`,
          'AgentOrchestrator',
          { error: (error as Error).message }
        );
      } else {
        task.status = TaskStatus.FAILED;
        task.completedAt = new Date();

        this.logger.error(
          `Task failed: ${task.id}`,
          'AgentOrchestrator',
          {
            agentId: task.assignedAgent,
            error: (error as Error).message,
          }
        );
      }
    } finally {
      this.executingTasks.delete(task.id);

      // Process queue to potentially start next task
      this.processQueue();
    }
  }

  /**
   * Perform actual task execution using AgentExecutor
   *
   * @param task - Task to execute
   * @returns Task result
   */
  private async performTaskExecution(task: OrchestratedTask): Promise<AgentTaskResult> {
    const executor = getAgentExecutor();

    // Build execution context
    const context = await executor.buildContext(task);

    // Execute the task
    const result = await executor.execute(context);

    this.logger.debug('Task execution completed', 'AgentOrchestrator', {
      taskId: task.id,
      success: result.success,
      iterations: result.iterations,
      durationMs: result.durationMs,
      tokenUsage: result.usage,
    });

    return {
      taskId: task.id,
      success: result.success,
      output: result.output,
      error: result.error?.message,
      metadata: {
        agentId: task.assignedAgent,
        iterations: result.iterations,
        durationMs: result.durationMs,
        usage: result.usage,
        toolCalls: result.toolCalls.map((tc) => ({
          name: tc.toolName,
          success: tc.success,
          durationMs: tc.durationMs,
        })),
      },
    };
  }

  /**
   * Execute with timeout
   *
   * @param promise - Promise to execute
   * @param timeout - Timeout in milliseconds
   * @returns Promise result
   * @throws Error if timeout is exceeded
   */
  private async executeWithTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Task execution timeout after ${timeout}ms`));
      }, timeout);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Generate unique task ID
   *
   * @returns Unique task ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get orchestrator statistics
   *
   * @returns Orchestrator statistics
   */
  getStatistics(): {
    totalTasks: number;
    pendingTasks: number;
    executingTasks: number;
    completedTasks: number;
    failedTasks: number;
    cancelledTasks: number;
  } {
    const tasks = Array.from(this.tasks.values());

    return {
      totalTasks: tasks.length,
      pendingTasks: tasks.filter((t) => t.status === TaskStatus.PENDING).length,
      executingTasks: tasks.filter((t) => t.status === TaskStatus.EXECUTING).length,
      completedTasks: tasks.filter((t) => t.status === TaskStatus.COMPLETED).length,
      failedTasks: tasks.filter((t) => t.status === TaskStatus.FAILED).length,
      cancelledTasks: tasks.filter((t) => t.status === TaskStatus.CANCELLED).length,
    };
  }

  /**
   * Clear all tasks
   */
  clearTasks(): void {
    this.tasks.clear();
    this.taskQueue = [];
    this.executingTasks.clear();
    this.logger.info('AgentOrchestrator tasks cleared', 'AgentOrchestrator');
  }
}

/**
 * Global agent orchestrator instance
 */
let globalAgentOrchestrator: AgentOrchestrator | null = null;

/**
 * Initialize global agent orchestrator
 *
 * @param config - Orchestrator configuration
 * @param logger - Optional logger instance
 * @param errorHandler - Optional error handler instance
 * @param registry - Optional agent registry instance
 * @param lifecycleManager - Optional lifecycle manager instance
 * @returns The global agent orchestrator
 */
export function initAgentOrchestrator(
  config?: AgentOrchestratorConfig,
  logger?: Logger,
  errorHandler?: ErrorHandler,
  registry?: AgentRegistry,
  lifecycleManager?: AgentLifecycleManager
): AgentOrchestrator {
  globalAgentOrchestrator = new AgentOrchestrator(
    config,
    logger,
    errorHandler,
    registry,
    lifecycleManager
  );
  return globalAgentOrchestrator;
}

/**
 * Get global agent orchestrator
 *
 * @returns The global agent orchestrator
 */
export function getAgentOrchestrator(): AgentOrchestrator {
  if (!globalAgentOrchestrator) {
    globalAgentOrchestrator = new AgentOrchestrator();
  }
  return globalAgentOrchestrator;
}
