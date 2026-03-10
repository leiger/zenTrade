'use client';

import type { AssetHolding } from '@/types/portfolio';
import { formatNumber, formatUsd, getPnlTone } from '@/lib/assets';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AccountBreakdownProps {
  holdings: AssetHolding[];
  onAdjust?: (holding: AssetHolding) => void;
}

export function AccountBreakdown({ holdings, onAdjust }: AccountBreakdownProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">分账户持仓</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {holdings.length === 0 ? (
          <div className="rounded-lg border border-dashed px-3 py-12 text-center text-sm text-muted-foreground">
            当前资产暂无持仓记录
          </div>
        ) : (
          holdings.map((holding) => (
            <div key={holding.id} className="rounded-lg border px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{holding.account.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {holding.account.type} / {holding.account.brokerOrPlatform || 'Manual'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium tabular-nums">{formatUsd(holding.marketValueUsd)}</p>
                  <p className={`text-xs ${getPnlTone(holding.unrealizedPnlUsd)}`}>
                    {formatUsd(holding.unrealizedPnlUsd)}
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                <div className="rounded-md bg-muted/40 px-2 py-1">
                  <p>数量</p>
                  <p className="font-medium text-foreground tabular-nums">{formatNumber(holding.quantity)}</p>
                </div>
                <div className="rounded-md bg-muted/40 px-2 py-1">
                  <p>均价</p>
                  <p className="font-medium text-foreground tabular-nums">
                    {formatNumber(holding.avgCost, 2)} {holding.costCurrency}
                  </p>
                </div>
                <div className="rounded-md bg-muted/40 px-2 py-1">
                  <p>状态</p>
                  <p className="font-medium text-foreground">{holding.status}</p>
                </div>
              </div>
              {onAdjust && (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    className="text-xs font-medium text-primary hover:underline"
                    onClick={() => onAdjust(holding)}
                  >
                    调整这个 holding
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
