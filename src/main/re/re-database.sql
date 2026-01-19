-- Reverse Engineering Tools Database Schema
-- Created: 2026-01-18
-- Purpose: Store metadata for 460+ RE tools, workflows, and execution history

-- ============================================================
-- TOOLS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS tools (
  id TEXT PRIMARY KEY,                    -- e.g., 'ghidra', 'frida', 'apktool'
  name TEXT NOT NULL,                     -- Display name
  category TEXT NOT NULL,                 -- web-browser, mobile-app, binary-executable, etc.
  subcategory TEXT,                       -- decompiler, debugger, instrumentation, etc.
  binary_name TEXT,                       -- Executable name (e.g., 'ghidraRun', 'frida')
  install_method TEXT,                    -- homebrew, npm, pip, github, manual
  install_command TEXT,                   -- e.g., 'brew install ghidra'
  version_command TEXT,                   -- Command to check version
  capabilities JSON,                      -- Array of capabilities
  dependencies JSON,                      -- Required dependencies
  performance_score REAL DEFAULT 0.7,     -- 0.0-1.0 (higher is better)
  reliability_score REAL DEFAULT 0.8,     -- 0.0-1.0 (higher is better)
  popularity_score REAL DEFAULT 0.5,      -- 0.0-1.0 (higher is better)
  cost TEXT DEFAULT 'free',               -- free, paid, freemium
  platforms JSON,                         -- ['macos', 'linux', 'windows']
  documentation_url TEXT,                 -- Official docs URL
  github_url TEXT,                        -- GitHub repository
  last_updated INTEGER,                   -- Unix timestamp
  metadata JSON,                          -- Additional custom metadata
  UNIQUE(id)
);

-- Index for fast category lookups
CREATE INDEX IF NOT EXISTS idx_tools_category ON tools(category);
CREATE INDEX IF NOT EXISTS idx_tools_subcategory ON tools(subcategory);

-- ============================================================
-- WORKFLOWS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,                    -- e.g., 'android-apk-analysis'
  name TEXT NOT NULL,                     -- Display name
  description TEXT,                       -- Human-readable description
  target_type TEXT NOT NULL,              -- web-browser, mobile-app, etc.
  difficulty TEXT DEFAULT 'moderate',     -- surface, moderate, deep
  tool_chain JSON NOT NULL,               -- Ordered array of tool IDs
  parallel_steps JSON,                    -- Array of steps that can run in parallel
  estimated_duration INTEGER,             -- Estimated time in seconds
  success_rate REAL DEFAULT 0.9,          -- 0.0-1.0
  usage_count INTEGER DEFAULT 0,          -- How many times executed
  average_rating REAL,                    -- User ratings
  created_at INTEGER,                     -- Unix timestamp
  updated_at INTEGER,                     -- Unix timestamp
  author TEXT,                            -- Creator
  tags JSON,                              -- Searchable tags
  UNIQUE(id)
);

-- Index for fast target type lookups
CREATE INDEX IF NOT EXISTS idx_workflows_target_type ON workflows(target_type);
CREATE INDEX IF NOT EXISTS idx_workflows_difficulty ON workflows(difficulty);

-- ============================================================
-- RE EXECUTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS re_executions (
  id TEXT PRIMARY KEY,                    -- Unique execution ID
  workflow_id TEXT NOT NULL,              -- References workflows(id)
  target_type TEXT NOT NULL,              -- Type of target
  target_path TEXT,                       -- File path or URL
  status TEXT NOT NULL,                   -- pending, running, completed, failed
  current_step INTEGER DEFAULT 0,         -- Current step in workflow
  total_steps INTEGER,                    -- Total steps in workflow
  results JSON,                           -- Execution results
  errors JSON,                            -- Error messages
  duration_ms INTEGER,                    -- Actual execution time
  started_at INTEGER,                     -- Unix timestamp
  completed_at INTEGER,                   -- Unix timestamp
  user_rating INTEGER,                    -- 1-5 stars
  notes TEXT,                             -- User notes
  FOREIGN KEY (workflow_id) REFERENCES workflows(id)
);

-- Index for execution history queries
CREATE INDEX IF NOT EXISTS idx_executions_workflow ON re_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_executions_status ON re_executions(status);
CREATE INDEX IF NOT EXISTS idx_executions_started ON re_executions(started_at);

-- ============================================================
-- TOOL COMPATIBILITY TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS tool_compatibility (
  tool_id TEXT NOT NULL,                  -- References tools(id)
  platform TEXT NOT NULL,                 -- macos, linux, windows
  version TEXT,                           -- Specific version tested
  status TEXT NOT NULL,                   -- working, broken, untested
  notes TEXT,                             -- Compatibility notes
  tested_at INTEGER,                      -- Unix timestamp
  PRIMARY KEY (tool_id, platform),
  FOREIGN KEY (tool_id) REFERENCES tools(id)
);

-- ============================================================
-- USER PREFERENCES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS re_preferences (
  key TEXT PRIMARY KEY,                   -- Preference key
  value TEXT NOT NULL,                    -- JSON-encoded value
  updated_at INTEGER                      -- Unix timestamp
);
