/**
 * Constitutional AI Implementation
 *
 * Implements safety principles and auto-revision with max 2 iterations.
 * Ensures code quality, security, and ethical standards.
 *
 * Based on ARCHITECTURE-SYNTHESIS-ENHANCED.md: Intelligence Layer
 */

import { Logger, LoggerLike } from '../../utils/logger';

/**
 * Constitutional principle
 */
export interface ConstitutionalPrinciple {
  id: string;
  name: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  validator: (content: string) => Promise<ViolationResult>;
}

/**
 * Violation result
 */
export interface ViolationResult {
  violated: boolean;
  issues: string[];
  suggestions: string[];
  confidence: number; // 0.0-1.0
}

/**
 * Critique result
 */
export interface CritiqueResult {
  overall: 'safe' | 'needs_revision' | 'unsafe';
  violations: Map<string, ViolationResult>;
  totalIssues: number;
  criticalIssues: number;
  revisionNeeded: boolean;
}

/**
 * Revision result
 */
export interface RevisionResult {
  iteration: number;
  originalContent: string;
  revisedContent: string;
  improvementsMade: string[];
  remainingIssues: string[];
  status: 'improved' | 'no_change' | 'needs_manual_review';
}

/**
 * Constitutional AI Configuration
 */
export interface ConstitutionalAIConfig {
  maxRevisions?: number; // Max auto-revision iterations (default: 2)
  enabledPrinciples?: string[]; // Enabled principle IDs (default: all)
  strictMode?: boolean; // Fail on any violation (default: false)
}

/**
 * Constitutional AI
 *
 * Implements safety checks and auto-revision based on constitutional principles.
 */
export class ConstitutionalAI {
  private logger: LoggerLike;
  private config: Required<ConstitutionalAIConfig>;
  private principles: Map<string, ConstitutionalPrinciple> = new Map();

  constructor(config: Partial<ConstitutionalAIConfig> = {}, logger?: LoggerLike) {
    this.logger = logger ?? new Logger().child('ConstitutionalAI');
    this.config = {
      maxRevisions: config.maxRevisions ?? 2,
      enabledPrinciples: config.enabledPrinciples ?? [],
      strictMode: config.strictMode ?? false,
    };

    // Initialize default principles
    this.initializeDefaultPrinciples();

    this.logger.debug('Constitutional AI initialized', {
      maxRevisions: this.config.maxRevisions,
      principleCount: this.principles.size,
    });
  }

  /**
   * Initialize default principles
   */
  private initializeDefaultPrinciples(): void {
    // Principle 1: Security
    this.addPrinciple({
      id: 'security',
      name: 'Security',
      description: 'Code must not contain security vulnerabilities',
      severity: 'critical',
      validator: async (content: string) => {
        const issues: string[] = [];
        const suggestions: string[] = [];

        // Check for common vulnerabilities
        if (content.includes('eval(')) {
          issues.push('Usage of eval() detected - potential code injection');
          suggestions.push('Use JSON.parse() or safer alternatives');
        }

        if (content.match(/innerHTML\s*=.*\+/)) {
          issues.push('innerHTML with concatenation - XSS risk');
          suggestions.push('Use textContent or sanitize HTML input');
        }

        if (content.includes('process.env') && content.includes('console.log')) {
          issues.push('Environment variables logged - potential secret exposure');
          suggestions.push('Remove console.log statements with env vars');
        }

        return {
          violated: issues.length > 0,
          issues,
          suggestions,
          confidence: 0.9,
        };
      },
    });

    // Principle 2: Error Handling
    this.addPrinciple({
      id: 'error_handling',
      name: 'Error Handling',
      description: 'Code must have proper error handling',
      severity: 'high',
      validator: async (content: string) => {
        const issues: string[] = [];
        const suggestions: string[] = [];

        // Check for try-catch blocks in async functions
        if (content.includes('async function') || content.includes('async (')) {
          if (!content.includes('try') && !content.includes('.catch(')) {
            issues.push('Async function without error handling');
            suggestions.push('Add try-catch blocks or .catch() handlers');
          }
        }

        // Check for promises without error handling
        if (content.match(/\.then\([^)]+\)/) && !content.includes('.catch(')) {
          issues.push('Promise chain without .catch() handler');
          suggestions.push('Add .catch() to handle promise rejections');
        }

        return {
          violated: issues.length > 0,
          issues,
          suggestions,
          confidence: 0.8,
        };
      },
    });

