/**
 * FastAPI base origin for server-side fetch (Route Handlers).
 * NEXT_PUBLIC_API_URL is often a browser-relative path (e.g. /api) — invalid as fetch base on the server.
 * Set API_URL (absolute, e.g. http://backend:8000 in Docker) for login proxying.
 */

/** Node fetch to `localhost` may try IPv6 (::1) first; many dev servers only listen on 127.0.0.1 → long hang then failure. */
function forceIpv4LoopbackOrigin(origin: string): string {
  try {
    const u = new URL(origin);
    if (u.hostname === 'localhost' || u.hostname === '::1') {
      u.hostname = '127.0.0.1';
    }
    return u.origin;
  } catch {
    return origin;
  }
}

export function getBackendOrigin(): string {
  const strip = (s: string) => s.replace(/\/$/, '');

  let origin: string;

  const direct = process.env.API_URL?.trim();
  if (direct && /^https?:\/\//i.test(direct)) {
    const r = strip(direct);
    origin = r.endsWith('/api') ? r.slice(0, -4) : r;
    return forceIpv4LoopbackOrigin(origin);
  }

  const pub = strip(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000');
  if (/^https?:\/\//i.test(pub)) {
    origin = pub.endsWith('/api') ? pub.slice(0, -4) : pub;
    return forceIpv4LoopbackOrigin(origin);
  }

  // Relative path (e.g. "/api") — browser-only; server falls back to API_URL or local backend
  const fallback = strip(process.env.API_URL || 'http://127.0.0.1:8000');
  if (/^https?:\/\//i.test(fallback)) {
    origin = fallback.endsWith('/api') ? fallback.slice(0, -4) : fallback;
    return forceIpv4LoopbackOrigin(origin);
  }

  return 'http://127.0.0.1:8000';
}
