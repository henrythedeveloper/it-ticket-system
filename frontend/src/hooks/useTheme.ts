// src/hooks/useTheme.ts
import { useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark';

export const useTheme = (): { theme: Theme; toggleTheme: () => void } => {
  const [theme, setTheme] = useState<Theme>('light'); // Default to light

  // Function to apply theme class to body
  const applyTheme = useCallback((selectedTheme: Theme) => {
    if (selectedTheme === 'dark') {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
    localStorage.setItem('theme', selectedTheme);
    setTheme(selectedTheme);
  }, []);

  // Effect to set initial theme based on localStorage or system preference
  useEffect(() => {
    const storedTheme = localStorage.getItem('theme') as Theme | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (storedTheme) {
      applyTheme(storedTheme);
    } else if (prefersDark) {
      applyTheme('dark');
    } else {
      applyTheme('light'); // Explicitly set light if no preference/storage
    }
  }, [applyTheme]);

  // Effect to listen for OS theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
        // Only change if no theme is explicitly stored in localStorage
        if (!localStorage.getItem('theme')) {
             applyTheme(e.matches ? 'dark' : 'light');
        }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [applyTheme]);


  // Function to toggle theme
  const toggleTheme = () => {
    applyTheme(theme === 'light' ? 'dark' : 'light');
  };

  return { theme, toggleTheme };
};
