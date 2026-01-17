/**
 * Multi-Session Context Sharing for KOMPLETE-KONTROL CLI
 *
 * Provides context sharing across multiple sessions including:
 * - Shared context storage
 * - Keyword-based sharing
 * - Relevance scoring
 * - TTL-based expiration
 */

import { createLogger, type ContextLogger } from '../../utils/logger';
import type {
  ContextMessage,
  ContextSharingConfig,
  SharedContextEntry,
  MessageContent,
} from '../../types';

/**
 * Multi-session context manager
 * Manages shared context across multiple sessions
 */
export class MultiSessionContextManager {
  private logger: ContextLogger;
  private config: ContextSharingConfig;
  private sharedContexts: Map<string, SharedContextEntry[]> = new Map();
  private cleanupInterval?: ReturnType<typeof setInterval>;

  constructor(config: ContextSharingConfig, logger?: ContextLogger) {
    this.config = config;
    this.logger = logger ?? createLogger('MultiSessionContextManager');
    this.logger.debug('Multi-session context manager initialized', { config } as Record<string, unknown>);

    // Start cleanup interval
    this.startCleanup();
  }

  /**
   * Share context from a session
   *
   * @param sessionId - Source session ID
   * @param message - Message to share
   * @param keywords - Keywords for the message
   * @returns Shared context entry ID
   */
  shareContext(
    sessionId: string,
    message: ContextMessage,
    keywords: string[] = []
  ): string {
    if (!this.config.enabled) {
      this.logger.debug('Context sharing disabled');
      return '';
    }

    const entry: SharedContextEntry = {
      id: this.generateEntryId(),
      sourceSessionId: sessionId,
      message: { ...message },
      relevanceScore: this.calculateInitialRelevance(message, keywords),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.config.sharedMessageTtl),
      keywords: this.extractKeywords(message, keywords),
    };

    // Add to session's shared contexts
    if (!this.sharedContexts.has(sessionId)) {
      this.sharedContexts.set(sessionId, []);
    }

    const contexts = this.sharedContexts.get(sessionId)!;
    contexts.push(entry);

    // Limit number of shared messages per session
    if (contexts.length > this.config.maxSharedMessages) {
      contexts.shift();
    }

    this.logger.debug('Context shared', {
      entryId: entry.id,
      sessionId,
      keywords: entry.keywords,
      expiresAt: entry.expiresAt,
    } as Record<string, unknown>);

