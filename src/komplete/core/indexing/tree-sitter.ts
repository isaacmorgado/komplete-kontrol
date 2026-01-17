/**
 * Tree-sitter Integration
 *
 * Provides AST parsing for multiple languages, code structure extraction,
 * and syntax tree traversal for codebase indexing.
 */

import { z } from 'zod';
import { Logger, LoggerLike } from '../../utils/logger';
import { AgentError } from '../../types';

/**
 * Supported languages
 */
export enum Language {
  /**
   * TypeScript
   */
  TYPESCRIPT = 'typescript',

  /**
   * JavaScript
   */
  JAVASCRIPT = 'javascript',

  /**
   * Python
   */
  PYTHON = 'python',

  /**
   * Go
   */
  GO = 'go',

  /**
   * Rust
   */
  RUST = 'rust',

  /**
   * Java
   */
  JAVA = 'java',

  /**
   * C++
   */
  CPP = 'cpp',

  /**
   * C
   */
  C = 'c',

  /**
   * Ruby
   */
  RUBY = 'ruby',

  /**
   * PHP
   */
  PHP = 'php',

  /**
   * HTML
   */
  HTML = 'html',

  /**
   * CSS
   */
  CSS = 'css',

  /**
   * JSON
   */
  JSON = 'json',

  /**
   * YAML
   */
  YAML = 'yaml',

  /**
   * Markdown
   */
  MARKDOWN = 'markdown',
}

/**
 * AST node type
 */
export enum NodeType {
  /**
   * File node
   */
  FILE = 'file',

  /**
   * Function node
   */
  FUNCTION = 'function',

  /**
   * Class node
   */
  CLASS = 'class',

  /**
   * Method node
   */
  METHOD = 'method',

  /**
   * Variable node
   */
  VARIABLE = 'variable',

  /**
   * Parameter node
   */
  PARAMETER = 'parameter',

  /**
   * Import node
   */
  IMPORT = 'import',

  /**
   * Export node
   */
  EXPORT = 'export',

  /**
   * Interface node
   */
  INTERFACE = 'interface',

  /**
   * Type alias node
   */
  TYPE_ALIAS = 'type_alias',

  /**
   * Enum node
   */
  ENUM = 'enum',

  /**
   * Statement node
   */
  STATEMENT = 'statement',

  /**
   * Expression node
   */
  EXPRESSION = 'expression',

  /**
   * Comment node
   */
  COMMENT = 'comment',

  /**
   * String node
   */
  STRING = 'string',

  /**
   * Number node
   */
  NUMBER = 'number',

  /**
   * Boolean node
   */
  BOOLEAN = 'boolean',

  /**
   * Null node
   */
  NULL = 'null',

  /**
   * Array node
   */
  ARRAY = 'array',

  /**
   * Object node
   */
  OBJECT = 'object',

  /**
   * Property node
   */
  PROPERTY = 'property',

  /**
   * Identifier node
   */
  IDENTIFIER = 'identifier',

  /**
   * Operator node
   */
  OPERATOR = 'operator',

  /**
   * Call expression node
   */
  CALL_EXPRESSION = 'call_expression',

  /**
   * Member expression node
   */
  MEMBER_EXPRESSION = 'member_expression',

  /**
   * Binary expression node
   */
  BINARY_EXPRESSION = 'binary_expression',

  /**
   * Unary expression node
   */
  UNARY_EXPRESSION = 'unary_expression',

  /**
   * Assignment node
   */
  ASSIGNMENT = 'assignment',

  /**
   * Return statement node
   */
  RETURN_STATEMENT = 'return_statement',

  /**
   * If statement node
   */
  IF_STATEMENT = 'if_statement',

  /**
   * For statement node
   */
  FOR_STATEMENT = 'for_statement',

  /**
   * While statement node
   */
  WHILE_STATEMENT = 'while_statement',

  /**
   * Try statement node
   */
  TRY_STATEMENT = 'try_statement',

  /**
   * Catch clause node
   */
  CATCH_CLAUSE = 'catch_clause',

  /**
   * Throw statement node
   */
  THROW_STATEMENT = 'throw_statement',

