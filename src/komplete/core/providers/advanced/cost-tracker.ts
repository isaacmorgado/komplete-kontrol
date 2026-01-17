/**
 * Cost Tracker for KOMPLETE-KONTROL CLI
 *
 * Tracks per-request costs for LLM usage across providers and models.
 */

import { Logger, LoggerLike } from '../../../utils/logger';

/**
 * Token pricing per 1K tokens
 */
export interface TokenPricing {
  /**
   * Input token price per 1K tokens
   */
  inputPricePer1k: number;

  /**
   * Output token price per 1K tokens
   */
  outputPricePer1k: number;

  /**
   * Currency (default: USD)
   */
  currency?: string;
}

/**
 * Cost entry for a single request
 */
export interface CostEntry {
  /**
   * Unique request ID
   */
  requestId: string;

  /**
   * Provider used
   */
  provider: string;

  /**
   * Model used
   */
  model: string;

  /**
   * Input tokens
   */
  inputTokens: number;

  /**
   * Output tokens
   */
  outputTokens: number;

  /**
   * Input cost
   */
  inputCost: number;

  /**
   * Output cost
   */
  outputCost: number;

  /**
   * Total cost
   */
  totalCost: number;

  /**
   * Currency
   */
  currency: string;

  /**
   * Timestamp
   */
  timestamp: Date;

  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Cost tracker configuration
 */
export interface CostTrackerConfig {
  /**
   * Default currency
   */
  currency: string;

  /**
   * Budget limit (total)
   */
  budgetLimit?: number;

  /**
   * Daily budget limit
   */
  dailyBudgetLimit?: number;

  /**
   * Alert threshold (0-1)
   */
  alertThreshold?: number;

  /**
   * Enable cost tracking
   */
  enabled: boolean;

  /**
   * Maximum entries to keep in history
   */
  maxHistoryEntries: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: CostTrackerConfig = {
  currency: 'USD',
  alertThreshold: 0.8,
  enabled: true,
  maxHistoryEntries: 10000,
};

/**
 * Known model pricing (as of 2024)
 */
const MODEL_PRICING: Record<string, TokenPricing> = {
  // OpenAI GPT-4o
  'gpt-4o': { inputPricePer1k: 0.005, outputPricePer1k: 0.015 },
  'gpt-4o-mini': { inputPricePer1k: 0.00015, outputPricePer1k: 0.0006 },
  // OpenAI GPT-4
  'gpt-4-turbo': { inputPricePer1k: 0.01, outputPricePer1k: 0.03 },
  'gpt-4-turbo-preview': { inputPricePer1k: 0.01, outputPricePer1k: 0.03 },
  'gpt-4': { inputPricePer1k: 0.03, outputPricePer1k: 0.06 },
  'gpt-4-32k': { inputPricePer1k: 0.06, outputPricePer1k: 0.12 },
  // OpenAI GPT-3.5
  'gpt-3.5-turbo': { inputPricePer1k: 0.0005, outputPricePer1k: 0.0015 },
  'gpt-3.5-turbo-16k': { inputPricePer1k: 0.001, outputPricePer1k: 0.002 },
  // Anthropic Claude 3.5
  'claude-3-5-sonnet-20241022': { inputPricePer1k: 0.003, outputPricePer1k: 0.015 },
  'claude-3.5-sonnet': { inputPricePer1k: 0.003, outputPricePer1k: 0.015 },
  // Anthropic Claude 3
  'claude-3-opus-20240229': { inputPricePer1k: 0.015, outputPricePer1k: 0.075 },
  'claude-3-opus': { inputPricePer1k: 0.015, outputPricePer1k: 0.075 },
  'claude-3-sonnet-20240229': { inputPricePer1k: 0.003, outputPricePer1k: 0.015 },
  'claude-3-sonnet': { inputPricePer1k: 0.003, outputPricePer1k: 0.015 },
  'claude-3-haiku-20240307': { inputPricePer1k: 0.00025, outputPricePer1k: 0.00125 },
  'claude-3-haiku': { inputPricePer1k: 0.00025, outputPricePer1k: 0.00125 },
  // Groq (free tier pricing shown, may vary)
  'llama3-70b-8192': { inputPricePer1k: 0.00059, outputPricePer1k: 0.00079 },
  'llama3-8b-8192': { inputPricePer1k: 0.00005, outputPricePer1k: 0.00008 },
  'mixtral-8x7b-32768': { inputPricePer1k: 0.00024, outputPricePer1k: 0.00024 },
  // Ollama (local - free)
  'llama3': { inputPricePer1k: 0, outputPricePer1k: 0 },
  'llama3:8b': { inputPricePer1k: 0, outputPricePer1k: 0 },
  'llama3:70b': { inputPricePer1k: 0, outputPricePer1k: 0 },
  'mistral': { inputPricePer1k: 0, outputPricePer1k: 0 },
  'codellama': { inputPricePer1k: 0, outputPricePer1k: 0 },
};

/**
 * Cost summary for a time period
 */
export interface CostSummary {
  /**
   * Total cost
   */
  totalCost: number;

