/**
 * Smart Context Stuffing
 *
 * Provides context stuffing based on dependencies, relevance scoring for code,
 * and optimal context selection for codebase indexing.
 */

import { z } from 'zod';
import { Logger, LoggerLike } from '../../utils/logger';
import { DependencyGraphQueries, GraphPath } from './dependencies';
import { CodeStructureUnderstanding, CodeSymbol, SymbolType } from './structure';

/**
 * Context item type
 */
export enum ContextItemType {
  /**
   * File context
   */
  FILE = 'file',

  /**
   * Symbol context
   */
  SYMBOL = 'symbol',

  /**
   * Function context
   */
  FUNCTION = 'function',

  /**
   * Class context
   */
  CLASS = 'class',

  /**
   * Interface context
   */
  INTERFACE = 'interface',

  /**
   * Method context
   */
  METHOD = 'method',

  /**
   * Variable context
   */
  VARIABLE = 'variable',

  /**
   * Import context
   */
  IMPORT = 'import',

  /**
   * Export context
   */
  EXPORT = 'export',

  /**
   * Comment context
   */
  COMMENT = 'comment',

  /**
   * Documentation context
   */
  DOCUMENTATION = 'documentation',
}

/**
 * Context priority
 */
export enum ContextPriority {
  /**
   * Critical priority
   */
  CRITICAL = 'critical',

  /**
   * High priority
   */
  HIGH = 'high',

  /**
   * Medium priority
   */
  MEDIUM = 'medium',

  /**
   * Low priority
   */
  LOW = 'low',

  /**
   * Minimal priority
   */
  MINIMAL = 'minimal',
}

/**
 * Context item
 */
export interface ContextItem {
  /**
   * Item ID
   */
  id: string;

  /**
   * Item type
   */
  type: ContextItemType;

  /**
   * File path
   */
  filePath: string;

  /**
   * Symbol ID (if applicable)
   */
  symbolId?: string;

  /**
   * Content
   */
  content: string;

  /**
   * Start line
   */
  startLine: number;

  /**
   * End line
   */
  endLine: number;

  /**
   * Relevance score (0-1)
   */
  relevanceScore: number;

  /**
   * Priority
   */
  priority: ContextPriority;

  /**
   * Dependencies
   */
  dependencies: string[];

  /**
   * Tokens used
   */
  tokens: number;

  /**
   * Metadata
   */
  metadata: Record<string, unknown>;
}

/**
 * Context stuffing strategy
 */
export enum StuffingStrategy {
  /**
   * Relevance-based strategy
   */
  RELEVANCE = 'relevance',

  /**
   * Dependency-based strategy
   */
  DEPENDENCY = 'dependency',

  /**
   * Hybrid strategy
   */
  HYBRID = 'hybrid',

  /**
   * Token-based strategy
   */
  TOKEN = 'token',

  /**
   * Priority-based strategy
   */
  PRIORITY = 'priority',
}

/**
 * Context stuffing options
 */
export interface ContextStuffingOptions {
  /**
   * Maximum tokens
   */
  maxTokens?: number;

  /**
   * Stuffing strategy
   */
  strategy?: StuffingStrategy;

  /**
   * Include imports
   */
  includeImports?: boolean;

  /**
   * Include exports
   */
  includeExports?: boolean;

  /**
   * Include documentation
   */
  includeDocumentation?: boolean;

  /**
   * Include comments
   */
  includeComments?: boolean;

  /**
   * Max depth for dependency traversal
   */
  maxDepth?: number;

  /**
   * Minimum relevance score
   */
  minRelevanceScore?: number;

  /**
   * Priority threshold
   */
  priorityThreshold?: ContextPriority;
}

/**
 * Context stuffing result
 */
export interface ContextStuffingResult {
  /**
   * Context items
   */
  items: ContextItem[];

  /**
   * Total tokens
   */
  totalTokens: number;

  /**
   * Items included
   */
  included: string[];

  /**
   * Items excluded
   */
  excluded: string[];

  /**
   * Strategy used
   */
  strategy: StuffingStrategy;

  /**
   * Coverage score (0-1)
   */
  coverageScore: number;
}

/**
 * Relevance factors
 */
export interface RelevanceFactors {
  /**
   * Direct dependency factor
   */
  directDependency: number;

  /**
   * Indirect dependency factor
   */
  indirectDependency: number;

