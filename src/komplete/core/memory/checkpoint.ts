/**
 * Memory Checkpoint/Restore System
 *
 * Provides snapshot and restore capabilities for memory state.
 * Enables rolling back to previous states and saving progress.
 *
 * Based on ARCHITECTURE-SYNTHESIS-ENHANCED.md: Checkpoint/Restore System
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { MemoryEntry } from './rrf-memory';
import { Logger, LoggerLike } from '../../utils/logger';

/**
 * Checkpoint metadata
 */
export interface CheckpointMetadata {
  id: string;
  description: string;
  timestamp: Date;
  entryCount: number;
  gitBranch?: string;
  gitCommit?: string;
  sessionId?: string;
}

/**
 * Checkpoint data
 */
export interface CheckpointData {
  metadata: CheckpointMetadata;
  entries: MemoryEntry[];
  config?: Record<string, unknown>;
}

/**
 * Checkpoint configuration
 */
export interface CheckpointConfig {
  checkpointDir: string;
  maxCheckpoints: number;
  autoCleanup: boolean;
}

/**
 * Memory Checkpoint Manager
 *
 * Manages creating, listing, and restoring memory checkpoints.
 */
export class CheckpointManager {
  private logger: LoggerLike;
  private config: CheckpointConfig;

  constructor(config: Partial<CheckpointConfig> = {}, logger?: LoggerLike) {
    this.logger = logger ?? new Logger().child('CheckpointManager');

    this.config = {
      checkpointDir: config.checkpointDir ?? path.join(process.cwd(), '.komplete', 'checkpoints'),
      maxCheckpoints: config.maxCheckpoints ?? 10,
      autoCleanup: config.autoCleanup ?? true,
    };

    this.ensureCheckpointDir();

    this.logger.debug('Checkpoint manager initialized', { config: this.config });
  }

  /**
   * Create checkpoint from memory state
   */
  async createCheckpoint(
    entries: MemoryEntry[],
    description: string,
    metadata?: {
      gitBranch?: string;
      gitCommit?: string;
      sessionId?: string;
      config?: Record<string, unknown>;
    }
  ): Promise<string> {
    const checkpointId = this.generateCheckpointId();

    const checkpointData: CheckpointData = {
      metadata: {
        id: checkpointId,
        description,
        timestamp: new Date(),
        entryCount: entries.length,
        gitBranch: metadata?.gitBranch,
        gitCommit: metadata?.gitCommit,
        sessionId: metadata?.sessionId,
      },
      entries,
      config: metadata?.config,
    };

    // Save checkpoint
    const checkpointPath = this.getCheckpointPath(checkpointId);
    await fs.promises.mkdir(path.dirname(checkpointPath), { recursive: true });
    await fs.promises.writeFile(
      checkpointPath,
      JSON.stringify(checkpointData, null, 2),
      'utf-8'
    );

    this.logger.info('Checkpoint created', {
      id: checkpointId,
      description,
      entryCount: entries.length,
    });

    // Auto-cleanup if enabled
    if (this.config.autoCleanup) {
      await this.cleanupOldCheckpoints();
    }

    return checkpointId;
  }

  /**
   * Restore checkpoint
   */
  async restoreCheckpoint(checkpointId: string): Promise<CheckpointData> {
    const checkpointPath = this.getCheckpointPath(checkpointId);

    if (!fs.existsSync(checkpointPath)) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    const content = await fs.promises.readFile(checkpointPath, 'utf-8');
    const checkpointData: CheckpointData = JSON.parse(content);

    this.logger.info('Checkpoint restored', {
      id: checkpointId,
      entryCount: checkpointData.entries.length,
    });

    return checkpointData;
  }

  /**
   * List all checkpoints
   */
  async listCheckpoints(): Promise<CheckpointMetadata[]> {
    const checkpoints: CheckpointMetadata[] = [];

    if (!fs.existsSync(this.config.checkpointDir)) {
      return checkpoints;
    }

    const files = await fs.promises.readdir(this.config.checkpointDir);

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      try {
        const filePath = path.join(this.config.checkpointDir, file);
        const content = await fs.promises.readFile(filePath, 'utf-8');
        const data: CheckpointData = JSON.parse(content);
        checkpoints.push(data.metadata);
      } catch (error) {
        this.logger.warn('Failed to read checkpoint', { file, error });
      }
    }

