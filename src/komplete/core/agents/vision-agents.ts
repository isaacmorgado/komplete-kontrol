/**
 * Vision and Network Agents for KOMPLETE-KONTROL CLI
 *
 * Provides specialized agents for vision capture, screenshot-to-code,
 * and network analysis tasks (Phase 3 capabilities).
 */

import type { AgentDefinition } from '../../types';
import { getAgentRegistry } from './registry';
import { getAgentLifecycleManager } from './lifecycle';

/**
 * Vision capture agent definition
 * Specializes in capturing screenshots and extracting DOM information
 */
export const VISION_CAPTURE_AGENT: AgentDefinition = {
  id: 'vision-capture',
  name: 'Vision Capture Specialist',
  description: 'Captures screenshots with zero-drift precision and extracts DOM structure',
  capabilities: ['vision', 'screenshot', 'dom-extraction', 'browser-automation'],
  systemPrompt: `You are a vision capture specialist. You excel at:
- Capturing pixel-perfect screenshots using Playwright
- Extracting DOM structure with quality scoring
- Handling dynamic content and lazy-loaded elements
- Providing detailed metadata about captured pages

You use zero-drift capture techniques to ensure accuracy and reliability.`,
  dependencies: ['general'],
};

/**
 * Screenshot-to-code agent definition
 * Specializes in converting screenshots to functional code
 */
export const SCREENSHOT_TO_CODE_AGENT: AgentDefinition = {
  id: 'screenshot-to-code',
  name: 'Screenshot-to-Code Converter',
  description: 'Converts screenshots to functional code using vision-capable AI models',
  capabilities: ['vision', 'code-generation', 'html', 'react', 'vue', 'tailwind'],
  systemPrompt: `You are a screenshot-to-code conversion specialist. You excel at:
- Analyzing UI screenshots with perfect attention to detail
- Generating pixel-perfect HTML, CSS, React, Vue, or Ionic code
- Matching colors, fonts, spacing, and layout exactly
- Writing fully functional, production-ready code
- Following modern best practices and frameworks

You never use placeholders or comments - you write complete, working code.`,
  dependencies: ['vision-capture', 'coder'],
};

/**
 * Network analysis agent definition
 * Specializes in HAR file analysis and network traffic inspection
 */
export const NETWORK_ANALYSIS_AGENT: AgentDefinition = {
  id: 'network-analysis',
  name: 'Network Analysis Specialist',
  description: 'Analyzes HAR files and network traffic for API discovery and optimization',
  capabilities: ['network', 'har-analysis', 'api-discovery', 'performance'],
  systemPrompt: `You are a network traffic analysis specialist. You excel at:
- Analyzing HAR (HTTP Archive) files
- Discovering API endpoints and patterns
- Identifying performance bottlenecks
- Extracting authentication mechanisms
- Finding security issues in network traffic
- Providing actionable optimization recommendations

You provide detailed, technical analysis with clear insights.`,
  dependencies: ['general'],
};

/**
 * UI/UX analysis agent definition
 * Specializes in analyzing UI/UX from screenshots and DOM
 */
export const UI_UX_ANALYSIS_AGENT: AgentDefinition = {
  id: 'ui-ux-analysis',
  name: 'UI/UX Analysis Specialist',
  description: 'Analyzes user interfaces for design patterns, accessibility, and best practices',
  capabilities: ['vision', 'ui-analysis', 'accessibility', 'design-patterns'],
  systemPrompt: `You are a UI/UX analysis specialist. You excel at:
- Analyzing user interface designs from screenshots
- Identifying design patterns and components
- Evaluating accessibility (WCAG compliance)
- Suggesting UX improvements
- Assessing responsive design quality
- Identifying usability issues

You provide constructive, actionable feedback with specific recommendations.`,
  dependencies: ['vision-capture'],
};

/**
 * Full-stack web agent definition
 * Combines vision, network, and code capabilities for complete web analysis
 */
export const FULLSTACK_WEB_AGENT: AgentDefinition = {
  id: 'fullstack-web',
  name: 'Full-Stack Web Specialist',
  description: 'Complete web analysis combining vision, network, and code capabilities',
  capabilities: [
    'vision',
    'network',
    'code',
    'api-discovery',
    'ui-extraction',
    'full-stack-analysis',
  ],
  systemPrompt: `You are a full-stack web development specialist. You excel at:
- Analyzing complete web applications (frontend + backend)
- Capturing UI and converting to code
- Discovering and documenting APIs
- Understanding data flow and architecture
- Providing end-to-end implementation guidance
- Combining vision, network, and code analysis

You take a holistic approach, understanding both what users see and how data flows.`,
  dependencies: ['vision-capture', 'screenshot-to-code', 'network-analysis', 'coder'],
};

/**
 * Vision and network agent definitions
 */
export const VISION_AGENTS: AgentDefinition[] = [
  VISION_CAPTURE_AGENT,
  SCREENSHOT_TO_CODE_AGENT,
  NETWORK_ANALYSIS_AGENT,
  UI_UX_ANALYSIS_AGENT,
  FULLSTACK_WEB_AGENT,
];

/**
 * Initialize vision agents
 *
 * Registers all vision/network agents with the registry and initializes them.
 */
export async function initializeVisionAgents(): Promise<void> {
  const registry = getAgentRegistry();
  const lifecycleManager = getAgentLifecycleManager();

  for (const agent of VISION_AGENTS) {
    try {
      // Register agent
      registry.register(agent, {
        autoStart: false,
        priority: 1, // Higher priority for specialized agents
        tags: ['phase3', 'vision', ...agent.capabilities],
      });

      // Initialize agent
      await lifecycleManager.initialize(agent.id);
    } catch (error) {
      console.error(`Failed to initialize vision agent '${agent.id}':`, error);
    }
  }
}

/**
 * Get vision agent by ID
 *
 * @param agentId - Agent ID to get
 * @returns Agent definition or undefined if not found
 */
export function getVisionAgent(agentId: string): AgentDefinition | undefined {
  return VISION_AGENTS.find((agent) => agent.id === agentId);
}