  /**
   * Symbol usage factor
   */
  symbolUsage: number;

  /**
   * Recency factor
   */
  recency: number;

  /**
   * File size factor
   */
  fileSize: number;

  /**
   * Code complexity factor
   */
  complexity: number;

  /**
   * Documentation factor
   */
  documentation: number;
}

/**
 * Smart context stuffing class
 *
 * Provides context stuffing based on dependencies and relevance.
 */
export class SmartContextStuffing {
  private logger: LoggerLike;
  private structure: CodeStructureUnderstanding;
  private graphQueries: DependencyGraphQueries;
  private relevanceFactors: RelevanceFactors;
  private cacheEnabled: boolean;

  constructor(options?: {
    logger?: Logger;
    structure?: CodeStructureUnderstanding;
    graphQueries?: DependencyGraphQueries;
    relevanceFactors?: Partial<RelevanceFactors>;
    cacheEnabled?: boolean;
  }) {
    this.logger = options?.logger || new Logger();
    this.structure = options?.structure || new CodeStructureUnderstanding();
    this.graphQueries = options?.graphQueries || new DependencyGraphQueries();
    this.relevanceFactors = {
      directDependency: 0.4,
      indirectDependency: 0.2,
      symbolUsage: 0.15,
      recency: 0.1,
      fileSize: 0.05,
      complexity: 0.05,
      documentation: 0.05,
      ...options?.relevanceFactors,
    };
    this.cacheEnabled = options?.cacheEnabled ?? true;

    this.logger.info('SmartContextStuffing initialized', 'SmartContextStuffing');
  }

  /**
   * Stuff context for a file
   *
   * @param filePath - File path
   * @param options - Stuffing options
   * @returns Context stuffing result
   */
  async stuffContext(
    filePath: string,
    options: ContextStuffingOptions = {}
  ): Promise<ContextStuffingResult> {
    const strategy = options.strategy || StuffingStrategy.HYBRID;
    const maxTokens = options.maxTokens || 100000;

    // Get file structure
    const structure = await this.structure.analyzeFile(filePath);

    // Get dependencies
    const dependencies = this.structure.getDependencies(filePath);

    // Build context items
    const items = await this.buildContextItems(
      filePath,
      structure,
      dependencies,
      options
    );

    // Calculate relevance scores
    for (const item of items) {
      item.relevanceScore = this.calculateRelevanceScore(item, structure);
    }

    // Sort and select items based on strategy
    const selectedItems = this.selectItems(items, strategy, maxTokens, options);

    // Calculate coverage score
    const coverageScore = this.calculateCoverageScore(
      items,
      selectedItems,
      options
    );

    return {
      items: selectedItems,
      totalTokens: selectedItems.reduce((sum, item) => sum + item.tokens, 0),
      included: selectedItems.map((item) => item.id),
      excluded: items
        .filter((item) => !selectedItems.some((s) => s.id === item.id))
        .map((item) => item.id),
      strategy,
      coverageScore,
    };
  }

  /**
   * Stuff context for multiple files
   *
   * @param filePaths - File paths
   * @param options - Stuffing options
   * @returns Map of file paths to context stuffing results
   */
  async stuffContextForFiles(
    filePaths: string[],
    options: ContextStuffingOptions = {}
  ): Promise<Map<string, ContextStuffingResult>> {
    const results = new Map<string, ContextStuffingResult>();

    for (const filePath of filePaths) {
      try {
        const result = await this.stuffContext(filePath, options);
        results.set(filePath, result);
      } catch (error) {
        this.logger.error(
          `Failed to stuff context for ${filePath}`,
          'SmartContextStuffing',
          { error: (error as Error).message }
        );
      }
    }

    return results;
  }

