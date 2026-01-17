/**
 * Codebase Indexing Module
 *
 * Provides AST parsing, code structure understanding, dependency graph queries,
 * and smart context stuffing for codebase indexing.
 */

// Tree-sitter Integration
export { TreeSitterIntegration, initTreeSitter, getTreeSitter } from './tree-sitter';
export type {
  Language,
  NodeType,
  ASTNode,
  NodePosition,
  NodeRange,
  ParseResult,
  ParseOptions,
} from './tree-sitter';

export { ParseOptionsSchema } from './tree-sitter';

// Code Structure Understanding
export { CodeStructureUnderstanding, initCodeStructure, getCodeStructure } from './structure';
export type {
  SymbolType,
  Visibility,
  CodeSymbol,
  SymbolParameter,
  FileStructure,
  Dependency,
  DependencyType,
  StructureAnalysisOptions,
} from './structure';

export { StructureAnalysisOptionsSchema } from './structure';

// Dependency Graph Queries
export { DependencyGraphQueries, initDependencyGraphQueries, getDependencyGraphQueries } from './dependencies';
export type {
  GraphNodeType,
  GraphEdgeType,
  GraphNode,
  GraphEdge,
  DependencyGraph,
  GraphPath,
  ImpactAnalysis,
  CycleDetection,
  GraphQueryOptions,
} from './dependencies';

export { GraphQueryOptionsSchema } from './dependencies';

// Smart Context Stuffing
export { SmartContextStuffing, initSmartContextStuffing, getSmartContextStuffing } from './context-stuffing';
export type {
  ContextItemType,
  ContextPriority,
  ContextItem,
  StuffingStrategy,
  ContextStuffingOptions,
  ContextStuffingResult,
  RelevanceFactors,
} from './context-stuffing';

export { ContextStuffingOptionsSchema } from './context-stuffing';
