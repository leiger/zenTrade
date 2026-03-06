'use client';

import { ThesisTag } from '@/types/thesis';
import { BUY_TAGS, SELL_TAGS } from '@/constants/tags';
import { Badge } from '@/components/ui/badge';
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
    <div className="space-y-4">
      {buyTags.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            买入理由
          </p>
          <div className="flex flex-wrap gap-2">
            {buyTags.map((tag) => (
              <Badge
                key={tag.id}
                variant={isSelected(tag) ? 'default' : 'secondary'}
                className={cn(
                  'cursor-pointer select-none transition-colors duration-200',
                  isSelected(tag) && 'bg-primary text-primary-foreground hover:bg-primary/90',
                  !isSelected(tag) && 'hover:bg-accent hover:text-accent-foreground'
                )}
                onClick={() => toggleTag(tag)}
              >
                {tag.label}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {sellTags.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            卖出理由
          </p>
          <div className="flex flex-wrap gap-2">
            {sellTags.map((tag) => (
              <Badge
                key={tag.id}
                variant={isSelected(tag) ? 'destructive' : 'outline'}
                className={cn(
                  'cursor-pointer select-none transition-colors duration-200',
                  isSelected(tag) &&
                    'bg-destructive text-destructive-foreground hover:bg-destructive/90',
                  !isSelected(tag) &&
                    'hover:bg-accent hover:text-accent-foreground text-foreground/80'
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