  /**
   * Get context for a symbol
   *
   * @param filePath - File path
   * @param symbolId - Symbol ID
   * @param options - Stuffing options
   * @returns Context stuffing result
   */
  async getSymbolContext(
    filePath: string,
    symbolId: string,
    options: ContextStuffingOptions = {}
  ): Promise<ContextStuffingResult> {
    const structure = await this.structure.analyzeFile(filePath);
    const symbol = structure.symbols.get(symbolId);

    if (!symbol) {
      throw new Error(`Symbol not found: ${symbolId}`);
    }

    // Get symbol's dependencies
    const symbolDependencies = this.getSymbolDependencies(filePath, symbolId);

    // Build context items for symbol
    const items = await this.buildSymbolContextItems(
      filePath,
      symbol,
      symbolDependencies,
      options
    );

    // Calculate relevance scores
    for (const item of items) {
      item.relevanceScore = this.calculateRelevanceScore(item, structure);
    }

    // Select items
    const maxTokens = options.maxTokens || 50000;
    const strategy = options.strategy || StuffingStrategy.HYBRID;
    const selectedItems = this.selectItems(items, strategy, maxTokens, options);

    return {
      items: selectedItems,
      totalTokens: selectedItems.reduce((sum, item) => sum + item.tokens, 0),
      included: selectedItems.map((item) => item.id),
      excluded: items
        .filter((item) => !selectedItems.some((s) => s.id === item.id))
        .map((item) => item.id),
      strategy,
      coverageScore: 1.0,
    };
  }

  /**
   * Calculate relevance score for a context item
   *
   * @param item - Context item
   * @param structure - File structure
   * @returns Relevance score (0-1)
   */
  calculateRelevanceScore(
    item: ContextItem,
    structure: { symbols: Map<string, CodeSymbol> }
  ): number {
    let score = 0;

    // Direct dependency factor
    if (item.dependencies.length > 0) {
      score += this.relevanceFactors.directDependency * Math.min(1, item.dependencies.length / 10);
    }

    // Symbol usage factor
    if (item.symbolId) {
      const symbol = structure.symbols.get(item.symbolId);
      if (symbol) {
        // More complex symbols get higher scores
        const complexity = symbol.children.length + (symbol.parameters?.length || 0);
        score += this.relevanceFactors.symbolUsage * Math.min(1, complexity / 20);
      }
    }

    // File size factor (prefer smaller files for context)
    const lineCount = item.endLine - item.startLine + 1;
    score += this.relevanceFactors.fileSize * Math.max(0, 1 - lineCount / 500);

    // Documentation factor
    if (item.content.includes('/**') || item.content.includes('///')) {
      score += this.relevanceFactors.documentation;
    }

    return Math.min(1, score);
  }

  /**
   * Select context items based on strategy
   *
   * @param items - All context items
   * @param strategy - Selection strategy
   * @param maxTokens - Maximum tokens
   * @param options - Stuffing options
   * @returns Selected context items
   */
  selectItems(
    items: ContextItem[],
    strategy: StuffingStrategy,
    maxTokens: number,
    options: ContextStuffingOptions
  ): ContextItem[] {
    let sortedItems: ContextItem[];

    switch (strategy) {
      case StuffingStrategy.RELEVANCE:
        sortedItems = [...items].sort((a, b) => b.relevanceScore - a.relevanceScore);
        break;

      case StuffingStrategy.DEPENDENCY:
        sortedItems = [...items].sort((a, b) => b.dependencies.length - a.dependencies.length);
        break;

      case StuffingStrategy.TOKEN:
        sortedItems = [...items].sort((a, b) => a.tokens - b.tokens);
        break;

      case StuffingStrategy.PRIORITY:
        const priorityOrder = [
          ContextPriority.CRITICAL,
          ContextPriority.HIGH,
          ContextPriority.MEDIUM,
          ContextPriority.LOW,
          ContextPriority.MINIMAL,
        ];
        sortedItems = [...items].sort(
          (a, b) => priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority)
        );
        break;

      case StuffingStrategy.HYBRID:
      default:
        // Combine relevance, priority, and token efficiency
        sortedItems = [...items].sort((a, b) => {
          const scoreA =
            a.relevanceScore * 0.5 +
            this.priorityScore(a.priority) * 0.3 +
            (1 - a.tokens / 10000) * 0.2;
          const scoreB =
            b.relevanceScore * 0.5 +
            this.priorityScore(b.priority) * 0.3 +
            (1 - b.tokens / 10000) * 0.2;
          return scoreB - scoreA;
        });
        break;
    }

    // Filter by minimum relevance score
    const minScore = options.minRelevanceScore ?? 0;
    sortedItems = sortedItems.filter((item) => item.relevanceScore >= minScore);

    // Filter by priority threshold
    const priorityThreshold = options.priorityThreshold ?? ContextPriority.MINIMAL;
    const priorityOrder = [
      ContextPriority.CRITICAL,
      ContextPriority.HIGH,
      ContextPriority.MEDIUM,
      ContextPriority.LOW,
      ContextPriority.MINIMAL,
    ];
    const thresholdIndex = priorityOrder.indexOf(priorityThreshold);
    sortedItems = sortedItems.filter(
      (item) => priorityOrder.indexOf(item.priority) <= thresholdIndex
    );

