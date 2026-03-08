'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useThesisStore } from '@/lib/store';
import { getCategoryConfig } from '@/constants/assets';
import { SnapshotTimeline } from '@/components/modules/thesis-tracker/SnapshotTimeline';
import { SnapshotForm } from '@/components/modules/thesis-tracker/SnapshotForm';
import { TagSelector } from '@/components/modules/thesis-tracker/TagSelector';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
import { ArrowLeft, Camera, Trash2, Pencil, BrainCircuit } from 'lucide-react';
import { ConfirmPopover } from '@/components/modules/thesis-tracker/ConfirmPopover';
import type { ThesisTag } from '@/types/thesis';

export default function ThesisDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const thesis = useThesisStore((s) => s.theses.find((t) => t.id === id));
  const loading = useThesisStore((s) => s.loading);
  const fetchTheses = useThesisStore((s) => s.fetchTheses);
  const deleteThesis = useThesisStore((s) => s.deleteThesis);
  const updateThesis = useThesisStore((s) => s.updateThesis);
  const addFollowUp = useThesisStore((s) => s.addFollowUp);

  useEffect(() => {
    fetchTheses();
  }, [fetchTheses]);

  const [snapshotDialogOpen, setSnapshotDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTags, setEditTags] = useState<ThesisTag[]>([]);

  const openEditDialog = () => {
    if (!thesis) return;
    setEditName(thesis.name);
    setEditDescription(thesis.description);
    setEditTags(thesis.tags);
    setEditDialogOpen(true);
  };

  const handleEditSave = () => {
    if (!thesis || !editName.trim()) return;
    updateThesis(thesis.id, {
      name: editName.trim(),
      description: editDescription.trim(),
      tags: editTags,
    });
    setEditDialogOpen(false);
  };

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

  return (
    <div className="max-w-6xl mx-auto">
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

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={openEditDialog}
          >
            <Pencil className="h-3.5 w-3.5" />
            编辑
          </Button>
          <ConfirmPopover
            title="删除看法"
            description={`确认删除「${thesis.name}」？所有关联的快照也会被一并删除。`}
            confirmLabel="删除"
            onConfirm={handleDelete}
          >
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
              删除
            </Button>
          </ConfirmPopover>
        </div>
      </div>

      {/* 看法头部信息 */}
      <div className="space-y-4 mb-8">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-2xl flex-shrink-0 mt-0.5">
            {catConfig?.icon ?? '📁'}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">{thesis.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              {thesis.asset && (
                <Badge variant="secondary" className="text-xs font-mono font-normal gap-1">
                  {thesis.asset}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs font-normal gap-1">
                {catConfig?.icon ?? '📁'} {catConfig?.label ?? thesis.category}
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

        <SnapshotTimeline
          snapshots={thesis.snapshots}
          thesisId={thesis.id}
          onAddFollowUp={(snapshotId, comment, verdict) =>
            addFollowUp(thesis.id, snapshotId, { comment, verdict })
          }
        />
      </div>

      {/* 编辑看法 Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>编辑看法</DialogTitle>
            <DialogDescription>修改看法的名称、描述和标签。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">名称</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="看法名称"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc">描述</Label>
              <Textarea
                id="edit-desc"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="简要描述你的投资看法..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>标签</Label>
              <TagSelector selectedTags={editTags} onChange={setEditTags} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleEditSave} disabled={!editName.trim()}>
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
