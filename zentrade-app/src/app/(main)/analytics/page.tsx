'use client';

import { useEffect, useMemo } from 'react';
import { BarChart3, BrainCircuit, Camera, Clock3, Target } from 'lucide-react';
import { useThesisStore } from '@/lib/store';
import { getCategoryConfig } from '@/constants/assets';
import {
  getAccuracyStats,
  getCategoryAnalytics,
  getInfluenceAnalytics,
  getReminderSummary,
  getTagAnalytics,
  getTimelineAnalytics,
} from '@/lib/thesis-tracker';
import { Badge } from '@/components/ui/badge';

export default function AnalyticsPage() {
  const theses = useThesisStore((state) => state.theses);
  const loading = useThesisStore((state) => state.loading);
  const fetchTheses = useThesisStore((state) => state.fetchTheses);

  useEffect(() => {
    fetchTheses();
  }, [fetchTheses]);

  const snapshots = useMemo(() => theses.flatMap((thesis) => thesis.snapshots), [theses]);
  const accuracy = useMemo(() => getAccuracyStats(snapshots), [snapshots]);
  const reminders = useMemo(() => getReminderSummary(theses), [theses]);
  const categoryAnalytics = useMemo(() => getCategoryAnalytics(theses), [theses]);
  const timelineAnalytics = useMemo(() => getTimelineAnalytics(theses), [theses]);
  const tagAnalytics = useMemo(() => getTagAnalytics(theses), [theses]);
  const influenceAnalytics = useMemo(() => getInfluenceAnalytics(theses), [theses]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <BarChart3 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          从 thesis、标签、时间跨度与影响来源几个维度复盘你的判断质量。
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard label="Theses" value={theses.length} icon={BrainCircuit} />
        <MetricCard label="Snapshots" value={snapshots.length} icon={Camera} />
        <MetricCard label="Pending Reviews" value={reminders.pending.length} icon={Clock3} accent="text-amber-500" />
        <MetricCard label="Accuracy" value={accuracy.rate !== null ? `${accuracy.rate}%` : '—'} icon={Target} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-xl border bg-background/70 p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">分类表现</h2>
            <Badge variant="outline" className="text-[10px] font-normal">
              按资产大类
            </Badge>
          </div>

          <div className="space-y-3">
            {categoryAnalytics.map((item) => {
              const category = getCategoryConfig(item.category as Parameters<typeof getCategoryConfig>[0]);
              return (
                <div key={item.category} className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{category?.icon ?? '•'}</span>
                      <p className="font-medium">{category?.label ?? item.category}</p>
                    </div>
                    <div className="text-sm font-medium text-muted-foreground">
                      正确率 {item.accuracy !== null ? `${item.accuracy}%` : '—'}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <StatChip label="Theses" value={item.theses} />
                    <StatChip label="Snapshots" value={item.snapshots} />
                    <StatChip label="Coverage" value={`${item.coverage}%`} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border bg-background/70 p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">时间跨度效果</h2>
            <Badge variant="outline" className="text-[10px] font-normal">
              按 timeline
            </Badge>
          </div>

          <div className="space-y-3">
            {timelineAnalytics.map((item) => (
              <div key={item.timeline} className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-medium">{item.timeline === 'custom' ? '自定义' : item.timeline}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.accuracy !== null ? `${item.accuracy}%` : '—'}
                  </p>
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground">
                  <StatChip label="总数" value={item.total} />
                  <StatChip label="正确" value={item.correct} />
                  <StatChip label="错误" value={item.wrong} />
                  <StatChip label="持平" value={item.neutral} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-xl border bg-background/70 p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">标签复盘</h2>
            <Badge variant="outline" className="text-[10px] font-normal">
              Top 8
            </Badge>
          </div>
          <div className="space-y-3">
            {tagAnalytics.slice(0, 8).map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">
                    使用 {item.total} 次，已复盘 {item.reviewed} 次
                  </p>
                </div>
                <Badge variant="outline" className="text-xs font-normal">
                  {item.accuracy !== null ? `${item.accuracy}%` : '—'}
                </Badge>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border bg-background/70 p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">影响来源</h2>
            <Badge variant="outline" className="text-[10px] font-normal">
              Top 8
            </Badge>
          </div>
          <div className="space-y-3">
            {influenceAnalytics.slice(0, 8).map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">
                    出现 {item.total} 次，已复盘 {item.reviewed} 次
                  </p>
                </div>
                <Badge variant="outline" className="text-xs font-normal">
                  {item.accuracy !== null ? `${item.accuracy}%` : '—'}
                </Badge>
              </div>
            ))}
          </div>
        </section>
      </div>

      {loading && theses.length === 0 && (
        <div className="rounded-xl border px-4 py-16 text-center text-sm text-muted-foreground">
          正在加载 Analytics…
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number | string;
  icon: typeof BrainCircuit;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border bg-background/70 px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className={`mt-2 text-3xl tabular-nums tracking-wide ${accent ?? ''}`}>{value}</p>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md bg-muted/40 px-2 py-1">
      <p>{label}</p>
      <p className="font-medium text-foreground tabular-nums">{value}</p>
    </div>
  );
}
