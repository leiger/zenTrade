'use client';

import { useEffect, useState } from 'react';
import { Landmark, Wallet } from 'lucide-react';
import type { PortfolioDashboard as PortfolioDashboardType } from '@/types/portfolio';
import { createAdjustment, createHolding, fetchAssetDashboard } from '@/lib/api';
import { formatNumber, formatUsd } from '@/lib/assets';
import { PortfolioSummaryCards } from '@/components/modules/assets/PortfolioSummaryCards';
import { PortfolioValueChart } from '@/components/modules/assets/PortfolioValueChart';
import { AllocationChart } from '@/components/modules/assets/AllocationChart';
import { HoldingsTable } from '@/components/modules/assets/HoldingsTable';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AssetsPage() {
  const [dashboard, setDashboard] = useState<PortfolioDashboardType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const nextDashboard = await fetchAssetDashboard();
      setDashboard(nextDashboard);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assets dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading && !dashboard) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="rounded-xl border border-dashed px-4 py-16 text-center text-sm text-muted-foreground">
        {error ?? '暂时无法加载资产看板'}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <Wallet className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Assets Dashboard</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          用数量维护真实持仓，系统按 USD 实时估值，并保留 adjustment 与估值快照。
        </p>
      </div>

      <PortfolioSummaryCards summary={dashboard.summary} />

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <PortfolioValueChart title="Portfolio Value" points={dashboard.history} />

        <div className="space-y-4">
          <AllocationChart title="按资产类别分布" items={dashboard.categoryAllocation} />
          <AllocationChart title="按账户分布" items={dashboard.accountAllocation} />
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Top Holdings</CardTitle>
          <Badge variant="outline" className="text-[10px] font-normal">
            按市值排序
          </Badge>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {dashboard.topHoldings.map((asset) => (
            <div key={asset.id} className="rounded-lg border p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{asset.name}</p>
                  <p className="text-xs text-muted-foreground">{asset.symbol}</p>
                </div>
                <Landmark className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-lg font-semibold tabular-nums">{formatUsd(asset.marketValueUsd)}</p>
                <p className="text-xs text-muted-foreground">
                  数量 {formatNumber(asset.totalQuantity)} / {asset.accountsCount} 个账户
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <HoldingsTable
        holdings={dashboard.holdings}
        accounts={dashboard.accounts}
        onCreateHolding={async (payload) => {
          await createHolding(payload);
          await loadDashboard();
        }}
        onCreateAdjustment={async (holdingId, payload) => {
          await createAdjustment(holdingId, payload);
          await loadDashboard();
        }}
      />
    </div>
  );
}
