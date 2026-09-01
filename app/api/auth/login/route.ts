import { NextResponse } from 'next/server';
import {
  createSessionToken,
  getAuthMode,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  timingSafeEqual,
} from '@/lib/auth/session';

/**
 * Exchanges the password for a session cookie.
 *
 * Attempts are throttled per source address. It is a crude in-memory counter
 * that resets when the process restarts, which is the right weight for a
 * single-user app: enough to make guessing impractical, no infrastructure.
 */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = new Map<string, { count: number; firstAt: number }>();

function rateLimit(key: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const record = attempts.get(key);

  if (!record || now - record.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  record.count += 1;
  if (record.count > MAX_ATTEMPTS) {
    return { allowed: false, retryAfterSeconds: Math.ceil((record.firstAt + WINDOW_MS - now) / 1000) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'local';
}

export async function POST(request: Request) {
  const mode = getAuthMode();
  if (mode.kind !== 'password') {
    return NextResponse.json({ ok: false, error: 'This app has no password set.' }, { status: 400 });
  }

  const limit = rateLimit(clientKey(request));
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: `Too many attempts. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.` },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  let password = '';
  try {
    const body = (await request.json()) as { password?: unknown };
    password = typeof body.password === 'string' ? body.password : '';
  } catch {
    return NextResponse.json({ ok: false, error: 'The request was not understood.' }, { status: 400 });
  }

  if (!timingSafeEqual(password, mode.password)) {
    return NextResponse.json({ ok: false, error: 'That password is not right.' }, { status: 401 });
  }

  attempts.delete(clientKey(request));

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, await createSessionToken(mode.password), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
