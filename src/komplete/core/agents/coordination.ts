/**
 * Agent Coordination for KOMPLETE-KONTROL CLI
 *
 * Provides coordination primitives including task queues, state sharing,
 * and synchronization mechanisms for multi-agent systems.
 * Follows patterns from agent-swarm-kit with simplified architecture.
 */

import { AgentError } from '../../types';
import { Logger } from '../../utils/logger';

/**
 * Task queue priority
 */
export enum QueuePriority {
  /**
   * Low priority
   */
  LOW = 0,
  /**
   * Normal priority
   */
  NORMAL = 1,
  /**
   * High priority
   */
  HIGH = 2,
  /**
   * Critical priority
   */
  CRITICAL = 3,
}

/**
 * Queue item
 */
export interface QueueItem<T> {
  /**
   * Item ID
   */
  id: string;
  /**
   * Item data
   */
  data: T;
  /**
   * Item priority
   */
  priority: QueuePriority;
  /**
   * Item creation time
   */
  createdAt: Date;
  /**
   * Item metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Queue statistics
 */
export interface QueueStatistics {
  /**
   * Total items in queue
   */
  totalItems: number;
  /**
   * Number of items by priority
   */
  itemsByPriority: Record<QueuePriority, number>;
  /**
   * Number of processed items
   */
  processedItems: number;
  /**
   * Number of failed items
   */
  failedItems: number;
}

/**
 * Task queue configuration
 */
export interface TaskQueueConfig {
  /**
   * Maximum queue size
   */
  maxSize?: number;
  /**
   * Enable priority queue
   */
  enablePriority?: boolean;
  /**
   * Queue name
   */
  name?: string;
}

/**
 * Task Queue class
 *
 * Provides a priority-based task queue for agent coordination.
 */
export class TaskQueue<T> {
  private queue: QueueItem<T>[] = [];
  private processedCount: number = 0;
  private failedCount: number = 0;
  private logger: Logger;
  private config: Required<TaskQueueConfig>;

  constructor(config: TaskQueueConfig = {}, logger?: Logger) {
    this.logger = logger || new Logger();
    this.config = {
      maxSize: config.maxSize ?? 1000,
      enablePriority: config.enablePriority ?? true,
      name: config.name ?? 'default',
    };
    this.logger.info(
      `TaskQueue initialized: ${this.config.name}`,
      'TaskQueue'
    );
  }

  /**
   * Add an item to the queue
   *
   * @param data - Item data
   * @param priority - Item priority
   * @param metadata - Optional metadata
   * @returns Item ID
   * @throws AgentError if queue is full
   */
  enqueue(data: T, priority: QueuePriority = QueuePriority.NORMAL, metadata?: Record<string, unknown>): string {
    if (this.queue.length >= this.config.maxSize) {
      throw new AgentError(`Queue '${this.config.name}' is full`, this.config.name);
    }

    const item: QueueItem<T> = {
      id: this.generateItemId(),
      data,
      priority,
      createdAt: new Date(),
      metadata,
    };

    this.queue.push(item);

    // Sort by priority if enabled
    if (this.config.enablePriority) {
      this.queue.sort((a, b) => {
        const priorityDiff = b.priority - a.priority;
        if (priorityDiff !== 0) return priorityDiff;
        return a.createdAt.getTime() - b.createdAt.getTime();
      });
    }

    this.logger.debug(
      `Item enqueued: ${item.id}`,
      'TaskQueue',
      { priority, queueSize: this.queue.length }
    );

    return item.id;
  }

  /**
   * Remove and return the next item from the queue
   *
   * @returns Queue item or undefined if queue is empty
   */
  dequeue(): QueueItem<T> | undefined {
    const item = this.queue.shift();

    if (item) {
      this.processedCount++;
      this.logger.debug(
        `Item dequeued: ${item.id}`,
        'TaskQueue',
        { priority: item.priority, queueSize: this.queue.length }
      );
    }

    return item;
  }

  /**
   * Peek at the next item without removing it
   *
   * @returns Queue item or undefined if queue is empty
   */
  peek(): QueueItem<T> | undefined {
    return this.queue[0];
  }

