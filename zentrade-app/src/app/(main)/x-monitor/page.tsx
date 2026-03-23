'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ApiStatusBanner } from '@/components/modules/x-monitor/ApiStatusBanner';
import { MonitorHeader } from '@/components/modules/x-monitor/MonitorHeader';
import { StrategyList } from '@/components/modules/x-monitor/StrategyList';
import { AlertTimeline } from '@/components/modules/x-monitor/AlertTimeline';
import { StrategyManager } from '@/components/modules/x-monitor/StrategyManager';
import { HistoryDialog } from '@/components/modules/x-monitor/HistoryDialog';
import { PostActivityHeatmap } from '@/components/modules/x-monitor/PostActivityHeatmap';
import { StrategyNotes } from '@/components/modules/x-monitor/StrategyNotes';
import { TradeHistory } from '@/components/modules/x-monitor/TradeHistory';
import { useXMonitorStore } from '@/lib/xmonitor-store';
import { mapStatus, importMuskTweets, normalizeBrowserApiBase } from '@/lib/xmonitor-api';
import type { MonitorAlert, StrategyInstance, StrategyType } from '@/types/xmonitor';
import { STRATEGY_TYPE_LABELS } from '@/types/xmonitor';
import { Separator } from '@/components/ui/separator';

const WS_BASE = normalizeBrowserApiBase(
  process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api',
).replace(/^http/, 'ws');

const FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  ...Object.entries(STRATEGY_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v })),
];

export default function XMonitorPage() {
  return (
    <Suspense>
      <XMonitorContent />
    </Suspense>
  );
}

