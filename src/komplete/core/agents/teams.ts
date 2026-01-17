/**
 * Agent Team Formation
 *
 * Provides dynamic team composition, role-based team assignment,
 * and team communication channels for multi-agent systems.
 */

import { z } from 'zod';
import { Logger } from '../../utils/logger';
import { AgentError } from '../../types';
import { AgentRole, CoordinationPattern, type TeamConfig } from './patterns';
import type { AgentMessage } from './communication';

/**
 * Agent capability
 */
export interface AgentCapability {
  /**
   * Capability name
   */
  name: string;

  /**
   * Capability description
   */
  description: string;

  /**
   * Capability score (0-1)
   */
  score: number;

  /**
   * Capability tags
   */
  tags: string[];
}

/**
 * Agent profile
 */
export interface AgentProfile {
  /**
   * Agent ID
   */
  agentId: string;

  /**
   * Agent name
   */
  name: string;

  /**
   * Agent capabilities
   */
  capabilities: AgentCapability[];

  /**
   * Agent role preferences
   */
  rolePreferences: AgentRole[];

  /**
   * Agent availability
   */
  available: boolean;

  /**
   * Current load (0-1)
   */
  load: number;

  /**
   * Agent metadata
   */
  metadata: Record<string, unknown>;
}

/**
 * Team member
 */
export interface TeamMember {
  /**
   * Agent ID
   */
  agentId: string;

  /**
   * Role in team
   */
  role: AgentRole;

  /**
   * Assigned at timestamp
   */
  assignedAt: Date;

  /**
   * Performance score
   */
  performanceScore: number;
}

/**
 * Team communication channel
 */
export interface TeamChannel {
  /**
   * Channel ID
   */
  channelId: string;

  /**
   * Channel name
   */
  name: string;

  /**
   * Channel type
   */
  type: 'broadcast' | 'direct' | 'topic' | 'role_based';

  /**
   * Channel members
   */
  members: Set<string>;

  /**
   * Channel messages
   */
  messages: AgentMessage[];

  /**
   * Channel metadata
   */
  metadata: Record<string, unknown>;
}

/**
 * Team formation request
 */
export interface TeamFormationRequest {
  /**
   * Team name
   */
  name: string;

  /**
   * Required capabilities
   */
  requiredCapabilities: string[];

  /**
   * Required roles
   */
  requiredRoles: AgentRole[];

  /**
   * Team size
   */
  teamSize: number;

  /**
   * Task description
   */
  taskDescription?: string;

  /**
   * Formation strategy
   */
  strategy: 'capability_based' | 'role_based' | 'load_balanced' | 'random';

  /**
   * Communication channels to create
   */
  channels?: string[];
}

/**
 * Team formation result
 */
export interface TeamFormationResult {
  /**
   * Team ID
   */
  teamId: string;

  /**
   * Team configuration
   */
  team: TeamConfig;

  /**
   * Formation success
   */
  success: boolean;

  /**
   * Formation duration in milliseconds
   */
  durationMs: number;

  /**
   * Error if failed
   */
  error?: Error;
}

/**
 * Teams class
 *
 * Provides dynamic team composition and role-based team assignment.
 */
