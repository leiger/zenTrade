'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { DEFAULT_THEME, type ThemeValue } from './theme-config';

const STORAGE_KEY = 'zentrade_active_theme';

type ThemeContextType = {
  activeTheme: ThemeValue;
  setActiveTheme: (theme: ThemeValue) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getStoredTheme(): ThemeValue {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  return (localStorage.getItem(STORAGE_KEY) as ThemeValue) || DEFAULT_THEME;
}

export function ActiveThemeProvider({ children }: { children: ReactNode }) {
  const [activeTheme, setActiveThemeState] = useState<ThemeValue>(DEFAULT_THEME);

  useEffect(() => {
    const stored = getStoredTheme();
    setActiveThemeState(stored);
    applyTheme(stored);
  }, []);

  const setActiveTheme = (theme: ThemeValue) => {
    setActiveThemeState(theme);
    localStorage.setItem(STORAGE_KEY, theme);
    applyTheme(theme);
  };

  return (
    <ThemeContext.Provider value={{ activeTheme, setActiveTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

function applyTheme(theme: ThemeValue) {
  if (typeof window === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
}

export function useThemeConfig() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeConfig must be used within an ActiveThemeProvider');
  }
  return context;
}
