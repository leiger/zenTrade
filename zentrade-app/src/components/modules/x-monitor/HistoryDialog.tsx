'use client';

import { useState, useEffect, useCallback } from 'react';
import { History, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { AlertTimeline } from './AlertTimeline';
import * as api from '@/lib/xmonitor-api';
import type { MonitorAlert } from '@/types/xmonitor';

const PAGE_SIZE = 30;

interface HistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFeedback: (alertId: string, feedback: 'yes' | 'no') => void;
}

export function HistoryDialog({ open, onOpenChange, onFeedback }: HistoryDialogProps) {
  const [alerts, setAlerts] = useState<MonitorAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadAlerts = useCallback(async (offset: number) => {
    setLoading(true);
    try {
      const data = await api.fetchAlerts(undefined, PAGE_SIZE, offset);
      if (offset === 0) {
        setAlerts(data);
      } else {
        setAlerts((prev) => [...prev, ...data]);
      }
      setHasMore(data.length >= PAGE_SIZE);
    } catch (e) {
      console.error('[HistoryDialog] Failed to load alerts:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setAlerts([]);
      setHasMore(true);
      loadAlerts(0);
    }
  }, [open, loadAlerts]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-oswald flex items-center gap-2">
            <History className="h-5 w-5" />
            Alert History
          </DialogTitle>
          <DialogDescription>
            All historical strategy alerts, sorted by newest first
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 -mr-2 min-h-0">
          {alerts.length === 0 && !loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No historical alerts found
            </div>
          ) : (
            <AlertTimeline
              alerts={alerts}
              highlightAlertId={null}
              onFeedback={onFeedback}
              onClearHighlight={() => {}}
            />
          )}

          {loading && alerts.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {hasMore && alerts.length > 0 && (
            <div className="flex justify-center py-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadAlerts(alerts.length)}
                disabled={loading}
                className="gap-1.5"
              >
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {loading ? 'Loading…' : 'Load More'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
