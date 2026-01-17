/**
 * Context Optimization for KOMPLETE-KONTROL CLI
 *
 * Provides context optimization strategies including:
 * - Token estimation and reduction
 * - Message deduplication
 * - Priority-based message selection
 * - Relevance scoring
 */

import { createLogger, type ContextLogger } from '../../utils/logger';
import type {
  ContextMessage,
  ContextOptimizationConfig,
  ContextOptimizationResult,
  MessageContent,
} from '../../types';

/**
 * Context optimizer
 * Optimizes context for token efficiency and relevance
 */
export class ContextOptimizer {
  private logger: ContextLogger;
  private config: ContextOptimizationConfig;

  constructor(config: Partial<ContextOptimizationConfig> = {}, logger?: ContextLogger) {
    this.config = {
      maxTokens: 128000,
      targetTokens: 100000,
      enableDeduplication: true,
      enableRelevanceScoring: true,
      preserveSystemMessages: true,
      preserveRecentMessages: 10,
      minRelevanceScore: 0.3,
      ...config,
    };
    this.logger = logger ?? createLogger('ContextOptimizer');
    this.logger.debug('Context optimizer initialized', { config: this.config } as Record<string, unknown>);
  }

  /**
   * Optimize context messages
   *
   * @param messages - Messages to optimize
   * @param query - Query for relevance scoring
   * @returns Optimization result
   */
  optimize(
    messages: ContextMessage[],
    query: string = ''
  ): ContextOptimizationResult {
    this.logger.debug('Optimizing context', {
      originalCount: messages.length,
      query,
    } as Record<string, unknown>);

    const startTime = Date.now();

    // Step 1: Estimate tokens
    const originalTokens = this.estimateTokens(messages);

    // Step 2: Deduplicate messages
    const deduplicatedMessages = this.config.enableDeduplication
      ? this.deduplicateMessages(messages)
      : messages;

    // Step 3: Score messages by relevance
    const scoredMessages = this.config.enableRelevanceScoring
      ? this.scoreMessages(deduplicatedMessages, query)
      : deduplicatedMessages.map(msg => ({ message: msg, score: 1.0 }));

    // Step 4: Select messages based on priority and relevance
    const selectedMessages = this.selectMessages(scoredMessages);

    // Step 5: Estimate final tokens
    const optimizedTokens = this.estimateTokens(selectedMessages);

    const endTime = Date.now();

    const result: ContextOptimizationResult = {
      originalMessages: messages,
      optimizedMessages: selectedMessages,
      originalTokenCount: originalTokens,
      optimizedTokenCount: optimizedTokens,
      tokenReduction: originalTokens - optimizedTokens,
      reductionPercentage: originalTokens > 0
        ? ((originalTokens - optimizedTokens) / originalTokens) * 100
        : 0,
      processingTime: endTime - startTime,
      removedCount: messages.length - selectedMessages.length,
    };

    this.logger.debug('Context optimization complete', {
      originalCount: messages.length,
      optimizedCount: selectedMessages.length,
      originalTokens,
      optimizedTokens,
      reductionPercentage: (result.reductionPercentage ?? 0).toFixed(2),
    } as Record<string, unknown>);

    return result;
  }

  /**
   * Estimate token count for messages
   *
   * @param messages - Messages to estimate
   * @returns Estimated token count
   */
  estimateTokens(messages: ContextMessage[]): number {
    let totalTokens = 0;

    for (const message of messages) {
      totalTokens += this.estimateMessageTokens(message);
    }

    return totalTokens;
  }

  /**
   * Estimate token count for a single message
   *
   * @param message - Message to estimate
   * @returns Estimated token count
   */
  estimateMessageTokens(message: ContextMessage): number {
    // Use explicit tokens if available
    if (message.tokens !== undefined) {
      return message.tokens;
    }

    // Base tokens for role and metadata
    let tokens = 10;

    // Tokens for content
    tokens += this.estimateContentTokens(message.content);

    return tokens;
  }

