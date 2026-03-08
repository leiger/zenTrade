import { ThesisTag, TimelineOption } from '@/types/thesis';

/** 买入理由预设标签 */
export const BUY_TAGS: ThesisTag[] = [
  { id: 'buy-fundamental', label: '基本面驱动', category: 'buy' },
  { id: 'buy-technical', label: '技术面破位/支撑', category: 'buy' },
  { id: 'buy-dca', label: '定投计划执行', category: 'buy' },
  { id: 'buy-sentiment', label: '情绪面超卖/FUD', category: 'buy' },
  { id: 'buy-narrative', label: '叙事跟踪', category: 'buy' },
];

/** 卖出理由预设标签 */
export const SELL_TAGS: ThesisTag[] = [
  { id: 'sell-target', label: '达到目标位', category: 'sell' },
  { id: 'sell-invalidated', label: '逻辑证伪', category: 'sell' },
  { id: 'sell-stoploss', label: '防守止损', category: 'sell' },
  { id: 'sell-rebalance', label: '再平衡需求', category: 'sell' },
];

/** 所有预设标签 */
export const ALL_TAGS: ThesisTag[] = [...BUY_TAGS, ...SELL_TAGS];

/** 时间轴选项（预设） */
export const TIMELINE_PRESETS: { value: TimelineOption; label: string; description: string }[] = [
  { value: '1D', label: '1 天', description: '明天回顾' },
  { value: '1W', label: '1 周', description: '下周回顾' },
  { value: '1M', label: '1 月', description: '下月回顾' },
  { value: '1Q', label: '1 季度', description: '下季度回顾' },
];

/** 投资分区预设 */
export const ZONE_PRESETS = [
  'BTC 长线',
  'ETH 生态',
  'SOL 生态实验',
  'DeFi 策略',
  'NFT / GameFi',
  '稳定币理财',
  '山寨币投机',
  '法币储备',
];
