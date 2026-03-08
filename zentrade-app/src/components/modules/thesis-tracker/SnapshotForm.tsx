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
import { Camera, Link2, Plus, UserRound, X } from 'lucide-react';

interface SnapshotFormProps {
  thesisId: string;
  onSuccess?: () => void;
}

export function SnapshotForm({ thesisId, onSuccess }: SnapshotFormProps) {
  const addSnapshot = useThesisStore((s) => s.addSnapshot);
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<ThesisTag[]>([]);
  const [timeline, setTimeline] = useState<TimelineOption>('1W');

  // New fields
  const [links, setLinks] = useState<string[]>([]);
  const [linkInput, setLinkInput] = useState('');
  const [influencedBy, setInfluencedBy] = useState('');

  const isValid = content.trim().length > 0;

  const handleAddLink = () => {
    const url = linkInput.trim();
    if (!url) return;
    setLinks((prev) => [...prev, url]);
    setLinkInput('');
  };

  const handleRemoveLink = (index: number) => {
    setLinks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    const reviewDate = getReviewDate(timeline);

    addSnapshot(thesisId, {
      content: content.trim(),
      tags,
      timeline,
      expectedReviewDate: reviewDate.toISOString(),
      links,
      influencedBy: influencedBy.trim(),
    });

    setContent('');
    setTags([]);
    setTimeline('1W');
    setLinks([]);
    setLinkInput('');
    setInfluencedBy('');
    onSuccess?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="snapshot-content">看法记录 *</Label>
        <Textarea
          id="snapshot-content"
          placeholder="记录你当前对这个资产的判断和逻辑..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          className="bg-background resize-none"
        />
      </div>

      {/* 相关链接 */}
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5">
          <Link2 className="h-3.5 w-3.5" />
          相关链接
        </Label>
        {links.length > 0 && (
          <div className="space-y-1">
            {links.map((link, i) => (
              <div key={i} className="flex items-center gap-1.5 group">
                <Badge
                  variant="secondary"
                  className="flex-1 font-normal text-xs justify-start truncate py-1"
                >
                  <Link2 className="h-3 w-3 mr-1 shrink-0" />
                  <span className="truncate">{link}</span>
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleRemoveLink(i)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Input
            placeholder="粘贴链接地址…"
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

      {/* 受谁影响 */}
      <div className="space-y-1.5">
        <Label htmlFor="influenced-by" className="flex items-center gap-1.5">
          <UserRound className="h-3.5 w-3.5" />
          受谁影响
        </Label>
        <Input
          id="influenced-by"
          placeholder="例如: PlanB, Arthur Hayes, 某研报…"
          value={influencedBy}
          onChange={(e) => setInfluencedBy(e.target.value)}
          className="h-8 text-xs bg-background"
        />
      </div>

      <div className="space-y-1.5">
        <Label>关联标签</Label>
        <TagSelector selectedTags={tags} onChange={setTags} />
      </div>

      <div className="space-y-1.5">
        <Label>回顾时间轴</Label>
        <TimelineSelector value={timeline} onChange={setTimeline} />
      </div>

      <Button type="submit" disabled={!isValid} className="w-full gap-2">
        <Camera className="h-4 w-4" />
        记录快照
      </Button>
    </form>
  );
}
