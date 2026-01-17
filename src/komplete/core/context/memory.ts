/**
 * Memory File Format for KOMPLETE-KONTROL CLI
 *
 * Provides .memory.md file format with frontmatter and markdown sections
 * for storing persistent memory that can be easily edited.
 * Includes file locking mechanism to prevent race conditions during concurrent access.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { ContextError } from '../../types';
import { createLogger, type ContextLogger } from '../../utils/logger';

/**
 * Memory frontmatter metadata
 */
export interface MemoryFrontmatter {
  version: string;
  created: string;
  updated: string;
  tags?: string[];
  project?: string;
}

/**
 * Memory section
 */
export interface MemorySection {
  name: string;
  content: string;
  priority?: number;
}

/**
 * Memory file data
 */
export interface MemoryFile {
  frontmatter: MemoryFrontmatter;
  sections: MemorySection[];
}

/**
 * Memory file configuration
 */
export interface MemoryFileConfig {
  filePath: string;
  autoSave: boolean;
  maxSections: number;
  lockTimeout?: number; // Maximum time to wait for lock (ms)
  lockRetryDelay?: number; // Initial delay between lock attempts (ms)
  maxLockRetries?: number; // Maximum number of lock acquisition attempts
}

/**
 * Memory file class
 */
export class MemoryFileHandler {
  private logger: ContextLogger;
  private config: MemoryFileConfig;
  private memory: MemoryFile;
  private dirty: boolean;
  private lockFilePath: string;

  constructor(config: MemoryFileConfig, logger?: ContextLogger) {
    this.config = config;
    this.logger = logger ?? createLogger('MemoryFileHandler');
    this.memory = this.createEmptyMemory();
    this.dirty = false;
    this.lockFilePath = `${config.filePath}.lock`;
    this.logger.debug('Memory file handler initialized', { config } as Record<string, unknown>);
  }

  /**
   * Acquire file lock with retry logic
   *
   * @throws ContextError if lock cannot be acquired
   */
  private async acquireLock(): Promise<void> {
    const lockTimeout = this.config.lockTimeout ?? 30000; // 30 seconds default
    const lockRetryDelay = this.config.lockRetryDelay ?? 100; // 100ms default
    const maxRetries = this.config.maxLockRetries ?? Math.ceil(lockTimeout / lockRetryDelay);
    
    const startTime = Date.now();
    let attempt = 0;

    while (attempt < maxRetries) {
      attempt++;
      
      try {
        // Try to create lock file exclusively
        const lockFd = await fs.promises.open(
          this.lockFilePath,
          fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY,
          0o600
        );

        // Write process ID to lock file
        const lockContent = JSON.stringify({
          pid: process.pid,
          timestamp: new Date().toISOString(),
          attempt,
        });
        await lockFd.writeFile(lockContent, 'utf-8');
        await lockFd.close();

        this.logger.debug('File lock acquired', {
          lockFile: this.lockFilePath,
          attempt,
          duration: Date.now() - startTime,
        } as Record<string, unknown>);
        
        return;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
          // Lock file exists, check if it's stale
          try {
            const lockContent = await fs.promises.readFile(this.lockFilePath, 'utf-8');
            const lockData = JSON.parse(lockContent);
            const lockTime = new Date(lockData.timestamp).getTime();
            const staleThreshold = 60000; // 1 minute stale threshold

            if (Date.now() - lockTime > staleThreshold) {
              // Lock is stale, remove it
              this.logger.warn('Removing stale lock file', {
                lockFile: this.lockFilePath,
                lockData,
              } as Record<string, unknown>);
              await fs.promises.unlink(this.lockFilePath);
              continue; // Retry immediately
            }
          } catch {
            // Failed to read lock file, continue retrying
          }

          // Check timeout
          if (Date.now() - startTime >= lockTimeout) {
            throw new ContextError(
              `Failed to acquire file lock after ${lockTimeout}ms. Lock file: ${this.lockFilePath}`,
              { code: 'LOCK_TIMEOUT' }
            );
          }

          // Exponential backoff
          const delay = lockRetryDelay * Math.pow(1.5, Math.min(attempt, 5));
          await this.sleep(delay);
        } else {
          // Unexpected error
          throw new ContextError(
            `Failed to acquire file lock: ${(error as Error).message}`,
            { code: 'LOCK_ERROR' }
          );
        }
      }
    }

