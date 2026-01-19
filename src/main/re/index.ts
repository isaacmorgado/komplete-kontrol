/**
 * Reverse Engineering Module - Main Exports
 * Central module for RE toolkit integration
 */

// Core modules
export * from './intent-parser';
export * from './tool-selector';
export * from './orchestrator';
export * from './re-database';
export * from './seed-database';
export * from './ipc-handlers';

// Re-export singletons for convenience
export { getIntentParser } from './intent-parser';
export { getToolSelector } from './tool-selector';
export { getREOrchestrator } from './orchestrator';
export { getREDatabase, closeREDatabase } from './re-database';
