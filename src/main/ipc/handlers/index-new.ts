/**
 * Kilocode IPC Handlers Registry
 * Central registration point for Kilocode integration IPC handlers
 */

import { registerSkillsHandlers } from "./skills";
import { registerSemanticSearchHandlers } from "./semantic-search";
import { registerContextHandlers } from "./context";
import { registerCostHandlers } from "./cost";

export function registerKilocodeIPCHandlers(): void {
  registerSkillsHandlers();
  registerSemanticSearchHandlers();
  registerContextHandlers();
  registerCostHandlers();
}

export * from "./skills";
export * from "./semantic-search";
export * from "./context";
export * from "./cost";
