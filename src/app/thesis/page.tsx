'use client';

import { useState } from 'react';
import { useThesisStore } from '@/lib/store';
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
import { Plus, BrainCircuit, Activity, Camera, Clock } from 'lucide-react';

export default function ThesisPage() {
  const theses = useThesisStore((s) => s.theses);
  const [dialogOpen, setDialogOpen] = useState(false);

  const pendingReviewCount = theses.reduce(
    (acc, t) =>
      acc + t.snapshots.filter((s) => new Date(s.expectedReviewDate) < new Date()).length,
    0
  );

  return (
    <div className="max-w-6xl mx-auto">
      {/* 页头 */}
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <BrainCircuit className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Thesis Tracker</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            记录投资逻辑，追踪认知偏差，实现"预测-执行-复盘"闭环
          </p>
        </div>
      </div>

      {/* 统计栏 */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="flex items-center gap-3 rounded-lg border px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500/10">
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">待回顾</p>
            <p className="text-lg font-semibold text-amber-500">{pendingReviewCount}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg border px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
            <Activity className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">活跃看法</p>
            <p className="text-lg font-semibold">{theses.length}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg border px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
            <Camera className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">总快照数</p>
            <p className="text-lg font-semibold">
              {theses.reduce((acc, t) => acc + t.snapshots.length, 0)}
            </p>
          </div>
        </div>
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
