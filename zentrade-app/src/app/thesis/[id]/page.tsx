'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useThesisStore } from '@/lib/store';
import { getCategoryConfig, getAssetName } from '@/constants/assets';
import { SnapshotTimeline } from '@/components/modules/thesis-tracker/SnapshotTimeline';
import { SnapshotDetailPanel } from '@/components/modules/thesis-tracker/SnapshotDetailPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type DrawerState =
  | null
  | { mode: 'create' }
  | { mode: 'view'; snapshotId: string };

export default function ThesisDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const thesis = useThesisStore((s) => s.theses.find((t) => t.id === id));
  const loading = useThesisStore((s) => s.loading);
  const fetchTheses = useThesisStore((s) => s.fetchTheses);
  const deleteThesis = useThesisStore((s) => s.deleteThesis);
  const addFollowUp = useThesisStore((s) => s.addFollowUp);

  useEffect(() => {
    fetchTheses();
  }, [fetchTheses]);

  const [drawerState, setDrawerState] = useState<DrawerState>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  if (loading) {
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

  const catConfig = getCategoryConfig(thesis.category);

  const handleDelete = () => {
    deleteThesis(thesis.id);
    router.push('/thesis');
  };

  const assetDisplayName = thesis.asset
    ? getAssetName(thesis.category, thesis.asset)
    : null;

  const snapshotCount = thesis.snapshots.length;
  const reviewedSnapshots = thesis.snapshots.filter((s) => s.followUp);
  const correctCount = reviewedSnapshots.filter((s) => s.followUp!.verdict === 'correct').length;
  const wrongCount = reviewedSnapshots.filter((s) => s.followUp!.verdict === 'wrong').length;
  const neutralCount = reviewedSnapshots.filter((s) => s.followUp!.verdict === 'neutral').length;
  const accuracyRate = reviewedSnapshots.length > 0
    ? Math.round((correctCount / reviewedSnapshots.length) * 100)
    : null;

  const drawerOpen = drawerState !== null;
  const selectedSnapshot =
    drawerState?.mode === 'view'
      ? thesis.snapshots.find((s) => s.id === drawerState.snapshotId)
      : undefined;

  const closeDrawer = () => setDrawerState(null);

  return (
    <div className="max-w-6xl mx-auto">
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
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
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
            <div className="inline-flex items-center gap-1.5 text-xl font-semibold">
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
                      'inline-flex items-center gap-1.5 text-xl font-semibold',
                      accuracyRate >= 60 ? 'text-emerald-500' : accuracyRate >= 40 ? 'text-amber-500' : 'text-rose-500'
                    )}>
                      <Target className="h-4 w-4" />
                      {accuracyRate}%
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 text-xl font-semibold text-muted-foreground/40">
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
      <div className="flex items-center justify-between mb-4">
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

      <div className="pb-8">
        <SnapshotTimeline
          snapshots={thesis.snapshots}
          selectedId={drawerState?.mode === 'view' ? drawerState.snapshotId : null}
          onSelect={(snapshotId) => setDrawerState({ mode: 'view', snapshotId })}
          onAddFollowUp={(snapshotId, comment, verdict) =>
            addFollowUp(thesis.id, snapshotId, { comment, verdict })
          }
        />
      </div>

      {/* ── Drawer (overlay + panel) ── */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 animate-in fade-in-0 duration-200"
            onClick={closeDrawer}
          />
          <div className="fixed top-14 right-4 sm:right-6 md:right-8 bottom-2 z-40 w-[480px] rounded-xl border shadow-2xl bg-card animate-in slide-in-from-right duration-300 overflow-hidden">
            <SnapshotDetailPanel
              key={drawerState.mode === 'view' ? drawerState.snapshotId : '__create__'}
              snapshot={selectedSnapshot}
              thesisId={thesis.id}
              onClose={closeDrawer}
            />
          </div>
        </>
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
