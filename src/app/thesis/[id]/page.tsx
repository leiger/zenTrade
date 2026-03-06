'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useThesisStore } from '@/lib/store';
import { SnapshotTimeline } from '@/components/modules/thesis-tracker/SnapshotTimeline';
import { SnapshotForm } from '@/components/modules/thesis-tracker/SnapshotForm';
import { TagSelector } from '@/components/modules/thesis-tracker/TagSelector';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { ArrowLeft, Camera, Layers, Trash2, BrainCircuit } from 'lucide-react';

export default function ThesisDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const thesis = useThesisStore((s) => s.theses.find((t) => t.id === id));
  const deleteThesis = useThesisStore((s) => s.deleteThesis);

  const [snapshotDialogOpen, setSnapshotDialogOpen] = useState(false);

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

  const handleDelete = () => {
    if (window.confirm('确认删除这个看法？所有关联的快照也会被删除。')) {
      deleteThesis(thesis.id);
      router.push('/thesis');
    }
  };

  return (
    <div className="p-2 md:p-4 max-w-6xl mx-auto">
      {/* 返回 & 操作 */}
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/thesis')}
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          返回列表
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" />
          删除
        </Button>
      </div>

      {/* 看法头部信息 */}
      <div className="space-y-4 mb-8">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary flex-shrink-0 mt-0.5">
            <BrainCircuit className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">{thesis.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs font-normal gap-1">
                <Layers className="h-3 w-3" />
                {thesis.zone}
              </Badge>
              <span className="text-xs text-muted-foreground">
                创建于{' '}
                <span suppressHydrationWarning>
                  {format(new Date(thesis.createdAt), 'yyyy/MM/dd', { locale: zhCN })}
                </span>
              </span>
            </div>
          </div>
        </div>

        {thesis.description && (
          <p className="text-sm text-muted-foreground leading-relaxed pl-[52px]">
            {thesis.description}
          </p>
        )}

        {/* 关联标签 */}
        {thesis.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pl-[52px]">
            {thesis.tags.map((tag) => (
              <Badge
                key={tag.id}
                variant="outline"
                className={cn(
                  'text-xs font-normal',
                  tag.category === 'buy'
                    ? 'border-emerald-500/30 text-emerald-400'
                    : 'border-rose-500/30 text-rose-400'
                )}
              >
                {tag.label}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <Separator className="mb-8" />

      {/* 快照区 */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-lg font-semibold">看法快照</h2>
            <p className="text-xs text-muted-foreground">
              在特定时间点记录你的判断，到期自动提醒回顾
            </p>
          </div>

          <Dialog open={snapshotDialogOpen} onOpenChange={setSnapshotDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Camera className="h-3.5 w-3.5" />
                添加快照
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[520px]">
              <DialogHeader>
                <DialogTitle>记录看法快照</DialogTitle>
                <DialogDescription>
                  记录你当前对「{thesis.name}」的判断和逻辑，并设定回顾时间。
                </DialogDescription>
              </DialogHeader>
              <SnapshotForm thesisId={thesis.id} onSuccess={() => setSnapshotDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>

        <SnapshotTimeline snapshots={thesis.snapshots} />
      </div>
    </div>
  );
}
