/**
 * Session Memory Manager
 *
 * Integrates RRF memory with checkpoint/restore capabilities.
 * Provides high-level API for managing conversation memory across sessions.
 *
 * Based on ARCHITECTURE-SYNTHESIS-ENHANCED.md: Four-Layer Memory System
 */

import type { Message } from '../../types';
import { RRFMemory, type MemoryEntry, type SearchResult, type RRFConfig } from './rrf-memory';
import { CheckpointManager, type CheckpointConfig, type CheckpointMetadata } from './checkpoint';
import { Logger, LoggerLike } from '../../utils/logger';

/**
 * Session memory configuration
 */
export interface SessionMemoryConfig {
  sessionId: string;
  gitBranch?: string;
  maxEntries?: number;
  autoCheckpoint?: boolean;
  checkpointInterval?: number; // Number of entries between auto-checkpoints
  rrfConfig?: Partial<RRFConfig>;
  checkpointConfig?: Partial<CheckpointConfig>;
}

/**
 * Memory layer types
 */
export enum MemoryLayer {
  WORKING = 'working', // Current session context
  EPISODIC = 'episodic', // Past experiences
  SEMANTIC = 'semantic', // Facts and patterns
  REFLECTION = 'reflection', // Meta-insights
}

/**
 * Session Memory Manager
 *
 * Provides unified API for managing conversation memory with:
 * - 4-signal RRF search
 * - Checkpoint/restore
 * - Per-session isolation
 * - Auto-checkpointing
 */
export class SessionMemoryManager {
  private logger: LoggerLike;
  private config: Required<Omit<SessionMemoryConfig, 'rrfConfig' | 'checkpointConfig' | 'gitBranch'>> & {
    gitBranch?: string;
  };
  private memory: RRFMemory;
  private checkpointManager: CheckpointManager;
  private entriesSinceCheckpoint: number = 0;

  constructor(config: SessionMemoryConfig, logger?: LoggerLike) {
    this.logger = logger ?? new Logger().child('SessionMemoryManager');

    this.config = {
      sessionId: config.sessionId,
      gitBranch: config.gitBranch,
      maxEntries: config.maxEntries ?? 1000,
      autoCheckpoint: config.autoCheckpoint ?? true,
      checkpointInterval: config.checkpointInterval ?? 10,
    };

    this.memory = new RRFMemory(config.rrfConfig, this.logger);
    this.checkpointManager = new CheckpointManager(config.checkpointConfig, this.logger);

    this.logger.info('Session memory manager initialized', {
      sessionId: this.config.sessionId,
      gitBranch: this.config.gitBranch,
    });
  }

  /**
   * Add message to memory
   */
  async addMessage(
    message: Message,
    importance: number = 0.5,
    layer: MemoryLayer = MemoryLayer.WORKING
  ): Promise<string> {
    const content = this.extractMessageContent(message);

    const entryId = await this.memory.addEntry({
      content,
      timestamp: new Date(),
      importance,
      metadata: {
        role: message.role,
        layer,
        sessionId: this.config.sessionId,
        gitBranch: this.config.gitBranch,
      },
      tags: [layer, message.role],
    });

    this.entriesSinceCheckpoint++;

    // Auto-checkpoint if enabled
    if (
      this.config.autoCheckpoint &&
      this.entriesSinceCheckpoint >= this.config.checkpointInterval
    ) {
      await this.createCheckpoint(`Auto-checkpoint after ${this.entriesSinceCheckpoint} entries`);
      this.entriesSinceCheckpoint = 0;
    }

    return entryId;
  }

  /**
   * Add custom memory entry
   */
  async addEntry(
    content: string,
    importance: number = 0.5,
    layer: MemoryLayer = MemoryLayer.SEMANTIC,
    metadata?: Record<string, unknown>
  ): Promise<string> {
    const entryId = await this.memory.addEntry({
      content,
      timestamp: new Date(),
      importance,
      metadata: {
        ...metadata,
        layer,
        sessionId: this.config.sessionId,
        gitBranch: this.config.gitBranch,
      },
      tags: [layer],
    });

    this.entriesSinceCheckpoint++;

    return entryId;
  }

  /**
   * Search memory using 4-signal RRF
   */
  async search(
    query: string,
    options?: {
      limit?: number;
      layers?: MemoryLayer[];
      minImportance?: number;
    }
  ): Promise<SearchResult[]> {
    const limit = options?.limit ?? 10;
    let results = await this.memory.search(query, limit * 2); // Get extra for filtering

    // Filter by layer if specified
    if (options?.layers && options.layers.length > 0) {
      results = results.filter(r => {
        const layer = r.entry.metadata?.layer as MemoryLayer;
        return options.layers!.includes(layer);
      });
    }

    // Filter by importance if specified
    if (options?.minImportance !== undefined) {
      results = results.filter(r => r.entry.importance >= options.minImportance!);
    }

    return results.slice(0, limit);
  }

