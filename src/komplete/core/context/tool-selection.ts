/**
 * Context-Aware Tool Selection for KOMPLETE-KONTROL CLI
 *
 * Provides intelligent tool selection based on context including:
 * - Context keyword analysis
 * - Tool usage tracking
 * - Success rate monitoring
 * - Token estimation
 */

import { createLogger, type ContextLogger } from '../../utils/logger';
import type {
  ContextMessage,
  Tool,
  ToolSelectionCriteria,
  ToolRecommendation,
  MessageContent,
} from '../../types';

/**
 * Tool usage statistics
 */
interface ToolUsageStats {
  totalCount: number;
  successCount: number;
  failCount: number;
  lastUsedAt: Date;
  averageTokens: number;
}

/**
 * Context-aware tool selector
 * Selects appropriate tools based on context and usage patterns
 */
export class ContextAwareToolSelector {
  private logger: ContextLogger;
  private toolUsageStats: Map<string, ToolUsageStats> = new Map();
  private availableTools: Map<string, Tool> = new Map();
  private minConfidenceThreshold: number = 0.3;

  constructor(logger?: ContextLogger) {
    this.logger = logger ?? createLogger('ContextAwareToolSelector');
    this.logger.debug('Context-aware tool selector initialized');
  }

  /**
   * Register a tool
   *
   * @param tool - Tool to register
   */
  registerTool(tool: Tool): void {
    this.availableTools.set(tool.name, tool);
    this.logger.debug('Tool registered', { tool: tool.name } as Record<string, unknown>);

    // Initialize stats if not exists
    if (!this.toolUsageStats.has(tool.name)) {
      this.toolUsageStats.set(tool.name, {
        totalCount: 0,
        successCount: 0,
        failCount: 0,
        lastUsedAt: new Date(),
        averageTokens: 0,
      });
    }
  }

  /**
   * Unregister a tool
   *
   * @param toolName - Name of tool to unregister
   */
  unregisterTool(toolName: string): void {
    this.availableTools.delete(toolName);
    this.toolUsageStats.delete(toolName);
    this.logger.debug('Tool unregistered', { tool: toolName } as Record<string, unknown>);
  }

  /**
   * Record tool usage
   *
   * @param toolName - Name of tool used
   * @param success - Whether the tool execution was successful
   * @param tokensUsed - Number of tokens used
   */
  recordUsage(toolName: string, success: boolean, tokensUsed: number = 0): void {
    const stats = this.toolUsageStats.get(toolName);

    if (!stats) {
      this.logger.warn('Recording usage for unregistered tool', {
        tool: toolName,
      } as Record<string, unknown>);
      return;
    }

    stats.totalCount++;
    stats.lastUsedAt = new Date();

    if (success) {
      stats.successCount++;
    } else {
      stats.failCount++;
    }

    // Update average tokens
    if (tokensUsed > 0) {
      stats.averageTokens = (stats.averageTokens * (stats.totalCount - 1) + tokensUsed) / stats.totalCount;
    }

    this.logger.debug('Tool usage recorded', {
      tool: toolName,
      success,
      tokensUsed,
      successRate: stats.successCount / stats.totalCount,
    } as Record<string, unknown>);
  }

  /**
   * Get tool recommendations based on context
   *
   * @param criteria - Selection criteria
   * @param limit - Maximum number of recommendations
   * @returns Tool recommendations
   */
  getRecommendations(
    criteria: ToolSelectionCriteria,
    limit: number = 5
  ): ToolRecommendation[] {
    this.logger.debug('Getting tool recommendations', {
      contextKeywords: criteria.contextKeywords,
      contextComplexity: criteria.contextComplexity,
      taskType: criteria.taskType,
      limit,
    } as Record<string, unknown>);

    const recommendations: ToolRecommendation[] = [];

    for (const [toolName, tool] of this.availableTools.entries()) {
      const recommendation = this.evaluateTool(tool, criteria);

      if (recommendation.confidence >= this.minConfidenceThreshold) {
        recommendations.push(recommendation);
      }
    }

    // Sort by confidence and limit
    recommendations.sort((a, b) => b.confidence - a.confidence);

    this.logger.debug('Tool recommendations generated', {
      count: recommendations.length,
      limited: Math.min(recommendations.length, limit),
    } as Record<string, unknown>);

    return recommendations.slice(0, limit);
  }

