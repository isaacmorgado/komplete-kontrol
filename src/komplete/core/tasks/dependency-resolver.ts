/**
 * Task Dependency Resolver - Dependency Resolution
 *
 * Provides task dependency resolution capabilities including:
 * - Dependency graph construction
 * - Topological sorting
 * - Circular dependency detection
 * - Dependency validation
 */

import { Logger } from '../../utils/logger';
import type { Task, TaskPriority } from '../../types';
import type { Subtask, TaskDependency, TaskPlan } from './planner';

/**
 * Dependency node in the graph
 */
interface DependencyNode {
  /** Task ID */
  taskId: string;
  /** Task priority */
  priority: TaskPriority;
  /** Dependencies (task IDs that this task depends on) */
  dependencies: string[];
  /** Dependents (task IDs that depend on this task) */
  dependents: string[];
  /** Visited flag for cycle detection */
  visited: boolean;
  /** Recursion stack for cycle detection */
  inStack: boolean;
}

/**
 * Resolution result
 */
export interface ResolutionResult {
  /** Success flag */
  success: boolean;
  /** Execution order (topologically sorted) */
  executionOrder: string[];
  /** Circular dependencies found */
  circularDependencies: string[][];
  /** Unresolved dependencies */
  unresolvedDependencies: string[];
  /** Resolution metadata */
  metadata: {
    /** Total tasks */
    totalTasks: number;
    /** Resolved tasks */
    resolvedTasks: number;
    /** Resolution timestamp */
    timestamp: string;
  };
}

/**
 * Dependency validation options
 */
export interface DependencyValidationOptions {
  /** Allow circular dependencies */
  allowCircular?: boolean;
  /** Validate task existence */
  validateExistence?: boolean;
  /** Check for orphaned tasks */
  checkOrphans?: boolean;
}

/**
 * Task dependency resolver for resolving task dependencies
 *
 * Features:
 * - Dependency graph construction
 * - Topological sorting
 * - Circular dependency detection
 * - Dependency validation
 * - Priority-based ordering
 */
export class TaskDependencyResolver {
  private logger: Logger;
  private dependencyCache = new Map<string, ResolutionResult>();

  constructor(logger?: Logger) {
    this.logger = logger?.child('TaskDependencyResolver') ?? new Logger().child('TaskDependencyResolver');
  }

  /**
   * Resolve task dependencies
   *
   * @param plan - Task plan with subtasks and dependencies
   * @param options - Resolution options
   * @returns Resolution result
   */
  resolve(
    plan: TaskPlan,
    options: DependencyValidationOptions = {}
  ): ResolutionResult {
    const {
      allowCircular = false,
      validateExistence = true,
      checkOrphans = true,
    } = options;

    this.logger.info(`Resolving dependencies for plan: ${plan.task.id}`);

    // Build dependency graph
    const graph = this.buildDependencyGraph(plan);

    // Validate dependencies
    const validationErrors = this.validateDependencies(
      graph,
      plan,
      validateExistence,
      checkOrphans
    );

    if (validationErrors.length > 0) {
      this.logger.warn(`Dependency validation errors: ${validationErrors.length}`);
    }

    // Detect circular dependencies
    const circularDependencies = this.detectCircularDependencies(graph);

    if (circularDependencies.length > 0) {
      this.logger.warn(`Circular dependencies found: ${circularDependencies.length}`);

      if (!allowCircular) {
        return {
          success: false,
          executionOrder: [],
          circularDependencies,
          unresolvedDependencies: [],
          metadata: {
            totalTasks: plan.subtasks.length,
            resolvedTasks: 0,
            timestamp: new Date().toISOString(),
          },
        };
      }
    }

    // Topological sort
    const executionOrder = this.topologicalSort(graph, circularDependencies);

    const result: ResolutionResult = {
      success: true,
      executionOrder,
      circularDependencies,
      unresolvedDependencies: [],
      metadata: {
        totalTasks: plan.subtasks.length,
        resolvedTasks: executionOrder.length,
        timestamp: new Date().toISOString(),
      },
    };

    // Cache result
    this.dependencyCache.set(plan.task.id, result);

    return result;
  }

  /**
   * Build dependency graph from plan
   *
   * @param plan - Task plan
   * @returns Dependency graph
   */
  private buildDependencyGraph(plan: TaskPlan): Map<string, DependencyNode> {
    const graph = new Map<string, DependencyNode>();

    // Initialize nodes for all subtasks
    for (const subtask of plan.subtasks) {
      graph.set(subtask.id, {
        taskId: subtask.id,
        priority: subtask.priority ?? 'medium',
        dependencies: [],
        dependents: [],
        visited: false,
        inStack: false,
      });
    }

    // Add dependencies
    for (const dep of plan.dependencies) {
      const node = graph.get(dep.taskId);
      if (!node) {
        continue;
      }

      node.dependencies.push(...dep.dependsOn);

      // Update dependents
      for (const depId of dep.dependsOn) {
        const depNode = graph.get(depId);
        if (depNode) {
          depNode.dependents.push(dep.taskId);
        }
      }
    }

    return graph;
  }

