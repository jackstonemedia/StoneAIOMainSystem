import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type ThemeName = 'stone' | 'dark' | 'ocean' | 'sunset' | 'forest' | 'neon';

interface ThemeContextType {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  themes: { id: ThemeName; name: string; preview: { bg: string; surface: string; primary: string; accent: string } }[];
}

export const THEMES: ThemeContextType['themes'] = [
  { id: 'stone',  name: 'Enterprise Navy', preview: { bg: '#0F1A2B', surface: '#1C2E4A', primary: '#52677D', accent: '#BDC4D4' } },
  { id: 'dark',   name: 'Dark',            preview: { bg: '#080d1a', surface: '#111827', primary: '#818cf8', accent: '#34d399' } },
  { id: 'ocean',  name: 'Ocean',           preview: { bg: '#060d1a', surface: '#0d1829', primary: '#38bdf8', accent: '#22d3ee' } },
  { id: 'sunset', name: 'Sunset',          preview: { bg: '#110a0d', surface: '#1e1218', primary: '#f97316', accent: '#fb923c' } },
  { id: 'forest', name: 'Forest',          preview: { bg: '#080f0b', surface: '#0f1a10', primary: '#22c55e', accent: '#4ade80' } },
  { id: 'neon',   name: 'Neon',            preview: { bg: '#05050f', surface: '#0a0a1e', primary: '#a855f7', accent: '#e879f9' } },
];

const THEME_KEY = 'stone-aio-theme';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY) as ThemeName | null;
      // Migrate old 'light' preference to 'stone'
      if (saved === 'light' || !saved) return 'stone';
      return saved in THEMES.reduce((acc, t) => ({ ...acc, [t.id]: true }), {} as Record<string, boolean>)
        ? saved
        : 'stone';
    } catch {
      return 'stone';
    }
  });

  const setTheme = (newTheme: ThemeName) => {
    setThemeState(newTheme);
    try { localStorage.setItem(THEME_KEY, newTheme); } catch {}
  };

  useEffect(() => {
    const root = document.documentElement;
    // Remove all theme classes
    THEMES.forEach(t => root.classList.remove(`theme-${t.id}`));
    // Remove legacy classes
    root.classList.remove('theme-light', 'dark');
    // Apply new theme
    root.classList.add(`theme-${theme}`);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
