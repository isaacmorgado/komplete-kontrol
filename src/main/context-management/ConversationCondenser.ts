/**
 * Conversation Condenser
 * LLM-based summarization for context condensation
 * Adapted from: kilocode/src/core/condense/index.ts
 */

import { v4 as uuidv4 } from "uuid";
import { CondensationResult, MessageParamWithMeta, MessageParam } from "./types";

const SUMMARY_PROMPT = `Your task is to create a detailed summary of the conversation so far, paying close attention to:
1. The user's explicit requests and goals
2. Technical details, code patterns, and architectural decisions
3. Any problems encountered and their solutions
4. Current state and next steps

This summary should be thorough enough to allow continuation of the conversation without losing important context.`;

export class ConversationCondenser {
  private provider: any; // Komplete provider

  constructor(provider: any) {
    this.provider = provider;
  }

  /**
   * Summarize conversation to save tokens
   */
  async summarize(messages: MessageParamWithMeta[], options: {
    maxTokensToSave?: number;
    systemPrompt?: string;
    keepLastN?: number;
  } = {}): Promise<CondensationResult> {
    const {
      maxTokensToSave,
      systemPrompt = SUMMARY_PROMPT,
      keepLastN = 3,
    } = options;

    // Preserve first message (may contain commands) and last N messages
    const firstMessage = messages[0];
    const lastMessages = messages.slice(-keepLastN);
    const messagesToSummarize = messages.slice(1, -keepLastN);

    if (messagesToSummarize.length === 0) {
      return {
        condensedMessages: messages,
        summary: "",
        tokensSaved: 0,
        cost: 0,
      };
    }

    // Create summary
    const summaryResult = await this.createSummary(messagesToSummarize, systemPrompt);

    // Build condensed messages
    const condensedMessages: MessageParamWithMeta[] = [
      firstMessage,
      {
        ...({ role: "user", content: `[Previous conversation was summarized. Key points: ${summaryResult.summary}]` } as MessageParam),
        id: uuidv4(),
        isSummary: true,
      },
      ...lastMessages.map((m) => ({
        ...m,
        id: m.id || uuidv4(),
      })),
    ];

    const tokensSaved = maxTokensToSave || this.estimateTokens(messagesToSummarize);

    return {
      condensedMessages,
      summary: summaryResult.summary,
      tokensSaved,
      cost: summaryResult.cost,
    };
  }

  /**
   * Create a summary using LLM
   */
  private async createSummary(messages: MessageParam[], prompt: string): Promise<{
    summary: string;
    cost: number;
  }> {
    try {
      const response = await this.provider.complete({
        messages: [
          { role: "user", content: `${prompt}\n\nConversation:\n${this.formatMessages(messages)}` },
        ],
        maxTokens: 2000,
      });

      return {
        summary: response.content[0].text,
        cost: response.cost || 0,
      };
    } catch (error) {
      console.error("Failed to create summary:", error);
      return {
        summary: "[Error creating summary]",
        cost: 0,
      };
    }
  }

  /**
   * Format messages for summarization
   */
  private formatMessages(messages: MessageParam[]): string {
    return messages.map((m) => {
      const role = m.role.toUpperCase();
      const content = typeof m.content === "string" ? m.content : "[Complex content]";
      return `${role}: ${content}`;
    }).join("\n\n");
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(messages: MessageParam[]): number {
    const text = this.formatMessages(messages);
    return Math.ceil(text.length / 4); // Rough estimate: ~4 chars per token
  }
}
