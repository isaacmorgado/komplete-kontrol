/**
 * Unit Tests: Skills Manager
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SkillsManager } from "../../../../main/skills/SkillsManager";
import fs from "fs/promises";
import path from "path";

describe("SkillsManager", () => {
  let manager: SkillsManager;
  let testGlobalDir: string;
  let testProjectDir: string;

  beforeEach(async () => {
    testGlobalDir = `/tmp/test-global-skills-${Date.now()}`;
    testProjectDir = `/tmp/test-project-${Date.now()}`;

    await fs.mkdir(testGlobalDir, { recursive: true });
    await fs.mkdir(testProjectDir, { recursive: true });

    // Create a test skill
    await fs.mkdir(path.join(testGlobalDir, "test-skill"), { recursive: true });
    await fs.writeFile(
      path.join(testGlobalDir, "test-skill", "SKILL.md"),
      `---
name: test-skill
description: A test skill
---
# Test Skill

This is a test skill.`
    );

    manager = new SkillsManager();
  });

  afterEach(async () => {
    // Clean up
    try {
      await fs.rm(testGlobalDir, { recursive: true });
      await fs.rm(testProjectDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it("should discover skills from global directory", async () => {
    await manager.initialize();

    const skills = manager.getSkillsForMode();

    expect(skills.length).toBeGreaterThan(0);
    expect(skills[0].name).toBe("test-skill");
  });

  it("should load skill content", async () => {
    await manager.initialize();

    const skill = await manager.getSkillContent("test-skill");

    expect(skill).toBeDefined();
    expect(skill?.name).toBe("test-skill");
    expect(skill?.instructions).toContain("This is a test skill");
  });

  it("should return null for non-existent skill", async () => {
    await manager.initialize();

    const skill = await manager.getSkillContent("non-existent");

    expect(skill).toBeNull();
  });

  it("should filter skills by mode", async () => {
    // Create mode-specific skill
    await fs.mkdir(path.join(testGlobalDir, "mode-skill"), { recursive: true });
    await fs.writeFile(
      path.join(testGlobalDir, "mode-skill", "SKILL.md"),
      `---
name: mode-skill
description: Mode-specific skill
mode: code
---
# Mode Skill`
    );

    await manager.initialize();

    const allSkills = manager.getSkillsForMode();
    const codeSkills = manager.getSkillsForMode("code");

    expect(codeSkills.length).toBeLessThanOrEqual(allSkills.length);
  });

  it("should handle project skills override", async () => {
    // Create project-level override
    const projectSkillsDir = path.join(testProjectDir, ".komplete-kontrol", "skills");
    await fs.mkdir(path.join(projectSkillsDir, "test-skill"), { recursive: true });
    await fs.writeFile(
      path.join(projectSkillsDir, "test-skill", "SKILL.md"),
      `---
name: test-skill
description: Project override
---
# Project Version`
    );

    await manager.initialize(testProjectDir);

    const skills = manager.getSkillsForMode();
    const skill = skills.find((s) => s.name === "test-skill");

    expect(skill?.source).toBe("project");
    expect(skill?.description).toBe("Project override");
  });

  it("should validate skill name format", async () => {
    // Create invalid skill (uppercase not allowed)
    await fs.mkdir(path.join(testGlobalDir, "InvalidSkill"), { recursive: true });
    await fs.writeFile(
      path.join(testGlobalDir, "InvalidSkill", "SKILL.md"),
      `---
name: InvalidSkill
description: Invalid name
---
# Content`
    );

    await manager.initialize();

    const skills = manager.getSkillsForMode();
    const invalidSkill = skills.find((s) => s.name === "InvalidSkill");

    expect(invalidSkill).toBeUndefined();
  });

  it("should validate skill description length", async () => {
    // Create skill with description too long
    await fs.mkdir(path.join(testGlobalDir, "long-desc"), { recursive: true });
    await fs.writeFile(
      path.join(testGlobalDir, "long-desc", "SKILL.md"),
      `---
name: long-desc
description: ${"a".repeat(2000)}
---
# Content`
    );

    await manager.initialize();

    const skills = manager.getSkillsForMode();
    const longDescSkill = skills.find((s) => s.name === "long-desc");

    expect(longDescSkill).toBeUndefined();
  });

  it("should require name to match directory", async () => {
    await fs.mkdir(path.join(testGlobalDir, "mismatch-name"), { recursive: true });
    await fs.writeFile(
      path.join(testGlobalDir, "mismatch-name", "SKILL.md"),
      `---
name: different-name
description: Test
---
# Content`
    );

    await manager.initialize();

    const skills = manager.getSkillsForMode();
    const mismatchedSkill = skills.find((s) => s.name === "different-name");

    expect(mismatchedSkill).toBeUndefined();
  });
});
