/**
 * New Task Tool
 *
 * Tool definition for creating new tasks with optional mode switch.
 *
 * Part of Phase 02: Mode System Integration (Section 5.2)
 */

import { randomUUID } from 'crypto';
import { getModeController } from '../controller';
import type { OperationalMode, NewTaskResult } from '../types';
import { isOperationalMode, ALL_OPERATIONAL_MODES } from '../types';

/**
 * Tool name constant
 */
export const NEW_TASK_TOOL_NAME = 'new_task';

/**
 * Tool description
 */
export const NEW_TASK_DESCRIPTION = `Create a new task context, optionally switching to a different mode.

Use this tool when:
- Starting a new distinct task
- Handing off work to a different mode
- Creating a sub-task with specific focus

The task will receive a unique ID for tracking purposes.`;

/**
 * Tool parameters JSON schema
 */
export const NEW_TASK_SCHEMA = {
  type: 'object',
  properties: {
    description: {
      type: 'string',
      description: 'Description of the new task',
    },
    suggestedMode: {
      type: 'string',
      enum: ALL_OPERATIONAL_MODES,
      description: 'Optional mode to switch to for this task',
    },
  },
  required: ['description'],
  additionalProperties: false,
};

/**
 * Tool interface for new_task
 */
export interface NewTaskToolInput {
  description: string;
  suggestedMode?: string;
}

/**
 * Execute the new_task tool
 *
 * @param input - Tool input parameters
 * @returns Result of the task creation
 */
export async function executeNewTask(input: Record<string, unknown>): Promise<NewTaskResult> {
  const { description, suggestedMode } = input as unknown as NewTaskToolInput;

  // Generate a unique task ID
  const taskId = randomUUID();

  try {
    const controller = getModeController();
    let finalMode = controller.getCurrentMode().slug;

    // Switch mode if suggested and valid
    if (suggestedMode) {
      if (!isOperationalMode(suggestedMode)) {
        return {
          success: false,
          taskId,
          mode: finalMode,
          description,
          error: `Invalid suggested mode: ${suggestedMode}. Valid modes are: ${ALL_OPERATIONAL_MODES.join(', ')}`,
        };
      }

      try {
        const transition = await controller.switchMode(suggestedMode as OperationalMode, 'agent');
        finalMode = transition.to;
      } catch (error) {
        // Mode switch failed, but task can still be created in current mode
        return {
          success: true,
          taskId,
          mode: finalMode,
          description,
          error: `Task created but mode switch failed: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    return {
      success: true,
      taskId,
      mode: finalMode,
      description,
    };
  } catch (error) {
    return {
      success: false,
      taskId,
      mode: getModeController().getCurrentMode().slug,
      description,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * New task tool definition for registration
 */
export const newTaskTool = {
  name: NEW_TASK_TOOL_NAME,
  description: NEW_TASK_DESCRIPTION,
  inputSchema: NEW_TASK_SCHEMA,
  execute: executeNewTask,
};

export default newTaskTool;
