'use client';

import { useEffect, useMemo, useState } from 'react';
import { GitCompareArrows, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMuskQuantAnalysis } from '@/hooks/useMuskQuantAnalysis';
import {
  PATTERN_TEMPLATES,
  alignHourlySeries,
  fetchPriceHistory,
  predictPattern,
  type AlignedSeries,
  type PatternKey,
  type PatternPrediction,
} from '@/lib/musk-quant-morphology';
import { pricePct, type BucketProb } from '@/lib/musk-quant-engine';
import { logMorphologyVerdict } from '@/lib/musk-quant-api';
import { cn } from '@/lib/utils';

const GREEN = '#10b981';
const RED = '#f43f5e';

/** 将 0-1 价格序列转成 SVG polyline 点串 */
function toPolyline(data: number[], width: number, height: number, pad = 2): string {
  if (data.length < 2) return '';
  const stepX = (width - pad * 2) / (data.length - 1);
  return data
    .map((v, i) => `${(pad + i * stepX).toFixed(1)},${(pad + (1 - v) * (height - pad * 2)).toFixed(1)}`)
    .join(' ');
}

/** 双线 SVG 迷你图（绿=中心，红=对比） */
function DualLineChart({
  green, red, width, height, zone, className,
}: {
  green: number[];
  red: number[];
  width: number;
  height: number;
  /** 高亮窗口（索引区间，模板图用） */
  zone?: [number, number];
  className?: string;
}) {
  const zoneRect = useMemo(() => {
    if (!zone || green.length < 2) return null;
    const stepX = (width - 4) / (green.length - 1);
    return { x: 2 + zone[0] * stepX, w: (zone[1] - zone[0]) * stepX };
  }, [zone, green.length, width]);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={cn('w-full', className)} preserveAspectRatio="none">
      {zoneRect && <rect x={zoneRect.x} y={0} width={zoneRect.w} height={height} fill="currentColor" opacity={0.06} />}
      <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke="currentColor" strokeOpacity={0.1} strokeDasharray="3 3" />
      <polyline points={toPolyline(red, width, height)} fill="none" stroke={RED} strokeWidth={1.5} strokeLinejoin="round" />
      <polyline points={toPolyline(green, width, height)} fill="none" stroke={GREEN} strokeWidth={1.8} strokeLinejoin="round" />
    </svg>
  );
}

interface ComparisonState {
  aligned: AlignedSeries;
  prediction: PatternPrediction;
}

