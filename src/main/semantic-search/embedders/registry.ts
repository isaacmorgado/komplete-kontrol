/**
 * Embedder Registry
 */

import { IEmbedder } from "./base";
import { OpenAIEmbedder } from "./openai";
import { OllamaEmbedder } from "./ollama";
import { EmbedderConfig } from "../types";

export function createEmbedder(config: EmbedderConfig): IEmbedder {
  switch (config.provider) {
    case "openai":
      return new OpenAIEmbedder(config);
    case "ollama":
      return new OllamaEmbedder(config);
    case "gemini":
      // TODO: Implement Gemini embedder
      throw new Error("Gemini embedder not yet implemented");
    default:
      throw new Error(`Unknown embedder provider: ${config.provider}`);
  }
}

export const DEFAULT_EMBEDDER_MODELS = {
  openai: {
    model: "text-embedding-3-small",
    dimensions: 1536,
  },
  ollama: {
    model: "nomic-embed-text",
    dimensions: 768,
  },
  gemini: {
    model: "text-embedding-004",
    dimensions: 768,
  },
};
