/**
 * Hierarchical Agent Structures
 *
 * Provides supervisor-agent relationships, task delegation and reporting,
 * and hierarchical coordination for multi-agent systems.
 */

import { z } from 'zod';
import { Logger, LoggerLike } from '../../utils/logger';
import { AgentError } from '../../types';
import type { AgentMessage } from './communication';

/**
 * Task status
 */
export enum HierarchyTaskStatus {
  /**
   * Task is pending
   */
  PENDING = 'pending',

  /**
   * Task is assigned
   */
  ASSIGNED = 'assigned',

  /**
   * Task is in progress
   */
  IN_PROGRESS = 'in_progress',

  /**
   * Task is completed
   */
  COMPLETED = 'completed',

  /**
   * Task failed
   */
  FAILED = 'failed',

  /**
   * Task is cancelled
   */
  CANCELLED = 'cancelled',
}

/**
 * Task priority
 */
export enum HierarchyTaskPriority {
  /**
   * Low priority
   */
  LOW = 'low',

  /**
   * Medium priority
   */
  MEDIUM = 'medium',

  /**
   * High priority
   */
  HIGH = 'high',

  /**
   * Critical priority
   */
  CRITICAL = 'critical',
}

/**
 * Delegation strategy
 */
export enum DelegationStrategy {
  /**
   * Direct delegation to specific agent
   */
  DIRECT = 'direct',

  /**
   * Capability-based delegation
   */
  CAPABILITY_BASED = 'capability_based',

  /**
   * Load-based delegation
   */
  LOAD_BASED = 'load_based',

  /**
   * Round-robin delegation
   */
  ROUND_ROBIN = 'round_robin',
}

/**
 * Task
 */
export interface Task {
  /**
   * Task ID
   */
  taskId: string;

  /**
   * Task title
   */
  title: string;

  /**
   * Task description
   */
  description: string;

  /**
   * Task status
   */
  status: HierarchyTaskStatus;

  /**
   * Task priority
   */
  priority: HierarchyTaskPriority;

  /**
   * Assignee agent ID
   */
  assignee?: string;

  /**
   * Created at timestamp
   */
  createdAt: Date;

  /**
   * Assigned at timestamp
   */
  assignedAt?: Date;

  /**
   * Started at timestamp
   */
  startedAt?: Date;

  /**
   * Completed at timestamp
   */
  completedAt?: Date;

  /**
   * Deadline timestamp
   */
  deadline?: Date;

  /**
   * Task dependencies
   */
  dependencies: string[];

  /**
   * Task result
   */
  result?: unknown;

  /**
   * Task error
   */
  error?: Error;

  /**
   * Task metadata
   */
  metadata: Record<string, unknown>;
}

/**
 * Agent capability
 */
export interface AgentCapability {
  /**
   * Capability name
   */
  name: string;

  /**
   * Capability score (0-1)
   */
  score: number;
}

/**
 * Agent load
 */
export interface AgentLoad {
  /**
   * Agent ID
   */
  agentId: string;

  /**
   * Current task count
   */
  taskCount: number;

  /**
   * Total tasks completed
   */
  tasksCompleted: number;

  /**
   * Average completion time in milliseconds
   */
  avgCompletionTime: number;

  /**
   * Success rate (0-1)
   */
  successRate: number;

  /**
   * Last updated timestamp
   */
  lastUpdated: Date;
}

/**
 * Agent report
 */
export interface AgentReport {
  /**
   * Report ID
   */
  reportId: string;

  /**
   * Reporter agent ID
   */
  reporterId: string;

  /**
   * Recipient agent ID
   */
  recipientId: string;

  /**
   * Report type
   */
  type: 'status' | 'result' | 'error' | 'progress';

  /**
   * Report content
   */
  content: unknown;

  /**
   * Related task ID
   */
  taskId?: string;

  /**
   * Timestamp
   */
  timestamp: Date;

