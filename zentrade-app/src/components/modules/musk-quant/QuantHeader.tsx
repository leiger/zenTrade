'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, RefreshCw, Crosshair } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useMuskQuantStore } from '@/lib/musk-quant-store';
import { countPostsInWindow, countPostsToday } from '@/lib/musk-quant-engine';

function formatEndDate(iso: string): string {
  if (!iso) return '';
  const parts = iso.split('T')[0].split('-');
  return parts.length >= 3 ? `${parts[1]}-${parts[2]}` : iso;
}

function formatRemaining(endIso: string, now: number): string {
  const ms = new Date(endIso).getTime() - now;
  if (ms <= 0) return 'Ended';
  const h = Math.floor(ms / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${h}h ${m}m`;
}

export function QuantHeader() {
  const { events, selectedSlug, posts, refreshing, refresh, selectEvent, lastUpdatedAt } =
    useMuskQuantStore();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const event = events.find((e) => e.slug === selectedSlug) ?? events[0];
  const total = event ? countPostsInWindow(posts, event.startDate, event.endDate) : 0;
  const todayCount = countPostsToday(posts);

  const elapsedDays = event
    ? Math.max(0.25, (now - new Date(event.startDate).getTime()) / 86400_000)
    : 1;
  const pace = total / elapsedDays;

  const syncedAgo = lastUpdatedAt
    ? `${Math.max(0, Math.floor((now - new Date(lastUpdatedAt).getTime()) / 60_000))}m ago`
    : '—';

  return (
    <div className="flex-1 space-y-4 min-w-0">
      <div className="flex items-center gap-5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary shadow-sm border border-primary/20">
          <Crosshair className="h-8 w-8" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight">Musk Quant</h1>
            <span className="text-sm text-border">/</span>
            <span className="text-sm font-medium text-muted-foreground">
              Polymarket tweet-count strategy
            </span>
            <span className="text-sm text-border">/</span>
            <button
              onClick={refresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Syncing…' : syncedAgo}</span>
            </button>
          </div>
          <p className="text-sm text-muted-foreground">
            落点预测 · 价值比排名 · 三层入场结构 · 分阶段操作纪律
          </p>
        </div>
      </div>

      <Separator className="bg-border/50" />

      <div className="flex flex-wrap items-center gap-2">
        {events.map((e) => {
          const isActive = e.slug === (selectedSlug ?? events[0]?.slug);
          return (
            <Button
              key={e.slug}
              variant={isActive ? 'default' : 'outline'}
              size="xs"
              onClick={() => selectEvent(e.slug)}
              className="rounded-full"
            >
              {formatEndDate(e.endDate)}
            </Button>
          );
        })}
        {event && (
          <Button variant="ghost" size="xs" className="gap-1.5 text-muted-foreground hover:text-foreground" asChild>
            <a href={`https://polymarket.com/event/${event.slug}`} target="_blank" rel="noopener noreferrer">
              <span>Open market</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
        )}
      </div>

      {event && (
        <>
          <h2 className="text-md font-medium text-foreground">{event.title}</h2>
          <div className="flex items-center">
            <div className="inline-flex flex-wrap items-center gap-6 rounded-xl border border-border/50 bg-muted/20 px-6 py-3.5 shadow-sm">
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">Posts</span>
                <span className="text-lg font-bold tabular-nums text-foreground">{total}</span>
              </div>
              <div className="h-5 w-[1px] bg-border/60" />
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">Today</span>
                <span className="text-lg font-bold tabular-nums text-foreground">{todayCount}</span>
              </div>
              <div className="h-5 w-[1px] bg-border/60" />
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">Remaining</span>
                <span className="text-lg font-bold tabular-nums text-foreground">
                  {formatRemaining(event.endDate, now)}
                </span>
              </div>
              <div className="h-5 w-[1px] bg-border/60" />
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">Pace</span>
                <span className="text-lg font-bold tabular-nums text-foreground">{pace.toFixed(1)}/d</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
