'use client';

import { useState } from 'react';
import { Snapshot, Verdict } from '@/types/thesis';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { format, isPast } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  CalendarClock,
  Camera,
  CheckCircle2,
  ChevronRight,
  CircleCheck,
  CircleX,
  CircleMinus,
  Sparkles,
  MessageSquarePlus,
  Pencil,
  Trash2,
  Clock,
} from 'lucide-react';

const TIMELINE_COLORS: Record<string, string> = {
  '1D': 'bg-sky-500',
  '1W': 'bg-blue-500',
  '1M': 'bg-indigo-500',
  '1Q': 'bg-purple-500',
  custom: 'bg-pink-500',
};



const VERDICT_CONFIG: Record<Verdict, { label: string; icon: typeof CircleCheck; className: string }> = {
  correct: { label: '正确', icon: CircleCheck, className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20' },
  wrong: { label: '错误', icon: CircleX, className: 'bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500/20' },
  neutral: { label: '持平', icon: CircleMinus, className: 'bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20' },
};

interface SnapshotTimelineProps {
  snapshots: Snapshot[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddFollowUp: (snapshotId: string, comment: string, verdict: Verdict) => void;
  onDeleteFollowUp: (snapshotId: string) => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function SnapshotTimeline({
  snapshots,
  selectedId,
  onSelect,
  onAddFollowUp,
  onDeleteFollowUp,
  emptyTitle = '暂无快照记录',
  emptyDescription = '点击上方按钮记录你的第一个看法快照',
}: SnapshotTimelineProps) {
  const [followUpId, setFollowUpId] = useState<string | null>(null);
  const [followUpComment, setFollowUpComment] = useState('');
  const [followUpVerdict, setFollowUpVerdict] = useState<Verdict | null>(null);

  const handleSubmitFollowUp = () => {
    if (!followUpId || !followUpVerdict) return;
    onAddFollowUp(followUpId, followUpComment.trim(), followUpVerdict);
    setFollowUpId(null);
    setFollowUpComment('');
    setFollowUpVerdict(null);
  };

  if (snapshots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <CalendarClock className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">{emptyTitle}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {emptyDescription}
        </p>
      </div>
    );
  }

  const sorted = [...snapshots].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="relative">
      {/* Vertical timeline line */}
      <div className="absolute left-[7px] top-4 bottom-4 w-px bg-gradient-to-b from-border via-border/60 to-transparent" />

      <div className="space-y-6">
        {sorted.map((snapshot, index) => {
          const reviewDate = new Date(snapshot.expectedReviewDate);
          const isOverdue = isPast(reviewDate);
          const hasFollowUp = !!snapshot.followUp;
          const isSelected = selectedId === snapshot.id;
          const hasAi = !!snapshot.aiAnalysis;
          const canFollowUp = isOverdue && !hasFollowUp;
          const isFollowUpOpen = followUpId === snapshot.id;

          // Dot color
          const dotColor = hasFollowUp
            ? snapshot.followUp!.verdict === 'correct'
              ? 'bg-emerald-500'
              : snapshot.followUp!.verdict === 'wrong'
                ? 'bg-rose-500'
                : 'bg-amber-500'
            : isOverdue
              ? 'bg-amber-400'
              : index === 0
                ? 'bg-primary'
                : 'bg-muted-foreground/30';

          return (
            <div key={snapshot.id} className="relative group/item">
              {/* ── Timeline Header: Creation → Review ── */}
              <div className="flex items-stretch gap-0 mb-3.5">
                {/* Timeline dot on vertical axis */}
                <div className="relative flex items-center justify-center w-[15px] shrink-0">
                  <div className={cn(
                    'h-2.5 w-2.5 rounded-full ring-[3px] ring-background z-10 shadow-sm',
                    dotColor
                  )} />
                </div>

                {/* Date cards row */}
                <div className="flex items-center gap-0 flex-1 ml-2">
                  {/* 1. Start: Creation Date */}
                  <div className={cn(
                    'flex items-center gap-2.5 pl-3 pr-4 py-2 rounded-l-lg border-y border-l transition-all duration-300',
                    index === 0
                      ? 'bg-primary/[0.04] border-primary/15'
                      : 'bg-muted/20 border-border/40'
                  )}>
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/8 shrink-0">
                      <Camera className="h-3.5 w-3.5 text-primary/70" />
                    </div>
                    <div className="flex flex-col leading-none gap-0.5">
                      <span className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-widest leading-none">
                        记录
                      </span>
                      <span className="text-[13px] font-bold text-foreground tabular-nums tracking-tight leading-none" suppressHydrationWarning>
                        {format(new Date(snapshot.createdAt), 'MM.dd', { locale: zhCN })}
                        <span className="text-[11px] font-medium text-muted-foreground/40 ml-1">
                          {format(new Date(snapshot.createdAt), 'HH:mm', { locale: zhCN })}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* 2. Arrow Connector */}
                  <div className="flex items-center px-0 shrink-0">
                    <div className={cn(
                      'flex items-center h-full py-2 px-2 border-y',
                      index === 0 ? 'border-primary/15' : 'border-border/40',
                      hasFollowUp
                        ? snapshot.followUp!.verdict === 'correct'
                          ? 'border-y-emerald-500/15'
                          : snapshot.followUp!.verdict === 'wrong'
                            ? 'border-y-rose-500/15'
                            : 'border-y-amber-500/15'
                        : isOverdue
                          ? 'border-y-amber-500/15'
                          : ''
                    )}>
                      <div className="flex items-center gap-0.5">
                        <div className={cn(
                          'w-6 h-px',
                          hasFollowUp
                            ? snapshot.followUp!.verdict === 'correct'
                              ? 'bg-emerald-500/25'
                              : snapshot.followUp!.verdict === 'wrong'
                                ? 'bg-rose-500/25'
                                : 'bg-amber-500/25'
                            : isOverdue
                              ? 'bg-amber-500/25'
                              : 'bg-border/40'
                        )} />
                        <ChevronRight className={cn(
                          'h-3 w-3 -ml-1',
                          hasFollowUp
                            ? snapshot.followUp!.verdict === 'correct'
                              ? 'text-emerald-500/40'
                              : snapshot.followUp!.verdict === 'wrong'
                                ? 'text-rose-500/40'
                                : 'text-amber-500/40'
                            : isOverdue
                              ? 'text-amber-500/40'
                              : 'text-muted-foreground/20'
                        )} />
                      </div>
                    </div>
                  </div>

                  {/* 3. End: Review Status */}
                  {hasFollowUp ? (
                    <div className={cn(
                      'flex items-center gap-2.5 pl-3 pr-3 py-2 rounded-r-lg border-y border-r shadow-sm transition-all duration-300',
                      snapshot.followUp!.verdict === 'correct' && 'bg-emerald-500/[0.04] border-emerald-500/15 text-emerald-600',
                      snapshot.followUp!.verdict === 'wrong' && 'bg-rose-500/[0.04] border-rose-500/15 text-rose-600',
                      snapshot.followUp!.verdict === 'neutral' && 'bg-amber-500/[0.04] border-amber-500/15 text-amber-600',
                    )}>
                      <div className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-md shrink-0 transition-transform duration-500 group-hover/item:rotate-[360deg]',
                        snapshot.followUp!.verdict === 'correct' && 'bg-emerald-500/10',
                        snapshot.followUp!.verdict === 'wrong' && 'bg-rose-500/10',
                        snapshot.followUp!.verdict === 'neutral' && 'bg-amber-500/10',
                      )}>
                        {snapshot.followUp!.verdict === 'correct' && <CircleCheck className="h-3.5 w-3.5" />}
                        {snapshot.followUp!.verdict === 'wrong' && <CircleX className="h-3.5 w-3.5" />}
                        {snapshot.followUp!.verdict === 'neutral' && <CircleMinus className="h-3.5 w-3.5" />}
                      </div>
                      <div className="flex flex-col leading-none gap-0.5">
                        <span className="text-[10px] font-black uppercase tracking-widest leading-none">
                          {VERDICT_CONFIG[snapshot.followUp!.verdict].label}
                        </span>
                        <span className="text-[13px] font-bold tabular-nums tracking-tight leading-none opacity-70" suppressHydrationWarning>
                          {format(new Date(snapshot.followUp!.createdAt), 'MM.dd', { locale: zhCN })}
                          <span className="text-[11px] font-medium opacity-60 ml-1">
                            {format(new Date(snapshot.followUp!.createdAt), 'HH:mm', { locale: zhCN })}
                          </span>
                        </span>
                      </div>
                    </div>
                  ) : isOverdue ? (
                    <div className="flex items-center gap-2.5 pl-3 pr-3 py-2 rounded-r-lg border-y border-r bg-amber-500/[0.04] border-amber-500/20 text-amber-600 shadow-sm shadow-amber-500/5">
                      <div className="relative flex h-7 w-7 items-center justify-center rounded-md bg-amber-500/10 shrink-0">
                        <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-amber-400 opacity-60" />
                        <CalendarClock className="h-3.5 w-3.5 relative z-10" />
                      </div>
                      <div className="flex flex-col leading-none gap-0.5">
                        <span className="text-[10px] font-black uppercase tracking-widest leading-none animate-pulse">
                          待回顾
                        </span>
                        <span className="text-[13px] font-bold tabular-nums tracking-tight leading-none opacity-60" suppressHydrationWarning>
                          {format(reviewDate, 'MM.dd', { locale: zhCN })}
                          <span className="text-[11px] font-medium opacity-60 ml-1">
                            预计
                          </span>
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 pl-3 pr-3 py-2 rounded-r-lg border-y border-r bg-muted/10 border-border/30 text-muted-foreground/50 group-hover/item:bg-muted/20 transition-all">
                      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted/30 shrink-0">
                        <Clock className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex flex-col leading-none gap-0.5">
                        <span className="text-[10px] font-medium uppercase tracking-widest leading-none opacity-60">
                          预计回顾
                        </span>
                        <span className="text-[13px] font-bold tabular-nums tracking-tight leading-none" suppressHydrationWarning>
                          {format(reviewDate, 'MM.dd', { locale: zhCN })}
                          <span className="text-[11px] font-medium opacity-50 ml-1">
                            {format(reviewDate, 'yyyy', { locale: zhCN })}
                          </span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Snapshot Card Area */}
              <div className="pl-[23px] pb-5 last:pb-0">
                {/* Snapshot card */}
                <div
                  className={cn(
                    'relative rounded-xl border p-4 transition-all duration-300 cursor-pointer overflow-hidden',
                    isSelected
                      ? 'border-primary/40 bg-linear-to-br from-primary/[0.04] to-transparent shadow-lg shadow-primary/5 ring-1 ring-primary/20 backdrop-blur-xs'
                      : 'bg-card hover:bg-accent/40 hover:border-border/80 hover:shadow-md',
                  )}
                  onClick={() => onSelect(snapshot.id)}
                >
                  {/* Subtle corner indicator for AI */}
                  {hasAi && (
                    <div className="absolute top-0 right-0 h-10 w-10 overflow-hidden pointer-events-none">
                      <div className="absolute top-0 right-0 h-[1px] w-[200%] bg-violet-500/30 rotate-45 translate-x-[30%] translate-y-[30%]" />
                    </div>
                  )}

                  <p className="text-sm leading-relaxed text-foreground/90 font-medium line-clamp-2 mb-3">
                    {snapshot.content}
                  </p>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="outline" className="text-[11px] px-1.5 py-0 font-medium gap-1">
                      <span className={cn('h-1.5 w-1.5 rounded-full', TIMELINE_COLORS[snapshot.timeline] ?? 'bg-muted-foreground')} />
                      {snapshot.timeline === 'custom' ? '自定义' : snapshot.timeline}
                    </Badge>

                    {hasAi && (
                      <>
                        <span className="text-muted-foreground/30">·</span>
                        <Sparkles className="h-3 w-3 text-violet-400" />
                      </>
                    )}

                    {snapshot.tags.length > 0 && (
                      <>
                        <span className="text-muted-foreground/30">·</span>
                        {snapshot.tags.map((tag) => (
                          <Badge
                            key={tag.id}
                            variant="outline"
                            className={cn(
                              'text-[11px] px-1.5 py-0 font-normal',
                              tag.category === 'buy'
                                ? 'text-emerald-600 border-emerald-500/30'
                                : 'text-rose-600 border-rose-500/30'
                            )}
                          >
                            {tag.label}
                          </Badge>
                        ))}
                      </>
                    )}
                  </div>
                </div>

                {/* Follow-up: reviewed result display */}
                {hasFollowUp && !isFollowUpOpen && (
                  <div className="group/review rounded-md border bg-muted/30 p-2.5 space-y-1.5 relative">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] px-1.5 py-0 font-medium gap-0.5',
                            snapshot.followUp!.verdict === 'correct' && 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10',
                            snapshot.followUp!.verdict === 'wrong' && 'text-rose-500 border-rose-500/30 bg-rose-500/10',
                            snapshot.followUp!.verdict === 'neutral' && 'text-amber-500 border-amber-500/30 bg-amber-500/10',
                          )}
                        >
                          {snapshot.followUp!.verdict === 'correct' && <CircleCheck className="h-2.5 w-2.5" />}
                          {snapshot.followUp!.verdict === 'wrong' && <CircleX className="h-2.5 w-2.5" />}
                          {snapshot.followUp!.verdict === 'neutral' && <CircleMinus className="h-2.5 w-2.5" />}
                          {VERDICT_CONFIG[snapshot.followUp!.verdict].label}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground/60" suppressHydrationWarning>
                          {format(new Date(snapshot.followUp!.createdAt), 'MM/dd HH:mm', { locale: zhCN })}
                        </span>
                      </div>
                      <div className="opacity-0 group-hover/review:opacity-100 transition-opacity flex items-center gap-0.5">
                        <button
                          type="button"
                          className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
                          aria-label="编辑回顾"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFollowUpId(snapshot.id);
                            setFollowUpComment(snapshot.followUp!.comment);
                            setFollowUpVerdict(snapshot.followUp!.verdict);
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                          aria-label="删除回顾"
                          onClick={(e) => { e.stopPropagation(); onDeleteFollowUp(snapshot.id); }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    {snapshot.followUp!.comment && (
                      <p className="text-xs text-muted-foreground leading-relaxed">{snapshot.followUp!.comment}</p>
                    )}
                  </div>
                )}

                {/* Follow-up: action button */}
                {canFollowUp && !isFollowUpOpen && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs h-7 text-amber-500 border-amber-500/20 hover:bg-amber-500/10 hover:text-amber-500"
                    onClick={(e) => { e.stopPropagation(); setFollowUpId(snapshot.id); setFollowUpComment(''); setFollowUpVerdict(null); }}
                  >
                    <MessageSquarePlus className="h-3.5 w-3.5" />
                    回顾跟进
                  </Button>
                )}

                {/* Follow-up: inline form */}
                {isFollowUpOpen && (
                  <div className="rounded-lg border border-primary/20 p-3 space-y-3 bg-muted/20">
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium">判断结果</p>
                      <div className="flex gap-1.5">
                        {(Object.keys(VERDICT_CONFIG) as Verdict[]).map((v) => {
                          const cfg = VERDICT_CONFIG[v];
                          const Icon = cfg.icon;
                          return (
                            <button
                              key={v}
                              type="button"
                              onClick={() => setFollowUpVerdict(v)}
                              className={cn(
                                'flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-all cursor-pointer',
                                followUpVerdict === v ? cfg.className : 'border-border text-muted-foreground hover:bg-accent/50'
                              )}
                            >
                              <Icon className="h-3.5 w-3.5" />
                              {cfg.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <Textarea
                      placeholder="回顾你之前的判断…（可选）"
                      value={followUpComment}
                      onChange={(e) => setFollowUpComment(e.target.value)}
                      rows={2}
                      className="bg-background resize-none text-xs"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => { setFollowUpId(null); setFollowUpComment(''); setFollowUpVerdict(null); }}
                      >
                        取消
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        disabled={!followUpVerdict}
                        onClick={handleSubmitFollowUp}
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        提交
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div >
  );
}
