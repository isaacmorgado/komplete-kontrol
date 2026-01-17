/**
 * Token Counting and Budgeting for KOMPLETE-KONTROL CLI
 *
 * Provides token counting, cost estimation, and budgeting
 * for managing token usage and costs.
 */

import { createLogger, type ContextLogger } from '../../utils/logger';
import type {
  Message,
  TokenCountMethod,
  TokenPricing,
  TokenUsage,
  TokenBudgetConfig,
  MessageContent,
} from '../../types';

/**
 * Token counter class
 */
export class TokenCounter {
  private logger: ContextLogger;
  private method: TokenCountMethod;
  private pricing: TokenPricing;

  constructor(
    method: TokenCountMethod = 'char',
    pricing?: TokenPricing,
    logger?: ContextLogger
  ) {
    this.method = method;
    this.pricing = pricing ?? this.getDefaultPricing();
    this.logger = logger ?? createLogger('TokenCounter');
    this.logger.debug('Token counter initialized', {
      method,
      pricing: this.pricing,
    } as Record<string, unknown>);
  }

  /**
   * Count tokens in a message
   *
   * @param message - Message to count
   * @returns Token count
   */
  countMessage(message: Message): number {
    const text = this.extractTextFromContent(message.content);
    return this.countText(text);
  }

  /**
   * Count tokens in text
   *
   * @param text - Text to count
   * @returns Token count
   */
  countText(text: string): number {
    switch (this.method) {
      case 'char':
        return Math.ceil(text.length / 4);
      case 'word':
        return text.split(/\s+/).filter(w => w.length > 0).length;
      case 'model':
        // For now, fall back to char-based
        // TODO: Integrate with actual model tokenization
        return Math.ceil(text.length / 4);
      default:
        return Math.ceil(text.length / 4);
    }
  }

  /**
   * Estimate cost for a message
   *
   * @param message - Message to estimate
   * @returns Estimated cost in USD
   */
  estimateCost(message: Message): number {
    const tokens = this.countMessage(message);
    const isInput = message.role === 'user' || message.role === 'system';

    if (isInput) {
      return (tokens * this.pricing.inputPrice) / 1000000;
    } else {
      return (tokens * this.pricing.outputPrice) / 1000000;
    }
  }

  /**
   * Estimate cost for multiple messages
   *
   * @param messages - Messages to estimate
   * @returns Total estimated cost in USD
   */
  estimateCostBatch(messages: Message[]): number {
    return messages.reduce((sum, msg) => sum + this.estimateCost(msg), 0);
  }

  /**
   * Get current pricing
   *
   * @returns Current pricing
   */
  getPricing(): TokenPricing {
    return { ...this.pricing };
  }

  /**
   * Set pricing
   *
   * @param pricing - New pricing
   */
  setPricing(pricing: TokenPricing): void {
    this.pricing = pricing;
    this.logger.debug('Pricing updated', { pricing } as Record<string, unknown>);
  }

  /**
   * Get current counting method
   *
   * @returns Counting method
   */
  getMethod(): TokenCountMethod {
    return this.method;
  }

  /**
   * Set counting method
   *
   * @param method - New method
   */
  setMethod(method: TokenCountMethod): void {
    this.method = method;
    this.logger.debug('Counting method updated', { method } as Record<string, unknown>);
  }

  /**
   * Extract text from message content
   *
   * @param content - Message content
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
      return `[Tool: ${(item as { type: 'tool_use'; name: string; input: any }).name}]`;
    }
    if (item.type === 'tool_result') {
      const resultContent = (item as { type: 'tool_result'; content: any }).content;
      if (typeof resultContent === 'string') {
        return `[Result: ${resultContent}]`;
      }
      if (Array.isArray(resultContent)) {
        return `[Result: ${resultContent.map(this.extractTextFromItem.bind(this)).join(' ')}]`;
      }
      return '[Result]';
    }
    return '';
  }

  /**
   * Get default pricing
   *
   * @returns Default pricing
   */
  private getDefaultPricing(): TokenPricing {
    return {
      inputPrice: 0.15, // $0.15 per 1M tokens
      outputPrice: 0.6, // $0.60 per 1M tokens
      currency: 'USD',
    };
  }
}

/**
 * Token budget class
 */
export class TokenBudget {
  private logger: ContextLogger;
  private config: TokenBudgetConfig;
  private used: number;

  constructor(config: TokenBudgetConfig, logger?: ContextLogger) {
    this.config = config;
    this.logger = logger ?? createLogger('TokenBudget');
    this.used = 0;
    this.logger.debug('Token budget initialized', { config } as Record<string, unknown>);
  }

  /**
   * Add tokens to used count
   *
   * @param tokens - Number of tokens to add
   */
  addTokens(tokens: number): void {
    this.used += tokens;
    this.logger.debug('Tokens added to budget', {
      tokens,
      totalUsed: this.used,
    } as Record<string, unknown>);

    if (this.isOverBudget()) {
      this.logger.warn('Token budget exceeded', {
        used: this.used,
        limit: this.config.limit,
      } as Record<string, unknown>);
    }
  }

  /**
   * Get remaining tokens
   *
   * @returns Remaining tokens
   */
  getRemaining(): number {
    return Math.max(0, this.config.limit - this.used);
  }

  /**
   * Get used tokens
   *
   * @returns Used tokens
   */
  getUsed(): number {
    return this.used;
  }

