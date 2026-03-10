'use client';

import { buildLinePath, formatUsd } from '@/lib/assets';
import type { HistoryPoint } from '@/types/portfolio';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface AssetPriceChartProps {
  title: string;
  points: HistoryPoint[];
  range: string;
  ranges: readonly string[];
  onRangeChange: (range: string) => void;
}

export function AssetPriceChart({
  title,
  points,
  range,
  ranges,
  onRangeChange,
}: AssetPriceChartProps) {
  const latest = points.at(-1)?.value ?? 0;
  const start = points.at(0)?.value ?? latest;
  const deltaPct = start > 0 ? ((latest - start) / start) * 100 : 0;
  const path = buildLinePath(points, 620, 220);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            最新价 {formatUsd(latest)} / 区间涨跌{' '}
            <span className={deltaPct >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
              {deltaPct >= 0 ? '+' : ''}{deltaPct.toFixed(2)}%
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {ranges.map((item) => (
            <Button
              key={item}
              type="button"
              variant={item === range ? 'default' : 'outline'}
              size="sm"
              onClick={() => onRangeChange(item)}
            >
              {item}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {points.length === 0 ? (
          <div className="rounded-lg border border-dashed px-3 py-16 text-center text-sm text-muted-foreground">
            暂无价格曲线数据
          </div>
        ) : (
          <svg viewBox="0 0 620 240" className="h-[240px] w-full">
            <path
              d={path}
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className={deltaPct >= 0 ? 'text-emerald-500' : 'text-rose-500'}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </CardContent>
    </Card>
  );
}
