/**
 * The password gate.
 *
 * Single user, one password, no accounts — the point is only to stop a stranger
 * who finds the URL from reading and editing your finances. There is no user
 * table, no registration and no password reset.
 *
 * Written against Web Crypto rather than `node:crypto` so the identical code
 * runs in the Edge middleware and in a Node route handler. Nothing here touches
 * the filesystem.
 */

export const SESSION_COOKIE = 'finance_session';
const SESSION_DAYS = 30;
export const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;

/** Domain separation, so the signing key is never the raw password. */
const KEY_SALT = 'my-finance/session-key/v1';

export type AuthMode =
  | { kind: 'password'; password: string }
  /** No password set, and the app is not running as a deployed build. */
  | { kind: 'open' }
  /** Deployed with no password: refuse to serve rather than expose the data. */
  | { kind: 'locked-out' };

/**
 * Decides whether the gate is on.
 *
 * The important case is the last one: a production build with no password set
 * is treated as a misconfigured deployment and serves nothing. Failing closed
 * is the only safe default when the alternative is publishing someone's
 * finances to the open internet.
 */
export function getAuthMode(): AuthMode {
  const password = (process.env.FINANCE_PASSWORD ?? '').trim();
  if (password) return { kind: 'password', password };

  const isProduction = process.env.NODE_ENV === 'production';
  const explicitlyOpen = (process.env.FINANCE_ALLOW_NO_PASSWORD ?? '').toLowerCase() === 'true';

  if (!isProduction || explicitlyOpen) return { kind: 'open' };
  return { kind: 'locked-out' };
}

const encoder = new TextEncoder();

function base64url(bytes: ArrayBuffer): string {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * The signing key is derived from the password, so changing the password
 * invalidates every existing session. `FINANCE_SESSION_SECRET` overrides it if
 * you would rather sessions survive a password change.
 */
async function signingKey(password: string): Promise<CryptoKey> {
  const secret = process.env.FINANCE_SESSION_SECRET?.trim() || `${KEY_SALT}:${password}`;
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  return crypto.subtle.importKey('raw', digest, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

async function sign(payload: string, password: string): Promise<string> {
  const key = await signingKey(password);
  return base64url(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)));
}

/** `<expiry-ms>.<signature>` — no secrets in the cookie, only an expiry. */
export async function createSessionToken(password: string, now = Date.now()): Promise<string> {
  const payload = String(now + SESSION_MAX_AGE * 1000);
  return `${payload}.${await sign(payload, password)}`;
}

export async function verifySessionToken(
  token: string | undefined,
  password: string,
  now = Date.now(),
): Promise<boolean> {
  if (!token) return false;

  const separator = token.lastIndexOf('.');
  if (separator <= 0) return false;

  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!/^\d+$/.test(payload)) return false;
  if (Number(payload) <= now) return false; // Expired.

  const expected = await sign(payload, password);
  return timingSafeEqual(signature, expected);
}

/**
 * Constant-time comparison. A plain `===` leaks how much of a value matched
 * through how long it took to say no.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
