/**
 * Runtime Supervisor
 *
 * Monitors code execution, detects failures, and provides
 * real-time execution metrics and anomaly detection.
 */

import { z } from 'zod';
import { Logger } from '../../utils/logger';
import type { ExecutionResult, ErrorInfo } from './loop';

/**
 * Execution status
 */
export enum ExecutionStatus {
  /**
   * Pending execution
   */
  PENDING = 'pending',

  /**
   * Currently running
   */
  RUNNING = 'running',

  /**
   * Successfully completed
   */
  SUCCESS = 'success',

  /**
   * Failed with error
   */
  FAILED = 'failed',

  /**
   * Timed out
   */
  TIMEOUT = 'timeout',

  /**
   * Cancelled by user
   */
  CANCELLED = 'cancelled',
}

/**
 * Execution metrics
 */
export interface ExecutionMetrics {
  /**
   * Execution ID
   */
  executionId: string;

  /**
   * Start time
   */
  startTime: number;

  /**
   * End time
   */
  endTime?: number;

  /**
   * Total duration (ms)
   */
  duration?: number;

  /**
   * CPU time (ms)
   */
  cpuTime?: number;

  /**
   * Memory used (bytes)
   */
  memoryUsed?: number;

  /**
   * Peak memory (bytes)
   */
  peakMemory?: number;

  /**
   * Status
   */
  status: ExecutionStatus;

  /**
   * Exit code
   */
  exitCode?: number;

  /**
   * Error count
   */
  errorCount: number;

  /**
   * Warning count
   */
  warningCount: number;
}

/**
 * Supervision event
 */
export interface SupervisionEvent {
  /**
   * Event ID
   */
  id: string;

  /**
   * Event type
   */
  type: 'start' | 'progress' | 'error' | 'warning' | 'complete' | 'timeout' | 'cancel';

  /**
   * Execution ID
   */
  executionId: string;

  /**
   * Timestamp
   */
  timestamp: number;

  /**
   * Message
   */
  message: string;

  /**
   * Data
   */
  data?: Record<string, unknown>;

  /**
   * Severity
   */
  severity: 'info' | 'warning' | 'error' | 'critical';
}

/**
 * Anomaly detection result
 */
export interface AnomalyDetection {
  /**
   * Is anomalous
   */
  isAnomaly: boolean;

  /**
   * Anomaly type
   */
  type?: 'performance' | 'memory' | 'error' | 'timeout';

  /**
   * Confidence score (0-1)
   */
  confidence: number;

  /**
   * Description
   */
  description: string;

  /**
   * Recommended action
   */
  recommendedAction?: string;

  /**
   * Historical baseline
   */
  baseline?: {
    avgDuration: number;
    avgMemory: number;
    avgErrorRate: number;
  };
}

/**
 * Supervisor options
 */
export interface SupervisorOptions {
  /**
   * Execution timeout (ms)
   */
  timeout?: number;

  /**
   * Enable anomaly detection
   */
  enableAnomalyDetection?: boolean;

  /**
   * Memory limit (bytes)
   */
  memoryLimit?: number;

  /**
   * CPU time limit (ms)
   */
  cpuTimeLimit?: number;

  /**
   * Enable real-time monitoring
   */
  enableRealTimeMonitoring?: boolean;

  /**
   * Monitoring interval (ms)
   */
  monitoringInterval?: number;

  /**
   * Record execution history
   */
  recordHistory?: boolean;

  /**
   * Max history size
   */
  maxHistorySize?: number;
}

/**
 * Execution context
 */
interface ExecutionContext {
  /**
   * Execution ID
   */
  id: string;

  /**
   * Code being executed
   */
  code: string;

  /**
   * Metrics
   */
  metrics: ExecutionMetrics;

  /**
   * Events
   */
  events: SupervisionEvent[];

  /**
   * Start time
   */
  startTime: number;

  /**
   * Timeout handle
   */
  timeoutHandle?: Timer;

  /**
   * Monitoring interval handle
   */
  monitoringHandle?: Timer;

  /**
   * Is cancelled
   */
  cancelled: boolean;
}

