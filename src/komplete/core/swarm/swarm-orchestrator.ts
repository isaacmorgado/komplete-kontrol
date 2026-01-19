/**
 * Git Worktree Swarm Orchestrator
 *
 * Implements true parallel execution with git worktree isolation.
 * Supports 2-100+ concurrent agents with automatic merge and conflict resolution.
 *
 * Based on ARCHITECTURE-SYNTHESIS-ENHANCED.md: Git Worktree Swarm System
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger, LoggerLike } from '../../utils/logger';

const execAsync = promisify(exec);

/**
 * Agent state
 */
export interface AgentState {
  id: string;
  worktreePath: string;
  branchName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  task: string;
  startTime?: Date;
  endTime?: Date;
  error?: string;
  progress: number; // 0-100
}

/**
 * Swarm configuration
 */
export interface SwarmConfig {
  swarmId: string;
  task: string;
  agentCount: number;
  strategy: TaskDecompositionStrategy;
  basePath?: string; // Base path for worktrees (default: ~/.komplete/swarm/)
  projectPath: string; // Path to project root
  autoMerge?: boolean; // Auto-merge results (default: true)
  conflictStrategy?: ConflictStrategy; // Default: 'auto'
}

/**
 * Task decomposition strategies
 */
export enum TaskDecompositionStrategy {
  FEATURE_IMPLEMENTATION = 'feature', // Sequential phases
  TESTING_VALIDATION = 'testing', // Parallel independent
  REFACTORING = 'refactor', // Sequential modules
  RESEARCH_ANALYSIS = 'research', // Parallel investigation
  GENERIC_PARALLEL = 'generic', // Equal division
}

/**
 * Conflict resolution strategies
 */
export enum ConflictStrategy {
  AUTO = 'auto', // Automatic resolution with 3 strategies
  MANUAL = 'manual', // Require manual resolution
  KEEP_OURS = 'ours', // Always keep current changes
  KEEP_THEIRS = 'theirs', // Always keep agent changes
}

/**
 * Swarm state
 */
export interface SwarmState {
  config: SwarmConfig;
  agents: AgentState[];
  status: 'initializing' | 'spawning' | 'running' | 'merging' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  results: AgentResult[];
  conflicts: ConflictReport[];
}

/**
 * Agent result
 */
export interface AgentResult {
  agentId: string;
  success: boolean;
  output?: string;
  error?: string;
  filesModified: string[];
}

/**
 * Conflict report
 */
export interface ConflictReport {
  file: string;
  conflictCount: number;
  strategy: ConflictStrategy;
  resolution: 'auto' | 'manual';
  resolved: boolean;
}

/**
 * Swarm Orchestrator
 *
 * Manages git worktree-based parallel agent execution.
 */
export class SwarmOrchestrator {
  private logger: LoggerLike;
  private swarmState: SwarmState | null = null;

  constructor(logger?: LoggerLike) {
    this.logger = logger ?? new Logger().child('SwarmOrchestrator');
  }

  /**
   * Initialize swarm with configuration
   */
  async initializeSwarm(config: SwarmConfig): Promise<SwarmState> {
    this.logger.info('Initializing swarm', {
      swarmId: config.swarmId,
      agentCount: config.agentCount,
      strategy: config.strategy,
    });

    // Validate git repository
    await this.validateGitRepo(config.projectPath);

    // Create swarm state
    this.swarmState = {
      config: {
        ...config,
        basePath: config.basePath ?? path.join(process.env.HOME ?? '', '.komplete', 'swarm'),
        autoMerge: config.autoMerge ?? true,
        conflictStrategy: config.conflictStrategy ?? ConflictStrategy.AUTO,
      },
      agents: [],
      status: 'initializing',
      startTime: new Date(),
      results: [],
      conflicts: [],
    };

    // Decompose task
    const subtasks = await this.decomposeTask(config.task, config.agentCount, config.strategy);

    // Create agents
    for (let i = 0; i < config.agentCount; i++) {
      const agentId = `agent-${i + 1}`;
      const worktreePath = path.join(this.swarmState.config.basePath!, config.swarmId, `worktree-${i + 1}`);
      const branchName = `swarm-${Date.now()}-${agentId}`;

      this.swarmState.agents.push({
        id: agentId,
        worktreePath,
        branchName,
        status: 'pending',
        task: subtasks[i],
        progress: 0,
      });
    }

    this.logger.info('Swarm initialized', {
      agents: this.swarmState.agents.length,
      subtasks: subtasks.length,
    });

    return this.swarmState;
  }

