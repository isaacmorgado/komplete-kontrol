/**
 * Streaming Response Handler
 *
 * Provides unified streaming response handling for all providers
 * with buffering, chunk aggregation, and event emission.
 */

import type { AIProvider, Message, CompletionOptions, StreamChunk, MessageContent } from '../../../types';
import { Logger, LoggerLike } from '../../../utils/logger';

/**
 * Extract text from MessageContent
 */
function extractText(content: MessageContent | undefined): string {
  if (!content) return '';
  if (content.type === 'text') return content.text;
  if (content.type === 'tool_use') return JSON.stringify(content.input);
  if (content.type === 'tool_result') return typeof content.content === 'string' ? content.content : JSON.stringify(content.content);
  return '';
}

/**
 * Stream event type
 */
export type StreamEventType = 'start' | 'data' | 'done' | 'error' | 'metadata';

/**
 * Stream event
 */
export interface StreamEvent {
  type: StreamEventType;
  chunk?: StreamChunk;
  error?: Error;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Stream buffer configuration
 */
export interface StreamBufferConfig {
  bufferSize: number;
  flushIntervalMs: number;
  enableBuffering: boolean;
}

/**
 * Stream handler configuration
 */
export interface StreamHandlerConfig {
  buffer: StreamBufferConfig;
  enableEvents: boolean;
  enableProgress: boolean;
  onEvent?: (event: StreamEvent) => void;
  onProgress?: (progress: number) => void;
}

/**
 * Stream result
 */
export interface StreamResult {
  text: string;
  chunks: StreamChunk[];
  metadata: Record<string, unknown>;
  duration: number;
}

/**
 * Stream state
 */
interface StreamState {
  id: string;
  startTime: Date;
  buffer: string;
  chunks: StreamChunk[];
  metadata: Record<string, unknown>;
  totalTokens: number;
  completed: boolean;
}

/**
 * Streaming response handler
 *
 * Provides unified streaming response handling with buffering,
 * chunk aggregation, and event emission.
 */
export class StreamingResponseHandler {
  private logger: LoggerLike;
  private config: StreamHandlerConfig;
  private activeStreams: Map<string, StreamState> = new Map();

  constructor(config?: Partial<StreamHandlerConfig>, logger?: LoggerLike) {
    this.config = {
      buffer: {
        bufferSize: 1024,
        flushIntervalMs: 100,
        enableBuffering: true,
      },
      enableEvents: true,
      enableProgress: false,
      ...config,
    };
    this.logger = logger?.child('StreamingResponseHandler') ?? new Logger().child('StreamingResponseHandler');
  }

