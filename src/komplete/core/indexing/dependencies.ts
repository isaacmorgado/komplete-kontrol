/**
 * Dependency Graph Queries
 *
 * Provides building dependency graphs, querying dependencies by file/symbol,
 * and impact analysis for codebase indexing.
 */

import { z } from 'zod';
import { Logger, LoggerLike } from '../../utils/logger';
import { Dependency, DependencyType } from './structure';

/**
 * Graph node type
 */
export enum GraphNodeType {
  /**
   * File node
   */
  FILE = 'file',

  /**
   * Symbol node
   */
  SYMBOL = 'symbol',

  /**
   * Module node
   */
  MODULE = 'module',

  /**
   * Package node
   */
  PACKAGE = 'package',
}

/**
 * Graph edge type
 */
export enum GraphEdgeType {
  /**
   * Imports edge
   */
  IMPORTS = 'imports',

  /**
   * Exports edge
   */
  EXPORTS = 'exports',

  /**
   * Depends on edge
   */
  DEPENDS_ON = 'depends_on',

  /**
   * Contains edge
   */
  CONTAINS = 'contains',

  /**
   * Uses edge
   */
  USES = 'uses',
}

/**
 * Graph node
 */
export interface GraphNode {
  /**
   * Node ID
   */
  id: string;

  /**
   * Node type
   */
  type: GraphNodeType;

  /**
   * Node label
   */
  label: string;

  /**
   * Node value (file path, symbol name, etc.)
   */
  value: string;

  /**
   * Node metadata
   */
  metadata: Record<string, unknown>;
}

/**
 * Graph edge
 */
export interface GraphEdge {
  /**
   * Edge ID
   */
  id: string;

  /**
   * Source node ID
   */
  sourceId: string;

  /**
   * Target node ID
   */
  targetId: string;

  /**
   * Edge type
   */
  type: GraphEdgeType;

  /**
   * Edge weight
   */
  weight: number;

  /**
   * Edge metadata
   */
  metadata: Record<string, unknown>;
}

/**
 * Dependency graph
 */
export interface DependencyGraph {
  /**
   * Graph ID
   */
  id: string;

  /**
   * Graph nodes
   */
  nodes: Map<string, GraphNode>;

  /**
   * Graph edges
   */
  edges: Map<string, GraphEdge>;

  /**
   * Adjacency list (source -> targets)
   */
  adjacency: Map<string, Set<string>>;

  /**
   * Reverse adjacency list (target -> sources)
   */
  reverseAdjacency: Map<string, Set<string>>;

  /**
   * Graph metadata
   */
  metadata: Record<string, unknown>;
}

/**
 * Path in graph
 */
export interface GraphPath {
  /**
   * Path nodes
   */
  nodes: string[];

  /**
   * Path edges
   */
  edges: string[];

  /**
   * Path length
   */
  length: number;

  /**
   * Path weight
   */
  weight: number;
}

/**
 * Impact analysis result
 */
export interface ImpactAnalysis {
  /**
   * Source node ID
   */
  sourceId: string;

  /**
   * Directly affected nodes
   */
  directlyAffected: string[];

  /**
   * Indirectly affected nodes
   */
  indirectlyAffected: string[];

  /**
   * Impact paths
   */
  paths: GraphPath[];

  /**
   * Impact score (0-1)
   */
  impactScore: number;
}

/**
 * Cycle detection result
 */
export interface CycleDetection {
  /**
   * Has cycles
   */
  hasCycles: boolean;

  /**
   * Cycles found
   */
  cycles: string[][];

  /**
   * Cycle nodes
   */
  cycleNodes: Set<string>;
}

/**
 * Graph query options
 */
export interface GraphQueryOptions {
  /**
   * Include transitive dependencies
   */
  transitive?: boolean;

  /**
   * Max depth for traversal
   */
  maxDepth?: number;

  /**
   * Filter by edge type
   */
  edgeType?: GraphEdgeType;

