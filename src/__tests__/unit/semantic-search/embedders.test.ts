/**
 * Unit Tests: Embedders
 */

import { describe, it, expect, beforeEach } from "vitest";
import { OpenAIEmbedder } from "../../../../main/semantic-search/embedders/openai";
import { OllamaEmbedder } from "../../../../main/semantic-search/embedders/ollama";
import { createEmbedder } from "../../../../main/semantic-search/embedders/registry";

describe("OpenAIEmbedder", () => {
  let embedder: OpenAIEmbedder;

  beforeEach(() => {
    embedder = new OpenAIEmbedder({
      provider: "openai",
      model: "text-embedding-3-small",
      dimensions: 1536,
      apiKey: "test-key",
    });
  });

  it("should create embeddings", async () => {
    // Mock the fetch to avoid actual API calls
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            data: [{ embedding: Array(1536).fill(0.1) }],
            model: "text-embedding-3-small",
          }),
      } as Response)
    );

    const result = await embedder.createEmbeddings(["test text"]);

    expect(result.embeddings).toHaveLength(1);
    expect(result.embeddings[0]).toBeInstanceOf(Float32Array);
    expect(result.embeddings[0].length).toBe(1536);
  });

  it("should get dimensions", () => {
    expect(embedder.getDimensions()).toBe(1536);
  });

  it("should return embedder info", () => {
    const info = embedder.getInfo();

    expect(info.provider).toBe("openai");
    expect(info.model).toBe("text-embedding-3-small");
    expect(info.dimensions).toBe(1536);
  });
});

describe("OllamaEmbedder", () => {
  let embedder: OllamaEmbedder;

  beforeEach(() => {
    embedder = new OllamaEmbedder({
      provider: "ollama",
      model: "nomic-embed-text",
      dimensions: 768,
      baseUrl: "http://localhost:11434",
    });
  });

  it("should create embeddings", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            embedding: Array(768).fill(0.1),
            model: "nomic-embed-text",
          }),
      } as Response)
    );

    const result = await embedder.createEmbeddings(["test text"]);

    expect(result.embeddings).toHaveLength(1);
    expect(result.embeddings[0]).toBeInstanceOf(Float32Array);
    expect(result.embeddings[0].length).toBe(768);
  });

  it("should get dimensions", () => {
    expect(embedder.getDimensions()).toBe(768);
  });

  it("should return embedder info", () => {
    const info = embedder.getInfo();

    expect(info.provider).toBe("ollama");
    expect(info.model).toBe("nomic-embed-text");
    expect(info.dimensions).toBe(768);
  });
});

describe("Embedder Registry", () => {
  it("should create OpenAI embedder", () => {
    const embedder = createEmbedder({
      provider: "openai",
      model: "text-embedding-3-small",
      dimensions: 1536,
      apiKey: "test",
    });

    expect(embedder).toBeInstanceOf(OpenAIEmbedder);
  });

  it("should create Ollama embedder", () => {
    const embedder = createEmbedder({
      provider: "ollama",
      model: "nomic-embed-text",
      dimensions: 768,
    });

    expect(embedder).toBeInstanceOf(OllamaEmbedder);
  });

  it("should throw error for unknown provider", () => {
    expect(() =>
      createEmbedder({
        provider: "unknown" as any,
        model: "test",
        dimensions: 100,
      })
    ).toThrow("Unknown embedder provider");
  });
});
