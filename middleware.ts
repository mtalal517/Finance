import { NextResponse, type NextRequest } from 'next/server';
import { getAuthMode, SESSION_COOKIE, verifySessionToken } from '@/lib/auth/session';

/**
 * Guards every route. Runs before any page or handler, so there is no path into
 * the data that skips the check — including the API and the data export.
 */

const PUBLIC_PATHS = new Set(['/login', '/api/auth/login']);

export async function middleware(request: NextRequest) {
  const mode = getAuthMode();

  if (mode.kind === 'open') return NextResponse.next();

  if (mode.kind === 'locked-out') {
    // Deployed without a password. Serving the app here would publish the
    // user's finances to anyone with the URL, so nothing is served at all.
    return new NextResponse(
      'This app is deployed without a password.\n\n' +
        'Set the FINANCE_PASSWORD environment variable on your host and redeploy.\n' +
        'To run it locally with no password, set FINANCE_ALLOW_NO_PASSWORD=true instead.\n',
      { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    );
  }

  const { pathname } = request.nextUrl;
  const signedIn = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value, mode.password);

  if (PUBLIC_PATHS.has(pathname)) {
    // Already signed in? Skip the login screen.
    if (signedIn && pathname === '/login') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  if (signedIn) return NextResponse.next();

  // An expired session on a background save should not redirect a fetch call
  // into an HTML login page — the client would try to parse it as JSON.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { ok: false, error: 'Your session has expired. Reload the page and sign in again.' },
      { status: 401 },
    );
  }

  const login = new URL('/login', request.url);
  // Remember where they were headed so sign-in lands them back there.
  if (pathname !== '/') login.searchParams.set('next', pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  // Everything except Next's own static output and the favicon.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
