import { NextRequest, NextResponse } from 'next/server';

/**
 * 代理 Polymarket CLOB 价格历史：单个区间 YES token 的小时级价格序列。
 * 用于走势形态对比（最近 48h 曲线）。
 */
const CLOB_BASE = 'https://clob.polymarket.com/prices-history';

export async function GET(req: NextRequest) {
  const tokenId = req.nextUrl.searchParams.get('tokenId');
  if (!tokenId) {
    return NextResponse.json({ error: 'tokenId required' }, { status: 400 });
  }

  // 取最近 50 小时，小时粒度
  const startTs = Math.floor((Date.now() - 50 * 3600_000) / 1000);
  const url = `${CLOB_BASE}?market=${encodeURIComponent(tokenId)}&interval=1d&fidelity=60&startTs=${startTs}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 120 },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `clob API responded ${res.status}` },
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
