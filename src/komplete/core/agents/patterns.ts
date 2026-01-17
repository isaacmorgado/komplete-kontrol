/**
 * Advanced Coordination Patterns
 *
 * Provides coordination patterns for multi-agent systems including
 * team pattern, swarm pattern, and hierarchical pattern.
 */

import { z } from 'zod';
import { Logger, LoggerLike } from '../../utils/logger';
import { AgentError } from '../../types';
import type { AgentMessage } from './communication';

/**
 * Agent role in a team
 */
export enum AgentRole {
  /**
   * Primary agent responsible for task completion
   */
  PRIMARY = 'primary',

  /**
   * Supporting agent that assists primary
   */
  SUPPORT = 'support',

  /**
   * Reviewer agent that validates results
   */
  REVIEWER = 'reviewer',

  /**
   * Observer agent that monitors progress
   */
  OBSERVER = 'observer',

  /**
   * Specialist agent with specific expertise
   */
  SPECIALIST = 'specialist',
}

/**
 * Coordination pattern type
 */
export enum CoordinationPattern {
  /**
   * Team pattern: Specialized agents working together
   */
  TEAM = 'team',

  /**
   * Swarm pattern: Multiple agents on same task
   */
  SWARM = 'swarm',

  /**
   * Hierarchical pattern: Supervisor-agent relationships
   */
  HIERARCHICAL = 'hierarchical',

  /**
   * Pipeline pattern: Sequential agent processing
   */
  PIPELINE = 'pipeline',

  /**
   * Peer-to-peer pattern: Equal agents collaborating
   */
  PEER_TO_PEER = 'peer_to_peer',
}

/**
 * Team configuration
 */
export interface TeamConfig {
  /**
   * Team ID
   */
  teamId: string;

  /**
   * Team name
   */
  name: string;

  /**
   * Agent roles mapping
   */
  roles: Map<string, AgentRole>;

  /**
   * Communication channels
   */
  channels: string[];

  /**
   * Coordination pattern
   */
  pattern: CoordinationPattern;
}

/**
 * Swarm configuration
 */
export interface SwarmConfig {
  /**
   * Swarm ID
   */
  swarmId: string;

  /**
   * Number of agents in swarm
   */
  agentCount: number;

  /**
   * Task distribution strategy
   */
  distributionStrategy: 'round_robin' | 'random' | 'load_balanced';

  /**
   * Result aggregation strategy
   */
  aggregationStrategy: 'first' | 'majority' | 'consensus' | 'all';

  /**
   * Maximum concurrent agents
   */
  maxConcurrent?: number;
}

/**
 * Hierarchical configuration
 */
export interface HierarchicalConfig {
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
  delegationStrategy: 'direct' | 'capability_based' | 'load_based';

  /**
   * Reporting frequency in milliseconds
   */
  reportFrequencyMs?: number;
}

/**
 * Pipeline configuration
 */
export interface PipelineConfig {
  /**
   * Pipeline ID
   */
  pipelineId: string;

  /**
   * Agent stages in order
   */
  stages: string[];

  /**
   * Whether stages run in parallel
   */
  parallel?: boolean;

  /**
   * Data passing strategy
   */
  dataStrategy: 'pass_all' | 'pass_filtered' | 'pass_transformed';

  /**
   * Error handling strategy
   */
  errorStrategy: 'stop' | 'continue' | 'retry';
}

/**
 * Coordination pattern configuration
 */
export interface PatternConfig {
  /**
   * Pattern type
   */
  pattern: CoordinationPattern;

  /**
   * Team configuration (for team pattern)
   */
  team?: TeamConfig;

  /**
   * Swarm configuration (for swarm pattern)
   */
  swarm?: SwarmConfig;

  /**
   * Hierarchical configuration (for hierarchical pattern)
   */
  hierarchy?: HierarchicalConfig;

  /**
   * Pipeline configuration (for pipeline pattern)
   */
  pipeline?: PipelineConfig;
}

/**
 * Pattern execution result
 */
export interface PatternExecutionResult {
  /**
   * Pattern type
   */
  pattern: CoordinationPattern;

  /**
   * Execution ID
   */
  executionId: string;

  /**
   * Success status
   */
  success: boolean;

  /**
   * Execution duration in milliseconds
   */
  durationMs: number;

  /**
   * Number of agents involved
   */
  agentCount: number;

  /**
   * Result data
   */
  result?: unknown;

