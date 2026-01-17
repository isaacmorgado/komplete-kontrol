/**
 * Mode Controller
 *
 * Central controller for the operational mode system. Manages mode state,
 * transitions, tool restrictions, and system prompts.
 *
 * Part of Phase 02: Mode System Integration (Section 2)
 */

import { EventEmitter } from 'events';
import type {
  ModeConfig,
  ModeState,
  ModeTransition,
  ModeError,
  OperationalMode,
  ToolCallingMethod,
  IModeController,
  IToolManager,
} from './types';
import { ALL_OPERATIONAL_MODES, isOperationalMode } from './types';
import {
  MODE_DEFINITIONS,
  TOOL_GROUPS,
  ALWAYS_AVAILABLE_TOOLS,
  getToolsFromGroups,
  getDefaultMode,
  canHandoffTo,
} from './definitions';

// ============================================================================
// Section 2.1-2.7: Mode Controller Implementation
// ============================================================================

/**
 * Mode Controller class
 *
 * Manages the operational mode system including:
 * - Mode state tracking
 * - Mode transitions with validation
 * - Tool restriction management
 * - System prompt generation
 * - Model selection per mode
 * - Custom mode registration
 */
export class ModeController extends EventEmitter implements IModeController {
  /**
   * Internal mode state
   */
  private state: ModeState;

  /**
   * Optional tool manager for tool restriction enforcement
   */
  private toolManager?: IToolManager;

  /**
   * Maximum history length to maintain
   */
  private readonly maxHistoryLength = 10;

  /**
   * Create a new ModeController
   *
   * @param toolManager - Optional tool manager for enforcing tool restrictions
   * @param initialMode - Optional initial mode (defaults to 'code')
   */
  constructor(toolManager?: IToolManager, initialMode?: OperationalMode) {
    super();
    this.toolManager = toolManager;

    const startMode = initialMode ?? getDefaultMode();
    const modeConfig = MODE_DEFINITIONS[startMode];
    const allowedTools = this.buildAllowedTools(modeConfig);

    this.state = {
      currentMode: startMode,
      previousMode: undefined,
      modeHistory: [startMode],
      allowedTools,
      lastModeChangeAt: new Date(),
      switchCount: 0,
      customModes: new Map(),
    };

    // Apply initial tool restrictions
    this.applyModeRestrictions();
  }

  // ============================================================================
  // Section 2.2: Mode State Management
  // ============================================================================

  /**
   * Get the current mode configuration
   */
  getCurrentMode(): ModeConfig {
    const config = this.getModeConfig(this.state.currentMode);
    if (!config) {
      // Should never happen, but fallback to code mode
      return MODE_DEFINITIONS['code'];
    }
    return config;
  }

  /**
   * Get mode configuration by slug
   */
  getModeConfig(slug: OperationalMode): ModeConfig | undefined {
    // Check custom modes first
    if (this.state.customModes.has(slug)) {
      return this.state.customModes.get(slug);
    }

    // Check built-in modes
    return MODE_DEFINITIONS[slug];
  }

  /**
   * Set the current mode (private - use switchMode for public API)
   */
  private setCurrentMode(slug: OperationalMode): void {
    this.state.previousMode = this.state.currentMode;
    this.state.currentMode = slug;
    this.state.lastModeChangeAt = new Date();
    this.state.switchCount++;

    // Update history
    this.state.modeHistory.unshift(slug);
    if (this.state.modeHistory.length > this.maxHistoryLength) {
      this.state.modeHistory = this.state.modeHistory.slice(0, this.maxHistoryLength);
    }
  }

  /**
   * Get mode history (most recent first)
   */
  getModeHistory(): OperationalMode[] {
    return [...this.state.modeHistory];
  }

  // ============================================================================
  // Section 2.3: Mode Switching
  // ============================================================================

  /**
   * Switch to a target mode
   *
   * @param targetMode - The mode to switch to
   * @param initiatedBy - Who initiated the switch (user, agent, or system)
   * @throws ModeError if transition is not allowed
   */
  async switchMode(
    targetMode: OperationalMode,
    initiatedBy: 'user' | 'agent' | 'system' = 'user'
  ): Promise<ModeTransition> {
    // Validate target mode exists
    if (!isOperationalMode(targetMode)) {
      const error: ModeError = {
        type: 'INVALID_MODE',
        message: `Invalid mode: ${targetMode}. Valid modes are: ${ALL_OPERATIONAL_MODES.join(', ')}`,
        details: { targetMode },
      };
      this.emit('mode-error', error);
      throw new Error(error.message);
    }

    const targetConfig = this.getModeConfig(targetMode);
    if (!targetConfig) {
      const error: ModeError = {
        type: 'MODE_NOT_FOUND',
        message: `Mode configuration not found for: ${targetMode}`,
        details: { targetMode },
      };
      this.emit('mode-error', error);
      throw new Error(error.message);
    }

    // Validate transition is allowed (unless initiated by system)
    if (initiatedBy !== 'system') {
      const currentMode = this.state.currentMode;
      if (currentMode !== targetMode && !canHandoffTo(currentMode, targetMode)) {
        const error: ModeError = {
          type: 'TRANSITION_NOT_ALLOWED',
          message: `Cannot switch from '${currentMode}' to '${targetMode}'. Allowed targets: ${MODE_DEFINITIONS[currentMode].canHandoffTo.join(', ')}`,
          details: { fromMode: currentMode, toMode: targetMode },
        };
        this.emit('mode-error', error);
        throw new Error(error.message);
      }
    }

    // Record the transition
    const fromMode = this.state.currentMode;
    const transition: ModeTransition = {
      from: fromMode,
      to: targetMode,
      config: targetConfig,
      timestamp: new Date(),
      initiatedBy,
    };

    // Perform the switch
    this.setCurrentMode(targetMode);

    // Apply tool restrictions
    await this.applyModeRestrictions();

    // Emit mode-changed event
    this.emit('mode-changed', transition);

    return transition;
  }