  /**
   * Validate dependencies
   *
   * @param graph - Dependency graph
   * @param plan - Task plan
   * @param validateExistence - Validate task existence
   * @param checkOrphans - Check for orphaned tasks
   * @returns Validation errors
   */
  private validateDependencies(
    graph: Map<string, DependencyNode>,
    plan: TaskPlan,
    validateExistence: boolean,
    checkOrphans: boolean
  ): string[] {
    const errors: string[] = [];

    // Validate task existence
    if (validateExistence) {
      for (const dep of plan.dependencies) {
        for (const depId of dep.dependsOn) {
          if (!graph.has(depId)) {
            errors.push(`Dependency not found: ${depId} (required by ${dep.taskId})`);
          }
        }
      }
    }

    // Check for orphaned tasks (no dependencies and no dependents)
    if (checkOrphans) {
      for (const [taskId, node] of graph.entries()) {
        if (node.dependencies.length === 0 && node.dependents.length === 0) {
          this.logger.debug(`Orphaned task detected: ${taskId}`);
        }
      }
    }

    return errors;
  }

  /**
   * Detect circular dependencies using DFS
   *
   * @param graph - Dependency graph
   * @returns Array of circular dependency chains
   */
  private detectCircularDependencies(
    graph: Map<string, DependencyNode>
  ): string[][] {
    const circularDeps: string[][] = [];

    // Reset visited flags
    for (const node of graph.values()) {
      node.visited = false;
      node.inStack = false;
    }

    // DFS to detect cycles
    for (const [taskId, node] of graph.entries()) {
      if (!node.visited) {
        const cycle = this.detectCycle(graph, taskId, []);
        if (cycle.length > 0) {
          circularDeps.push(cycle);
        }
      }
    }

    return circularDeps;
  }

  /**
   * Detect cycle starting from a node
   *
   * @param graph - Dependency graph
   * @param taskId - Starting task ID
   * @param path - Current path
   * @returns Cycle path if found, empty array otherwise
   */
  private detectCycle(
    graph: Map<string, DependencyNode>,
    taskId: string,
    path: string[]
  ): string[] {
    const node = graph.get(taskId);
    if (!node) {
      return [];
    }

    node.visited = true;
    node.inStack = true;
    path.push(taskId);

    for (const depId of node.dependencies) {
      const depNode = graph.get(depId);
      if (!depNode) {
        continue;
      }

      if (!depNode.visited) {
        const cycle = this.detectCycle(graph, depId, [...path]);
        if (cycle.length > 0) {
          return cycle;
        }
      } else if (depNode.inStack) {
        // Found a cycle
        const cycleStart = path.indexOf(depId);
        return path.slice(cycleStart);
      }
    }

    node.inStack = false;
    return [];
  }

  /**
   * Topological sort with priority ordering
   *
   * @param graph - Dependency graph
   * @param circularDependencies - Circular dependencies to handle
   * @returns Topologically sorted task IDs
   */
  private topologicalSort(
    graph: Map<string, DependencyNode>,
    circularDependencies: string[][]
  ): string[] {
    const sorted: string[] = [];
    const inDegree = new Map<string, number>();

    // Calculate in-degrees
    for (const [taskId, node] of graph.entries()) {
      inDegree.set(taskId, node.dependencies.length);
    }

    // Priority queue for tasks with no dependencies
    const queue = this.getPriorityQueue(graph, inDegree);

    while (queue.length > 0) {
      // Get highest priority task
      const taskId = queue.shift()!;
      sorted.push(taskId);

      // Update in-degrees of dependents
      const node = graph.get(taskId);
      if (!node) {
        continue;
      }

      for (const depId of node.dependents) {
        const currentDegree = inDegree.get(depId) ?? 0;
        inDegree.set(depId, currentDegree - 1);

        if (inDegree.get(depId) === 0) {
          this.insertPriority(queue, graph, depId);
        }
      }
    }

    // Handle circular dependencies
    for (const cycle of circularDependencies) {
      for (const taskId of cycle) {
        if (!sorted.includes(taskId)) {
          sorted.push(taskId);
        }
      }
    }

    return sorted;
  }

  /**
   * Get priority queue of tasks with no dependencies
   *
   * @param graph - Dependency graph
   * @param inDegree - In-degree map
   * @returns Priority queue (sorted by priority)
   */
  private getPriorityQueue(
    graph: Map<string, DependencyNode>,
    inDegree: Map<string, number>
  ): string[] {
    const queue: string[] = [];

    for (const [taskId, degree] of inDegree.entries()) {
      if (degree === 0) {
        this.insertPriority(queue, graph, taskId);
      }
    }

    return queue;
  }

