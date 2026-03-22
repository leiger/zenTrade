'use client';

import { Plus, Pencil, Trash2, Moon, Crosshair, ShieldAlert, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { StrategyInstance, StrategyType } from '@/types/xmonitor';
import { STRATEGY_TYPE_LABELS } from '@/types/xmonitor';

interface StrategyListProps {
  strategies: StrategyInstance[];
  onToggle: (id: string, enabled: boolean) => void;
  onAdd: () => void;
  onEdit: (strategy: StrategyInstance) => void;
  onDelete: (id: string) => void;
}

const STRATEGY_ICONS: Record<StrategyType, typeof Moon> = {
  silent_period: Moon,
  tail_sweep: Crosshair,
  settlement_no: ShieldAlert,
  panic_fade: Flame,
};

const STRATEGY_COLORS: Record<StrategyType, string> = {
  silent_period: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  tail_sweep: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  settlement_no: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
  panic_fade: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
};

export function StrategyList({ strategies, onToggle, onAdd, onEdit, onDelete }: StrategyListProps) {
  const activeCount = strategies.filter((s) => s.enabled).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h2 className="text-lg font-semibold">Active Strategies</h2>
          <p className="text-xs text-muted-foreground">
            {activeCount} of {strategies.length} strategies enabled
          </p>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={onAdd}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add Strategy</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {strategies.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No strategies configured</p>
          <p className="text-xs text-muted-foreground mt-1">
            Create a strategy to start receiving alerts
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {strategies.map((s) => {
            const Icon = STRATEGY_ICONS[s.strategyType];
            const color = STRATEGY_COLORS[s.strategyType];

            return (
              <div
                key={s.id}
                className={cn(
                  'group/strat flex items-center gap-3 rounded-lg border px-4 py-3 transition-all',
                  s.enabled ? 'bg-card hover:bg-accent/40' : 'bg-muted/20 opacity-60',
                )}
              >
                <div className={cn('flex h-8 w-8 items-center justify-center rounded-md shrink-0', color)}>
                  <Icon className="h-4 w-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{s.name}</p>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                      {STRATEGY_TYPE_LABELS[s.strategyType]}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0 mt-0.5">
                    {Object.entries(s.params).map(([k, v]) => (
                      <span key={k} className="text-[10px] text-muted-foreground">
                        {k.replace(/_/g, ' ')}: {String(v)}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center shrink-0">
                  <div className="flex items-center gap-0.5 opacity-0 group-hover/strat:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onEdit(s)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => onDelete(s.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <Switch
                    className="ml-2"
                    checked={s.enabled}
                    onCheckedChange={(checked) => onToggle(s.id, checked)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
