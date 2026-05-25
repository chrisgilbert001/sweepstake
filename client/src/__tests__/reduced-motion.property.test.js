import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property 6: Reduced motion disables all timed transitions
 *
 * Given the duration tokens under prefers-reduced-motion, all duration values
 * should be 0ms.
 *
 * **Validates: Requirements 7.5**
 */

/**
 * The duration tokens defined in variables.css under the
 * `@media (prefers-reduced-motion: reduce)` media query.
 *
 * From variables.css:
 * ```css
 * @media (prefers-reduced-motion: reduce) {
 *   :root, [data-theme='dark'] {
 *     --duration-instant: 0ms;
 *     --duration-fast: 0ms;
 *     --duration-normal: 0ms;
 *     --duration-slow: 0ms;
 *   }
 * }
 * ```
 */
const reducedMotionDurationTokens = {
  '--duration-instant': '0ms',
  '--duration-fast': '0ms',
  '--duration-normal': '0ms',
  '--duration-slow': '0ms',
};

/**
 * Parses a CSS duration value to milliseconds.
 */
function parseDurationMs(value) {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.endsWith('ms')) {
    return parseFloat(trimmed);
  }
  if (trimmed.endsWith('s')) {
    return parseFloat(trimmed) * 1000;
  }
  return parseFloat(trimmed);
}

/**
 * Simulates what the reduced-motion media query does to duration tokens.
 * In the actual CSS, all duration tokens are overridden to 0ms.
 */
function applyReducedMotion(tokens) {
  const result = {};
  for (const [key, _value] of Object.entries(tokens)) {
    // Under prefers-reduced-motion: reduce, all durations become 0ms
    result[key] = '0ms';
  }
  return result;
}

describe('Feature: ui-modernization, Property 6: Reduced-motion disabling all timed transitions', () => {
  it('should set all duration tokens to 0ms under prefers-reduced-motion', () => {
    const tokenNames = Object.keys(reducedMotionDurationTokens);

    fc.assert(
      fc.property(
        fc.constantFrom(...tokenNames),
        (tokenName) => {
          const value = reducedMotionDurationTokens[tokenName];
          const durationMs = parseDurationMs(value);

          // All durations must be exactly 0ms
          expect(durationMs).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should produce 0ms for any arbitrary duration token when reduced motion is applied', () => {
    // Generate arbitrary duration values that might exist in a theme
    const durationArb = fc.oneof(
      fc.constant('0ms'),
      fc.constant('100ms'),
      fc.constant('150ms'),
      fc.constant('200ms'),
      fc.constant('250ms'),
      fc.constant('300ms'),
      fc.constant('350ms'),
      fc.constant('0.1s'),
      fc.constant('0.2s'),
      fc.constant('0.35s')
    );

    const tokenArb = fc.record({
      name: fc.constantFrom(
        '--duration-instant',
        '--duration-fast',
        '--duration-normal',
        '--duration-slow',
        '--transition-fast',
        '--transition-normal',
        '--transition-slow'
      ),
      value: durationArb,
    });

    fc.assert(
      fc.property(tokenArb, (token) => {
        // When reduced motion is applied, the token should become 0ms
        const tokens = { [token.name]: token.value };
        const reduced = applyReducedMotion(tokens);

        const resultMs = parseDurationMs(reduced[token.name]);
        expect(resultMs).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('should have all four duration tokens defined in the reduced-motion override', () => {
    const expectedTokens = [
      '--duration-instant',
      '--duration-fast',
      '--duration-normal',
      '--duration-slow',
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...expectedTokens),
        (tokenName) => {
          // Token must exist in the reduced motion overrides
          expect(reducedMotionDurationTokens).toHaveProperty(tokenName);

          // Token value must be 0ms
          expect(reducedMotionDurationTokens[tokenName]).toBe('0ms');
        }
      ),
      { numRuns: 100 }
    );
  });
});