function XMonitorContent() {
  const searchParams = useSearchParams();
  const {
    status,
    alerts,
    strategies,
    loading,
    refreshing,
    alertFilter,
    highlightAlertId,
    alertsHasMore,
    loadingMore,
    fetchStatus,
    fetchAlerts,
    fetchMoreAlerts,
    fetchStrategies,
    refreshData,
    submitFeedback,
    createStrategy,
    updateStrategy,
    deleteStrategy,
    setAlertFilter,
    setHighlightAlertId,
    prependAlert,
    updateStatus,
  } = useXMonitorStore();

  const [selectedTrackingId, setSelectedTrackingId] = useState<string | null>(null);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState<StrategyInstance | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const handleImport = useCallback(async () => {
    setImporting(true);
    try {
      const res = await importMuskTweets();
      alert(`Successfully imported ${res.imported} tweets!`);
    } catch (e) {
      alert(`Failed to import tweets: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setImporting(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchAlerts();
    fetchStrategies();
  }, [fetchStatus, fetchAlerts, fetchStrategies]);

  useEffect(() => {
    const alertId = searchParams.get('alert');
    if (alertId) {
      setHighlightAlertId(alertId);
    }
  }, [searchParams, setHighlightAlertId]);

  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE}/xmonitor/ws`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'status_update') {
          updateStatus(mapStatus(msg.data));
        } else if (msg.type === 'new_alert') {
          prependAlert(mapWsAlert(msg.data));
        } else if (msg.type === 'api_health_change' && status) {
          const updated = { ...status };
          if (msg.data.api === 'xtracker') {
            updated.apiHealth = { ...updated.apiHealth, xtracker: msg.data.status, xtrackerError: msg.data.error ?? null };
          } else if (msg.data.api === 'polymarket') {
            updated.apiHealth = { ...updated.apiHealth, polymarket: msg.data.status, polymarketError: msg.data.error ?? null };
          }
          updateStatus(updated);
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      setTimeout(() => {
        if (wsRef.current === ws) wsRef.current = null;
      }, 5000);
    };

    return () => ws.close();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const effectiveTrackingId = selectedTrackingId ?? status?.activeTrackings?.[0]?.id;

  const filteredAlerts = alerts.filter((a) => {
    if (effectiveTrackingId && a.trackingId !== effectiveTrackingId) return false;
    if (alertFilter && a.strategyType !== alertFilter) return false;
    return true;
  });

  const handleFilterChange = useCallback(
    (value: string) => setAlertFilter(value === 'all' ? null : (value as StrategyType)),
    [setAlertFilter],
  );

  const handleFeedback = useCallback(
    (alertId: string, feedback: 'yes' | 'no') => submitFeedback(alertId, feedback),
    [submitFeedback],
  );

  const handleAddStrategy = useCallback(() => {
    setEditingStrategy(null);
    setFormDialogOpen(true);
  }, []);

  const handleEditStrategy = useCallback((strategy: StrategyInstance) => {
    setEditingStrategy(strategy);
    setFormDialogOpen(true);
  }, []);

  const handleFormSave = useCallback(
    (type: StrategyType, name: string, params: Record<string, unknown>) => {
      if (editingStrategy) {
        updateStrategy(editingStrategy.id, { name, params });
      } else {
        createStrategy(type, name, params);
      }
    },
    [editingStrategy, updateStrategy, createStrategy],
  );

  if (!status && loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="mx-auto max-w-5xl space-y-5">
        {status?.apiHealth && <ApiStatusBanner health={status.apiHealth} />}

        {status && (
          <MonitorHeader
            status={status}
            selectedTrackingId={selectedTrackingId}
            onTrackingChange={setSelectedTrackingId}
            onHistory={() => setHistoryOpen(true)}
            refreshing={refreshing}
            onRefresh={refreshData}
            importing={importing}
            onImport={handleImport}
          />
        )}

        <Separator className="bg-border/50" />

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="general">Summary</TabsTrigger>
            <TabsTrigger value="list">Strategy List</TabsTrigger>
            <TabsTrigger value="manager">Strategy Manager</TabsTrigger>
            <TabsTrigger value="notes">Note</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
            <PostActivityHeatmap />
          </TabsContent>

          <TabsContent value="list" className="space-y-4">
            {/* Alert section */}
            <div className="space-y-3">
              <div className="space-y-0.5">
                <h2 className="text-lg font-semibold">Strategy Alerts</h2>
                <p className="text-xs text-muted-foreground">
                  Real-time alerts from active strategies. Give Yes/No feedback to iterate.
                </p>
              </div>

              <Tabs value={alertFilter ?? 'all'} onValueChange={handleFilterChange}>
                <TabsList className="h-8">
                  {FILTER_OPTIONS.map((opt) => (
                    <TabsTrigger key={opt.value} value={opt.value} className="text-xs px-3 h-7">
                      {opt.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              <div className="pb-8">
                <AlertTimeline
                  alerts={filteredAlerts}
                  highlightAlertId={highlightAlertId}
                  onFeedback={handleFeedback}
                  onClearHighlight={() => setHighlightAlertId(null)}
                  hasMore={alertsHasMore}
                  loadingMore={loadingMore}
                  onLoadMore={fetchMoreAlerts}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="manager" className="space-y-4">
            {/* Strategy list */}
            <StrategyList
              strategies={strategies}
              onToggle={(id, enabled) => updateStrategy(id, { enabled })}
              onAdd={handleAddStrategy}
              onEdit={handleEditStrategy}
              onDelete={deleteStrategy}
            />
          </TabsContent>

          <TabsContent value="notes" className="space-y-4">
            <StrategyNotes />
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <TradeHistory />
          </TabsContent>
        </Tabs>
      </div>

      {/* Strategy form dialog */}
      <StrategyManager
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        editing={editingStrategy}
        onSave={handleFormSave}
      />

      {/* History dialog */}
      <HistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        onFeedback={handleFeedback}
      />
    </div>
  );
}

function mapWsAlert(data: Record<string, unknown>): MonitorAlert {
  return {
    id: data.id as string,
    strategyInstanceId: (data.strategy_instance_id as string) ?? '',
    strategyType: (data.strategy_type as StrategyType) ?? 'silent_period',
    trackingId: (data.tracking_id as string) ?? '',
    bracket: (data.bracket as string | null) ?? null,
    triggerData: (data.trigger_data as Record<string, unknown>) ?? {},
    message: (data.message as string) ?? '',
    polymarketUrl: (data.polymarket_url as string) ?? '',
    feedback: null,
    feedbackNote: null,
    createdAt: (data.created_at as string) ?? new Date().toISOString(),
    feedbackAt: null,
    pushSent: (data.push_sent as boolean) ?? false,
  };
}
