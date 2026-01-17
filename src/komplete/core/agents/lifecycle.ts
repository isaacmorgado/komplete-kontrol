/**
 * Agent Lifecycle Management for KOMPLETE-KONTROL CLI
 *
 * Provides agent lifecycle management including initialization, start, pause, stop, and disposal.
 * Follows patterns from agent-swarm-kit with simplified architecture.
 */

import type { AgentDefinition, AgentTask, AgentTaskResult } from '../../types';
import { AgentError } from '../../types';
import { Logger } from '../../utils/logger';
import { ErrorHandler } from '../../utils/error-handler';
import { AgentRegistry, getAgentRegistry } from './registry';

/**
 * Agent lifecycle state
 */
export enum AgentLifecycleState {
  /**
   * Agent has been created but not initialized
   */
  CREATED = 'created',
  /**
   * Agent is being initialized
   */
  INITIALIZING = 'initializing',
  /**
   * Agent is initialized and ready
   */
  INITIALIZED = 'initialized',
  /**
   * Agent is starting
   */
  STARTING = 'starting',
  /**
   * Agent is running and active
   */
  RUNNING = 'running',
  /**
   * Agent is pausing
   */
  PAUSING = 'pausing',
  /**
   * Agent is paused
   */
  PAUSED = 'paused',
  /**
   * Agent is stopping
   */
  STOPPING = 'stopping',
  /**
   * Agent is stopped
   */
  STOPPED = 'stopped',
  /**
   * Agent is being disposed
   */
  DISPOSING = 'disposing',
  /**
   * Agent has been disposed
   */
  DISPOSED = 'disposed',
  /**
   * Agent encountered an error
   */
  ERROR = 'error',
}

/**
 * Agent lifecycle event
 */
export enum AgentLifecycleEvent {
  /**
   * Agent is about to initialize
   */
  BEFORE_INIT = 'before_init',
  /**
   * Agent has been initialized
   */
  INITIALIZED = 'initialized',
  /**
   * Agent initialization failed
   */
  INIT_ERROR = 'init_error',
  /**
   * Agent is about to start
   */
  BEFORE_START = 'before_start',
  /**
   * Agent has started
   */
  STARTED = 'started',
  /**
   * Agent start failed
   */
  START_ERROR = 'start_error',
  /**
   * Agent is about to pause
   */
  BEFORE_PAUSE = 'before_pause',
  /**
   * Agent has been paused
   */
  PAUSED = 'paused',
  /**
   * Agent pause failed
   */
  PAUSE_ERROR = 'pause_error',
  /**
   * Agent is about to resume
   */
  BEFORE_RESUME = 'before_resume',
  /**
   * Agent has been resumed
   */
  RESUMED = 'resumed',
  /**
   * Agent resume failed
   */
  RESUME_ERROR = 'resume_error',
  /**
   * Agent is about to stop
   */
  BEFORE_STOP = 'before_stop',
  /**
   * Agent has been stopped
   */
  STOPPED = 'stopped',
  /**
   * Agent stop failed
   */
  STOP_ERROR = 'stop_error',
  /**
   * Agent is about to be disposed
   */
  BEFORE_DISPOSE = 'before_dispose',
  /**
   * Agent has been disposed
   */
  DISPOSED = 'disposed',
  /**
   * Agent disposal failed
   */
  DISPOSE_ERROR = 'dispose_error',
}

/**
 * Agent lifecycle event handler
 */
export type AgentLifecycleEventHandler = (
  event: AgentLifecycleEvent,
  agentId: string,
  error?: Error
) => void | Promise<void>;

/**
 * Agent execution context
 */
export interface AgentExecutionContext {
  /**
   * Agent ID
   */
  agentId: string;
  /**
   * Current task being executed
   */
  currentTask?: AgentTask;
  /**
   * Task execution history
   */
  taskHistory: AgentTaskResult[];
  /**
   * Custom context data
   */
  contextData: Map<string, unknown>;
}

