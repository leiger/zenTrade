'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { addDays, format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  CalendarClock,
  CheckCircle2,
  CircleCheck,
  CircleMinus,
  CircleX,
  ExternalLink,
  Inbox,
  Search,
} from 'lucide-react';
import type { ThesisStatus, Verdict } from '@/types/thesis';
import { useThesisStore } from '@/lib/store';
import {
  THESIS_STATUS_CONFIG,
  flattenReviewInbox,
  getReminderSummary,
  getReviewBucketLabel,
  type ReviewBucket,
} from '@/lib/thesis-tracker';
import { ThesisStatusBadge } from '@/components/modules/thesis-tracker/ThesisStatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const REVIEW_BUCKETS: Array<{ value: ReviewBucket; label: string }> = [
  { value: 'overdue', label: '已逾期' },
  { value: 'today', label: '今天到期' },
  { value: 'upcoming', label: '即将到期' },
];

const VERDICTS: Array<{ value: Verdict; label: string; icon: typeof CircleCheck; className: string }> = [
  {
    value: 'correct',
    label: '正确',
    icon: CircleCheck,
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600',
  },
  {
    value: 'wrong',
    label: '错误',
    icon: CircleX,
    className: 'border-rose-500/30 bg-rose-500/10 text-rose-600',
  },
  {
    value: 'neutral',
    label: '持平',
    icon: CircleMinus,
    className: 'border-amber-500/30 bg-amber-500/10 text-amber-600',
  },
];

type DraftState = Record<string, { verdict: Verdict | null; comment: string }>;

