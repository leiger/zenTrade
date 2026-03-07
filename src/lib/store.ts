import { create } from 'zustand';
import { Thesis, Snapshot, ThesisTag, FollowUp, Verdict } from '@/types/thesis';
import { BUY_TAGS, SELL_TAGS } from '@/constants/tags';
import { addDays, addWeeks, addMonths } from 'date-fns';
import type { TimelineOption } from '@/types/thesis';

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
  }
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// 种子数据
const now = new Date().toISOString();
const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

const SEED_THESES: Thesis[] = [
  {
    id: 'seed-1',
    name: 'Bitcoin',
    category: 'crypto',
    asset: 'BTC',
    description: '',
    tags: [BUY_TAGS[0], BUY_TAGS[2]],
    snapshots: [
      {
        id: 'snap-1',
        thesisId: 'seed-1',
        content:
          '当前价位处于减半前的蓄力区间，链上数据显示长期持有者占比持续上升，交易所余额降至2年新低。宏观层面美联储暂停加息，流动性有望回暖。',
        tags: [BUY_TAGS[0]],
        timeline: '1Q',
        expectedReviewDate: addMonths(new Date(monthAgo), 3).toISOString(),
        createdAt: monthAgo,
        links: ['https://glassnode.com/reports'],
        influencedBy: 'PlanB (@100trillionUSD)',
        followUp: {
          id: 'fu-1',
          snapshotId: 'snap-1',
          comment: '链上数据继续向好，减半叙事正在兑现，维持看多。',
          verdict: 'correct',
          createdAt: weekAgo,
        },
      },
    ],
    createdAt: monthAgo,
    updatedAt: weekAgo,
  },
  {
    id: 'seed-2',
    name: 'Solana',
    category: 'crypto',
    asset: 'SOL',
    description: '',
    tags: [BUY_TAGS[4], SELL_TAGS[2]],
    snapshots: [
      {
        id: 'snap-2',
        thesisId: 'seed-2',
        content:
          'SOL 生态 TVL 突破 $8B，Jupiter 交易量创新高。Meme 币热度回升但需警惕泡沫。设置 $120 为关键支撑位，跌破即执行防守止损。',
        tags: [BUY_TAGS[4], SELL_TAGS[2]],
        timeline: '1W',
        expectedReviewDate: addWeeks(new Date(weekAgo), 1).toISOString(),
        createdAt: weekAgo,
        links: [],
        influencedBy: '',
      },
    ],
    createdAt: weekAgo,
    updatedAt: now,
  },
  {
    id: 'seed-3',
    name: 'NVIDIA',
    category: 'us-stock',
    asset: 'NVDA',
    description: '',
    tags: [BUY_TAGS[0]],
    snapshots: [],
    createdAt: monthAgo,
    updatedAt: monthAgo,
  },
];

interface ThesisStore {
  theses: Thesis[];
  addThesis: (thesis: Pick<Thesis, 'name' | 'category' | 'asset'>) => void;
  updateThesis: (
    id: string,
    updates: Partial<Pick<Thesis, 'name' | 'description' | 'tags'>>
  ) => void;
  deleteThesis: (id: string) => void;
  addSnapshot: (
    thesisId: string,
    snapshot: Omit<Snapshot, 'id' | 'thesisId' | 'createdAt'>
  ) => void;
  addFollowUp: (
    thesisId: string,
    snapshotId: string,
    followUp: { comment: string; verdict: Verdict }
  ) => void;
  reorderTheses: (theses: Thesis[]) => void;
}

export const useThesisStore = create<ThesisStore>((set) => ({
  theses: SEED_THESES,

  addThesis: (thesis) =>
    set((state) => ({
      theses: [
        {
          ...thesis,
          id: generateId(),
          description: '',
          tags: [],
          snapshots: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ...state.theses,
      ],
    })),

  updateThesis: (id, updates) =>
    set((state) => ({
      theses: state.theses.map((t) =>
        t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
      ),
    })),

  deleteThesis: (id) =>
    set((state) => ({
      theses: state.theses.filter((t) => t.id !== id),
    })),

  addSnapshot: (thesisId, snapshot) =>
    set((state) => ({
      theses: state.theses.map((t) =>
        t.id === thesisId
          ? {
              ...t,
              snapshots: [
                ...t.snapshots,
                {
                  ...snapshot,
                  id: generateId(),
                  thesisId,
                  createdAt: new Date().toISOString(),
                },
              ],
              updatedAt: new Date().toISOString(),
            }
          : t
      ),
    })),

  addFollowUp: (thesisId, snapshotId, { comment, verdict }) =>
    set((state) => ({
      theses: state.theses.map((t) =>
        t.id === thesisId
          ? {
              ...t,
              snapshots: t.snapshots.map((s) =>
                s.id === snapshotId
                  ? {
                      ...s,
                      followUp: {
                        id: generateId(),
                        snapshotId,
                        comment,
                        verdict,
                        createdAt: new Date().toISOString(),
                      },
                    }
                  : s
              ),
              updatedAt: new Date().toISOString(),
            }
          : t
      ),
    })),

  reorderTheses: (theses) => set({ theses }),
}));
