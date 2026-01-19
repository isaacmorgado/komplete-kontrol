/**
 * Reflexion Framework
 *
 * Implements self-reflection and learning from experience:
 * Observe → Reflect → Revise
 *
 * Based on ARCHITECTURE-SYNTHESIS-ENHANCED.md: Intelligence Layer
 */

import { Logger, LoggerLike } from '../../utils/logger';
import { ReActObservation, ReActThought, ReActAction } from './react-cycle';

/**
 * Reflection entry
 */
export interface Reflection {
  observation: ReActObservation;
  critique: string; // Self-critique of the action
  lessonsLearned: string[]; // Key takeaways
  improvements: string[]; // Suggested improvements
  confidence: number; // Confidence in the reflection (0.0-1.0)
  timestamp: Date;
}

/**
 * Revision plan
 */
export interface RevisionPlan {
  reason: string; // Why revision is needed
  originalApproach: string; // Original approach that failed/succeeded
  revisedApproach: string; // New approach to try
  expectedImprovement: string; // Expected benefits
  confidence: number; // Confidence in the revision (0.0-1.0)
  timestamp: Date;
}

/**
 * Pattern learned from experience
 */
export interface LearnedPattern {
  id: string;
  context: string; // Situation where pattern applies
  pattern: string; // The pattern itself
  outcome: 'positive' | 'negative'; // Whether pattern led to good/bad outcome
  frequency: number; // How many times observed
  confidence: number; // Confidence in the pattern (0.0-1.0)
  examples: ReActObservation[]; // Example observations
  firstSeen: Date;
  lastSeen: Date;
}

/**
 * Reflexion configuration
 */
export interface ReflexionConfig {
  minConfidenceForPattern?: number; // Min confidence to create pattern (default: 0.7)
  minFrequencyForPattern?: number; // Min frequency to trust pattern (default: 3)
  maxPatterns?: number; // Max patterns to store (default: 1000)
}

/**
 * Reflexion Framework
 *
 * Implements self-reflection and iterative improvement through experience.
 */
export class Reflexion {
  private logger: LoggerLike;
  private config: Required<ReflexionConfig>;
  private reflections: Reflection[] = [];
  private patterns: Map<string, LearnedPattern> = new Map();
  private patternIdCounter: number = 0;

  constructor(config: Partial<ReflexionConfig> = {}, logger?: LoggerLike) {
    this.logger = logger ?? new Logger().child('Reflexion');
    this.config = {
      minConfidenceForPattern: config.minConfidenceForPattern ?? 0.7,
      minFrequencyForPattern: config.minFrequencyForPattern ?? 3,
      maxPatterns: config.maxPatterns ?? 1000,
    };

    this.logger.debug('Reflexion initialized', { config: this.config });
  }

  /**
   * Reflect on observation
   */
  reflect(
    observation: ReActObservation,
    critique: string,
    lessonsLearned: string[],
    improvements: string[],
    confidence: number
  ): Reflection {
    const reflection: Reflection = {
      observation,
      critique,
      lessonsLearned,
      improvements,
      confidence,
      timestamp: new Date(),
    };

    this.reflections.push(reflection);

    this.logger.debug('Reflection recorded', {
      outcome: observation.outcome,
      confidence,
      lessonCount: lessonsLearned.length,
      improvementCount: improvements.length,
    });

    // Extract patterns from reflection
    this.extractPatterns(reflection);

    return reflection;
  }

  /**
   * Generate revision plan based on reflection
   */
  generateRevision(
    reflection: Reflection,
    revisedApproach: string,
    expectedImprovement: string,
    confidence: number
  ): RevisionPlan {
    const revision: RevisionPlan = {
      reason: reflection.critique,
      originalApproach: reflection.observation.action.thought.chosenApproach,
      revisedApproach,
      expectedImprovement,
      confidence,
      timestamp: new Date(),
    };

    this.logger.debug('Revision plan generated', {
      originalApproach: revision.originalApproach.substring(0, 50),
      confidence,
    });

    return revision;
  }

