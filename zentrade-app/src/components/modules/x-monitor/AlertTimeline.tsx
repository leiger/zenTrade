'use client';

import { useEffect, useRef } from 'react';
import {
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Bell,
  Loader2,
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { MonitorAlert, StrategyType } from '@/types/xmonitor';
import { STRATEGY_TYPE_LABELS } from '@/types/xmonitor';

interface AlertTimelineProps {
  alerts: MonitorAlert[];
  highlightAlertId: string | null;
  onFeedback: (alertId: string, feedback: 'yes' | 'no') => void;
  onClearHighlight: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}

const STRATEGY_CONFIG: Record<StrategyType, {
  icon: typeof Clock;
  dotColor: string;
  badgeBg: string;
  cardBorder: string;
}> = {
  silent_period: {
    icon: Clock,
    dotColor: 'bg-amber-500',
    badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    cardBorder: 'border-amber-500/15 hover:border-amber-500/30',
  },
  tail_sweep: {
    icon: CheckCircle2,
    dotColor: 'bg-emerald-500',
    badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    cardBorder: 'border-emerald-500/15 hover:border-emerald-500/30',
  },
  settlement_no: {
    icon: AlertTriangle,
    dotColor: 'bg-rose-500',
    badgeBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    cardBorder: 'border-rose-500/15 hover:border-rose-500/30',
  },
  panic_fade: {
    icon: Zap,
    dotColor: 'bg-purple-500',
    badgeBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    cardBorder: 'border-purple-500/15 hover:border-purple-500/30',
  },
};

function groupByDate(alerts: MonitorAlert[]): Map<string, MonitorAlert[]> {
  const groups = new Map<string, MonitorAlert[]>();
  for (const alert of alerts) {
    const date = new Date(alert.createdAt);
    let label: string;
    if (isToday(date)) label = 'Today';
    else if (isYesterday(date)) label = 'Yesterday';
    else label = format(date, 'MMM d, yyyy');

    const existing = groups.get(label) ?? [];
    existing.push(alert);
    groups.set(label, existing);
  }
  return groups;
}

export function AlertTimeline({ alerts, highlightAlertId, onFeedback, onClearHighlight, hasMore, loadingMore, onLoadMore }: AlertTimelineProps) {
  const highlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlightAlertId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const timer = setTimeout(() => onClearHighlight(), 3000);
      return () => clearTimeout(timer);
    }
  }, [highlightAlertId, onClearHighlight]);

  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Bell className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">No alerts yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Strategies are monitoring in the background
        </p>
      </div>
    );
  }

  const grouped = groupByDate(alerts);

  return (
    <div className="space-y-6">
      {Array.from(grouped.entries()).map(([dateLabel, dayAlerts]) => (
        <div key={dateLabel}>
          <h3 className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground/50">
            {dateLabel}
          </h3>

          <div className="relative">
            {/* Vertical timeline line */}
            <div className="absolute left-[7px] top-3 bottom-3 w-px bg-gradient-to-b from-border via-border/60 to-transparent" />

            <div className="space-y-4">
              {dayAlerts.map((alert, index) => {
                const isHighlighted = alert.id === highlightAlertId;
                const config = STRATEGY_CONFIG[alert.strategyType];
                const Icon = config.icon;

                return (
                  <div
                    key={alert.id}
                    ref={isHighlighted ? highlightRef : undefined}
                    className="relative group/item"
                  >
                    {/* Timeline header row: time dot → strategy badge */}
                    <div className="flex items-stretch gap-0 mb-2">
                      {/* Dot on vertical axis */}
                      <div className="relative flex items-center justify-center w-[15px] shrink-0">
                        <div className={cn(
                          'h-2.5 w-2.5 rounded-full ring-[3px] ring-background z-10 shadow-sm',
                          alert.feedback ? (alert.feedback === 'yes' ? 'bg-emerald-500' : 'bg-muted-foreground/30') : config.dotColor,
                        )} />
                      </div>

                      {/* Time + strategy badge row */}
                      <div className="flex items-center gap-0 flex-1 ml-2">
                        {/* Time card */}
                        <div className={cn(
                          'flex items-center gap-2.5 pl-3 pr-4 py-2 rounded-l-lg border-y border-l transition-all duration-300',
                          index === 0
                            ? 'bg-primary/[0.04] border-primary/15'
                            : 'bg-muted/20 border-border/40',
                        )}>
                          <div className={cn('flex h-7 w-7 items-center justify-center rounded-md shrink-0', config.badgeBg.split(' ')[0])}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex flex-col leading-none gap-0.5">
                            <span className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-widest leading-none">
                              {STRATEGY_TYPE_LABELS[alert.strategyType]}
                            </span>
                            <span className="text-[13px] text-foreground tabular-nums tracking-tight leading-none" suppressHydrationWarning>
                              {format(new Date(alert.createdAt), 'HH:mm')}
                            </span>
                          </div>
                        </div>

                        {/* Status badge */}
                        {alert.feedback ? (
                          <div className={cn(
                            'flex items-center gap-2 pl-3 pr-3 py-2 rounded-r-lg border-y border-r shadow-sm transition-all duration-300',
                            alert.feedback === 'yes'
                              ? 'bg-emerald-500/[0.04] border-emerald-500/15 text-emerald-600'
                              : 'bg-muted/30 border-border/40 text-muted-foreground',
                          )}>
                            <div className={cn(
                              'flex h-7 w-7 items-center justify-center rounded-md shrink-0',
                              alert.feedback === 'yes' ? 'bg-emerald-500/10' : 'bg-muted/30',
                            )}>
                              {alert.feedback === 'yes'
                                ? <ThumbsUp className="h-3.5 w-3.5" />
                                : <ThumbsDown className="h-3.5 w-3.5" />
                              }
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest leading-none">
                              {alert.feedback === 'yes' ? 'Acted' : 'Skipped'}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 pl-3 pr-3 py-2 rounded-r-lg border-y border-r bg-muted/10 border-border/30 text-muted-foreground/50 group-hover/item:bg-muted/20 transition-all">
                            <div className="relative flex h-7 w-7 items-center justify-center rounded-md bg-amber-500/10 shrink-0">
                              <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-amber-400 opacity-60" />
                              <Bell className="h-3.5 w-3.5 text-amber-500 relative z-10" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest leading-none text-amber-600 animate-pulse">
                              Pending
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Alert card */}
                    <div className="pl-[23px]">
                      <div
                        className={cn(
                          'relative rounded-xl border p-4 transition-all duration-300 overflow-hidden',
                          isHighlighted
                            ? 'border-primary/40 bg-linear-to-br from-primary/[0.04] to-transparent shadow-lg shadow-primary/5 ring-1 ring-primary/20'
                            : cn('bg-card hover:bg-accent/40 hover:shadow-md', config.cardBorder),
                        )}
                      >
                        <p className="text-sm leading-relaxed text-foreground/90 font-medium mb-3">
                          {alert.message}
                        </p>

                        <TriggerDataDisplay data={alert.triggerData as Record<string, unknown>} strategyType={alert.strategyType} />

                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/40">
                          {alert.polymarketUrl && (
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" asChild>
                              <a href={alert.polymarketUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3 w-3" />
                                Polymarket
                              </a>
                            </Button>
                          )}
                          {!alert.feedback && (
                            <div className="flex items-center gap-1.5 ml-auto">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/10 hover:text-emerald-600"
                                onClick={() => onFeedback(alert.id, 'yes')}
                              >
                                <ThumbsUp className="h-3 w-3" />
                                Yes
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs gap-1 text-muted-foreground"
                                onClick={() => onFeedback(alert.id, 'no')}
                              >
                                <ThumbsDown className="h-3 w-3" />
                                No
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}

      {onLoadMore && hasMore && (
        <div className="flex justify-center py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="gap-1.5"
          >
            {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {loadingMore ? 'Loading…' : 'Load More'}
          </Button>
        </div>
      )}
    </div>
  );
}

function TriggerDataDisplay({ data, strategyType }: { data: Record<string, unknown>; strategyType: StrategyType }) {
  if (strategyType === 'panic_fade' && Array.isArray(data.matched_brackets)) {
    const matched = data.matched_brackets as Array<Record<string, unknown>>;
    return (
      <div className="space-y-1.5 rounded-md border bg-muted/30 p-2.5">
        {matched.slice(0, 5).map((mb, i) => (
          <div key={i} className="flex items-center gap-3 text-xs">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-medium shrink-0">
              {String(mb.bracket)}
            </Badge>
            <span className="text-muted-foreground">need {String(mb.gap)} more</span>
            <span className="text-muted-foreground">Yes @ <span className="font-medium text-foreground">{String(mb.yes_price)}%</span></span>
            <span className="text-rose-500 font-medium ml-auto">→ buy No</span>
          </div>
        ))}
      </div>
    );
  }

  const items: { label: string; value: string }[] = [];
  if (data.post_count !== undefined) items.push({ label: 'Count', value: String(data.post_count) });
  if (data.silence_hours !== undefined) items.push({ label: 'Silent', value: `${data.silence_hours}h` });
  if (data.remaining_hours !== undefined) items.push({ label: 'Remaining', value: `${data.remaining_hours}h` });
  if (data.gap !== undefined) items.push({ label: 'Gap', value: `${data.gap}` });
  if (data.bracket !== undefined) items.push({ label: 'Bracket', value: String(data.bracket) });
  if (data.yes_price !== undefined) items.push({ label: 'Yes', value: `${data.yes_price}%` });
  if (data.no_price !== undefined) items.push({ label: 'No', value: `${data.no_price}%` });

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map((item) => (
        <Badge key={item.label} variant="outline" className="text-[11px] px-1.5 py-0 font-normal gap-1">
          <span className="text-muted-foreground">{item.label}</span>
          <span className="font-medium">{item.value}</span>
        </Badge>
      ))}
    </div>
  );
}
