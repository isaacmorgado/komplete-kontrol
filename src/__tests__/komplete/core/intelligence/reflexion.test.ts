/**
 * Tests for Reflexion Framework
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Reflexion, createReflexion } from '../../../../komplete/core/intelligence/reflexion';
import type { ReActObservation } from '../../../../komplete/core/intelligence/react-cycle';

describe('Reflexion', () => {
  let reflexion: Reflexion;

  beforeEach(() => {
    reflexion = createReflexion({
      minConfidenceForPattern: 0.7,
      minFrequencyForPattern: 3,
      maxPatterns: 100,
    });
  });

  const createMockObservation = (outcome: 'success' | 'failure' | 'partial'): ReActObservation => ({
    action: {
      type: 'code_write',
      description: 'Test action',
      parameters: {},
      thought: {
        reasoning: 'Test reasoning',
        alternatives: [],
        chosenApproach: 'Test approach',
        confidence: 0.8,
        timestamp: new Date(),
      },
      timestamp: new Date(),
    },
    outcome,
    timestamp: new Date(),
  });

  describe('reflect', () => {
    it('should record reflection', () => {
      const observation = createMockObservation('success');

      const reflection = reflexion.reflect(
        observation,
        'Good implementation',
        ['Always validate input', 'Use type guards'],
        ['Add more tests'],
        0.9
      );

      expect(reflection.critique).toBe('Good implementation');
      expect(reflection.lessonsLearned).toHaveLength(2);
      expect(reflection.improvements).toHaveLength(1);
      expect(reflection.confidence).toBe(0.9);

      const reflections = reflexion.getReflections();
      expect(reflections).toHaveLength(1);
    });

    it('should extract patterns from high-confidence reflections', () => {
      const observation = createMockObservation('success');

      reflexion.reflect(
        observation,
        'Validation successful',
        ['Input validation prevents errors'],
        [],
        0.9 // Above minConfidenceForPattern
      );

      const patterns = reflexion.getAllPatterns();
      expect(patterns.length).toBeGreaterThan(0);
    });

    it('should not extract patterns from low-confidence reflections', () => {
      const observation = createMockObservation('failure');

      reflexion.reflect(
        observation,
        'Uncertain about this',
        ['Maybe check input'],
        [],
        0.5 // Below minConfidenceForPattern
      );

      const patterns = reflexion.getAllPatterns();
      expect(patterns).toHaveLength(0);
    });
  });

  describe('pattern learning', () => {
    it('should create pattern on first high-confidence reflection', () => {
      const observation = createMockObservation('success');

      // Reflect 3 times to meet minimum frequency threshold
      reflexion.reflect(
        observation,
        'Good approach',
        ['Always hash passwords before storage'],
        [],
        0.9
      );
      reflexion.reflect(
        observation,
        'Good approach',
        ['Always hash passwords before storage'],
        [],
        0.9
      );
      reflexion.reflect(
        observation,
        'Good approach',
        ['Always hash passwords before storage'],
        [],
        0.9
      );

      const patterns = reflexion.queryPatterns('password');
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].pattern).toContain('hash passwords');
      expect(patterns[0].frequency).toBe(3);
    });

    it('should update pattern frequency on repeated observations', () => {
      const observation1 = createMockObservation('success');
      const observation2 = createMockObservation('success');
      const observation3 = createMockObservation('success');

      const lesson = 'Always validate input';

      reflexion.reflect(observation1, 'Good', [lesson], [], 0.9);
      reflexion.reflect(observation2, 'Good', [lesson], [], 0.9);
      reflexion.reflect(observation3, 'Good', [lesson], [], 0.9);

      const patterns = reflexion.queryPatterns('validate');
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].frequency).toBe(3);
    });

    it('should adjust pattern confidence based on outcomes', () => {
      const successObs = createMockObservation('success');

      const lesson = 'Test pattern';

      // Reflect 3 times to meet minimum frequency with lower confidence
      reflexion.reflect(successObs, 'Good', [lesson], [], 0.7);
      reflexion.reflect(successObs, 'Good', [lesson], [], 0.7);
      reflexion.reflect(successObs, 'Good', [lesson], [], 0.7);

      const patterns1 = reflexion.queryPatterns('Test pattern');
      const initialConfidence = patterns1[0]?.confidence ?? 0;
      expect(initialConfidence).toBeGreaterThan(0); // Should now have a pattern
      // After 3 reflections: 0.7 -> 0.8 -> 0.9, so initialConfidence = 0.9

      // Additional success should increase confidence to 1.0
      reflexion.reflect(successObs, 'Good', [lesson], [], 0.7);
      const patterns2 = reflexion.queryPatterns('Test pattern');
      const afterSuccessConfidence = patterns2[0]?.confidence ?? 0;
      // After 4th reflection: 0.9 -> 1.0

      expect(afterSuccessConfidence).toBeGreaterThan(initialConfidence);
    });

    it('should filter patterns by minimum frequency', () => {
      const observation = createMockObservation('success');

      // Create pattern with frequency 1
      reflexion.reflect(observation, 'Test', ['Low frequency pattern'], [], 0.9);

      // Query should not return patterns with frequency < 3
      const patterns = reflexion.queryPatterns('Low frequency');
      expect(patterns).toHaveLength(0);

      // Add more observations to increase frequency
      reflexion.reflect(observation, 'Test', ['Low frequency pattern'], [], 0.9);
      reflexion.reflect(observation, 'Test', ['Low frequency pattern'], [], 0.9);

      // Now should return the pattern
      const patternsAfter = reflexion.queryPatterns('Low frequency');
      expect(patternsAfter.length).toBeGreaterThan(0);
    });
  });

  describe('pattern querying', () => {
    beforeEach(() => {
      // Create diverse patterns
      const codeObs = { ...createMockObservation('success'), action: { ...createMockObservation('success').action, type: 'code_write' } };
      const testObs = { ...createMockObservation('success'), action: { ...createMockObservation('success').action, type: 'test_run' } };

      // Add patterns with sufficient frequency
      for (let i = 0; i < 3; i++) {
        reflexion.reflect(codeObs, 'Code review', ['Validate input before processing'], [], 0.9);
        reflexion.reflect(testObs, 'Test review', ['Test edge cases'], [], 0.9);
        reflexion.reflect(codeObs, 'Security', ['Hash passwords'], [], 0.9);
      }
    });

    it('should query patterns by context', () => {
      const patterns = reflexion.queryPatterns('input');
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].pattern).toContain('input');
    });

    it('should query patterns by action type', () => {
      const patterns = reflexion.queryPatterns('Test', 'test_run');
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].context).toContain('test_run');
    });

    it('should sort patterns by confidence * frequency', () => {
      const patterns = reflexion.getAllPatterns();
      expect(patterns.length).toBeGreaterThan(0);

      // Verify sorting
      for (let i = 1; i < patterns.length; i++) {
        const scoreA = patterns[i - 1].confidence * patterns[i - 1].frequency;
        const scoreB = patterns[i].confidence * patterns[i].frequency;
        expect(scoreA).toBeGreaterThanOrEqual(scoreB);
      }
    });
  });

  describe('revision plan generation', () => {
    it('should generate revision plan from reflection', () => {
      const observation = createMockObservation('failure');

      const reflection = reflexion.reflect(
        observation,
        'Forgot to validate input',
        ['Always validate before processing'],
        ['Add input validation', 'Add type guards'],
        0.9
      );

      const revision = reflexion.generateRevision(
        reflection,
        'Validate input with type guards',
        'Prevent runtime errors',
        0.85
      );

      expect(revision.reason).toBe('Forgot to validate input');
      expect(revision.originalApproach).toBe('Test approach');
      expect(revision.revisedApproach).toBe('Validate input with type guards');
      expect(revision.expectedImprovement).toBe('Prevent runtime errors');
      expect(revision.confidence).toBe(0.85);
    });
  });

  describe('pattern management', () => {
    it('should prune patterns when max is exceeded', () => {
      // Create many low-confidence patterns
      for (let i = 0; i < 150; i++) {
        const observation = createMockObservation('success');
        reflexion.reflect(
          observation,
          `Pattern ${i}`,
          [`Low confidence pattern ${i}`],
          [],
          0.7
        );
      }

      const patterns = reflexion.getAllPatterns();
      expect(patterns.length).toBeLessThanOrEqual(100); // Max patterns
    });

    it('should export patterns', () => {
      const observation = createMockObservation('success');
      reflexion.reflect(observation, 'Test', ['Pattern 1'], [], 0.9);

      const exported = reflexion.exportPatterns();
      expect(Array.isArray(exported)).toBe(true);
      expect(exported.length).toBeGreaterThan(0);
    });

    it('should import patterns', () => {
      const observation = createMockObservation('success');
      reflexion.reflect(observation, 'Test', ['Original pattern'], [], 0.9);

      const exported = reflexion.exportPatterns();

      const newReflexion = createReflexion();
      newReflexion.importPatterns(exported);

      const patterns = newReflexion.getAllPatterns();
      expect(patterns.length).toBe(exported.length);
    });
  });

  describe('statistics', () => {
    it('should return accurate statistics', () => {
      const successObs = createMockObservation('success');
      const failureObs = createMockObservation('failure');

      reflexion.reflect(successObs, 'Good', ['Positive pattern'], [], 0.9);
      reflexion.reflect(successObs, 'Good', ['Positive pattern'], [], 0.9);
      reflexion.reflect(successObs, 'Good', ['Positive pattern'], [], 0.9);

      reflexion.reflect(failureObs, 'Bad', ['Negative pattern'], [], 0.8);
      reflexion.reflect(failureObs, 'Bad', ['Negative pattern'], [], 0.8);
      reflexion.reflect(failureObs, 'Bad', ['Negative pattern'], [], 0.8);

      const stats = reflexion.getStats();
      expect(stats.reflectionCount).toBe(6);
      expect(stats.patternCount).toBe(2);
      expect(stats.positivePatternCount).toBeGreaterThan(0);
      expect(stats.negativePatternCount).toBeGreaterThan(0);
      expect(stats.avgConfidence).toBeCloseTo((0.9 + 0.9 + 0.9 + 0.8 + 0.8 + 0.8) / 6, 2);
    });
  });

  describe('clear', () => {
    it('should clear all reflections and patterns', () => {
      const observation = createMockObservation('success');
      reflexion.reflect(observation, 'Test', ['Pattern'], [], 0.9);

      reflexion.clear();

      const reflections = reflexion.getReflections();
      const patterns = reflexion.getAllPatterns();

      expect(reflections).toHaveLength(0);
      expect(patterns).toHaveLength(0);
    });
  });

  describe('learning workflow', () => {
    it('should learn from repeated experiences', () => {
      const lesson = 'Always hash passwords before storage';

      // First attempt - no prior knowledge
      let patterns = reflexion.queryPatterns('password');
      expect(patterns).toHaveLength(0);

      // Experience 1: Forgot to hash
      const failure1 = createMockObservation('failure');
      reflexion.reflect(failure1, 'Security vulnerability', [lesson], [], 0.95);

      // Experience 2: Remembered to hash
      const success1 = createMockObservation('success');
      reflexion.reflect(success1, 'Secure implementation', [lesson], [], 0.95);

      // Experience 3: Applied learned pattern
      const success2 = createMockObservation('success');
      reflexion.reflect(success2, 'Used best practice', [lesson], [], 0.95);

      // Should now have high-confidence pattern
      patterns = reflexion.queryPatterns('password');
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].frequency).toBe(3);
      expect(patterns[0].confidence).toBeGreaterThan(0.9);
    });
  });
});
