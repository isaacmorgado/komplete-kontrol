/**
 * Cost Optimization Type Definitions
 */

export interface ModelInfo {
  id: string;
  provider: string;
  inputCostPer1k: number;
  outputCostPer1k: number;
  maxTokens: number;
  capabilities: string[];
}

export interface ProviderSelection {
  model: ModelInfo;
  estimatedCost: number;
  estimatedTokens: number;
  reasoning: string;
}

export interface TaskComplexity {
  level: "low" | "medium" | "high";
  estimatedTokens: number;
  requiresCapabilities: string[];
}
