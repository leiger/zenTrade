import { create } from 'zustand';
import { Thesis, Snapshot, ThesisTag, Verdict } from '@/types/thesis';
import { addDays, addWeeks, addMonths } from 'date-fns';
import type { TimelineOption } from '@/types/thesis';
import * as api from './api';

/** 根据时间轴选项计算回顾日期 */
export function getReviewDate(timeline: TimelineOption, from: Date = new Date()): Date {
  switch (timeline) {
    case '1D':
      return addDays(from, 1);
    case '1W':
      return addWeeks(from, 1);
    case '1M':
      return addMonths(from, 1);
    case '1Q':
      return addMonths(from, 3);
    case 'custom':
      return from;
  }
}

interface ThesisStore {
  theses: Thesis[];
  loading: boolean;
  fetchTheses: () => Promise<void>;
  addThesis: (thesis: Pick<Thesis, 'name' | 'category' | 'asset'>) => Promise<void>;
  updateThesis: (
    id: string,
    updates: Partial<Pick<Thesis, 'name' | 'description' | 'tags'>>
  ) => Promise<void>;
  deleteThesis: (id: string) => Promise<void>;
  addSnapshot: (
    thesisId: string,
    snapshot: Omit<Snapshot, 'id' | 'thesisId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  updateSnapshot: (
    thesisId: string,
    snapshotId: string,
    updates: {
      content?: string;
      aiAnalysis?: string;
      tags?: string[];
      timeline?: string;
      expectedReviewDate?: string;
      links?: string[];
      influencedBy?: string[];
    }
  ) => Promise<void>;
  deleteSnapshot: (thesisId: string, snapshotId: string) => Promise<void>;
  addFollowUp: (
    thesisId: string,
    snapshotId: string,
    followUp: { comment: string; verdict: Verdict }
  ) => Promise<void>;
  deleteFollowUp: (thesisId: string, snapshotId: string) => Promise<void>;
  reorderTheses: (theses: Thesis[]) => Promise<void>;
}

export const useThesisStore = create<ThesisStore>((set) => ({
  theses: [],
  loading: true,

  fetchTheses: async () => {
    try {
      set({ loading: true });
      console.log('[Store] Fetching theses...');
      const theses = await api.fetchTheses();
      console.log('[Store] Fetched', theses.length, 'theses:', theses);
      set({ theses, loading: false });
    } catch (e) {
      console.error('[Store] Failed to fetch theses:', e);
      set({ loading: false });
    }
  },

  addThesis: async (thesis) => {
    try {
      await api.createThesis({
        name: thesis.name,
        category: thesis.category,
        asset: thesis.asset,
      });
      const theses = await api.fetchTheses();
      set({ theses });
    } catch (e) {
      console.error('Failed to add thesis:', e);
    }
  },

  updateThesis: async (id, updates) => {
    try {
      const payload: { name?: string; description?: string; tags?: string[] } = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.description !== undefined) payload.description = updates.description;
      if (updates.tags !== undefined) payload.tags = updates.tags.map((t) => t.id);

      const updated = await api.updateThesis(id, payload);
      set((state) => ({
        theses: state.theses.map((t) => (t.id === id ? updated : t)),
      }));
    } catch (e) {
      console.error('Failed to update thesis:', e);
    }
  },

  deleteThesis: async (id) => {
    set((state) => ({ theses: state.theses.filter((t) => t.id !== id) }));
    try {
      await api.deleteThesis(id);
    } catch (e) {
      console.error('Failed to delete thesis:', e);
      const theses = await api.fetchTheses();
      set({ theses });
    }
  },

  addSnapshot: async (thesisId, snapshot) => {
    try {
      await api.createSnapshot(thesisId, {
        content: snapshot.content,
        aiAnalysis: snapshot.aiAnalysis,
        tags: snapshot.tags.map((t) => t.id),
        timeline: snapshot.timeline,
        expectedReviewDate: snapshot.expectedReviewDate,
        links: snapshot.links,
        influencedBy: snapshot.influencedBy,
      });
      const theses = await api.fetchTheses();
      set({ theses });
    } catch (e) {
      console.error('Failed to add snapshot:', e);
    }
  },

  updateSnapshot: async (thesisId, snapshotId, updates) => {
    try {
      await api.updateSnapshot(thesisId, snapshotId, updates);
      const theses = await api.fetchTheses();
      set({ theses });
    } catch (e) {
      console.error('Failed to update snapshot:', e);
    }
  },

  deleteSnapshot: async (thesisId, snapshotId) => {
    try {
      await api.deleteSnapshot(thesisId, snapshotId);
      const theses = await api.fetchTheses();
      set({ theses });
    } catch (e) {
      console.error('Failed to delete snapshot:', e);
    }
  },

  addFollowUp: async (thesisId, snapshotId, followUp) => {
    try {
      await api.upsertFollowUp(thesisId, snapshotId, followUp);
      const theses = await api.fetchTheses();
      set({ theses });
    } catch (e) {
      console.error('Failed to add follow-up:', e);
    }
  },

  deleteFollowUp: async (thesisId, snapshotId) => {
    try {
      await api.deleteFollowUp(thesisId, snapshotId);
      const theses = await api.fetchTheses();
      set({ theses });
    } catch (e) {
      console.error('Failed to delete follow-up:', e);
    }
  },

  reorderTheses: async (theses) => {
    set({ theses });
    try {
      const orderedIds = theses.map((t) => t.id);
      const updated = await api.reorderTheses(orderedIds);
      set({ theses: updated });
    } catch (e) {
      console.error('Failed to reorder theses:', e);
      const fresh = await api.fetchTheses();
      set({ theses: fresh });
    }
  },
}));