  // ============================================================================
  // Section 2.4: Tool Restrictions
  // ============================================================================

  /**
   * Build the set of allowed tools for a mode
   */
  private buildAllowedTools(config: ModeConfig): Set<string> {
    const allowed = new Set<string>();

    // Add tools from enabled tool groups
    const groupTools = getToolsFromGroups(config.toolGroups);
    for (const tool of groupTools) {
      allowed.add(tool);
    }

    // Add always available tools
    for (const tool of ALWAYS_AVAILABLE_TOOLS) {
      allowed.add(tool);
    }

    // Remove disabled tools
    if (config.disabledTools) {
      for (const tool of config.disabledTools) {
        allowed.delete(tool);
      }
    }

    return allowed;
  }

  /**
   * Apply mode restrictions to the tool manager
   */
  private async applyModeRestrictions(): Promise<void> {
    const config = this.getCurrentMode();
    const allowedTools = this.buildAllowedTools(config);

    // Update internal state
    this.state.allowedTools = allowedTools;

    // Update tool manager if available
    if (this.toolManager) {
      this.toolManager.setAllowedTools(Array.from(allowedTools));
    }

    // Emit tools-updated event
    this.emit('tools-updated', Array.from(allowedTools));
  }

  /**
   * Check if a tool is allowed in the current mode
   */
  isToolAllowed(toolName: string): boolean {
    return this.state.allowedTools.has(toolName);
  }

  /**
   * Get all currently allowed tools
   */
  getAllowedTools(): string[] {
    return Array.from(this.state.allowedTools);
  }

  // ============================================================================
  // Section 2.5: Prompt Generation
  // ============================================================================

  /**
   * Get the system prompt for the current mode
   */
  getSystemPrompt(): string {
    const config = this.getCurrentMode();
    let prompt = config.roleDefinition;

    // Append custom instructions if present
    if (config.customInstructions) {
      prompt += '\n\n' + config.customInstructions;
    }

    return prompt;
  }

  // ============================================================================
  // Section 2.6: Model Selection
  // ============================================================================

  /**
   * Get the preferred model for the current mode
   */
  getPreferredModel(): string {
    const config = this.getCurrentMode();
    return config.preferredModel;
  }

  /**
   * Get fallback models for the current mode
   */
  getFallbackModels(): string[] {
    const config = this.getCurrentMode();
    return config.fallbackModels ?? [];
  }

  /**
   * Get the tool calling method for the current mode
   */
  getToolCallingMethod(): ToolCallingMethod {
    const config = this.getCurrentMode();
    return config.toolCallingMethod;
  }

  // ============================================================================
  // Section 2.7: Custom Modes
  // ============================================================================

  /**
   * Register a custom mode
   *
   * @param config - The mode configuration
   * @throws ModeError if mode already exists
   */
  registerCustomMode(config: ModeConfig): void {
    // Check if mode already exists (built-in or custom)
    if (MODE_DEFINITIONS[config.slug] || this.state.customModes.has(config.slug)) {
      const error: ModeError = {
        type: 'CUSTOM_MODE_EXISTS',
        message: `Mode '${config.slug}' already exists`,
        details: { slug: config.slug },
      };
      this.emit('mode-error', error);
      throw new Error(error.message);
    }

    // Mark as custom
    const customConfig: ModeConfig = {
      ...config,
      isCustom: true,
    };

    // Store the custom mode
    this.state.customModes.set(config.slug, customConfig);

    // Emit event
    this.emit('custom-mode-registered', customConfig);
  }

  /**
   * Get all available modes (built-in + custom)
   */
  getAllModes(): ModeConfig[] {
    const builtIn = Object.values(MODE_DEFINITIONS);
    const custom = Array.from(this.state.customModes.values());
    return [...builtIn, ...custom];
  }

  // ============================================================================
  // Additional Utility Methods
  // ============================================================================

  /**
   * Get the current mode state
   */
  getState(): Readonly<ModeState> {
    return { ...this.state };
  }

  /**
   * Get switch count for the session
   */
  getSwitchCount(): number {
    return this.state.switchCount;
  }

  /**
   * Get time since last mode change
   */
  getTimeSinceLastSwitch(): number {
    return Date.now() - this.state.lastModeChangeAt.getTime();
  }

  /**
   * Reset mode to default
   */
  async resetToDefault(): Promise<ModeTransition> {
    return this.switchMode(getDefaultMode(), 'system');
  }

  /**
   * Update tool manager reference
   */
  setToolManager(toolManager: IToolManager): void {
    this.toolManager = toolManager;
    // Re-apply restrictions with new tool manager
    this.applyModeRestrictions();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Global mode controller instance
 */
let globalModeController: ModeController | null = null;

/**
 * Initialize global mode controller
 */
export function initModeController(
  toolManager?: IToolManager,
  initialMode?: OperationalMode
): ModeController {
  globalModeController = new ModeController(toolManager, initialMode);
  return globalModeController;
}

/**
 * Get global mode controller
 */
export function getModeController(): ModeController {
  if (!globalModeController) {
    globalModeController = new ModeController();
  }
  return globalModeController;
}

/**
 * Check if mode controller is initialized
 */
export function isModeControllerInitialized(): boolean {
  return globalModeController !== null;
}