    throw new ContextError(
      `Failed to acquire file lock after ${maxRetries} attempts`,
      { code: 'LOCK_TIMEOUT' }
    );
  }

  /**
   * Release file lock
   *
   * @throws ContextError if lock cannot be released
   */
  private async releaseLock(): Promise<void> {
    try {
      await fs.promises.unlink(this.lockFilePath);
      this.logger.debug('File lock released', { lockFile: this.lockFilePath } as Record<string, unknown>);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn('Failed to release file lock', {
          lockFile: this.lockFilePath,
          error: (error as Error).message,
        } as Record<string, unknown>);
      }
    }
  }

  /**
   * Execute operation with file lock
   *
   * @param operation - Operation to execute while holding lock
   * @returns Result of operation
   */
  private async withLock<T>(operation: () => Promise<T>): Promise<T> {
    await this.acquireLock();
    try {
      return await operation();
    } finally {
      await this.releaseLock();
    }
  }

  /**
   * Sleep for specified duration
   *
   * @param ms - Duration in milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Load memory from file
   */
  async load(): Promise<void> {
    await this.withLock(async () => {
      try {
        const content = await Bun.file(this.config.filePath).text();
        this.memory = this.parseMemory(content);
        this.dirty = false;
        this.logger.info('Memory file loaded', { filePath: this.config.filePath } as Record<string, unknown>);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          // File doesn't exist, create new
          this.memory = this.createEmptyMemory();
          this.dirty = false; // Don't mark as dirty, will be saved when sections are added
          this.logger.info('Memory file not found, creating new', {
            filePath: this.config.filePath,
          } as Record<string, unknown>);
        } else {
          this.logger.error('Failed to load memory file', {
            filePath: this.config.filePath,
            error,
          } as Record<string, unknown>);
          throw new ContextError(
            `Failed to load memory file: ${this.config.filePath}`,
            { code: 'MEMORY_LOAD_FAILED' }
          );
        }
      }
    });
  }

  /**
   * Save memory to file
   */
  async save(): Promise<void> {
    if (!this.dirty && !this.config.autoSave) {
      return;
    }

    await this.withLock(async () => {
      const content = this.serializeMemory(this.memory);
      await Bun.write(this.config.filePath, content, { createPath: true });

      this.memory.frontmatter.updated = new Date().toISOString();
      this.dirty = false;

      this.logger.debug('Memory file saved', { filePath: this.config.filePath } as Record<string, unknown>);
    });
  }

  /**
   * Add a section to memory
   *
   * @param name - Section name
   * @param content - Section content
   * @param priority - Section priority (optional)
   */
  addSection(name: string, content: string, priority: number = 0): void {
    const section: MemorySection = {
      name,
      content,
      priority,
    };

    this.memory.sections.push(section);
    this.dirty = true;

    this.logger.debug('Memory section added', { name, priority } as Record<string, unknown>);

    if (this.config.autoSave) {
      // Don't auto-save here - let caller explicitly save
      // to avoid race conditions with dirty flag
    }
  }

  /**
   * Update a section in memory
   *
   * @param name - Section name
   * @param content - New content
   * @param priority - New priority (optional)
   */
  updateSection(name: string, content: string, priority?: number): void {
    const section = this.memory.sections.find(s => s.name === name);

    if (!section) {
      throw new ContextError(
        `Section not found: ${name}`,
        { code: 'SECTION_NOT_FOUND' }
      );
    }

    section.content = content;
    if (priority !== undefined) {
      section.priority = priority;
    }

    this.dirty = true;
    this.logger.debug('Memory section updated', { name } as Record<string, unknown>);

    if (this.config.autoSave) {
      this.save().catch(error => {
        this.logger.error('Auto-save failed', { error } as Record<string, unknown>);
      });
    }
  }

  /**
   * Remove a section from memory
   *
   * @param name - Section name
   */
  removeSection(name: string): void {
    const index = this.memory.sections.findIndex(s => s.name === name);

    if (index === -1) {
      throw new ContextError(
        `Section not found: ${name}`,
        { code: 'SECTION_NOT_FOUND' }
      );
    }

    this.memory.sections.splice(index, 1);
    this.dirty = true;

    this.logger.debug('Memory section removed', { name } as Record<string, unknown>);

    if (this.config.autoSave) {
      this.save().catch(error => {
        this.logger.error('Auto-save failed', { error } as Record<string, unknown>);
      });
    }
  }

  /**
   * Get a section from memory
   *
   * @param name - Section name
   * @returns Section or undefined
   */
  getSection(name: string): MemorySection | undefined {
    return this.memory.sections.find(s => s.name === name);
  }

  /**
   * Get all sections
   *
   * @returns Array of all sections
   */
  getAllSections(): MemorySection[] {
    return [...this.memory.sections];
  }

  /**
   * Get sections sorted by priority
   *
   * @returns Array of sections sorted by priority
   */
  getSectionsByPriority(): MemorySection[] {
    return [...this.memory.sections].sort((a, b) => {
      const aPriority = a.priority ?? 0;
      const bPriority = b.priority ?? 0;
      return bPriority - aPriority;
    });
  }

  /**
   * Search sections by content
   *
   * @param query - Search query
   * @returns Matching sections
   */
  searchSections(query: string): MemorySection[] {
    const lowerQuery = query.toLowerCase();
    return this.memory.sections.filter(
      section =>
        section.name.toLowerCase().includes(lowerQuery) ||
        section.content.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Set tags
   *
   * @param tags - Array of tags
   */
  setTags(tags: string[]): void {
    this.memory.frontmatter.tags = tags;
    this.dirty = true;
  }

  /**
   * Get tags
   *
   * @returns Array of tags
   */
  getTags(): string[] {
    return this.memory.frontmatter.tags ?? [];
  }

  /**
   * Add a tag
   *
   * @param tag - Tag to add
   */
  addTag(tag: string): void {
    if (!this.memory.frontmatter.tags) {
      this.memory.frontmatter.tags = [];
    }

    if (!this.memory.frontmatter.tags.includes(tag)) {
      this.memory.frontmatter.tags.push(tag);
      this.dirty = true;
    }
  }

  /**
   * Remove a tag
   *
   * @param tag - Tag to remove
   */
  removeTag(tag: string): void {
    if (!this.memory.frontmatter.tags) {
      return;
    }

    const index = this.memory.frontmatter.tags.indexOf(tag);
    if (index !== -1) {
      this.memory.frontmatter.tags.splice(index, 1);
      this.dirty = true;
    }
  }

  /**
   * Set project name
   *
   * @param project - Project name
   */
  setProject(project: string): void {
    this.memory.frontmatter.project = project;
    this.dirty = true;
  }

  /**
   * Get project name
   *
   * @returns Project name or undefined
   */
  getProject(): string | undefined {
    return this.memory.frontmatter.project;
  }

  /**
   * Clear all sections
   */
  clearSections(): void {
    this.memory.sections = [];
    this.dirty = true;
    this.logger.debug('Memory sections cleared', {} as Record<string, unknown>);
  }

  /**
   * Get memory file data
   *
   * @returns Complete memory file data
   */
  getMemory(): MemoryFile {
    return {
      frontmatter: { ...this.memory.frontmatter },
      sections: this.memory.sections.map(s => ({ ...s })),
    };
  }

  /**
   * Check if memory has unsaved changes
   *
   * @returns True if dirty
   */
  isDirty(): boolean {
    return this.dirty;
  }

  /**
   * Update configuration
   *
   * @param config - New configuration
   */
  updateConfig(config: Partial<MemoryFileConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.debug('Memory file config updated', { config: this.config } as Record<string, unknown>);
  }

  /**
   * Get current configuration
   *
   * @returns Current configuration
   */
  getConfig(): MemoryFileConfig {
    return { ...this.config };
  }

  /**
   * Parse memory file content
   *
   * @param content - File content
   * @returns Parsed memory file
   */
  private parseMemory(content: string): MemoryFile {
    // Split frontmatter from content
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

    if (!frontmatterMatch) {
      throw new ContextError(
        'Invalid memory file format: missing frontmatter',
        { code: 'INVALID_FORMAT' }
      );
    }

    const frontmatterStr = frontmatterMatch[1] ?? '';
    const body = frontmatterMatch[2] ?? '';

    // Parse frontmatter (simple YAML-like format)
    const frontmatter = this.parseFrontmatter(frontmatterStr);

    // Parse sections
    const sections = this.parseSections(body);

    return {
      frontmatter,
      sections,
    };
  }

  /**
   * Parse frontmatter
   *
   * @param content - Frontmatter content
   * @returns Parsed frontmatter
   */
  private parseFrontmatter(content: string): MemoryFrontmatter {
    const frontmatter: MemoryFrontmatter = {
      version: '1.0',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    };

    const lines = content.trim().split('\n');

    for (const line of lines) {
      const key = line.split(':')[0];
      const valueParts = line.split(':').slice(1);
      const value = valueParts.join(':').trim();

      const trimmedKey = key?.trim() ?? '';
      if (!trimmedKey) continue;

      switch (trimmedKey) {
        case 'version':
          frontmatter.version = value;
          break;
        case 'created':
          frontmatter.created = value;
          break;
        case 'updated':
          frontmatter.updated = value;
          break;
        case 'tags':
          frontmatter.tags = value
            .split(',')
            .map(t => t.trim())
            .filter(t => t.length > 0);
          break;
        case 'project':
          frontmatter.project = value;
          break;
      }
    }

    return frontmatter;
  }

  /**
   * Parse sections from body
   *
   * @param content - Body content
   * @returns Array of sections
   */
  private parseSections(content: string): MemorySection[] {
    const sections: MemorySection[] = [];
    const sectionRegex = /^##\s+(.+?)\s*$/gm;
    const lines = content.split('\n');

    let currentSection: MemorySection | null = null;
    let currentContent: string[] = [];

    for (const line of lines) {
      const match = line.match(/^##\s+(.+?)\s*$/);

      if (match) {
        // Save previous section
        if (currentSection) {
          currentSection.content = currentContent.join('\n').trim();
          sections.push(currentSection);
        }

        // Start new section
        const priorityMatch = match[1]?.match(/\s*\[priority:\s*(\d+)\]\s*$/);
        const name = match[1]?.replace(/\s*\[priority:\s*\d+\]\s*$/, '').trim() ?? '';
        const priority = priorityMatch ? parseInt(priorityMatch[1] ?? '0', 10) : 0;

        currentSection = {
          name,
          content: '',
          priority,
        };
        currentContent = [];
      } else if (currentSection) {
        currentContent.push(line);
      }
    }

    // Save last section
    if (currentSection) {
      currentSection.content = currentContent.join('\n').trim();
      sections.push(currentSection);
    }

    return sections;
  }

  /**
   * Serialize memory file to string
   *
   * @param memory - Memory file data
   * @returns Serialized content
   */
  private serializeMemory(memory: MemoryFile): string {
    const lines: string[] = [];

    // Frontmatter
    lines.push('---');
    lines.push(`version: ${memory.frontmatter.version}`);
    lines.push(`created: ${memory.frontmatter.created}`);
    lines.push(`updated: ${memory.frontmatter.updated}`);

    if (memory.frontmatter.tags && memory.frontmatter.tags.length > 0) {
      lines.push(`tags: ${memory.frontmatter.tags.join(', ')}`);
    }

    if (memory.frontmatter.project) {
      lines.push(`project: ${memory.frontmatter.project}`);
    }

    lines.push('---');
    lines.push('');

    // Sections
    for (const section of memory.sections) {
      lines.push(`## ${section.name}${section.priority ? ` [priority:${section.priority}]` : ''}`);
      lines.push('');
      lines.push(section.content);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Create empty memory file
   *
   * @returns Empty memory file
   */
  private createEmptyMemory(): MemoryFile {
    const now = new Date().toISOString();

    return {
      frontmatter: {
        version: '1.0',
        created: now,
        updated: now,
      },
      sections: [],
    };
  }
}

/**
 * Create a memory file handler with default configuration
 *
 * @param filePath - Path to memory file
 * @returns New memory file handler
 */
export function createMemoryFileHandler(filePath: string = '.memory.md'): MemoryFileHandler {
  const config: MemoryFileConfig = {
    filePath,
    autoSave: true,
    maxSections: 100,
    lockTimeout: 30000, // 30 seconds
    lockRetryDelay: 100, // 100ms
    maxLockRetries: 300, // ~30 seconds max
  };

  return new MemoryFileHandler(config);
}

/**
 * Create a new memory file with initial content
 *
 * @param filePath - Path to memory file
 * @param project - Project name
 * @param tags - Initial tags
 * @returns New memory file handler
 */
export async function createMemoryFile(
  filePath: string = '.memory.md',
  project?: string,
  tags?: string[]
): Promise<MemoryFileHandler> {
  const handler = createMemoryFileHandler(filePath);

  if (project) {
    handler.setProject(project);
  }

  if (tags) {
    for (const tag of tags) {
      handler.addTag(tag);
    }
  }

  await handler.save();

  return handler;
}
