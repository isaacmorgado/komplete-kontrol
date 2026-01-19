/**
 * RE Intent Parser
 * Converts natural language commands into structured RE intents
 */

export enum RETargetType {
  WEB_BROWSER = 'web-browser',
  MOBILE_APP = 'mobile-app',
  BINARY_EXECUTABLE = 'binary-executable',
  NETWORK_API = 'network-api',
  HARDWARE_FIRMWARE = 'hardware-firmware',
  CLOUD_CONTAINER = 'cloud-container',
  ELECTRON_DESKTOP = 'electron-desktop',
  AI_ML_MODEL = 'ai-ml-model'
}

export type RECommand = 'reverse-engineer' | 're' | 'analyze' | 'decompile' | 'deobfuscate' | 'extract';

export interface REIntent {
  command: RECommand;
  target: {
    type: RETargetType;
    path?: string;
    identifier?: string;
    metadata?: Record<string, any>;
  };
  options: {
    depth?: 'surface' | 'moderate' | 'deep';
    outputFormat?: 'summary' | 'detailed' | 'json';
    parallel?: boolean;
    fast?: boolean;
    thorough?: boolean;
  };
  confidence: number; // 0.0 - 1.0
  rawInput: string;
}

export class IntentParser {
  // Command pattern matching
  private readonly COMMAND_PATTERNS = {
    're': /\b(reverse\s+engineer|re\s+|decompile|deobfuscate|analyze|extract)\b/i,
    'reverse-engineer': /\brever(se)?\s*engin(eer)?(ing)?\b/i,
    'decompile': /\bdecompil(e|ing)\b/i,
    'deobfuscate': /\bdeobfuscat(e|ing)\b/i,
    'analyze': /\banalyz(e|ing)\b/i,
    'extract': /\bextract(ing)?\b/i
  };

  // Target type detection patterns
  private readonly TARGET_PATTERNS = {
    // File extensions
    apk: /\.apk$/i,
    ipa: /\.ipa$/i,
    exe: /\.exe$/i,
    dll: /\.dll$/i,
    elf: /\.elf$/i,
    so: /\.so$/i,
    crx: /\.crx$/i,
    xpi: /\.xpi$/i,
    asar: /\.asar$/i,
    bin: /\.bin$/i,
    hex: /\.hex$/i,
    onnx: /\.onnx$/i,
    pb: /\.pb$/i,
    docker: /Dockerfile|docker-compose/i,

    // URLs and domains
    url: /https?:\/\//i,
    website: /\.(com|net|org|io|ai|dev)/i,

    // Specific indicators
    firmware: /\b(firmware|router|iot|embedded)\b/i,
    api: /\b(api|endpoint|rest|graphql|grpc)\b/i,
    ml: /\b(model|neural|tensorflow|pytorch|onnx)\b/i,
    container: /\b(docker|kubernetes|k8s|pod|container)\b/i
  };

  // Option detection
  private readonly OPTION_PATTERNS = {
    fast: /\b(fast|quick|shallow)\b/i,
    thorough: /\b(thorough|deep|comprehensive|complete)\b/i,
    parallel: /\b(parallel)\b/i,
    json: /\b(json|structured)\b/i,
    detailed: /\b(detailed|verbose)\b/i
  };

  /**
   * Parse natural language input into structured RE intent
   */
  parseCommand(input: string): REIntent {
    const normalizedInput = input.trim();

    // Extract command
    const command = this.extractCommand(normalizedInput);

    // Extract target information
    const target = this.extractTarget(normalizedInput);

    // Extract options
    const options = this.extractOptions(normalizedInput);

    // Calculate confidence based on pattern matches
    const confidence = this.calculateConfidence(normalizedInput, target);

    return {
      command,
      target,
      options,
      confidence,
      rawInput: input
    };
  }

  private extractCommand(input: string): RECommand {
    // Check for specific commands first
    if (this.COMMAND_PATTERNS.decompile.test(input)) return 'decompile';
    if (this.COMMAND_PATTERNS.deobfuscate.test(input)) return 'deobfuscate';
    if (this.COMMAND_PATTERNS.extract.test(input)) return 'extract';
    if (this.COMMAND_PATTERNS.analyze.test(input)) return 'analyze';

    // Check for RE shorthand
    if (/\bre\s+/i.test(input)) return 're';

    // Default to 'reverse-engineer'
    return 'reverse-engineer';
  }

