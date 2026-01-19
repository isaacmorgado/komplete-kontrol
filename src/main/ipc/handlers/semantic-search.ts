/**
 * Semantic Search IPC Handlers
 */

import { ipcMain } from "electron";
import { getCodeIndexManager } from "../../semantic-search/CodeIndexManager";
import { SearchOptions, CodeIndexConfig } from "../../semantic-search/types";

export function registerSemanticSearchHandlers(): void {
  let currentManager: any = null;

  // Start indexing
  ipcMain.handle("semantic-search:start", async (_event, workspacePath: string, config?: Partial<CodeIndexConfig>) => {
    try {
      currentManager = getCodeIndexManager(workspacePath, config);

      currentManager.on("progress", (_progress: any) => {
        // Send progress to renderer
        _event.sender.send("semantic-search:progress", _progress);
      });

      await currentManager.startIndexing();

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // Search
  ipcMain.handle("semantic-search:search", async (_event, workspacePath: string, query: string, options?: SearchOptions) => {
    try {
      const manager = getCodeIndexManager(workspacePath);
      const results = await manager.search(query, options);

      return {
        success: true,
        results,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // Get status
  ipcMain.handle("semantic-search:status", async (_event, workspacePath: string) => {
    try {
      const manager = getCodeIndexManager(workspacePath);
      const status = manager.getStatus();

      return {
        success: true,
        status,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // Clear index
  ipcMain.handle("semantic-search:clear", async (_event, workspacePath: string) => {
    try {
      const manager = getCodeIndexManager(workspacePath);
      await manager.clearIndex();

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}
