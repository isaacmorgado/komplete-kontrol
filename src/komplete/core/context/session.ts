/**
 * Session Management for KOMPLETE-KONTROL CLI
 *
 * Provides session persistence and management for storing
 * conversation history and metadata.
 */

import { ContextError } from '../../types';
import { createLogger, type ContextLogger } from '../../utils/logger';
import type { Session } from '../../types';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Session manager configuration
 */
export interface SessionManagerConfig {
  sessionsDir: string;
  autoSave: boolean;
  maxSessions: number;
}

/**
 * Session manager class
 */
export class SessionManager {
  private logger: ContextLogger;
  private config: SessionManagerConfig;
  private sessions: Map<string, Session>;
  private activeSessionId: string | null;

  constructor(config: SessionManagerConfig, logger?: ContextLogger) {
    this.config = config;
    this.logger = logger ?? createLogger('SessionManager');
    this.sessions = new Map();
    this.activeSessionId = null;
    this.logger.debug('Session manager initialized', { config } as Record<string, unknown>);
  }

  /**
   * Initialize session manager
   */
  async initialize(): Promise<void> {
    try {
      // Ensure sessions directory exists
      const dirExists = await fs.access(this.config.sessionsDir).then(() => true).catch(() => false);

      if (!dirExists) {
        // Create directory using fs.mkdir
        await fs.mkdir(this.config.sessionsDir, { recursive: true });
        this.logger.info('Sessions directory created', {
          sessionsDir: this.config.sessionsDir,
        } as Record<string, unknown>);
      }

      // Load existing sessions
      await this.loadSessions();

      this.logger.info('Session manager initialized', {
        sessionCount: this.sessions.size,
      } as Record<string, unknown>);
    } catch (error) {
      this.logger.error('Failed to initialize session manager', {
        error,
      } as Record<string, unknown>);
      throw new ContextError(
        `Failed to initialize session manager: ${(error as Error).message}`,
        { code: 'SESSION_INIT_FAILED' }
      );
    }
  }

  /**
   * Create a new session
   *
   * @param name - Session name
   * @returns New session
   */
  async createSession(name: string): Promise<Session> {
    const session: Session = {
      id: this.generateSessionId(),
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      agent: name,
      model: 'default',
      messages: [],
      totalTokens: 0,
    };

    this.sessions.set(session.id, session);

    if (this.config.autoSave) {
      await this.saveSession(session.id);
    }

    this.logger.info('Session created', {
      sessionId: session.id,
      name,
    } as Record<string, unknown>);

    return session;
  }

  /**
   * Get a session by ID
   *
   * @param sessionId - Session ID
   * @returns Session or undefined
   */
  async getSession(sessionId: string): Promise<Session | undefined> {
    // Try to get from memory first
    let session = this.sessions.get(sessionId);

    // If not in memory, try to load from disk
    if (!session) {
      try {
        session = await this.loadSessionFromFile(sessionId);
        if (session) {
          this.sessions.set(sessionId, session);
        }
      } catch (error) {
        this.logger.warn('Failed to load session from file', {
          sessionId,
          error,
        } as Record<string, unknown>);
      }
    }

    return session;
  }

  /**
   * Update a session
   *
   * @param session - Session to update
   */
  async updateSession(session: Session): Promise<void> {
    session.updated = new Date().toISOString();
    this.sessions.set(session.id, session);

    if (this.config.autoSave) {
      await this.saveSession(session.id);
    }

    this.logger.debug('Session updated', {
      sessionId: session.id,
    } as Record<string, unknown>);
  }

