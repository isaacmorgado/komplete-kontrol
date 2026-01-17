# Komplete-Kontrol: Comprehensive Fork Implementation Plan

## Executive Summary

This document provides a detailed implementation plan for creating **Komplete-Kontrol** by forking Maestro and integrating features from Roo Code, OpenAI Agents SDK, Browser-Use, and your existing komplete-kontrol-cli codebase.

**Goal**: Create an AI coding assistant with:
- Maestro's excellent UI (history, files, sessions)
- Roo Code's mode system and per-agent model selection
- Universal tool calling for any model (including Featherless abliterated models)
- OpenAI Agents SDK handoff mechanism for agent-to-agent delegation
- Browser automation via Agent-Browser and Browser-Use
- Your /auto features (context-aware checkpointing, git integration)

---

## Part 1: Repository Analysis

### 1.1 Maestro (Base Fork)

**Repository**: https://github.com/pedramamini/Maestro
**License**: AGPL-3.0
**Tech Stack**: Electron 28.1.0, React 18.2.0, TypeScript 5.3.3, Vite

#### Key Files to Modify

| File | Purpose | Modifications Needed |
|------|---------|---------------------|
| `src/main/agent-detector.ts` | Agent definitions (820 lines) | Add mode system, model profiles |
| `src/main/agent-capabilities.ts` | Agent feature flags (332 lines) | Add tool calling capability flags |
| `src/main/process-manager.ts` | Process spawning (1000+ lines) | Add tool emulation, mode args |
| `src/main/parsers/` | Output parsing | Add tool call parser for emulated models |
| `src/main/index.ts` | Main process entry | Add IPC handlers for modes, tools |
| `src/renderer/hooks/useSettings.ts` | Settings state | Add mode and model profile settings |

#### Key Interfaces

```typescript
// From agent-detector.ts
interface AgentConfig {
  id: string;
  name: string;
  binaryName: string;
  command: string;
  args: string[];
  requiresPty?: boolean;
  configOptions?: AgentConfigOption[];
  capabilities: AgentCapabilities;

  // Argument builders
  batchModePrefix?: string[];
  resumeArgs?: (sessionId: string) => string[];
  modelArgs?: (modelId: string) => string[];
  workingDirArgs?: (dir: string) => string[];
  imageArgs?: (imagePath: string) => string[];
  promptArgs?: (prompt: string) => string[];
}
```

---

### 1.2 Roo Code (Mode System Source)

**Repository**: https://github.com/RooVetGit/Roo-Code
**License**: Apache 2.0 (can use freely)
**Tech Stack**: TypeScript, VS Code Extension

#### Key Files to Port

| File | Purpose | What to Extract |
|------|---------|-----------------|
| `src/shared/modes.ts` | Mode definitions | ModeConfig interface, getModeBySlug() |
| `src/shared/tools.ts` | Tool groups | TOOL_GROUPS, ALWAYS_AVAILABLE_TOOLS |
| `src/core/config/` | Configuration | Mode-specific settings patterns |
| `src/core/prompts/` | System prompts | Mode-specific prompt templates |

#### Mode System Structure

```typescript
// From modes.ts
interface ModeConfig {
  slug: string;              // 'architect', 'code', 'debug', etc.
  roleDefinition: string;    // System role description
  customInstructions?: string;
  whenToUse?: string;
  description?: string;
  groups?: ToolGroup[];      // ['read', 'edit', 'browser', 'command', 'mcp']
}

// From tools.ts
const TOOL_GROUPS = {
  read: { tools: ["read_file", "search_files", "list_files", "codebase_search"] },
  edit: { tools: ["apply_diff", "write_to_file"], customTools: ["edit_file"] },
  browser: { tools: ["browser_action"] },
  command: { tools: ["execute_command"] },
  mcp: { tools: ["use_mcp_tool", "access_mcp_resource"] },
  modes: { tools: ["switch_mode", "new_task"], alwaysAvailable: true }
};
```

---

### 1.3 OpenAI Agents SDK (Handoff Pattern)

**Repository**: https://github.com/openai/openai-agents-python
**License**: MIT
**Tech Stack**: Python 3.9+

#### Key Files to Reference

| File | Purpose | What to Port |
|------|---------|--------------|
| `src/agents/agent.py` | Agent class | Handoff mechanism, tool registration |
| `src/agents/run.py` | Runner class | Agent loop, tool execution |
| `src/agents/tool.py` | Tool decorator | @function_tool pattern |
| `src/agents/handoff.py` | Handoff handling | Agent delegation logic |

#### Handoff Pattern

```python
# From agent.py - to be ported to TypeScript
class Agent:
    instructions: str | Callable
    model: str
    tools: list[Tool]
    handoffs: list[Agent]  # Sub-agents for delegation

    def as_tool(self) -> Tool:
        """Convert agent to callable tool for other agents"""
        pass

# Runner loop (from run.py)
# 1. Call LLM with agent config
# 2. If tool call → execute tool → continue
# 3. If handoff → switch to target agent → continue
# 4. If final output → terminate
```

---

### 1.4 Browser-Use

**Repository**: https://github.com/browser-use/browser-use
**License**: MIT
**Tech Stack**: Python, Playwright

#### Key Files to Reference

| File | Purpose | What to Port |
|------|---------|--------------|
| `browser_use/agent/service.py` | Agent class | Task loop, tool execution |
| `browser_use/browser/` | Browser control | CDP integration patterns |
| `browser_use/tools/` | Custom tools | @tools.action decorator |

#### Integration Pattern

```python
# From service.py
class Agent:
    async def run(task: str) -> AgentHistoryList:
        while not done:
            context = await self._prepare_context()  # Screenshot + DOM
            action = await self._get_next_action()   # LLM decision
            result = await self._execute_actions()   # Browser control
            await self._post_process()               # Validate
```

---

### 1.5 Agent-Browser (Vercel)

**Repository**: https://github.com/vercel-labs/agent-browser
**License**: MIT
**Tech Stack**: Rust + TypeScript

#### Key Files to Reference

| File | Purpose | What to Port |
|------|---------|--------------|
| `src/actions.ts` | Command execution | Action patterns |
| `src/browser.ts` | Browser control | CDP commands |
| `src/snapshot.ts` | Accessibility tree | DOM extraction with refs |
| `src/protocol.ts` | Communication | Message protocol |

#### Accessibility Tree Pattern

```typescript
// Snapshot command returns refs like @e2, @e3
// Agents use refs for precise element targeting
interface Snapshot {
  url: string;
  title: string;
  elements: Element[];  // With @ref identifiers
}
```

---

### 1.6 Your komplete-kontrol-cli

**Location**: `/Users/imorgado/Projects/komplete-kontrol-cli`
**Tech Stack**: TypeScript, Bun

#### Key Files to Integrate

| File | Purpose | What to Port |
|------|---------|--------------|
| `src/core/providers/router.ts` | Model routing | Provider prefix handling (fl/, oai/, etc.) |
| `src/core/providers/base.ts` | Provider interface | AIProvider, CompletionOptions |
| `src/core/agents/orchestrator.ts` | Agent orchestration | Multi-agent patterns |
| `src/core/context/condensation.ts` | Context compaction | Compression strategies |
| `src/mcp/client.ts` | MCP integration | Tool calling via MCP |

#### Your /auto Features (from ~/.claude/hooks/)

| File | Purpose | What to Port |
|------|---------|--------------|
| `auto-continue.sh` | Auto-checkpoint | Context threshold logic (40%) |
| `memory-manager.sh` | Memory persistence | Checkpoint/restore system |
| `file-change-tracker.sh` | File monitoring | Change count triggers |

---

## Part 2: Architecture Design

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      KOMPLETE-KONTROL                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                 ELECTRON SHELL (Maestro)                    │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │    │
│  │  │ Session Mgr  │  │ History View │  │ File Browser │     │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘     │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │    │
│  │  │ Mode Select  │  │ Model Prefs  │  │ Auto Status  │     │    │
│  │  │  (Roo Code)  │  │  (Roo Code)  │  │ (Your /auto) │     │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘     │    │
│  └────────────────────────────────────────────────────────────┘    │
│                              │                                      │
│                              ▼ IPC                                  │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                    MAIN PROCESS                             │    │
│  │                                                             │    │
│  │  ┌─────────────────────────────────────────────────────┐   │    │
│  │  │              UNIFIED ORCHESTRATOR                    │   │    │
│  │  │                                                      │   │    │
│  │  │  ┌────────────┐ ┌────────────┐ ┌────────────┐      │   │    │
│  │  │  │ Mode Mgr   │ │ Agent Mgr  │ │ Tool Router│      │   │    │
│  │  │  │(Roo Code)  │ │ (Maestro)  │ │(komplete)  │      │   │    │
│  │  │  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘      │   │    │
│  │  │        │              │              │              │   │    │
│  │  │        ▼              ▼              ▼              │   │    │
│  │  │  ┌─────────────────────────────────────────────┐   │   │    │
│  │  │  │           SPECIALIST AGENTS                  │   │   │    │
│  │  │  │                                              │   │   │    │
│  │  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐       │   │   │    │
│  │  │  │  │Architect│ │  Coder  │ │Debugger │       │   │   │    │
│  │  │  │  │(Claude) │ │(Claude) │ │(Dolphin)│       │   │   │    │
│  │  │  │  └─────────┘ └─────────┘ └─────────┘       │   │   │    │
│  │  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐       │   │   │    │
│  │  │  │  │ Tester  │ │   RE    │ │ Browser │       │   │   │    │
│  │  │  │  │(GPT-4o) │ │(WRNeo)  │ │  Agent  │       │   │   │    │
│  │  │  │  └─────────┘ └─────────┘ └─────────┘       │   │   │    │
│  │  │  └─────────────────────────────────────────────┘   │   │    │
│  │  │                        │                            │   │    │
│  │  │                        ▼                            │   │    │
│  │  │  ┌─────────────────────────────────────────────┐   │   │    │
│  │  │  │          UNIVERSAL TOOL CALLER               │   │   │    │
│  │  │  │                                              │   │   │    │
│  │  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐       │   │   │    │
│  │  │  │  │ Native  │ │ LiteLLM │ │XML/JSON │       │   │   │    │
│  │  │  │  │(Claude) │ │ Bridge  │ │Emulator │       │   │   │    │
│  │  │  │  └─────────┘ └─────────┘ └─────────┘       │   │   │    │
│  │  │  └─────────────────────────────────────────────┘   │   │    │
│  │  └─────────────────────────────────────────────────────┘   │    │
│  │                              │                              │    │
│  │                              ▼                              │    │
│  │  ┌─────────────────────────────────────────────────────┐   │    │
│  │  │              PYTHON BRIDGE (subprocess)              │   │    │
│  │  │                                                      │   │    │
│  │  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │   │    │
│  │  │  │   LiteLLM   │ │ OpenAI SDK  │ │ Browser-Use │   │   │    │
│  │  │  │ (100+ LLMs) │ │ (Handoffs)  │ │  (Stealth)  │   │   │    │
│  │  │  └─────────────┘ └─────────────┘ └─────────────┘   │   │    │
│  │  └─────────────────────────────────────────────────────┘   │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Part 3: Detailed Implementation Plan

