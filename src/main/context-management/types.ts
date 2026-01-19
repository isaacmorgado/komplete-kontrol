/**
 * Context Management Type Definitions
 * Adapted from: kilocode/packages/types/src/context-management.ts
 */

import { MessageParam } from "@anthropic-ai/sdk/resources/messages/messages";

export type { MessageParam };

export interface MessageParamWithMeta extends MessageParam {
  id?: string;
  timestamp?: number;
  isSummary?: boolean;
  condenseParent?: string;
  truncationParent?: string;
  isTruncationMarker?: boolean;
}

export interface CondensationResult {
  condensedMessages: MessageParamWithMeta[];
  summary: string;
  tokensSaved: number;
  cost: number;
}

export interface ContextManagementOptions {
  messages: MessageParamWithMeta[];
  totalTokens: number;
  contextWindow: number;
  autoCondense?: boolean;
  systemPrompt?: string;
  taskId?: string;
}

export interface MemoryEntry {
  id: string;
  sessionId: string;
  workspacePath: string;
  memoryType: "summary" | "key_fact" | "pattern" | "decision";
  content: string;
  tokensSaved: number;
  relevanceScore: number;
  accessCount: number;
  lastAccessed: number;
  createdAt: number;
}

export interface RetrieveOptions {
  query: string;
  workspacePath: string;
  maxTokens: number;
  strategy?: "keyword" | "semantic" | "hybrid";
}
