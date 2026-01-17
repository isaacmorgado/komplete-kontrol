/**
 * Global Type Declarations for Komplete-Kontrol
 *
 * Provides ambient type declarations for:
 * - Bun runtime compatibility
 * - Timer type for Node.js
 */

 

/**
 * Bun file reference
 */
interface BunFile {
  text(): Promise<string>;
  json<T = unknown>(): Promise<T>;
  arrayBuffer(): Promise<ArrayBuffer>;
  stream(): ReadableStream<Uint8Array>;
  exists(): Promise<boolean>;
  delete(): Promise<void>;
  size: number;
  type: string;
  lastModified: number;
}

/**
 * Bun spawn result
 */
interface BunSubprocess {
  pid: number;
  stdin: WritableStream<Uint8Array> | null;
  stdout: ReadableStream<Uint8Array> | null;
  stderr: ReadableStream<Uint8Array> | null;
  exited: Promise<number>;
  kill(signal?: number): void;
  exitCode: number | null;
  signalCode: string | null;
  killed: boolean;
}

/**
 * Bun spawn options (old style with cmd property)
 */
interface BunSpawnOptionsOld {
  cmd: string[];
  cwd?: string;
  env?: Record<string, string | undefined>;
  stdin?: 'inherit' | 'pipe' | 'ignore' | null | number | ReadableStream<Uint8Array>;
  stdout?: 'inherit' | 'pipe' | 'ignore' | null | number | WritableStream<Uint8Array>;
  stderr?: 'inherit' | 'pipe' | 'ignore' | null | number | WritableStream<Uint8Array>;
  onExit?: (
    proc: BunSubprocess,
    exitCode: number | null,
    signalCode: string | null,
    error: Error | undefined
  ) => void | Promise<void>;
}

/**
 * Bun spawn options (new style)
 */
interface BunSpawnOptions {
  cwd?: string;
  env?: Record<string, string | undefined>;
  stdin?: 'inherit' | 'pipe' | 'ignore' | null | number | ReadableStream<Uint8Array>;
  stdout?: 'inherit' | 'pipe' | 'ignore' | null | number | WritableStream<Uint8Array>;
  stderr?: 'inherit' | 'pipe' | 'ignore' | null | number | WritableStream<Uint8Array>;
  onExit?: (
    proc: BunSubprocess,
    exitCode: number | null,
    signalCode: string | null,
    error: Error | undefined
  ) => void | Promise<void>;
}

/**
 * Bun fs module interface
 */
interface BunFS {
  readdir(path: string): Promise<string[]>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, data: string | Uint8Array): Promise<void>;
  rm(path: string): Promise<void>;
  stat(path: string): Promise<{ size: number; mtime: Date; isFile(): boolean; isDirectory(): boolean }>;
  exists(path: string): Promise<boolean>;
}

/**
 * Bun global namespace
 */
declare namespace Bun {
  function file(path: string | URL): BunFile;
  function write(path: string | URL, data: string | Blob | ArrayBuffer | ArrayBufferView | Response | BunFile): Promise<number>;
  function spawn(cmd: string[], options?: BunSpawnOptions): BunSubprocess;
  function spawn(options: BunSpawnOptionsOld): BunSubprocess;
  function sleep(ms: number): Promise<void>;
  function hash(data: string | Uint8Array, seed?: number): number;

  const version: string;
  const revision: string;
  const env: Record<string, string | undefined>;
  const main: string;
  const fs: BunFS;
}

/**
 * Global Bun variable (may be undefined in Node.js)
 */
declare const Bun: typeof Bun | undefined;

/**
 * Timer type compatible with both Node.js and Bun
 */
declare type Timer = ReturnType<typeof setTimeout>;

/**
 * Module declaration for bun:sqlite (used in persistent-cache.ts)
 */
declare module 'bun:sqlite' {
  export class Database {
    constructor(filename?: string, options?: { create?: boolean; readonly?: boolean; readwrite?: boolean });
    query<Params extends Record<string, any> = Record<string, any>, ReturnType = unknown>(
      sql: string
    ): Statement<Params, ReturnType>;
    run(sql: string): void;
    exec(sql: string): void;
    close(): void;
    serialize(): Buffer;
  }

  export interface Statement<Params extends Record<string, any> = Record<string, any>, ReturnType = unknown> {
    run(params?: Params): void;
    get(params?: Params): ReturnType | null;
    all(params?: Params): ReturnType[];
    values(params?: Params): any[][];
    finalize(): void;
  }

  export default Database;
}

/**
 * Module declaration for bun (used in linter-integration.ts)
 */
declare module 'bun' {
  export const spawn: typeof Bun.spawn;
  export const file: typeof Bun.file;
  export const write: typeof Bun.write;
  export const version: string;
  export const env: Record<string, string | undefined>;
}