  /**
   * Delete a session
   *
   * @param sessionId - Session ID
   */
  async deleteSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new ContextError(
        `Session not found: ${sessionId}`,
        { code: 'SESSION_NOT_FOUND' }
      );
    }

    this.sessions.delete(sessionId);

    // Delete from disk
    try {
      const filePath = this.getSessionFilePath(sessionId);
      await Bun.write(filePath, '');
    } catch (error) {
      this.logger.warn('Failed to delete session file', {
        sessionId,
        error,
      } as Record<string, unknown>);
    }

    if (this.activeSessionId === sessionId) {
      this.activeSessionId = null;
    }

    this.logger.info('Session deleted', {
      sessionId,
    } as Record<string, unknown>);
  }

  /**
   * List all sessions
   *
   * @returns Array of session metadata
   */
  listSessions(): Session[] {
    return Array.from(this.sessions.values()).sort((a, b) => {
      return new Date(b.created).getTime() - new Date(a.created).getTime();
    });
  }

  /**
   * Set active session
   *
   * @param sessionId - Session ID
   */
  async setActiveSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);

    if (!session) {
      throw new ContextError(
        `Session not found: ${sessionId}`,
        { code: 'SESSION_NOT_FOUND' }
      );
    }

    this.activeSessionId = sessionId;

    this.logger.info('Active session set', {
      sessionId,
    } as Record<string, unknown>);
  }

  /**
   * Get active session
   *
   * @returns Active session or undefined
   */
  getActiveSession(): Session | undefined {
    if (!this.activeSessionId) {
      return undefined;
    }

    return this.sessions.get(this.activeSessionId);
  }

  /**
   * Clear active session
   */
  clearActiveSession(): void {
    this.activeSessionId = null;
    this.logger.debug('Active session cleared', {} as Record<string, unknown>);
  }

  /**
   * Add message to session
   *
   * @param sessionId - Session ID
   * @param message - Message to add
   */
  async addMessage(sessionId: string, message: Session['messages'][0]): Promise<void> {
    const session = await this.getSession(sessionId);

    if (!session) {
      throw new ContextError(
        `Session not found: ${sessionId}`,
        { code: 'SESSION_NOT_FOUND' }
      );
    }

    session.messages.push(message);
    session.updated = new Date().toISOString();

    if (this.config.autoSave) {
      await this.saveSession(sessionId);
    }

    this.logger.debug('Message added to session', {
      sessionId,
      messageCount: session.messages.length,
    } as Record<string, unknown>);
  }

  /**
   * Remove message from session
   *
   * @param sessionId - Session ID
   * @param messageIndex - Message index
   */
  async removeMessage(sessionId: string, messageIndex: number): Promise<void> {
    const session = await this.getSession(sessionId);

    if (!session) {
      throw new ContextError(
        `Session not found: ${sessionId}`,
        { code: 'SESSION_NOT_FOUND' }
      );
    }

    if (messageIndex < 0 || messageIndex >= session.messages.length) {
      throw new ContextError(
        `Invalid message index: ${messageIndex}`,
        { code: 'INVALID_INDEX' }
      );
    }

    session.messages.splice(messageIndex, 1);
    session.updated = new Date().toISOString();

    if (this.config.autoSave) {
      await this.saveSession(sessionId);
    }

    this.logger.debug('Message removed from session', {
      sessionId,
      messageIndex,
    } as Record<string, unknown>);
  }

  /**
   * Clear all messages from session
   *
   * @param sessionId - Session ID
   */
  async clearMessages(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);

    if (!session) {
      throw new ContextError(
        `Session not found: ${sessionId}`,
        { code: 'SESSION_NOT_FOUND' }
      );
    }

    session.messages = [];
    session.updated = new Date().toISOString();

    if (this.config.autoSave) {
      await this.saveSession(sessionId);
    }

    this.logger.info('Session messages cleared', {
      sessionId,
    } as Record<string, unknown>);
  }

  /**
   * Update session token count
   *
   * @param sessionId - Session ID
   * @param tokens - Token count to add
   */
  async updateTokenCount(sessionId: string, tokens: number): Promise<void> {
    const session = await this.getSession(sessionId);

    if (!session) {
      throw new ContextError(
        `Session not found: ${sessionId}`,
        { code: 'SESSION_NOT_FOUND' }
      );
    }

    session.totalTokens = (session.totalTokens ?? 0) + tokens;
    session.updated = new Date().toISOString();

    if (this.config.autoSave) {
      await this.saveSession(sessionId);
    }

    this.logger.debug('Session token count updated', {
      sessionId,
      totalTokens: session.totalTokens,
    } as Record<string, unknown>);
  }

  /**
   * Load all sessions from disk
   */
  private async loadSessions(): Promise<void> {
    try {
      const files = await fs.readdir(this.config.sessionsDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));

      for (const fileName of jsonFiles) {
        try {
          const fullPath = path.join(this.config.sessionsDir, fileName);
          const content = await Bun.file(fullPath).text();
          const session = JSON.parse(content) as Session;
          this.sessions.set(session.id, session);
        } catch (error) {
          this.logger.warn('Failed to load session file', {
            fileName,
            error,
          } as Record<string, unknown>);
        }
      }

      this.logger.info('Sessions loaded', {
        count: this.sessions.size,
      } as Record<string, unknown>);
    } catch (error) {
      this.logger.warn('Failed to read sessions directory', {
        sessionsDir: this.config.sessionsDir,
        error,
      } as Record<string, unknown>);
    }
  }

  /**
   * Save session to disk
   *
   * @param sessionId - Session ID
   */
  private async saveSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new ContextError(
        `Session not found: ${sessionId}`,
        { code: 'SESSION_NOT_FOUND' }
      );
    }

    const filePath = this.getSessionFilePath(sessionId);
    const content = JSON.stringify(session, null, 2);

    await Bun.write(filePath, content);

    this.logger.debug('Session saved', {
      sessionId,
      filePath,
    } as Record<string, unknown>);
  }

  /**
   * Load session from file
   *
   * @param sessionId - Session ID
   * @returns Session or undefined
   */
  private async loadSessionFromFile(sessionId: string): Promise<Session | undefined> {
    try {
      const filePath = this.getSessionFilePath(sessionId);
      const content = await Bun.file(filePath).text();
      return JSON.parse(content) as Session;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Get file path for session
   *
   * @param sessionId - Session ID
   * @returns File path
   */
  private getSessionFilePath(sessionId: string): string {
    return `${this.config.sessionsDir}/${sessionId}.json`;
  }

  /**
   * Generate unique session ID
   *
   * @returns Session ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Clean up old sessions
   */
  async cleanupOldSessions(maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<number> {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [sessionId, session] of this.sessions) {
      const age = now - new Date(session.created).getTime();
      if (age > maxAge) {
        toDelete.push(sessionId);
      }
    }

    for (const sessionId of toDelete) {
      await this.deleteSession(sessionId);
    }

    this.logger.info('Old sessions cleaned up', {
      count: toDelete.length,
      maxAge,
    } as Record<string, unknown>);

    return toDelete.length;
  }
}

/**
 * Create session manager with default configuration
 *
 * @param sessionsDir - Path to sessions directory
 * @returns New session manager
 */
export function createSessionManager(
  sessionsDir: string = '.komplete/sessions'
): SessionManager {
  const config: SessionManagerConfig = {
    sessionsDir,
    autoSave: true,
    maxSessions: 100,
  };

  return new SessionManager(config);
}
