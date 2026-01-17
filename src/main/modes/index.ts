/**
 * Mode System Index
 *
 * Central export for the operational mode system.
 *
 * Part of Phase 02: Mode System Integration
 */

// Types
export {
  type OperationalMode,
  type ToolGroup,
  type ToolCallingMethod,
  type ModeConfig,
  type ModeState,
  type ModeTransition,
  type ModeError,
  type ModeErrorType,
  type ModelProfile,
  type IModeController,
  type IToolManager,
  type SwitchModeResult,
  type NewTaskResult,
  ALL_OPERATIONAL_MODES,
  ALL_TOOL_GROUPS,
  isOperationalMode,
  isToolGroup,
} from './types';

// Definitions
export {
  TOOL_GROUPS,
  ALWAYS_AVAILABLE_TOOLS,
  MODE_DEFINITIONS,
  getToolsFromGroups,
  getModeDefinition,
  getAllModeDefinitions,
  getDefaultMode,
  canHandoffTo,
} from './definitions';

// Controller
export {
  ModeController,
  getModeController,
  initModeController,
  isModeControllerInitialized,
} from './controller';

// Prompts
export {
  ARCHITECT_PROMPT,
  CODE_PROMPT,
  DEBUG_PROMPT,
  TEST_PROMPT,
  REVERSE_ENGINEER_PROMPT,
  ASK_PROMPT,
  MODE_PROMPTS,
  getModePrompt,
} from './prompts';

// Tools
export {
  SWITCH_MODE_TOOL_NAME,
  NEW_TASK_TOOL_NAME,
  switchModeTool,
  newTaskTool,
  executeSwitchMode,
  executeNewTask,
  MODE_TOOLS,
  registerModeTools,
} from './tools';

// Events
export {
  MODE_EVENT_CHANNELS,
  type ModeEventChannel,
  type ModeChangedPayload,
  type ModeErrorPayload,
  type ToolsUpdatedPayload,
  type CustomModeRegisteredPayload,
  type ModeEventPayloads,
  createModeChangedPayload,
  createModeErrorPayload,
  createToolsUpdatedPayload,
  createCustomModeRegisteredPayload,
} from './events';
