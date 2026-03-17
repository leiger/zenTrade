import { create } from 'zustand';
import type { MonitorAlert, MonitorStatus, StrategyInstance, StrategyType } from '@/types/xmonitor';
import * as api from './xmonitor-api';

interface XMonitorStore {
  status: MonitorStatus | null;
  alerts: MonitorAlert[];
  strategies: StrategyInstance[];
  loading: boolean;
  refreshing: boolean;
  alertFilter: StrategyType | null;
  highlightAlertId: string | null;

  fetchStatus: () => Promise<void>;
  fetchAlerts: (strategyType?: string) => Promise<void>;
  refreshData: () => Promise<void>;
  fetchStrategies: () => Promise<void>;
  submitFeedback: (alertId: string, feedback: 'yes' | 'no', note?: string) => Promise<void>;
  createStrategy: (type: StrategyType, name: string, params: Record<string, unknown>) => Promise<void>;
  updateStrategy: (id: string, updates: { name?: string; enabled?: boolean; params?: Record<string, unknown> }) => Promise<void>;
  deleteStrategy: (id: string) => Promise<void>;
  setAlertFilter: (filter: StrategyType | null) => void;
  setHighlightAlertId: (id: string | null) => void;
  prependAlert: (alert: MonitorAlert) => void;
  updateStatus: (status: MonitorStatus) => void;
}

export const useXMonitorStore = create<XMonitorStore>((set, get) => ({
  status: null,
  alerts: [],
  strategies: [],
  loading: true,
  refreshing: false,
  alertFilter: null,
  highlightAlertId: null,

  fetchStatus: async () => {
    try {
      const status = await api.fetchMonitorStatus();
      set({ status });
    } catch (e) {
      console.error('[XMonitor] Failed to fetch status:', e);
    }
  },

  refreshData: async () => {
    set({ refreshing: true });
    try {
      const status = await api.refreshData();
      set({ status, refreshing: false });
      await get().fetchAlerts();
    } catch (e) {
      console.error('[XMonitor] Failed to refresh:', e);
      set({ refreshing: false });
    }
  },

  fetchAlerts: async (strategyType?: string) => {
    try {
      set({ loading: true });
      const alerts = await api.fetchAlerts(strategyType);
      set({ alerts, loading: false });
    } catch (e) {
      console.error('[XMonitor] Failed to fetch alerts:', e);
      set({ loading: false });
    }
  },

  fetchStrategies: async () => {
    try {
      const strategies = await api.fetchStrategies();
      set({ strategies });
    } catch (e) {
      console.error('[XMonitor] Failed to fetch strategies:', e);
    }
  },

  submitFeedback: async (alertId, feedback, note) => {
    try {
      const updated = await api.postAlertFeedback(alertId, feedback, note);
      set((state) => ({
        alerts: state.alerts.map((a) => (a.id === alertId ? updated : a)),
      }));
    } catch (e) {
      console.error('[XMonitor] Failed to submit feedback:', e);
    }
  },

  createStrategy: async (type, name, params) => {
    try {
      await api.createStrategy(type, name, params);
      await get().fetchStrategies();
    } catch (e) {
      console.error('[XMonitor] Failed to create strategy:', e);
    }
  },

  updateStrategy: async (id, updates) => {
    try {
      await api.updateStrategy(id, updates);
      await get().fetchStrategies();
    } catch (e) {
      console.error('[XMonitor] Failed to update strategy:', e);
    }
  },

  deleteStrategy: async (id) => {
    try {
      await api.deleteStrategy(id);
      await get().fetchStrategies();
    } catch (e) {
      console.error('[XMonitor] Failed to delete strategy:', e);
    }
  },

  setAlertFilter: (filter) => set({ alertFilter: filter }),
  setHighlightAlertId: (id) => set({ highlightAlertId: id }),
  prependAlert: (alert) => set((state) => ({ alerts: [alert, ...state.alerts] })),
  updateStatus: (status) => set({ status }),
}));
