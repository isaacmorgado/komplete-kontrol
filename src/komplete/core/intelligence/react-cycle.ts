/**
 * ReAct Cycle Implementation
 *
 * Implements the ReAct (Reasoning and Acting) pattern:
 * Think → Act → Observe → (Repeat)
 *
 * Based on ARCHITECTURE-SYNTHESIS-ENHANCED.md: Intelligence Layer
 */

import { Logger, LoggerLike } from '../../utils/logger';

/**
 * ReAct thought
 */
export interface ReActThought {
  reasoning: string; // Explicit reasoning before action
  alternatives: string[]; // Alternative approaches considered
  chosenApproach: string; // Selected approach
  confidence: number; // 0.0-1.0 confidence level
  timestamp: Date;
}

/**
 * ReAct action
 */
export interface ReActAction {
  type: string; // Action type (e.g., 'code_write', 'test_run', 'search')
  description: string; // Human-readable description
  parameters: Record<string, unknown>; // Action parameters
  thought: ReActThought; // Associated thought
  timestamp: Date;
}

/**
 * ReAct observation
 */
export interface ReActObservation {
  action: ReActAction; // Associated action
  outcome: 'success' | 'failure' | 'partial';
  result?: unknown; // Action result
  error?: string; // Error message if failed
  metrics?: Record<string, number>; // Measurable metrics
  timestamp: Date;
}

/**
 * ReAct cycle configuration
 */
export interface ReActConfig {
  maxIterations?: number; // Max think-act-observe cycles (default: 10)
  minConfidence?: number; // Min confidence threshold (default: 0.6)
  allowBacktracking?: boolean; // Allow revisiting previous states (default: true)
}

/**
 * ReAct cycle state
 */
export interface ReActCycleState {
  goal: string; // Overall goal
  context: string; // Task context
  iteration: number; // Current iteration
  thoughts: ReActThought[];
  actions: ReActAction[];
  observations: ReActObservation[];
  status: 'thinking' | 'acting' | 'observing' | 'complete' | 'failed';
}

/**
 * ReAct Cycle
 *
 * Implements iterative reasoning and acting with observation feedback.
 */
export class ReActCycle {
  private logger: LoggerLike;
  private config: Required<ReActConfig>;
  private state: ReActCycleState | null = null;

  constructor(config: Partial<ReActConfig> = {}, logger?: LoggerLike) {
    this.logger = logger ?? new Logger().child('ReActCycle');
    this.config = {
      maxIterations: config.maxIterations ?? 10,
      minConfidence: config.minConfidence ?? 0.6,
      allowBacktracking: config.allowBacktracking ?? true,
    };

    this.logger.debug('ReAct cycle initialized', { config: this.config });
  }

  /**
   * Initialize cycle with goal and context
   */
  initialize(goal: string, context: string): void {
    this.state = {
      goal,
      context,
      iteration: 0,
      thoughts: [],
      actions: [],
      observations: [],
      status: 'thinking',
    };

    this.logger.info('ReAct cycle started', { goal, contextLength: context.length });
  }

  /**
   * Think phase: Generate reasoning before acting
   */
  think(
    reasoning: string,
    alternatives: string[],
    chosenApproach: string,
    confidence: number
  ): ReActThought {
    if (!this.state) {
      throw new Error('Cycle not initialized');
    }

    if (this.state.status !== 'thinking') {
      throw new Error(`Cannot think in status: ${this.state.status}`);
    }

    const thought: ReActThought = {
      reasoning,
      alternatives,
      chosenApproach,
      confidence,
      timestamp: new Date(),
    };

    this.state.thoughts.push(thought);
    this.state.status = 'acting';

    this.logger.debug('Thought generated', {
      iteration: this.state.iteration,
      confidence,
      alternativeCount: alternatives.length,
    });

    return thought;
  }

  /**
   * Act phase: Execute action based on thought
   */
  act(
    actionType: string,
    description: string,
    parameters: Record<string, unknown> = {}
  ): ReActAction {
    if (!this.state) {
      throw new Error('Cycle not initialized');
    }

    if (this.state.status !== 'acting') {
      throw new Error(`Cannot act in status: ${this.state.status}`);
    }

    const lastThought = this.state.thoughts[this.state.thoughts.length - 1];
    if (!lastThought) {
      throw new Error('No thought exists for this action');
    }

    const action: ReActAction = {
      type: actionType,
      description,
      parameters,
      thought: lastThought,
      timestamp: new Date(),
    };

    this.state.actions.push(action);
    this.state.status = 'observing';

    this.logger.debug('Action executed', {
      iteration: this.state.iteration,
      type: actionType,
      description,
    });

    return action;
  }

