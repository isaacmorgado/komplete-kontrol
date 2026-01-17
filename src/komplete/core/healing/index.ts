/**
 * Self-Healing Loop Module
 *
 * Provides self-healing loop for automatic code fixing with
 * error pattern matching, auto-suggestion system, fix validation,
 * REPL interface, runtime supervision, and shadow mode.
 */

// Self-Healing Loop
export {
  SelfHealingLoop,
  LoopStage,
  initSelfHealingLoop,
  getSelfHealingLoop,
  LoopOptionsSchema,
} from './loop';

export type {
  LoopState,
  ExecutionResult,
  AnalysisResult,
  AppliedFix,
  ErrorInfo,
  TerminationCondition,
  LoopResult,
  LoopOptions,
} from './loop';

// Error Pattern Matching
export {
  ErrorPatternMatching,
  initErrorPatternMatching,
  getErrorPatternMatching,
  PatternMatchingOptionsSchema,
  ErrorCategory,
  ErrorSeverity,
} from './patterns';

export type {
  ErrorPattern,
  PatternMatch,
  PatternDatabaseEntry,
  PatternMatchingOptions,
} from './patterns';

// Auto-Suggestion System
export {
  AutoSuggestionSystem,
  initAutoSuggestionSystem,
  getAutoSuggestionSystem,
  SuggestionOptionsSchema,
} from './suggestions';

export type {
  SuggestionPriority,
  SuggestionType,
  Suggestion,
  SuggestionOptions,
  RankingStrategy,
  SuggestionFilterOptions,
} from './suggestions';

// Fix Validation
export {
  FixValidation,
  initFixValidation,
  getFixValidation,
  ValidationOptionsSchema,
  RollbackOptionsSchema,
} from './validation';

export type {
  ValidationResult,
  ValidationError,
  ValidationWarning,
  TestResult,
  ValidationOptions,
  RollbackOptions,
  RollbackResult,
} from './validation';

// REPL Interface (Phase 4)
export {
  REPLInterface,
  REPLMode,
  initREPLInterface,
  getREPLInterface,
  REPLOptionsSchema,
} from './repl-interface';

export type {
  REPLState,
  REPLCommand,
  REPLOptions,
  REPLResult,
} from './repl-interface';

// Shadow Mode (Phase 4)
export {
  ShadowMode,
  ShadowState,
  initShadowMode,
  getShadowMode,
} from './shadow-mode';

export type {
  ShadowExecutionOptions,
  ShadowExecutionResult,
} from './shadow-mode';
