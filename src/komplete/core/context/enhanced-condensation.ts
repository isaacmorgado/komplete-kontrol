/**
 * Enhanced Context Condensation for KOMPLETE-KONTROL CLI
 *
 * Provides advanced context condensation patterns including:
 * - Abstract condenser base class
 * - Token-based condensation
 * - Semantic condensation
 */

import { createLogger, type ContextLogger } from '../../utils/logger';
import type {
  ContextMessage,
  CondensationConfig,
  ICondenser,
  TokenBasedConfig,
  SemanticConfig,
  MessageContent,
  TextContent,
  CondensationResult,
} from '../../types';

// Re-export CondensationResult for backwards compatibility
export type { CondensationResult } from '../../types';

/**
 * Abstract condenser base class
 * All condensers should extend this class
 */
export abstract class BaseCondenser implements ICondenser {
  protected logger: ContextLogger;
  protected config: CondensationConfig;

  constructor(config: CondensationConfig, logger?: ContextLogger) {
    this.config = config;
    this.logger = logger ?? createLogger(this.constructor.name);
    this.logger.debug('Condenser initialized', { config } as Record<string, unknown>);
  }

  /**
   * Condense context window using configured strategy
   * Must be implemented by subclasses
   *
   * @param messages - Messages to condense
   * @param targetSize - Target size in tokens
   * @returns Condensation result
   */
  abstract condense(messages: ContextMessage[], targetSize: number): CondensationResult;

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
    this.logger.debug('Condenser config updated', { config } as Record<string, unknown>);
  }

  /**
   * Get configuration
   *
   * @returns Configuration
   */
  getConfig(): CondensationConfig {
    return { ...this.config };
  }

  /**
   * Calculate total tokens for messages
   *
   * @param messages - Messages to calculate
   * @returns Total token count
   */
  protected calculateTotalTokens(messages: ContextMessage[]): number {
    return messages.reduce((sum, m) => sum + (m.tokens ?? 0), 0);
  }

  /**
   * Extract text from a message
   *
   * @param message - Message to extract text from
   * @returns Extracted text
   */
  protected extractTextFromMessage(message: ContextMessage): string {
    const content = message.content;
    return this.extractTextFromContent(content);
  }

  /**
   * Extract text from message content
   *
   * @param content - Message content
   * @returns Extracted text
   */
  protected extractTextFromContent(content: MessageContent | MessageContent[]): string {
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
  protected extractTextFromItem(item: MessageContent): string {
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
   * Estimate tokens for text
   *
   * @param text - Text to estimate
   * @returns Estimated token count
   */
  protected estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Generate a unique message ID
   *
   * @returns Message ID
   */
  protected generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

/**
 * Token-based condenser
 * Condenses context based on token counts and message age
 */
export class TokenBasedCondenser extends BaseCondenser {
  private tokenConfig: TokenBasedConfig;

  constructor(config: TokenBasedConfig, logger?: ContextLogger) {
    super(config, logger);
    this.tokenConfig = config;
  }

  /**
   * Condense using token-based strategy
   *
   * @param messages - Messages to condense
   * @param targetSize - Target size in tokens
   * @returns Condensation result
   */
  condense(messages: ContextMessage[], targetSize: number): CondensationResult {
    this.logger.info('Token-based condensation', {
      currentSize: this.calculateTotalTokens(messages),
      targetSize,
      preferRecent: this.tokenConfig.preferRecent,
      recentWindowMs: this.tokenConfig.recentWindowMs,
    } as Record<string, unknown>);

    const result: ContextMessage[] = [];
    let currentSize = 0;

    // Sort messages based on configuration
    const sorted = this.sortMessages(messages);

    for (const message of sorted) {
      const messageTokens = message.tokens ?? this.estimateTokens(this.extractTextFromMessage(message));
      const minTokens = this.tokenConfig.minTokensPerMessage ?? 0;
      const maxTokens = this.tokenConfig.maxTokensPerMessage ?? Infinity;

      // Skip if message is too small or too large
      if (messageTokens < minTokens || messageTokens > maxTokens) {
        // Try to summarize instead
        const summary = this.createSummary(message);
        const summarySize = this.estimateTokens(summary);

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
        continue;
      }

      // Add message if it fits
      if (currentSize + messageTokens <= targetSize) {
        result.push(message);
        currentSize += messageTokens;
      } else if (this.shouldPreserve(message)) {
        // Force add preserved messages
        result.push(message);
        currentSize += messageTokens;
      }
    }

    const originalSize = this.calculateTotalTokens(messages);

    this.logger.debug('Token-based condensation complete', {
      originalCount: messages.length,
      newCount: result.length,
      originalSize,
      newSize: currentSize,
    } as Record<string, unknown>);

    return {
      messages: result,
      originalCount: messages.length,
      newCount: result.length,
      originalSize,
      newSize: currentSize,
      tokensRemoved: originalSize - currentSize,
    };
  }

  /**
   * Sort messages based on configuration
   *
   * @param messages - Messages to sort
   * @returns Sorted messages
   */
  private sortMessages(messages: ContextMessage[]): ContextMessage[] {
    if (this.tokenConfig.preferRecent) {
      return [...messages].sort((a, b) => {
        const aTime = a.timestamp?.getTime() ?? 0;
        const bTime = b.timestamp?.getTime() ?? 0;
        return bTime - aTime;
      });
    }

    return [...messages].sort((a, b) => {
      const aPriority = a.priority ?? 0;
      const bPriority = b.priority ?? 0;
      return bPriority - aPriority;
    });
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
}

/**
 * Semantic condenser
 * Condenses context based on semantic similarity and clustering
 */
export class SemanticCondenser extends BaseCondenser {
  private semanticConfig: SemanticConfig;
  private messageEmbeddings: Map<string, number[]> = new Map();
  private embeddingCache: Map<string, number[]> = new Map();

  constructor(config: SemanticConfig, logger?: ContextLogger) {
    super(config, logger);
    this.semanticConfig = config;
  }

  /**
   * Condense using semantic strategy
   *
   * @param messages - Messages to condense
   * @param targetSize - Target size in tokens
   * @returns Condensation result
   */
  condense(messages: ContextMessage[], targetSize: number): CondensationResult {
    this.logger.info('Semantic condensation', {
      currentSize: this.calculateTotalTokens(messages),
      targetSize,
      similarityThreshold: this.semanticConfig.similarityThreshold,
      clusterSize: this.semanticConfig.clusterSize,
    } as Record<string, unknown>);

    // Calculate embeddings for all messages
    this.calculateEmbeddings(messages);

    // Cluster messages by similarity
    const clusters = this.clusterMessages(messages);

    // Select messages from clusters to fit target size
    const result = this.selectFromClusters(clusters, targetSize);

    const originalSize = this.calculateTotalTokens(messages);
    const newSize = this.calculateTotalTokens(result);

    this.logger.debug('Semantic condensation complete', {
      originalCount: messages.length,
      newCount: result.length,
      clusterCount: clusters.length,
      originalSize,
      newSize,
    } as Record<string, unknown>);

    return {
      messages: result,
      originalCount: messages.length,
      newCount: result.length,
      originalSize,
      newSize,
      tokensRemoved: originalSize - newSize,
      clusters,
    };
  }

  /**
   * Generate embeddings for messages (public method for testing)
   *
   * @param messages - Messages to generate embeddings for
   * @returns Array of embeddings
   */
  generateEmbeddings(messages: ContextMessage[]): number[][] {
    this.calculateEmbeddings(messages);
    const embeddings: number[][] = [];
    for (const message of messages) {
      const embedding = this.messageEmbeddings.get(message.id);
      if (embedding) {
        embeddings.push(embedding);
      }
    }
    return embeddings;
  }

  /**
   * Calculate embeddings for messages
   *
   * @param messages - Messages to calculate embeddings for
   */
  private calculateEmbeddings(messages: ContextMessage[]): void {
    for (const message of messages) {
      const text = this.extractTextFromMessage(message);

      // Check cache first
      if (this.embeddingCache.has(text)) {
        this.messageEmbeddings.set(message.id, this.embeddingCache.get(text)!);
        continue;
      }

      // Calculate simple embedding (in production, use actual embedding model)
      const embedding = this.calculateSimpleEmbedding(text);
      this.embeddingCache.set(text, embedding);
      this.messageEmbeddings.set(message.id, embedding);
    }
  }

  /**
   * Calculate simple embedding for text
   * In production, this would use an actual embedding model
   *
   * @param text - Text to embed
   * @returns Embedding vector
   */
  private calculateSimpleEmbedding(text: string): number[] {
    // Simple hash-based embedding for demonstration
    const embedding: number[] = [];
    const dimensions = 128;

    for (let i = 0; i < dimensions; i++) {
      const charCode = text.charCodeAt(i % text.length) || 0;
      embedding.push((charCode * (i + 1)) % 100 / 100);
    }

    return embedding;
  }

  /**
   * Cluster messages by similarity
   *
   * @param messages - Messages to cluster
   * @returns Clusters of messages
   */
  private clusterMessages(messages: ContextMessage[]): ContextMessage[][] {
    const clusters: ContextMessage[][] = [];
    const visited = new Set<string>();

    for (const message of messages) {
      if (visited.has(message.id)) {
        continue;
      }

      const cluster = this.findSimilarMessages(message, messages, visited);
      clusters.push(cluster);
    }

    return clusters;
  }

  /**
   * Find messages similar to a given message
   *
   * @param message - Message to find similar messages for
   * @param messages - All messages
   * @param visited - Visited messages set
   * @returns Cluster of similar messages
   */
  private findSimilarMessages(
    message: ContextMessage,
    messages: ContextMessage[],
    visited: Set<string>
  ): ContextMessage[] {
    const cluster: ContextMessage[] = [message];
    visited.add(message.id);

    const embedding = this.messageEmbeddings.get(message.id);
    if (!embedding) {
      return cluster;
    }

    for (const other of messages) {
      if (visited.has(other.id)) {
        continue;
      }

      const otherEmbedding = this.messageEmbeddings.get(other.id);
      if (!otherEmbedding) {
        continue;
      }

      const similarity = this.calculateCosineSimilarity(embedding, otherEmbedding);

      if (similarity >= this.semanticConfig.similarityThreshold) {
        cluster.push(other);
        visited.add(other.id);
      }
    }

    // Limit cluster size
    return cluster.slice(0, this.semanticConfig.clusterSize);
  }

  /**
   * Calculate cosine similarity between two embeddings
   *
   * @param a - First embedding
   * @param b - Second embedding
   * @returns Similarity score
   */
  private calculateCosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      return 0;
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Select messages from clusters to fit target size
   *
   * @param clusters - Clusters to select from
   * @param targetSize - Target size in tokens
   * @returns Selected messages
   */
  private selectFromClusters(clusters: ContextMessage[][], targetSize: number): ContextMessage[] {
    const result: ContextMessage[] = [];
    let currentSize = 0;

    // Sort clusters by priority (preserve important clusters first)
    clusters.sort((a, b) => {
      const aMaxPriority = Math.max(...a.map(m => m.priority ?? 0));
      const bMaxPriority = Math.max(...b.map(m => m.priority ?? 0));
      return bMaxPriority - aMaxPriority;
    });

    for (const cluster of clusters) {
      // Select representative from cluster
      const representative = this.selectRepresentative(cluster);

      if (this.shouldPreserve(representative)) {
        result.push(representative);
        currentSize += representative.tokens ?? 0;
      } else if (currentSize + (representative.tokens ?? 0) <= targetSize) {
        result.push(representative);
        currentSize += representative.tokens ?? 0;
      } else {
        // Try to summarize instead
        const summary = this.createSummary(representative);
        const summarySize = this.estimateTokens(summary);

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

      if (currentSize >= targetSize) {
        break;
      }
    }

    return result;
  }

  /**
   * Select representative message from cluster
   *
   * @param cluster - Cluster to select from
   * @returns Representative message
   */
  private selectRepresentative(cluster: ContextMessage[]): ContextMessage {
    // Prefer preserved messages
    const preserved = cluster.find(m => this.shouldPreserve(m));
    if (preserved) {
      return preserved;
    }

    // Prefer messages with key keywords
    const keywords = this.semanticConfig.keyMessageKeywords ?? [];
    for (const keyword of keywords) {
      const message = cluster.find(m => {
        const text = this.extractTextFromMessage(m);
        return text.toLowerCase().includes(keyword.toLowerCase());
      });
      if (message) {
        return message;
      }
    }

    // Return highest priority message
    return cluster.reduce((best, current) => {
      const bestPriority = best.priority ?? 0;
      const currentPriority = current.priority ?? 0;
      return currentPriority > bestPriority ? current : best;
    });
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
   * Clear embedding cache
   */
  clearCache(): void {
    this.messageEmbeddings.clear();
    this.embeddingCache.clear();
    this.logger.debug('Embedding cache cleared');
  }
}

/**
 * Create token-based condenser
 *
 * @param config - Token-based condenser configuration
 * @returns New token-based condenser
 */
export function createTokenBasedCondenser(
  config: Partial<TokenBasedConfig> = {}
): TokenBasedCondenser {
  const fullConfig: TokenBasedConfig = {
    strategy: 'token-based',
    targetSize: 100000,
    preserveToolUse: true,
    priorityKeywords: [],
    minTokensPerMessage: 10,
    maxTokensPerMessage: 10000,
    preferRecent: true,
    recentWindowMs: 300000,
    ...config,
  };

  return new TokenBasedCondenser(fullConfig);
}

/**
 * Create semantic condenser
 *
 * @param config - Semantic condenser configuration
 * @returns New semantic condenser
 */
export function createSemanticCondenser(
  config: Partial<SemanticConfig> = {}
): SemanticCondenser {
  const fullConfig: SemanticConfig = {
    strategy: 'semantic',
    targetSize: 100000,
    preserveToolUse: true,
    priorityKeywords: [],
    embeddingModel: 'text-embedding-ada-002',
    similarityThreshold: 0.7,
    clusterSize: 5,
    preserveKeyMessages: true,
    keyMessageKeywords: ['error', 'warning', 'important', 'critical'],
    ...config,
  };

  return new SemanticCondenser(fullConfig);
}
