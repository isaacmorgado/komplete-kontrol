/**
 * Hook System - Before/After/Finally Hooks
 *
 * Provides hook capabilities for intercepting and augmenting execution:
 * - Before hooks: Execute before an operation
 * - After hooks: Execute after successful operation
 * - Finally hooks: Always execute (even on failure)
 * - Error hooks: Execute on failure
 */

import { Logger } from '../../utils/logger';

/**
 * Hook type
 */
export enum HookType {
  /** Execute before operation */
  BEFORE = 'before',
  /** Execute after successful operation */
  AFTER = 'after',
  /** Always execute (even on failure) */
  FINALLY = 'finally',
  /** Execute on operation failure */
  ERROR = 'error',
}

/**
 * Hook priority (lower = earlier execution)
 */
export enum HookPriority {
  /** Highest priority (execute first) */
  HIGHEST = 0,
  /** High priority */
  HIGH = 25,
  /** Normal priority (default) */
  NORMAL = 50,
  /** Low priority */
  LOW = 75,
  /** Lowest priority (execute last) */
  LOWEST = 100,
}

/**
 * Hook context passed to hook functions
 */
export interface HookContext {
  /** Operation name */
  operation: string;
  /** Input parameters */
  params: Record<string, unknown>;
  /** Current result (for after/finally hooks) */
  result?: unknown;
  /** Error (for error/finally hooks) */
  error?: Error;
  /** Hook metadata */
  metadata: {
    /** Start time */
    startTime: number;
    /** Execution time (ms) */
    executionTime?: number;
    /** Hook execution count */
    executionCount: number;
  };
  /** Shared state between hooks */
  state: Map<string, unknown>;
}

/**
 * Hook function signature
 */
export type HookFunction = (context: HookContext) => Promise<void> | void;

/**
 * Hook definition
 */
export interface Hook {
  /** Hook ID */
  id: string;
  /** Hook type */
  type: HookType;
  /** Operation pattern (glob-style) */
  operationPattern: string;
  /** Hook function */
  fn: HookFunction;
  /** Priority */
  priority: HookPriority;
  /** Enabled */
  enabled: boolean;
  /** Max execution time (ms) */
  timeout?: number;
  /** Description */
  description?: string;
}

/**
 * Hook execution result
 */
export interface HookExecutionResult {
  /** Hook ID */
  hookId: string;
  /** Success */
  success: boolean;
  /** Execution time (ms) */
  executionTime: number;
  /** Error (if any) */
  error?: Error;
}

/**
 * Hook manager options
 */
export interface HookManagerOptions {
  /** Enable state mutex (prevents concurrent hook execution) */
  enableStateMutex?: boolean;
  /** Default hook timeout (ms) */
  defaultTimeout?: number;
  /** Log hook execution */
  logExecution?: boolean;
}

/**
 * Hook Manager
 *
 * Manages hook registration and execution.
 */
export class HookManager {
  private logger: Logger;
  private hooks = new Map<string, Hook>();
  private executionCount = 0;
  private stateMutex = false;
  private options: Required<HookManagerOptions>;

  constructor(options: HookManagerOptions = {}) {
    this.logger = new Logger().child('HookManager');
    this.options = {
      enableStateMutex: options.enableStateMutex ?? true,
      defaultTimeout: options.defaultTimeout ?? 10000,
      logExecution: options.logExecution ?? true,
    };

    this.logger.info('Hook Manager initialized', {
      stateMutex: this.options.enableStateMutex,
      timeout: this.options.defaultTimeout,
    });
  }

