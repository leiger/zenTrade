'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMuskQuantStore } from '@/lib/musk-quant-store';
import {
  buildEntryStructure,
  buildPhaseEntryPlan,
  buildSignals,
  computePrediction,
  countPostsInWindow,
  countPostsToday,
  currentWindow,
  dailyTotals,
  evaluateBuckets,
  findLotteryOpportunities,
  landingImpacts,
  operationPhase,
  phaseBadge,
  timingBadge,
  todayHourlyCounts,
  todayRhythmBlocks,
} from '@/lib/musk-quant-engine';
import type { QuantEvent } from '@/types/musk-quant';

/**
 * 从 store 派生当前选中市场的全套量化分析。
 * 每 60s 触发一次重算（时间推进会改变剩余时间/会话状态）。
 */
export function useMuskQuantAnalysis() {
  const { events, selectedSlug, posts, constants, remainingSamples } = useMuskQuantStore();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  return useMemo(() => {
    void tick;
    const event: QuantEvent | undefined = events.find((e) => e.slug === selectedSlug) ?? events[0];
    if (!event) return null;

    const now = new Date();
    const total = countPostsInWindow(posts, event.startDate, event.endDate);
    const todayCount = countPostsToday(posts, now);
    const todayByHour = todayHourlyCounts(posts, now);
    const remainingHours = Math.max(
      0,
      (new Date(event.endDate).getTime() - now.getTime()) / 3600_000,
    );
    const elapsedDays = Math.max(
      0.25,
      (now.getTime() - new Date(event.startDate).getTime()) / 86400_000,
    );
    const pace = total / elapsedDays;

    const prediction = computePrediction(total, todayCount, pace, remainingHours, todayByHour, now, constants);
    const probs = evaluateBuckets(event.buckets, prediction, total, pace, remainingHours, remainingSamples);
    const distribution: 'bootstrap' | 'poisson' =
      remainingSamples && remainingSamples.length >= 100 ? 'bootstrap' : 'poisson';

    const startKey = event.startDate.slice(0, 10);
    const daily = dailyTotals(posts).filter((d) => d.date >= startKey);

    return {
      event,
      now,
      constants,
      distribution,
      total,
      todayCount,
      todayByHour,
      remainingHours,
      remainingDays: remainingHours / 24,
      pace,
      daily,
      prediction,
      probs,
      entryStructure: buildEntryStructure(probs),
      phasePlan: buildPhaseEntryPlan(probs, prediction, total, remainingHours),
      lottery: findLotteryOpportunities(probs, prediction, total),
      signals: buildSignals(probs, prediction, total, todayCount, pace, remainingHours, now),
      badge: phaseBadge(remainingHours / 24),
      opPhase: operationPhase(remainingHours / 24),
      window: currentWindow(now),
      timing: timingBadge(prediction.sessions, now),
      rhythmBlocks: todayRhythmBlocks(todayByHour, now),
      impacts: landingImpacts(prediction.sessions, prediction, now),
    };
  }, [events, selectedSlug, posts, constants, remainingSamples, tick]);
}

export type MuskQuantAnalysis = NonNullable<ReturnType<typeof useMuskQuantAnalysis>>;
