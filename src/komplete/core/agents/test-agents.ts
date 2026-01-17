/**
 * Test Agents for KOMPLETE-KONTROL CLI
 *
 * Provides basic test agents for testing the agent system.
 * These agents demonstrate the agent system capabilities.
 */

import type { AgentDefinition } from '../../types';
import { getAgentRegistry } from './registry';
import { getAgentLifecycleManager } from './lifecycle';

/**
 * General mode agent definition
 */
export const GENERAL_AGENT: AgentDefinition = {
  id: 'general',
  name: 'General Assistant',
  description: 'A general-purpose AI assistant for everyday tasks and questions',
  capabilities: ['chat', 'code-assist', 'analysis', 'research'],
  systemPrompt: `You are a helpful, knowledgeable AI assistant. You provide clear, accurate, and thoughtful responses to a wide variety of questions and tasks. You are friendly, professional, and always strive to be helpful while being honest about your limitations.`,
  dependencies: [],
};

/**
 * Coder mode agent definition
 */
export const CODER_AGENT: AgentDefinition = {
  id: 'coder',
  name: 'Code Assistant',
  description: 'Specialized AI assistant for coding, debugging, and software development tasks',
  capabilities: ['code', 'debug', 'refactor', 'code-review', 'documentation'],
  systemPrompt: `You are an expert software development assistant. You help with writing, reviewing, debugging, and refactoring code. You follow best practices, write clean and maintainable code, and provide clear explanations. You are familiar with multiple programming languages and frameworks.`,
  dependencies: ['general'],
};

/**
 * Reverse engineer mode agent definition
 */
export const REVERSE_ENGINEER_AGENT: AgentDefinition = {
  id: 'reverse-engineer',
  name: 'Reverse Engineering Assistant',
  description: 'Specialized AI assistant for reverse engineering, binary analysis, and system internals exploration',
  capabilities: ['reverse-engineering', 'binary-analysis', 'decompilation', 'system-analysis'],
  systemPrompt: `You are an expert in reverse engineering and system analysis. You help understand how software and systems work internally, analyze binaries, and explore undocumented behavior. You approach tasks methodically and provide detailed technical explanations.`,
  dependencies: ['coder', 'general'],
};

/**
 * Test agent definitions
 */
export const TEST_AGENTS: AgentDefinition[] = [
  GENERAL_AGENT,
  CODER_AGENT,
  REVERSE_ENGINEER_AGENT,
];

/**
 * Initialize test agents
 *
 * Registers all test agents with the registry and initializes them.
 */
export async function initializeTestAgents(): Promise<void> {
  const registry = getAgentRegistry();
  const lifecycleManager = getAgentLifecycleManager();

  for (const agent of TEST_AGENTS) {
    try {
      // Register agent
      registry.register(agent, {
        autoStart: false,
        priority: 0,
        tags: ['test', agent.capabilities[0] ?? 'general'],
      });

      // Initialize agent
      await lifecycleManager.initialize(agent.id);
    } catch (error) {
      console.error(`Failed to initialize agent '${agent.id}':`, error);
    }
  }
}

/**
 * Get test agent by ID
 *
 * @param agentId - Agent ID to get
 * @returns Agent definition or undefined if not found
 */
export function getTestAgent(agentId: string): AgentDefinition | undefined {
  return TEST_AGENTS.find((agent) => agent.id === agentId);
}