  private extractTarget(input: string): REIntent['target'] {
    // Try to find a file path or URL in the input
    const tokens = input.split(/\s+/);

    // Check for explicit target paths/URLs
    for (const token of tokens) {
      // Check file extensions
      if (this.TARGET_PATTERNS.apk.test(token)) {
        return {
          type: RETargetType.MOBILE_APP,
          path: token,
          metadata: { platform: 'android' }
        };
      }

      if (this.TARGET_PATTERNS.ipa.test(token)) {
        return {
          type: RETargetType.MOBILE_APP,
          path: token,
          metadata: { platform: 'ios' }
        };
      }

      if (this.TARGET_PATTERNS.exe.test(token) || this.TARGET_PATTERNS.dll.test(token)) {
        return {
          type: RETargetType.BINARY_EXECUTABLE,
          path: token,
          metadata: { platform: 'windows' }
        };
      }

      if (this.TARGET_PATTERNS.elf.test(token) || this.TARGET_PATTERNS.so.test(token)) {
        return {
          type: RETargetType.BINARY_EXECUTABLE,
          path: token,
          metadata: { platform: 'linux' }
        };
      }

      if (this.TARGET_PATTERNS.crx.test(token) || this.TARGET_PATTERNS.xpi.test(token)) {
        return {
          type: RETargetType.WEB_BROWSER,
          path: token,
          metadata: { extension: true }
        };
      }

      if (this.TARGET_PATTERNS.asar.test(token)) {
        return {
          type: RETargetType.ELECTRON_DESKTOP,
          path: token
        };
      }

      if (this.TARGET_PATTERNS.bin.test(token) || this.TARGET_PATTERNS.hex.test(token)) {
        return {
          type: RETargetType.HARDWARE_FIRMWARE,
          path: token
        };
      }

      if (this.TARGET_PATTERNS.onnx.test(token) || this.TARGET_PATTERNS.pb.test(token)) {
        return {
          type: RETargetType.AI_ML_MODEL,
          path: token
        };
      }

      if (this.TARGET_PATTERNS.url.test(token)) {
        return {
          type: RETargetType.WEB_BROWSER,
          path: token,
          metadata: { isUrl: true }
        };
      }
    }

    // Check for contextual indicators
    if (this.TARGET_PATTERNS.firmware.test(input)) {
      return { type: RETargetType.HARDWARE_FIRMWARE };
    }

    if (this.TARGET_PATTERNS.api.test(input)) {
      return { type: RETargetType.NETWORK_API };
    }

    if (this.TARGET_PATTERNS.ml.test(input)) {
      return { type: RETargetType.AI_ML_MODEL };
    }

    if (this.TARGET_PATTERNS.container.test(input) || this.TARGET_PATTERNS.docker.test(input)) {
      return { type: RETargetType.CLOUD_CONTAINER };
    }

    if (this.TARGET_PATTERNS.website.test(input)) {
      return { type: RETargetType.WEB_BROWSER };
    }

    // Default to binary executable if no specific pattern matched
    return {
      type: RETargetType.BINARY_EXECUTABLE,
      metadata: { inferred: true }
    };
  }

  private extractOptions(input: string): REIntent['options'] {
    const options: REIntent['options'] = {
      parallel: true // Default to parallel execution
    };

    // Depth detection
    if (this.OPTION_PATTERNS.fast.test(input)) {
      options.depth = 'surface';
      options.fast = true;
    } else if (this.OPTION_PATTERNS.thorough.test(input)) {
      options.depth = 'deep';
      options.thorough = true;
    } else {
      options.depth = 'moderate';
    }

    // Output format detection
    if (this.OPTION_PATTERNS.json.test(input)) {
      options.outputFormat = 'json';
    } else if (this.OPTION_PATTERNS.detailed.test(input)) {
      options.outputFormat = 'detailed';
    } else {
      options.outputFormat = 'summary';
    }

    // Parallel execution
    if (this.OPTION_PATTERNS.parallel.test(input)) {
      options.parallel = true;
    }

    return options;
  }

  private calculateConfidence(input: string, target: REIntent['target']): number {
    let confidence = 0.5; // Base confidence

    // Boost confidence if command keyword is present
    if (this.COMMAND_PATTERNS.re.test(input)) {
      confidence += 0.2;
    }

    // Boost confidence if we found a specific file
    if (target.path) {
      confidence += 0.3;
    }

    // Reduce confidence if target was inferred
    if (target.metadata?.inferred) {
      confidence -= 0.2;
    }

    // Clamp between 0 and 1
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Generate human-readable summary of parsed intent
   */
  summarizeIntent(intent: REIntent): string {
    const { command, target, options } = intent;

    const commandVerb = command === 're' ? 'reverse engineer' : command;
    const targetDesc = target.path || `${target.type} target`;
    const depthDesc = options.depth || 'moderate';

    return `${commandVerb} ${targetDesc} (${depthDesc} analysis, ${options.outputFormat} output)`;
  }

  /**
   * Validate parsed intent
   */
  validateIntent(intent: REIntent): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (intent.confidence < 0.3) {
      errors.push('Low confidence in intent parsing. Please be more specific.');
    }

    if (!intent.target.path && !intent.target.identifier) {
      errors.push('No target specified. Please provide a file path, URL, or identifier.');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Singleton instance
let parserInstance: IntentParser | null = null;

export function getIntentParser(): IntentParser {
  if (!parserInstance) {
    parserInstance = new IntentParser();
  }
  return parserInstance;
}
