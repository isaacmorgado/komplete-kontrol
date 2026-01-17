/**
 * Embeddings API for KOMPLETE-KONTROL CLI
 *
 * Provides embeddings generation using OpenAI and Ollama providers.
 */

import { Logger } from '../../../utils/logger';

/**
 * Embeddings request
 */
export interface EmbeddingsRequest {
  /**
   * Input text(s) to embed
   */
  input: string | string[];

  /**
   * Model to use for embeddings
   */
  model: string;

  /**
   * Output dimensions (optional, for models that support it)
   */
  dimensions?: number;
}

/**
 * Embeddings result
 */
export interface EmbeddingsResult {
  /**
   * Array of embedding vectors
   */
  embeddings: number[][];

  /**
   * Model used
   */
  model: string;

  /**
   * Token usage
   */
  usage: {
    promptTokens: number;
    totalTokens: number;
  };
}

/**
 * Embeddings provider interface
 */
export interface EmbeddingsProvider {
  /**
   * Provider name
   */
  name: string;

  /**
   * Generate embeddings
   */
  embed(request: EmbeddingsRequest): Promise<EmbeddingsResult>;

  /**
   * List supported models
   */
  supportedModels(): string[];
}

/**
 * Embeddings configuration
 */
export interface EmbeddingsConfig {
  /**
   * OpenAI API key
   */
  openaiApiKey?: string;

  /**
   * OpenAI base URL
   */
  openaiBaseUrl?: string;

  /**
   * Ollama base URL
   */
  ollamaBaseUrl?: string;

  /**
   * Default model
   */
  defaultModel?: string;

  /**
   * Request timeout in ms
   */
  timeout?: number;

  /**
   * Enable graceful degradation when primary provider fails
   */
  enableGracefulDegradation?: boolean;

  /**
   * Fallback provider when primary fails
   */
  fallbackProvider?: 'openai' | 'ollama';

  /**
   * Maximum retries on failure
   */
  maxRetries?: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: EmbeddingsConfig = {
  openaiBaseUrl: 'https://api.openai.com/v1',
  ollamaBaseUrl: 'http://localhost:11434',
  defaultModel: 'text-embedding-3-small',
  timeout: 30000,
  enableGracefulDegradation: true,
  fallbackProvider: 'ollama',
  maxRetries: 2,
};

/**
 * OpenAI Embeddings Provider
 */
export class OpenAIEmbeddings implements EmbeddingsProvider {
  name = 'openai';
  private logger: Logger;
  private config: EmbeddingsConfig;

  constructor(config: EmbeddingsConfig = {}, logger?: Logger) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = logger?.child('OpenAIEmbeddings') ?? new Logger().child('OpenAIEmbeddings');
  }

  /**
   * Generate embeddings using OpenAI API
   */
  async embed(request: EmbeddingsRequest): Promise<EmbeddingsResult> {
    const apiKey = this.config.openaiApiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error('OpenAI API key is required for embeddings');
    }

    const inputs = Array.isArray(request.input) ? request.input : [request.input];

    this.logger.debug(`Generating embeddings for ${inputs.length} input(s)`, 'OpenAIEmbeddings', {
      model: request.model,
    });

    const body: Record<string, unknown> = {
      model: request.model,
      input: inputs,
    };

    if (request.dimensions) {
      body.dimensions = request.dimensions;
    }

    const response = await fetch(`${this.config.openaiBaseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeout!),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI embeddings failed: ${response.status} ${error}`);
    }

    const result = await response.json() as {
      data: Array<{ embedding: number[]; index: number }>;
      model: string;
      usage: { prompt_tokens: number; total_tokens: number };
    };

    // Sort by index to maintain order
    const sortedData = result.data.sort((a, b) => a.index - b.index);

    return {
      embeddings: sortedData.map(d => d.embedding),
      model: result.model,
      usage: {
        promptTokens: result.usage.prompt_tokens,
        totalTokens: result.usage.total_tokens,
      },
    };
  }

  /**
   * List supported OpenAI embedding models
   */
  supportedModels(): string[] {
    return [
      'text-embedding-3-small',
      'text-embedding-3-large',
      'text-embedding-ada-002',
    ];
  }

  /**
   * Check if provider is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const apiKey = this.config.openaiApiKey || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return false;
      }
      
      const response = await fetch(`${this.config.openaiBaseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        signal: AbortSignal.timeout(5000),
      });
      
      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Ollama Embeddings Provider
 */
