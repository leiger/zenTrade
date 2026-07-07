'use client';

import {
  CircleCheck,
  CircleDashed,
  CloudMoon,
  Eye,
  Flame,
  Hourglass,
  Megaphone,
  Moon,
  MoonStar,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * 引擎数据里的 emoji（会话窗口/节奏块/落点影响）统一映射为 Lucide 图标，
 * UI 层不再直接渲染 emoji。
 */

/** currentWindow 的 tone → 图标 */
const WINDOW_ICONS: Record<string, { Icon: LucideIcon; cls: string }> = {
  orange: { Icon: Flame, cls: 'text-orange-500' },
  slate: { Icon: Moon, cls: 'text-slate-400' },
  emerald: { Icon: Zap, cls: 'text-emerald-500' },
  teal: { Icon: TrendingDown, cls: 'text-teal-500' },
};

export function WindowIcon({ tone, className }: { tone: string; className?: string }) {
  const meta = WINDOW_ICONS[tone] ?? WINDOW_ICONS.emerald;
  return <meta.Icon className={cn('h-4 w-4 shrink-0', meta.cls, className)} />;
}

/** todayRhythmBlocks 的 kind → 图标 */
const RHYTHM_ICONS: Record<string, { Icon: LucideIcon; cls: string }> = {
  peak: { Icon: Flame, cls: 'text-orange-500' },
  sleep: { Icon: Moon, cls: 'text-slate-400' },
  low: { Icon: CloudMoon, cls: 'text-teal-500/80' },
  medium: { Icon: Megaphone, cls: 'text-primary/80' },
};

export function RhythmIcon({ kind, className }: { kind: string; className?: string }) {
  const meta = RHYTHM_ICONS[kind] ?? RHYTHM_ICONS.medium;
  return <meta.Icon className={cn('h-4 w-4 shrink-0', meta.cls, className)} />;
}

/** timingBadge 的 key → 图标 */
const TIMING_ICONS: Record<string, { Icon: LucideIcon; cls: string }> = {
  ACTIVE: { Icon: Zap, cls: 'text-emerald-500' },
  DEAD: { Icon: Moon, cls: 'text-slate-400' },
  LOW: { Icon: CloudMoon, cls: 'text-teal-500/80' },
  WATCH: { Icon: Eye, cls: 'text-amber-500' },
  NEUTRAL: { Icon: CircleDashed, cls: 'text-muted-foreground' },
};

export function TimingIcon({ timingKey, className }: { timingKey: string; className?: string }) {
  const meta = TIMING_ICONS[timingKey] ?? TIMING_ICONS.NEUTRAL;
  return <meta.Icon className={cn('h-4 w-4 shrink-0', meta.cls, className)} />;
}

/** landingImpacts 的 tone → 图标 */
const IMPACT_ICONS: Record<string, { Icon: LucideIcon; cls: string }> = {
  warning: { Icon: TriangleAlert, cls: 'text-amber-500' },
  down: { Icon: TrendingDown, cls: 'text-rose-500' },
  up: { Icon: TrendingUp, cls: 'text-emerald-500' },
  wait: { Icon: Hourglass, cls: 'text-muted-foreground' },
  active: { Icon: MoonStar, cls: 'text-indigo-400' },
  ok: { Icon: CircleCheck, cls: 'text-emerald-500' },
};

export function ImpactIcon({ tone, className }: { tone: string; className?: string }) {
  const meta = IMPACT_ICONS[tone] ?? IMPACT_ICONS.ok;
  return <meta.Icon className={cn('mt-0.5 h-4 w-4 shrink-0', meta.cls, className)} />;
}
