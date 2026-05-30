import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property 4: Theme color contrast WCAG AA compliance
 *
 * For any text color token paired with its designated background color token in the
 * Theme_System (both light and dark modes), the computed contrast ratio SHALL be at
 * least 4.5:1 for normal text sizes and at least 3:1 for large text sizes.
 *
 * **Validates: Requirements 4.1**
 */

/**
 * Parses a hex color string to RGB values.
 */
function hexToRgb(hex) {
  const cleaned = hex.replace('#', '');
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  return { r, g, b };
}

/**
 * Computes relative luminance per WCAG 2.1 spec.
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
function relativeLuminance({ r, g, b }) {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const sRGB = c / 255;
    return sRGB <= 0.03928
      ? sRGB / 12.92
      : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Computes contrast ratio between two colors per WCAG 2.1.
 * https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */
function contrastRatio(color1, color2) {
  const l1 = relativeLuminance(hexToRgb(color1));
  const l2 = relativeLuminance(hexToRgb(color2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Light theme color tokens from variables.css
 * Only testing actual intended text-on-background pairings used in the UI.
 */
const lightThemePairs = [
  // Primary text on all backgrounds
  { textToken: '--color-text', textColor: '#0f1c16', bgToken: '--color-bg', bgColor: '#eef3ef' },
  { textToken: '--color-text', textColor: '#0f1c16', bgToken: '--color-bg-card', bgColor: '#ffffff' },
  { textToken: '--color-text', textColor: '#0f1c16', bgToken: '--color-bg-muted', bgColor: '#e1e9e3' },
  // Light text on primary backgrounds
  { textToken: '--color-text-light', textColor: '#3d4f46', bgToken: '--color-bg', bgColor: '#eef3ef' },
  { textToken: '--color-text-light', textColor: '#3d4f46', bgToken: '--color-bg-card', bgColor: '#ffffff' },
  // Muted text on primary backgrounds (not on muted backgrounds)
  { textToken: '--color-text-muted', textColor: '#51625a', bgToken: '--color-bg', bgColor: '#eef3ef' },
  { textToken: '--color-text-muted', textColor: '#51625a', bgToken: '--color-bg-card', bgColor: '#ffffff' },
];

/**
 * Dark theme color tokens from variables.css
 * Verified contrast ratios documented in the CSS comments.
 */
const darkThemePairs = [
  // Primary text on all backgrounds
  { textToken: '--color-text', textColor: '#e9f1ec', bgToken: '--color-bg', bgColor: '#0b1512' },
  { textToken: '--color-text', textColor: '#e9f1ec', bgToken: '--color-bg-card', bgColor: '#111d18' },
  { textToken: '--color-text', textColor: '#e9f1ec', bgToken: '--color-bg-muted', bgColor: '#1a2a23' },
  // Light text on primary backgrounds
  { textToken: '--color-text-light', textColor: '#aebdb5', bgToken: '--color-bg', bgColor: '#0b1512' },
  { textToken: '--color-text-light', textColor: '#aebdb5', bgToken: '--color-bg-card', bgColor: '#111d18' },
  // Muted text on primary backgrounds
  { textToken: '--color-text-muted', textColor: '#8fa79b', bgToken: '--color-bg', bgColor: '#0b1512' },
  { textToken: '--color-text-muted', textColor: '#8fa79b', bgToken: '--color-bg-card', bgColor: '#111d18' },
];

/**
 * All text-on-background combinations that must meet WCAG AA.
 * Pairs are defined explicitly above based on actual UI usage patterns.
 */

describe('Feature: ui-modernization, Property 4: Theme color contrast WCAG AA compliance', () => {
  it('should have >= 4.5:1 contrast ratio for all light theme text-on-background combinations', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...lightThemePairs),
        (pair) => {
          const ratio = contrastRatio(pair.textColor, pair.bgColor);
          expect(ratio).toBeGreaterThanOrEqual(4.5);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should have >= 4.5:1 contrast ratio for all dark theme text-on-background combinations', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...darkThemePairs),
        (pair) => {
          const ratio = contrastRatio(pair.textColor, pair.bgColor);
          expect(ratio).toBeGreaterThanOrEqual(4.5);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should have >= 3:1 contrast ratio for primary/secondary colors on backgrounds (large text)', () => {
    const accentOnBgPairs = [
      // Light theme accent colors on backgrounds
      { textColor: '#047857', bgColor: '#eef3ef', label: 'light: primary on bg' },
      { textColor: '#047857', bgColor: '#ffffff', label: 'light: primary on card' },
      // Dark theme accent colors on backgrounds
      { textColor: '#34d399', bgColor: '#0b1512', label: 'dark: primary on bg' },
      { textColor: '#34d399', bgColor: '#111d18', label: 'dark: primary on card' },
      { textColor: '#bef264', bgColor: '#0b1512', label: 'dark: secondary on bg' },
      { textColor: '#bef264', bgColor: '#111d18', label: 'dark: secondary on card' },
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...accentOnBgPairs),
        (pair) => {
          const ratio = contrastRatio(pair.textColor, pair.bgColor);
          // Large text requires 3:1 minimum
          expect(ratio).toBeGreaterThanOrEqual(3);
        }
      ),
      { numRuns: 100 }
    );
  });
});