  /**
   * Filter by node type
   */
  nodeType?: GraphNodeType;
}

/**
 * Dependency graph queries class
 *
 * Provides building and querying dependency graphs.
 */
export class DependencyGraphQueries {
  private logger: LoggerLike;
  private graphs: Map<string, DependencyGraph> = new Map();
  private activeGraphId: string | null = null;
  private cacheEnabled: boolean;

  constructor(options?: {
    logger?: Logger;
    cacheEnabled?: boolean;
  }) {
    this.logger = options?.logger || new Logger();
    this.cacheEnabled = options?.cacheEnabled ?? true;

    this.logger.info('DependencyGraphQueries initialized', 'DependencyGraphQueries');
  }

  /**
   * Create a new dependency graph
   *
   * @param id - Graph ID
   * @returns The new graph
   */
  createGraph(id: string): DependencyGraph {
    const graph: DependencyGraph = {
      id,
      nodes: new Map(),
      edges: new Map(),
      adjacency: new Map(),
      reverseAdjacency: new Map(),
      metadata: {},
    };

    this.graphs.set(id, graph);
    this.activeGraphId = id;

    this.logger.debug(`Created graph: ${id}`, 'DependencyGraphQueries');

    return graph;
  }

  /**
   * Get graph by ID
   *
   * @param id - Graph ID
   * @returns Graph or undefined
   */
  getGraph(id: string): DependencyGraph | undefined {
    return this.graphs.get(id);
  }

  /**
   * Get active graph
   *
   * @returns Active graph or undefined
   */
  getActiveGraph(): DependencyGraph | undefined {
    return this.activeGraphId ? this.graphs.get(this.activeGraphId) : undefined;
  }

  /**
   * Set active graph
   *
   * @param id - Graph ID
   */
  setActiveGraph(id: string): void {
    if (this.graphs.has(id)) {
      this.activeGraphId = id;
      this.logger.debug(`Set active graph: ${id}`, 'DependencyGraphQueries');
    }
  }

  /**
   * Add node to graph
   *
   * @param graphId - Graph ID
   * @param node - Node to add
   * @returns Added node
   */
  addNode(graphId: string, node: GraphNode): GraphNode {
    const graph = this.graphs.get(graphId);

    if (!graph) {
      throw new Error(`Graph not found: ${graphId}`);
    }

    graph.nodes.set(node.id, node);
    graph.adjacency.set(node.id, new Set());
    graph.reverseAdjacency.set(node.id, new Set());

    return node;
  }

  /**
   * Add edge to graph
   *
   * @param graphId - Graph ID
   * @param edge - Edge to add
   * @returns Added edge
   */
  addEdge(graphId: string, edge: GraphEdge): GraphEdge {
    const graph = this.graphs.get(graphId);

    if (!graph) {
      throw new Error(`Graph not found: ${graphId}`);
    }

    if (!graph.nodes.has(edge.sourceId)) {
      throw new Error(`Source node not found: ${edge.sourceId}`);
    }

    if (!graph.nodes.has(edge.targetId)) {
      throw new Error(`Target node not found: ${edge.targetId}`);
    }

    graph.edges.set(edge.id, edge);
    graph.adjacency.get(edge.sourceId)!.add(edge.targetId);
    graph.reverseAdjacency.get(edge.targetId)!.add(edge.sourceId);

    return edge;
  }

