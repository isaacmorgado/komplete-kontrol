/**
 * IPC Handlers for Reverse Engineering Module
 * Exposes RE functionality to renderer process
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { getIntentParser, REIntent } from './intent-parser';
import { getToolSelector, ToolSelectionResult } from './tool-selector';
import { getREOrchestrator, REExecutionPlan, REExecutionStatus } from './orchestrator';
import { getREDatabase, RETool, REWorkflow } from './re-database';
import { DatabaseSeeder } from './seed-database';

export function registerREHandlers(): void {
  const parser = getIntentParser();
  const selector = getToolSelector();
  const orchestrator = getREOrchestrator();
  const db = getREDatabase();

  // ============================================================
  // INTENT PARSING
  // ============================================================

  /**
   * Parse natural language RE command
   * @example
   * Input: "reverse engineer myapp.apk"
   * Output: { command: 're', target: { type: 'mobile-app', path: 'myapp.apk' }, ... }
   */
  ipcMain.handle('re:parseCommand', async (_: IpcMainInvokeEvent, input: string): Promise<{
    success: boolean;
    data?: REIntent;
    error?: string;
  }> => {
    try {
      const intent = parser.parseCommand(input);
      const validation = parser.validateIntent(intent);

      if (!validation.valid) {
        return {
          success: false,
          error: validation.errors.join(', ')
        };
      }

      return {
        success: true,
        data: intent
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Get human-readable summary of parsed intent
   */
  ipcMain.handle('re:summarizeIntent', async (_: IpcMainInvokeEvent, intent: REIntent): Promise<string> => {
    return parser.summarizeIntent(intent);
  });

  // ============================================================
  // TOOL SELECTION
  // ============================================================

  /**
   * Select optimal tools for a target type
   */
  ipcMain.handle('re:selectTools', async (_: IpcMainInvokeEvent, intent: REIntent): Promise<{
    success: boolean;
    data?: ToolSelectionResult;
    error?: string;
  }> => {
    try {
      const result = selector.selectTools(intent);
      return {
        success: true,
        data: result
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Get tool recommendations with explanations
   */
  ipcMain.handle('re:getRecommendations', async (_: IpcMainInvokeEvent, intent: REIntent): Promise<{
    tool: RETool;
    reason: string;
    score: number;
  }[]> => {
    return selector.getToolRecommendations(intent);
  });

  /**
   * Check tool availability on system
   */
  ipcMain.handle('re:checkToolAvailability', async (_: IpcMainInvokeEvent, toolIds: string[]): Promise<{
    available: string[];
    missing: string[];
  }> => {
    return selector.checkToolAvailability(toolIds);
  });

  /**
   * Get installation instructions for tools
   */
  ipcMain.handle('re:getInstallInstructions', async (_: IpcMainInvokeEvent, toolIds: string[]): Promise<{
    toolId: string;
    name: string;
    method: string;
    command: string;
  }[]> => {
    return selector.getInstallInstructions(toolIds);
  });

  // ============================================================
  // ORCHESTRATION
  // ============================================================

  /**
   * Create execution plan from command
   */
  ipcMain.handle('re:plan', async (_: IpcMainInvokeEvent, input: string): Promise<{
    success: boolean;
    data?: REExecutionPlan;
    error?: string;
  }> => {
    try {
      const plan = await orchestrator.plan(input);
      return {
        success: true,
        data: plan
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Execute a plan
   */
  ipcMain.handle('re:execute', async (_: IpcMainInvokeEvent, plan: REExecutionPlan): Promise<{
    success: boolean;
    executionId?: string;
    error?: string;
  }> => {
    try {
      const executionId = await orchestrator.execute(plan);
      return {
        success: true,
        executionId
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Get execution status
   */
  ipcMain.handle('re:getStatus', async (_: IpcMainInvokeEvent, executionId: string): Promise<{
    success: boolean;
    data?: REExecutionStatus;
    error?: string;
  }> => {
    try {
      const status = orchestrator.getStatus(executionId);
      if (!status) {
        return {
          success: false,
          error: 'Execution not found'
        };
      }
      return {
        success: true,
        data: status
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Cancel execution
   */
  ipcMain.handle('re:cancel', async (_: IpcMainInvokeEvent, executionId: string): Promise<{
    success: boolean;
    error?: string;
  }> => {
    try {
      await orchestrator.cancel(executionId);
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Get recent executions
   */
  ipcMain.handle('re:getRecentExecutions', async (_: IpcMainInvokeEvent, limit?: number): Promise<any[]> => {
    return orchestrator.getRecentExecutions(limit);
  });

  // ============================================================
  // DATABASE
  // ============================================================

  /**
   * Get tools by category
   */
  ipcMain.handle('re:getToolsByCategory', async (_: IpcMainInvokeEvent, category: string): Promise<RETool[]> => {
    return db.getToolsByCategory(category);
  });

  /**
   * Get tool by ID
   */
  ipcMain.handle('re:getToolById', async (_: IpcMainInvokeEvent, id: string): Promise<RETool | null> => {
    return db.getToolById(id);
  });

  /**
   * Search tools
   */
  ipcMain.handle('re:searchTools', async (_: IpcMainInvokeEvent, query: string): Promise<RETool[]> => {
    return db.searchTools(query);
  });

  /**
   * Get workflows by target type
   */
  ipcMain.handle('re:getWorkflowsByTargetType', async (_: IpcMainInvokeEvent, targetType: string): Promise<REWorkflow[]> => {
    return db.getWorkflowsByTargetType(targetType);
  });

  /**
   * Get workflow by ID
   */
  ipcMain.handle('re:getWorkflowById', async (_: IpcMainInvokeEvent, id: string): Promise<REWorkflow | null> => {
    return db.getWorkflowById(id);
  });

  /**
   * Get database stats
   */
  ipcMain.handle('re:getStats', async (): Promise<{
    tools: number;
    workflows: number;
    executions: number;
  }> => {
    return db.getStats();
  });

  /**
   * Seed database with essential tools and workflows
   */
  ipcMain.handle('re:seedDatabase', async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    try {
      const seeder = new DatabaseSeeder();
      await seeder.seed();
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  });

  // ============================================================
  // EVENTS (Orchestrator events forwarded to renderer)
  // ============================================================

  orchestrator.on('execution:start', (data) => {
    // Forward event to all windows (TODO: send to specific window)
    const windows = require('electron').BrowserWindow.getAllWindows();
    windows.forEach((window: any) => {
      window.webContents.send('re:execution:start', data);
    });
  });

  orchestrator.on('execution:complete', (data) => {
    const windows = require('electron').BrowserWindow.getAllWindows();
    windows.forEach((window: any) => {
      window.webContents.send('re:execution:complete', data);
    });
  });

  orchestrator.on('execution:error', (data) => {
    const windows = require('electron').BrowserWindow.getAllWindows();
    windows.forEach((window: any) => {
      window.webContents.send('re:execution:error', data);
    });
  });

  orchestrator.on('step:start', (data) => {
    const windows = require('electron').BrowserWindow.getAllWindows();
    windows.forEach((window: any) => {
      window.webContents.send('re:step:start', data);
    });
  });

  orchestrator.on('step:complete', (data) => {
    const windows = require('electron').BrowserWindow.getAllWindows();
    windows.forEach((window: any) => {
      window.webContents.send('re:step:complete', data);
    });
  });

  orchestrator.on('step:error', (data) => {
    const windows = require('electron').BrowserWindow.getAllWindows();
    windows.forEach((window: any) => {
      window.webContents.send('re:step:error', data);
    });
  });

  console.log('✅ RE IPC handlers registered');
}
