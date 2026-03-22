'use client';

import { useCallback, useEffect, useState } from 'react';
import { subDays } from 'date-fns';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DateRangePicker } from '@/components/ui/date-picker';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { fetchPostStats, type PostActivityStats } from '@/lib/xmonitor-api';
import { useXMonitorStore } from '@/lib/xmonitor-store';
import { cn } from '@/lib/utils';
import { PostTimeline } from '@/components/modules/x-monitor/PostTimeline';

const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));

type Preset = '1d' | '7d' | '14d' | '30d' | 'all';

function getPresetRange(preset: Preset): { start?: string; end?: string; label: string } {
  const now = new Date();
  const endIso = now.toISOString();
  switch (preset) {
    case '1d':
      return { start: subDays(now, 1).toISOString(), end: endIso, label: 'Last 24 Hours' };
    case '7d':
      return { start: subDays(now, 7).toISOString(), end: endIso, label: 'Last 7 Days' };
    case '14d':
      return { start: subDays(now, 14).toISOString(), end: endIso, label: 'Last 14 Days' };
    case '30d':
      return { start: subDays(now, 30).toISOString(), end: endIso, label: 'Last 30 Days' };
    case 'all':
      return { label: 'All Time' };
  }
}

function cellColor(value: number, max: number): string {
  if (max === 0 || value === 0) return 'bg-muted/30 text-muted-foreground/40';
  const ratio = value / max;
  if (ratio > 0.75) return 'bg-amber-400/90 text-amber-950';
  if (ratio > 0.5) return 'bg-amber-400/60 text-amber-950';
  if (ratio > 0.25) return 'bg-amber-500/30 text-foreground/70';
  return 'bg-amber-600/15 text-foreground/50';
}

