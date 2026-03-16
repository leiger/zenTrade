'use client';

import { useState, useEffect } from 'react';
import { useThesisStore } from '@/lib/store';
import { getReminderSummary } from '@/lib/thesis-tracker';
import { ThesisTable } from '@/components/modules/thesis-tracker/ThesisTable';
import { ThesisForm } from '@/components/modules/thesis-tracker/ThesisForm';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Link from 'next/link';
import { Plus, BrainCircuit, Activity, Camera, Clock, Inbox } from 'lucide-react';
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function ThesisPage() {
  const theses = useThesisStore((s) => s.theses);
  const loading = useThesisStore((s) => s.loading);
  const fetchTheses = useThesisStore((s) => s.fetchTheses);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchTheses();
  }, [fetchTheses]);

  const pendingReviewCount = getReminderSummary(theses).pending.length;

  if (loading && theses.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div>
      {/* 页头 */}
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <BrainCircuit className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Thesis Tracker</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            记录投资逻辑，追踪认知偏差，实现“预测-执行-复盘”闭环
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link href="/review">
            <Inbox className="h-3.5 w-3.5" />
            Review Inbox
          </Link>
        </Button>
      </div>

      {/* 统计栏 */}
      <div className="*:data-[slot=card]:shadow-xs grid grid-cols-1 gap-3 mb-6 sm:grid-cols-3 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card">
        <Card className="py-3 gap-2">
          <CardHeader className="px-4 gap-1">
            <CardDescription className="text-xs">待回顾</CardDescription>
            <CardTitle className="text-xl font-semibold tabular-nums text-amber-500">
              {pendingReviewCount}
            </CardTitle>
          </CardHeader>
          <CardFooter className="px-4 text-xs text-muted-foreground">
            <Clock className="size-3.5" />
            需要及时复盘处理
          </CardFooter>
        </Card>

        <Card className="py-3 gap-2">
          <CardHeader className="px-4 gap-1">
            <CardDescription className="text-xs">活跃看法</CardDescription>
            <CardTitle className="text-xl font-semibold tabular-nums">
              {theses.length}
            </CardTitle>
          </CardHeader>
          <CardFooter className="px-4 text-xs text-muted-foreground">
            <Activity className="size-3.5" />
            当前追踪中的投资看法
          </CardFooter>
        </Card>

        <Card className="py-3 gap-2">
          <CardHeader className="px-4 gap-1">
            <CardDescription className="text-xs">总快照数</CardDescription>
            <CardTitle className="text-xl font-semibold tabular-nums">
              {theses.reduce((acc, t) => acc + t.snapshots.length, 0)}
            </CardTitle>
          </CardHeader>
          <CardFooter className="px-4 text-xs text-muted-foreground">
            <Camera className="size-3.5" />
            累计记录的认知快照
          </CardFooter>
        </Card>
      </div>

      {/* 看法列表 */}
      {theses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="rounded-full bg-muted p-6 mb-4">
            <BrainCircuit className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-1">还没有看法记录</h3>
          <p className="text-sm text-muted-foreground mb-4">
            创建你的第一个投资看法，开始追踪你的认知和决策逻辑
          </p>
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            创建第一个看法
          </Button>
        </div>
      ) : (
        <ThesisTable onCreateClick={() => setDialogOpen(true)} />
      )}

      {/* 新建看法按钮 — 固定在列表工具栏末尾 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>创建新看法</DialogTitle>
            <DialogDescription>选择投资大类和具体资产，开始追踪你的看法。</DialogDescription>
          </DialogHeader>
          <ThesisForm onSuccess={() => setDialogOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