  /**
   * Total input tokens
   */
  totalInputTokens: number;

  /**
   * Total output tokens
   */
  totalOutputTokens: number;

  /**
   * Request count
   */
  requestCount: number;

  /**
   * Average cost per request
   */
  avgCostPerRequest: number;

  /**
   * Cost by provider
   */
  byProvider: Record<string, number>;

  /**
   * Cost by model
   */
  byModel: Record<string, number>;

  /**
   * Currency
   */
  currency: string;
}

/**
 * Cost Tracker
 *
 * Tracks and aggregates LLM usage costs.
 */
export class CostTracker {
  private logger: LoggerLike;
  private config: CostTrackerConfig;
  private history: CostEntry[] = [];
  private customPricing: Map<string, TokenPricing> = new Map();
  private totalCost: number = 0;
  private dailyCost: Map<string, number> = new Map();

  constructor(config: Partial<CostTrackerConfig> = {}, logger?: LoggerLike) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = logger?.child('CostTracker') ?? new Logger().child('CostTracker');

    this.logger.info('CostTracker initialized', 'CostTracker', {
      budgetLimit: this.config.budgetLimit,
      dailyBudgetLimit: this.config.dailyBudgetLimit,
    });
  }

  /**
   * Get pricing for a model
   */
  getPricing(model: string): TokenPricing {
    // Check custom pricing first
    const custom = this.customPricing.get(model);
    if (custom) {
      return custom;
    }

    // Remove provider prefix if present
    const cleanModel = model.includes('/') ? model.split('/')[1]! : model;

    // Check known pricing
    if (MODEL_PRICING[cleanModel]) {
      return MODEL_PRICING[cleanModel];
    }

    // Check prefix match
    for (const [modelPrefix, pricing] of Object.entries(MODEL_PRICING)) {
      if (cleanModel.startsWith(modelPrefix)) {
        return pricing;
      }
    }

    // Default: assume free (like local Ollama)
    this.logger.debug(`Unknown model ${model}, assuming free`, 'CostTracker');
    return { inputPricePer1k: 0, outputPricePer1k: 0 };
  }

  /**
   * Set custom pricing for a model
   */
  setCustomPricing(model: string, pricing: TokenPricing): void {
    this.customPricing.set(model, pricing);
    this.logger.debug(`Custom pricing set for ${model}`, 'CostTracker', pricing);
  }

  /**
   * Track a request
   */
  track(
    requestId: string,
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    metadata?: Record<string, unknown>
  ): CostEntry {
    if (!this.config.enabled) {
      return {
        requestId,
        provider,
        model,
        inputTokens,
        outputTokens,
        inputCost: 0,
        outputCost: 0,
        totalCost: 0,
        currency: this.config.currency,
        timestamp: new Date(),
        metadata,
      };
    }

    const pricing = this.getPricing(model);

    const inputCost = (inputTokens / 1000) * pricing.inputPricePer1k;
    const outputCost = (outputTokens / 1000) * pricing.outputPricePer1k;
    const totalCost = inputCost + outputCost;

    const entry: CostEntry = {
      requestId,
      provider,
      model,
      inputTokens,
      outputTokens,
      inputCost,
      outputCost,
      totalCost,
      currency: pricing.currency || this.config.currency,
      timestamp: new Date(),
      metadata,
    };

    // Add to history
    this.history.push(entry);
    if (this.history.length > this.config.maxHistoryEntries) {
      this.history.shift();
    }

    // Update totals
    this.totalCost += totalCost;

    // Update daily total
    const today = new Date().toISOString().split('T')[0]!;
    const currentDaily = this.dailyCost.get(today) || 0;
    this.dailyCost.set(today, currentDaily + totalCost);

    // Check budget alerts
    this.checkBudgetAlerts();

    this.logger.debug('Request tracked', 'CostTracker', {
      requestId,
      provider,
      model,
      inputTokens,
      outputTokens,
      totalCost: totalCost.toFixed(6),
    });

    return entry;
  }

