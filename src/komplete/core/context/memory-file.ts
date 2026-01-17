/**
 * Memory File Manager - .memory.md Institutional Memory
 *
 * Manages .memory.md file for storing:
 * - Project context
 * - Key decisions
 * - Learned patterns
 * - Architectural decisions
 * - Notes and reminders
 */

import { Logger } from '../../utils/logger';

/**
 * Memory section
 */
export interface MemorySection {
  /** Section name */
  name: string;
  /** Section priority (1-10) */
  priority: number;
  /** Section content */
  content: string;
  /** Last updated */
  updated: string;
}

/**
 * Memory file structure
 */
export interface MemoryFile {
  /** File version */
  version: string;
  /** Created timestamp */
  created: string;
  /** Last updated timestamp */
  updated: string;
  /** Sections */
  sections: MemorySection[];
}

/**
 * Memory update options
 */
export interface MemoryUpdateOptions {
  /** Append to existing content */
  append?: boolean;
  /** Update timestamp */
  updateTimestamp?: boolean;
}

/**
 * Memory File Manager
 *
 * Manages .memory.md file for institutional memory.
 */
export class MemoryFileManager {
  private logger: Logger;
  private filePath: string;
  private memory: MemoryFile | null = null;

  constructor(filePath = '.memory.md') {
    this.logger = new Logger().child('MemoryFileManager');
    this.filePath = filePath;

    this.logger.debug('MemoryFileManager initialized', { filePath });
  }

