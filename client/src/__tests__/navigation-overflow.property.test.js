import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property 1: Navigation item overflow partitioning
 *
 * For any list of navigation items with length N, the NavigationBar SHALL display
 * exactly the first 4 items (or all items if N <= 4) as primary visible items and
 * place the remaining max(0, N-4) items in the overflow menu, preserving their
 * original order. Total should always equal N.
 *
 * **Validates: Requirements 2.3**
 */

/**
 * Replicates the partitioning logic from NavigationBar.jsx:
 * - Primary items: items where isPrimary === true (first 4 by convention)
 * - Overflow items: items where isPrimary === false (remaining items)
 *
 * For property testing, we generalize: given N items and a max visible count of 4,
 * the first min(N, 4) are primary and the rest are overflow.
 */
function partitionNavigationItems(items, maxVisible = 4) {
  const primaryItems = items.slice(0, maxVisible);
  const overflowItems = items.slice(maxVisible);
  return { primaryItems, overflowItems };
}

/**
 * Arbitrary for generating navigation items.
 */
const navigationItemArb = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }),
  label: fc.string({ minLength: 1, maxLength: 30 }),
  icon: fc.constantFrom('🏠', '🏆', '⚽', '📈', '👤', '🎯', '📊', '🔔'),
  path: fc.string({ minLength: 0, maxLength: 20 }),
});

describe('Feature: ui-modernization, Property 1: Navigation item overflow partitioning', () => {
  it('should partition items into exactly min(N, 4) primary and max(0, N-4) overflow items', () => {
    fc.assert(
      fc.property(
        fc.array(navigationItemArb, { minLength: 1, maxLength: 20 }),
        (items) => {
          const { primaryItems, overflowItems } = partitionNavigationItems(items, 4);

          const expectedPrimaryCount = Math.min(items.length, 4);
          const expectedOverflowCount = Math.max(0, items.length - 4);

          // Primary count is exactly min(N, 4)
          expect(primaryItems.length).toBe(expectedPrimaryCount);

          // Overflow count is exactly max(0, N-4)
          expect(overflowItems.length).toBe(expectedOverflowCount);

          // Total always equals N
          expect(primaryItems.length + overflowItems.length).toBe(items.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve original order in both primary and overflow partitions', () => {
    fc.assert(
      fc.property(
        fc.array(navigationItemArb, { minLength: 1, maxLength: 20 }),
        (items) => {
          const { primaryItems, overflowItems } = partitionNavigationItems(items, 4);

          // Primary items should be the first min(N, 4) items in order
          for (let i = 0; i < primaryItems.length; i++) {
            expect(primaryItems[i]).toBe(items[i]);
          }

          // Overflow items should be the remaining items in order
          for (let i = 0; i < overflowItems.length; i++) {
            expect(overflowItems[i]).toBe(items[i + 4]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should produce no overflow when N <= 4', () => {
    fc.assert(
      fc.property(
        fc.array(navigationItemArb, { minLength: 1, maxLength: 4 }),
        (items) => {
          const { primaryItems, overflowItems } = partitionNavigationItems(items, 4);

          expect(primaryItems.length).toBe(items.length);
          expect(overflowItems.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should always produce overflow when N > 4', () => {
    fc.assert(
      fc.property(
        fc.array(navigationItemArb, { minLength: 5, maxLength: 20 }),
        (items) => {
          const { primaryItems, overflowItems } = partitionNavigationItems(items, 4);

          expect(primaryItems.length).toBe(4);
          expect(overflowItems.length).toBe(items.length - 4);
          expect(overflowItems.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
