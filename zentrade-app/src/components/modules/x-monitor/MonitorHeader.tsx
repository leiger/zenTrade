'use client';

import { useEffect, useState, useCallback } from 'react';
import { ExternalLink, History, MessageSquare, Clock, Timer, TrendingUp, Radio, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

function getSelectedTracking(status: MonitorStatus, trackingId: string | null): TrackingPeriod | null {
  if (!status.activeTrackings?.length) return null;
  if (trackingId) {
    return status.activeTrackings.find((t) => t.id === trackingId) ?? status.activeTrackings[0];
  }
  // Backend already sorts by soonest endDate first
  return status.activeTrackings[0];
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
  const tracking = getSelectedTracking(status, selectedTrackingId);
  const remaining = getRemainingSeconds(tracking);
  const pmUrl = tracking?.marketLink ?? '';
  const syncedAgo = useTimeSince(status.lastPolledAt);

  return (
    <div className="space-y-5">
      {/* Title row */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <Radio className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">X Monitor</h1>
            <span className="text-sm text-muted-foreground">—</span>
            <a
              href={`https://x.com/${status.userHandle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-muted-foreground/40 transition-colors"
            >
              @{status.userHandle}
            </a>
          </div>
          <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <span>Polymarket tweet count market monitoring & strategy alerts</span>
            <span className="text-border">|</span>
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-2.5 w-2.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Syncing…' : `Synced ${syncedAgo}`}</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status.activeTrackings?.length > 1 && (
            <Select value={selectedTrackingId ?? status.activeTrackings[0]?.id ?? ''} onValueChange={onTrackingChange}>
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder="Select tracking period" />
              </SelectTrigger>
              <SelectContent>
                {status.activeTrackings.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8" asChild>
                  <a href="https://xtracker.polymarket.com" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent>XTracker</TooltipContent>
            </Tooltip>

            {pmUrl && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8" asChild>
                    <a href={pmUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Polymarket</TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={onHistory}>
                  <History className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Alert History</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard
          icon={<MessageSquare className="h-4 w-4 text-primary" />}
          iconBg="bg-primary/10"
          label="Posts"
          value={String(tracking?.totalPosts ?? status.currentPostCount)}
        />
        <StatCard
          icon={<Clock className="h-4 w-4 text-amber-500" />}
          iconBg="bg-amber-500/10"
          label="Since Last Post"
          value={formatDuration(status.secondsSinceLastPost)}
        />
        <StatCard
          icon={<Timer className="h-4 w-4 text-blue-500" />}
          iconBg="bg-blue-500/10"
          label="Remaining"
          value={formatDuration(remaining)}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
          iconBg="bg-emerald-500/10"
          label="Pace / Daily Avg"
          value={tracking ? `${tracking.pace}` : '—'}
          sub={tracking ? `${tracking.dailyAverage.toFixed(1)}/d` : undefined}
        />
      </div>

      <Separator />
    </div>
  );
}

function StatCard({ icon, iconBg, label, value, sub }: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-gradient-to-t from-primary/5 to-card px-4 py-3">
      <div className={`flex h-8 w-8 items-center justify-center rounded-md ${iconBg}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="flex items-baseline gap-1.5">
          <p className="text-lg tabular-nums tracking-wide leading-none">{value}</p>
          {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
        </div>
      </div>
    </div>
  );
}
