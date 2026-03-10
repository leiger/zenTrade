import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type {
  AdjustmentType,
  AssetHolding,
  AssetSummary,
  HistoryPoint,
} from '@/types/portfolio';

export const CHART_RANGES = ['1D', '1W', '1M', '3M', '1Y'] as const;

export const ADJUSTMENT_TYPE_OPTIONS: Array<{
  value: AdjustmentType;
  label: string;
  direction: 'in' | 'out';
}> = [
  { value: 'buy', label: '买入', direction: 'in' },
  { value: 'sell', label: '卖出', direction: 'out' },
  { value: 'transfer_in', label: '转入', direction: 'in' },
  { value: 'transfer_out', label: '转出', direction: 'out' },
  { value: 'airdrop', label: '空投', direction: 'in' },
  { value: 'dividend_reinvest', label: '分红再投', direction: 'in' },
  { value: 'manual_add', label: '手动增加', direction: 'in' },
  { value: 'manual_reduce', label: '手动减少', direction: 'out' },
];

export function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

export function formatNumber(value: number, maximumFractionDigits = 4) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits,
  }).format(value);
}

export function formatPercent(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export function formatRelativeTime(value: string) {
  return formatDistanceToNow(new Date(value), { addSuffix: true, locale: zhCN });
}

export function getPnlTone(value: number) {
  if (value > 0) return 'text-emerald-500';
  if (value < 0) return 'text-rose-500';
  return 'text-muted-foreground';
}

export function buildLinePath(points: HistoryPoint[], width: number, height: number) {
  if (points.length === 0) return '';

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return points
    .map((point, index) => {
      const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
      const y = height - ((point.value - min) / range) * height;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

export function buildAllocationGradient(items: Array<{ percentage: number }>) {
  if (items.length === 0) {
    return 'conic-gradient(from 180deg, hsl(var(--muted)) 0deg 360deg)';
  }

  const palette = [
    'hsl(var(--chart-1, 221 83% 53%))',
    'hsl(var(--chart-2, 160 84% 39%))',
    'hsl(var(--chart-3, 35 92% 51%))',
    'hsl(var(--chart-4, 262 83% 58%))',
    'hsl(var(--chart-5, 346 77% 49%))',
  ];

  let start = 0;
  const stops = items.map((item, index) => {
    const end = start + item.percentage * 3.6;
    const color = palette[index % palette.length];
    const segment = `${color} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`;
    start = end;
    return segment;
  });

  return `conic-gradient(from 180deg, ${stops.join(', ')})`;
}

export function sortHoldingsByValue(holdings: AssetHolding[]) {
  return [...holdings].sort((a, b) => b.marketValueUsd - a.marketValueUsd);
}

export function sortAssetsByValue(assets: AssetSummary[]) {
  return [...assets].sort((a, b) => b.marketValueUsd - a.marketValueUsd);
}
