'use client';

import { Landmark, TrendingUp, Wallet, Waypoints } from 'lucide-react';
import type { DashboardMetric } from '@/types/portfolio';
import { formatPercent, formatUsd, getPnlTone } from '@/lib/assets';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PortfolioSummaryCardsProps {
  summary: DashboardMetric;
}

export function PortfolioSummaryCards({ summary }: PortfolioSummaryCardsProps) {
  const items = [
    {
      label: '总资产',
      value: formatUsd(summary.totalValueUsd),
      meta: `成本 ${formatUsd(summary.totalCostBasisUsd)}`,
      icon: Wallet,
      tone: 'text-foreground',
    },
    {
      label: '未实现盈亏',
      value: formatUsd(summary.unrealizedPnlUsd),
      meta: formatPercent(summary.unrealizedPnlPct),
      icon: TrendingUp,
      tone: getPnlTone(summary.unrealizedPnlUsd),
    },
    {
      label: '持仓数',
      value: `${summary.holdingsCount}`,
      meta: '按 holding 统计',
      icon: Waypoints,
      tone: 'text-foreground',
    },
    {
      label: '账户数',
      value: `${summary.accountsCount}`,
      meta: '钱包 / 交易所 / 券商',
      icon: Landmark,
      tone: 'text-foreground',
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.label}>
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">{item.label}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-1">
              <p className={`text-2xl font-semibold tabular-nums ${item.tone}`}>{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.meta}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