export class OllamaEmbeddings implements EmbeddingsProvider {
  name = 'ollama';
  private logger: Logger;
  private config: EmbeddingsConfig;

  constructor(config: EmbeddingsConfig = {}, logger?: Logger) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = logger?.child('OllamaEmbeddings') ?? new Logger().child('OllamaEmbeddings');
  }

  /**
   * Generate embeddings using Ollama API
   */
  async embed(request: EmbeddingsRequest): Promise<EmbeddingsResult> {
    const inputs = Array.isArray(request.input) ? request.input : [request.input];

    this.logger.debug(`Generating embeddings for ${inputs.length} input(s)`, 'OllamaEmbeddings', {
      model: request.model,
    });

    const embeddings: number[][] = [];
    let totalTokens = 0;

    // Ollama processes one at a time
    for (const input of inputs) {
      const response = await fetch(`${this.config.ollamaBaseUrl}/api/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: request.model,
          prompt: input,
        }),
        signal: AbortSignal.timeout(this.config.timeout!),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ollama embeddings failed: ${response.status} ${error}`);
      }

      const result = await response.json() as {
        embedding: number[];
      };

      embeddings.push(result.embedding);

      // Estimate tokens (Ollama doesn't return token count)
      totalTokens += Math.ceil(input.length / 4);
    }

    return {
      embeddings,
      model: request.model,
      usage: {
        promptTokens: totalTokens,
        totalTokens,
      },
    };
  }

  /**
   * List supported Ollama embedding models
   */
  supportedModels(): string[] {
    // Common embedding models available in Ollama
    return [
      'nomic-embed-text',
      'all-minilm',
      'mxbai-embed-large',
      'bge-large',
      'snowflake-arctic-embed',
    ];
  }

  /**
   * List available models from Ollama server
   */
  async listAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.config.ollamaBaseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return [];
      }

      const result = await response.json() as {
        models: Array<{ name: string }>;
      };

      return result.models.map(m => m.name);
    } catch {
      return [];
    }
  }

  /**
   * Check if provider is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.ollamaBaseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Unified Embeddings Manager
 *
 * Routes embedding requests to appropriate provider with graceful degradation.
 */
export class EmbeddingsManager {
  private logger: Logger;
  private openai: OpenAIEmbeddings;
  private ollama: OllamaEmbeddings;
  private defaultProvider: 'openai' | 'ollama';
  private config: EmbeddingsConfig;

  constructor(config: EmbeddingsConfig = {}, logger?: Logger) {
    this.logger = logger?.child('EmbeddingsManager') ?? new Logger().child('EmbeddingsManager');
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.openai = new OpenAIEmbeddings(this.config, this.logger);
    this.ollama = new OllamaEmbeddings(this.config, this.logger);
    this.defaultProvider = config.openaiApiKey || process.env.OPENAI_API_KEY ? 'openai' : 'ollama';

    this.logger.info('EmbeddingsManager initialized', 'EmbeddingsManager', {
      defaultProvider: this.defaultProvider,
      gracefulDegradation: this.config.enableGracefulDegradation,
    });
  }

  /**
   * Generate embeddings with graceful degradation
   */
  async embed(request: EmbeddingsRequest, provider?: 'openai' | 'ollama'): Promise<EmbeddingsResult> {
    const selectedProvider = provider || this.defaultProvider;
    const maxRetries = this.config.maxRetries ?? 2;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        switch (selectedProvider) {
          case 'openai':
            return await this.openai.embed(request);
          case 'ollama':
            return await this.ollama.embed(request);
          default:
            throw new Error(`Unknown embeddings provider: ${selectedProvider}`);
        }
      } catch (error) {
        this.logger.warn(
          `Embedding attempt ${attempt}/${maxRetries} failed for ${selectedProvider}`,
          'EmbeddingsManager',
          { error: (error as Error).message }
        );

        // If graceful degradation is enabled and this is the last attempt
        if (this.config.enableGracefulDegradation && attempt === maxRetries) {
          const fallbackProvider = this.config.fallbackProvider;

          if (fallbackProvider && fallbackProvider !== selectedProvider) {
            this.logger.info(
              `Attempting fallback from ${selectedProvider} to ${fallbackProvider}`,
              'EmbeddingsManager'
            );

            try {
              const fallbackInstance = fallbackProvider === 'openai' ? this.openai : this.ollama;
              return await fallbackInstance.embed(request);
            } catch (fallbackError) {
              this.logger.error(
                `Fallback provider ${fallbackProvider} also failed`,
                'EmbeddingsManager',
                { error: (fallbackError as Error).message }
              );
            }
          }
        }

        // If not the last attempt, wait before retrying
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All attempts failed, return a degraded result
    this.logger.warn(
      'All embedding providers failed, returning degraded result',
      'EmbeddingsManager'
    );

    return this.getDegradedResult(request);
  }

