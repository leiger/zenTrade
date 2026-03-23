import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { ZENTRADE_SESSION_COOKIE } from '@/lib/auth-session';

const AUTH_PAGES = ['/login', '/register'];

function getSecretKey() {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret || secret.length < 32) return null;
  return new TextEncoder().encode(secret);
}

async function isAuthenticated(request: NextRequest, key: Uint8Array): Promise<boolean> {
  const token = request.cookies.get(ZENTRADE_SESSION_COOKIE)?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, key, { algorithms: ['HS256'] });
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAuthPage = AUTH_PAGES.some((p) => pathname.startsWith(p));
  if (isAuthPage) {
    const key = getSecretKey();
    if (key && (await isAuthenticated(request, key))) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  const key = getSecretKey();
  if (!key) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (await isAuthenticated(request, key)) {
    return NextResponse.next();
  }

  const res = NextResponse.redirect(new URL('/login', request.url));
  res.cookies.delete(ZENTRADE_SESSION_COOKIE);
  return res;
}

export const config = {
  matcher: [
    '/((?!_next/|favicon.ico|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
