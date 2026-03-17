'use client';

import { AlertTriangle } from 'lucide-react';
import type { ApiHealthStatus } from '@/types/xmonitor';

interface ApiStatusBannerProps {
  health: ApiHealthStatus;
}

export function ApiStatusBanner({ health }: ApiStatusBannerProps) {
  const errors: { api: string; error: string | null }[] = [];

  if (health.xtracker === 'error') {
    errors.push({ api: 'XTracker', error: health.xtrackerError });
  }
  if (health.polymarket === 'error') {
    errors.push({ api: 'Polymarket', error: health.polymarketError });
  }

  if (errors.length === 0) return null;

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/[0.06] px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-destructive/10 shrink-0 mt-0.5">
          <AlertTriangle className="h-4 w-4 text-destructive" />
        </div>
        <div className="space-y-0.5">
          {errors.map((e) => (
            <p key={e.api} className="text-sm font-medium text-destructive">
              {e.api} API unavailable
              {e.error && (
                <span className="font-normal text-destructive/70"> — {e.error}</span>
              )}
            </p>
          ))}
          <p className="text-xs text-destructive/60">
            Bots may be offline — potential price mispricing opportunity
          </p>
        </div>
      </div>
    </div>
  );
}
