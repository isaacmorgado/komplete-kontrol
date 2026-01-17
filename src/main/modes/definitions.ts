/**
 * Mode Definitions
 *
 * Defines tool groups and mode configurations for all 6 operational modes.
 * Ported from Roo Code (Apache 2.0 license) with customizations for Komplete-Kontrol.
 *
 * Part of Phase 02: Mode System Integration (Section 1.2)
 */

import type { ModeConfig, OperationalMode, ToolGroup } from './types';

// ============================================================================
// Section 1.2: Tool Groups and Mode Definitions
// ============================================================================

/**
 * Tool groups mapping - defines which tools belong to each group
 */
export const TOOL_GROUPS: Record<ToolGroup, string[]> = {
  read: [
    'read_file',
    'search_files',
    'list_files',
    'codebase_search',
    'Read',
    'Glob',
    'Grep',
    'LS',
  ],
  edit: [
    'apply_diff',
    'write_to_file',
    'edit_file',
    'Write',
    'Edit',
    'MultiEdit',
  ],
  browser: [
    'browser_action',
    'screenshot',
    'navigate',
    'click',
    'type',
    'WebFetch',
    'WebSearch',
  ],
  command: [
    'execute_command',
    'run_tests',
    'Bash',
    'KillShell',
  ],
  mcp: [
    'use_mcp_tool',
    'access_mcp_resource',
    'mcp',
  ],
  modes: [
    'switch_mode',
    'new_task',
    'handoff_to_agent',
    'SwitchMode',
    'NewTask',
  ],
};

/**
 * Tools that are always available regardless of mode
 */
export const ALWAYS_AVAILABLE_TOOLS: string[] = [
  'ask_followup_question',
  'attempt_completion',
  'AskUserQuestion',
  'Task',
  'TodoWrite',
];

/**
 * Get all tools from specified tool groups
 */
export function getToolsFromGroups(groups: ToolGroup[]): string[] {
  const tools = new Set<string>();

  for (const group of groups) {
    const groupTools = TOOL_GROUPS[group] || [];
    for (const tool of groupTools) {
      tools.add(tool);
    }
  }

  // Add always available tools
  for (const tool of ALWAYS_AVAILABLE_TOOLS) {
    tools.add(tool);
  }

  return Array.from(tools);
}

// ============================================================================
// Section 1.3-1.8: Mode Configurations
// ============================================================================

/**
 * Architect Mode Configuration
 * Focus: High-level system design and planning
 */
const architectMode: ModeConfig = {
  slug: 'architect',
  displayName: 'Architect',
  roleDefinition: `You are an expert software architect focused on high-level system design and planning.

Your primary responsibilities:
- Analyze requirements and design system architecture
- Create detailed technical specifications
- Document design decisions and trade-offs
- Review and critique proposed solutions
- Plan implementation strategies

You do NOT write code directly. Instead, you:
- Create architecture diagrams and documentation
- Define interfaces and contracts between components
- Identify potential risks and mitigation strategies
- Recommend design patterns and best practices`,
  toolGroups: ['read', 'mcp', 'modes'],
  disabledTools: ['write_to_file', 'apply_diff', 'execute_command', 'Write', 'Edit', 'Bash'],
  preferredModel: 'anthropic/claude-sonnet',
  toolCallingMethod: 'native',
  temperature: 0.3,
  maxTokens: 8192,
  canHandoffTo: ['code', 'test'],
  icon: 'building',
  shortDescription: 'High-level design and planning',
};

/**
 * Code Mode Configuration
 * Focus: Code generation and modification
 */
const codeMode: ModeConfig = {
  slug: 'code',
  displayName: 'Code',
  roleDefinition: `You are an expert software engineer focused on code implementation.

Your primary responsibilities:
- Write clean, maintainable, and efficient code
- Implement features according to specifications
- Refactor existing code for improved quality
- Follow established coding standards and patterns
- Document code with appropriate comments

When writing code:
- Prioritize readability and maintainability
- Handle errors appropriately
- Consider edge cases
- Write code that is testable`,
  toolGroups: ['read', 'edit', 'command', 'mcp', 'modes'],
  preferredModel: 'anthropic/claude-sonnet',
  toolCallingMethod: 'native',
  temperature: 0.2,
  maxTokens: 4096,
  canHandoffTo: ['debug', 'test', 'architect'],
  icon: 'code',
  shortDescription: 'Code generation and modification',
};

/**
 * Debug Mode Configuration
 * Focus: Debugging and troubleshooting
 */
const debugMode: ModeConfig = {
  slug: 'debug',
  displayName: 'Debug',
  roleDefinition: `You are an expert debugger focused on identifying and fixing issues.

Your primary responsibilities:
- Systematically investigate reported issues
- Form and test hypotheses about root causes
- Make minimal, targeted fixes
- Prevent regressions through careful analysis
- Document findings and fixes

Debugging methodology:
1. Understand the expected vs actual behavior
2. Reproduce the issue
3. Isolate the problem area
4. Form hypotheses about the cause
5. Test hypotheses systematically
6. Apply minimal fix
7. Verify the fix works
8. Check for regressions`,
  toolGroups: ['read', 'edit', 'command', 'mcp', 'modes'],
  disabledTools: ['write_to_file', 'Write'], // Prefer edit over write for debugging
  preferredModel: 'fl/dolphin-2.9.3-llama-3.1-8b', // Abliterated for unrestricted debugging
  toolCallingMethod: 'emulated',
  temperature: 0.1,
  maxTokens: 4096,
  canHandoffTo: ['code', 'test'],
  icon: 'bug',
  shortDescription: 'Debugging and troubleshooting',
};

