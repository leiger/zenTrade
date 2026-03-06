'use client';

import { ThesisTag } from '@/types/thesis';
import { BUY_TAGS, SELL_TAGS } from '@/constants/tags';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface TagSelectorProps {
  selectedTags: ThesisTag[];
  onChange: (tags: ThesisTag[]) => void;
  /** 只显示某个类别的标签 */
  filterCategory?: 'buy' | 'sell';
}

export function TagSelector({ selectedTags, onChange, filterCategory }: TagSelectorProps) {
  const buyTags = filterCategory === 'sell' ? [] : BUY_TAGS;
  const sellTags = filterCategory === 'buy' ? [] : SELL_TAGS;

  const isSelected = (tag: ThesisTag) => selectedTags.some((t) => t.id === tag.id);

  const toggleTag = (tag: ThesisTag) => {
    if (isSelected(tag)) {
      onChange(selectedTags.filter((t) => t.id !== tag.id));
    } else {
      onChange([...selectedTags, tag]);
    }
  };

  return (
    <div className="rounded-xl border bg-muted/30 p-4 space-y-6">
      {buyTags.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-1 w-1 rounded-full bg-emerald-500" />
            <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wider">
              买入理由
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {buyTags.map((tag) => (
              <Badge
                key={tag.id}
                variant={isSelected(tag) ? 'default' : 'outline'}
                className={cn(
                  'cursor-pointer select-none transition-all duration-200 px-3 py-1 font-normal',
                  isSelected(tag)
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 border-transparent shadow-sm'
                    : 'bg-background hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 text-muted-foreground'
                )}
                onClick={() => toggleTag(tag)}
              >
                {tag.label}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {buyTags.length > 0 && sellTags.length > 0 && (
        <Separator className="bg-border/50" />
      )}

      {sellTags.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-1 w-1 rounded-full bg-rose-500" />
            <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wider">
              卖出理由
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {sellTags.map((tag) => (
              <Badge
                key={tag.id}
                variant={isSelected(tag) ? 'destructive' : 'outline'}
                className={cn(
                  'cursor-pointer select-none transition-all duration-200 px-3 py-1 font-normal',
                  isSelected(tag)
                    ? 'bg-rose-600 text-white hover:bg-rose-700 border-transparent shadow-sm'
                    : 'bg-background hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-muted-foreground'
                )}
                onClick={() => toggleTag(tag)}
              >
                {tag.label}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
