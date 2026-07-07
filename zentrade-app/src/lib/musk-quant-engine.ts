import type {
  BucketValuation,
  ElonPost,
  LandingPrediction,
  QuantAlertSignal,
  QuantBucket,
  QuantPosition,
} from '@/types/musk-quant';

/**
 * Musk Quant 策略引擎（纯函数层）。
 * 算法逆向自 musk-tweet-quant 站点：双 µ 预测（线性/小时加权）、泊松区间概率、
 * 价值比 VR、三层入场结构、阶段系统、会话节奏修正。
 * 约定：时间一律北京时间（BJ, UTC+8）；价格内部用 %（0-100）。
 */

// ---------------------------------------------------------------------------
// 常量（206 天历史数据拟合，来自原站硬编码表）
// ---------------------------------------------------------------------------

/** 历史日均发推条数 */
export const DAILY_BASELINE = 43.4;

/** BJ 每小时发推量占全天比例（∑=1） */
export const HOURLY_FRACTION: number[] = [
  0.0495, 0.05, 0.0512, 0.0503, 0.0415, 0.031,
  0.0263, 0.0335, 0.035, 0.0295, 0.024, 0.0256,
  0.028, 0.0699, 0.0785, 0.0616, 0.053, 0.027,
  0.0183, 0.0223, 0.0347, 0.0467, 0.0603, 0.0522,
];

/** BJ 每小时历史均值条数（≈ HOURLY_FRACTION × 43.4） */
export const HOURLY_BASELINE: number[] = [
  2.15, 2.17, 2.22, 2.18, 1.8, 1.34, 1.14, 1.46, 1.52, 1.28,
  1.04, 1.11, 1.21, 3.03, 3.41, 2.67, 2.3, 1.17, 0.8,
  0.97, 1.5, 2.03, 2.62, 2.27,
];

/** 会话定义（BJ 小时窗口 + 历史统计） */
export interface SessionDef {
  name: string;
  emoji: string;
  bjHours: number[];
  cdt: string;
  freq: number;
  avgTweets: number;
  medTweets: number;
  strongThreshold: number;
  weakThreshold: number;
  expectedContrib: number;
}

export const SESSIONS: SessionDef[] = [
  { name: '下午会话', emoji: '☀️', bjHours: [0, 1, 2, 3, 4, 5], cdt: 'CDT 11am–5pm', freq: 0.97, avgTweets: 14.4, medTweets: 10, strongThreshold: 15, weakThreshold: 5, expectedContrib: 13.9 },
  { name: '傍晚会话', emoji: '🌆', bjHours: [6, 7, 8, 9, 10], cdt: 'CDT 5–10pm', freq: 0.51, avgTweets: 11.4, medTweets: 6, strongThreshold: 9, weakThreshold: 3, expectedContrib: 5.8 },
  { name: '深夜会话', emoji: '🌙', bjHours: [11, 12, 13, 14, 15, 16], cdt: 'CDT 10pm–3am', freq: 0.71, avgTweets: 14.3, medTweets: 11, strongThreshold: 16, weakThreshold: 5, expectedContrib: 10.1 },
  { name: '清晨过渡', emoji: '🌅', bjHours: [17, 18, 19], cdt: 'CDT 4–7am', freq: 0.16, avgTweets: 16.4, medTweets: 13, strongThreshold: 19, weakThreshold: 6, expectedContrib: 2.6 },
  { name: '上午会话', emoji: '🏙️', bjHours: [20, 21, 22, 23], cdt: 'CDT 7–11am', freq: 0.64, avgTweets: 10.9, medTweets: 8, strongThreshold: 12, weakThreshold: 4, expectedContrib: 7 },
];

/**
 * 预测模型常量集：默认为上面的 206 天冻结表；
 * 后端 /api/quant/constants 会用近 90 天数据滚动重估（马斯克发推行为非平稳，冻结表会过期）。
 */
export interface QuantConstants {
  source: 'default' | 'live';
  /** 重估用到的完整天数（default 时为 0） */
  daysUsed: number;
  dailyBaseline: number;
  hourlyFraction: number[];
  sessions: SessionDef[];
}

export const DEFAULT_CONSTANTS: QuantConstants = {
  source: 'default',
  daysUsed: 0,
  dailyBaseline: DAILY_BASELINE,
  hourlyFraction: HOURLY_FRACTION,
  sessions: SESSIONS,
};

// ---------------------------------------------------------------------------
// 时间/计数工具
// ---------------------------------------------------------------------------

const BJ_OFFSET_MS = 8 * 3600_000;

/** 取北京时间的小时（0-23） */
export function bjHour(date: Date): number {
  return new Date(date.getTime() + BJ_OFFSET_MS).getUTCHours();
}

/** 取北京时间的分钟 */
export function bjMinute(date: Date): number {
  return new Date(date.getTime() + BJ_OFFSET_MS).getUTCMinutes();
}

/** 取北京时间的日期 key（YYYY-MM-DD） */
export function bjDateKey(date: Date): string {
  return new Date(date.getTime() + BJ_OFFSET_MS).toISOString().slice(0, 10);
}

/** 统计窗口内推文数 */
export function countPostsInWindow(posts: ElonPost[], startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return posts.filter((p) => {
    const t = new Date(p.createdAt).getTime();
    return t >= start && t <= end;
  }).length;
}

/** 今日（北京时间自然日）已发条数 */
export function countPostsToday(posts: ElonPost[], now = new Date()): number {
  const todayKey = bjDateKey(now);
  return posts.filter((p) => bjDateKey(new Date(p.createdAt)) === todayKey).length;
}

