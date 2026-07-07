'use client';

import Link from 'next/link';
import {
  Ban,
  BookOpen,
  Clock3,
  ClipboardList,
  Flame,
  Ruler,
  ShieldAlert,
  Skull,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMuskQuantAnalysis } from '@/hooks/useMuskQuantAnalysis';
import { cn } from '@/lib/utils';

/** 回测铁律：来自 docs/strategy-backtest-2026-07-07.md 的可执行结论 */
const BACKTEST_RULES: { Icon: LucideIcon; iconCls: string; title: string; detail: string }[] = [
  {
    Icon: Ban,
    iconCls: 'text-rose-500',
    title: 'T-72h 前禁止按 VR 入场',
    detail: '回测 0/7 全灭。早期 µ 噪声下「VR 最高」恰是模型错得最离谱的区间——不是少买，是不买。',
  },
  {
    Icon: Clock3,
    iconCls: 'text-amber-500',
    title: 'VR 主仓只在 T-48h ~ T-24h',
    detail: '利润呈彩票型（靠个别高倍命中）。仓位 ≤ 计划资金 25%，跑满 20 期再决定加码。',
  },
  {
    Icon: Ruler,
    iconCls: 'text-teal-500',
    title: '结算 NO 只做动态 gap',
    detail: '所需条数 ≥ 2.5 × 当前节奏 × 剩余天数才入场。98¢+ 捡钢镚，一次黑天鹅要 ~56 笔盈利来填，仓位必须小。',
  },
  {
    Icon: Flame,
    iconCls: 'text-orange-500',
    title: '沉默 6h → 爆发 2.3× 基线',
    detail: '本数据集最扎实的信号（n=130）。沉默期关注中心上方相邻区间的低价 YES，等爆发兑现。',
  },
];

/** 止盈阶梯（移植原站规则） */
const TAKE_PROFIT_LADDER = [
  { at: '65¢', action: '减仓 20–30%' },
  { at: '75¢', action: '卖出 50%' },
  { at: '85¢', action: '大部分止盈' },
];

/**
 * 右侧策略方案面板：当前阶段纪律 + 回测铁律 + 止盈阶梯。
 * 阶段部分随剩余时间实时切换，静态规则给出「为什么」防止临场变形。
 */
export function StrategyPlanPanel() {
  const analysis = useMuskQuantAnalysis();

  return (
    <div className="space-y-4 xl:sticky xl:top-4">
      {/* 当前操作阶段（时间感知） */}
      {analysis?.opPhase && (
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between gap-2 text-base">
              <span className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-primary" />
                {analysis.opPhase.title}
              </span>
              <Badge
                variant="outline"
                className={cn(
                  'text-xs shrink-0',
                  analysis.badge.tone === 'teal' && 'border-teal-500/50 text-teal-500',
                  analysis.badge.tone === 'amber' && 'border-amber-500/50 text-amber-500',
                  analysis.badge.tone === 'rose' && 'border-rose-500/50 text-rose-500',
                )}
              >
                {analysis.badge.label}
              </Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              µ 误差 {analysis.opPhase.muError} · 距到期 {analysis.remainingDays.toFixed(1)} 天
            </p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {analysis.opPhase.actions.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-sm leading-relaxed">
                  <span className="mt-2 h-1 w-1 rounded-full bg-primary shrink-0" />
                  {a}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* 回测铁律 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4 text-amber-500" />
            回测铁律
            <span className="text-xs font-normal text-muted-foreground">2026-07-07 · n=8 期</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3.5">
          {BACKTEST_RULES.map((r) => (
            <div key={r.title} className="space-y-1">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <r.Icon className={cn('h-4 w-4 shrink-0', r.iconCls)} />
                {r.title}
              </p>
              <p className="pl-6 text-sm leading-relaxed text-muted-foreground">{r.detail}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 止盈阶梯 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            止盈阶梯
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {TAKE_PROFIT_LADDER.map((s) => (
            <div
              key={s.at}
              className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-4 py-2.5"
            >
              <span className="text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {s.at}
              </span>
              <span className="text-sm text-foreground/90">{s.action}</span>
            </div>
          ))}
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 px-4 py-3 space-y-1">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-rose-600 dark:text-rose-400">
              <Skull className="h-4 w-4" />
              死亡陷阱
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              亏损仓「再等等看」。翼仓纪律：最后一天上午卖 40% → 晚上再卖剩余 50% → 到期前 12h 清仓。
            </p>
          </div>
        </CardContent>
      </Card>

      <Link
        href="/x-monitor?tab=guide"
        scroll={false}
        className="flex items-center justify-center gap-1.5 rounded-lg border border-border/50 px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <BookOpen className="h-4 w-4" />
        完整操作手册（Guide）
      </Link>
    </div>
  );
}