export class Teams {
  private logger: Logger;
  private agents: Map<string, AgentProfile> = new Map();
  private teams: Map<string, TeamConfig> = new Map();
  private teamMembers: Map<string, TeamMember[]> = new Map();
  private channels: Map<string, TeamChannel> = new Map();
  private agentChannels: Map<string, Set<string>> = new Map();

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
    this.logger.info('Teams initialized', 'Teams');
  }

  /**
   * Register an agent
   *
   * @param profile - Agent profile
   */
  registerAgent(profile: AgentProfile): void {
    this.agents.set(profile.agentId, profile);

    // Initialize agent channels
    this.agentChannels.set(profile.agentId, new Set());

    this.logger.info(
      `Registered agent: ${profile.name}`,
      'Teams',
      { agentId: profile.agentId, capabilities: profile.capabilities.length }
    );
  }

  /**
   * Unregister an agent
   *
   * @param agentId - Agent ID
   * @returns True if agent was removed
   */
  unregisterAgent(agentId: string): boolean {
    const removed = this.agents.delete(agentId);

    if (removed) {
      // Remove from all teams
      this.removeAgentFromAllTeams(agentId);

      // Remove from all channels
      this.removeAgentFromAllChannels(agentId);

      this.logger.info(
        `Unregistered agent: ${agentId}`,
        'Teams'
      );
    }

    return removed;
  }

  /**
   * Get agent profile
   *
   * @param agentId - Agent ID
   * @returns Agent profile or undefined
   */
  getAgent(agentId: string): AgentProfile | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get all agents
   *
   * @param filter - Optional filter
   * @returns Array of agent profiles
   */
  getAllAgents(filter?: {
    available?: boolean;
    capability?: string;
    role?: AgentRole;
  }): AgentProfile[] {
    let agents = Array.from(this.agents.values());

    if (filter?.available !== undefined) {
      agents = agents.filter((a) => a.available === filter.available);
    }

    if (filter?.capability) {
      agents = agents.filter((a) =>
        a.capabilities.some((c) => c.name === filter.capability)
      );
    }

    if (filter?.role) {
      agents = agents.filter((a) => a.rolePreferences.includes(filter.role!));
    }

    return agents;
  }

  /**
   * Update agent availability
   *
   * @param agentId - Agent ID
   * @param available - Availability status
   */
  updateAgentAvailability(agentId: string, available: boolean): void {
    const agent = this.agents.get(agentId);

    if (agent) {
      agent.available = available;

      this.logger.debug(
        `Updated agent availability: ${agentId}`,
        'Teams',
        { available }
      );
    }
  }

  /**
   * Update agent load
   *
   * @param agentId - Agent ID
   * @param load - Load value (0-1)
   */
  updateAgentLoad(agentId: string, load: number): void {
    const agent = this.agents.get(agentId);

    if (agent) {
      agent.load = Math.max(0, Math.min(1, load));

      this.logger.debug(
        `Updated agent load: ${agentId}`,
        'Teams',
        { load: agent.load }
      );
    }
  }

  /**
   * Form a team based on request
   *
   * @param request - Team formation request
   * @returns Team formation result
   */
  async formTeam(request: TeamFormationRequest): Promise<TeamFormationResult> {
    const startTime = Date.now();
    const teamId = this.generateTeamId();

    this.logger.info(
      `Forming team: ${request.name}`,
      'Teams',
      { teamId, strategy: request.strategy, teamSize: request.teamSize }
    );

    try {
      // Select agents based on strategy
      const selectedAgents = await this.selectAgents(request);

      if (selectedAgents.length < request.teamSize) {
        throw new AgentError(
          `Could not form team: insufficient agents (${selectedAgents.length}/${request.teamSize})`,
          'Teams',
          { required: request.teamSize, available: selectedAgents.length }
        );
      }

      // Assign roles
      const roles = this.assignRoles(selectedAgents, request);

      // Create team configuration
      const team: TeamConfig = {
        teamId,
        name: request.name,
        roles,
        channels: [],
        pattern: CoordinationPattern.TEAM,
      };

      // Create communication channels
      if (request.channels) {
        for (const channelName of request.channels) {
          const channelId = this.createChannel(
            channelName,
            'broadcast',
            new Set(selectedAgents.map((a) => a.agentId))
          );
          team.channels.push(channelId);
        }
      }

      // Store team
      this.teams.set(teamId, team);

      // Store team members
      const members: TeamMember[] = selectedAgents.map((agent) => ({
        agentId: agent.agentId,
        role: roles.get(agent.agentId)!,
        assignedAt: new Date(),
        performanceScore: 1.0,
      }));

      this.teamMembers.set(teamId, members);

      const durationMs = Date.now() - startTime;

      this.logger.info(
        `Team formed successfully: ${request.name}`,
        'Teams',
        { teamId, durationMs, memberCount: members.length }
      );

      return {
        teamId,
        team,
        success: true,
        durationMs,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;

      this.logger.error(
        `Team formation failed: ${request.name}`,
        'Teams',
        { durationMs, error: (error as Error).message }
      );

      return {
        teamId,
        team: {
          teamId,
          name: request.name,
          roles: new Map(),
          channels: [],
          pattern: CoordinationPattern.TEAM,
        },
        success: false,
        durationMs,
        error: error as Error,
      };
    }
  }

  /**
   * Select agents based on strategy
   *
   * @param request - Team formation request
   * @returns Selected agent profiles
   */
  private async selectAgents(
    request: TeamFormationRequest
  ): Promise<AgentProfile[]> {
    let candidates = Array.from(this.agents.values()).filter((a) => a.available);

    switch (request.strategy) {
      case 'capability_based':
        return this.selectByCapability(candidates, request);

      case 'role_based':
        return this.selectByRole(candidates, request);

      case 'load_balanced':
        return this.selectByLoad(candidates, request);

      case 'random':
        return this.selectRandom(candidates, request);

      default:
        return this.selectByCapability(candidates, request);
    }
  }

  /**
   * Select agents by capability
   *
   * @param candidates - Candidate agents
   * @param request - Team formation request
   * @returns Selected agents
   */
  private selectByCapability(
    candidates: AgentProfile[],
    request: TeamFormationRequest
  ): AgentProfile[] {
    // Score candidates based on required capabilities
    const scored = candidates.map((agent) => {
      let score = 0;

      for (const cap of request.requiredCapabilities) {
        const agentCap = agent.capabilities.find((c) => c.name === cap);
        if (agentCap) {
          score += agentCap.score;
        }
      }

      return { agent, score };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Return top agents
    return scored.slice(0, request.teamSize).map((s) => s.agent);
  }

  /**
   * Select agents by role
   *
   * @param candidates - Candidate agents
   * @param request - Team formation request
   * @returns Selected agents
   */
  private selectByRole(
    candidates: AgentProfile[],
    request: TeamFormationRequest
  ): AgentProfile[] {
    const selected: AgentProfile[] = [];

    // Select one agent for each required role
    for (const role of request.requiredRoles) {
      const roleAgents = candidates.filter((a) =>
        a.rolePreferences.includes(role)
      );

      if (roleAgents.length > 0) {
        // Select agent with lowest load
        roleAgents.sort((a, b) => a.load - b.load);
        selected.push(roleAgents[0]!);
        candidates = candidates.filter((a) => a.agentId !== roleAgents[0]!.agentId);
      }
    }

    // Fill remaining slots with any available agents
    while (selected.length < request.teamSize && candidates.length > 0) {
      candidates.sort((a, b) => a.load - b.load);
      selected.push(candidates[0]!);
      candidates = candidates.slice(1);
    }

    return selected;
  }

  /**
   * Select agents by load
   *
   * @param candidates - Candidate agents
   * @param request - Team formation request
   * @returns Selected agents
   */
  private selectByLoad(
    candidates: AgentProfile[],
    request: TeamFormationRequest
  ): AgentProfile[] {
    // Sort by load ascending
    candidates.sort((a, b) => a.load - b.load);

    // Return top agents
    return candidates.slice(0, request.teamSize);
  }

  /**
   * Select agents randomly
   *
   * @param candidates - Candidate agents
   * @param request - Team formation request
   * @returns Selected agents
   */
  private selectRandom(
    candidates: AgentProfile[],
    request: TeamFormationRequest
  ): AgentProfile[] {
    // Shuffle candidates
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);

    // Return first N agents
    return shuffled.slice(0, request.teamSize);
  }

  /**
   * Assign roles to agents
   *
   * @param agents - Selected agents
   * @param request - Team formation request
   * @returns Role assignments
   */
  private assignRoles(
    agents: AgentProfile[],
    request: TeamFormationRequest
  ): Map<string, AgentRole> {
    const roles = new Map<string, AgentRole>();

    // Assign required roles first
    for (const role of request.requiredRoles) {
      const agent = agents.find(
        (a) => a.rolePreferences.includes(role) && !roles.has(a.agentId)
      );

      if (agent) {
        roles.set(agent.agentId, role);
      }
    }

    // Assign remaining roles
    for (const agent of agents) {
      if (!roles.has(agent.agentId)) {
        // Use first preference or default to support
        roles.set(
          agent.agentId,
          agent.rolePreferences[0] || AgentRole.SUPPORT
        );
      }
    }

    return roles;
  }

  /**
   * Create a communication channel
   *
   * @param name - Channel name
   * @param type - Channel type
   * @param members - Channel members
   * @returns Channel ID
   */
  createChannel(
    name: string,
    type: 'broadcast' | 'direct' | 'topic' | 'role_based',
    members: Set<string>
  ): string {
    const channelId = this.generateChannelId();

    const channel: TeamChannel = {
      channelId,
      name,
      type,
      members,
      messages: [],
      metadata: {},
    };

    this.channels.set(channelId, channel);

    // Add channel to each member
    for (const memberId of members) {
      const channels = this.agentChannels.get(memberId) || new Set();
      channels.add(channelId);
      this.agentChannels.set(memberId, channels);
    }

    this.logger.info(
      `Created channel: ${name}`,
      'Teams',
      { channelId, type, memberCount: members.size }
    );

    return channelId;
  }

  /**
   * Get channel
   *
   * @param channelId - Channel ID
   * @returns Channel or undefined
   */
  getChannel(channelId: string): TeamChannel | undefined {
    return this.channels.get(channelId);
  }

  /**
   * Get channels for an agent
   *
   * @param agentId - Agent ID
   * @returns Array of channels
   */
  getAgentChannels(agentId: string): TeamChannel[] {
    const channelIds = this.agentChannels.get(agentId) || new Set();

    return Array.from(channelIds)
      .map((id) => this.channels.get(id))
      .filter((c): c is TeamChannel => c !== undefined);
  }

  /**
   * Send message to channel
   *
   * @param channelId - Channel ID
   * @param message - Message to send
   */
  sendMessage(channelId: string, message: AgentMessage): void {
    const channel = this.channels.get(channelId);

    if (channel) {
      channel.messages.push(message);

      this.logger.debug(
        `Message sent to channel: ${channel.name}`,
        'Teams',
        { channelId, from: message.from, to: message.to }
      );
    }
  }

  /**
   * Get messages from channel
   *
   * @param channelId - Channel ID
   * @param filter - Optional filter
   * @returns Array of messages
   */
  getChannelMessages(
    channelId: string,
    filter?: { from?: string; to?: string; since?: Date }
  ): AgentMessage[] {
    const channel = this.channels.get(channelId);

    if (!channel) {
      return [];
    }

    let messages = [...channel.messages];

    if (filter?.from) {
      messages = messages.filter((m) => m.from === filter.from);
    }

    if (filter?.to) {
      messages = messages.filter((m) => m.to === filter.to);
    }

    if (filter?.since) {
      messages = messages.filter((m) => m.timestamp >= filter.since!);
    }

    return messages;
  }

  /**
   * Dissolve a team
   *
   * @param teamId - Team ID
   * @returns True if team was dissolved
   */
  dissolveTeam(teamId: string): boolean {
    const team = this.teams.get(teamId);

    if (!team) {
      return false;
    }

    // Remove members from team
    const members = this.teamMembers.get(teamId) || [];
    for (const member of members) {
      this.removeAgentFromTeam(teamId, member.agentId);
    }

    // Delete team channels
    for (const channelId of team.channels) {
      this.deleteChannel(channelId);
    }

    // Remove team
    this.teams.delete(teamId);
    this.teamMembers.delete(teamId);

    this.logger.info(
      `Team dissolved: ${team.name}`,
      'Teams',
      { teamId }
    );

    return true;
  }

  /**
   * Remove agent from all teams
   *
   * @param agentId - Agent ID
   */
  private removeAgentFromAllTeams(agentId: string): void {
    for (const [teamId, members] of this.teamMembers.entries()) {
      const index = members.findIndex((m) => m.agentId === agentId);

      if (index !== -1) {
        members.splice(index, 1);

        // Update team roles
        const team = this.teams.get(teamId);
        if (team) {
          team.roles.delete(agentId);
        }
      }
    }
  }

  /**
   * Remove agent from team
   *
   * @param teamId - Team ID
   * @param agentId - Agent ID
   */
  private removeAgentFromTeam(teamId: string, agentId: string): void {
    const members = this.teamMembers.get(teamId);
    if (members) {
      const index = members.findIndex((m) => m.agentId === agentId);
      if (index !== -1) {
        members.splice(index, 1);
      }
    }

    const team = this.teams.get(teamId);
    if (team) {
      team.roles.delete(agentId);
    }
  }

  /**
   * Remove agent from all channels
   *
   * @param agentId - Agent ID
   */
  private removeAgentFromAllChannels(agentId: string): void {
    const channelIds = this.agentChannels.get(agentId) || new Set();

    for (const channelId of channelIds) {
      const channel = this.channels.get(channelId);
      if (channel) {
        channel.members.delete(agentId);
      }
    }

    this.agentChannels.delete(agentId);
  }

  /**
   * Delete a channel
   *
   * @param channelId - Channel ID
   * @returns True if channel was deleted
   */
  deleteChannel(channelId: string): boolean {
    const channel = this.channels.get(channelId);

    if (!channel) {
      return false;
    }

    // Remove channel from all members
    for (const memberId of channel.members) {
      const channels = this.agentChannels.get(memberId);
      if (channels) {
        channels.delete(channelId);
      }
    }

    // Delete channel
    this.channels.delete(channelId);

    this.logger.info(
      `Channel deleted: ${channel.name}`,
      'Teams',
      { channelId }
    );

    return true;
  }

  /**
   * Get team configuration
   *
   * @param teamId - Team ID
   * @returns Team configuration or undefined
   */
  getTeam(teamId: string): TeamConfig | undefined {
    return this.teams.get(teamId);
  }

  /**
   * Get team members
   *
   * @param teamId - Team ID
   * @returns Array of team members
   */
  getTeamMembers(teamId: string): TeamMember[] {
    return this.teamMembers.get(teamId) || [];
  }

  /**
   * Get all teams
   *
   * @returns Array of team configurations
   */
  getAllTeams(): TeamConfig[] {
    return Array.from(this.teams.values());
  }

  /**
   * Update team member performance
   *
   * @param teamId - Team ID
   * @param agentId - Agent ID
   * @param score - Performance score
   */
  updateMemberPerformance(
    teamId: string,
    agentId: string,
    score: number
  ): void {
    const members = this.teamMembers.get(teamId);

    if (members) {
      const member = members.find((m) => m.agentId === agentId);

      if (member) {
        // Exponential moving average
        member.performanceScore = 0.7 * member.performanceScore + 0.3 * score;

        this.logger.debug(
          `Updated member performance: ${agentId}`,
          'Teams',
          { teamId, score: member.performanceScore }
        );
      }
    }
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.agents.clear();
    this.teams.clear();
    this.teamMembers.clear();
    this.channels.clear();
    this.agentChannels.clear();
    this.logger.debug('All data cleared', 'Teams');
  }

  /**
   * Get statistics
   *
   * @returns Statistics about teams
   */
  getStatistics(): {
    totalAgents: number;
    availableAgents: number;
    totalTeams: number;
    totalChannels: number;
    avgTeamSize: number;
    avgAgentLoad: number;
  } {
    const agents = Array.from(this.agents.values());
    const availableAgents = agents.filter((a) => a.available).length;
    const teams = Array.from(this.teamMembers.values());
    const avgTeamSize =
      teams.length > 0
        ? teams.reduce((sum, m) => sum + m.length, 0) / teams.length
        : 0;
    const avgAgentLoad =
      agents.length > 0
        ? agents.reduce((sum, a) => sum + a.load, 0) / agents.length
        : 0;

    return {
      totalAgents: this.agents.size,
      availableAgents,
      totalTeams: this.teams.size,
      totalChannels: this.channels.size,
      avgTeamSize,
      avgAgentLoad,
    };
  }

  /**
   * Generate team ID
   *
   * @returns Team ID
   */
  private generateTeamId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `team_${timestamp}_${random}`;
  }

  /**
   * Generate channel ID
   *
   * @returns Channel ID
   */
  private generateChannelId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `channel_${timestamp}_${random}`;
  }
}

