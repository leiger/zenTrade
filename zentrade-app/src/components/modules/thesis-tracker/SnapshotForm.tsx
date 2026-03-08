'use client';

import { useState } from 'react';
import { ThesisTag, TimelineOption } from '@/types/thesis';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { TagSelector } from './TagSelector';
import { TimelineSelector } from './TimelineSelector';
import { useThesisStore, getReviewDate } from '@/lib/store';
import {
  Camera,
  Link2,
  Plus,
  UserRound,
  X,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  PenLine,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SnapshotFormProps {
  thesisId: string;
  onSuccess?: () => void;
}

export function SnapshotForm({ thesisId, onSuccess }: SnapshotFormProps) {
  const addSnapshot = useThesisStore((s) => s.addSnapshot);
  const [step, setStep] = useState(1);

  const [content, setContent] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [tags, setTags] = useState<ThesisTag[]>([]);
  const [timeline, setTimeline] = useState<TimelineOption>('1W');
  const [customDate, setCustomDate] = useState('');

  const [links, setLinks] = useState<string[]>([]);
  const [linkInput, setLinkInput] = useState('');
  const [influencedBy, setInfluencedBy] = useState<string[]>([]);
  const [influencedByInput, setInfluencedByInput] = useState('');

  const step1Valid = content.trim().length > 0;
  const step2Valid = timeline !== 'custom' || !!customDate;

  const handleAddLink = () => {
    const url = linkInput.trim();
    if (!url) return;
    setLinks((prev) => [...prev, url]);
    setLinkInput('');
  };

  const handleRemoveLink = (index: number) => {
    setLinks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddInfluencedBy = () => {
    const val = influencedByInput.trim();
    if (!val) return;
    setInfluencedBy((prev) => [...prev, val]);
    setInfluencedByInput('');
  };

  const handleRemoveInfluencedBy = (index: number) => {
    setInfluencedBy((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!step1Valid || !step2Valid) return;

    const reviewDate =
      timeline === 'custom' ? new Date(customDate) : getReviewDate(timeline);

    addSnapshot(thesisId, {
      content: content.trim(),
      aiAnalysis: aiAnalysis.trim(),
      tags,
      timeline,
      expectedReviewDate: reviewDate.toISOString(),
      links,
      influencedBy,
    });

    setContent('');
    setAiAnalysis('');
    setTags([]);
    setTimeline('1W');
    setCustomDate('');
    setLinks([]);
    setLinkInput('');
    setInfluencedBy([]);
    setInfluencedByInput('');
    setStep(1);
    onSuccess?.();
  };

  return (
    <div className="space-y-4">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[1, 2].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => s === 1 || step1Valid ? setStep(s) : undefined}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors',
              step === s
                ? 'bg-primary text-primary-foreground'
                : s < step
                  ? 'bg-primary/10 text-primary cursor-pointer'
                  : 'bg-muted text-muted-foreground'
            )}
          >
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">
              {s}
            </span>
            {s === 1 ? '记录看法' : '补充 & 回顾'}
          </button>
        ))}
      </div>

      {/* Step 1: Core content */}
      {step === 1 && (
        <div className="space-y-4">
          {/* User analysis */}
          <div className="space-y-1.5">
            <Label htmlFor="snapshot-content" className="flex items-center gap-1.5">
              <PenLine className="h-3.5 w-3.5" />
              你的看法 *
            </Label>
            <Textarea
              id="snapshot-content"
              placeholder="记录你当前对这个资产的判断和逻辑..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              className="bg-background resize-none"
            />
          </div>

          {/* AI analysis */}
          <div className="space-y-1.5">
            <Label htmlFor="ai-analysis" className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-violet-500" />
              <span>AI 看法</span>
              <span className="text-muted-foreground font-normal">（选填）</span>
            </Label>
            <Textarea
              id="ai-analysis"
              placeholder="粘贴或输入 AI 对该资产的分析观点..."
              value={aiAnalysis}
              onChange={(e) => setAiAnalysis(e.target.value)}
              rows={3}
              className="bg-violet-500/5 border-violet-500/20 resize-none focus-visible:ring-violet-500/30"
            />
          </div>

          <Button
            type="button"
            className="w-full gap-2"
            onClick={() => setStep(2)}
            disabled={!step1Valid}
          >
            下一步
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Step 2: Details & timeline */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Timeline */}
          <div className="space-y-1.5">
            <Label>回顾时间</Label>
            <TimelineSelector
              value={timeline}
              onChange={setTimeline}
              customDate={customDate}
              onCustomDateChange={setCustomDate}
            />
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label>关联标签</Label>
            <TagSelector selectedTags={tags} onChange={setTags} />
          </div>

          {/* Compact row: influenced by + links */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="influenced-by" className="flex items-center gap-1 text-xs">
                <UserRound className="h-3 w-3" />
                受谁影响
              </Label>
              <div className="flex items-center gap-1">
                <Input
                  id="influenced-by"
                  placeholder="PlanB, 某研报…"
                  value={influencedByInput}
                  onChange={(e) => setInfluencedByInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddInfluencedBy();
                    }
                  }}
                  className="h-8 text-xs bg-background"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={handleAddInfluencedBy}
                  disabled={!influencedByInput.trim()}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1 text-xs">
                <Link2 className="h-3 w-3" />
                相关链接
              </Label>
              <div className="flex items-center gap-1">
                <Input
                  placeholder="粘贴链接…"
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddLink();
                    }
                  }}
                  className="h-8 text-xs bg-background"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={handleAddLink}
                  disabled={!linkInput.trim()}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {influencedBy.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {influencedBy.map((val, i) => (
                <Badge
                  key={`inf-${i}`}
                  variant="secondary"
                  className="font-normal text-xs gap-1 max-w-[200px]"
                >
                  <UserRound className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">{val}</span>
                  <button
                    type="button"
                    className="ml-0.5 rounded-full hover:bg-black/10 p-0"
                    onClick={() => handleRemoveInfluencedBy(i)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {links.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {links.map((link, i) => (
                <Badge
                  key={i}
                  variant="secondary"
                  className="font-normal text-xs gap-1 max-w-[200px]"
                >
                  <Link2 className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">{link}</span>
                  <button
                    type="button"
                    className="ml-0.5 rounded-full hover:bg-black/10 p-0"
                    onClick={() => handleRemoveLink(i)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-1.5"
              onClick={() => setStep(1)}
            >
              <ArrowLeft className="h-4 w-4" />
              上一步
            </Button>
            <Button
              type="button"
              className="flex-1 gap-2"
              onClick={handleSubmit}
              disabled={!step2Valid}
            >
              <Camera className="h-4 w-4" />
              记录快照
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
