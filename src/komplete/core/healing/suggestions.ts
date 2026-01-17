/**
 * Auto-Suggestion System
 *
 * Provides suggestion generation based on errors,
 * suggestion ranking and filtering, and suggestion application.
 */

import { z } from 'zod';
import { Logger } from '../../utils/logger';
import { ErrorPatternMatching, ErrorCategory, ErrorSeverity } from './patterns';

/**
 * Suggestion priority
 */
export enum SuggestionPriority {
  /**
   * Critical priority
   */
  CRITICAL = 'critical',

  /**
   * High priority
   */
  HIGH = 'high',

  /**
   * Medium priority
   */
  MEDIUM = 'medium',

  /**
   * Low priority
   */
  LOW = 'low',
}

/**
 * Suggestion type
 */
export enum SuggestionType {
  /**
   * Fix suggestion
   */
  FIX = 'fix',

  /**
   * Refactor suggestion
   */
  REFACTOR = 'refactor',

  /**
   * Optimize suggestion
   */
  OPTIMIZE = 'optimize',

  /**
   * Best practice suggestion
   */
  BEST_PRACTICE = 'best_practice',

  /**
   * Security suggestion
   */
  SECURITY = 'security',

  /**
   * Performance suggestion
   */
  PERFORMANCE = 'performance',
}

/**
 * Suggestion
 */
export interface Suggestion {
  /**
   * Suggestion ID
   */
  id: string;

  /**
   * Suggestion type
   */
  type: SuggestionType;

  /**
   * Suggestion priority
   */
  priority: SuggestionPriority;

  /**
   * Suggestion description
   */
  description: string;

  /**
   * Fix code
   */
  fix: string;

  /**
   * Line number
   */
  lineNumber?: number;

  /**
   * Column number
   */
  columnNumber?: number;

  /**
   * Confidence score (0-1)
   */
  confidence: number;

  /**
   * Related error patterns
   */
  relatedPatterns: string[];

  /**
   * Suggestion metadata
   */
  metadata: Record<string, unknown>;
}

/**
 * Suggestion options
 */
export interface SuggestionOptions {
  /**
   * Include type filter
   */
  includeTypes?: SuggestionType[];

  /**
   * Exclude type filter
   */
  excludeTypes?: SuggestionType[];

  /**
   * Include priority filter
   */
  includePriorities?: SuggestionPriority[];

  /**
   * Exclude priority filter
   */
  excludePriorities?: SuggestionPriority[];

  /**
   * Minimum confidence
   */
  minConfidence?: number;

  /**
   * Max suggestions
   */
  maxSuggestions?: number;

  /**
   * Language
   */
  language?: string;

  /**
   * Apply ranking
   */
  applyRanking?: boolean;
}

/**
 * Suggestion ranking strategy
 */
export enum RankingStrategy {
  /**
   * Confidence-based ranking
   */
  CONFIDENCE = 'confidence',

  /**
   * Priority-based ranking
   */
  PRIORITY = 'priority',

  /**
   * Combined ranking
   */
  COMBINED = 'combined',

  /**
   * Frequency-based ranking
   */
  FREQUENCY = 'frequency',
}

/**
 * Suggestion filter options
 */
export interface SuggestionFilterOptions {
  /**
   * Error category filter
   */
  category?: ErrorCategory;

  /**
   * Error severity filter
   */
  severity?: ErrorSeverity;

  /**
   * Language filter
   */
  language?: string;

  /**
   * Minimum confidence
   */
  minConfidence?: number;

  /**
   * Maximum age (ms)
   */
  maxAge?: number;
}

/**
 * Auto-suggestion system class
 *
 * Provides suggestion generation based on errors.
 */
export class AutoSuggestionSystem {
  private logger: Logger;
  private patternMatching: ErrorPatternMatching;
  private suggestions: Map<string, Suggestion> = new Map();
  private suggestionHistory: Map<string, number> = new Map();
  private cacheEnabled: boolean;

