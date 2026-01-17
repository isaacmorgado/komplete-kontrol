/**
 * Agent Communication for KOMPLETE-KONTROL CLI
 *
 * Provides message passing and communication capabilities between agents.
 * Follows patterns from agent-swarm-kit with simplified architecture.
 */

import { AgentError } from '../../types';
import { Logger } from '../../utils/logger';

/**
 * Message types
 */
export enum MessageType {
  /**
   * Request message (expects response)
   */
  REQUEST = 'request',
  /**
   * Response message
   */
  RESPONSE = 'response',
  /**
   * Notification message (no response expected)
   */
  NOTIFICATION = 'notification',
  /**
   * Broadcast message (sent to all agents)
   */
  BROADCAST = 'broadcast',
}

/**
 * Message priority
 */
export enum MessagePriority {
  /**
   * Low priority message
   */
  LOW = 0,
  /**
   * Normal priority message
   */
  NORMAL = 1,
  /**
   * High priority message
   */
  HIGH = 2,
  /**
   * Critical priority message
   */
  CRITICAL = 3,
}

/**
 * Agent message
 */
export interface AgentMessage {
  /**
   * Message ID
   */
  id: string;
  /**
   * Message type
   */
  type: MessageType;
  /**
   * Sender agent ID
   */
  from: string;
  /**
   * Recipient agent ID (undefined for broadcast)
   */
  to?: string;
  /**
   * Message subject
   */
  subject: string;
  /**
   * Message payload
   */
  payload: unknown;
  /**
   * Message priority
   */
  priority: MessagePriority;
  /**
   * Message timestamp
   */
  timestamp: Date;
  /**
   * Correlation ID for request-response pattern
   */
  correlationId?: string;
  /**
   * Reply-to agent ID
   */
  replyTo?: string;
  /**
   * TTL (time to live) in milliseconds
   */
  ttl?: number;
  /**
   * Message metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Message handler function
 */
export type MessageHandler = (message: AgentMessage) => void | Promise<void>;

/**
 * Message filter function
 */
export type MessageFilter = (message: AgentMessage) => boolean;

/**
 * Pending request
 */
interface PendingRequest {
  resolve: (value: AgentMessage) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

/**
 * Communication channel configuration
 */
export interface CommunicationChannelConfig {
  /**
   * Channel name
   */
  name: string;
  /**
   * Message TTL in milliseconds
   */
  defaultTtl?: number;
  /**
   * Maximum message queue size
   */
  maxQueueSize?: number;
  /**
   * Enable message persistence
   */
  enablePersistence?: boolean;
}

/**
 * Agent Communication Manager class
 *
 * Provides message passing and communication capabilities between agents.
 * Supports request-response pattern, notifications, and broadcasting.
 */
export class AgentCommunicationManager {
  private messageHandlers: Map<string, MessageHandler[]> = new Map();
  private messageFilters: Map<string, MessageFilter[]> = new Map();
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private messageHistory: AgentMessage[] = [];
  private logger: Logger;
  private config: Required<CommunicationChannelConfig>;

  constructor(
    config: CommunicationChannelConfig = { name: 'default' },
    logger?: Logger
  ) {
    this.logger = logger || new Logger();
    this.config = {
      name: config.name,
      defaultTtl: config.defaultTtl ?? 60000,
      maxQueueSize: config.maxQueueSize ?? 1000,
      enablePersistence: config.enablePersistence ?? false,
    };
    this.logger.info(
      `AgentCommunicationManager initialized: ${this.config.name}`,
      'AgentCommunicationManager'
    );
  }

  /**
   * Send a message to an agent
   *
   * @param message - Message to send
   * @throws AgentError if message validation fails
   */
  async send(message: AgentMessage): Promise<void> {
    this.validateMessage(message);

    // Handle response messages
    if (message.type === MessageType.RESPONSE) {
      this.handleResponse(message);
      return;
    }

    // Check TTL
    if (message.ttl && Date.now() - message.timestamp.getTime() > message.ttl) {
      this.logger.warn(`Message expired: ${message.id}`, 'AgentCommunicationManager');
      return;
    }

    // Add to history
    this.addToHistory(message);

    // Find handlers for recipient
    const handlers = this.getHandlers(message.to);

    if (handlers.length === 0) {
      this.logger.warn(
        `No handlers found for recipient: ${message.to}`,
        'AgentCommunicationManager'
      );
      return;
    }

    // Apply filters
    const filters = this.getFilters(message.to);
    const shouldProcess = filters.every((filter) => filter(message));

    if (!shouldProcess) {
      this.logger.debug(`Message filtered out: ${message.id}`, 'AgentCommunicationManager');
      return;
    }

    // Deliver message to handlers
    for (const handler of handlers) {
      try {
        await handler(message);
      } catch (error) {
        this.logger.error(
          `Message handler error: ${message.id}`,
          'AgentCommunicationManager',
          { error: (error as Error).message }
        );
      }
    }

    this.logger.debug(
      `Message sent: ${message.id} from ${message.from} to ${message.to}`,
      'AgentCommunicationManager'
    );
  }