  /**
   * Get recent entries
   */
  getRecentEntries(limit: number = 10, layer?: MemoryLayer): MemoryEntry[] {
    const allEntries = this.memory.exportEntries();

    let filtered = allEntries;

    // Filter by layer if specified
    if (layer) {
      filtered = allEntries.filter(e => e.metadata?.layer === layer);
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return filtered.slice(0, limit);
  }

  /**
   * Get entries by layer
   */
  getEntriesByLayer(layer: MemoryLayer): MemoryEntry[] {
    const allEntries = this.memory.exportEntries();
    return allEntries.filter(e => e.metadata?.layer === layer);
  }

  /**
   * Create checkpoint
   */
  async createCheckpoint(description: string): Promise<string> {
    const entries = this.memory.exportEntries();
    const stats = this.memory.getStats();

    const checkpointId = await this.checkpointManager.createCheckpoint(
      entries,
      description,
      {
        gitBranch: this.config.gitBranch,
        sessionId: this.config.sessionId,
        config: {
          maxEntries: this.config.maxEntries,
          stats,
        },
      }
    );

    this.logger.info('Memory checkpoint created', {
      checkpointId,
      description,
      entryCount: entries.length,
    });

    return checkpointId;
  }

  /**
   * Restore from checkpoint
   */
  async restoreCheckpoint(checkpointId: string): Promise<void> {
    const checkpointData = await this.checkpointManager.restoreCheckpoint(checkpointId);

    // Clear current memory
    this.memory.clear();

    // Import checkpoint entries
    await this.memory.importEntries(checkpointData.entries);

    this.entriesSinceCheckpoint = 0;

    this.logger.info('Memory restored from checkpoint', {
      checkpointId,
      entryCount: checkpointData.entries.length,
    });
  }

  /**
   * List available checkpoints
   */
  async listCheckpoints(): Promise<CheckpointMetadata[]> {
    return await this.checkpointManager.listCheckpoints();
  }

  /**
   * Delete checkpoint
   */
  async deleteCheckpoint(checkpointId: string): Promise<void> {
    await this.checkpointManager.deleteCheckpoint(checkpointId);
  }

  /**
   * Clear all memory (working layer only by default)
   */
  clearMemory(layer?: MemoryLayer): void {
    if (!layer) {
      // Clear only working memory
      const allEntries = this.memory.exportEntries();
      const workingEntries = allEntries.filter(e => e.metadata?.layer === MemoryLayer.WORKING);

      for (const entry of workingEntries) {
        this.memory.removeEntry(entry.id);
      }

      this.logger.info('Working memory cleared', {
        entriesRemoved: workingEntries.length,
      });
    } else if (layer === MemoryLayer.WORKING) {
      // Clear only specified layer
      const allEntries = this.memory.exportEntries();
      const layerEntries = allEntries.filter(e => e.metadata?.layer === layer);

      for (const entry of layerEntries) {
        this.memory.removeEntry(entry.id);
      }

      this.logger.info(`${layer} memory cleared`, {
        entriesRemoved: layerEntries.length,
      });
    } else {
      // For non-working layers, require explicit confirmation
      this.logger.warn(`Clearing ${layer} memory requires explicit confirmation`, { layer });
    }

    this.entriesSinceCheckpoint = 0;
  }

  /**
   * Get memory statistics
   */
  getStats(): {
    memory: ReturnType<RRFMemory['getStats']>;
    session: {
      sessionId: string;
      gitBranch?: string;
      entriesSinceCheckpoint: number;
      maxEntries: number;
    };
  } {
    return {
      memory: this.memory.getStats(),
      session: {
        sessionId: this.config.sessionId,
        gitBranch: this.config.gitBranch,
        entriesSinceCheckpoint: this.entriesSinceCheckpoint,
        maxEntries: this.config.maxEntries,
      },
    };
  }

  /**
   * Export all memory entries
   */
  exportMemory(): MemoryEntry[] {
    return this.memory.exportEntries();
  }

  /**
   * Import memory entries
   */
  async importMemory(entries: MemoryEntry[]): Promise<void> {
    await this.memory.importEntries(entries);
    this.entriesSinceCheckpoint = 0;
  }

  /**
   * Extract content from message
   */
  private extractMessageContent(message: Message): string {
    if (Array.isArray(message.content)) {
      return message.content
        .map(c => {
          if (c.type === 'text') return c.text;
          if (c.type === 'tool_use') return `[Tool: ${c.name}]`;
          if (c.type === 'tool_result') return `[Tool Result]`;
          return '';
        })
        .filter(Boolean)
        .join('\n');
    }

    if (message.content.type === 'text') {
      return message.content.text;
    }

    if (message.content.type === 'tool_use') {
      return `[Tool: ${message.content.name}]`;
    }

    if (message.content.type === 'tool_result') {
      return `[Tool Result]`;
    }

    return '';
  }
}

/**
 * Create session memory manager
 */
export function createSessionMemory(
  config: SessionMemoryConfig,
  logger?: LoggerLike
): SessionMemoryManager {
  return new SessionMemoryManager(config, logger);
}