  constructor(options?: {
    logger?: Logger;
    patternMatching?: ErrorPatternMatching;
    cacheEnabled?: boolean;
  }) {
    this.logger = options?.logger || new Logger();
    this.patternMatching = options?.patternMatching || new ErrorPatternMatching();
    this.cacheEnabled = options?.cacheEnabled ?? true;

    this.logger.info('AutoSuggestionSystem initialized', 'AutoSuggestionSystem');
  }

  /**
   * Generate suggestions for an error
   *
   * @param errorText - Error text
   * @param code - Current code
   * @param options - Suggestion options
   * @returns Array of suggestions
   */
  async generateSuggestions(
    errorText: string,
    code: string,
    options: SuggestionOptions = {}
  ): Promise<Suggestion[]> {
    // Match error patterns
    const patternMatches = this.patternMatching.matchPatterns(errorText);

    if (patternMatches.length === 0) {
      return [];
    }

    const suggestions: Suggestion[] = [];

    // Generate suggestions from pattern matches
    for (const match of patternMatches) {
      const suggestion = this.createSuggestionFromMatch(match, code, options);
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }

    // Apply filters
    const filtered = this.filterSuggestions(suggestions, options);

    // Apply ranking if enabled
    const ranked = options.applyRanking !== false
      ? this.rankSuggestions(filtered, RankingStrategy.COMBINED)
      : filtered;

    // Apply max suggestions limit
    const maxSuggestions = options.maxSuggestions ?? 10;
    return ranked.slice(0, maxSuggestions);
  }

  /**
   * Get suggestion by ID
   *
   * @param suggestionId - Suggestion ID
   * @returns Suggestion or undefined
   */
  getSuggestion(suggestionId: string): Suggestion | undefined {
    return this.suggestions.get(suggestionId);
  }

  /**
   * Get all suggestions
   *
   * @returns Map of suggestion IDs to suggestions
   */
  getAllSuggestions(): Map<string, Suggestion> {
    return new Map(this.suggestions);
  }

  /**
   * Add suggestion
   *
   * @param suggestion - Suggestion to add
   */
  addSuggestion(suggestion: Suggestion): void {
    this.suggestions.set(suggestion.id, suggestion);
    this.logger.debug(`Added suggestion: ${suggestion.id}`, 'AutoSuggestionSystem');
  }

  /**
   * Remove suggestion
   *
   * @param suggestionId - Suggestion ID
   * @returns Success
   */
  removeSuggestion(suggestionId: string): boolean {
    const removed = this.suggestions.delete(suggestionId);
    if (removed) {
      this.logger.debug(`Removed suggestion: ${suggestionId}`, 'AutoSuggestionSystem');
    }
    return removed;
  }

  /**
   * Rank suggestions
   *
   * @param suggestions - Suggestions to rank
   * @param strategy - Ranking strategy
   * @returns Ranked suggestions
   */
  rankSuggestions(
    suggestions: Suggestion[],
    strategy: RankingStrategy = RankingStrategy.COMBINED
  ): Suggestion[] {
    const ranked = [...suggestions];

    switch (strategy) {
      case RankingStrategy.CONFIDENCE:
        ranked.sort((a, b) => b.confidence - a.confidence);
        break;

      case RankingStrategy.PRIORITY:
        ranked.sort((a, b) => {
          const priorityOrder = [
            SuggestionPriority.CRITICAL,
            SuggestionPriority.HIGH,
            SuggestionPriority.MEDIUM,
            SuggestionPriority.LOW,
          ];
          return priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority);
        });
        break;

      case RankingStrategy.FREQUENCY:
        ranked.sort((a, b) => {
          const freqA = this.suggestionHistory.get(a.id) || 0;
          const freqB = this.suggestionHistory.get(b.id) || 0;
          return freqB - freqA;
        });
        break;

      case RankingStrategy.COMBINED:
        ranked.sort((a, b) => {
          const priorityOrder = [
            SuggestionPriority.CRITICAL,
            SuggestionPriority.HIGH,
            SuggestionPriority.MEDIUM,
            SuggestionPriority.LOW,
          ];
          const priorityScoreA = 4 - priorityOrder.indexOf(a.priority);
          const priorityScoreB = 4 - priorityOrder.indexOf(b.priority);

          const combinedScoreA = (a.confidence * 0.6) + (priorityScoreA * 0.4);
          const combinedScoreB = (b.confidence * 0.6) + (priorityScoreB * 0.4);

          return combinedScoreB - combinedScoreA;
        });
        break;
    }