  /**
   * Unknown node
   */
  UNKNOWN = 'unknown',
}

/**
 * AST node position
 */
export interface NodePosition {
  /**
   * Line number (1-indexed)
   */
  line: number;

  /**
   * Column number (1-indexed)
   */
  column: number;

  /**
   * Byte offset
   */
  offset: number;
}

/**
 * AST node range
 */
export interface NodeRange {
  /**
   * Start position
   */
  start: NodePosition;

  /**
   * End position
   */
  end: NodePosition;
}

/**
 * AST node
 */
export interface ASTNode {
  /**
   * Node ID
   */
  id: string;

  /**
   * Node type
   */
  type: NodeType;

  /**
   * Node name (for named nodes)
   */
  name?: string;

  /**
   * Node value (for literal nodes)
   */
  value?: unknown;

  /**
   * Node range in source
   */
  range: NodeRange;

  /**
   * Parent node ID
   */
  parentId?: string;

  /**
   * Child node IDs
   */
  children: string[];

  /**
   * Node metadata
   */
  metadata: Record<string, unknown>;
}

/**
 * Parse result
 */
export interface ParseResult {
  /**
   * Root node ID
   */
  rootId: string;

  /**
   * All nodes
   */
  nodes: Map<string, ASTNode>;

  /**
   * Language
   */
  language: Language;

  /**
   * Parse success
   */
  success: boolean;

  /**
   * Parse error
   */
  error?: Error;
}

/**
 * Parse options
 */
export interface ParseOptions {
  /**
   * Include comments
   */
  includeComments?: boolean;

  /**
   * Include whitespace
   */
  includeWhitespace?: boolean;

  /**
   * Track node positions
   */
  trackPositions?: boolean;

  /**
   * Max depth for parsing
   */
  maxDepth?: number;
}

/**
 * Tree-sitter integration class
 *
 * Provides AST parsing for multiple languages.
 */
export class TreeSitterIntegration {
  private logger: LoggerLike;
  private parsers: Map<Language, (code: string, options: ParseOptions) => ParseResult> = new Map();
  private cache: Map<string, ParseResult> = new Map();
  private cacheEnabled: boolean;
  private cacheMaxSize: number;

  constructor(options?: {
    logger?: Logger;
    cacheEnabled?: boolean;
    cacheMaxSize?: number;
  }) {
    this.logger = options?.logger || new Logger();
    this.cacheEnabled = options?.cacheEnabled ?? true;
    this.cacheMaxSize = options?.cacheMaxSize ?? 1000;

    this.initializeParsers();
    this.logger.info('TreeSitterIntegration initialized', 'TreeSitterIntegration');
  }

  /**
   * Parse code into AST
   *
   * @param code - Code to parse
   * @param language - Language to parse
   * @param options - Parse options
   * @returns Parse result
   */
  parse(code: string, language: Language, options: ParseOptions = {}): ParseResult {
    const cacheKey = this.getCacheKey(code, language, options);

    if (this.cacheEnabled && this.cache.has(cacheKey)) {
      this.logger.debug(
        `Using cached parse result for ${language}`,
        'TreeSitterIntegration'
      );
      return this.cache.get(cacheKey)!;
    }

    const parser = this.parsers.get(language);

    if (!parser) {
      const error = new Error(`No parser available for language: ${language}`);
      this.logger.error(
        `Parse failed: ${error.message}`,
        'TreeSitterIntegration',
        { language }
      );

      return {
        rootId: '',
        nodes: new Map(),
        language,
        success: false,
        error,
      };
    }

    const result = parser(code, options);

    if (this.cacheEnabled && result.success) {
      this.addToCache(cacheKey, result);
    }

    return result;
  }

