/**
 * Mode System Prompts Index
 *
 * Central export for all mode-specific system prompts.
 *
 * Part of Phase 02: Mode System Integration (Section 3)
 */

export { ARCHITECT_PROMPT } from './architect';
export { CODE_PROMPT } from './code';
export { DEBUG_PROMPT } from './debug';
export { TEST_PROMPT } from './test';
export { REVERSE_ENGINEER_PROMPT } from './reverse-engineer';
export { ASK_PROMPT } from './ask';

import { ARCHITECT_PROMPT } from './architect';
import { CODE_PROMPT } from './code';
import { DEBUG_PROMPT } from './debug';
import { TEST_PROMPT } from './test';
import { REVERSE_ENGINEER_PROMPT } from './reverse-engineer';
import { ASK_PROMPT } from './ask';
import type { OperationalMode } from '../types';

/**
 * Map of mode slugs to their detailed prompts
 */
export const MODE_PROMPTS: Record<OperationalMode, string> = {
  'architect': ARCHITECT_PROMPT,
  'code': CODE_PROMPT,
  'debug': DEBUG_PROMPT,
  'test': TEST_PROMPT,
  'reverse-engineer': REVERSE_ENGINEER_PROMPT,
  'ask': ASK_PROMPT,
};

/**
 * Get the detailed prompt for a specific mode
 */
export function getModePrompt(mode: OperationalMode): string {
  return MODE_PROMPTS[mode];
}