/**
 * Test Mode Configuration
 * Focus: Test engineering and quality assurance
 */
const testMode: ModeConfig = {
  slug: 'test',
  displayName: 'Test',
  roleDefinition: `You are an expert test engineer focused on ensuring code quality.

Your primary responsibilities:
- Write comprehensive test cases
- Identify edge cases and boundary conditions
- Ensure proper test coverage
- Maintain test isolation and independence
- Create clear and maintainable test code

Testing principles:
- Tests should be deterministic and repeatable
- Each test should test one thing
- Tests should be independent of each other
- Use appropriate test doubles (mocks, stubs, spies)
- Follow the Arrange-Act-Assert pattern`,
  toolGroups: ['read', 'edit', 'command', 'mcp', 'modes'],
  preferredModel: 'openai/gpt-4o',
  toolCallingMethod: 'native',
  temperature: 0.1,
  maxTokens: 4096,
  canHandoffTo: ['debug', 'code'],
  icon: 'test-tube',
  shortDescription: 'Test engineering and QA',
};

/**
 * Reverse Engineer Mode Configuration
 * Focus: Security analysis and reverse engineering
 */
const reverseEngineerMode: ModeConfig = {
  slug: 'reverse-engineer',
  displayName: 'Reverse Engineer',
  roleDefinition: `You are an expert security analyst and reverse engineer.

IMPORTANT: Only assist with authorized security testing, defensive security research,
CTF challenges, and educational contexts. Always verify authorization before proceeding.

Your primary responsibilities:
- Analyze binaries, protocols, and systems
- Document findings clearly and thoroughly
- Identify security vulnerabilities
- Understand obfuscated or undocumented systems
- Extract useful information from compiled code

Analysis methodology:
1. Verify authorization for the analysis
2. Gather initial information
3. Identify entry points and attack surface
4. Analyze control flow and data flow
5. Document findings with evidence
6. Assess security implications
7. Recommend mitigations if vulnerabilities found`,
  toolGroups: ['read', 'command', 'browser', 'mcp', 'modes'],
  preferredModel: 'fl/WhiteRabbitNeo-2.5-Qwen-2.5-Coder-7B',
  toolCallingMethod: 'emulated',
  temperature: 0.2,
  maxTokens: 8192,
  canHandoffTo: ['code', 'debug'],
  icon: 'shield',
  shortDescription: 'Security analysis and RE',
};

/**
 * Ask Mode Configuration
 * Focus: Q&A and information retrieval
 */
const askMode: ModeConfig = {
  slug: 'ask',
  displayName: 'Ask',
  roleDefinition: `You are a helpful assistant focused on answering questions and providing information.

Your primary responsibilities:
- Answer questions clearly and concisely
- Provide accurate information with context
- Explain complex concepts in understandable terms
- Reference relevant code when answering questions
- Suggest next steps when appropriate

Guidelines:
- Be direct and to the point
- Use examples to illustrate concepts
- Cite specific code locations when referencing code
- Do NOT modify any files - only read and explain`,
  toolGroups: ['read', 'mcp', 'modes'],
  disabledTools: ['write_to_file', 'apply_diff', 'execute_command', 'Write', 'Edit', 'Bash'],
  preferredModel: 'anthropic/claude-sonnet',
  toolCallingMethod: 'native',
  temperature: 0.5,
  maxTokens: 2048,
  canHandoffTo: ['architect', 'code'],
  icon: 'message-question',
  shortDescription: 'Q&A and information retrieval',
};

/**
 * All mode definitions record
 */
export const MODE_DEFINITIONS: Record<OperationalMode, ModeConfig> = {
  'architect': architectMode,
  'code': codeMode,
  'debug': debugMode,
  'test': testMode,
  'reverse-engineer': reverseEngineerMode,
  'ask': askMode,
};

/**
 * Get mode configuration by slug
 */
export function getModeDefinition(slug: OperationalMode): ModeConfig {
  return MODE_DEFINITIONS[slug];
}

/**
 * Get all mode definitions as array
 */
export function getAllModeDefinitions(): ModeConfig[] {
  return Object.values(MODE_DEFINITIONS);
}

/**
 * Get default mode
 */
export function getDefaultMode(): OperationalMode {
  return 'code';
}

/**
 * Check if a mode can hand off to another mode
 */
export function canHandoffTo(fromMode: OperationalMode, toMode: OperationalMode): boolean {
  const config = MODE_DEFINITIONS[fromMode];
  return config.canHandoffTo.includes(toMode);
}
