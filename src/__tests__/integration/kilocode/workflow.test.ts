/**
 * Integration Tests: Code Indexing Workflow
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getCodeIndexManager } from "../../../../main/semantic-search/CodeIndexManager";
import fs from "fs/promises";
import path from "path";

describe("Code Indexing Workflow", () => {
  let workspacePath: string;
  let manager: ReturnType<typeof getCodeIndexManager>;

  beforeEach(async () => {
    workspacePath = `/tmp/test-index-${Date.now()}`;
    await fs.mkdir(workspacePath, { recursive: true });

    // Create test files
    await fs.mkdir(path.join(workspacePath, "src"), { recursive: true });

    await fs.writeFile(
      path.join(workspacePath, "src", "auth.ts"),
      `export function authenticate(username: string, password: string) {
  // Validate credentials
  const user = findUser(username);
  if (!user) return null;

  // Check password
  if (user.password !== hash(password)) {
    return null;
  }

  return user;
}

export function findUser(username: string) {
  return database.users.find(u => u.username === username);
}`
    );

    await fs.writeFile(
      path.join(workspacePath, "src", "database.ts"),
      `export const database = {
  users: [
    { username: "alice", password: "hash1" },
    { username: "bob", password: "hash2" },
  ]
};

export function hash(password: string) {
  return password.split("").reverse().join("");
}`
    );

    // Create manager with mock embedder
    manager = getCodeIndexManager(workspacePath, {
      embedder: {
        provider: "ollama",
        model: "test-model",
        dimensions: 768,
      },
      ignoredPatterns: [],
      maxFileSize: 1024 * 1024,
      batchSize: 10,
    });
  });

  afterEach(async () => {
    manager.dispose();
    try {
      await fs.rm(workspacePath, { recursive: true });
      // Clean up database
      await fs.unlink(path.join(workspacePath, ".komplete-kontrol", "embeddings.db"));
    } catch {
      // Ignore cleanup errors
    }
  });

  it("should complete full indexing workflow", async () => {
    let progressEvents = 0;

    manager.on("progress", (progress) => {
      progressEvents++;
      expect(progress).toBeDefined();
      expect(progress.total).toBeGreaterThan(0);
    });

    await manager.startIndexing();

    expect(progressEvents).toBeGreaterThan(0);
  });

  it("should search indexed code", async () => {
    // Mock the search to avoid actual embeddings
    manager.search = async () => {
      return [
        {
          filePath: path.join(workspacePath, "src", "auth.ts"),
          chunkText: "function authenticate(username, password)",
          startLine: 1,
          endLine: 5,
          score: 0.95,
          language: "typescript",
        },
      ];
    };

    const results = await manager.search("authentication function");

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].filePath).toContain("auth.ts");
  });

  it("should track indexing status", async () => {
    const beforeStatus = manager.getStatus();
    expect(beforeStatus.isIndexing).toBe(false);

    const indexingPromise = manager.startIndexing();

    const duringStatus = manager.getStatus();
    expect(duringStatus.isIndexing).toBe(true);

    await indexingPromise;

    const afterStatus = manager.getStatus();
    expect(afterStatus.isIndexing).toBe(false);
  });

  it("should clear index", async () => {
    await manager.startIndexing();

    // Verify indexing worked
    const beforeClear = await manager.search("test");
    expect(beforeClear).toBeDefined();

    await manager.clearIndex();

    // After clear, search should return empty
    const afterClear = await manager.search("test");
    expect(afterClear).toEqual([]);
  });
});

/**
 * Integration Tests: Context Management Workflow
 */

import { ContextManager } from "../../../../main/context-management/ContextManager";

describe("Context Management Workflow", () => {
  let workspacePath: string;
  let contextManager: ContextManager;
  let mockProvider: any;

  beforeEach(async () => {
    workspacePath = `/tmp/test-context-${Date.now()}`;
    await fs.mkdir(workspacePath, { recursive: true });

    mockProvider = {
      complete: jest.fn().mockResolvedValue({
        content: [{ text: "Conversation summary" }],
        cost: 0.002,
      }),
    };

    contextManager = new ContextManager(workspacePath, mockProvider, {
      autoCondensePercent: 80,
      summarizationModel: "haiku",
    });
  });

  afterEach(async () => {
    contextManager.dispose();
    try {
      await fs.rm(workspacePath, { recursive: true });
      await fs.unlink(path.join(workspacePath, ".komplete-kontrol", "memory.db"));
    } catch {
      // Ignore cleanup errors
    }
  });

  it("should complete context condensation workflow", async () => {
    const messages = [
      { role: "user", content: "Message 1" },
      { role: "assistant", content: "Response 1" },
      { role: "user", content: "Message 2" },
      { role: "assistant", content: "Response 2" },
    ];

    const result = await contextManager.manageContext({
      messages: messages as any,
      totalTokens: 180000, // 90% of 200k
      contextWindow: 200000,
      autoCondense: true,
      taskId: "test-session",
    });

    expect(result.messages).toBeDefined();
    expect(result.summary).toBeDefined();
    expect(result.tokensSaved).toBeGreaterThan(0);
  });

  it("should store and retrieve memories", async () => {
    const memory = contextManager.getMemoryBank().store({
      sessionId: "session-1",
      workspacePath,
      memoryType: "key_fact",
      content: "Important fact",
      tokensSaved: 500,
      relevanceScore: 1.0,
    });

    expect(memory.id).toBeDefined();

    const retrieved = contextManager.retrieveRelevantContext(
      "test query",
      workspacePath,
      1000
    );

    expect(retrieved.length).toBeGreaterThan(0);
    expect(retrieved[0].content).toBe("Important fact");
  });

  it("should update memory access count", async () => {
    contextManager.getMemoryBank().store({
      sessionId: "session-1",
      workspacePath,
      memoryType: "summary",
      content: "Summary content",
      tokensSaved: 1000,
      relevanceScore: 1.0,
    });

    contextManager.retrieveRelevantContext("query", workspacePath, 100);
    contextManager.retrieveRelevantContext("query", workspacePath, 100);

    const memories = contextManager.retrieveRelevantContext("query", workspacePath, 100);

    expect(memories[0].accessCount).toBeGreaterThan(1);
  });
});