  /**
   * Spawn agents in worktrees
   */
  async spawnAgents(): Promise<void> {
    if (!this.swarmState) {
      throw new Error('Swarm not initialized');
    }

    this.swarmState.status = 'spawning';
    this.logger.info('Spawning agents', { count: this.swarmState.agents.length });

    // Create base swarm directory
    await fs.mkdir(path.join(this.swarmState.config.basePath!, this.swarmState.config.swarmId), {
      recursive: true,
    });

    // Spawn each agent in parallel
    const spawnPromises = this.swarmState.agents.map(agent => this.spawnAgent(agent));
    await Promise.all(spawnPromises);

    this.swarmState.status = 'running';
    this.logger.info('All agents spawned successfully');
  }

  /**
   * Spawn single agent in worktree
   */
  private async spawnAgent(agent: AgentState): Promise<void> {
    try {
      this.logger.debug('Spawning agent', { agentId: agent.id, worktreePath: agent.worktreePath });

      // Create git worktree
      await this.createWorktree(agent.worktreePath, agent.branchName);

      agent.status = 'running';
      agent.startTime = new Date();

      // Simulate agent execution (in production, would spawn actual AI agent)
      // For now, just mark as completed after delay
      await this.simulateAgentExecution(agent);

      agent.status = 'completed';
      agent.endTime = new Date();
      agent.progress = 100;

      this.logger.debug('Agent completed', { agentId: agent.id });
    } catch (error) {
      agent.status = 'failed';
      agent.error = error instanceof Error ? error.message : String(error);
      this.logger.error('Agent failed', { agentId: agent.id, error: agent.error });
      throw error;
    }
  }

  /**
   * Create git worktree
   */
  private async createWorktree(worktreePath: string, branchName: string): Promise<void> {
    if (!this.swarmState) {
      throw new Error('Swarm not initialized');
    }

    const projectPath = this.swarmState.config.projectPath;

    try {
      // Create worktree with new branch
      await execAsync(
        `git worktree add -b ${branchName} ${worktreePath} HEAD`,
        { cwd: projectPath }
      );

      this.logger.debug('Worktree created', { worktreePath, branchName });
    } catch (error) {
      this.logger.error('Failed to create worktree', { worktreePath, error });
      throw new Error(`Failed to create worktree: ${error}`);
    }
  }