/**
 * Agent instance
 */
export interface AgentInstance {
  /**
   * Agent ID
   */
  id: string;
  /**
   * Agent definition
   */
  definition: AgentDefinition;
  /**
   * Current lifecycle state
   */
  state: AgentLifecycleState;
  /**
   * Execution context
   */
  context: AgentExecutionContext;
  /**
   * Whether the agent is active
   */
  isActive: boolean;
  /**
   * Error encountered (if any)
   */
  error?: Error;
}

/**
 * Agent lifecycle manager configuration
 */
export interface AgentLifecycleManagerConfig {
  /**
   * Maximum number of concurrent tasks per agent
   */
  maxConcurrentTasks?: number;
  /**
   * Task timeout in milliseconds
   */
  taskTimeout?: number;
  /**
   * Enable automatic recovery on error
   */
  autoRecovery?: boolean;
  /**
   * Maximum recovery attempts
   */
  maxRecoveryAttempts?: number;
}

/**
 * Agent Lifecycle Manager class
 *
 * Manages agent lifecycle including initialization, start, pause, stop, and disposal.
 * Provides state management and event handling for agents.
 */
export class AgentLifecycleManager {
  private instances: Map<string, AgentInstance> = new Map();
  private eventHandlers: Map<AgentLifecycleEvent, AgentLifecycleEventHandler[]> =
    new Map();
  private logger: Logger;
  private errorHandler: ErrorHandler;
  private registry: AgentRegistry;
  private config: Required<AgentLifecycleManagerConfig>;

  constructor(
    config: AgentLifecycleManagerConfig = {},
    logger?: Logger,
    errorHandler?: ErrorHandler,
    registry?: AgentRegistry
  ) {
    this.logger = logger || new Logger();
    this.errorHandler = errorHandler || new ErrorHandler();
    this.registry = registry || getAgentRegistry();
    this.config = {
      maxConcurrentTasks: config.maxConcurrentTasks ?? 1,
      taskTimeout: config.taskTimeout ?? 30000,
      autoRecovery: config.autoRecovery ?? true,
      maxRecoveryAttempts: config.maxRecoveryAttempts ?? 3,
    };
    this.logger.info('AgentLifecycleManager initialized', 'AgentLifecycleManager');
  }

  /**
   * Initialize an agent
   *
   * @param agentId - ID of agent to initialize
   * @returns Promise that resolves when agent is initialized
   * @throws AgentError if agent not found or initialization fails
   */
  async initialize(agentId: string): Promise<void> {
    const definition = this.registry.get(agentId);

    if (!definition) {
      throw new AgentError(`Agent '${agentId}' not found in registry`, agentId);
    }

    // Check if already initialized
    if (this.instances.has(agentId)) {
      const instance = this.instances.get(agentId)!;
      if (instance.state === AgentLifecycleState.INITIALIZED) {
        this.logger.debug(`Agent '${agentId}' already initialized`, 'AgentLifecycleManager');
        return;
      }
    }

    // Create agent instance
    const instance: AgentInstance = {
      id: agentId,
      definition,
      state: AgentLifecycleState.INITIALIZING,
      context: {
        agentId,
        taskHistory: [],
        contextData: new Map(),
      },
      isActive: false,
    };

    this.instances.set(agentId, instance);

    // Emit before_init event
    await this.emitEvent(AgentLifecycleEvent.BEFORE_INIT, agentId);

    try {
      // Validate dependencies
      if (!this.registry.checkDependencies(agentId)) {
        throw new AgentError(
          `Agent '${agentId}' has unsatisfied dependencies`,
          agentId
        );
      }

      // Transition to initialized state
      instance.state = AgentLifecycleState.INITIALIZED;

      // Emit initialized event
      await this.emitEvent(AgentLifecycleEvent.INITIALIZED, agentId);

      this.logger.info(`Agent initialized: ${agentId}`, 'AgentLifecycleManager', {
        name: definition.name,
        capabilities: definition.capabilities,
      });

      // Update registry status
      this.registry.updateStatus(agentId, 'registered');
    } catch (error) {
      instance.state = AgentLifecycleState.ERROR;
      instance.error = error as Error;

      await this.emitEvent(
        AgentLifecycleEvent.INIT_ERROR,
        agentId,
        error as Error
      );

      this.logger.error(
        `Agent initialization failed: ${agentId}`,
        'AgentLifecycleManager',
        { error: (error as Error).message }
      );

      throw error;
    }
  }

