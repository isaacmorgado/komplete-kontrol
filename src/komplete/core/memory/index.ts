/**
 * Memory System Module Exports
 *
 * Exports the 4-signal RRF memory system with checkpoint/restore capabilities.
 *
 * Phase 3 Implementation:
 * - RRF Memory: BM25 + Vector + Recency + Importance
 * - Checkpoint/Restore: State snapshots with rollback
 * - Session Memory: High-level conversation memory API
 */

// RRF Memory exports
export {
  RRFMemory,
  type MemoryEntry,
  type SearchResult,
  type RRFConfig,
  initRRFMemory,
  getRRFMemory,
} from './rrf-memory';

// Checkpoint exports
export {
  CheckpointManager,
  type CheckpointMetadata,
  type CheckpointData,
  type CheckpointConfig,
  initCheckpointManager,
  getCheckpointManager,
} from './checkpoint';

// Session Memory exports
export {
  SessionMemoryManager,
  type SessionMemoryConfig,
  MemoryLayer,
  createSessionMemory,
} from './session-memory';
