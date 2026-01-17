/**
 * HAR (HTTP Archive) Network Analysis
 *
 * Parses and analyzes HAR files to extract:
 * - API endpoints and patterns
 * - Performance metrics
 * - Request/response patterns
 * - Network dependencies
 */

import type { LoggerLike } from '../../utils/logger';

/**
 * HAR entry (simplified)
 */
export interface HAREntry {
  startedDateTime: string;
  time: number;
  request: {
    method: string;
    url: string;
    headers: Array<{ name: string; value: string }>;
    queryString: Array<{ name: string; value: string }>;
    postData?: {
      mimeType: string;
      text: string;
    };
  };
  response: {
    status: number;
    statusText: string;
    headers: Array<{ name: string; value: string }>;
    content: {
      size: number;
      mimeType: string;
      text?: string;
    };
  };
  timings: {
    blocked: number;
    dns: number;
    connect: number;
    send: number;
    wait: number;
    receive: number;
    ssl: number;
  };
}

/**
 * HAR file structure
 */
export interface HARFile {
  log: {
    version: string;
    creator: {
      name: string;
      version: string;
    };
    entries: HAREntry[];
  };
}

/**
 * Discovered API endpoint
 */
export interface APIEndpoint {
  /** HTTP method */
  method: string;
  /** Full URL */
  url: string;
  /** URL pattern (with parameters replaced) */
  pattern: string;
  /** Path segments */
  path: string;
  /** Query parameters */
  queryParams: string[];
  /** Request count */
  count: number;
  /** Average response time */
  avgResponseTime: number;
  /** Response status codes */
  statusCodes: number[];
  /** Content type */
  contentType: string;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  /** Total requests */
  totalRequests: number;
  /** Total transfer size (bytes) */
  totalSize: number;
  /** Average response time (ms) */
  avgResponseTime: number;
  /** Slowest requests */
  slowestRequests: Array<{
    url: string;
    time: number;
  }>;
  /** Failed requests */
  failedRequests: Array<{
    url: string;
    status: number;
  }>;
  /** Timing breakdown */
  timingBreakdown: {
    dns: number;
    connect: number;
    ssl: number;
    send: number;
    wait: number;
    receive: number;
  };
}

/**
 * Analysis result
 */
export interface AnalysisResult {
  /** Discovered API endpoints */
  endpoints: APIEndpoint[];
  /** Performance metrics */
  performance: PerformanceMetrics;
  /** Resource types breakdown */
  resourceTypes: Record<string, number>;
  /** Domains accessed */
  domains: string[];
  /** Analysis metadata */
  metadata: {
    entriesAnalyzed: number;
    timeRange: {
      start: string;
      end: string;
    };
    duration: number;
  };
}

/**
 * HAR Network Analyzer
 */
export class HARAnalyzer {
  private logger: LoggerLike;

  constructor(logger: LoggerLike) {
    this.logger = logger;
  }

  /**
   * Analyze HAR file
   */
  async analyze(harData: HARFile): Promise<AnalysisResult> {
    const startTime = Date.now();
    const entries = harData.log.entries;

    this.logger.info('Analyzing HAR file', 'Network', {
      entries: entries.length,
    });

    // Discover API endpoints
    const endpoints = this.discoverEndpoints(entries);

    // Calculate performance metrics
    const performance = this.calculatePerformance(entries);

    // Analyze resource types
    const resourceTypes = this.analyzeResourceTypes(entries);

    // Extract domains
    const domains = this.extractDomains(entries);

    // Time range
    const times = entries.map((e) => new Date(e.startedDateTime).getTime());
    const timeRange = {
      start: new Date(Math.min(...times)).toISOString(),
      end: new Date(Math.max(...times)).toISOString(),
    };

    this.logger.info('HAR analysis completed', 'Network', {
      endpoints: endpoints.length,
      domains: domains.length,
      durationMs: Date.now() - startTime,
    });

    return {
      endpoints,
      performance,
      resourceTypes,
      domains,
      metadata: {
        entriesAnalyzed: entries.length,
        timeRange,
        duration: Date.now() - startTime,
      },
    };
  }