  /**
   * Start an agent
   *
   * @param agentId - ID of agent to start
   * @returns Promise that resolves when agent is started
   * @throws AgentError if agent not initialized or start fails
   */
  async start(agentId: string): Promise<void> {
    const instance = this.instances.get(agentId);

    if (!instance) {
      throw new AgentError(
        `Agent '${agentId}' not initialized. Call initialize() first.`,
        agentId
      );
    }

    if (instance.state === AgentLifecycleState.RUNNING) {
      this.logger.debug(`Agent '${agentId}' already running`, 'AgentLifecycleManager');
      return;
    }

    // Emit before_start event
    await this.emitEvent(AgentLifecycleEvent.BEFORE_START, agentId);

    try {
      instance.state = AgentLifecycleState.STARTING;

      // Transition to running state
      instance.state = AgentLifecycleState.RUNNING;
      instance.isActive = true;

      // Emit started event
      await this.emitEvent(AgentLifecycleEvent.STARTED, agentId);

      this.logger.info(`Agent started: ${agentId}`, 'AgentLifecycleManager');

      // Update registry status
      this.registry.updateStatus(agentId, 'active');
    } catch (error) {
      instance.state = AgentLifecycleState.ERROR;
      instance.error = error as Error;

      await this.emitEvent(AgentLifecycleEvent.START_ERROR, agentId, error as Error);

      this.logger.error(
        `Agent start failed: ${agentId}`,
        'AgentLifecycleManager',
        { error: (error as Error).message }
      );

      throw error;
    }
  }

  /**
   * Pause an agent
   *
   * @param agentId - ID of agent to pause
   * @returns Promise that resolves when agent is paused
   * @throws AgentError if agent not running or pause fails
   */
  async pause(agentId: string): Promise<void> {
    const instance = this.instances.get(agentId);

    if (!instance) {
      throw new AgentError(`Agent '${agentId}' not found`, agentId);
    }

    if (instance.state !== AgentLifecycleState.RUNNING) {
      throw new AgentError(
        `Agent '${agentId}' is not running. Current state: ${instance.state}`,
        agentId
      );
    }

    // Emit before_pause event
    await this.emitEvent(AgentLifecycleEvent.BEFORE_PAUSE, agentId);

    try {
      instance.state = AgentLifecycleState.PAUSING;

      // Transition to paused state
      instance.state = AgentLifecycleState.PAUSED;
      instance.isActive = false;

      // Emit paused event
      await this.emitEvent(AgentLifecycleEvent.PAUSED, agentId);

      this.logger.info(`Agent paused: ${agentId}`, 'AgentLifecycleManager');

      // Update registry status
      this.registry.updateStatus(agentId, 'paused');
    } catch (error) {
      instance.state = AgentLifecycleState.ERROR;
      instance.error = error as Error;

      await this.emitEvent(AgentLifecycleEvent.PAUSE_ERROR, agentId, error as Error);

      this.logger.error(
        `Agent pause failed: ${agentId}`,
        'AgentLifecycleManager',
        { error: (error as Error).message }
      );

      throw error;
    }
  }

