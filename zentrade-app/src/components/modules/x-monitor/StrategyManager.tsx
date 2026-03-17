'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { StrategyInstance, StrategyType } from '@/types/xmonitor';
import { STRATEGY_TYPE_LABELS } from '@/types/xmonitor';

interface StrategyManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: StrategyInstance | null;
  onSave: (type: StrategyType, name: string, params: Record<string, unknown>) => void;
}

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

export function StrategyManager({ open, onOpenChange, editing, onSave }: StrategyManagerProps) {
  const [type, setType] = useState<StrategyType>('silent_period');
  const [name, setName] = useState('');
  const [params, setParams] = useState<Record<string, number>>(
    Object.fromEntries(PARAM_DEFS.silent_period.map((p) => [p.key, p.default])),
  );

  useEffect(() => {
    if (open) {
      const t = editing?.strategyType ?? 'silent_period';
      setType(t);
      setName(editing?.name ?? '');
      setParams(
        editing
          ? Object.fromEntries(Object.entries(editing.params).map(([k, v]) => [k, Number(v)]))
          : Object.fromEntries(PARAM_DEFS[t].map((p) => [p.key, p.default])),
      );
    }
  }, [open, editing]);

  const defs = PARAM_DEFS[editing?.strategyType ?? type];

  const handleTypeChange = (t: StrategyType) => {
    setType(t);
    setParams(Object.fromEntries(PARAM_DEFS[t].map((p) => [p.key, p.default])));
  };

  const handleSubmit = () => {
    onSave(type, name, params);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-oswald">
            {editing ? 'Edit Strategy' : 'New Strategy'}
          </DialogTitle>
          <DialogDescription>
            {editing ? 'Update strategy configuration' : 'Configure a new alert strategy'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
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
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 沉默6h提醒"
              className="bg-background"
            />
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
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" className="gap-1" onClick={handleSubmit} disabled={!name.trim()}>
            <CheckCircle2 className="h-3 w-3" />
            {editing ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