### Phase 1: Fork & Setup (Days 1-3)

#### 1.1 Fork Repository

```bash
# Fork Maestro
gh repo fork pedramamini/Maestro --clone --remote
cd Maestro

# Rename to Komplete-Kontrol
git remote rename origin upstream
git remote add origin https://github.com/yourusername/komplete-kontrol.git

# Create development branch
git checkout -b feature/komplete-kontrol-core
```

#### 1.2 Update Package Identity

**Files to modify:**

```json
// package.json
{
  "name": "komplete-kontrol",
  "productName": "Komplete-Kontrol",
  "description": "AI Coding Agent with Universal Tool Calling",
  "version": "1.0.0-alpha.1"
}
```

```typescript
// src/main/constants.ts
export const APP_NAME = 'Komplete-Kontrol';
export const APP_ID = 'com.komplete-kontrol.app';
```

#### 1.3 Directory Structure Additions

```
src/
├── main/
│   ├── modes/                    # NEW: Mode system
│   │   ├── index.ts
│   │   ├── definitions.ts
│   │   ├── controller.ts
│   │   └── prompts/
│   │       ├── architect.ts
│   │       ├── code.ts
│   │       ├── debug.ts
│   │       ├── test.ts
│   │       └── reverse-engineer.ts
│   │
│   ├── tools/                    # NEW: Universal tool calling
│   │   ├── index.ts
│   │   ├── router.ts
│   │   ├── native-caller.ts
│   │   ├── emulator.ts
│   │   ├── litellm-bridge.ts
│   │   └── definitions/
│   │       ├── file-tools.ts
│   │       ├── shell-tools.ts
│   │       ├── browser-tools.ts
│   │       └── mcp-tools.ts
│   │
│   ├── auto/                     # NEW: Auto mode features
│   │   ├── index.ts
│   │   ├── controller.ts
│   │   ├── checkpoint.ts
│   │   ├── context-monitor.ts
│   │   └── git-integration.ts
│   │
│   ├── bridges/                  # NEW: Language bridges
│   │   ├── python/
│   │   │   ├── index.ts
│   │   │   ├── litellm.py
│   │   │   ├── openai-agents.py
│   │   │   └── browser-use.py
│   │   └── rust/
│   │       └── agent-browser.ts
│   │
│   └── handoffs/                 # NEW: Agent handoff system
│       ├── index.ts
│       ├── router.ts
│       └── delegation.ts
│
├── renderer/
│   ├── components/
│   │   ├── ModeSelector/         # NEW
│   │   ├── ModelProfileEditor/   # NEW
│   │   ├── AutoModeStatus/       # NEW
│   │   └── ToolCallViewer/       # NEW
│   │
│   └── hooks/
│       ├── useModes.ts           # NEW
│       ├── useModelProfiles.ts   # NEW
│       └── useAutoMode.ts        # NEW
```

---

### Phase 2: Mode System (Days 4-10)

#### 2.1 Create Mode Definitions

**File: `src/main/modes/definitions.ts`**

```typescript
/**
 * Mode System - Ported from Roo Code (Apache 2.0)
 * Enhanced with model preferences and tool calling configuration
 */

export type OperationalMode =
  | 'architect'
  | 'code'
  | 'debug'
  | 'test'
  | 'reverse-engineer'
  | 'ask';

export type ToolGroup = 'read' | 'edit' | 'browser' | 'command' | 'mcp' | 'modes';

export interface ModeConfig {
  slug: OperationalMode;
  name: string;
  description: string;
  roleDefinition: string;
  customInstructions?: string;

  // Tool configuration
  toolGroups: ToolGroup[];
  disabledTools?: string[];

  // Model preferences
  preferredModel: string;
  fallbackModels: string[];
  toolCallingMethod: 'native' | 'emulated' | 'litellm';

  // LLM settings
  temperature: number;
  maxTokens: number;

  // Handoff configuration
  canHandoffTo: OperationalMode[];
}

export const TOOL_GROUPS: Record<ToolGroup, { tools: string[]; customTools?: string[] }> = {
  read: {
    tools: ['read_file', 'search_files', 'list_files', 'codebase_search', 'fetch_instructions']
  },
  edit: {
    tools: ['apply_diff', 'write_to_file', 'generate_image'],
    customTools: ['search_and_replace', 'edit_file', 'apply_patch']
  },
  browser: {
    tools: ['browser_action', 'screenshot', 'navigate', 'click', 'type']
  },
  command: {
    tools: ['execute_command', 'run_tests', 'build_project']
  },
  mcp: {
    tools: ['use_mcp_tool', 'access_mcp_resource']
  },
  modes: {
    tools: ['switch_mode', 'new_task', 'handoff_to_agent']
  }
};

export const ALWAYS_AVAILABLE_TOOLS = [
  'ask_followup_question',
  'attempt_completion',
  'switch_mode',
  'update_todo_list'
];

export const MODE_DEFINITIONS: Record<OperationalMode, ModeConfig> = {
  architect: {
    slug: 'architect',
    name: 'Architect',
    description: 'System design and architecture planning',
    roleDefinition: `You are an expert software architect. Your role is to:
- Analyze system requirements and constraints
- Design scalable, maintainable architectures
- Document design decisions and trade-offs
- Create technical specifications
- Review and critique existing designs

You should NOT write implementation code. Focus on high-level design.`,
    toolGroups: ['read', 'mcp', 'modes'],
    disabledTools: ['write_to_file', 'apply_diff', 'execute_command'],
    preferredModel: 'anthropic/claude-sonnet',
    fallbackModels: ['openai/gpt-4o', 'google/gemini-2.0-flash'],
    toolCallingMethod: 'native',
    temperature: 0.3,
    maxTokens: 4096,
    canHandoffTo: ['code', 'test']
  },

  code: {
    slug: 'code',
    name: 'Code',
    description: 'Implementation and development',
    roleDefinition: `You are an expert software engineer. Your role is to:
- Write clean, maintainable, well-documented code
- Follow existing patterns and conventions in the codebase
- Implement features according to specifications
- Refactor code when necessary
- Add appropriate tests for new functionality`,
    toolGroups: ['read', 'edit', 'command', 'mcp', 'modes'],
    preferredModel: 'anthropic/claude-sonnet',
    fallbackModels: ['openai/gpt-4o'],
    toolCallingMethod: 'native',
    temperature: 0.2,
    maxTokens: 8192,
    canHandoffTo: ['debug', 'test', 'architect']
  },

  debug: {
    slug: 'debug',
    name: 'Debug',
    description: 'Debugging and troubleshooting',
    roleDefinition: `You are an expert debugger and troubleshooter. Your role is to:
- Analyze error messages and stack traces
- Form hypotheses about root causes
- Use systematic debugging approaches
- Make minimal, targeted fixes
- Verify fixes don't introduce regressions
- Document the issue and solution`,
    toolGroups: ['read', 'edit', 'command', 'mcp', 'modes'],
    disabledTools: ['write_to_file'],  // Prefer edit over write
    preferredModel: 'fl/dolphin-2.9.3-llama-3.1-8b',  // Abliterated for unrestricted debugging
    fallbackModels: ['fl/qwen2.5-72b-instruct', 'anthropic/claude-sonnet'],
    toolCallingMethod: 'emulated',  // XML tool calling for abliterated models
    temperature: 0.1,
    maxTokens: 4096,
    canHandoffTo: ['code', 'test']
  },

  test: {
    slug: 'test',
    name: 'Test',
    description: 'Test creation and verification',
    roleDefinition: `You are an expert test engineer. Your role is to:
- Write comprehensive unit, integration, and e2e tests
- Ensure edge cases are covered
- Create tests that are maintainable and readable
- Verify test isolation and reproducibility
- Document test scenarios and expected outcomes`,
    toolGroups: ['read', 'edit', 'command', 'mcp', 'modes'],
    preferredModel: 'openai/gpt-4o',
    fallbackModels: ['anthropic/claude-sonnet'],
    toolCallingMethod: 'native',
    temperature: 0.1,
    maxTokens: 4096,
    canHandoffTo: ['debug', 'code']
  },

  'reverse-engineer': {
    slug: 'reverse-engineer',
    name: 'Reverse Engineer',
    description: 'Security analysis and reverse engineering',
    roleDefinition: `You are an expert reverse engineer and security researcher. Your role is to:
- Analyze binaries, protocols, and obfuscated code
- Identify vulnerabilities and security issues
- Document findings with technical detail
- Use tools like disassemblers, decompilers, and debuggers
- Understand and explain complex systems

IMPORTANT: Only perform authorized security testing.`,
    toolGroups: ['read', 'command', 'browser', 'mcp', 'modes'],
    preferredModel: 'fl/WhiteRabbitNeo-2.5-Qwen-2.5-Coder-7B',  // Security-focused
    fallbackModels: ['fl/dolphin-2.9.3-llama-3.1-8b', 'fl/qwen2.5-72b-instruct'],
    toolCallingMethod: 'emulated',
    temperature: 0.2,
    maxTokens: 8192,
    canHandoffTo: ['code', 'debug']
  },

  ask: {
    slug: 'ask',
    name: 'Ask',
    description: 'Questions and explanations',
    roleDefinition: `You are a helpful assistant that answers questions clearly and accurately.
- Explain code, concepts, and systems
- Provide examples when helpful
- Be concise but thorough
- Do NOT modify any files`,
    toolGroups: ['read', 'mcp', 'modes'],
    disabledTools: ['write_to_file', 'apply_diff', 'execute_command'],
    preferredModel: 'anthropic/claude-sonnet',
    fallbackModels: ['openai/gpt-4o', 'google/gemini-2.0-flash'],
    toolCallingMethod: 'native',
    temperature: 0.5,
    maxTokens: 2048,
    canHandoffTo: ['architect', 'code']
  }
};
```

#### 2.2 Create Mode Controller

**File: `src/main/modes/controller.ts`**

