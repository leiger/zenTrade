'use client';

import { Thesis } from '@/types/thesis';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { MessageSquareText, Clock, Layers } from 'lucide-react';

interface ThesisCardProps {
  thesis: Thesis;
  onClick?: () => void;
}

export function ThesisCard({ thesis, onClick }: ThesisCardProps) {
  return (
    <Card
      className={cn(
        'group relative overflow-hidden transition-colors duration-200 cursor-pointer',
        'hover:bg-accent/40',
        'bg-card border-border'
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 flex-1 min-w-0">
            <CardTitle className="text-base font-semibold truncate">{thesis.name}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px] font-normal px-1.5 py-0">
                <Layers className="h-2.5 w-2.5 mr-0.5" />
                {thesis.zone}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
          {thesis.description}
        </p>

        {/* 标签 */}
        {thesis.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {thesis.tags.map((tag) => (
              <Badge
                key={tag.id}
                variant={tag.category === 'buy' ? 'secondary' : 'outline'}
                className={cn(
                  'text-[10px] px-1.5 py-0 font-normal',
                  tag.category === 'sell' && 'text-destructive border-destructive/20'
                )}
              >
                {tag.label}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-4 border-t border-border/50 flex items-center justify-between text-muted-foreground">
        <div className="flex items-center gap-1 text-xs">
          <MessageSquareText className="h-3 w-3" />
          <span>{thesis.snapshots.length} 快照</span>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <Clock className="h-3 w-3" />
          <span suppressHydrationWarning>
            {formatDistanceToNow(new Date(thesis.updatedAt), {
              addSuffix: true,
              locale: zhCN,
            })}
          </span>
        </div>
      </CardFooter>
    </Card>
  );
}
