/**
 * Mode Tools Index
 *
 * Central export for all mode-related tools.
 *
 * Part of Phase 02: Mode System Integration (Section 5.3)
 */

export {
  SWITCH_MODE_TOOL_NAME,
  SWITCH_MODE_DESCRIPTION,
  SWITCH_MODE_SCHEMA,
  switchModeTool,
  executeSwitchMode,
} from './switch-mode';

export type { SwitchModeToolInput } from './switch-mode';

export {
  NEW_TASK_TOOL_NAME,
  NEW_TASK_DESCRIPTION,
  NEW_TASK_SCHEMA,
  newTaskTool,
  executeNewTask,
} from './new-task';

export type { NewTaskToolInput } from './new-task';

import { switchModeTool } from './switch-mode';
import { newTaskTool } from './new-task';

/**
 * All mode tools for registration
 */
export const MODE_TOOLS = [
  switchModeTool,
  newTaskTool,
];

/**
 * Register mode tools with a tool manager
 *
 * @param toolManager - Tool manager instance with registerTool method
 */
export function registerModeTools(toolManager: {
  registerTool: (tool: {
    name: string;
    description: string;
    inputSchema: object;
    execute: (input: Record<string, unknown>) => Promise<unknown>;
  }) => void;
}): void {
  for (const tool of MODE_TOOLS) {
    toolManager.registerTool(tool);
  }
}