```typescript
import { EventEmitter } from 'events';
import {
  OperationalMode,
  ModeConfig,
  MODE_DEFINITIONS,
  TOOL_GROUPS,
  ALWAYS_AVAILABLE_TOOLS
} from './definitions';

export interface ModeState {
  currentMode: OperationalMode;
  modeHistory: OperationalMode[];
  customModes: Map<string, ModeConfig>;
}

export class ModeController extends EventEmitter {
  private state: ModeState;
  private toolManager: ToolManager;

  constructor(toolManager: ToolManager) {
    super();
    this.toolManager = toolManager;
    this.state = {
      currentMode: 'code',
      modeHistory: [],
      customModes: new Map()
    };
  }

  /**
   * Get current mode configuration
   */
  getCurrentMode(): ModeConfig {
    return this.getModeConfig(this.state.currentMode);
  }

  /**
   * Get mode configuration by slug
   */
  getModeConfig(slug: OperationalMode): ModeConfig {
    // Check custom modes first
    const customMode = this.state.customModes.get(slug);
    if (customMode) return customMode;

    // Fall back to built-in modes
    return MODE_DEFINITIONS[slug];
  }

  /**
   * Switch to a new mode
   */
  async switchMode(targetMode: OperationalMode): Promise<void> {
    const currentConfig = this.getCurrentMode();

    // Validate handoff is allowed
    if (!currentConfig.canHandoffTo.includes(targetMode)) {
      throw new Error(
        `Cannot switch from ${currentConfig.slug} to ${targetMode}. ` +
        `Allowed: ${currentConfig.canHandoffTo.join(', ')}`
      );
    }

    // Record history
    this.state.modeHistory.push(this.state.currentMode);

    // Switch mode
    this.state.currentMode = targetMode;

    // Apply tool restrictions
    await this.applyModeRestrictions();

    // Emit event
    this.emit('mode-changed', {
      from: currentConfig.slug,
      to: targetMode,
      config: this.getCurrentMode()
    });
  }

  /**
   * Apply tool restrictions based on current mode
   */
  private async applyModeRestrictions(): Promise<void> {
    const config = this.getCurrentMode();

    // Get all tools for this mode's tool groups
    const allowedTools = new Set<string>();

    for (const group of config.toolGroups) {
      const groupConfig = TOOL_GROUPS[group];
      groupConfig.tools.forEach(t => allowedTools.add(t));
      groupConfig.customTools?.forEach(t => allowedTools.add(t));
    }

    // Add always-available tools
    ALWAYS_AVAILABLE_TOOLS.forEach(t => allowedTools.add(t));

    // Remove disabled tools
    config.disabledTools?.forEach(t => allowedTools.delete(t));

    // Apply to tool manager
    await this.toolManager.setAllowedTools(Array.from(allowedTools));
  }

  /**
   * Get system prompt for current mode
   */
  getSystemPrompt(): string {
    const config = this.getCurrentMode();

    let prompt = config.roleDefinition;

    if (config.customInstructions) {
      prompt += `\n\n${config.customInstructions}`;
    }

    return prompt;
  }

  /**
   * Get preferred model for current mode
   */
  getPreferredModel(): string {
    return this.getCurrentMode().preferredModel;
  }

  /**
   * Get tool calling method for current mode
   */
  getToolCallingMethod(): 'native' | 'emulated' | 'litellm' {
    return this.getCurrentMode().toolCallingMethod;
  }

  /**
   * Register a custom mode
   */
  registerCustomMode(config: ModeConfig): void {
    this.state.customModes.set(config.slug, config);
    this.emit('custom-mode-registered', config);
  }

  /**
   * Get all available modes
   */
  getAllModes(): ModeConfig[] {
    const builtIn = Object.values(MODE_DEFINITIONS);
    const custom = Array.from(this.state.customModes.values());
    return [...builtIn, ...custom];
  }
}
```

#### 2.3 Integrate Mode System into Agent Detector

**File: `src/main/agent-detector.ts` (Modifications)**

```typescript
// Add to imports
import { ModeController, OperationalMode, ModeConfig } from './modes';

// Extend AgentConfig interface
interface AgentConfig {
  // ... existing fields ...

  // NEW: Mode integration
  supportsModes?: boolean;
  defaultMode?: OperationalMode;
  modeArgs?: (mode: OperationalMode) => string[];

  // NEW: Model selection per mode
  modelProfiles?: Record<OperationalMode, {
    model: string;
    toolCallingMethod: 'native' | 'emulated' | 'litellm';
  }>;
}

// Update AGENT_DEFINITIONS
const AGENT_DEFINITIONS: AgentConfig[] = [
  {
    id: 'komplete',
    name: 'Komplete-Kontrol',
    binaryName: 'komplete',
    command: 'komplete',
    args: ['chat'],
    supportsModes: true,
    defaultMode: 'code',
    modelProfiles: {
      architect: { model: 'anthropic/claude-sonnet', toolCallingMethod: 'native' },
      code: { model: 'anthropic/claude-sonnet', toolCallingMethod: 'native' },
      debug: { model: 'fl/dolphin-2.9.3-llama-3.1-8b', toolCallingMethod: 'emulated' },
      test: { model: 'openai/gpt-4o', toolCallingMethod: 'native' },
      'reverse-engineer': { model: 'fl/WhiteRabbitNeo-2.5-Qwen-2.5-Coder-7B', toolCallingMethod: 'emulated' },
      ask: { model: 'anthropic/claude-sonnet', toolCallingMethod: 'native' }
    },
    modeArgs: (mode) => ['--mode', mode],
    capabilities: {
      supportsModes: true,
      supportsModelSelection: true,
      supportsToolCalling: true,
      supportsEmulatedToolCalling: true,
      // ... other capabilities
    }
  },
  // ... other agent definitions
];
```

---

### Phase 3: Universal Tool Calling (Days 11-18)

#### 3.1 Create Tool Router

**File: `src/main/tools/router.ts`**

```typescript
import { Tool, ToolCall, ToolResult } from '../types';
import { NativeToolCaller } from './native-caller';
import { ToolEmulator } from './emulator';
import { LiteLLMBridge } from './litellm-bridge';

export interface ModelCapabilities {
  nativeToolCalling: boolean;
  preferredEmulationFormat: 'xml' | 'json';
  maxTools: number;
  supportsParallelTools: boolean;
}

export const MODEL_CAPABILITIES: Record<string, ModelCapabilities> = {
  // Native tool calling support
  'anthropic/claude-*': {
    nativeToolCalling: true,
    preferredEmulationFormat: 'xml',
    maxTools: 100,
    supportsParallelTools: true
  },
  'openai/gpt-4*': {
    nativeToolCalling: true,
    preferredEmulationFormat: 'json',
    maxTools: 128,
    supportsParallelTools: true
  },
  'google/gemini-*': {
    nativeToolCalling: true,
    preferredEmulationFormat: 'json',
    maxTools: 64,
    supportsParallelTools: true
  },

  // Featherless abliterated models (need emulation)
  'fl/dolphin-*': {
    nativeToolCalling: false,
    preferredEmulationFormat: 'xml',
    maxTools: 10,
    supportsParallelTools: false
  },
  'fl/WhiteRabbitNeo-*': {
    nativeToolCalling: false,
    preferredEmulationFormat: 'xml',
    maxTools: 10,
    supportsParallelTools: false
  },
  'fl/qwen*': {
    nativeToolCalling: false,
    preferredEmulationFormat: 'json',
    maxTools: 15,
    supportsParallelTools: false
  },
  'fl/llama-*': {
    nativeToolCalling: false,
    preferredEmulationFormat: 'json',
    maxTools: 10,
    supportsParallelTools: false
  }
};

export class ToolCallingRouter {
  private nativeCaller: NativeToolCaller;
  private emulator: ToolEmulator;
  private litellmBridge: LiteLLMBridge;

  constructor() {
    this.nativeCaller = new NativeToolCaller();
    this.emulator = new ToolEmulator();
    this.litellmBridge = new LiteLLMBridge();
  }

  /**
   * Get capabilities for a model
   */
  getCapabilities(modelId: string): ModelCapabilities {
    // Pattern match against known models
    for (const [pattern, caps] of Object.entries(MODEL_CAPABILITIES)) {
      const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
      if (regex.test(modelId)) {
        return caps;
      }
    }

    // Default: assume no native support
    return {
      nativeToolCalling: false,
      preferredEmulationFormat: 'xml',
      maxTools: 10,
      supportsParallelTools: false
    };
  }

  /**
   * Route tool call to appropriate handler
   */
  async callTools(
    modelId: string,
    tools: Tool[],
    messages: Message[],
    method?: 'native' | 'emulated' | 'litellm'
  ): Promise<{ response: string; toolCalls: ToolCall[] }> {
    const caps = this.getCapabilities(modelId);

    // Determine method
    const actualMethod = method || (caps.nativeToolCalling ? 'native' : 'emulated');

    switch (actualMethod) {
      case 'native':
        return this.nativeCaller.call(modelId, tools, messages);

      case 'litellm':
        return this.litellmBridge.call(modelId, tools, messages);

      case 'emulated':
      default:
        return this.emulator.call(
          modelId,
          tools,
          messages,
          caps.preferredEmulationFormat
        );
    }
  }

  /**
   * Execute a tool call and return result
   */
  async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    const tool = this.toolRegistry.get(toolCall.name);
    if (!tool) {
      return {
        toolCallId: toolCall.id,
        success: false,
        error: `Unknown tool: ${toolCall.name}`
      };
    }

    try {
      const result = await tool.execute(toolCall.arguments);
      return {
        toolCallId: toolCall.id,
        success: true,
        content: result
      };
    } catch (error) {
      return {
        toolCallId: toolCall.id,
        success: false,
        error: error.message
      };
    }
  }
}
```

#### 3.2 Create Tool Emulator

**File: `src/main/tools/emulator.ts`**