    // Principle 3: Testing
    this.addPrinciple({
      id: 'testing',
      name: 'Testing',
      description: 'Code should include tests or test stubs',
      severity: 'medium',
      validator: async (content: string) => {
        const issues: string[] = [];
        const suggestions: string[] = [];

        // Check if this is production code (not a test file)
        if (!content.includes('.test.') && !content.includes('.spec.')) {
          // Check for exported functions without tests
          const exports = content.match(/export (function|class|const)/g);
          if (exports && exports.length > 0) {
            if (!content.includes('// TODO: Add tests')) {
              issues.push('Exported code without tests or test TODOs');
              suggestions.push('Add // TODO: Add tests comments or create test file');
            }
          }
        }

        return {
          violated: issues.length > 0,
          issues,
          suggestions,
          confidence: 0.6,
        };
      },
    });

    // Principle 4: Code Quality
    this.addPrinciple({
      id: 'code_quality',
      name: 'Code Quality',
      description: 'Code should follow quality standards',
      severity: 'medium',
      validator: async (content: string) => {
        const issues: string[] = [];
        const suggestions: string[] = [];

        // Check for any types (TypeScript)
        if (content.match(/:\s*any\b/)) {
          issues.push('Usage of "any" type - reduces type safety');
          suggestions.push('Use specific types or unknown instead of any');
        }

        // Check for console.log in production code
        if (content.includes('console.log') && !content.includes('test')) {
          issues.push('console.log statements in production code');
          suggestions.push('Use proper logging library or remove debug logs');
        }

        // Check for magic numbers
        const magicNumbers = content.match(/\b(?!0|1|2|10|100|1000)\d{3,}\b/g);
        if (magicNumbers && magicNumbers.length > 2) {
          issues.push('Magic numbers detected');
          suggestions.push('Extract magic numbers to named constants');
        }

        return {
          violated: issues.length > 0,
          issues,
          suggestions,
          confidence: 0.7,
        };
      },
    });

    // Principle 5: Documentation
    this.addPrinciple({
      id: 'documentation',
      name: 'Documentation',
      description: 'Complex functions should have documentation',
      severity: 'low',
      validator: async (content: string) => {
        const issues: string[] = [];
        const suggestions: string[] = [];

        // Check for exported functions without JSDoc
        const functionMatches = content.matchAll(/export (async )?function (\w+)/g);
        for (const match of functionMatches) {
          const functionName = match[2];
          const functionIndex = match.index ?? 0;
          const beforeFunction = content.substring(Math.max(0, functionIndex - 200), functionIndex);

          if (!beforeFunction.includes('/**')) {
            issues.push(`Function ${functionName} lacks JSDoc documentation`);
            suggestions.push('Add JSDoc comments explaining parameters and return value');
          }
        }

        return {
          violated: issues.length > 0,
          issues,
          suggestions,
          confidence: 0.5,
        };
      },
    });

    // Principle 6: Performance
    this.addPrinciple({
      id: 'performance',
      name: 'Performance',
      description: 'Code should avoid obvious performance issues',
      severity: 'medium',
      validator: async (content: string) => {
        const issues: string[] = [];
        const suggestions: string[] = [];

        // Check for nested loops
        if (content.match(/for\s*\([^)]+\)\s*{[^}]*for\s*\(/)) {
          issues.push('Nested loops detected - potential O(n²) complexity');
          suggestions.push('Consider using more efficient algorithms or data structures');
        }

        // Check for synchronous file operations
        if (content.match(/fs\.readFileSync|fs\.writeFileSync/)) {
          issues.push('Synchronous file operations - blocks event loop');
          suggestions.push('Use async file operations (readFile, writeFile)');
        }

        return {
          violated: issues.length > 0,
          issues,
          suggestions,
          confidence: 0.7,
        };
      },
    });

    // Principle 7: Type Safety
    this.addPrinciple({
      id: 'type_safety',
      name: 'Type Safety',
      description: 'Code should maintain type safety',
      severity: 'high',
      validator: async (content: string) => {
        const issues: string[] = [];
        const suggestions: string[] = [];

        // Check for @ts-ignore or @ts-nocheck
        if (content.includes('@ts-ignore') || content.includes('@ts-nocheck')) {
          issues.push('TypeScript error suppression detected');
          suggestions.push('Fix underlying type errors instead of suppressing');
        }

        // Check for type assertions without validation
        if (content.match(/as \w+/) && !content.includes('typeof')) {
          issues.push('Type assertion without runtime validation');
          suggestions.push('Add runtime type checks before assertions');
        }

        return {
          violated: issues.length > 0,
          issues,
          suggestions,
          confidence: 0.8,
        };
      },
    });

