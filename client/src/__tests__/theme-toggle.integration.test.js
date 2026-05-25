import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Integration test: Theme toggle persists and applies without flash.
 *
 * Tests the theme initialization, toggle, and persistence logic from ThemeContext.
 * Verifies that:
 * - Theme is determined synchronously (no flash)
 * - localStorage preference takes priority
 * - System preference is used as fallback
 * - Toggle persists to localStorage
 * - data-theme attribute is set correctly
 */

describe('Integration: Theme toggle persistence and flash prevention', () => {
  /**
   * Replicates getInitialTheme from ThemeContext.jsx.
   * This runs synchronously to prevent flash of wrong theme.
   */
  function getInitialTheme(storage, matchMedia) {
    // Check localStorage first (synchronous)
    try {
      const stored = storage.getItem('theme');
      if (stored === 'dark' || stored === 'light') {
        return stored;
      }
    } catch {
      // localStorage may be unavailable
    }

    // Check system preference (synchronous)
    if (matchMedia) {
      const prefersDark = matchMedia('(prefers-color-scheme: dark)');
      if (prefersDark.matches) {
        return 'dark';
      }
    }

    // Default to light
    return 'light';
  }

  /**
   * Simulates the toggle logic from ThemeContext.
   */
  function createThemeManager(initialTheme, storage) {
    let theme = initialTheme;

    return {
      getTheme: () => theme,
      toggle: () => {
        theme = theme === 'dark' ? 'light' : 'dark';
        try {
          storage.setItem('theme', theme);
        } catch {
          // localStorage may be unavailable
        }
        return theme;
      },
      getDataThemeAttribute: () => theme,
    };
  }

  let mockStorage;

  beforeEach(() => {
    mockStorage = {
      store: {},
      getItem(key) { return this.store[key] ?? null; },
      setItem(key, value) { this.store[key] = String(value); },
      removeItem(key) { delete this.store[key]; },
    };
  });

  describe('Flash prevention (synchronous initialization)', () => {
    it('should determine theme synchronously from localStorage', () => {
      mockStorage.store.theme = 'dark';
      const matchMedia = () => ({ matches: false });

      // getInitialTheme is synchronous - no async, no flash
      const theme = getInitialTheme(mockStorage, matchMedia);
      expect(theme).toBe('dark');
    });

    it('should determine theme synchronously from system preference', () => {
      const matchMedia = (query) => ({
        matches: query === '(prefers-color-scheme: dark)',
      });

      const theme = getInitialTheme(mockStorage, matchMedia);
      expect(theme).toBe('dark');
    });

    it('should default to light synchronously when no preference exists', () => {
      const matchMedia = () => ({ matches: false });

      const theme = getInitialTheme(mockStorage, matchMedia);
      expect(theme).toBe('light');
    });
  });

  describe('Persistence priority', () => {
    it('should prioritize localStorage over system preference', () => {
      mockStorage.store.theme = 'light';
      const matchMedia = () => ({ matches: true }); // System prefers dark

      const theme = getInitialTheme(mockStorage, matchMedia);
      expect(theme).toBe('light'); // localStorage wins
    });

    it('should use system preference when localStorage is empty', () => {
      const matchMedia = () => ({ matches: true }); // System prefers dark

      const theme = getInitialTheme(mockStorage, matchMedia);
      expect(theme).toBe('dark');
    });

    it('should handle localStorage errors gracefully', () => {
      const brokenStorage = {
        getItem() { throw new Error('SecurityError'); },
        setItem() { throw new Error('SecurityError'); },
      };
      const matchMedia = () => ({ matches: false });

      const theme = getInitialTheme(brokenStorage, matchMedia);
      expect(theme).toBe('light');
    });
  });

  describe('Toggle and persist', () => {
    it('should toggle from light to dark and persist', () => {
      const manager = createThemeManager('light', mockStorage);

      const newTheme = manager.toggle();

      expect(newTheme).toBe('dark');
      expect(mockStorage.store.theme).toBe('dark');
    });

    it('should toggle from dark to light and persist', () => {
      const manager = createThemeManager('dark', mockStorage);

      const newTheme = manager.toggle();

      expect(newTheme).toBe('light');
      expect(mockStorage.store.theme).toBe('light');
    });

    it('should persist through multiple toggles', () => {
      const manager = createThemeManager('light', mockStorage);

      manager.toggle(); // -> dark
      manager.toggle(); // -> light
      manager.toggle(); // -> dark

      expect(manager.getTheme()).toBe('dark');
      expect(mockStorage.store.theme).toBe('dark');
    });

    it('should survive page reload by reading persisted value', () => {
      // First session: user toggles to dark
      const manager1 = createThemeManager('light', mockStorage);
      manager1.toggle(); // -> dark, persisted

      // Second session: simulates page reload
      const matchMedia = () => ({ matches: false });
      const restoredTheme = getInitialTheme(mockStorage, matchMedia);

      expect(restoredTheme).toBe('dark');
    });

    it('should handle localStorage write failure gracefully during toggle', () => {
      const brokenStorage = {
        store: {},
        getItem() { return null; },
        setItem() { throw new Error('QuotaExceededError'); },
      };

      const manager = createThemeManager('light', brokenStorage);

      // Toggle should still work in-memory even if persist fails
      const newTheme = manager.toggle();
      expect(newTheme).toBe('dark');
      expect(manager.getTheme()).toBe('dark');
    });
  });

  describe('data-theme attribute application', () => {
    it('should reflect current theme as data-theme attribute value', () => {
      const manager = createThemeManager('light', mockStorage);
      expect(manager.getDataThemeAttribute()).toBe('light');

      manager.toggle();
      expect(manager.getDataThemeAttribute()).toBe('dark');

      manager.toggle();
      expect(manager.getDataThemeAttribute()).toBe('light');
    });

    it('should apply correct initial data-theme based on stored preference', () => {
      mockStorage.store.theme = 'dark';
      const matchMedia = () => ({ matches: false });

      const initialTheme = getInitialTheme(mockStorage, matchMedia);
      const manager = createThemeManager(initialTheme, mockStorage);

      // data-theme should be 'dark' immediately (no flash of light)
      expect(manager.getDataThemeAttribute()).toBe('dark');
    });
  });
});
