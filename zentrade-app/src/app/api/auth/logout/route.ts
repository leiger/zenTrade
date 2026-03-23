import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ZENTRADE_SESSION_COOKIE } from '@/lib/auth-session';

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(ZENTRADE_SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