/**
 * Runtime Supervisor class
 *
 * Supervises code execution with monitoring and anomaly detection.
 */
export class RuntimeSupervisor {
  private logger: Logger;
  private options: Required<SupervisorOptions>;
  private executions: Map<string, ExecutionContext> = new Map();
  private history: ExecutionMetrics[] = [];
  private listeners: Map<
    string,
    ((event: SupervisionEvent) => void)[]
  > = new Map();

  constructor(options: SupervisorOptions = {}) {
    this.logger = new Logger();

    this.options = {
      timeout: options.timeout || 30000,
      enableAnomalyDetection: options.enableAnomalyDetection ?? true,
      memoryLimit: options.memoryLimit || 1024 * 1024 * 1024, // 1GB
      cpuTimeLimit: options.cpuTimeLimit || 60000, // 60s
      enableRealTimeMonitoring: options.enableRealTimeMonitoring ?? true,
      monitoringInterval: options.monitoringInterval || 1000,
      recordHistory: options.recordHistory ?? true,
      maxHistorySize: options.maxHistorySize || 1000,
    };

    this.logger.info('RuntimeSupervisor initialized', 'RuntimeSupervisor');
  }

  /**
   * Supervise code execution
   *
   * @param code - Code to execute
   * @param executor - Executor function
   * @returns Execution result with metrics
   */
  async supervise(
    code: string,
    executor: () => Promise<ExecutionResult>
  ): Promise<ExecutionResult & { metrics: ExecutionMetrics; anomaly?: AnomalyDetection }> {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const context: ExecutionContext = {
      id: executionId,
      code,
      metrics: {
        executionId,
        startTime: Date.now(),
        status: ExecutionStatus.PENDING,
        errorCount: 0,
        warningCount: 0,
      },
      events: [],
      startTime: Date.now(),
      cancelled: false,
    };

    this.executions.set(executionId, context);

    try {
      // Emit start event
      this.emitEvent(context, {
        type: 'start',
        message: 'Execution started',
        severity: 'info',
      });

      // Update status
      context.metrics.status = ExecutionStatus.RUNNING;

      // Setup timeout
      if (this.options.timeout > 0) {
        context.timeoutHandle = setTimeout(() => {
          this.handleTimeout(context);
        }, this.options.timeout);
      }

      // Setup monitoring
      if (this.options.enableRealTimeMonitoring) {
        context.monitoringHandle = setInterval(() => {
          this.monitorExecution(context);
        }, this.options.monitoringInterval);
      }

      // Execute code
      const result = await executor();

      // Check if cancelled
      if (context.cancelled) {
        context.metrics.status = ExecutionStatus.CANCELLED;
        return {
          ...result,
          success: false,
          metrics: context.metrics,
        };
      }

      // Update metrics
      context.metrics.endTime = Date.now();
      context.metrics.duration = context.metrics.endTime - context.metrics.startTime;
      context.metrics.exitCode = result.exitCode;
      context.metrics.status = result.success
        ? ExecutionStatus.SUCCESS
        : ExecutionStatus.FAILED;

      // Count errors and warnings
      if (result.stderr) {
        context.metrics.errorCount += (result.stderr.match(/error/gi) || []).length;
        context.metrics.warningCount += (result.stderr.match(/warning/gi) || []).length;
      }

      // Emit complete event
      this.emitEvent(context, {
        type: 'complete',
        message: result.success ? 'Execution completed successfully' : 'Execution failed',
        severity: result.success ? 'info' : 'error',
        data: {
          duration: context.metrics.duration,
          exitCode: result.exitCode,
        },
      });

      // Detect anomalies
      let anomaly: AnomalyDetection | undefined;
      if (this.options.enableAnomalyDetection) {
        anomaly = this.detectAnomalies(context.metrics);
      }

      // Record history
      if (this.options.recordHistory) {
        this.recordExecution(context.metrics);
      }

      return {
        ...result,
        metrics: context.metrics,
        anomaly,
      };
    } catch (error) {
      context.metrics.endTime = Date.now();
      context.metrics.duration = context.metrics.endTime - context.metrics.startTime;
      context.metrics.status = ExecutionStatus.FAILED;
      context.metrics.errorCount++;

      this.emitEvent(context, {
        type: 'error',
        message: `Execution failed: ${(error as Error).message}`,
        severity: 'critical',
        data: {
          error: (error as Error).message,
          stack: (error as Error).stack,
        },
      });

      return {
        success: false,
        stdout: '',
        stderr: (error as Error).message,
        executionTime: context.metrics.duration,
        error: error as Error,
        metrics: context.metrics,
      };
    } finally {
      // Cleanup
      this.cleanup(context);
    }
  }

