/**
 * Switch Mode Tool
 *
 * Tool definition for switching between operational modes.
 *
 * Part of Phase 02: Mode System Integration (Section 5.1)
 */

import { getModeController } from '../controller';
import type { OperationalMode, SwitchModeResult } from '../types';
import { isOperationalMode, ALL_OPERATIONAL_MODES } from '../types';

/**
 * Tool name constant
 */
export const SWITCH_MODE_TOOL_NAME = 'switch_mode';

/**
 * Tool description
 */
export const SWITCH_MODE_DESCRIPTION = `Switch the AI agent to a different operational mode.

Available modes:
- architect: High-level design and planning (read-only)
- code: Code generation and modification
- debug: Debugging and troubleshooting (minimal edits)
- test: Test generation and execution
- reverse-engineer: Security analysis and RE (requires authorization)
- ask: Q&A and information retrieval (read-only)

Note: Not all mode transitions are allowed. Check canHandoffTo for valid targets.`;

/**
 * Tool parameters JSON schema
 */
export const SWITCH_MODE_SCHEMA = {
  type: 'object',
  properties: {
    targetMode: {
      type: 'string',
      enum: ALL_OPERATIONAL_MODES,
      description: 'The operational mode to switch to',
    },
    reason: {
      type: 'string',
      description: 'Optional reason for the mode switch',
    },
  },
  required: ['targetMode'],
  additionalProperties: false,
};

/**
 * Tool interface for switch_mode
 */
export interface SwitchModeToolInput {
  targetMode: string;
  reason?: string;
}

/**
 * Execute the switch_mode tool
 *
 * @param input - Tool input parameters
 * @returns Result of the mode switch
 */
export async function executeSwitchMode(input: Record<string, unknown>): Promise<SwitchModeResult> {
  const { targetMode, reason } = input as unknown as SwitchModeToolInput;

  // Validate target mode
  if (!isOperationalMode(targetMode)) {
    return {
      success: false,
      currentMode: getModeController().getCurrentMode().slug,
      error: `Invalid mode: ${targetMode}. Valid modes are: ${ALL_OPERATIONAL_MODES.join(', ')}`,
    };
  }

  try {
    const controller = getModeController();
    const previousMode = controller.getCurrentMode().slug;

    // Perform the switch
    const transition = await controller.switchMode(targetMode as OperationalMode, 'agent');

    return {
      success: true,
      previousMode,
      currentMode: transition.to,
      config: transition.config,
    };
  } catch (error) {
    return {
      success: false,
      currentMode: getModeController().getCurrentMode().slug,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Switch mode tool definition for registration
 */
export const switchModeTool = {
  name: SWITCH_MODE_TOOL_NAME,
  description: SWITCH_MODE_DESCRIPTION,
  inputSchema: SWITCH_MODE_SCHEMA,
  execute: executeSwitchMode,
};

export default switchModeTool;
