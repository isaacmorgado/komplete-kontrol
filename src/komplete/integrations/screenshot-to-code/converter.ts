/**
 * Screenshot-to-Code Converter
 *
 * Converts screenshots to code using vision-capable AI models.
 * Based on research from abi/screenshot-to-code architecture.
 */

import type { Logger } from '../../utils/logger';
import type { AIProvider } from '../../types';
import type { CaptureResult } from '../vision/zero-drift-capture';

/**
 * Code generation stack options
 */
export type CodeStack =
  | 'html_tailwind'
  | 'html_css'
  | 'react_tailwind'
  | 'vue_tailwind'
  | 'ionic_tailwind';

/**
 * Code generation options
 */
export interface GenerateCodeOptions {
  /** Target stack */
  stack: CodeStack;
  /** Additional instructions */
  instructions?: string;
  /** Whether to include accessibility features */
  includeAccessibility?: boolean;
  /** Whether to make it responsive */
  responsive?: boolean;
  /** Model to use (must support vision) */
  model?: string;
}

/**
 * Code generation result
 */
export interface CodeGenerationResult {
  /** Generated code */
  code: string;
  /** Stack used */
  stack: CodeStack;
  /** Model used */
  model: string;
  /** Generation metadata */
  metadata: {
    /** Timestamp */
    timestamp: number;
    /** Input screenshot size */
    screenshotSize: number;
    /** Generation duration (ms) */
    durationMs: number;
    /** Token usage if available */
    tokenUsage?: {
      input: number;
      output: number;
    };
  };
}

/**
 * System prompts for different stacks
 * Based on abi/screenshot-to-code research
 */
const SYSTEM_PROMPTS: Record<CodeStack, string> = {
  html_tailwind: `You have perfect vision and pay great attention to detail which makes you an expert at building single page apps using Tailwind, HTML and JS.

You take screenshots of a reference web page from the user, and then build single page apps using Tailwind, HTML and JS.

- Make sure the app looks exactly like the screenshot.
- Pay close attention to background color, text color, font size, font family, padding, margin, border, etc. Match the colors and sizes exactly.
- Use the exact text from the screenshot.
- Do not add comments in the code such as "<!-- Add other navigation links as needed -->" in place of writing the full code. WRITE THE FULL CODE.
- Repeat elements as needed. For example, if there are 15 items, the code should have 15 items. DO NOT LEAVE comments like "<!-- Repeat for each item -->".
- For images, use placeholder images from https://placehold.co and include a detailed description of the image in the alt text so that an image generation AI can generate the image later.
- Use modern Tailwind CSS classes and best practices.
- Make sure the code is fully functional and can run standalone.

Return only the full code in <html></html> tags.
Do not include markdown "\`\`\`" or "\`\`\`html" at the start or end.
Reply with only the code, and no text/explanation before and after the code.`,

  html_css: `You are an expert CSS developer.

You take screenshots of a reference web page from the user, and then build single page apps using CSS, HTML and JS.

- Make sure the app looks exactly like the screenshot.
- Pay close attention to background color, text color, font size, font family, padding, margin, border, etc. Match the colors and sizes exactly.
- Use the exact text from the screenshot.
- Do not add comments in the code such as "<!-- Add other navigation links as needed -->" in place of writing the full code. WRITE THE FULL CODE.
- Repeat elements as needed. For example, if there are 15 items, the code should have 15 items.
- For images, use placeholder images from https://placehold.co and include a detailed description of the image in the alt text.
- Use modern CSS features (Flexbox, Grid, etc.).
- Include all CSS in a <style> tag in the HTML.

Return only the full code in <html></html> tags.
Do not include markdown "\`\`\`" or "\`\`\`html" at the start or end.`,

  react_tailwind: `You are an expert React and Tailwind developer.

You take screenshots of a reference web page from the user, and then build single page apps using React and Tailwind CSS.

- Make sure the app looks exactly like the screenshot.
- Pay close attention to background color, text color, font size, font family, padding, margin, border, etc. Match the colors and sizes exactly.
- Use the exact text from the screenshot.
- Write fully functional React components with proper hooks (useState, useEffect, etc.) where needed.
- For images, use placeholder images from https://placehold.co with descriptive alt text.
- Use modern React patterns and Tailwind best practices.
- Return a single-file React component that can be rendered.

Return only the full code wrapped in a single functional component.
Do not include markdown "\`\`\`" or "\`\`\`jsx" at the start or end.`,

  vue_tailwind: `You are an expert Vue.js and Tailwind developer.

You take screenshots of a reference web page from the user, and then build single page apps using Vue 3 and Tailwind CSS.

- Make sure the app looks exactly like the screenshot.
- Use Vue 3 Composition API with <script setup>.
- Pay close attention to all visual details: colors, fonts, spacing, etc.
- Use the exact text from the screenshot.
- For images, use placeholder images from https://placehold.co.
- Use modern Vue 3 and Tailwind best practices.

Return only the full single-file component code.
Do not include markdown "\`\`\`" at the start or end.`,

  ionic_tailwind: `You are an expert Ionic and Tailwind developer.

You take screenshots of a reference mobile app from the user, and then build mobile apps using Ionic with Tailwind CSS.

- Make sure the app looks exactly like the screenshot.
- Use Ionic components (ion-header, ion-content, ion-button, etc.) appropriately.
- Pay close attention to mobile UI patterns and spacing.
- Use the exact text from the screenshot.
- For images, use placeholder images from https://placehold.co.
- Make it mobile-responsive and touch-friendly.

Return only the full code.
Do not include markdown "\`\`\`" at the start or end.`,
};

