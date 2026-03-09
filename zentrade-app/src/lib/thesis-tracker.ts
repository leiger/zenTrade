import { endOfDay, isAfter, isBefore, startOfDay } from 'date-fns';
import type { Snapshot, Thesis, ThesisStatus, ThesisTag, Verdict } from '@/types/thesis';

export const THESIS_STATUS_CONFIG: Record<
  ThesisStatus,
  { label: string; className: string; description: string }
> = {
  active: {
    label: '进行中',
    className: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600',
    description: '持续跟踪并继续记录快照',
  },
  paused: {
    label: '暂停',
    className: 'border-amber-500/25 bg-amber-500/10 text-amber-600',
    description: '暂不新增判断，但保留后续回顾',
  },
  archived: {
    label: '归档',
    className: 'border-slate-500/25 bg-slate-500/10 text-slate-600',
    description: '已完成阶段复盘，默认不再活跃展示',
  },
  invalidated: {
    label: '证伪',
    className: 'border-rose-500/25 bg-rose-500/10 text-rose-600',
    description: '核心逻辑被否定，保留供复盘参考',
  },
};

export type ReviewBucket = 'overdue' | 'today' | 'upcoming';

export interface ReviewInboxItem {
  thesis: Thesis;
  snapshot: Snapshot;
  reviewBucket: ReviewBucket;
  reviewBucketLabel: string;
  dueAt: Date;
  isPending: boolean;
  daysDelta: number;
}

export interface ReminderSummary {
  overdue: ReviewInboxItem[];
  today: ReviewInboxItem[];
  upcoming: ReviewInboxItem[];
  pending: ReviewInboxItem[];
}

export function getReviewedSnapshots(snapshots: Snapshot[]) {
  return snapshots.filter((snapshot) => snapshot.followUp);
}

export function getAccuracyStats(snapshots: Snapshot[]) {
  const reviewed = getReviewedSnapshots(snapshots);
  const correct = reviewed.filter((snapshot) => snapshot.followUp?.verdict === 'correct').length;
  const wrong = reviewed.filter((snapshot) => snapshot.followUp?.verdict === 'wrong').length;
  const neutral = reviewed.filter((snapshot) => snapshot.followUp?.verdict === 'neutral').length;
  const rate = reviewed.length > 0 ? Math.round((correct / reviewed.length) * 100) : null;

  return {
    reviewed,
    correct,
    wrong,
    neutral,
    rate,
    coverage: snapshots.length > 0 ? Math.round((reviewed.length / snapshots.length) * 100) : 0,
  };
}

export function getReviewBucket(reviewDate: Date, now = new Date()): ReviewBucket {
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  if (isBefore(reviewDate, todayStart)) {
    return 'overdue';
  }

  if (isAfter(reviewDate, todayEnd)) {
    return 'upcoming';
  }

  return 'today';
}

export function getReviewBucketLabel(bucket: ReviewBucket) {
  switch (bucket) {
    case 'overdue':
      return '已逾期';
    case 'today':
      return '今天到期';
    case 'upcoming':
      return '即将到期';
  }
}

export function flattenReviewInbox(theses: Thesis[], now = new Date()): ReviewInboxItem[] {
  return theses.flatMap((thesis) =>
    thesis.snapshots
      .filter((snapshot) => !snapshot.followUp)
      .map((snapshot) => {
        const dueAt = new Date(snapshot.expectedReviewDate);
        const reviewBucket = getReviewBucket(dueAt, now);
        const dayStart = startOfDay(now).getTime();
        const targetStart = startOfDay(dueAt).getTime();
        const daysDelta = Math.round((targetStart - dayStart) / (1000 * 60 * 60 * 24));

        return {
          thesis,
          snapshot,
          reviewBucket,
          reviewBucketLabel: getReviewBucketLabel(reviewBucket),
          dueAt,
          isPending: true,
          daysDelta,
        };
      })
  );
}

export function getReminderSummary(theses: Thesis[], now = new Date()): ReminderSummary {
  const pending = flattenReviewInbox(theses, now)
    .filter((item) => item.thesis.status !== 'archived')
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());

  return {
    overdue: pending.filter((item) => item.reviewBucket === 'overdue'),
    today: pending.filter((item) => item.reviewBucket === 'today'),
    upcoming: pending.filter((item) => item.reviewBucket === 'upcoming'),
    pending,
  };
}

export function collectThesisTags(thesis: Thesis): ThesisTag[] {
  const tagMap = new Map<string, ThesisTag>();

  for (const tag of thesis.tags) {
    tagMap.set(tag.id, tag);
  }

  for (const snapshot of thesis.snapshots) {
    for (const tag of snapshot.tags) {
      tagMap.set(tag.id, tag);
    }
  }

  return Array.from(tagMap.values());
}

