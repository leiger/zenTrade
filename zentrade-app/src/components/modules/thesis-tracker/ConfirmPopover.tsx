'use client';

import * as React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { TriangleAlert } from 'lucide-react';

interface ConfirmPopoverProps {
  /** The trigger element */
  children: React.ReactNode;
  /** Title displayed in the popover */
  title?: string;
  /** Description / confirmation message */
  description?: string;
  /** Label of the confirm button */
  confirmLabel?: string;
  /** Called when the user confirms */
  onConfirm: () => void;
  /** Popover alignment */
  align?: 'start' | 'center' | 'end';
  /** Popover side */
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export function ConfirmPopover({
  children,
  title = '确认操作',
  description = '此操作不可撤销，确定要继续吗？',
  confirmLabel = '确认',
  onConfirm,
  align = 'end',
  side = 'bottom',
}: ConfirmPopoverProps) {
  const [open, setOpen] = React.useState(false);

  const handleConfirm = () => {
    setOpen(false);
    onConfirm();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        className="w-72 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <TriangleAlert className="h-4 w-4 text-destructive" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium leading-none">{title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setOpen(false)}
            >
              取消
            </Button>
            <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={handleConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
