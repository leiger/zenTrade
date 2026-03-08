'use client';

import { useState } from 'react';
import { Snapshot, Verdict, ThesisTag, TimelineOption } from '@/types/thesis';
import { useThesisStore, getReviewDate } from '@/lib/store';
import { TagMultiSelect } from './TagMultiSelect';
import { DatePicker } from '@/components/ui/date-picker';
import { TIMELINE_PRESETS } from '@/constants/tags';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { format, isPast, addDays } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  X,
  Pencil,
  Trash2,
  Save,
  Camera,
  CalendarClock,
  Clock,
  Link2,
  UserRound,
  ExternalLink,
  Sparkles,
  PenLine,
  Tag,
  Plus,
  TriangleAlert,
  RefreshCw,
} from 'lucide-react';

interface FormState {
  content: string;
  aiAnalysis: string;
  tags: ThesisTag[];
  timeline: TimelineOption;
  reviewDate: Date;
  links: string[];
  linkInput: string;
  influencedBy: string[];
  influencedByInput: string;
}

function emptyForm(): FormState {
  return {
    content: '',
    aiAnalysis: '',
    tags: [],
    timeline: '1W',
    reviewDate: getReviewDate('1W'),
    links: [],
    linkInput: '',
    influencedBy: [],
    influencedByInput: '',
  };
}

function formFromSnapshot(snapshot: Snapshot): FormState {
  return {
    content: snapshot.content,
    aiAnalysis: snapshot.aiAnalysis,
    tags: snapshot.tags,
    timeline: snapshot.timeline,
    reviewDate: new Date(snapshot.expectedReviewDate),
    links: [...snapshot.links],
    linkInput: '',
    influencedBy: Array.isArray(snapshot.influencedBy) ? [...snapshot.influencedBy] : [],
    influencedByInput: '',
  };
}

interface SnapshotDetailPanelProps {
  snapshot?: Snapshot;
  thesisId: string;
  onClose: () => void;
}

