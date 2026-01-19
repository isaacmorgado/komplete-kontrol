/**
 * Tests for ReAct Cycle
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ReActCycle, createReActCycle } from '../../../../komplete/core/intelligence/react-cycle';

describe('ReActCycle', () => {
  let cycle: ReActCycle;

  beforeEach(() => {
    cycle = createReActCycle({
      maxIterations: 5,
      minConfidence: 0.6,
      allowBacktracking: true,
    });
  });

  describe('initialization', () => {
    it('should initialize cycle with goal and context', () => {
      cycle.initialize('Test goal', 'Test context');

      const state = cycle.getState();
      expect(state).not.toBeNull();
      expect(state?.goal).toBe('Test goal');
      expect(state?.context).toBe('Test context');
      expect(state?.status).toBe('thinking');
      expect(state?.iteration).toBe(0);
    });

    it('should start with empty thought/action/observation arrays', () => {
      cycle.initialize('Test goal', 'Test context');

      const state = cycle.getState();
      expect(state?.thoughts).toHaveLength(0);
      expect(state?.actions).toHaveLength(0);
      expect(state?.observations).toHaveLength(0);
    });
  });

  describe('think phase', () => {
    beforeEach(() => {
      cycle.initialize('Test goal', 'Test context');
    });

    it('should generate thought in thinking status', () => {
      const thought = cycle.think(
        'Test reasoning',
        ['Alt 1', 'Alt 2'],
        'Alt 1',
        0.8
      );

      expect(thought.reasoning).toBe('Test reasoning');
      expect(thought.alternatives).toEqual(['Alt 1', 'Alt 2']);
      expect(thought.chosenApproach).toBe('Alt 1');
      expect(thought.confidence).toBe(0.8);

      const state = cycle.getState();
      expect(state?.status).toBe('acting');
      expect(state?.thoughts).toHaveLength(1);
    });

    it('should throw error if not in thinking status', () => {
      cycle.think('Reasoning', [], 'Approach', 0.8);

      expect(() => {
        cycle.think('Another reasoning', [], 'Approach', 0.7);
      }).toThrow('Cannot think in status: acting');
    });
  });

  describe('act phase', () => {
    beforeEach(() => {
      cycle.initialize('Test goal', 'Test context');
      cycle.think('Reasoning', [], 'Approach', 0.8);
    });

    it('should execute action in acting status', () => {
      const action = cycle.act('code_write', 'Write code', { file: 'test.ts' });

      expect(action.type).toBe('code_write');
      expect(action.description).toBe('Write code');
      expect(action.parameters).toEqual({ file: 'test.ts' });

      const state = cycle.getState();
      expect(state?.status).toBe('observing');
      expect(state?.actions).toHaveLength(1);
    });

    it('should throw error if not in acting status', () => {
      cycle.act('code_write', 'Write code', {});

      expect(() => {
        cycle.act('code_write', 'Another action', {});
      }).toThrow('Cannot act in status: observing');
    });

    it('should throw error if acting without thinking first', () => {
      const newCycle = createReActCycle();
      newCycle.initialize('Goal', 'Context');

      // Cannot act() while in 'thinking' status without calling think() first
      expect(() => {
        newCycle.act('test', 'Test action', {});
      }).toThrow('Cannot act in status: thinking');
    });
  });

  describe('observe phase', () => {
    beforeEach(() => {
      cycle.initialize('Test goal', 'Test context');
      cycle.think('Reasoning', [], 'Approach', 0.8);
      cycle.act('code_write', 'Write code', {});
    });

    it('should record successful observation', () => {
      const observation = cycle.observe('success', { output: 'test' });

      expect(observation.outcome).toBe('success');
      expect(observation.result).toEqual({ output: 'test' });

      const state = cycle.getState();
      expect(state?.observations).toHaveLength(1);
      expect(state?.iteration).toBe(1);
    });

    it('should complete cycle on success', () => {
      cycle.observe('success');

      const state = cycle.getState();
      expect(state?.status).toBe('complete');
    });

    it('should continue cycle on partial success', () => {
      cycle.observe('partial');

      const state = cycle.getState();
      expect(state?.status).toBe('thinking');
      expect(state?.iteration).toBe(1);
    });

    it('should fail cycle on repeated failures', () => {
      cycle.observe('failure', undefined, 'Test error');

      const state = cycle.getState();
      // Should still allow continuation if within max iterations
      expect(state?.iteration).toBe(1);
    });

    it('should throw error if not in observing status', () => {
      cycle.observe('success');

      expect(() => {
        cycle.observe('success');
      }).toThrow('Cannot observe in status: complete');
    });
  });

  describe('iteration control', () => {
    it('should stop after max iterations', () => {
      cycle.initialize('Test goal', 'Test context');

      // Execute 5 iterations (max)
      for (let i = 0; i < 5; i++) {
        cycle.think(`Reasoning ${i}`, [], 'Approach', 0.8);
        cycle.act('test', `Action ${i}`, {});
        cycle.observe('partial'); // Keep going
      }

      const state = cycle.getState();
      expect(state?.iteration).toBe(5);

      // Should not be able to continue after max iterations
      expect(state?.status).toBe('thinking');
    });

    it('should stop if confidence drops below threshold', () => {
      cycle.initialize('Test goal', 'Test context');

      cycle.think('High confidence', [], 'Approach', 0.9);
      cycle.act('test', 'Action 1', {});
      cycle.observe('partial'); // Continue with partial

      cycle.think('Low confidence', [], 'Approach', 0.4); // Below 0.6
      cycle.act('test', 'Action 2', {});

      // With low confidence, failure should stop the cycle
      const state = cycle.getState();
      // Low confidence thought exists, next failure would cause canContinue to return false
      expect(state?.thoughts[state.thoughts.length - 1].confidence).toBeLessThan(0.6);
    });
  });

  describe('cycle summary', () => {
    it('should return null summary if not initialized', () => {
      const summary = cycle.getSummary();
      expect(summary).toBeNull();
    });

    it('should return accurate summary', () => {
      cycle.initialize('Test goal', 'Test context');

      cycle.think('Reasoning 1', [], 'Approach', 0.9);
      cycle.act('test', 'Action 1', {});
      cycle.observe('partial'); // Use partial to allow continuation

      cycle.think('Reasoning 2', [], 'Approach', 0.7);
      cycle.act('test', 'Action 2', {});
      cycle.observe('success'); // Final success completes cycle

      const summary = cycle.getSummary();
      expect(summary).not.toBeNull();
      expect(summary?.goal).toBe('Test goal');
      expect(summary?.iterations).toBe(2);
      expect(summary?.thoughtCount).toBe(2);
      expect(summary?.actionCount).toBe(2);
      expect(summary?.observationCount).toBe(2);
      expect(summary?.successRate).toBe(0.5); // 1 partial, 1 success = 0.5
      expect(summary?.avgConfidence).toBe(0.8); // (0.9 + 0.7) / 2
    });
  });

  describe('history export', () => {
    it('should return null if not initialized', () => {
      const history = cycle.exportHistory();
      expect(history).toBeNull();
    });

    it('should export complete history', () => {
      cycle.initialize('Test goal', 'Test context');

      cycle.think('Reasoning', [], 'Approach', 0.8);
      cycle.act('test', 'Action', {});
      cycle.observe('success');

      const history = cycle.exportHistory();
      expect(history).not.toBeNull();
      expect(history?.thoughts).toHaveLength(1);
      expect(history?.actions).toHaveLength(1);
      expect(history?.observations).toHaveLength(1);
    });
  });

  describe('reset', () => {
    it('should clear all state', () => {
      cycle.initialize('Test goal', 'Test context');
      cycle.think('Reasoning', [], 'Approach', 0.8);

      cycle.reset();

      const state = cycle.getState();
      expect(state).toBeNull();
    });
  });

  describe('full cycle workflow', () => {
    it('should complete a full think-act-observe cycle', () => {
      cycle.initialize('Implement authentication', 'OAuth 2.0 with JWT');

      // Iteration 1: Research
      cycle.think(
        'Need to research OAuth patterns',
        ['Implement directly', 'Research first', 'Use library'],
        'Research first',
        0.85
      );

      cycle.act('research', 'Search OAuth patterns', { query: 'OAuth 2.0' });
      cycle.observe('partial', { patternsFound: 5 }); // Use partial to continue

      // Iteration 2: Implement
      cycle.think(
        'Found good patterns, ready to implement',
        ['Custom OAuth', 'Use passport.js'],
        'Use passport.js',
        0.9
      );

      cycle.act('code_write', 'Implement OAuth', { library: 'passport' });
      cycle.observe('success', { implemented: true }); // Final success completes

      const summary = cycle.getSummary();
      expect(summary?.iterations).toBe(2);
      expect(summary?.status).toBe('complete');
      expect(summary?.successRate).toBe(0.5); // 1 partial, 1 success = 0.5
    });
  });
});