  /**
   * Load memory file
   *
   * @returns Success
   */
  async load(): Promise<boolean> {
    try {
      const file = Bun.file(this.filePath);
      const exists = await file.exists();

      if (!exists) {
        this.logger.debug('Memory file not found, creating new', {
          filePath: this.filePath,
        });
        await this.createDefault();
        return true;
      }

      const content = await file.text();
      this.memory = this.parseMemoryFile(content);

      this.logger.info('Memory file loaded', {
        filePath: this.filePath,
        sectionCount: this.memory.sections.length,
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to load memory file', {
        filePath: this.filePath,
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Save memory file
   *
   * @returns Success
   */
  async save(): Promise<boolean> {
    if (!this.memory) {
      this.logger.error('No memory loaded');
      return false;
    }

    try {
      // Update timestamp
      this.memory.updated = new Date().toISOString();

      // Generate markdown content
      const content = this.generateMarkdown(this.memory);

      // Write to file
      await Bun.write(this.filePath, content);

      this.logger.info('Memory file saved', {
        filePath: this.filePath,
        sectionCount: this.memory.sections.length,
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to save memory file', {
        filePath: this.filePath,
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Add or update section
   *
   * @param name - Section name
   * @param content - Section content
   * @param priority - Section priority (1-10)
   * @param options - Update options
   */
  async updateSection(
    name: string,
    content: string,
    priority = 5,
    options: MemoryUpdateOptions = {}
  ): Promise<void> {
    if (!this.memory) {
      await this.load();
    }

    if (!this.memory) {
      return;
    }

    const existingIndex = this.memory.sections.findIndex((s) => s.name === name);

    if (existingIndex >= 0) {
      // Update existing section
      const existing = this.memory.sections[existingIndex]!;

      if (options.append) {
        existing.content += '\n\n' + content;
      } else {
        existing.content = content;
      }

      existing.priority = priority;

      if (options.updateTimestamp !== false) {
        existing.updated = new Date().toISOString();
      }

      this.logger.debug('Section updated', { name });
    } else {
      // Add new section
      this.memory.sections.push({
        name,
        priority,
        content,
        updated: new Date().toISOString(),
      });

      this.logger.debug('Section added', { name });
    }

    await this.save();
  }

  /**
   * Get section content
   *
   * @param name - Section name
   * @returns Section content or undefined
   */
  getSection(name: string): string | undefined {
    if (!this.memory) {
      return undefined;
    }

    const section = this.memory.sections.find((s) => s.name === name);
    return section?.content;
  }

  /**
   * Get all sections
   *
   * @returns Array of sections
   */
  getAllSections(): MemorySection[] {
    return this.memory?.sections ?? [];
  }

  /**
   * Delete section
   *
   * @param name - Section name
   */
  async deleteSection(name: string): Promise<void> {
    if (!this.memory) {
      await this.load();
    }

    if (!this.memory) {
      return;
    }

    this.memory.sections = this.memory.sections.filter((s) => s.name !== name);
    this.logger.debug('Section deleted', { name });

    await this.save();
  }

  /**
   * Add note to Notes section
   *
   * @param note - Note content
   */
  async addNote(note: string): Promise<void> {
    const existingNotes = this.getSection('Notes') ?? '';
    const timestamp = new Date().toISOString();
    const newNote = `\n- [${timestamp}] ${note}`;

    await this.updateSection('Notes', existingNotes + newNote, 5);
  }

  /**
   * Add key decision
   *
   * @param decision - Decision description
   * @param rationale - Decision rationale
   */
  async addDecision(decision: string, rationale: string): Promise<void> {
    const existingDecisions = this.getSection('Key Decisions') ?? '';
    const timestamp = new Date().toISOString();
    const newDecision = `\n\n### ${decision}\n\n**Date**: ${timestamp}\n\n**Rationale**: ${rationale}`;

    await this.updateSection('Key Decisions', existingDecisions + newDecision, 10);
  }

  /**
   * Add learned pattern
   *
   * @param pattern - Pattern description
   * @param solution - Solution description
   */
  async addPattern(pattern: string, solution: string): Promise<void> {
    const existingPatterns = this.getSection('Learned Patterns') ?? '';
    const timestamp = new Date().toISOString();
    const newPattern = `\n\n### Pattern: ${pattern}\n\n**Date**: ${timestamp}\n\n**Solution**: ${solution}`;

    await this.updateSection('Learned Patterns', existingPatterns + newPattern, 8);
  }

  /**
   * Update project context
   *
   * @param context - Context description
   */
  async updateContext(context: string): Promise<void> {
    await this.updateSection('Project Context', context, 10, {
      updateTimestamp: true,
    });
  }

  /**
   * Get memory summary
   *
   * @returns Summary of memory file
   */
  getSummary(): string {
    if (!this.memory) {
      return 'No memory loaded';
    }

    const sections = this.memory.sections
      .sort((a, b) => b.priority - a.priority)
      .map((s) => {
        const lines = s.content.split('\n').length;
        return `- ${s.name} (priority: ${s.priority}, lines: ${lines})`;
      })
      .join('\n');

    return `Memory File Summary:\n\nVersion: ${this.memory.version}\nCreated: ${this.memory.created}\nUpdated: ${this.memory.updated}\nSections:\n${sections}`;
  }

  /**
   * Create default memory file
   */
  private async createDefault(): Promise<void> {
    this.memory = {
      version: '1.0',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      sections: [
        {
          name: 'Project Context',
          priority: 10,
          content: 'Describe project context here...',
          updated: new Date().toISOString(),
        },
        {
          name: 'Key Decisions',
          priority: 10,
          content: 'Document key decisions made during development...',
          updated: new Date().toISOString(),
        },
        {
          name: 'Learned Patterns',
          priority: 8,
          content: 'Document patterns and solutions learned...',
          updated: new Date().toISOString(),
        },
        {
          name: 'Notes',
          priority: 5,
          content: 'Add any notes or reminders here...',
          updated: new Date().toISOString(),
        },
      ],
    };

    await this.save();
  }

  /**
   * Parse memory file
   *
   * @param content - File content
   * @returns Parsed memory structure
   */
  private parseMemoryFile(content: string): MemoryFile {
    const lines = content.split('\n');

    // Parse frontmatter
    let version = '1.0';
    let created = new Date().toISOString();
    let updated = new Date().toISOString();

    if (lines[0] === '---') {
      const frontmatterEnd = lines.slice(1).indexOf('---') + 1;
      const frontmatter = lines.slice(1, frontmatterEnd);

      for (const line of frontmatter) {
        const [key, value] = line.split(':').map((s) => s.trim());
        if (key === 'version') version = value!;
        if (key === 'created') created = value!;
        if (key === 'updated') updated = value!;
      }

      lines.splice(0, frontmatterEnd + 2);
    }

    // Parse sections
    const sections: MemorySection[] = [];
    let currentSection: MemorySection | null = null;
    let currentContent: string[] = [];

    for (const line of lines) {
      // Check for section header (## Section Name [priority:X])
      const sectionMatch = line.match(/^##\s+(.+?)\s+\[priority:(\d+)\]/);

      if (sectionMatch) {
        // Save previous section
        if (currentSection) {
          currentSection.content = currentContent.join('\n').trim();
          sections.push(currentSection);
        }

        // Start new section
        currentSection = {
          name: sectionMatch[1]!,
          priority: parseInt(sectionMatch[2]!, 10),
          content: '',
          updated: new Date().toISOString(),
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

    return {
      version,
      created,
      updated,
      sections,
    };
  }

  /**
   * Generate markdown content
   *
   * @param memory - Memory structure
   * @returns Markdown content
   */
  private generateMarkdown(memory: MemoryFile): string {
    let content = '---\n';
    content += `version: ${memory.version}\n`;
    content += `created: ${memory.created}\n`;
    content += `updated: ${memory.updated}\n`;
    content += '---\n\n';

    // Sort sections by priority (highest first)
    const sortedSections = memory.sections.sort((a, b) => b.priority - a.priority);

    for (const section of sortedSections) {
      content += `## ${section.name} [priority:${section.priority}]\n\n`;
      content += `${section.content}\n\n`;
    }

    return content;
  }
}

/**
 * Global memory file manager instance
 */
let globalMemoryFileManager: MemoryFileManager | null = null;

/**
 * Initialize global memory file manager
 *
 * @param filePath - Path to .memory.md file
 * @returns The global memory file manager
 */
export function initMemoryFileManager(filePath?: string): MemoryFileManager {
  globalMemoryFileManager = new MemoryFileManager(filePath);
  return globalMemoryFileManager;
}

/**
 * Get global memory file manager
 *
 * @returns The global memory file manager
 */
export function getMemoryFileManager(): MemoryFileManager {
  if (!globalMemoryFileManager) {
    globalMemoryFileManager = new MemoryFileManager();
  }
  return globalMemoryFileManager;
}
