/**
 * Cost Router
 * Intelligent model selection based on task and cost
 */

import { ModelInfo, ProviderSelection, TaskComplexity } from "./types";

// Model registry with costs (as of 2025)
const MODEL_REGISTRY: Record<string, ModelInfo> = {
  "claude-haiku": {
    id: "claude-3-haiku-20240307",
    provider: "anthropic",
    inputCostPer1k: 0.00025,
    outputCostPer1k: 0.00125,
    maxTokens: 200000,
    capabilities: ["tool-use", "vision"],
  },
  "claude-sonnet": {
    id: "claude-3-5-sonnet-20241022",
    provider: "anthropic",
    inputCostPer1k: 0.003,
    outputCostPer1k: 0.015,
    maxTokens: 200000,
    capabilities: ["tool-use", "vision", "extended-thinking"],
  },
  "gpt-4o-mini": {
    id: "gpt-4o-mini",
    provider: "openai",
    inputCostPer1k: 0.00015,
    outputCostPer1k: 0.0006,
    maxTokens: 128000,
    capabilities: ["tool-use", "vision"],
  },
  "gpt-4o": {
    id: "gpt-4o",
    provider: "openai",
    inputCostPer1k: 0.005,
    outputCostPer1k: 0.015,
    maxTokens: 128000,
    capabilities: ["tool-use", "vision"],
  },
  "llama-3-70b": {
    id: "llama-3-70b",
    provider: "ollama",
    inputCostPer1k: 0,
    outputCostPer1k: 0,
    maxTokens: 8192,
    capabilities: ["tool-use", "local"],
  },
};

export class CostRouter {
  private availableModels: ModelInfo[];

  constructor(availableModels?: string[]) {
    this.availableModels = availableModels
      ? availableModels.map((id) => MODEL_REGISTRY[id]).filter(Boolean)
      : Object.values(MODEL_REGISTRY);
  }

  /**
   * Select the best model for a task
   */
  selectForTask(task: string, complexity: TaskComplexity): ProviderSelection {
    const capableModels = this.availableModels.filter((model) =>
      complexity.requiresCapabilities.every((cap) =>
        model.capabilities.includes(cap)
      )
    );

    if (capableModels.length === 0) {
      // Fallback to least capable model
      return this.createSelection(this.availableModels[0], complexity.estimatedTokens);
    }

    // For low complexity, use cheapest
    if (complexity.level === "low") {
      const cheapest = capableModels.sort((a, b) =>
        (a.inputCostPer1k + a.outputCostPer1k) -
        (b.inputCostPer1k + b.outputCostPer1k)
      )[0];

      return this.createSelection(cheapest, complexity.estimatedTokens);
    }

    // For medium/high complexity, balance cost and capability
    const best = capableModels.sort((a, b) => {
      const aScore = this.calculateScore(a, complexity);
      const bScore = this.calculateScore(b, complexity);
      return bScore - aScore;
    })[0];

    return this.createSelection(best, complexity.estimatedTokens);
  }

  /**
   * Calculate a score for model selection
   */
  private calculateScore(model: ModelInfo, complexity: TaskComplexity): number {
    // Score = (capability score) / (cost factor)
    const capabilityScore = model.maxTokens / 1000;
    const costFactor = model.inputCostPer1k + model.outputCostPer1k;
    const costAdjusted = costFactor === 0 ? 0.0001 : costFactor;

    return capabilityScore / costAdjusted;
  }

  /**
   * Create provider selection result
   */
  private createSelection(model: ModelInfo, estimatedTokens: number): ProviderSelection {
    const estimatedCost = (estimatedTokens / 1000) *
      ((model.inputCostPer1k + model.outputCostPer1k) / 2);

    return {
      model,
      estimatedCost,
      estimatedTokens,
      reasoning: `Selected ${model.id} for optimal cost/capability balance`,
    };
  }

  /**
   * Analyze task complexity
   */
  analyzeTask(task: string): TaskComplexity {
    const tokenCount = this.estimateTokens(task);
    const hasCode = /```[\s\S]*```/.test(task);
    const hasFiles = /read_file|write_file|edit_file/.test(task);
    const requiresTools = hasFiles || /browser|search/.test(task);

    let level: "low" | "medium" | "high";
    if (tokenCount > 10000 && hasCode) {
      level = "high";
    } else if (tokenCount > 5000 || hasFiles) {
      level = "medium";
    } else {
      level = "low";
    }

    const capabilities: string[] = [];
    if (requiresTools) capabilities.push("tool-use");
    if (/(image|screenshot|photo)/.test(task)) capabilities.push("vision");

    return {
      level,
      estimatedTokens: tokenCount,
      requiresCapabilities: capabilities,
    };
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
