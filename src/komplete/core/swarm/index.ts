/**
 * Swarm Orchestration Module Exports
 *
 * Exports the git worktree-based swarm orchestration system.
 *
 * Phase 4 Implementation:
 * - Git Worktree Isolation: TRUE parallel execution (2-100+ agents)
 * - Task Decomposition: 5 strategies (feature, testing, refactor, research, generic)
 * - Auto-Merge: 3 conflict resolution strategies
 */

// Swarm Orchestrator exports
export {
  SwarmOrchestrator,
  createSwarmOrchestrator,
  type SwarmConfig,
  type SwarmState,
  type AgentState,
  type AgentResult,
  type ConflictReport,
  TaskDecompositionStrategy,
  ConflictStrategy,
} from './swarm-orchestrator';