    return entry.id;
  }

  /**
   * Get relevant shared contexts for a session
   *
   * @param sessionId - Target session ID
   * @param query - Query keywords
   * @param limit - Maximum number of entries to return
   * @returns Relevant shared contexts
   */
  getRelevantContexts(
    sessionId: string,
    query: string[] = [],
    limit: number = 10
  ): SharedContextEntry[] {
    if (!this.config.enabled) {
      return [];
    }

    this.logger.debug('Getting relevant contexts', {
      sessionId,
      query,
      limit,
    } as Record<string, unknown>);

    const relevant: SharedContextEntry[] = [];

    // Get all shared contexts from other sessions
    for (const [sourceSessionId, contexts] of this.sharedContexts.entries()) {
      // Skip same session
      if (sourceSessionId === sessionId) {
        continue;
      }

      for (const entry of contexts) {
        // Check if expired
        if (entry.expiresAt < new Date()) {
          continue;
        }

        // Calculate relevance
        const relevance = this.calculateRelevance(entry, query);

        if (relevance > 0) {
          relevant.push({ ...entry, relevanceScore: relevance });
        }
      }
    }

    // Sort by relevance and limit
    relevant.sort((a, b) => b.relevanceScore - a.relevanceScore);

    this.logger.debug('Relevant contexts found', {
      sessionId,
      count: relevant.length,
      limited: Math.min(relevant.length, limit),
    } as Record<string, unknown>);

    return relevant.slice(0, limit);
  }

  /**
   * Get shared contexts by session
   *
   * @param sessionId - Session ID
   * @returns Shared contexts for the session
   */
  getSessionSharedContexts(sessionId: string): SharedContextEntry[] {
    const contexts = this.sharedContexts.get(sessionId) ?? [];

    // Filter out expired entries
    const validContexts = contexts.filter(
      entry => entry.expiresAt >= new Date()
    );

    this.logger.debug('Session shared contexts retrieved', {
      sessionId,
      count: validContexts.length,
    } as Record<string, unknown>);

    return validContexts;
  }

  /**
   * Clear shared contexts for a session
   *
   * @param sessionId - Session ID to clear
   */
  clearSessionContexts(sessionId: string): void {
    this.sharedContexts.delete(sessionId);
    this.logger.debug('Session contexts cleared', { sessionId } as Record<string, unknown>);
  }

  /**
   * Clear all shared contexts
   */
  clearAllContexts(): void {
    this.sharedContexts.clear();
    this.logger.debug('All shared contexts cleared');
  }

  /**
   * Update configuration
   *
   * @param config - New configuration
   */
  updateConfig(config: Partial<ContextSharingConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.debug('Config updated', { config } as Record<string, unknown>);

    // Restart cleanup if TTL changed
    if (config.sharedMessageTtl !== undefined) {
      this.stopCleanup();
      this.startCleanup();
    }
  }

  /**
   * Get configuration
   *
   * @returns Configuration
   */
  getConfig(): ContextSharingConfig {
    return { ...this.config };
  }

  /**
   * Get statistics
   *
   * @returns Statistics
   */
  getStatistics(): {
    totalSessions: number;
    totalEntries: number;
    expiredEntries: number;
    averageRelevance: number;
  } {
    let totalEntries = 0;
    let expiredEntries = 0;
    let totalRelevance = 0;

    for (const contexts of this.sharedContexts.values()) {
      for (const entry of contexts) {
        totalEntries++;
        if (entry.expiresAt < new Date()) {
          expiredEntries++;
        }
        totalRelevance += entry.relevanceScore;
      }
    }

    return {
      totalSessions: this.sharedContexts.size,
      totalEntries,
      expiredEntries,
      averageRelevance: totalEntries > 0 ? totalRelevance / totalEntries : 0,
    };
  }

  /**
   * Start cleanup interval
   */
  private startCleanup(): void {
    // Clean up every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60000);

    this.logger.debug('Cleanup interval started');
  }

  /**
   * Stop cleanup interval
   */
  private stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
      this.logger.debug('Cleanup interval stopped');
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanupExpiredEntries(): void {
    let removedCount = 0;

    for (const [sessionId, contexts] of this.sharedContexts.entries()) {
      const validContexts = contexts.filter(
        entry => entry.expiresAt >= new Date()
      );
      removedCount += contexts.length - validContexts.length;

      if (validContexts.length === 0) {
        this.sharedContexts.delete(sessionId);
      } else {
        this.sharedContexts.set(sessionId, validContexts);
      }
    }

    if (removedCount > 0) {
      this.logger.debug('Expired entries cleaned up', {
        removedCount,
      } as Record<string, unknown>);
    }
  }

  /**
   * Calculate initial relevance for a message
   *
   * @param message - Message to calculate relevance for
   * @param keywords - Keywords
   * @returns Relevance score
   */
  private calculateInitialRelevance(
    message: ContextMessage,
    keywords: string[]
  ): number {
    let relevance = 0;

    // Check for share keywords
    for (const keyword of this.config.shareKeywords) {
      const text = this.extractTextFromMessage(message);
      if (text.toLowerCase().includes(keyword.toLowerCase())) {
        relevance += 10;
      }
    }

    // Check for provided keywords
    for (const keyword of keywords) {
      const text = this.extractTextFromMessage(message);
      if (text.toLowerCase().includes(keyword.toLowerCase())) {
        relevance += 5;
      }
    }

    // Boost for system messages
    if (message.role === 'system') {
      relevance += 5;
    }

    return relevance;
  }

  /**
   * Calculate relevance for an entry
   *
   * @param entry - Entry to calculate relevance for
   * @param query - Query keywords
   * @returns Relevance score
   */
  private calculateRelevance(
    entry: SharedContextEntry,
    query: string[]
  ): number {
    let relevance = entry.relevanceScore;

    // Decay over time
    const age = Date.now() - entry.createdAt.getTime();
    const decay = Math.max(0, 1 - age / (24 * 60 * 60 * 1000)); // Decay over 24 hours
    relevance *= decay;

    // Boost for matching query
    for (const keyword of query) {
      for (const entryKeyword of entry.keywords) {
        if (entryKeyword.toLowerCase().includes(keyword.toLowerCase())) {
          relevance += 5;
        }
      }
    }

    return relevance;
  }

  /**
   * Extract keywords from a message
   *
   * @param message - Message to extract keywords from
   * @param providedKeywords - Provided keywords
   * @returns Extracted keywords
   */
  private extractKeywords(
    message: ContextMessage,
    providedKeywords: string[]
  ): string[] {
    const keywords = new Set(providedKeywords);

    // Add share keywords from message
    for (const keyword of this.config.shareKeywords) {
      const text = this.extractTextFromMessage(message);
      if (text.toLowerCase().includes(keyword.toLowerCase())) {
        keywords.add(keyword);
      }
    }

    // Extract important words from message
    const text = this.extractTextFromMessage(message);
    const words = text.split(/\s+/);
    const importantWords = words.filter(word => {
      // Filter out common words and short words
      const commonWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'to', 'from', 'in', 'on', 'at', 'by', 'for', 'with', 'about', 'as', 'of', 'and', 'or', 'but', 'if', 'then', 'else', 'when', 'where', 'while', 'until'];
      return word.length > 3 && !commonWords.includes(word.toLowerCase());
    });

    // Add unique important words
    for (const word of importantWords.slice(0, 10)) {
      keywords.add(word.toLowerCase());
    }

    return Array.from(keywords);
  }

  /**
   * Extract text from a message
   *
   * @param message - Message to extract text from
   * @returns Extracted text
   */
  private extractTextFromMessage(message: ContextMessage): string {
    const content = message.content;
    return this.extractTextFromContent(content);
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
      return `[Tool: ${(item as { type: 'tool_use'; name: string; input: Record<string, unknown> }).name}]`;
    }
    if (item.type === 'tool_result') {
      const resultContent = (item as { type: 'tool_result'; content: unknown }).content;
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
   * Generate a unique entry ID
   *
   * @returns Entry ID
   */
  private generateEntryId(): string {
    return `shared-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Destroy the manager and cleanup resources
   */
  destroy(): void {
    this.stopCleanup();
    this.clearAllContexts();
    this.logger.debug('Multi-session context manager destroyed');
  }
}

/**
 * Create multi-session context manager
 *
 * @param config - Context sharing configuration
 * @returns New multi-session context manager
 */
export function createMultiSessionContextManager(
  config: Partial<ContextSharingConfig> = {}
): MultiSessionContextManager {
  const fullConfig: ContextSharingConfig = {
    enabled: true,
    shareAcrossSessions: true,
    shareKeywords: ['error', 'bug', 'fix', 'solution', 'important', 'critical'],
    maxSharedMessages: 100,
    sharedMessageTtl: 24 * 60 * 60 * 1000, // 24 hours
    ...config,
  };

  return new MultiSessionContextManager(fullConfig);
}
