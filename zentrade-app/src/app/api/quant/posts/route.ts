import { NextRequest, NextResponse } from 'next/server';

/**
 * 代理 Polymarket xtracker API：马斯克推文流水（与市场结算口径一致）。
 * 支持 limit / offset 透传，用于抓取多周历史数据。
 */
const XTRACKER_BASE = 'https://xtracker.polymarket.com/api/users/elonmusk/posts';

export async function GET(req: NextRequest) {
  const limit = req.nextUrl.searchParams.get('limit') ?? '100';
  const offset = req.nextUrl.searchParams.get('offset') ?? '0';

  try {
    const res = await fetch(`${XTRACKER_BASE}?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `xtracker API responded ${res.status}` },
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
