/**
 * Context Condensation for KOMPLETE-KONTROL CLI
 *
 * Provides context condensation patterns for managing
 * context window size through various strategies.
 */

import { createLogger, type ContextLogger } from '../../utils/logger';
import type {
  ContextMessage,
  CondensationStrategy,
  CondensationConfig,
  MessageContent,
  TextContent,
} from '../../types';

/**
 * Context condenser class
 */
export class ContextCondenser {
  private logger: ContextLogger;
  private config: CondensationConfig;

  constructor(config: CondensationConfig, logger?: ContextLogger) {
    this.config = config;
    this.logger = logger ?? createLogger('ContextCondenser');
    this.logger.debug('Context condenser initialized', { config } as Record<string, unknown>);
  }

  /**
   * Condense context window using configured strategy
   *
   * @param messages - Messages to condense
   * @param targetSize - Target size in tokens
   * @returns Condensed messages
   */
  condense(messages: ContextMessage[], targetSize: number): ContextMessage[] {
    this.logger.info('Condensing context', {
      currentSize: this.calculateTotalTokens(messages),
      targetSize,
      strategy: this.config.strategy,
    } as Record<string, unknown>);

    switch (this.config.strategy) {
      case 'fifo':
        return this.condenseFIFO(messages, targetSize);
      case 'priority':
        return this.condensePriority(messages, targetSize);
      case 'summarize':
        return this.condenseSummarize(messages, targetSize);
      case 'hybrid':
        return this.condenseHybrid(messages, targetSize);
      default:
        this.logger.warn('Unknown condensation strategy, using FIFO', {
          strategy: this.config.strategy,
        } as Record<string, unknown>);
        return this.condenseFIFO(messages, targetSize);
    }
  }

  /**
   * Condense using FIFO (First In, First Out)
   *
   * @param messages - Messages to condense
   * @param targetSize - Target size in tokens
   * @returns Condensed messages
   */
  private condenseFIFO(messages: ContextMessage[], targetSize: number): ContextMessage[] {
    let currentSize = this.calculateTotalTokens(messages);
    const result = [...messages];

    while (currentSize > targetSize && result.length > 0) {
      const removed = result.shift();
      if (removed) {
        currentSize -= removed.tokens ?? 0;
      }
    }

    this.logger.debug('FIFO condensation complete', {
      originalCount: messages.length,
      newCount: result.length,
      originalSize: this.calculateTotalTokens(messages),
      newSize: currentSize,
    } as Record<string, unknown>);

    return result;
  }

  /**
   * Condense using priority-based strategy
   *
   * @param messages - Messages to condense
   * @param targetSize - Target size in tokens
   * @returns Condensed messages
   */
  private condensePriority(messages: ContextMessage[], targetSize: number): ContextMessage[] {
    // Sort messages by priority (higher priority first)
    const sorted = [...messages].sort((a, b) => {
      const aPriority = a.priority ?? 0;
      const bPriority = b.priority ?? 0;
      return bPriority - aPriority;
    });

    let currentSize = this.calculateTotalTokens(sorted);
    const result: ContextMessage[] = [];

    for (const message of sorted) {
      if (currentSize + (message.tokens ?? 0) <= targetSize) {
        result.push(message);
        currentSize += message.tokens ?? 0;
      }
    }

    this.logger.debug('Priority condensation complete', {
      originalCount: messages.length,
      newCount: result.length,
      originalSize: this.calculateTotalTokens(messages),
      newSize: this.calculateTotalTokens(result),
    } as Record<string, unknown>);

    return result;
  }

  /**
   * Condense using summarization
   *
   * @param messages - Messages to condense
   * @param targetSize - Target size in tokens
   * @returns Condensed messages
   */
  private condenseSummarize(messages: ContextMessage[], targetSize: number): ContextMessage[] {
    const result = [...messages];
    let currentSize = this.calculateTotalTokens(messages);

    // Keep removing oldest messages until we fit
    while (currentSize > targetSize && result.length > 0) {
      const oldest = result.shift();
      if (oldest) {
        currentSize -= oldest.tokens ?? 0;

        // Create a summary message
        const summary = this.createSummary(oldest);
        const summarySize = Math.ceil(summary.length / 4);
        
        if (currentSize + summarySize <= targetSize) {
          const textContent: TextContent = { type: 'text', text: summary };
          const summaryMessage: ContextMessage = {
            id: this.generateMessageId(),
            role: 'system',
            content: textContent,
            timestamp: new Date(),
            tokens: summarySize,
            priority: this.config.summaryPriority ?? 5,
          };

          result.unshift(summaryMessage);
          currentSize += summarySize;
        }
      }
    }

    this.logger.debug('Summarization condensation complete', {
      originalCount: messages.length,
      newCount: result.length,
      originalSize: this.calculateTotalTokens(messages),
      newSize: currentSize,
    } as Record<string, unknown>);

    return result;
  }

