/**
 * Intelligence Module Exports
 *
 * Exports the ReAct + Reflexion + Constitutional AI system.
 *
 * Phase 5 Implementation:
 * - ReAct Cycle: Think → Act → Observe pattern
 * - Reflexion: Observe → Reflect → Revise pattern
 * - Constitutional AI: Safety principles with auto-revision
 */

// ReAct Cycle exports
export {
  ReActCycle,
  createReActCycle,
  type ReActThought,
  type ReActAction,
  type ReActObservation,
  type ReActConfig,
  type ReActCycleState,
} from './react-cycle';

// Reflexion exports
export {
  Reflexion,
  createReflexion,
  type Reflection,
  type RevisionPlan,
  type LearnedPattern,
  type ReflexionConfig,
} from './reflexion';

// Constitutional AI exports
export {
  ConstitutionalAI,
  createConstitutionalAI,
  type ConstitutionalPrinciple,
  type ViolationResult,
  type CritiqueResult,
  type RevisionResult,
  type ConstitutionalAIConfig,
} from './constitutional-ai';