  /**
   * Check if budget is exceeded
   *
   * @returns True if exceeded
   */
  isOverBudget(): boolean {
    return this.used > this.config.limit;
  }

  /**
   * Check if budget is near limit
   *
   * @param threshold - Threshold percentage (default 0.9)
   * @returns True if near limit
   */
  isNearLimit(threshold: number = 0.9): boolean {
    return this.used >= this.config.limit * threshold;
  }

  /**
   * Get budget status
   *
   * @returns Budget status
   */
  getStatus(): {
    used: number;
    remaining: number;
    percentUsed: number;
    isNearLimit: boolean;
    isOverBudget: boolean;
  } {
    const used = this.used;
    const remaining = this.getRemaining();
    const percentUsed = used / this.config.limit;

    return {
      used,
      remaining,
      percentUsed,
      isNearLimit: this.isNearLimit(),
      isOverBudget: this.isOverBudget(),
    };
  }

  /**
   * Reset budget
   */
  reset(): void {
    this.used = 0;
    this.logger.info('Token budget reset', {} as Record<string, unknown>);
  }

  /**
   * Get configuration
   *
   * @returns Configuration
   */
  getConfig(): TokenBudgetConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   *
   * @param config - New configuration
   */
  updateConfig(config: Partial<TokenBudgetConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.debug('Token budget config updated', { config } as Record<string, unknown>);
  }
}

/**
 * Token tracker class for global tracking
 */
export class TokenTracker {
  private logger: ContextLogger;
  private usage: TokenUsage;
  private sessionUsage: Map<string, number>;

  constructor(logger?: ContextLogger) {
    this.logger = logger ?? createLogger('TokenTracker');
    this.usage = {
      totalTokens: 0,
      totalCost: 0,
      sessions: 0,
    };
    this.sessionUsage = new Map();
    this.logger.debug('Token tracker initialized', {} as Record<string, unknown>);
  }

  /**
   * Track token usage
   *
   * @param tokens - Number of tokens used
   * @param sessionId - Session ID (optional)
   * @param cost - Cost in USD (optional)
   */
  trackUsage(tokens: number, sessionId?: string, cost?: number): void {
    this.usage.totalTokens += tokens;
    this.usage.sessions += 1;

    if (cost !== undefined) {
      this.usage.totalCost += cost;
    }

    if (sessionId) {
      const current = this.sessionUsage.get(sessionId) ?? 0;
      this.sessionUsage.set(sessionId, current + tokens);
    }

    this.logger.debug('Token usage tracked', {
      tokens,
      sessionId,
      cost,
      totalTokens: this.usage.totalTokens,
    } as Record<string, unknown>);
  }

  /**
   * Get total usage
   *
   * @returns Total usage
   */
  getTotalUsage(): TokenUsage {
    return { ...this.usage };
  }

  /**
   * Get session usage
   *
   * @param sessionId - Session ID
   * @returns Session token count
   */
  getSessionUsage(sessionId: string): number {
    return this.sessionUsage.get(sessionId) ?? 0;
  }

  /**
   * Get all session usage
   *
   * @returns Map of session ID to token count
   */
  getAllSessionUsage(): Map<string, number> {
    return new Map(this.sessionUsage);
  }

  /**
   * Reset all tracking
   */
  reset(): void {
    this.usage = {
      totalTokens: 0,
      totalCost: 0,
      sessions: 0,
    };
    this.sessionUsage.clear();
    this.logger.info('Token tracker reset', {} as Record<string, unknown>);
  }

  /**
   * Reset session tracking
   *
   * @param sessionId - Session ID to reset
   */
  resetSession(sessionId: string): void {
    this.sessionUsage.delete(sessionId);
    this.logger.debug('Session token tracking reset', {
      sessionId,
    } as Record<string, unknown>);
  }

  /**
   * Get usage summary
   *
   * @returns Usage summary
   */
  getSummary(): {
    totalTokens: number;
    totalCost: number;
    totalSessions: number;
    averageTokensPerSession: number;
    topSessions: Array<{ sessionId: string; tokens: number }>;
  } {
    const totalTokens = this.usage.totalTokens;
    const totalSessions = this.usage.sessions;
    const averageTokensPerSession = totalSessions > 0 ? totalTokens / totalSessions : 0;

    // Get top 5 sessions by token usage
    const sortedSessions = Array.from(this.sessionUsage.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([sessionId, tokens]) => ({ sessionId, tokens }));

    return {
      totalTokens,
      totalCost: this.usage.totalCost,
      totalSessions,
      averageTokensPerSession,
      topSessions: sortedSessions,
    };
  }
}

/**
 * Create a token counter with default configuration
 *
 * @param method - Counting method
 * @param pricing - Token pricing
 * @returns New token counter
 */
export function createTokenCounter(
  method?: TokenCountMethod,
  pricing?: TokenPricing
): TokenCounter {
  return new TokenCounter(method, pricing);
}

/**
 * Create a token budget with default configuration
 *
 * @param limit - Token limit
 * @returns New token budget
 */
export function createTokenBudget(limit: number = 1000000): TokenBudget {
  const config: TokenBudgetConfig = {
    limit,
    alertThreshold: 0.9,
  };

  return new TokenBudget(config);
}

/**
 * Create a token tracker
 *
 * @returns New token tracker
 */
export function createTokenTracker(): TokenTracker {
  return new TokenTracker();
}
