/**
 * Unit Tests: Memory Bank
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MemoryBank } from "../../../../main/context-management/MemoryBank";
import { MemoryEntry } from "../../../../main/context-management/types";
import fs from "fs/promises";

describe("MemoryBank", () => {
  let memoryBank: MemoryBank;
  let workspacePath: string;

  beforeEach(() => {
    workspacePath = `/tmp/test-workspace-${Date.now()}`;
    memoryBank = new MemoryBank(workspacePath);
  });

  afterEach(async () => {
    memoryBank.close();
    try {
      await fs.unlink(`${workspacePath}/.komplete-kontrol/memory.db`);
    } catch {
      // Ignore cleanup errors
    }
  });

  it("should store memory entry", () => {
    const entry = memoryBank.store({
      sessionId: "session-1",
      workspacePath,
      memoryType: "summary",
      content: "Test summary content",
      tokensSaved: 1000,
      relevanceScore: 1.0,
    });

    expect(entry.id).toBeDefined();
    expect(entry.content).toBe("Test summary content");
    expect(entry.tokensSaved).toBe(1000);
    expect(entry.createdAt).toBeDefined();
  });

  it("should retrieve memories by workspace", () => {
    memoryBank.store({
      sessionId: "session-1",
      workspacePath,
      memoryType: "key_fact",
      content: "Important fact",
      tokensSaved: 500,
      relevanceScore: 0.9,
    });

    memoryBank.store({
      sessionId: "session-2",
      workspacePath,
      memoryType: "pattern",
      content: "Common pattern",
      tokensSaved: 300,
      relevanceScore: 0.8,
    });

    const memories = memoryBank.retrieve({
      query: "test",
      workspacePath,
      maxTokens: 2000,
    });

    expect(memories.length).toBe(2);
  });

  it("should update access count on retrieval", () => {
    const entry = memoryBank.store({
      sessionId: "session-1",
      workspacePath,
      memoryType: "summary",
      content: "Test",
      tokensSaved: 100,
      relevanceScore: 1.0,
    });

    memoryBank.retrieve({ query: "test", workspacePath, maxTokens: 1000 });

    const memories = memoryBank.retrieve({ query: "test", workspacePath, maxTokens: 1000 });

    expect(memories[0].accessCount).toBe(2); // Initial + 1 retrieval
  });

  it("should retrieve memories by session", () => {
    memoryBank.store({
      sessionId: "session-1",
      workspacePath,
      memoryType: "summary",
      content: "Session 1 summary",
      tokensSaved: 1000,
      relevanceScore: 1.0,
    });

    memoryBank.store({
      sessionId: "session-2",
      workspacePath,
      memoryType: "summary",
      content: "Session 2 summary",
      tokensSaved: 1500,
      relevanceScore: 0.9,
    });

    const session1Memories = memoryBank.getBySession("session-1");
    const session2Memories = memoryBank.getBySession("session-2");

    expect(session1Memories.length).toBe(1);
    expect(session2Memories.length).toBe(1);
    expect(session1Memories[0].content).toBe("Session 1 summary");
    expect(session2Memories[0].content).toBe("Session 2 summary");
  });

  it("should sort by relevance and last accessed", () => {
    memoryBank.store({
      sessionId: "session-1",
      workspacePath,
      memoryType: "key_fact",
      content: "Less relevant",
      tokensSaved: 100,
      relevanceScore: 0.5,
    });

    memoryBank.store({
      sessionId: "session-2",
      workspacePath,
      memoryType: "key_fact",
      content: "More relevant",
      tokensSaved: 200,
      relevanceScore: 0.9,
    });

    const memories = memoryBank.retrieve({
      query: "test",
      workspacePath,
      maxTokens: 1000,
    });

    expect(memories[0].relevanceScore).toBeGreaterThanOrEqual(memories[1].relevanceScore);
  });

  it("should cleanup old memories", () => {
    memoryBank.store({
      sessionId: "session-1",
      workspacePath,
      memoryType: "summary",
      content: "Old memory",
      tokensSaved: 100,
      relevanceScore: 1.0,
    });

    const deletedCount = memoryBank.cleanup(0); // Delete all (0 days old)

    expect(deletedCount).toBe(1);
  });
});

/**
 * Unit Tests: Conversation Condenser
 */

import { ConversationCondenser } from "../../../../main/context-management/ConversationCondenser";
import { MessageParamWithMeta } from "../../../../main/context-management/types";

describe("ConversationCondenser", () => {
  let condenser: ConversationCondenser;
  let mockProvider: any;

  beforeEach(() => {
    mockProvider = {
      complete: jest.fn(),
    };
    condenser = new ConversationCondenser(mockProvider);
  });

  it("should summarize conversation", async () => {
    const messages: MessageParamWithMeta[] = [
      { role: "user", content: "First message" },
      { role: "assistant", content: "First response" },
      { role: "user", content: "Second message" },
      { role: "assistant", content: "Second response" },
    ];

    mockProvider.complete.mockResolvedValue({
      content: [{ text: "Summary of conversation" }],
      cost: 0.001,
    });

    const result = await condenser.summarize(messages, {
      maxTokensToSave: 100,
      keepLastN: 1,
    });

    expect(result.summary).toBe("Summary of conversation");
    expect(result.condensedMessages.length).toBeLessThan(messages.length);
    expect(result.tokensSaved).toBeGreaterThan(0);
  });

  it("should keep first and last messages", async () => {
    const messages: MessageParamWithMeta[] = [
      { role: "user", content: "First message", id: "1" },
      { role: "assistant", content: "Response 1", id: "2" },
      { role: "user", content: "Second message", id: "3" },
      { role: "assistant", content: "Last message", id: "4" },
    ];

    mockProvider.complete.mockResolvedValue({
      content: [{ text: "Summary" }],
      cost: 0.001,
    });

    const result = await condenser.summarize(messages, { keepLastN: 1 });

    const firstMsg = result.condensedMessages[0];
    const lastMsg = result.condensedMessages[result.condensedMessages.length - 1];

    expect(firstMsg.content).toBe("First message");
    expect(lastMsg.content).toBe("Last message");
  });

  it("should estimate tokens correctly", () => {
    const messages: MessageParamWithMeta[] = [
      { role: "user", content: "Test message with some text" },
    ];

    const estimated = condenser["estimateTokens"](messages);

    expect(estimated).toBeGreaterThan(0);
  });

  it("should handle empty messages", async () => {
    const messages: MessageParamWithMeta[] = [];

    const result = await condenser.summarize(messages);

    expect(result.condensedMessages).toEqual(messages);
    expect(result.tokensSaved).toBe(0);
  });
});
