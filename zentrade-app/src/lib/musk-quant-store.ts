import { create } from 'zustand';
import type { ElonPost, QuantEvent, QuantPosition } from '@/types/musk-quant';
import { fetchElonPosts, fetchQuantEvents } from '@/lib/musk-quant-api';

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
  loading: false,
  refreshing: false,
  error: null,
  lastUpdatedAt: null,

  initialize: async () => {
    if (get().loading) return;
    set({ loading: true, error: null, positions: loadPositions() });
    try {
      const since = new Date(Date.now() - HISTORY_DAYS * 86400_000).toISOString();
      const [events, posts] = await Promise.all([fetchQuantEvents(), fetchElonPosts(since)]);
      set((s) => ({
        events,
        posts,
        selectedSlug: s.selectedSlug ?? events[0]?.slug ?? null,
        loading: false,
        lastUpdatedAt: new Date().toISOString(),
      }));
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
        selectedSlug: s.selectedSlug ?? events[0]?.slug ?? null,
        refreshing: false,
        lastUpdatedAt: new Date().toISOString(),
      }));
    } catch (e) {
      set({ refreshing: false, error: e instanceof Error ? e.message : 'refresh failed' });
    }
  },

  selectEvent: (slug) => set({ selectedSlug: slug }),

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
