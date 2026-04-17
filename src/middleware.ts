// DEPLOY_ID: 20260416-imap-dashboard
import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  const session = await updateSession(request);
  let response = session.response;
  const user = session.user ?? null;

  // HMR / bad bundles can theoretically yield a missing response; never crash middleware.
  if (!response) {
    response = NextResponse.next({ request });
  }

  const path = request.nextUrl.pathname;

  if (path.startsWith('/dashboard')) {
    response.headers.set('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    if (!user) {
      const login = new URL('/login', request.url);
      login.searchParams.set('next', path);
      const redirect = NextResponse.redirect(login);
      response.headers.forEach((value, key) => {
        if (key.toLowerCase() === 'set-cookie') {
          redirect.headers.append(key, value);
        }
      });
      return redirect;
    }
  }

  if (user && (path === '/login' || path === '/signup' || path === '/auth')) {
    const dashboard = new URL('/dashboard', request.url);
    const redirect = NextResponse.redirect(dashboard);
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'set-cookie') {
        redirect.headers.append(key, value);
      }
    });
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