/** 单组对比：中心 vs 相邻区间 */
function ComparisonSection({
  title, center, comp, hoursLeft, eventSlug,
}: {
  title: string;
  center: BucketProb;
  comp: BucketProb | null;
  hoursLeft: number;
  eventSlug: string;
}) {
  const [state, setState] = useState<ComparisonState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const centerToken = center.bucket.clobTokenIdYes;
  const compToken = comp?.bucket.clobTokenIdYes ?? null;

  useEffect(() => {
    if (!centerToken || !compToken) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([fetchPriceHistory(centerToken), fetchPriceHistory(compToken)])
      .then(([cd, rd]) => {
        if (cancelled) return;
        const aligned = alignHourlySeries(cd, rd);
        // 数据不足时用当前价占位（与原站行为一致）
        if (aligned.green.length < 2) {
          aligned.green = [center.bucket.price, center.bucket.price];
          aligned.red = [comp!.bucket.price, comp!.bucket.price];
          aligned.timestamps = [Date.now() - 3600_000, Date.now()];
        }
        const prediction = predictPattern(aligned.green, aligned.red);
        setState({ aligned, prediction });
        // 判定结果落库（每期每对比每日一条），事后对照实际走势验证分类器
        logMorphologyVerdict({
          eventSlug,
          comparison: `${center.bucket.label} vs ${comp!.bucket.label}`,
          pattern: prediction.pattern,
          confidence: prediction.confidence,
          hoursLeft,
        });
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'load failed'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerToken, compToken]);

  if (!comp) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-6 text-center text-xs text-muted-foreground">该方向无相邻区间</p>
        </CardContent>
      </Card>
    );
  }

  const prediction = state?.prediction ?? null;
  const matched = prediction?.pattern ?? null;
  const tpl = matched ? PATTERN_TEMPLATES[matched] : null;
  const confPct = prediction ? Math.round(prediction.confidence * 100) : 0;

  const reliability =
    hoursLeft < 24
      ? { text: '最后 24h，预测可信度高', cls: 'text-emerald-500' }
      : hoursLeft < 48
        ? { text: '最后 48h 内，预测参考价值强', cls: 'text-amber-500' }
        : { text: '距结算较远，形态仍可能演变', cls: 'text-muted-foreground' };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span>{title}</span>
          <span className="flex items-center gap-3 text-[10px] font-normal">
            <span className="flex items-center gap-1">
              <span className="h-0.5 w-4 rounded" style={{ background: GREEN }} />
              {center.bucket.label}（中心）
            </span>
            <span className="flex items-center gap-1">
              <span className="h-0.5 w-4 rounded" style={{ background: RED }} />
              {comp.bucket.label}
            </span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 实际 48h 曲线 */}
        <div className="rounded-lg border border-border/50 bg-muted/10 p-2">
          {loading && (
            <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
              <RefreshCw className="mr-1.5 h-3 w-3 animate-spin" /> 获取价格历史...
            </div>
          )}
          {error && <div className="flex h-40 items-center justify-center text-xs text-destructive">价格历史加载失败：{error}</div>}
          {!loading && !error && state && (
            <DualLineChart green={state.aligned.green} red={state.aligned.red} width={640} height={160} />
          )}
        </div>

        {/* 形态预测结果 */}
        {prediction && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-muted-foreground">形态预测走向：</span>
            {matched && tpl ? (
              <>
                <Badge
                  variant="outline"
                  className="gap-1 text-[10px]"
                  style={{ borderColor: tpl.color, color: tpl.color }}
                >
                  <strong>{matched}</strong> {tpl.name}
                </Badge>
                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted/40">
                  <div className="h-full rounded-full" style={{ width: `${confPct}%`, background: tpl.color }} />
                </div>
                <span className="text-[11px] tabular-nums text-muted-foreground">匹配 {confPct}%</span>
                <span className="text-[11px] text-muted-foreground">{prediction.reason}</span>
                {prediction.second && (
                  <span className="text-[10px] text-muted-foreground/70">
                    次可能：{prediction.second}·{PATTERN_TEMPLATES[prediction.second].name}
                  </span>
                )}
                <span className={cn('text-[10px]', reliability.cls)}>● {reliability.text}</span>
              </>
            ) : (
              <span className="text-[11px] text-muted-foreground">{prediction.reason}</span>
            )}
          </div>
        )}

        {/* 行动建议卡 */}
        {tpl && (
          <div
            className="rounded-lg border-l-2 bg-muted/20 px-3 py-2.5 text-xs leading-relaxed"
            style={{ borderLeftColor: tpl.color }}
          >
            <strong style={{ color: tpl.color }}>预测说明 · {tpl.name}</strong>
            <p className="mt-1 text-muted-foreground">{tpl.predict}</p>
            <p className="mt-1 font-medium" style={{ color: tpl.color }}>
              当前建议：{tpl.signal}
            </p>
          </div>
        )}

        {/* 六种模板对比 */}
        <div>
          <p className="mb-2 text-[10px] text-muted-foreground">
            六种历史形态模板对比（高亮 = 预测走向，基于 18 个真实市场最后 48h 曲线）
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {(Object.keys(PATTERN_TEMPLATES) as PatternKey[]).map((key) => {
              const t = PATTERN_TEMPLATES[key];
              const isMatch = key === matched;
              return (
                <div
                  key={key}
                  className={cn(
                    'rounded-lg border p-2 transition-colors',
                    isMatch ? 'bg-muted/30' : 'border-border/40 opacity-75',
                  )}
                  style={isMatch ? { borderColor: t.color } : undefined}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className="flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold"
                      style={{ color: t.color, background: `${t.color}22` }}
                    >
                      {key}
                    </span>
                    <span className="truncate text-[10px] font-medium" style={isMatch ? { color: t.color } : undefined}>
                      {t.name}
                    </span>
                    <span className="ml-auto text-[9px] text-muted-foreground">{t.freq}</span>
                  </div>
                  <DualLineChart green={t.g} red={t.r} width={160} height={56} zone={t.zone} className="mt-1.5" />
                  <p className={cn('mt-1 truncate text-[9px]', isMatch ? 'font-semibold' : 'text-muted-foreground')} style={isMatch ? { color: t.color } : undefined}>
                    {isMatch ? '↑ 预测走向此形态' : t.signal}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function MorphologyCompare() {
  const analysis = useMuskQuantAnalysis();

  if (!analysis) {
    return (
      <div className="rounded-lg border border-border/50 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
        暂无市场数据，请刷新或选择其他市场
      </div>
    );
  }

  const { probs, remainingHours, prediction, total } = analysis;

  // 中心 = 盘口价最高的区间（形态对比以市场热点为准，而非模型 µ）
  const byMin = [...probs].sort((a, b) => a.bucket.min - b.bucket.min);
  const hottest = [...probs].sort((a, b) => b.bucket.price - a.bucket.price)[0] ?? null;
  const hottestIdx = hottest ? byMin.findIndex((p) => p.bucket.marketId === hottest.bucket.marketId) : -1;
  const below = hottestIdx > 0 ? byMin[hottestIdx - 1] : null;
  const above = hottestIdx >= 0 && hottestIdx < byMin.length - 1 ? byMin[hottestIdx + 1] : null;

  if (!hottest) {
    return (
      <div className="rounded-lg border border-border/50 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
        暂无区间数据
      </div>
    );
  }

  const timeStr =
    remainingHours < 1
      ? `${Math.floor(remainingHours * 60)} 分钟`
      : `${Math.floor(remainingHours)}h ${Math.floor((remainingHours % 1) * 60)}m`;

  const relevance =
    remainingHours <= 24
      ? { icon: '🎯', cls: 'border-emerald-500/40 bg-emerald-500/5', text: <>最后 24 小时，形态即将确立。<strong>预测可信度最高</strong>，结合推文数量判断决策。</> }
      : remainingHours <= 48
        ? { icon: '📍', cls: 'border-amber-500/40 bg-amber-500/5', text: <>距结算 {timeStr}，进入<strong>形态关键窗口（最后 48h）</strong>，预测参考价值强。</> }
        : { icon: '⏱', cls: 'border-border/60 bg-muted/20', text: <>距结算还有 {timeStr}，形态仍在演变中。以下预测为当前阶段参考，最后 48h 精度显著提升。</> };

  return (
    <div className="space-y-4">
      {/* 可信度提示 + 区间标签 */}
      <div className={cn('flex items-center gap-2 rounded-lg border px-4 py-2.5 text-xs', relevance.cls)}>
        <span className="text-base">{relevance.icon}</span>
        <span className="leading-relaxed">{relevance.text}</span>
      </div>

      <p className="rounded-lg border border-border/50 bg-muted/20 px-4 py-2 text-[10px] leading-relaxed text-muted-foreground">
        ⚠️ 形态分类为<strong>描述性参考</strong>：模板仅来自 18 个历史市场、权重人工调校，「匹配度」是特征打分（上限
        92%），不是统计意义上的置信度。判定结果会自动记录，攒够样本对照实际结果后再评估其预测力——在那之前，请以
        VR 与落点预测为主要决策依据。
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <GitCompareArrows className="h-4 w-4 text-primary" />
        {below && (
          <Badge variant="outline" className="gap-1.5 text-[10px] tabular-nums">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: RED }} />
            {below.bucket.label} 下方 · {pricePct(below).toFixed(1)}¢
          </Badge>
        )}
        <Badge variant="outline" className="gap-1.5 border-emerald-500/50 text-[10px] tabular-nums text-emerald-500">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: GREEN }} />
          {hottest.bucket.label} ★ 中心 · {pricePct(hottest).toFixed(1)}¢
        </Badge>
        {above && (
          <Badge variant="outline" className="gap-1.5 text-[10px] tabular-nums">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: RED }} />
            {above.bucket.label} 上方 · {pricePct(above).toFixed(1)}¢
          </Badge>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
          已计 {total} 条 · 线性预测 ~{prediction.predictedTotal} 条
        </span>
      </div>

      <ComparisonSection
        title={`对比 A：中心 ${hottest.bucket.label} vs 下方 ${below?.bucket.label ?? '—'}`}
        center={hottest}
        comp={below}
        hoursLeft={remainingHours}
        eventSlug={analysis.event.slug}
      />
      <ComparisonSection
        title={`对比 B：中心 ${hottest.bucket.label} vs 上方 ${above?.bucket.label ?? '—'}`}
        center={hottest}
        comp={above}
        hoursLeft={remainingHours}
        eventSlug={analysis.event.slug}
      />

      <Button variant="outline" size="sm" asChild>
        <a
          href={`https://polymarket.com/event/${analysis.event.slug}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          查看市场
        </a>
      </Button>
    </div>
  );
}
