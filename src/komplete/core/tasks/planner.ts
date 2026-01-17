/**
 * Task Planner - Task Planning and Decomposition
 *
 * Provides task planning capabilities including:
 * - Task decomposition into subtasks
 * - Dependency analysis
 * - Task prioritization
 * - Execution planning
 */

import { Logger, LoggerLike } from '../../utils/logger';
import type { Task, TaskPriority, TaskStatus } from '../../types';

/**
 * Subtask definition
 */
export interface Subtask extends Task {
  /** Parent task ID */
  parentId: string;
  /** Subtask ID (e.g., "1.2" for subtask 2 of task 1) */
  subtaskId: string;
  /** Estimated completion time in milliseconds */
  estimatedDuration?: number;
}

/**
 * Task dependency definition
 */
export interface TaskDependency {
  /** Task ID that depends on another task */
  taskId: string;
  /** Task IDs this task depends on */
  dependsOn: string[];
  /** Dependency type */
  type: 'hard' | 'soft';
}

/**
 * Task plan with decomposed subtasks
 */
export interface TaskPlan {
  /** Original task */
  task: Task;
  /** Decomposed subtasks */
  subtasks: Subtask[];
  /** Dependencies between tasks */
  dependencies: TaskDependency[];
  /** Execution order (topologically sorted) */
  executionOrder: string[];
  /** Estimated total duration */
  estimatedTotalDuration: number;
}

/**
 * Task decomposition options
 */
export interface TaskDecompositionOptions {
  /** Maximum depth of decomposition */
  maxDepth?: number;
  /** Maximum number of subtasks */
  maxSubtasks?: number;
  /** Enable parallel execution of independent tasks */
  enableParallel?: boolean;
  /** Custom decomposition strategy */
  strategy?: 'sequential' | 'parallel' | 'hierarchical';
}

/**
 * Task planner configuration
 */
export interface TaskPlannerConfig {
  /** Maximum number of concurrent tasks */
  maxConcurrentTasks?: number;
  /** Default task timeout in milliseconds */
  defaultTimeout?: number;
  /** Enable task caching */
  enableCaching?: boolean;
}

/**
 * Task planner for planning and decomposing tasks
 *
 * Inspired by patterns from taskmaster-cli:
 * - Hierarchical task IDs (e.g., "1.2" for subtask 2 of task 1)
 * - Dependency validation and circular dependency detection
 * - Task-to-subtask conversion with validation
 */
export class TaskPlanner {
  private logger: LoggerLike;
  private config: TaskPlannerConfig;
  private taskCounter = 0;
  private planCache = new Map<string, TaskPlan>();

  constructor(config?: TaskPlannerConfig, logger?: LoggerLike) {
    this.config = {
      maxConcurrentTasks: 5,
      defaultTimeout: 30000,
      enableCaching: true,
      ...config,
    };
    this.logger = logger?.child('TaskPlanner') ?? new Logger().child('TaskPlanner');
  }

  /**
   * Plan a task by decomposing it into subtasks
   *
   * @param task - Task to plan
   * @param options - Decomposition options
   * @returns Task plan
   */
  async planTask(
    task: Task,
    options: TaskDecompositionOptions = {}
  ): Promise<TaskPlan> {
    const {
      maxDepth = 3,
      maxSubtasks = 10,
      enableParallel = true,
      strategy = 'hierarchical',
    } = options;

    // Check cache first
    const cacheKey = this.getCacheKey(task, options);
    if (this.config.enableCaching && this.planCache.has(cacheKey)) {
      this.logger.debug(`Cache hit for task: ${task.id}`);
      return this.planCache.get(cacheKey)!;
    }

    this.logger.info(`Planning task: ${task.id} - ${task.description}`);

    // Decompose task into subtasks
    const subtasks = await this.decomposeTask(task, {
      maxDepth,
      maxSubtasks,
      strategy,
    });

    // Analyze dependencies
    const dependencies = this.analyzeDependencies(task, subtasks);

    // Determine execution order
    const executionOrder = this.topologicalSort(subtasks, dependencies);

    // Calculate estimated duration
    const estimatedTotalDuration = this.calculateEstimatedDuration(subtasks);

    const plan: TaskPlan = {
      task,
      subtasks,
      dependencies,
      executionOrder,
      estimatedTotalDuration,
    };

    // Cache the plan
    if (this.config.enableCaching) {
      this.planCache.set(cacheKey, plan);
    }

    this.logger.info(
      `Task plan created: ${subtasks.length} subtasks, ` +
      `${dependencies.length} dependencies, ` +
      `estimated duration: ${estimatedTotalDuration}ms`
    );

    return plan;
  }

  /**
   * Decompose a task into subtasks
   *
   * @param task - Task to decompose
   * @param options - Decomposition options
   * @returns Array of subtasks
   */
  private async decomposeTask(
    task: Task,
    options: Omit<TaskDecompositionOptions, 'strategy'>
  ): Promise<Subtask[]> {
    const { maxDepth, maxSubtasks } = options;

    // Simple decomposition based on task type
    const subtasks: Subtask[] = [];

    // If task is already simple enough, return as single subtask
    if (task.complexity === 'simple') {
      return [{
        ...task,
        parentId: task.id,
        subtaskId: `${task.id}.1`,
        estimatedDuration: 1000,
      }];
    }

    // Decompose based on task complexity
    const numSubtasks = Math.min(
      this.getSubtaskCount(task.complexity),
      maxSubtasks
    );

    for (let i = 0; i < numSubtasks; i++) {
      const subtaskId = `${task.id}.${i + 1}`;
      const subtask: Subtask = {
        ...task,
        id: subtaskId,
        parentId: task.id,
        subtaskId,
        description: `${task.description} - Part ${i + 1}`,
        complexity: this.reduceComplexity(task.complexity),
        priority: task.priority,
        status: 'pending',
        estimatedDuration: Math.ceil(task.estimatedDuration / numSubtasks),
      };

      subtasks.push(subtask);

      // Recursively decompose if depth allows
      if (maxDepth > 1 && subtask.complexity !== 'simple') {
        const nestedSubtasks = await this.decomposeTask(subtask, {
          maxDepth: maxDepth - 1,
          maxSubtasks: Math.max(2, Math.floor(maxSubtasks / numSubtasks)),
        });
        subtasks.push(...nestedSubtasks);
      }
    }

    // Fix parent references for nested subtasks
    for (const subtask of subtasks) {
      const parts = subtask.subtaskId.split('.');
      if (parts.length > 2) {
        // This is a nested subtask, find its direct parent
        const parentSubtaskId = parts.slice(0, -1).join('.');
        const parentSubtask = subtasks.find(st => st.subtaskId === parentSubtaskId);
        if (parentSubtask) {
          subtask.parentId = parentSubtask.id;
        }
      }
    }

    return subtasks;
  }

