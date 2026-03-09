'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Bell, CalendarClock, ExternalLink } from 'lucide-react';
import { useThesisStore } from '@/lib/store';
import { getReminderSummary } from '@/lib/thesis-tracker';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const LAST_SEEN_KEY = 'zenTrade.reviewReminders.lastSeenAt';

export function ReminderBell() {
  const theses = useThesisStore((state) => state.theses);
  const fetchTheses = useThesisStore((state) => state.fetchTheses);
  const summary = useMemo(() => getReminderSummary(theses), [theses]);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(LAST_SEEN_KEY);
  });

  useEffect(() => {
    if (theses.length === 0) {
      fetchTheses();
    }
  }, [fetchTheses, theses.length]);

  const unreadCount = useMemo(() => {
    if (!lastSeenAt) {
      return summary.pending.length;
    }

    const seenAt = new Date(lastSeenAt).getTime();

    return summary.pending.filter((item) => item.snapshot.createdAt && new Date(item.snapshot.createdAt).getTime() > seenAt).length;
  }, [lastSeenAt, summary.pending]);

  const markAsSeen = () => {
    const now = new Date().toISOString();
    setLastSeenAt(now);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LAST_SEEN_KEY, now);
    }
  };

  return (
    <DropdownMenu onOpenChange={(open) => open && markAsSeen()}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8" aria-label="打开回顾提醒">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 inline-flex h-2 w-2 rounded-full bg-amber-500" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[360px]">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>回顾提醒</span>
          <span className="text-xs font-normal text-muted-foreground">
            {summary.pending.length} 条待处理
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="space-y-3 p-2">
          {summary.pending.length === 0 ? (
            <div className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
              当前没有待回顾的快照
            </div>
          ) : (
            summary.pending.slice(0, 5).map((item) => (
              <Link
                key={item.snapshot.id}
                href={`/thesis/${item.thesis.id}?snapshot=${item.snapshot.id}`}
                className="block rounded-lg border p-3 transition-colors hover:bg-accent/40"
              >
                <div className="mb-1 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.thesis.name}</p>
                    <p className="text-xs text-muted-foreground">{item.reviewBucketLabel}</p>
                  </div>
                  <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                </div>
                <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {item.snapshot.content}
                </p>
                <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span suppressHydrationWarning>
                    {format(item.dueAt, 'MM/dd HH:mm', { locale: zhCN })}
                  </span>
                  <ExternalLink className="h-3 w-3" />
                </div>
              </Link>
            ))
          )}
        </div>
        <DropdownMenuSeparator />
        <div className="p-2">
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href="/review">打开 Review Inbox</Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