  /**
   * Cancel execution
   *
   * @param executionId - Execution ID
   * @returns Success
   */
  cancelExecution(executionId: string): boolean {
    const context = this.executions.get(executionId);

    if (!context) {
      return false;
    }

    context.cancelled = true;
    context.metrics.status = ExecutionStatus.CANCELLED;

    this.emitEvent(context, {
      type: 'cancel',
      message: 'Execution cancelled by user',
      severity: 'warning',
    });

    this.cleanup(context);

    return true;
  }

  /**
   * Get execution metrics
   *
   * @param executionId - Execution ID
   * @returns Metrics or undefined
   */
  getMetrics(executionId: string): ExecutionMetrics | undefined {
    const context = this.executions.get(executionId);
    return context?.metrics;
  }

  /**
   * Get execution events
   *
   * @param executionId - Execution ID
   * @returns Events array
   */
  getEvents(executionId: string): SupervisionEvent[] {
    const context = this.executions.get(executionId);
    return context?.events || [];
  }

  /**
   * Get execution history
   *
   * @param limit - Maximum number of items
   * @returns History array
   */
  getHistory(limit?: number): ExecutionMetrics[] {
    if (limit) {
      return this.history.slice(-limit);
    }
    return [...this.history];
  }

  /**
   * Get historical statistics
   *
   * @returns Statistics
   */
  getStatistics(): {
    totalExecutions: number;
    successRate: number;
    avgDuration: number;
    avgMemory: number;
    avgErrorRate: number;
  } {
    if (this.history.length === 0) {
      return {
        totalExecutions: 0,
        successRate: 0,
        avgDuration: 0,
        avgMemory: 0,
        avgErrorRate: 0,
      };
    }

    const successCount = this.history.filter(
      (m) => m.status === ExecutionStatus.SUCCESS
    ).length;

    const totalDuration = this.history.reduce(
      (sum, m) => sum + (m.duration || 0),
      0
    );

    const totalMemory = this.history.reduce(
      (sum, m) => sum + (m.memoryUsed || 0),
      0
    );

    const totalErrors = this.history.reduce(
      (sum, m) => sum + m.errorCount,
      0
    );

    return {
      totalExecutions: this.history.length,
      successRate: successCount / this.history.length,
      avgDuration: totalDuration / this.history.length,
      avgMemory: totalMemory / this.history.length,
      avgErrorRate: totalErrors / this.history.length,
    };
  }

  /**
   * Clear execution history
   */
  clearHistory(): void {
    this.history = [];
    this.logger.debug('Execution history cleared', 'RuntimeSupervisor');
  }

  /**
   * Add event listener
   *
   * @param executionId - Execution ID
   * @param listener - Event listener
   */
  addEventListener(
    executionId: string,
    listener: (event: SupervisionEvent) => void
  ): void {
    if (!this.listeners.has(executionId)) {
      this.listeners.set(executionId, []);
    }

    this.listeners.get(executionId)!.push(listener);
  }

  /**
   * Remove event listener
   *
   * @param executionId - Execution ID
   * @param listener - Event listener
   */
  removeEventListener(
    executionId: string,
    listener: (event: SupervisionEvent) => void
  ): void {
    const listeners = this.listeners.get(executionId);

    if (!listeners) {
      return;
    }

    const index = listeners.indexOf(listener);

    if (index !== -1) {
      listeners.splice(index, 1);
    }
  }