  /**
   * Resume a paused agent
   *
   * @param agentId - ID of agent to resume
   * @returns Promise that resolves when agent is resumed
   * @throws AgentError if agent not paused or resume fails
   */
  async resume(agentId: string): Promise<void> {
    const instance = this.instances.get(agentId);

    if (!instance) {
      throw new AgentError(`Agent '${agentId}' not found`, agentId);
    }

    if (instance.state !== AgentLifecycleState.PAUSED) {
      throw new AgentError(
        `Agent '${agentId}' is not paused. Current state: ${instance.state}`,
        agentId
      );
    }

    // Emit before_resume event
    await this.emitEvent(AgentLifecycleEvent.BEFORE_RESUME, agentId);

    try {
      instance.state = AgentLifecycleState.STARTING;

      // Transition to running state
      instance.state = AgentLifecycleState.RUNNING;
      instance.isActive = true;

      // Emit resumed event
      await this.emitEvent(AgentLifecycleEvent.RESUMED, agentId);

      this.logger.info(`Agent resumed: ${agentId}`, 'AgentLifecycleManager');

      // Update registry status
      this.registry.updateStatus(agentId, 'active');
    } catch (error) {
      instance.state = AgentLifecycleState.ERROR;
      instance.error = error as Error;

      await this.emitEvent(AgentLifecycleEvent.RESUME_ERROR, agentId, error as Error);

      this.logger.error(
        `Agent resume failed: ${agentId}`,
        'AgentLifecycleManager',
        { error: (error as Error).message }
      );

      throw error;
    }
  }

  /**
   * Stop an agent
   *
   * @param agentId - ID of agent to stop
   * @returns Promise that resolves when agent is stopped
   * @throws AgentError if stop fails
   */
  async stop(agentId: string): Promise<void> {
    const instance = this.instances.get(agentId);

    if (!instance) {
      this.logger.warn(`Agent '${agentId}' not found for stop`, 'AgentLifecycleManager');
      return;
    }

    if (instance.state === AgentLifecycleState.STOPPED) {
      this.logger.debug(`Agent '${agentId}' already stopped`, 'AgentLifecycleManager');
      return;
    }

    // Emit before_stop event
    await this.emitEvent(AgentLifecycleEvent.BEFORE_STOP, agentId);

    try {
      instance.state = AgentLifecycleState.STOPPING;

      // Transition to stopped state
      instance.state = AgentLifecycleState.STOPPED;
      instance.isActive = false;

      // Clear current task
      instance.context.currentTask = undefined;

      // Emit stopped event
      await this.emitEvent(AgentLifecycleEvent.STOPPED, agentId);

      this.logger.info(`Agent stopped: ${agentId}`, 'AgentLifecycleManager');
    } catch (error) {
      instance.state = AgentLifecycleState.ERROR;
      instance.error = error as Error;

      await this.emitEvent(AgentLifecycleEvent.STOP_ERROR, agentId, error as Error);

      this.logger.error(
        `Agent stop failed: ${agentId}`,
        'AgentLifecycleManager',
        { error: (error as Error).message }
      );

      throw error;
    }
  }

  /**
   * Dispose an agent
   *
   * @param agentId - ID of agent to dispose
   * @returns Promise that resolves when agent is disposed
   * @throws AgentError if disposal fails
   */
  async dispose(agentId: string): Promise<void> {
    const instance = this.instances.get(agentId);

    if (!instance) {
      this.logger.warn(`Agent '${agentId}' not found for disposal`, 'AgentLifecycleManager');
      return;
    }

    // Stop if running
    if (instance.state === AgentLifecycleState.RUNNING || instance.state === AgentLifecycleState.PAUSED) {
      await this.stop(agentId);
    }

    // Emit before_dispose event
    await this.emitEvent(AgentLifecycleEvent.BEFORE_DISPOSE, agentId);

    try {
      instance.state = AgentLifecycleState.DISPOSING;

      // Clear context data
      instance.context.contextData.clear();
      instance.context.taskHistory = [];

      // Remove instance
      this.instances.delete(agentId);

      // Emit disposed event
      await this.emitEvent(AgentLifecycleEvent.DISPOSED, agentId);

      this.logger.info(`Agent disposed: ${agentId}`, 'AgentLifecycleManager');
    } catch (error) {
      await this.emitEvent(AgentLifecycleEvent.DISPOSE_ERROR, agentId, error as Error);

      this.logger.error(
        `Agent disposal failed: ${agentId}`,
        'AgentLifecycleManager',
        { error: (error as Error).message }
      );

      throw error;
    }
  }