export function collectAllTags(theses: Thesis[]) {
  const tagMap = new Map<string, ThesisTag>();

  for (const thesis of theses) {
    for (const tag of collectThesisTags(thesis)) {
      tagMap.set(tag.id, tag);
    }
  }

  return Array.from(tagMap.values()).sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));
}

export function normalizeInfluenceLabel(label: string) {
  return label.trim().toLowerCase();
}

export function getInfluenceAnalytics(theses: Thesis[]) {
  const influenceMap = new Map<
    string,
    { label: string; total: number; reviewed: number; correct: number; wrong: number; neutral: number }
  >();

  for (const thesis of theses) {
    for (const snapshot of thesis.snapshots) {
      if (snapshot.influencedBy.length === 0) continue;

      for (const label of snapshot.influencedBy) {
        const key = normalizeInfluenceLabel(label);
        const current = influenceMap.get(key) ?? {
          label,
          total: 0,
          reviewed: 0,
          correct: 0,
          wrong: 0,
          neutral: 0,
        };

        current.total += 1;
        if (snapshot.followUp) {
          current.reviewed += 1;
          current[snapshot.followUp.verdict] += 1;
        }

        influenceMap.set(key, current);
      }
    }
  }

  return Array.from(influenceMap.values())
    .map((item) => ({
      ...item,
      accuracy: item.reviewed > 0 ? Math.round((item.correct / item.reviewed) * 100) : null,
    }))
    .sort((a, b) => b.total - a.total);
}

export function getCategoryAnalytics(theses: Thesis[]) {
  const categoryMap = new Map<
    string,
    { category: string; theses: number; snapshots: number; reviewed: number; correct: number }
  >();

  for (const thesis of theses) {
    const current = categoryMap.get(thesis.category) ?? {
      category: thesis.category,
      theses: 0,
      snapshots: 0,
      reviewed: 0,
      correct: 0,
    };

    current.theses += 1;
    current.snapshots += thesis.snapshots.length;
    current.reviewed += getReviewedSnapshots(thesis.snapshots).length;
    current.correct += thesis.snapshots.filter((snapshot) => snapshot.followUp?.verdict === 'correct').length;

    categoryMap.set(thesis.category, current);
  }

  return Array.from(categoryMap.values())
    .map((item) => ({
      ...item,
      accuracy: item.reviewed > 0 ? Math.round((item.correct / item.reviewed) * 100) : null,
      coverage: item.snapshots > 0 ? Math.round((item.reviewed / item.snapshots) * 100) : 0,
    }))
    .sort((a, b) => b.snapshots - a.snapshots);
}

export function getTimelineAnalytics(theses: Thesis[]) {
  const timelineMap = new Map<
    string,
    { timeline: string; total: number; reviewed: number; correct: number; wrong: number; neutral: number }
  >();

  for (const thesis of theses) {
    for (const snapshot of thesis.snapshots) {
      const current = timelineMap.get(snapshot.timeline) ?? {
        timeline: snapshot.timeline,
        total: 0,
        reviewed: 0,
        correct: 0,
        wrong: 0,
        neutral: 0,
      };

      current.total += 1;
      if (snapshot.followUp) {
        current.reviewed += 1;
        current[snapshot.followUp.verdict] += 1;
      }

      timelineMap.set(snapshot.timeline, current);
    }
  }

  return Array.from(timelineMap.values())
    .map((item) => ({
      ...item,
      accuracy: item.reviewed > 0 ? Math.round((item.correct / item.reviewed) * 100) : null,
    }))
    .sort((a, b) => b.total - a.total);
}

export function getTagAnalytics(theses: Thesis[]) {
  const tagMap = new Map<
    string,
    { id: string; label: string; total: number; reviewed: number; correct: number; wrong: number; neutral: number }
  >();

  for (const thesis of theses) {
    for (const snapshot of thesis.snapshots) {
      for (const tag of snapshot.tags) {
        const current = tagMap.get(tag.id) ?? {
          id: tag.id,
          label: tag.label,
          total: 0,
          reviewed: 0,
          correct: 0,
          wrong: 0,
          neutral: 0,
        };

        current.total += 1;
        if (snapshot.followUp) {
          current.reviewed += 1;
          current[snapshot.followUp.verdict] += 1;
        }

        tagMap.set(tag.id, current);
      }
    }
  }

  return Array.from(tagMap.values())
    .map((item) => ({
      ...item,
      accuracy: item.reviewed > 0 ? Math.round((item.correct / item.reviewed) * 100) : null,
    }))
    .sort((a, b) => b.total - a.total);
}

export function getVerdictLabel(verdict: Verdict) {
  switch (verdict) {
    case 'correct':
      return '正确';
    case 'wrong':
      return '错误';
    case 'neutral':
      return '持平';
  }
}
