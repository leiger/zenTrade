import type {
  ApiHealthStatus,
  MonitorAlert,
  MonitorStatus,
  StrategyInstance,
  StrategyNote,
  StrategyType,
  TrackingPeriod,
} from '@/types/xmonitor';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// snake_case → camelCase mappers

function mapApiHealth(h: Record<string, unknown>): ApiHealthStatus {
  return {
    xtracker: ((h.xtracker as string) ?? 'unknown') as ApiHealthStatus['xtracker'],
    polymarket: ((h.polymarket as string) ?? 'unknown') as ApiHealthStatus['polymarket'],
    xtrackerError: (h.xtracker_error as string | null) ?? null,
    polymarketError: (h.polymarket_error as string | null) ?? null,
    xtrackerLastSuccess: (h.xtracker_last_success as string | null) ?? null,
    polymarketLastSuccess: (h.polymarket_last_success as string | null) ?? null,
  };
}

function mapTracking(t: Record<string, unknown>) {
  return {
    id: t.id as string,
    title: t.title as string,
    startDate: t.start_date as string,
    endDate: t.end_date as string,
    marketLink: (t.market_link as string | null) ?? null,
    isActive: t.is_active as boolean,
    totalPosts: (t.total_posts as number) ?? 0,
    pace: (t.pace as number) ?? 0,
    dailyAverage: (t.daily_average as number) ?? 0,
  };
}

export function mapStatus(raw: Record<string, unknown>): MonitorStatus {
  const trackings = Array.isArray(raw.active_trackings)
    ? (raw.active_trackings as Record<string, unknown>[]).map(mapTracking)
    : [];
  return {
    userHandle: (raw.user_handle as string) ?? 'elonmusk',
    apiHealth: mapApiHealth((raw.api_health as Record<string, unknown>) ?? {}),
    activeTrackings: trackings,
    currentPostCount: (raw.current_post_count as number) ?? 0,
    lastPostAt: (raw.last_post_at as string | null) ?? null,
    secondsSinceLastPost: (raw.seconds_since_last_post as number | null) ?? null,
    lastPolledAt: (raw.last_polled_at as string | null) ?? null,
  };
}

export async function refreshData(): Promise<MonitorStatus> {
  const raw = await req<Record<string, unknown>>('/xmonitor/refresh', { method: 'POST' });
  return mapStatus(raw);
}

function mapStrategy(s: Record<string, unknown>): StrategyInstance {
  return {
    id: s.id as string,
    strategyType: s.strategy_type as StrategyType,
    name: s.name as string,
    enabled: s.enabled as boolean,
    params: (s.params as Record<string, number | string | boolean>) ?? {},
    createdAt: s.created_at as string,
    updatedAt: s.updated_at as string,
  };
}

function mapAlert(a: Record<string, unknown>): MonitorAlert {
  return {
    id: a.id as string,
    strategyInstanceId: a.strategy_instance_id as string,
    strategyType: a.strategy_type as StrategyType,
    trackingId: a.tracking_id as string,
    bracket: (a.bracket as string | null) ?? null,
    triggerData: (a.trigger_data as Record<string, unknown>) ?? {},
    message: a.message as string,
    polymarketUrl: (a.polymarket_url as string) ?? '',
    feedback: (a.feedback as 'yes' | 'no' | null) ?? null,
    feedbackNote: (a.feedback_note as string | null) ?? null,
    createdAt: a.created_at as string,
    feedbackAt: (a.feedback_at as string | null) ?? null,
    pushSent: (a.push_sent as boolean) ?? false,
  };
}

// ── API Functions ────────────────────────────────────────

export async function fetchMonitorStatus(): Promise<MonitorStatus> {
  const raw = await req<Record<string, unknown>>('/xmonitor/status');
  return mapStatus(raw);
}

export async function fetchPastTrackings(): Promise<TrackingPeriod[]> {
  const raw = await req<Record<string, unknown>[]>('/xmonitor/trackings/history');
  return raw.map(mapTracking);
}

export async function fetchAlerts(
  strategyType?: string,
  limit = 50,
  offset = 0
): Promise<MonitorAlert[]> {
  const params = new URLSearchParams();
  if (strategyType) params.set('strategy_type', strategyType);
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  const raw = await req<Record<string, unknown>[]>(`/xmonitor/alerts?${params}`);
  return raw.map(mapAlert);
}