  /**
   * Report metadata
   */
  metadata: Record<string, unknown>;
}

/**
 * Hierarchy configuration
 */
export interface HierarchyConfig {
  /**
   * Hierarchy ID
   */
  hierarchyId: string;

  /**
   * Supervisor agent ID
   */
  supervisorId: string;

  /**
   * Agent hierarchy (parent -> children)
   */
  hierarchy: Map<string, string[]>;

  /**
   * Delegation strategy
   */
  delegationStrategy: DelegationStrategy;

  /**
   * Reporting frequency in milliseconds
   */
  reportFrequencyMs?: number;

  /**
   * Auto-assign tasks
   */
  autoAssign?: boolean;

  /**
   * Max tasks per agent
   */
  maxTasksPerAgent?: number;
}

/**
 * Task delegation request
 */
export interface TaskDelegationRequest {
  /**
   * Task to delegate
   */
  task: Task;

  /**
   * Target agent ID (for direct delegation)
   */
  targetAgentId?: string;

  /**
   * Required capabilities
   */
  requiredCapabilities?: string[];

  /**
   * Delegation strategy override
   */
  strategy?: DelegationStrategy;
}

/**
 * Hierarchy class
 *
 * Provides hierarchical coordination with supervisor-agent relationships.
 */
export class Hierarchy {
  private logger: LoggerLike;
  private hierarchies: Map<string, HierarchyConfig> = new Map();
  private tasks: Map<string, Task> = new Map();
  private agentCapabilities: Map<string, AgentCapability[]> = new Map();
  private agentLoads: Map<string, AgentLoad> = new Map();
  private reports: Map<string, AgentReport[]> = new Map();
  private roundRobinCounters: Map<string, number> = new Map();

  constructor(logger?: LoggerLike) {
    this.logger = logger || new Logger();
    this.logger.info('Hierarchy initialized', 'Hierarchy');
  }

  /**
   * Register a hierarchy
   *
   * @param config - Hierarchy configuration
   */
  registerHierarchy(config: HierarchyConfig): void {
    this.hierarchies.set(config.hierarchyId, config);

    // Initialize round-robin counters
    for (const [parentId, children] of config.hierarchy.entries()) {
      this.roundRobinCounters.set(parentId, 0);

      // Initialize agent loads for children
      for (const childId of children) {
        if (!this.agentLoads.has(childId)) {
          this.agentLoads.set(childId, {
            agentId: childId,
            taskCount: 0,
            tasksCompleted: 0,
            avgCompletionTime: 0,
            successRate: 1.0,
            lastUpdated: new Date(),
          });
        }
      }
    }

    this.logger.info(
      `Registered hierarchy: ${config.hierarchyId}`,
      'Hierarchy',
      { supervisorId: config.supervisorId, children: config.hierarchy.size }
    );
  }

  /**
   * Get hierarchy configuration
   *
   * @param hierarchyId - Hierarchy ID
   * @returns Hierarchy configuration or undefined
   */
  getHierarchy(hierarchyId: string): HierarchyConfig | undefined {
    return this.hierarchies.get(hierarchyId);
  }

  /**
   * Get all hierarchies
   *
   * @returns Array of hierarchy configurations
   */
  getAllHierarchies(): HierarchyConfig[] {
    return Array.from(this.hierarchies.values());
  }

