/**
 * Agent Registry for KOMPLETE-KONTROL CLI
 *
 * Provides agent registration, discovery, and management capabilities.
 * Follows patterns from agent-swarm-kit with simplified architecture.
 */

import type { AgentDefinition } from '../../types';
import { AgentError } from '../../types';
import { Logger } from '../../utils/logger';

/**
 * Agent registration options
 */
export interface AgentRegistrationOptions {
  /**
   * Whether to auto-start the agent on registration
   */
  autoStart?: boolean;
  /**
   * Priority for agent selection (higher = preferred)
   */
  priority?: number;
  /**
   * Tags for categorization and filtering
   */
  tags?: string[];
}

/**
 * Agent registration record
 */
interface AgentRecord {
  definition: AgentDefinition;
  options: AgentRegistrationOptions;
  registeredAt: Date;
  lastUsed?: Date;
  status: 'registered' | 'active' | 'paused' | 'unregistered';
}

/**
 * Agent filter options
 */
export interface AgentFilterOptions {
  /**
   * Filter by capability
   */
  capability?: string;
  /**
   * Filter by tag
   */
  tag?: string;
  /**
   * Filter by status
   */
  status?: 'registered' | 'active' | 'paused' | 'unregistered';
  /**
   * Filter by dependencies (agents that depend on given agent)
   */
  dependsOn?: string;
  /**
   * Minimum priority
   */
  minPriority?: number;
}

/**
 * Agent statistics
 */
export interface AgentStatistics {
  /**
   * Total number of registered agents
   */
  totalAgents: number;
  /**
   * Number of active agents
   */
  activeAgents: number;
  /**
   * Number of paused agents
   */
  pausedAgents: number;
  /**
   * Most recently used agent
   */
  lastUsedAgent?: string;
  /**
   * Capabilities distribution
   */
  capabilitiesDistribution: Record<string, number>;
}

/**
 * Agent Registry class
 *
 * Manages agent registration, discovery, and querying.
 * Provides a centralized registry for all available agents.
 */
