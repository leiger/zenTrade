/**
 * Musk Quant 量化分析模块类型定义
 * 数据源：Polymarket gamma API（市场/区间/价格） + xtracker API（推文流水）
 */

/** 单个价格区间（bucket），如 "<90" / "90-109" / "≥250" */
export interface QuantBucket {
  marketId: string;
  /** 区间显示名，来自 groupItemTitle */
  label: string;
  /** 区间下限（含），开口区间为 0 */
  min: number;
  /** 区间上限（含），开口区间为 Infinity（序列化时用 null） */
  max: number | null;
  /** Yes 价格（0-1），取 lastTradePrice 与 bid/ask 中值的可用者 */
  price: number;
  bestBid: number | null;
  bestAsk: number | null;
  /** 该区间市场的 24h 交易量 */
  volume: number;
  clobTokenIdYes: string | null;
}

/** 一期周度市场事件 */
export interface QuantEvent {
  id: string;
  slug: string;
  title: string;
  startDate: string;
  endDate: string;
  buckets: QuantBucket[];
}

/** xtracker 推文记录 */
export interface ElonPost {
  id: string;
  platformId: string;
  content: string;
  createdAt: string;
}

/** 本地持仓记录（localStorage 持久化，与原站口径一致） */
export interface QuantPosition {
  id: string;
  /** 所属市场 slug */
  eventSlug: string;
  /** 区间 label */
  bucketLabel: string;
  /** 买入单价（0-1） */
  entryPrice: number;
  /** 份数 */
  shares: number;
  /** 投入金额（entryPrice * shares，冗余存储便于展示） */
  cost: number;
  /** 仓位角色：中心主仓 / 翼仓 / 彩票仓（超额收益机会） */
  role: 'center' | 'wing' | 'lottery';
  note: string;
  createdAt: string;
}

/** 落点预测结果 */
export interface LandingPrediction {
  /** 预测最终发推总数 */
  predictedTotal: number;
  /** 已发数量 */
  currentCount: number;
  /** 今日已发 */
  todayCount: number;
  /** 剩余小时预期新增 */
  expectedRemaining: number;
  /** 预测不确定度（σ，条数） */
  sigma: number;
  /** 每日均值（历史基线） */
  dailyBaseline: number;
  /** 今日节奏相对基线的偏离（比率，1 = 正常） */
  todayRhythmRatio: number;
}

/** 单区间的概率与价值比评估 */
export interface BucketValuation {
  bucket: QuantBucket;
  /** 模型概率（正态/泊松混合） */
  modelProb: number;
  /** 价值比 VR = modelProb / price */
  vr: number;
  /** 估值标签 */
  judgement: 'strong_undervalued' | 'undervalued' | 'fair' | 'slightly_overvalued' | 'overvalued';
  /** 是否为模型中心区间 */
  isCenter: boolean;
}

/** 操作阶段（按距到期时间划分） */
export type QuantPhase =
  | 'early' // 前期布局（>72h 且未到建仓窗口）
  | 'main_entry' // 主力建仓窗口
  | 'hold_review' // 持仓评估阶段
  | 'contraction' // 后期收缩（翼仓减仓）
  | 'final'; // 最终阶段（<12h 翼仓清仓）

/** 会话节奏时段（北京时间） */
export interface SessionWindow {
  key: string;
  label: string;
  /** 北京时间小时范围 [start, end) */
  bjStart: number;
  bjEnd: number;
  /** 历史出现频率 0-1 */
  frequency: number;
  /** 出现时的均值条数 */
  meanPosts: number;
  description: string;
}

export interface QuantAlertSignal {
  level: 'info' | 'warning' | 'danger' | 'success';
  title: string;
  detail: string;
}