  /**
   * Build graph from dependencies
   *
   * @param dependencies - Array of dependencies
   * @param graphId - Graph ID (optional, creates new if not provided)
   * @returns The graph
   */
  buildGraph(
    dependencies: Dependency[],
    graphId?: string
  ): DependencyGraph {
    const id = graphId || `graph_${Date.now()}`;
    const graph = this.createGraph(id);

    // Create nodes for all files
    const filePaths = new Set<string>();
    for (const dep of dependencies) {
      filePaths.add(dep.sourcePath);
      if (!dep.isExternal) {
        filePaths.add(dep.target);
      }
    }

    for (const filePath of filePaths) {
      this.addNode(id, {
        id: `file_${this.hash(filePath)}`,
        type: GraphNodeType.FILE,
        label: filePath.split('/').pop() || filePath,
        value: filePath,
        metadata: {},
      });
    }

    // Create edges for dependencies
    for (const dep of dependencies) {
      if (!dep.isExternal) {
        const sourceId = `file_${this.hash(dep.sourcePath)}`;
        const targetId = `file_${this.hash(dep.target)}`;

        this.addEdge(id, {
          id: `edge_${this.hash(sourceId + targetId)}`,
          sourceId,
          targetId,
          type: GraphEdgeType.IMPORTS,
          weight: 1,
          metadata: { dependency: dep },
        });
      }
    }

    return graph;
  }

  /**
   * Get dependencies of a node
   *
   * @param graphId - Graph ID
   * @param nodeId - Node ID
   * @param options - Query options
   * @returns Array of dependency node IDs
   */
  getDependencies(
    graphId: string,
    nodeId: string,
    options: GraphQueryOptions = {}
  ): string[] {
    const graph = this.graphs.get(graphId);

    if (!graph) {
      throw new Error(`Graph not found: ${graphId}`);
    }

    const result: string[] = [];
    const visited = new Set<string>();
    const queue: Array<{ nodeId: string; depth: number }> = [
      { nodeId, depth: 0 },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (visited.has(current.nodeId)) {
        continue;
      }

      if (current.depth > 0) {
        // Filter by node type if specified
        const node = graph.nodes.get(current.nodeId);
        if (options.nodeType && node?.type !== options.nodeType) {
          continue;
        }

        result.push(current.nodeId);
      }

      visited.add(current.nodeId);

      // Check max depth
      const maxDepth = options.maxDepth ?? Infinity;
      if (current.depth >= maxDepth) {
        continue;
      }

      // Get adjacent nodes
      const adjacent = graph.adjacency.get(current.nodeId) || new Set();
      for (const neighborId of adjacent) {
        // Filter by edge type if specified
        if (options.edgeType) {
          const edge = Array.from(graph.edges.values()).find(
            (e) =>
              e.sourceId === current.nodeId && e.targetId === neighborId
          );
          if (!edge || edge.type !== options.edgeType) {
            continue;
          }
        }

        if (!visited.has(neighborId) && options.transitive) {
          queue.push({ nodeId: neighborId, depth: current.depth + 1 });
        } else if (current.depth === 0 && !options.transitive) {
          result.push(neighborId);
        }
      }
    }

    return result;
  }

  /**
   * Get dependents of a node
   *
   * @param graphId - Graph ID
   * @param nodeId - Node ID
   * @param options - Query options
   * @returns Array of dependent node IDs
   */
  getDependents(
    graphId: string,
    nodeId: string,
    options: GraphQueryOptions = {}
  ): string[] {
    const graph = this.graphs.get(graphId);

    if (!graph) {
      throw new Error(`Graph not found: ${graphId}`);
    }

    const result: string[] = [];
    const visited = new Set<string>();
    const queue: Array<{ nodeId: string; depth: number }> = [
      { nodeId, depth: 0 },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (visited.has(current.nodeId)) {
        continue;
      }

      if (current.depth > 0) {
        const node = graph.nodes.get(current.nodeId);
        if (options.nodeType && node?.type !== options.nodeType) {
          continue;
        }

        result.push(current.nodeId);
      }

      visited.add(current.nodeId);

      const maxDepth = options.maxDepth ?? Infinity;
      if (current.depth >= maxDepth) {
        continue;
      }

      const adjacent = graph.reverseAdjacency.get(current.nodeId) || new Set();
      for (const neighborId of adjacent) {
        if (options.edgeType) {
          const edge = Array.from(graph.edges.values()).find(
            (e) =>
              e.sourceId === neighborId && e.targetId === current.nodeId
          );
          if (!edge || edge.type !== options.edgeType) {
            continue;
          }
        }

        if (!visited.has(neighborId) && options.transitive) {
          queue.push({ nodeId: neighborId, depth: current.depth + 1 });
        } else if (current.depth === 0 && !options.transitive) {
          result.push(neighborId);
        }
      }
    }

    return result;
  }