  /**
   * Analyze dependencies between tasks
   *
   * @param task - Original task
   * @param subtasks - Array of subtasks
   * @returns Array of dependencies
   */
  private analyzeDependencies(
    task: Task,
    subtasks: Subtask[]
  ): TaskDependency[] {
    const dependencies: TaskDependency[] = [];

    // Build dependency graph based on task hierarchy
    for (const subtask of subtasks) {
      if (subtask.parentId !== task.id) {
        // Subtask depends on its parent
        dependencies.push({
          taskId: subtask.id,
          dependsOn: [subtask.parentId],
          type: 'hard',
        });
      }

      // Sibling dependencies based on execution order
      const subtaskNum = parseInt(subtask.subtaskId.split('.').pop() || '0');
      if (subtaskNum > 1) {
        const siblingId = `${subtask.parentId}.${subtaskNum - 1}`;
        dependencies.push({
          taskId: subtask.id,
          dependsOn: [siblingId],
          type: 'soft',
        });
      }
    }

    return dependencies;
  }

  /**
   * Topological sort for execution order
   *
   * @param subtasks - Array of subtasks
   * @param dependencies - Array of dependencies
   * @returns Execution order
   */
  private topologicalSort(
    subtasks: Subtask[],
    dependencies: TaskDependency[]
  ): string[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const order: string[] = [];

    const visit = (taskId: string): void => {
      if (visited.has(taskId)) {
        return;
      }

      if (visiting.has(taskId)) {
        this.logger.warn(`Circular dependency detected involving task: ${taskId}`);
        return;
      }

      visiting.add(taskId);

      // Visit dependencies first
      const deps = dependencies
        .filter(d => d.taskId === taskId)
        .flatMap(d => d.dependsOn);

      for (const depId of deps) {
        visit(depId);
      }

      visiting.delete(taskId);
      visited.add(taskId);
      order.push(taskId);
    };

    for (const subtask of subtasks) {
      visit(subtask.id);
    }

    return order;
  }

  /**
   * Calculate estimated total duration
   *
   * @param subtasks - Array of subtasks
   * @returns Total estimated duration
   */
  private calculateEstimatedDuration(subtasks: Subtask[]): number {
    return subtasks.reduce((total, task) => {
      return total + (task.estimatedDuration || 0);
    }, 0);
  }

  /**
   * Get number of subtasks based on complexity
   *
   * @param complexity - Task complexity
   * @returns Number of subtasks
   */
  private getSubtaskCount(complexity: Task['complexity']): number {
    switch (complexity) {
      case 'simple':
        return 1;
      case 'medium':
        return 3;
      case 'complex':
        return 5;
      case 'critical':
        return 8;
      default:
        return 3;
    }
  }

  /**
   * Reduce complexity level
   *
   * @param complexity - Current complexity
   * @returns Reduced complexity
   */
  private reduceComplexity(complexity: Task['complexity']): Task['complexity'] {
    switch (complexity) {
      case 'critical':
        return 'complex';
      case 'complex':
        return 'medium';
      case 'medium':
        return 'simple';
      case 'simple':
        return 'simple';
      default:
        return 'simple';
    }
  }

  /**
   * Get cache key for task plan
   *
   * @param task - Task
   * @param options - Decomposition options
   * @returns Cache key
   */
  private getCacheKey(
    task: Task,
    options: TaskDecompositionOptions
  ): string {
    return `${task.id}-${JSON.stringify(options)}`;
  }

  /**
   * Clear plan cache
   */
  clearCache(): void {
    this.planCache.clear();
    this.logger.debug('Plan cache cleared');
  }

  /**
   * Get cached plan for a task
   *
   * @param taskId - Task ID
   * @returns Cached plan or null
   */
  getCachedPlan(taskId: string): TaskPlan | null {
    for (const [key, plan] of this.planCache.entries()) {
      if (key.startsWith(taskId)) {
        return plan;
      }
    }
    return null;
  }

  /**
   * Get plan cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.planCache.size,
      keys: Array.from(this.planCache.keys()),
    };
  }
}

/**
 * Create a task planner instance
 *
 * @param config - Planner configuration
 * @param logger - Logger instance
 * @returns Task planner instance
 */
export function createTaskPlanner(
  config?: TaskPlannerConfig,
  logger?: Logger
): TaskPlanner {
  return new TaskPlanner(config, logger);
}

/**
 * Get global task planner instance
 *
 * @returns Global task planner
 */
let globalTaskPlanner: TaskPlanner | null = null;

export function getTaskPlanner(): TaskPlanner {
  if (!globalTaskPlanner) {
    globalTaskPlanner = createTaskPlanner();
  }
  return globalTaskPlanner;
}
