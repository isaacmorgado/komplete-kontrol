/**
 * Skills IPC Handlers
 */

import { ipcMain } from "electron";
import { getSkillsManager } from "../../skills/SkillsManager";

export function registerSkillsHandlers(): void {
  const skillsManager = getSkillsManager();

  // List all skills for a mode
  ipcMain.handle("skills:list", async (_event, mode?: string) => {
    try {
      return {
        success: true,
        skills: skillsManager.getSkillsForMode(mode),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // Get skill content
  ipcMain.handle("skills:get", async (_event, name: string, mode?: string) => {
    try {
      const skill = await skillsManager.getSkillContent(name, mode);
      if (!skill) {
        return {
          success: false,
          error: "Skill not found",
        };
      }
      return {
        success: true,
        skill,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // Reload skills
  ipcMain.handle("skills:reload", async (_event, projectPath?: string) => {
    try {
      await skillsManager.discoverSkills(projectPath);
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