    // Sort by timestamp (newest first)
    checkpoints.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return checkpoints;
  }

  /**
   * Delete checkpoint
   */
  async deleteCheckpoint(checkpointId: string): Promise<void> {
    const checkpointPath = this.getCheckpointPath(checkpointId);

    if (!fs.existsSync(checkpointPath)) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    await fs.promises.unlink(checkpointPath);

    this.logger.info('Checkpoint deleted', { id: checkpointId });
  }

  /**
   * Get checkpoint metadata
   */
  async getCheckpointMetadata(checkpointId: string): Promise<CheckpointMetadata> {
    const checkpointPath = this.getCheckpointPath(checkpointId);

    if (!fs.existsSync(checkpointPath)) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    const content = await fs.promises.readFile(checkpointPath, 'utf-8');
    const data: CheckpointData = JSON.parse(content);

    return data.metadata;
  }

  /**
   * Cleanup old checkpoints (keep only maxCheckpoints)
   */
  private async cleanupOldCheckpoints(): Promise<void> {
    const checkpoints = await this.listCheckpoints();

    if (checkpoints.length <= this.config.maxCheckpoints) {
      return;
    }

    const toDelete = checkpoints.slice(this.config.maxCheckpoints);

    for (const checkpoint of toDelete) {
      try {
        await this.deleteCheckpoint(checkpoint.id);
        this.logger.debug('Old checkpoint cleaned up', { id: checkpoint.id });
      } catch (error) {
        this.logger.warn('Failed to cleanup checkpoint', {
          id: checkpoint.id,
          error,
        });
      }
    }

    this.logger.info('Checkpoint cleanup complete', {
      deleted: toDelete.length,
      remaining: this.config.maxCheckpoints,
    });
  }

  /**
   * Get checkpoint file path
   */
  private getCheckpointPath(checkpointId: string): string {
    return path.join(this.config.checkpointDir, `${checkpointId}.json`);
  }

  /**
   * Generate checkpoint ID
   */
  private generateCheckpointId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 5);
    return `CP-${timestamp}-${random}`;
  }

  /**
   * Ensure checkpoint directory exists
   */
  private ensureCheckpointDir(): void {
    if (!fs.existsSync(this.config.checkpointDir)) {
      fs.mkdirSync(this.config.checkpointDir, { recursive: true });
      this.logger.debug('Checkpoint directory created', {
        dir: this.config.checkpointDir,
      });
    }
  }

  /**
   * Get checkpoint statistics
   */
  async getStats(): Promise<{
    totalCheckpoints: number;
    totalSize: number;
    oldestCheckpoint?: Date;
    newestCheckpoint?: Date;
  }> {
    const checkpoints = await this.listCheckpoints();

    let totalSize = 0;
    for (const checkpoint of checkpoints) {
      const checkpointPath = this.getCheckpointPath(checkpoint.id);
      try {
        const stats = await fs.promises.stat(checkpointPath);
        totalSize += stats.size;
      } catch {
        // Ignore errors
      }
    }

    return {
      totalCheckpoints: checkpoints.length,
      totalSize,
      oldestCheckpoint: checkpoints.length > 0
        ? checkpoints[checkpoints.length - 1].timestamp
        : undefined,
      newestCheckpoint: checkpoints.length > 0 ? checkpoints[0].timestamp : undefined,
    };
  }
}

/**
 * Global checkpoint manager instance
 */
let globalCheckpointManager: CheckpointManager | null = null;

/**
 * Initialize global checkpoint manager
 */
export function initCheckpointManager(
  config?: Partial<CheckpointConfig>,
  logger?: LoggerLike
): CheckpointManager {
  globalCheckpointManager = new CheckpointManager(config, logger);
  return globalCheckpointManager;
}

/**
 * Get global checkpoint manager
 */
export function getCheckpointManager(): CheckpointManager {
  if (!globalCheckpointManager) {
    globalCheckpointManager = new CheckpointManager();
  }
  return globalCheckpointManager;
}