  /**
   * Check budget alerts
   */
  private checkBudgetAlerts(): void {
    const threshold = this.config.alertThreshold || 0.8;

    // Check total budget
    if (this.config.budgetLimit) {
      const usage = this.totalCost / this.config.budgetLimit;
      if (usage >= threshold) {
        this.logger.warn('Budget alert: approaching total limit', 'CostTracker', {
          currentCost: this.totalCost.toFixed(4),
          budgetLimit: this.config.budgetLimit,
          usage: (usage * 100).toFixed(1) + '%',
        });
      }
      if (usage >= 1) {
        this.logger.error('Budget exceeded!', 'CostTracker', {
          currentCost: this.totalCost.toFixed(4),
          budgetLimit: this.config.budgetLimit,
        });
      }
    }

    // Check daily budget
    if (this.config.dailyBudgetLimit) {
      const today = new Date().toISOString().split('T')[0]!;
      const dailyTotal = this.dailyCost.get(today) || 0;
      const usage = dailyTotal / this.config.dailyBudgetLimit;

      if (usage >= threshold) {
        this.logger.warn('Budget alert: approaching daily limit', 'CostTracker', {
          currentDailyCost: dailyTotal.toFixed(4),
          dailyBudgetLimit: this.config.dailyBudgetLimit,
          usage: (usage * 100).toFixed(1) + '%',
        });
      }
    }
  }

  /**
   * Get cost summary for a time range
   */
  getSummary(startDate?: Date, endDate?: Date): CostSummary {
    const now = new Date();
    const start = startDate || new Date(0);
    const end = endDate || now;

    const filtered = this.history.filter(
      entry => entry.timestamp >= start && entry.timestamp <= end
    );

    const byProvider: Record<string, number> = {};
    const byModel: Record<string, number> = {};
    let totalCost = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for (const entry of filtered) {
      totalCost += entry.totalCost;
      totalInputTokens += entry.inputTokens;
      totalOutputTokens += entry.outputTokens;

      byProvider[entry.provider] = (byProvider[entry.provider] || 0) + entry.totalCost;
      byModel[entry.model] = (byModel[entry.model] || 0) + entry.totalCost;
    }

    return {
      totalCost,
      totalInputTokens,
      totalOutputTokens,
      requestCount: filtered.length,
      avgCostPerRequest: filtered.length > 0 ? totalCost / filtered.length : 0,
      byProvider,
      byModel,
      currency: this.config.currency,
    };
  }

  /**
   * Get today's summary
   */
  getTodaySummary(): CostSummary {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.getSummary(today);
  }

  /**
   * Get this month's summary
   */
  getMonthSummary(): CostSummary {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    return this.getSummary(monthStart);
  }

  /**
   * Get total cost
   */
  getTotalCost(): number {
    return this.totalCost;
  }

  /**
   * Get daily cost for a date
   */
  getDailyCost(date?: Date): number {
    const d = date || new Date();
    const key = d.toISOString().split('T')[0]!;
    return this.dailyCost.get(key) || 0;
  }

  /**
   * Get history
   */
  getHistory(limit?: number): CostEntry[] {
    if (limit) {
      return this.history.slice(-limit);
    }
    return [...this.history];
  }

  /**
   * Check if budget exceeded
   */
  isBudgetExceeded(): boolean {
    if (!this.config.budgetLimit) {
      return false;
    }
    return this.totalCost >= this.config.budgetLimit;
  }

  /**
   * Check if daily budget exceeded
   */
  isDailyBudgetExceeded(): boolean {
    if (!this.config.dailyBudgetLimit) {
      return false;
    }
    return this.getDailyCost() >= this.config.dailyBudgetLimit;
  }

  /**
   * Reset tracking
   */
  reset(): void {
    this.history = [];
    this.totalCost = 0;
    this.dailyCost.clear();
    this.logger.info('Cost tracking reset', 'CostTracker');
  }

  /**
   * Export cost data
   */
  export(): {
    config: CostTrackerConfig;
    totalCost: number;
    history: CostEntry[];
    dailyCosts: Record<string, number>;
  } {
    return {
      config: this.config,
      totalCost: this.totalCost,
      history: [...this.history],
      dailyCosts: Object.fromEntries(this.dailyCost),
    };
  }

  /**
   * Import cost data
   */
  import(data: {
    totalCost?: number;
    history?: CostEntry[];
    dailyCosts?: Record<string, number>;
  }): void {
    if (data.totalCost !== undefined) {
      this.totalCost = data.totalCost;
    }
    if (data.history) {
      this.history = data.history.map(e => ({
        ...e,
        timestamp: new Date(e.timestamp),
      }));
    }
    if (data.dailyCosts) {
      this.dailyCost = new Map(Object.entries(data.dailyCosts));
    }
    this.logger.info('Cost data imported', 'CostTracker');
  }
}

/**
 * Global cost tracker instance
 */
let globalCostTracker: CostTracker | null = null;

/**
 * Initialize global cost tracker
 */
export function initCostTracker(
  config?: Partial<CostTrackerConfig>,
  logger?: Logger
): CostTracker {
  globalCostTracker = new CostTracker(config, logger);
  return globalCostTracker;
}

/**
 * Get global cost tracker
 */
export function getCostTracker(): CostTracker {
  if (!globalCostTracker) {
    globalCostTracker = new CostTracker();
  }
  return globalCostTracker;
}
