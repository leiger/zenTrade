'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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
import { MarketOverview } from '@/components/modules/musk-quant/MarketOverview';
import { ProbabilityAnalysis } from '@/components/modules/musk-quant/ProbabilityAnalysis';
import { MorphologyCompare } from '@/components/modules/musk-quant/MorphologyCompare';
import { PositionManager } from '@/components/modules/musk-quant/PositionManager';
import { StrategyGuide } from '@/components/modules/musk-quant/StrategyGuide';
import { StrategyPlanPanel } from '@/components/modules/musk-quant/StrategyPlanPanel';
import { useXMonitorStore } from '@/lib/xmonitor-store';
import { useMuskQuantStore } from '@/lib/musk-quant-store';
import { useMuskQuantAnalysis } from '@/hooks/useMuskQuantAnalysis';
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

/** 合并后的 Tab 集合：X Monitor 骨架 + Musk Quant 各分析面 */
const TAB_VALUES = [
  'overview',
  'probability',
  'morphology',
  'rhythm',
  'alerts',
  'positions',
  'strategies',
  'guide',
] as const;
type TabValue = (typeof TAB_VALUES)[number];

/** 从 Polymarket 市场链接提取 event slug（tracking ↔ quant 市场联动用） */
function slugFromMarketLink(link: string | null | undefined): string {
  if (!link) return '';
  try {
    return new URL(link).pathname.split('/').filter(Boolean).pop() || '';
  } catch {
    return '';
  }
}

export default function XMonitorPage() {
  return (
    <Suspense>
      <XMonitorContent />
    </Suspense>
  );
}

function XMonitorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
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

  const {
    events: quantEvents,
    selectedSlug: quantSlug,
    error: quantError,
    refreshing: quantRefreshing,
    initialize: initializeQuant,
    refresh: refreshQuant,
    selectEvent: selectQuantEvent,
  } = useMuskQuantStore();
  const analysis = useMuskQuantAnalysis();

  const [selectedTrackingId, setSelectedTrackingId] = useState<string | null>(null);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState<StrategyInstance | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Tab 状态放 URL（可分享/刷新保持），非法值回退 overview
  const rawTab = searchParams.get('tab');
  const activeTab: TabValue = TAB_VALUES.includes(rawTab as TabValue)
    ? (rawTab as TabValue)
    : 'overview';

  const handleTabChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', value);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname],
  );

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

  // 手动刷新：两个数据源一起刷
  const handleRefresh = useCallback(() => {
    refreshData();
    void refreshQuant();
  }, [refreshData, refreshQuant]);

  useEffect(() => {
    fetchStatus();
    fetchAlerts();
    fetchStrategies();
    void initializeQuant();
  }, [fetchStatus, fetchAlerts, fetchStrategies, initializeQuant]);

  useEffect(() => {
    const alertId = searchParams.get('alert');
    if (alertId) {
      setHighlightAlertId(alertId);
      // 从推送跳转来的告警定位到 Alerts tab
      if (!rawTab) handleTabChange('alerts');
    }
  }, [searchParams, setHighlightAlertId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // tracking 切换 → 同步 quant 市场（slug 匹配得上才切，past tracking 无对应量化数据则保持不动）
  const selectedTracking = status?.activeTrackings?.find((t) => t.id === effectiveTrackingId);
  const trackingSlug = slugFromMarketLink(selectedTracking?.marketLink);
  useEffect(() => {
    if (trackingSlug && trackingSlug !== quantSlug && quantEvents.some((e) => e.slug === trackingSlug)) {
      selectQuantEvent(trackingSlug);
    }
  }, [trackingSlug, quantSlug, quantEvents, selectQuantEvent]);

  // 量化数据与当前选中周期不一致时的提示（如选中了已结算的 past tracking）
  const quantMismatch = useMemo(() => {
    if (!analysis || !trackingSlug) return false;
    return analysis.event.slug !== trackingSlug && !quantEvents.some((e) => e.slug === trackingSlug);
  }, [analysis, trackingSlug, quantEvents]);

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
      <div className="mx-auto max-w-6xl space-y-5">
        {status?.apiHealth && <ApiStatusBanner health={status.apiHealth} />}

        {quantError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            Failed to load quant market data: {quantError}
          </div>
        )}

        {status && (
          <MonitorHeader
            status={status}
            selectedTrackingId={selectedTrackingId}
            onTrackingChange={setSelectedTrackingId}
            onHistory={() => setHistoryOpen(true)}
            refreshing={refreshing || quantRefreshing}
            onRefresh={handleRefresh}
            importing={importing}
            onImport={handleImport}
            todayCount={quantMismatch ? null : (analysis?.todayCount ?? null)}
            predictedLanding={quantMismatch ? null : (analysis?.prediction.displayLanding ?? null)}
          />
        )}

        <Separator className="bg-border/50" />

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="mb-4 flex-wrap h-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="probability">Probability</TabsTrigger>
            <TabsTrigger value="morphology">Morphology</TabsTrigger>
            <TabsTrigger value="rhythm">Rhythm</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
            <TabsTrigger value="positions">Positions</TabsTrigger>
            <TabsTrigger value="strategies">Strategies</TabsTrigger>
            <TabsTrigger value="guide">Guide</TabsTrigger>
          </TabsList>

          {/* Overview：量化市场概览 + 右侧策略方案面板 */}
          <TabsContent value="overview" className="space-y-4">
            {quantMismatch && analysis && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-600 dark:text-amber-400">
                当前选中周期无量化数据（已结算或未收录），以下展示 {analysis.event.title}
              </div>
            )}
            <div className="grid gap-4 items-start xl:grid-cols-[minmax(0,1fr)_320px]">
              <MarketOverview />
              <StrategyPlanPanel />
            </div>
          </TabsContent>

          {/* Probability：VR 表 / 时速雷达 / 三层入场结构 / 分布对比 */}
          <TabsContent value="probability" className="space-y-4">
            <ProbabilityAnalysis />
          </TabsContent>

          {/* Morphology：最后 48h 走势形态对比 */}
          <TabsContent value="morphology" className="space-y-4">
            <MorphologyCompare />
          </TabsContent>

          {/* Rhythm：统一交互式热力图（Day×Hour / Daily 14d / Hourly / Today vs Baseline / Timeline） */}
          <TabsContent value="rhythm" className="space-y-6">
            <PostActivityHeatmap />
          </TabsContent>

          {/* Alerts：策略告警时间轴 */}
          <TabsContent value="alerts" className="space-y-4">
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

          {/* Positions：量化持仓管理 + 手动交易记录 */}
          <TabsContent value="positions" className="space-y-6">
            <PositionManager />
            <Separator className="bg-border/50" />
            <TradeHistory />
          </TabsContent>

          {/* Strategies：后端策略实例 CRUD + 策略笔记 */}
          <TabsContent value="strategies" className="space-y-6">
            <StrategyList
              strategies={strategies}
              onToggle={(id, enabled) => updateStrategy(id, { enabled })}
              onAdd={handleAddStrategy}
              onEdit={handleEditStrategy}
              onDelete={deleteStrategy}
            />
            <Separator className="bg-border/50" />
            <StrategyNotes />
          </TabsContent>

          {/* Guide：完整操作手册 */}
          <TabsContent value="guide" className="space-y-4">
            <StrategyGuide />
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