  /**
   * Emit supervision event
   *
   * @param context - Execution context
   * @param eventData - Event data
   */
  private emitEvent(
    context: ExecutionContext,
    eventData: {
      type: SupervisionEvent['type'];
      message: string;
      severity: SupervisionEvent['severity'];
      data?: Record<string, unknown>;
    }
  ): void {
    const event: SupervisionEvent = {
      id: `event_${Date.now()}`,
      executionId: context.id,
      timestamp: Date.now(),
      ...eventData,
    };

    context.events.push(event);

    // Notify listeners
    const listeners = this.listeners.get(context.id);

    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (error) {
          this.logger.error('Error in event listener', 'RuntimeSupervisor', {
            error: (error as Error).message,
          });
        }
      }
    }

    // Log event
    const logLevel = eventData.severity === 'error' || eventData.severity === 'critical'
      ? 'error'
      : eventData.severity === 'warning'
        ? 'warn'
        : 'debug';

    this.logger[logLevel](eventData.message, 'RuntimeSupervisor', {
      executionId: context.id,
      type: eventData.type,
    });
  }

  /**
   * Monitor execution
   *
   * @param context - Execution context
   */
  private monitorExecution(context: ExecutionContext): void {
    // Check memory usage
    const memUsage = process.memoryUsage();
    context.metrics.memoryUsed = memUsage.heapUsed;
    context.metrics.peakMemory = Math.max(
      context.metrics.peakMemory || 0,
      memUsage.heapUsed
    );

    // Check memory limit
    if (
      this.options.memoryLimit > 0 &&
      context.metrics.memoryUsed > this.options.memoryLimit
    ) {
      this.emitEvent(context, {
        type: 'warning',
        message: `Memory limit exceeded: ${Math.round(context.metrics.memoryUsed / 1024 / 1024)}MB`,
        severity: 'warning',
        data: {
          memoryUsed: context.metrics.memoryUsed,
          memoryLimit: this.options.memoryLimit,
        },
      });
    }

    // Check CPU time
    const cpuTime = Date.now() - context.startTime;
    context.metrics.cpuTime = cpuTime;

    if (
      this.options.cpuTimeLimit > 0 &&
      cpuTime > this.options.cpuTimeLimit
    ) {
      this.emitEvent(context, {
        type: 'warning',
        message: `CPU time limit exceeded: ${Math.round(cpuTime / 1000)}s`,
        severity: 'warning',
        data: {
          cpuTime,
          cpuTimeLimit: this.options.cpuTimeLimit,
        },
      });
    }

    // Emit progress event
    this.emitEvent(context, {
      type: 'progress',
      message: 'Execution in progress',
      severity: 'info',
      data: {
        duration: cpuTime,
        memoryUsed: context.metrics.memoryUsed,
      },
    });
  }

  /**
   * Handle execution timeout
   *
   * @param context - Execution context
   */
  private handleTimeout(context: ExecutionContext): void {
    context.metrics.status = ExecutionStatus.TIMEOUT;
    context.cancelled = true;

    this.emitEvent(context, {
      type: 'timeout',
      message: `Execution timed out after ${this.options.timeout}ms`,
      severity: 'error',
      data: {
        timeout: this.options.timeout,
      },
    });
  }

  /**
   * Detect anomalies
   *
   * @param metrics - Execution metrics
   * @returns Anomaly detection result
   */
  private detectAnomalies(metrics: ExecutionMetrics): AnomalyDetection {
    const stats = this.getStatistics();

    // Need at least 10 executions for meaningful anomaly detection
    if (stats.totalExecutions < 10) {
      return {
        isAnomaly: false,
        confidence: 0,
        description: 'Insufficient historical data for anomaly detection',
      };
    }

    // Check duration anomaly
    if (metrics.duration && metrics.duration > stats.avgDuration * 3) {
      return {
        isAnomaly: true,
        type: 'performance',
        confidence: 0.8,
        description: `Execution took ${Math.round(metrics.duration / stats.avgDuration)}x longer than average`,
        recommendedAction: 'Review code for performance bottlenecks',
        baseline: {
          avgDuration: stats.avgDuration,
          avgMemory: stats.avgMemory,
          avgErrorRate: stats.avgErrorRate,
        },
      };
    }

    // Check memory anomaly
    if (metrics.memoryUsed && metrics.memoryUsed > stats.avgMemory * 3) {
      return {
        isAnomaly: true,
        type: 'memory',
        confidence: 0.8,
        description: `Execution used ${Math.round(metrics.memoryUsed / stats.avgMemory)}x more memory than average`,
        recommendedAction: 'Check for memory leaks or excessive allocations',
        baseline: {
          avgDuration: stats.avgDuration,
          avgMemory: stats.avgMemory,
          avgErrorRate: stats.avgErrorRate,
        },
      };
    }

    // Check error anomaly
    if (metrics.errorCount > stats.avgErrorRate * 2) {
      return {
        isAnomaly: true,
        type: 'error',
        confidence: 0.7,
        description: `Execution had ${Math.round(metrics.errorCount / stats.avgErrorRate)}x more errors than average`,
        recommendedAction: 'Review error logs and fix recurring issues',
        baseline: {
          avgDuration: stats.avgDuration,
          avgMemory: stats.avgMemory,
          avgErrorRate: stats.avgErrorRate,
        },
      };
    }

    // Check timeout
    if (metrics.status === ExecutionStatus.TIMEOUT) {
      return {
        isAnomaly: true,
        type: 'timeout',
        confidence: 1.0,
        description: 'Execution timed out',
        recommendedAction: 'Increase timeout or optimize code',
        baseline: {
          avgDuration: stats.avgDuration,
          avgMemory: stats.avgMemory,
          avgErrorRate: stats.avgErrorRate,
        },
      };
    }

    return {
      isAnomaly: false,
      confidence: 0,
      description: 'No anomalies detected',
    };
  }

  /**
   * Record execution in history
   *
   * @param metrics - Execution metrics
   */
  private recordExecution(metrics: ExecutionMetrics): void {
    this.history.push(metrics);

    // Trim history if needed
    if (this.history.length > this.options.maxHistorySize) {
      this.history = this.history.slice(-this.options.maxHistorySize);
    }
  }

  /**
   * Cleanup execution
   *
   * @param context - Execution context
   */
  private cleanup(context: ExecutionContext): void {
    // Clear timeout
    if (context.timeoutHandle) {
      clearTimeout(context.timeoutHandle);
    }

    // Clear monitoring interval
    if (context.monitoringHandle) {
      clearInterval(context.monitoringHandle);
    }

    // Remove from active executions
    this.executions.delete(context.id);

    // Remove listeners
    this.listeners.delete(context.id);
  }
}