  /**
   * Generate unique stream ID
   */
  private generateStreamId(): string {
    return `stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create stream state
   */
  private createStreamState(id: string): StreamState {
    return {
      id,
      startTime: new Date(),
      buffer: '',
      chunks: [],
      metadata: {},
      totalTokens: 0,
      completed: false,
    };
  }

  /**
   * Emit event
   */
  private emitEvent(event: StreamEvent): void {
    if (this.config.enableEvents && this.config.onEvent) {
      this.config.onEvent(event);
    }
  }

  /**
   * Emit progress
   */
  private emitProgress(progress: number): void {
    if (this.config.enableProgress && this.config.onProgress) {
      this.config.onProgress(progress);
    }
  }

  /**
   * Process chunk
   */
  private processChunk(state: StreamState, chunk: StreamChunk): void {
    state.chunks.push(chunk);

    if (chunk.content) {
      state.buffer += chunk.content;
    }

    if (chunk.metadata) {
      Object.assign(state.metadata, chunk.metadata);
    }

    if (chunk.tokens) {
      state.totalTokens += chunk.tokens;
    }

    // Emit data event
    this.emitEvent({
      type: 'data',
      chunk,
      timestamp: new Date(),
    });

    // Emit progress (estimate based on tokens)
    if (this.config.enableProgress) {
      // Rough estimate: assume 4 tokens is 100% (based on mock provider)
      const progress = state.totalTokens > 0 ? Math.min(state.totalTokens / 4, 1) : 0;
      this.emitProgress(progress);
    }
  }

  /**
   * Stream from provider with unified handling
   */
  async *stream(
    provider: AIProvider,
    model: string,
    messages: Message[],
    options?: CompletionOptions
  ): AsyncGenerator<StreamChunk> {
    const streamId = this.generateStreamId();
    const state = this.createStreamState(streamId);
    this.activeStreams.set(streamId, state);

    // Emit start event
    this.emitEvent({
      type: 'start',
      metadata: { streamId, model, messageCount: messages.length },
      timestamp: new Date(),
    });

    try {
      // Stream from provider
      for await (const chunk of provider.stream(model, messages, options)) {
        this.processChunk(state, chunk);

        // Handle buffering vs non-buffering
        if (this.config.buffer.enableBuffering) {
          // When buffering, only yield when buffer is flushed
          if (state.buffer.length >= this.config.buffer.bufferSize) {
            yield { content: { type: 'text' as const, text: state.buffer }, metadata: state.metadata };
            state.buffer = '';
          }
        } else {
          // When not buffering, yield each chunk immediately
          yield chunk;
        }
      }

      // Flush remaining buffer
      if (this.config.buffer.enableBuffering && state.buffer.length > 0) {
        yield { content: { type: 'text' as const, text: state.buffer }, metadata: state.metadata };
        state.buffer = '';
      }

      state.completed = true;

      // Emit done event
      this.emitEvent({
        type: 'done',
        metadata: {
          streamId,
          totalChunks: state.chunks.length,
          totalTokens: state.totalTokens,
          duration: Date.now() - state.startTime.getTime(),
        },
        timestamp: new Date(),
      });

      // Emit final progress
      if (this.config.enableProgress) {
        this.emitProgress(1);
      }
    } catch (error) {
      state.completed = true;

      // Emit error event
      this.emitEvent({
        type: 'error',
        error: error as Error,
        timestamp: new Date(),
      });

      throw error;
    } finally {
      const streamState = this.activeStreams.get(streamId);
      if (streamState) {
        this.completedStreams.push({ ...streamState });
      }
      this.activeStreams.delete(streamId);
    }
  }

  /**
   * Stream and collect all chunks
   */
  async streamAndCollect(
    provider: AIProvider,
    model: string,
    messages: Message[],
    options?: CompletionOptions
  ): Promise<StreamResult> {
    const streamId = this.generateStreamId();
    const state = this.createStreamState(streamId);
    this.activeStreams.set(streamId, state);

    // Emit start event
    this.emitEvent({
      type: 'start',
      metadata: { streamId, model, messageCount: messages.length },
      timestamp: new Date(),
    });

    try {
      // Stream and collect all chunks
      for await (const chunk of provider.stream(model, messages, options)) {
        this.processChunk(state, chunk);
      }

      state.completed = true;

      const result: StreamResult = {
        text: state.chunks.map(c => c.content ?? '').join(''),
        chunks: state.chunks,
        metadata: state.metadata,
        duration: Date.now() - state.startTime.getTime(),
      };

      // Emit done event
      this.emitEvent({
        type: 'done',
        metadata: {
          streamId,
          totalChunks: state.chunks.length,
          totalTokens: state.totalTokens,
          duration: result.duration,
        },
        timestamp: new Date(),
      });

      // Emit final progress
      if (this.config.enableProgress) {
        this.emitProgress(1);
      }

      return result;
    } catch (error) {
      state.completed = true;

      // Emit error event
      this.emitEvent({
        type: 'error',
        error: error as Error,
        timestamp: new Date(),
      });

      throw error;
    } finally {
      const streamState = this.activeStreams.get(streamId);
      if (streamState) {
        this.completedStreams.push({ ...streamState });
      }
      this.activeStreams.delete(streamId);
    }
  }

  /**
   * Stream with buffering
   */
  async *streamWithBuffer(
    provider: AIProvider,
    model: string,
    messages: Message[],
    options?: CompletionOptions
  ): AsyncGenerator<string> {
    const streamId = this.generateStreamId();
    const state = this.createStreamState(streamId);
    this.activeStreams.set(streamId, state);

    // Emit start event
    this.emitEvent({
      type: 'start',
      metadata: { streamId, model, messageCount: messages.length },
      timestamp: new Date(),
    });

    try {
      let buffer = '';
      let lastFlush = Date.now();

      for await (const chunk of provider.stream(model, messages, options)) {
        this.processChunk(state, chunk);

        if (chunk.content) {
          buffer += chunk.content;

          // Flush buffer if size or time threshold reached
          if (
            buffer.length >= this.config.buffer.bufferSize ||
            Date.now() - lastFlush >= this.config.buffer.flushIntervalMs
          ) {
            yield buffer;
            buffer = '';
            lastFlush = Date.now();
          }
        }
      }

      // Flush remaining buffer
      if (buffer.length > 0) {
        yield buffer;
      }

      state.completed = true;

      // Emit done event
      this.emitEvent({
        type: 'done',
        metadata: {
          streamId,
          totalChunks: state.chunks.length,
          totalTokens: state.totalTokens,
          duration: Date.now() - state.startTime.getTime(),
        },
        timestamp: new Date(),
      });

      // Emit final progress
      if (this.config.enableProgress) {
        this.emitProgress(1);
      }
    } catch (error) {
      state.completed = true;

      // Emit error event
      this.emitEvent({
        type: 'error',
        error: error as Error,
        timestamp: new Date(),
      });

      throw error;
    } finally {
      const streamState = this.activeStreams.get(streamId);
      if (streamState) {
        this.completedStreams.push({ ...streamState });
      }
      this.activeStreams.delete(streamId);
    }
  }

  /**
   * Get active streams
   */
  getActiveStreams(): string[] {
    return Array.from(this.activeStreams.keys());
  }

  /**
   * Get stream state
   */
  getStreamState(streamId: string): StreamState | undefined {
    return this.activeStreams.get(streamId);
  }

  /**
   * Cancel a stream
   */
  cancelStream(streamId: string): boolean {
    const state = this.activeStreams.get(streamId);
    if (state) {
      state.completed = true;
      this.activeStreams.delete(streamId);
      this.logger.info(`Stream cancelled: ${streamId}`);
      return true;
    }
    return false;
  }

  /**
   * Cancel all active streams
   */
  cancelAllStreams(): void {
    for (const streamId of this.activeStreams.keys()) {
      this.cancelStream(streamId);
    }
  }

  /**
   * Get configuration
   */
  getConfig(): Readonly<StreamHandlerConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<StreamHandlerConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('Stream handler configuration updated');
  }

  /**
   * Get statistics
   */
  private completedStreams: StreamState[] = [];

  getStatistics(): StreamHandlerStatistics {
    const activeStreams = Array.from(this.activeStreams.values());

    return {
      activeStreams: activeStreams.length,
      totalChunks: activeStreams.reduce((sum, s) => sum + s.chunks.length, 0) +
        this.completedStreams.reduce((sum, s) => sum + s.chunks.length, 0),
      totalTokens: activeStreams.reduce((sum, s) => sum + s.totalTokens, 0) +
        this.completedStreams.reduce((sum, s) => sum + s.totalTokens, 0),
      averageDuration:
        [...activeStreams, ...this.completedStreams].length > 0
          ? [...activeStreams, ...this.completedStreams].reduce((sum, s) => sum + (Date.now() - s.startTime.getTime()), 0) /
            [...activeStreams, ...this.completedStreams].length
          : 0,
    };
  }
}

/**
 * Stream handler statistics
 */
export interface StreamHandlerStatistics {
  activeStreams: number;
  totalChunks: number;
  totalTokens: number;
  averageDuration: number;
}

/**
 * Default stream handler configuration
 */
export const DEFAULT_STREAM_HANDLER_CONFIG: StreamHandlerConfig = {
  buffer: {
    bufferSize: 1024,
    flushIntervalMs: 100,
    enableBuffering: true,
  },
  enableEvents: true,
  enableProgress: false,
};

/**
 * Create a streaming response handler with default configuration
 */
export function createStreamingResponseHandler(
  config?: Partial<StreamHandlerConfig>
): StreamingResponseHandler {
  return new StreamingResponseHandler(config);
}

/**
 * Stream utility functions
 */
export class StreamUtils {
  /**
   * Collect all chunks from a stream
   */
  static async collectChunks(
    stream: AsyncGenerator<StreamChunk>
  ): Promise<StreamChunk[]> {
    const chunks: StreamChunk[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return chunks;
  }

  /**
   * Collect all text from a stream
   */
  static async collectText(
    stream: AsyncGenerator<StreamChunk>
  ): Promise<string> {
    const chunks = await this.collectChunks(stream);
    return chunks.map(c => c.content ?? '').join('');
  }

  /**
   * Stream to text strings
   */
  static async *streamToText(
    stream: AsyncGenerator<StreamChunk>
  ): AsyncGenerator<string> {
    for await (const chunk of stream) {
      if (chunk.content) {
        const text = extractText(chunk.content);
        if (text) {
          yield text;
        }
      }
    }
  }

  /**
   * Merge multiple streams
   */
  static async *mergeStreams(
    streams: AsyncGenerator<StreamChunk>[]
  ): AsyncGenerator<StreamChunk> {
    const promises = streams.map(async function* (s) {
      for await (const chunk of s) {
        yield chunk;
      }
    });

    for await (const chunk of this.mergeAsyncGenerators(promises)) {
      yield chunk;
    }
  }

  /**
   * Merge async generators
   */
  private static async *mergeAsyncGenerators<T>(
    generators: AsyncGenerator<T>[]
  ): AsyncGenerator<T> {
    const iterators = generators.map(g => g[Symbol.asyncIterator]());
    const pending = new Map<AsyncIterator<T>, Promise<{ iterator: AsyncIterator<T>; result: IteratorResult<T> }>>();

    const wrapPromise = (iterator: AsyncIterator<T>) =>
      iterator.next().then(result => ({ iterator, result }));

    for (const iterator of iterators) {
      pending.set(iterator, wrapPromise(iterator));
    }

    while (pending.size > 0) {
      const settled = await Promise.race([...pending.values()]);
      pending.delete(settled.iterator);

      if (settled.result.done) {
        continue;
      }

      yield settled.result.value;
      pending.set(settled.iterator, wrapPromise(settled.iterator));
    }
  }

  /**
   * Transform stream chunks
   */
  static async *transformStream<T extends StreamChunk>(
    stream: AsyncGenerator<T>,
    transformer: (chunk: T) => T | Promise<T>
  ): AsyncGenerator<T> {
    for await (const chunk of stream) {
      yield await transformer(chunk);
    }
  }

  /**
   * Filter stream chunks
   */
  static async *filterStream<T extends StreamChunk>(
    stream: AsyncGenerator<T>,
    predicate: (chunk: T) => boolean | Promise<boolean>
  ): AsyncGenerator<T> {
    for await (const chunk of stream) {
      if (await predicate(chunk)) {
        yield chunk;
      }
    }
  }

  /**
   * Batch stream chunks
   */
  static async *batchStream<T extends StreamChunk>(
    stream: AsyncGenerator<T>,
    batchSize: number,
    batchIntervalMs?: number
  ): AsyncGenerator<T[]> {
    const batch: T[] = [];
    let lastBatch = Date.now();

    for await (const chunk of stream) {
      batch.push(chunk);

      if (batch.length >= batchSize) {
        yield [...batch];
        batch.length = 0;
        lastBatch = Date.now();
      } else if (batchIntervalMs && Date.now() - lastBatch >= batchIntervalMs) {
        yield [...batch];
        batch.length = 0;
        lastBatch = Date.now();
      }
    }

    // Yield remaining chunks
    if (batch.length > 0) {
      yield batch;
    }
  }
}
