/**
 * Task Result Aggregator - Result Aggregation
 *
 * Provides result aggregation capabilities including:
 * - Multiple aggregation strategies
 * - Result merging and combination
 * - Error handling
 * - Result validation
 */

import { Logger, LoggerLike } from '../../utils/logger';
import type { TaskExecutionResult } from './executor';

/**
 * Aggregation strategy type
 */
export type AggregationStrategy =
  | 'merge'
  | 'concat'
  | 'sum'
  | 'average'
  | 'latest'
  | 'first-success'
  | 'majority-vote';

/**
 * Aggregated result
 */
export interface AggregatedResult {
  /** Aggregated data */
  data: unknown;
  /** Strategy used */
  strategy: AggregationStrategy;
  /** Number of results aggregated */
  count: number;
  /** Success count */
  successCount: number;
  /** Failure count */
  failureCount: number;
  /** Aggregation metadata */
  metadata: {
    /** Individual results */
    results: TaskExecutionResult[];
    /** Aggregation timestamp */
    timestamp: string;
  };
}

/**
 * Aggregation options
 */
export interface AggregationOptions {
  /** Aggregation strategy */
  strategy?: AggregationStrategy;
  /** Include failed results */
  includeFailed?: boolean;
  /** Custom aggregation function */
  customAggregator?: (results: TaskExecutionResult[]) => unknown;
  /** Validate results before aggregation */
  validateResults?: (result: unknown) => boolean;
}

/**
 * Task result aggregator for aggregating execution results
 *
 * Features:
 * - Multiple aggregation strategies
 * - Result validation
 * - Error handling
 * - Metadata tracking
 */
export class TaskResultAggregator {
  private logger: LoggerLike;

  constructor(logger?: LoggerLike) {
    this.logger = logger?.child('TaskResultAggregator') ?? new Logger().child('TaskResultAggregator');
  }

  /**
   * Aggregate execution results
   *
   * @param results - Execution results to aggregate
   * @param options - Aggregation options
   * @returns Aggregated result
   */
  aggregate(
    results: TaskExecutionResult[],
    options: AggregationOptions = {}
  ): AggregatedResult {
    const {
      strategy = 'merge',
      includeFailed = false,
      customAggregator,
      validateResults,
    } = options;

    this.logger.info(`Aggregating ${results.length} results with strategy: ${strategy}`);

    // Filter results
    const filteredResults = includeFailed
      ? results
      : results.filter(r => r.status === 'completed');

    // Validate results if validator provided
    const validResults = validateResults
      ? filteredResults.filter(r => validateResults(r.result))
      : filteredResults;

    // Use custom aggregator if provided
    if (customAggregator) {
      const data = customAggregator(validResults);
      return this.createAggregatedResult(data, strategy, validResults);
    }

    // Apply strategy
    const data = this.applyStrategy(validResults, strategy);

    return this.createAggregatedResult(data, strategy, validResults);
  }

  /**
   * Apply aggregation strategy
   *
   * @param results - Valid execution results
   * @param strategy - Aggregation strategy
   * @returns Aggregated data
   */
  private applyStrategy(
    results: TaskExecutionResult[],
    strategy: AggregationStrategy
  ): unknown {
    switch (strategy) {
      case 'merge':
        return this.mergeStrategy(results);
      case 'concat':
        return this.concatStrategy(results);
      case 'sum':
        return this.sumStrategy(results);
      case 'average':
        return this.averageStrategy(results);
      case 'latest':
        return this.latestStrategy(results);
      case 'first-success':
        return this.firstSuccessStrategy(results);
      case 'majority-vote':
        return this.majorityVoteStrategy(results);
      default:
        return this.mergeStrategy(results);
    }
  }

  /**
   * Merge strategy - combine objects
   */
  private mergeStrategy(results: TaskExecutionResult[]): unknown {
    const merged: Record<string, unknown> = {};

    for (const result of results) {
      if (result.result && typeof result.result === 'object') {
        Object.assign(merged, result.result);
      }
    }

    return merged;
  }

  /**
   * Concat strategy - combine arrays
   */
  private concatStrategy(results: TaskExecutionResult[]): unknown {
    const arrays: unknown[] = [];

    for (const result of results) {
      if (Array.isArray(result.result)) {
        arrays.push(...result.result);
      }
    }

    return arrays;
  }

  /**
   * Sum strategy - sum numeric values
   */
  private sumStrategy(results: TaskExecutionResult[]): unknown {
    let sum = 0;

    for (const result of results) {
      if (typeof result.result === 'number') {
        sum += result.result;
      }
    }

    return sum;
  }

  /**
   * Average strategy - average numeric values
   */
  private averageStrategy(results: TaskExecutionResult[]): unknown {
    const numericResults = results
      .map(r => r.result)
      .filter((r): r is number => typeof r === 'number');

    if (numericResults.length === 0) {
      return 0;
    }

    const sum = numericResults.reduce((a, b) => a + b, 0);
    return sum / numericResults.length;
  }