  /**
   * Get a degraded result when all providers fail
   * This allows the system to continue functioning without embeddings
   */
  private getDegradedResult(request: EmbeddingsRequest): EmbeddingsResult {
    const inputs = Array.isArray(request.input) ? request.input : [request.input];

    // Return zero vectors as fallback
    const embeddings = inputs.map(() => new Array(1536).fill(0)); // Standard OpenAI embedding dimension

    this.logger.debug(
      `Returning degraded embeddings for ${inputs.length} input(s)`,
      'EmbeddingsManager'
    );

    return {
      embeddings,
      model: 'degraded',
      usage: {
        promptTokens: 0,
        totalTokens: 0,
      },
    };
  }

  /**
   * Check which providers are available
   */
  async checkProvidersAvailability(): Promise<{
    openai: boolean;
    ollama: boolean;
  }> {
    const [openaiAvailable, ollamaAvailable] = await Promise.all([
      this.openai.isAvailable(),
      this.ollama.isAvailable(),
    ]);

    return {
      openai: openaiAvailable,
      ollama: ollamaAvailable,
    };
  }

  /**
   * Get embedding for a single text
   */
  async embedSingle(text: string, model?: string, provider?: 'openai' | 'ollama'): Promise<number[]> {
    const selectedProvider = provider || this.defaultProvider;
    const defaultModel = selectedProvider === 'openai' ? 'text-embedding-3-small' : 'nomic-embed-text';

    const result = await this.embed({
      input: text,
      model: model || defaultModel,
    }, selectedProvider);

    return result.embeddings[0]!;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i]! * b[i]!;
      normA += a[i]! * a[i]!;
      normB += b[i]! * b[i]!;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Find most similar texts from a list
   */
  async findSimilar(
    query: string,
    candidates: string[],
    topK: number = 5,
    model?: string,
    provider?: 'openai' | 'ollama'
  ): Promise<Array<{ text: string; similarity: number; index: number }>> {
    // Get all embeddings
    const allTexts = [query, ...candidates];
    const result = await this.embed({
      input: allTexts,
      model: model || (provider === 'ollama' ? 'nomic-embed-text' : 'text-embedding-3-small'),
    }, provider);

    const queryEmbedding = result.embeddings[0]!;
    const candidateEmbeddings = result.embeddings.slice(1);

    // Calculate similarities
    const similarities = candidateEmbeddings.map((embedding, index) => ({
      text: candidates[index]!,
      similarity: this.cosineSimilarity(queryEmbedding, embedding),
      index,
    }));

    // Sort by similarity (descending) and return top K
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  /**
   * Get OpenAI provider
   */
  getOpenAIProvider(): OpenAIEmbeddings {
    return this.openai;
  }

  /**
   * Get Ollama provider
   */
  getOllamaProvider(): OllamaEmbeddings {
    return this.ollama;
  }
}

/**
 * Global embeddings manager
 */
let globalEmbeddingsManager: EmbeddingsManager | null = null;

/**
 * Initialize global embeddings manager
 */
export function initEmbeddingsManager(
  config?: EmbeddingsConfig,
  logger?: Logger
): EmbeddingsManager {
  globalEmbeddingsManager = new EmbeddingsManager(config, logger);
  return globalEmbeddingsManager;
}

/**
 * Get global embeddings manager
 */
export function getEmbeddingsManager(): EmbeddingsManager {
  if (!globalEmbeddingsManager) {
    globalEmbeddingsManager = new EmbeddingsManager();
  }
  return globalEmbeddingsManager;
}
