'use client';

import type { ThesisStatus } from '@/types/thesis';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { THESIS_STATUS_CONFIG } from '@/lib/thesis-tracker';

interface ThesisStatusBadgeProps {
  status: ThesisStatus;
  className?: string;
}

export function ThesisStatusBadge({ status, className }: ThesisStatusBadgeProps) {
  const config = THESIS_STATUS_CONFIG[status];

  return (
    <Badge variant="outline" className={cn('text-xs font-normal', config.className, className)}>
      {config.label}
    </Badge>
  );
}
