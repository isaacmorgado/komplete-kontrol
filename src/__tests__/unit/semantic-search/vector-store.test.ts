/**
 * Unit Tests: Vector Store
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SQLiteVectorStore } from "../../../../main/semantic-search/vector-store/sqlite-vector";
import { EmbeddedCodeBlock } from "../../../../main/semantic-search/types";
import { OpenAIEmbedder } from "../../../../main/semantic-search/embedders/openai";
import fs from "fs/promises";

describe("SQLiteVectorStore", () => {
  let store: SQLiteVectorStore;
  let embedder: OpenAIEmbedder;
  let dbPath: string;
  let workspacePath: string;

  beforeEach(async () => {
    dbPath = `/tmp/test-embeddings-${Date.now()}.db`;
    workspacePath = `/tmp/test-workspace-${Date.now()}`;

    embedder = new OpenAIEmbedder({
      provider: "openai",
      model: "text-embedding-3-small",
      dimensions: 1536,
      apiKey: "test-key",
    });

    store = new SQLiteVectorStore(
      dbPath,
      embedder,
      { type: "sqlite", path: dbPath }
    );
  });

  afterEach(async () => {
    store.close();
    try {
      await fs.unlink(dbPath);
    } catch {
      // Ignore cleanup errors
    }
  });

  it("should store embedded blocks", async () => {
    const blocks: EmbeddedCodeBlock[] = [
      {
        filePath: "/test/file.ts",
        startLine: 0,
        endLine: 10,
        content: "test content",
        language: "typescript",
        hash: "abc123",
        embedding: new Float32Array(1536).fill(0.1),
      },
    ];

    await store.store(blocks, workspacePath);

    // Verify storage by searching
    const results = await store.search(
      new Float32Array(1536).fill(0.1),
      workspacePath,
      { maxResults: 1 }
    );

    expect(results.length).toBe(1);
    expect(results[0].filePath).toBe("/test/file.ts");
  });

  it("should search for similar code", async () => {
    const queryEmbedding = new Float32Array(1536).fill(0.5);

    const blocks: EmbeddedCodeBlock[] = [
      {
        filePath: "/test/similar.ts",
        startLine: 0,
        endLine: 10,
        content: "similar content",
        language: "typescript",
        hash: "xyz789",
        embedding: new Float32Array(1536).fill(0.5),
      },
      {
        filePath: "/test/different.ts",
        startLine: 0,
        endLine: 10,
        content: "different content",
        language: "typescript",
        hash: "def456",
        embedding: new Float32Array(1536).fill(0.1),
      },
    ];

    await store.store(blocks, workspacePath);

    const results = await store.search(queryEmbedding, workspacePath, {
      maxResults: 2,
      minScore: 0.0,
    });

    expect(results.length).toBe(2);
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  it("should respect minScore threshold", async () => {
    const queryEmbedding = new Float32Array(1536).fill(0.5);

    const blocks: EmbeddedCodeBlock[] = [
      {
        filePath: "/test/low-score.ts",
        startLine: 0,
        endLine: 10,
        content: "low score",
        language: "typescript",
        hash: "low123",
        embedding: new Float32Array(1536).fill(0.1),
      },
    ];

    await store.store(blocks, workspacePath);

    const results = await store.search(queryEmbedding, workspacePath, {
      maxResults: 10,
      minScore: 0.9,
    });

    // Should return no results due to high minScore
    expect(results.length).toBe(0);
  });

  it("should respect maxResults limit", async () => {
    const queryEmbedding = new Float32Array(1536).fill(0.5);

    const blocks: EmbeddedCodeBlock[] = Array.from({ length: 20 }, (_, i) => ({
      filePath: `/test/file${i}.ts`,
      startLine: 0,
      endLine: 10,
      content: `content ${i}`,
      language: "typescript",
      hash: `hash${i}`,
      embedding: new Float32Array(1536).fill(0.5),
    }));

    await store.store(blocks, workspacePath);

    const results = await store.search(queryEmbedding, workspacePath, {
      maxResults: 5,
      minScore: 0.0,
    });

    expect(results.length).toBe(5);
  });

  it("should delete file embeddings", async () => {
    const blocks: EmbeddedCodeBlock[] = [
      {
        filePath: "/test/to-delete.ts",
        startLine: 0,
        endLine: 10,
        content: "delete me",
        language: "typescript",
        hash: "del123",
        embedding: new Float32Array(1536).fill(0.1),
      },
      {
        filePath: "/test/keep.ts",
        startLine: 0,
        endLine: 10,
        content: "keep me",
        language: "typescript",
        hash: "keep123",
        embedding: new Float32Array(1536).fill(0.1),
      },
    ];

    await store.store(blocks, workspacePath);
    await store.deleteFile("/test/to-delete.ts");

    const results = await store.search(
      new Float32Array(1536).fill(0.1),
      workspacePath,
      { maxResults: 10 }
    );

    expect(results.length).toBe(1);
    expect(results[0].filePath).toBe("/test/keep.ts");
  });

  it("should clear workspace embeddings", async () => {
    const blocks: EmbeddedCodeBlock[] = [
      {
        filePath: "/test/file1.ts",
        startLine: 0,
        endLine: 10,
        content: "content",
        language: "typescript",
        hash: "abc123",
        embedding: new Float32Array(1536).fill(0.1),
      },
    ];

    await store.store(blocks, workspacePath);
    await store.clearWorkspace(workspacePath);

    const results = await store.search(
      new Float32Array(1536).fill(0.1),
      workspacePath,
      { maxResults: 10 }
    );

    expect(results.length).toBe(0);
  });
});
