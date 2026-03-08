'use client';

import { TimelineOption } from '@/types/thesis';
import { TIMELINE_PRESETS } from '@/constants/tags';
import { cn } from '@/lib/utils';
import { format, addDays } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { getReviewDate } from '@/lib/store';
import { CalendarClock } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';

interface TimelineSelectorProps {
  value: TimelineOption;
  onChange: (value: TimelineOption) => void;
  customDate: string;
  onCustomDateChange: (date: string) => void;
}

export function TimelineSelector({
  value,
  onChange,
  customDate,
  onCustomDateChange,
}: TimelineSelectorProps) {
  const isCustom = value === 'custom';

  const reviewDate = isCustom && customDate
    ? new Date(customDate)
    : getReviewDate(value);

  const handleCustomDateSelect = (date: Date | undefined) => {
    if (!date) return;
    onChange('custom');
    onCustomDateChange(format(date, 'yyyy-MM-dd'));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {TIMELINE_PRESETS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'relative flex flex-col items-center justify-center rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors duration-200',
              value === option.value
                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <span className="text-base font-semibold">{option.label}</span>
            <span className="text-[10px] mt-0.5 opacity-70">{option.description}</span>
          </button>
        ))}
        <DatePicker
          date={isCustom && customDate ? new Date(customDate) : undefined}
          onDateChange={handleCustomDateSelect}
          placeholder="自定义日期"
          disabled={(date) => date < addDays(new Date(), 1)}
          className={cn(
            'h-auto py-2.5 px-3',
            isCustom && 'border-primary bg-primary/5'
          )}
        />
      </div>

      {(isCustom ? customDate : true) && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
          <CalendarClock className="h-3.5 w-3.5" />
          <span>
            预计回顾日期：
            <span className="text-foreground font-medium" suppressHydrationWarning>
              {format(reviewDate, 'yyyy年MM月dd日 (EEEE)', { locale: zhCN })}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
