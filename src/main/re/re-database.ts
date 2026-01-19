/**
 * RE Database Manager
 * SQLite database for reverse engineering tools, workflows, and execution history
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

export interface RETool {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  binary_name?: string;
  install_method?: string;
  install_command?: string;
  version_command?: string;
  capabilities?: string[];
  dependencies?: string[];
  performance_score?: number;
  reliability_score?: number;
  popularity_score?: number;
  cost?: string;
  platforms?: string[];
  documentation_url?: string;
  github_url?: string;
  last_updated?: number;
  metadata?: Record<string, any>;
}

export interface REWorkflow {
  id: string;
  name: string;
  description?: string;
  target_type: string;
  difficulty?: string;
  tool_chain: string[];
  parallel_steps?: number[][];
  estimated_duration?: number;
  success_rate?: number;
  usage_count?: number;
  average_rating?: number;
  created_at?: number;
  updated_at?: number;
  author?: string;
  tags?: string[];
}

export interface REExecution {
  id: string;
  workflow_id: string;
  target_type: string;
  target_path?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  current_step?: number;
  total_steps?: number;
  results?: any;
  errors?: any;
  duration_ms?: number;
  started_at?: number;
  completed_at?: number;
  user_rating?: number;
  notes?: string;
}

export class REDatabase {
  private db: Database.Database;
  private dbPath: string;

  constructor(customPath?: string) {
    const userDataPath = app.getPath('userData');
    this.dbPath = customPath || path.join(userDataPath, 're-tools.db');

    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Initialize database
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL'); // Performance optimization
    this.initializeSchema();
  }

  private initializeSchema(): void {
    const schemaPath = path.join(__dirname, 're-database.sql');

    // Check if schema file exists
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf-8');
      this.db.exec(schema);
    } else {
      console.warn('RE database schema file not found, creating basic schema');
      this.createBasicSchema();
    }
  }

  private createBasicSchema(): void {
    // Fallback schema creation
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tools (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        subcategory TEXT,
        binary_name TEXT,
        capabilities JSON,
        platforms JSON,
        github_url TEXT,
        metadata JSON
      );

      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        target_type TEXT NOT NULL,
        tool_chain JSON NOT NULL,
        difficulty TEXT DEFAULT 'moderate'
      );

      CREATE TABLE IF NOT EXISTS re_executions (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        target_type TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at INTEGER
      );
    `);
  }

  // ============================================================
  // TOOL OPERATIONS
  // ============================================================

  insertTool(tool: RETool): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO tools (
        id, name, category, subcategory, binary_name, install_method,
        install_command, version_command, capabilities, dependencies,
        performance_score, reliability_score, popularity_score, cost,
        platforms, documentation_url, github_url, last_updated, metadata
      ) VALUES (
        @id, @name, @category, @subcategory, @binary_name, @install_method,
        @install_command, @version_command, @capabilities, @dependencies,
        @performance_score, @reliability_score, @popularity_score, @cost,
        @platforms, @documentation_url, @github_url, @last_updated, @metadata
      )
    `);

    stmt.run({
      ...tool,
      capabilities: tool.capabilities ? JSON.stringify(tool.capabilities) : null,
      dependencies: tool.dependencies ? JSON.stringify(tool.dependencies) : null,
      platforms: tool.platforms ? JSON.stringify(tool.platforms) : null,
      metadata: tool.metadata ? JSON.stringify(tool.metadata) : null,
      last_updated: tool.last_updated || Date.now()
    });
  }

  getToolsByCategory(category: string): RETool[] {
    const stmt = this.db.prepare('SELECT * FROM tools WHERE category = ?');
    const rows = stmt.all(category) as any[];
    return rows.map(this.deserializeTool);
  }

  getToolById(id: string): RETool | null {
    const stmt = this.db.prepare('SELECT * FROM tools WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.deserializeTool(row) : null;
  }

  searchTools(query: string): RETool[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tools
      WHERE name LIKE ? OR category LIKE ? OR subcategory LIKE ?
    `);
    const pattern = `%${query}%`;
    const rows = stmt.all(pattern, pattern, pattern) as any[];
    return rows.map(this.deserializeTool);
  }

  private deserializeTool(row: any): RETool {
    return {
      ...row,
      capabilities: row.capabilities ? JSON.parse(row.capabilities) : undefined,
      dependencies: row.dependencies ? JSON.parse(row.dependencies) : undefined,
      platforms: row.platforms ? JSON.parse(row.platforms) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    };
  }

  // ============================================================
  // WORKFLOW OPERATIONS
  // ============================================================

  insertWorkflow(workflow: REWorkflow): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO workflows (
        id, name, description, target_type, difficulty, tool_chain,
        parallel_steps, estimated_duration, success_rate, usage_count,
        average_rating, created_at, updated_at, author, tags
      ) VALUES (
        @id, @name, @description, @target_type, @difficulty, @tool_chain,
        @parallel_steps, @estimated_duration, @success_rate, @usage_count,
        @average_rating, @created_at, @updated_at, @author, @tags
      )
    `);

    stmt.run({
      ...workflow,
      tool_chain: JSON.stringify(workflow.tool_chain),
      parallel_steps: workflow.parallel_steps ? JSON.stringify(workflow.parallel_steps) : null,
      tags: workflow.tags ? JSON.stringify(workflow.tags) : null,
      created_at: workflow.created_at || Date.now(),
      updated_at: workflow.updated_at || Date.now()
    });
  }

  getWorkflowsByTargetType(targetType: string): REWorkflow[] {
    const stmt = this.db.prepare('SELECT * FROM workflows WHERE target_type = ?');
    const rows = stmt.all(targetType) as any[];
    return rows.map(this.deserializeWorkflow);
  }

  getWorkflowById(id: string): REWorkflow | null {
    const stmt = this.db.prepare('SELECT * FROM workflows WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.deserializeWorkflow(row) : null;
  }

  private deserializeWorkflow(row: any): REWorkflow {
    return {
      ...row,
      tool_chain: JSON.parse(row.tool_chain),
      parallel_steps: row.parallel_steps ? JSON.parse(row.parallel_steps) : undefined,
      tags: row.tags ? JSON.parse(row.tags) : undefined
    };
  }

  // ============================================================
  // EXECUTION OPERATIONS
  // ============================================================

  createExecution(execution: Omit<REExecution, 'id'>): string {
    const id = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const stmt = this.db.prepare(`
      INSERT INTO re_executions (
        id, workflow_id, target_type, target_path, status,
        current_step, total_steps, results, errors, duration_ms,
        started_at, completed_at, user_rating, notes
      ) VALUES (
        @id, @workflow_id, @target_type, @target_path, @status,
        @current_step, @total_steps, @results, @errors, @duration_ms,
        @started_at, @completed_at, @user_rating, @notes
      )
    `);

    stmt.run({
      id,
      ...execution,
      results: execution.results ? JSON.stringify(execution.results) : null,
      errors: execution.errors ? JSON.stringify(execution.errors) : null,
      started_at: execution.started_at || Date.now()
    });

    return id;
  }

  updateExecution(id: string, updates: Partial<REExecution>): void {
    const fields = Object.keys(updates).filter(k => k !== 'id');
    const setClause = fields.map(f => `${f} = @${f}`).join(', ');

    const stmt = this.db.prepare(`
      UPDATE re_executions SET ${setClause} WHERE id = @id
    `);

    const params: any = { id };
    fields.forEach(field => {
      const value = (updates as any)[field];
      params[field] = (field === 'results' || field === 'errors') && value
        ? JSON.stringify(value)
        : value;
    });

    stmt.run(params);
  }

  getExecutionById(id: string): REExecution | null {
    const stmt = this.db.prepare('SELECT * FROM re_executions WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.deserializeExecution(row) : null;
  }

  getRecentExecutions(limit = 50): REExecution[] {
    const stmt = this.db.prepare(`
      SELECT * FROM re_executions
      ORDER BY started_at DESC
      LIMIT ?
    `);
    const rows = stmt.all(limit) as any[];
    return rows.map(this.deserializeExecution);
  }

  private deserializeExecution(row: any): REExecution {
    return {
      ...row,
      results: row.results ? JSON.parse(row.results) : undefined,
      errors: row.errors ? JSON.parse(row.errors) : undefined
    };
  }

  // ============================================================
  // UTILITY
  // ============================================================

  close(): void {
    this.db.close();
  }

  getStats(): { tools: number; workflows: number; executions: number } {
    const tools = (this.db.prepare('SELECT COUNT(*) as count FROM tools').get() as any).count;
    const workflows = (this.db.prepare('SELECT COUNT(*) as count FROM workflows').get() as any).count;
    const executions = (this.db.prepare('SELECT COUNT(*) as count FROM re_executions').get() as any).count;

    return { tools, workflows, executions };
  }
}

// Singleton instance
let dbInstance: REDatabase | null = null;

export function getREDatabase(): REDatabase {
  if (!dbInstance) {
    dbInstance = new REDatabase();
  }
  return dbInstance;
}

export function closeREDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
