/**
 * Code Structure Understanding
 *
 * Provides file structure analysis, function/class/method extraction,
 * and dependency extraction for codebase indexing.
 */

import { z } from 'zod';
import { Logger, LoggerLike } from '../../utils/logger';
import { TreeSitterIntegration, ParseResult, NodeType, ASTNode } from './tree-sitter';

/**
 * Symbol type
 */
export enum SymbolType {
  /**
   * Function symbol
   */
  FUNCTION = 'function',

  /**
   * Class symbol
   */
  CLASS = 'class',

  /**
   * Interface symbol
   */
  INTERFACE = 'interface',

  /**
   * Method symbol
   */
  METHOD = 'method',

  /**
   * Variable symbol
   */
  VARIABLE = 'variable',

  /**
   * Parameter symbol
   */
  PARAMETER = 'parameter',

  /**
   * Type alias symbol
   */
  TYPE_ALIAS = 'type_alias',

  /**
   * Enum symbol
   */
  ENUM = 'enum',

  /**
   * Constant symbol
   */
  CONSTANT = 'constant',

  /**
   * Property symbol
   */
  PROPERTY = 'property',

  /**
   * Import symbol
   */
  IMPORT = 'import',

  /**
   * Export symbol
   */
  EXPORT = 'export',
}

/**
 * Symbol visibility
 */
export enum Visibility {
  /**
   * Public symbol
   */
  PUBLIC = 'public',

  /**
   * Private symbol
   */
  PRIVATE = 'private',

  /**
   * Protected symbol
   */
  PROTECTED = 'protected',

  /**
   * Internal symbol
   */
  INTERNAL = 'internal',

  /**
   * Unknown visibility
   */
  UNKNOWN = 'unknown',
}

/**
 * Code symbol
 */
export interface CodeSymbol {
  /**
   * Symbol ID
   */
  id: string;

  /**
   * Symbol name
   */
  name: string;

  /**
   * Symbol type
   */
  type: SymbolType;

  /**
   * Symbol visibility
   */
  visibility: Visibility;

  /**
   * File path
   */
  filePath: string;

  /**
   * Start line
   */
  startLine: number;

  /**
   * End line
   */
  endLine: number;

  /**
   * Parent symbol ID (for nested symbols)
   */
  parentId?: string;

  /**
   * Child symbol IDs
   */
  children: string[];

  /**
   * Parameters (for functions/methods)
   */
  parameters?: SymbolParameter[];

  /**
   * Return type (for functions/methods)
   */
  returnType?: string;

  /**
   * Signature (for functions/methods)
   */
  signature?: string;

  /**
   * Symbol metadata
   */
  metadata: Record<string, unknown>;
}

/**
 * Symbol parameter
 */
export interface SymbolParameter {
  /**
   * Parameter name
   */
  name: string;

  /**
   * Parameter type
   */
  type?: string;

  /**
   * Default value
   */
  defaultValue?: unknown;

  /**
   * Is optional
   */
  isOptional?: boolean;

  /**
   * Is rest parameter
   */
  isRest?: boolean;
}

/**
 * File structure
 */
export interface FileStructure {
  /**
   * File path
   */
  filePath: string;

  /**
   * Language
   */
  language: string;

  /**
   * All symbols
   */
  symbols: Map<string, CodeSymbol>;

  /**
   * Top-level symbols
   */
  topLevelSymbols: string[];

  /**
   * Imports
   */
  imports: string[];

  /**
   * Exports
   */
  exports: string[];

  /**
   * Parse result
   */
  parseResult: ParseResult;
}

/**
 * Dependency type
 */
export enum DependencyType {
  /**
   * Import dependency
   */
  IMPORT = 'import',

  /**
   * Require dependency
   */
  REQUIRE = 'require',

  /**
   * From import dependency
   */
  FROM_IMPORT = 'from_import',

  /**
   * Dynamic import
   */
  DYNAMIC_IMPORT = 'dynamic_import',

  /**
   * Type import
   */
  TYPE_IMPORT = 'type_import',

  /**
   * Unknown dependency
   */
  UNKNOWN = 'unknown',
}

/**
 * Dependency
 */
export interface Dependency {
  /**
   * Dependency ID
   */
  id: string;

  /**
   * Source file path
   */
  sourcePath: string;

  /**
   * Target file path or module name
   */
  target: string;

  /**
   * Dependency type
   */
  type: DependencyType;

  /**
   * Imported symbols
   */
  importedSymbols?: string[];

  /**
   * Is external dependency
   */
  isExternal: boolean;

  /**
   * Line number
   */
  line: number;

  /**
   * Metadata
   */
  metadata: Record<string, unknown>;
}

/**
 * Structure analysis options
 */
