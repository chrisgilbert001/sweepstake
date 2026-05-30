import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(undefined);

/**
 * Determines the initial theme synchronously to prevent flash.
 * Priority: localStorage > prefers-color-scheme > 'light'
 */
function getInitialTheme() {
  // Check localStorage first
  try {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark' || stored === 'light') {
      return stored;
    }
  } catch {
    // localStorage may be unavailable (private browsing, etc.)
  }

  // Check system preference — only an explicit "light" preference opts out of
  // the signature stadium-dark theme.
  if (typeof window !== 'undefined' && window.matchMedia) {
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)');
    if (prefersLight.matches) {
      return 'light';
    }
  }

  // Default to the stadium-dark theme
  return 'dark';
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);

  // Apply theme to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Listen for system preference changes
  useEffect(() => {
    if (!window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      // Only respond to system changes if user hasn't set a preference
      try {
        const stored = localStorage.getItem('theme');
        if (!stored) {
          setTheme(e.matches ? 'dark' : 'light');
        }
      } catch {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('theme', next);
      } catch {
        // localStorage may be unavailable
      }
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export default ThemeContext;