  /**
   * Register a hook
   *
   * @param hook - Hook to register
   * @returns Hook ID
   */
  register(hook: Omit<Hook, 'id'>): string {
    const id = `hook_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const fullHook: Hook = {
      id,
      ...hook,
      enabled: hook.enabled ?? true,
      priority: hook.priority ?? HookPriority.NORMAL,
      timeout: hook.timeout ?? this.options.defaultTimeout,
    };

    this.hooks.set(id, fullHook);

    this.logger.debug('Hook registered', {
      id,
      type: hook.type,
      operation: hook.operationPattern,
      priority: hook.priority,
    });

    return id;
  }

  /**
   * Unregister a hook
   *
   * @param hookId - Hook ID
   * @returns Success
   */
  unregister(hookId: string): boolean {
    const deleted = this.hooks.delete(hookId);

    if (deleted) {
      this.logger.debug('Hook unregistered', { hookId });
    }

    return deleted;
  }

  /**
   * Enable a hook
   *
   * @param hookId - Hook ID
   */
  enable(hookId: string): void {
    const hook = this.hooks.get(hookId);
    if (hook) {
      hook.enabled = true;
      this.logger.debug('Hook enabled', { hookId });
    }
  }

  /**
   * Disable a hook
   *
   * @param hookId - Hook ID
   */
  disable(hookId: string): void {
    const hook = this.hooks.get(hookId);
    if (hook) {
      hook.enabled = false;
      this.logger.debug('Hook disabled', { hookId });
    }
  }

  /**
   * Execute hooks for an operation
   *
   * @param type - Hook type
   * @param operation - Operation name
   * @param context - Hook context
   * @returns Array of execution results
   */
  async executeHooks(
    type: HookType,
    operation: string,
    context: Partial<HookContext>
  ): Promise<HookExecutionResult[]> {
    // Wait for state mutex if enabled
    if (this.options.enableStateMutex) {
      await this.acquireMutex();
    }

    try {
      const matchingHooks = this.getMatchingHooks(type, operation);

      if (matchingHooks.length === 0) {
        return [];
      }

      // Sort by priority (lower = earlier)
      matchingHooks.sort((a, b) => a.priority - b.priority);

      // Build full context
      const fullContext: HookContext = {
        operation,
        params: context.params ?? {},
        result: context.result,
        error: context.error,
        metadata: {
          startTime: context.metadata?.startTime ?? Date.now(),
          executionTime: context.metadata?.executionTime,
          executionCount: ++this.executionCount,
        },
        state: context.state ?? new Map(),
      };

      const results: HookExecutionResult[] = [];

      // Execute hooks sequentially
      for (const hook of matchingHooks) {
        const result = await this.executeHook(hook, fullContext);
        results.push(result);

        // Stop on error for non-finally hooks
        if (!result.success && type !== HookType.FINALLY) {
          break;
        }
      }

      if (this.options.logExecution) {
        this.logger.debug('Hooks executed', {
          type,
          operation,
          count: results.length,
          successful: results.filter((r) => r.success).length,
        });
      }

      return results;
    } finally {
      if (this.options.enableStateMutex) {
        this.releaseMutex();
      }
    }
  }

  /**
   * Execute before hooks
   *
   * @param operation - Operation name
   * @param params - Operation parameters
   * @returns Shared state from hooks
   */
  async executeBefore(
    operation: string,
    params: Record<string, unknown> = {}
  ): Promise<Map<string, unknown>> {
    const state = new Map<string, unknown>();

    await this.executeHooks(HookType.BEFORE, operation, {
      params,
      state,
      metadata: {
        startTime: Date.now(),
        executionCount: 0,
      },
    });

    return state;
  }

  /**
   * Execute after hooks
   *
   * @param operation - Operation name
   * @param result - Operation result
   * @param state - Shared state from before hooks
   */
  async executeAfter(
    operation: string,
    result: unknown,
    state?: Map<string, unknown>
  ): Promise<void> {
    await this.executeHooks(HookType.AFTER, operation, {
      result,
      state: state ?? new Map(),
      metadata: {
        startTime: Date.now(),
        executionCount: 0,
      },
    });
  }

  /**
   * Execute error hooks
   *
   * @param operation - Operation name
   * @param error - Error
   * @param state - Shared state from before hooks
   */
  async executeError(
    operation: string,
    error: Error,
    state?: Map<string, unknown>
  ): Promise<void> {
    await this.executeHooks(HookType.ERROR, operation, {
      error,
      state: state ?? new Map(),
      metadata: {
        startTime: Date.now(),
        executionCount: 0,
      },
    });
  }

  /**
   * Execute finally hooks
   *
   * @param operation - Operation name
   * @param result - Operation result (if successful)
   * @param error - Error (if failed)
   * @param state - Shared state from before hooks
   */
  async executeFinally(
    operation: string,
    result?: unknown,
    error?: Error,
    state?: Map<string, unknown>
  ): Promise<void> {
    await this.executeHooks(HookType.FINALLY, operation, {
      result,
      error,
      state: state ?? new Map(),
      metadata: {
        startTime: Date.now(),
        executionCount: 0,
      },
    });
  }

  /**
   * Get all registered hooks
   *
   * @returns Array of hooks
   */
  getAllHooks(): Hook[] {
    return Array.from(this.hooks.values());
  }

  /**
   * Get hooks by type
   *
   * @param type - Hook type
   * @returns Array of hooks
   */
  getHooksByType(type: HookType): Hook[] {
    return Array.from(this.hooks.values()).filter((hook) => hook.type === type);
  }

  /**
   * Clear all hooks
   */
  clearAll(): void {
    this.hooks.clear();
    this.logger.debug('All hooks cleared');
  }

  /**
   * Get matching hooks
   *
   * @param type - Hook type
   * @param operation - Operation name
   * @returns Array of matching hooks
   */
  private getMatchingHooks(type: HookType, operation: string): Hook[] {
    return Array.from(this.hooks.values()).filter(
      (hook) =>
        hook.enabled &&
        hook.type === type &&
        this.matchesPattern(operation, hook.operationPattern)
    );
  }

  /**
   * Execute a single hook
   *
   * @param hook - Hook to execute
   * @param context - Hook context
   * @returns Execution result
   */
  private async executeHook(
    hook: Hook,
    context: HookContext
  ): Promise<HookExecutionResult> {
    const startTime = Date.now();

    try {
      // Execute with timeout
      await Promise.race([
        hook.fn(context),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Hook timeout')),
            hook.timeout ?? this.options.defaultTimeout
          )
        ),
      ]);

      const executionTime = Date.now() - startTime;

      return {
        hookId: hook.id,
        success: true,
        executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      this.logger.error('Hook execution failed', {
        hookId: hook.id,
        operation: context.operation,
        error: (error as Error).message,
      });

      return {
        hookId: hook.id,
        success: false,
        executionTime,
        error: error as Error,
      };
    }
  }

  /**
   * Check if operation matches pattern
   *
   * @param operation - Operation name
   * @param pattern - Pattern (supports * wildcard)
   * @returns True if matches
   */
  private matchesPattern(operation: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(operation);
  }

  /**
   * Acquire state mutex
   */
  private async acquireMutex(): Promise<void> {
    while (this.stateMutex) {
      await Bun.sleep(10);
    }
    this.stateMutex = true;
  }

  /**
   * Release state mutex
   */
  private releaseMutex(): void {
    this.stateMutex = false;
  }
}

/**
 * Global hook manager instance
 */
let globalHookManager: HookManager | null = null;

/**
 * Initialize global hook manager
 *
 * @param options - Hook manager options
 * @returns The global hook manager
 */
export function initHookManager(options?: HookManagerOptions): HookManager {
  globalHookManager = new HookManager(options);
  return globalHookManager;
}

/**
 * Get global hook manager
 *
 * @returns The global hook manager
 */
export function getHookManager(): HookManager {
  if (!globalHookManager) {
    globalHookManager = new HookManager();
  }
  return globalHookManager;
}

/**
 * Helper: Create a before hook
 *
 * @param operationPattern - Operation pattern
 * @param fn - Hook function
 * @param options - Hook options
 * @returns Hook ID
 */
export function before(
  operationPattern: string,
  fn: HookFunction,
  options?: Partial<Hook>
): string {
  return getHookManager().register({
    type: HookType.BEFORE,
    operationPattern,
    fn,
    ...options,
  });
}

/**
 * Helper: Create an after hook
 *
 * @param operationPattern - Operation pattern
 * @param fn - Hook function
 * @param options - Hook options
 * @returns Hook ID
 */
export function after(
  operationPattern: string,
  fn: HookFunction,
  options?: Partial<Hook>
): string {
  return getHookManager().register({
    type: HookType.AFTER,
    operationPattern,
    fn,
    ...options,
  });
}

/**
 * Helper: Create a finally hook
 *
 * @param operationPattern - Operation pattern
 * @param fn - Hook function
 * @param options - Hook options
 * @returns Hook ID
 */
export function finally_(
  operationPattern: string,
  fn: HookFunction,
  options?: Partial<Hook>
): string {
  return getHookManager().register({
    type: HookType.FINALLY,
    operationPattern,
    fn,
    ...options,
  });
}

/**
 * Helper: Create an error hook
 *
 * @param operationPattern - Operation pattern
 * @param fn - Hook function
 * @param options - Hook options
 * @returns Hook ID
 */
export function onError(
  operationPattern: string,
  fn: HookFunction,
  options?: Partial<Hook>
): string {
  return getHookManager().register({
    type: HookType.ERROR,
    operationPattern,
    fn,
    ...options,
  });
}
