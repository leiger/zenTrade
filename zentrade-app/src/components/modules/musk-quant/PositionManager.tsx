'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useMuskQuantStore } from '@/lib/musk-quant-store';
import { useMuskQuantAnalysis } from '@/hooks/useMuskQuantAnalysis';
import { evaluatePosition } from '@/lib/musk-quant-engine';
import type { QuantPosition } from '@/types/musk-quant';
import { cn } from '@/lib/utils';

const ROLE_LABELS: Record<QuantPosition['role'], string> = {
  center: '中心主仓',
  wing: '翼仓',
  lottery: '彩票仓',
};

const SIGNAL_META = {
  takeprofit: { label: '止盈 ↑', cls: 'border-emerald-500/50 text-emerald-500' },
  stoploss: { label: '减仓 ↓', cls: 'border-red-500/50 text-red-500' },
  modelexit: { label: '出场', cls: 'border-amber-500/50 text-amber-500' },
} as const;

export function PositionManager() {
  const analysis = useMuskQuantAnalysis();
  const { positions, addPosition, removePosition } = useMuskQuantStore();

  const [bucketLabel, setBucketLabel] = useState('');
  const [priceInput, setPriceInput] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [role, setRole] = useState<QuantPosition['role']>('center');

  const eventSlug = analysis?.event.slug ?? '';
  const eventPositions = useMemo(
    () => positions.filter((p) => p.eventSlug === eventSlug),
    [positions, eventSlug],
  );

  const evaluations = useMemo(
    () => (analysis ? eventPositions.map((p) => evaluatePosition(p, analysis.probs)) : []),
    [analysis, eventPositions],
  );

  const totals = useMemo(() => {
    const cost = evaluations.reduce((s, e) => s + e.position.cost, 0);
    const value = evaluations.reduce((s, e) => s + e.currentValue, 0);
    return { cost, value, pnl: value - cost };
  }, [evaluations]);

  if (!analysis) {
    return (
      <div className="rounded-lg border border-border/50 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
        暂无市场数据，请刷新或选择其他市场
      </div>
    );
  }

  const priceNum = Number(priceInput);
  const amountNum = Number(amountInput);
  const formValid =
    bucketLabel !== '' && priceNum > 0 && priceNum < 100 && amountNum > 0;
  const previewShares = formValid ? amountNum / (priceNum / 100) : 0;

  const handleBucketChange = (label: string) => {
    setBucketLabel(label);
    // 选中区间自动填当前买入价（ask，即实际成交成本）
    const match = analysis.probs.find((p) => p.bucket.label === label);
    if (match) setPriceInput(match.askPct.toFixed(1));
  };

  const handleAdd = () => {
    if (!formValid) return;
    addPosition({
      eventSlug,
      bucketLabel,
      entryPrice: priceNum / 100,
      shares: previewShares,
      cost: amountNum,
      role,
      note: '',
    });
    setAmountInput('');
  };

  return (
    <div className="space-y-4">
      {/* 汇总卡 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-0.5 rounded-lg border bg-gradient-to-t from-primary/5 to-card px-4 py-3">
          <span className="text-xs text-muted-foreground">总投入</span>
          <span className="text-2xl tracking-wide tabular-nums">${totals.cost.toFixed(2)}</span>
        </div>
        <div className="flex flex-col gap-0.5 rounded-lg border bg-gradient-to-t from-primary/5 to-card px-4 py-3">
          <span className="text-xs text-muted-foreground">当前估值</span>
          <span className="text-2xl tracking-wide tabular-nums">${totals.value.toFixed(2)}</span>
        </div>
        <div className="flex flex-col gap-0.5 rounded-lg border bg-gradient-to-t from-primary/5 to-card px-4 py-3">
          <span className="text-xs text-muted-foreground">浮动盈亏</span>
          <span
            className={cn(
              'text-2xl tracking-wide tabular-nums',
              totals.pnl > 0 ? 'text-emerald-500' : totals.pnl < 0 ? 'text-red-500' : '',
            )}
          >
            {totals.pnl >= 0 ? '+' : ''}${totals.pnl.toFixed(2)}
          </span>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground">
        ⚠️ 各区间互斥，最终只有一个区间结算为 YES。当前估值与浮盈按可卖价（bid）折算，非中奖金额。
      </p>

      {/* 添加仓位 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Plus className="h-4 w-4 text-primary" />
            记录持仓（{analysis.event.title}）
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-5">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">选择区间</Label>
              <Select value={bucketLabel} onValueChange={handleBucketChange}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="选择区间" />
                </SelectTrigger>
                <SelectContent>
                  {analysis.probs
                    .filter((p) => p.status !== 'busted')
                    .map((p) => (
                      <SelectItem key={p.bucket.marketId} value={p.bucket.label}>
                        {p.bucket.label}
                        {p.isCenter ? ' ★中心' : ''} · {p.askPct.toFixed(1)}¢
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">入场价格（¢）</Label>
              <Input
                className="h-9"
                type="number"
                min={0.1}
                max={99.9}
                step={0.1}
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">投入金额（$）</Label>
              <Input
                className="h-9"
                type="number"
                min={1}
                step={1}
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">仓位角色</Label>
              <Select value={role} onValueChange={(v) => setRole(v as QuantPosition['role'])}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABELS) as QuantPosition['role'][]).map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {formValid
                ? `每份 $${(priceNum / 100).toFixed(3)} · 赔率 ${(100 / priceNum).toFixed(2)}x · ≈ ${previewShares.toFixed(0)} 份 YES token`
                : '填写区间、价格与金额后确认添加'}
            </p>
            <Button size="sm" onClick={handleAdd} disabled={!formValid}>
              确认添加
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 持仓明细 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Wallet className="h-4 w-4 text-primary" />
            持仓明细
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {evaluations.length === 0 && (
            <p className="py-4 text-center text-xs text-muted-foreground">暂无持仓记录</p>
          )}
          {evaluations.map((ev) => (
            <div
              key={ev.position.id}
              className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/10 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums">{ev.position.bucketLabel}</span>
                  <Badge variant="outline" className="h-4 px-1.5 text-[9px]">
                    {ROLE_LABELS[ev.position.role]}
                  </Badge>
                  {ev.signal && (
                    <Badge variant="outline" className={cn('h-4 px-1.5 text-[9px]', SIGNAL_META[ev.signal].cls)}>
                      {SIGNAL_META[ev.signal].label}
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                  入场 {(ev.position.entryPrice * 100).toFixed(1)}¢ · {ev.position.shares.toFixed(0)} 份 · 投入 $
                  {ev.position.cost.toFixed(2)}
                  {ev.currentPrice !== null && ` · 现价 ${(ev.currentPrice * 100).toFixed(1)}¢`}
                  {ev.modelProb !== null && ` · 模型 ${ev.modelProb.toFixed(1)}%`}
                </p>
                {ev.signalText && <p className="mt-0.5 text-[11px]">{ev.signalText}</p>}
              </div>
              <div className="shrink-0 text-right">
                <p
                  className={cn(
                    'text-sm font-semibold tabular-nums',
                    ev.pnl > 0 ? 'text-emerald-500' : ev.pnl < 0 ? 'text-red-500' : '',
                  )}
                >
                  {ev.pnl >= 0 ? '+' : ''}${ev.pnl.toFixed(2)}（{ev.pnlPct >= 0 ? '+' : ''}
                  {ev.pnlPct.toFixed(1)}%）
                </p>
                <p className="text-[10px] text-muted-foreground tabular-nums">
                  若命中：${ev.winValue.toFixed(0)}（+${(ev.winValue - ev.position.cost).toFixed(0)}）
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removePosition(ev.position.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
