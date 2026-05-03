import dns from 'node:dns/promises';
import { ValidationResult } from '../types.js';
import { detectPlatform } from '../platforms/registry.js';

/**
 * Checks whether an IP address falls within private/reserved ranges.
 * Used as an SSRF guard before passing URLs to yt-dlp.
 */
function isPrivateIp(ip: string): boolean {
  // IPv4 checks
  const parts = ip.split('.').map(Number);
  if (parts.length === 4) {
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
  }
  // IPv6 checks
  if (ip === '::1') return true;
  if (ip.toLowerCase().startsWith('fe80:')) return true;
  return false;
}

/**
 * Synchronous URL validation without DNS resolution.
 * Safe to use in client-side or test contexts where SSRF checking is not needed.
 *
 * Steps performed:
 *   1. Parse URL — reject malformed input
 *   2. Scheme check — only http/https; coerce http → https
 *   3. Platform detection — reject unsupported hostnames
 *   4. Platform mismatch check (if platformId provided)
 *   5. Tracking param stripping
 */
export function validateUrlClientSafe(
  raw: string,
  platformId?: string,
): ValidationResult {
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

/**
 * Full async URL validation including server-side SSRF guard via DNS resolution.
 * Use this on the backend before passing any URL to yt-dlp.
 *
 * Steps performed:
 *   1–5. Same as validateUrlClientSafe
 *   6. DNS lookup — block private/loopback/link-local IPs
 */
export async function validateUrl(
  raw: string,
  platformId?: string,
): Promise<ValidationResult> {
  // Steps 1–5 (synchronous portion)
  const syncResult = validateUrlClientSafe(raw, platformId);
  if (!syncResult.valid) {
    return syncResult;
  }

  // Step 6 — SSRF guard: resolve hostname and check IP range
  const hostname = new URL(syncResult.normalizedUrl!).hostname;
  try {
    const { address } = await dns.lookup(hostname);
    if (isPrivateIp(address)) {
      return {
        valid: false,
        error: 'SSRF_BLOCKED',
        errorMessage: "That URL isn't allowed.",
      };
    }
  } catch {
    // DNS resolution failure — treat as blocked to be safe
    return {
      valid: false,
      error: 'SSRF_BLOCKED',
      errorMessage: "That URL isn't allowed.",
    };
  }

  return syncResult;
}