  /**
   * Latest strategy - return most recent result
   */
  private latestStrategy(results: TaskExecutionResult[]): unknown {
    if (results.length === 0) {
      return null;
    }

    const sorted = [...results].sort((a, b) => {
      const aTime = a.subtaskResults?.size || 0;
      const bTime = b.subtaskResults?.size || 0;
      return bTime - aTime;
    });

    return sorted[0]?.result ?? null;
  }

  /**
   * First success strategy - return first successful result
   */
  private firstSuccessStrategy(results: TaskExecutionResult[]): unknown {
    const firstSuccess = results.find(r => r.status === 'completed');

    return firstSuccess?.result ?? null;
  }

  /**
   * Majority vote strategy - return most common result
   */
  private majorityVoteStrategy(results: TaskExecutionResult[]): unknown {
    const resultMap = new Map<string, number>();

    for (const result of results) {
      const key = JSON.stringify(result.result);
      const count = resultMap.get(key) ?? 0;
      resultMap.set(key, count + 1);
    }

    let maxCount = 0;
    let majorityResult: unknown = null;

    for (const [key, count] of resultMap.entries()) {
      if (count > maxCount) {
        maxCount = count;
        majorityResult = JSON.parse(key);
      }
    }

    return majorityResult;
  }

  /**
   * Create aggregated result object
   */
  private createAggregatedResult(
    data: unknown,
    strategy: AggregationStrategy,
    results: TaskExecutionResult[]
  ): AggregatedResult {
    const successCount = results.filter(r => r.status === 'completed').length;
    const failureCount = results.length - successCount;

    return {
      data,
      strategy,
      count: results.length,
      successCount,
      failureCount,
      metadata: {
        results,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Aggregate subtask results
   *
   * @param subtaskResults - Map of subtask results
   * @returns Aggregated subtask results
   */
  aggregateSubtasks(
    subtaskResults: Map<string, TaskExecutionResult>
  ): AggregatedResult {
    const results = Array.from(subtaskResults.values());

    return this.aggregate(results, {
      strategy: 'merge',
      includeFailed: false,
    });
  }

  /**
   * Aggregate multiple aggregation results
   *
   * @param aggregations - Array of aggregation results
   * @returns Combined aggregation result
   */
  aggregateMultiple(
    aggregations: AggregatedResult[]
  ): AggregatedResult {
    this.logger.info(`Aggregating ${aggregations.length} aggregation results`);

    const allResults = aggregations.flatMap(a => a.metadata.results);
    const totalSuccess = aggregations.reduce((sum, a) => sum + a.successCount, 0);
    const totalFailure = aggregations.reduce((sum, a) => sum + a.failureCount, 0);

    return {
      data: aggregations.map(a => a.data),
      strategy: 'merge',
      count: aggregations.length,
      successCount: totalSuccess,
      failureCount: totalFailure,
      metadata: {
        results: allResults,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Validate aggregation result
   *
   * @param result - Aggregated result to validate
   * @returns True if valid
   */
  validateResult(result: AggregatedResult): boolean {
    // Basic validation
    if (!result) {
      return false;
    }

    if (result.count === 0) {
      this.logger.warn('Aggregated result has no items');
      return false;
    }

    // Check if all results failed
    if (result.successCount === 0 && result.failureCount > 0) {
      this.logger.warn('All results failed');
      return false;
    }

    return true;
  }

  /**
   * Get aggregation statistics
   *
   * @param aggregations - Array of aggregation results
   * @returns Statistics
   */
  getStatistics(aggregations: AggregatedResult[]): {
    totalAggregations: number;
    totalResults: number;
    averageSuccessRate: number;
    strategies: Map<AggregationStrategy, number>;
  } {
    const totalAggregations = aggregations.length;
    const totalResults = aggregations.reduce((sum, a) => sum + a.count, 0);
    const totalSuccess = aggregations.reduce((sum, a) => sum + a.successCount, 0);
    const averageSuccessRate = totalResults > 0
      ? (totalSuccess / totalResults) * 100
      : 0;

    const strategies = new Map<AggregationStrategy, number>();

    for (const agg of aggregations) {
      const count = strategies.get(agg.strategy) ?? 0;
      strategies.set(agg.strategy, count + 1);
    }

    return {
      totalAggregations,
      totalResults,
      averageSuccessRate,
      strategies,
    };
  }
}

/**
 * Create a task result aggregator instance
 *
 * @param logger - Logger instance
 * @returns Task result aggregator instance
 */
export function createTaskResultAggregator(
  logger?: Logger
): TaskResultAggregator {
  return new TaskResultAggregator(logger);
}

/**
 * Get global task result aggregator instance
 *
 * @returns Global task result aggregator
 */
let globalTaskResultAggregator: TaskResultAggregator | null = null;

export function getTaskResultAggregator(): TaskResultAggregator {
  if (!globalTaskResultAggregator) {
    globalTaskResultAggregator = createTaskResultAggregator();
  }
  return globalTaskResultAggregator;
}
