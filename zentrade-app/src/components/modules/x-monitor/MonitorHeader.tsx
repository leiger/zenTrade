'use client';

import { useEffect, useState, useCallback } from 'react';
import { ChevronDown, ExternalLink, History, RefreshCw } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { fetchPastTrackings } from '@/lib/xmonitor-api';
import type { MonitorStatus, TrackingPeriod } from '@/types/xmonitor';

interface MonitorHeaderProps {
  status: MonitorStatus;
  selectedTrackingId: string | null;
  onTrackingChange: (id: string) => void;
  onHistory: () => void;
  refreshing: boolean;
  onRefresh: () => void;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds < 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 24) {
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
  }
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatEndDate(isoString: string): string {
  if (!isoString) return '';
  try {
    const parts = isoString.split('T')[0].split('-');
    if (parts.length >= 3) return `${parts[1]}-${parts[2]}`;
    return isoString;
  } catch {
    return isoString;
  }
}

function getSelectedTracking(status: MonitorStatus, pastTrackings: TrackingPeriod[], trackingId: string | null): TrackingPeriod | null {
  const all = [...(status.activeTrackings || []), ...pastTrackings];
  if (!all.length) return null;
  if (trackingId) {
    return all.find((t) => t.id === trackingId) ?? all[0];
  }
  return status.activeTrackings?.[0] ?? all[0];
}

function getRemainingSeconds(tracking: TrackingPeriod | null): number | null {
  if (!tracking?.endDate) return null;
  const end = new Date(tracking.endDate).getTime();
  return Math.max(0, (end - Date.now()) / 1000);
}

