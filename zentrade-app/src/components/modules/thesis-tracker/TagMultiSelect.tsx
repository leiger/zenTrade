'use client';

import { useState, useEffect } from 'react';
import { ThesisTag, TagCategory } from '@/types/thesis';
import * as api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown, Plus, Tag, X } from 'lucide-react';

interface TagMultiSelectProps {
  selectedTags: ThesisTag[];
  onChange: (tags: ThesisTag[]) => void;
}

export function TagMultiSelect({ selectedTags, onChange }: TagMultiSelectProps) {
  const [open, setOpen] = useState(false);
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

  const renderGroup = (tags: ThesisTag[], category: TagCategory, label: string, dotColor: string) => (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <div className={cn('h-1.5 w-1.5 rounded-full', dotColor)} />
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            {label}
          </span>
        </div>
        <button
          type="button"
          className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          onClick={() => setAdding(adding === category ? null : category)}
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
      {adding === category && (
        <div className="flex items-center gap-1 px-1">
          <Input
            autoFocus
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); handleAddTag(category); }
              if (e.key === 'Escape') setAdding(null);
            }}
            placeholder="新标签名…"
            className="h-6 text-xs flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => handleAddTag(category)}
            disabled={!newLabel.trim()}
          >
            <Check className="h-3 w-3" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => { setAdding(null); setNewLabel(''); }}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
      <div className="space-y-0.5">
        {tags.map((tag) => {
          const selected = isSelected(tag);
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggleTag(tag)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
                selected
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50 text-foreground/80'
              )}
            >
              <div
                className={cn(
                  'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border',
                  selected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/30'
                )}
              >
                {selected && <Check className="h-2.5 w-2.5" />}
              </div>
              <span className="truncate">{tag.label}</span>
            </button>
          );
        })}
        {tags.length === 0 && !adding && (
          <p className="px-2 py-1 text-[10px] text-muted-foreground/50">暂无标签</p>
        )}
      </div>
    </div>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-7 gap-1.5 text-xs font-normal justify-between min-w-[100px]',
            selectedTags.length === 0 && 'text-muted-foreground'
          )}
        >
          <div className="flex items-center gap-1.5 truncate">
            <Tag className="h-3 w-3 shrink-0" />
            {selectedTags.length > 0
              ? `${selectedTags.length} 个标签`
              : '选择标签'}
          </div>
          <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2 space-y-2">
        {renderGroup(buyTags, 'buy', '买入理由', 'bg-emerald-500')}
        <div className="h-px bg-border" />
        {renderGroup(sellTags, 'sell', '卖出理由', 'bg-rose-500')}

        {selectedTags.length > 0 && (
          <>
            <div className="h-px bg-border" />
            <button
              type="button"
              onClick={() => onChange([])}
              className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent/50 transition-colors"
            >
              <X className="h-3 w-3" />
              清除全部
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
