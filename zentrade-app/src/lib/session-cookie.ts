/**
 * Session cookie flags. In production, Secure must match how the browser reached the site:
 * HTTPS (or X-Forwarded-Proto: https behind Nginx) → Secure; plain HTTP → must not use Secure or the browser drops the cookie.
 */
export function sessionCookieSetOptions(request: Request, maxAge: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure: shouldUseSecureCookie(request),
    maxAge,
  };
}

function shouldUseSecureCookie(request: Request): boolean {
  if (process.env.NODE_ENV !== 'production') return false;
  if (process.env.AUTH_COOKIE_INSECURE === '1') return false;

  const forwarded = request.headers.get('x-forwarded-proto');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim().toLowerCase();
    if (first === 'https') return true;
    if (first === 'http') return false;
  }

  try {
    return new URL(request.url).protocol === 'https:';
  } catch {
    return false;
  }
}
