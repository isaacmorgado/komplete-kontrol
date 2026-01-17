/**
 * Vision Integration Module
 *
 * Exports zero-drift capture and DOM extraction capabilities
 */

export {
  ZeroDriftCapturer,
  createZeroDriftCapturer,
  type CaptureResult,
  type CaptureMetadata,
  type CaptureOptions,
} from './zero-drift-capture';

export {
  DOMExtractor,
  createDOMExtractor,
  type ExtractedElement,
  type ElementMetadata,
  type QualityFactors,
  type ExtractionOptions,
  type ExtractionResult,
} from './dom-extractor';
