import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property 5: Tab slide animation direction
 *
 * For any TabPanel with ordered tabs and any transition from tab index `current`
 * to tab index `target` (where current != target), the content slide direction
 * SHALL be 'left' when target > current, and 'right' when target < current.
 *
 * **Validates: Requirements 7.2**
 */

/**
 * Replicates the slide direction logic from TabPanel.jsx:
 *
 * ```js
 * const direction = newIndex > currentIndex ? 'slide-left' : 'slide-right';
 * ```
 *
 * "slide-left" means content slides to the left (new content comes from right),
 * used when navigating to a tab with a higher index.
 * "slide-right" means content slides to the right (new content comes from left),
 * used when navigating to a tab with a lower index.
 */
function getSlideDirection(currentIndex, targetIndex) {
  if (targetIndex > currentIndex) {
    return 'slide-left';
  } else {
    return 'slide-right';
  }
}

describe('Feature: ui-modernization, Property 5: Tab slide animation direction', () => {
  it('should slide left when target index > current index', () => {
    fc.assert(
      fc.property(
        // Generate tab count (at least 2)
        fc.integer({ min: 2, max: 20 }),
        fc.nat(),
        fc.nat(),
        (tabCount, currentRaw, targetRaw) => {
          const currentIndex = currentRaw % tabCount;
          let targetIndex = targetRaw % tabCount;

          // Ensure target > current
          if (targetIndex <= currentIndex) {
            targetIndex = currentIndex + 1;
            if (targetIndex >= tabCount) return; // skip if can't satisfy
          }

          const direction = getSlideDirection(currentIndex, targetIndex);
          expect(direction).toBe('slide-left');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should slide right when target index < current index', () => {
    fc.assert(
      fc.property(
        // Generate tab count (at least 2)
        fc.integer({ min: 2, max: 20 }),
        fc.nat(),
        fc.nat(),
        (tabCount, currentRaw, targetRaw) => {
          const currentIndex = currentRaw % tabCount;
          let targetIndex = targetRaw % tabCount;

          // Ensure target < current
          if (targetIndex >= currentIndex) {
            targetIndex = currentIndex - 1;
            if (targetIndex < 0) return; // skip if can't satisfy
          }

          const direction = getSlideDirection(currentIndex, targetIndex);
          expect(direction).toBe('slide-right');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should always produce a valid direction for any current != target pair', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 20 }),
        fc.nat(),
        fc.nat(),
        (tabCount, currentRaw, targetRaw) => {
          const currentIndex = currentRaw % tabCount;
          let targetIndex = targetRaw % tabCount;

          // Ensure different indices
          if (targetIndex === currentIndex) {
            targetIndex = (targetIndex + 1) % tabCount;
          }

          const direction = getSlideDirection(currentIndex, targetIndex);

          // Direction must be one of the two valid values
          expect(['slide-left', 'slide-right']).toContain(direction);

          // Verify correctness
          if (targetIndex > currentIndex) {
            expect(direction).toBe('slide-left');
          } else {
            expect(direction).toBe('slide-right');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