    // Principle 8: Resource Management
    this.addPrinciple({
      id: 'resource_management',
      name: 'Resource Management',
      description: 'Resources should be properly managed and cleaned up',
      severity: 'high',
      validator: async (content: string) => {
        const issues: string[] = [];
        const suggestions: string[] = [];

        // Check for event listeners without cleanup
        if (content.includes('addEventListener') && !content.includes('removeEventListener')) {
          issues.push('Event listeners without cleanup - potential memory leak');
          suggestions.push('Add removeEventListener in cleanup/unmount');
        }

        // Check for timers without cleanup
        if ((content.includes('setInterval') || content.includes('setTimeout')) && !content.includes('clear')) {
          issues.push('Timers without cleanup');
          suggestions.push('Add clearInterval/clearTimeout in cleanup');
        }

        return {
          violated: issues.length > 0,
          issues,
          suggestions,
          confidence: 0.8,
        };
      },
    });
  }

  /**
   * Add custom principle
   */
  addPrinciple(principle: ConstitutionalPrinciple): void {
    this.principles.set(principle.id, principle);
    this.logger.debug('Principle added', { id: principle.id, name: principle.name });
  }

  /**
   * Critique content against principles
   */
  async critique(content: string): Promise<CritiqueResult> {
    const violations = new Map<string, ViolationResult>();
    let totalIssues = 0;
    let criticalIssues = 0;

    // Get enabled principles
    const enabledPrinciples = this.config.enabledPrinciples.length > 0
      ? Array.from(this.principles.values()).filter(p => this.config.enabledPrinciples.includes(p.id))
      : Array.from(this.principles.values());

    // Run all validators
    for (const principle of enabledPrinciples) {
      const result = await principle.validator(content);

      if (result.violated) {
        violations.set(principle.id, result);
        totalIssues += result.issues.length;

        if (principle.severity === 'critical') {
          criticalIssues += result.issues.length;
        }
      }
    }

    // Determine overall assessment
    let overall: 'safe' | 'needs_revision' | 'unsafe';
    if (criticalIssues > 0 || (this.config.strictMode && totalIssues > 0)) {
      overall = 'unsafe';
    } else if (totalIssues > 0) {
      overall = 'needs_revision';
    } else {
      overall = 'safe';
    }

    this.logger.debug('Critique completed', {
      overall,
      totalIssues,
      criticalIssues,
      violationCount: violations.size,
    });

    return {
      overall,
      violations,
      totalIssues,
      criticalIssues,
      revisionNeeded: overall !== 'safe',
    };
  }

  /**
   * Auto-revise content (placeholder - would use AI in production)
   */
  async revise(content: string, critique: CritiqueResult, iteration: number): Promise<RevisionResult> {
    // In production, would send content + violations to AI for revision
    // For now, return a placeholder indicating revision would happen

    const improvementsMade: string[] = [];
    const remainingIssues: string[] = [];

    // Collect all suggestions
    for (const [principleId, violation] of critique.violations) {
      improvementsMade.push(...violation.suggestions);
      remainingIssues.push(...violation.issues);
    }

    this.logger.info('Revision generated', {
      iteration,
      improvementCount: improvementsMade.length,
      remainingIssueCount: remainingIssues.length,
    });

    return {
      iteration,
      originalContent: content,
      revisedContent: content, // Would be revised content in production
      improvementsMade,
      remainingIssues,
      status: iteration < this.config.maxRevisions ? 'improved' : 'needs_manual_review',
    };
  }

  /**
   * Full critique and revise cycle
   */
  async critiqueAndRevise(content: string): Promise<{
    critique: CritiqueResult;
    revisions: RevisionResult[];
    finalContent: string;
    status: 'safe' | 'revised' | 'needs_manual_review';
  }> {
    let currentContent = content;
    const revisions: RevisionResult[] = [];
    let critique = await this.critique(currentContent);

    // Auto-revise up to maxRevisions times
    let iteration = 0;
    while (critique.revisionNeeded && iteration < this.config.maxRevisions) {
      const revision = await this.revise(currentContent, critique, iteration + 1);
      revisions.push(revision);
      currentContent = revision.revisedContent;
      iteration++;

      // Re-critique revised content
      critique = await this.critique(currentContent);
    }

    // Determine final status
    let status: 'safe' | 'revised' | 'needs_manual_review';
    if (critique.overall === 'safe') {
      status = revisions.length > 0 ? 'revised' : 'safe';
    } else {
      status = 'needs_manual_review';
    }

    this.logger.info('Critique and revise cycle completed', {
      status,
      revisionCount: revisions.length,
      finalIssueCount: critique.totalIssues,
    });

    return {
      critique,
      revisions,
      finalContent: currentContent,
      status,
    };
  }

  /**
   * Get all principles
   */
  getPrinciples(): ConstitutionalPrinciple[] {
    return Array.from(this.principles.values());
  }
}

/**
 * Create Constitutional AI instance
 */
export function createConstitutionalAI(
  config?: Partial<ConstitutionalAIConfig>,
  logger?: LoggerLike
): ConstitutionalAI {
  return new ConstitutionalAI(config, logger);
}
