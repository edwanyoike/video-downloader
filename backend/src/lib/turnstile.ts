const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Verifies a Cloudflare Turnstile token server-side.
 *
 * @param token - The Turnstile response token from the client
 * @param ip    - The client's IP address (from CF-Connecting-IP or req.ip)
 * @returns `true` only when Cloudflare confirms `success === true`
 */
export async function verifyTurnstileToken(token: string, ip: string): Promise<boolean> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  if (!secretKey) {
    console.warn('[turnstile] TURNSTILE_SECRET_KEY is not set — rejecting all tokens');
    return false;
  }

  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: secretKey, response: token, remoteip: ip }),
    });

    if (!response.ok) {
      console.error(
        `[turnstile] siteverify returned non-200 status: ${response.status} ${response.statusText}`,
      );
      return false;
    }

    const data = (await response.json()) as { success: boolean };
    return data.success === true;
  } catch (err) {
    console.error('[turnstile] Network error calling siteverify:', err);
    return false;
  }
}
