/**
 * Cost Optimization IPC Handlers
 */

import { ipcMain } from "electron";
import { CostRouter } from "../../cost-optimization/CostRouter";

const costRouter = new CostRouter();

export function registerCostHandlers(): void {
  // Select model for task
  ipcMain.handle("cost:select-model", async (_event, task: string) => {
    try {
      const complexity = costRouter.analyzeTask(task);
      const selection = costRouter.selectForTask(task, complexity);

      return {
        success: true,
        selection,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // Get model info
  ipcMain.handle("cost:model-info", async (_event, modelId: string) => {
    try {
      // Would need to implement getModelInfo method in CostRouter
      return {
        success: true,
        model: {
          id: modelId,
          provider: "unknown",
          inputCostPer1k: 0,
          outputCostPer1k: 0,
          maxTokens: 0,
          capabilities: [],
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // List all models
  ipcMain.handle("cost:list-models", async () => {
    try {
      // Would need to implement listModels method in CostRouter
      return {
        success: true,
        models: [],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}
