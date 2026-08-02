
import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/apiClient';
import { useAuth } from './AuthContext';

export type ThemeColor = 'blue' | 'purple' | 'green' | 'orange' | 'slate';

interface Theme {
  name: string;
  color: ThemeColor;
  classes: {
    bg: string;
    bgHover: string;
    text: string;
    bgLight: string;
    border: string;
    ring: string;
  };
}

export const THEMES: Record<ThemeColor, Theme> = {
  blue: {
    name: '科技蓝 (Default)',
    color: 'blue',
    classes: { bg: 'bg-blue-600', bgHover: 'hover:bg-blue-700', text: 'text-blue-600', bgLight: 'bg-blue-50', border: 'border-blue-200', ring: 'ring-blue-500' }
  },
  purple: {
    name: '星云紫 (Nebula)',
    color: 'purple',
    classes: { bg: 'bg-purple-600', bgHover: 'hover:bg-purple-700', text: 'text-purple-600', bgLight: 'bg-purple-50', border: 'border-purple-200', ring: 'ring-purple-500' }
  },
  green: {
    name: '翡翠绿 (Emerald)',
    color: 'green',
    classes: { bg: 'bg-emerald-600', bgHover: 'hover:bg-emerald-700', text: 'text-emerald-600', bgLight: 'bg-emerald-50', border: 'border-emerald-200', ring: 'ring-emerald-500' }
  },
  orange: {
    name: '活力橙 (Orange)',
    color: 'orange',
    classes: { bg: 'bg-orange-600', bgHover: 'hover:bg-orange-700', text: 'text-orange-600', bgLight: 'bg-orange-50', border: 'border-orange-200', ring: 'ring-orange-500' }
  },
  slate: {
    name: '极简灰 (Slate)',
    color: 'slate',
    classes: { bg: 'bg-slate-700', bgHover: 'hover:bg-slate-800', text: 'text-slate-700', bgLight: 'bg-slate-100', border: 'border-slate-300', ring: 'ring-slate-500' }
  }
};

// Fixed swatch colors for the theme picker. The global stylesheet remaps
// Tailwind color classes to the active theme, so using bg-blue-600 here would
// incorrectly make every preview display the currently selected color.
export const THEME_SWATCH_COLORS: Record<ThemeColor, string> = {
  blue: '#2563eb',
  purple: '#7c3aed',
  green: '#059669',
  orange: '#ea580c',
  slate: '#475569',
};

interface ThemeContextType {
  theme: ThemeColor;
  setTheme: (theme: ThemeColor) => void;
  themeConfig: Theme;
}

type ThemeTokens = {
  primary: string;
  primaryStrong: string;
  primarySoft: string;
  primaryBorder: string;
  primaryRgb: string;
  strongRgb: string;
};

const THEME_TOKENS: Record<ThemeColor, ThemeTokens> = {
  blue: { primary: '#2563eb', primaryStrong: '#1d4ed8', primarySoft: '#eff6ff', primaryBorder: '#bfdbfe', primaryRgb: '37,99,235', strongRgb: '29,78,216' },
  purple: { primary: '#7c3aed', primaryStrong: '#6d28d9', primarySoft: '#f5f3ff', primaryBorder: '#ddd6fe', primaryRgb: '124,58,237', strongRgb: '109,40,217' },
  green: { primary: '#059669', primaryStrong: '#047857', primarySoft: '#ecfdf5', primaryBorder: '#a7f3d0', primaryRgb: '5,150,105', strongRgb: '4,120,87' },
  orange: { primary: '#ea580c', primaryStrong: '#c2410c', primarySoft: '#fff7ed', primaryBorder: '#fed7aa', primaryRgb: '234,88,12', strongRgb: '194,65,12' },
  slate: { primary: '#475569', primaryStrong: '#334155', primarySoft: '#f8fafc', primaryBorder: '#cbd5e1', primaryRgb: '71,85,105', strongRgb: '51,65,85' }
};

const applyThemeTokens = (value: ThemeColor) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const tokens = THEME_TOKENS[value];
  root.dataset.theme = value;
  root.style.setProperty('--theme-primary', tokens.primary);
  root.style.setProperty('--theme-primary-strong', tokens.primaryStrong);
  root.style.setProperty('--theme-primary-soft', tokens.primarySoft);
  root.style.setProperty('--theme-primary-border', tokens.primaryBorder);
  root.style.setProperty('--theme-primary-rgb', tokens.primaryRgb);
  root.style.setProperty('--theme-primary-strong-rgb', tokens.strongRgb);
  root.style.setProperty('--color-secondary', tokens.primary);
  root.style.setProperty('--color-primary', tokens.primaryStrong);
  root.style.setProperty('--color-accent', tokens.primary);
  root.style.setProperty('--slss-brand-rgb', tokens.primaryRgb);
  root.style.setProperty('--slss-brand-dark-rgb', tokens.strongRgb);
  window.dispatchEvent(new CustomEvent('slss-theme-updated', { detail: { theme: value, tokens } }));
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeColor>('blue');
  const { user } = useAuth();

  useEffect(() => {
    applyThemeTokens(theme);
  }, [theme]);

  // Settings are saved from AdminPanel; listen as well so every mounted surface
  // (including a second tab) updates without a full page reload.
  useEffect(() => {
    const onSettingsUpdated = (event: Event) => {
      const next = (event as CustomEvent<any>).detail?.theme as ThemeColor | undefined;
      if (next && THEMES[next]) {
        setTheme(next);
        localStorage.setItem('slss_theme', next);
      }
    };
    window.addEventListener('slss-system-settings-updated', onSettingsUpdated);
    return () => window.removeEventListener('slss-system-settings-updated', onSettingsUpdated);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('slss_theme');
    if (saved && THEMES[saved as ThemeColor]) {
      setTheme(saved as ThemeColor);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    api.branding().then((settings: any) => {
      if (settings?.theme && THEMES[settings.theme as ThemeColor]) {
        setTheme(settings.theme as ThemeColor);
        localStorage.setItem('slss_theme', settings.theme);
      }
    }).catch(() => undefined);
  }, [user?.username]);

  const handleSetTheme = (newTheme: ThemeColor) => {
    if (!THEMES[newTheme]) return;
    setTheme(newTheme);
    localStorage.setItem('slss_theme', newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme: handleSetTheme, themeConfig: THEMES[theme] }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
