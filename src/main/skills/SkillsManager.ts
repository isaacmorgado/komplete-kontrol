/**
 * Skills Manager
 * Adapted from: kilocode/src/services/skills/SkillsManager.ts
 *
 * Manages discovery, loading, and resolution of skill files.
 * Supports global/project skills and mode-specific overrides.
 */

import fs from "fs/promises";
import path from "path";
import { app } from "electron";
import matter from "gray-matter";
import chokidar from "chokidar";
import {
  SkillMetadata,
  SkillContent,
  SkillChangeEvent,
  SkillsManagerConfig,
  SKILL_NAME_PATTERN,
  SKILL_NAME_MIN_LENGTH,
  SKILL_NAME_MAX_LENGTH,
  SKILL_DESCRIPTION_MIN_LENGTH,
  SKILL_DESCRIPTION_MAX_LENGTH,
} from "./types";
import { ipcMain } from "electron";

export class SkillsManager {
  private skills: Map<string, SkillMetadata> = new Map();
  private config: SkillsManagerConfig;
  private watchers: chokidar.FSWatcher[] = [];
  private changeListeners: Set<(event: SkillChangeEvent) => void> = new Set();
  private isInitialized = false;

  constructor(config?: Partial<SkillsManagerConfig>) {
    this.config = {
      enableGlobalSkills: true,
      enableProjectSkills: true,
      watchForChanges: true,
      ...config,
    };
  }

  /**
   * Initialize the skills manager
   */
  async initialize(projectPath?: string): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    await this.discoverSkills(projectPath);

    if (this.config.watchForChanges) {
      await this.setupFileWatchers(projectPath);
    }