  /**
   * Error if failed
   */
  error?: Error;
}

/**
 * Coordination Patterns class
 *
 * Provides advanced coordination patterns for multi-agent systems.
 */
export class CoordinationPatterns {
  private logger: LoggerLike;
  private patterns: Map<string, PatternConfig> = new Map();
  private executions: Map<string, PatternExecutionResult> = new Map();

  constructor(logger?: LoggerLike) {
    this.logger = logger || new Logger();
    this.logger.info('CoordinationPatterns initialized', 'CoordinationPatterns');
  }

  /**
   * Register a coordination pattern
   *
   * @param config - Pattern configuration
   */
  registerPattern(config: PatternConfig): void {
    const patternId = this.getPatternIdFromConfig(config);
    this.patterns.set(patternId, config);

    this.logger.info(
      `Registered coordination pattern: ${config.pattern}`,
      'CoordinationPatterns',
      { patternId, config }
    );
  }

  /**
   * Get pattern configuration
   *
   * @param patternId - Pattern ID
   * @returns Pattern configuration or undefined
   */
  getPattern(patternId: string): PatternConfig | undefined {
    return this.patterns.get(patternId);
  }

  /**
   * Get all patterns
   *
   * @param filter - Optional filter
   * @returns Array of pattern configurations
   */
  getAllPatterns(filter?: { pattern?: CoordinationPattern }): PatternConfig[] {
    let patterns = Array.from(this.patterns.values());

    if (filter?.pattern) {
      patterns = patterns.filter((p) => p.pattern === filter.pattern);
    }

    return patterns;
  }

  /**
   * Execute a coordination pattern
   *
   * @param patternId - Pattern ID
   * @param executeFn - Execution function
   * @returns Pattern execution result
   */
  async executePattern(
    patternId: string,
    executeFn: (config: PatternConfig) => Promise<unknown>
  ): Promise<PatternExecutionResult> {
    const config = this.patterns.get(patternId);

    if (!config) {
      throw new AgentError(
        `Pattern not found: ${patternId}`,
        'CoordinationPatterns',
        { patternId }
      );
    }

    const executionId = this.generateExecutionId();
    const startTime = Date.now();

    this.logger.info(
      `Executing pattern: ${config.pattern}`,
      'CoordinationPatterns',
      { patternId, executionId }
    );

    try {
      const result = await executeFn(config);
      const durationMs = Date.now() - startTime;

      const executionResult: PatternExecutionResult = {
        pattern: config.pattern,
        executionId,
        success: true,
        durationMs,
        agentCount: this.countAgentsInPattern(config),
        result,
      };

      this.executions.set(executionId, executionResult);

      this.logger.info(
        `Pattern execution completed: ${config.pattern}`,
        'CoordinationPatterns',
        { executionId, durationMs, success: true }
      );

      return executionResult;
    } catch (error) {
      const durationMs = Date.now() - startTime;

      const executionResult: PatternExecutionResult = {
        pattern: config.pattern,
        executionId,
        success: false,
        durationMs,
        agentCount: this.countAgentsInPattern(config),
        error: error as Error,
      };

      this.executions.set(executionId, executionResult);

      this.logger.error(
        `Pattern execution failed: ${config.pattern}`,
        'CoordinationPatterns',
        { executionId, durationMs, error: (error as Error).message }
      );

      return executionResult;
    }
  }

  /**
   * Execute team pattern
   *
   * @param teamId - Team ID
   * @param executeFn - Execution function
   * @returns Pattern execution result
   */
  async executeTeamPattern(
    teamId: string,
    executeFn: (config: TeamConfig) => Promise<unknown>
  ): Promise<PatternExecutionResult> {
    const config = this.patterns.get(teamId);

    if (!config || config.pattern !== CoordinationPattern.TEAM || !config.team) {
      throw new AgentError(
        `Team pattern not found: ${teamId}`,
        'CoordinationPatterns',
        { teamId }
      );
    }

    return this.executePattern(teamId, async () => executeFn(config.team!));
  }

  /**
   * Execute swarm pattern
   *
   * @param swarmId - Swarm ID
   * @param executeFn - Execution function
   * @returns Pattern execution result
   */
  async executeSwarmPattern(
    swarmId: string,
    executeFn: (config: SwarmConfig) => Promise<unknown>
  ): Promise<PatternExecutionResult> {
    const config = this.patterns.get(swarmId);

    if (!config || config.pattern !== CoordinationPattern.SWARM || !config.swarm) {
      throw new AgentError(
        `Swarm pattern not found: ${swarmId}`,
        'CoordinationPatterns',
        { swarmId }
      );
    }

    return this.executePattern(swarmId, async () => executeFn(config.swarm!));
  }

