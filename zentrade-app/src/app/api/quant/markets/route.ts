import { NextResponse } from 'next/server';

/**
 * 代理 Polymarket gamma API：按 elon-tweets 周度系列发现当前活跃市场。
 * 服务端转发以规避浏览器 CORS 限制。
 */
const GAMMA_EVENTS_URL =
  'https://gamma-api.polymarket.com/events?series_slug=elon-tweets&closed=false&limit=10&order=endDate&ascending=true';

export async function GET() {
  try {
    const res = await fetch(GAMMA_EVENTS_URL, {
      headers: { Accept: 'application/json' },
      // 市场价格变动频繁，短缓存即可
      next: { revalidate: 30 },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `gamma API responded ${res.status}` },
        { status: 502 },
      );
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'fetch failed' },
      { status: 502 },
    );
  }
}
