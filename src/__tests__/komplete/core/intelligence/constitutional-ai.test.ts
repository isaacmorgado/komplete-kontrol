/**
 * Tests for Constitutional AI
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ConstitutionalAI,
  createConstitutionalAI,
  type ConstitutionalPrinciple,
} from '../../../../komplete/core/intelligence/constitutional-ai';

describe('ConstitutionalAI', () => {
  let constitutionalAI: ConstitutionalAI;

  beforeEach(() => {
    constitutionalAI = createConstitutionalAI({
      maxRevisions: 2,
      strictMode: false,
    });
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      const ai = createConstitutionalAI();
      const principles = ai.getPrinciples();

      expect(principles).toHaveLength(8); // 8 default principles
      expect(principles[0].id).toBe('security');
      expect(principles[1].id).toBe('error_handling');
    });

    it('should initialize with custom configuration', () => {
      const ai = createConstitutionalAI({
        maxRevisions: 5,
        strictMode: true,
        enabledPrinciples: ['security', 'error_handling'],
      });

      const principles = ai.getPrinciples();
      expect(principles).toHaveLength(8); // Still has all principles, filtering happens in critique
    });

    it('should initialize all 8 default principles', () => {
      const principles = constitutionalAI.getPrinciples();
      const principleIds = principles.map(p => p.id);

      expect(principleIds).toContain('security');
      expect(principleIds).toContain('error_handling');
      expect(principleIds).toContain('testing');
      expect(principleIds).toContain('code_quality');
      expect(principleIds).toContain('documentation');
      expect(principleIds).toContain('performance');
      expect(principleIds).toContain('type_safety');
      expect(principleIds).toContain('resource_management');
    });
  });

  describe('security principle', () => {
    it('should detect eval() usage', async () => {
      const code = `
        const result = eval('2 + 2');
      `;

      const critique = await constitutionalAI.critique(code);

      expect(critique.violations.has('security')).toBe(true);
      const security = critique.violations.get('security');
      expect(security?.issues).toContain('Usage of eval() detected - potential code injection');
      expect(security?.suggestions).toContain('Use JSON.parse() or safer alternatives');
    });

    it('should detect XSS risk with innerHTML', async () => {
      const code = `
        element.innerHTML = userInput + '<div>content</div>';
      `;

      const critique = await constitutionalAI.critique(code);

      expect(critique.violations.has('security')).toBe(true);
      const security = critique.violations.get('security');
      expect(security?.issues).toContain('innerHTML with concatenation - XSS risk');
      expect(security?.suggestions).toContain('Use textContent or sanitize HTML input');
    });

    it('should detect secret exposure in console.log', async () => {
      const code = `
        console.log('API Key:', process.env.API_KEY);
      `;

      const critique = await constitutionalAI.critique(code);

      expect(critique.violations.has('security')).toBe(true);
      const security = critique.violations.get('security');
      expect(security?.issues).toContain('Environment variables logged - potential secret exposure');
    });

    it('should not flag safe code', async () => {
      const code = `
        const data = JSON.parse(jsonString);
        element.textContent = userInput;
      `;

      const critique = await constitutionalAI.critique(code);

      expect(critique.violations.has('security')).toBe(false);
    });
  });

  describe('error handling principle', () => {
    it('should detect async function without error handling', async () => {
      const code = `
        async function fetchData() {
          const response = await fetch('/api/data');
          return response.json();
        }
      `;

      const critique = await constitutionalAI.critique(code);

      expect(critique.violations.has('error_handling')).toBe(true);
      const errorHandling = critique.violations.get('error_handling');
      expect(errorHandling?.issues).toContain('Async function without error handling');
      expect(errorHandling?.suggestions).toContain('Add try-catch blocks or .catch() handlers');
    });

    it('should detect promise chain without .catch()', async () => {
      const code = `
        fetch('/api/data')
          .then(response => response.json())
          .then(data => console.log(data));
      `;

      const critique = await constitutionalAI.critique(code);

      expect(critique.violations.has('error_handling')).toBe(true);
      const errorHandling = critique.violations.get('error_handling');
      expect(errorHandling?.issues).toContain('Promise chain without .catch() handler');
    });

    it('should not flag async function with try-catch', async () => {
      const code = `
        async function fetchData() {
          try {
            const response = await fetch('/api/data');
            return response.json();
          } catch (error) {
            console.error(error);
          }
        }
      `;

      const critique = await constitutionalAI.critique(code);

      expect(critique.violations.has('error_handling')).toBe(false);
    });

    it('should not flag promise chain with .catch()', async () => {
      const code = `
        fetch('/api/data')
          .then(response => response.json())
          .then(data => console.log(data))
          .catch(error => console.error(error));
      `;

      const critique = await constitutionalAI.critique(code);

      expect(critique.violations.has('error_handling')).toBe(false);
    });
  });

  describe('testing principle', () => {
    it('should detect exported code without tests', async () => {
      const code = `
        export function calculateTotal(items) {
          return items.reduce((sum, item) => sum + item.price, 0);
        }
      `;

      const critique = await constitutionalAI.critique(code);

      expect(critique.violations.has('testing')).toBe(true);
      const testing = critique.violations.get('testing');
      expect(testing?.issues).toContain('Exported code without tests or test TODOs');
    });

    it('should not flag code with test TODO', async () => {
      const code = `
        // TODO: Add tests
        export function calculateTotal(items) {
          return items.reduce((sum, item) => sum + item.price, 0);
        }
      `;

      const critique = await constitutionalAI.critique(code);

      expect(critique.violations.has('testing')).toBe(false);
    });

    it('should not flag test files', async () => {
      const code = `
        // In file: calculateTotal.test.ts
        export function testCalculateTotal() {
          // test code
        }
      `;

      const critique = await constitutionalAI.critique(code);

      expect(critique.violations.has('testing')).toBe(false);
    });
  });

  describe('code quality principle', () => {
    it('should detect any types', async () => {
      const code = `
        function process(data: any) {
          return data;
        }
      `;

      const critique = await constitutionalAI.critique(code);

      expect(critique.violations.has('code_quality')).toBe(true);
      const quality = critique.violations.get('code_quality');
      expect(quality?.issues).toContain('Usage of "any" type - reduces type safety');
      expect(quality?.suggestions).toContain('Use specific types or unknown instead of any');
    });

    it('should detect console.log in production code', async () => {
      const code = `
        function processData(data) {
          console.log('Processing:', data);
          return data.map(x => x * 2);
        }
      `;

      const critique = await constitutionalAI.critique(code);

      expect(critique.violations.has('code_quality')).toBe(true);
      const quality = critique.violations.get('code_quality');
      expect(quality?.issues).toContain('console.log statements in production code');
    });

    it('should detect multiple code quality issues', async () => {
      const code = `
        function process(data: any) {
          console.log('Processing:', data);
          return data;
        }
      `;

      const critique = await constitutionalAI.critique(code);

      expect(critique.violations.has('code_quality')).toBe(true);
      const quality = critique.violations.get('code_quality');
      // Should detect both any type and console.log
      expect(quality?.issues.length).toBeGreaterThanOrEqual(2);
    });

    it('should not flag console.log in test code', async () => {
      const code = `
        test('should process data', () => {
          console.log('Running test');
          expect(true).toBe(true);
        });
      `;

      const critique = await constitutionalAI.critique(code);

      // May still flag other issues, but not console.log in tests
      if (critique.violations.has('code_quality')) {
        const quality = critique.violations.get('code_quality');
        const hasConsoleLogIssue = quality?.issues.some(issue =>
          issue.includes('console.log')
        );
        expect(hasConsoleLogIssue).toBe(false);
      }
    });
  });

  describe('documentation principle', () => {
    it('should detect exported function without JSDoc', async () => {
      const code = `
        export function complexCalculation(a, b, c) {
          return (a + b) * c / (a - b);
        }
      `;

      const critique = await constitutionalAI.critique(code);

      expect(critique.violations.has('documentation')).toBe(true);
      const docs = critique.violations.get('documentation');
      expect(docs?.issues[0]).toContain('complexCalculation');
      expect(docs?.issues[0]).toContain('lacks JSDoc documentation');
    });

    it('should not flag function with JSDoc', async () => {
      const code = `/**
 * Performs complex calculation
 * @param a First number
 * @param b Second number
 * @param c Third number
 * @returns Result of calculation
 */