  /**
   * Remove an item by ID
   *
   * @param itemId - Item ID to remove
   * @returns True if item was removed, false if not found
   */
  remove(itemId: string): boolean {
    const index = this.queue.findIndex((item) => item.id === itemId);

    if (index > -1) {
      this.queue.splice(index, 1);
      this.logger.debug(`Item removed: ${itemId}`, 'TaskQueue');
      return true;
    }

    return false;
  }

  /**
   * Get an item by ID
   *
   * @param itemId - Item ID to get
   * @returns Queue item or undefined if not found
   */
  get(itemId: string): QueueItem<T> | undefined {
    return this.queue.find((item) => item.id === itemId);
  }

  /**
   * Get all items
   *
   * @returns Array of queue items
   */
  getAll(): QueueItem<T>[] {
    return [...this.queue];
  }

  /**
   * Get queue size
   *
   * @returns Number of items in queue
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Check if queue is empty
   *
   * @returns True if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Check if queue is full
   *
   * @returns True if queue is full
   */
  isFull(): boolean {
    return this.queue.length >= this.config.maxSize;
  }

  /**
   * Mark an item as failed
   *
   * @param itemId - Item ID to mark as failed
   * @returns True if item was marked as failed, false if not found
   */
  markFailed(itemId: string): boolean {
    const index = this.queue.findIndex((item) => item.id === itemId);

    if (index > -1) {
      this.queue.splice(index, 1);
      this.failedCount++;
      this.logger.debug(`Item marked as failed: ${itemId}`, 'TaskQueue');
      return true;
    }

    return false;
  }

  /**
   * Get queue statistics
   *
   * @returns Queue statistics
   */
  getStatistics(): QueueStatistics {
    const itemsByPriority: Record<QueuePriority, number> = {
      [QueuePriority.LOW]: 0,
      [QueuePriority.NORMAL]: 0,
      [QueuePriority.HIGH]: 0,
      [QueuePriority.CRITICAL]: 0,
    };

    for (const item of this.queue) {
      itemsByPriority[item.priority]++;
    }

    return {
      totalItems: this.queue.length,
      itemsByPriority,
      processedItems: this.processedCount,
      failedItems: this.failedCount,
    };
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.queue = [];
    this.processedCount = 0;
    this.failedCount = 0;
    this.logger.info(`Queue cleared: ${this.config.name}`, 'TaskQueue');
  }

