import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifyTurnstileToken } from '../../lib/turnstile';

// Helper to build a mock Response-like object
function mockResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Bad Request',
    json: async () => body,
  } as unknown as Response;
}

describe('verifyTurnstileToken', () => {
  const originalEnv = process.env.TURNSTILE_SECRET_KEY;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.TURNSTILE_SECRET_KEY;
    } else {
      process.env.TURNSTILE_SECRET_KEY = originalEnv;
    }
  });

  it('returns true when siteverify responds with { success: true }', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse({ success: true })));

    const result = await verifyTurnstileToken('valid-token', '1.2.3.4');

    expect(result).toBe(true);
  });

  it('returns false when siteverify responds with { success: false }', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse({ success: false })));

    const result = await verifyTurnstileToken('invalid-token', '1.2.3.4');

    expect(result).toBe(false);
  });

  it('returns false when fetch throws a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')));

    const result = await verifyTurnstileToken('some-token', '1.2.3.4');

    expect(result).toBe(false);
  });

  it('returns false when TURNSTILE_SECRET_KEY is not set', async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await verifyTurnstileToken('some-token', '1.2.3.4');

    expect(result).toBe(false);
    // fetch should never be called when the secret key is absent
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns false when siteverify returns a non-200 HTTP status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(mockResponse({ success: true }, false, 500)),
    );

    const result = await verifyTurnstileToken('some-token', '1.2.3.4');

    expect(result).toBe(false);
  });

  it('sends the correct payload to the siteverify endpoint', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(mockResponse({ success: true }));
    vi.stubGlobal('fetch', fetchSpy);

    await verifyTurnstileToken('my-token', '5.6.7.8');

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ secret: 'test-secret', response: 'my-token', remoteip: '5.6.7.8' });
  });
});