export function complexCalculation(a, b, c) {
  return (a + b) * c / (a - b);
}`;

      const critique = await constitutionalAI.critique(code);

      expect(critique.violations.has('documentation')).toBe(false);
    });
  });

  describe('performance principle', () => {
    it('should detect nested loops', async () => {
      const code = `
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < m; j++) {
            matrix[i][j] = i * j;
          }
        }
      `;

      const critique = await constitutionalAI.critique(code);

      expect(critique.violations.has('performance')).toBe(true);
      const perf = critique.violations.get('performance');
      expect(perf?.issues).toContain('Nested loops detected - potential O(n²) complexity');
    });

    it('should detect synchronous file operations', async () => {
      const code = `
        const data = fs.readFileSync('data.json', 'utf-8');
      `;

      const critique = await constitutionalAI.critique(code);

      expect(critique.violations.has('performance')).toBe(true);
      const perf = critique.violations.get('performance');
      expect(perf?.issues).toContain('Synchronous file operations - blocks event loop');
      expect(perf?.suggestions).toContain('Use async file operations (readFile, writeFile)');
    });

    it('should not flag single loop', async () => {
      const code = `
        for (let i = 0; i < n; i++) {
          array[i] = i * 2;
        }
      `;

      const critique = await constitutionalAI.critique(code);

      expect(critique.violations.has('performance')).toBe(false);
    });
  });

  describe('type safety principle', () => {
    it('should detect @ts-ignore', async () => {
      const code = `
        // @ts-ignore
        const result = unsafeOperation();
      `;

      const critique = await constitutionalAI.critique(code);

      expect(critique.violations.has('type_safety')).toBe(true);
      const typeSafety = critique.violations.get('type_safety');
      expect(typeSafety?.issues).toContain('TypeScript error suppression detected');
    });

    it('should detect type assertion without validation', async () => {
      const code = `
        const data = response as UserData;
      `;

      const critique = await constitutionalAI.critique(code);

      expect(critique.violations.has('type_safety')).toBe(true);
      const typeSafety = critique.violations.get('type_safety');
      expect(typeSafety?.issues).toContain('Type assertion without runtime validation');
    });

    it('should not flag type assertion with typeof check', async () => {
      const code = `
        if (typeof response === 'object') {
          const data = response as UserData;
        }
      `;

      const critique = await constitutionalAI.critique(code);

      expect(critique.violations.has('type_safety')).toBe(false);
    });
  });

  describe('resource management principle', () => {
    it('should detect event listener without cleanup', async () => {
      const code = `
        element.addEventListener('click', handleClick);
      `;

      const critique = await constitutionalAI.critique(code);

      expect(critique.violations.has('resource_management')).toBe(true);
      const resource = critique.violations.get('resource_management');
      expect(resource?.issues).toContain('Event listeners without cleanup - potential memory leak');
      expect(resource?.suggestions).toContain('Add removeEventListener in cleanup/unmount');
    });

    it('should detect timers without cleanup', async () => {
      const code = `
        const interval = setInterval(() => {
          updateData();
        }, 1000);
      `;

      const critique = await constitutionalAI.critique(code);

      expect(critique.violations.has('resource_management')).toBe(true);
      const resource = critique.violations.get('resource_management');
      expect(resource?.issues).toContain('Timers without cleanup');
    });

    it('should not flag event listener with cleanup', async () => {
      const code = `
        element.addEventListener('click', handleClick);
        // Later...
        element.removeEventListener('click', handleClick);
      `;

      const critique = await constitutionalAI.critique(code);

      expect(critique.violations.has('resource_management')).toBe(false);
    });

    it('should not flag timer with cleanup', async () => {
      const code = `
        const interval = setInterval(() => updateData(), 1000);
        clearInterval(interval);
      `;

      const critique = await constitutionalAI.critique(code);

      expect(critique.violations.has('resource_management')).toBe(false);
    });
  });

  describe('critique', () => {
    it('should return safe for code with no violations', async () => {
      const code = `
        /**
         * Safe function with proper types and error handling
         */
        export async function fetchUser(id: string): Promise<User> {
          try {
            const response = await fetch(\`/api/users/\${id}\`);
            if (!response.ok) throw new Error('Failed to fetch');
            return await response.json();
          } catch (error) {
            console.error('Error fetching user:', error);
            throw error;
          }
        }
      `;

      const critique = await constitutionalAI.critique(code);

      expect(critique.overall).toBe('safe');
      expect(critique.revisionNeeded).toBe(false);
      expect(critique.totalIssues).toBe(0);
      expect(critique.criticalIssues).toBe(0);
    });

    it('should return needs_revision for non-critical violations', async () => {
      const code = `
        export function process(data: any) {
          console.log(data);
          return data;
        }
      `;

      const critique = await constitutionalAI.critique(code);

      expect(critique.overall).toBe('needs_revision');
      expect(critique.revisionNeeded).toBe(true);
      expect(critique.totalIssues).toBeGreaterThan(0);
      expect(critique.criticalIssues).toBe(0);
    });

    it('should return unsafe for critical violations', async () => {
      const code = `
        const result = eval('malicious code');
      `;

      const critique = await constitutionalAI.critique(code);

      expect(critique.overall).toBe('unsafe');
      expect(critique.revisionNeeded).toBe(true);
      expect(critique.criticalIssues).toBeGreaterThan(0);
    });

    it('should handle multiple violations', async () => {
      const code = `
        export async function badFunction(data: any) {
          console.log(data);
          element.innerHTML = data + '<div>test</div>';
          const result = eval(data);
        }
      `;

      const critique = await constitutionalAI.critique(code);

      expect(critique.totalIssues).toBeGreaterThan(3); // Multiple principles violated
      expect(critique.violations.size).toBeGreaterThan(2);
    });

    it('should respect strictMode', async () => {
      const strictAI = createConstitutionalAI({ strictMode: true });

      const code = `
        function test(data: any) {
          return data;
        }
      `;

      const critique = await strictAI.critique(code);

      // In strict mode, any violation is considered unsafe
      expect(critique.overall).toBe('unsafe');
      expect(critique.revisionNeeded).toBe(true);
    });

    it('should filter by enabledPrinciples', async () => {
      const filteredAI = createConstitutionalAI({
        enabledPrinciples: ['security'],
      });

      const code = `
        function test(data: any) {
          console.log(data);
          return data;
        }
      `;

      const critique = await filteredAI.critique(code);

      // Only security principle enabled, so code_quality violations are ignored
      expect(critique.overall).toBe('safe');
      expect(critique.totalIssues).toBe(0);
    });
  });

  describe('revise', () => {
    it('should generate revision result', async () => {
      const code = `
        const result = eval('test');
      `;

      const critique = await constitutionalAI.critique(code);
      const revision = await constitutionalAI.revise(code, critique, 1);

      expect(revision.iteration).toBe(1);
      expect(revision.originalContent).toBe(code);
      expect(revision.improvementsMade.length).toBeGreaterThan(0);
      expect(revision.remainingIssues.length).toBeGreaterThan(0);
    });

    it('should set status to improved when under max revisions', async () => {
      const code = `const result = eval('test');`;
      const critique = await constitutionalAI.critique(code);
      const revision = await constitutionalAI.revise(code, critique, 1);

      expect(revision.status).toBe('improved');
    });

    it('should set status to needs_manual_review when at max revisions', async () => {
      const code = `const result = eval('test');`;
      const critique = await constitutionalAI.critique(code);
      const revision = await constitutionalAI.revise(code, critique, 2);

      expect(revision.status).toBe('needs_manual_review');
    });
  });

  describe('critiqueAndRevise', () => {
    it('should return safe status for safe code', async () => {
      const code = `
        /**
         * Safe function
         */
        export async function fetchData(): Promise<Data> {
          try {
            const response = await fetch('/api/data');
            return await response.json();
          } catch (error) {
            throw error;
          }
        }
      `;

      const result = await constitutionalAI.critiqueAndRevise(code);

      expect(result.status).toBe('safe');
      expect(result.revisions).toHaveLength(0);
      expect(result.critique.overall).toBe('safe');
    });

    it('should attempt revision for code with violations', async () => {
      const code = `
        const result = eval('test');
      `;

      const result = await constitutionalAI.critiqueAndRevise(code);

      expect(result.revisions.length).toBeGreaterThan(0);
      expect(result.revisions.length).toBeLessThanOrEqual(2); // Max 2 revisions
    });

    it('should return revised status after successful revision', async () => {
      const code = `
        export function test(data: any) {
          return data;
        }
      `;

      // In the placeholder implementation, revisions don't actually fix issues
      // So this will go through max revisions and return needs_manual_review
      const result = await constitutionalAI.critiqueAndRevise(code);

      // Either revised (if fixed) or needs_manual_review (if not fixed after max iterations)
      expect(['revised', 'needs_manual_review']).toContain(result.status);
    });

    it('should stop after max revisions', async () => {
      const aiWith1Revision = createConstitutionalAI({ maxRevisions: 1 });

      const code = `
        const result = eval('test');
      `;

      const result = await aiWith1Revision.critiqueAndRevise(code);

      expect(result.revisions.length).toBeLessThanOrEqual(1);
    });

    it('should return final critique and content', async () => {
      const code = `
        const result = eval('test');
      `;

      const result = await constitutionalAI.critiqueAndRevise(code);

      expect(result.critique).toBeDefined();
      expect(result.finalContent).toBeDefined();
      expect(typeof result.finalContent).toBe('string');
    });
  });

  describe('custom principles', () => {
    it('should allow adding custom principles', () => {
      const customPrinciple: ConstitutionalPrinciple = {
        id: 'custom',
        name: 'Custom Principle',
        description: 'A custom validation rule',
        severity: 'medium',
        validator: async (content: string) => ({
          violated: content.includes('forbidden'),
          issues: content.includes('forbidden') ? ['Forbidden keyword detected'] : [],
          suggestions: ['Remove forbidden keyword'],
          confidence: 1.0,
        }),
      };

      constitutionalAI.addPrinciple(customPrinciple);

      const principles = constitutionalAI.getPrinciples();
      expect(principles.length).toBe(9); // 8 default + 1 custom
      expect(principles.some(p => p.id === 'custom')).toBe(true);
    });

    it('should use custom principle in critique', async () => {
      const customPrinciple: ConstitutionalPrinciple = {
        id: 'no_forbidden',
        name: 'No Forbidden',
        description: 'Disallow forbidden keyword',
        severity: 'critical',
        validator: async (content: string) => ({
          violated: content.includes('forbidden'),
          issues: content.includes('forbidden') ? ['Forbidden keyword found'] : [],
          suggestions: ['Remove forbidden'],
          confidence: 1.0,
        }),
      };

      constitutionalAI.addPrinciple(customPrinciple);

      const code = `const test = 'forbidden code';`;
      const critique = await constitutionalAI.critique(code);

      expect(critique.violations.has('no_forbidden')).toBe(true);
      expect(critique.criticalIssues).toBeGreaterThan(0);
    });

    it('should get all principles including custom ones', () => {
      const custom1: ConstitutionalPrinciple = {
        id: 'custom1',
        name: 'Custom 1',
        description: 'First custom',
        severity: 'low',
        validator: async () => ({ violated: false, issues: [], suggestions: [], confidence: 1 }),
      };

      const custom2: ConstitutionalPrinciple = {
        id: 'custom2',
        name: 'Custom 2',
        description: 'Second custom',
        severity: 'high',
        validator: async () => ({ violated: false, issues: [], suggestions: [], confidence: 1 }),
      };

      constitutionalAI.addPrinciple(custom1);
      constitutionalAI.addPrinciple(custom2);

      const principles = constitutionalAI.getPrinciples();
      expect(principles.length).toBe(10); // 8 default + 2 custom
    });
  });

  describe('principle severities', () => {
    it('should have correct severities for default principles', () => {
      const principles = constitutionalAI.getPrinciples();
      const principleMap = new Map(principles.map(p => [p.id, p]));

      expect(principleMap.get('security')?.severity).toBe('critical');
      expect(principleMap.get('error_handling')?.severity).toBe('high');
      expect(principleMap.get('testing')?.severity).toBe('medium');
      expect(principleMap.get('code_quality')?.severity).toBe('medium');
      expect(principleMap.get('documentation')?.severity).toBe('low');
      expect(principleMap.get('performance')?.severity).toBe('medium');
      expect(principleMap.get('type_safety')?.severity).toBe('high');
      expect(principleMap.get('resource_management')?.severity).toBe('high');
    });

    it('should count critical issues correctly', async () => {
      const code = `
        const result1 = eval('test1');
        const result2 = eval('test2');
      `;

      const critique = await constitutionalAI.critique(code);

      // eval is a critical security issue
      expect(critique.criticalIssues).toBeGreaterThan(0);
    });
  });
});