  /**
   * Generate unique item ID
   *
   * @returns Unique item ID
   */
  private generateItemId(): string {
    return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Shared state value
 */
interface StateValue<T> {
  value: T;
  version: number;
  updatedAt: Date;
  updatedBy?: string;
}

/**
 * Shared state configuration
 */
export interface SharedStateConfig {
  /**
   * State name
   */
  name?: string;
  /**
   * Enable versioning
   */
  enableVersioning?: boolean;
  /**
   * Maximum history size
   */
  maxHistorySize?: number;
}

/**
 * Shared State class
 *
 * Provides shared state management for agent coordination.
 */
export class SharedState {
  private state: Map<string, StateValue<unknown>> = new Map();
  private history: Array<{ key: string; value: StateValue<unknown> }> = [];
  private logger: Logger;
  private config: Required<SharedStateConfig>;

  constructor(config: SharedStateConfig = {}, logger?: Logger) {
    this.logger = logger || new Logger();
    this.config = {
      name: config.name ?? 'default',
      enableVersioning: config.enableVersioning ?? true,
      maxHistorySize: config.maxHistorySize ?? 100,
    };
    this.logger.info(
      `SharedState initialized: ${this.config.name}`,
      'SharedState'
    );
  }

  /**
   * Set a value in the shared state
   *
   * @param key - State key
   * @param value - State value
   * @param updatedBy - Optional agent ID that updated the value
   */
  set<T>(key: string, value: T, updatedBy?: string): void {
    const currentValue = this.state.get(key);
    const version = currentValue ? currentValue.version + 1 : 1;

    const stateValue: StateValue<T> = {
      value,
      version,
      updatedAt: new Date(),
      updatedBy,
    };

    // Add to history if versioning is enabled
    if (this.config.enableVersioning && currentValue) {
      this.history.push({ key, value: currentValue });
      this.trimHistory();
    }

    this.state.set(key, stateValue as StateValue<unknown>);

    this.logger.debug(
      `State set: ${key}`,
      'SharedState',
      { version, updatedBy }
    );
  }

  /**
   * Get a value from the shared state
   *
   * @param key - State key
   * @param defaultValue - Default value if key doesn't exist
   * @returns State value or default value
   */
  get<T>(key: string, defaultValue?: T): T | undefined {
    const stateValue = this.state.get(key);
    return stateValue ? (stateValue.value as T) : defaultValue;
  }

  /**
   * Get a value with version information
   *
   * @param key - State key
   * @returns State value with metadata or undefined
   */
  getWithVersion<T>(key: string): StateValue<T> | undefined {
    const stateValue = this.state.get(key);
    return stateValue as StateValue<T> | undefined;
  }

  /**
   * Check if a key exists in the shared state
   *
   * @param key - State key
   * @returns True if key exists
   */
  has(key: string): boolean {
    return this.state.has(key);
  }

  /**
   * Delete a value from the shared state
   *
   * @param key - State key
   * @returns True if key was deleted, false if not found
   */
  delete(key: string): boolean {
    const existed = this.state.has(key);

    if (existed) {
      // Add to history before deleting
      if (this.config.enableVersioning) {
        const currentValue = this.state.get(key)!;
        this.history.push({ key, value: currentValue });
        this.trimHistory();
      }

      this.state.delete(key);
      this.logger.debug(`State deleted: ${key}`, 'SharedState');
    }

    return existed;
  }

  /**
   * Get all keys in the shared state
   *
   * @returns Array of keys
   */
  keys(): string[] {
    return Array.from(this.state.keys());
  }

  /**
   * Get all values in the shared state
   *
   * @returns Map of key to value
   */
  values(): Map<string, unknown> {
    const result = new Map<string, unknown>();

    for (const [key, stateValue] of this.state.entries()) {
      result.set(key, stateValue.value);
    }

    return result;
  }

  /**
   * Get all entries in the shared state
   *
   * @returns Array of [key, value] tuples
   */
  entries(): Array<[string, unknown]> {
    const result: Array<[string, unknown]> = [];

    for (const [key, stateValue] of this.state.entries()) {
      result.push([key, stateValue.value]);
    }

    return result;
  }

  /**
   * Get history for a key
   *
   * @param key - State key
   * @param limit - Maximum number of history entries
   * @returns Array of historical values
   */
  getHistory<T>(key: string, limit?: number): StateValue<T>[] {
    const keyHistory = this.history.filter((entry) => entry.key === key);

    if (limit) {
      return keyHistory.slice(-limit).map((entry) => entry.value as StateValue<T>);
    }

    return keyHistory.map((entry) => entry.value as StateValue<T>);
  }

  /**
   * Clear the shared state
   */
  clear(): void {
    this.state.clear();
    this.history = [];
    this.logger.info(`SharedState cleared: ${this.config.name}`, 'SharedState');
  }

  /**
   * Trim history to max size
   */
  private trimHistory(): void {
    if (this.history.length > this.config.maxHistorySize) {
      this.history = this.history.slice(-this.config.maxHistorySize);
    }
  }
}

/**
 * Barrier configuration
 */
export interface BarrierConfig {
  /**
   * Barrier name
   */
  name?: string;
  /**
   * Timeout in milliseconds
   */
  timeout?: number;
}

/**
 * Barrier class
 *
 * Provides a synchronization barrier for agent coordination.
 * Agents can wait at the barrier until all expected agents arrive.
 */
export class Barrier {
  private expected: number;
  private arrived: Set<string> = new Set();
  private resolve: (() => void) | null = null;
  private reject: ((error: Error) => void) | null = null;
  private timeoutHandle: NodeJS.Timeout | null = null;
  private logger: Logger;
  private config: Required<BarrierConfig>;

  constructor(expected: number, config: BarrierConfig = {}, logger?: Logger) {
    this.expected = expected;
    this.logger = logger || new Logger();
    this.config = {
      name: config.name ?? 'default',
      timeout: config.timeout ?? 30000,
    };
    this.logger.info(
      `Barrier initialized: ${this.config.name} (expected: ${expected})`,
      'Barrier'
    );
  }

  /**
   * Wait for all agents to arrive at the barrier
   *
   * @param agentId - Agent ID
   * @returns Promise that resolves when all agents have arrived
   * @throws AgentError if timeout is exceeded
   */
  async wait(agentId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if already arrived
      if (this.arrived.has(agentId)) {
        resolve();
        return;
      }

      // Set up timeout
      this.timeoutHandle = setTimeout(() => {
        const error = new AgentError(
          `Barrier '${this.config.name}' timeout: ${this.arrived.size}/${this.expected} agents arrived`,
          this.config.name
        );
        this.cleanup();
        reject(error);
      }, this.config.timeout);

      // Set resolve/reject handlers
      this.resolve = resolve;
      this.reject = reject;

      // Mark agent as arrived
      this.arrived.add(agentId);
      this.logger.debug(
        `Agent arrived at barrier: ${agentId}`,
        'Barrier',
        { arrived: this.arrived.size, expected: this.expected }
      );

      // Check if all agents have arrived
      if (this.arrived.size >= this.expected) {
        this.cleanup();
        resolve();
      }
    });
  }

