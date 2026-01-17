/**
 * Context Window Management for KOMPLETE-KONTROL CLI
 *
 * Provides context window tracking with message management
 * for managing conversation context within token limits.
 */

import { createLogger, type ContextLogger } from '../../utils/logger';
import type {
  Message,
  MessageRole,
  MessageContent,
  ContextWindowConfig,
  ContextMessage,
} from '../../types';

/**
 * Context window class
 */
export class ContextWindow {
  private logger: ContextLogger;
  private config: ContextWindowConfig;
  private messages: ContextMessage[];
  private currentSize: number;

  constructor(config: ContextWindowConfig, logger?: ContextLogger) {
    this.config = config;
    this.logger = logger ?? createLogger('ContextWindow');
    this.messages = [];
    this.currentSize = 0;
    this.logger.debug('Context window initialized', { config } as Record<string, unknown>);
  }

  /**
   * Add a message to context window
   *
   * @param message - Message to add
   * @returns True if added, false if window is full
   */
  addMessage(message: Message): boolean {
    const tokenCount = this.estimateTokens(message);

    if (this.currentSize + tokenCount > this.config.maxTokens) {
      this.logger.warn('Context window full, cannot add message', {
        currentSize: this.currentSize,
        messageSize: tokenCount,
        maxSize: this.config.maxTokens,
      } as Record<string, unknown>);
      return false;
    }

    const contextMessage: ContextMessage = {
      id: this.generateMessageId(),
      role: message.role,
      content: message.content,
      timestamp: new Date(),
      tokens: tokenCount,
    };

    this.messages.push(contextMessage);
    this.currentSize += tokenCount;

    this.logger.debug('Message added to context window', {
        messageId: contextMessage.id,
        tokenCount,
        currentSize: this.currentSize,
      } as Record<string, unknown>);

    return true;
  }

  /**
   * Add multiple messages to context window
   *
   * @param messages - Messages to add
   * @returns Number of messages added
   */
  addMessages(messages: Message[]): number {
    let added = 0;

    for (const message of messages) {
      if (!this.addMessage(message)) {
        break;
      }
      added++;
    }

    this.logger.debug('Messages added to context window', {
      count: added,
      total: messages.length,
    } as Record<string, unknown>);

    return added;
  }

  /**
   * Remove a message from context window
   *
   * @param messageId - Message ID to remove
   * @returns True if removed, false if not found
   */
  removeMessage(messageId: string): boolean {
    const index = this.messages.findIndex(m => m.id === messageId);

    if (index === -1) {
      return false;
    }

    const message = this.messages[index];
    if (!message) {
      return false;
    }
    this.currentSize -= message.tokens ?? 0;
    this.messages.splice(index, 1);

    this.logger.debug('Message removed from context window', {
      messageId,
      currentSize: this.currentSize,
    } as Record<string, unknown>);

    return true;
  }

  /**
   * Remove messages from beginning of context window
   *
   * @param count - Number of messages to remove
   * @returns Number of messages removed
   */
  removeOldestMessages(count: number): number {
    const toRemove = Math.min(count, this.messages.length);
    const removed = this.messages.splice(0, toRemove);

    for (const message of removed) {
      this.currentSize -= message.tokens ?? 0;
    }

    this.logger.debug('Oldest messages removed from context window', {
      count: toRemove,
      currentSize: this.currentSize,
    } as Record<string, unknown>);

    return toRemove;
  }

  /**
   * Remove messages from end of context window
   *
   * @param count - Number of messages to remove
   * @returns Number of messages removed
   */
  removeNewestMessages(count: number): number {
    const toRemove = Math.min(count, this.messages.length);
    const removed = this.messages.splice(this.messages.length - toRemove, toRemove);

    for (const message of removed) {
      this.currentSize -= message.tokens ?? 0;
    }

    this.logger.debug('Newest messages removed from context window', {
      count: toRemove,
      currentSize: this.currentSize,
    } as Record<string, unknown>);

    return toRemove;
  }

  /**
   * Clear all messages from context window
   */
  clear(): void {
    this.messages = [];
    this.currentSize = 0;

    this.logger.debug('Context window cleared', {} as Record<string, unknown>);
  }

  /**
   * Get all messages in context window
   *
   * @returns Array of messages
   */
  getMessages(): Message[] {
    return this.messages.map(m => ({
      role: m.role as MessageRole,
      content: m.content,
    }));
  }

  /**
   * Get context messages with metadata
   *
   * @returns Array of context messages
   */
  getContextMessages(): ContextMessage[] {
    return [...this.messages];
  }

  /**
   * Get a message by ID
   *
   * @param messageId - Message ID
   * @returns Message or undefined
   */
  getMessage(messageId: string): Message | undefined {
    const contextMessage = this.messages.find(m => m.id === messageId);
    if (!contextMessage) {
      return undefined;
    }
    return {
      role: contextMessage.role as MessageRole,
      content: contextMessage.content,
    };
  }

  /**
   * Get current size of context window in tokens
   *
   * @returns Current size in tokens
   */
  getCurrentSize(): number {
    return this.currentSize;
  }

  /**
   * Get maximum size of context window in tokens
   *
   * @returns Maximum size in tokens
   */
  getMaxSize(): number {
    return this.config.maxTokens;
  }

  /**
   * Check if context window is full
   *
   * @returns True if full
   */
  isFull(): boolean {
    return this.currentSize >= this.config.maxTokens;
  }

  /**
   * Check if context window is near full
   *
   * @param threshold - Threshold percentage (default 0.9)
   * @returns True if near full
   */
  isNearFull(threshold: number = 0.9): boolean {
    return this.currentSize >= this.config.maxTokens * threshold;
  }

  /**
   * Get number of messages in context window
   *
   * @returns Number of messages
   */
  getMessageCount(): number {
    return this.messages.length;
  }

  /**
   * Get available space in context window
   *
   * @returns Available space in tokens
   */
  getAvailableSpace(): number {
    return this.config.maxTokens - this.currentSize;
  }

  /**
   * Get utilization percentage of context window
   *
   * @returns Utilization percentage (0-1)
   */
  getUtilization(): number {
    return this.currentSize / this.config.maxTokens;
  }

  /**
   * Get configuration of context window
   *
   * @returns Configuration
   */
  getConfig(): ContextWindowConfig {
    return { ...this.config };
  }

  /**
   * Update configuration of context window
   *
   * @param config - New configuration
   */
  updateConfig(config: Partial<ContextWindowConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.debug('Context window config updated', { config } as Record<string, unknown>);
  }

  /**
   * Estimate number of tokens in a message
   *
   * @param message - Message to estimate
   * @returns Estimated token count
   */
  private estimateTokens(message: Message): number {
    const text = this.extractTextFromContent(message.content);
    // Simple character-based estimation (approximately 4 chars per token)
    return Math.ceil(text.length / 4);
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
   * Generate a unique message ID
   *
   * @returns Message ID
   */
  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

/**
 * Create context window with default configuration
 *
 * @param config - Window configuration (partial, defaults will be provided)
 * @returns New context window
 */
export function createContextWindow(
  config: Partial<ContextWindowConfig> = { maxTokens: 200000 }
): ContextWindow {
  const fullConfig: ContextWindowConfig = {
    maxTokens: config.maxTokens ?? 200000,
    maxMessages: config.maxMessages ?? 100,
    preserveToolUse: config.preserveToolUse ?? true,
  };
  return new ContextWindow(fullConfig);
}
