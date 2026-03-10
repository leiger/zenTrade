'use client';

import { buildLinePath, formatUsd } from '@/lib/assets';
import type { HistoryPoint } from '@/types/portfolio';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PortfolioValueChartProps {
  title: string;
  points: HistoryPoint[];
}

export function PortfolioValueChart({ title, points }: PortfolioValueChartProps) {
  const path = buildLinePath(points, 620, 220);
  const latest = points.at(-1)?.value ?? 0;
  const start = points.at(0)?.value ?? latest;
  const delta = latest - start;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <div className="text-right">
          <p className="text-sm font-medium tabular-nums">{formatUsd(latest)}</p>
          <p className={`text-xs ${delta >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {delta >= 0 ? '+' : ''}{formatUsd(delta)}
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {points.length === 0 ? (
          <div className="rounded-lg border border-dashed px-3 py-16 text-center text-sm text-muted-foreground">
            暂无历史估值数据
          </div>
        ) : (
          <svg viewBox="0 0 620 240" className="h-[240px] w-full">
            <path
              d={path}
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="text-primary"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </CardContent>
    </Card>
  );
}
