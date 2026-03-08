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
  CheckCircle2,
  CircleCheck,
  CircleX,
  CircleMinus,
  Clock,
  Sparkles,
  AlertCircle,
  MessageSquarePlus,
} from 'lucide-react';

const TIMELINE_COLORS: Record<string, string> = {
  '1D': 'bg-sky-500',
  '1W': 'bg-blue-500',
  '1M': 'bg-indigo-500',
  '1Q': 'bg-purple-500',
  custom: 'bg-pink-500',
};

const VERDICT_DOT: Record<Verdict, { icon: typeof CircleCheck; border: string; bg: string; text: string }> = {
  correct: { icon: CircleCheck, border: 'border-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-500' },
  wrong: { icon: CircleX, border: 'border-rose-500', bg: 'bg-rose-500/10', text: 'text-rose-500' },
  neutral: { icon: CircleMinus, border: 'border-amber-500', bg: 'bg-amber-500/10', text: 'text-amber-500' },
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
}

export function SnapshotTimeline({ snapshots, selectedId, onSelect, onAddFollowUp }: SnapshotTimelineProps) {
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
        <p className="text-sm text-muted-foreground">暂无快照记录</p>
        <p className="text-xs text-muted-foreground mt-1">
          点击上方按钮记录你的第一个看法快照
        </p>
      </div>
    );
  }

  const sorted = [...snapshots].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="relative space-y-0">
      <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

      {sorted.map((snapshot, index) => {
        const reviewDate = new Date(snapshot.expectedReviewDate);
        const isOverdue = isPast(reviewDate);
        const hasFollowUp = !!snapshot.followUp;
        const isSelected = selectedId === snapshot.id;
        const hasAi = !!snapshot.aiAnalysis;
        const canFollowUp = isOverdue && !hasFollowUp;
        const isFollowUpOpen = followUpId === snapshot.id;

        return (
          <div key={snapshot.id} className="relative flex gap-3 pb-4 last:pb-0">
            {/* Timeline dot */}
            <div className="relative z-10 flex-shrink-0 mt-1.5">
              {hasFollowUp ? (
                <div className={cn(
                  'h-[28px] w-[28px] rounded-full border-2 flex items-center justify-center',
                  VERDICT_DOT[snapshot.followUp!.verdict].border,
                  VERDICT_DOT[snapshot.followUp!.verdict].bg,
                  VERDICT_DOT[snapshot.followUp!.verdict].text,
                )}>
                  {(() => {
                    const Icon = VERDICT_DOT[snapshot.followUp!.verdict].icon;
                    return <Icon className="h-3.5 w-3.5" />;
                  })()}
                </div>
              ) : isOverdue ? (
                <div className="h-[28px] w-[28px] rounded-full border-2 border-amber-400 bg-amber-400/10 flex items-center justify-center">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
                </div>
              ) : (
                <div className={cn(
                  'h-[28px] w-[28px] rounded-full border-2 flex items-center justify-center',
                  index === 0 ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground'
                )}>
                  <Clock className="h-3 w-3" />
                </div>
              )}
            </div>

            {/* Card */}
            <div className="flex-1 space-y-2">
              <div
                className={cn(
                  'rounded-lg border p-3 transition-all duration-150 cursor-pointer',
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'bg-card hover:bg-accent/30 hover:border-border/80',
                )}
                onClick={() => onSelect(snapshot.id)}
              >
                <p className="text-sm leading-snug text-foreground line-clamp-2 mb-2">
                  {snapshot.content}
                </p>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] text-muted-foreground" suppressHydrationWarning>
                    {format(new Date(snapshot.createdAt), 'MM/dd HH:mm', { locale: zhCN })}
                  </span>

                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-medium gap-1">
                    <span className={cn('h-1.5 w-1.5 rounded-full', TIMELINE_COLORS[snapshot.timeline] ?? 'bg-muted-foreground')} />
                    {snapshot.timeline === 'custom' ? '自定义' : snapshot.timeline}
                  </Badge>

                  {hasFollowUp ? (
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] px-1.5 py-0 font-medium gap-0.5',
                        snapshot.followUp!.verdict === 'correct' && 'text-emerald-500 border-emerald-500/30',
                        snapshot.followUp!.verdict === 'wrong' && 'text-rose-500 border-rose-500/30',
                        snapshot.followUp!.verdict === 'neutral' && 'text-amber-500 border-amber-500/30',
                      )}
                    >
                      {snapshot.followUp!.verdict === 'correct' && <CircleCheck className="h-2.5 w-2.5" />}
                      {snapshot.followUp!.verdict === 'wrong' && <CircleX className="h-2.5 w-2.5" />}
                      {snapshot.followUp!.verdict === 'neutral' && <CircleMinus className="h-2.5 w-2.5" />}
                      已回顾
                    </Badge>
                  ) : isOverdue ? (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-medium gap-0.5 text-amber-500 border-amber-500/30">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      待回顾
                    </Badge>
                  ) : (
                    <span className="text-[10px] text-muted-foreground/60 flex items-center gap-0.5" suppressHydrationWarning>
                      <CalendarClock className="h-2.5 w-2.5" />
                      {format(reviewDate, 'MM/dd', { locale: zhCN })}
                    </span>
                  )}

                  {hasAi && <Sparkles className="h-3 w-3 text-violet-400" />}

                  {snapshot.tags.length > 0 && (
                    <span className="text-[10px] text-muted-foreground/50">
                      {snapshot.tags.length} 标签
                    </span>
                  )}
                </div>
              </div>

              {/* Follow-up: reviewed result display */}
              {hasFollowUp && snapshot.followUp!.comment && (
                <div className="ml-1 rounded-md border bg-muted/30 p-2.5 text-xs text-muted-foreground leading-relaxed">
                  {snapshot.followUp!.comment}
                </div>
              )}

              {/* Follow-up: action button */}
              {canFollowUp && !isFollowUpOpen && (
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-1 gap-1.5 text-xs h-7 text-amber-500 border-amber-500/20 hover:bg-amber-500/10 hover:text-amber-500"
                  onClick={(e) => { e.stopPropagation(); setFollowUpId(snapshot.id); setFollowUpComment(''); setFollowUpVerdict(null); }}
                >
                  <MessageSquarePlus className="h-3.5 w-3.5" />
                  回顾跟进
                </Button>
              )}

              {/* Follow-up: inline form */}
              {isFollowUpOpen && (
                <div className="ml-1 rounded-lg border border-primary/20 p-3 space-y-3 bg-muted/20">
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
  );
}
