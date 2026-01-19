/**
 * Unit Tests: Code Scanner
 */

import { describe, it, expect, beforeEach } from "vitest";
import { CodeScanner } from "../../../../main/semantic-search/processors/scanner";
import { CodeBlock } from "../../../../main/semantic-search/types";
import fs from "fs/promises";
import path from "path";

describe("CodeScanner", () => {
  let scanner: CodeScanner;
  let testDir: string;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = `/tmp/test-scan-${Date.now()}`;
    await fs.mkdir(testDir, { recursive: true });
    scanner = new CodeScanner();
  });

  it("should scan directory for code files", async () => {
    // Create test files
    await fs.mkdir(path.join(testDir, "src"), { recursive: true });
    await fs.writeFile(
      path.join(testDir, "src", "test.ts"),
      `function test() {\n  return true;\n}`
    );

    const blocks = await scanner.scanDirectory(testDir);

    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks[0].filePath).toContain("test.ts");
    expect(blocks[0].language).toBe("typescript");
  });

  it("should respect ignore patterns", async () => {
    await fs.mkdir(path.join(testDir, "node_modules"), { recursive: true });
    await fs.mkdir(path.join(testDir, "src"), { recursive: true });

    await fs.writeFile(
      path.join(testDir, "node_modules", "dep.ts"),
      "const x = 1;"
    );
    await fs.writeFile(
      path.join(testDir, "src", "app.ts"),
      "const y = 2;"
    );

    const blocks = await scanner.scanDirectory(testDir);

    // Should only find src/app.ts, not node_modules/dep.ts
    expect(blocks.every((b) => !b.filePath.includes("node_modules"))).toBe(true);
    expect(blocks.some((b) => b.filePath.includes("src"))).toBe(true);
  });

  it("should chunk large files", async () => {
    const longFile = Array(200).fill("const line = 1;").join("\n");
    await fs.writeFile(path.join(testDir, "large.ts"), longFile);

    const blocks = await scanner.scanDirectory(testDir);

    expect(blocks.length).toBeGreaterThan(1);
    expect(blocks[0].content).toBeDefined();
  });

  it("should detect language correctly", async () => {
    const testCases = [
      { file: "test.ts", lang: "typescript" },
      { file: "test.py", lang: "python" },
      { file: "test.js", lang: "javascript" },
      { file: "test.rs", lang: "rust" },
      { file: "test.go", lang: "go" },
    ];

    for (const tc of testCases) {
      await fs.writeFile(path.join(testDir, tc.file), "test content");
    }

    const blocks = await scanner.scanDirectory(testDir);

    for (const tc of testCases) {
      const block = blocks.find((b) => b.filePath.endsWith(tc.file));
      expect(block?.language).toBe(tc.lang);
    }
  });

  it("should skip non-code files", async () => {
    await fs.writeFile(path.join(testDir, "test.txt"), "text content");
    await fs.writeFile(path.join(testDir, "test.md"), "# Markdown");
    await fs.writeFile(path.join(testDir, "test.json"), '{"key": "value"}');

    const blocks = await scanner.scanDirectory(testDir);

    expect(blocks.length).toBe(0);
  });

  it("should skip files exceeding max size", async () => {
    const scanner = new CodeScanner({ maxFileSize: 100 });
    const largeContent = "x".repeat(200);

    await fs.writeFile(path.join(testDir, "large.ts"), largeContent);

    const blocks = await scanner.scanDirectory(testDir);

    expect(blocks.length).toBe(0);
  });

  it("should generate consistent hashes for same content", async () => {
    const content = "function test() { return true; }";
    await fs.writeFile(path.join(testDir, "file1.ts"), content);
    await fs.writeFile(path.join(testDir, "file2.ts"), content);

    const blocks = await scanner.scanDirectory(testDir);

    const hashes = blocks.map((b) => b.hash);
    expect(hashes[0]).toBe(hashes[1]);
  });
});