  /**
   * Execute hierarchical pattern
   *
   * @param hierarchyId - Hierarchy ID
   * @param executeFn - Execution function
   * @returns Pattern execution result
   */
  async executeHierarchicalPattern(
    hierarchyId: string,
    executeFn: (config: HierarchicalConfig) => Promise<unknown>
  ): Promise<PatternExecutionResult> {
    const config = this.patterns.get(hierarchyId);

    if (!config || config.pattern !== CoordinationPattern.HIERARCHICAL || !config.hierarchy) {
      throw new AgentError(
        `Hierarchical pattern not found: ${hierarchyId}`,
        'CoordinationPatterns',
        { hierarchyId }
      );
    }

    return this.executePattern(hierarchyId, async () => executeFn(config.hierarchy!));
  }

  /**
   * Execute pipeline pattern
   *
   * @param pipelineId - Pipeline ID
   * @param executeFn - Execution function
   * @returns Pattern execution result
   */
  async executePipelinePattern(
    pipelineId: string,
    executeFn: (config: PipelineConfig) => Promise<unknown>
  ): Promise<PatternExecutionResult> {
    const config = this.patterns.get(pipelineId);

    if (!config || config.pattern !== CoordinationPattern.PIPELINE || !config.pipeline) {
      throw new AgentError(
        `Pipeline pattern not found: ${pipelineId}`,
        'CoordinationPatterns',
        { pipelineId }
      );
    }

    return this.executePattern(pipelineId, async () => executeFn(config.pipeline!));
  }

  /**
   * Get execution result
   *
   * @param executionId - Execution ID
   * @returns Execution result or undefined
   */
  getExecution(executionId: string): PatternExecutionResult | undefined {
    return this.executions.get(executionId);
  }

  /**
   * Get all executions
   *
   * @param filter - Optional filter
   * @returns Array of execution results
   */
  getAllExecutions(filter?: { pattern?: CoordinationPattern; success?: boolean }): PatternExecutionResult[] {
    let executions = Array.from(this.executions.values());

    if (filter?.pattern) {
      executions = executions.filter((e) => e.pattern === filter.pattern);
    }

    if (filter?.success !== undefined) {
      executions = executions.filter((e) => e.success === filter.success);
    }

    return executions;
  }

  /**
   * Unregister a pattern
   *
   * @param patternId - Pattern ID
   * @returns True if pattern was removed
   */
  unregisterPattern(patternId: string): boolean {
    const removed = this.patterns.delete(patternId);

    if (removed) {
      this.logger.info(
        `Unregistered pattern: ${patternId}`,
        'CoordinationPatterns'
      );
    }

    return removed;
  }

  /**
   * Clear all patterns
   */
  clearPatterns(): void {
    this.patterns.clear();
    this.logger.debug('All patterns cleared', 'CoordinationPatterns');
  }

  /**
   * Clear all executions
   */
  clearExecutions(): void {
    this.executions.clear();
    this.logger.debug('All executions cleared', 'CoordinationPatterns');
  }

  /**
   * Get pattern statistics
   *
   * @returns Statistics about patterns
   */
  getStatistics(): {
    totalPatterns: number;
    totalExecutions: number;
    patternsByType: Record<CoordinationPattern, number>;
    successRate: number;
    avgDurationMs: number;
  } {
    const patternsByType: Record<CoordinationPattern, number> = {
      [CoordinationPattern.TEAM]: 0,
      [CoordinationPattern.SWARM]: 0,
      [CoordinationPattern.HIERARCHICAL]: 0,
      [CoordinationPattern.PIPELINE]: 0,
      [CoordinationPattern.PEER_TO_PEER]: 0,
    };

    for (const config of this.patterns.values()) {
      patternsByType[config.pattern]++;
    }

    const executions = Array.from(this.executions.values());
    const successCount = executions.filter((e) => e.success).length;
    const successRate = executions.length > 0 ? successCount / executions.length : 1.0;
    const avgDurationMs =
      executions.length > 0
        ? executions.reduce((sum, e) => sum + e.durationMs, 0) / executions.length
        : 0;

    return {
      totalPatterns: this.patterns.size,
      totalExecutions: this.executions.size,
      patternsByType,
      successRate,
      avgDurationMs,
    };
  }

