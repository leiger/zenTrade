'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, X, Clock, CheckCircle2, AlertTriangle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { StrategyInstance, StrategyType } from '@/types/xmonitor';
import { STRATEGY_TYPE_LABELS } from '@/types/xmonitor';

interface StrategyManagerProps {
  open: boolean;
  onClose: () => void;
  closing: boolean;
  strategies: StrategyInstance[];
  onToggle: (id: string, enabled: boolean) => void;
  onCreate: (type: StrategyType, name: string, params: Record<string, unknown>) => void;
  onUpdate: (id: string, updates: { name?: string; params?: Record<string, unknown> }) => void;
  onDelete: (id: string) => void;
}

const STRATEGY_ICONS: Record<StrategyType, typeof Clock> = {
  silent_period: Clock,
  tail_sweep: CheckCircle2,
  settlement_no: AlertTriangle,
  panic_fade: Zap,
};

const STRATEGY_COLORS: Record<StrategyType, string> = {
  silent_period: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  tail_sweep: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  settlement_no: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
  panic_fade: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
};

const PARAM_DEFS: Record<StrategyType, { key: string; label: string; default: number }[]> = {
  silent_period: [
    { key: 'silence_hours', label: 'Silence threshold (hours)', default: 6 },
    { key: 'remind_interval_minutes', label: 'Remind interval (minutes)', default: 60 },
  ],
  tail_sweep: [
    { key: 'min_yes_price', label: 'Min Yes price (%)', default: 99 },
  ],
  settlement_no: [
    { key: 'remaining_hours', label: 'Remaining time (hours)', default: 12 },
    { key: 'min_gap', label: 'Min gap (posts)', default: 100 },
    { key: 'max_no_price', label: 'Max No price (%)', default: 99.5 },
    { key: 'remind_interval_minutes', label: 'Remind interval (minutes)', default: 120 },
  ],
  panic_fade: [
    { key: 'remaining_hours', label: 'Remaining time (hours)', default: 2 },
    { key: 'min_gap', label: 'Min gap (posts)', default: 50 },
    { key: 'min_yes_price', label: 'Min Yes price (%)', default: 5 },
  ],
};

export function StrategyManager({ open, onClose, closing, strategies, onToggle, onCreate, onUpdate, onDelete }: StrategyManagerProps) {
  const [editing, setEditing] = useState<StrategyInstance | null>(null);
  const [creating, setCreating] = useState(false);

  if (!open && !closing) return null;

  return (
    <div
      className={cn(
        'fixed top-14 right-2 bottom-2 z-40 w-[480px] rounded-xl border shadow-2xl bg-card/95 backdrop-blur-sm overflow-hidden duration-300',
        closing
          ? 'animate-out slide-out-to-right fill-mode-forwards'
          : 'animate-in slide-in-from-right',
      )}
    >
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold">Strategies</h3>
            <p className="text-xs text-muted-foreground">Create and manage alert strategies</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5"
            onClick={() => { setCreating(true); setEditing(null); }}
          >
            <Plus className="h-3.5 w-3.5" />
            Create Strategy
          </Button>

          {/* Strategy form */}
          {(creating || editing) && (
            <StrategyForm
              editing={editing}
              onSave={(type, name, params) => {
                if (editing) {
                  onUpdate(editing.id, { name, params });
                } else {
                  onCreate(type, name, params);
                }
                setEditing(null);
                setCreating(false);
              }}
              onCancel={() => { setEditing(null); setCreating(false); }}
            />
          )}

          <Separator />

          {/* Strategy list */}
          {strategies.map((s) => {
            const Icon = STRATEGY_ICONS[s.strategyType];
            const color = STRATEGY_COLORS[s.strategyType];

            return (
              <div
                key={s.id}
                className={cn(
                  'group/strat rounded-xl border p-4 transition-all duration-300',
                  s.enabled
                    ? 'bg-card hover:bg-accent/40 hover:shadow-md'
                    : 'bg-muted/20 opacity-60',
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn('flex h-8 w-8 items-center justify-center rounded-md shrink-0', color)}>
                    <Icon className="h-4 w-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium truncate">{s.name}</p>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                        {STRATEGY_TYPE_LABELS[s.strategyType]}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(s.params).map(([k, v]) => (
                        <Badge key={k} variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                          {k.replace(/_/g, ' ')}: {String(v)}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Switch
                      checked={s.enabled}
                      onCheckedChange={(checked) => onToggle(s.id, checked)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover/strat:opacity-100 transition-opacity"
                      onClick={() => { setEditing(s); setCreating(false); }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive opacity-0 group-hover/strat:opacity-100 transition-opacity"
                      onClick={() => onDelete(s.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StrategyForm({
  editing,
  onSave,
  onCancel,
}: {
  editing: StrategyInstance | null;
  onSave: (type: StrategyType, name: string, params: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<StrategyType>(editing?.strategyType ?? 'silent_period');
  const [name, setName] = useState(editing?.name ?? '');
  const [params, setParams] = useState<Record<string, number>>(
    editing
      ? Object.fromEntries(Object.entries(editing.params).map(([k, v]) => [k, Number(v)]))
      : Object.fromEntries(PARAM_DEFS[type].map((p) => [p.key, p.default])),
  );

  const defs = PARAM_DEFS[editing?.strategyType ?? type];

  const handleTypeChange = (t: StrategyType) => {
    setType(t);
    setParams(Object.fromEntries(PARAM_DEFS[t].map((p) => [p.key, p.default])));
  };

  return (
    <div className="rounded-lg border border-primary/20 p-4 space-y-3 bg-muted/20">
      <h4 className="text-sm font-medium">{editing ? 'Edit Strategy' : 'New Strategy'}</h4>

      {!editing && (
        <div className="space-y-1.5">
          <Label className="text-xs">Strategy Type</Label>
          <Select value={type} onValueChange={(v) => handleTypeChange(v as StrategyType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(STRATEGY_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs">Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 沉默6h提醒" className="bg-background" />
      </div>

      {defs.map((d) => (
        <div key={d.key} className="space-y-1.5">
          <Label className="text-xs">{d.label}</Label>
          <Input
            type="number"
            value={params[d.key] ?? d.default}
            onChange={(e) => setParams({ ...params, [d.key]: parseFloat(e.target.value) || 0 })}
            className="bg-background"
          />
        </div>
      ))}

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" className="h-7 text-xs gap-1" onClick={() => onSave(type, name, params)} disabled={!name.trim()}>
          <CheckCircle2 className="h-3 w-3" />
          {editing ? 'Update' : 'Create'}
        </Button>
      </div>
    </div>
  );
}
