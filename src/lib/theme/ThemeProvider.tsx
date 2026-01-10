'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'default' | 'blue' | 'green' | 'purple' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('default');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem('djsh-theme') as Theme;
    if (savedTheme) {
      setThemeState(savedTheme);
    }
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('djsh-theme', newTheme);
  };

  useEffect(() => {
    if (!mounted) return;

    // Remove all theme classes
    document.documentElement.classList.remove(
      'theme-default',
      'theme-blue',
      'theme-green',
      'theme-purple',
      'theme-dark'
    );

    // Add new theme class
    document.documentElement.classList.add(`theme-${theme}`);
  }, [theme, mounted]);

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    // Return default values during SSR instead of throwing error
    return {
      theme: 'default' as Theme,
      setTheme: () => {},
    };
  }
  return context;
}