function useTimeSince(isoDate: string | null): string {
  const compute = useCallback(() => {
    if (!isoDate) return 'Never';
    const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
    if (diff < 10) return 'Just now';
    if (diff < 60) return `${diff}s ago`;
    const m = Math.floor(diff / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m ago`;
  }, [isoDate]);

  const [text, setText] = useState(compute);

  useEffect(() => {
    setText(compute());
    const id = setInterval(() => setText(compute()), 5000);
    return () => clearInterval(id);
  }, [compute]);

  return text;
}

export function MonitorHeader({ status, selectedTrackingId, onTrackingChange, onHistory, refreshing, onRefresh }: MonitorHeaderProps) {
  const [pastTrackings, setPastTrackings] = useState<TrackingPeriod[]>([]);

  useEffect(() => {
    fetchPastTrackings().then(setPastTrackings).catch(console.error);
  }, []);

  const tracking = getSelectedTracking(status, pastTrackings, selectedTrackingId);
  const remaining = getRemainingSeconds(tracking);
  const pmUrl = tracking?.marketLink ?? '';
  const syncedAgo = useTimeSince(status.lastPolledAt);
  const { resolvedTheme } = useTheme();

  const pmSlug = pmUrl ? (() => {
    try { return new URL(pmUrl).pathname.split('/').filter(Boolean).pop() || ''; }
    catch { return ''; }
  })() : '';

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Left side: Original Header Info & Stats */}
      <div className="md:col-span-2 space-y-5 flex flex-col">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-5">
            {/* Logo container */}
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary shadow-sm border border-primary/20">
              <svg viewBox="0 0 24 24" className="h-9 w-9 fill-current">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight">X Monitor</h1>
                <span className="text-sm text-border">/</span>
                <a
                  href={`https://x.com/${status.userHandle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-all"
                >
                  <span className="group-hover:underline underline-offset-4 decoration-muted-foreground/30">
                    @{status.userHandle}
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 opacity-70 group-hover:opacity-100" />
                </a>
                <span className="text-sm text-border">/</span>
                <div className="flex items-center text-xs text-muted-foreground whitespace-nowrap">
                  <button
                    onClick={onRefresh}
                    disabled={refreshing}
                    className="inline-flex items-center gap-1 hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
                    <span>{refreshing ? 'Syncing…' : syncedAgo}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Buttons and Sync status below the icon/title but above the dates */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="xs" className="h-8 gap-1.5 rounded-md" asChild>
              <a href="https://xtracker.polymarket.com" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                <span>XTracker</span>
              </a>
            </Button>
            <Button variant="outline" size="xs" className="h-8 gap-1.5 rounded-md" asChild>
              <a href="https://tweetcast.xyz/app/" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                <span>TweetCast</span>
              </a>
            </Button>
          </div>

        </div>

        {/* Tracking Period Buttons above stats */}
        <div className="flex flex-wrap items-center gap-2">
          {status.activeTrackings?.map((t) => {
            const isActive = t.id === (selectedTrackingId ?? status.activeTrackings[0]?.id);
            return (
              <Button
                key={t.id}
                variant={isActive ? 'default' : 'outline'}
                size="xs"
                onClick={() => onTrackingChange(t.id)}
                className="rounded-full"
              >
                {formatEndDate(t.endDate)}
              </Button>
            );
          })}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="xs" className="gap-1.5 text-muted-foreground hover:text-foreground">
                <span>Past</span>
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[240px]">
              <DropdownMenuItem onClick={onHistory} className="font-medium text-foreground cursor-pointer">
                <History className="h-4 w-4 mr-2" />
                All Alert History
              </DropdownMenuItem>
              {pastTrackings.length > 0 && (
                <>
                  <div className="h-px bg-border my-1" />
                  {pastTrackings.map((t) => (
                    <DropdownMenuItem
                      key={t.id}
                      onClick={() => onTrackingChange(t.id)}
                      className={`cursor-pointer ${selectedTrackingId === t.id ? 'bg-accent/50 font-medium' : ''}`}
                    >
                      <span className="truncate">{t.title}</span>
                      <span className="ml-auto flex-shrink-0 text-muted-foreground text-[10px] pl-2">{formatEndDate(t.endDate)}</span>
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Market Title */}
        {tracking?.title && (
          <h2 className="text-md font-medium text-foreground">
            {tracking.title}
          </h2>
        )}

        {/* Stats row boxed and refined */}
        <div className="flex items-center">
          <div className="inline-flex flex-wrap items-center gap-6 rounded-xl border border-border/50 bg-muted/20 px-6 py-3.5 shadow-sm">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">Posts</span>
              <span className="text-lg font-bold tabular-nums text-foreground">{String(tracking?.totalPosts ?? status.currentPostCount)}</span>
            </div>
            <div className="h-5 w-[1px] bg-border/60" />
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">Since Last</span>
              <span className="text-lg font-bold tabular-nums text-foreground">{formatDuration(status.secondsSinceLastPost)}</span>
            </div>
            <div className="h-5 w-[1px] bg-border/60" />
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">Remaining</span>
              <span className="text-lg font-bold tabular-nums text-foreground">{formatDuration(remaining)}</span>
            </div>
            <div className="h-5 w-[1px] bg-border/60" />
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">Pace (Avg)</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold tabular-nums text-foreground">{tracking ? tracking.pace : '—'}</span>
                {tracking && <span className="text-[11px] text-muted-foreground">({tracking.dailyAverage.toFixed(1)}/d)</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side: Polymarket Embed */}
      {pmSlug ? (
        <div className="xl:col-span-1 w-full flex items-center justify-center rounded-2xl overflow-hidden">
          <figure
            className=""
            id={`polymarket-${pmSlug}`}
            aria-label={`Polymarket prediction market: ${tracking?.title ?? 'Market'}`}
            itemScope
            itemType="https://schema.org/WebPage"
            style={{ position: 'relative', display: 'flex', margin: 0, width: '100%', height: 'auto' }}
          >
            <iframe
              title={`${tracking?.title ?? 'Polymarket'} — Polymarket Prediction Market`}
              src={`https://embed.polymarket.com/market?event=${pmSlug}&rotate=true&theme=${resolvedTheme === 'light' ? 'light' : 'dark'}&liveactivity=true&creator=leiger`}
              width="100%"
              height="100%"
              style={{ border: 0, minHeight: '300px', backgroundColor: 'transparent', colorScheme: resolvedTheme === 'light' ? 'light' : 'dark' }}
              allow="clipboard-write"
              {...({ allowtransparency: 'true' } as any)}
            ></iframe>
          </figure>
        </div>
      ) : null}
    </div>
  );
}
