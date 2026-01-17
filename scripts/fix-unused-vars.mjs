#!/usr/bin/env node
/**
 * Script to fix unused variable errors in TypeScript files
 *
 * This script parses TypeScript error output and automatically:
 * - Removes unused imports (TS6133 for imports, TS6196 for type imports, TS6192 for all unused)
 * - Prefixes unused parameters with underscore
 * - Prefixes unused local variables with underscore
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

// Get the TypeScript errors
let buildOutput;
try {
  buildOutput = execSync('npm run build:main 2>&1', { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }).toString();
} catch (e) {
  // TypeScript exits with non-zero when there are errors - that's expected
  buildOutput = e.stdout || '';
}

// Parse errors
const errorRegex = /^(src\/komplete\/[^(]+)\((\d+),(\d+)\): error (TS\d+): '([^']+)' is declared but (its value is never read|never used)/gm;
const allUnusedRegex = /^(src\/komplete\/[^(]+)\((\d+),(\d+)\): error TS6192: All imports in import declaration are unused/gm;

const fileErrors = new Map(); // Map<filePath, Array<{line, col, varName, errorType}>>

let match;
while ((match = errorRegex.exec(buildOutput)) !== null) {
  const [, filePath, line, col, errorCode, varName] = match;
  if (!fileErrors.has(filePath)) {
    fileErrors.set(filePath, []);
  }
  fileErrors.get(filePath).push({
    line: parseInt(line),
    col: parseInt(col),
    varName,
    errorCode,
  });
}

while ((match = allUnusedRegex.exec(buildOutput)) !== null) {
  const [, filePath, line, col] = match;
  if (!fileErrors.has(filePath)) {
    fileErrors.set(filePath, []);
  }
  fileErrors.get(filePath).push({
    line: parseInt(line),
    col: parseInt(col),
    varName: null,
    errorCode: 'TS6192',
  });
}

console.log(`Found ${Array.from(fileErrors.values()).flat().length} errors in ${fileErrors.size} files`);

// Process each file
for (const [filePath, errors] of fileErrors) {
  console.log(`Processing ${filePath} (${errors.length} errors)`);

  const fullPath = filePath;
  let content = readFileSync(fullPath, 'utf-8');
  const lines = content.split('\n');

  // Sort errors by line number descending so we can process from bottom to top
  errors.sort((a, b) => b.line - a.line);

  // Track which lines have been modified to avoid double-processing
  const modifiedLines = new Set();

  for (const error of errors) {
    const lineIndex = error.line - 1;

    if (modifiedLines.has(lineIndex)) continue;

    const line = lines[lineIndex];

    if (error.errorCode === 'TS6192') {
      // All imports unused - comment out or remove the entire line
      lines[lineIndex] = `// UNUSED: ${line}`;
      modifiedLines.add(lineIndex);
      continue;
    }

    const varName = error.varName;

    // Check if this is an import line
    if (line.includes('import ')) {
      // Handle different import patterns

      // Pattern: import { A, B, C } from '...'
      // Pattern: import { type A, B } from '...'
      const importMatch = line.match(/import\s+(?:type\s+)?{([^}]+)}/);
      if (importMatch) {
        const imports = importMatch[1];
        // Remove the specific import
        const patterns = [
          new RegExp(`\\btype\\s+${varName}\\b,?\\s*`, 'g'),  // type VarName,
          new RegExp(`\\b${varName}\\b,?\\s*`, 'g'),          // VarName,
          new RegExp(`,?\\s*\\btype\\s+${varName}\\b`, 'g'),  // , type VarName
          new RegExp(`,?\\s*\\b${varName}\\b`, 'g'),          // , VarName
        ];

        let newImports = imports;
        for (const pattern of patterns) {
          const before = newImports;
          newImports = newImports.replace(pattern, '');
          if (newImports !== before) break;
        }

        // Clean up extra commas and spaces
        newImports = newImports.replace(/,\s*,/g, ',').replace(/^\s*,\s*/, '').replace(/\s*,\s*$/, '').trim();

        if (newImports === '') {
          // All imports removed - comment out the line
          lines[lineIndex] = `// UNUSED: ${line}`;
        } else {
          // Replace imports
          lines[lineIndex] = line.replace(importMatch[1], newImports);
        }
        modifiedLines.add(lineIndex);
        continue;
      }

      // Pattern: import Name from '...'
      const defaultImportMatch = line.match(/import\s+(\w+)\s+from/);
      if (defaultImportMatch && defaultImportMatch[1] === varName) {
        lines[lineIndex] = `// UNUSED: ${line}`;
        modifiedLines.add(lineIndex);
        continue;
      }
    }

    // Check if this is a function parameter - prefix with underscore
    // Pattern: function foo(param: type) or (param: type) =>
    const paramPatterns = [
      new RegExp(`\\(([^)]*?)\\b${varName}\\b(\\s*[,:)])`, 'g'),
      new RegExp(`\\{([^}]*?)\\b${varName}\\b(\\s*[,:}])`, 'g'),  // destructuring
    ];

    let modified = false;
    for (const pattern of paramPatterns) {
      if (pattern.test(line) && !line.includes(`_${varName}`)) {
        lines[lineIndex] = line.replace(new RegExp(`\\b${varName}\\b`, 'g'), `_${varName}`);
        modifiedLines.add(lineIndex);
        modified = true;
        break;
      }
    }
    if (modified) continue;

    // Check if it's a local variable declaration - prefix with underscore
    // Pattern: const/let/var name =
    const varDeclMatch = line.match(new RegExp(`(const|let|var)\\s+(\\{[^}]*)?\\b${varName}\\b`));
    if (varDeclMatch && !line.includes(`_${varName}`)) {
      lines[lineIndex] = line.replace(new RegExp(`\\b${varName}\\b`), `_${varName}`);
      modifiedLines.add(lineIndex);
      continue;
    }

    // Fallback: just prefix with underscore
    if (!line.includes(`_${varName}`) && line.includes(varName)) {
      lines[lineIndex] = line.replace(new RegExp(`\\b${varName}\\b`), `_${varName}`);
      modifiedLines.add(lineIndex);
    }
  }

  writeFileSync(fullPath, lines.join('\n'));
}

console.log('Done! Run npm run build to verify.');
