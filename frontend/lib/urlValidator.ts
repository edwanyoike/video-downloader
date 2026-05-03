import { ValidationResult } from './types';
import { detectPlatform } from './platformRegistry';

/**
 * Client-safe URL validation without DNS resolution or SSRF checking.
 * Use this on the frontend for immediate feedback before submitting to the backend.
 *
 * Steps performed:
 *   1. Parse URL — reject malformed input
 *   2. Scheme check — only http/https; coerce http → https
 *   3. Platform detection — reject unsupported hostnames
 *   4. Platform mismatch check (if platformId provided)
 *   5. Tracking param stripping
 */
export function validateUrl(raw: string, platformId?: string): ValidationResult {
  // Step 1 — Parse
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return {
      valid: false,
      error: 'MALFORMED',
      errorMessage: "That doesn't look like a valid URL.",
    };
  }

  // Step 2 — Scheme check; coerce http → https
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      valid: false,
      error: 'MALFORMED',
      errorMessage: "That doesn't look like a valid URL.",
    };
  }
  if (parsed.protocol === 'http:') {
    parsed = new URL(raw.replace(/^http:/, 'https:'));
  }

  // Step 3 — Platform detection
  const detected = detectPlatform(parsed.hostname);
  if (!detected) {
    return {
      valid: false,
      error: 'UNSUPPORTED_PLATFORM',
      errorMessage: "This platform isn't supported yet.",
    };
  }

  // Step 4 — Platform mismatch
  if (platformId !== undefined && detected.id !== platformId) {
    return {
      valid: false,
      error: 'PLATFORM_MISMATCH',
      errorMessage: `That URL belongs to ${detected.displayName}, not the selected platform.`,
    };
  }

  // Step 5 — Strip tracking params
  for (const param of detected.trackingParams) {
    parsed.searchParams.delete(param);
  }
  const normalizedUrl = parsed.toString();

  return {
    valid: true,
    normalizedUrl,
    platformId: detected.id,
  };
}
