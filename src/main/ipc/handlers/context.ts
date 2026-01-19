/**
 * Context Management IPC Handlers
 */

import { ipcMain } from "electron";
import { ContextManager } from "../../context-management/ContextManager";
import { ContextManagementOptions } from "../../context-management/types";

const contextManagers = new Map<string, ContextManager>();

export function registerContextHandlers(): void {
  // Manage context (condense if needed)
  ipcMain.handle("context:manage", async (_event, workspacePath: string, provider: any, options: ContextManagementOptions) => {
    try {
      let manager = contextManagers.get(workspacePath);

      if (!manager) {
        manager = new ContextManager(workspacePath, provider);
        contextManagers.set(workspacePath, manager);
      }

      const result = await manager.manageContext(options);

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // Retrieve memory
  ipcMain.handle("context:retrieve", async (_event, query: string, workspacePath: string, maxTokens?: number) => {
    try {
      const manager = contextManagers.get(workspacePath);

      if (!manager) {
        return {
          success: false,
          error: "Context manager not initialized for workspace",
        };
      }

      const memories = manager.retrieveRelevantContext(query, workspacePath, maxTokens);

      return {
        success: true,
        memories,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // Get memory stats
  ipcMain.handle("context:stats", async (_event, workspacePath: string) => {
    try {
      const manager = contextManagers.get(workspacePath);

      if (!manager) {
        return {
          success: false,
          error: "Context manager not initialized for workspace",
        };
      }

      const memoryBank = manager.getMemoryBank();
      const stats = {
        totalMemories: 0, // Would need to implement count method
      };

      return {
        success: true,
        stats,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}
