'use client';

import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Crosshair,
  Pin,
  Shield,
  Sparkles,
  Star,
  Target,
  TrendingUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ImpactIcon, RhythmIcon, TimingIcon, WindowIcon } from '@/components/modules/musk-quant/QuantIcons';
import { useMuskQuantAnalysis } from '@/hooks/useMuskQuantAnalysis';
import { type BucketProb } from '@/lib/musk-quant-engine';
import type { QuantAlertSignal } from '@/types/musk-quant';
import { cn } from '@/lib/utils';

const SIGNAL_STYLES: Record<QuantAlertSignal['level'], string> = {
  danger: 'border-red-500/30 bg-red-500/5 text-red-600 dark:text-red-400',
  warning: 'border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400',
  success: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400',
  info: 'border-border bg-muted/20 text-foreground',
};

function vrColor(vr: number): string {
  if (vr >= 1.5) return 'text-emerald-500 font-semibold';
  if (vr >= 1.0) return 'text-foreground';
  return 'text-red-500/80';
}

function BucketRow({ p, muDisplay }: { p: BucketProb; muDisplay: number }) {
  const price = p.askPct;
  const highlight = p.isCenter
    ? 'border-emerald-500/40 bg-emerald-500/5'
    : p.vr >= 1.5 && price <= 20
      ? 'border-amber-500/40 bg-amber-500/5'
      : 'border-border/50';
  void muDisplay;
  return (
    <div className={cn('flex items-center justify-between rounded-lg border px-4 py-2.5', highlight)}>
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm font-medium tabular-nums">{p.bucket.label}</span>
        {p.isCenter && (
          <Badge variant="outline" className="h-5 px-1.5 text-xs border-emerald-500/50 text-emerald-500">
            CENTER
          </Badge>
        )}
        {p.vr >= 1.5 && (
          <span className="flex items-center text-amber-500">
            <Star className="h-3.5 w-3.5 fill-current" />
            {p.vr >= 2 && <Star className="h-3.5 w-3.5 fill-current" />}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4 text-sm tabular-nums">
        <span className="text-muted-foreground w-16 text-right">{price.toFixed(1)}¢</span>
        <span className={cn('w-16 text-right', vrColor(p.vr))}>VR {p.vr.toFixed(2)}</span>
        <span className="text-muted-foreground w-14 text-right">
          {price > 0 ? `${(100 / price).toFixed(1)}x` : '—'}
        </span>
      </div>
    </div>
  );
}

export function MarketOverview() {
  const analysis = useMuskQuantAnalysis();

  if (!analysis) {
    return (
      <div className="rounded-lg border border-border/50 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
        暂无市场数据，请刷新或选择其他市场
      </div>
    );
  }

  const {
    prediction, probs, daily, signals, phasePlan, lottery, badge,
    window: win, timing, rhythmBlocks, impacts, pace,
  } = analysis;

  const byMin = [...probs].sort((a, b) => a.bucket.min - b.bucket.min);
  const activeAround = byMin.filter((p) => p.status !== 'busted').slice(0, 6);
  const maxDaily = Math.max(1, ...daily.map((d) => d.count));

  return (
    <div className="space-y-4">
      {/* 实时操作信号 */}
      {signals.length > 0 && (
        <div className="space-y-2">
          {signals.map((s, i) => (
            <div key={i} className={cn('rounded-lg border px-5 py-3.5', SIGNAL_STYLES[s.level])}>
              <p className="text-base font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {s.title}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-foreground/80">{s.detail}</p>
            </div>
          ))}
        </div>
      )}

      {/* 预测卡 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              落点预测
            </span>
            <Badge
              variant="outline"
              className={cn(
                'text-xs',
                badge.tone === 'teal' && 'border-teal-500/50 text-teal-500',
                badge.tone === 'amber' && 'border-amber-500/50 text-amber-500',
                badge.tone === 'rose' && 'border-rose-500/50 text-rose-500',
              )}
            >
              {badge.label}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
            <div>
              <p className="text-4xl font-bold tabular-nums">~{prediction.displayLanding} 条</p>
              <p className="text-sm text-muted-foreground mt-1">
                线性 µ {prediction.muLinear.toFixed(1)} · 小时加权 µ {prediction.muHourly.toFixed(1)} · 会话修正{' '}
                {prediction.totalMuAdjust >= 0 ? '+' : ''}
                {prediction.totalMuAdjust}
              </p>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs uppercase tracking-wider text-muted-foreground/80">预测精准度</span>
              <span className="text-xl font-bold tabular-nums">{prediction.confidence}%</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs uppercase tracking-wider text-muted-foreground/80">日均节奏</span>
              <span className="text-xl font-bold tabular-nums">{pace.toFixed(1)}/d</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs uppercase tracking-wider text-muted-foreground/80">当前窗口</span>
              <span className="flex items-center gap-1.5 text-base font-semibold">
                <WindowIcon tone={win.tone} />
                {win.label}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* 本期每日发推 */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-primary" />
              本期每日发推
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {daily.length === 0 && (
              <p className="text-xs text-muted-foreground">暂无本期每日数据</p>
            )}
            {daily.map((d, i) => {
              const ratio = d.count / maxDaily;
              const isToday = i === daily.length - 1;
              return (
                <div key={d.date} className="flex items-center gap-2">
                  <span className={cn('w-14 shrink-0 text-sm tabular-nums', isToday ? 'font-semibold' : 'text-muted-foreground')}>
                    {d.date.slice(5)}
                  </span>
                  <div className="h-4 flex-1 rounded-sm bg-muted/30 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-sm',
                        ratio >= 0.8 ? 'bg-emerald-500' : ratio >= 0.6 ? 'bg-emerald-500/75' : ratio >= 0.4 ? 'bg-emerald-500/55' : ratio >= 0.2 ? 'bg-emerald-500/35' : 'bg-emerald-500/20',
                      )}
                      style={{ width: `${Math.max(4, ratio * 100)}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                    {d.count}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* 区间定价 */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Crosshair className="h-4 w-4 text-primary" />
                区间定价（价格 / VR / 盈亏比）
              </span>
              <span className="text-sm font-normal text-muted-foreground">
                VR = 模型概率 ÷ 买入价（ask），≥1.2 有价值
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {activeAround.length === 0 && (
              <p className="text-xs text-muted-foreground">暂无区间数据</p>
            )}
            {activeAround.map((p) => (
              <BucketRow key={p.bucket.marketId} p={p} muDisplay={prediction.displayLanding} />
            ))}
          </CardContent>
        </Card>
      </div>

      {/* 阶段建仓卡 */}
      {phasePlan && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" />
              {phasePlan.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {phasePlan.kind !== 'endgame' ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-5 py-4">
                  <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
                    <Target className="h-4 w-4 text-emerald-500" />
                    中心落点仓
                  </p>
                  <p className="mt-1.5 text-base font-semibold">{phasePlan.center?.bucket.label ?? '—'}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{phasePlan.centerBudget}</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/20 px-5 py-4">
                  <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
                    <Shield className="h-4 w-4 text-primary/70" />
                    保护仓
                    <ArrowUp className="h-3.5 w-3.5" />
                  </p>
                  <p className="mt-1.5 text-base font-semibold">{phasePlan.protectUp?.bucket.label ?? '无上方区间'}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{phasePlan.protectBudget}</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/20 px-5 py-4">
                  <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
                    <Shield className="h-4 w-4 text-primary/70" />
                    保护仓
                    <ArrowDown className="h-3.5 w-3.5" />
                  </p>
                  <p className="mt-1.5 text-base font-semibold">{phasePlan.protectDown?.bucket.label ?? '无下方区间'}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{phasePlan.protectBudget}</p>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border/60 bg-muted/20 px-5 py-4 space-y-2">
                  <p className="text-sm font-semibold">NO 埋伏机会 · 目标 10¢→100¢</p>
                  {phasePlan.noPlays.length === 0 && (
                    <p className="text-sm text-muted-foreground">暂无符合条件的期末博弈机会，持续观察中</p>
                  )}
                  {phasePlan.noPlays.map(({ prob, noPrice, multiple }) => (
                    <div key={prob.bucket.marketId} className="flex items-center justify-between text-sm">
                      <span className="font-medium tabular-nums">{prob.bucket.label}</span>
                      <span className="text-muted-foreground tabular-nums">
                        NO {noPrice.toFixed(1)}¢ · 最高 {multiple}x
                      </span>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/20 px-5 py-4 space-y-2">
                  <p className="text-sm font-semibold">YES 联动机会 · 目标 20¢→80¢</p>
                  {phasePlan.yesPlays.length === 0 && (
                    <p className="text-sm text-muted-foreground">暂无符合条件的期末博弈机会，持续观察中</p>
                  )}
                  {phasePlan.yesPlays.map(({ prob, multiple }) => (
                    <div key={prob.bucket.marketId} className="flex items-center justify-between text-sm">
                      <span className="font-medium tabular-nums">{prob.bucket.label}</span>
                      <span className="text-muted-foreground tabular-nums">
                        YES {prob.askPct.toFixed(1)}¢ · 最高 {multiple}x
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 彩票仓机会 */}
      {lottery.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-amber-500" />
              彩票仓机会（≤$50）
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {lottery.map(({ prob, needed, multiple }) => (
              <div
                key={prob.bucket.marketId}
                className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2.5 text-sm"
              >
                <span className="font-medium tabular-nums">{prob.bucket.label}</span>
                <span className="text-muted-foreground tabular-nums">
                  还需 +{needed} 条 · {prob.askPct.toFixed(1)}¢ · 最高 {multiple}x
                </span>
              </div>
            ))}
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground pt-1">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
              高风险 · 极低成本 · 仅在确信今日节奏活跃时布局 · 最坏归零不影响主仓
            </p>
          </CardContent>
        </Card>
      )}

      {/* 今日节奏 & 落点影响 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              今日节奏 &amp; 落点影响
            </span>
            <span className="text-sm font-normal text-muted-foreground">206 天历史数据</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-5 py-4">
            <div>
              <p className="flex items-center gap-2 text-base font-semibold">
                <TimingIcon timingKey={timing.key} />
                {timing.title}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{timing.detail}</p>
            </div>
            <div className="text-right shrink-0 pl-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">落点预测</p>
              <p className="text-3xl font-bold tabular-nums">{prediction.displayLanding}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {rhythmBlocks.map((b) => (
              <div
                key={b.label}
                className={cn(
                  'rounded-lg border px-2 py-2.5 text-center',
                  b.state === 'current'
                    ? 'border-primary/50 bg-primary/5'
                    : b.state === 'past'
                      ? 'border-border/50 bg-muted/20'
                      : 'border-border/30 bg-transparent opacity-70',
                )}
              >
                <p className="text-xs text-muted-foreground tabular-nums">
                  {b.range[0]}–{b.range[1]}h
                </p>
                <p className="mt-1 flex items-center justify-center gap-1 text-sm font-medium">
                  <RhythmIcon kind={b.kind} className="h-3.5 w-3.5" />
                  {b.label}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {b.state === 'past' && `${b.actual} 条`}
                  {b.state === 'current' && `进行中 · ${b.actual} 条`}
                  {b.state === 'future' && (b.kind === 'peak' ? '预计爆发' : b.kind === 'sleep' ? '入睡' : '预计中等')}
                </p>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <Pin className="h-4 w-4" />
              对本期落点的影响
            </p>
            {impacts.map((imp, i) => (
              <p key={i} className="flex items-start gap-2 text-sm leading-relaxed">
                <ImpactIcon tone={imp.tone} />
                {imp.text}
              </p>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
