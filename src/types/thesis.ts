/** 标签类别 */
export type TagCategory = 'buy' | 'sell';

/** 预设标签 */
export interface ThesisTag {
  id: string;
  label: string;
  category: TagCategory;
}

/** 时间轴选项 */
export type TimelineOption = '1D' | '1W' | '1M' | '1Q';

/** 看法快照 */
export interface Snapshot {
  id: string;
  thesisId: string;
  content: string;
  tags: ThesisTag[];
  timeline: TimelineOption;
  expectedReviewDate: string; // ISO date string
  createdAt: string;
}

/** 投资看法 / 策略分区 */
export interface Thesis {
  id: string;
  name: string;
  description: string;
  zone: string; // 投资分区，如 "BTC 长线"、"SOL 生态实验"
  tags: ThesisTag[];
  snapshots: Snapshot[];
  createdAt: string;
  updatedAt: string;
}
