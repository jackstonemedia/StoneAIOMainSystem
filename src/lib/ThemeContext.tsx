import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type ThemeName = 'stone' | 'dark' | 'ocean' | 'sunset' | 'forest' | 'neon';

interface ThemeContextType {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  themes: { id: ThemeName; name: string; preview: { bg: string; surface: string; primary: string; accent: string } }[];
}

export const THEMES: ThemeContextType['themes'] = [
  { id: 'stone',  name: 'Enterprise Navy', preview: { bg: '#0F1A2B', surface: '#1C2E4A', primary: '#52677D', accent: '#BDC4D4' } },
  { id: 'dark',   name: 'Dark',            preview: { bg: '#52677D', surface: '#52677D', primary: '#52677D', accent: '#52677D' } },
  { id: 'ocean',  name: 'Ocean',           preview: { bg: '#52677D', surface: '#52677D', primary: '#52677D', accent: '#52677D' } },
  { id: 'sunset', name: 'Sunset',          preview: { bg: '#52677D', surface: '#52677D', primary: '#52677D', accent: '#52677D' } },
  { id: 'forest', name: 'Forest',          preview: { bg: '#52677D', surface: '#52677D', primary: '#52677D', accent: '#52677D' } },
  { id: 'neon',   name: 'Neon',            preview: { bg: '#52677D', surface: '#52677D', primary: '#52677D', accent: '#52677D' } },
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
