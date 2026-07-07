'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart2, Flame } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMuskQuantStore } from '@/lib/musk-quant-store';
import {
  buildHourlyMatrix,
  bjDateKey,
  bjHour,
  todayHourlyCounts,
  type QuantConstants,
} from '@/lib/musk-quant-engine';
import { cn } from '@/lib/utils';

const DAYS_SHOWN = 14;

/** 热力格颜色分档：0 灰，随条数加深 */
function cellClass(count: number): string {
  if (count === 0) return 'bg-muted/30';
  if (count <= 1) return 'bg-primary/15';
  if (count <= 3) return 'bg-primary/35';
  if (count <= 6) return 'bg-primary/60';
  return 'bg-primary/90';
}

/** 今日实际 vs 历史基线的 24 小时双层柱状图 */
function TodayVsBaseline({
  today,
  nowHour,
  constants,
}: {
  today: number[];
  nowHour: number;
  constants: QuantConstants;
}) {
  const baseline = constants.hourlyFraction.map((f) => f * constants.dailyBaseline);
  const denom = Math.max(...baseline, ...today, 1);
  const baselineLabel =
    constants.source === 'live' ? `近 ${constants.daysUsed} 天滚动均值` : '206 天冻结均值';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart2 className="h-4 w-4 text-primary" />
          今日节奏 vs 历史基线
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          前景 = 今日实际 · 背景 = 历史小时均值（{baselineLabel}）· 高峰 BJ 13–15 点
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div className="flex min-w-[640px] items-end gap-1" style={{ height: 120 }}>
          {baseline.map((base, h) => {
            const actual = h <= nowHour ? today[h] : 0;
            const isPast = h <= nowHour;
            // 今日柱颜色：超预期 1.5x 琥珀 / 低于 0.4x 红 / 正常主色
            const actualCls =
              actual > base * 1.5
                ? 'bg-amber-500'
                : isPast && actual < base * 0.4
                  ? 'bg-red-500/80'
                  : 'bg-primary';
            return (
              <div key={h} className="relative flex h-full flex-1 flex-col justify-end">
                <div
                  className="w-full rounded-t-sm bg-muted-foreground/20"
                  style={{ height: `${(base / denom) * 100}%` }}
                  title={`${h}:00 历史均值 ${base.toFixed(2)} 条`}
                />
                {isPast && actual > 0 && (
                  <div
                    className={cn('absolute bottom-0 left-[15%] w-[70%] rounded-t-sm', actualCls)}
                    style={{ height: `${(actual / denom) * 100}%` }}
                    title={`${h}:00 今日 ${actual} 条`}
                  />
                )}
                {h === nowHour && (
                  <span className="absolute -top-2 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-emerald-500" />
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex min-w-[640px] gap-1">
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} className="flex-1 text-center text-[9px] tabular-nums text-muted-foreground">
              {h}
            </span>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-primary" />实际（正常）</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-amber-500" />超预期（&gt;1.5x）</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-red-500/80" />低于预期 40%</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-muted-foreground/20" />历史基线</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function RhythmHeatmap() {
  const posts = useMuskQuantStore((s) => s.posts);
  const constants = useMuskQuantStore((s) => s.constants);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const { today, nowHour } = useMemo(
    () => ({ today: todayHourlyCounts(posts, now), nowHour: bjHour(now) }),
    [posts, now],
  );

  const { days, hourlyAvg } = useMemo(() => {
    const matrix = buildHourlyMatrix(posts);
    const keys: string[] = [];
    for (let i = DAYS_SHOWN - 1; i >= 0; i--) {
      keys.push(bjDateKey(new Date(now.getTime() - i * 86400_000)));
    }
    const days = keys.map((key) => ({
      key,
      row: matrix.get(key) ?? new Array<number>(24).fill(0),
    }));

    // 各小时历史均值（不含今天）
    const hourlyAvg = new Array<number>(24).fill(0);
    const histDays = days.slice(0, -1);
    if (histDays.length > 0) {
      for (const d of histDays) {
        for (let h = 0; h < 24; h++) hourlyAvg[h] += d.row[h];
      }
      for (let h = 0; h < 24; h++) hourlyAvg[h] /= histDays.length;
    }
    return { days, hourlyAvg };
  }, [posts, now]);

  return (
    <div className="space-y-4">
    <TodayVsBaseline today={today} nowHour={nowHour} constants={constants} />
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Flame className="h-4 w-4 text-primary" />
          发推节奏热力图（北京时间，近 {DAYS_SHOWN} 天）
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div className="min-w-[720px] space-y-1">
          {/* 小时刻度 */}
          <div className="flex items-center gap-1">
            <span className="w-16 shrink-0" />
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="flex-1 text-center text-[9px] text-muted-foreground tabular-nums">
                {h}
              </span>
            ))}
            <span className="w-10 shrink-0 text-right text-[9px] text-muted-foreground">合计</span>
          </div>

          {days.map(({ key, row }, idx) => {
            const total = row.reduce((a, b) => a + b, 0);
            const isToday = idx === days.length - 1;
            return (
              <div key={key} className="flex items-center gap-1">
                <span
                  className={cn(
                    'w-16 shrink-0 text-[10px] tabular-nums',
                    isToday ? 'font-semibold text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {key.slice(5)}
                  {isToday && ' ·今'}
                </span>
                {row.map((count, h) => (
                  <div
                    key={h}
                    title={`${key} ${h}:00 · ${count} 条`}
                    className={cn('h-4 flex-1 rounded-[3px] transition-colors', cellClass(count))}
                  />
                ))}
                <span className="w-10 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
                  {total}
                </span>
              </div>
            );
          })}

          {/* 历史小时均值行 */}
          <div className="flex items-center gap-1 pt-1.5 border-t border-border/50 mt-1.5">
            <span className="w-16 shrink-0 text-[10px] font-medium text-muted-foreground">均值</span>
            {hourlyAvg.map((avg, h) => (
              <span
                key={h}
                className="flex-1 text-center text-[9px] tabular-nums text-muted-foreground"
                title={`${h}:00 历史均值 ${avg.toFixed(1)} 条`}
              >
                {avg >= 0.05 ? avg.toFixed(1) : '·'}
              </span>
            ))}
            <span className="w-10 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
              {hourlyAvg.reduce((a, b) => a + b, 0).toFixed(0)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
    </div>
  );
}
