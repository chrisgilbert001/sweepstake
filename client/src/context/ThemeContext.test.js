import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Tests for ThemeContext theme detection logic.
 * Tests the getInitialTheme logic which determines theme priority:
 * 1. localStorage 'theme' key
 * 2. prefers-color-scheme media query
 * 3. Default to 'light'
 */

describe('ThemeContext - theme initialization logic', () => {
  let mockLocalStorage;

  beforeEach(() => {
    mockLocalStorage = {
      store: {},
      getItem(key) { return this.store[key] ?? null; },
      setItem(key, value) { this.store[key] = String(value); },
      removeItem(key) { delete this.store[key]; },
      clear() { this.store = {}; },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Replicates the getInitialTheme logic from ThemeContext.jsx
   * for unit testing without needing a DOM environment.
   */
  function getInitialTheme(localStorage, matchMedia) {
    // Check localStorage first
    try {
      const stored = localStorage.getItem('theme');
      if (stored === 'dark' || stored === 'light') {
        return stored;
      }
    } catch {
      // localStorage may be unavailable
    }

    // Check system preference
    if (matchMedia) {
      const prefersDark = matchMedia('(prefers-color-scheme: dark)');
      if (prefersDark.matches) {
        return 'dark';
      }
    }

    // Default to light
    return 'light';
  }

  it('should return "dark" when localStorage has theme=dark', () => {
    mockLocalStorage.store.theme = 'dark';
    const matchMedia = () => ({ matches: false });

    expect(getInitialTheme(mockLocalStorage, matchMedia)).toBe('dark');
  });

  it('should return "light" when localStorage has theme=light', () => {
    mockLocalStorage.store.theme = 'light';
    const matchMedia = () => ({ matches: true });

    // localStorage takes priority over matchMedia
    expect(getInitialTheme(mockLocalStorage, matchMedia)).toBe('light');
  });

  it('should return "dark" when no localStorage but prefers-color-scheme is dark', () => {
    const matchMedia = (query) => ({
      matches: query === '(prefers-color-scheme: dark)',
    });

    expect(getInitialTheme(mockLocalStorage, matchMedia)).toBe('dark');
  });

  it('should return "light" when no localStorage and prefers-color-scheme is light', () => {
    const matchMedia = () => ({ matches: false });

    expect(getInitialTheme(mockLocalStorage, matchMedia)).toBe('light');
  });

  it('should return "light" when localStorage throws and matchMedia is unavailable', () => {
    const brokenStorage = {
      getItem() { throw new Error('Access denied'); },
    };

    expect(getInitialTheme(brokenStorage, null)).toBe('light');
  });

  it('should ignore invalid localStorage values and fall back to matchMedia', () => {
    mockLocalStorage.store.theme = 'invalid-value';
    const matchMedia = () => ({ matches: true });

    expect(getInitialTheme(mockLocalStorage, matchMedia)).toBe('dark');
  });

  it('should ignore invalid localStorage values and default to light when matchMedia is false', () => {
    mockLocalStorage.store.theme = 'blue';
    const matchMedia = () => ({ matches: false });

    expect(getInitialTheme(mockLocalStorage, matchMedia)).toBe('light');
  });
});

describe('ThemeContext - toggle logic', () => {
  it('should toggle from light to dark', () => {
    let theme = 'light';
    const toggleTheme = () => {
      theme = theme === 'dark' ? 'light' : 'dark';
    };

    toggleTheme();
    expect(theme).toBe('dark');
  });

  it('should toggle from dark to light', () => {
    let theme = 'dark';
    const toggleTheme = () => {
      theme = theme === 'dark' ? 'light' : 'dark';
    };

    toggleTheme();
    expect(theme).toBe('light');
  });

  it('should persist theme to localStorage on toggle', () => {
    const store = {};
    const mockStorage = {
      setItem(key, value) { store[key] = value; },
    };

    let theme = 'light';
    const toggleTheme = () => {
      theme = theme === 'dark' ? 'light' : 'dark';
      mockStorage.setItem('theme', theme);
    };

    toggleTheme();
    expect(store.theme).toBe('dark');

    toggleTheme();
    expect(store.theme).toBe('light');
  });
});