    // Select items until max tokens is reached
    const selected: ContextItem[] = [];
    let usedTokens = 0;

    for (const item of sortedItems) {
      if (usedTokens + item.tokens <= maxTokens) {
        selected.push(item);
        usedTokens += item.tokens;
      }
    }

    return selected;
  }

  /**
   * Update relevance factors
   *
   * @param factors - New relevance factors
   */
  updateRelevanceFactors(factors: Partial<RelevanceFactors>): void {
    this.relevanceFactors = { ...this.relevanceFactors, ...factors };
    this.logger.debug('Relevance factors updated', 'SmartContextStuffing');
  }

  /**
   * Get current relevance factors
   *
   * @returns Current relevance factors
   */
  getRelevanceFactors(): RelevanceFactors {
    return { ...this.relevanceFactors };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    // Cache is managed by structure and graphQueries
    this.structure.clearCache();
    this.logger.debug('Context stuffing cache cleared', 'SmartContextStuffing');
  }

  /**
   * Build context items for a file
   *
   * @param filePath - File path
   * @param structure - File structure
   * @param dependencies - Dependencies
   * @param options - Stuffing options
   * @returns Array of context items
   */
  private async buildContextItems(
    filePath: string,
    structure: any,
    dependencies: any[],
    options: ContextStuffingOptions
  ): Promise<ContextItem[]> {
    const items: ContextItem[] = [];
    let itemId = 0;

    // Add file content
    const file = Bun.file(filePath);
    const content = await file.text();
    const lines = content.split('\n');

    // Add symbols as context items
    for (const [symbolId, symbol] of structure.symbols.entries()) {
      const symbolContent = lines
        .slice(symbol.startLine - 1, symbol.endLine)
        .join('\n');

      let type: ContextItemType;
      switch (symbol.type) {
        case SymbolType.FUNCTION:
          type = ContextItemType.FUNCTION;
          break;
        case SymbolType.CLASS:
          type = ContextItemType.CLASS;
          break;
        case SymbolType.INTERFACE:
          type = ContextItemType.INTERFACE;
          break;
        case SymbolType.METHOD:
          type = ContextItemType.METHOD;
          break;
        case SymbolType.VARIABLE:
          type = ContextItemType.VARIABLE;
          break;
        case SymbolType.IMPORT:
          if (!options.includeImports) {
            continue;
          }
          type = ContextItemType.IMPORT;
          break;
        case SymbolType.EXPORT:
          if (!options.includeExports) {
            continue;
          }
          type = ContextItemType.EXPORT;
          break;
        default:
          type = ContextItemType.SYMBOL;
      }

      items.push({
        id: `item_${itemId++}`,
        type,
        filePath,
        symbolId,
        content: symbolContent,
        startLine: symbol.startLine,
        endLine: symbol.endLine,
        relevanceScore: 0,
        priority: this.inferPriority(symbol),
        dependencies: this.getSymbolDependencies(filePath, symbolId),
        tokens: this.estimateTokens(symbolContent),
        metadata: { symbol },
      });
    }

    return items;
  }

  /**
   * Build context items for a symbol
   *
   * @param filePath - File path
   * @param symbol - Symbol
   * @param dependencies - Symbol dependencies
   * @param options - Stuffing options
   * @returns Array of context items
   */
  private async buildSymbolContextItems(
    filePath: string,
    symbol: CodeSymbol,
    dependencies: string[],
    options: ContextStuffingOptions
  ): Promise<ContextItem[]> {
    const items: ContextItem[] = [];

    const file = Bun.file(filePath);
    const content = await file.text();
    const lines = content.split('\n');

    const symbolContent = lines
      .slice(symbol.startLine - 1, symbol.endLine)
      .join('\n');

    let type: ContextItemType;
    switch (symbol.type) {
      case SymbolType.FUNCTION:
        type = ContextItemType.FUNCTION;
        break;
      case SymbolType.CLASS:
        type = ContextItemType.CLASS;
        break;
      case SymbolType.INTERFACE:
        type = ContextItemType.INTERFACE;
        break;
      case SymbolType.METHOD:
        type = ContextItemType.METHOD;
        break;
      default:
        type = ContextItemType.SYMBOL;
    }

    items.push({
      id: `symbol_${symbol.id}`,
      type,
      filePath,
      symbolId: symbol.id,
      content: symbolContent,
      startLine: symbol.startLine,
      endLine: symbol.endLine,
      relevanceScore: 1.0,
      priority: ContextPriority.CRITICAL,
      dependencies,
      tokens: this.estimateTokens(symbolContent),
      metadata: { symbol },
    });

    return items;
  }

  /**
   * Get symbol dependencies
   *
   * @param filePath - File path
   * @param symbolId - Symbol ID
   * @returns Array of dependency IDs
   */
  private getSymbolDependencies(filePath: string, symbolId: string): string[] {
    // This would be implemented using the dependency graph
    // For now, return empty array
    return [];
  }

  /**
   * Infer priority from symbol
   *
   * @param symbol - Symbol
   * @returns Context priority
   */
  private inferPriority(symbol: CodeSymbol): ContextPriority {
    // Public symbols get higher priority
    if (symbol.visibility === 'public') {
      return ContextPriority.HIGH;
    }

    // Functions and classes get medium priority
    if (symbol.type === SymbolType.FUNCTION || symbol.type === SymbolType.CLASS) {
      return ContextPriority.MEDIUM;
    }

    return ContextPriority.LOW;
  }

  /**
   * Convert priority to numeric score
   *
   * @param priority - Context priority
   * @returns Numeric score (0-1)
   */
  private priorityScore(priority: ContextPriority): number {
    switch (priority) {
      case ContextPriority.CRITICAL:
        return 1.0;
      case ContextPriority.HIGH:
        return 0.8;
      case ContextPriority.MEDIUM:
        return 0.6;
      case ContextPriority.LOW:
        return 0.4;
      case ContextPriority.MINIMAL:
        return 0.2;
      default:
        return 0.5;
    }
  }

  /**
   * Estimate token count for content
   *
   * @param content - Content to estimate
   * @returns Estimated token count
   */
  private estimateTokens(content: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(content.length / 4);
  }

  /**
   * Calculate coverage score
   *
   * @param allItems - All context items
   * @param selectedItems - Selected context items
   * @param options - Stuffing options
   * @returns Coverage score (0-1)
   */
  private calculateCoverageScore(
    allItems: ContextItem[],
    selectedItems: ContextItem[],
    options: ContextStuffingOptions
  ): number {
    if (allItems.length === 0) {
      return 1.0;
    }

    // Coverage based on tokens
    const totalTokens = allItems.reduce((sum, item) => sum + item.tokens, 0);
    const selectedTokens = selectedItems.reduce((sum, item) => sum + item.tokens, 0);

    return totalTokens > 0 ? selectedTokens / totalTokens : 1.0;
  }
}