/**
 * Schema for agent capability
 */
export const AgentCapabilitySchema = z.object({
  name: z.string(),
  description: z.string(),
  score: z.number().min(0).max(1),
  tags: z.array(z.string()),
});

/**
 * Schema for agent profile
 */
export const AgentProfileSchema = z.object({
  agentId: z.string(),
  name: z.string(),
  capabilities: z.array(AgentCapabilitySchema),
  rolePreferences: z.array(z.nativeEnum(AgentRole)),
  available: z.boolean(),
  load: z.number().min(0).max(1),
  metadata: z.record(z.unknown()),
});

/**
 * Schema for team formation request
 */
export const TeamFormationRequestSchema = z.object({
  name: z.string(),
  requiredCapabilities: z.array(z.string()),
  requiredRoles: z.array(z.nativeEnum(AgentRole)),
  teamSize: z.number().min(1),
  taskDescription: z.string().optional(),
  strategy: z.enum(['capability_based', 'role_based', 'load_balanced', 'random']),
  channels: z.array(z.string()).optional(),
});

/**
 * Global teams instance
 */
let globalTeams: Teams | null = null;

/**
 * Initialize global teams
 *
 * @param logger - Optional logger instance
 * @returns The global teams
 */
export function initTeams(logger?: Logger): Teams {
  globalTeams = new Teams(logger);
  return globalTeams;
}

/**
 * Get global teams
 *
 * @returns The global teams
 */
export function getTeams(): Teams {
  if (!globalTeams) {
    globalTeams = new Teams();
  }
  return globalTeams;
}
