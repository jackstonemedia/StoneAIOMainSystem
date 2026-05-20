import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type ThemeName = 'dark' | 'light';

interface ThemeContextType {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  themes: { id: ThemeName; name: string; preview: { bg: string; surface: string; primary: string; accent: string } }[];
}

export const THEMES: ThemeContextType['themes'] = [
  { id: 'light',  name: 'Light Mode', preview: { bg: '#fdfdfc', surface: '#ffffff', primary: '#e5e5e5', accent: '#111111' } },
  { id: 'dark',   name: 'Dark Mode',  preview: { bg: '#0F1A2B', surface: '#1C2E4A', primary: '#52677D', accent: '#BDC4D4' } },
];

const THEME_KEY = 'stone-aio-theme';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY) as ThemeName | null;
      if (saved === 'light' || saved === 'dark') return saved;
      return 'dark';
    } catch {
      return 'dark';
    }
  });

  const setTheme = (newTheme: ThemeName) => {
    setThemeState(newTheme);
    try { localStorage.setItem(THEME_KEY, newTheme); } catch {}
  };

  useEffect(() => {
    const root = document.documentElement;
    THEMES.forEach(t => root.classList.remove(`theme-${t.id}`));
    root.classList.remove('theme-light', 'dark');
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