  /**
   * Reset the barrier
   */
  reset(): void {
    this.arrived.clear();
    this.cleanup();
    this.logger.debug(`Barrier reset: ${this.config.name}`, 'Barrier');
  }

  /**
   * Get the number of arrived agents
   *
   * @returns Number of arrived agents
   */
  getArrivedCount(): number {
    return this.arrived.size;
  }

  /**
   * Get the number of expected agents
   *
   * @returns Number of expected agents
   */
  getExpectedCount(): number {
    return this.expected;
  }

  /**
   * Check if all agents have arrived
   *
   * @returns True if all agents have arrived
   */
  isComplete(): boolean {
    return this.arrived.size >= this.expected;
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
    this.resolve = null;
    this.reject = null;
  }
}

/**
 * Semaphore configuration
 */
export interface SemaphoreConfig {
  /**
   * Semaphore name
   */
  name?: string;
}

/**
 * Semaphore class
 *
 * Provides a counting semaphore for resource management.
 */
export class Semaphore {
  private permits: number;
  private queue: Array<{ resolve: (permit: boolean) => void }> = [];
  private logger: Logger;
  private config: Required<SemaphoreConfig>;

  constructor(permits: number, config: SemaphoreConfig = {}, logger?: Logger) {
    this.permits = permits;
    this.logger = logger || new Logger();
    this.config = {
      name: config.name ?? 'default',
    };
    this.logger.info(
      `Semaphore initialized: ${this.config.name} (permits: ${permits})`,
      'Semaphore'
    );
  }

  /**
   * Acquire a permit
   *
   * @returns Promise that resolves when a permit is acquired
   */
  async acquire(): Promise<boolean> {
    if (this.permits > 0) {
      this.permits--;
      this.logger.debug(
        `Permit acquired: ${this.config.name}`,
        'Semaphore',
        { available: this.permits }
      );
      return true;
    }

    // Wait for a permit
    return new Promise((resolve) => {
      this.queue.push({ resolve });
      this.logger.debug(
        `Waiting for permit: ${this.config.name}`,
        'Semaphore',
        { queueSize: this.queue.length }
      );
    });
  }

  /**
   * Release a permit
   */
  release(): void {
    if (this.queue.length > 0) {
      // Grant permit to next waiting agent
      const next = this.queue.shift()!;
      next.resolve(true);
      this.logger.debug(
        `Permit granted to waiting agent: ${this.config.name}`,
        'Semaphore',
        { queueSize: this.queue.length }
      );
    } else {
      this.permits++;
      this.logger.debug(
        `Permit released: ${this.config.name}`,
        'Semaphore',
        { available: this.permits }
      );
    }
  }

  /**
   * Get the number of available permits
   *
   * @returns Number of available permits
   */
  availablePermits(): number {
    return this.permits;
  }

  /**
   * Get the number of waiting agents
   *
   * @returns Number of waiting agents
   */
  getWaitingCount(): number {
    return this.queue.length;
  }
}

/**
 * Agent Coordination Manager class
 *
 * Provides coordination primitives including task queues, shared state,
 * barriers, and semaphores for multi-agent systems.
 */
export class AgentCoordinationManager {
  private queues: Map<string, TaskQueue<unknown>> = new Map();
  private states: Map<string, SharedState> = new Map();
  private barriers: Map<string, Barrier> = new Map();
  private semaphores: Map<string, Semaphore> = new Map();
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
    this.logger.info('AgentCoordinationManager initialized', 'AgentCoordinationManager');
  }