```typescript
import { Tool, ToolCall, Message } from '../types';

export interface EmulatorConfig {
  format: 'xml' | 'json';
  includeExamples: boolean;
  maxToolsPerPrompt: number;
}

export class ToolEmulator {
  private config: EmulatorConfig;

  constructor(config: Partial<EmulatorConfig> = {}) {
    this.config = {
      format: config.format || 'xml',
      includeExamples: config.includeExamples ?? true,
      maxToolsPerPrompt: config.maxToolsPerPrompt || 10
    };
  }

  /**
   * Call model with emulated tool calling
   */
  async call(
    modelId: string,
    tools: Tool[],
    messages: Message[],
    format: 'xml' | 'json'
  ): Promise<{ response: string; toolCalls: ToolCall[] }> {
    // Inject tool definitions into system prompt
    const enhancedMessages = this.injectToolsIntoMessages(messages, tools, format);

    // Call model via LiteLLM (no native tools)
    const response = await this.callModel(modelId, enhancedMessages);

    // Extract tool calls from response
    const toolCalls = this.extractToolCalls(response, format);

    return { response, toolCalls };
  }

  /**
   * Inject tool definitions into system prompt
   */
  private injectToolsIntoMessages(
    messages: Message[],
    tools: Tool[],
    format: 'xml' | 'json'
  ): Message[] {
    const toolsDoc = format === 'xml'
      ? this.formatToolsXML(tools)
      : this.formatToolsJSON(tools);

    // Find or create system message
    const systemIndex = messages.findIndex(m => m.role === 'system');

    if (systemIndex >= 0) {
      const enhanced = [...messages];
      enhanced[systemIndex] = {
        ...enhanced[systemIndex],
        content: enhanced[systemIndex].content + '\n\n' + toolsDoc
      };
      return enhanced;
    }

    // Prepend system message with tools
    return [{ role: 'system', content: toolsDoc }, ...messages];
  }

  /**
   * Format tools as XML documentation
   */
  private formatToolsXML(tools: Tool[]): string {
    const limitedTools = tools.slice(0, this.config.maxToolsPerPrompt);

    let doc = `# Available Tools

You have access to the following tools. To use a tool, respond with a tool_use block:

<tool_use>
  <name>tool_name</name>
  <parameters>
    <param_name>value</param_name>
  </parameters>
</tool_use>

## Tools

`;

    for (const tool of limitedTools) {
      doc += `### ${tool.name}
${tool.description}

Parameters:
`;
      if (tool.inputSchema?.properties) {
        for (const [name, schema] of Object.entries(tool.inputSchema.properties)) {
          const required = tool.inputSchema.required?.includes(name) ? ' (required)' : '';
          doc += `- \`${name}\`${required}: ${(schema as any).description || (schema as any).type}\n`;
        }
      }
      doc += '\n';
    }

    if (this.config.includeExamples) {
      doc += `## Example

To read a file:
<tool_use>
  <name>read_file</name>
  <parameters>
    <path>/path/to/file.ts</path>
  </parameters>
</tool_use>

To execute a command:
<tool_use>
  <name>execute_command</name>
  <parameters>
    <command>npm test</command>
  </parameters>
</tool_use>
`;
    }

    return doc;
  }

  /**
   * Format tools as JSON documentation
   */
  private formatToolsJSON(tools: Tool[]): string {
    const limitedTools = tools.slice(0, this.config.maxToolsPerPrompt);

    let doc = `# Available Tools

You have access to the following tools. To use a tool, respond with a JSON code block:

\`\`\`json
{
  "tool": "tool_name",
  "parameters": {
    "param_name": "value"
  }
}
\`\`\`

## Tools

`;

    for (const tool of limitedTools) {
      doc += `### ${tool.name}
${tool.description}

Parameters:
\`\`\`json
${JSON.stringify(tool.inputSchema?.properties || {}, null, 2)}
\`\`\`

`;
    }

    if (this.config.includeExamples) {
      doc += `## Example

\`\`\`json
{
  "tool": "read_file",
  "parameters": {
    "path": "/path/to/file.ts"
  }
}
\`\`\`
`;
    }

    return doc;
  }

  /**
   * Extract tool calls from model response
   */
  extractToolCalls(response: string, format: 'xml' | 'json'): ToolCall[] {
    return format === 'xml'
      ? this.extractXMLToolCalls(response)
      : this.extractJSONToolCalls(response);
  }

  /**
   * Extract XML tool calls
   */
  private extractXMLToolCalls(response: string): ToolCall[] {
    const toolCalls: ToolCall[] = [];

    // Match <tool_use>...</tool_use> blocks
    const toolUseRegex = /<tool_use>([\s\S]*?)<\/tool_use>/g;
    let match;

    while ((match = toolUseRegex.exec(response)) !== null) {
      const block = match[1];

      // Extract name
      const nameMatch = block.match(/<name>([\s\S]*?)<\/name>/);
      if (!nameMatch) continue;

      const name = nameMatch[1].trim();

      // Extract parameters
      const paramsMatch = block.match(/<parameters>([\s\S]*?)<\/parameters>/);
      const parameters: Record<string, unknown> = {};

      if (paramsMatch) {
        // Parse each parameter
        const paramRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
        let paramMatch;

        while ((paramMatch = paramRegex.exec(paramsMatch[1])) !== null) {
          const [, paramName, paramValue] = paramMatch;
          parameters[paramName] = paramValue.trim();
        }
      }

      toolCalls.push({
        id: `tool_${Date.now()}_${toolCalls.length}`,
        name,
        arguments: parameters
      });
    }

    return toolCalls;
  }

  /**
   * Extract JSON tool calls
   */
  private extractJSONToolCalls(response: string): ToolCall[] {
    const toolCalls: ToolCall[] = [];

    // Match ```json ... ``` blocks
    const jsonRegex = /```(?:json)?\s*\n?({[\s\S]*?})\n?```/g;
    let match;

    while ((match = jsonRegex.exec(response)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);

        if (parsed.tool && parsed.parameters) {
          toolCalls.push({
            id: `tool_${Date.now()}_${toolCalls.length}`,
            name: parsed.tool,
            arguments: parsed.parameters
          });
        }
      } catch {
        // Invalid JSON, skip
      }
    }

    return toolCalls;
  }
}
```

#### 3.3 Create LiteLLM Bridge

**File: `src/main/bridges/python/litellm.py`**

```python
#!/usr/bin/env python3
"""
LiteLLM Bridge for Komplete-Kontrol
Provides unified tool calling across 100+ LLM providers
"""

import sys
import json
import asyncio
from typing import Any, Optional
import litellm
from litellm import completion, acompletion

# Configure LiteLLM
litellm.set_verbose = False

# Featherless.ai configuration
FEATHERLESS_CONFIG = {
    "api_base": "https://api.featherless.ai/v1",
    "custom_llm_provider": "openai"
}

def configure_featherless(api_key: str):
    """Configure Featherless.ai as a custom provider"""
    litellm.api_key = api_key

async def call_model(
    model: str,
    messages: list[dict],
    tools: Optional[list[dict]] = None,
    api_key: Optional[str] = None,
    api_base: Optional[str] = None
) -> dict:
    """
    Call any LLM with optional tool calling support

    Args:
        model: Model identifier (e.g., 'openai/gpt-4', 'fl/dolphin-3')
        messages: Chat messages
        tools: Optional tool definitions
        api_key: Optional API key override
        api_base: Optional API base URL override

    Returns:
        Response dict with content and tool_calls
    """
    # Parse model prefix
    if model.startswith('fl/'):
        # Featherless model
        model_name = model[3:]  # Remove 'fl/' prefix
        api_base = api_base or FEATHERLESS_CONFIG["api_base"]
        model = f"openai/{model_name}"  # LiteLLM uses openai/ for compatible APIs

    # Build request kwargs
    kwargs = {
        "model": model,
        "messages": messages,
    }

    if tools:
        kwargs["tools"] = tools
        kwargs["tool_choice"] = "auto"

    if api_key:
        kwargs["api_key"] = api_key

    if api_base:
        kwargs["api_base"] = api_base

    try:
        response = await acompletion(**kwargs)

        # Extract response
        choice = response.choices[0]
        result = {
            "content": choice.message.content or "",
            "tool_calls": []
        }

        # Extract tool calls if present
        if hasattr(choice.message, 'tool_calls') and choice.message.tool_calls:
            for tc in choice.message.tool_calls:
                result["tool_calls"].append({
                    "id": tc.id,
                    "name": tc.function.name,
                    "arguments": json.loads(tc.function.arguments)
                })

        return result

    except Exception as e:
        return {
            "error": str(e),
            "content": "",
            "tool_calls": []
        }

def main():
    """Main entry point for subprocess communication"""
    # Read request from stdin
    request = json.loads(sys.stdin.read())

    # Process request
    result = asyncio.run(call_model(
        model=request["model"],
        messages=request["messages"],
        tools=request.get("tools"),
        api_key=request.get("api_key"),
        api_base=request.get("api_base")
    ))

    # Write response to stdout
    print(json.dumps(result))

if __name__ == "__main__":
    main()
```

**File: `src/main/tools/litellm-bridge.ts`**

```typescript
import { spawn } from 'child_process';
import { Tool, ToolCall, Message } from '../types';
import path from 'path';

export class LiteLLMBridge {
  private pythonPath: string;
  private scriptPath: string;

  constructor() {
    this.pythonPath = process.env.PYTHON_PATH || 'python3';
    this.scriptPath = path.join(__dirname, '../bridges/python/litellm.py');
  }

  /**
   * Call model via LiteLLM Python bridge
   */
  async call(
    modelId: string,
    tools: Tool[],
    messages: Message[]
  ): Promise<{ response: string; toolCalls: ToolCall[] }> {
    const request = {
      model: modelId,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      })),
      tools: tools.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema
        }
      })),
      api_key: this.getApiKey(modelId),
      api_base: this.getApiBase(modelId)
    };

    return new Promise((resolve, reject) => {
      const proc = spawn(this.pythonPath, [this.scriptPath]);

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`LiteLLM bridge failed: ${stderr}`));
          return;
        }

        try {
          const result = JSON.parse(stdout);

          if (result.error) {
            reject(new Error(result.error));
            return;
          }

          resolve({
            response: result.content,
            toolCalls: result.tool_calls.map((tc: any) => ({
              id: tc.id,
              name: tc.name,
              arguments: tc.arguments
            }))
          });
        } catch (e) {
          reject(new Error(`Failed to parse LiteLLM response: ${e}`));
        }
      });

      // Send request
      proc.stdin.write(JSON.stringify(request));
      proc.stdin.end();
    });
  }

  /**
   * Get API key for model
   */
  private getApiKey(modelId: string): string | undefined {
    if (modelId.startsWith('fl/')) {
      return process.env.FEATHERLESS_API_KEY;
    }
    if (modelId.startsWith('anthropic/')) {
      return process.env.ANTHROPIC_API_KEY;
    }
    if (modelId.startsWith('openai/')) {
      return process.env.OPENAI_API_KEY;
    }
    return undefined;
  }

  /**
   * Get API base URL for model
   */
  private getApiBase(modelId: string): string | undefined {
    if (modelId.startsWith('fl/')) {
      return 'https://api.featherless.ai/v1';
    }
    return undefined;
  }
}
```

---

### Phase 4: Auto Mode (Days 19-23)

#### 4.1 Port Auto-Continue Features

**File: `src/main/auto/controller.ts`**

```typescript
import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