export function PostActivityHeatmap() {
  const [preset, setPreset] = useState<Preset>('all');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [isCustom, setIsCustom] = useState(false);
  const [stats, setStats] = useState<PostActivityStats | null>(null);
  const [loading, setLoading] = useState(true);

  const status = useXMonitorStore((s) => s.status);
  const lastPolledAt = status?.lastPolledAt;

  const loadStats = useCallback(async (start?: string, end?: string) => {
    setLoading(true);
    try {
      const data = await fetchPostStats(start, end);
      setStats(data);
    } catch (e) {
      console.error('Failed to load post stats', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount and whenever preset or data updates
  useEffect(() => {
    if (isCustom) return;
    const range = getPresetRange(preset);
    loadStats(range.start, range.end);
  }, [preset, isCustom, loadStats, lastPolledAt]);

  // Load when custom range or data updates
  useEffect(() => {
    if (!isCustom || !customFrom || !customTo) return;
    loadStats(customFrom.toISOString(), customTo.toISOString());
  }, [isCustom, customFrom, customTo, loadStats, lastPolledAt]);

  const handlePreset = (p: Preset) => {
    setIsCustom(false);
    setPreset(p);
  };

  const handleRangeChange = (from: Date | undefined, to: Date | undefined) => {
    setCustomFrom(from);
    setCustomTo(to);
    if (from && to) {
      setIsCustom(true);
    }
  };

  const rangeLabel =
    isCustom && customFrom && customTo ? `Custom Range` : getPresetRange(preset).label;

  const maxVal = stats ? Math.max(...stats.matrix.flat(), 1) : 1;
  const maxHourVal = stats ? Math.max(...stats.hour_totals, 1) : 1;

  return (
    <div className="space-y-4">
      {/* Time window bar */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Data Window
        </span>
        <div className="flex items-center gap-1">
          {(['1d', '7d', '14d', '30d', 'all'] as Preset[]).map((p) => (
            <button
              key={p}
              onClick={() => handlePreset(p)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-all',
                !isCustom && preset === p
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {p === 'all' ? 'ALL TIME' : p.toUpperCase()}
            </button>
          ))}
        </div>

        <DateRangePicker
          from={customFrom}
          to={customTo}
          onRangeChange={handleRangeChange}
          placeholder="Custom range"
        />

        {stats && (
          <span className="text-xs text-muted-foreground ml-auto">
            <span className="font-semibold text-foreground tabular-nums">
              {stats.total_posts.toLocaleString()}
            </span>{' '}
            posts · {rangeLabel}
          </span>
        )}
      </div>

      {/* Sub-tabs for different views */}
      {loading && !stats ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      ) : stats ? (
        <Tabs defaultValue="day-hour" className="w-full">
          <TabsList className="h-6">
            <TabsTrigger value="day-hour" className="text-xs px-3 h-5">
              Day × Hour
            </TabsTrigger>
            <TabsTrigger value="hourly" className="text-xs px-3 h-5">
              Hourly Heatmap
            </TabsTrigger>
            <TabsTrigger value="timeline" className="text-xs px-3 h-5">
              Timeline
            </TabsTrigger>
          </TabsList>

          <TabsContent value="day-hour" className="mt-3">
            <DayHourMatrix stats={stats} maxVal={maxVal} />
          </TabsContent>

          <TabsContent value="hourly" className="mt-3">
            <HourlyHeatmap stats={stats} maxVal={maxHourVal} />
          </TabsContent>

          <TabsContent value="timeline" className="mt-3">
            <PostTimeline
              startDate={isCustom ? customFrom?.toISOString() : getPresetRange(preset).start}
              endDate={isCustom ? customTo?.toISOString() : getPresetRange(preset).end}
            />
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}

/* ── Day × Hour Matrix ──────────────────────────────────── */

function DayHourMatrix({ stats, maxVal }: { stats: PostActivityStats; maxVal: number }) {
  return (
    <div className="rounded-xl border bg-card p-4 overflow-x-auto">
      <h3 className="text-sm font-semibold mb-3 italic text-foreground/80">
        Day of Week × Hour Matrix
      </h3>
      <table className="w-full border-separate border-spacing-[3px]">
        <thead>
          <tr>
            <th className="w-12 text-[10px] font-medium text-muted-foreground text-left">Day</th>
            {HOURS.map((h) => (
              <th
                key={h}
                className="text-[10px] font-medium text-muted-foreground text-center w-[38px]"
              >
                {h}
              </th>
            ))}
            <th className="text-[10px] font-semibold text-foreground/70 text-center w-[48px]">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {DAY_LABELS.map((day, di) => (
            <tr key={day}>
              <td className="text-[11px] font-semibold text-muted-foreground pr-1">{day}</td>
              {stats.matrix[di].map((val, hi) => (
                <td
                  key={hi}
                  className={cn(
                    'text-center text-[11px] font-medium rounded-md py-1.5 transition-colors',
                    cellColor(val, maxVal)
                  )}
                >
                  {val || ''}
                </td>
              ))}
              <td className="text-center text-[11px] font-bold text-amber-500 tabular-nums">
                {stats.day_totals[di].toLocaleString()}
              </td>
            </tr>
          ))}
          {/* Totals row */}
          <tr>
            <td className="text-[10px] font-medium uppercase text-muted-foreground/60">Total</td>
            {stats.hour_totals.map((val, hi) => (
              <td
                key={hi}
                className="text-center text-[10px] font-semibold text-muted-foreground tabular-nums"
              >
                {val}
              </td>
            ))}
            <td className="text-center text-[11px] font-extrabold text-amber-400 tabular-nums">
              {stats.total_posts.toLocaleString()}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ── Hourly Heatmap ─────────────────────────────────────── */

const BUCKET_LABELS = Array.from({ length: 12 }, (_, i) => {
  const start = String(i * 5).padStart(2, '0');
  const end = String(i * 5 + 4).padStart(2, '0');
  return `${start}–${end}`;
});

function HourlyHeatmap({ stats, maxVal }: { stats: PostActivityStats; maxVal: number }) {
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);

  return (
    <div className="rounded-xl border bg-card p-4 overflow-x-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h3 className="text-sm font-semibold italic text-foreground/80 flex items-center gap-2">
          Hourly Post Distribution
          <span className="text-[10px] font-normal text-muted-foreground not-italic">
            (Hover a bar for 5-min breakdown)
          </span>
        </h3>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/70">
              Peak Hour
            </span>
            <span className="text-xs font-bold tabular-nums text-foreground">
              {HOURS[stats.hour_totals.indexOf(Math.max(...stats.hour_totals))]}:00
            </span>
          </div>
          <div className="h-3 w-[1px] bg-border/60" />
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/70">
              Peak Count
            </span>
            <span className="text-xs font-bold tabular-nums text-foreground">
              {Math.max(...stats.hour_totals).toLocaleString()}
            </span>
          </div>
          <div className="h-3 w-[1px] bg-border/60" />
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/70">
              Avg / Hr
            </span>
            <span className="text-xs font-bold tabular-nums text-foreground">
              {Math.round(stats.total_posts / 24).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <div className="flex gap-0">
        {/* Bar chart */}
        <div className="flex-1">
          <div className="flex items-end gap-1 h-[180px] mb-2">
            {stats.hour_totals.map((val, i) => {
              const ratio = maxVal > 0 ? val / maxVal : 0;
              const heightPct = Math.max(ratio * 100, 2);

              if (val === 0) {
                return (
                  <div
                    key={i}
                    className="flex-1 flex flex-col items-center justify-end h-full cursor-default"
                    onMouseEnter={() => setHoveredHour(i)}
                    onMouseLeave={() => setHoveredHour(null)}
                  >
                    <span className="text-[9px] font-medium text-foreground/70 tabular-nums mb-1"></span>
                    <div
                      className={cn(
                        'w-full rounded-t-sm transition-all bg-muted/30',
                        hoveredHour === i ? 'ring-2 ring-primary/50' : ''
                      )}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                );
              }

              return (
                <HoverCard key={i} openDelay={0} closeDelay={0}>
                  <HoverCardTrigger asChild>
                    <div
                      className="flex-1 flex flex-col items-center justify-end h-full cursor-pointer"
                      onMouseEnter={() => setHoveredHour(i)}
                      onMouseLeave={() => setHoveredHour(null)}
                    >
                      <span className="text-[9px] font-medium text-foreground/70 tabular-nums mb-1">
                        {val}
                      </span>
                      <div
                        className={cn(
                          'w-full rounded-t-sm transition-all',
                          hoveredHour === i ? 'ring-2 ring-primary/50' : '',
                          ratio > 0.75
                            ? 'bg-amber-400'
                            : ratio > 0.5
                              ? 'bg-amber-400/70'
                              : ratio > 0.25
                                ? 'bg-amber-500/40'
                                : 'bg-amber-600/20'
                        )}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                  </HoverCardTrigger>
                  <HoverCardContent
                    side="top"
                    sideOffset={8}
                    className="w-[200px] p-3 pointer-events-none"
                  >
                    <BucketDetail hour={i} buckets={stats.minute_buckets[i]} hourTotal={val} />
                  </HoverCardContent>
                </HoverCard>
              );
            })}
          </div>

          {/* Hour labels */}
          <div className="flex gap-1">
            {HOURS.map((h, i) => (
              <div
                key={h}
                className={cn(
                  'flex-1 text-center text-[10px] font-medium transition-colors',
                  hoveredHour === i ? 'text-primary font-bold' : 'text-muted-foreground'
                )}
              >
                {h}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 5-Minute Bucket Detail Panel ───────────────────────── */

function BucketDetail({
  hour,
  buckets,
  hourTotal,
}: {
  hour: number;
  buckets: number[];
  hourTotal: number;
}) {
  const maxBucket = Math.max(...buckets, 1);

  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-semibold text-foreground mb-2">
        {HOURS[hour]}:00 – {HOURS[hour]}:59
        <span className="text-muted-foreground font-normal ml-1.5">({hourTotal} posts)</span>
      </div>
      {BUCKET_LABELS.map((label, bi) => {
        const count = buckets[bi];
        const pct = hourTotal > 0 ? ((count / hourTotal) * 100).toFixed(1) : '0.0';
        const barWidth = maxBucket > 0 ? (count / maxBucket) * 100 : 0;
        return (
          <div key={bi} className="flex items-center gap-1.5">
            <span className="text-[9px] font-medium text-muted-foreground w-[34px] shrink-0 tabular-nums">
              :{label.split('–')[0]}
            </span>
            <div className="flex-1 h-[14px] bg-muted/30 rounded-sm overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-sm transition-all',
                  count > 0 ? 'bg-amber-400/70' : ''
                )}
                style={{ width: `${barWidth}%` }}
              />
            </div>
            <span className="text-[9px] font-semibold tabular-nums w-[22px] text-right text-foreground/80">
              {count}
            </span>
            <span className="text-[8px] text-muted-foreground w-[32px] text-right tabular-nums">
              {pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
