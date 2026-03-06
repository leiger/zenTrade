'use client';

import { Snapshot } from '@/types/thesis';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, isPast } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { CalendarClock, CheckCircle2, Clock } from 'lucide-react';

interface SnapshotTimelineProps {
  snapshots: Snapshot[];
}

export function SnapshotTimeline({ snapshots }: SnapshotTimelineProps) {
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

  return (
    <div className="relative space-y-0">
      {/* 竖线 */}
      <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

      {sorted.map((snapshot, index) => {
        const reviewDate = new Date(snapshot.expectedReviewDate);
        const isOverdue = isPast(reviewDate);

        return (
          <div key={snapshot.id} className="relative flex gap-4 pb-6 last:pb-0">
            {/* 时间轴节点 */}
            <div className="relative z-10 flex-shrink-0 mt-1">
              <div
                className={cn(
                  'h-[30px] w-[30px] rounded-full border-2 flex items-center justify-center',
                  index === 0
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground'
                )}
              >
                <span className="text-[10px] font-bold">{snapshot.timeline}</span>
              </div>
            </div>

            {/* 内容卡片 */}
            <div
              className={cn(
                'flex-1 rounded-lg border bg-card p-4 space-y-3 transition-colors',
                index === 0 && 'border-primary/20'
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
                    isOverdue ? 'text-amber-400' : 'text-muted-foreground'
                  )}
                >
                  {isOverdue ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <CalendarClock className="h-3 w-3" />
                  )}
                  <span suppressHydrationWarning>
                    {isOverdue ? '待回顾' : '回顾于'}{' '}
                    {format(reviewDate, 'MM/dd', { locale: zhCN })}
                  </span>
                </div>
              </div>

              {/* 内容 */}
              <p className="text-sm leading-relaxed text-foreground">{snapshot.content}</p>

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
            </div>
          </div>
        );
      })}
    </div>
  );
}
