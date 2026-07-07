/**
 * 走势形态预测引擎（移植自原站 morphology_compare.html）。
 * 六种形态模板来自 18 个真实市场最后 48h 的价格曲线；
 * 分类器根据「中心区间（绿）vs 相邻区间（红）」近 48h 小时级价格特征打分。
 */

import { normalizeBrowserApiBase } from '@/lib/xmonitor-api';

export type PatternKey = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export interface PatternTemplate {
  name: string;
  /** 历史出现频率文本 */
  freq: string;
  color: string;
  signal: string;
  action: string;
  predict: string;
  /** 中心区间（绿）48 点模板曲线（-48h..-1h，价格 0-1） */
  g: number[];
  /** 相邻区间（红）模板曲线 */
  r: number[];
  /** 关键窗口（模板 X 轴索引区间） */
  zone: [number, number];
}

export const PATTERN_TEMPLATES: Record<PatternKey, PatternTemplate> = {
  A: {
    name: '全程碾压型', freq: '20%', color: '#00d4aa',
    signal: '持仓 / 跟进入场',
    action: '绿色从始至终稳定领先，差距单调扩大。任何时间买入均合理，越早成本越低。红色无博弈价值。',
    predict: '若当前绿色已全程领先且红色无有效追赶，大概率延续此形态至结算。',
    g: [0.28, 0.305, 0.325, 0.325, 0.325, 0.325, 0.345, 0.355, 0.347, 0.355, 0.365, 0.375, 0.365, 0.385, 0.365, 0.341, 0.345, 0.395, 0.435, 0.445, 0.455, 0.462, 0.465, 0.475, 0.507, 0.515, 0.522, 0.545, 0.545, 0.555, 0.535, 0.519, 0.565, 0.535, 0.484, 0.475, 0.43, 0.475, 0.551, 0.635, 0.67, 0.695, 0.7, 0.709, 0.815, 0.905, 0.949, 0.999],
    r: [0.281, 0.26, 0.272, 0.243, 0.246, 0.241, 0.232, 0.214, 0.192, 0.241, 0.214, 0.213, 0.213, 0.206, 0.189, 0.176, 0.164, 0.236, 0.197, 0.178, 0.181, 0.231, 0.199, 0.238, 0.178, 0.193, 0.228, 0.204, 0.185, 0.164, 0.156, 0.151, 0.164, 0.151, 0.328, 0.365, 0.424, 0.442, 0.367, 0.285, 0.265, 0.245, 0.255, 0.234, 0.16, 0.091, 0.045, 0.001],
    zone: [36, 47],
  },
  B: {
    name: '快速确立型', freq: '12%', color: '#4cc9f0',
    signal: '确立后跟进入场',
    action: '初期拉锯后绿色在约-33h确立稳定领先，此后极少逆转。拉锯期不宜重仓，确立后2-3h跟进最稳。',
    predict: '若初期有拉锯但绿色已站稳12h以上，预计进入稳定收敛阶段，红色将持续萎缩。',
    g: [0.385, 0.395, 0.375, 0.395, 0.415, 0.435, 0.425, 0.425, 0.418, 0.415, 0.415, 0.32, 0.355, 0.375, 0.344, 0.375, 0.435, 0.435, 0.485, 0.495, 0.475, 0.475, 0.485, 0.545, 0.545, 0.615, 0.585, 0.635, 0.655, 0.685, 0.695, 0.695, 0.695, 0.535, 0.546, 0.505, 0.585, 0.615, 0.6, 0.695, 0.725, 0.69, 0.645, 0.65, 0.675, 0.755, 0.955, 0.999],
    r: [0.385, 0.375, 0.415, 0.415, 0.376, 0.385, 0.385, 0.385, 0.43, 0.365, 0.365, 0.475, 0.495, 0.495, 0.5, 0.51, 0.475, 0.475, 0.425, 0.425, 0.445, 0.445, 0.435, 0.345, 0.365, 0.235, 0.365, 0.285, 0.255, 0.235, 0.19, 0.21, 0.205, 0.435, 0.394, 0.475, 0.395, 0.365, 0.385, 0.285, 0.275, 0.295, 0.335, 0.335, 0.325, 0.235, 0.045, 0.002],
    zone: [0, 16],
  },
  C: {
    name: '中期反超型', freq: '33%', color: '#ffd700',
    signal: '反超后1-4h入场',
    action: '最常见形态（33%）。红色先领约20-24h，约-24h完成反超，反超后红色加速崩溃。反超发生后1-4h内是最佳入场窗口。',
    predict: '若当前红色仍领先但绿色正在追赶，大概率在未来12-24h内发生反超，届时是核心入场机会。',
    g: [0.329, 0.321, 0.281, 0.28, 0.277, 0.276, 0.279, 0.238, 0.251, 0.186, 0.241, 0.309, 0.38, 0.333, 0.305, 0.292, 0.296, 0.298, 0.303, 0.419, 0.379, 0.379, 0.403, 0.381, 0.361, 0.526, 0.556, 0.537, 0.54, 0.566, 0.545, 0.581, 0.613, 0.667, 0.667, 0.683, 0.688, 0.722, 0.748, 0.72, 0.715, 0.682, 0.699, 0.683, 0.685, 0.571, 0.67, 0.977],
    r: [0.415, 0.465, 0.465, 0.475, 0.489, 0.514, 0.525, 0.545, 0.535, 0.555, 0.555, 0.525, 0.465, 0.525, 0.555, 0.565, 0.565, 0.565, 0.565, 0.475, 0.525, 0.515, 0.475, 0.525, 0.535, 0.325, 0.275, 0.295, 0.305, 0.315, 0.335, 0.085, 0.075, 0.085, 0.085, 0.075, 0.095, 0.115, 0.1, 0.17, 0.265, 0.265, 0.265, 0.275, 0.285, 0.375, 0.001, 0.001],
    zone: [19, 31],
  },
  D: {
    name: '末期追赶型', freq: '8%', color: '#ff9f43',
    signal: '确认动量后小仓进',
    action: '红色主导36h以上，绿色最后12h急速追赶。追赶中入场成本中等偏高，追赶过程波动大，需1-2h确认动量方向再进场。',
    predict: '若绿色长期低位但近6h开始快速拉升，有可能触发末期追赶。高风险高弹性，需密切关注推文速率。',
    g: [0.093, 0.093, 0.079, 0.074, 0.073, 0.071, 0.065, 0.083, 0.1, 0.093, 0.084, 0.076, 0.069, 0.07, 0.071, 0.072, 0.073, 0.06, 0.053, 0.047, 0.038, 0.039, 0.037, 0.037, 0.032, 0.032, 0.094, 0.073, 0.402, 0.325, 0.345, 0.322, 0.291, 0.289, 0.365, 0.352, 0.5, 0.608, 0.571, 0.466, 0.344, 0.411, 0.381, 0.281, 0.195, 0.422, 0.984, 0.999],
    r: [0.361, 0.341, 0.323, 0.311, 0.254, 0.23, 0.211, 0.303, 0.365, 0.376, 0.389, 0.372, 0.382, 0.4, 0.422, 0.411, 0.424, 0.408, 0.401, 0.383, 0.411, 0.372, 0.369, 0.333, 0.347, 0.292, 0.562, 0.696, 0.474, 0.559, 0.571, 0.617, 0.626, 0.636, 0.57, 0.589, 0.402, 0.325, 0.39, 0.498, 0.616, 0.566, 0.619, 0.699, 0.81, 0.58, 0.001, 0.001],
    zone: [26, 47],
  },
  E: {
    name: '临门一脚型', freq: '2%', color: '#ff6b6b',
    signal: '高赔率小仓押注',
    action: '极罕见（2%）但赔率最高。绿色全程趴底，最后2-3h垂直爆发。触发条件：推文数在最后几小时真实爆发，价格绿色<20¢。',
    predict: '若绿色长期趴底无追赶迹象，大概率延续E型格局。若出现推文突发加速，则可能触发垂直爆发，小仓待机。',
    g: [0.244, 0.233, 0.21, 0.207, 0.201, 0.182, 0.153, 0.17, 0.154, 0.146, 0.148, 0.149, 0.198, 0.24, 0.216, 0.203, 0.206, 0.187, 0.158, 0.163, 0.156, 0.21, 0.186, 0.158, 0.147, 0.111, 0.111, 0.086, 0.077, 0.061, 0.054, 0.042, 0.029, 0.094, 0.102, 0.066, 0.093, 0.087, 0.135, 0.368, 0.372, 0.377, 0.39, 0.386, 0.412, 0.87, 0.863, 0.99],
    r: [0.419, 0.439, 0.442, 0.435, 0.414, 0.412, 0.411, 0.436, 0.432, 0.467, 0.448, 0.467, 0.506, 0.543, 0.566, 0.586, 0.596, 0.597, 0.578, 0.579, 0.613, 0.666, 0.675, 0.696, 0.721, 0.754, 0.759, 0.736, 0.738, 0.686, 0.662, 0.664, 0.653, 0.789, 0.877, 0.892, 0.894, 0.911, 0.857, 0.609, 0.619, 0.62, 0.589, 0.584, 0.596, 0.115, 0.001, 0.001],
    zone: [43, 47],
  },
  F: {
    name: '领先险守型', freq: '22%', color: '#a29bfe',
    signal: '持仓不动，不割肉',
    action: '绿色长期领先（22%），末期红色突然大幅追赶。历史数据：即使结算前2h绿0.16红0.84，绿色仍然胜出。末期急拉是噪音，不要轻易割肉。',
    predict: '若绿色已长期领先但红色近12h快速拉升，大概率将走F型「险守」路线。持仓坚守，末期恐慌是陷阱。',
    g: [0.317, 0.285, 0.274, 0.298, 0.314, 0.32, 0.319, 0.319, 0.334, 0.291, 0.3, 0.307, 0.319, 0.314, 0.323, 0.411, 0.369, 0.375, 0.414, 0.434, 0.435, 0.428, 0.494, 0.49, 0.557, 0.562, 0.576, 0.581, 0.56, 0.634, 0.602, 0.651, 0.673, 0.635, 0.533, 0.49, 0.437, 0.454, 0.461, 0.473, 0.446, 0.429, 0.41, 0.417, 0.393, 0.273, 0.159, 0.998],
    r: [0.105, 0.056, 0.044, 0.06, 0.066, 0.069, 0.077, 0.089, 0.09, 0.063, 0.058, 0.062, 0.074, 0.048, 0.059, 0.063, 0.053, 0.021, 0.041, 0.029, 0.027, 0.027, 0.048, 0.076, 0.094, 0.102, 0.111, 0.134, 0.184, 0.219, 0.282, 0.201, 0.231, 0.345, 0.397, 0.446, 0.49, 0.466, 0.478, 0.485, 0.549, 0.524, 0.548, 0.573, 0.588, 0.7, 0.843, 0.001],
    zone: [33, 46],
  },
};

