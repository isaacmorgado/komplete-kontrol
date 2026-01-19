/**
 * Context Manager
 * Main orchestrator for context management
 * Adapted from: kilocode/src/core/context-management/index.ts
 */

import { ConversationCondenser } from "./ConversationCondenser";
import { MemoryBank } from "./MemoryBank";
import { ContextManagementOptions, CondensationResult, MemoryEntry } from "./types";

export class ContextManager {
  private condenser: ConversationCondenser;
  private memoryBank: MemoryBank;
  private config: {
    autoCondensePercent: number;
    summarizationModel: string;
  };

  constructor(workspacePath: string, provider: any, config?: {
    autoCondensePercent?: number;
    summarizationModel?: string;
  }) {
    this.condenser = new ConversationCondenser(provider);
    this.memoryBank = new MemoryBank(workspacePath);

    this.config = {
      autoCondensePercent: 80,
      summarizationModel: "haiku",
      ...config,
    };
  }

  /**
   * Manage context - condense if needed
   */
  async manageContext(options: ContextManagementOptions): Promise<{
    messages: typeof options.messages;
    summary?: string;
    tokensSaved?: number;
  }> {
    const { messages, totalTokens, contextWindow, autoCondense = true } = options;

    const contextPercent = (totalTokens / contextWindow) * 100;
    const threshold = this.config.autoCondensePercent;

    if (contextPercent >= threshold && autoCondense) {
      console.log(`Context at ${contextPercent.toFixed(1)}%, condensing...`);

      const result: CondensationResult = await this.condenser.summarize(messages, {
        maxTokensToSave: Math.floor(totalTokens * 0.6),
      });

      // Store summary in memory bank
      if (result.summary) {
        this.memoryBank.store({
          sessionId: options.taskId || "default",
          workspacePath: "", // Will be set by caller
          memoryType: "summary",
          content: result.summary,
          tokensSaved: result.tokensSaved,
          relevanceScore: 1.0,
          accessCount: 0,
          lastAccessed: Date.now(),
        });
      }

      return {
        messages: result.condensedMessages as any,
        summary: result.summary,
        tokensSaved: result.tokensSaved,
      };
    }

    return {
      messages,
    };
  }

  /**
   * Retrieve relevant context from memory
   */
  retrieveRelevantContext(query: string, workspacePath: string, maxTokens = 2000): MemoryEntry[] {
    return this.memoryBank.retrieve({
      query,
      workspacePath,
      maxTokens,
    });
  }

  /**
   * Get memory bank instance
   */
  getMemoryBank(): MemoryBank {
    return this.memoryBank;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.memoryBank.close();
  }
}