  /**
   * Count agents in a pattern
   *
   * @param config - Pattern configuration
   * @returns Number of agents
   */
  private countAgentsInPattern(config: PatternConfig): number {
    switch (config.pattern) {
      case CoordinationPattern.TEAM:
        return config.team?.roles.size || 0;
      case CoordinationPattern.SWARM:
        return config.swarm?.agentCount || 0;
      case CoordinationPattern.HIERARCHICAL:
        return config.hierarchy?.hierarchy.size || 0;
      case CoordinationPattern.PIPELINE:
        return config.pipeline?.stages.length || 0;
      default:
        return 0;
    }
  }

  /**
   * Get pattern ID from configuration
   *
   * @param config - Pattern configuration
   * @returns Pattern ID
   */
  private getPatternIdFromConfig(config: PatternConfig): string {
    switch (config.pattern) {
      case CoordinationPattern.TEAM:
        return config.team?.teamId || this.generatePatternId(config);
      case CoordinationPattern.SWARM:
        return config.swarm?.swarmId || this.generatePatternId(config);
      case CoordinationPattern.HIERARCHICAL:
        return config.hierarchy?.hierarchyId || this.generatePatternId(config);
      case CoordinationPattern.PIPELINE:
        return config.pipeline?.pipelineId || this.generatePatternId(config);
      default:
        return this.generatePatternId(config);
    }
  }

  /**
   * Generate pattern ID
   *
   * @param config - Pattern configuration
   * @returns Pattern ID
   */
  private generatePatternId(config: PatternConfig): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `${config.pattern}_${timestamp}_${random}`;
  }

  /**
   * Generate execution ID
   *
   * @returns Execution ID
   */
  private generateExecutionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `exec_${timestamp}_${random}`;
  }
}

/**
 * Schema for team configuration
 */
export const TeamConfigSchema = z.object({
  teamId: z.string(),
  name: z.string(),
  roles: z.map(z.string(), z.nativeEnum(AgentRole)),
  channels: z.array(z.string()),
  pattern: z.nativeEnum(CoordinationPattern),
});

/**
 * Schema for swarm configuration
 */
export const SwarmConfigSchema = z.object({
  swarmId: z.string(),
  agentCount: z.number().min(1),
  distributionStrategy: z.enum(['round_robin', 'random', 'load_balanced']),
  aggregationStrategy: z.enum(['first', 'majority', 'consensus', 'all']),
  maxConcurrent: z.number().min(1).optional(),
});

/**
 * Schema for hierarchical configuration
 */
export const HierarchicalConfigSchema = z.object({
  hierarchyId: z.string(),
  supervisorId: z.string(),
  hierarchy: z.map(z.string(), z.array(z.string())),
  delegationStrategy: z.enum(['direct', 'capability_based', 'load_based']),
  reportFrequencyMs: z.number().min(0).optional(),
});

/**
 * Schema for pipeline configuration
 */
export const PipelineConfigSchema = z.object({
  pipelineId: z.string(),
  stages: z.array(z.string()).min(1),
  parallel: z.boolean().optional(),
  dataStrategy: z.enum(['pass_all', 'pass_filtered', 'pass_transformed']),
  errorStrategy: z.enum(['stop', 'continue', 'retry']),
});

/**
 * Schema for pattern configuration
 */
export const PatternConfigSchema = z.object({
  pattern: z.nativeEnum(CoordinationPattern),
  team: TeamConfigSchema.optional(),
  swarm: SwarmConfigSchema.optional(),
  hierarchy: HierarchicalConfigSchema.optional(),
  pipeline: PipelineConfigSchema.optional(),
});

/**
 * Global coordination patterns instance
 */
let globalCoordinationPatterns: CoordinationPatterns | null = null;

/**
 * Initialize global coordination patterns
 *
 * @param logger - Optional logger instance
 * @returns The global coordination patterns
 */
export function initCoordinationPatterns(logger?: LoggerLike): CoordinationPatterns {
  globalCoordinationPatterns = new CoordinationPatterns(logger);
  return globalCoordinationPatterns;
}

/**
 * Get global coordination patterns
 *
 * @returns The global coordination patterns
 */
export function getCoordinationPatterns(): CoordinationPatterns {
  if (!globalCoordinationPatterns) {
    globalCoordinationPatterns = new CoordinationPatterns();
  }
  return globalCoordinationPatterns;
}
