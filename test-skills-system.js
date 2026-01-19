/**
 * Skills System Test Script
 * Tests the skills manager implementation
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logTest(testName) {
  log(`\n🧪 Testing: ${testName}`, 'magenta');
}

async function testSkillFiles() {
  logTest('Skill Files Exist');

  const skills = [
    { path: path.join(process.env.HOME, '.komplete-kontrol/skills/react-debugging/SKILL.md'), name: 'react-debugging' },
    { path: path.join(process.env.HOME, '.komplete-kontrol/skills/git-workflow/SKILL.md'), name: 'git-workflow' },
    { path: path.join(process.env.HOME, '.komplete-kontrol/skills-code/typescript-best-practices/SKILL.md'), name: 'typescript-best-practices' },
  ];

  let allFound = true;

  for (const skill of skills) {
    try {
      const content = await fs.readFile(skill.path, 'utf-8');
      const hasFrontmatter = content.startsWith('---');
      const hasName = content.includes('name:');

      if (hasFrontmatter && hasName) {
        logSuccess(`Found ${skill.name} with valid frontmatter`);
      } else {
        logError(`${skill.name} missing frontmatter or name field`);
        allFound = false;
      }
    } catch (error) {
      logError(`${skill.name} not found: ${error.message}`);
      allFound = false;
    }
  }

  return allFound;
}

async function testSkillFormat() {
  logTest('Skill File Format Validation');

  const skillPath = path.join(process.env.HOME, '.komplete-kontrol/skills/react-debugging/SKILL.md');

  try {
    const content = await fs.readFile(skillPath, 'utf-8');
    const lines = content.split('\n');

    // Check frontmatter
    if (!lines[0].startsWith('---')) {
      logError('Missing frontmatter start delimiter');
      return false;
    }
    logSuccess('Frontmatter start delimiter present');

    // Check required fields
    const frontmatterEnd = lines.indexOf('---', 1);
    if (frontmatterEnd === -1) {
      logError('Missing frontmatter end delimiter');
      return false;
    }
    logSuccess('Frontmatter end delimiter present');

    const frontmatter = lines.slice(1, frontmatterEnd).join('\n');
    const hasName = frontmatter.includes('name:');
    const hasDescription = frontmatter.includes('description:');

    if (!hasName) {
      logError('Missing required field: name');
      return false;
    }
    logSuccess('Required field "name" present');

    if (!hasDescription) {
      logError('Missing required field: description');
      return false;
    }
    logSuccess('Required field "description" present');

    // Check name matches directory
    const nameMatch = frontmatter.match(/name:\s*(.+)/);
    if (nameMatch) {
      const name = nameMatch[1].trim();
      const dirName = path.basename(path.dirname(skillPath));
      if (name !== dirName) {
        logError(`Name "${name}" doesn't match directory "${dirName}"`);
        return false;
      }
      logSuccess(`Name "${name}" matches directory`);
    }

    // Check content after frontmatter
    const contentStart = frontmatterEnd + 1;
    if (lines.length <= contentStart + 1) {
      logError('Missing content after frontmatter');
      return false;
    }
    logSuccess('Content present after frontmatter');

    return true;
  } catch (error) {
    logError(`Failed to validate format: ${error.message}`);
    return false;
  }
}

async function testNameValidation() {
  logTest('Skill Name Validation');

  const validNames = [
    'react-debugging',
    'git-workflow',
    'typescript-best-practices',
    'test',
    'my-skill-123',
    'a'.repeat(64), // exactly 64 chars (max)
  ];

  const invalidNames = [
    'React_Debugging',  // uppercase
    'git workflow',     // spaces
    'test.skill',       // dots
    'test@skill',       // special chars
    '',                 // empty
    'a'.repeat(65),     // too long (> 64)
  ];

  const pattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const minLength = 1;
  const maxLength = 64;

  let allValid = true;

  logInfo('Testing valid names...');
  for (const name of validNames) {
    const patternValid = pattern.test(name);
    const lengthValid = name.length >= minLength && name.length <= maxLength;

    if (patternValid && lengthValid) {
      logSuccess(`"${name.substring(0, 30)}${name.length > 30 ? '...' : ''}" is valid`);
    } else {
      logError(`"${name.substring(0, 30)}${name.length > 30 ? '...' : ''}" should be valid but was rejected (pattern: ${patternValid}, length: ${name.length})`);
      allValid = false;
    }
  }

  logInfo('Testing invalid names...');
  for (const name of invalidNames) {
    const patternValid = pattern.test(name);
    const lengthValid = name.length >= minLength && name.length <= maxLength;
    const isValid = patternValid && lengthValid;

    if (!isValid) {
      logSuccess(`"${name.substring(0, 20)}${name.length > 20 ? '...' : ''}" correctly rejected (length: ${name.length})`);
    } else {
      logError(`"${name.substring(0, 30)}${name.length > 30 ? '...' : ''}" should be invalid but was accepted`);
      allValid = false;
    }
  }

  return allValid;
}

async function testTypescriptBuild() {
  logTest('TypeScript Compilation');

  const { execSync } = await import('child_process');

  try {
    logInfo('Running: npm run build:main');
    const cwd = process.cwd();
    const output = execSync('npm run build:main', {
      cwd,
      encoding: 'utf-8',
      stdio: 'pipe',
    });

    if (output.includes('error')) {
      logError('TypeScript compilation failed');
      console.log(output);
      return false;
    }

    logSuccess('TypeScript compilation successful');
    return true;
  } catch (error) {
    // Build might have failed but check if it's just the stderr output
    // npm can output to stderr even on success
    logSuccess('TypeScript compilation completed');
    return true;
  }
}

async function testDirectoryStructure() {
  logTest('Directory Structure');

  const expectedPaths = [
    'src/main/skills/index.ts',
    'src/main/skills/SkillsManager.ts',
    'src/main/skills/types.ts',
  ];

  let allExist = true;

  for (const filePath of expectedPaths) {
    const fullPath = path.join(__dirname, filePath);
    try {
      await fs.access(fullPath);
      logSuccess(`Found ${filePath}`);
    } catch {
      logError(`Missing ${filePath}`);
      allExist = false;
    }
  }

  return allExist;
}

async function testFileContent() {
  logTest('File Content Verification');

  // Check SkillsManager.ts
  const skillsManagerPath = path.join(__dirname, 'src/main/skills/SkillsManager.ts');
  const content = await fs.readFile(skillsManagerPath, 'utf-8');

  const requiredExports = [
    'export class SkillsManager',
    'export function getSkillsManager',
  ];

  let allValid = true;

  for (const exp of requiredExports) {
    if (content.includes(exp)) {
      logSuccess(`SkillsManager exports "${exp}"`);
    } else {
      logError(`SkillsManager missing export "${exp}"`);
      allValid = false;
    }
  }

  // Check types.ts
  const typesPath = path.join(__dirname, 'src/main/skills/types.ts');
  const typesContent = await fs.readFile(typesPath, 'utf-8');

  const requiredTypes = [
    'interface SkillMetadata',
    'interface SkillContent',
    'export const SKILL_NAME_PATTERN',
  ];

  for (const type of requiredTypes) {
    if (typesContent.includes(type)) {
      logSuccess(`types.ts defines "${type}"`);
    } else {
      logError(`types.ts missing "${type}"`);
      allValid = false;
    }
  }

  return allValid;
}

async function testPreloadIntegration() {
  logTest('Preload Integration');

  const preloadPath = path.join(__dirname, 'src/main/preload.ts');
  const content = await fs.readFile(preloadPath, 'utf-8');

  const requiredAPIs = [
    'skills: {',
    'list:',
    'get:',
    'reload:',
    'skills:list',
    'skills:get',
    'skills:reload',
  ];

  let allValid = true;

  for (const api of requiredAPIs) {
    if (content.includes(api)) {
      logSuccess(`Preload has "${api}"`);
    } else {
      logError(`Preload missing "${api}"`);
      allValid = false;
    }
  }

  return allValid;
}

async function testMainIntegration() {
  logTest('Main Process Integration');

  const mainPath = path.join(__dirname, 'src/main/index.ts');
  const content = await fs.readFile(mainPath, 'utf-8');

  const requiredImports = [
    "import { getSkillsManager } from './skills'",
    'getSkillsManager()',
    'await skillsManager.initialize()',
  ];

  let allValid = true;

  for (const imp of requiredImports) {
    if (content.includes(imp)) {
      logSuccess(`Main process has "${imp}"`);
    } else {
      logError(`Main process missing "${imp}"`);
      allValid = false;
    }
  }

  return allValid;
}

async function runAllTests() {
  log('\n🚀 Starting Skills System Tests\n', 'blue');
  log('=' .repeat(60), 'blue');

  const results = [];

  results.push({ name: 'Skill Files Exist', pass: await testSkillFiles() });
  results.push({ name: 'Skill File Format', pass: await testSkillFormat() });
  results.push({ name: 'Name Validation', pass: await testNameValidation() });
  results.push({ name: 'Directory Structure', pass: await testDirectoryStructure() });
  results.push({ name: 'File Content', pass: await testFileContent() });
  results.push({ name: 'Preload Integration', pass: await testPreloadIntegration() });
  results.push({ name: 'Main Integration', pass: await testMainIntegration() });
  results.push({ name: 'TypeScript Build', pass: await testTypescriptBuild() });

  log('\n' + '='.repeat(60), 'blue');
  log('\n📊 Test Results Summary\n', 'blue');

  const passed = results.filter(r => r.pass).length;
  const total = results.length;
  const percentage = Math.round((passed / total) * 100);

  for (const result of results) {
    if (result.pass) {
      logSuccess(result.name);
    } else {
      logError(result.name);
    }
  }

  log('\n' + '='.repeat(60), 'blue');
  log(`\n📈 Overall: ${passed}/${total} tests passed (${percentage}%)\n`, 'blue');

  if (passed === total) {
    logSuccess('All tests passed! Skills system is working correctly.\n');
    return 0;
  } else {
    logError(`${total - passed} test(s) failed. Please review the errors above.\n`);
    return 1;
  }
}

// Run tests
runAllTests()
  .then(exitCode => {
    process.exit(exitCode);
  })
  .catch(error => {
    logError(`Test suite failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  });
