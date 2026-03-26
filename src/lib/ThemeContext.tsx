import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type ThemeName = 'light' | 'dark' | 'ocean' | 'sunset' | 'forest' | 'neon';

interface ThemeContextType {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  themes: { id: ThemeName; name: string; preview: { bg: string; surface: string; primary: string; accent: string } }[];
}

export const THEMES: ThemeContextType['themes'] = [
  { id: 'light', name: 'Light', preview: { bg: '#ffffff', surface: '#f8fafc', primary: '#4361EE', accent: '#06D6A0' } },
  { id: 'dark', name: 'Dark', preview: { bg: '#0f172a', surface: '#1e293b', primary: '#818cf8', accent: '#34d399' } },
  { id: 'ocean', name: 'Ocean', preview: { bg: '#0c1222', surface: '#162032', primary: '#38bdf8', accent: '#22d3ee' } },
  { id: 'sunset', name: 'Sunset', preview: { bg: '#1a1017', surface: '#2a1a25', primary: '#f97316', accent: '#fb923c' } },
  { id: 'forest', name: 'Forest', preview: { bg: '#0f1a14', surface: '#1a2e22', primary: '#22c55e', accent: '#4ade80' } },
  { id: 'neon', name: 'Neon', preview: { bg: '#0a0a1a', surface: '#12122a', primary: '#a855f7', accent: '#e879f9' } },
];

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('stone-aio-theme') as ThemeName) || 'dark';
    }
    return 'dark';
  });

  const setTheme = (newTheme: ThemeName) => {
    setThemeState(newTheme);
    localStorage.setItem('stone-aio-theme', newTheme);
  };

  useEffect(() => {
    const root = document.documentElement;
    // Remove all theme classes
    THEMES.forEach(t => root.classList.remove(`theme-${t.id}`));
    // Add current theme class
    root.classList.add(`theme-${theme}`);
    // Also set dark class for Tailwind compatibility
    if (theme !== 'light') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
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
