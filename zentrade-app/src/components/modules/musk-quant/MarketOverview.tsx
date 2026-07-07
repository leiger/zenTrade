'use client';

import { Activity, AlertTriangle, Crosshair, Sparkles, Target, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  const stars = p.vr >= 2 ? '⭐⭐' : p.vr >= 1.5 ? '⭐' : '';
  void muDisplay;
  return (
    <div className={cn('flex items-center justify-between rounded-lg border px-3 py-2', highlight)}>
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm font-medium tabular-nums">{p.bucket.label}</span>
        {p.isCenter && (
          <Badge variant="outline" className="h-4 px-1.5 text-[9px] border-emerald-500/50 text-emerald-500">
            CENTER
          </Badge>
        )}
        {stars && <span className="text-[10px]">{stars}</span>}
      </div>
      <div className="flex items-center gap-4 text-xs tabular-nums">
        <span className="text-muted-foreground w-14 text-right">{price.toFixed(1)}¢</span>
        <span className={cn('w-14 text-right', vrColor(p.vr))}>VR {p.vr.toFixed(2)}</span>
        <span className="text-muted-foreground w-12 text-right">
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
    prediction, probs, daily, signals, phasePlan, lottery, badge, opPhase,
    window: win, timing, rhythmBlocks, impacts, pace, remainingDays,
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
            <div key={i} className={cn('rounded-lg border px-4 py-3', SIGNAL_STYLES[s.level])}>
              <p className="text-sm font-semibold flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                {s.title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-foreground/80">{s.detail}</p>
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
                'text-[10px]',
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
              <p className="text-3xl font-bold tabular-nums">~{prediction.displayLanding} 条</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                线性 µ {prediction.muLinear.toFixed(1)} · 小时加权 µ {prediction.muHourly.toFixed(1)} · 会话修正{' '}
                {prediction.totalMuAdjust >= 0 ? '+' : ''}
                {prediction.totalMuAdjust}
              </p>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground/80">预测精准度</span>
              <span className="text-lg font-bold tabular-nums">{prediction.confidence}%</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground/80">日均节奏</span>
              <span className="text-lg font-bold tabular-nums">{pace.toFixed(1)}/d</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground/80">当前窗口</span>
              <span className="text-sm font-semibold">
                {win.emoji} {win.label}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* 本期每日发推 */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
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
                  <span className={cn('w-12 shrink-0 text-[10px] tabular-nums', isToday ? 'font-semibold' : 'text-muted-foreground')}>
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
                  <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
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
            <CardTitle className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Crosshair className="h-4 w-4 text-primary" />
                区间定价（价格 / VR / 盈亏比）
              </span>
              <span className="text-[10px] font-normal text-muted-foreground">
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
            <CardTitle className="flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4 text-primary" />
              {phasePlan.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {phasePlan.kind !== 'endgame' ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">🎯 中心落点仓</p>
                  <p className="mt-1 text-sm font-semibold">{phasePlan.center?.bucket.label ?? '—'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{phasePlan.centerBudget}</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">🛡️ 保护仓 ↑</p>
                  <p className="mt-1 text-sm font-semibold">{phasePlan.protectUp?.bucket.label ?? '无上方区间'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{phasePlan.protectBudget}</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">🛡️ 保护仓 ↓</p>
                  <p className="mt-1 text-sm font-semibold">{phasePlan.protectDown?.bucket.label ?? '无下方区间'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{phasePlan.protectBudget}</p>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3 space-y-2">
                  <p className="text-xs font-semibold">NO 埋伏机会 · 目标 10¢→100¢</p>
                  {phasePlan.noPlays.length === 0 && (
                    <p className="text-xs text-muted-foreground">暂无符合条件的期末博弈机会，持续观察中</p>
                  )}
                  {phasePlan.noPlays.map(({ prob, noPrice, multiple }) => (
                    <div key={prob.bucket.marketId} className="flex items-center justify-between text-xs">
                      <span className="font-medium tabular-nums">{prob.bucket.label}</span>
                      <span className="text-muted-foreground tabular-nums">
                        NO {noPrice.toFixed(1)}¢ · 最高 {multiple}x
                      </span>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3 space-y-2">
                  <p className="text-xs font-semibold">YES 联动机会 · 目标 20¢→80¢</p>
                  {phasePlan.yesPlays.length === 0 && (
                    <p className="text-xs text-muted-foreground">暂无符合条件的期末博弈机会，持续观察中</p>
                  )}
                  {phasePlan.yesPlays.map(({ prob, multiple }) => (
                    <div key={prob.bucket.marketId} className="flex items-center justify-between text-xs">
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
            <CardTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-amber-500" />
              🎰 彩票仓机会（≤$50）
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {lottery.map(({ prob, needed, multiple }) => (
              <div
                key={prob.bucket.marketId}
                className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs"
              >
                <span className="font-medium tabular-nums">{prob.bucket.label}</span>
                <span className="text-muted-foreground tabular-nums">
                  还需 +{needed} 条 · {prob.askPct.toFixed(1)}¢ · 最高 {multiple}x
                </span>
              </div>
            ))}
            <p className="text-[10px] text-muted-foreground pt-1">
              ⚠️ 高风险 · 极低成本 · 仅在确信今日节奏活跃时布局 · 最坏归零不影响主仓
            </p>
          </CardContent>
        </Card>
      )}

      {/* 今日节奏 & 落点影响 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm">
            <span>📊 今日节奏 &amp; 落点影响</span>
            <span className="text-[10px] font-normal text-muted-foreground">206 天历史数据</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
            <div>
              <p className="text-sm font-semibold">{timing.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{timing.detail}</p>
            </div>
            <div className="text-right shrink-0 pl-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">落点预测</p>
              <p className="text-2xl font-bold tabular-nums">{prediction.displayLanding}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {rhythmBlocks.map((b) => (
              <div
                key={b.label}
                className={cn(
                  'rounded-lg border px-2 py-2 text-center',
                  b.state === 'current'
                    ? 'border-primary/50 bg-primary/5'
                    : b.state === 'past'
                      ? 'border-border/50 bg-muted/20'
                      : 'border-border/30 bg-transparent opacity-70',
                )}
              >
                <p className="text-[10px] text-muted-foreground tabular-nums">
                  {b.range[0]}–{b.range[1]}h
                </p>
                <p className="text-xs font-medium mt-0.5">
                  {b.emoji} {b.label}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {b.state === 'past' && `${b.actual} 条`}
                  {b.state === 'current' && `进行中 · ${b.actual} 条`}
                  {b.state === 'future' && (b.kind === 'peak' ? '预计爆发' : b.kind === 'sleep' ? '入睡' : '预计中等')}
                </p>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-muted-foreground">📌 对本期落点的影响</p>
            {impacts.map((imp, i) => (
              <p key={i} className="text-xs leading-relaxed">
                {imp.icon} {imp.text}
              </p>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 操作阶段纪律 */}
      {opPhase && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm">
              <span>{opPhase.title}</span>
              <span className="text-[10px] font-normal text-muted-foreground">
                µ 误差 {opPhase.muError} · 距到期 {remainingDays.toFixed(1)} 天
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {opPhase.actions.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-xs leading-relaxed">
                  <span className="mt-1 h-1 w-1 rounded-full bg-primary shrink-0" />
                  {a}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