  /**
   * Insert task into priority queue
   *
   * @param queue - Priority queue
   * @param graph - Dependency graph
   * @param taskId - Task ID to insert
   */
  private insertPriority(
    queue: string[],
    graph: Map<string, DependencyNode>,
    taskId: string
  ): void {
    const node = graph.get(taskId);
    if (!node) {
      return;
    }

    // Priority order: critical > high > medium > low
    const priorityOrder: Record<TaskPriority, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    const priority = priorityOrder[node.priority];
    let inserted = false;

    for (let i = 0; i < queue.length; i++) {
      const existingNode = graph.get(queue[i]);
      if (!existingNode) {
        continue;
      }

      const existingPriority = priorityOrder[existingNode.priority];
      if (priority < existingPriority) {
        queue.splice(i, 0, taskId);
        inserted = true;
        break;
      }
    }

    if (!inserted) {
      queue.push(taskId);
    }
  }

  /**
   * Get execution levels (parallelizable tasks at each level)
   *
   * @param plan - Task plan
   * @returns Array of execution levels
   */
  getExecutionLevels(plan: TaskPlan): string[][] {
    const result = this.resolve(plan);
    const levels: string[][] = [];

    // Group tasks by dependency depth
    const depthMap = new Map<string, number>();

    for (const taskId of result.executionOrder) {
      const node = this.buildDependencyGraph(plan).get(taskId);
      if (!node) {
        continue;
      }

      let maxDepth = 0;
      for (const depId of node.dependencies) {
        const depDepth = depthMap.get(depId) ?? 0;
        maxDepth = Math.max(maxDepth, depDepth + 1);
      }

      depthMap.set(taskId, maxDepth);

      // Add to appropriate level
      while (levels.length <= maxDepth) {
        levels.push([]);
      }
      levels[maxDepth].push(taskId);
    }

    return levels;
  }

  /**
   * Check if tasks can be executed in parallel
   *
   * @param taskId1 - First task ID
   * @param taskId2 - Second task ID
   * @param plan - Task plan
   * @returns True if tasks can be parallelized
   */
  canParallelize(taskId1: string, taskId2: string, plan: TaskPlan): boolean {
    const graph = this.buildDependencyGraph(plan);
    const node1 = graph.get(taskId1);
    const node2 = graph.get(taskId2);

    if (!node1 || !node2) {
      return false;
    }

    // Check if one depends on the other
    const dependsOn1 = node1.dependencies.includes(taskId2);
    const dependsOn2 = node2.dependencies.includes(taskId1);

    return !dependsOn1 && !dependsOn2;
  }

  /**
   * Get critical path (longest dependency chain)
   *
   * @param plan - Task plan
   * @returns Critical path task IDs
   */
  getCriticalPath(plan: TaskPlan): string[] {
    const graph = this.buildDependencyGraph(plan);
    const longestPath: string[] = [];
    const memo = new Map<string, string[]>();

    for (const taskId of plan.subtasks.map(st => st.id)) {
      const path = this.getLongestPath(graph, taskId, memo);
      if (path.length > longestPath.length) {
        longestPath.length = 0;
        longestPath.push(...path);
      }
    }

    return longestPath;
  }

  /**
   * Get longest path from a node using memoization
   *
   * @param graph - Dependency graph
   * @param taskId - Starting task ID
   * @param memo - Memoization map
   * @returns Longest path from this node
   */
  private getLongestPath(
    graph: Map<string, DependencyNode>,
    taskId: string,
    memo: Map<string, string[]>
  ): string[] {
    if (memo.has(taskId)) {
      return memo.get(taskId)!;
    }

    const node = graph.get(taskId);
    if (!node) {
      return [];
    }

    let longestPath: string[] = [taskId];

    for (const depId of node.dependencies) {
      const depPath = this.getLongestPath(graph, depId, memo);
      if (depPath.length + 1 > longestPath.length) {
        longestPath = [...depPath, taskId];
      }
    }

    memo.set(taskId, longestPath);
    return longestPath;
  }

  /**
   * Clear dependency cache
   */
  clearCache(): void {
    this.dependencyCache.clear();
    this.logger.debug('Dependency cache cleared');
  }

  /**
   * Get cached resolution result
   *
   * @param taskId - Task ID
   * @returns Cached result or null
   */
  getCachedResult(taskId: string): ResolutionResult | null {
    return this.dependencyCache.get(taskId) ?? null;
  }
}

/**
 * Create a task dependency resolver instance
 *
 * @param logger - Logger instance
 * @returns Task dependency resolver instance
 */
export function createTaskDependencyResolver(
  logger?: Logger
): TaskDependencyResolver {
  return new TaskDependencyResolver(logger);
}

/**
 * Get global task dependency resolver instance
 *
 * @returns Global task dependency resolver
 */
let globalTaskDependencyResolver: TaskDependencyResolver | null = null;

export function getTaskDependencyResolver(): TaskDependencyResolver {
  if (!globalTaskDependencyResolver) {
    globalTaskDependencyResolver = createTaskDependencyResolver();
  }
  return globalTaskDependencyResolver;
}