  /**
   * Create or get a task queue
   *
   * @param name - Queue name
   * @param config - Queue configuration
   * @returns Task queue
   */
  getQueue<T>(name: string, config?: TaskQueueConfig): TaskQueue<T> {
    if (!this.queues.has(name)) {
      this.queues.set(name, new TaskQueue<T>(config || { name }, this.logger));
    }
    return this.queues.get(name) as TaskQueue<T>;
  }

  /**
   * Create or get a shared state
   *
   * @param name - State name
   * @param config - State configuration
   * @returns Shared state
   */
  getState(name: string, config?: SharedStateConfig): SharedState {
    if (!this.states.has(name)) {
      this.states.set(name, new SharedState(config || { name }, this.logger));
    }
    return this.states.get(name)!;
  }

  /**
   * Create or get a barrier
   *
   * @param name - Barrier name
   * @param expected - Expected number of agents
   * @param config - Barrier configuration
   * @returns Barrier
   */
  getBarrier(name: string, expected: number, config?: BarrierConfig): Barrier {
    if (!this.barriers.has(name)) {
      this.barriers.set(name, new Barrier(expected, config || { name }, this.logger));
    }
    return this.barriers.get(name)!;
  }

  /**
   * Create or get a semaphore
   *
   * @param name - Semaphore name
   * @param permits - Number of permits
   * @param config - Semaphore configuration
   * @returns Semaphore
   */
  getSemaphore(name: string, permits: number, config?: SemaphoreConfig): Semaphore {
    if (!this.semaphores.has(name)) {
      this.semaphores.set(name, new Semaphore(permits, config || { name }, this.logger));
    }
    return this.semaphores.get(name)!;
  }

  /**
   * Delete a task queue
   *
   * @param name - Queue name
   * @returns True if queue was deleted, false if not found
   */
  deleteQueue(name: string): boolean {
    const queue = this.queues.get(name);
    if (queue) {
      queue.clear();
      this.queues.delete(name);
      return true;
    }
    return false;
  }

  /**
   * Delete a shared state
   *
   * @param name - State name
   * @returns True if state was deleted, false if not found
   */
  deleteState(name: string): boolean {
    const state = this.states.get(name);
    if (state) {
      state.clear();
      this.states.delete(name);
      return true;
    }
    return false;
  }

  /**
   * Delete a barrier
   *
   * @param name - Barrier name
   * @returns True if barrier was deleted, false if not found
   */
  deleteBarrier(name: string): boolean {
    return this.barriers.delete(name);
  }

  /**
   * Delete a semaphore
   *
   * @param name - Semaphore name
   * @returns True if semaphore was deleted, false if not found
   */
  deleteSemaphore(name: string): boolean {
    return this.semaphores.delete(name);
  }

  /**
   * Clear all coordination primitives
   */
  clear(): void {
    for (const queue of this.queues.values()) {
      queue.clear();
    }
    for (const state of this.states.values()) {
      state.clear();
    }
    this.queues.clear();
    this.states.clear();
    this.barriers.clear();
    this.semaphores.clear();
    this.logger.info('AgentCoordinationManager cleared', 'AgentCoordinationManager');
  }
}

/**
 * Global agent coordination manager instance
 */
let globalAgentCoordinationManager: AgentCoordinationManager | null = null;

/**
 * Initialize global agent coordination manager
 *
 * @param logger - Optional logger instance
 * @returns The global agent coordination manager
 */
export function initAgentCoordinationManager(logger?: Logger): AgentCoordinationManager {
  globalAgentCoordinationManager = new AgentCoordinationManager(logger);
  return globalAgentCoordinationManager;
}

/**
 * Get global agent coordination manager
 *
 * @returns The global agent coordination manager
 */
export function getAgentCoordinationManager(): AgentCoordinationManager {
  if (!globalAgentCoordinationManager) {
    globalAgentCoordinationManager = new AgentCoordinationManager();
  }
  return globalAgentCoordinationManager;
}
