/**
 * Unit Tests: Cost Router
 */

import { describe, it, expect, beforeEach } from "vitest";
import { CostRouter } from "../../../../main/cost-optimization/CostRouter";

describe("CostRouter", () => {
  let router: CostRouter;

  beforeEach(() => {
    router = new CostRouter([
      "claude-haiku",
      "claude-sonnet",
      "gpt-4o-mini",
      "llama-3-70b",
    ]);
  });

  it("should analyze low complexity task", () => {
    const task = "Write a simple hello world function";
    const complexity = router.analyzeTask(task);

    expect(complexity.level).toBe("low");
    expect(complexity.estimatedTokens).toBeLessThan(5000);
    expect(complexity.requiresCapabilities).toEqual([]);
  });

  it("should analyze medium complexity task", () => {
    const task = "Implement a user login system with validation";
    const complexity = router.analyzeTask(task);

    expect(complexity.level).toBe("medium");
    expect(complexity.requiresCapabilities).toContain("tool-use");
  });

  it("should analyze high complexity task", () => {
    const task = "Refactor the entire payment processing module with error handling and tests. This involves updating the PaymentProcessor class, adding new validation methods, integrating with the payment gateway API, and writing comprehensive unit tests for all edge cases including network failures, invalid card numbers, and timeout scenarios.";

    const complexity = router.analyzeTask(task);

    expect(complexity.level).toBe("high");
    expect(complexity.estimatedTokens).toBeGreaterThan(10000);
  });

  it("should select cheapest model for low complexity", () => {
    const task = "Simple task";
    const complexity = router.analyzeTask(task);
    const selection = router.selectForTask(task, complexity);

    expect(selection.model.id).toBe("gpt-4o-mini"); // Cheapest
    expect(selection.estimatedCost).toBeGreaterThan(0);
  });

  it("should select balanced model for medium complexity", () => {
    const task = "Implement a feature with file operations";
    const complexity = router.analyzeTask(task);
    const selection = router.selectForTask(task, complexity);

    expect(["claude-haiku", "gpt-4o-mini"]).toContain(selection.model.id);
  });

  it("should select capable model for high complexity", () => {
    const task = "Complex task with code";
    const complexity = router.analyzeTask(task);
    const selection = router.selectForTask(task, complexity);

    expect(selection.model.maxTokens).toBeGreaterThan(100000);
  });

  it("should estimate tokens based on text length", () => {
    const task = "a".repeat(4000); // ~1000 tokens
    const complexity = router.analyzeTask(task);

    expect(complexity.estimatedTokens).toBeGreaterThan(900);
    expect(complexity.estimatedTokens).toBeLessThan(1100);
  });

  it("should detect code in task", () => {
    const task = "```javascript\nconst x = 1;\n```";
    const complexity = router.analyzeTask(task);

    expect(complexity.level).not.toBe("low");
  });

  it("should detect tool requirements", () => {
    const task = "Read the file and edit it";
    const complexity = router.analyzeTask(task);

    expect(complexity.requiresCapabilities).toContain("tool-use");
  });

  it("should detect vision requirements", () => {
    const task = "Analyze this screenshot image.png";
    const complexity = router.analyzeTask(task);

    expect(complexity.requiresCapabilities).toContain("vision");
  });

  it("should handle tasks without capable models", () => {
    const router = new CostRouter(["llama-3-70b"]); // Local model only
    const task = "Process image screenshot";
    const complexity = router.analyzeTask(task);

    // Should still return a selection (fallback)
    const selection = router.selectForTask(task, complexity);

    expect(selection).toBeDefined();
    expect(selection.model.id).toBeDefined();
  });

  it("should estimate cost correctly", () => {
    const task = "Test task";
    const complexity = router.analyzeTask(task);
    const selection = router.selectForTask(task, complexity);

    const expectedCost = (complexity.estimatedTokens / 1000) *
      ((selection.model.inputCostPer1k + selection.model.outputCostPer1k) / 2);

    expect(selection.estimatedCost).toBeCloseTo(expectedCost, 5);
  });
});