export interface PatternPrediction {
  pattern: PatternKey | null;
  confidence: number;
  reason: string;
  scores: Partial<Record<PatternKey, number>>;
  second: PatternKey | null;
}

/**
 * 形态分类器：输入中心区间（绿）与相邻区间（红）的小时级价格序列，
 * 输出最可能的形态与置信度。
 */
export function predictPattern(greenHist: number[], redHist: number[]): PatternPrediction {
  const len = greenHist.length;
  if (len < 4) {
    return { pattern: null, confidence: 0, reason: '数据不足（需至少4小时价格历史）', scores: {}, second: null };
  }

  const gNow = greenHist[len - 1];
  const rNow = redHist[len - 1];

  // 绿色/红色连续领先小时数
  let greenLeadH = 0;
  for (let i = len - 1; i >= 0; i--) {
    if (greenHist[i] > redHist[i]) greenLeadH++;
    else break;
  }
  let redLeadH = 0;
  for (let i = len - 1; i >= 0; i--) {
    if (redHist[i] > greenHist[i]) redLeadH++;
    else break;
  }

  // 最近 36h 交叉次数
  let crossovers = 0;
  const s36 = Math.max(0, len - 36);
  for (let i = s36; i < len - 1; i++) {
    if (greenHist[i] > redHist[i] !== greenHist[i + 1] > redHist[i + 1]) crossovers++;
  }

  const lb12 = Math.min(12, len - 1);
  const redGain12 = rNow - redHist[len - 1 - lb12];
  const lb6 = Math.min(6, len - 1);
  const greenGain6 = gNow - greenHist[len - 1 - lb6];
  const rMax = Math.max(...redHist);

  const scores: Record<PatternKey, number> = {
    // A：全程碾压 - 绿全程领先，红无有效追赶
    A:
      (gNow > rNow ? 0.4 : 0) +
      (greenLeadH >= Math.min(24, len) ? 0.4 : (greenLeadH / Math.max(len, 1)) * 0.3) +
      (redGain12 < 0.07 ? 0.2 : 0),
    // B：快速确立 - 有拉锯，绿色 12-40h 前确立
    B:
      (gNow > rNow ? 0.3 : 0) +
      (crossovers >= 1 && crossovers <= 4 ? 0.35 : 0) +
      (greenLeadH >= 10 && greenLeadH < 40 ? 0.35 : 0),
    // C：中期反超 - 红先领，绿近 4-24h 反超
    C:
      (gNow > rNow ? 0.25 : 0.1) +
      (crossovers >= 1 ? 0.3 : 0) +
      (greenLeadH >= 2 && greenLeadH < 24 ? 0.4 : 0) +
      (gNow > rNow && redLeadH === 0 && greenLeadH < 24 ? 0.05 : 0),
    // D：末期追赶 - 红长期主导，绿近 6h 开始急拉
    D:
      (gNow < rNow || greenLeadH < 8 ? 0.25 : 0) +
      (greenGain6 > 0.09 ? 0.5 : greenGain6 > 0.04 ? 0.25 : 0) +
      (redLeadH >= 10 || rMax > 0.45 ? 0.25 : 0),
    // E：临门一脚 - 红长期大幅领先，绿趴底无动静
    E:
      (gNow < rNow ? 0.3 : 0) +
      (rMax > 0.55 ? 0.3 : 0) +
      (gNow < 0.2 && greenGain6 < 0.05 ? 0.4 : 0),
    // F：领先险守 - 绿领先但红末期急追
    F:
      (gNow > rNow ? 0.35 : 0) +
      (redGain12 > 0.1 ? 0.5 : redGain12 > 0.05 ? 0.25 : 0) +
      (greenLeadH >= 18 ? 0.15 : 0),
  };

  const sorted = (Object.entries(scores) as [PatternKey, number][]).sort((a, b) => b[1] - a[1]);
  const [bestKey, bestScore] = sorted[0];
  const secondKey = sorted[1][0];
  const confidence = Math.min(0.92, bestScore);

  const reasons: Record<PatternKey, string> = {
    A: `绿色已连续领先 ${greenLeadH}h，红色近12h仅涨 ${(redGain12 * 100).toFixed(0)}%，形态稳固`,
    B: `经历 ${crossovers} 次拉锯后绿色 ${greenLeadH}h 前确立领先，预计进入收敛阶段`,
    C: `绿色约 ${greenLeadH}h 前完成反超，处于确认窗口，关注后续是否稳固`,
    D: `绿色近6h涨幅 ${(greenGain6 * 100).toFixed(0)}%，末期追赶信号正在形成`,
    E: `绿色长期趴底 ${(gNow * 100).toFixed(1)}¢，近6h无有效拉升，等待推文数突破触发`,
    F: `绿色领先但红色近12h大幅上涨 ${(redGain12 * 100).toFixed(0)}%，末期追赶压力加剧`,
  };

  return { pattern: bestKey, confidence, reason: reasons[bestKey], scores, second: secondKey };
}

