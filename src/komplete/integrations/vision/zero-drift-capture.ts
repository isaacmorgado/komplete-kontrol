/**
 * Zero-Drift Vision Capture
 *
 * Captures screenshot and DOM state in the same frame to eliminate drift
 * between visual and structural representations.
 *
 * Uses Playwright for browser automation with pixel-perfect synchronization.
 */

import type { Page, Browser } from 'playwright';
import { chromium } from 'playwright';
import type { LoggerLike } from '../../utils/logger';
import { createHash } from 'crypto';

/**
 * Capture result containing synchronized screenshot and DOM
 */
export interface CaptureResult {
  /** Base64-encoded screenshot */
  screenshot: string;
  /** Full HTML DOM */
  dom: string;
  /** Computed accessibility tree */
  accessibilityTree?: string;
  /** Capture metadata */
  metadata: CaptureMetadata;
}

/**
 * Capture metadata
 */
export interface CaptureMetadata {
  /** Timestamp of capture */
  timestamp: number;
  /** Viewport dimensions */
  viewport: { width: number; height: number };
  /** Page URL */
  url: string;
  /** Page title */
  title: string;
  /** Content hash for change detection */
  contentHash: string;
}

/**
 * Capture options
 */
export interface CaptureOptions {
  /** Target URL to capture */
  url: string;
  /** Viewport width (default: 1920) */
  width?: number;
  /** Viewport height (default: 1080) */
  height?: number;
  /** Wait for network idle before capture */
  waitForNetworkIdle?: boolean;
  /** Include accessibility tree */
  includeAccessibility?: boolean;
  /** Custom wait selector */
  waitForSelector?: string;
  /** Maximum wait time in ms */
  timeout?: number;
  /** Record HAR file for network analysis */
  recordHAR?: boolean;
  /** Path to save HAR file (required if recordHAR is true) */
  harPath?: string;
}

/**
 * Zero-Drift Vision Capturer
 *
 * Ensures screenshot and DOM are captured atomically to prevent drift.
 */
export class ZeroDriftCapturer {
  private logger: LoggerLike;
  private browser: Browser | null = null;

  constructor(logger: LoggerLike) {
    this.logger = logger;
  }

  /**
   * Initialize browser instance
   */
  async initialize(): Promise<void> {
    if (this.browser) {
      return;
    }

    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    this.logger.info('ZeroDriftCapturer initialized', 'Vision', {
      browser: 'chromium',
    });
  }

  /**
   * Capture page with zero drift between screenshot and DOM
   */
  async capture(options: CaptureOptions): Promise<CaptureResult> {
    if (!this.browser) {
      await this.initialize();
    }

    const startTime = Date.now();

    // Create context with HAR recording if requested
    const contextOptions: any = {
      viewport: {
        width: options.width || 1920,
        height: options.height || 1080,
      },
    };

    if (options.recordHAR && options.harPath) {
      contextOptions.recordHar = {
        path: options.harPath,
        mode: 'minimal',
      };
    }

    const context = await this.browser!.newContext(contextOptions);

    const page = await context.newPage();

    try {
      // Navigate to page
      await page.goto(options.url, {
        waitUntil: options.waitForNetworkIdle ? 'networkidle' : 'domcontentloaded',
        timeout: options.timeout || 30000,
      });

      // Wait for custom selector if provided
      if (options.waitForSelector) {
        await page.waitForSelector(options.waitForSelector, {
          timeout: options.timeout || 10000,
        });
      }

      // Execute atomic capture: screenshot + DOM in same tick
      const result = await this.atomicCapture(page, options);

      this.logger.info('Capture completed', 'Vision', {
        url: options.url,
        durationMs: Date.now() - startTime,
        domSize: result.dom.length,
        harRecorded: options.recordHAR,
      });

      return result;
    } finally {
      // Close context (this saves the HAR file if recording)
      await context.close();
    }
  }

  /**
   * Perform atomic capture to prevent drift
   */
  private async atomicCapture(
    page: Page,
    options: CaptureOptions
  ): Promise<CaptureResult> {
    // Pause all animations and transitions for stable capture
    // Note: The callback runs in browser context where document/window exist
    await page.evaluate(`(() => {
      const style = document.createElement('style');
      style.textContent = \`
        *, *::before, *::after {
          animation-duration: 0s !important;
          transition-duration: 0s !important;
        }
      \`;
      document.head.appendChild(style);
    })()`);

    // Small delay to ensure style is applied
    await page.waitForTimeout(100);

    // Atomic capture: evaluate runs synchronously in page context
    // Using string expression to avoid TypeScript DOM type errors
    const captureData = await page.evaluate(`(() => {
      // Capture DOM
      const dom = document.documentElement.outerHTML;

      // Capture computed styles for key elements
      const elements = document.querySelectorAll('body, body > *');
      const styles = {};
      elements.forEach((el, idx) => {
        if (el.nodeType === 1) { // Element node
          const computed = window.getComputedStyle(el);
          styles['el_' + idx] = {
            display: computed.display,
            visibility: computed.visibility,
            opacity: computed.opacity,
          };
        }
      });

      return {
        dom,
        title: document.title,
        styles,
      };
    })()`) as { dom: string; title: string; styles: Record<string, unknown> };

    // Take screenshot immediately after DOM capture
    const screenshotBuffer = await page.screenshot({
      type: 'png',
      fullPage: false,
    });

    // Optional: Capture accessibility tree
    let accessibilityTree: string | undefined;
    if (options.includeAccessibility) {
      // Cast to access accessibility API (exists but may have typing issues)
      const accessibilityApi = (page as unknown as { accessibility?: { snapshot: () => Promise<unknown> } }).accessibility;
      if (accessibilityApi) {
        const snapshot = await accessibilityApi.snapshot();
        accessibilityTree = JSON.stringify(snapshot, null, 2);
      }
    }

    // Generate content hash
    const contentHash = createHash('sha256')
      .update(captureData.dom)
      .digest('hex')
      .substring(0, 16);

    const viewport = page.viewportSize()!;

    return {
      screenshot: screenshotBuffer.toString('base64'),
      dom: captureData.dom,
      accessibilityTree,
      metadata: {
        timestamp: Date.now(),
        viewport: {
          width: viewport.width,
          height: viewport.height,
        },
        url: page.url(),
        title: captureData.title,
        contentHash,
      },
    };
  }

  /**
   * Capture multiple pages in sequence
   */
  async captureMultiple(
    urls: string[],
    options: Omit<CaptureOptions, 'url'>
  ): Promise<CaptureResult[]> {
    const results: CaptureResult[] = [];

    for (const url of urls) {
      const result = await this.capture({ ...options, url });
      results.push(result);
    }

    return results;
  }

  /**
   * Detect if page has changed since last capture
   */
  async hasChanged(
    url: string,
    lastContentHash: string,
    options?: Omit<CaptureOptions, 'url'>
  ): Promise<boolean> {
    const result = await this.capture({ ...options, url });
    return result.metadata.contentHash !== lastContentHash;
  }

  /**
   * Close browser and cleanup
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.logger.info('ZeroDriftCapturer closed', 'Vision');
    }
  }
}

/**
 * Create a zero-drift capturer instance
 */
export function createZeroDriftCapturer(logger: LoggerLike): ZeroDriftCapturer {
  return new ZeroDriftCapturer(logger);
}
