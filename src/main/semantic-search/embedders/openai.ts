/**
 * OpenAI Embedder
 * Adapted from: kilocode/src/services/code-index/embedders/openai.ts
 */

import OpenAI from "openai";
import { IEmbedder, EmbeddingResponse } from "./base";
import { EmbedderConfig } from "../types";

export class OpenAIEmbedder implements IEmbedder {
  private client: OpenAI;
  private config: EmbedderConfig;

  constructor(config: EmbedderConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
  }

  async createEmbeddings(texts: string[], model?: string): Promise<EmbeddingResponse> {
    const response = await this.client.embeddings.create({
      model: model || this.config.model,
      input: texts,
    });

    const embeddings = response.data.map((d) =>
      new Float32Array(d.embedding)
    );

    return {
      embeddings,
      model: response.model,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
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