export interface AlignedSeries {
  timestamps: number[];
  green: number[];
  red: number[];
}

/**
 * 将两条 CLOB 价格序列按小时对齐，取最近 48 小时的共同时间点。
 */
export function alignHourlySeries(
  center: { t: number; p: number }[],
  comp: { t: number; p: number }[],
): AlignedSeries {
  const cMap = new Map(center.map((p) => [Math.round(p.t / 3600_000), p.p]));
  const rMap = new Map(comp.map((p) => [Math.round(p.t / 3600_000), p.p]));
  const allH = [...new Set([...cMap.keys(), ...rMap.keys()])].sort((a, b) => a - b);

  const timestamps: number[] = [];
  const green: number[] = [];
  const red: number[] = [];
  for (const h of allH.slice(-48)) {
    const g = cMap.get(h);
    const r = rMap.get(h);
    if (g !== undefined && r !== undefined) {
      timestamps.push(h * 3600_000);
      green.push(g);
      red.push(r);
    }
  }
  return { timestamps, green, red };
}

/** 拉取单个 token 的价格历史：先走同源代理，失败时回退 FastAPI 后端（dev 下 Next 代理偶发外网失败） */
export async function fetchPriceHistory(tokenId: string): Promise<{ t: number; p: number }[]> {
  const query = `tokenId=${encodeURIComponent(tokenId)}`;
  const backendBase = normalizeBrowserApiBase(
    process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api',
  );
  const urls = [`/api/quant/price-history?${query}`, `${backendBase}/quant/price-history?${query}`];

  let lastError: Error = new Error('price-history unavailable');
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) {
        lastError = new Error(`price-history api ${res.status}`);
        continue;
      }
      const body = (await res.json()) as { history?: { t: number; p: number | string }[] };
      return (body.history ?? []).map((p) => ({ t: p.t * 1000, p: Number(p.p) }));
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastError;
}
