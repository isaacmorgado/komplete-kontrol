#!/usr/bin/env node
/**
 * Seed RE database - Simple JavaScript version
 */

const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs');

// Database path
const dbPath = path.join(__dirname, 'maestro-re.db');

console.log('🌱 Seeding RE database...');
console.log('📍 Database:', dbPath);

// Create database
const db = new Database(dbPath);

// Read schema
const schemaPath = path.join(__dirname, 'src/main/re/re-database.sql');
const schema = fs.readFileSync(schemaPath, 'utf-8');

// Execute schema
console.log('📝 Creating tables...');
db.exec(schema);

// Insert essential tools
console.log('🔧 Adding tools...');

const tools = [
  {
    id: 'apktool',
    name: 'APKTool',
    category: 'mobile-app',
    subcategory: 'decompiler',
    binary_name: 'apktool',
    install_method: 'homebrew',
    install_command: 'brew install apktool',
    version_command: 'apktool --version',
    capabilities: JSON.stringify(['decompile', 'disassemble', 'rebuild']),
    performance_score: 0.90,
    reliability_score: 0.95,
    popularity_score: 0.90
  },
  {
    id: 'frida',
    name: 'Frida',
    category: 'mobile-app',
    subcategory: 'instrumentation',
    binary_name: 'frida',
    install_method: 'pip',
    install_command: 'pip install frida-tools',
    version_command: 'frida --version',
    capabilities: JSON.stringify(['dynamic-analysis', 'hooking', 'instrumentation']),
    performance_score: 0.85,
    reliability_score: 0.85,
    popularity_score: 0.95
  },
  {
    id: 'ghidra',
    name: 'Ghidra',
    category: 'binary-executable',
    subcategory: 'decompiler',
    binary_name: 'ghidraRun',
    install_method: 'manual',
    install_command: 'Download from https://ghidra-sre.org',
    version_command: null,
    capabilities: JSON.stringify(['decompile', 'disassemble', 'analyze']),
    performance_score: 0.70,
    reliability_score: 0.95,
    popularity_score: 0.95
  },
  {
    id: 'radare2',
    name: 'Radare2',
    category: 'binary-executable',
    subcategory: 'disassembler',
    binary_name: 'radare2',
    install_method: 'homebrew',
    install_command: 'brew install radare2',
    version_command: 'radare2 -v',
    capabilities: JSON.stringify(['disassemble', 'debug', 'analyze']),
    performance_score: 0.90,
    reliability_score: 0.85,
    popularity_score: 0.85
  },
  {
    id: 'mitmproxy',
    name: 'mitmproxy',
    category: 'network-api',
    subcategory: 'proxy',
    binary_name: 'mitmproxy',
    install_method: 'homebrew',
    install_command: 'brew install mitmproxy',
    version_command: 'mitmproxy --version',
    capabilities: JSON.stringify(['intercept', 'modify', 'analyze']),
    performance_score: 0.90,
    reliability_score: 0.90,
    popularity_score: 0.85
  },
  {
    id: 'playwright',
    name: 'Playwright',
    category: 'web-browser',
    subcategory: 'automation',
    binary_name: 'playwright',
    install_method: 'npm',
    install_command: 'npm install -g playwright',
    version_command: 'npx playwright --version',
    capabilities: JSON.stringify(['scrape', 'automate', 'screenshot']),
    performance_score: 0.95,
    reliability_score: 0.95,
    popularity_score: 0.90
  }
];

const insertTool = db.prepare(`
  INSERT OR REPLACE INTO tools (
    id, name, category, subcategory, binary_name, install_method,
    install_command, version_command, capabilities,
    performance_score, reliability_score, popularity_score
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

for (const tool of tools) {
  insertTool.run(
    tool.id,
    tool.name,
    tool.category,
    tool.subcategory,
    tool.binary_name,
    tool.install_method,
    tool.install_command,
    tool.version_command,
    tool.capabilities,
    tool.performance_score,
    tool.reliability_score,
    tool.popularity_score
  );
}

// Insert workflows
console.log('📋 Adding workflows...');

const workflows = [
  {
    id: 'android-apk-analysis',
    name: 'Android APK Analysis',
    description: 'Complete APK reverse engineering workflow',
    target_type: 'mobile-app',
    tool_chain: JSON.stringify(['apktool', 'frida']),
    parallel_steps: JSON.stringify([[0], [1]]),
    success_rate: 0.95
  },
  {
    id: 'binary-malware-analysis',
    name: 'Binary Malware Analysis',
    description: 'Analyze suspicious binaries',
    target_type: 'binary',
    tool_chain: JSON.stringify(['ghidra', 'radare2']),
    parallel_steps: JSON.stringify([[0], [1]]),
    success_rate: 0.90
  },
  {
    id: 'web-app-analysis',
    name: 'Web App Analysis',
    description: 'Scrape and analyze web applications',
    target_type: 'web-app',
    tool_chain: JSON.stringify(['playwright', 'mitmproxy']),
    parallel_steps: JSON.stringify([[0], [1]]),
    success_rate: 0.92
  }
];

const insertWorkflow = db.prepare(`
  INSERT OR REPLACE INTO workflows (
    id, name, description, target_type, tool_chain, parallel_steps, success_rate
  ) VALUES (?, ?, ?, ?, ?, ?, ?)
`);

for (const workflow of workflows) {
  insertWorkflow.run(
    workflow.id,
    workflow.name,
    workflow.description,
    workflow.target_type,
    workflow.tool_chain,
    workflow.parallel_steps,
    workflow.success_rate
  );
}

// Get stats
const stats = db.prepare('SELECT COUNT(*) as count FROM tools').get();
const workflowStats = db.prepare('SELECT COUNT(*) as count FROM workflows').get();

console.log(`✅ Database seeding complete`);
console.log(`📊 ${stats.count} tools, ${workflowStats.count} workflows`);

db.close();
