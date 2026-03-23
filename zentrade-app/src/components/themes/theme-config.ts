export const DEFAULT_THEME = 'mono';

export const THEMES = [
  { name: 'Claude', value: 'claude' },
  { name: 'Vercel', value: 'vercel' },
  { name: 'Supabase', value: 'supabase' },
  { name: 'Mono', value: 'mono' },
  { name: 'Notebook', value: 'notebook' },
  { name: 'Neobrutualism', value: 'neobrutualism' },
] as const;

export type ThemeValue = (typeof THEMES)[number]['value'];