  /**
   * Estimate token count for content
   *
   * @param content - Content to estimate
   * @returns Estimated token count
   */
  estimateContentTokens(content: MessageContent | MessageContent[]): number {
    if (Array.isArray(content)) {
      return content.reduce((sum, item) => sum + this.estimateItemTokens(item), 0);
    }
    return this.estimateItemTokens(content);
  }

  /**
   * Estimate token count for a single content item
   *
   * @param item - Content item
   * @returns Estimated token count
   */
  private estimateItemTokens(item: MessageContent): number {
    if (item.type === 'text') {
      return Math.ceil(item.text.length / 4);
    }

    if (item.type === 'image') {
      // Images typically cost more tokens
      return 1000;
    }

    if (item.type === 'tool_use') {
      const toolUse = item as { type: 'tool_use'; name: string; input: Record<string, unknown> };
      const inputJson = JSON.stringify(toolUse.input);
      return Math.ceil((toolUse.name.length + inputJson.length) / 4) + 20;
    }

    if (item.type === 'tool_result') {
      const result = item as { type: 'tool_result'; content: unknown };
      if (typeof result.content === 'string') {
        return Math.ceil(result.content.length / 4);
      }
      if (Array.isArray(result.content)) {
        return result.content.reduce(
          (sum, subItem) => sum + this.estimateItemTokens(subItem),
          0
        );
      }
      return 100;
    }

    return 10;
  }

  /**
   * Deduplicate messages
   *
   * @param messages - Messages to deduplicate
   * @returns Deduplicated messages
   */
  private deduplicateMessages(messages: ContextMessage[]): ContextMessage[] {
    const seen = new Set<string>();
    const deduplicated: ContextMessage[] = [];

    for (const message of messages) {
      const hash = this.hashMessage(message);

      if (!seen.has(hash)) {
        seen.add(hash);
        deduplicated.push(message);
      }
    }

    this.logger.debug('Messages deduplicated', {
      original: messages.length,
      deduplicated: deduplicated.length,
    } as Record<string, unknown>);

    return deduplicated;
  }

  /**
   * Hash a message for deduplication
   *
   * @param message - Message to hash
   * @returns Message hash
   */
  private hashMessage(message: ContextMessage): string {
    const content = this.extractTextFromContent(message.content);
    return `${message.role}:${content.substring(0, 100)}`;
  }

  /**
   * Score messages by relevance
   *
   * @param messages - Messages to score
   * @param query - Query for relevance
   * @returns Scored messages
   */
  private scoreMessages(
    messages: ContextMessage[],
    query: string
  ): Array<{ message: ContextMessage; score: number }> {
    const queryKeywords = this.extractKeywords(query);

    return messages.map((message, index) => {
      let score = 0;

      // Boost for system messages
      if (message.role === 'system' && this.config.preserveSystemMessages) {
        score += 2.0;
      }

      // Boost for recent messages
      const recentBoost = Math.max(0, 1 - index / messages.length);
      score += recentBoost * 0.5;

      // Relevance to query
      const relevance = this.calculateRelevance(message, queryKeywords);
      score += relevance;

      return { message, score };
    });
  }

  /**
   * Calculate relevance of a message to a query
   *
   * @param message - Message to calculate relevance for
   * @param queryKeywords - Query keywords
   * @returns Relevance score
   */
  private calculateRelevance(
    message: ContextMessage,
    queryKeywords: string[]
  ): number {
    if (queryKeywords.length === 0) {
      return 0.5;
    }

    const text = this.extractTextFromContent(message.content).toLowerCase();
    let matchCount = 0;

    for (const keyword of queryKeywords) {
      if (text.includes(keyword.toLowerCase())) {
        matchCount++;
      }
    }

    return matchCount / queryKeywords.length;
  }

