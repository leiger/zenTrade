'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useThesisStore } from '@/lib/store';
import type { ThesisStatus } from '@/types/thesis';
import { getCategoryConfig, getAssetName } from '@/constants/assets';
import { collectThesisTags } from '@/lib/thesis-tracker';
import { SnapshotTimeline } from '@/components/modules/thesis-tracker/SnapshotTimeline';
import { SnapshotDetailPanel } from '@/components/modules/thesis-tracker/SnapshotDetailPanel';
import { ThesisStatusBadge } from '@/components/modules/thesis-tracker/ThesisStatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format, subDays } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  ArrowLeft,
  Camera,
  Trash2,
  MoreHorizontal,
  BrainCircuit,
  TriangleAlert,
  CalendarDays,
  MessageSquareText,
  Target,
  CircleCheck,
  CircleX,
  CircleMinus,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
type DrawerState =
  | null
  | { mode: 'create' }
  | { mode: 'view'; snapshotId: string };

export default function ThesisDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;

  const thesis = useThesisStore((s) => s.theses.find((t) => t.id === id));
  const loading = useThesisStore((s) => s.loading);
  const fetchTheses = useThesisStore((s) => s.fetchTheses);
  const deleteThesis = useThesisStore((s) => s.deleteThesis);
  const updateThesis = useThesisStore((s) => s.updateThesis);
  const addFollowUp = useThesisStore((s) => s.addFollowUp);
  const deleteFollowUp = useThesisStore((s) => s.deleteFollowUp);
  const [drawerState, setDrawerState] = useState<DrawerState>(null);
  const [closing, setClosing] = useState(false);
  const [dismissedQueryKey, setDismissedQueryKey] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [reviewFilter, setReviewFilter] = useState<'all' | 'pending' | 'reviewed' | 'overdue'>('all');
  const [tagFilter, setTagFilter] = useState<'all' | string>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | '7d' | '30d' | '90d'>('all');

  useEffect(() => {
    fetchTheses();
  }, [fetchTheses]);

  const catConfig = thesis ? getCategoryConfig(thesis.category) : null;
  const assetDisplayName = thesis?.asset
    ? getAssetName(thesis.category, thesis.asset)
    : null;

  const snapshotCount = thesis?.snapshots.length ?? 0;
  const reviewedSnapshots = thesis?.snapshots.filter((s) => s.followUp) ?? [];
  const correctCount = reviewedSnapshots.filter((s) => s.followUp!.verdict === 'correct').length;
  const wrongCount = reviewedSnapshots.filter((s) => s.followUp!.verdict === 'wrong').length;
  const neutralCount = reviewedSnapshots.filter((s) => s.followUp!.verdict === 'neutral').length;
  const accuracyRate = reviewedSnapshots.length > 0
    ? Math.round((correctCount / reviewedSnapshots.length) * 100)
    : null;
  const allTags = thesis ? collectThesisTags(thesis) : [];

  const filteredSnapshots = useMemo(() => {
    if (!thesis) {
      return [];
    }

    const keyword = search.trim().toLowerCase();
    const timeThreshold = timeFilter === 'all'
      ? null
      : subDays(new Date(), Number.parseInt(timeFilter, 10));

    return thesis.snapshots.filter((snapshot) => {
      if (reviewFilter === 'pending' && snapshot.followUp) {
        return false;
      }

      if (reviewFilter === 'reviewed' && !snapshot.followUp) {
        return false;
      }

      if (reviewFilter === 'overdue' && (snapshot.followUp || new Date(snapshot.expectedReviewDate) >= new Date())) {
        return false;
      }

      if (tagFilter !== 'all' && !snapshot.tags.some((tag) => tag.id === tagFilter)) {
        return false;
      }

      if (timeThreshold && new Date(snapshot.createdAt) < timeThreshold) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const haystack = [
        snapshot.content,
        snapshot.aiAnalysis,
        ...snapshot.tags.map((tag) => tag.label),
        ...snapshot.influencedBy,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [reviewFilter, search, tagFilter, thesis, timeFilter]);

  const queryKey = searchParams.toString();
  const queryDrawerState = useMemo<DrawerState>(() => {
    if (!thesis) return null;

    const mode = searchParams.get('mode');
    const snapshotId = searchParams.get('snapshot');

    if (mode === 'create') {
      return { mode: 'create' };
    }

    if (snapshotId && thesis.snapshots.some((snapshot) => snapshot.id === snapshotId)) {
      return { mode: 'view', snapshotId };
    }

    return null;
  }, [searchParams, thesis]);
  const effectiveDrawerState = drawerState ?? (dismissedQueryKey === queryKey ? null : queryDrawerState);
  const drawerOpen = effectiveDrawerState !== null;
  const selectedSnapshot =
    effectiveDrawerState?.mode === 'view'
      ? thesis?.snapshots.find((s) => s.id === effectiveDrawerState.snapshotId)
      : undefined;

  const handleStatusChange = (status: ThesisStatus) => {
    if (!thesis) return;
    updateThesis(thesis.id, { status });
  };

  const handleDelete = () => {
    if (!thesis) return;
    deleteThesis(thesis.id);
    router.push('/thesis');
  };

  const closeDrawer = () => {
    setDismissedQueryKey(queryKey);
    setClosing(true);
    setTimeout(() => {
      setDrawerState(null);
      setClosing(false);
    }, 300);
  };

  if (loading && !thesis) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!thesis) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <BrainCircuit className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg font-medium mb-2">看法不存在</p>
        <Button variant="outline" onClick={() => router.push('/thesis')}>
          返回列表
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/thesis')}
          className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          返回列表
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="打开 thesis 菜单">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>生命周期</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => handleStatusChange('active')}>
              标记为进行中
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => handleStatusChange('paused')}>
              标记为暂停
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => handleStatusChange('archived')}>
              标记为归档
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => handleStatusChange('invalidated')}>
              标记为证伪
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => setDeleteDialogOpen(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── Asset info ── */}
      <div className="flex items-start gap-4 mb-8">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-3xl flex-shrink-0">
          {catConfig?.icon ?? '📁'}
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <h1 className="text-xl font-bold tracking-tight leading-tight">{thesis.name}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {assetDisplayName && (
              <Badge variant="secondary" className="text-xs font-normal gap-1">
                {assetDisplayName}
              </Badge>
            )}
            <Badge variant="outline" className="text-xs font-normal gap-1">
              {catConfig?.icon ?? '📁'} {catConfig?.label ?? thesis.category}
            </Badge>
            <ThesisStatusBadge status={thesis.status} />
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarDays className="h-3 w-3" />
              <span suppressHydrationWarning>
                {format(new Date(thesis.createdAt), 'yyyy/MM/dd', { locale: zhCN })}
              </span>
            </span>
          </div>
          {thesis.description && (
            <p className="text-sm text-muted-foreground leading-relaxed pt-1">
              {thesis.description}
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-5 flex-shrink-0 pt-1">
          <div className="flex flex-col items-center min-w-[60px]">
            <p className="text-xs text-muted-foreground mb-1">快照</p>
            <div className="inline-flex items-center gap-1.5 text-2xl tracking-wide">
              <MessageSquareText className="h-4 w-4 text-muted-foreground" />
              {snapshotCount}
            </div>
          </div>

          <Separator orientation="vertical" className="h-10" />

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center min-w-[60px] cursor-default">
                  <p className="text-xs text-muted-foreground mb-1">正确率</p>
                  {accuracyRate !== null ? (
                    <div className={cn(
                      'inline-flex items-center gap-1.5 text-2xl tracking-wide',
                      accuracyRate >= 60 ? 'text-emerald-500' : accuracyRate >= 40 ? 'text-amber-500' : 'text-rose-500'
                    )}>
                      <Target className="h-4 w-4" />
                      {accuracyRate}%
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 text-2xl tracking-wide text-muted-foreground/40">
                      <Target className="h-4 w-4" />
                      —
                    </div>
                  )}
                </div>
              </TooltipTrigger>
              {reviewedSnapshots.length > 0 && (
                <TooltipContent side="bottom">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="flex items-center gap-1"><CircleCheck className="h-3 w-3 text-emerald-400" />正确 {correctCount}</span>
                    <span className="flex items-center gap-1"><CircleX className="h-3 w-3 text-rose-400" />错误 {wrongCount}</span>
                    <span className="flex items-center gap-1"><CircleMinus className="h-3 w-3 text-amber-400" />中立 {neutralCount}</span>
                  </div>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <Separator className="mb-6" />

      {/* ── Snapshot section ── */}
      <div className="mb-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-lg font-semibold">看法快照</h2>
            <p className="text-xs text-muted-foreground">
              在特定时间点记录你的判断，到期自动提醒回顾
            </p>
          </div>

          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => setDrawerState({ mode: 'create' })}
          >
            <Camera className="h-3.5 w-3.5" />
            添加快照
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_160px_140px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索快照内容、AI 分析、标签、来源…"
              className="pl-9"
              name="snapshot-search"
              autoComplete="off"
              aria-label="搜索快照"
            />
          </div>

          <Select value={reviewFilter} onValueChange={(value) => setReviewFilter(value as 'all' | 'pending' | 'reviewed' | 'overdue')}>
            <SelectTrigger className="w-full" aria-label="按快照回顾状态筛选">
              <SelectValue placeholder="回顾状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部回顾状态</SelectItem>
              <SelectItem value="pending">待回顾</SelectItem>
              <SelectItem value="reviewed">已复盘</SelectItem>
              <SelectItem value="overdue">逾期未回顾</SelectItem>
            </SelectContent>
          </Select>

          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger className="w-full" aria-label="按快照标签筛选">
              <SelectValue placeholder="标签" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部标签</SelectItem>
              {allTags.map((tag) => (
                <SelectItem key={tag.id} value={tag.id}>
                  {tag.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={timeFilter} onValueChange={(value) => setTimeFilter(value as 'all' | '7d' | '30d' | '90d')}>
            <SelectTrigger className="w-full" aria-label="按快照创建时间筛选">
              <SelectValue placeholder="时间范围" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部时间</SelectItem>
              <SelectItem value="7d">最近 7 天</SelectItem>
              <SelectItem value="30d">最近 30 天</SelectItem>
              <SelectItem value="90d">最近 90 天</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="pb-8">
        <SnapshotTimeline
          snapshots={filteredSnapshots}
          selectedId={effectiveDrawerState?.mode === 'view' ? effectiveDrawerState.snapshotId : null}
          emptyTitle={thesis.snapshots.length === 0 ? '暂无快照记录' : '没有符合筛选条件的快照'}
          emptyDescription={thesis.snapshots.length === 0 ? '点击上方按钮记录你的第一个看法快照' : '尝试调整搜索词、标签或时间范围'}
          onSelect={(snapshotId) => {
            setDismissedQueryKey(null);
            setDrawerState({ mode: 'view', snapshotId });
          }}
          onAddFollowUp={(snapshotId, comment, verdict) =>
            addFollowUp(thesis.id, snapshotId, { comment, verdict })
          }
          onDeleteFollowUp={(snapshotId) =>
            deleteFollowUp(thesis.id, snapshotId)
          }
        />
      </div>

      {/* ── Drawer (panel only, no overlay) ── */}
      {(drawerOpen || closing) && (
        <div
          className={cn(
            'fixed top-14 right-2 bottom-2 z-40 w-[480px] rounded-xl border-l md:border shadow-2xl bg-card/95 backdrop-blur-sm overflow-hidden duration-300',
            closing
              ? 'animate-out slide-out-to-right fill-mode-forwards'
              : 'animate-in slide-in-from-right',
          )}
        >
          <SnapshotDetailPanel
            key={drawerState?.mode === 'view' ? drawerState.snapshotId : '__create__'}
            snapshot={selectedSnapshot}
            thesisId={thesis.id}
            onClose={closeDrawer}
          />
        </div>
      )}

      {/* Delete thesis dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <TriangleAlert className="h-4 w-4 text-destructive" />
              </div>
              删除看法
            </DialogTitle>
            <DialogDescription>
              确认删除「{thesis.name}」？所有关联的快照也会被一并删除。此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              删除
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