export interface AutoModeConfig {
  enabled: boolean;
  contextThreshold: number;      // Default: 40%
  fileChangeThreshold: number;   // Default: 10
  autoCheckpoint: boolean;       // Default: true
  autoCompact: boolean;          // Default: true
  maxIterations: number;         // Default: 100
  stopWords: string[];           // ['stop', 'pause', 'quit']
  gitIntegration: boolean;       // Default: true
}

export interface AutoModeState {
  active: boolean;
  iteration: number;
  lastCheckpoint: Date | null;
  fileChanges: number;
  currentContextPercent: number;
  goal: string | null;
}

export class AutoModeController extends EventEmitter {
  private config: AutoModeConfig;
  private state: AutoModeState;
  private contextMonitor: ContextMonitor;
  private checkpointManager: CheckpointManager;

  constructor(config: Partial<AutoModeConfig> = {}) {
    super();

    this.config = {
      enabled: false,
      contextThreshold: 40,
      fileChangeThreshold: 10,
      autoCheckpoint: true,
      autoCompact: true,
      maxIterations: 100,
      stopWords: ['stop', 'pause', 'quit', 'hold', 'wait'],
      gitIntegration: true,
      ...config
    };

    this.state = {
      active: false,
      iteration: 0,
      lastCheckpoint: null,
      fileChanges: 0,
      currentContextPercent: 0,
      goal: null
    };

    this.contextMonitor = new ContextMonitor(this.config.contextThreshold);
    this.checkpointManager = new CheckpointManager();
  }

  /**
   * Start autonomous mode
   */
  async start(goal: string): Promise<void> {
    this.state.active = true;
    this.state.goal = goal;
    this.state.iteration = 0;

    this.emit('auto-started', { goal });

    // Start monitoring
    this.contextMonitor.start();
    this.contextMonitor.on('threshold-reached', () => this.handleContextThreshold());

    console.log(`🤖 Autonomous mode started. Goal: ${goal}`);
  }

  /**
   * Stop autonomous mode
   */
  async stop(): Promise<void> {
    this.state.active = false;
    this.contextMonitor.stop();

    this.emit('auto-stopped', {
      iterations: this.state.iteration,
      goal: this.state.goal
    });

    console.log(`⏹️ Autonomous mode stopped after ${this.state.iteration} iterations`);
  }

  /**
   * Get current status
   */
  getStatus(): AutoModeState & { config: AutoModeConfig } {
    return {
      ...this.state,
      config: this.config
    };
  }

  /**
   * Handle context threshold reached
   */
  private async handleContextThreshold(): Promise<void> {
    console.log(`⚠️ Context threshold reached (${this.state.currentContextPercent}%)`);

    if (this.config.autoCheckpoint) {
      await this.checkpoint();
    }

    if (this.config.autoCompact) {
      await this.compact();
    }
  }

  /**
   * Create checkpoint
   */
  async checkpoint(): Promise<string | null> {
    console.log('💾 Creating checkpoint...');

    try {
      // Update CLAUDE.md
      await this.updateClaudeMd();

      // Git commit if enabled
      if (this.config.gitIntegration) {
        await this.gitCommit();
      }

      this.state.lastCheckpoint = new Date();
      this.emit('checkpoint-created', { timestamp: this.state.lastCheckpoint });

      return this.state.lastCheckpoint.toISOString();
    } catch (error) {
      console.error('❌ Checkpoint failed:', error);
      return null;
    }
  }

  /**
   * Update CLAUDE.md with session progress
   */
  private async updateClaudeMd(): Promise<void> {
    const claudeMdPath = path.join(process.cwd(), 'CLAUDE.md');

    const sessionSummary = `
### Last Session (${new Date().toISOString()})

**Auto-checkpoint at ${this.state.currentContextPercent}% context**
- Iteration: ${this.state.iteration}
- Goal: ${this.state.goal}
- File changes: ${this.state.fileChanges}

`;

    try {
      let content = await fs.readFile(claudeMdPath, 'utf-8');

      // Update or append Last Session section
      if (content.includes('## Last Session')) {
        content = content.replace(
          /## Last Session[\s\S]*?(?=\n## |$)/,
          `## Last Session\n${sessionSummary}`
        );
      } else {
        content += `\n## Last Session\n${sessionSummary}`;
      }

      await fs.writeFile(claudeMdPath, content);
    } catch {
      // Create new CLAUDE.md
      await fs.writeFile(claudeMdPath, `# Project\n\n## Last Session\n${sessionSummary}`);
    }
  }

