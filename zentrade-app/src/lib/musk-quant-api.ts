import type { ElonPost, QuantBucket, QuantEvent } from '@/types/musk-quant';

/**
 * Musk Quant 数据获取层。
 * 全部经由本地 /api/quant/* 代理访问 Polymarket 公开 API。
 */

/** 解析区间 label（"<90" / "90-109" / "≥250" / "250+"）为数值范围 */
export function parseBucketLabel(label: string): { min: number; max: number | null } {
  const clean = label.replace(/\s|,/g, '');
  let m = clean.match(/^[<＜](\d+)$/);
  if (m) return { min: 0, max: Number(m[1]) - 1 };
  m = clean.match(/^[≥>＞](\d+)\+?$/) ?? clean.match(/^(\d+)\+$/);
  if (m) return { min: Number(m[1]), max: null };
  m = clean.match(/^(\d+)[-–—](\d+)$/);
  if (m) return { min: Number(m[1]), max: Number(m[2]) };
  return { min: 0, max: null };
}

interface GammaMarketRaw {
  id: string;
  groupItemTitle?: string;
  question?: string;
  outcomePrices?: string;
  lastTradePrice?: number;
  bestBid?: number | null;
  bestAsk?: number | null;
  volume1wk?: number;
  volume?: string | number;
  clobTokenIds?: string;
  closed?: boolean;
}

interface GammaEventRaw {
  id: string;
  slug: string;
  title: string;
  /** 注意：gamma 的 startDate 是市场创建时间，计数窗口起点是 startTime */
  startDate: string;
  startTime?: string;
  endDate: string;
  markets?: GammaMarketRaw[];
}

function mapBucket(m: GammaMarketRaw): QuantBucket {
  const label = m.groupItemTitle || m.question || '?';
  const { min, max } = parseBucketLabel(label);
  // 优先 bid/ask 中值，缺失时退回最近成交价
  const bid = typeof m.bestBid === 'number' ? m.bestBid : null;
  const ask = typeof m.bestAsk === 'number' ? m.bestAsk : null;
  let price = typeof m.lastTradePrice === 'number' ? m.lastTradePrice : 0;
  if (bid !== null && ask !== null && ask > 0) price = (bid + ask) / 2;

  let clobTokenIdYes: string | null = null;
  try {
    const ids = JSON.parse(m.clobTokenIds ?? '[]') as string[];
    clobTokenIdYes = ids[0] ?? null;
  } catch {
    clobTokenIdYes = null;
  }

  return {
    marketId: m.id,
    label,
    min,
    max,
    price,
    bestBid: bid,
    bestAsk: ask,
    volume: Number(m.volume1wk ?? m.volume ?? 0),
    clobTokenIdYes,
  };
}

/** 获取当前所有活跃的周度市场（按到期时间升序） */
export async function fetchQuantEvents(): Promise<QuantEvent[]> {
  const res = await fetch('/api/quant/markets', { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`markets api ${res.status}`);
  const raw = (await res.json()) as GammaEventRaw[];
  if (!Array.isArray(raw)) throw new Error('unexpected markets payload');

  return raw.map((e) => ({
    id: e.id,
    slug: e.slug,
    title: e.title,
    // 计数窗口起点优先 startTime（结算口径），回退为到期前 7 天
    startDate:
      e.startTime ?? new Date(new Date(e.endDate).getTime() - 7 * 86400_000).toISOString(),
    endDate: e.endDate,
    buckets: (e.markets ?? [])
      .map(mapBucket)
      .sort((a, b) => a.min - b.min),
  }));
}

interface XtrackerPostRaw {
  id: string;
  platformId: string;
  content: string;
  createdAt: string;
}

/** 抓取推文流水，直到覆盖 sinceIso 之前（分页拉取，单页 100 条） */
export async function fetchElonPosts(sinceIso: string, maxPages = 30): Promise<ElonPost[]> {
  const since = new Date(sinceIso).getTime();
  const posts: ElonPost[] = [];

  for (let page = 0; page < maxPages; page++) {
    const res = await fetch(`/api/quant/posts?limit=100&offset=${page * 100}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`posts api ${res.status}`);
    const body = (await res.json()) as { success?: boolean; data?: XtrackerPostRaw[] };
    const batch = body.data ?? [];
    if (batch.length === 0) break;

    for (const p of batch) {
      posts.push({
        id: p.id,
        platformId: p.platformId,
        content: p.content,
        createdAt: p.createdAt,
      });
    }

    const oldest = new Date(batch[batch.length - 1].createdAt).getTime();
    if (oldest < since) break;
  }

  return posts.filter((p) => new Date(p.createdAt).getTime() >= since);
}