    this.setupIPCHandlers();
    this.isInitialized = true;
  }

  /**
   * Discover all skills from global and project directories
   */
  async discoverSkills(projectPath?: string): Promise<void> {
    this.skills.clear();

    const dirsToScan: Array<{ dir: string; source: "global" | "project"; mode?: string }> = [];

    // Global directories
    if (this.config.enableGlobalSkills) {
      const globalDir = path.join(app.getPath("home"), ".komplete-kontrol", "skills");
      dirsToScan.push({ dir: globalDir, source: "global" });

      // Mode-specific global directories
      for (const mode of this.getSupportedModes()) {
        const modeDir = path.join(app.getPath("home"), ".komplete-kontrol", `skills-${mode}`);
        dirsToScan.push({ dir: modeDir, source: "global", mode });
      }
    }

    // Project directories
    if (this.config.enableProjectSkills && projectPath) {
      const projectDir = path.join(projectPath, ".komplete-kontrol", "skills");
      dirsToScan.push({ dir: projectDir, source: "project" });

      // Mode-specific project directories
      for (const mode of this.getSupportedModes()) {
        const modeDir = path.join(projectPath, ".komplete-kontrol", `skills-${mode}`);
        dirsToScan.push({ dir: modeDir, source: "project", mode });
      }
    }

    // Scan each directory
    for (const { dir, source, mode } of dirsToScan) {
      await this.scanSkillsDirectory(dir, source, mode);
    }
  }

  /**
   * Scan a single directory for skills
   */
  private async scanSkillsDirectory(
    dirPath: string,
    source: "global" | "project",
    mode?: string
  ): Promise<void> {
    try {
      const stat = await fs.stat(dirPath);
      if (!stat.isDirectory()) {
        return;
      }
    } catch {
      // Directory doesn't exist, skip
      return;
    }

    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const skillDir = path.join(dirPath, entry.name);
      await this.loadSkillFromDirectory(skillDir, source, mode);
    }
  }

  /**
   * Load a skill from its directory
   */
  private async loadSkillFromDirectory(
    skillDir: string,
    source: "global" | "project",
    mode?: string
  ): Promise<void> {
    const skillFile = path.join(skillDir, "SKILL.md");

    try {
      await fs.access(skillFile);
    } catch {
      return; // SKILL.md doesn't exist
    }

    const content = await fs.readFile(skillFile, "utf-8");
    const { data: frontmatter, content: body } = matter(content);

    // Validate frontmatter
    if (!this.isValidSkillName(frontmatter.name)) {
      console.warn(`Invalid skill name in ${skillFile}`);
      return;
    }

    if (!this.isValidSkillDescription(frontmatter.description)) {
      console.warn(`Invalid skill description in ${skillFile}`);
      return;
    }

    // Name must match directory name
    const dirName = path.basename(skillDir);
    if (frontmatter.name !== dirName) {
      console.warn(`Skill name "${frontmatter.name}" doesn't match directory "${dirName}"`);
      return;
    }

    const skill: SkillMetadata = {
      name: frontmatter.name,
      description: frontmatter.description.trim(),
      path: skillFile,
      source,
      mode,
      license: frontmatter.license,
      compatibility: frontmatter.compatibility,
    };

    // Apply override logic
    const existingSkill = this.skills.get(skill.name);
    if (existingSkill) {
      if (this.shouldOverrideSkill(existingSkill, skill)) {
        this.skills.set(skill.name, skill);
      }
    } else {
      this.skills.set(skill.name, skill);
    }
  }

  /**
   * Override logic: project > global, mode-specific > generic
   */
  private shouldOverrideSkill(existing: SkillMetadata, newSkill: SkillMetadata): boolean {
    // Project always overrides global
    if (newSkill.source === "project" && existing.source === "global") {
      return true;
    }
    if (newSkill.source === "global" && existing.source === "project") {
      return false;
    }

    // Same source: mode-specific overrides generic
    if (newSkill.mode && !existing.mode) {
      return true;
    }
    if (!newSkill.mode && existing.mode) {
      return false;
    }

    // Same source and mode-specificity: keep existing (first wins)
    return false;
  }

  /**
   * Get skills available for the current mode
   */
  getSkillsForMode(currentMode?: string): SkillMetadata[] {
    const resolvedSkills = new Map<string, SkillMetadata>();

    for (const skill of this.skills.values()) {
      // Skip mode-specific skills that don't match
      if (skill.mode && currentMode && skill.mode !== currentMode) {
        continue;
      }

      const existingSkill = resolvedSkills.get(skill.name);
      if (!existingSkill) {
        resolvedSkills.set(skill.name, skill);
        continue;
      }

      // Apply override rules
      if (this.shouldOverrideSkill(existingSkill, skill)) {
        resolvedSkills.set(skill.name, skill);
      }
    }

    return Array.from(resolvedSkills.values());
  }

  /**
   * Get full skill content including instructions
   */
  async getSkillContent(name: string, mode?: string): Promise<SkillContent | null> {
    const modeSkills = this.getSkillsForMode(mode);
    const skill = modeSkills.find((s) => s.name === name);

    if (!skill) {
      return null;
    }

    const fileContent = await fs.readFile(skill.path, "utf-8");
    const { content: body } = matter(fileContent);

    return {
      ...skill,
      instructions: body.trim(),
    };
  }

  /**
   * Setup file watchers for skill directories
   */
  private async setupFileWatchers(projectPath?: string): Promise<void> {
    const dirsToWatch: string[] = [];

    // Global directories
    if (this.config.enableGlobalSkills) {
      dirsToWatch.push(path.join(app.getPath("home"), ".komplete-kontrol", "skills"));
      for (const mode of this.getSupportedModes()) {
        dirsToWatch.push(path.join(app.getPath("home"), ".komplete-kontrol", `skills-${mode}`));
      }
    }

    // Project directories
    if (this.config.enableProjectSkills && projectPath) {
      dirsToWatch.push(path.join(projectPath, ".komplete-kontrol", "skills"));
      for (const mode of this.getSupportedModes()) {
        dirsToWatch.push(path.join(projectPath, ".komplete-kontrol", `skills-${mode}`));
      }
    }

    for (const dir of dirsToWatch) {
      try {
        await fs.access(dir);
        const watcher = chokidar.watch(dir, {
          ignored: /(^|[\/\\])\../, // ignore dotfiles
          persistent: true,
          ignoreInitial: true,
        });

        watcher
          .on("add", () => this.handleSkillChange())
          .on("change", () => this.handleSkillChange())
          .on("unlink", () => this.handleSkillChange());

        this.watchers.push(watcher);
      } catch {
        // Directory doesn't exist, skip
      }
    }
  }

  /**
   * Handle skill file changes
   */
  private async handleSkillChange(): Promise<void> {
    await this.discoverSkills();
    const event: SkillChangeEvent = {
      type: "modified",
      skill: Array.from(this.skills.values())[0],
    };
    this.notifyListeners(event);
  }

  /**
   * Notify change listeners
   */
  private notifyListeners(event: SkillChangeEvent): void {
    for (const listener of this.changeListeners) {
      listener(event);
    }
  }

  /**
   * Register change listener
   */
  onSkillsChange(callback: (event: SkillChangeEvent) => void): () => void {
    this.changeListeners.add(callback);
    return () => this.changeListeners.delete(callback);
  }

  /**
   * Setup IPC handlers
   */
  private setupIPCHandlers(): void {
    ipcMain.handle("skills:list", async (_event, mode?: string) => {
      return this.getSkillsForMode(mode);
    });

    ipcMain.handle("skills:get", async (_event, name: string, mode?: string) => {
      return this.getSkillContent(name, mode);
    });

    ipcMain.handle("skills:reload", async (_event, projectPath?: string) => {
      return this.discoverSkills(projectPath);
    });
  }

  /**
   * Validate skill name
   */
  private isValidSkillName(name: unknown): name is string {
    return (
      typeof name === "string" &&
      name.length >= SKILL_NAME_MIN_LENGTH &&
      name.length <= SKILL_NAME_MAX_LENGTH &&
      SKILL_NAME_PATTERN.test(name)
    );
  }

  /**
   * Validate skill description
   */
  private isValidSkillDescription(description: unknown): description is string {
    return (
      typeof description === "string" &&
      description.trim().length >= SKILL_DESCRIPTION_MIN_LENGTH &&
      description.trim().length <= SKILL_DESCRIPTION_MAX_LENGTH
    );
  }

  /**
   * Get supported modes
   */
  private getSupportedModes(): string[] {
    return ["architect", "code", "debug", "test", "reverse-engineer", "ask"];
  }

  /**
   * Dispose of resources
   */
  async dispose(): Promise<void> {
    for (const watcher of this.watchers) {
      await watcher.close();
    }
    this.watchers = [];
    this.changeListeners.clear();
    this.isInitialized = false;
  }
}

// Singleton instance
let skillsManagerInstance: SkillsManager | null = null;

export function getSkillsManager(config?: Partial<SkillsManagerConfig>): SkillsManager {
  if (!skillsManagerInstance) {
    skillsManagerInstance = new SkillsManager(config);
  }
  return skillsManagerInstance;
}