  /**
   * Delegate a task
   *
   * @param hierarchyId - Hierarchy ID
   * @param request - Task delegation request
   * @returns Delegated task
   */
  async delegateTask(
    hierarchyId: string,
    request: TaskDelegationRequest
  ): Promise<Task> {
    const config = this.hierarchies.get(hierarchyId);

    if (!config) {
      throw new AgentError(
        `Hierarchy not found: ${hierarchyId}`,
        'Hierarchy',
        { hierarchyId }
      );
    }

    this.logger.info(
      `Delegating task: ${request.task.title}`,
      'Hierarchy',
      { taskId: request.task.taskId, hierarchyId }
    );

    // Determine delegation strategy
    const strategy = request.strategy || config.delegationStrategy;

    // Select agent based on strategy
    const assignee = await this.selectAgent(
      config,
      request,
      strategy
    );

    if (!assignee) {
      throw new AgentError(
        'No available agent for task delegation',
        'Hierarchy',
        { taskId: request.task.taskId }
      );
    }

    // Assign task
    request.task.assignee = assignee;
    request.task.assignedAt = new Date();
    request.task.status = HierarchyTaskStatus.ASSIGNED;

    // Store task
    this.tasks.set(request.task.taskId, request.task);

    // Update agent load
    this.updateAgentLoad(assignee, 1);

    this.logger.info(
      `Task delegated to agent: ${assignee}`,
      'Hierarchy',
      { taskId: request.task.taskId, assignee }
    );

    return request.task;
  }

  /**
   * Select agent based on strategy
   *
   * @param config - Hierarchy configuration
   * @param request - Task delegation request
   * @param strategy - Delegation strategy
   * @returns Selected agent ID or undefined
   */
  private async selectAgent(
    config: HierarchyConfig,
    request: TaskDelegationRequest,
    strategy: DelegationStrategy
  ): Promise<string | undefined> {
    const children = config.hierarchy.get(config.supervisorId) || [];

    switch (strategy) {
      case DelegationStrategy.DIRECT:
        return request.targetAgentId;

      case DelegationStrategy.CAPABILITY_BASED:
        return this.selectByCapability(
          children,
          request.requiredCapabilities || []
        );

      case DelegationStrategy.LOAD_BASED:
        return this.selectByLoad(children, config.maxTasksPerAgent);

      case DelegationStrategy.ROUND_ROBIN:
        return this.selectByRoundRobin(children, config.supervisorId);

      default:
        return this.selectByLoad(children, config.maxTasksPerAgent);
    }
  }

