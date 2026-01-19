/**
 * RE Tool Selector
 * Intelligent tool selection using weighted ranking algorithm
 */

import { getREDatabase, RETool, REWorkflow } from './re-database';
import { RETargetType, REIntent } from './intent-parser';

export interface ToolScore {
  tool: RETool;
  score: number;
  breakdown: {
    capability: number;    // 40% weight
    performance: number;   // 30% weight
    reliability: number;   // 20% weight
    popularity: number;    // 10% weight
  };
}

export interface ToolSelectionResult {
  primaryTools: ToolScore[];
  workflows: REWorkflow[];
  recommendedApproach: 'workflow' | 'manual' | 'hybrid';
  estimatedDuration?: number;
  confidence: number;
}

export class ToolSelector {
  private db = getREDatabase();

  // Scoring weights
  private readonly WEIGHTS = {
    capability: 0.4,
    performance: 0.3,
    reliability: 0.2,
    popularity: 0.1
  };

  /**
   * Select optimal tools for a given RE intent
   */
  selectTools(intent: REIntent): ToolSelectionResult {
    const targetType = intent.target.type;

    // Get all tools for this target type
    const categoryTools = this.db.getToolsByCategory(targetType);

    if (categoryTools.length === 0) {
      return {
        primaryTools: [],
        workflows: [],
        recommendedApproach: 'manual',
        confidence: 0.0
      };
    }

    // Score each tool
    const scoredTools = categoryTools.map(tool => this.scoreTool(tool, intent));

    // Sort by score (highest first)
    scoredTools.sort((a, b) => b.score - a.score);

    // Get top tools (top 5 or tools with score > 0.7)
    const primaryTools = scoredTools.filter(t => t.score > 0.7).slice(0, 5);

    // Get applicable workflows
    const workflows = this.db.getWorkflowsByTargetType(targetType);

    // Rank workflows by success rate and usage
    workflows.sort((a, b) => {
      const scoreA = (a.success_rate || 0.5) * 0.6 + (a.usage_count || 0) * 0.0001;
      const scoreB = (b.success_rate || 0.5) * 0.6 + (b.usage_count || 0) * 0.0001;
      return scoreB - scoreA;
    });

    // Determine recommended approach
    const recommendedApproach = this.determineApproach(workflows, primaryTools, intent);

    // Calculate confidence
    const confidence = this.calculateSelectionConfidence(primaryTools, workflows, intent);

    // Estimate duration
    const estimatedDuration = this.estimateDuration(workflows, primaryTools, intent);

    return {
      primaryTools,
      workflows: workflows.slice(0, 3), // Top 3 workflows
      recommendedApproach,
      estimatedDuration,
      confidence
    };
  }

  /**
   * Score a tool based on weighted criteria
   */
  private scoreTool(tool: RETool, intent: REIntent): ToolScore {
    // Capability score (40%)
    const capabilityScore = this.scoreCapability(tool, intent);

    // Performance score (30%)
    const performanceScore = tool.performance_score || 0.7;

    // Reliability score (20%)
    const reliabilityScore = tool.reliability_score || 0.8;

    // Popularity score (10%)
    const popularityScore = tool.popularity_score || 0.5;

    // Weighted total
    const totalScore =
      capabilityScore * this.WEIGHTS.capability +
      performanceScore * this.WEIGHTS.performance +
      reliabilityScore * this.WEIGHTS.reliability +
      popularityScore * this.WEIGHTS.popularity;

    return {
      tool,
      score: totalScore,
      breakdown: {
        capability: capabilityScore,
        performance: performanceScore,
        reliability: reliabilityScore,
        popularity: popularityScore
      }
    };
  }