  /**
   * Send a request and wait for response
   *
   * @param from - Sender agent ID
   * @param to - Recipient agent ID
   * @param subject - Message subject
   * @param payload - Message payload
   * @param timeout - Request timeout in milliseconds
   * @returns Response message
   * @throws AgentError if request times out or fails
   */
  async request(
    from: string,
    to: string,
    subject: string,
    payload: unknown,
    timeout: number = 30000
  ): Promise<AgentMessage> {
    const correlationId = this.generateMessageId();
    const message: AgentMessage = {
      id: this.generateMessageId(),
      type: MessageType.REQUEST,
      from,
      to,
      subject,
      payload,
      priority: MessagePriority.NORMAL,
      timestamp: new Date(),
      correlationId,
      ttl: this.config.defaultTtl,
    };

    // Create promise for response
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(correlationId);
        reject(new AgentError(`Request timeout: ${message.id}`, from));
      }, timeout);

      this.pendingRequests.set(correlationId, {
        resolve,
        reject,
        timeout: timeoutHandle,
      });

      // Send request
      this.send(message).catch((error) => {
        this.pendingRequests.delete(correlationId);
        clearTimeout(timeoutHandle);
        reject(error);
      });
    });
  }

  /**
   * Send a response to a request
   *
   * @param from - Sender agent ID
   * @param to - Recipient agent ID
   * @param subject - Message subject
   * @param payload - Message payload
   * @param correlationId - Correlation ID from original request
   */
  async respond(
    from: string,
    to: string,
    subject: string,
    payload: unknown,
    correlationId: string
  ): Promise<void> {
    const message: AgentMessage = {
      id: this.generateMessageId(),
      type: MessageType.RESPONSE,
      from,
      to,
      subject,
      payload,
      priority: MessagePriority.NORMAL,
      timestamp: new Date(),
      correlationId,
      ttl: this.config.defaultTtl,
    };

    await this.send(message);
  }

  /**
   * Send a notification (no response expected)
   *
   * @param from - Sender agent ID
   * @param to - Recipient agent ID
   * @param subject - Message subject
   * @param payload - Message payload
   * @param priority - Message priority
   */
  async notify(
    from: string,
    to: string,
    subject: string,
    payload: unknown,
    priority: MessagePriority = MessagePriority.NORMAL
  ): Promise<void> {
    const message: AgentMessage = {
      id: this.generateMessageId(),
      type: MessageType.NOTIFICATION,
      from,
      to,
      subject,
      payload,
      priority,
      timestamp: new Date(),
      ttl: this.config.defaultTtl,
    };

    await this.send(message);
  }

  /**
   * Broadcast a message to all agents
   *
   * @param from - Sender agent ID
   * @param subject - Message subject
   * @param payload - Message payload
   * @param priority - Message priority
   */
  async broadcast(
    from: string,
    subject: string,
    payload: unknown,
    priority: MessagePriority = MessagePriority.NORMAL
  ): Promise<void> {
    const message: AgentMessage = {
      id: this.generateMessageId(),
      type: MessageType.BROADCAST,
      from,
      subject,
      payload,
      priority,
      timestamp: new Date(),
      ttl: this.config.defaultTtl,
    };

    // Add to history
    this.addToHistory(message);

    // Deliver to all handlers
    for (const [agentId, handlers] of this.messageHandlers.entries()) {
      // Skip sender
      if (agentId === from) continue;

      // Apply filters
      const filters = this.getFilters(agentId);
      const shouldProcess = filters.every((filter) => filter(message));

      if (!shouldProcess) continue;

      // Deliver message to handlers
      for (const handler of handlers) {
        try {
          await handler(message);
        } catch (error) {
          this.logger.error(
            `Broadcast handler error: ${message.id}`,
            'AgentCommunicationManager',
            { error: (error as Error).message }
          );
        }
      }
    }

    this.logger.debug(
      `Message broadcast: ${message.id} from ${message.from}`,
      'AgentCommunicationManager'
    );
  }

  /**
   * Register a message handler for an agent
   *
   * @param agentId - Agent ID to register handler for
   * @param handler - Message handler function
   */
  registerHandler(agentId: string, handler: MessageHandler): void {
    if (!this.messageHandlers.has(agentId)) {
      this.messageHandlers.set(agentId, []);
    }
    this.messageHandlers.get(agentId)!.push(handler);

    this.logger.debug(
      `Message handler registered for agent: ${agentId}`,
      'AgentCommunicationManager'
    );
  }

  /**
   * Unregister a message handler for an agent
   *
   * @param agentId - Agent ID to unregister handler for
   * @param handler - Message handler function to remove
   */
  unregisterHandler(agentId: string, handler: MessageHandler): void {
    const handlers = this.messageHandlers.get(agentId);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Register a message filter for an agent
   *
   * @param agentId - Agent ID to register filter for
   * @param filter - Message filter function
   */
  registerFilter(agentId: string, filter: MessageFilter): void {
    if (!this.messageFilters.has(agentId)) {
      this.messageFilters.set(agentId, []);
    }
    this.messageFilters.get(agentId)!.push(filter);

    this.logger.debug(
      `Message filter registered for agent: ${agentId}`,
      'AgentCommunicationManager'
    );
  }

  /**
   * Unregister a message filter for an agent
   *
   * @param agentId - Agent ID to unregister filter for
   * @param filter - Message filter function to remove
   */
  unregisterFilter(agentId: string, filter: MessageFilter): void {
    const filters = this.messageFilters.get(agentId);
    if (filters) {
      const index = filters.indexOf(filter);
      if (index > -1) {
        filters.splice(index, 1);
      }
    }
  }

  /**
   * Get message history
   *
   * @param agentId - Optional agent ID to filter by
   * @param limit - Maximum number of messages to return
   * @returns Array of messages
   */
  getHistory(agentId?: string, limit?: number): AgentMessage[] {
    let messages = this.messageHistory;

    if (agentId) {
      messages = messages.filter(
        (msg) => msg.from === agentId || msg.to === agentId
      );
    }

    if (limit) {
      messages = messages.slice(-limit);
    }

    return messages;
  }

  /**
   * Clear message history
   */
  clearHistory(): void {
    this.messageHistory = [];
    this.logger.info('Message history cleared', 'AgentCommunicationManager');
  }

  /**
   * Handle response message
   *
   * @param message - Response message
   */
  private handleResponse(message: AgentMessage): void {
    if (message.correlationId && this.pendingRequests.has(message.correlationId)) {
      const pending = this.pendingRequests.get(message.correlationId)!;
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(message.correlationId);
      pending.resolve(message);
    }
  }

  /**
   * Get handlers for an agent
   *
   * @param agentId - Agent ID to get handlers for
   * @returns Array of message handlers
   */
  private getHandlers(agentId?: string): MessageHandler[] {
    if (!agentId) return [];

    const handlers = this.messageHandlers.get(agentId);
    return handlers ? [...handlers] : [];
  }

  /**
   * Get filters for an agent
   *
   * @param agentId - Agent ID to get filters for
   * @returns Array of message filters
   */
  private getFilters(agentId?: string): MessageFilter[] {
    if (!agentId) return [];

    const filters = this.messageFilters.get(agentId);
    return filters ? [...filters] : [];
  }

  /**
   * Add message to history
   *
   * @param message - Message to add
   */
  private addToHistory(message: AgentMessage): void {
    this.messageHistory.push(message);

    // Trim history if exceeds max size
    if (this.messageHistory.length > this.config.maxQueueSize) {
      this.messageHistory.shift();
    }
  }

  /**
   * Validate message
   *
   * @param message - Message to validate
   * @throws AgentError if validation fails
   */
  private validateMessage(message: AgentMessage): void {
    if (!message.id || message.id.trim() === '') {
      throw new AgentError('Message ID is required', 'communication');
    }

    if (!message.from || message.from.trim() === '') {
      throw new AgentError('Message sender is required', 'communication');
    }

    if (!message.subject || message.subject.trim() === '') {
      throw new AgentError('Message subject is required', 'communication');
    }

    if (message.type === MessageType.REQUEST && !message.to) {
      throw new AgentError('Request message must have a recipient', 'communication');
    }
  }

  /**
   * Generate unique message ID
   *
   * @returns Unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear all handlers and filters
   */
  clear(): void {
    this.messageHandlers.clear();
    this.messageFilters.clear();
    this.pendingRequests.forEach((pending) => {
      clearTimeout(pending.timeout);
    });
    this.pendingRequests.clear();
    this.messageHistory = [];
    this.logger.info('AgentCommunicationManager cleared', 'AgentCommunicationManager');
  }
}

/**
 * Global agent communication manager instance
 */
let globalAgentCommunicationManager: AgentCommunicationManager | null = null;

/**
 * Initialize global agent communication manager
 *
 * @param config - Communication channel configuration
 * @param logger - Optional logger instance
 * @returns The global agent communication manager
 */
export function initAgentCommunicationManager(
  config?: CommunicationChannelConfig,
  logger?: Logger
): AgentCommunicationManager {
  globalAgentCommunicationManager = new AgentCommunicationManager(config, logger);
  return globalAgentCommunicationManager;
}

/**
 * Get global agent communication manager
 *
 * @returns The global agent communication manager
 */
export function getAgentCommunicationManager(): AgentCommunicationManager {
  if (!globalAgentCommunicationManager) {
    globalAgentCommunicationManager = new AgentCommunicationManager();
  }
  return globalAgentCommunicationManager;
}