  /**
   * Select messages based on priority and relevance
   *
   * @param scoredMessages - Scored messages
   * @returns Selected messages
   */
  private selectMessages(
    scoredMessages: Array<{ message: ContextMessage; score: number }>
  ): ContextMessage[] {
    // Sort by score (descending)
    scoredMessages.sort((a, b) => b.score - a.score);

    const selected: ContextMessage[] = [];
    let currentTokens = 0;

    // Use defaults for optional config values
    const minRelevanceScore = this.config.minRelevanceScore ?? 0.3;
    const maxTokens = this.config.maxTokens ?? 128000;
    const targetTokens = this.config.targetTokens ?? 100000;
    const preserveRecentMessages = this.config.preserveRecentMessages ?? 10;

    for (const { message, score } of scoredMessages) {
      // Skip if below minimum relevance
      if (score < minRelevanceScore && message.role !== 'system') {
        continue;
      }

      const messageTokens = this.estimateMessageTokens(message);

      // Check if adding this message would exceed max tokens
      if (currentTokens + messageTokens > maxTokens) {
        // Try to fit if we're below target
        if (currentTokens < targetTokens) {
          selected.push(message);
          currentTokens += messageTokens;
        }
        continue;
      }

      selected.push(message);
      currentTokens += messageTokens;
    }

    // Ensure recent messages are preserved
    const recentMessages = scoredMessages
      .slice(-preserveRecentMessages)
      .filter(item => !selected.includes(item.message))
      .map(item => item.message);

    // Add recent messages if there's room
    for (const message of recentMessages) {
      const messageTokens = this.estimateMessageTokens(message);
      if (currentTokens + messageTokens <= maxTokens) {
        selected.push(message);
        currentTokens += messageTokens;
      }
    }

    // Sort selected messages back to original order
    const selectedSet = new Set(selected);
    const finalMessages = scoredMessages
      .filter(item => selectedSet.has(item.message))
      .map(item => item.message);

    this.logger.debug('Messages selected', {
      total: scoredMessages.length,
      selected: finalMessages.length,
      tokens: currentTokens,
    } as Record<string, unknown>);

    return finalMessages;
  }

  /**
   * Extract keywords from text
   *
   * @param text - Text to extract keywords from
   * @returns Extracted keywords
   */
  private extractKeywords(text: string): string[] {
    const words = text.toLowerCase().split(/\s+/);
    const commonWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'can', 'to', 'from', 'in', 'on',
      'at', 'by', 'for', 'with', 'about', 'as', 'of', 'and', 'or', 'but',
      'if', 'then', 'else', 'when', 'where', 'while', 'until', 'this',
      'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
    ]);

    return words.filter(word => word.length > 3 && !commonWords.has(word));
  }

  /**
   * Extract text from content
   *
   * @param content - Content to extract from
   * @returns Extracted text
   */
  private extractTextFromContent(content: MessageContent | MessageContent[]): string {
    if (Array.isArray(content)) {
      return content.map(item => this.extractTextFromItem(item)).join(' ');
    }
    return this.extractTextFromItem(content);
  }

  /**
   * Extract text from a single content item
   *
   * @param item - Content item
   * @returns Extracted text
   */
  private extractTextFromItem(item: MessageContent): string {
    if (typeof item === 'string') {
      return item;
    }
    if (item.type === 'text') {
      return (item as { type: 'text'; text: string }).text;
    }
    if (item.type === 'image') {
      return '[Image]';
    }
    if (item.type === 'tool_use') {
      const toolUse = item as { type: 'tool_use'; name: string; input: Record<string, unknown> };
      return `[Tool: ${toolUse.name}]`;
    }
    if (item.type === 'tool_result') {
      const result = item as { type: 'tool_result'; content: unknown };
      if (typeof result.content === 'string') {
        return result.content;
      }
      return '[Tool Result]';
    }
    return '';
  }

  /**
   * Update configuration
   *
   * @param config - New configuration
   */
  updateConfig(config: Partial<ContextOptimizationConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.debug('Config updated', { config } as Record<string, unknown>);
  }

  /**
   * Get configuration
   *
   * @returns Configuration
   */
  getConfig(): ContextOptimizationConfig {
    return { ...this.config };
  }
}

/**
 * Create context optimizer
 *
 * @param config - Optimization configuration
 * @returns New context optimizer
 */
export function createContextOptimizer(
  config: Partial<ContextOptimizationConfig> = {}
): ContextOptimizer {
  return new ContextOptimizer(config);
}
