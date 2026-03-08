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
  Clock,
  Link2,
  UserRound,
  ExternalLink,
  MessageSquarePlus,
  CircleCheck,
  CircleX,
  CircleMinus,
} from 'lucide-react';

const VERDICT_CONFIG: Record<Verdict, { label: string; icon: typeof CircleCheck; className: string }> = {
  correct: {
    label: '正确',
    icon: CircleCheck,
    className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20',
  },
  wrong: {
    label: '错误',
    icon: CircleX,
    className: 'bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500/20',
  },
  neutral: {
    label: '持平',
    icon: CircleMinus,
    className: 'bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20',
  },
};

interface SnapshotTimelineProps {
  snapshots: Snapshot[];
  thesisId: string;
  onAddFollowUp: (snapshotId: string, comment: string, verdict: Verdict) => void;
}

export function SnapshotTimeline({ snapshots, thesisId, onAddFollowUp }: SnapshotTimelineProps) {
  const [activeFollowUp, setActiveFollowUp] = useState<string | null>(null);
  const [followUpComment, setFollowUpComment] = useState('');
  const [followUpVerdict, setFollowUpVerdict] = useState<Verdict | null>(null);

  if (snapshots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <CalendarClock className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">暂无快照记录</p>
        <p className="text-xs text-muted-foreground mt-1">点击上方按钮记录你的第一个看法快照</p>
      </div>
    );
  }

  // 按时间倒序排列
  const sorted = [...snapshots].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const handleSubmitFollowUp = (snapshotId: string) => {
    if (!followUpVerdict) return;
    onAddFollowUp(snapshotId, followUpComment.trim(), followUpVerdict);
    setActiveFollowUp(null);
    setFollowUpComment('');
    setFollowUpVerdict(null);
  };

  return (
    <div className="relative space-y-0">
      {/* 竖线 */}
      <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

      {sorted.map((snapshot, index) => {
        const reviewDate = new Date(snapshot.expectedReviewDate);
        const isOverdue = isPast(reviewDate);
        const hasFollowUp = !!snapshot.followUp;
        const isFollowUpActive = activeFollowUp === snapshot.id;
        const canFollowUp = isOverdue && !hasFollowUp;

        return (
          <div key={snapshot.id} className="relative flex gap-4 pb-6 last:pb-0">
            {/* 时间轴节点 */}
            <div className="relative z-10 flex-shrink-0 mt-1">
              <div
                className={cn(
                  'h-[30px] w-[30px] rounded-full border-2 flex items-center justify-center',
                  hasFollowUp
                    ? snapshot.followUp!.verdict === 'correct'
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500'
                      : snapshot.followUp!.verdict === 'wrong'
                        ? 'border-rose-500 bg-rose-500/10 text-rose-500'
                        : 'border-amber-500 bg-amber-500/10 text-amber-500'
                    : index === 0
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-muted-foreground'
                )}
              >
                {hasFollowUp ? (
                  (() => {
                    const Icon = VERDICT_CONFIG[snapshot.followUp!.verdict].icon;
                    return <Icon className="h-4 w-4" />;
                  })()
                ) : (
                  <span className="text-[10px] font-bold">{snapshot.timeline}</span>
                )}
              </div>
            </div>

            {/* 内容卡片 */}
            <div
              className={cn(
                'flex-1 rounded-lg border bg-card p-4 space-y-3 transition-colors',
                index === 0 && !hasFollowUp && 'border-primary/20'
              )}
            >
              {/* 时间与回顾日期 */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span suppressHydrationWarning>
                    {format(new Date(snapshot.createdAt), 'yyyy/MM/dd HH:mm', { locale: zhCN })}
                  </span>
                </div>
                <div
                  className={cn(
                    'flex items-center gap-1',
                    isOverdue && !hasFollowUp ? 'text-amber-400' : 'text-muted-foreground'
                  )}
                >
                  {isOverdue ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <CalendarClock className="h-3 w-3" />
                  )}
                  <span suppressHydrationWarning>
                    {hasFollowUp ? '已回顾' : isOverdue ? '待回顾' : '回顾于'}{' '}
                    {format(reviewDate, 'MM/dd', { locale: zhCN })}
                  </span>
                </div>
              </div>

              {/* 内容 */}
              <p className="text-sm leading-relaxed text-foreground">{snapshot.content}</p>

              {/* 相关链接 */}
              {snapshot.links && snapshot.links.length > 0 && (
                <div className="space-y-1">
                  {snapshot.links.map((link, i) => (
                    <a
                      key={i}
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-primary/70 hover:text-primary transition-colors group"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Link2 className="h-3 w-3 shrink-0" />
                      <span className="truncate underline underline-offset-2 decoration-primary/30 group-hover:decoration-primary">
                        {link}
                      </span>
                      <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                  ))}
                </div>
              )}

              {/* 受谁影响 */}
              {snapshot.influencedBy && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <UserRound className="h-3 w-3 shrink-0" />
                  <span>受 <span className="font-medium text-foreground/80">{snapshot.influencedBy}</span> 影响</span>
                </div>
              )}

              {/* 标签 */}
              {snapshot.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {snapshot.tags.map((tag) => (
                    <Badge
                      key={tag.id}
                      variant={tag.category === 'buy' ? 'secondary' : 'outline'}
                      className={cn(
                        'text-[10px] px-1.5 py-0 font-normal',
                        tag.category === 'sell' && 'text-destructive border-destructive/20'
                      )}
                    >
                      {tag.label}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Follow-up: 已有回顾 */}
              {hasFollowUp && (
                <div className={cn(
                  'rounded-md border p-3 space-y-2',
                  VERDICT_CONFIG[snapshot.followUp!.verdict].className.split(' ').slice(0, 1).join(' '),
                  'bg-muted/30 border-border'
                )}>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn('text-[11px] gap-1 font-medium', VERDICT_CONFIG[snapshot.followUp!.verdict].className)}
                    >
                      {(() => {
                        const cfg = VERDICT_CONFIG[snapshot.followUp!.verdict];
                        const Icon = cfg.icon;
                        return <><Icon className="h-3 w-3" />{cfg.label}</>;
                      })()}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground" suppressHydrationWarning>
                      {format(new Date(snapshot.followUp!.createdAt), 'yyyy/MM/dd HH:mm', { locale: zhCN })}
                    </span>
                  </div>
                  {snapshot.followUp!.comment && (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {snapshot.followUp!.comment}
                    </p>
                  )}
                </div>
              )}

              {/* Follow-up: 可回顾但未回顾 — 触发按钮 */}
              {canFollowUp && !isFollowUpActive && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs h-7 text-amber-500 border-amber-500/20 hover:bg-amber-500/10 hover:text-amber-500"
                  onClick={() => {
                    setActiveFollowUp(snapshot.id);
                    setFollowUpComment('');
                    setFollowUpVerdict(null);
                  }}
                >
                  <MessageSquarePlus className="h-3.5 w-3.5" />
                  回顾跟进
                </Button>
              )}

              {/* Follow-up: 正在回顾 — 输入区域 */}
              {isFollowUpActive && (
                <div className="rounded-md border border-primary/20 p-3 space-y-3 bg-muted/20">
                  {/* Verdict selector */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium">判断结果</p>
                    <div className="flex gap-2">
                      {(Object.keys(VERDICT_CONFIG) as Verdict[]).map((v) => {
                        const cfg = VERDICT_CONFIG[v];
                        const Icon = cfg.icon;
                        const isSelected = followUpVerdict === v;
                        return (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setFollowUpVerdict(v)}
                            className={cn(
                              'flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-all cursor-pointer',
                              isSelected
                                ? cfg.className
                                : 'border-border text-muted-foreground hover:bg-accent/50'
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Comment */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium">回顾评论 <span className="text-muted-foreground font-normal">(可选)</span></p>
                    <Textarea
                      placeholder="回顾你之前的判断，记录新的认知..."
                      value={followUpComment}
                      onChange={(e) => setFollowUpComment(e.target.value)}
                      rows={2}
                      className="bg-background resize-none text-xs"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setActiveFollowUp(null);
                        setFollowUpComment('');
                        setFollowUpVerdict(null);
                      }}
                    >
                      取消
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      disabled={!followUpVerdict}
                      onClick={() => handleSubmitFollowUp(snapshot.id)}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      提交回顾
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
