/**
 * DOM Extraction and Quality Scoring
 *
 * Extracts meaningful content from DOM with quality assessment.
 * Scores elements based on content richness, semantic value, and accessibility.
 */

import type { LoggerLike } from '../../utils/logger';

/**
 * Extracted element with quality score
 */
export interface ExtractedElement {
  /** Element selector */
  selector: string;
  /** Element type (heading, paragraph, button, etc.) */
  type: string;
  /** Text content */
  text: string;
  /** HTML content */
  html: string;
  /** Computed quality score (0-100) */
  qualityScore: number;
  /** Element metadata */
  metadata: ElementMetadata;
}

/**
 * Element metadata
 */
export interface ElementMetadata {
  /** Element tag name */
  tagName: string;
  /** CSS classes */
  classes: string[];
  /** Accessibility attributes */
  aria: Record<string, string>;
  /** Position in viewport */
  position: { x: number; y: number; width: number; height: number };
  /** Visibility */
  visible: boolean;
  /** Interactive (clickable, focusable) */
  interactive: boolean;
  /** Semantic role */
  role?: string;
}

/**
 * Quality scoring factors
 */
export interface QualityFactors {
  /** Content length score (0-100) */
  contentLength: number;
  /** Semantic value score (0-100) */
  semantic: number;
  /** Accessibility score (0-100) */
  accessibility: number;
  /** Position/visibility score (0-100) */
  position: number;
  /** Interactive elements score (0-100) */
  interactivity: number;
}

/**
 * Extraction options
 */
export interface ExtractionOptions {
  /** Minimum quality score threshold (0-100) */
  minQuality?: number;
  /** Include invisible elements */
  includeHidden?: boolean;
  /** Maximum elements to extract */
  maxElements?: number;
  /** Focus on specific element types */
  focusTypes?: string[];
}

/**
 * Extraction result
 */
export interface ExtractionResult {
  /** Extracted elements sorted by quality */
  elements: ExtractedElement[];
  /** Overall page quality score */
  pageQuality: number;
  /** Extraction metadata */
  metadata: {
    totalElements: number;
    extractedCount: number;
    averageQuality: number;
    timestamp: number;
  };
}

/**
 * DOM Extractor with Quality Scoring
 */
export class DOMExtractor {
  private logger: LoggerLike;

  constructor(logger: LoggerLike) {
    this.logger = logger;
  }

