import type { AppError } from '../types';

interface ErrorPattern {
  pattern: RegExp;
  code: AppError['code'];
  httpStatus: number;
  userMessage: string;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  {
    pattern: /private video/i,
    code: 'CONTENT_PRIVATE',
    httpStatus: 422,
    userMessage: 'This video is private or unavailable.',
  },
  {
    pattern: /video unavailable/i,
    code: 'CONTENT_UNAVAILABLE',
    httpStatus: 422,
    userMessage: 'This video is private or unavailable.',
  },
  {
    pattern: /this video is unavailable/i,
    code: 'CONTENT_UNAVAILABLE',
    httpStatus: 422,
    userMessage: 'This video is private or unavailable.',
  },
  {
    pattern: /sign in to confirm your age/i,
    code: 'AGE_RESTRICTED',
    httpStatus: 422,
    userMessage:
      'This video requires age verification. Configure YouTube credentials to download it.',
  },
  {
    pattern: /age-restricted/i,
    code: 'AGE_RESTRICTED',
    httpStatus: 422,
    userMessage:
      'This video requires age verification. Configure YouTube credentials to download it.',
  },
  {
    pattern: /not available in your country/i,
    code: 'GEO_RESTRICTED',
    httpStatus: 422,
    userMessage: "This video isn't available in your region.",
  },
  {
    pattern: /this video is not available in your country/i,
    code: 'GEO_RESTRICTED',
    httpStatus: 422,
    userMessage: "This video isn't available in your region.",
  },
  {
    pattern: /unsupported url/i,
    code: 'UNSUPPORTED_URL',
    httpStatus: 400,
    userMessage: "This URL isn't supported.",
  },
];

/**
 * Classifies a yt-dlp error into a structured AppError.
 *
 * Patterns are checked in order; the first match wins.
 * An exit code of -1 indicates a timeout / SIGTERM.
 * Raw stderr is never included in the returned AppError.
 */
export function classifyYtdlpError(stderr: string, exitCode: number): AppError {
  // Timeout / SIGTERM — check before pattern matching
  if (exitCode === -1) {
    return {
      code: 'EXTRACTOR_TIMEOUT',
      message: 'yt-dlp process timed out or was terminated.',
      httpStatus: 504,
      userMessage: "Couldn't reach the platform. Please try again.",
    };
  }

  for (const { pattern, code, httpStatus, userMessage } of ERROR_PATTERNS) {
    if (pattern.test(stderr)) {
      return {
        code,
        message: `yt-dlp exited with code ${exitCode}: ${code}`,
        httpStatus,
        userMessage,
      };
    }
  }

  // Generic fallback
  return {
    code: 'DOWNLOAD_FAILED',
    message: `yt-dlp exited with code ${exitCode}: unrecognised error.`,
    httpStatus: 500,
    userMessage: 'Download failed. Please retry.',
  };
}