/**
 * Schema for supervisor options
 */
export const SupervisorOptionsSchema = z.object({
  timeout: z.number().min(0).optional(),
  enableAnomalyDetection: z.boolean().optional(),
  memoryLimit: z.number().min(0).optional(),
  cpuTimeLimit: z.number().min(0).optional(),
  enableRealTimeMonitoring: z.boolean().optional(),
  monitoringInterval: z.number().min(100).optional(),
  recordHistory: z.boolean().optional(),
  maxHistorySize: z.number().min(1).max(10000).optional(),
});

/**
 * Global runtime supervisor instance
 */
let globalRuntimeSupervisor: RuntimeSupervisor | null = null;

/**
 * Initialize global runtime supervisor
 *
 * @param options - Options
 * @returns The global runtime supervisor
 */
export function initRuntimeSupervisor(
  options?: SupervisorOptions
): RuntimeSupervisor {
  globalRuntimeSupervisor = new RuntimeSupervisor(options);
  return globalRuntimeSupervisor;
}

/**
 * Get global runtime supervisor
 *
 * @returns The global runtime supervisor
 */
export function getRuntimeSupervisor(): RuntimeSupervisor {
  if (!globalRuntimeSupervisor) {
    globalRuntimeSupervisor = new RuntimeSupervisor();
  }
  return globalRuntimeSupervisor;
}
