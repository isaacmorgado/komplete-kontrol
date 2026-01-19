/**
 * Skills System Type Definitions
 * Adapted from: kilocode/src/shared/skills.ts
 */

export interface SkillMetadata {
  name: string;           // Required: skill identifier (1-64 chars)
  description: string;    // Required: when to use this skill (1-1024 chars)
  path: string;           // Absolute path to SKILL.md
  source: "global" | "project";  // Where the skill was discovered
  mode?: string;          // If set, skill only available in this mode
  license?: string;       // Optional: SPDX license identifier
  compatibility?: string; // Optional: Compatibility notes
}

export interface SkillContent extends SkillMetadata {
  instructions: string;   // Full markdown body of the skill
}

export interface SkillDiscoveryOptions {
  globalSkillsPath: string;
  projectSkillsPath?: string;
  modes: string[];
}

export interface SkillChangeEvent {
  type: "added" | "removed" | "modified";
  skill: SkillMetadata;
}

export interface SkillsManagerConfig {
  enableGlobalSkills: boolean;
  enableProjectSkills: boolean;
  watchForChanges: boolean;
}

// Skill name validation: must be 1-64 chars, lowercase/numbers/hyphens only
export const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SKILL_NAME_MIN_LENGTH = 1;
export const SKILL_NAME_MAX_LENGTH = 64;
export const SKILL_DESCRIPTION_MIN_LENGTH = 1;
export const SKILL_DESCRIPTION_MAX_LENGTH = 1024;