  /**
   * Observe phase: Record action outcome
   */
  observe(
    outcome: 'success' | 'failure' | 'partial',
    result?: unknown,
    error?: string,
    metrics?: Record<string, number>
  ): ReActObservation {
    if (!this.state) {
      throw new Error('Cycle not initialized');
    }

    if (this.state.status !== 'observing') {
      throw new Error(`Cannot observe in status: ${this.state.status}`);
    }

    const lastAction = this.state.actions[this.state.actions.length - 1];
    if (!lastAction) {
      throw new Error('No action exists for this observation');
    }

    const observation: ReActObservation = {
      action: lastAction,
      outcome,
      result,
      error,
      metrics,
      timestamp: new Date(),
    };

    this.state.observations.push(observation);
    this.state.iteration++;

    // Check if cycle should complete
    if (outcome === 'success' && this.shouldComplete()) {
      this.state.status = 'complete';
      this.logger.info('ReAct cycle completed successfully', {
        iterations: this.state.iteration,
        thoughtCount: this.state.thoughts.length,
        actionCount: this.state.actions.length,
      });
    } else if (outcome === 'failure' && !this.canContinue()) {
      this.state.status = 'failed';
      this.logger.warn('ReAct cycle failed', {
        iterations: this.state.iteration,
        error,
      });
    } else {
      // Continue to next iteration
      this.state.status = 'thinking';
      this.logger.debug('Observation recorded, continuing cycle', {
        iteration: this.state.iteration,
        outcome,
      });
    }

    return observation;
  }

  /**
   * Check if cycle should complete
   */
  private shouldComplete(): boolean {
    if (!this.state) return false;

    // Check if goal is achieved based on observations
    const lastObservation = this.state.observations[this.state.observations.length - 1];
    return lastObservation?.outcome === 'success';
  }

  /**
   * Check if cycle can continue
   */
  private canContinue(): boolean {
    if (!this.state) return false;

    // Check max iterations
    if (this.state.iteration >= this.config.maxIterations) {
      this.logger.warn('Max iterations reached', { iterations: this.state.iteration });
      return false;
    }

    // Check if confidence is too low
    const lastThought = this.state.thoughts[this.state.thoughts.length - 1];
    if (lastThought && lastThought.confidence < this.config.minConfidence) {
      this.logger.warn('Confidence below threshold', {
        confidence: lastThought.confidence,
        threshold: this.config.minConfidence,
      });
      return false;
    }

    return true;
  }

  /**
   * Get current state
   */
  getState(): ReActCycleState | null {
    return this.state;
  }

  /**
   * Get cycle summary
   */
  getSummary(): {
    goal: string;
    iterations: number;
    status: string;
    thoughtCount: number;
    actionCount: number;
    observationCount: number;
    successRate: number;
    avgConfidence: number;
  } | null {
    if (!this.state) return null;

    const successCount = this.state.observations.filter(o => o.outcome === 'success').length;
    const avgConfidence =
      this.state.thoughts.reduce((sum, t) => sum + t.confidence, 0) / this.state.thoughts.length || 0;

    return {
      goal: this.state.goal,
      iterations: this.state.iteration,
      status: this.state.status,
      thoughtCount: this.state.thoughts.length,
      actionCount: this.state.actions.length,
      observationCount: this.state.observations.length,
      successRate: this.state.observations.length > 0 ? successCount / this.state.observations.length : 0,
      avgConfidence,
    };
  }

  /**
   * Reset cycle
   */
  reset(): void {
    this.state = null;
    this.logger.debug('ReAct cycle reset');
  }

  /**
   * Export cycle history
   */
  exportHistory(): {
    thoughts: ReActThought[];
    actions: ReActAction[];
    observations: ReActObservation[];
  } | null {
    if (!this.state) return null;

    return {
      thoughts: this.state.thoughts,
      actions: this.state.actions,
      observations: this.state.observations,
    };
  }
}

/**
 * Create ReAct cycle
 */
export function createReActCycle(config?: Partial<ReActConfig>, logger?: LoggerLike): ReActCycle {
  return new ReActCycle(config, logger);
}
