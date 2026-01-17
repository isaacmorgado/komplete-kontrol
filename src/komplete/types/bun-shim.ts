/**
 * Bun Shim for Node.js Compatibility
 *
 * This file provides fallback implementations for Bun-specific APIs
 * when running in Node.js environment.
 *
 * Type declarations for Bun are in globals.d.ts
 */

import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { spawn, type SpawnOptions, type ChildProcess } from 'node:child_process';

/**
 * Check if we're running in Bun environment
 */
export function isBun(): boolean {
  return typeof globalThis.Bun !== 'undefined';
}

/**
 * Read a file as text (Bun-compatible)
 */
export async function readFile(filePath: string): Promise<string> {
  if (isBun()) {
    return Bun!.file(filePath).text();
  }
  return fsp.readFile(filePath, 'utf-8');
}

/**
 * Read a file as JSON (Bun-compatible)
 */
export async function readFileAsJson<T>(filePath: string): Promise<T> {
  if (isBun()) {
    return Bun!.file(filePath).json();
  }
  const content = await fsp.readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Write a file (Bun-compatible)
 */
export async function writeFile(filePath: string, data: string | Uint8Array): Promise<void> {
  if (isBun()) {
    await Bun!.write(filePath, data);
    return;
  }
  // Ensure directory exists
  const dir = path.dirname(filePath);
  await fsp.mkdir(dir, { recursive: true });
  await fsp.writeFile(filePath, data);
}

/**
 * Check if a file exists (Bun-compatible)
 */
export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

/**
 * Spawn a process (Bun-compatible interface)
 */
export function spawnProcess(
  cmd: string[],
  options: {
    cwd?: string;
    env?: Record<string, string>;
  } = {}
): {
  process: ChildProcess;
  exited: Promise<number>;
  kill: (signal?: NodeJS.Signals) => void;
} {
  const [command, ...args] = cmd;
  const spawnOptions: SpawnOptions = {
    cwd: options.cwd,
    env: options.env ? { ...process.env, ...options.env } : process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  };

  const proc = spawn(command, args, spawnOptions);

  const exited = new Promise<number>((resolve, reject) => {
    proc.on('exit', (code) => resolve(code ?? 0));
    proc.on('error', reject);
  });

  return {
    process: proc,
    exited,
    kill: (signal?: NodeJS.Signals) => {
      proc.kill(signal);
    },
  };
}

/**
 * Timer type for Node.js (compatible with Bun's Timer)
 */
export type Timer = ReturnType<typeof setTimeout>;

export default {
  isBun,
  readFile,
  readFileAsJson,
  writeFile,
  fileExists,
  spawnProcess,
};
