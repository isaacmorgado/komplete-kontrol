/**
 * Task Execution Module for KOMPLETE-KONTROL CLI
 *
 * Provides task planning, decomposition, execution, result aggregation,
 * and dependency resolution capabilities for agent workflows.
 *
 * This module exports:
 * - TaskPlanner: Task planning and decomposition
 * - TaskExecutor: Task execution framework
 * - TaskResultAggregator: Result aggregation
 * - TaskDependencyResolver: Dependency resolution
 */

// Task planning and decomposition
export {
  TaskPlanner,
  type TaskPlan,
  type TaskDecompositionOptions,
  type Subtask,
  type TaskDependency,
  createTaskPlanner,
  getTaskPlanner,
} from './planner';

// Task execution framework
export {
  TaskExecutor,
  TimeoutError,
  type TaskExecutionOptions,
  type TaskExecutionResult,
  type TaskExecutionStatus,
  type TaskExecutionContext,
  type TaskExecutionConfig,
  createTaskExecutor,
  getTaskExecutor,
} from './executor';

// Task result aggregation
export {
  TaskResultAggregator,
  type AggregatedResult,
  type AggregationStrategy,
  type AggregationOptions,
  createTaskResultAggregator,
  getTaskResultAggregator,
} from './aggregator';

// Task dependency resolution
export {
  TaskDependencyResolver,
  type ResolutionResult,
  type DependencyValidationOptions,
  createTaskDependencyResolver,
  getTaskDependencyResolver,
} from './dependency-resolver';

// Re-export types from main types file
export type {
  Task,
  TaskPriority,
  TaskStatus,
  TaskResult,
  TaskError,
} from '../../types';