export class AgentRegistry {
  private agents: Map<string, AgentRecord> = new Map();
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
    this.logger.info('AgentRegistry initialized', 'AgentRegistry');
  }

  /**
   * Register an agent
   *
   * @param definition - Agent definition to register
   * @param options - Registration options
   * @returns The registered agent ID
   * @throws AgentError if agent with same ID already exists
   */
  register(definition: AgentDefinition, options: AgentRegistrationOptions = {}): string {
    const agentId = definition.id;

    // Check if agent already exists
    if (this.agents.has(agentId)) {
      throw new AgentError(
        `Agent with ID '${agentId}' is already registered`,
        agentId,
        { existingAgent: this.agents.get(agentId)?.definition }
      );
    }

    // Validate agent definition
    this.validateDefinition(definition);

    // Create agent record
    const record: AgentRecord = {
      definition,
      options: {
        autoStart: options.autoStart ?? false,
        priority: options.priority ?? 0,
        tags: options.tags ?? [],
      },
      registeredAt: new Date(),
      status: options.autoStart ? 'active' : 'registered',
    };

    // Store agent
    this.agents.set(agentId, record);

    this.logger.info(
      `Agent registered: ${agentId}`,
      'AgentRegistry',
      {
        name: definition.name,
        capabilities: definition.capabilities,
        status: record.status,
      }
    );

    return agentId;
  }

  /**
   * Unregister an agent
   *
   * @param agentId - ID of agent to unregister
   * @returns True if agent was unregistered, false if not found
   */
  unregister(agentId: string): boolean {
    const record = this.agents.get(agentId);

    if (!record) {
      this.logger.warn(`Agent not found for unregistration: ${agentId}`, 'AgentRegistry');
      return false;
    }

    // Check for dependent agents
    const dependents = this.getDependents(agentId);
    if (dependents.length > 0) {
      throw new AgentError(
        `Cannot unregister agent '${agentId}' - ${dependents.length} agent(s) depend on it`,
        agentId,
        { dependents }
      );
    }

    // Mark as unregistered
    record.status = 'unregistered';

    this.logger.info(`Agent unregistered: ${agentId}`, 'AgentRegistry', {
      name: record.definition.name,
    });

    return true;
  }

  /**
   * Get an agent by ID
   *
   * @param agentId - ID of agent to get
   * @returns Agent definition or undefined if not found
   */
  get(agentId: string): AgentDefinition | undefined {
    const record = this.agents.get(agentId);
    return record?.definition;
  }

  /**
   * Check if an agent is registered
   *
   * @param agentId - ID of agent to check
   * @returns True if agent is registered
   */
  has(agentId: string): boolean {
    return this.agents.has(agentId);
  }

  /**
   * List all registered agents
   *
   * @param filter - Optional filter options
   * @returns Array of agent definitions
   */
  list(filter?: AgentFilterOptions): AgentDefinition[] {
    let agents = Array.from(this.agents.values());

    // Apply filters
    if (filter) {
      if (filter.capability) {
        agents = agents.filter((record) =>
          record.definition.capabilities.includes(filter.capability!)
        );
      }
      if (filter.tag) {
        agents = agents.filter((record) =>
          record.options.tags?.includes(filter.tag!)
        );
      }
      if (filter.status) {
        agents = agents.filter((record) => record.status === filter.status);
      }
      if (filter.dependsOn) {
        agents = agents.filter((record) =>
          record.definition.dependencies?.includes(filter.dependsOn!)
        );
      }
      if (filter.minPriority !== undefined) {
        agents = agents.filter(
          (record) => record.options.priority! >= filter.minPriority!
        );
      }
    }

    // Sort by priority (descending) then by registration time (ascending)
    agents.sort((a, b) => {
      const priorityDiff = (b.options.priority ?? 0) - (a.options.priority ?? 0);
      if (priorityDiff !== 0) return priorityDiff;
      return a.registeredAt.getTime() - b.registeredAt.getTime();
    });

    return agents.map((record) => record.definition);
  }

  /**
   * Find agents by capability
   *
   * @param capability - Capability to search for
   * @returns Array of agent definitions with the capability
   */
  findByCapability(capability: string): AgentDefinition[] {
    return this.list({ capability });
  }

  /**
   * Find agents by tag
   *
   * @param tag - Tag to search for
   * @returns Array of agent definitions with the tag
   */
  findByTag(tag: string): AgentDefinition[] {
    return this.list({ tag });
  }

  /**
   * Get agent capabilities
   *
   * @param agentId - ID of agent
   * @returns Array of capabilities or undefined if agent not found
   */
  getCapabilities(agentId: string): string[] | undefined {
    const record = this.agents.get(agentId);
    return record?.definition.capabilities;
  }

  /**
   * Check if agent dependencies are satisfied
   *
   * @param agentId - ID of agent to check
   * @returns True if all dependencies are registered
   */
  checkDependencies(agentId: string): boolean {
    const record = this.agents.get(agentId);

    if (!record || !record.definition.dependencies) {
      return true;
    }

    const { dependencies } = record.definition;

    for (const depId of dependencies) {
      if (!this.agents.has(depId)) {
        this.logger.warn(
          `Missing dependency for agent '${agentId}': ${depId}`,
          'AgentRegistry'
        );
        return false;
      }

      const depRecord = this.agents.get(depId)!;
      if (depRecord.status === 'unregistered') {
        this.logger.warn(
          `Dependency '${depId}' for agent '${agentId}' is unregistered`,
          'AgentRegistry'
        );
        return false;
      }
    }

    return true;
  }

  /**
   * Get agents that depend on a given agent
   *
   * @param agentId - ID of agent to find dependents for
   * @returns Array of agent IDs that depend on the given agent
   */
  getDependents(agentId: string): string[] {
    const dependents: string[] = [];

    for (const [id, record] of this.agents.entries()) {
      if (record.definition.dependencies?.includes(agentId)) {
        dependents.push(id);
      }
    }

    return dependents;
  }

  /**
   * Update agent status
   *
   * @param agentId - ID of agent to update
   * @param status - New status
   * @returns True if status was updated, false if agent not found
   */
  updateStatus(
    agentId: string,
    status: 'registered' | 'active' | 'paused' | 'unregistered'
  ): boolean {
    const record = this.agents.get(agentId);

    if (!record) {
      this.logger.warn(`Agent not found for status update: ${agentId}`, 'AgentRegistry');
      return false;
    }

    record.status = status;

    this.logger.debug(
      `Agent status updated: ${agentId} -> ${status}`,
      'AgentRegistry'
    );

    return true;
  }

  /**
   * Mark agent as used
   *
   * @param agentId - ID of agent to mark as used
   */
  markUsed(agentId: string): void {
    const record = this.agents.get(agentId);

    if (record) {
      record.lastUsed = new Date();
      this.logger.debug(`Agent marked as used: ${agentId}`, 'AgentRegistry');
    }
  }

  /**
   * Get agent statistics
   *
   * @returns Registry statistics
   */
  getStatistics(): AgentStatistics {
    const agents = Array.from(this.agents.values());
    const activeAgents = agents.filter((a) => a.status === 'active');
    const pausedAgents = agents.filter((a) => a.status === 'paused');

    // Find most recently used agent
    let lastUsedAgent: string | undefined;
    let lastUsedTime: Date | undefined;

    for (const [id, record] of this.agents.entries()) {
      if (record.lastUsed && (!lastUsedTime || record.lastUsed > lastUsedTime)) {
        lastUsedTime = record.lastUsed;
        lastUsedAgent = id;
      }
    }

    // Calculate capabilities distribution
    const capabilitiesDistribution: Record<string, number> = {};

    for (const record of agents) {
      for (const capability of record.definition.capabilities) {
        capabilitiesDistribution[capability] =
          (capabilitiesDistribution[capability] || 0) + 1;
      }
    }

    return {
      totalAgents: agents.length,
      activeAgents: activeAgents.length,
      pausedAgents: pausedAgents.length,
      lastUsedAgent,
      capabilitiesDistribution,
    };
  }

  /**
   * Clear all registered agents
   */
  clear(): void {
    this.agents.clear();
    this.logger.info('AgentRegistry cleared', 'AgentRegistry');
  }

  /**
   * Validate agent definition
   *
   * @param definition - Agent definition to validate
   * @throws AgentError if validation fails
   */
  private validateDefinition(definition: AgentDefinition): void {
    if (!definition.id || definition.id.trim() === '') {
      throw new AgentError('Agent ID is required', definition.id || 'unknown');
    }

    if (!definition.name || definition.name.trim() === '') {
      throw new AgentError('Agent name is required', definition.id);
    }

    if (!definition.description || definition.description.trim() === '') {
      throw new AgentError('Agent description is required', definition.id);
    }

    if (!definition.capabilities || definition.capabilities.length === 0) {
      throw new AgentError('Agent must have at least one capability', definition.id);
    }

    if (!definition.systemPrompt || definition.systemPrompt.trim() === '') {
      throw new AgentError('Agent system prompt is required', definition.id);
    }

    // Validate dependencies exist
    if (definition.dependencies) {
      for (const depId of definition.dependencies) {
        if (!this.agents.has(depId)) {
          this.logger.warn(
            `Dependency '${depId}' for agent '${definition.id}' is not yet registered`,
            'AgentRegistry'
          );
        }
      }
    }
  }
}

/**
 * Global agent registry instance
 */
let globalAgentRegistry: AgentRegistry | null = null;

/**
 * Initialize global agent registry
 *
 * @param logger - Optional logger instance
 * @returns The global agent registry
 */
export function initAgentRegistry(logger?: Logger): AgentRegistry {
  globalAgentRegistry = new AgentRegistry(logger);
  return globalAgentRegistry;
}

/**
 * Get global agent registry
 *
 * @returns The global agent registry
 */
export function getAgentRegistry(): AgentRegistry {
  if (!globalAgentRegistry) {
    globalAgentRegistry = new AgentRegistry();
  }
  return globalAgentRegistry;
}
