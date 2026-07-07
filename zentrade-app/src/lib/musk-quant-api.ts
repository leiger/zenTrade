import type { ElonPost, QuantBucket, QuantEvent } from '@/types/musk-quant';
import {
  DEFAULT_CONSTANTS,
  SESSIONS,
  type QuantConstants,
  type SessionDef,
} from '@/lib/musk-quant-engine';
import { normalizeBrowserApiBase } from '@/lib/xmonitor-api';

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

/** FastAPI 后端基址（constants 等仅由后端提供的端点用它；/api/quant/* 代理在 dev 下走 Next handler） */
const BACKEND_BASE = normalizeBrowserApiBase(
  process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api',
);

interface ConstantsResponseRaw {
  source: 'default' | 'live';
  daysUsed: number;
  dailyBaseline: number;
  hourlyFraction: number[];
  sessions: {
    name: string;
    bjHours: number[];
    freq: number;
    avgTweets: number;
    medTweets: number;
    strongThreshold: number;
    weakThreshold: number;
    expectedContrib: number;
  }[];
}

/**
 * 拉取滚动重估的模型常量（近 90 天）。
 * 后端不可达或样本不足时回退 206 天冻结默认表——调用方无需感知失败。
 */
export async function fetchQuantConstants(): Promise<QuantConstants> {
  try {
    const res = await fetch(`${BACKEND_BASE}/quant/constants`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return DEFAULT_CONSTANTS;
    const raw = (await res.json()) as ConstantsResponseRaw;
    if (raw.source !== 'live' || raw.hourlyFraction?.length !== 24) return DEFAULT_CONSTANTS;

    // emoji / cdt 等展示属性保留自默认表（按会话名对齐）
    const sessions: SessionDef[] = raw.sessions.map((s) => {
      const base = SESSIONS.find((d) => d.name === s.name);
      return {
        name: s.name,
        emoji: base?.emoji ?? '🕐',
        cdt: base?.cdt ?? '',
        bjHours: s.bjHours,
        freq: s.freq,
        avgTweets: s.avgTweets,
        medTweets: s.medTweets,
        strongThreshold: s.strongThreshold,
        weakThreshold: s.weakThreshold,
        expectedContrib: s.expectedContrib,
      };
    });

    return {
      source: 'live',
      daysUsed: raw.daysUsed,
      dailyBaseline: raw.dailyBaseline,
      hourlyFraction: raw.hourlyFraction,
      sessions,
    };
  } catch {
    return DEFAULT_CONSTANTS;
  }
}

/**
 * 拉取剩余时段发推数的 bootstrap 样本（经验分布形状）。
 * 后端数据不足或不可达时返回 null，evaluateBuckets 回退泊松。
 */
export async function fetchRemainingSamples(remainingHours: number): Promise<number[] | null> {
  try {
    const res = await fetch(
      `${BACKEND_BASE}/quant/remaining-samples?remainingHours=${remainingHours.toFixed(1)}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { source: string; samples: number[] };
    if (body.source !== 'live' || !Array.isArray(body.samples) || body.samples.length < 100) {
      return null;
    }
    return body.samples;
  } catch {
    return null;
  }
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
