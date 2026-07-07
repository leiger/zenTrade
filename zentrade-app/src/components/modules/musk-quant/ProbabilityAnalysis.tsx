'use client';

import { BarChart3, Gauge, Layers, SlidersHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useMuskQuantAnalysis } from '@/hooks/useMuskQuantAnalysis';
import { pricePct, type BucketProb } from '@/lib/musk-quant-engine';
import { cn } from '@/lib/utils';

const DIFFICULTY_META: Record<NonNullable<BucketProb['difficulty']>, { label: string; cls: string }> = {
  easy: { label: '轻松', cls: 'border-emerald-500/50 text-emerald-500' },
  medium: { label: '中等', cls: 'border-amber-500/50 text-amber-500' },
  hard: { label: '较难', cls: 'border-teal-500/50 text-teal-500' },
  impossible: { label: '需加速', cls: 'border-rose-500/50 text-rose-500' },
};

function vrCell(vr: number) {
  return (
    <span
      className={cn(
        'tabular-nums',
        vr >= 1.2 ? 'font-semibold text-emerald-500' : vr >= 1.0 ? 'text-teal-500' : 'text-muted-foreground',
      )}
    >
      {vr.toFixed(2)}
      {vr >= 1.2 && ' ✓'}
    </span>
  );
}

export function ProbabilityAnalysis() {
  const analysis = useMuskQuantAnalysis();

  if (!analysis) {
    return (
      <div className="rounded-lg border border-border/50 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
        暂无市场数据，请刷新或选择其他市场
      </div>
    );
  }

  const { probs, prediction, total, remainingDays, pace, entryStructure } = analysis;
  const byMin = [...probs].sort((a, b) => a.bucket.min - b.bucket.min);
  const tableRows = byMin.filter((p) => pricePct(p) > 0).slice(0, 12);
  const radarRows = byMin.filter((p) => p.status === 'active').slice(0, 12);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {/* 盘口价值比 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                盘口价值比
              </span>
              <span className="text-[10px] font-normal text-muted-foreground tabular-nums">
                µ = {prediction.displayLanding} · 当前 {total} 条 · 剩余 {remainingDays.toFixed(1)} 天
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">区间</TableHead>
                  <TableHead className="text-right text-xs">盘口价</TableHead>
                  <TableHead className="text-right text-xs">模型概率</TableHead>
                  <TableHead className="text-right text-xs">VR</TableHead>
                  <TableHead className="text-right text-xs">状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableRows.map((p) => (
                  <TableRow key={p.bucket.marketId} className={cn(p.isCenter && 'bg-emerald-500/5')}>
                    <TableCell className="py-2 text-xs font-medium tabular-nums">
                      {p.bucket.label}
                      {p.isCenter && (
                        <Badge variant="outline" className="ml-2 h-4 px-1.5 text-[9px] border-emerald-500/50 text-emerald-500">
                          CENTER
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="py-2 text-right text-xs tabular-nums">{pricePct(p).toFixed(1)}¢</TableCell>
                    <TableCell className="py-2 text-right text-xs tabular-nums">{p.modelProb.toFixed(1)}%</TableCell>
                    <TableCell className="py-2 text-right text-xs">{vrCell(p.vr)}</TableCell>
                    <TableCell className="py-2 text-right text-[10px] text-muted-foreground">
                      {p.status === 'busted' ? '已越过' : p.status === 'passed' ? '已进入' : '进行中'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mt-2 text-[10px] text-muted-foreground">
              VR = 模型概率 ÷ 盘口价，≥1.2 有价值 · 概率为泊松模型（λ = 线性 µ {prediction.muLinear.toFixed(1)}）在
              ≥1¢ 区间内归一化
            </p>
          </CardContent>
        </Card>

        {/* 目标区间时速倒推雷达 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-primary" />
                目标区间时速倒推雷达
              </span>
              <span className="text-[10px] font-normal text-muted-foreground tabular-nums">
                当前速率 {(pace / 24).toFixed(2)} 条/时
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {radarRows.map((p) => (
                <div key={p.bucket.marketId} className="rounded-lg border border-border/50 bg-muted/10 px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold tabular-nums">
                      {p.bucket.label}
                      {p.isCenter && <span className="ml-1.5 text-[9px] text-emerald-500">★中心</span>}
                    </span>
                    {p.difficulty && (
                      <Badge variant="outline" className={cn('h-4 px-1.5 text-[9px]', DIFFICULTY_META[p.difficulty].cls)}>
                        {DIFFICULTY_META[p.difficulty].label}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1.5 space-y-0.5 text-[10px] text-muted-foreground tabular-nums">
                    <p>还需发推 +{p.tweetsNeededMin} ~ +{p.bucket.max === null ? '∞' : p.tweetsNeededMax} 条</p>
                    <p>
                      所需时速 {p.minVelocity.toFixed(2)} ~ {p.bucket.max === null ? '∞' : p.maxVelocity.toFixed(2)} /h
                    </p>
                    <p>真实概率 {p.modelProb.toFixed(1)}%</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              图例：轻松（速率已达标，距 µ&lt;20）· 中等（&lt;50）· 较难（≥50）· 需加速（当前速率不足）
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {/* 三层入场结构 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Layers className="h-4 w-4 text-primary" />
              推荐入场结构
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">🟦 主仓 50–70%</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums">
                {entryStructure.main
                  ? `${entryStructure.main.bucket.label} · VR ${entryStructure.main.vr.toFixed(2)}`
                  : '暂无有效入场点'}
              </p>
              <p className="text-[10px] text-muted-foreground">概率 ≥10% 中价值比最高的区间</p>
            </div>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">🟨 保护仓 20–30%</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums">
                {entryStructure.protect ? `${entryStructure.protect.bucket.label}（+0.3档偏高对冲）` : '中心已在最低档，无下方区间'}
              </p>
              <p className="text-[10px] text-muted-foreground">中心区间下方相邻区间</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">⭐ 高赔率仓 ≤5%</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums">
                {entryStructure.highOdds
                  ? `${entryStructure.highOdds.bucket.label} · ${pricePct(entryStructure.highOdds).toFixed(1)}¢ · VR ${entryStructure.highOdds.vr.toFixed(2)}`
                  : '暂无（需 ≤5¢ 且 VR≥2）'}
              </p>
              <p className="text-[10px] text-muted-foreground">低价高赔率彩票位</p>
            </div>
            <p
              className={cn(
                'rounded-md px-3 py-2 text-xs font-medium',
                entryStructure.verdict === 'enter' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                entryStructure.verdict === 'marginal' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                entryStructure.verdict === 'wait' && 'bg-muted/40 text-muted-foreground',
              )}
            >
              {entryStructure.verdictText}
            </p>
          </CardContent>
        </Card>

        {/* 分布模型对比 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                分布模型对比
              </span>
              <span className="text-[10px] font-normal text-muted-foreground tabular-nums">
                泊松 vs 正态（σ={prediction.sigma.toFixed(1)}）
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[360px] space-y-1 overflow-y-auto pr-1">
              {tableRows.map((p) => (
                <div
                  key={p.bucket.marketId}
                  className="flex items-center justify-between rounded-md border border-border/40 px-2.5 py-1.5 text-[11px] tabular-nums"
                >
                  <span className="font-medium">{p.bucket.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">市 {pricePct(p).toFixed(0)}%</span>
                    <span>泊 {p.modelProb.toFixed(1)}%</span>
                    <span>正 {p.normalProb.toFixed(1)}%</span>
                    <span
                      className={cn(
                        'w-12 text-right',
                        p.delta > 1 ? 'text-emerald-500' : p.delta < -1 ? 'text-red-500' : 'text-muted-foreground',
                      )}
                    >
                      Δ{p.delta >= 0 ? '+' : ''}
                      {p.delta.toFixed(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
              正态分布偏宽（Δ正）→ 尾部风险更大；偏窄（Δ负）→ 中心更集中
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