/** 今日各小时计数（BJ） */
export function todayHourlyCounts(posts: ElonPost[], now = new Date()): number[] {
  const todayKey = bjDateKey(now);
  const row = new Array<number>(24).fill(0);
  for (const p of posts) {
    const d = new Date(p.createdAt);
    if (bjDateKey(d) === todayKey) row[bjHour(d)] += 1;
  }
  return row;
}

/** 按北京时间聚合为 dateKey -> hour -> count 的矩阵 */
export function buildHourlyMatrix(posts: ElonPost[]): Map<string, number[]> {
  const matrix = new Map<string, number[]>();
  for (const p of posts) {
    const d = new Date(p.createdAt);
    const key = bjDateKey(d);
    let row = matrix.get(key);
    if (!row) {
      row = new Array<number>(24).fill(0);
      matrix.set(key, row);
    }
    row[bjHour(d)] += 1;
  }
  return matrix;
}

/** 各日总数（北京时间自然日） */
export function dailyTotals(posts: ElonPost[]): { date: string; count: number }[] {
  const matrix = buildHourlyMatrix(posts);
  return [...matrix.entries()]
    .map(([date, row]) => ({ date, count: row.reduce((a, b) => a + b, 0) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ---------------------------------------------------------------------------
// 落点预测模型（双 µ）
// ---------------------------------------------------------------------------

/** 线性外推 µ：概率模型用它 */
export function muLinear(current: number, pace: number, remainingHours: number): number {
  return current + (remainingHours / 24) * pace;
}

/** 小时加权 µ：按当前 BJ 小时用历史小时分布加权剩余时间 */
export function muHourly(
  current: number,
  pace: number,
  remainingHours: number,
  now = new Date(),
  consts: QuantConstants = DEFAULT_CONSTANTS,
): number {
  const h = bjHour(now);
  const frac = (60 - bjMinute(now)) / 60;
  let r = consts.hourlyFraction[h] * frac;
  for (let i = 1; i < Math.floor(remainingHours); i++) {
    r += consts.hourlyFraction[(h + i) % 24];
  }
  return Math.round((current + pace * r) * 10) / 10;
}

export type SessionState = 'upcoming' | 'pending' | 'ongoing' | 'strong' | 'weak' | 'confirmed' | 'absent';

export interface SessionStatus {
  def: SessionDef;
  state: SessionState;
  /** 该会话今日实发 */
  actual: number;
  /** 按当前节奏缩放后的期望贡献 */
  expected: number;
  /** 对 µ 的修正（条） */
  muAdjust: number;
  /** 是否异常（缺席/明显偏弱） */
  anomaly: boolean;
  note: string;
}

/** 会话状态机：判定各会话状态并给出 µ 修正 */
export function evaluateSessions(
  todayByHour: number[],
  pace: number,
  now = new Date(),
  consts: QuantConstants = DEFAULT_CONSTANTS,
): { sessions: SessionStatus[]; totalMuAdjust: number } {
  const bjNow = bjHour(now);
  const scale = pace > 0 ? pace / consts.dailyBaseline : 1;
  const hasData = todayByHour.some((c) => c > 0);

  const sessions = consts.sessions.map((def): SessionStatus => {
    const actual = def.bjHours.reduce((sum, h) => sum + (todayByHour[h] ?? 0), 0);
    const expected = Math.round(def.expectedContrib * scale);
    const startHour = def.bjHours[0];
    const endHour = def.bjHours[def.bjHours.length - 1];

    if (bjNow < startHour) {
      return { def, state: 'upcoming', actual, expected, muAdjust: 0, anomaly: false, note: `待开始（BJ ${startHour}:00 后）` };
    }

    if (bjNow <= endHour) {
      // 进行中
      if (!hasData || actual === 0) {
        return { def, state: 'pending', actual, expected, muAdjust: 0, anomaly: false, note: '窗口已开 · 等待首推' };
      }
      if (actual >= def.strongThreshold) {
        return { def, state: 'strong', actual, expected, muAdjust: Math.round(def.avgTweets * 0.3), anomaly: false, note: '强势进行中' };
      }
      if (actual <= def.weakThreshold) {
        const pct = Math.round((1 - actual / Math.max(expected, 1)) * 100);
        return { def, state: 'weak', actual, expected, muAdjust: -Math.round(def.avgTweets * 0.25), anomaly: true, note: `当前 ${actual} 条，预期 ${expected} 条，偏低 ${pct}%` };
      }
      return { def, state: 'ongoing', actual, expected, muAdjust: 0, anomaly: false, note: '进行中' };
    }

    // 已结束
    if (!hasData) {
      return { def, state: 'pending', actual, expected, muAdjust: 0, anomaly: false, note: '无今日数据' };
    }
    if (actual === 0) {
      const anomaly = def.freq >= 0.6;
      return {
        def, state: 'absent', actual, expected,
        muAdjust: anomaly ? -Math.round(def.expectedContrib * scale) : 0,
        anomaly,
        note: anomaly ? `历史 ${Math.round(def.freq * 100)}% 的天会出现，今日缺席` : '缺席（0条）',
      };
    }
    if (actual >= def.strongThreshold) {
      return { def, state: 'strong', actual, expected, muAdjust: Math.round((actual - def.avgTweets) * 0.5), anomaly: false, note: '✓ 强势' };
    }
    if (actual <= def.weakThreshold) {
      return { def, state: 'weak', actual, expected, muAdjust: -Math.round((def.medTweets - actual) * 0.6), anomaly: true, note: `实际 ${actual} 条，历史中位 ${def.medTweets} 条，偏低明显` };
    }
    return { def, state: 'confirmed', actual, expected, muAdjust: Math.round((actual - def.avgTweets) * 0.3), anomaly: false, note: '✓ 正常' };
  });

  return { sessions, totalMuAdjust: sessions.reduce((s, x) => s + x.muAdjust, 0) };
}

export interface PredictionBundle extends LandingPrediction {
  /** 线性 µ */
  muLinear: number;
  /** 小时加权 µ */
  muHourly: number;
  /** 会话修正后的展示落点 */
  displayLanding: number;
  /**
   * 概率模型 λ = 会话修正后的落点（= displayLanding）。
   * 展示落点与概率中心统一使用同一 µ，避免两者落在不同区间的自相矛盾。
   */
  lambdaMu: number;
  /** 预测精准度（置信 %） */
  confidence: number;
  sessions: SessionStatus[];
  totalMuAdjust: number;
}

/** 预测精准度曲线（按剩余小时） */
export function confidenceCurve(remainingHours: number): number {
  const e = remainingHours;
  if (e >= 72) return 45;
  if (e >= 48) return Math.round(45 + ((72 - e) / 24) * 13);
  if (e >= 24) return Math.round(58 + ((48 - e) / 24) * 14);
  if (e >= 12) return Math.round(72 + ((24 - e) / 12) * 10);
  if (e >= 6) return Math.round(82 + ((12 - e) / 6) * 6);
  return 88;
}

/** 综合预测：双 µ + 会话修正 */
export function computePrediction(
  current: number,
  todayCount: number,
  pace: number,
  remainingHours: number,
  todayByHour: number[],
  now = new Date(),
  consts: QuantConstants = DEFAULT_CONSTANTS,
): PredictionBundle {
  const M = muLinear(current, pace, remainingHours);
  const muH = muHourly(current, pace, remainingHours, now, consts);
  const { sessions, totalMuAdjust } = evaluateSessions(todayByHour, pace, now, consts);
  const adjusted = Math.round(muH + totalMuAdjust);
  const displayLanding = Math.max(current, Math.round((muH + adjusted) / 2));
  const expectedRemaining = (remainingHours / 24) * pace;

  // 今日节奏比率：外推全天 vs 日均
  const bjNow = bjHour(now);
  const elapsedFrac = Math.max(1, bjNow) / 24;
  const todayProjected = todayCount / elapsedFrac;
  const todayRhythmRatio = pace > 0 ? todayProjected / pace : 1;

  return {
    predictedTotal: Math.round(M),
    currentCount: current,
    todayCount,
    expectedRemaining,
    sigma: Math.max(8, Math.sqrt(Math.max(0, expectedRemaining)) * 2.2),
    dailyBaseline: pace,
    todayRhythmRatio,
    muLinear: M,
    muHourly: muH,
    displayLanding,
    lambdaMu: displayLanding,
    confidence: confidenceCurve(remainingHours),
    sessions,
    totalMuAdjust,
  };
}

// ---------------------------------------------------------------------------
// 区间概率（泊松 + 正态对比）
// ---------------------------------------------------------------------------

/** 泊松 PMF 迭代实现（避免阶乘溢出） */
function poissonPmf(x: number, lambda: number): number {
  let p = Math.exp(-lambda);
  for (let i = 1; i <= x; i++) p *= lambda / i;
  return p;
}

/** 区间累计泊松概率 */
function poissonRange(min: number, max: number, lambda: number): number {
  let sum = 0;
  const upper = Math.min(max, Math.max(min, Math.round(lambda)) + 400); // a+ 区间截断防超时
  for (let i = min; i <= upper; i++) sum += poissonPmf(i, lambda);
  return sum;
}

/** erf 近似（Abramowitz–Stegun） */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

function normalCdf(x: number, mu: number, sigma: number): number {
  return 0.5 * (1 + erf((x - mu) / (sigma * Math.SQRT2)));
}

export interface BucketProb extends BucketValuation {
  /** 正态模型概率（对比用） */
  normalProb: number;
  /** 正态 − 泊松 */
  delta: number;
  /** 状态：已冲破上限 / 已进入 / 进行中 */
  status: 'busted' | 'passed' | 'active';
  /** 进入区间所需最低/最高时速（条/小时） */
  minVelocity: number;
  maxVelocity: number;
  /** 达到区间还需条数 */
  tweetsNeededMin: number;
  tweetsNeededMax: number;
  /** 时速难度 */
  difficulty: 'easy' | 'medium' | 'hard' | 'impossible' | null;
  /** 买入可成交价（¢，ask 优先） */
  askPct: number;
  /** 卖出可成交价（¢，bid 优先） */
  bidPct: number;
  /** 点差（¢），bid/ask 缺失时为 null */
  spreadPct: number | null;
  /** 中间价口径 VR（对照展示用；决策一律用 vr = 模型概率 ÷ ask） */
  vrMid: number;
  /** 流动性不足：无盘口或点差 ≥5¢，薄尾玩法（彩票/高赔率仓）应跳过 */
  illiquid: boolean;
}

function judge(vr: number): BucketValuation['judgement'] {
  if (vr >= 2.5) return 'strong_undervalued';
  if (vr >= 1.2) return 'undervalued';
  if (vr >= 1.0) return 'fair';
  if (vr >= 0.8) return 'slightly_overvalued';
  return 'overvalued';
}

/** 买入可成交价（¢）：优先 ask，缺盘口时回退中间价 */
export function askPctOf(b: QuantBucket): number {
  if (b.bestAsk !== null && b.bestAsk > 0) return Math.round(b.bestAsk * 1000) / 10;
  return Math.round(b.price * 1000) / 10;
}

/** 卖出可成交价（¢）：优先 bid，缺盘口时回退中间价 */
export function bidPctOf(b: QuantBucket): number {
  if (b.bestBid !== null && b.bestBid > 0) return Math.round(b.bestBid * 1000) / 10;
  return Math.round(b.price * 1000) / 10;
}

/**
 * 区间估值：泊松概率（仅中间价 ≥1¢ 参与归一化）+ VR + 状态/时速。
 * λ 用会话修正后的 µ（lambdaMu），与展示落点同源。
 * VR 用买入可成交价（ask）：低价区间点差大，中间价 VR 会高估实际拿到的赔率。
 * @param buckets price 为 0-1 小数
 */
export function evaluateBuckets(
  buckets: QuantBucket[],
  prediction: PredictionBundle,
  current: number,
  pace: number,
  remainingHours: number,
): BucketProb[] {
  const M = prediction.lambdaMu;
  const sigma = prediction.sigma;
  const k = Math.max(0.1, remainingHours);
  const v = pace / 24;

  const enriched = buckets.map((b) => {
    const pricePct = Math.round(b.price * 1000) / 10;
    const max = b.max ?? 9999;
    return { bucket: b, pricePct, min: b.min, max };
  });

  // 泊松归一化：仅价格 ≥1¢ 的区间参与
  const eligible = enriched.filter((e) => e.pricePct >= 1);
  const raw = new Map<string, number>();
  let totalRaw = 0;
  for (const e of eligible) {
    const p = poissonRange(e.min, e.max, M);
    raw.set(e.bucket.marketId, p);
    totalRaw += p;
  }

  // 正态对比同样归一化
  const rawNormal = new Map<string, number>();
  let totalNormal = 0;
  for (const e of eligible) {
    const p = normalCdf(e.max, M, sigma) - normalCdf(e.min, M, sigma);
    rawNormal.set(e.bucket.marketId, p);
    totalNormal += p;
  }

  return enriched.map((e): BucketProb => {
    const modelProb = totalRaw > 0 ? ((raw.get(e.bucket.marketId) ?? 0) / totalRaw) * 100 : 0;
    const normalProb = totalNormal > 0 ? ((rawNormal.get(e.bucket.marketId) ?? 0) / totalNormal) * 100 : 0;
    const ask = askPctOf(e.bucket);
    const bid = bidPctOf(e.bucket);
    const spread =
      e.bucket.bestAsk !== null && e.bucket.bestBid !== null
        ? Math.round((e.bucket.bestAsk - e.bucket.bestBid) * 1000) / 10
        : null;
    const vrMid = e.pricePct > 0 ? modelProb / e.pricePct : 0;
    const vr = ask > 0 ? modelProb / ask : 0;
    const status: BucketProb['status'] = current > e.max ? 'busted' : current >= e.min ? 'passed' : 'active';
    const minVelocity = Math.max(0, (e.min - current) / k);
    const maxVelocity = Math.max(0, (e.max - current) / k);

    let difficulty: BucketProb['difficulty'] = null;
    if (status === 'active') {
      const dist = Math.abs((e.min + e.max) / 2 - M);
      difficulty =
        v >= minVelocity ? (dist < 20 ? 'easy' : dist < 50 ? 'medium' : 'hard') : 'impossible';
    }

    return {
      bucket: e.bucket,
      modelProb,
      vr,
      judgement: judge(vr),
      isCenter: e.min <= M && M <= e.max,
      normalProb,
      delta: normalProb - modelProb,
      status,
      minVelocity,
      maxVelocity,
      tweetsNeededMin: Math.max(0, e.min - current),
      tweetsNeededMax: Math.max(0, e.max - current),
      difficulty,
      askPct: ask,
      bidPct: bid,
      spreadPct: spread,
      vrMid,
      illiquid: spread === null || spread >= 5,
    };
  });
}

// ---------------------------------------------------------------------------
// 三层入场结构 / 阶段建仓 / 彩票仓
// ---------------------------------------------------------------------------

export interface EntryStructure {
  /** 主仓 50–70%：realProb≥10% 中 VR 最高 */
  main: BucketProb | null;
  /** 保护仓 20–30%：中心下方相邻区间 */
  protect: BucketProb | null;
  /** 高赔率仓 ≤5%：price≤5¢ 且 VR≥2 */
  highOdds: BucketProb | null;
  /** 总体结论 */
  verdict: 'enter' | 'marginal' | 'wait';
  verdictText: string;
}

export function buildEntryStructure(probs: BucketProb[]): EntryStructure {
  const sorted = probs
    .filter((p) => pricePct(p) > 0 && p.modelProb > 0)
    .sort((a, b) => b.vr - a.vr);
  const main = sorted.find((p) => p.modelProb >= 10) ?? null;

  const byMin = [...probs].sort((a, b) => a.bucket.min - b.bucket.min);
  const centerIdx = byMin.findIndex((p) => p.isCenter);
  const protect = centerIdx > 0 ? byMin[centerIdx - 1] : null;

  const highOdds =
    sorted.find(
      (p) =>
        p.askPct <= 5 &&
        p.vr >= 2 &&
        !p.illiquid &&
        p !== main &&
        p !== protect,
    ) ?? null;

  const mainVr = main?.vr ?? 0;
  const verdict = mainVr >= 1.2 ? 'enter' : mainVr >= 1.0 ? 'marginal' : 'wait';
  const verdictText =
    verdict === 'enter'
      ? '✅ 有入场价值，可执行建仓'
      : verdict === 'marginal'
        ? '🟡 勉强可入，等更好时机'
        : '❌ 无正期望入场点，等待价格回调';

  return { main, protect, highOdds, verdict, verdictText };
}

export function pricePct(p: BucketProb): number {
  return Math.round(p.bucket.price * 1000) / 10;
}

export interface PhaseEntryPlan {
  kind: 'light' | 'main' | 'endgame' | null;
  title: string;
  /** 中心落点仓（light/main 阶段） */
  center: BucketProb | null;
  protectUp: BucketProb | null;
  protectDown: BucketProb | null;
  centerBudget: string;
  protectBudget: string;
  /** endgame 阶段的 NO 埋伏 / YES 联动机会 */
  noPlays: { prob: BucketProb; noPrice: number; multiple: number }[];
  yesPlays: { prob: BucketProb; multiple: number }[];
}

/** 阶段建仓卡（>72h 或 <6h 不显示） */
export function buildPhaseEntryPlan(
  probs: BucketProb[],
  prediction: PredictionBundle,
  current: number,
  remainingHours: number,
): PhaseEntryPlan | null {
  const e = remainingHours;
  if (e > 72 || e < 6) return null;

  const byMin = [...probs].sort((a, b) => a.bucket.min - b.bucket.min);
  const M = prediction.lambdaMu;
  // 中心区间：包含 M；否则取中点距 M 最近者
  let center = byMin.find((p) => p.isCenter) ?? null;
  if (!center && byMin.length > 0) {
    center = byMin.reduce((best, p) => {
      const mid = (p.bucket.min + (p.bucket.max ?? p.bucket.min + 19)) / 2;
      const bestMid = (best.bucket.min + (best.bucket.max ?? best.bucket.min + 19)) / 2;
      return Math.abs(mid - M) < Math.abs(bestMid - M) ? p : best;
    });
  }
  const centerMax = center?.bucket.max ?? 0;
  const centerMin = center?.bucket.min ?? 0;
  const protectUp = byMin.find((p) => p.bucket.min > centerMax) ?? null;
  const protectDown = [...byMin].reverse().find((p) => (p.bucket.max ?? Infinity) < centerMin) ?? null;

  if (e > 48) {
    return {
      kind: 'light', title: '🟡 轻仓布局（第3天）',
      center, protectUp, protectDown,
      centerBudget: '$80–130', protectBudget: '各 $30–50',
      noPlays: [], yesPlays: [],
    };
  }
  if (e > 36) {
    return {
      kind: 'main', title: '🟢 主力建仓窗口（第1–2天）',
      center, protectUp, protectDown,
      centerBudget: '$170–210', protectBudget: '各 $50–70',
      noPlays: [], yesPlays: [],
    };
  }

  // 最后 1.5 天：博弈高倍价差（可成交口径：买 NO 成本 ≈ 100 − YES bid，买 YES 成本 = ask）
  const noPlays = probs
    .filter((p) => {
      const noPrice = 100 - p.bidPct;
      const distToTop = (p.bucket.max ?? 9999) - current;
      return !p.illiquid && noPrice > 0 && noPrice <= 15 && distToTop >= 20 && distToTop <= 80;
    })
    .map((p) => {
      const noPrice = 100 - p.bidPct;
      return { prob: p, noPrice, multiple: Math.round(100 / noPrice) };
    });

  const yesPlays = probs
    .filter((p) => {
      const distToTop = (p.bucket.max ?? 9999) - current;
      return !p.illiquid && p.askPct > 0 && p.askPct <= 15 && distToTop >= 0 && distToTop <= 15;
    })
    .map((p) => ({ prob: p, multiple: Math.round(100 / p.askPct) }));

  return {
    kind: 'endgame', title: '🔴 最后1.5天 · 博弈高倍价差',
    center, protectUp: null, protectDown: null,
    centerBudget: '', protectBudget: '',
    noPlays, yesPlays,
  };
}

export interface LotteryOpportunity {
  prob: BucketProb;
  needed: number;
  multiple: number;
}

/** 彩票仓：ask ≤2¢、有盘口、未进入、下限距 µ ≤60 条 */
export function findLotteryOpportunities(
  probs: BucketProb[],
  prediction: PredictionBundle,
  current: number,
): LotteryOpportunity[] {
  return probs
    .filter((p) => {
      const shootDist = p.bucket.min - prediction.lambdaMu;
      return (
        !p.illiquid &&
        p.askPct > 0 &&
        p.askPct <= 2 &&
        p.bucket.min > current &&
        shootDist >= 0 &&
        shootDist <= 60
      );
    })
    .map((p) => ({
      prob: p,
      needed: p.bucket.min - current,
      multiple: Math.round(100 / p.askPct),
    }));
}

// ---------------------------------------------------------------------------
// 阶段系统
// ---------------------------------------------------------------------------

export interface PhaseBadge {
  key: string;
  label: string;
  tone: 'teal' | 'amber' | 'rose';
}

export function phaseBadge(daysRemaining: number): PhaseBadge {
  if (daysRemaining >= 5) return { key: 'early', label: '前期布局', tone: 'teal' };
  if (daysRemaining >= 3) return { key: 'mid', label: '中期调整', tone: 'teal' };
  if (daysRemaining >= 1) return { key: 'late', label: '后期收缩', tone: 'amber' };
  return { key: 'final', label: '最后24H', tone: 'rose' };
}

export interface OperationPhase {
  key: string;
  title: string;
  muError: string;
  actions: string[];
}

/** 操作阶段（按剩余天，含小数）：给出该阶段纪律清单 */
export function operationPhase(remainingDays: number): OperationPhase | null {
  if (remainingDays >= 3) {
    return {
      key: 'observe', title: '观察期（距到期 3 天以上）', muError: '±50条以上',
      actions: ['µ 不确定性大，不建议重仓入场（容易买错区间）', '每 6 小时看一次即可', '记录节奏，等建仓窗口开启'],
    };
  }
  if (remainingDays >= 2.5) {
    return {
      key: 'phase_entry1', title: '⏰ 建仓窗口开启（早期）', muError: '±50条',
      actions: ['µ 不确定性仍大：无正期望（VR<1）→ 观望', '有价值区间 → 轻仓 ≤25% 试探', '中心高估 → 主仓看两侧区间，不买中心', '等 1.5–2 天 µ 稳定后再加主仓'],
    };
  }
  if (remainingDays >= 1.5) {
    return {
      key: 'phase_entry2', title: '⏰ 主力建仓窗口', muError: '±20条',
      actions: ['µ 精度提升，最佳入场时机', 'VR<1 → 不要为了入场而入场', '中心高估 → 主仓移至价值比更高区间', '按三层入场结构执行（主仓/保护仓/高赔率仓）'],
    };
  }
  if (remainingDays >= 1) {
    return {
      key: 'phase_hold1', title: '⏰ 持仓评估阶段', muError: '±12条',
      actions: ['检查持仓 VR 是否 ≥1.0、µ 是否仍在区间内', '换仓在死区 BJ 17:30 执行', 'µ 偏移 >1.5σ（约25-30条）才考虑换仓', '上/下翼各卖出 40%，同时评估超额收益机会'],
    };
  }
  if (remainingDays >= 0.5) {
    return {
      key: 'phase_hold2', title: '⏰ 止盈评估阶段', muError: '±8条',
      actions: ['µ 非常稳定：>75¢ → 卖 50% 锁利，剩余博到期 $1', '>85¢ → 大部分止盈', '亏损仓位且 VR<0.8 → 死区出场，不拖延', '翼仓再卖剩余 50%（只剩最初 30% 仓位）'],
    };
  }
  return {
    key: 'phase_final', title: '⏰ 最终阶段 · 临近结算', muError: '±8条',
    actions: ['亏损仓位：现在出，不再等（死亡陷阱：「再等等看」）', '盈利仓位：持有到期，或已止盈 50% → 不动', '>85¢ 可全部止盈', '到期前 12 小时：翼仓全部清仓，专注等待中心结算'],
  };
}

// ---------------------------------------------------------------------------
// 会话节奏展示（当前窗口 / 时机徽章 / 落点影响）
// ---------------------------------------------------------------------------

export interface WindowInfo {
  emoji: string;
  label: string;
  tone: 'orange' | 'slate' | 'emerald' | 'teal';
}

/** 当前窗口分类（BJ 小时） */
export function currentWindow(now = new Date()): WindowInfo {
  const n = bjHour(now);
  if (n >= 12 && n < 16) return { emoji: '🔥', label: '深夜爆发期', tone: 'orange' };
  if (n >= 16 && n < 20) return { emoji: '💤', label: '入睡低谷', tone: 'slate' };
  if (n >= 20 || n < 4) return { emoji: '⚡', label: '美国活跃期', tone: 'emerald' };
  return { emoji: '📉', label: '傍晚低谷', tone: 'teal' };
}

export interface TimingBadge {
  key: 'BEST' | 'ACTIVE' | 'GOOD' | 'DEAD' | 'LOW' | 'WATCH' | 'NEUTRAL';
  title: string;
  detail: string;
}

/** 建仓时机徽章（按优先级） */
export function timingBadge(sessions: SessionStatus[], now = new Date()): TimingBadge {
  const h = bjHour(now);
  const m = bjMinute(now);
  const find = (name: string) => sessions.find((s) => s.def.name === name);
  const lateNight = find('深夜会话');
  const morning = find('上午会话');
  const evening = find('傍晚会话');

  if (h === 12 && m <= 35) {
    return { key: 'BEST', title: '⭐⭐ 最佳建仓时机', detail: '深夜会话窗口将在 25min 内开启，历史 +150% 跳跃即将发生' };
  }
  if (lateNight && (lateNight.state === 'ongoing' || lateNight.state === 'strong')) {
    return { key: 'ACTIVE', title: '🌙 深夜会话进行中', detail: '全天最强会话（均值14条），µ 正在上移，评估止盈时机' };
  }
  if (h === 21 && m <= 35) {
    return { key: 'GOOD', title: '⭐ 上午会话前建仓', detail: '上午会话（64%频率）即将在 BJ 22:00 开启' };
  }
  if (morning && (morning.state === 'ongoing' || morning.state === 'strong')) {
    return { key: 'ACTIVE', title: '🏙️ 上午会话进行中', detail: 'CDT 9–11am 活跃期，第二强信号，注意是否接近结束' };
  }
  if (h >= 17 && h <= 19) {
    return { key: 'DEAD', title: '💤 睡眠沉默期', detail: 'µ 冻结，适合冷静评估/剪仓' };
  }
  if (h >= 8 && h <= 11) {
    return { key: 'LOW', title: '🔵 深夜前过渡期', detail: 'CDT 7–10pm 低谷，等 BJ 12:00' };
  }
  if (evening && (evening.state === 'ongoing' || evening.state === 'strong')) {
    return { key: 'WATCH', title: '🌆 傍晚会话进行中', detail: '傍晚会话（51%频率），若出现则 65% 概率今晚有深夜会话' };
  }
  return { key: 'NEUTRAL', title: '🟡 过渡时段', detail: '活跃度中等，等待下一个会话窗口' };
}

export interface RhythmBlock {
  label: string;
  emoji: string;
  range: [number, number];
  kind: 'medium' | 'low' | 'peak' | 'sleep';
  /** 已过时段的实发条数；进行中/未来为 null */
  actual: number | null;
  state: 'past' | 'current' | 'future';
}

/** 今日节奏 6 时段块 */
export function todayRhythmBlocks(todayByHour: number[], now = new Date()): RhythmBlock[] {
  const h = bjHour(now);
  const defs: { label: string; emoji: string; range: [number, number]; kind: RhythmBlock['kind'] }[] = [
    { label: '美国下午', emoji: '📢', range: [0, 4], kind: 'medium' },
    { label: '美国傍晚', emoji: '🔵', range: [4, 8], kind: 'low' },
    { label: '美国晚上', emoji: '🔵', range: [8, 12], kind: 'low' },
    { label: '深夜', emoji: '🔥', range: [12, 16], kind: 'peak' },
    { label: '入睡', emoji: '💤', range: [16, 20], kind: 'sleep' },
    { label: '美国上午', emoji: '📢', range: [20, 24], kind: 'medium' },
  ];
  return defs.map((d) => {
    const state: RhythmBlock['state'] = h >= d.range[1] ? 'past' : h >= d.range[0] ? 'current' : 'future';
    const actual =
      state === 'future'
        ? null
        : todayHourSum(todayByHour, d.range[0], state === 'current' ? h + 1 : d.range[1]);
    return { ...d, actual, state };
  });
}

function todayHourSum(row: number[], from: number, to: number): number {
  let s = 0;
  for (let i = from; i < to; i++) s += row[i] ?? 0;
  return s;
}

export interface LandingImpact {
  icon: string;
  text: string;
  tone: 'warning' | 'down' | 'up' | 'wait' | 'active' | 'ok';
}

/** 「对本期落点的影响」提示 */
export function landingImpacts(
  sessions: SessionStatus[],
  prediction: PredictionBundle,
  now = new Date(),
): LandingImpact[] {
  const impacts: LandingImpact[] = [];
  const h = bjHour(now);

  for (const s of sessions) {
    if (s.state === 'absent' && s.def.freq >= 0.6) {
      impacts.push({ icon: '⚠️', tone: 'warning', text: `${s.def.name}今日缺席，落点预计下移约 ${Math.abs(s.muAdjust)} 条` });
    } else if (s.state === 'weak' && s.anomaly) {
      impacts.push({ icon: '🔻', tone: 'down', text: `${s.def.name}偏弱（今日 ${s.actual} 条），落点可能小幅偏低` });
    } else if (s.state === 'strong' && s.muAdjust > 2) {
      impacts.push({ icon: '📈', tone: 'up', text: `${s.def.name}强势（今日 ${s.actual} 条），落点预计上移约 ${s.muAdjust} 条` });
    }
  }

  const lateNight = sessions.find((s) => s.def.name === '深夜会话');
  if (lateNight?.state === 'upcoming') {
    impacts.push({ icon: '⏳', tone: 'wait', text: `深夜爆发时段（BJ 13–16）约 ${Math.max(0, 13 - h)} 小时后开始，是落点最大变量（历史均值 +14 条）` });
  } else if (lateNight && ['ongoing', 'strong', 'pending'].includes(lateNight.state)) {
    impacts.push({ icon: '🌙', tone: 'active', text: '深夜时段进行中（全天最高），µ 正在上移，注意评估止盈' });
  }

  if (impacts.length === 0) {
    impacts.push({ icon: '✅', tone: 'ok', text: `今日节奏正常，落点预测约 ${prediction.displayLanding} 条` });
  }
  return impacts;
}

// ---------------------------------------------------------------------------
// 实时操作信号（预警规则的页面版）
// ---------------------------------------------------------------------------

/** 生成当前市场的操作信号列表（原站预警规则的界面呈现，不做推送） */
export function buildSignals(
  probs: BucketProb[],
  prediction: PredictionBundle,
  current: number,
  todayCount: number,
  pace: number,
  remainingHours: number,
  now = new Date(),
): QuantAlertSignal[] {
  const signals: QuantAlertSignal[] = [];
  const remainingDays = remainingHours / 24;
  const center = probs.find((p) => p.isCenter) ?? null;
  const mu = prediction.lambdaMu;

  // 中心区间高估（负EV）：买入按 ask 计
  if (center && center.askPct > 35 && center.vr < 1) {
    const alternatives = probs
      .filter((p) => p.modelProb >= 3 && p !== center)
      .sort((a, b) => b.vr - a.vr)
      .slice(0, 3)
      .map((p) => `${p.bucket.label}（VR ${p.vr.toFixed(2)}）`)
      .join('、');
    signals.push({
      level: 'danger', title: '中心区间定价偏高，负EV',
      detail: `预测正确 ≠ 下注正确：${center.bucket.label} 买入价 ${center.askPct.toFixed(1)}¢ 高于模型概率，买入是负EV操作。更划算的区间：${alternatives || '暂无'}。建议主仓移至价值比最高的相邻区间。`,
    });
  }

  // 落点接近区间边界
  if (center) {
    const centerMax = center.bucket.max ?? 9999;
    const distTop = centerMax - mu;
    const distBottom = mu - center.bucket.min;
    const nearest = Math.min(distTop, distBottom);
    if (nearest >= 0 && nearest <= 10) {
      const side = distTop < distBottom ? '上' : '下';
      signals.push({
        level: 'danger', title: `落点接近区间${side}边界`,
        detail: `预测落点距 ${center.bucket.label} ${side}沿仅 ${Math.round(nearest)} 条（µ 误差约 ±10 条），边界两侧都有实质概率。建议在${side}方相邻区间补建保护仓。`,
      });
    }
  }

  // 今日速率异常
  const h = bjHour(now);
  const est = (todayCount / Math.max(1, h)) * 24;
  if (pace > 0 && h >= 4) {
    if (est / pace < 0.45) {
      signals.push({
        level: 'warning', title: '马斯克今天发推异常少（速率偏低）',
        detail: `今日外推全天约 ${Math.round(est)} 条，日均 ${pace.toFixed(1)} 条/天，今天不到一半。µ 可能虚高约 14 条。单日沉默不要立刻换仓，等今日死区（BJ 17:30）后再重估。`,
      });
    } else if (est / pace > 1.9) {
      signals.push({
        level: 'warning', title: '马斯克今天发推异常多（速率偏高）',
        detail: `今日外推全天约 ${Math.round(est)} 条，日均 ${pace.toFixed(1)} 条/天，今天近两倍。价格正在上涨，不追仓。BJ 14:00 是全天止盈最佳时机，+30% 可考虑减仓 30–50%。`,
      });
    }
  }

  // 价值比机会（VR 按 ask 口径）
  const structure = buildEntryStructure(probs);
  const opp = probs.filter((p) => p.vr >= 1.2 && p.modelProb >= 3).sort((a, b) => b.vr - a.vr);
  const centerOverpriced = center ? center.askPct > 35 && center.vr < 1 : false;
  if (opp.length > 0 && ((structure.main?.vr ?? 0) >= 1.5 || (centerOverpriced && (structure.main?.vr ?? 0) >= 1.2))) {
    const top = opp
      .slice(0, 4)
      .map((p) => `${p.bucket.label} VR ${p.vr.toFixed(2)}（买入 ${p.askPct.toFixed(1)}¢ / 模型 ${p.modelProb.toFixed(1)}%）`)
      .join('；');
    signals.push({
      level: 'success', title: '价值比机会（入场结构建议）',
      detail: `各区间价值比排名（按可成交 ask 价计算）：${top}。只有 VR≥1.0 的区间才有正期望。${structure.verdictText}`,
    });
  }

  // 止盈信号（卖出按 bid 计）
  if (center && remainingDays < 1.5) {
    const cp = center.bidPct;
    if (cp >= 75) {
      signals.push({
        level: 'success', title: '止盈信号（高位）',
        detail: `中心区间 ${center.bucket.label} 可卖价（bid）${cp.toFixed(1)}¢：卖出 50% 锁利，剩余博到期 $1；>85¢ 时可大部分止盈。到这个价位赔率极低，减仓是理性的。`,
      });
    } else if (cp >= 65) {
      signals.push({
        level: 'info', title: '可轻度止盈',
        detail: `中心区间 ${center.bucket.label} 可卖价（bid）${cp.toFixed(1)}¢，已进入可轻度止盈区间：建议减仓 20–30%，锁定部分收益，主仓继续持有等结算。`,
      });
    }
  }

  // 落点跑偏（当前数超出中心上限）
  if (center && remainingDays < 3) {
    const centerMax = center.bucket.max ?? 0;
    if (centerMax > 0 && current > centerMax) {
      const next = probs.find((p) => current >= p.bucket.min && current <= (p.bucket.max ?? 9999));
      signals.push({
        level: 'danger', title: '当前发推数已超出落点区间上限',
        detail: `当前 ${current} 条，超过上限 ${centerMax} 条。新落点可能是：${next ? `${next.bucket.label}（VR ${next.vr.toFixed(2)}）` : '待模型更新'}。检查持仓，有仓位需评估是否换仓。`,
      });
    }
  }

  return signals;
}

// ---------------------------------------------------------------------------
// 持仓评估
// ---------------------------------------------------------------------------

export interface PositionEvaluation {
  position: QuantPosition;
  currentPrice: number | null;
  currentValue: number;
  pnl: number;
  pnlPct: number;
  modelProb: number | null;
  signal: 'takeprofit' | 'stoploss' | 'modelexit' | null;
  signalText: string | null;
  /** 若命中的单笔中奖金额 */
  winValue: number;
}

/** 评估单笔持仓：估值与止盈/止损信号按可卖价（bid）计算 */
export function evaluatePosition(
  position: QuantPosition,
  probs: BucketProb[],
): PositionEvaluation {
  const match = probs.find((p) => p.bucket.label === position.bucketLabel) ?? null;
  const price = match ? match.bidPct / 100 : null;
  const currentValue = price !== null ? position.shares * price : position.cost;
  const pnl = currentValue - position.cost;
  const pnlPct = position.cost > 0 ? (pnl / position.cost) * 100 : 0;

  let signal: PositionEvaluation['signal'] = null;
  let signalText: string | null = null;
  if (price !== null && match) {
    if (price >= 0.7) {
      signal = 'takeprofit';
      signalText = '止盈 ↑ 建议锁定部分利润';
    } else if (price <= position.entryPrice * 0.4) {
      signal = 'stoploss';
      signalText = '减仓 ↓ 可卖价较均价跌幅 ≥60%，考虑止损';
    } else if (match.modelProb < 3) {
      signal = 'modelexit';
      signalText = '出场：模型概率 <3%，区间已无胜算';
    }
  }

  return {
    position,
    currentPrice: price,
    currentValue,
    pnl,
    pnlPct,
    modelProb: match?.modelProb ?? null,
    signal,
    signalText,
    winValue: position.shares,
  };
}
