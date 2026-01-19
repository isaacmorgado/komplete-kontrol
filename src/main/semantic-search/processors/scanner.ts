/**
 * Code Scanner
 * Scans directories and chunks files for embedding
 */

import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { CodeBlock } from "../types";

export interface ScanOptions {
  ignoredPatterns: string[];
  maxFileSize: number;
  extensions: string[];
}

export class CodeScanner {
  private options: ScanOptions;

  constructor(options: Partial<ScanOptions> = {}) {
    this.options = {
      ignoredPatterns: ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.git/**"],
      maxFileSize: 1024 * 1024, // 1MB
      extensions: [
        ".ts", ".tsx", ".js", ".jsx",
        ".py", ".rs", ".go", ".java",
        ".cpp", ".c", ".h", ".cs",
        ".php", ".rb", ".swift", ".kt",
      ],
      ...options,
    };
  }

  /**
   * Scan a directory for code files
   */
  async scanDirectory(dirPath: string): Promise<CodeBlock[]> {
    const blocks: CodeBlock[] = [];

    await this.scanRecursive(dirPath, blocks);

    return blocks;
  }

  private async scanRecursive(dirPath: string, blocks: CodeBlock[]): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      // Check ignored patterns
      if (this.isIgnored(fullPath)) {
        continue;
      }

      if (entry.isDirectory()) {
        await this.scanRecursive(fullPath, blocks);
      } else if (entry.isFile()) {
        const fileBlocks = await this.scanFile(fullPath);
        blocks.push(...fileBlocks);
      }
    }
  }

  private async scanFile(filePath: string): Promise<CodeBlock[]> {
    // Check extension
    const ext = path.extname(filePath);
    if (!this.options.extensions.includes(ext)) {
      return [];
    }

    // Check file size
    const stats = await fs.stat(filePath);
    if (stats.size > this.options.maxFileSize) {
      return [];
    }

    // Read file
    const content = await fs.readFile(filePath, "utf-8");
    const language = this.getLanguage(ext);

    // Chunk file
    return this.chunkContent(content, filePath, language);
  }

  private chunkContent(content: string, filePath: string, language: string): CodeBlock[] {
    const blocks: CodeBlock[] = [];
    const lines = content.split("\n");
    const chunkSize = 100; // lines per chunk
    const overlap = 10; // overlapping lines

    for (let i = 0; i < lines.length; i += chunkSize - overlap) {
      const startLine = i;
      const endLine = Math.min(i + chunkSize, lines.length);
      const chunkText = lines.slice(startLine, endLine).join("\n");
      const hash = this.hashContent(chunkText);

      blocks.push({
        filePath,
        startLine,
        endLine,
        content: chunkText,
        language,
        hash,
      });
    }

    return blocks;
  }

  private hashContent(content: string): string {
    return crypto.createHash("sha256").update(content).digest("hex");
  }

  private isIgnored(filePath: string): boolean {
    return this.options.ignoredPatterns.some((pattern) => {
      const regex = new RegExp(
        pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*")
      );
      return regex.test(filePath);
    });
  }

  private getLanguage(ext: string): string {
    const languageMap: Record<string, string> = {
      ".ts": "typescript",
      ".tsx": "typescript",
      ".js": "javascript",
      ".jsx": "javascript",
      ".py": "python",
      ".rs": "rust",
      ".go": "go",
      ".java": "java",
      ".cpp": "cpp",
      ".c": "c",
      ".h": "c",
      ".cs": "csharp",
      ".php": "php",
      ".rb": "ruby",
      ".swift": "swift",
      ".kt": "kotlin",
    };

    return languageMap[ext] || "text";
  }
}
