'use client';

import { useState } from 'react';
import { Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useThemeConfig } from './active-theme';
import { THEMES } from './theme-config';
import { cn } from '@/lib/utils';

const THEME_COLORS: Record<string, { light: string; dark: string }> = {
  claude: { light: 'bg-[#c46a30]', dark: 'bg-[#c46a30]' },
  vercel: { light: 'bg-black', dark: 'bg-white' },
  supabase: { light: 'bg-[#3ecf8e]', dark: 'bg-[#3ecf8e]' },
  mono: { light: 'bg-zinc-500', dark: 'bg-zinc-500' },
  notebook: { light: 'bg-zinc-400', dark: 'bg-zinc-400' },
  neobrutualism: { light: 'bg-[#e04832]', dark: 'bg-[#e04832]' },
};

export function ThemeSwitcher() {
  const { activeTheme, setActiveTheme } = useThemeConfig();
  const [open, setOpen] = useState(false);

  const handleSelect = (value: typeof activeTheme) => {
    setActiveTheme(value);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Palette className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">Switch theme</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="w-48 p-2"
      >
        <div className="grid gap-1">
          <p className="text-xs font-medium text-muted-foreground px-1 pb-1">
            Theme
          </p>
          {THEMES.map((theme) => {
            const colors = THEME_COLORS[theme.value];
            const isActive = activeTheme === theme.value;
            return (
              <button
                key={theme.value}
                onClick={() => handleSelect(theme.value)}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  isActive && 'bg-accent text-accent-foreground font-medium'
                )}
              >
                <span
                  className={cn(
                    'h-4 w-4 rounded-full border border-border shrink-0',
                    colors?.light ?? 'bg-primary'
                  )}
                />
                <span>{theme.name}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
