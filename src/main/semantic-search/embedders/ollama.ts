/**
 * Ollama Embedder (Local)
 * Adapted from: kilocode/src/services/code-index/embedders/ollama.ts
 */

import { IEmbedder, EmbeddingResponse } from "./base";
import { EmbedderConfig } from "../types";

interface OllamaEmbedResponse {
  embedding: number[];
  model: string;
}

export class OllamaEmbedder implements IEmbedder {
  private config: EmbedderConfig;
  private baseUrl: string;

  constructor(config: EmbedderConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || "http://localhost:11434";
  }

  async createEmbeddings(texts: string[], model?: string): Promise<EmbeddingResponse> {
    const embeddings: Float32Array[] = [];

    for (const text of texts) {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: model || this.config.model,
          prompt: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama request failed: ${response.statusText}`);
      }

      const json = await response.json();
      const data = json as OllamaEmbedResponse;
      embeddings.push(new Float32Array(data.embedding));
    }

    return {
      embeddings,
      model: model || this.config.model,
    };
  }

  async validateConfiguration(): Promise<boolean> {
    try {
      await this.createEmbeddings(["test"]);
      return true;
    } catch {
      return false;
    }
  }

  getDimensions(): number {
    return this.config.dimensions;
  }

  getInfo(): EmbedderConfig {
    return this.config;
  }
}