  /**
   * Extract elements from DOM HTML string
   */
  async extract(
    domHtml: string,
    options: ExtractionOptions = {}
  ): Promise<ExtractionResult> {
    const startTime = Date.now();

    // Parse DOM (in Node.js, we'd use jsdom or similar)
    // For now, this is a template - actual parsing would use jsdom or cheerio
    const elements = await this.parseAndExtract(domHtml, options);

    // Sort by quality score
    elements.sort((a, b) => b.qualityScore - a.qualityScore);

    // Apply limit
    const maxElements = options.maxElements || elements.length;
    const limited = elements.slice(0, maxElements);

    // Calculate page quality
    const pageQuality = this.calculatePageQuality(limited);

    this.logger.info('DOM extraction completed', 'Vision', {
      totalElements: elements.length,
      extracted: limited.length,
      pageQuality,
      durationMs: Date.now() - startTime,
    });

    return {
      elements: limited,
      pageQuality,
      metadata: {
        totalElements: elements.length,
        extractedCount: limited.length,
        averageQuality: this.average(limited.map((e) => e.qualityScore)),
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Parse DOM and extract meaningful elements
   */
  private async parseAndExtract(
    domHtml: string,
    options: ExtractionOptions
  ): Promise<ExtractedElement[]> {
    // This is a simplified implementation
    // In production, use jsdom or cheerio for actual DOM parsing

    const elements: ExtractedElement[] = [];
    const minQuality = options.minQuality || 0;

    // Extract semantic elements (headings, paragraphs, buttons, links, etc.)
    const semanticTags = [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'p',
      'button',
      'a',
      'nav',
      'header',
      'footer',
      'article',
      'section',
      'main',
      'aside',
      'form',
      'input',
      'select',
      'textarea',
      'label',
    ];

    // Simple regex-based extraction (replace with proper DOM parser)
    for (const tag of semanticTags) {
      if (options.focusTypes && !options.focusTypes.includes(tag)) {
        continue;
      }

      const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
      let match;

      while ((match = regex.exec(domHtml)) !== null) {
        const html = match[0];
        const text = this.extractText(html);

        if (!text.trim()) continue;

        const element: ExtractedElement = {
          selector: this.generateSelector(tag, elements.length),
          type: tag,
          text,
          html,
          qualityScore: 0,
          metadata: {
            tagName: tag,
            classes: this.extractClasses(html),
            aria: this.extractAria(html),
            position: { x: 0, y: 0, width: 0, height: 0 },
            visible: !html.includes('display: none') && !html.includes('visibility: hidden'),
            interactive: ['button', 'a', 'input', 'select', 'textarea'].includes(tag),
            role: this.extractRole(html),
          },
        };

        // Calculate quality score
        element.qualityScore = this.calculateQuality(element);

        if (element.qualityScore >= minQuality) {
          elements.push(element);
        }
      }
    }

    return elements;
  }

  /**
   * Calculate quality score for an element
   */
  private calculateQuality(element: ExtractedElement): number {
    const factors: QualityFactors = {
      contentLength: this.scoreContentLength(element.text),
      semantic: this.scoreSemanticValue(element.type, element.metadata),
      accessibility: this.scoreAccessibility(element.metadata),
      position: this.scorePosition(element.metadata),
      interactivity: this.scoreInteractivity(element.metadata),
    };

    // Weighted average
    const weights = {
      contentLength: 0.2,
      semantic: 0.3,
      accessibility: 0.2,
      position: 0.15,
      interactivity: 0.15,
    };

    const score =
      factors.contentLength * weights.contentLength +
      factors.semantic * weights.semantic +
      factors.accessibility * weights.accessibility +
      factors.position * weights.position +
      factors.interactivity * weights.interactivity;

    return Math.min(100, Math.max(0, Math.round(score)));
  }

  /**
   * Score content length (longer = better, up to a point)
   */
  private scoreContentLength(text: string): number {
    const length = text.trim().length;
    if (length === 0) return 0;
    if (length < 10) return 20;
    if (length < 50) return 50;
    if (length < 200) return 80;
    return 100;
  }

  /**
   * Score semantic value based on tag and attributes
   */
  private scoreSemanticValue(type: string, metadata: ElementMetadata): number {
    const semanticScores: Record<string, number> = {
      h1: 100,
      h2: 90,
      h3: 80,
      main: 95,
      article: 90,
      nav: 85,
      header: 80,
      footer: 70,
      section: 75,
      button: 85,
      a: 70,
      p: 60,
      form: 80,
      input: 75,
    };

    let score = semanticScores[type] || 50;

    // Boost for semantic role
    if (metadata.role) {
      score += 10;
    }

    return Math.min(100, score);
  }

  /**
   * Score accessibility (ARIA attributes, labels, etc.)
   */
  private scoreAccessibility(metadata: ElementMetadata): number {
    let score = 50;

    // Boost for ARIA attributes
    const ariaKeys = Object.keys(metadata.aria);
    score += ariaKeys.length * 10;

    // Boost for role
    if (metadata.role) {
      score += 15;
    }

    // Interactive elements should have accessibility
    if (metadata.interactive) {
      if (ariaKeys.length === 0) {
        score -= 20; // Penalty for no ARIA
      }
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Score position/visibility
   */
  private scorePosition(metadata: ElementMetadata): number {
    if (!metadata.visible) return 0;

    // In a real implementation, use actual position data
    // Higher score for elements in main viewport
    return metadata.visible ? 80 : 0;
  }

  /**
   * Score interactivity
   */
  private scoreInteractivity(metadata: ElementMetadata): number {
    return metadata.interactive ? 100 : 50;
  }

  /**
   * Calculate overall page quality
   */
  private calculatePageQuality(elements: ExtractedElement[]): number {
    if (elements.length === 0) return 0;

    const topElements = elements.slice(0, Math.min(20, elements.length));
    return this.average(topElements.map((e) => e.qualityScore));
  }

  // Helper methods

  private extractText(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim();
  }

  private extractClasses(html: string): string[] {
    const match = html.match(/class="([^"]*)"/);
    return match ? match[1].split(/\s+/).filter(Boolean) : [];
  }

  private extractAria(html: string): Record<string, string> {
    const aria: Record<string, string> = {};
    const ariaRegex = /aria-([a-z]+)="([^"]*)"/g;
    let match;

    while ((match = ariaRegex.exec(html)) !== null) {
      aria[match[1]] = match[2];
    }

    return aria;
  }

  private extractRole(html: string): string | undefined {
    const match = html.match(/role="([^"]*)"/);
    return match ? match[1] : undefined;
  }

  private generateSelector(tag: string, index: number): string {
    return `${tag}:nth-of-type(${index + 1})`;
  }

  private average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  }
}

/**
 * Create a DOM extractor instance
 */
export function createDOMExtractor(logger: LoggerLike): DOMExtractor {
  return new DOMExtractor(logger);
}
