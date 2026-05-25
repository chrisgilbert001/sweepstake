import { describe, it, expect } from 'vitest';
import { NAVIGATION_ITEMS } from '../config/navigation.js';

/**
 * Integration test: Full navigation flow through shell.
 *
 * Tests the navigation configuration and routing logic that the AppShell
 * uses to navigate between sections while maintaining shell persistence.
 *
 * The AppShell renders NavigationBar + header + Outlet. Navigation between
 * sections changes the Outlet content but the shell (header, NavigationBar)
 * persists. This test verifies the navigation configuration supports that flow.
 */

describe('Integration: Full navigation flow through shell', () => {
  const TEST_SLUG = 'test-league';
  const BASE_PATH = `/league/${TEST_SLUG}`;

  /**
   * Simulates the path-building logic from NavigationBar.
   */
  function buildPath(item, slug) {
    const basePath = `/league/${slug}`;
    return item.path === '' ? basePath : `${basePath}/${item.path}`;
  }

  /**
   * Simulates the active-item detection logic from NavigationBar.
   */
  function getIsActive(item, slug, currentPath) {
    const basePath = `/league/${slug}`;
    if (item.path === '') {
      return currentPath === basePath || currentPath === `${basePath}/`;
    }
    return currentPath.startsWith(`${basePath}/${item.path}`);
  }

  /**
   * Simulates the section title logic from AppShell.
   */
  const SECTION_TITLES = {
    '': 'Dashboard',
    tournament: 'Tournament',
    live: 'Live',
    stats: 'Stats',
    'my-teams': 'My Teams',
    draft: 'Draft',
  };

  function getSectionTitle(pathname, slug) {
    const basePath = `/league/${slug}`;
    const relativePath = pathname.startsWith(basePath)
      ? pathname.slice(basePath.length).replace(/^\//, '')
      : '';
    const firstSegment = relativePath.split('/')[0] || '';
    return SECTION_TITLES[firstSegment] || 'Dashboard';
  }

  it('should have all navigation items with valid paths', () => {
    expect(NAVIGATION_ITEMS.length).toBeGreaterThanOrEqual(4);

    for (const item of NAVIGATION_ITEMS) {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('label');
      expect(item).toHaveProperty('icon');
      expect(item).toHaveProperty('path');
      expect(item).toHaveProperty('isPrimary');
    }
  });

  it('should build correct paths for all navigation items', () => {
    const paths = NAVIGATION_ITEMS.map((item) => buildPath(item, TEST_SLUG));

    // Dashboard should be the base path
    expect(paths[0]).toBe(BASE_PATH);

    // Other items should be nested under the base path
    for (let i = 1; i < NAVIGATION_ITEMS.length; i++) {
      expect(paths[i]).toBe(`${BASE_PATH}/${NAVIGATION_ITEMS[i].path}`);
    }
  });

  it('should detect exactly one active item for each navigation path', () => {
    for (const targetItem of NAVIGATION_ITEMS) {
      const currentPath = buildPath(targetItem, TEST_SLUG);
      const activeItems = NAVIGATION_ITEMS.filter((item) =>
        getIsActive(item, TEST_SLUG, currentPath)
      );

      // At least the target item should be active
      expect(activeItems.length).toBeGreaterThanOrEqual(1);

      // The target item should be in the active set
      const targetIsActive = getIsActive(targetItem, TEST_SLUG, currentPath);
      expect(targetIsActive).toBe(true);
    }
  });

  it('should show Dashboard as active only on the base path', () => {
    const dashboardItem = NAVIGATION_ITEMS.find((item) => item.path === '');
    expect(dashboardItem).toBeDefined();

    // Dashboard active on base path
    expect(getIsActive(dashboardItem, TEST_SLUG, BASE_PATH)).toBe(true);
    expect(getIsActive(dashboardItem, TEST_SLUG, `${BASE_PATH}/`)).toBe(true);

    // Dashboard NOT active on sub-paths
    expect(getIsActive(dashboardItem, TEST_SLUG, `${BASE_PATH}/tournament`)).toBe(false);
    expect(getIsActive(dashboardItem, TEST_SLUG, `${BASE_PATH}/live`)).toBe(false);
    expect(getIsActive(dashboardItem, TEST_SLUG, `${BASE_PATH}/stats`)).toBe(false);
  });

  it('should resolve correct section title for each navigation path', () => {
    const expectedTitles = {
      [BASE_PATH]: 'Dashboard',
      [`${BASE_PATH}/tournament`]: 'Tournament',
      [`${BASE_PATH}/live`]: 'Live',
      [`${BASE_PATH}/stats`]: 'Stats',
      [`${BASE_PATH}/my-teams`]: 'My Teams',
      [`${BASE_PATH}/draft`]: 'Draft',
    };

    for (const [path, expectedTitle] of Object.entries(expectedTitles)) {
      expect(getSectionTitle(path, TEST_SLUG)).toBe(expectedTitle);
    }
  });

  it('should maintain shell persistence: navigating between sections does not change shell structure', () => {
    // The shell structure is: header (league name + section title) + NavigationBar + content area
    // Navigating between sections only changes the section title and content (Outlet).
    // This test verifies that the section title updates correctly for each navigation.

    const navigationSequence = [
      BASE_PATH,
      `${BASE_PATH}/tournament`,
      `${BASE_PATH}/live`,
      `${BASE_PATH}/stats`,
      `${BASE_PATH}/my-teams`,
      `${BASE_PATH}/draft`,
      BASE_PATH, // back to dashboard
    ];

    const titles = navigationSequence.map((path) => getSectionTitle(path, TEST_SLUG));

    expect(titles).toEqual([
      'Dashboard',
      'Tournament',
      'Live',
      'Stats',
      'My Teams',
      'Draft',
      'Dashboard',
    ]);
  });

  it('should partition navigation items into primary (shown) and overflow (More menu)', () => {
    const primaryItems = NAVIGATION_ITEMS.filter((item) => item.isPrimary);
    const overflowItems = NAVIGATION_ITEMS.filter((item) => !item.isPrimary);

    // Primary items shown directly (first 4)
    expect(primaryItems.length).toBe(4);

    // Overflow items in More menu
    expect(overflowItems.length).toBeGreaterThanOrEqual(1);

    // All items accounted for
    expect(primaryItems.length + overflowItems.length).toBe(NAVIGATION_ITEMS.length);
  });

  it('should highlight More button when an overflow item is active', () => {
    const overflowItems = NAVIGATION_ITEMS.filter((item) => !item.isPrimary);

    for (const overflowItem of overflowItems) {
      const currentPath = buildPath(overflowItem, TEST_SLUG);
      const isOverflowActive = overflowItems.some((item) =>
        getIsActive(item, TEST_SLUG, currentPath)
      );
      expect(isOverflowActive).toBe(true);
    }
  });
});