  /**
   * Get an agent instance
   *
   * @param agentId - ID of agent to get
   * @returns Agent instance or undefined if not found
   */
  getInstance(agentId: string): AgentInstance | undefined {
    return this.instances.get(agentId);
  }

  /**
   * Get all agent instances
   *
   * @returns Map of agent ID to agent instance
   */
  getAllInstances(): Map<string, AgentInstance> {
    return new Map(this.instances);
  }

  /**
   * Get agent state
   *
   * @param agentId - ID of agent to get state for
   * @returns Agent state or undefined if not found
   */
  getState(agentId: string): AgentLifecycleState | undefined {
    return this.instances.get(agentId)?.state;
  }

  /**
   * Check if agent is active
   *
   * @param agentId - ID of agent to check
   * @returns True if agent is active
   */
  isActive(agentId: string): boolean {
    return this.instances.get(agentId)?.isActive ?? false;
  }

  /**
   * Get active agents
   *
   * @returns Array of active agent IDs
   */
  getActiveAgents(): string[] {
    const active: string[] = [];

    for (const [id, instance] of this.instances.entries()) {
      if (instance.isActive) {
        active.push(id);
      }
    }

    return active;
  }

  /**
   * Add event handler
   *
   * @param event - Event to handle
   * @param handler - Event handler function
   */
  addEventHandler(event: AgentLifecycleEvent, handler: AgentLifecycleEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  /**
   * Remove event handler
   *
   * @param event - Event to remove handler for
   * @param handler - Event handler function to remove
   */
  removeEventHandler(event: AgentLifecycleEvent, handler: AgentLifecycleEventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Emit lifecycle event
   *
   * @param event - Event to emit
   * @param agentId - ID of agent
   * @param error - Optional error
   */
  private async emitEvent(
    event: AgentLifecycleEvent,
    agentId: string,
    error?: Error
  ): Promise<void> {
    const handlers = this.eventHandlers.get(event);

    if (handlers) {
      for (const handler of handlers) {
        try {
          await handler(event, agentId, error);
        } catch (err) {
          this.logger.error(
            `Event handler error for event '${event}' on agent '${agentId}'`,
            'AgentLifecycleManager',
            { error: (err as Error).message }
          );
        }
      }
    }
  }

  /**
   * Clear all agent instances
   */
  clear(): void {
    this.instances.clear();
    this.logger.info('AgentLifecycleManager cleared', 'AgentLifecycleManager');
  }
}

/**
 * Global agent lifecycle manager instance
 */
let globalAgentLifecycleManager: AgentLifecycleManager | null = null;

/**
 * Initialize global agent lifecycle manager
 *
 * @param config - Lifecycle manager configuration
 * @param logger - Optional logger instance
 * @param errorHandler - Optional error handler instance
 * @param registry - Optional agent registry instance
 * @returns The global agent lifecycle manager
 */
export function initAgentLifecycleManager(
  config?: AgentLifecycleManagerConfig,
  logger?: Logger,
  errorHandler?: ErrorHandler,
  registry?: AgentRegistry
): AgentLifecycleManager {
  globalAgentLifecycleManager = new AgentLifecycleManager(
    config,
    logger,
    errorHandler,
    registry
  );
  return globalAgentLifecycleManager;
}

/**
 * Get global agent lifecycle manager
 *
 * @returns The global agent lifecycle manager
 */
export function getAgentLifecycleManager(): AgentLifecycleManager {
  if (!globalAgentLifecycleManager) {
    globalAgentLifecycleManager = new AgentLifecycleManager();
  }
  return globalAgentLifecycleManager;
}