  /**
   * Get best tool for context
   *
   * @param criteria - Selection criteria
   * @returns Best tool or null
   */
  getBestTool(criteria: ToolSelectionCriteria): ToolRecommendation | null {
    const recommendations = this.getRecommendations(criteria, 1);

    if (recommendations.length === 0) {
      this.logger.debug('No suitable tool found for context');
      return null;
    }

    return recommendations[0];
  }

  /**
   * Get tool usage statistics
   *
   * @param toolName - Name of tool
   * @returns Tool usage statistics
   */
  getToolStats(toolName: string): ToolUsageStats | null {
    return this.toolUsageStats.get(toolName) ?? null;
  }

  /**
   * Get all tool usage statistics
   *
   * @returns All tool usage statistics
   */
  getAllStats(): Map<string, ToolUsageStats> {
    return new Map(this.toolUsageStats);
  }

  /**
   * Clear all usage statistics
   */
  clearStats(): void {
    this.toolUsageStats.clear();
    this.logger.debug('All tool usage statistics cleared');
  }

  /**
   * Set minimum confidence threshold
   *
   * @param threshold - Minimum confidence threshold
   */
  setMinConfidenceThreshold(threshold: number): void {
    this.minConfidenceThreshold = threshold;
    this.logger.debug('Minimum confidence threshold updated', { threshold } as Record<string, unknown>);
  }

  /**
   * Evaluate a tool for the given criteria
   *
   * @param tool - Tool to evaluate
   * @param criteria - Selection criteria
   * @returns Tool recommendation
   */
  private evaluateTool(
    tool: Tool,
    criteria: ToolSelectionCriteria
  ): ToolRecommendation {
    let confidence = 0;
    const reasons: string[] = [];

    // Check keyword matching
    const keywordScore = this.evaluateKeywordMatch(tool, criteria.contextKeywords);
    confidence += keywordScore;
    if (keywordScore > 0) {
      reasons.push(`Matches ${keywordScore.toFixed(0)} context keywords`);
    }

    // Check success rate
    const stats = this.toolUsageStats.get(tool.name);
    if (stats && stats.totalCount > 0) {
      const successRate = stats.successCount / stats.totalCount;
      confidence += successRate * 30;
      reasons.push(`Success rate: ${(successRate * 100).toFixed(0)}%`);
    }

    // Check recent usage
    if (stats) {
      const age = Date.now() - stats.lastUsedAt.getTime();
      const recentBoost = Math.max(0, 1 - age / (24 * 60 * 60 * 1000)); // Decay over 24 hours
      confidence += recentBoost * 10;
      if (recentBoost > 0.5) {
        reasons.push('Recently used successfully');
      }
    }

    // Check context complexity match
    const complexityScore = this.evaluateComplexityMatch(tool, criteria.contextComplexity);
    confidence += complexityScore;
    if (complexityScore > 0) {
      reasons.push(`Matches ${criteria.contextComplexity} complexity`);
    }

    // Check task type match
    if (criteria.taskType) {
      const taskScore = this.evaluateTaskTypeMatch(tool, criteria.taskType);
      confidence += taskScore;
      if (taskScore > 0) {
        reasons.push(`Matches task type: ${criteria.taskType}`);
      }
    }

    // Estimate tokens
    const estimatedTokens = stats?.averageTokens ?? this.estimateToolTokens(tool);

    return {
      tool: tool.name,
      confidence: Math.min(100, confidence),
      reason: reasons.join('; ') || 'General purpose tool',
      estimatedTokens,
    };
  }

  /**
   * Evaluate keyword matching for a tool
   *
   * @param tool - Tool to evaluate
   * @param keywords - Context keywords
   * @returns Keyword match score
   */
  private evaluateKeywordMatch(tool: Tool, keywords: string[]): number {
    if (keywords.length === 0) {
      return 0;
    }

    const toolText = `${tool.name} ${tool.description}`.toLowerCase();
    let matchCount = 0;

    for (const keyword of keywords) {
      if (toolText.includes(keyword.toLowerCase())) {
        matchCount++;
      }
    }

    return (matchCount / keywords.length) * 40;
  }