export interface StructureAnalysisOptions {
  /**
   * Include private symbols
   */
  includePrivate?: boolean;

  /**
   * Include comments
   */
  includeComments?: boolean;

  /**
   * Track dependencies
   */
  trackDependencies?: boolean;

  /**
   * Resolve external dependencies
   */
  resolveExternal?: boolean;
}

/**
 * Code structure understanding class
 *
 * Provides file structure analysis and symbol extraction.
 */
export class CodeStructureUnderstanding {
  private logger: LoggerLike;
  private treeSitter: TreeSitterIntegration;
  private structures: Map<string, FileStructure> = new Map();
  private dependencies: Map<string, Dependency[]> = new Map();
  private cacheEnabled: boolean;

  constructor(options?: {
    logger?: Logger;
    treeSitter?: TreeSitterIntegration;
    cacheEnabled?: boolean;
  }) {
    this.logger = options?.logger || new Logger();
    this.treeSitter = options?.treeSitter || new TreeSitterIntegration();
    this.cacheEnabled = options?.cacheEnabled ?? true;

    this.logger.info('CodeStructureUnderstanding initialized', 'CodeStructureUnderstanding');
  }

  /**
   * Analyze file structure
   *
   * @param filePath - File path
   * @param options - Analysis options
   * @returns File structure
   */
  async analyzeFile(
    filePath: string,
    options: StructureAnalysisOptions = {}
  ): Promise<FileStructure> {
    if (this.cacheEnabled && this.structures.has(filePath)) {
      this.logger.debug(
        `Using cached structure for ${filePath}`,
        'CodeStructureUnderstanding'
      );
      return this.structures.get(filePath)!;
    }

    const language = this.treeSitter.detectLanguage(filePath);

    if (!language) {
      throw new Error(`Could not detect language for file: ${filePath}`);
    }

    const parseResult = await this.treeSitter.parseFile(filePath, language);

    if (!parseResult.success) {
      throw new Error(`Failed to parse file: ${filePath}`);
    }

    const structure = this.buildStructure(filePath, language, parseResult, options);

    if (options.trackDependencies) {
      const deps = this.extractDependencies(filePath, parseResult);
      this.dependencies.set(filePath, deps);
    }

    if (this.cacheEnabled) {
      this.structures.set(filePath, structure);
    }

    return structure;
  }

  /**
   * Analyze multiple files
   *
   * @param filePaths - File paths
   * @param options - Analysis options
   * @returns Map of file structures
   */
  async analyzeFiles(
    filePaths: string[],
    options: StructureAnalysisOptions = {}
  ): Promise<Map<string, FileStructure>> {
    const results = new Map<string, FileStructure>();

    for (const filePath of filePaths) {
      try {
        const structure = await this.analyzeFile(filePath, options);
        results.set(filePath, structure);
      } catch (error) {
        this.logger.error(
          `Failed to analyze file: ${filePath}`,
          'CodeStructureUnderstanding',
          { error: (error as Error).message }
        );
      }
    }

    return results;
  }

  /**
   * Get symbol by ID
   *
   * @param filePath - File path
   * @param symbolId - Symbol ID
   * @returns Symbol or undefined
   */
  getSymbol(filePath: string, symbolId: string): CodeSymbol | undefined {
    const structure = this.structures.get(filePath);
    return structure?.symbols.get(symbolId);
  }

  /**
   * Get symbols by type
   *
   * @param filePath - File path
   * @param type - Symbol type
   * @returns Array of symbols
   */
  getSymbolsByType(filePath: string, type: SymbolType): CodeSymbol[] {
    const structure = this.structures.get(filePath);
    if (!structure) {
      return [];
    }

    return Array.from(structure.symbols.values()).filter((s) => s.type === type);
  }

  /**
   * Get symbols by name
   *
   * @param filePath - File path
   * @param name - Symbol name
   * @returns Array of symbols
   */
  getSymbolsByName(filePath: string, name: string): CodeSymbol[] {
    const structure = this.structures.get(filePath);
    if (!structure) {
      return [];
    }

    return Array.from(structure.symbols.values()).filter((s) => s.name === name);
  }

  /**
   * Get top-level symbols
   *
   * @param filePath - File path
   * @returns Array of top-level symbols
   */
  getTopLevelSymbols(filePath: string): CodeSymbol[] {
    const structure = this.structures.get(filePath);
    if (!structure) {
      return [];
    }

    return structure.topLevelSymbols
      .map((id) => structure.symbols.get(id))
      .filter((s): s is CodeSymbol => s !== undefined);
  }

