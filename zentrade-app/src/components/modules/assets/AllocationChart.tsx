'use client';

import { buildAllocationGradient, formatUsd } from '@/lib/assets';
import type { AllocationSlice } from '@/types/portfolio';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AllocationChartProps {
  title: string;
  items: AllocationSlice[];
}

export function AllocationChart({ title, items }: AllocationChartProps) {
  const background = buildAllocationGradient(items);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="relative mx-auto h-40 w-40 shrink-0">
          <div className="h-full w-full rounded-full border" style={{ background }} />
          <div className="absolute inset-[26%] rounded-full bg-background" />
        </div>
        <div className="flex-1 space-y-2">
          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
              暂无可展示的数据
            </div>
          ) : (
            items.map((item, index) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{
                      background: [
                        'hsl(221 83% 53%)',
                        'hsl(160 84% 39%)',
                        'hsl(35 92% 51%)',
                        'hsl(262 83% 58%)',
                        'hsl(346 77% 49%)',
                      ][index % 5],
                    }}
                  />
                  <span>{item.label}</span>
                </div>
                <div className="text-right">
                  <p className="font-medium tabular-nums">{item.percentage.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">{formatUsd(item.valueUsd)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