export function SnapshotDetailPanel({
  snapshot,
  thesisId,
  onClose,
}: SnapshotDetailPanelProps) {
  const addSnapshot = useThesisStore((s) => s.addSnapshot);
  const updateSnapshot = useThesisStore((s) => s.updateSnapshot);
  const deleteSnapshot = useThesisStore((s) => s.deleteSnapshot);

  const isCreateMode = !snapshot;
  const [isEditing, setIsEditing] = useState(isCreateMode);
  const [form, setForm] = useState<FormState>(
    isCreateMode ? emptyForm() : formFromSnapshot(snapshot)
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const reviewDate = snapshot ? new Date(snapshot.expectedReviewDate) : form.reviewDate;
  const isOverdue = snapshot ? isPast(reviewDate) : false;
  const hasFollowUp = !!snapshot?.followUp;
  const wasUpdated = snapshot
    ? snapshot.updatedAt && snapshot.updatedAt !== snapshot.createdAt && snapshot.updatedAt > snapshot.createdAt
    : false;

  const startEdit = () => {
    if (!snapshot) return;
    setIsEditing(true);
    setForm(formFromSnapshot(snapshot));
  };

  const cancelEdit = () => {
    if (isCreateMode) {
      onClose();
      return;
    }
    setIsEditing(false);
    setForm(formFromSnapshot(snapshot!));
  };

  const handleSubmit = async () => {
    if (!form.content.trim()) return;

    if (isCreateMode) {
      await addSnapshot(thesisId, {
        content: form.content.trim(),
        aiAnalysis: form.aiAnalysis.trim(),
        tags: form.tags,
        timeline: form.timeline,
        expectedReviewDate: form.reviewDate.toISOString(),
        links: form.links,
        influencedBy: form.influencedBy,
      });
      onClose();
    } else {
      await updateSnapshot(thesisId, snapshot!.id, {
        content: form.content.trim(),
        aiAnalysis: form.aiAnalysis.trim(),
        tags: form.tags.map((t) => t.id),
        timeline: form.timeline,
        expectedReviewDate: form.reviewDate.toISOString(),
        links: form.links,
        influencedBy: form.influencedBy,
      });
      setIsEditing(false);
    }
  };

  const handleDelete = async () => {
    if (!snapshot) return;
    await deleteSnapshot(thesisId, snapshot.id);
    setDeleteDialogOpen(false);
    onClose();
  };

  const patch = (partial: Partial<FormState>) =>
    setForm((prev) => ({ ...prev, ...partial }));

  const addLink = () => {
    const url = form.linkInput.trim();
    if (!url) return;
    patch({ links: [...form.links, url], linkInput: '' });
  };

  const removeLink = (index: number) => {
    patch({ links: form.links.filter((_, i) => i !== index) });
  };

  const addInfluencedBy = () => {
    const val = form.influencedByInput.trim();
    if (!val) return;
    patch({ influencedBy: [...form.influencedBy, val], influencedByInput: '' });
  };

  const removeInfluencedBy = (index: number) => {
    patch({ influencedBy: form.influencedBy.filter((_, i) => i !== index) });
  };

  const selectPreset = (preset: TimelineOption) => {
    if (preset === 'custom') return;
    patch({ timeline: preset, reviewDate: getReviewDate(preset) });
  };

  const selectCustomDate = (date: Date | undefined) => {
    if (!date) return;
    patch({ timeline: 'custom', reviewDate: date });
  };

  return (
    <>
      <div className="h-full flex flex-col">
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
          <h3 className="text-sm font-semibold tracking-tight">
            {isCreateMode ? '添加快照' : '快照详情'}
          </h3>
          <div className="flex items-center gap-1">
            {!isCreateMode && !isEditing && (
              <>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={startEdit}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleteDialogOpen(true)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto">
          {/* Timestamps (view mode only) */}
          {!isCreateMode && (
            <div className="px-5 pt-3 pb-2 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1.5" suppressHydrationWarning>
                <Clock className="h-3.5 w-3.5" />
                {format(new Date(snapshot.createdAt), 'yyyy/MM/dd HH:mm', { locale: zhCN })}
              </span>
              {wasUpdated && (
                <span className="flex items-center gap-1 text-muted-foreground/60" suppressHydrationWarning>
                  <RefreshCw className="h-3 w-3" />
                  编辑于 {format(new Date(snapshot.updatedAt), 'MM/dd HH:mm', { locale: zhCN })}
                </span>
              )}
            </div>
          )}

          {/* ══ Section 1: 记录看法 ══ */}
          <div className="px-5 py-4 space-y-4">
            {/* User analysis */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <PenLine className="h-4 w-4" />
                我的看法 {isEditing && <span className="text-destructive normal-case">*</span>}
              </Label>
              {isEditing ? (
                <Textarea
                  value={form.content}
                  onChange={(e) => patch({ content: e.target.value })}
                  rows={4}
                  className="bg-background resize-none text-sm leading-relaxed"
                  placeholder="记录你当前对这个资产的判断和逻辑..."
                />
              ) : (
                <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{snapshot!.content}</p>
              )}
            </div>

            {/* AI analysis */}
            {(isEditing || snapshot?.aiAnalysis) && (
              <div className={cn('space-y-2', !isEditing && 'rounded-lg border border-violet-500/20 bg-violet-500/5 p-4')}>
                <Label className="flex items-center gap-2 text-xs font-semibold text-violet-500 uppercase tracking-wider">
                  <Sparkles className="h-4 w-4" />
                  AI 看法
                  {isEditing && <span className="text-muted-foreground font-normal normal-case tracking-normal">（选填）</span>}
                </Label>
                {isEditing ? (
                  <Textarea
                    value={form.aiAnalysis}
                    onChange={(e) => patch({ aiAnalysis: e.target.value })}
                    rows={3}
                    className="bg-violet-500/5 border-violet-500/20 resize-none text-sm leading-relaxed focus-visible:ring-violet-500/30"
                    placeholder="粘贴或输入 AI 对该资产的分析观点..."
                  />
                ) : (
                  <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">{snapshot!.aiAnalysis}</p>
                )}
              </div>
            )}
          </div>

          {/* ── Separator between two sections ── */}
          <Separator />

          {/* ══ Section 2: 补充信息 ══ */}
          <div className="px-5 py-4 space-y-4">
            {/* Review date */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <CalendarClock className="h-4 w-4" />
                回顾时间
              </Label>
              {isEditing ? (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {TIMELINE_PRESETS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => selectPreset(opt.value)}
                      className={cn(
                        'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                        form.timeline === opt.value
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border text-muted-foreground hover:bg-accent'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                  <DatePicker
                    date={form.reviewDate}
                    onDateChange={selectCustomDate}
                    placeholder="自定义"
                    disabled={(d) => d < addDays(new Date(), 1)}
                    className={cn(form.timeline === 'custom' && 'border-primary')}
                  />
                </div>
              ) : (
                <span
                  className={cn(
                    'flex items-center gap-1.5 text-sm',
                    isOverdue && !hasFollowUp ? 'text-amber-500 font-medium' : 'text-muted-foreground'
                  )}
                  suppressHydrationWarning
                >
                  {hasFollowUp ? '已回顾' : isOverdue ? '待回顾' : '回顾于'}{' '}
                  {format(reviewDate, 'yyyy年MM月dd日', { locale: zhCN })}
                </span>
              )}
            </div>

            {/* Influenced by */}
            {(isEditing || (snapshot?.influencedBy?.length ?? 0) > 0) && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <UserRound className="h-4 w-4" />
                  受谁影响
                </Label>
                {isEditing ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Input
                        value={form.influencedByInput}
                        onChange={(e) => patch({ influencedByInput: e.target.value })}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addInfluencedBy(); } }}
                        className="h-8 text-sm bg-background"
                        placeholder="PlanB, 某研报…回车添加"
                      />
                      <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={addInfluencedBy} disabled={!form.influencedByInput.trim()}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {form.influencedBy.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {form.influencedBy.map((val, i) => (
                          <Badge key={i} variant="secondary" className="font-normal text-xs gap-1.5 max-w-[240px] py-0.5">
                            <UserRound className="h-3 w-3 shrink-0" />
                            <span className="truncate">{val}</span>
                            <button type="button" className="ml-0.5 rounded-full hover:bg-black/10 p-0" onClick={() => removeInfluencedBy(i)}>
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {snapshot!.influencedBy.map((val, i) => (
                      <Badge key={i} variant="secondary" className="font-normal text-xs gap-1.5 py-0.5 text-foreground/80">
                        <UserRound className="h-3 w-3 shrink-0" />
                        <span className="truncate">{val}</span>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Links */}
            {(isEditing || (snapshot?.links.length ?? 0) > 0) && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <Link2 className="h-4 w-4" />
                  相关链接
                </Label>
                {isEditing ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Input
                        value={form.linkInput}
                        onChange={(e) => patch({ linkInput: e.target.value })}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }}
                        className="h-8 text-sm bg-background"
                        placeholder="粘贴链接后回车…"
                      />
                      <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={addLink} disabled={!form.linkInput.trim()}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {form.links.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {form.links.map((link, i) => (
                          <Badge key={i} variant="secondary" className="font-normal text-xs gap-1.5 max-w-[240px] py-0.5">
                            <Link2 className="h-3 w-3 shrink-0" />
                            <span className="truncate">{link.replace(/^https?:\/\//, '').split('/')[0]}</span>
                            <button type="button" className="ml-0.5 rounded-full hover:bg-black/10 p-0" onClick={() => removeLink(i)}>
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {snapshot!.links.map((link, i) => (
                      <a
                        key={i}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-sm text-primary/70 hover:text-primary transition-colors group/link"
                      >
                        <span className="truncate underline underline-offset-2 decoration-primary/30 group-hover/link:decoration-primary">
                          {link.replace(/^https?:\/\//, '').split('/')[0]}
                        </span>
                        <ExternalLink className="h-3 w-3 shrink-0 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tags */}
            {(isEditing || (snapshot?.tags.length ?? 0) > 0) && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <Tag className="h-4 w-4" />
                  关联标签
                </Label>
                {isEditing ? (
                  <TagMultiSelect selectedTags={form.tags} onChange={(tags) => patch({ tags })} />
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    {snapshot!.tags.map((tag) => (
                      <Badge
                        key={tag.id}
                        variant="outline"
                        className={cn(
                          'text-xs px-2 py-0.5 font-normal',
                          tag.category === 'buy'
                            ? 'text-emerald-600 border-emerald-500/30 bg-emerald-500/5'
                            : 'text-rose-600 border-rose-500/30 bg-rose-500/5'
                        )}
                      >
                        {tag.label}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Sticky bottom actions ── */}
        {isEditing && (
          <div className="flex justify-end gap-2 px-5 py-3 border-t border-border bg-card shrink-0">
            <Button variant="ghost" size="sm" className="h-8 text-sm" onClick={cancelEdit}>
              取消
            </Button>
            <Button size="sm" className="h-8 text-sm gap-1.5" onClick={handleSubmit} disabled={!form.content.trim()}>
              {isCreateMode ? (
                <><Camera className="h-3.5 w-3.5" />记录快照</>
              ) : (
                <><Save className="h-3.5 w-3.5" />保存</>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Delete dialog */}
      {!isCreateMode && (
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                  <TriangleAlert className="h-4 w-4 text-destructive" />
                </div>
                删除快照
              </DialogTitle>
              <DialogDescription>
                确认删除这条快照记录？
                <span className="block mt-1 text-foreground/60 line-clamp-2">「{snapshot!.content}」</span>
                此操作不可撤销。
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setDeleteDialogOpen(false)}>取消</Button>
              <Button variant="destructive" size="sm" onClick={handleDelete}>删除</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
