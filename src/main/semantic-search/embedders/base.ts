/**
 * Embedder Interface
 * Adapted from: kilocode/src/services/code-index/interfaces/embedder.ts
 */

import { EmbedderConfig } from "../types";

export interface EmbeddingResponse {
  embeddings: Float32Array[];
  model: string;
  usage?: {
    promptTokens: number;
    totalTokens: number;
  };
}

export interface IEmbedder {
  /**
   * Create embeddings for the given texts
   */
  createEmbeddings(texts: string[], model?: string): Promise<EmbeddingResponse>;

  /**
   * Validate the embedder configuration
   */
  validateConfiguration(): Promise<boolean>;

  /**
   * Get the number of dimensions for this embedder
   */
  getDimensions(): number;

  /**
   * Get the embedder info
   */
  getInfo(): EmbedderConfig;
}