  /**
   * Score tool's capability match
   */
  private scoreCapability(tool: RETool, intent: REIntent): number {
    let score = 0.5; // Base score

    const { command, options, target } = intent;

    // Match command to tool capabilities
    const capabilities = tool.capabilities || [];

    // Command matching
    if (command === 'decompile' && capabilities.includes('decompilation')) {
      score += 0.3;
    }

    if (command === 'deobfuscate' && capabilities.includes('deobfuscation')) {
      score += 0.3;
    }

    if (command === 'analyze' && capabilities.includes('static-analysis')) {
      score += 0.2;
    }

    if (capabilities.includes('dynamic-analysis')) {
      score += 0.1;
    }

    // Depth matching
    if (options.depth === 'deep' && capabilities.includes('deep-analysis')) {
      score += 0.15;
    }

    if (options.depth === 'surface' && capabilities.includes('quick-scan')) {
      score += 0.1;
    }

    // Platform-specific bonus
    if (target.metadata?.platform) {
      const platforms = tool.platforms || [];
      if (platforms.includes(target.metadata.platform)) {
        score += 0.15;
      }
    }

    // Clamp between 0 and 1
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Determine recommended approach
   */
  private determineApproach(
    workflows: REWorkflow[],
    primaryTools: ToolScore[],
    intent: REIntent
  ): 'workflow' | 'manual' | 'hybrid' {
    // If high-quality workflows exist, recommend workflow
    if (workflows.length > 0 && workflows[0].success_rate && workflows[0].success_rate > 0.85) {
      return 'workflow';
    }

    // If good tools but no workflows, recommend manual
    if (primaryTools.length > 0 && workflows.length === 0) {
      return 'manual';
    }

    // If moderate workflows and good tools, recommend hybrid
    if (workflows.length > 0 && primaryTools.length > 2) {
      return 'hybrid';
    }

    // Default to manual
    return 'manual';
  }

  /**
   * Calculate overall selection confidence
   */
  private calculateSelectionConfidence(
    primaryTools: ToolScore[],
    workflows: REWorkflow[],
    intent: REIntent
  ): number {
    let confidence = intent.confidence; // Start with intent confidence

    // Boost if we have high-scoring tools
    if (primaryTools.length > 0 && primaryTools[0].score > 0.8) {
      confidence += 0.2;
    }

    // Boost if we have proven workflows
    if (workflows.length > 0 && workflows[0].success_rate && workflows[0].success_rate > 0.85) {
      confidence += 0.2;
    }

    // Reduce if no tools found
    if (primaryTools.length === 0) {
      confidence -= 0.3;
    }

    // Clamp between 0 and 1
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Estimate execution duration
   */
  private estimateDuration(
    workflows: REWorkflow[],
    primaryTools: ToolScore[],
    intent: REIntent
  ): number | undefined {
    // If using a workflow, return its estimated duration
    if (workflows.length > 0 && workflows[0].estimated_duration) {
      return workflows[0].estimated_duration;
    }

    // Estimate based on depth and number of tools
    const baseTime = intent.options.depth === 'deep' ? 600 : intent.options.depth === 'surface' ? 60 : 300; // seconds
    const toolMultiplier = primaryTools.length > 0 ? primaryTools.length * 0.5 : 1;

    return Math.round(baseTime * toolMultiplier);
  }

  /**
   * Get tool recommendations with explanations
   */
  getToolRecommendations(intent: REIntent): {
    tool: RETool;
    reason: string;
    score: number;
  }[] {
    const result = this.selectTools(intent);

    return result.primaryTools.map(scored => {
      const reasons: string[] = [];

      if (scored.breakdown.capability > 0.7) {
        reasons.push('Strong capability match');
      }

      if (scored.breakdown.performance > 0.8) {
        reasons.push('High performance');
      }

      if (scored.breakdown.reliability > 0.9) {
        reasons.push('Very reliable');
      }

      if (scored.breakdown.popularity > 0.7) {
        reasons.push('Widely used');
      }

      if (scored.tool.cost === 'free') {
        reasons.push('Free and open source');
      }

      return {
        tool: scored.tool,
        reason: reasons.join(', ') || 'General-purpose tool',
        score: scored.score
      };
    });
  }

  /**
   * Check if specific tools are installed
   */
  async checkToolAvailability(toolIds: string[]): Promise<{
    available: string[];
    missing: string[];
  }> {
    const available: string[] = [];
    const missing: string[] = [];

    for (const toolId of toolIds) {
      const tool = this.db.getToolById(toolId);
      if (!tool) {
        missing.push(toolId);
        continue;
      }

      // Check if binary exists (basic check)
      if (tool.version_command) {
        try {
          const { exec } = require('child_process');
          const { promisify } = require('util');
          const execAsync = promisify(exec);
          await execAsync(tool.version_command, { timeout: 5000 });
          available.push(toolId);
        } catch {
          missing.push(toolId);
        }
      } else {
        // Can't verify, assume available
        available.push(toolId);
      }
    }

    return { available, missing };
  }

  /**
   * Generate installation instructions for missing tools
   */
  getInstallInstructions(toolIds: string[]): {
    toolId: string;
    name: string;
    method: string;
    command: string;
  }[] {
    return toolIds
      .map(toolId => {
        const tool = this.db.getToolById(toolId);
        if (!tool) return null;

        return {
          toolId: tool.id,
          name: tool.name,
          method: tool.install_method || 'manual',
          command: tool.install_command || `# Install ${tool.name} manually - see ${tool.documentation_url}`
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }
}

// Singleton instance
let selectorInstance: ToolSelector | null = null;

export function getToolSelector(): ToolSelector {
  if (!selectorInstance) {
    selectorInstance = new ToolSelector();
  }
  return selectorInstance;
}
