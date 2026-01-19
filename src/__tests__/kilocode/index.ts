/**
 * Kilocode Test Suite Index
 * Centralizes all Kilocode-related tests
 */

// Unit Tests
export * from "./unit/semantic-search/scanner.test";
export * from "./unit/semantic-search/embedders.test";
export * from "./unit/semantic-search/vector-store.test";
export * from "./unit/context-management/memory.test";
export * from "./unit/cost-optimization/cost-router.test";
export * from "./unit/skills/skills-manager.test";

// Integration Tests
export * from "./integration/kilocode/ipc.test";
export * from "./integration/kilocode/workflow.test";