export async function postAlertFeedback(
  alertId: string,
  feedback: 'yes' | 'no',
  note?: string
): Promise<MonitorAlert> {
  const raw = await req<Record<string, unknown>>(`/xmonitor/alerts/${alertId}/feedback`, {
    method: 'POST',
    body: JSON.stringify({ feedback, feedback_note: note ?? null }),
  });
  return mapAlert(raw);
}

export async function fetchStrategies(): Promise<StrategyInstance[]> {
  const raw = await req<Record<string, unknown>[]>('/xmonitor/strategies');
  return raw.map(mapStrategy);
}

export async function createStrategy(
  strategyType: StrategyType,
  name: string,
  params: Record<string, unknown>,
  enabled = true
): Promise<StrategyInstance> {
  const raw = await req<Record<string, unknown>>('/xmonitor/strategies', {
    method: 'POST',
    body: JSON.stringify({ strategy_type: strategyType, name, enabled, params }),
  });
  return mapStrategy(raw);
}

export async function updateStrategy(
  id: string,
  updates: { name?: string; enabled?: boolean; params?: Record<string, unknown> }
): Promise<StrategyInstance> {
  const raw = await req<Record<string, unknown>>(`/xmonitor/strategies/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  return mapStrategy(raw);
}

export async function deleteStrategy(id: string): Promise<void> {
  await req<void>(`/xmonitor/strategies/${id}`, { method: 'DELETE' });
}

export async function subscribePush(endpoint: string, p256dh: string, auth: string): Promise<void> {
  await req('/xmonitor/push/subscribe', {
    method: 'POST',
    body: JSON.stringify({ endpoint, p256dh, auth }),
  });
}

export async function unsubscribePush(endpoint: string): Promise<void> {
  await req(`/xmonitor/push/subscribe?endpoint=${encodeURIComponent(endpoint)}`, {
    method: 'DELETE',
  });
}

export async function fetchVapidKey(): Promise<string> {
  const data = await req<{ public_key: string }>('/xmonitor/push/vapid-key');
  return data.public_key;
}
export async function importMuskTweets(): Promise<{ status: string; imported: number }> {
  return req<{ status: string; imported: number }>('/xmonitor/import-tweets', { method: 'POST' });
}

// ── Notes API ────────────────────────────────────────────

function mapNote(n: Record<string, unknown>): StrategyNote {
  return {
    id: n.id as string,
    title: n.title as string,
    content: (n.content as string) ?? '',
    createdAt: n.created_at as string,
    updatedAt: n.updated_at as string,
  };
}

export async function fetchNotes(): Promise<StrategyNote[]> {
  const raw = await req<Record<string, unknown>[]>('/xmonitor/notes');
  return raw.map(mapNote);
}

export async function createNote(title: string, content: string): Promise<StrategyNote> {
  const raw = await req<Record<string, unknown>>('/xmonitor/notes', {
    method: 'POST',
    body: JSON.stringify({ title, content }),
  });
  return mapNote(raw);
}

export async function updateNote(
  id: string,
  updates: { title?: string; content?: string },
): Promise<StrategyNote> {
  const raw = await req<Record<string, unknown>>(`/xmonitor/notes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  return mapNote(raw);
}

export async function deleteNote(id: string): Promise<void> {
  await req<void>(`/xmonitor/notes/${id}`, { method: 'DELETE' });
}

export interface PostActivityStats {
  total_posts: number;
  matrix: number[][];
  day_totals: number[];
  hour_totals: number[];
  minute_buckets: number[][];
}

export async function fetchPostStats(
  startDate?: string,
  endDate?: string
): Promise<PostActivityStats> {
  const params = new URLSearchParams();
  if (startDate) params.set('start_date', startDate);
  if (endDate) params.set('end_date', endDate);
  const qs = params.toString();
  return req<PostActivityStats>(`/xmonitor/posts/stats${qs ? `?${qs}` : ''}`);
}

export interface HistoricalPost {
  id: string;
  userId: string;
  platformId: string;
  content: string;
  createdAt: string;
  importedAt: string;
  metrics: Record<string, number> | null;
  rawData: Record<string, unknown> | null;
}

export async function fetchPostHistory(
  limit = 50,
  offset = 0,
  startDate?: string,
  endDate?: string
): Promise<HistoricalPost[]> {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  if (startDate) params.set('start_date', startDate);
  if (endDate) params.set('end_date', endDate);
  const qs = params.toString();
  return req<HistoricalPost[]>(`/xmonitor/posts/history${qs ? `?${qs}` : ''}`);
}