    return ranked;
  }

  /**
   * Filter suggestions
   *
   * @param suggestions - Suggestions to filter
   * @param options - Filter options
   * @returns Filtered suggestions
   */
  filterSuggestions(
    suggestions: Suggestion[],
    options: SuggestionOptions
  ): Suggestion[] {
    let filtered = [...suggestions];

    // Type filters
    if (options.includeTypes) {
      filtered = filtered.filter((s) => options.includeTypes!.includes(s.type));
    }

    if (options.excludeTypes) {
      filtered = filtered.filter((s) => !options.excludeTypes!.includes(s.type));
    }

    // Priority filters
    if (options.includePriorities) {
      filtered = filtered.filter((s) => options.includePriorities!.includes(s.priority));
    }

    if (options.excludePriorities) {
      filtered = filtered.filter((s) => !options.excludePriorities!.includes(s.priority));
    }

    // Confidence filter
    if (options.minConfidence) {
      filtered = filtered.filter((s) => s.confidence >= options.minConfidence!);
    }

    return filtered;
  }

  /**
   * Track suggestion usage
   *
   * @param suggestionId - Suggestion ID
   */
  trackSuggestionUsage(suggestionId: string): void {
    const count = this.suggestionHistory.get(suggestionId) || 0;
    this.suggestionHistory.set(suggestionId, count + 1);
  }

  /**
   * Get suggestion statistics
   *
   * @returns Suggestion statistics
   */
  getStatistics(): {
    totalSuggestions: number;
    suggestionsByType: Record<SuggestionType, number>;
    suggestionsByPriority: Record<SuggestionPriority, number>;
    topUsedSuggestions: Array<{ id: string; count: number }>;
  } {
    const suggestionsByType: Record<SuggestionType, number> = {
      [SuggestionType.FIX]: 0,
      [SuggestionType.REFACTOR]: 0,
      [SuggestionType.OPTIMIZE]: 0,
      [SuggestionType.BEST_PRACTICE]: 0,
      [SuggestionType.SECURITY]: 0,
      [SuggestionType.PERFORMANCE]: 0,
    };

    const suggestionsByPriority: Record<SuggestionPriority, number> = {
      [SuggestionPriority.CRITICAL]: 0,
      [SuggestionPriority.HIGH]: 0,
      [SuggestionPriority.MEDIUM]: 0,
      [SuggestionPriority.LOW]: 0,
    };

    for (const suggestion of this.suggestions.values()) {
      suggestionsByType[suggestion.type]++;
      suggestionsByPriority[suggestion.priority]++;
    }

    // Get top used suggestions
    const topUsedSuggestions = Array.from(this.suggestionHistory.entries())
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalSuggestions: this.suggestions.size,
      suggestionsByType,
      suggestionsByPriority,
      topUsedSuggestions,
    };
  }

  /**
   * Clear all suggestions
   */
  clearSuggestions(): void {
    this.suggestions.clear();
    this.suggestionHistory.clear();
    this.logger.debug('Suggestions cleared', 'AutoSuggestionSystem');
  }

  /**
   * Create suggestion from pattern match
   *
   * @param match - Pattern match
   * @param code - Current code
   * @param options - Suggestion options
   * @returns Suggestion or undefined
   */
  private createSuggestionFromMatch(
    match: { patternId: string; suggestedFixes: string[]; confidence: number; lineNumber?: number },
    code: string,
    options: SuggestionOptions
  ): Suggestion | undefined {
    if (match.suggestedFixes.length === 0) {
      return undefined;
    }

    const suggestionId = `suggestion_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const fix = match.suggestedFixes[0];

    // Determine priority based on confidence
    let priority: SuggestionPriority;
    if (match.confidence >= 0.9) {
      priority = SuggestionPriority.CRITICAL;
    } else if (match.confidence >= 0.7) {
      priority = SuggestionPriority.HIGH;
    } else if (match.confidence >= 0.5) {
      priority = SuggestionPriority.MEDIUM;
    } else {
      priority = SuggestionPriority.LOW;
    }

    const suggestion: Suggestion = {
      id: suggestionId,
      type: SuggestionType.FIX,
      priority,
      description: fix,
      fix: this.generateFixCode(fix, code, match.lineNumber),
      lineNumber: match.lineNumber,
      confidence: match.confidence,
      relatedPatterns: [match.patternId],
      metadata: {
        language: options.language || 'typescript',
        timestamp: Date.now(),
      },
    };

    this.suggestions.set(suggestionId, suggestion);
    return suggestion;
  }

  /**
   * Generate fix code from description
   *
   * @param description - Fix description
   * @param code - Current code
   * @param lineNumber - Line number
   * @returns Fix code
   */
  private generateFixCode(
    description: string,
    code: string,
    lineNumber?: number
  ): string {
    // Simple fix generation based on description
    const lines = code.split('\n');

    if (description.includes('import') && lineNumber) {
      // Add import statement
      const importMatch = description.match(/import\s+(\w+)/);
      if (importMatch) {
        const importStatement = `import { ${importMatch[1]} } from './${importMatch[1].toLowerCase()}';`;
        lines.splice(lineNumber - 1, 0, importStatement);
      }
    }

    if (description.includes('semicolon') && lineNumber) {
      // Add semicolon
      if (lineNumber > 0 && lineNumber <= lines.length) {
        lines[lineNumber - 1] = lines[lineNumber - 1].trimEnd() + ';';
      }
    }

    if (description.includes('bracket') && lineNumber) {
      // Add closing bracket
      if (lineNumber > 0 && lineNumber <= lines.length) {
        lines[lineNumber - 1] = lines[lineNumber - 1].trimEnd() + '}';
      }
    }

    if (description.includes('null check')) {
      // Add null check
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('.') && !lines[i].includes('?.')) {
          lines[i] = lines[i].replace(/\./, '?.');
        }
      }
    }

    return lines.join('\n');
  }
}

/**
 * Schema for suggestion options
 */
export const SuggestionOptionsSchema = z.object({
  includeTypes: z.array(z.nativeEnum(SuggestionType)).optional(),
  excludeTypes: z.array(z.nativeEnum(SuggestionType)).optional(),
  includePriorities: z.array(z.nativeEnum(SuggestionPriority)).optional(),
  excludePriorities: z.array(z.nativeEnum(SuggestionPriority)).optional(),
  minConfidence: z.number().min(0).max(1).optional(),
  maxSuggestions: z.number().min(1).optional(),
  language: z.string().optional(),
  applyRanking: z.boolean().optional(),
});

/**
 * Global auto-suggestion system instance
 */
let globalAutoSuggestionSystem: AutoSuggestionSystem | null = null;

/**
 * Initialize global auto-suggestion system
 *
 * @param options - Options
 * @returns The global auto-suggestion system
 */
export function initAutoSuggestionSystem(options?: {
  logger?: Logger;
  patternMatching?: ErrorPatternMatching;
  cacheEnabled?: boolean;
}): AutoSuggestionSystem {
  globalAutoSuggestionSystem = new AutoSuggestionSystem(options);
  return globalAutoSuggestionSystem;
}

/**
 * Get global auto-suggestion system
 *
 * @returns The global auto-suggestion system
 */
export function getAutoSuggestionSystem(): AutoSuggestionSystem {
  if (!globalAutoSuggestionSystem) {
    globalAutoSuggestionSystem = new AutoSuggestionSystem();
  }
  return globalAutoSuggestionSystem;
}