  /**
   * Select agent by capability
   *
   * @param agentIds - Agent IDs
   * @param requiredCapabilities - Required capabilities
   * @returns Selected agent ID or undefined
   */
  private selectByCapability(
    agentIds: string[],
    requiredCapabilities: string[]
  ): string | undefined {
    if (requiredCapabilities.length === 0) {
      return agentIds[0];
    }

    // Score agents based on capabilities
    const scored = agentIds.map((agentId) => {
      const capabilities = this.agentCapabilities.get(agentId) || [];
      let score = 0;

      for (const req of requiredCapabilities) {
        const cap = capabilities.find((c) => c.name === req);
        if (cap) {
          score += cap.score;
        }
      }

      return { agentId, score };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Return top agent
    return scored[0]?.agentId;
  }

  /**
   * Select agent by load
   *
   * @param agentIds - Agent IDs
   * @param maxTasks - Max tasks per agent
   * @returns Selected agent ID or undefined
   */
  private selectByLoad(
    agentIds: string[],
    maxTasks?: number
  ): string | undefined {
    // Filter agents under max tasks
    const candidates = agentIds.filter((agentId) => {
      const load = this.agentLoads.get(agentId);
      return !maxTasks || (load && load.taskCount < maxTasks);
    });

    if (candidates.length === 0) {
      return undefined;
    }

    // Sort by load ascending
    candidates.sort((a, b) => {
      const loadA = this.agentLoads.get(a);
      const loadB = this.agentLoads.get(b);
      return (loadA?.taskCount ?? 0) - (loadB?.taskCount ?? 0);
    });

    return candidates[0];
  }

  /**
   * Select agent by round-robin
   *
   * @param agentIds - Agent IDs
   * @param parentId - Parent agent ID
   * @returns Selected agent ID or undefined
   */
  private selectByRoundRobin(
    agentIds: string[],
    parentId: string
  ): string | undefined {
    const counter = this.roundRobinCounters.get(parentId) || 0;
    const index = counter % agentIds.length;

    this.roundRobinCounters.set(parentId, counter + 1);

    return agentIds[index];
  }

  /**
   * Update task status
   *
   * @param taskId - Task ID
   * @param status - New status
   * @param result - Task result
   * @param error - Task error
   */
  updateTaskStatus(
    taskId: string,
    status: HierarchyTaskStatus,
    result?: unknown,
    error?: Error
  ): void {
    const task = this.tasks.get(taskId);

    if (!task) {
      return;
    }

    task.status = status;

    if (status === HierarchyTaskStatus.IN_PROGRESS && !task.startedAt) {
      task.startedAt = new Date();
    }

    if (status === HierarchyTaskStatus.COMPLETED) {
      task.completedAt = new Date();
      task.result = result;

      // Update agent load
      if (task.assignee) {
        this.updateAgentLoad(task.assignee, -1);
        this.recordTaskCompletion(task.assignee, task);
      }
    }

    if (status === HierarchyTaskStatus.FAILED) {
      task.error = error;

      // Update agent load
      if (task.assignee) {
        this.updateAgentLoad(task.assignee, -1);
        this.recordTaskFailure(task.assignee);
      }
    }

    this.logger.debug(
      `Task status updated: ${taskId}`,
      'Hierarchy',
      { status, assignee: task.assignee }
    );
  }

  /**
   * Get task
   *
   * @param taskId - Task ID
   * @returns Task or undefined
   */
  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks
   *
   * @param filter - Optional filter
   * @returns Array of tasks
   */
  getAllTasks(filter?: {
    assignee?: string;
    status?: HierarchyTaskStatus;
    priority?: HierarchyTaskPriority;
  }): Task[] {
    let tasks = Array.from(this.tasks.values());

    if (filter?.assignee) {
      tasks = tasks.filter((t) => t.assignee === filter.assignee);
    }

    if (filter?.status) {
      tasks = tasks.filter((t) => t.status === filter.status);
    }

    if (filter?.priority) {
      tasks = tasks.filter((t) => t.priority === filter.priority);
    }

    return tasks;
  }

  /**
   * Register agent capabilities
   *
   * @param agentId - Agent ID
   * @param capabilities - Agent capabilities
   */
  registerAgentCapabilities(
    agentId: string,
    capabilities: AgentCapability[]
  ): void {
    this.agentCapabilities.set(agentId, capabilities);

    this.logger.debug(
      `Registered capabilities for agent: ${agentId}`,
      'Hierarchy',
      { capabilities: capabilities.length }
    );
  }

  /**
   * Get agent capabilities
   *
   * @param agentId - Agent ID
   * @returns Agent capabilities
   */
  getAgentCapabilities(agentId: string): AgentCapability[] {
    return this.agentCapabilities.get(agentId) || [];
  }

  /**
   * Update agent load
   *
   * @param agentId - Agent ID
   * @param delta - Change in task count
   */
  private updateAgentLoad(agentId: string, delta: number): void {
    const load = this.agentLoads.get(agentId);

    if (load) {
      load.taskCount = Math.max(0, load.taskCount + delta);
      load.lastUpdated = new Date();
    }
  }

  /**
   * Record task completion
   *
   * @param agentId - Agent ID
   * @param task - Completed task
   */
  private recordTaskCompletion(agentId: string, task: Task): void {
    const load = this.agentLoads.get(agentId);

    if (load) {
      load.tasksCompleted++;

      const completionTime =
        task.completedAt && task.startedAt
          ? task.completedAt.getTime() - task.startedAt.getTime()
          : 0;

      // Update average completion time
      load.avgCompletionTime =
        (load.avgCompletionTime * (load.tasksCompleted - 1) + completionTime) /
        load.tasksCompleted;

      // Update success rate
      load.successRate = (load.successRate * (load.tasksCompleted - 1) + 1) / load.tasksCompleted;

      load.lastUpdated = new Date();
    }
  }

  /**
   * Record task failure
   *
   * @param agentId - Agent ID
   */
  private recordTaskFailure(agentId: string): void {
    const load = this.agentLoads.get(agentId);

    if (load) {
      load.tasksCompleted++;

      // Update success rate
      load.successRate = (load.successRate * (load.tasksCompleted - 1)) / load.tasksCompleted;

      load.lastUpdated = new Date();
    }
  }

  /**
   * Get agent load
   *
   * @param agentId - Agent ID
   * @returns Agent load or undefined
   */
  getAgentLoad(agentId: string): AgentLoad | undefined {
    return this.agentLoads.get(agentId);
  }

  /**
   * Get all agent loads
   *
   * @returns Array of agent loads
   */
  getAllAgentLoads(): AgentLoad[] {
    return Array.from(this.agentLoads.values());
  }

  /**
   * Submit report
   *
   * @param report - Report to submit
   */
  submitReport(report: AgentReport): void {
    const reports = this.reports.get(report.recipientId) || [];
    reports.push(report);
    this.reports.set(report.recipientId, reports);

    this.logger.debug(
      `Report submitted: ${report.reportId}`,
      'Hierarchy',
      { reporterId: report.reporterId, recipientId: report.recipientId, type: report.type }
    );
  }

  /**
   * Get reports for an agent
   *
   * @param agentId - Agent ID
   * @param filter - Optional filter
   * @returns Array of reports
   */
  getReports(
    agentId: string,
    filter?: { type?: string; since?: Date; taskId?: string }
  ): AgentReport[] {
    const reports = this.reports.get(agentId) || [];

    let filtered = [...reports];

    if (filter?.type) {
      filtered = filtered.filter((r) => r.type === filter.type);
    }

    if (filter?.since) {
      filtered = filtered.filter((r) => r.timestamp >= filter.since!);
    }

    if (filter?.taskId) {
      filtered = filtered.filter((r) => r.taskId === filter.taskId);
    }

    return filtered;
  }

  /**
   * Get children of an agent
   *
   * @param hierarchyId - Hierarchy ID
   * @param agentId - Agent ID
   * @returns Array of child agent IDs
   */
  getChildren(hierarchyId: string, agentId: string): string[] {
    const config = this.hierarchies.get(hierarchyId);

    if (!config) {
      return [];
    }

    return config.hierarchy.get(agentId) || [];
  }

  /**
   * Get parent of an agent
   *
   * @param hierarchyId - Hierarchy ID
   * @param agentId - Agent ID
   * @returns Parent agent ID or undefined
   */
  getParent(hierarchyId: string, agentId: string): string | undefined {
    const config = this.hierarchies.get(hierarchyId);

    if (!config) {
      return undefined;
    }

    for (const [parentId, children] of config.hierarchy.entries()) {
      if (children.includes(agentId)) {
        return parentId;
      }
    }

    return undefined;
  }

  /**
   * Get subtree of an agent
   *
   * @param hierarchyId - Hierarchy ID
   * @param agentId - Agent ID
   * @returns Array of descendant agent IDs
   */
  getSubtree(hierarchyId: string, agentId: string): string[] {
    const children = this.getChildren(hierarchyId, agentId);
    const subtree = [...children];

    for (const child of children) {
      subtree.push(...this.getSubtree(hierarchyId, child));
    }

    return subtree;
  }

  /**
   * Unregister a hierarchy
   *
   * @param hierarchyId - Hierarchy ID
   * @returns True if hierarchy was removed
   */
  unregisterHierarchy(hierarchyId: string): boolean {
    const removed = this.hierarchies.delete(hierarchyId);

    if (removed) {
      this.logger.info(
        `Unregistered hierarchy: ${hierarchyId}`,
        'Hierarchy'
      );
    }

    return removed;
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.hierarchies.clear();
    this.tasks.clear();
    this.agentCapabilities.clear();
    this.agentLoads.clear();
    this.reports.clear();
    this.roundRobinCounters.clear();
    this.logger.debug('All data cleared', 'Hierarchy');
  }

  /**
   * Get statistics
   *
   * @returns Statistics about hierarchy
   */
  getStatistics(): {
    totalHierarchies: number;
    totalTasks: number;
    tasksByStatus: Record<HierarchyTaskStatus, number>;
    avgAgentLoad: number;
    avgSuccessRate: number;
    totalReports: number;
  } {
    const tasks = Array.from(this.tasks.values());
    const tasksByStatus: Record<HierarchyTaskStatus, number> = {
      [HierarchyTaskStatus.PENDING]: 0,
      [HierarchyTaskStatus.ASSIGNED]: 0,
      [HierarchyTaskStatus.IN_PROGRESS]: 0,
      [HierarchyTaskStatus.COMPLETED]: 0,
      [HierarchyTaskStatus.FAILED]: 0,
      [HierarchyTaskStatus.CANCELLED]: 0,
    };

    for (const task of tasks) {
      tasksByStatus[task.status]++;
    }

    const loads = Array.from(this.agentLoads.values());
    const avgAgentLoad =
      loads.length > 0
        ? loads.reduce((sum, l) => sum + l.taskCount, 0) / loads.length
        : 0;
    const avgSuccessRate =
      loads.length > 0
        ? loads.reduce((sum, l) => sum + l.successRate, 0) / loads.length
        : 1.0;

    const totalReports = Array.from(this.reports.values()).reduce(
      (sum, r) => sum + r.length,
      0
    );

    return {
      totalHierarchies: this.hierarchies.size,
      totalTasks: this.tasks.size,
      tasksByStatus,
      avgAgentLoad,
      avgSuccessRate,
      totalReports,
    };
  }
}

/**
 * Schema for task
 */
export const TaskSchema = z.object({
  taskId: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.nativeEnum(HierarchyTaskStatus),
  priority: z.nativeEnum(HierarchyTaskPriority),
  assignee: z.string().optional(),
  createdAt: z.date(),
  assignedAt: z.date().optional(),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  deadline: z.date().optional(),
  dependencies: z.array(z.string()),
  result: z.unknown().optional(),
  error: z.instanceof(Error).optional(),
  metadata: z.record(z.unknown()),
});

/**
 * Schema for agent capability
 */
export const AgentCapabilitySchema = z.object({
  name: z.string(),
  score: z.number().min(0).max(1),
});

/**
 * Schema for hierarchy configuration
 */
export const HierarchyConfigSchema = z.object({
  hierarchyId: z.string(),
  supervisorId: z.string(),
  hierarchy: z.map(z.string(), z.array(z.string())),
  delegationStrategy: z.nativeEnum(DelegationStrategy),
  reportFrequencyMs: z.number().min(0).optional(),
  autoAssign: z.boolean().optional(),
  maxTasksPerAgent: z.number().min(1).optional(),
});

/**
 * Schema for task delegation request
 */
export const TaskDelegationRequestSchema = z.object({
  task: TaskSchema,
  targetAgentId: z.string().optional(),
  requiredCapabilities: z.array(z.string()).optional(),
  strategy: z.nativeEnum(DelegationStrategy).optional(),
});

/**
 * Global hierarchy instance
 */
let globalHierarchy: Hierarchy | null = null;

/**
 * Initialize global hierarchy
 *
 * @param logger - Optional logger instance
 * @returns The global hierarchy
 */
export function initHierarchy(logger?: LoggerLike): Hierarchy {
  globalHierarchy = new Hierarchy(logger);
  return globalHierarchy;
}

/**
 * Get global hierarchy
 *
 * @returns The global hierarchy
 */
export function getHierarchy(): Hierarchy {
  if (!globalHierarchy) {
    globalHierarchy = new Hierarchy();
  }
  return globalHierarchy;
}
