/**
 * Vision Workflow Integration
 *
 * Provides unified workflows that combine vision capture, screenshot-to-code,
 * and network analysis capabilities for complete web analysis.
 */

import type { LoggerLike } from '../utils/logger';
import type { AIProvider } from '../types';
import { ZeroDriftCapturer, type CaptureOptions, type CaptureResult } from './vision/zero-drift-capture';
import { ScreenshotToCodeConverter, type GenerateCodeOptions, type CodeGenerationResult } from './screenshot-to-code/converter';
import { HARAnalyzer, type AnalysisOptions, type NetworkAnalysis } from './network/har-analyzer';

/**
 * Complete web page analysis result
 */
export interface WebPageAnalysis {
  /** Vision capture result */
  capture: CaptureResult;
  /** Generated code (if requested) */
  code?: CodeGenerationResult;
  /** Network analysis (if HAR provided) */
  network?: NetworkAnalysis;
  /** Analysis metadata */
  metadata: {
    /** Total analysis duration */
    totalDurationMs: number;
    /** Timestamp */
    timestamp: number;
  };
}

/**
 * Web page analysis options
 */
export interface WebPageAnalysisOptions {
  /** URL to analyze */
  url: string;
  /** Capture options */
  capture?: Partial<CaptureOptions>;
  /** Code generation options (if desired) */
  generateCode?: GenerateCodeOptions;
  /** HAR file path for network analysis (optional) */
  harFilePath?: string;
  /** Network analysis options */
  networkAnalysis?: Partial<AnalysisOptions>;
}

/**
 * Vision Workflow Manager
 *
 * Orchestrates vision capture, code generation, and network analysis workflows.
 */
export class VisionWorkflow {
  private logger: LoggerLike;
  private provider?: AIProvider;
  private capture: ZeroDriftCapturer;
  private codeConverter?: ScreenshotToCodeConverter;
  private networkAnalyzer: HARAnalyzer;

  constructor(logger: LoggerLike, provider?: AIProvider) {
    this.logger = logger;
    this.provider = provider;
    this.capture = new ZeroDriftCapturer(logger);
    if (provider) {
      this.codeConverter = new ScreenshotToCodeConverter(provider, logger);
    }
    this.networkAnalyzer = new HARAnalyzer(logger);
  }

  /**
   * Analyze a complete web page
   *
   * Captures screenshot, optionally generates code, and analyzes network traffic.
   */
  async analyzeWebPage(options: WebPageAnalysisOptions): Promise<WebPageAnalysis> {
    const startTime = Date.now();

    this.logger.info('Starting web page analysis', 'VisionWorkflow', {
      url: options.url,
      generateCode: !!options.generateCode,
      analyzeNetwork: !!options.harFilePath,
    });

    // Step 1: Capture screenshot and DOM
    const captureResult = await this.capture.capture(options.url, options.capture);

    const result: WebPageAnalysis = {
      capture: captureResult,
      metadata: {
        totalDurationMs: 0,
        timestamp: Date.now(),
      },
    };

    // Step 2: Generate code if requested
    if (options.generateCode && this.codeConverter) {
      this.logger.info('Generating code from screenshot', 'VisionWorkflow');
      result.code = await this.codeConverter.generateCodeFromCapture(
        captureResult,
        options.generateCode
      );
    }

    // Step 3: Analyze network traffic if HAR provided
    if (options.harFilePath) {
      this.logger.info('Analyzing network traffic', 'VisionWorkflow', {
        harPath: options.harFilePath,
      });
      result.network = await this.networkAnalyzer.analyzeHAR(
        options.harFilePath,
        options.networkAnalysis
      );
    }

    result.metadata.totalDurationMs = Date.now() - startTime;

    this.logger.info('Web page analysis completed', 'VisionWorkflow', {
      totalDurationMs: result.metadata.totalDurationMs,
      capturedElements: captureResult.dom.totalElements,
      codeGenerated: !!result.code,
      networkAnalyzed: !!result.network,
    });

    return result;
  }

  /**
   * Screenshot-to-code workflow
   *
   * Captures a screenshot and converts it to code in one step.
   */
  async screenshotToCode(
    url: string,
    codeOptions: GenerateCodeOptions,
    captureOptions?: Partial<CaptureOptions>
  ): Promise<{
    capture: CaptureResult;
    code: CodeGenerationResult;
  }> {
    if (!this.codeConverter) {
      throw new Error('AI provider required for screenshot-to-code workflow');
    }

    this.logger.info('Starting screenshot-to-code workflow', 'VisionWorkflow', {
      url,
      stack: codeOptions.stack,
    });

    // Capture screenshot
    const capture = await this.capture.capture(url, captureOptions);

    // Generate code
    const code = await this.codeConverter.generateCodeFromCapture(capture, codeOptions);

    this.logger.info('Screenshot-to-code workflow completed', 'VisionWorkflow', {
      codeLength: code.code.length,
    });

    return { capture, code };
  }