  /**
   * Get children of a symbol
   *
   * @param filePath - File path
   * @param symbolId - Symbol ID
   * @returns Array of child symbols
   */
  getChildren(filePath: string, symbolId: string): CodeSymbol[] {
    const structure = this.structures.get(filePath);
    if (!structure) {
      return [];
    }

    const symbol = structure.symbols.get(symbolId);
    if (!symbol) {
      return [];
    }

    return symbol.children
      .map((id) => structure.symbols.get(id))
      .filter((s): s is CodeSymbol => s !== undefined);
  }

  /**
   * Get parent of a symbol
   *
   * @param filePath - File path
   * @param symbolId - Symbol ID
   * @returns Parent symbol or undefined
   */
  getParent(filePath: string, symbolId: string): CodeSymbol | undefined {
    const structure = this.structures.get(filePath);
    if (!structure) {
      return undefined;
    }

    const symbol = structure.symbols.get(symbolId);
    if (!symbol || !symbol.parentId) {
      return undefined;
    }

    return structure.symbols.get(symbol.parentId);
  }

  /**
   * Get dependencies for a file
   *
   * @param filePath - File path
   * @returns Array of dependencies
   */
  getDependencies(filePath: string): Dependency[] {
    return this.dependencies.get(filePath) || [];
  }

  /**
   * Get all dependencies
   *
   * @returns Map of file paths to dependencies
   */
  getAllDependencies(): Map<string, Dependency[]> {
    return new Map(this.dependencies);
  }

  /**
   * Get external dependencies
   *
   * @returns Array of external dependencies
   */
  getExternalDependencies(): Dependency[] {
    const external: Dependency[] = [];

    for (const deps of this.dependencies.values()) {
      for (const dep of deps) {
        if (dep.isExternal && !external.some((d) => d.target === dep.target)) {
          external.push(dep);
        }
      }
    }

    return external;
  }

  /**
   * Get internal dependencies
   *
   * @returns Map of file paths to internal dependencies
   */
  getInternalDependencies(): Map<string, Dependency[]> {
    const internal = new Map<string, Dependency[]>();

    for (const [filePath, deps] of this.dependencies.entries()) {
      internal.set(filePath, deps.filter((d) => !d.isExternal));
    }

    return internal;
  }

  /**
   * Find symbol by name across all files
   *
   * @param name - Symbol name
   * @returns Array of symbols
   */
  findSymbol(name: string): CodeSymbol[] {
    const results: CodeSymbol[] = [];

    for (const structure of this.structures.values()) {
      const symbols = Array.from(structure.symbols.values()).filter(
        (s) => s.name === name
      );
      results.push(...symbols);
    }

    return results;
  }

  /**
   * Find symbols by type across all files
   *
   * @param type - Symbol type
   * @returns Array of symbols
   */
  findSymbolsByType(type: SymbolType): CodeSymbol[] {
    const results: CodeSymbol[] = [];

    for (const structure of this.structures.values()) {
      const symbols = Array.from(structure.symbols.values()).filter(
        (s) => s.type === type
      );
      results.push(...symbols);
    }

    return results;
  }

  /**
   * Get file structure
   *
   * @param filePath - File path
   * @returns File structure or undefined
   */
  getStructure(filePath: string): FileStructure | undefined {
    return this.structures.get(filePath);
  }

  /**
   * Get all structures
   *
   * @returns Map of file paths to structures
   */
  getAllStructures(): Map<string, FileStructure> {
    return new Map(this.structures);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.structures.clear();
    this.dependencies.clear();
    this.logger.debug('Structure cache cleared', 'CodeStructureUnderstanding');
  }

  /**
   * Get cache statistics
   *
   * @returns Cache statistics
   */
  getCacheStatistics(): {
    structures: number;
    dependencies: number;
    enabled: boolean;
  } {
    return {
      structures: this.structures.size,
      dependencies: this.dependencies.size,
      enabled: this.cacheEnabled,
    };
  }

  /**
   * Build structure from parse result
   *
   * @param filePath - File path
   * @param language - Language
   * @param parseResult - Parse result
   * @param options - Analysis options
   * @returns File structure
   */
  private buildStructure(
    filePath: string,
    language: string,
    parseResult: ParseResult,
    options: StructureAnalysisOptions
  ): FileStructure {
    const symbols = new Map<string, CodeSymbol>();
    const topLevelSymbols: string[] = [];
    const imports: string[] = [];
    const exports: string[] = [];

    let symbolId = 0;

    // Process all nodes
    for (const [nodeId, node] of parseResult.nodes.entries()) {
      if (nodeId === parseResult.rootId) {
        continue; // Skip root node
      }

      const symbol = this.nodeToSymbol(
        node,
        filePath,
        language,
        symbolId++,
        options
      );

      if (symbol) {
        symbols.set(symbol.id, symbol);

        if (!symbol.parentId) {
          topLevelSymbols.push(symbol.id);
        }

        if (symbol.type === SymbolType.IMPORT) {
          imports.push(symbol.name);
        }

        if (symbol.type === SymbolType.EXPORT) {
          exports.push(symbol.name);
        }
      }
    }

    // Build parent-child relationships
    for (const symbol of symbols.values()) {
      if (symbol.parentId) {
        const parent = symbols.get(symbol.parentId);
        if (parent && !parent.children.includes(symbol.id)) {
          parent.children.push(symbol.id);
        }
      }
    }

    return {
      filePath,
      language,
      symbols,
      topLevelSymbols,
      imports,
      exports,
      parseResult,
    };
  }