/**
 * Screenshot-to-Code Converter
 */
export class ScreenshotToCodeConverter {
  private logger: Logger;
  private provider: AIProvider;

  constructor(provider: AIProvider, logger: Logger) {
    this.provider = provider;
    this.logger = logger;
  }

  /**
   * Generate code from screenshot
   */
  async generateCode(
    screenshot: string,
    options: GenerateCodeOptions
  ): Promise<CodeGenerationResult> {
    const startTime = Date.now();

    this.logger.info('Generating code from screenshot', 'ScreenshotToCode', {
      stack: options.stack,
      screenshotSize: screenshot.length,
    });

    // Build user prompt
    const userPrompt = this.buildUserPrompt(options);

    // Build system prompt
    const systemPrompt = SYSTEM_PROMPTS[options.stack];

    // Call AI provider with vision
    const result = await this.provider.complete(
      [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: screenshot.startsWith('data:')
                  ? screenshot.split(',')[1]
                  : screenshot,
              },
            },
            {
              type: 'text',
              text: userPrompt,
            },
          ],
        },
      ],
      {
        model: options.model,
        systemPrompt,
        temperature: 0.0, // Deterministic for code generation
        maxTokens: 4096,
      }
    );

    // Extract code from response
    const code = this.extractCode(result.content);

    const durationMs = Date.now() - startTime;

    this.logger.info('Code generation completed', 'ScreenshotToCode', {
      stack: options.stack,
      codeLength: code.length,
      durationMs,
    });

    return {
      code,
      stack: options.stack,
      model: options.model || this.provider.name,
      metadata: {
        timestamp: Date.now(),
        screenshotSize: screenshot.length,
        durationMs,
        tokenUsage: result.usage,
      },
    };
  }

  /**
   * Generate code from capture result
   */
  async generateCodeFromCapture(
    capture: CaptureResult,
    options: GenerateCodeOptions
  ): Promise<CodeGenerationResult> {
    return this.generateCode(capture.screenshot, options);
  }

  /**
   * Build user prompt with optional instructions
   */
  private buildUserPrompt(options: GenerateCodeOptions): string {
    let prompt = 'Generate code that matches this screenshot exactly.';

    if (options.instructions) {
      prompt += `\n\nAdditional instructions:\n${options.instructions}`;
    }

    if (options.responsive) {
      prompt += '\n\nMake sure the code is fully responsive and works on mobile, tablet, and desktop.';
    }

    if (options.includeAccessibility) {
      prompt += '\n\nInclude proper ARIA labels and semantic HTML for accessibility.';
    }

    return prompt;
  }

  /**
   * Extract code from AI response
   */
  private extractCode(content: string): string {
    // Remove markdown code fences if present
    let code = content.trim();

    // Remove ```html or ``` at start
    code = code.replace(/^```(?:html|jsx|vue)?\s*\n/i, '');

    // Remove ``` at end
    code = code.replace(/\n```\s*$/i, '');

    // If code doesn't start with <html>, wrap it
    if (!code.trim().startsWith('<html')) {
      // Check if it's a React/Vue component that needs wrapping
      if (code.includes('export default') || code.includes('export const')) {
        return code; // Already a complete module
      }
    }

    return code.trim();
  }
}

/**
 * Create a screenshot-to-code converter
 */
export function createScreenshotToCodeConverter(
  provider: AIProvider,
  logger: Logger
): ScreenshotToCodeConverter {
  return new ScreenshotToCodeConverter(provider, logger);
}