  /**
   * Git commit with checkpoint message
   */
  private async gitCommit(): Promise<void> {
    const isGitRepo = await this.isGitRepository();
    if (!isGitRepo) return;

    const hasChanges = await this.hasGitChanges();
    if (!hasChanges) return;

    try {
      // Stage changes
      await execAsync('git add CLAUDE.md');

      // Commit
      const commitMsg = `checkpoint: auto-checkpoint at ${this.state.currentContextPercent}% context

Iteration: ${this.state.iteration}
Goal: ${this.state.goal}

Co-Authored-By: Komplete-Kontrol <noreply@komplete-kontrol.ai>`;

      await execAsync(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`);

      // Push if remote exists
      const hasRemote = await this.hasGitRemote();
      if (hasRemote) {
        await execAsync('git push origin HEAD');
        console.log('✅ Changes pushed to remote');
      }
    } catch (error) {
      console.error('⚠️ Git commit failed:', error);
    }
  }

  /**
   * Check if current directory is a git repository
   */
  private async isGitRepository(): Promise<boolean> {
    try {
      await execAsync('git rev-parse --git-dir');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if there are uncommitted changes
   */
  private async hasGitChanges(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('git status --porcelain');
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Check if git remote exists
   */
  private async hasGitRemote(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('git remote');
      return stdout.includes('origin');
    } catch {
      return false;
    }
  }

  /**
   * Compact context
   */
  private async compact(): Promise<void> {
    console.log('📦 Compacting context...');
    this.emit('context-compacting');
    // Compaction is handled by the agent's context manager
  }

  /**
   * Check for stop words in message
   */
  containsStopWord(message: string): boolean {
    const lowerMessage = message.toLowerCase();
    return this.config.stopWords.some(word =>
      new RegExp(`\\b${word}\\b`, 'i').test(lowerMessage)
    );
  }

  /**
   * Increment iteration
   */
  incrementIteration(): void {
    this.state.iteration++;

    if (this.state.iteration >= this.config.maxIterations) {
      console.log(`⚠️ Max iterations (${this.config.maxIterations}) reached`);
      this.stop();
    }
  }

  /**
   * Record file change
   */
  recordFileChange(): void {
    this.state.fileChanges++;

    if (this.state.fileChanges >= this.config.fileChangeThreshold) {
      console.log(`📁 File change threshold (${this.config.fileChangeThreshold}) reached`);
      this.checkpoint();
      this.state.fileChanges = 0;  // Reset counter
    }
  }

  /**
   * Update context percentage
   */
  updateContextPercent(percent: number): void {
    this.state.currentContextPercent = percent;
    this.contextMonitor.update(percent);
  }
}

/**
 * Context usage monitor
 */
class ContextMonitor extends EventEmitter {
  private threshold: number;
  private currentPercent: number = 0;
  private active: boolean = false;

  constructor(threshold: number) {
    super();
    this.threshold = threshold;
  }

  start(): void {
    this.active = true;
  }

  stop(): void {
    this.active = false;
  }

  update(percent: number): void {
    this.currentPercent = percent;

    if (this.active && percent >= this.threshold) {
      this.emit('threshold-reached', { percent, threshold: this.threshold });
    }
  }
}

/**
 * Checkpoint manager
 */
class CheckpointManager {
  private checkpoints: Map<string, { timestamp: Date; description: string }> = new Map();

  async create(description: string): Promise<string> {
    const id = `checkpoint_${Date.now()}`;
    this.checkpoints.set(id, { timestamp: new Date(), description });
    return id;
  }

  async restore(id: string): Promise<boolean> {
    const checkpoint = this.checkpoints.get(id);
    if (!checkpoint) return false;
    // Restoration logic would go here
    return true;
  }

  list(): Array<{ id: string; timestamp: Date; description: string }> {
    return Array.from(this.checkpoints.entries()).map(([id, data]) => ({
      id,
      ...data
    }));
  }
}
```

---

### Phase 5: Browser Integration (Days 24-28)

#### 5.1 Agent-Browser Integration

**File: `src/main/bridges/rust/agent-browser.ts`**

```typescript
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface BrowserSnapshot {
  url: string;
  title: string;
  elements: BrowserElement[];
}

export interface BrowserElement {
  ref: string;        // @e1, @e2, etc.
  role: string;
  name?: string;
  value?: string;
  bounds?: { x: number; y: number; width: number; height: number };
}

export class AgentBrowserClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private session: string | null = null;

  /**
   * Start a new browser session
   */
  async start(options: { headless?: boolean; session?: string } = {}): Promise<string> {
    const args = ['start'];

    if (options.headless) {
      args.push('--headless');
    }

    if (options.session) {
      args.push('--session', options.session);
    }

    const result = await this.execute(args);
    this.session = result.sessionId;
    return this.session;
  }

  /**
   * Navigate to URL
   */
  async navigate(url: string): Promise<void> {
    await this.execute(['navigate', url]);
  }

  /**
   * Get accessibility tree snapshot
   */
  async snapshot(options: {
    interactive?: boolean;
    compact?: boolean;
    depth?: number;
  } = {}): Promise<BrowserSnapshot> {
    const args = ['snapshot'];

    if (options.interactive) args.push('-i');
    if (options.compact) args.push('-c');
    if (options.depth) args.push('-d', options.depth.toString());

    const result = await this.execute(args);
    return this.parseSnapshot(result.output);
  }

  /**
   * Click element by ref
   */
  async click(ref: string): Promise<void> {
    await this.execute(['click', ref]);
  }

  /**
   * Type text
   */
  async type(text: string, ref?: string): Promise<void> {
    const args = ['type', text];
    if (ref) args.push('--target', ref);
    await this.execute(args);
  }

  /**
   * Take screenshot
   */
  async screenshot(path?: string): Promise<Buffer> {
    const args = ['screenshot'];
    if (path) args.push('--output', path);

    const result = await this.execute(args);
    return Buffer.from(result.output, 'base64');
  }

  /**
   * Execute agent-browser command
   */
  private execute(args: string[]): Promise<{ output: string; sessionId?: string }> {
    return new Promise((resolve, reject) => {
      const fullArgs = [...args, '--json'];
      if (this.session) {
        fullArgs.push('--session', this.session);
      }

      const proc = spawn('agent-browser', fullArgs);

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`agent-browser failed: ${stderr}`));
          return;
        }

        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch {
          resolve({ output: stdout });
        }
      });
    });
  }

  /**
   * Parse snapshot output into structured format
   */
  private parseSnapshot(output: string): BrowserSnapshot {
    const lines = output.split('\n');
    const elements: BrowserElement[] = [];

    let url = '';
    let title = '';

    for (const line of lines) {
      // Extract URL
      if (line.startsWith('URL:')) {
        url = line.substring(4).trim();
        continue;
      }

      // Extract title
      if (line.startsWith('Title:')) {
        title = line.substring(6).trim();
        continue;
      }

      // Extract elements with refs (@e1, @e2, etc.)
      const refMatch = line.match(/@(e\d+)\s+(\w+)(?:\s+"([^"]*)")?/);
      if (refMatch) {
        elements.push({
          ref: `@${refMatch[1]}`,
          role: refMatch[2],
          name: refMatch[3]
        });
      }
    }

    return { url, title, elements };
  }

  /**
   * Close browser session
   */
  async close(): Promise<void> {
    if (this.session) {
      await this.execute(['close']);
      this.session = null;
    }
  }
}
```

#### 5.2 Browser-Use Integration

**File: `src/main/bridges/python/browser-use.py`**

```python
#!/usr/bin/env python3
"""
Browser-Use Bridge for Komplete-Kontrol
Provides stealth browser automation with LLM integration
"""

import sys
import json
import asyncio
from typing import Optional
from browser_use import Agent, Browser
from browser_use.tools import Tools

class BrowserUseAgent:
    def __init__(self, headless: bool = True):
        self.browser = Browser(headless=headless)
        self.tools = Tools()
        self.agent = None

    async def create_agent(self, model: str, task: str):
        """Create a browser automation agent"""
        self.agent = Agent(
            task=task,
            llm=self._get_llm(model),
            browser=self.browser,
            tools=self.tools
        )
        return self.agent

    async def run_task(self, task: str, model: str = "gpt-4o") -> dict:
        """Run a browser automation task"""
        agent = await self.create_agent(model, task)

        try:
            result = await agent.run()
            return {
                "success": True,
                "result": str(result),
                "history": [
                    {
                        "action": h.action,
                        "result": h.result
                    }
                    for h in agent.history
                ]
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    async def navigate(self, url: str) -> dict:
        """Navigate to URL"""
        page = await self.browser.get_current_page()
        await page.goto(url)
        return {"success": True, "url": url}

    async def screenshot(self) -> dict:
        """Take screenshot"""
        page = await self.browser.get_current_page()
        screenshot = await page.screenshot()
        import base64
        return {
            "success": True,
            "screenshot": base64.b64encode(screenshot).decode()
        }

    async def get_dom(self) -> dict:
        """Get page DOM"""
        page = await self.browser.get_current_page()
        content = await page.content()
        return {"success": True, "dom": content}

    def _get_llm(self, model: str):
        """Get LLM instance for model"""
        from langchain_openai import ChatOpenAI
        from langchain_anthropic import ChatAnthropic

        if model.startswith("anthropic/"):
            return ChatAnthropic(model=model.replace("anthropic/", ""))
        else:
            return ChatOpenAI(model=model.replace("openai/", ""))

    async def close(self):
        """Close browser"""
        await self.browser.close()

async def main():
    """Main entry point"""
    request = json.loads(sys.stdin.read())

    agent = BrowserUseAgent(headless=request.get("headless", True))

    try:
        action = request.get("action")

        if action == "run_task":
            result = await agent.run_task(
                task=request["task"],
                model=request.get("model", "gpt-4o")
            )
        elif action == "navigate":
            result = await agent.navigate(request["url"])
        elif action == "screenshot":
            result = await agent.screenshot()
        elif action == "get_dom":
            result = await agent.get_dom()
        else:
            result = {"error": f"Unknown action: {action}"}

        print(json.dumps(result))

    finally:
        await agent.close()

if __name__ == "__main__":
    asyncio.run(main())
```

---

### Phase 6: UI Components (Days 29-35)

#### 6.1 Mode Selector Component

**File: `src/renderer/components/ModeSelector/ModeSelector.tsx`**

```tsx
import React, { useState } from 'react';
import { useModes } from '../../hooks/useModes';
import { OperationalMode } from '../../../main/modes/definitions';

interface ModeSelectorProps {
  sessionId: string;
  onModeChange?: (mode: OperationalMode) => void;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  sessionId,
  onModeChange
}) => {
  const { currentMode, availableModes, switchMode, isLoading } = useModes(sessionId);
  const [isOpen, setIsOpen] = useState(false);

  const handleModeSelect = async (mode: OperationalMode) => {
    await switchMode(mode);
    setIsOpen(false);
    onModeChange?.(mode);
  };

  const getModeIcon = (mode: OperationalMode): string => {
    const icons: Record<OperationalMode, string> = {
      architect: '🏗️',
      code: '💻',
      debug: '🔍',
      test: '🧪',
      'reverse-engineer': '🔓',
      ask: '❓'
    };
    return icons[mode] || '🤖';
  };

  const getModeColor = (mode: OperationalMode): string => {
    const colors: Record<OperationalMode, string> = {
      architect: 'bg-purple-600',
      code: 'bg-blue-600',
      debug: 'bg-red-600',
      test: 'bg-green-600',
      'reverse-engineer': 'bg-orange-600',
      ask: 'bg-gray-600'
    };
    return colors[mode] || 'bg-gray-600';
  };

  return (
    <div className="relative">
      {/* Current mode button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg
          ${getModeColor(currentMode)} text-white
          hover:opacity-90 transition-opacity
          ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <span className="text-lg">{getModeIcon(currentMode)}</span>
        <span className="font-medium capitalize">{currentMode}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-gray-800 rounded-lg shadow-xl z-50 overflow-hidden">
          {availableModes.map((mode) => (
            <button
              key={mode.slug}
              onClick={() => handleModeSelect(mode.slug)}
              className={`
                w-full flex items-center gap-3 px-4 py-3 text-left
                hover:bg-gray-700 transition-colors
                ${mode.slug === currentMode ? 'bg-gray-700' : ''}
              `}
            >
              <span className="text-xl">{getModeIcon(mode.slug)}</span>
              <div className="flex-1">
                <div className="font-medium text-white">{mode.name}</div>
                <div className="text-xs text-gray-400">{mode.description}</div>
              </div>
              {mode.slug === currentMode && (
                <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
```

#### 6.2 Model Profile Editor Component

**File: `src/renderer/components/ModelProfileEditor/ModelProfileEditor.tsx`**

```tsx
import React, { useState, useEffect } from 'react';
import { useModelProfiles } from '../../hooks/useModelProfiles';
import { OperationalMode } from '../../../main/modes/definitions';

interface ModelProfile {
  mode: OperationalMode;
  model: string;
  toolCallingMethod: 'native' | 'emulated' | 'litellm';
  temperature: number;
  maxTokens: number;
  apiKey?: string;
  apiBase?: string;
}

interface ModelProfileEditorProps {
  sessionId: string;
  onSave?: (profiles: ModelProfile[]) => void;
}

// Available models organized by provider
const AVAILABLE_MODELS = {
  'Anthropic (Native)': [
    { id: 'anthropic/claude-opus', name: 'Claude Opus 4', toolCalling: 'native' },
    { id: 'anthropic/claude-sonnet', name: 'Claude Sonnet 4', toolCalling: 'native' },
    { id: 'anthropic/claude-haiku', name: 'Claude Haiku', toolCalling: 'native' },
  ],
  'OpenAI (Native)': [
    { id: 'openai/gpt-4o', name: 'GPT-4o', toolCalling: 'native' },
    { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo', toolCalling: 'native' },
    { id: 'openai/o1', name: 'o1', toolCalling: 'native' },
  ],
  'Google (Native)': [
    { id: 'google/gemini-2.0-flash', name: 'Gemini 2.0 Flash', toolCalling: 'native' },
    { id: 'google/gemini-2.0-pro', name: 'Gemini 2.0 Pro', toolCalling: 'native' },
  ],
  'Featherless (Emulated)': [
    { id: 'fl/dolphin-2.9.3-llama-3.1-8b', name: 'Dolphin 3 (Abliterated)', toolCalling: 'emulated' },
    { id: 'fl/qwen2.5-72b-instruct', name: 'Qwen 2.5 72B', toolCalling: 'emulated' },
    { id: 'fl/WhiteRabbitNeo-2.5-Qwen-2.5-Coder-7B', name: 'WhiteRabbitNeo (Security)', toolCalling: 'emulated' },
    { id: 'fl/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', toolCalling: 'emulated' },
  ],
  'Local (LiteLLM)': [
    { id: 'ollama/llama3.1', name: 'Ollama Llama 3.1', toolCalling: 'litellm' },
    { id: 'ollama/codellama', name: 'Ollama CodeLlama', toolCalling: 'litellm' },
  ],
};

const MODE_DESCRIPTIONS: Record<OperationalMode, string> = {
  architect: 'System design - prefers high reasoning models',
  code: 'Implementation - balance of speed and quality',
  debug: 'Troubleshooting - abliterated models for unrestricted analysis',
  test: 'Test creation - precise, structured output',
  'reverse-engineer': 'Security analysis - specialized security models',
  ask: 'Q&A - fast, helpful responses',
};

export const ModelProfileEditor: React.FC<ModelProfileEditorProps> = ({
  sessionId,
  onSave
}) => {
  const { profiles, updateProfile, resetToDefaults, isLoading } = useModelProfiles(sessionId);
  const [editingMode, setEditingMode] = useState<OperationalMode | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [localProfiles, setLocalProfiles] = useState<ModelProfile[]>([]);

  useEffect(() => {
    setLocalProfiles(profiles);
  }, [profiles]);

  const handleModelChange = (mode: OperationalMode, modelId: string) => {
    // Find model info to auto-set tool calling method
    let toolCallingMethod: 'native' | 'emulated' | 'litellm' = 'native';
    for (const [, models] of Object.entries(AVAILABLE_MODELS)) {
      const model = models.find(m => m.id === modelId);
      if (model) {
        toolCallingMethod = model.toolCalling as 'native' | 'emulated' | 'litellm';
        break;
      }
    }

    setLocalProfiles(prev => prev.map(p =>
      p.mode === mode ? { ...p, model: modelId, toolCallingMethod } : p
    ));
  };

  const handleSave = async () => {
    for (const profile of localProfiles) {
      await updateProfile(profile.mode, profile);
    }
    onSave?.(localProfiles);
    setEditingMode(null);
  };

  const getProfileForMode = (mode: OperationalMode): ModelProfile | undefined => {
    return localProfiles.find(p => p.mode === mode);
  };

  const getModelName = (modelId: string): string => {
    for (const [, models] of Object.entries(AVAILABLE_MODELS)) {
      const model = models.find(m => m.id === modelId);
      if (model) return model.name;
    }
    return modelId;
  };

  const getToolCallingBadge = (method: string) => {
    const colors = {
      native: 'bg-green-600',
      emulated: 'bg-yellow-600',
      litellm: 'bg-blue-600',
    };
    return (
      <span className={`px-2 py-0.5 text-xs rounded ${colors[method as keyof typeof colors] || 'bg-gray-600'}`}>
        {method}
      </span>
    );
  };

  return (
    <div className="bg-gray-900 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white">Model Profiles</h2>
          <p className="text-sm text-gray-400">Configure which model to use for each operational mode</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={resetToDefaults}
            disabled={isLoading}
            className="px-3 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
          >
            Reset to Defaults
          </button>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="px-3 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
          >
            {showAdvanced ? 'Hide' : 'Show'} Advanced
          </button>
        </div>
      </div>

      {/* Mode profiles grid */}
      <div className="space-y-4">
        {(['architect', 'code', 'debug', 'test', 'reverse-engineer', 'ask'] as OperationalMode[]).map((mode) => {
          const profile = getProfileForMode(mode);
          const isEditing = editingMode === mode;

          return (
            <div
              key={mode}
              className={`p-4 rounded-lg border ${isEditing ? 'border-blue-500 bg-gray-800' : 'border-gray-700 bg-gray-800/50'}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Mode icon and name */}
                  <div className="w-32">
                    <div className="font-medium text-white capitalize">{mode}</div>
                    <div className="text-xs text-gray-500">{MODE_DESCRIPTIONS[mode]}</div>
                  </div>

                  {/* Current model */}
                  {isEditing ? (
                    <select
                      value={profile?.model || ''}
                      onChange={(e) => handleModelChange(mode, e.target.value)}
                      className="w-64 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                    >
                      {Object.entries(AVAILABLE_MODELS).map(([provider, models]) => (
                        <optgroup key={provider} label={provider}>
                          {models.map((model) => (
                            <option key={model.id} value={model.id}>
                              {model.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-300">{getModelName(profile?.model || '')}</span>
                      {profile && getToolCallingBadge(profile.toolCallingMethod)}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setEditingMode(isEditing ? null : mode)}
                  className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
                >
                  {isEditing ? 'Cancel' : 'Edit'}
                </button>
              </div>

              {/* Advanced settings (expanded) */}
              {isEditing && showAdvanced && (
                <div className="mt-4 pt-4 border-t border-gray-700 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Temperature</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={profile?.temperature || 0.2}
                      onChange={(e) => setLocalProfiles(prev => prev.map(p =>
                        p.mode === mode ? { ...p, temperature: parseFloat(e.target.value) } : p
                      ))}
                      className="w-full"
                    />
                    <span className="text-xs text-gray-500">{profile?.temperature || 0.2}</span>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Max Tokens</label>
                    <input
                      type="number"
                      value={profile?.maxTokens || 4096}
                      onChange={(e) => setLocalProfiles(prev => prev.map(p =>
                        p.mode === mode ? { ...p, maxTokens: parseInt(e.target.value) } : p
                      ))}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">API Key Override</label>
                    <input
                      type="password"
                      placeholder="Use default"
                      value={profile?.apiKey || ''}
                      onChange={(e) => setLocalProfiles(prev => prev.map(p =>
                        p.mode === mode ? { ...p, apiKey: e.target.value } : p
                      ))}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">API Base Override</label>
                    <input
                      type="text"
                      placeholder="Use default"
                      value={profile?.apiBase || ''}
                      onChange={(e) => setLocalProfiles(prev => prev.map(p =>
                        p.mode === mode ? { ...p, apiBase: e.target.value } : p
                      ))}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                    />
                  </div>
                </div>
              )}

              {isEditing && (
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleSave}
                    disabled={isLoading}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
                  >
                    Save Changes
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

**File: `src/renderer/hooks/useModelProfiles.ts`**

```typescript
import { useState, useEffect, useCallback } from 'react';
import { OperationalMode } from '../../main/modes/definitions';

interface ModelProfile {
  mode: OperationalMode;
  model: string;
  toolCallingMethod: 'native' | 'emulated' | 'litellm';
  temperature: number;
  maxTokens: number;
  apiKey?: string;
  apiBase?: string;
}

const DEFAULT_PROFILES: ModelProfile[] = [
  { mode: 'architect', model: 'anthropic/claude-sonnet', toolCallingMethod: 'native', temperature: 0.3, maxTokens: 4096 },
  { mode: 'code', model: 'anthropic/claude-sonnet', toolCallingMethod: 'native', temperature: 0.2, maxTokens: 8192 },
  { mode: 'debug', model: 'fl/dolphin-2.9.3-llama-3.1-8b', toolCallingMethod: 'emulated', temperature: 0.1, maxTokens: 4096 },
  { mode: 'test', model: 'openai/gpt-4o', toolCallingMethod: 'native', temperature: 0.1, maxTokens: 4096 },
  { mode: 'reverse-engineer', model: 'fl/WhiteRabbitNeo-2.5-Qwen-2.5-Coder-7B', toolCallingMethod: 'emulated', temperature: 0.2, maxTokens: 8192 },
  { mode: 'ask', model: 'anthropic/claude-sonnet', toolCallingMethod: 'native', temperature: 0.5, maxTokens: 2048 },
];

export function useModelProfiles(sessionId: string) {
  const [profiles, setProfiles] = useState<ModelProfile[]>(DEFAULT_PROFILES);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Load profiles from IPC
    window.electronAPI?.getModelProfiles(sessionId).then(setProfiles);
  }, [sessionId]);

  const updateProfile = useCallback(async (mode: OperationalMode, profile: Partial<ModelProfile>) => {
    setIsLoading(true);
    try {
      await window.electronAPI?.updateModelProfile(sessionId, mode, profile);
      setProfiles(prev => prev.map(p => p.mode === mode ? { ...p, ...profile } : p));
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  const resetToDefaults = useCallback(async () => {
    setIsLoading(true);
    try {
      await window.electronAPI?.resetModelProfiles(sessionId);
      setProfiles(DEFAULT_PROFILES);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  const getProfileForMode = useCallback((mode: OperationalMode) => {
    return profiles.find(p => p.mode === mode);
  }, [profiles]);

  return {
    profiles,
    updateProfile,
    resetToDefaults,
    getProfileForMode,
    isLoading,
  };
}
```

#### 6.3 Tool Call Viewer Component

**File: `src/renderer/components/ToolCallViewer/ToolCallViewer.tsx`**

```tsx
import React, { useState, useMemo } from 'react';
import { useToolCalls } from '../../hooks/useToolCalls';

interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  status: 'pending' | 'executing' | 'success' | 'error';
  result?: unknown;
  error?: string;
  duration?: number;
  timestamp: Date;
  emulated: boolean;
}

interface ToolCallViewerProps {
  sessionId: string;
  maxHeight?: number;
  showFilters?: boolean;
}

const TOOL_ICONS: Record<string, string> = {
  read_file: '📄',
  write_to_file: '✏️',
  apply_diff: '🔧',
  execute_command: '⚡',
  search_files: '🔍',
  list_files: '📁',
  browser_action: '🌐',
  screenshot: '📸',
  use_mcp_tool: '🔌',
  switch_mode: '🔀',
  handoff_to_agent: '🤝',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-yellow-400',
  executing: 'text-blue-400',
  success: 'text-green-400',
  error: 'text-red-400',
};

const STATUS_ICONS: Record<string, string> = {
  pending: '⏳',
  executing: '🔄',
  success: '✅',
  error: '❌',
};

export const ToolCallViewer: React.FC<ToolCallViewerProps> = ({
  sessionId,
  maxHeight = 400,
  showFilters = true,
}) => {
  const { toolCalls, isLoading, clearHistory } = useToolCalls(sessionId);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'success' | 'error' | 'emulated'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCalls = useMemo(() => {
    return toolCalls.filter(call => {
      // Apply status filter
      if (filter === 'success' && call.status !== 'success') return false;
      if (filter === 'error' && call.status !== 'error') return false;
      if (filter === 'emulated' && !call.emulated) return false;

      // Apply search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          call.name.toLowerCase().includes(searchLower) ||
          JSON.stringify(call.arguments).toLowerCase().includes(searchLower)
        );
      }

      return true;
    });
  }, [toolCalls, filter, searchTerm]);

  const stats = useMemo(() => {
    const total = toolCalls.length;
    const success = toolCalls.filter(c => c.status === 'success').length;
    const errors = toolCalls.filter(c => c.status === 'error').length;
    const emulated = toolCalls.filter(c => c.emulated).length;
    const avgDuration = toolCalls
      .filter(c => c.duration)
      .reduce((sum, c) => sum + (c.duration || 0), 0) / (total || 1);

    return { total, success, errors, emulated, avgDuration };
  }, [toolCalls]);

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatTimestamp = (date: Date): string => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const renderArguments = (args: Record<string, unknown>): React.ReactNode => {
    return (
      <pre className="text-xs bg-gray-900 p-2 rounded overflow-x-auto">
        {JSON.stringify(args, null, 2)}
      </pre>
    );
  };

  const renderResult = (result: unknown): React.ReactNode => {
    if (typeof result === 'string' && result.length > 500) {
      return (
        <div className="text-xs bg-gray-900 p-2 rounded">
          <div className="text-gray-400 mb-1">Result (truncated):</div>
          <pre className="overflow-x-auto">{result.substring(0, 500)}...</pre>
        </div>
      );
    }

    return (
      <pre className="text-xs bg-gray-900 p-2 rounded overflow-x-auto">
        {JSON.stringify(result, null, 2)}
      </pre>
    );
  };

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden">
      {/* Header with stats */}
      <div className="px-4 py-3 bg-gray-900 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-white">Tool Calls</h3>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-400">
              Total: <span className="text-white">{stats.total}</span>
            </span>
            <span className="text-green-400">
              {STATUS_ICONS.success} {stats.success}
            </span>
            <span className="text-red-400">
              {STATUS_ICONS.error} {stats.errors}
            </span>
            {stats.emulated > 0 && (
              <span className="text-yellow-400">
                Emulated: {stats.emulated}
              </span>
            )}
            <span className="text-gray-400">
              Avg: {formatDuration(stats.avgDuration)}
            </span>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mt-3 flex items-center gap-3">
            <input
              type="text"
              placeholder="Search tool calls..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-sm text-white placeholder-gray-500"
            />
            <div className="flex gap-1">
              {(['all', 'success', 'error', 'emulated'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 text-xs rounded capitalize ${
                    filter === f
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <button
              onClick={clearHistory}
              className="px-3 py-1.5 text-xs bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Tool call list */}
      <div
        className="overflow-y-auto"
        style={{ maxHeight: `${maxHeight}px` }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-gray-400">
            Loading...
          </div>
        ) : filteredCalls.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-gray-500">
            No tool calls yet
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {filteredCalls.map((call) => (
              <div
                key={call.id}
                className={`px-4 py-3 hover:bg-gray-700/50 cursor-pointer transition-colors ${
                  expandedId === call.id ? 'bg-gray-700/30' : ''
                }`}
                onClick={() => setExpandedId(expandedId === call.id ? null : call.id)}
              >
                {/* Tool call header */}
                <div className="flex items-center gap-3">
                  {/* Icon */}
                  <span className="text-lg">
                    {TOOL_ICONS[call.name] || '🔧'}
                  </span>

                  {/* Name and status */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{call.name}</span>
                      {call.emulated && (
                        <span className="px-1.5 py-0.5 text-xs bg-yellow-600/30 text-yellow-400 rounded">
                          emulated
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {Object.keys(call.arguments).length > 0
                        ? Object.entries(call.arguments)
                            .map(([k, v]) => `${k}: ${JSON.stringify(v).substring(0, 30)}`)
                            .join(', ')
                        : 'No arguments'}
                    </div>
                  </div>

                  {/* Status and timing */}
                  <div className="flex items-center gap-3 text-sm">
                    {call.duration && (
                      <span className="text-gray-500">{formatDuration(call.duration)}</span>
                    )}
                    <span className={STATUS_COLORS[call.status]}>
                      {STATUS_ICONS[call.status]}
                    </span>
                    <span className="text-gray-500 text-xs">
                      {formatTimestamp(call.timestamp)}
                    </span>
                    <svg
                      className={`w-4 h-4 text-gray-500 transition-transform ${
                        expandedId === call.id ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Expanded details */}
                {expandedId === call.id && (
                  <div className="mt-3 space-y-3">
                    {/* Arguments */}
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Arguments:</div>
                      {renderArguments(call.arguments)}
                    </div>

                    {/* Result or Error */}
                    {call.status === 'success' && call.result && (
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Result:</div>
                        {renderResult(call.result)}
                      </div>
                    )}

                    {call.status === 'error' && call.error && (
                      <div>
                        <div className="text-xs text-red-400 mb-1">Error:</div>
                        <pre className="text-xs bg-red-900/30 text-red-300 p-2 rounded">
                          {call.error}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
```

**File: `src/renderer/hooks/useToolCalls.ts`**

```typescript
import { useState, useEffect, useCallback } from 'react';

interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  status: 'pending' | 'executing' | 'success' | 'error';
  result?: unknown;
  error?: string;
  duration?: number;
  timestamp: Date;
  emulated: boolean;
}

export function useToolCalls(sessionId: string) {
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load initial tool calls
    window.electronAPI?.getToolCalls(sessionId).then((calls) => {
      setToolCalls(calls || []);
      setIsLoading(false);
    });

    // Subscribe to new tool calls
    const unsubscribe = window.electronAPI?.onToolCall(sessionId, (call: ToolCall) => {
      setToolCalls(prev => {
        // Update existing or add new
        const existingIndex = prev.findIndex(c => c.id === call.id);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = call;
          return updated;
        }
        return [call, ...prev];
      });
    });

    return () => {
      unsubscribe?.();
    };
  }, [sessionId]);

  const clearHistory = useCallback(async () => {
    await window.electronAPI?.clearToolCalls(sessionId);
    setToolCalls([]);
  }, [sessionId]);

  const retryCall = useCallback(async (callId: string) => {
    const call = toolCalls.find(c => c.id === callId);
    if (!call) return;

    await window.electronAPI?.retryToolCall(sessionId, call);
  }, [sessionId, toolCalls]);

  return {
    toolCalls,
    isLoading,
    clearHistory,
    retryCall,
  };
}
```

#### 6.4 Auto Mode Status Component

**File: `src/renderer/components/AutoModeStatus/AutoModeStatus.tsx`**

```tsx
import React from 'react';
import { useAutoMode } from '../../hooks/useAutoMode';

interface AutoModeStatusProps {
  sessionId: string;
}

export const AutoModeStatus: React.FC<AutoModeStatusProps> = ({ sessionId }) => {
  const {
    isActive,
    status,
    start,
    stop,
    isLoading
  } = useAutoMode(sessionId);

  if (!isActive) {
    return (
      <button
        onClick={() => start('Continue development')}
        disabled={isLoading}
        className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 transition-colors"
      >
        <span>🤖</span>
        <span>Start Auto Mode</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-green-900/30 border border-green-700 rounded-lg">
      {/* Status indicator */}
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <span className="text-green-400 font-medium">Auto Mode Active</span>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-gray-400">
        <span>Iteration: {status?.iteration || 0}</span>
        <span>Context: {status?.currentContextPercent || 0}%</span>
        <span>Files: {status?.fileChanges || 0}</span>
      </div>

      {/* Context progress bar */}
      <div className="flex-1 max-w-32">
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              (status?.currentContextPercent || 0) > 80
                ? 'bg-red-500'
                : (status?.currentContextPercent || 0) > 40
                  ? 'bg-yellow-500'
                  : 'bg-green-500'
            }`}
            style={{ width: `${status?.currentContextPercent || 0}%` }}
          />
        </div>
      </div>

      {/* Stop button */}
      <button
        onClick={stop}
        disabled={isLoading}
        className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-sm transition-colors"
      >
        Stop
      </button>
    </div>
  );
};
```

---

## Part 4: File Reference Summary

### Files to Create (New)

| File | Lines | Purpose |
|------|-------|---------|
| `src/main/modes/definitions.ts` | ~250 | Mode configurations |
| `src/main/modes/controller.ts` | ~200 | Mode switching logic |
| `src/main/tools/router.ts` | ~150 | Tool calling router |
| `src/main/tools/emulator.ts` | ~300 | XML/JSON tool emulation |
| `src/main/tools/litellm-bridge.ts` | ~150 | LiteLLM TypeScript client |
| `src/main/bridges/python/litellm.py` | ~100 | LiteLLM Python bridge |
| `src/main/bridges/python/browser-use.py` | ~120 | Browser-Use bridge |
| `src/main/bridges/rust/agent-browser.ts` | ~200 | Agent-Browser client |
| `src/main/auto/controller.ts` | ~350 | Auto mode controller |
| `src/main/handoffs/router.ts` | ~150 | Agent handoff logic |
| `src/renderer/components/ModeSelector/` | ~150 | Mode selector UI |
| `src/renderer/components/AutoModeStatus/` | ~100 | Auto mode status UI |
| `src/renderer/components/ModelProfileEditor/` | ~300 | Per-mode model configuration UI |
| `src/renderer/components/ToolCallViewer/` | ~350 | Tool call history viewer with filters |
| `src/renderer/hooks/useModes.ts` | ~80 | Mode management hook |
| `src/renderer/hooks/useAutoMode.ts` | ~80 | Auto mode hook |
| `src/renderer/hooks/useModelProfiles.ts` | ~80 | Model profile management hook |
| `src/renderer/hooks/useToolCalls.ts` | ~70 | Tool call subscription hook |

**Total new code: ~3,180 lines**

### Files to Modify (Existing Maestro)

| File | Changes |
|------|---------|
| `src/main/agent-detector.ts` | Add mode/model profile support |
| `src/main/agent-capabilities.ts` | Add tool calling capability flags |
| `src/main/process-manager.ts` | Integrate tool router, mode args |
| `src/main/index.ts` | Add IPC handlers for modes, auto |
| `src/main/preload.ts` | Expose new APIs |
| `src/renderer/hooks/useSettings.ts` | Add mode/auto settings |
| `package.json` | Add Python dependencies |

---

## Part 5: Timeline Summary

| Phase | Days | Deliverables |
|-------|------|--------------|
| 1. Fork & Setup | 1-3 | Forked repo, directory structure |
| 2. Mode System | 4-10 | Mode definitions, controller, UI |
| 3. Tool Calling | 11-18 | Router, emulator, LiteLLM bridge |
| 4. Auto Mode | 19-23 | Context monitoring, checkpoint, git |
| 5. Browser | 24-28 | Agent-Browser, Browser-Use integration |
| 6. UI & Polish | 29-35 | Components, testing, documentation |

**Total: ~5 weeks**

---

## Part 6: Testing Strategy

### Unit Tests

```
tests/
├── modes/
│   ├── definitions.test.ts
│   └── controller.test.ts
├── tools/
│   ├── router.test.ts
│   ├── emulator.test.ts
│   └── litellm-bridge.test.ts
├── auto/
│   └── controller.test.ts
└── browser/
    ├── agent-browser.test.ts
    └── browser-use.test.ts
```

### Integration Tests

1. Mode switching with tool restriction verification
2. Tool calling with Featherless models (emulated)
3. Auto-checkpoint at context threshold
4. Git commit/push on checkpoint
5. Browser automation with Agent-Browser
6. End-to-end task with handoffs

### Manual Testing Checklist

- [ ] Switch between all 6 modes
- [ ] Verify tool restrictions per mode
- [ ] Test abliterated model tool calling
- [ ] Trigger auto-checkpoint at 40%
- [ ] Verify git commit/push
- [ ] Test browser automation
- [ ] Test agent handoffs

---

## Appendix: Key Repository URLs

- **Maestro**: https://github.com/pedramamini/Maestro
- **Roo Code**: https://github.com/RooVetGit/Roo-Code
- **OpenAI Agents SDK**: https://github.com/openai/openai-agents-python
- **Browser-Use**: https://github.com/browser-use/browser-use
- **Agent-Browser**: https://github.com/vercel-labs/agent-browser
- **LiteLLM**: https://github.com/BerriAI/litellm
- **Your komplete-kontrol-cli**: `/Users/imorgado/Projects/komplete-kontrol-cli`