  /**
   * Convert AST node to code symbol
   *
   * @param node - AST node
   * @param filePath - File path
   * @param language - Language
   * @param id - Symbol ID
   * @param options - Analysis options
   * @returns Code symbol or undefined
   */
  private nodeToSymbol(
    node: ASTNode,
    filePath: string,
    language: string,
    id: number,
    options: StructureAnalysisOptions
  ): CodeSymbol | undefined {
    let type: SymbolType | undefined;
    let visibility = Visibility.UNKNOWN;

    switch (node.type) {
      case NodeType.FUNCTION:
        type = SymbolType.FUNCTION;
        break;
      case NodeType.CLASS:
        type = SymbolType.CLASS;
        break;
      case NodeType.METHOD:
        type = SymbolType.METHOD;
        break;
      case NodeType.INTERFACE:
        type = SymbolType.INTERFACE;
        break;
      case NodeType.TYPE_ALIAS:
        type = SymbolType.TYPE_ALIAS;
        break;
      case NodeType.ENUM:
        type = SymbolType.ENUM;
        break;
      case NodeType.VARIABLE:
        type = SymbolType.VARIABLE;
        break;
      case NodeType.PARAMETER:
        type = SymbolType.PARAMETER;
        break;
      case NodeType.IMPORT:
        type = SymbolType.IMPORT;
        break;
      case NodeType.EXPORT:
        type = SymbolType.EXPORT;
        break;
      default:
        return undefined;
    }

    // Determine visibility
    if (node.name?.startsWith('_')) {
      visibility = Visibility.PRIVATE;
    } else if (node.name?.startsWith('#')) {
      visibility = Visibility.PRIVATE;
    } else if (node.name?.startsWith('use') || node.name?.startsWith('import')) {
      visibility = Visibility.INTERNAL;
    } else {
      visibility = Visibility.PUBLIC;
    }

    return {
      id: `symbol_${id}`,
      name: node.name || 'anonymous',
      type,
      visibility,
      filePath,
      startLine: node.range.start.line,
      endLine: node.range.end.line,
      parentId: node.parentId,
      children: [],
      metadata: node.metadata,
    };
  }

  /**
   * Extract dependencies from parse result
   *
   * @param filePath - File path
   * @param parseResult - Parse result
   * @returns Array of dependencies
   */
  private extractDependencies(
    filePath: string,
    parseResult: ParseResult
  ): Dependency[] {
    const dependencies: Dependency[] = [];
    let depId = 0;

    for (const node of parseResult.nodes.values()) {
      if (node.type === NodeType.IMPORT) {
        const target = node.name || '';
        const isExternal = !target.startsWith('.') && !target.startsWith('/');

        dependencies.push({
          id: `dep_${depId++}`,
          sourcePath: filePath,
          target,
          type: DependencyType.IMPORT,
          isExternal,
          line: node.range.start.line,
          metadata: {},
        });
      }
    }

    return dependencies;
  }
}

/**
 * Schema for structure analysis options
 */
export const StructureAnalysisOptionsSchema = z.object({
  includePrivate: z.boolean().optional(),
  includeComments: z.boolean().optional(),
  trackDependencies: z.boolean().optional(),
  resolveExternal: z.boolean().optional(),
});

/**
 * Global code structure understanding instance
 */
let globalStructure: CodeStructureUnderstanding | null = null;

/**
 * Initialize global code structure understanding
 *
 * @param options - Options
 * @returns The global code structure understanding
 */
export function initCodeStructure(options?: {
  logger?: Logger;
  treeSitter?: TreeSitterIntegration;
  cacheEnabled?: boolean;
}): CodeStructureUnderstanding {
  globalStructure = new CodeStructureUnderstanding(options);
  return globalStructure;
}

/**
 * Get global code structure understanding
 *
 * @returns The global code structure understanding
 */
export function getCodeStructure(): CodeStructureUnderstanding {
  if (!globalStructure) {
    globalStructure = new CodeStructureUnderstanding();
  }
  return globalStructure;
}
