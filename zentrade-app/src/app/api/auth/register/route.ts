import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ZENTRADE_SESSION_COOKIE } from '@/lib/auth-session';
import { getBackendOrigin } from '@/lib/backend-origin';

function sessionMaxAgeSec(): number {
  const days = Number.parseInt(process.env.AUTH_JWT_EXPIRES_DAYS ?? '7', 10);
  const d = Number.isFinite(days) && days > 0 ? days : 7;
  return 60 * 60 * 24 * d;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const { username, password } = body as { username?: string; password?: string };
  if (typeof username !== 'string' || typeof password !== 'string') {
    return NextResponse.json({ error: 'Missing username or password' }, { status: 400 });
  }

  const origin = getBackendOrigin();
  const url = `${origin}/api/auth/register`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    const hint = 'Cannot reach the API backend.';
    const payload: { error: string; debug?: string } = { error: hint };
    if (process.env.NODE_ENV === 'development' && e instanceof Error) {
      payload.debug = `${e.name}: ${e.message}`;
    }
    return NextResponse.json(payload, { status: 502 });
  }

  if (!res.ok) {
    let msg = 'Registration failed';
    try {
      const err = (await res.json()) as { detail?: string | unknown };
      if (typeof err.detail === 'string') msg = err.detail;
    } catch {
      /* ignore */
    }
    return NextResponse.json({ error: msg }, { status: res.status });
  }

  const data = (await res.json()) as { token?: string };
  if (!data.token || typeof data.token !== 'string') {
    return NextResponse.json({ error: 'Invalid server response' }, { status: 502 });
  }

  const cookieStore = await cookies();
  cookieStore.set(ZENTRADE_SESSION_COOKIE, data.token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: sessionMaxAgeSec(),
  });

  return NextResponse.json({ ok: true });
}
