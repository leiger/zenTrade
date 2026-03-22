export const DEFAULT_THEME = 'default';

export const THEMES = [
  { name: 'Default', value: 'default' },
  { name: 'Claude', value: 'claude' },
  { name: 'Vercel', value: 'vercel' },
  { name: 'Supabase', value: 'supabase' },
  { name: 'Mono', value: 'mono' },
  { name: 'Notebook', value: 'notebook' },
  { name: 'Neobrutualism', value: 'neobrutualism' },
] as const;

export type ThemeValue = (typeof THEMES)[number]['value'];