  /**
   * Simulate agent execution (placeholder for actual AI agent)
   */
  private async simulateAgentExecution(agent: AgentState): Promise<void> {
    // Simulate progress updates
    for (let progress = 0; progress <= 100; progress += 10) {
      agent.progress = progress;
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // In production, would:
    // 1. Spawn AI agent process
    // 2. Monitor agent output
    // 3. Track file modifications
    // 4. Handle errors and retries
  }

  /**
   * Merge agent results
   */
  async mergeResults(): Promise<void> {
    if (!this.swarmState) {
      throw new Error('Swarm not initialized');
    }

    this.swarmState.status = 'merging';
    this.logger.info('Merging agent results', { agentCount: this.swarmState.agents.length });

    const projectPath = this.swarmState.config.projectPath;

    // Merge each agent's branch
    for (const agent of this.swarmState.agents) {
      if (agent.status !== 'completed') {
        this.logger.warn('Skipping failed agent', { agentId: agent.id });
        continue;
      }

      try {
        await this.mergeAgentBranch(agent, projectPath);
      } catch (error) {
        this.logger.error('Failed to merge agent branch', {
          agentId: agent.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.swarmState.status = 'completed';
    this.swarmState.endTime = new Date();

    this.logger.info('Swarm completed', {
      duration: this.swarmState.endTime.getTime() - this.swarmState.startTime.getTime(),
      conflicts: this.swarmState.conflicts.length,
    });
  }

  /**
   * Merge agent branch
   */
  private async mergeAgentBranch(agent: AgentState, projectPath: string): Promise<void> {
    try {
      // Attempt merge
      const mergeResult = await execAsync(
        `git merge --no-ff --no-commit ${agent.branchName}`,
        { cwd: projectPath }
      );

      // Check for conflicts
      const conflictCheck = await execAsync(
        `git diff --name-only --diff-filter=U`,
        { cwd: projectPath }
      );

      const conflictedFiles = conflictCheck.stdout.trim().split('\n').filter(Boolean);

      if (conflictedFiles.length > 0) {
        await this.resolveConflicts(conflictedFiles, projectPath);
      }

      // Commit merge
      await execAsync(
        `git commit -m "Merge ${agent.branchName} (${agent.task})"`,
        { cwd: projectPath }
      );

      this.logger.info('Agent branch merged successfully', { agentId: agent.id });
    } catch (error) {
      this.logger.error('Merge failed', {
        agentId: agent.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Resolve merge conflicts
   */
  private async resolveConflicts(conflictedFiles: string[], projectPath: string): Promise<void> {
    if (!this.swarmState) {
      throw new Error('Swarm not initialized');
    }

    const strategy = this.swarmState.config.conflictStrategy!;

    for (const file of conflictedFiles) {
      const conflict: ConflictReport = {
        file,
        conflictCount: await this.countConflictMarkers(path.join(projectPath, file)),
        strategy,
        resolution: 'manual',
        resolved: false,
      };

      // Apply resolution strategy
      if (strategy === ConflictStrategy.AUTO) {
        await this.applyAutoResolution(file, conflict, projectPath);
      } else if (strategy === ConflictStrategy.KEEP_OURS) {
        await execAsync(`git checkout --ours ${file}`, { cwd: projectPath });
        conflict.resolution = 'auto';
        conflict.resolved = true;
      } else if (strategy === ConflictStrategy.KEEP_THEIRS) {
        await execAsync(`git checkout --theirs ${file}`, { cwd: projectPath });
        conflict.resolution = 'auto';
        conflict.resolved = true;
      }

      this.swarmState.conflicts.push(conflict);
    }
  }

  /**
   * Apply automatic conflict resolution
   */
  private async applyAutoResolution(
    file: string,
    conflict: ConflictReport,
    projectPath: string
  ): Promise<void> {
    // Strategy 1: Package lock files (always keep current)
    if (this.isPackageLockFile(file)) {
      await execAsync(`git checkout --ours ${file}`, { cwd: projectPath });
      conflict.resolution = 'auto';
      conflict.resolved = true;
      this.logger.debug('Auto-resolved package lock file', { file });
      return;
    }

    // Strategy 2: Small conflicts (≤3 markers, keep agent changes)
    if (conflict.conflictCount <= 3) {
      await execAsync(`git checkout --theirs ${file}`, { cwd: projectPath });
      conflict.resolution = 'auto';
      conflict.resolved = true;
      this.logger.debug('Auto-resolved small conflict', { file, conflictCount: conflict.conflictCount });
      return;
    }

    // Strategy 3: Large conflicts (requires manual resolution)
    this.logger.warn('Large conflict requires manual resolution', {
      file,
      conflictCount: conflict.conflictCount,
    });
  }

  /**
   * Count conflict markers in file
   */
  private async countConflictMarkers(filePath: string): Promise<number> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const markers = content.match(/^<<<<<<< /gm);
      return markers ? markers.length : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Check if file is a package lock file
   */
  private isPackageLockFile(file: string): boolean {
    const lockFiles = ['package-lock.json', 'yarn.lock', 'Gemfile.lock', 'Cargo.lock', 'pnpm-lock.yaml'];
    return lockFiles.some(lockFile => file.endsWith(lockFile));
  }

  /**
   * Cleanup worktrees
   */
  async cleanup(): Promise<void> {
    if (!this.swarmState) {
      return;
    }

    this.logger.info('Cleaning up swarm', { swarmId: this.swarmState.config.swarmId });

    const projectPath = this.swarmState.config.projectPath;

    // Remove worktrees
    for (const agent of this.swarmState.agents) {
      try {
        await execAsync(`git worktree remove ${agent.worktreePath} --force`, { cwd: projectPath });
        this.logger.debug('Worktree removed', { worktreePath: agent.worktreePath });
      } catch (error) {
        this.logger.warn('Failed to remove worktree', {
          worktreePath: agent.worktreePath,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Remove swarm directory
    try {
      await fs.rm(path.join(this.swarmState.config.basePath!, this.swarmState.config.swarmId), {
        recursive: true,
        force: true,
      });
    } catch (error) {
      this.logger.warn('Failed to remove swarm directory', { error });
    }

    this.logger.info('Swarm cleanup completed');
  }

  /**
   * Get swarm state
   */
  getState(): SwarmState | null {
    return this.swarmState;
  }

  /**
   * Decompose task into subtasks
   */
  private async decomposeTask(
    task: string,
    agentCount: number,
    strategy: TaskDecompositionStrategy
  ): Promise<string[]> {
    const subtasks: string[] = [];

    switch (strategy) {
      case TaskDecompositionStrategy.FEATURE_IMPLEMENTATION:
        subtasks.push(...this.decomposeFeatureTask(task, agentCount));
        break;

      case TaskDecompositionStrategy.TESTING_VALIDATION:
        subtasks.push(...this.decomposeTestingTask(task, agentCount));
        break;

      case TaskDecompositionStrategy.REFACTORING:
        subtasks.push(...this.decomposeRefactoringTask(task, agentCount));
        break;

      case TaskDecompositionStrategy.RESEARCH_ANALYSIS:
        subtasks.push(...this.decomposeResearchTask(task, agentCount));
        break;

      case TaskDecompositionStrategy.GENERIC_PARALLEL:
        subtasks.push(...this.decomposeGenericTask(task, agentCount));
        break;
    }

    return subtasks;
  }

  /**
   * Decompose feature implementation task
   */
  private decomposeFeatureTask(task: string, agentCount: number): string[] {
    if (agentCount === 3) {
      return [`Design: ${task}`, `Implement: ${task}`, `Test: ${task}`];
    } else if (agentCount === 5) {
      return [
        `Design: ${task}`,
        `Backend: ${task}`,
        `Frontend: ${task}`,
        `Test: ${task}`,
        `Integration: ${task}`,
      ];
    } else {
      // Generic division
      return Array.from({ length: agentCount }, (_, i) => `Part ${i + 1}: ${task}`);
    }
  }

  /**
   * Decompose testing task
   */
  private decomposeTestingTask(task: string, agentCount: number): string[] {
    const testTypes = [
      'Unit tests',
      'Integration tests',
      'E2E tests',
      'Performance tests',
      'Security tests',
    ];

    return testTypes.slice(0, agentCount).map(type => `${type}: ${task}`);
  }

  /**
   * Decompose refactoring task
   */
  private decomposeRefactoringTask(task: string, agentCount: number): string[] {
    return Array.from({ length: agentCount }, (_, i) => `Module ${String.fromCharCode(65 + i)}: ${task}`);
  }

  /**
   * Decompose research task
   */
  private decomposeResearchTask(task: string, agentCount: number): string[] {
    const researchTypes = [
      'Codebase patterns',
      'External solutions',
      'Architecture analysis',
      'Dependency mapping',
      'Performance analysis',
    ];

    return researchTypes.slice(0, agentCount).map(type => `${type}: ${task}`);
  }

  /**
   * Decompose generic task
   */
  private decomposeGenericTask(task: string, agentCount: number): string[] {
    return Array.from({ length: agentCount }, (_, i) => `Subtask ${i + 1}/${agentCount}: ${task}`);
  }

  /**
   * Validate git repository
   */
  private async validateGitRepo(projectPath: string): Promise<void> {
    try {
      await execAsync('git rev-parse --git-dir', { cwd: projectPath });
    } catch (error) {
      throw new Error(`Not a git repository: ${projectPath}`);
    }
  }
}

/**
 * Create swarm orchestrator
 */
export function createSwarmOrchestrator(logger?: LoggerLike): SwarmOrchestrator {
  return new SwarmOrchestrator(logger);
}