/**
 * Schema for context stuffing options
 */
export const ContextStuffingOptionsSchema = z.object({
  maxTokens: z.number().min(1).optional(),
  strategy: z.nativeEnum(StuffingStrategy).optional(),
  includeImports: z.boolean().optional(),
  includeExports: z.boolean().optional(),
  includeDocumentation: z.boolean().optional(),
  includeComments: z.boolean().optional(),
  maxDepth: z.number().min(1).optional(),
  minRelevanceScore: z.number().min(0).max(1).optional(),
  priorityThreshold: z.nativeEnum(ContextPriority).optional(),
});

/**
 * Global smart context stuffing instance
 */
let globalContextStuffing: SmartContextStuffing | null = null;

/**
 * Initialize global smart context stuffing
 *
 * @param options - Options
 * @returns The global smart context stuffing
 */
export function initSmartContextStuffing(options?: {
  logger?: Logger;
  structure?: CodeStructureUnderstanding;
  graphQueries?: DependencyGraphQueries;
  relevanceFactors?: Partial<RelevanceFactors>;
  cacheEnabled?: boolean;
}): SmartContextStuffing {
  globalContextStuffing = new SmartContextStuffing(options);
  return globalContextStuffing;
}

/**
 * Get global smart context stuffing
 *
 * @returns The global smart context stuffing
 */
export function getSmartContextStuffing(): SmartContextStuffing {
  if (!globalContextStuffing) {
    globalContextStuffing = new SmartContextStuffing();
  }
  return globalContextStuffing;
}
