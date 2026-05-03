import { describe, it, expect } from 'vitest';
import { classifyYtdlpError } from '../../lib/ytdlpErrorMapper.js';

function assertNoStderrLeak(result: ReturnType<typeof classifyYtdlpError>, stderr: string) {
  expect(result.message).not.toBe(stderr);
  expect(result.userMessage).not.toContain(stderr);
}

describe('CONTENT_PRIVATE — "Private video"', () => {
  it('matches exact phrase', () => {
    const result = classifyYtdlpError('ERROR: Private video', 1);
    expect(result.code).toBe('CONTENT_PRIVATE');
    expect(result.httpStatus).toBe(422);
    expect(result.userMessage).toBe('This video is private or unavailable.');
  });

  it('is case-insensitive', () => {
    expect(classifyYtdlpError('private video detected', 1).code).toBe('CONTENT_PRIVATE');
    expect(classifyYtdlpError('PRIVATE VIDEO', 1).code).toBe('CONTENT_PRIVATE');
  });

  it('does not leak raw stderr', () => {
    const stderr = 'ERROR: Private video — some internal detail';
    assertNoStderrLeak(classifyYtdlpError(stderr, 1), stderr);
  });
});

describe('CONTENT_UNAVAILABLE — "Video unavailable"', () => {
  it('matches "Video unavailable"', () => {
    const result = classifyYtdlpError('ERROR: Video unavailable', 1);
    expect(result.code).toBe('CONTENT_UNAVAILABLE');
    expect(result.httpStatus).toBe(422);
    expect(result.userMessage).toBe('This video is private or unavailable.');
  });

  it('matches "This video is unavailable"', () => {
    const result = classifyYtdlpError('This video is unavailable.', 1);
    expect(result.code).toBe('CONTENT_UNAVAILABLE');
    expect(result.httpStatus).toBe(422);
  });

  it('is case-insensitive', () => {
    expect(classifyYtdlpError('VIDEO UNAVAILABLE', 1).code).toBe('CONTENT_UNAVAILABLE');
  });
});

describe('AGE_RESTRICTED', () => {
  it('matches "Sign in to confirm your age"', () => {
    const result = classifyYtdlpError(
      'ERROR: Sign in to confirm your age. This video may be inappropriate for some users.',
      1,
    );
    expect(result.code).toBe('AGE_RESTRICTED');
    expect(result.httpStatus).toBe(422);
    expect(result.userMessage).toContain('age verification');
  });

  it('matches "age-restricted"', () => {
    const result = classifyYtdlpError('This video is age-restricted.', 1);
    expect(result.code).toBe('AGE_RESTRICTED');
    expect(result.httpStatus).toBe(422);
  });

  it('is case-insensitive for age-restricted', () => {
    expect(classifyYtdlpError('AGE-RESTRICTED content', 1).code).toBe('AGE_RESTRICTED');
  });
});

describe('GEO_RESTRICTED', () => {
  it('matches "not available in your country"', () => {
    const result = classifyYtdlpError('This content is not available in your country.', 1);
    expect(result.code).toBe('GEO_RESTRICTED');
    expect(result.httpStatus).toBe(422);
    expect(result.userMessage).toBe("This video isn't available in your region.");
  });

  it('matches "This video is not available in your country"', () => {
    const result = classifyYtdlpError('This video is not available in your country', 1);
    expect(result.code).toBe('GEO_RESTRICTED');
    expect(result.httpStatus).toBe(422);
  });

  it('is case-insensitive', () => {
    expect(classifyYtdlpError('NOT AVAILABLE IN YOUR COUNTRY', 1).code).toBe('GEO_RESTRICTED');
  });
});

describe('UNSUPPORTED_URL — "Unsupported URL"', () => {
  it('matches "Unsupported URL"', () => {
    const result = classifyYtdlpError('ERROR: Unsupported URL: https://example.com/video', 1);
    expect(result.code).toBe('UNSUPPORTED_URL');
    expect(result.httpStatus).toBe(400);
    expect(result.userMessage).toBe("This URL isn't supported.");
  });

  it('is case-insensitive', () => {
    expect(classifyYtdlpError('unsupported url', 1).code).toBe('UNSUPPORTED_URL');
    expect(classifyYtdlpError('UNSUPPORTED URL', 1).code).toBe('UNSUPPORTED_URL');
  });
});

describe('EXTRACTOR_TIMEOUT — exitCode -1', () => {
  it('returns EXTRACTOR_TIMEOUT for exitCode -1 regardless of stderr', () => {
    const result = classifyYtdlpError('', -1);
    expect(result.code).toBe('EXTRACTOR_TIMEOUT');
    expect(result.httpStatus).toBe(504);
    expect(result.userMessage).toBe("Couldn't reach the platform. Please try again.");
  });

  it('prioritises exitCode -1 over any stderr pattern', () => {
    const result = classifyYtdlpError('Private video', -1);
    expect(result.code).toBe('EXTRACTOR_TIMEOUT');
  });
});

describe('DOWNLOAD_FAILED — generic fallback', () => {
  it('returns DOWNLOAD_FAILED for unrecognised stderr', () => {
    const result = classifyYtdlpError('Some completely unknown error message', 1);
    expect(result.code).toBe('DOWNLOAD_FAILED');
    expect(result.httpStatus).toBe(500);
    expect(result.userMessage).toBe('Download failed. Please retry.');
  });

  it('returns DOWNLOAD_FAILED for empty stderr', () => {
    const result = classifyYtdlpError('', 1);
    expect(result.code).toBe('DOWNLOAD_FAILED');
    expect(result.httpStatus).toBe(500);
  });

  it('does not leak raw stderr in fallback', () => {
    const stderr = 'Some completely unknown error message with sensitive detail';
    assertNoStderrLeak(classifyYtdlpError(stderr, 1), stderr);
  });
});

describe('AppError shape', () => {
  const cases: [string, number][] = [
    ['Private video', 1],
    ['Video unavailable', 1],
    ['Sign in to confirm your age', 1],
    ['age-restricted', 1],
    ['not available in your country', 1],
    ['Unsupported URL', 1],
    ['', -1],
    ['unknown error', 1],
  ];

  it.each(cases)('result for stderr=%j exitCode=%i has all required fields', (stderr: string, exitCode: number) => {
    const result = classifyYtdlpError(stderr, exitCode);
    expect(result).toHaveProperty('code');
    expect(result).toHaveProperty('message');
    expect(result).toHaveProperty('httpStatus');
    expect(result).toHaveProperty('userMessage');
    expect(typeof result.code).toBe('string');
    expect(typeof result.message).toBe('string');
    expect(typeof result.httpStatus).toBe('number');
    expect(typeof result.userMessage).toBe('string');
    expect(result.message.length).toBeGreaterThan(0);
    expect(result.userMessage.length).toBeGreaterThan(0);
  });
});

describe('pattern ordering — first match wins', () => {
  it('"Private video" is matched before generic fallback', () => {
    expect(classifyYtdlpError('Private video and Video unavailable', 1).code).toBe(
      'CONTENT_PRIVATE',
    );
  });
});