export default function ReviewPage() {
  const theses = useThesisStore((state) => state.theses);
  const loading = useThesisStore((state) => state.loading);
  const fetchTheses = useThesisStore((state) => state.fetchTheses);
  const addFollowUp = useThesisStore((state) => state.addFollowUp);
  const updateSnapshot = useThesisStore((state) => state.updateSnapshot);

  const [query, setQuery] = useState('');
  const [bucketFilter, setBucketFilter] = useState<'all' | ReviewBucket>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ThesisStatus>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftState>({});

  useEffect(() => {
    fetchTheses();
  }, [fetchTheses]);

  const reminders = useMemo(() => getReminderSummary(theses), [theses]);
  const inboxItems = useMemo(() => flattenReviewInbox(theses), [theses]);

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    return inboxItems
      .filter((item) => bucketFilter === 'all' || item.reviewBucket === bucketFilter)
      .filter((item) => statusFilter === 'all' || item.thesis.status === statusFilter)
      .filter((item) => {
        if (!keyword) return true;

        const haystack = [
          item.thesis.name,
          item.thesis.asset,
          item.snapshot.content,
          ...item.snapshot.tags.map((tag) => tag.label),
          ...item.snapshot.influencedBy,
        ]
          .join(' ')
          .toLowerCase();

        return haystack.includes(keyword);
      })
      .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  }, [bucketFilter, inboxItems, query, statusFilter]);

  const groups = useMemo(
    () =>
      REVIEW_BUCKETS.map((bucket) => ({
        ...bucket,
        items: filteredItems.filter((item) => item.reviewBucket === bucket.value),
      })),
    [filteredItems]
  );

  const updateDraft = (snapshotId: string, patch: Partial<{ verdict: Verdict | null; comment: string }>) => {
    setDrafts((current) => ({
      ...current,
      [snapshotId]: {
        verdict: current[snapshotId]?.verdict ?? null,
        comment: current[snapshotId]?.comment ?? '',
        ...patch,
      },
    }));
  };

  const submitFollowUp = async (thesisId: string, snapshotId: string) => {
    const draft = drafts[snapshotId];
    if (!draft?.verdict) return;

    await addFollowUp(thesisId, snapshotId, {
      verdict: draft.verdict,
      comment: draft.comment.trim(),
    });

    setOpenId(null);
    setDrafts((current) => {
      const next = { ...current };
      delete next[snapshotId];
      return next;
    });
  };

  const postponeReview = async (thesisId: string, snapshotId: string, days: number) => {
    await updateSnapshot(thesisId, snapshotId, {
      timeline: 'custom',
      expectedReviewDate: addDays(new Date(), days).toISOString(),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <Inbox className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Review Inbox</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            集中处理所有待回顾快照，避免 thesis 分散后遗漏复盘。
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/thesis">返回 Thesis Tracker</Link>
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard label="已逾期" value={reminders.overdue.length} accent="text-rose-500" />
        <SummaryCard label="今天到期" value={reminders.today.length} accent="text-amber-500" />
        <SummaryCard label="即将到期" value={reminders.upcoming.length} accent="text-sky-500" />
      </div>

      <div className="rounded-xl border bg-background/70 p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_160px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索资产、快照内容、标签、影响来源…"
              className="pl-9"
              name="review-search"
              autoComplete="off"
              aria-label="搜索待回顾快照"
            />
          </div>

          <Select value={bucketFilter} onValueChange={(value) => setBucketFilter(value as 'all' | ReviewBucket)}>
            <SelectTrigger className="w-full" aria-label="按回顾状态筛选">
              <SelectValue placeholder="回顾状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部回顾状态</SelectItem>
              {REVIEW_BUCKETS.map((bucket) => (
                <SelectItem key={bucket.value} value={bucket.value}>
                  {bucket.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | ThesisStatus)}>
            <SelectTrigger className="w-full" aria-label="按 thesis 生命周期筛选">
              <SelectValue placeholder="生命周期" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部生命周期</SelectItem>
              {Object.entries(THESIS_STATUS_CONFIG).map(([value, config]) => (
                <SelectItem key={value} value={value}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading && theses.length === 0 ? (
        <div className="rounded-xl border px-4 py-16 text-center text-sm text-muted-foreground">
          正在加载 Review Inbox…
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.value} className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{group.label}</h2>
                <Badge variant="outline" className="text-[10px] font-normal">
                  {group.items.length}
                </Badge>
              </div>

              {group.items.length === 0 ? (
                <div className="rounded-xl border border-dashed px-4 py-8 text-sm text-muted-foreground">
                  当前分组没有待处理快照。
                </div>
              ) : (
                <div className="space-y-3">
                  {group.items.map((item) => {
                    const draft = drafts[item.snapshot.id] ?? { verdict: null, comment: '' };
                    const isOpen = openId === item.snapshot.id;
                    const dueText = item.reviewBucket === 'overdue'
                      ? `已逾期 ${Math.abs(item.daysDelta)} 天`
                      : item.reviewBucket === 'today'
                        ? '今天到期'
                        : `${item.daysDelta} 天后到期`;

                    return (
                      <div key={item.snapshot.id} className="rounded-xl border bg-card p-4 shadow-sm">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 flex-1 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-base font-semibold">{item.thesis.name}</p>
                              <ThesisStatusBadge status={item.thesis.status} />
                              {item.thesis.asset && (
                                <Badge variant="secondary" className="text-[10px] font-mono font-normal">
                                  {item.thesis.asset}
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-[10px] font-normal">
                                {getReviewBucketLabel(item.reviewBucket)}
                              </Badge>
                            </div>

                            <p className="text-sm leading-relaxed text-foreground/90">
                              {item.snapshot.content}
                            </p>

                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <CalendarClock className="h-3.5 w-3.5" />
                                <span suppressHydrationWarning>
                                  {format(item.dueAt, 'yyyy/MM/dd HH:mm', { locale: zhCN })}
                                </span>
                              </span>
                              <span className={cn(
                                'rounded-full px-2 py-0.5',
                                item.reviewBucket === 'overdue'
                                  ? 'bg-rose-500/10 text-rose-500'
                                  : item.reviewBucket === 'today'
                                    ? 'bg-amber-500/10 text-amber-500'
                                    : 'bg-sky-500/10 text-sky-500'
                              )}>
                                {dueText}
                              </span>
                              {item.snapshot.tags.map((tag) => (
                                <Badge key={tag.id} variant="outline" className="text-[10px] font-normal">
                                  {tag.label}
                                </Badge>
                              ))}
                            </div>

                            {item.snapshot.influencedBy.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                                <span>受影响于</span>
                                {item.snapshot.influencedBy.map((source) => (
                                  <Badge key={source} variant="secondary" className="text-[10px] font-normal">
                                    {source}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 lg:w-[280px] lg:justify-end">
                            <Button asChild variant="outline" size="sm" className="gap-1.5">
                              <Link href={`/thesis/${item.thesis.id}?snapshot=${item.snapshot.id}`}>
                                <ExternalLink className="h-3.5 w-3.5" />
                                查看详情
                              </Link>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => postponeReview(item.thesis.id, item.snapshot.id, 1)}
                            >
                              延后 1 天
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => postponeReview(item.thesis.id, item.snapshot.id, 7)}
                            >
                              延后 1 周
                            </Button>
                            <Button size="sm" onClick={() => setOpenId(isOpen ? null : item.snapshot.id)}>
                              {isOpen ? '收起' : '开始回顾'}
                            </Button>
                          </div>
                        </div>

                        {isOpen && (
                          <div className="mt-4 rounded-lg border border-primary/15 bg-muted/20 p-3">
                            <div className="mb-3 flex flex-wrap gap-2">
                              {VERDICTS.map((option) => {
                                const Icon = option.icon;
                                const selected = draft.verdict === option.value;

                                return (
                                  <button
                                    key={option.value}
                                    type="button"
                                    className={cn(
                                      'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                                      selected ? option.className : 'border-border text-muted-foreground hover:bg-accent'
                                    )}
                                    onClick={() => updateDraft(item.snapshot.id, { verdict: option.value })}
                                  >
                                    <Icon className="h-3.5 w-3.5" />
                                    {option.label}
                                  </button>
                                );
                              })}
                            </div>

                            <Textarea
                              value={draft.comment}
                              onChange={(event) => updateDraft(item.snapshot.id, { comment: event.target.value })}
                              rows={3}
                              placeholder="记录本次回顾结论、修正点或执行偏差…"
                              className="resize-none bg-background text-sm"
                              name={`review-comment-${item.snapshot.id}`}
                              aria-label="回顾备注"
                            />

                            <div className="mt-3 flex flex-wrap justify-end gap-2">
                              <Button variant="ghost" size="sm" onClick={() => setOpenId(null)}>
                                取消
                              </Button>
                              <Button
                                size="sm"
                                className="gap-1.5"
                                disabled={!draft.verdict}
                                onClick={() => submitFollowUp(item.thesis.id, item.snapshot.id)}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                提交回顾
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="rounded-xl border bg-gradient-to-t from-primary/5 to-card px-4 py-3 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-2xl font-semibold tabular-nums', accent)}>{value}</p>
    </div>
  );
}