  /**
   * Network capture workflow
   *
   * Captures both screenshot and network traffic simultaneously.
   * Requires browser to save HAR file during navigation.
   */
  async captureWithNetwork(
    url: string,
    harOutputPath: string,
    options?: {
      capture?: Partial<CaptureOptions>;
      network?: Partial<AnalysisOptions>;
    }
  ): Promise<{
    capture: CaptureResult;
    network: NetworkAnalysis;
  }> {
    this.logger.info('Starting capture with network workflow', 'VisionWorkflow', {
      url,
      harOutputPath,
    });

    // Capture screenshot with HAR recording
    const captureOptions: CaptureOptions = {
      ...options?.capture,
      waitForNetworkIdle: true,
      recordHAR: true,
      harPath: harOutputPath,
    };

    const capture = await this.capture.capture(url, captureOptions);

    // Analyze captured network traffic
    const network = await this.networkAnalyzer.analyzeHAR(
      harOutputPath,
      options?.network
    );

    this.logger.info('Capture with network workflow completed', 'VisionWorkflow', {
      totalRequests: network.summary.totalRequests,
      apis: network.apis.length,
    });

    return { capture, network };
  }

  /**
   * Monitor mode workflow
   *
   * Continuously monitors a page for changes and network activity.
   */
  async *monitorPage(
    url: string,
    intervalMs: number = 5000,
    options?: {
      capture?: Partial<CaptureOptions>;
      network?: Partial<AnalysisOptions>;
    }
  ): AsyncGenerator<{
    timestamp: number;
    capture: CaptureResult;
    changes?: {
      domChanged: boolean;
      visualChanged: boolean;
    };
  }> {
    this.logger.info('Starting page monitoring', 'VisionWorkflow', {
      url,
      intervalMs,
    });

    let previousCapture: CaptureResult | undefined;

    while (true) {
      const timestamp = Date.now();
      const capture = await this.capture.capture(url, options?.capture);

      const result: {
        timestamp: number;
        capture: CaptureResult;
        changes?: {
          domChanged: boolean;
          visualChanged: boolean;
        };
      } = {
        timestamp,
        capture,
      };

      // Detect changes from previous capture
      if (previousCapture) {
        result.changes = {
          domChanged: capture.dom.totalElements !== previousCapture.dom.totalElements,
          visualChanged: capture.screenshot !== previousCapture.screenshot,
        };
      }

      yield result;

      previousCapture = capture;

      // Wait for next interval
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  /**
   * Batch analysis workflow
   *
   * Analyzes multiple URLs in parallel or sequence.
   */
  async analyzeBatch(
    urls: string[],
    options: Omit<WebPageAnalysisOptions, 'url'>,
    parallel: boolean = false
  ): Promise<Map<string, WebPageAnalysis>> {
    this.logger.info('Starting batch analysis', 'VisionWorkflow', {
      urlCount: urls.length,
      parallel,
    });

    const results = new Map<string, WebPageAnalysis>();

    if (parallel) {
      // Parallel analysis
      const analyses = await Promise.allSettled(
        urls.map((url) => this.analyzeWebPage({ ...options, url }))
      );

      urls.forEach((url, index) => {
        const result = analyses[index];
        if (result.status === 'fulfilled') {
          results.set(url, result.value);
        } else {
          this.logger.error('Batch analysis failed for URL', 'VisionWorkflow', {
            url,
            error: result.reason,
          });
        }
      });
    } else {
      // Sequential analysis
      for (const url of urls) {
        try {
          const analysis = await this.analyzeWebPage({ ...options, url });
          results.set(url, analysis);
        } catch (error) {
          this.logger.error('Batch analysis failed for URL', 'VisionWorkflow', {
            url,
            error,
          });
        }
      }
    }

    this.logger.info('Batch analysis completed', 'VisionWorkflow', {
      successful: results.size,
      failed: urls.length - results.size,
    });

    return results;
  }
}

/**
 * Create a vision workflow manager
 */
export function createVisionWorkflow(
  logger: LoggerLike,
  provider?: AIProvider
): VisionWorkflow {
  return new VisionWorkflow(logger, provider);
}