  /**
   * Parse file
   *
   * @param filePath - File path
   * @param language - Language to parse
   * @param options - Parse options
   * @returns Parse result
   */
  async parseFile(
    filePath: string,
    language: Language,
    options: ParseOptions = {}
  ): Promise<ParseResult> {
    try {
      const file = Bun.file(filePath);
      const code = await file.text();

      return this.parse(code, language, options);
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to parse file: ${filePath}`,
        'TreeSitterIntegration',
        { error: err.message }
      );

      return {
        rootId: '',
        nodes: new Map(),
        language,
        success: false,
        error: err,
      };
    }
  }

  /**
   * Detect language from file extension
   *
   * @param filePath - File path
   * @returns Detected language or undefined
   */
  detectLanguage(filePath: string): Language | undefined {
    const ext = filePath.split('.').pop()?.toLowerCase();

    const languageMap: Record<string, Language> = {
      'ts': Language.TYPESCRIPT,
      'tsx': Language.TYPESCRIPT,
      'js': Language.JAVASCRIPT,
      'jsx': Language.JAVASCRIPT,
      'py': Language.PYTHON,
      'go': Language.GO,
      'rs': Language.RUST,
      'java': Language.JAVA,
      'cpp': Language.CPP,
      'cc': Language.CPP,
      'cxx': Language.CPP,
      'c': Language.C,
      'h': Language.C,
      'rb': Language.RUBY,
      'php': Language.PHP,
      'html': Language.HTML,
      'htm': Language.HTML,
      'css': Language.CSS,
      'json': Language.JSON,
      'yaml': Language.YAML,
      'yml': Language.YAML,
      'md': Language.MARKDOWN,
      'markdown': Language.MARKDOWN,
    };

    return ext ? languageMap[ext] : undefined;
  }

  /**
   * Get node by ID
   *
   * @param result - Parse result
   * @param nodeId - Node ID
   * @returns Node or undefined
   */
  getNode(result: ParseResult, nodeId: string): ASTNode | undefined {
    return result.nodes.get(nodeId);
  }

  /**
   * Get nodes by type
   *
   * @param result - Parse result
   * @param type - Node type
   * @returns Array of nodes
   */
  getNodesByType(result: ParseResult, type: NodeType): ASTNode[] {
    return Array.from(result.nodes.values()).filter((node) => node.type === type);
  }

  /**
   * Get nodes by name
   *
   * @param result - Parse result
   * @param name - Node name
   * @returns Array of nodes
   */
  getNodesByName(result: ParseResult, name: string): ASTNode[] {
    return Array.from(result.nodes.values()).filter((node) => node.name === name);
  }

  /**
   * Get children of a node
   *
   * @param result - Parse result
   * @param nodeId - Node ID
   * @returns Array of child nodes
   */
  getChildren(result: ParseResult, nodeId: string): ASTNode[] {
    const node = result.nodes.get(nodeId);
    if (!node) {
      return [];
    }

    return node.children
      .map((childId) => result.nodes.get(childId))
      .filter((child): child is ASTNode => child !== undefined);
  }

  /**
   * Get parent of a node
   *
   * @param result - Parse result
   * @param nodeId - Node ID
   * @returns Parent node or undefined
   */
  getParent(result: ParseResult, nodeId: string): ASTNode | undefined {
    const node = result.nodes.get(nodeId);
    if (!node || !node.parentId) {
      return undefined;
    }

    return result.nodes.get(node.parentId);
  }

  /**
   * Traverse AST
   *
   * @param result - Parse result
   * @param callback - Callback function
   * @param startNodeId - Starting node ID (default: root)
   */
  traverse(
    result: ParseResult,
    callback: (node: ASTNode, depth: number) => void,
    startNodeId?: string
  ): void {
    const startId = startNodeId || result.rootId;
    this.traverseNode(result, startId, callback, 0);
  }

  /**
   * Traverse AST with filtering
   *
   * @param result - Parse result
   * @param filter - Filter function
   * @returns Array of matching nodes
   */
  traverseFilter(
    result: ParseResult,
    filter: (node: ASTNode) => boolean
  ): ASTNode[] {
    const matches: ASTNode[] = [];

    this.traverse(result, (node) => {
      if (filter(node)) {
        matches.push(node);
      }
    });

    return matches;
  }

  /**
   * Get node at position
   *
   * @param result - Parse result
   * @param line - Line number
   * @param column - Column number
   * @returns Node at position or undefined
   */
  getNodeAtPosition(
    result: ParseResult,
    line: number,
    column: number
  ): ASTNode | undefined {
    let found: ASTNode | undefined;

    this.traverse(result, (node) => {
      const { start, end } = node.range;

      const inRange =
        (line > start.line || (line === start.line && column >= start.column)) &&
        (line < end.line || (line === end.line && column <= end.column));

      if (inRange) {
        found = node;
      }
    });

    return found;
  }

  /**
   * Get node text
   *
   * @param node - AST node
   * @param code - Original source code
   * @returns Node text
   */
  getNodeText(node: ASTNode, code: string): string {
    const { start, end } = node.range;

    // Convert positions to byte offsets
    const lines = code.split('\n');

    let startOffset = 0;
    for (let i = 0; i < start.line - 1; i++) {
      startOffset += lines[i].length + 1; // +1 for newline
    }
    startOffset += start.column - 1;

    let endOffset = 0;
    for (let i = 0; i < end.line - 1; i++) {
      endOffset += lines[i].length + 1;
    }
    endOffset += end.column - 1;

    return code.substring(startOffset, endOffset);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.debug('Parse cache cleared', 'TreeSitterIntegration');
  }

  /**
   * Get cache statistics
   *
   * @returns Cache statistics
   */
  getCacheStatistics(): {
    size: number;
    maxSize: number;
    enabled: boolean;
  } {
    return {
      size: this.cache.size,
      maxSize: this.cacheMaxSize,
      enabled: this.cacheEnabled,
    };
  }

  /**
   * Initialize parsers for supported languages
   */
  private initializeParsers(): void {
    // TypeScript parser
    this.parsers.set(Language.TYPESCRIPT, (code, options) =>
      this.parseTypeScript(code, options)
    );

    // JavaScript parser
    this.parsers.set(Language.JAVASCRIPT, (code, options) =>
      this.parseJavaScript(code, options)
    );

    // Python parser
    this.parsers.set(Language.PYTHON, (code, options) =>
      this.parsePython(code, options)
    );

    // JSON parser
    this.parsers.set(Language.JSON, (code, options) =>
      this.parseJSON(code, options)
    );

    // Add more parsers as needed
  }

  /**
   * Parse TypeScript code
   *
   * @param code - TypeScript code
   * @param options - Parse options
   * @returns Parse result
   */
  private parseTypeScript(code: string, options: ParseOptions): ParseResult {
    try {
      const nodes = new Map<string, ASTNode>();
      let nodeId = 0;

      // Simple TypeScript parser (in production, use actual tree-sitter)
      const lines = code.split('\n');

      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];

        // Detect function declarations
        const functionMatch = line.match(
          /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/
        );
        if (functionMatch) {
          const id = `node_${nodeId++}`;
          nodes.set(id, {
            id,
            type: NodeType.FUNCTION,
            name: functionMatch[1],
            range: {
              start: { line: lineNum + 1, column: 1, offset: 0 },
              end: { line: lineNum + 1, column: line.length, offset: 0 },
            },
            children: [],
            metadata: {},
          });
        }

        // Detect class declarations
        const classMatch = line.match(/^\s*(?:export\s+)?class\s+(\w+)/);
        if (classMatch) {
          const id = `node_${nodeId++}`;
          nodes.set(id, {
            id,
            type: NodeType.CLASS,
            name: classMatch[1],
            range: {
              start: { line: lineNum + 1, column: 1, offset: 0 },
              end: { line: lineNum + 1, column: line.length, offset: 0 },
            },
            children: [],
            metadata: {},
          });
        }

        // Detect interface declarations
        const interfaceMatch = line.match(/^\s*(?:export\s+)?interface\s+(\w+)/);
        if (interfaceMatch) {
          const id = `node_${nodeId++}`;
          nodes.set(id, {
            id,
            type: NodeType.INTERFACE,
            name: interfaceMatch[1],
            range: {
              start: { line: lineNum + 1, column: 1, offset: 0 },
              end: { line: lineNum + 1, column: line.length, offset: 0 },
            },
            children: [],
            metadata: {},
          });
        }

        // Detect imports
        const importMatch = line.match(/^\s*import\s+.*from\s+['"]([^'"]+)['"]/);
        if (importMatch) {
          const id = `node_${nodeId++}`;
          nodes.set(id, {
            id,
            type: NodeType.IMPORT,
            name: importMatch[1],
            range: {
              start: { line: lineNum + 1, column: 1, offset: 0 },
              end: { line: lineNum + 1, column: line.length, offset: 0 },
            },
            children: [],
            metadata: {},
          });
        }

        // Detect exports
        const exportMatch = line.match(/^\s*export\s+(?:default\s+)?(\w+)/);
        if (exportMatch) {
          const id = `node_${nodeId++}`;
          nodes.set(id, {
            id,
            type: NodeType.EXPORT,
            name: exportMatch[1],
            range: {
              start: { line: lineNum + 1, column: 1, offset: 0 },
              end: { line: lineNum + 1, column: line.length, offset: 0 },
            },
            children: [],
            metadata: {},
          });
        }
      }

      // Create root node
      const rootId = `node_${nodeId++}`;
      nodes.set(rootId, {
        id: rootId,
        type: NodeType.FILE,
        name: 'root',
        range: {
          start: { line: 1, column: 1, offset: 0 },
          end: { line: lines.length, column: lines[lines.length - 1].length, offset: 0 },
        },
        children: [],
        metadata: {},
      });

      return {
        rootId,
        nodes,
        language: Language.TYPESCRIPT,
        success: true,
      };
    } catch (error) {
      return {
        rootId: '',
        nodes: new Map(),
        language: Language.TYPESCRIPT,
        success: false,
        error: error as Error,
      };
    }
  }

  /**
   * Parse JavaScript code
   *
   * @param code - JavaScript code
   * @param options - Parse options
   * @returns Parse result
   */
  private parseJavaScript(code: string, options: ParseOptions): ParseResult {
    // JavaScript is similar to TypeScript
    const result = this.parseTypeScript(code, options);
    // Override the language to JavaScript since we're parsing JavaScript
    return {
      ...result,
      language: Language.JAVASCRIPT,
    };
  }

  /**
   * Parse Python code
   *
   * @param code - Python code
   * @param options - Parse options
   * @returns Parse result
   */
  private parsePython(code: string, options: ParseOptions): ParseResult {
    try {
      const nodes = new Map<string, ASTNode>();
      let nodeId = 0;

      const lines = code.split('\n');

      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];

        // Detect function definitions
        const functionMatch = line.match(/^\s*(?:async\s+)?def\s+(\w+)/);
        if (functionMatch) {
          const id = `node_${nodeId++}`;
          nodes.set(id, {
            id,
            type: NodeType.FUNCTION,
            name: functionMatch[1],
            range: {
              start: { line: lineNum + 1, column: 1, offset: 0 },
              end: { line: lineNum + 1, column: line.length, offset: 0 },
            },
            children: [],
            metadata: {},
          });
        }

        // Detect class definitions
        const classMatch = line.match(/^\s*class\s+(\w+)/);
        if (classMatch) {
          const id = `node_${nodeId++}`;
          nodes.set(id, {
            id,
            type: NodeType.CLASS,
            name: classMatch[1],
            range: {
              start: { line: lineNum + 1, column: 1, offset: 0 },
              end: { line: lineNum + 1, column: line.length, offset: 0 },
            },
            children: [],
            metadata: {},
          });
        }

        // Detect imports
        const importMatch = line.match(/^\s*(?:from\s+)?import\s+(\w+)/);
        if (importMatch) {
          const id = `node_${nodeId++}`;
          nodes.set(id, {
            id,
            type: NodeType.IMPORT,
            name: importMatch[1],
            range: {
              start: { line: lineNum + 1, column: 1, offset: 0 },
              end: { line: lineNum + 1, column: line.length, offset: 0 },
            },
            children: [],
            metadata: {},
          });
        }
      }

      const rootId = `node_${nodeId++}`;
      nodes.set(rootId, {
        id: rootId,
        type: NodeType.FILE,
        name: 'root',
        range: {
          start: { line: 1, column: 1, offset: 0 },
          end: { line: lines.length, column: lines[lines.length - 1].length, offset: 0 },
        },
        children: [],
        metadata: {},
      });

      return {
        rootId,
        nodes,
        language: Language.PYTHON,
        success: true,
      };
    } catch (error) {
      return {
        rootId: '',
        nodes: new Map(),
        language: Language.PYTHON,
        success: false,
        error: error as Error,
      };
    }
  }

  /**
   * Parse JSON code
   *
   * @param code - JSON code
   * @param options - Parse options
   * @returns Parse result
   */
  private parseJSON(code: string, options: ParseOptions): ParseResult {
    try {
      const nodes = new Map<string, ASTNode>();
      let nodeId = 0;

      // Parse JSON and create AST nodes
      const parsed = JSON.parse(code);

      const createNode = (value: unknown, path: string[]): string => {
        const id = `node_${nodeId++}`;
        let type: NodeType;
        let name: string | undefined;

        if (typeof value === 'string') {
          type = NodeType.STRING;
        } else if (typeof value === 'number') {
          type = NodeType.NUMBER;
        } else if (typeof value === 'boolean') {
          type = NodeType.BOOLEAN;
        } else if (value === null) {
          type = NodeType.NULL;
        } else if (Array.isArray(value)) {
          type = NodeType.ARRAY;
        } else if (typeof value === 'object') {
          type = NodeType.OBJECT;
          name = path[path.length - 1];
        } else {
          type = NodeType.UNKNOWN;
        }

        nodes.set(id, {
          id,
          type,
          name,
          value,
          range: {
            start: { line: 1, column: 1, offset: 0 },
            end: { line: 1, column: 1, offset: 0 },
          },
          children: [],
          metadata: { path },
        });

        return id;
      };

      const rootId = createNode(parsed, ['root']);

      return {
        rootId,
        nodes,
        language: Language.JSON,
        success: true,
      };
    } catch (error) {
      return {
        rootId: '',
        nodes: new Map(),
        language: Language.JSON,
        success: false,
        error: error as Error,
      };
    }
  }

  /**
   * Traverse a node recursively
   *
   * @param result - Parse result
   * @param nodeId - Node ID
   * @param callback - Callback function
   * @param depth - Current depth
   */
  private traverseNode(
    result: ParseResult,
    nodeId: string,
    callback: (node: ASTNode, depth: number) => void,
    depth: number
  ): void {
    const node = result.nodes.get(nodeId);

    if (!node) {
      return;
    }

    callback(node, depth);

    for (const childId of node.children) {
      this.traverseNode(result, childId, callback, depth + 1);
    }
  }

  /**
   * Get cache key
   *
   * @param code - Source code
   * @param language - Language
   * @param options - Parse options
   * @returns Cache key
   */
  private getCacheKey(
    code: string,
    language: Language,
    options: ParseOptions
  ): string {
    const optionsStr = JSON.stringify(options);
    const hash = Bun.hash(code + language + optionsStr);
    return `parse_${hash}`;
  }

  /**
   * Add result to cache
   *
   * @param key - Cache key
   * @param result - Parse result
   */
  private addToCache(key: string, result: ParseResult): void {
    if (this.cache.size >= this.cacheMaxSize) {
      // Remove oldest entry (first in Map)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, result);
  }
}

/**
 * Schema for parse options
 */
export const ParseOptionsSchema = z.object({
  includeComments: z.boolean().optional(),
  includeWhitespace: z.boolean().optional(),
  trackPositions: z.boolean().optional(),
  maxDepth: z.number().min(1).optional(),
});

/**
 * Global tree-sitter integration instance
 */
let globalTreeSitter: TreeSitterIntegration | null = null;

/**
 * Initialize global tree-sitter integration
 *
 * @param options - Options
 * @returns The global tree-sitter integration
 */
export function initTreeSitter(options?: {
  logger?: Logger;
  cacheEnabled?: boolean;
  cacheMaxSize?: number;
}): TreeSitterIntegration {
  globalTreeSitter = new TreeSitterIntegration(options);
  return globalTreeSitter;
}

/**
 * Get global tree-sitter integration
 *
 * @returns The global tree-sitter integration
 */
export function getTreeSitter(): TreeSitterIntegration {
  if (!globalTreeSitter) {
    globalTreeSitter = new TreeSitterIntegration();
  }
  return globalTreeSitter;
}
