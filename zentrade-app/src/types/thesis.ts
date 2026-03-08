/** 资产大类 */
export type AssetCategory = 'crypto' | 'us-stock' | 'a-stock' | 'hk-stock' | 'bond' | 'commodity';

/** 标签类别 */
export type TagCategory = 'buy' | 'sell';

/** 预设标签 */
export interface ThesisTag {
  id: string;
  label: string;
  category: TagCategory;
}

/** 时间轴选项 */
export type TimelineOption = '1D' | '1W' | '1M' | '1Q' | 'custom';

/** 回顾结论 */
export type Verdict = 'correct' | 'wrong' | 'neutral';

/** 跟进评论 */
export interface FollowUp {
  id: string;
  snapshotId: string;
  comment: string;
  verdict: Verdict;
  createdAt: string;
}

/** 看法快照 */
export interface Snapshot {
  id: string;
  thesisId: string;
  content: string;
  aiAnalysis: string;
  tags: ThesisTag[];
  timeline: TimelineOption;
  expectedReviewDate: string; // ISO date string
  createdAt: string;
  updatedAt: string;
  /** 相关链接 */
  links: string[];
  /** 观点受谁影响 */
  influencedBy: string;
  /** 回顾跟进 */
  followUp?: FollowUp;
}

/** 投资看法 */
export interface Thesis {
  id: string;
  name: string;
  category: AssetCategory;
  asset: string; // asset symbol, e.g. "BTC", "AAPL", or empty if only category selected
  description: string;
  tags: ThesisTag[];
  snapshots: Snapshot[];
  createdAt: string;
  updatedAt: string;
}