  /**
   * Extract patterns from reflection
   */
  private extractPatterns(reflection: Reflection): void {
    const { observation, lessonsLearned, confidence } = reflection;

    if (confidence < this.config.minConfidenceForPattern) {
      return; // Don't create patterns from low-confidence reflections
    }

    // Create pattern from each lesson learned
    for (const lesson of lessonsLearned) {
      const patternKey = this.generatePatternKey(observation.action.type, lesson);
      const existingPattern = this.patterns.get(patternKey);

      if (existingPattern) {
        // Update existing pattern
        existingPattern.frequency++;
        existingPattern.lastSeen = new Date();
        existingPattern.examples.push(observation);
        existingPattern.confidence = Math.min(
          1.0,
          existingPattern.confidence + 0.1 * (observation.outcome === 'success' ? 1 : -0.5)
        );

        this.logger.debug('Pattern updated', {
          patternId: existingPattern.id,
          frequency: existingPattern.frequency,
          confidence: existingPattern.confidence,
        });
      } else {
        // Create new pattern
        const pattern: LearnedPattern = {
          id: `pattern_${this.patternIdCounter++}`,
          context: `${observation.action.type}: ${observation.action.description}`,
          pattern: lesson,
          outcome: observation.outcome === 'success' ? 'positive' : 'negative',
          frequency: 1,
          confidence,
          examples: [observation],
          firstSeen: new Date(),
          lastSeen: new Date(),
        };

        this.patterns.set(patternKey, pattern);

        this.logger.debug('Pattern created', {
          patternId: pattern.id,
          context: pattern.context.substring(0, 50),
        });

        // Enforce max patterns
        if (this.patterns.size > this.config.maxPatterns) {
          this.prunePatterns();
        }
      }
    }
  }

  /**
   * Generate pattern key
   */
  private generatePatternKey(actionType: string, lesson: string): string {
    return `${actionType}:${lesson.substring(0, 50)}`;
  }

  /**
   * Prune low-confidence or infrequent patterns
   */
  private prunePatterns(): void {
    const sortedPatterns = Array.from(this.patterns.entries()).sort((a, b) => {
      const scoreA = a[1].confidence * a[1].frequency;
      const scoreB = b[1].confidence * b[1].frequency;
      return scoreA - scoreB;
    });

    // Remove bottom 10%
    const removeCount = Math.floor(this.patterns.size * 0.1);
    for (let i = 0; i < removeCount; i++) {
      const [key, pattern] = sortedPatterns[i];
      this.patterns.delete(key);
      this.logger.debug('Pattern pruned', { patternId: pattern.id });
    }
  }

  /**
   * Query patterns for a given context
   */
  queryPatterns(context: string, actionType?: string): LearnedPattern[] {
    const relevantPatterns = Array.from(this.patterns.values()).filter(pattern => {
      // Filter by action type if specified
      if (actionType && !pattern.context.startsWith(actionType)) {
        return false;
      }

      // Check if pattern context or pattern text matches query context
      const contextMatch =
        pattern.context.toLowerCase().includes(context.toLowerCase()) ||
        context.toLowerCase().includes(pattern.context.toLowerCase()) ||
        pattern.pattern.toLowerCase().includes(context.toLowerCase()) ||
        context.toLowerCase().includes(pattern.pattern.toLowerCase());

      // Must meet minimum frequency
      const meetsFrequency = pattern.frequency >= this.config.minFrequencyForPattern;

      return contextMatch && meetsFrequency;
    });

    // Sort by confidence * frequency
    return relevantPatterns.sort((a, b) => {
      const scoreA = a.confidence * a.frequency;
      const scoreB = b.confidence * b.frequency;
      return scoreB - scoreA;
    });
  }

  /**
   * Get all patterns
   */
  getAllPatterns(): LearnedPattern[] {
    return Array.from(this.patterns.values()).sort((a, b) => {
      const scoreA = a.confidence * a.frequency;
      const scoreB = b.confidence * b.frequency;
      return scoreB - scoreA;
    });
  }

  /**
   * Get reflection history
   */
  getReflections(): Reflection[] {
    return this.reflections;
  }

  /**
   * Get statistics
   */
  getStats(): {
    reflectionCount: number;
    patternCount: number;
    avgConfidence: number;
    positivePatternCount: number;
    negativePatternCount: number;
  } {
    const avgConfidence =
      this.reflections.reduce((sum, r) => sum + r.confidence, 0) / this.reflections.length || 0;

    const positivePatternCount = Array.from(this.patterns.values()).filter(
      p => p.outcome === 'positive'
    ).length;

    const negativePatternCount = Array.from(this.patterns.values()).filter(
      p => p.outcome === 'negative'
    ).length;

    return {
      reflectionCount: this.reflections.length,
      patternCount: this.patterns.size,
      avgConfidence,
      positivePatternCount,
      negativePatternCount,
    };
  }

  /**
   * Export patterns
   */
  exportPatterns(): LearnedPattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Import patterns
   */
  importPatterns(patterns: LearnedPattern[]): void {
    for (const pattern of patterns) {
      const key = this.generatePatternKey(
        pattern.context.split(':')[0] ?? '',
        pattern.pattern
      );
      this.patterns.set(key, pattern);
    }

    this.logger.info('Patterns imported', { count: patterns.length });
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.reflections = [];
    this.patterns.clear();
    this.patternIdCounter = 0;
    this.logger.debug('Reflexion cleared');
  }
}

/**
 * Create Reflexion instance
 */
export function createReflexion(config?: Partial<ReflexionConfig>, logger?: LoggerLike): Reflexion {
  return new Reflexion(config, logger);
}