  /**
   * Discover API endpoints from HAR entries
   */
  private discoverEndpoints(entries: HAREntry[]): APIEndpoint[] {
    const endpointMap = new Map<string, APIEndpoint>();

    for (const entry of entries) {
      const url = new URL(entry.request.url);

      // Skip static resources
      if (this.isStaticResource(url.pathname)) {
        continue;
      }

      // Generate pattern (replace IDs with placeholders)
      const pattern = this.generatePattern(url);
      const key = `${entry.request.method} ${pattern}`;

      if (!endpointMap.has(key)) {
        endpointMap.set(key, {
          method: entry.request.method,
          url: entry.request.url,
          pattern,
          path: url.pathname,
          queryParams: Array.from(url.searchParams.keys()),
          count: 0,
          avgResponseTime: 0,
          statusCodes: [],
          contentType: this.getContentType(entry.response.headers),
        });
      }

      const endpoint = endpointMap.get(key)!;
      endpoint.count++;
      endpoint.avgResponseTime += entry.time;
      endpoint.statusCodes.push(entry.response.status);
    }

    // Calculate averages
    for (const endpoint of endpointMap.values()) {
      endpoint.avgResponseTime = endpoint.avgResponseTime / endpoint.count;
    }

    return Array.from(endpointMap.values()).sort((a, b) => b.count - a.count);
  }

  /**
   * Calculate performance metrics
   */
  private calculatePerformance(entries: HAREntry[]): PerformanceMetrics {
    let totalSize = 0;
    let totalTime = 0;
    const failed: Array<{ url: string; status: number }> = [];
    const timingBreakdown = {
      dns: 0,
      connect: 0,
      ssl: 0,
      send: 0,
      wait: 0,
      receive: 0,
    };

    for (const entry of entries) {
      totalSize += entry.response.content.size;
      totalTime += entry.time;

      if (entry.response.status >= 400) {
        failed.push({
          url: entry.request.url,
          status: entry.response.status,
        });
      }

      // Accumulate timing data
      timingBreakdown.dns += Math.max(0, entry.timings.dns);
      timingBreakdown.connect += Math.max(0, entry.timings.connect);
      timingBreakdown.ssl += Math.max(0, entry.timings.ssl);
      timingBreakdown.send += Math.max(0, entry.timings.send);
      timingBreakdown.wait += Math.max(0, entry.timings.wait);
      timingBreakdown.receive += Math.max(0, entry.timings.receive);
    }

    // Average timings
    const count = entries.length;
    for (const key of Object.keys(timingBreakdown) as Array<keyof typeof timingBreakdown>) {
      timingBreakdown[key] = timingBreakdown[key] / count;
    }

    // Find slowest requests
    const sorted = [...entries].sort((a, b) => b.time - a.time);
    const slowest = sorted.slice(0, 10).map((e) => ({
      url: e.request.url,
      time: e.time,
    }));

    return {
      totalRequests: entries.length,
      totalSize,
      avgResponseTime: totalTime / count,
      slowestRequests: slowest,
      failedRequests: failed,
      timingBreakdown,
    };
  }

  /**
   * Analyze resource types distribution
   */
  private analyzeResourceTypes(entries: HAREntry[]): Record<string, number> {
    const types: Record<string, number> = {};

    for (const entry of entries) {
      const mimeType = entry.response.content.mimeType.split(';')[0];
      types[mimeType] = (types[mimeType] || 0) + 1;
    }

    return types;
  }

  /**
   * Extract unique domains
   */
  private extractDomains(entries: HAREntry[]): string[] {
    const domains = new Set<string>();

    for (const entry of entries) {
      try {
        const url = new URL(entry.request.url);
        domains.add(url.hostname);
      } catch {
        // Skip invalid URLs
      }
    }

    return Array.from(domains).sort();
  }

  /**
   * Generate URL pattern by replacing dynamic segments
   */
  private generatePattern(url: URL): string {
    let path = url.pathname;

    // Replace UUIDs
    path = path.replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      ':uuid'
    );

    // Replace numeric IDs
    path = path.replace(/\/\d+/g, '/:id');

    // Replace hash-like strings
    path = path.replace(/\/[a-f0-9]{32,}/gi, '/:hash');

    return path;
  }

  /**
   * Check if URL is a static resource
   */
  private isStaticResource(pathname: string): boolean {
    const staticExtensions = [
      '.css',
      '.js',
      '.png',
      '.jpg',
      '.jpeg',
      '.gif',
      '.svg',
      '.woff',
      '.woff2',
      '.ttf',
      '.ico',
    ];

    return staticExtensions.some((ext) => pathname.toLowerCase().endsWith(ext));
  }

  /**
   * Get content type from response headers
   */
  private getContentType(headers: Array<{ name: string; value: string }>): string {
    const header = headers.find(
      (h) => h.name.toLowerCase() === 'content-type'
    );
    return header ? header.value.split(';')[0] : 'unknown';
  }

  /**
   * Parse HAR file from JSON string
   */
  static parseHAR(harJson: string): HARFile {
    return JSON.parse(harJson) as HARFile;
  }
}

/**
 * Create HAR analyzer instance
 */
export function createHARAnalyzer(logger: LoggerLike): HARAnalyzer {
  return new HARAnalyzer(logger);
}
