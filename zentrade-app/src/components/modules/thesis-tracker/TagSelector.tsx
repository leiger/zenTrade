'use client';

import { useState, useEffect } from 'react';
import { ThesisTag, TagCategory } from '@/types/thesis';
import * as api from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Plus, X } from 'lucide-react';

interface TagSelectorProps {
  selectedTags: ThesisTag[];
  onChange: (tags: ThesisTag[]) => void;
}

export function TagSelector({ selectedTags, onChange }: TagSelectorProps) {
  const [allTags, setAllTags] = useState<ThesisTag[]>([]);
  const [adding, setAdding] = useState<TagCategory | null>(null);
  const [newLabel, setNewLabel] = useState('');

  useEffect(() => {
    api.fetchTags().then(setAllTags).catch(console.error);
  }, []);

  const buyTags = allTags.filter((t) => t.category === 'buy');
  const sellTags = allTags.filter((t) => t.category === 'sell');

  const isSelected = (tag: ThesisTag) => selectedTags.some((t) => t.id === tag.id);

  const toggleTag = (tag: ThesisTag) => {
    if (isSelected(tag)) {
      onChange(selectedTags.filter((t) => t.id !== tag.id));
    } else {
      onChange([...selectedTags, tag]);
    }
  };

  const handleAddTag = async (category: TagCategory) => {
    const label = newLabel.trim();
    if (!label) return;
    try {
      const tag = await api.createTag({ label, category });
      setAllTags((prev) => [...prev, tag]);
      onChange([...selectedTags, tag]);
      setNewLabel('');
      setAdding(null);
    } catch (e) {
      console.error('Failed to create tag:', e);
    }
  };

  const handleDeleteTag = async (tag: ThesisTag) => {
    try {
      await api.deleteTag(tag.id);
      setAllTags((prev) => prev.filter((t) => t.id !== tag.id));
      onChange(selectedTags.filter((t) => t.id !== tag.id));
    } catch (e) {
      console.error('Failed to delete tag:', e);
    }
  };

  const renderTagGroup = (tags: ThesisTag[], category: TagCategory, label: string, color: string) => (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <div className={cn('h-1 w-1 rounded-full', color === 'emerald' ? 'bg-emerald-500' : 'bg-rose-500')} />
        <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wider">{label}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <Badge
            key={tag.id}
            variant={isSelected(tag) ? 'default' : 'outline'}
            className={cn(
              'cursor-pointer select-none transition-all duration-200 px-3 py-1 font-normal group/tag gap-1',
              isSelected(tag)
                ? color === 'emerald'
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700 border-transparent shadow-sm'
                  : 'bg-rose-600 text-white hover:bg-rose-700 border-transparent shadow-sm'
                : color === 'emerald'
                  ? 'bg-background hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 text-muted-foreground'
                  : 'bg-background hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-muted-foreground'
            )}
            onClick={() => toggleTag(tag)}
          >
            {tag.label}
            <button
              type="button"
              className={cn(
                'ml-0.5 rounded-full p-0 opacity-0 group-hover/tag:opacity-100 transition-opacity hover:bg-black/10',
                isSelected(tag) ? 'hover:bg-white/20' : ''
              )}
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteTag(tag);
              }}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}

        {adding === category ? (
          <div className="flex items-center gap-1">
            <Input
              autoFocus
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag(category);
                }
                if (e.key === 'Escape') setAdding(null);
              }}
              placeholder="输入标签名…"
              className="h-7 w-28 text-xs"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => handleAddTag(category)}
              disabled={!newLabel.trim()}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => { setAdding(null); setNewLabel(''); }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <Badge
            variant="outline"
            className="cursor-pointer select-none px-2 py-1 font-normal text-muted-foreground/50 hover:text-muted-foreground border-dashed hover:border-solid transition-colors"
            onClick={() => setAdding(category)}
          >
            <Plus className="h-3 w-3" />
          </Badge>
        )}
      </div>
    </div>
  );

  return (
    <div className="rounded-xl border bg-muted/30 p-4 space-y-5">
      {renderTagGroup(buyTags, 'buy', '买入理由', 'emerald')}
      <Separator className="bg-border/50" />
      {renderTagGroup(sellTags, 'sell', '卖出理由', 'rose')}
    </div>
  );
}
