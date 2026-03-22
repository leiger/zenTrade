'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Link2 } from 'lucide-react';
import type { Account, AssetDetail as AssetDetailType, AssetHolding } from '@/types/portfolio';
import { createAdjustment, createHolding, fetchAccounts, fetchAssetDetail } from '@/lib/api';
import { CHART_RANGES, formatNumber, formatUsd, getPnlTone } from '@/lib/assets';
import { AssetPriceChart } from '@/components/modules/assets/AssetPriceChart';
import { AccountBreakdown } from '@/components/modules/assets/AccountBreakdown';
import { AdjustmentTimeline } from '@/components/modules/assets/AdjustmentTimeline';
import { HoldingAdjustmentSheet } from '@/components/modules/assets/HoldingAdjustmentSheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AssetDetailPage() {
  const params = useParams();
  const category = params.category as string;
  const symbol = params.symbol as string;

  const [detail, setDetail] = useState<AssetDetailType | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [range, setRange] = useState<string>('3M');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedHolding, setSelectedHolding] = useState<AssetHolding | undefined>();

  const loadDetail = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [nextDetail, nextAccounts] = await Promise.all([
        fetchAssetDetail(category, symbol),
        fetchAccounts(),
      ]);
      setDetail(nextDetail);
      setAccounts(nextAccounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load asset detail');
    } finally {
      setLoading(false);
    }
  }, [category, symbol]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const pricePoints = useMemo(() => {
    if (!detail) return [];
    if (range === '3M') return detail.priceHistory;

    const sizeMap: Record<string, number> = {
      '1D': 8,
      '1W': 7,
      '1M': 12,
      '3M': detail.priceHistory.length,
      '1Y': detail.priceHistory.length,
    };
    const targetSize = sizeMap[range] ?? detail.priceHistory.length;
    return detail.priceHistory.slice(-targetSize);
  }, [detail, range]);

  if (loading && !detail) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="rounded-xl border border-dashed px-4 py-16 text-center text-sm text-muted-foreground">
        {error ?? '暂时无法加载资产详情'}
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1.5 text-muted-foreground">
              <Link href="/assets">
                <ArrowLeft className="h-4 w-4" />
                返回 Assets
              </Link>
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{detail.asset.name}</h1>
              <Badge variant="secondary" className="font-mono font-normal">
                {detail.asset.symbol}
              </Badge>
              <Badge variant="outline" className="font-normal">
                {detail.asset.category}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              当前总数量 {formatNumber(detail.asset.totalQuantity)}，来自 {detail.asset.accountsCount} 个账户。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedHolding(undefined);
                setSheetOpen(true);
              }}
            >
              新增该资产持仓
            </Button>
            {detail.holdings[0] && (
              <Button
                onClick={() => {
                  setSelectedHolding(detail.holdings[0]);
                  setSheetOpen(true);
                }}
              >
                调整持仓
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <AssetPriceChart
            title="价格走势"
            points={pricePoints}
            range={range}
            ranges={CHART_RANGES}
            onRangeChange={setRange}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">资产摘要</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border px-4 py-3">
                <p className="text-xs text-muted-foreground">当前市值</p>
                <p className="mt-1 text-3xl tabular-nums tracking-wide">{formatUsd(detail.asset.marketValueUsd)}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <MetricBlock label="未实现盈亏" value={formatUsd(detail.asset.unrealizedPnlUsd)} tone={getPnlTone(detail.asset.unrealizedPnlUsd)} />
                <MetricBlock label="平均成本" value={`${formatNumber(detail.asset.costBasisUsd / Math.max(detail.asset.totalQuantity, 1), 2)} USD`} />
                <MetricBlock label="最新价格" value={`${formatNumber(detail.asset.marketPrice, 2)} ${detail.asset.marketPriceCurrency}`} />
                <MetricBlock label="持仓数" value={`${detail.asset.holdingsCount}`} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <AccountBreakdown
            holdings={detail.holdings}
            onAdjust={(holding) => {
              setSelectedHolding(holding);
              setSheetOpen(true);
            }}
          />
          <AssetPriceChart
            title="估值快照"
            points={detail.valuationHistory}
            range="3M"
            ranges={['3M']}
            onRangeChange={() => undefined}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
          <AdjustmentTimeline adjustments={detail.adjustments} />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">关联 Thesis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {detail.relatedTheses.length === 0 ? (
                <div className="rounded-lg border border-dashed px-3 py-12 text-center text-sm text-muted-foreground">
                  当前资产还没有关联 thesis
                </div>
              ) : (
                detail.relatedTheses.map((thesis) => (
                  <Link
                    key={thesis.id}
                    href={`/thesis/${thesis.id}`}
                    className="block rounded-lg border px-4 py-3 transition-colors hover:bg-accent/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{thesis.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{thesis.description || '暂无描述'}</p>
                      </div>
                      <Link2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <HoldingAdjustmentSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        accounts={accounts}
        holding={selectedHolding}
        defaultCategory={detail.asset.category}
        defaultSymbol={detail.asset.symbol}
        defaultName={detail.asset.name}
        onCreateHolding={async (payload) => {
          await createHolding(payload);
          await loadDetail();
        }}
        onCreateAdjustment={async (holdingId, payload) => {
          await createAdjustment(holdingId, payload);
          await loadDetail();
        }}
      />
    </>
  );
}

function MetricBlock({
  label,
  value,
  tone = 'text-foreground',
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 font-medium tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}
