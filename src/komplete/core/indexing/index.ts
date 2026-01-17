/**
 * Codebase Indexing Module
 *
 * Provides AST parsing, code structure understanding, dependency graph queries,
 * and smart context stuffing for codebase indexing.
 */

// Tree-sitter Integration
export {
  TreeSitterIntegration,
  Language,
  NodeType,
  ASTNode,
  NodePosition,
  NodeRange,
  ParseResult,
  ParseOptions,
  initTreeSitter,
  getTreeSitter,
} from './tree-sitter';

export { ParseOptionsSchema } from './tree-sitter';

// Code Structure Understanding
export {
  CodeStructureUnderstanding,
  SymbolType,
  Visibility,
  CodeSymbol,
  SymbolParameter,
  FileStructure,
  Dependency,
  DependencyType,
  StructureAnalysisOptions,
  initCodeStructure,
  getCodeStructure,
} from './structure';

export { StructureAnalysisOptionsSchema } from './structure';

// Dependency Graph Queries
export {
  DependencyGraphQueries,
  GraphNodeType,
  GraphEdgeType,
  GraphNode,
  GraphEdge,
  DependencyGraph,
  GraphPath,
  ImpactAnalysis,
  CycleDetection,
  GraphQueryOptions,
  initDependencyGraphQueries,
  getDependencyGraphQueries,
} from './dependencies';

export { GraphQueryOptionsSchema } from './dependencies';

// Smart Context Stuffing
export {
  SmartContextStuffing,
  ContextItemType,
  ContextPriority,
  ContextItem,
  StuffingStrategy,
  ContextStuffingOptions,
  ContextStuffingResult,
  RelevanceFactors,
  initSmartContextStuffing,
  getSmartContextStuffing,
} from './context-stuffing';

export { ContextStuffingOptionsSchema } from './context-stuffing';