  /**
   * Evaluate complexity match for a tool
   *
   * @param tool - Tool to evaluate
   * @param complexity - Context complexity
   * @returns Complexity match score
   */
  private evaluateComplexityMatch(
    tool: Tool,
    complexity: 'simple' | 'medium' | 'complex'
  ): number {
    const toolComplexity = this.inferToolComplexity(tool);

    if (toolComplexity === complexity) {
      return 20;
    }

    // Partial match
    if (
      (complexity === 'simple' && toolComplexity === 'medium') ||
      (complexity === 'medium' && toolComplexity === 'complex') ||
      (complexity === 'complex' && toolComplexity === 'medium')
    ) {
      return 10;
    }

    return 0;
  }

  /**
   * Infer tool complexity from description
   *
   * @param tool - Tool to infer complexity for
   * @returns Inferred complexity
   */
  private inferToolComplexity(
    tool: Tool
  ): 'simple' | 'medium' | 'complex' {
    const text = `${tool.name} ${tool.description}`.toLowerCase();

    // Complex indicators
    const complexIndicators = [
      'analyze', 'process', 'transform', 'aggregate', 'compute', 'calculate',
      'optimize', 'parallel', 'batch', 'stream', 'async', 'recursive',
    ];

    // Simple indicators
    const simpleIndicators = [
      'get', 'list', 'show', 'read', 'fetch', 'retrieve', 'display',
    ];

    let complexCount = 0;
    let simpleCount = 0;

    for (const indicator of complexIndicators) {
      if (text.includes(indicator)) {
        complexCount++;
      }
    }

    for (const indicator of simpleIndicators) {
      if (text.includes(indicator)) {
        simpleCount++;
      }
    }

    if (complexCount > simpleCount) {
      return 'complex';
    } else if (simpleCount > complexCount) {
      return 'simple';
    }

    return 'medium';
  }

  /**
   * Evaluate task type match for a tool
   *
   * @param tool - Tool to evaluate
   * @param taskType - Task type
   * @returns Task type match score
   */
  private evaluateTaskTypeMatch(tool: Tool, taskType: string): number {
    const toolText = `${tool.name} ${tool.description}`.toLowerCase();
    const taskText = taskType.toLowerCase();

    // Direct match
    if (toolText.includes(taskText)) {
      return 25;
    }

    // Partial match
    const taskWords = taskText.split(/\s+/);
    let matchCount = 0;

    for (const word of taskWords) {
      if (toolText.includes(word)) {
        matchCount++;
      }
    }

    return (matchCount / taskWords.length) * 15;
  }

  /**
   * Estimate tokens for a tool
   *
   * @param tool - Tool to estimate for
   * @returns Estimated token count
   */
  private estimateToolTokens(tool: Tool): number {
    const text = `${tool.name} ${tool.description} ${JSON.stringify(tool.inputSchema)}`;
    return Math.ceil(text.length / 4);
  }

  /**
   * Get available tools
   *
   * @returns List of available tools
   */
  getAvailableTools(): Tool[] {
    return Array.from(this.availableTools.values());
  }

  /**
   * Get tool by name
   *
   * @param toolName - Name of tool
   * @returns Tool or null
   */
  getTool(toolName: string): Tool | null {
    return this.availableTools.get(toolName) ?? null;
  }

  /**
   * Get statistics summary
   *
   * @returns Statistics summary
   */
  getStatistics(): {
    totalTools: number;
    totalUsage: number;
    averageSuccessRate: number;
    topTools: Array<{ tool: string; usage: number; successRate: number }>;
  } {
    let totalUsage = 0;
    let totalSuccesses = 0;
    const toolUsages: Array<{ tool: string; usage: number; successRate: number }> = [];

    for (const [toolName, stats] of this.toolUsageStats.entries()) {
      totalUsage += stats.totalCount;
      totalSuccesses += stats.successCount;

      toolUsages.push({
        tool: toolName,
        usage: stats.totalCount,
        successRate: stats.totalCount > 0 ? stats.successCount / stats.totalCount : 0,
      });
    }

    // Sort by usage
    toolUsages.sort((a, b) => b.usage - a.usage);

    return {
      totalTools: this.availableTools.size,
      totalUsage,
      averageSuccessRate: totalUsage > 0 ? totalSuccesses / totalUsage : 0,
      topTools: toolUsages.slice(0, 5),
    };
  }
}

/**
 * Create context-aware tool selector
 *
 * @param minConfidence - Minimum confidence threshold
 * @returns New context-aware tool selector
 */
export function createContextAwareToolSelector(
  minConfidence: number = 0.3
): ContextAwareToolSelector {
  const selector = new ContextAwareToolSelector();
  selector.setMinConfidenceThreshold(minConfidence);
  return selector;
}
