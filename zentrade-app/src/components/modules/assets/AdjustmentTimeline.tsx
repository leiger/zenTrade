'use client';

import { ArrowDownLeft, ArrowUpRight, Clock3 } from 'lucide-react';
import type { Adjustment } from '@/types/portfolio';
import { ADJUSTMENT_TYPE_OPTIONS, formatNumber, formatRelativeTime } from '@/lib/assets';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface AdjustmentTimelineProps {
  adjustments: Adjustment[];
}

export function AdjustmentTimeline({ adjustments }: AdjustmentTimelineProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">调整记录</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {adjustments.length === 0 ? (
          <div className="rounded-lg border border-dashed px-3 py-12 text-center text-sm text-muted-foreground">
            还没有 adjustment 记录
          </div>
        ) : (
          adjustments.map((adjustment) => {
            const option = ADJUSTMENT_TYPE_OPTIONS.find((item) => item.value === adjustment.type);
            const isIn = adjustment.quantityDelta >= 0;
            return (
              <div key={adjustment.id} className="rounded-lg border px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 rounded-full p-2 ${isIn ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                      {isIn ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{option?.label ?? adjustment.type}</p>
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {isIn ? '+' : ''}{formatNumber(adjustment.quantityDelta)}
                        </Badge>
                        {adjustment.relatedThesisId && (
                          <Badge variant="secondary" className="text-[10px] font-normal">
                            关联 Thesis
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        单价 {formatNumber(adjustment.unitPrice, 2)} {adjustment.feeCurrency}
                      </p>
                      {adjustment.notes && (
                        <p className="text-sm text-foreground/80">{adjustment.notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <div className="inline-flex items-center gap-1">
                      <Clock3 className="h-3 w-3" />
                      {formatRelativeTime(adjustment.executedAt)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
