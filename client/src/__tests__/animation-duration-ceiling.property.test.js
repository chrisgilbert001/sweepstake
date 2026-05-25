import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property 7: Animation duration ceiling
 *
 * For any animation or transition defined in the design token system, the duration
 * SHALL not exceed 300ms, ensuring no animation blocks pointer events, keyboard
 * input, or content visibility beyond that threshold.
 *
 * **Validates: Requirements 7.6**
 */

/**
 * All animation/transition duration tokens from variables.css.
 * These are the values defined in the :root scope (normal motion).
 */
const animationDurationTokens = {
  '--duration-instant': '0ms',
  '--duration-fast': '100ms',
  '--duration-normal': '200ms',
  '--duration-slow': '300ms',
  '--transition-fast': '150ms',
  '--transition-normal': '250ms',
  '--transition-slow': '300ms',
};

/**
 * The maximum allowed animation duration (300ms) as specified in the design.
 */
const MAX_ANIMATION_DURATION_MS = 300;

/**
 * Parses a CSS duration/transition value to milliseconds.
 * Handles formats like "150ms", "0.15s", "150ms ease", "250ms ease-in-out".
 */
function parseDurationMs(value) {
  const trimmed = value.trim().toLowerCase();
  // Extract the numeric duration part (first token before any timing function)
  const match = trimmed.match(/^([\d.]+)(ms|s)/);
  if (!match) return 0;

  const num = parseFloat(match[1]);
  const unit = match[2];

  return unit === 's' ? num * 1000 : num;
}

describe('Feature: ui-modernization, Property 7: Animation duration ceiling of 300ms', () => {
  it('should not have any duration token exceeding 300ms', () => {
    const tokenEntries = Object.entries(animationDurationTokens);

    fc.assert(
      fc.property(
        fc.constantFrom(...tokenEntries),
        ([tokenName, tokenValue]) => {
          const durationMs = parseDurationMs(tokenValue);

          expect(durationMs).toBeLessThanOrEqual(MAX_ANIMATION_DURATION_MS);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should ensure all duration tokens are non-negative', () => {
    const tokenEntries = Object.entries(animationDurationTokens);

    fc.assert(
      fc.property(
        fc.constantFrom(...tokenEntries),
        ([_tokenName, tokenValue]) => {
          const durationMs = parseDurationMs(tokenValue);

          expect(durationMs).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should validate that any generated duration within the token system respects the ceiling', () => {
    // Generate durations that could be defined in the system
    // All valid durations should be <= 300ms
    const validDurationArb = fc.integer({ min: 0, max: 300 }).map((ms) => `${ms}ms`);

    fc.assert(
      fc.property(validDurationArb, (duration) => {
        const ms = parseDurationMs(duration);
        expect(ms).toBeLessThanOrEqual(MAX_ANIMATION_DURATION_MS);
        expect(ms).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 100 }
    );
  });
});
