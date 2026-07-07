import { create } from 'zustand';
import type { ElonPost, QuantEvent, QuantPosition } from '@/types/musk-quant';
import {
  fetchElonPosts,
  fetchQuantConstants,
  fetchQuantEvents,
  fetchRemainingSamples,
} from '@/lib/musk-quant-api';
import { DEFAULT_CONSTANTS, type QuantConstants } from '@/lib/musk-quant-engine';

/** 选中市场的剩余小时（bootstrap 样本请求用） */
function remainingHoursOf(events: QuantEvent[], slug: string | null): number | null {
  const event = events.find((e) => e.slug === slug) ?? events[0];
  if (!event) return null;
  return Math.max(0, (new Date(event.endDate).getTime() - Date.now()) / 3600_000);
}

/** 默认选中第一个未到期的市场（gamma 的 closed=false 会滞后返回已到期市场） */
function defaultSlugOf(events: QuantEvent[]): string | null {
  const live = events.find((e) => new Date(e.endDate).getTime() > Date.now());
  return live?.slug ?? events[0]?.slug ?? null;
}

const POSITIONS_KEY = 'zentrade.musk-quant.positions';
/** 推文历史回溯天数：会话节奏与小时基线需要 ~30 天样本 */
const HISTORY_DAYS = 30;

function loadPositions(): QuantPosition[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(POSITIONS_KEY);
    return raw ? (JSON.parse(raw) as QuantPosition[]) : [];
  } catch {
    return [];
  }
}

function savePositions(positions: QuantPosition[]) {
  try {
    window.localStorage.setItem(POSITIONS_KEY, JSON.stringify(positions));
  } catch {
    // 存储失败不阻塞 UI
  }
}

interface MuskQuantStore {
  events: QuantEvent[];
  /** 当前选中的市场 slug */
  selectedSlug: string | null;
  posts: ElonPost[];
  positions: QuantPosition[];
  /** 模型常量（后端滚动重估，失败回退冻结默认表） */
  constants: QuantConstants;
  /** 剩余时段 bootstrap 样本（null → 泊松回退） */
  remainingSamples: number[] | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  lastUpdatedAt: string | null;

  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  selectEvent: (slug: string) => void;
  addPosition: (p: Omit<QuantPosition, 'id' | 'createdAt'>) => void;
  removePosition: (id: string) => void;
  clearBucketPositions: (eventSlug: string, bucketLabel: string) => void;
}

export const useMuskQuantStore = create<MuskQuantStore>((set, get) => ({
  events: [],
  selectedSlug: null,
  posts: [],
  positions: [],
  constants: DEFAULT_CONSTANTS,
  remainingSamples: null,
  loading: false,
  refreshing: false,
  error: null,
  lastUpdatedAt: null,

  initialize: async () => {
    if (get().loading) return;
    set({ loading: true, error: null, positions: loadPositions() });
    try {
      const since = new Date(Date.now() - HISTORY_DAYS * 86400_000).toISOString();
      const [events, posts, constants] = await Promise.all([
        fetchQuantEvents(),
        fetchElonPosts(since),
        fetchQuantConstants(),
      ]);
      set((s) => ({
        events,
        posts,
        constants,
        selectedSlug: s.selectedSlug ?? defaultSlugOf(events),
        loading: false,
        lastUpdatedAt: new Date().toISOString(),
      }));
      const rh = remainingHoursOf(events, get().selectedSlug);
      if (rh !== null) {
        set({ remainingSamples: await fetchRemainingSamples(rh) });
      }
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : 'load failed' });
    }
  },

  refresh: async () => {
    if (get().refreshing) return;
    set({ refreshing: true, error: null });
    try {
      const since = new Date(Date.now() - HISTORY_DAYS * 86400_000).toISOString();
      const [events, posts] = await Promise.all([fetchQuantEvents(), fetchElonPosts(since)]);
      set((s) => ({
        events,
        posts,
        selectedSlug: s.selectedSlug ?? defaultSlugOf(events),
        refreshing: false,
        lastUpdatedAt: new Date().toISOString(),
      }));
      const rh = remainingHoursOf(events, get().selectedSlug);
      if (rh !== null) {
        set({ remainingSamples: await fetchRemainingSamples(rh) });
      }
    } catch (e) {
      set({ refreshing: false, error: e instanceof Error ? e.message : 'refresh failed' });
    }
  },

  selectEvent: (slug) => {
    set({ selectedSlug: slug });
    // 切市场后剩余时长变化，异步更新 bootstrap 样本（失败仅回退泊松，不报错）
    const rh = remainingHoursOf(get().events, slug);
    if (rh !== null) {
      void fetchRemainingSamples(rh).then((samples) => set({ remainingSamples: samples }));
    }
  },

  addPosition: (p) => {
    const position: QuantPosition = {
      ...p,
      id: `pos_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
    };
    const positions = [...get().positions, position];
    savePositions(positions);
    set({ positions });
  },

  removePosition: (id) => {
    const positions = get().positions.filter((p) => p.id !== id);
    savePositions(positions);
    set({ positions });
  },

  clearBucketPositions: (eventSlug, bucketLabel) => {
    const positions = get().positions.filter(
      (p) => !(p.eventSlug === eventSlug && p.bucketLabel === bucketLabel),
    );
    savePositions(positions);
    set({ positions });
  },
}));
