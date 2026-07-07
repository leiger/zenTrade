'use client';

import { useState } from 'react';
import { BookOpen, ChevronDown, TriangleAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** 资金计划表（$5000 基准） */
const CAPITAL_PLAN = [
  { time: '倒数第三天上午（距到期 2.5–3 天）', what: '中心区间 60% + 上翼 28% + 下翼 12%', amount: '$1250', why: '分散建仓，不押单一区间' },
  { time: '倒数第二天（1.5–2.5 天）', what: '集中加仓中心区间（主力仓）', amount: '$2000', why: '落点更确定，重仓押注' },
  { time: '最后一天上午（1–1.5 天）', what: '卖翼仓 40%，同时寻找最佳盈亏比区间少量押注', amount: '$200–300', why: '用中心稳定收益的一部分博超额' },
  { time: '任意时间（机会单）', what: '中心附近区间价格跌到 8% 以下时少量买入', amount: '$50–100', why: '低价保险，扩大安全边界' },
  { time: '预留不动', what: '—', amount: '$750', why: '异常情况下的机动资金' },
];

const SELL_RULES = [
  { time: '最后一天上午（距到期 1–1.5 天）', action: '上/下翼各卖出 40%，同时评估超额收益机会' },
  { time: '最后一天晚上（0.5–1 天）', action: '再卖剩余 50%（此时翼仓只剩最初 30% 仓位）' },
  { time: '到期前 12 小时', action: '翼仓全部清仓，不留任何翼仓持仓，专注等待中心结算' },
  { time: '中心仓涨到 65–74%', action: '卖 20%，锁定部分收益（剩 80%，中奖潜力仍然很大）' },
  { time: '中心仓涨到 75%+', action: '再卖 30%（共减仓 50%）——到这个价位赔率极低，减仓是理性的' },
];

const EXCEPTIONS = [
  { title: '速率偏高预警', action: '延迟卖出上翼，观察是否持续。若持续 2 小时以上，考虑少量补买上翼。' },
  { title: '速率偏低预警', action: '延迟卖出下翼，观察是否持续。若持续 2 小时以上，考虑补买下翼低价保险。' },
  { title: 'µ 一天内移动超过一个区间（20条）', action: '先不加仓，等落点稳定 2 小时以上，再重新确认中心区间后执行计划。' },
  { title: '中心价格跌到入场价 40% 以下，且模型概率也很低', action: '考虑止损，把剩余资金转移到当前中心区间。不要死守。' },
];

const FAQ = [
  {
    q: '卖了翼仓，结果它中奖了，怎么办？',
    a: '你没有做错。翼仓赔率是 5–8 倍，但中奖概率只有 15–20%。长期来看，按计划卖出比死守期望值更高。这次是偶然，不代表策略错了。',
  },
  {
    q: '中心区间加了很多，突然很慌怎么办？',
    a: '先看模型的预测落点（µ）是否还在中心区间内。如果是，说明策略没变化，你只是在正常价格波动中焦虑。如果 µ 已经移走了一个区间，才需要调整。',
  },
  {
    q: '要不要一直盯着价格看？',
    a: '距到期 3 天以上：每 6 小时看一次即可。距到期 1–3 天：每 2–3 小时看一次。最后一天：需要随时关注，执行翼仓减仓和超额机会评估。到期前 12 小时：翼仓必须清仓。',
  },
  {
    q: '为什么利润总是来自没有重仓的区间？',
    a: '因为你重仓的区间是模型认为最可能的区间，它的赔率往往已经被市场定价得比较高了。翼仓和最佳盈亏比区间赔率低、潜在回报高——这是预测市场的结构特征，超额收益策略就是利用这个特征。',
  },
];

const TIMELINE = [
  { time: '倒数第三天上午（2.5–3天）', action: '第一次建仓', tone: 'bg-emerald-500' },
  { time: '倒数第二天（1.5–2.5天）', action: '主力加仓中心', tone: 'bg-emerald-500' },
  { time: '最后一天上午（1–1.5天）', action: '翼减 40% + 超额', tone: 'bg-yellow-500' },
  { time: '最后一天晚上（0.5–1天）', action: '翼仓继续减 50%', tone: 'bg-amber-500' },
  { time: '到期前 12 小时', action: '最终阶段 · 翼仓清仓', tone: 'bg-red-500' },
];

function Section({
  id, title, open, onToggle, children,
}: {
  id: string;
  title: string;
  open: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/60">
      <button
        onClick={() => onToggle(id)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left text-base font-semibold hover:bg-accent/40 transition-colors rounded-lg"
      >
        {title}
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="border-t border-border/60 px-4 py-4">{children}</div>}
    </div>
  );
}

export function StrategyGuide() {
  const [openSection, setOpenSection] = useState<string>('buy');
  const toggle = (id: string) => setOpenSection((cur) => (cur === id ? '' : id));

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {/* 头部 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-primary" />
            马斯克推文市场 · 操作手册
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">简化版 · 只讲操作，不讲数学 · 每期市场 7 天，以北京时间 24:00 结束</p>
          <p className="mt-2 text-base leading-relaxed">
            核心思路：中心落点区间带来<strong>稳定基础收益</strong>，最佳盈亏比区间带来<strong>超额收益</strong>
            ，翼仓做保险按时减仓——<strong>规则写死，不靠临场判断。</strong>
          </p>
        </CardContent>
      </Card>

      <Section id="buy" title="§1 什么时候买、买多少" open={openSection === 'buy'} onToggle={toggle}>
        <div className="space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">时机</th>
                  <th className="py-2 pr-3 font-medium">买什么</th>
                  <th className="py-2 pr-3 font-medium">金额（$5000 为例）</th>
                  <th className="py-2 font-medium">目的</th>
                </tr>
              </thead>
              <tbody>
                {CAPITAL_PLAN.map((row) => (
                  <tr key={row.time} className="border-b border-border/30">
                    <td className="py-2 pr-3">{row.time}</td>
                    <td className="py-2 pr-3">{row.what}</td>
                    <td className="py-2 pr-3 tabular-nums">{row.amount}</td>
                    <td className="py-2 text-muted-foreground">{row.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="rounded-lg border border-teal-500/30 bg-teal-500/5 px-4 py-3 text-sm leading-relaxed">
            <strong>超额收益策略</strong>：市场概览会自动找出当前市价远低于模型概率的区间（EV 指数 &gt; 1.25），即「价格被低估的区间」。
            此时中心仓位已有浮动盈利，可以用浮盈的 <strong>10–15%</strong> 买入最佳盈亏比区间，实现「中心保底 +
            翼仓超额」双层结构。注意：这是小仓位博弈，不是主力仓。若无明显价值区间（EV 指数 &lt; 1.25），跳过即可。
          </div>
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm leading-relaxed">
            <TriangleAlert className="mr-1.5 inline h-4 w-4 -translate-y-px text-red-500" />
            <strong>不建议这样做</strong>：距到期超过 3 天就重仓入场（预测不准，容易买错区间）；同一期内无限补仓（加仓应有明确计划，不是凭感觉）；把全部资金都押在超额收益机会上（它是辅助，不是主策略）。
          </div>
        </div>
      </Section>

      <Section id="sell" title="§2 什么时候卖（固定规则，不靠感情）" open={openSection === 'sell'} onToggle={toggle}>
        <div className="space-y-3">
          <div className="space-y-1.5">
            {SELL_RULES.map((r) => (
              <div key={r.time} className="flex items-start gap-3 rounded-md border border-border/40 px-3.5 py-2.5 text-sm">
                <span className="w-44 shrink-0 font-medium">{r.time}</span>
                <span className="text-muted-foreground leading-relaxed">{r.action}</span>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3 text-sm leading-relaxed">
            <strong>卖出后它反而涨了，怎么办？</strong>
            这不是错误，这是正确的风险管理。预测市场的利润来自<strong>多次操作的平均收益</strong>
            ，不是某一次押对。翼仓归零的次数远多于中奖的次数。把卖出时间写成规则，不用在关键时刻临时决定，心理压力会小很多。
          </div>
        </div>
      </Section>

      <Section id="exception" title="§3 出现异常情况怎么办" open={openSection === 'exception'} onToggle={toggle}>
        <div className="space-y-1.5">
          {EXCEPTIONS.map((e) => (
            <div key={e.title} className="rounded-md border border-border/40 px-3.5 py-2.5 text-sm">
              <p className="font-medium">{e.title}</p>
              <p className="mt-0.5 text-muted-foreground leading-relaxed">{e.action}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="faq" title="§4 心理备忘（FAQ）" open={openSection === 'faq'} onToggle={toggle}>
        <div className="space-y-3">
          {FAQ.map((f) => (
            <div key={f.q} className="text-sm">
              <p className="font-medium">Q：{f.q}</p>
              <p className="mt-1 text-muted-foreground leading-relaxed">A：{f.a}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 一张纸总结 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">一张纸总结（以北京时间 24:00 到期为基准）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-5">
            {TIMELINE.map((t) => (
              <div key={t.time} className="rounded-lg border border-border/50 px-3 py-2.5">
                <div className={cn('h-1 w-8 rounded-full mb-2', t.tone)} />
                <p className="text-sm text-muted-foreground leading-snug">{t.time}</p>
                <p className="mt-1 text-sm font-semibold leading-snug">{t.action}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            中心区间是稳定收益来源 · 超额机会是锦上添花 · 翼仓按时减仓，不靠临场判断
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
