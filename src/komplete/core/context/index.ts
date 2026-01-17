/**
 * Context Management Module for KOMPLETE-KONTROL CLI
 *
 * Exports all context management components including:
 * - Context window tracking
 * - Token counting and budgeting
 * - Context condensation patterns
 * - Session persistence
 * - Memory file format
 * - Enhanced condensation strategies
 * - Multi-session context sharing
 * - Context-aware tool selection
 * - Context optimization
 */

// Context window tracking
export {
  ContextWindow,
  createContextWindow,
} from './window';

// Token counting and budgeting
export {
  TokenCounter,
  TokenBudget,
  TokenTracker,
  createTokenCounter,
  createTokenBudget,
  createTokenTracker,
} from './tokens';

// Context condensation
export {
  ContextCondenser,
  createContextCondenser,
} from './condensation';

// Session persistence
export {
  SessionManager,
  createSessionManager,
} from './session';

// Memory file format
export {
  MemoryFileHandler,
  createMemoryFile,
  createMemoryFileHandler,
} from './memory';

// Enhanced condensation strategies
export {
  BaseCondenser,
  TokenBasedCondenser,
  SemanticCondenser,
  createTokenBasedCondenser,
  createSemanticCondenser,
} from './enhanced-condensation';

// Multi-session context sharing
export {
  MultiSessionContextManager,
  createMultiSessionContextManager,
} from './multi-session';

// Context-aware tool selection
export {
  ContextAwareToolSelector,
  createContextAwareToolSelector,
} from './tool-selection';

// Context optimization
export {
  ContextOptimizer,
  createContextOptimizer,
} from './optimization';

// Re-export types from main types file
export type {
  ContextMessage,
  ContextWindowConfig,
  TokenCountMethod,
  TokenPricing,
  TokenUsage,
  TokenBudgetConfig,
  CondensationStrategy,
  CondensationConfig,
  Session,
  ICondenser,
  TokenBasedConfig,
  SemanticConfig,
  ContextSharingConfig,
  SharedContextEntry,
  ToolSelectionCriteria,
  ToolRecommendation,
  ContextOptimizationResult,
  ContextOptimizationConfig,
} from '../../types';

// Re-export types from enhanced-condensation
export type {
  CondensationResult,
} from './enhanced-condensation';

// Context Ignore (Phase 4)
export {
  ContextIgnore,
  initContextIgnore,
  getContextIgnore,
  loadContextIgnore,
} from './contextignore';

export type {
  ContextIgnorePattern,
  ContextIgnoreOptions,
} from './contextignore';

// Memory File Manager (Phase 4)
export {
  MemoryFileManager,
  initMemoryFileManager,
  getMemoryFileManager,
} from './memory-file';

export type {
  MemorySection,
  MemoryFile,
  MemoryUpdateOptions,
} from './memory-file';