  /**
   * Find path between two nodes
   *
   * @param graphId - Graph ID
   * @param sourceId - Source node ID
   * @param targetId - Target node ID
   * @returns Path or undefined
   */
  findPath(
    graphId: string,
    sourceId: string,
    targetId: string
  ): GraphPath | undefined {
    const graph = this.graphs.get(graphId);

    if (!graph) {
      throw new Error(`Graph not found: ${graphId}`);
    }

    // BFS to find shortest path
    const queue: Array<{ nodeId: string; path: string[]; edges: string[] }> = [
      { nodeId: sourceId, path: [sourceId], edges: [] },
    ];
    const visited = new Set<string>([sourceId]);

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.nodeId === targetId) {
        // Calculate path weight
        let weight = 0;
        for (const edgeId of current.edges) {
          const edge = graph.edges.get(edgeId);
          if (edge) {
            weight += edge.weight;
          }
        }

        return {
          nodes: current.path,
          edges: current.edges,
          length: current.path.length - 1,
          weight,
        };
      }

      const adjacent = graph.adjacency.get(current.nodeId) || new Set();
      for (const neighborId of adjacent) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);

          const edge = Array.from(graph.edges.values()).find(
            (e) => e.sourceId === current.nodeId && e.targetId === neighborId
          );

          queue.push({
            nodeId: neighborId,
            path: [...current.path, neighborId],
            edges: edge ? [...current.edges, edge.id] : current.edges,
          });
        }
      }
    }

    return undefined;
  }

  /**
   * Find all paths between two nodes
   *
   * @param graphId - Graph ID
   * @param sourceId - Source node ID
   * @param targetId - Target node ID
   * @param maxPaths - Maximum number of paths to find
   * @returns Array of paths
   */
  findAllPaths(
    graphId: string,
    sourceId: string,
    targetId: string,
    maxPaths: number = 100
  ): GraphPath[] {
    const graph = this.graphs.get(graphId);

    if (!graph) {
      throw new Error(`Graph not found: ${graphId}`);
    }

    const paths: GraphPath[] = [];

    const dfs = (
      currentNodeId: string,
      visited: Set<string>,
      currentPath: string[],
      currentEdges: string[]
    ) => {
      if (paths.length >= maxPaths) {
        return;
      }

      if (currentNodeId === targetId) {
        let weight = 0;
        for (const edgeId of currentEdges) {
          const edge = graph.edges.get(edgeId);
          if (edge) {
            weight += edge.weight;
          }
        }

        paths.push({
          nodes: [...currentPath],
          edges: [...currentEdges],
          length: currentPath.length - 1,
          weight,
        });
        return;
      }

      const adjacent = graph.adjacency.get(currentNodeId) || new Set();
      for (const neighborId of adjacent) {
        if (!visited.has(neighborId)) {
          const edge = Array.from(graph.edges.values()).find(
            (e) => e.sourceId === currentNodeId && e.targetId === neighborId
          );

          visited.add(neighborId);
          dfs(
            neighborId,
            visited,
            [...currentPath, neighborId],
            edge ? [...currentEdges, edge.id] : currentEdges
          );
          visited.delete(neighborId);
        }
      }
    };

    dfs(sourceId, new Set([sourceId]), [sourceId], []);

    return paths;
  }

  /**
   * Perform impact analysis
   *
   * @param graphId - Graph ID
   * @param sourceId - Source node ID
   * @param maxDepth - Maximum depth to analyze
   * @returns Impact analysis result
   */
  analyzeImpact(
    graphId: string,
    sourceId: string,
    maxDepth: number = 10
  ): ImpactAnalysis {
    const graph = this.graphs.get(graphId);

    if (!graph) {
      throw new Error(`Graph not found: ${graphId}`);
    }

    const directlyAffected = this.getDependents(
      graphId,
      sourceId,
      { transitive: false }
    );

    const indirectlyAffected = this.getDependents(
      graphId,
      sourceId,
      { transitive: true, maxDepth }
    ).filter((id) => !directlyAffected.includes(id));

    // Find paths to all affected nodes
    const paths: GraphPath[] = [];
    for (const nodeId of [...directlyAffected, ...indirectlyAffected]) {
      const path = this.findPath(graphId, sourceId, nodeId);
      if (path) {
        paths.push(path);
      }
    }

    // Calculate impact score based on number of affected nodes and path lengths
    const totalAffected = directlyAffected.length + indirectlyAffected.length;
    const avgPathLength =
      paths.length > 0
        ? paths.reduce((sum, p) => sum + p.length, 0) / paths.length
        : 0;
    const impactScore = Math.min(1, (totalAffected * 0.1 + avgPathLength * 0.05));

    return {
      sourceId,
      directlyAffected,
      indirectlyAffected,
      paths,
      impactScore,
    };
  }

  /**
   * Detect cycles in graph
   *
   * @param graphId - Graph ID
   * @returns Cycle detection result
   */
  detectCycles(graphId: string): CycleDetection {
    const graph = this.graphs.get(graphId);

    if (!graph) {
      throw new Error(`Graph not found: ${graphId}`);
    }

    const cycles: string[][] = [];
    const cycleNodes = new Set<string>();
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeId: string, path: string[]): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const adjacent = graph.adjacency.get(nodeId) || new Set();
      for (const neighborId of adjacent) {
        if (!visited.has(neighborId)) {
          if (dfs(neighborId, [...path])) {
            return true;
          }
        } else if (recursionStack.has(neighborId)) {
          // Found a cycle
          const cycleStart = path.indexOf(neighborId);
          const cycle = path.slice(cycleStart);
          cycles.push(cycle);
          cycle.forEach((id) => cycleNodes.add(id));
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const nodeId of graph.nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId, []);
      }
    }

    return {
      hasCycles: cycles.length > 0,
      cycles,
      cycleNodes,
    };
  }

  /**
   * Get strongly connected components
   *
   * @param graphId - Graph ID
   * @returns Array of strongly connected components
   */
  getStronglyConnectedComponents(graphId: string): string[][] {
    const graph = this.graphs.get(graphId);

    if (!graph) {
      throw new Error(`Graph not found: ${graphId}`);
    }

    const components: string[][] = [];
    const visited = new Set<string>();
    const order: string[] = [];

    // First pass: fill order
    const dfs1 = (nodeId: string) => {
      visited.add(nodeId);
      const adjacent = graph.adjacency.get(nodeId) || new Set();
      for (const neighborId of adjacent) {
        if (!visited.has(neighborId)) {
          dfs1(neighborId);
        }
      }
      order.push(nodeId);
    };

    for (const nodeId of graph.nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs1(nodeId);
      }
    }

    // Second pass: find components in reverse graph
    visited.clear();
    const reversedOrder = [...order].reverse();

    const dfs2 = (nodeId: string, component: string[]) => {
      visited.add(nodeId);
      component.push(nodeId);
      const adjacent = graph.reverseAdjacency.get(nodeId) || new Set();
      for (const neighborId of adjacent) {
        if (!visited.has(neighborId)) {
          dfs2(neighborId, component);
        }
      }
    };

    for (const nodeId of reversedOrder) {
      if (!visited.has(nodeId)) {
        const component: string[] = [];
        dfs2(nodeId, component);
        components.push(component);
      }
    }

    return components;
  }

  /**
   * Get topological sort of graph
   *
   * @param graphId - Graph ID
   * @returns Array of node IDs in topological order
   */
  getTopologicalSort(graphId: string): string[] {
    const graph = this.graphs.get(graphId);

    if (!graph) {
      throw new Error(`Graph not found: ${graphId}`);
    }

    const inDegree = new Map<string, number>();
    for (const nodeId of graph.nodes.keys()) {
      inDegree.set(nodeId, 0);
    }

    for (const edge of graph.edges.values()) {
      inDegree.set(edge.targetId, (inDegree.get(edge.targetId) || 0) + 1);
    }

    const queue: string[] = [];
    for (const [nodeId, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    const result: string[] = [];
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      result.push(nodeId);

      const adjacent = graph.adjacency.get(nodeId) || new Set();
      for (const neighborId of adjacent) {
        inDegree.set(neighborId, (inDegree.get(neighborId) || 1) - 1);
        if (inDegree.get(neighborId) === 0) {
          queue.push(neighborId);
        }
      }
    }

    // Check for cycles
    if (result.length !== graph.nodes.size) {
      this.logger.warn(
        `Graph ${graphId} contains cycles, topological sort incomplete`,
        'DependencyGraphQueries'
      );
    }

    return result;
  }

  /**
   * Get graph statistics
   *
   * @param graphId - Graph ID
   * @returns Graph statistics
   */
  getStatistics(graphId: string): {
    nodeCount: number;
    edgeCount: number;
    avgDegree: number;
    maxDegree: number;
    isDense: boolean;
  } {
    const graph = this.graphs.get(graphId);

    if (!graph) {
      throw new Error(`Graph not found: ${graphId}`);
    }

    const nodeCount = graph.nodes.size;
    const edgeCount = graph.edges.size;

    const degrees: number[] = [];
    for (const adjacent of graph.adjacency.values()) {
      degrees.push(adjacent.size);
    }

    const avgDegree =
      degrees.length > 0 ? degrees.reduce((a, b) => a + b, 0) / degrees.length : 0;
    const maxDegree = degrees.length > 0 ? Math.max(...degrees) : 0;

    const maxPossibleEdges = nodeCount * (nodeCount - 1);
    const isDense = maxPossibleEdges > 0 && edgeCount / maxPossibleEdges > 0.5;

    return {
      nodeCount,
      edgeCount,
      avgDegree,
      maxDegree,
      isDense,
    };
  }

  /**
   * Clear all graphs
   */
  clearGraphs(): void {
    this.graphs.clear();
    this.activeGraphId = null;
    this.logger.debug('All graphs cleared', 'DependencyGraphQueries');
  }

  /**
   * Get all graphs
   *
   * @returns Map of graph IDs to graphs
   */
  getAllGraphs(): Map<string, DependencyGraph> {
    return new Map(this.graphs);
  }

  /**
   * Hash a string to a numeric value
   *
   * @param str - String to hash
   * @returns Hash value
   */
  private hash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

/**
 * Schema for graph query options
 */
export const GraphQueryOptionsSchema = z.object({
  transitive: z.boolean().optional(),
  maxDepth: z.number().min(1).optional(),
  edgeType: z.nativeEnum(GraphEdgeType).optional(),
  nodeType: z.nativeEnum(GraphNodeType).optional(),
});

/**
 * Global dependency graph queries instance
 */
let globalGraphQueries: DependencyGraphQueries | null = null;

/**
 * Initialize global dependency graph queries
 *
 * @param options - Options
 * @returns The global dependency graph queries
 */
export function initDependencyGraphQueries(options?: {
  logger?: Logger;
  cacheEnabled?: boolean;
}): DependencyGraphQueries {
  globalGraphQueries = new DependencyGraphQueries(options);
  return globalGraphQueries;
}

/**
 * Get global dependency graph queries
 *
 * @returns The global dependency graph queries
 */
export function getDependencyGraphQueries(): DependencyGraphQueries {
  if (!globalGraphQueries) {
    globalGraphQueries = new DependencyGraphQueries();
  }
  return globalGraphQueries;
}