  /**
   * Condense using hybrid strategy
   *
   * @param messages - Messages to condense
   * @param targetSize - Target size in tokens
   * @returns Condensed messages
   */
  private condenseHybrid(messages: ContextMessage[], targetSize: number): ContextMessage[] {
    // First, remove low-priority messages
    const filtered = messages.filter(m => {
      const priority = m.priority ?? 0;
      return priority >= (this.config.minPriority ?? 0);
    });

    let currentSize = this.calculateTotalTokens(filtered);
    const result: ContextMessage[] = [];

    // Add messages in priority order
    const sorted = [...filtered].sort((a, b) => {
      const aPriority = a.priority ?? 0;
      const bPriority = b.priority ?? 0;
      return bPriority - aPriority;
    });

    for (const message of sorted) {
      if (currentSize + (message.tokens ?? 0) <= targetSize) {
        result.push(message);
        currentSize += message.tokens ?? 0;
      } else {
        // Try to summarize instead
        const summary = this.createSummary(message);
        const summarySize = Math.ceil(summary.length / 4);
        
        if (currentSize + summarySize <= targetSize) {
          const textContent: TextContent = { type: 'text', text: summary };
          const summaryMessage: ContextMessage = {
            id: this.generateMessageId(),
            role: 'system',
            content: textContent,
            timestamp: new Date(),
            tokens: summarySize,
            priority: this.config.summaryPriority ?? 5,
          };

          result.push(summaryMessage);
          currentSize += summarySize;
        }
      }
    }

    this.logger.debug('Hybrid condensation complete', {
      originalCount: messages.length,
      newCount: result.length,
      originalSize: this.calculateTotalTokens(messages),
      newSize: currentSize,
    } as Record<string, unknown>);

    return result;
  }

  /**
   * Create a summary of a message
   *
   * @param message - Message to summarize
   * @returns Summary text
   */
  private createSummary(message: ContextMessage): string {
    const text = this.extractTextFromMessage(message);
    const maxLength = this.config.summaryMaxLength ?? 200;

    if (text.length <= maxLength) {
      return `[Summary: ${text}]`;
    }

    return `[Summary: ${text.substring(0, maxLength)}...]`;
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
   * Estimate tokens for a message
   *
   * @param message - Message to estimate
   * @returns Estimated token count
   */
  private estimateTokens(message: { content: MessageContent | MessageContent[] }): number {
    const text = this.extractTextFromContent(message.content);
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate total tokens for messages
   *
   * @param messages - Messages to calculate
   * @returns Total token count
   */
  private calculateTotalTokens(messages: ContextMessage[]): number {
    return messages.reduce((sum, m) => sum + (m.tokens ?? 0), 0);
  }

  /**
   * Generate a unique message ID
   *
   * @returns Message ID
   */
  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Check if a message should be preserved during condensation
   *
   * @param message - Message to check
   * @returns True if should be preserved
   */
  shouldPreserve(message: ContextMessage): boolean {
    // Always preserve system messages
    if (message.role === 'system') {
      return true;
    }

    // Preserve high-priority messages
    const priority = message.priority ?? 0;
    if (priority >= (this.config.preservePriority ?? 10)) {
      return true;
    }

    // Preserve recent messages
    if (message.timestamp) {
      const age = Date.now() - message.timestamp.getTime();
      if (age < (this.config.preserveRecentMs ?? 60000)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Update configuration
   *
   * @param config - New configuration
   */
  updateConfig(config: Partial<CondensationConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.debug('Context condenser config updated', { config } as Record<string, unknown>);
  }

  /**
   * Get configuration
   *
   * @returns Configuration
   */
  getConfig(): CondensationConfig {
    return { ...this.config };
  }
}

/**
 * Create context condenser with default configuration
 *
 * @param strategy - Condensation strategy
 * @returns New context condenser
 */
export function createContextCondenser(
  strategy: CondensationStrategy = 'fifo'
): ContextCondenser {
  const config: CondensationConfig = {
    strategy,
    targetSize: 100000,
    preserveToolUse: true,
    priorityKeywords: [],
    summaryPriority: 5,
    minPriority: 0,
    preservePriority: 10,
    preserveRecentMs: 60000,
    summaryMaxLength: 200,
  };

  return new ContextCondenser(config);
}
