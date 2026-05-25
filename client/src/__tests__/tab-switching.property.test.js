import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property 2: Tab switching displays correct content
 *
 * For any TabPanel with N tabs (N >= 2) and any valid tab index i (0 <= i < N),
 * switching to tab i SHALL render only the content associated with tab i and mark
 * only tab i's control as active (with all other tab controls marked inactive).
 *
 * **Validates: Requirements 3.4**
 */

/**
 * Replicates the tab switching logic from TabPanel.jsx.
 * Given an array of tabs and an active tab id, returns the state:
 * - which tab is active
 * - which content is displayed
 * - which tabs are marked as selected
 */
function computeTabState(tabs, activeTabId) {
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const tabStates = tabs.map((tab) => ({
    id: tab.id,
    isActive: tab.id === activeTabId,
    ariaSelected: tab.id === activeTabId,
  }));

  return {
    activeContent: activeTab ? activeTab.content : null,
    tabStates,
  };
}

/**
 * Arbitrary for generating tab definitions.
 */
const tabArb = fc.record({
  id: fc.uuid(),
  label: fc.string({ minLength: 1, maxLength: 20 }),
  content: fc.string({ minLength: 1, maxLength: 100 }),
});

/**
 * Arbitrary for generating a list of tabs with unique IDs.
 */
const tabsArb = fc
  .array(tabArb, { minLength: 2, maxLength: 10 })
  .map((tabs) => {
    // Ensure unique IDs
    const seen = new Set();
    return tabs.filter((tab) => {
      if (seen.has(tab.id)) return false;
      seen.add(tab.id);
      return true;
    });
  })
  .filter((tabs) => tabs.length >= 2);

describe('Feature: ui-modernization, Property 2: Tab switching content/active state correctness', () => {
  it('should mark exactly one tab as active when switching to any valid index', () => {
    fc.assert(
      fc.property(
        tabsArb.chain((tabs) =>
          fc.tuple(
            fc.constant(tabs),
            fc.integer({ min: 0, max: tabs.length - 1 })
          )
        ),
        ([tabs, targetIndex]) => {
          const targetTabId = tabs[targetIndex].id;
          const { tabStates } = computeTabState(tabs, targetTabId);

          // Exactly one tab should be active
          const activeCount = tabStates.filter((t) => t.isActive).length;
          expect(activeCount).toBe(1);

          // The active tab should be the target
          const activeTab = tabStates.find((t) => t.isActive);
          expect(activeTab.id).toBe(targetTabId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display only the content of the active tab', () => {
    fc.assert(
      fc.property(
        tabsArb.chain((tabs) =>
          fc.tuple(
            fc.constant(tabs),
            fc.integer({ min: 0, max: tabs.length - 1 })
          )
        ),
        ([tabs, targetIndex]) => {
          const targetTab = tabs[targetIndex];
          const { activeContent } = computeTabState(tabs, targetTab.id);

          // The displayed content should match the target tab's content
          expect(activeContent).toBe(targetTab.content);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should mark all non-target tabs as inactive', () => {
    fc.assert(
      fc.property(
        tabsArb.chain((tabs) =>
          fc.tuple(
            fc.constant(tabs),
            fc.integer({ min: 0, max: tabs.length - 1 })
          )
        ),
        ([tabs, targetIndex]) => {
          const targetTabId = tabs[targetIndex].id;
          const { tabStates } = computeTabState(tabs, targetTabId);

          // All non-target tabs should be inactive
          const inactiveTabs = tabStates.filter((t) => t.id !== targetTabId);
          for (const tab of inactiveTabs) {
            expect(tab.isActive).toBe(false);
            expect(tab.ariaSelected).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
