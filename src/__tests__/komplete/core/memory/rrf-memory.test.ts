/**
 * Tests for RRF Memory System
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  RRFMemory,
  initRRFMemory,
  type MemoryEntry,
} from '../../../../komplete/core/memory/rrf-memory';

describe('RRFMemory', () => {
  let memory: RRFMemory;

  beforeEach(() => {
    memory = initRRFMemory({
      k: 60,
      weights: {
        bm25: 1.0,
        vector: 1.0,
        recency: 1.0,
        importance: 1.0,
      },
      recencyDecayFactor: 0.1,
    });
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      const mem = initRRFMemory();
      expect(mem).toBeDefined();
    });

    it('should initialize with custom configuration', () => {
      const mem = initRRFMemory({
        k: 100,
        weights: {
          bm25: 2.0,
          vector: 0.5,
          recency: 1.5,
          importance: 0.8,
        },
        recencyDecayFactor: 0.2,
      });
      expect(mem).toBeDefined();
    });
  });

  describe('entry management', () => {
    it('should add entry and return entry ID', async () => {
      const entry: Omit<MemoryEntry, 'id'> = {
        content: 'Test content',
        timestamp: new Date(),
        importance: 0.8,
        tags: ['test'],
      };

      const entryId = await memory.addEntry(entry);

      expect(entryId).toBeDefined();
      expect(typeof entryId).toBe('string');
    });

    it('should retrieve entry by ID', async () => {
      const entry: Omit<MemoryEntry, 'id'> = {
        content: 'Test content',
        timestamp: new Date(),
        importance: 0.8,
      };

      const entryId = await memory.addEntry(entry);
      const retrieved = memory.getEntry(entryId);

      expect(retrieved).toBeDefined();
      expect(retrieved?.content).toBe('Test content');
      expect(retrieved?.importance).toBe(0.8);
    });

    it('should update existing entry', async () => {
      const entry: Omit<MemoryEntry, 'id'> = {
        content: 'Original content',
        timestamp: new Date(),
        importance: 0.5,
      };

      const entryId = await memory.addEntry(entry);
      await memory.updateEntry(entryId, {
        content: 'Updated content',
        importance: 0.9,
      });

      const updated = memory.getEntry(entryId);
      expect(updated?.content).toBe('Updated content');
      expect(updated?.importance).toBe(0.9);
    });

    it('should remove entry by ID', async () => {
      const entry: Omit<MemoryEntry, 'id'> = {
        content: 'To be removed',
        timestamp: new Date(),
        importance: 0.5,
      };

      const entryId = await memory.addEntry(entry);
      const removed = memory.removeEntry(entryId);

      expect(removed).toBe(true);
      const retrieved = memory.getEntry(entryId);
      expect(retrieved).toBeUndefined();
    });

    it('should get all entries via export', async () => {
      await memory.addEntry({ content: 'Entry 1', timestamp: new Date(), importance: 0.5 });
      await memory.addEntry({ content: 'Entry 2', timestamp: new Date(), importance: 0.7 });
      await memory.addEntry({ content: 'Entry 3', timestamp: new Date(), importance: 0.9 });

      const allEntries = memory.exportEntries();
      expect(allEntries).toHaveLength(3);
    });

    it('should clear all entries', async () => {
      await memory.addEntry({ content: 'Entry 1', timestamp: new Date(), importance: 0.5 });
      await memory.addEntry({ content: 'Entry 2', timestamp: new Date(), importance: 0.7 });

      memory.clear();

      const stats = memory.getStats();
      expect(stats.entryCount).toBe(0);
    });
  });

  describe('search - BM25 lexical matching', () => {
    beforeEach(async () => {
      await memory.addEntry({
        content: 'JavaScript is a programming language for web development',
        timestamp: new Date(),
        importance: 0.8,
      });
      await memory.addEntry({
        content: 'Python is a versatile programming language',
        timestamp: new Date(),
        importance: 0.7,
      });
      await memory.addEntry({
        content: 'Web development with React and TypeScript',
        timestamp: new Date(),
        importance: 0.9,
      });
    });

    it('should find entries with exact keyword match', async () => {
      const results = await memory.search('JavaScript', 10);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].entry.content).toContain('JavaScript');
    });

    it('should rank by term frequency', async () => {
      memory.clear();
      await memory.addEntry({
        content: 'programming programming programming language',
        timestamp: new Date(),
        importance: 0.5,
      });
      await memory.addEntry({
        content: 'programming language',
        timestamp: new Date(),
        importance: 0.5,
      });

      const results = await memory.search('programming', 10);

      expect(results.length).toBe(2);
      // Entry with more occurrences should rank higher (assuming equal other factors)
      expect(results[0].entry.content).toContain('programming programming programming');
    });

    it('should handle multi-word queries', async () => {
      const results = await memory.search('web development', 10);

      expect(results.length).toBeGreaterThan(0);
      const topResult = results[0];
      expect(
        topResult.entry.content.includes('web') || topResult.entry.content.includes('development')
      ).toBe(true);
    });
  });

  describe('search - recency scoring', () => {
    it('should rank recent entries higher', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      await memory.addEntry({
        content: 'JavaScript tutorial',
        timestamp: oneDayAgo,
        importance: 0.5,
      });
      await memory.addEntry({
        content: 'JavaScript tutorial',
        timestamp: oneHourAgo,
        importance: 0.5,
      });
      await memory.addEntry({
        content: 'JavaScript tutorial',
        timestamp: now,
        importance: 0.5,
      });

      const results = await memory.search('JavaScript', 10);

      expect(results.length).toBe(3);
      // Most recent should rank highest (all else equal)
      const timestamps = results.map(r => r.entry.timestamp.getTime());
      expect(timestamps[0]).toBeGreaterThanOrEqual(timestamps[1]);
      expect(timestamps[1]).toBeGreaterThanOrEqual(timestamps[2]);
    });
  });

  describe('search - importance weighting', () => {
    it('should rank high-importance entries higher', async () => {
      const now = new Date();

      await memory.addEntry({
        content: 'JavaScript is great',
        timestamp: now,
        importance: 0.3,
      });
      await memory.addEntry({
        content: 'JavaScript is great',
        timestamp: now,
        importance: 0.9,
      });
      await memory.addEntry({
        content: 'JavaScript is great',
        timestamp: now,
        importance: 0.6,
      });

      const results = await memory.search('JavaScript', 10);

      expect(results.length).toBe(3);
      // Higher importance should influence ranking
      expect(results[0].entry.importance).toBeGreaterThan(results[2].entry.importance);
    });
  });

  describe('search - RRF ranking', () => {
    it('should return results with all score components', async () => {
      await memory.addEntry({
        content: 'Testing RRF ranking system',
        timestamp: new Date(),
        importance: 0.8,
      });

      const results = await memory.search('RRF', 10);

      expect(results.length).toBeGreaterThan(0);
      const result = results[0];

      expect(result.scores).toBeDefined();
      expect(result.scores.bm25).toBeGreaterThanOrEqual(0);
      expect(result.scores.recency).toBeGreaterThanOrEqual(0);
      expect(result.scores.importance).toBeGreaterThanOrEqual(0);
      expect(result.scores.combined).toBeGreaterThan(0);
    });

    it('should assign ranks to results', async () => {
      await memory.addEntry({ content: 'Test 1', timestamp: new Date(), importance: 0.5 });
      await memory.addEntry({ content: 'Test 2', timestamp: new Date(), importance: 0.7 });
      await memory.addEntry({ content: 'Test 3', timestamp: new Date(), importance: 0.9 });

      const results = await memory.search('Test', 10);

      expect(results.length).toBe(3);
      expect(results[0].rank).toBe(1);
      expect(results[1].rank).toBe(2);
      expect(results[2].rank).toBe(3);
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 10; i++) {
        await memory.addEntry({
          content: `Entry ${i} about search`,
          timestamp: new Date(),
          importance: 0.5,
        });
      }

      const results = await memory.search('search', 5);

      expect(results).toHaveLength(5);
    });

    it('should return empty array for no matches', async () => {
      await memory.addEntry({
        content: 'JavaScript programming',
        timestamp: new Date(),
        importance: 0.5,
      });

      const results = await memory.search('nonexistent', 10);

      expect(results).toHaveLength(0);
    });
  });

  describe('statistics', () => {
    it('should return accurate entry count', async () => {
      await memory.addEntry({ content: 'Entry 1', timestamp: new Date(), importance: 0.5 });
      await memory.addEntry({ content: 'Entry 2', timestamp: new Date(), importance: 0.7 });
      await memory.addEntry({ content: 'Entry 3', timestamp: new Date(), importance: 0.9 });

      const stats = memory.getStats();

      expect(stats.entryCount).toBe(3);
    });

    it('should return avg document length', async () => {
      await memory.addEntry({ content: 'Short', timestamp: new Date(), importance: 0.5 });
      await memory.addEntry({ content: 'Medium length text', timestamp: new Date(), importance: 0.7 });

      const stats = memory.getStats();

      expect(stats.avgDocLength).toBeGreaterThan(0);
    });

    it('should return vocabulary size', async () => {
      await memory.addEntry({ content: 'JavaScript programming', timestamp: new Date(), importance: 0.5 });
      await memory.addEntry({ content: 'Python coding', timestamp: new Date(), importance: 0.7 });

      const stats = memory.getStats();

      expect(stats.vocabularySize).toBeGreaterThan(0);
    });
  });

  describe('export/import', () => {
    it('should export all entries', async () => {
      await memory.addEntry({ content: 'Entry 1', timestamp: new Date(), importance: 0.5 });
      await memory.addEntry({ content: 'Entry 2', timestamp: new Date(), importance: 0.7 });

      const exported = memory.exportEntries();

      expect(exported).toHaveLength(2);
      expect(exported[0].content).toBe('Entry 1');
      expect(exported[1].content).toBe('Entry 2');
    });

    it('should import entries', async () => {
      const entries: MemoryEntry[] = [
        {
          id: 'test-1',
          content: 'Imported entry 1',
          timestamp: new Date(),
          importance: 0.6,
        },
        {
          id: 'test-2',
          content: 'Imported entry 2',
          timestamp: new Date(),
          importance: 0.8,
        },
      ];

      await memory.importEntries(entries);

      const allEntries = memory.exportEntries();
      expect(allEntries).toHaveLength(2);
      expect(allEntries.some(e => e.content === 'Imported entry 1')).toBe(true);
      expect(allEntries.some(e => e.content === 'Imported entry 2')).toBe(true);
    });

    it('should preserve data through export/import cycle', async () => {
      await memory.addEntry({ content: 'Original', timestamp: new Date(), importance: 0.9 });

      const exported = memory.exportEntries();
      memory.clear();
      await memory.importEntries(exported);

      const allEntries = memory.exportEntries();
      expect(allEntries).toHaveLength(1);
      expect(allEntries[0].content).toBe('Original');
      expect(allEntries[0].importance).toBe(0.9);
    });
  });
});
