import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { NAVIGATION_ITEMS } from '../../config/navigation.js';
import './NavigationBar.css';

/**
 * NavigationBar — responsive navigation with overflow handling.
 *
 * Desktop (>768px): horizontal top bar with labeled icons.
 * Mobile (≤768px): fixed bottom tab bar with icons + compact labels.
 *
 * Shows first 4 primary items directly; remaining items in a "More" overflow menu.
 *
 * @param {object} props
 * @param {string} props.leagueSlug - The current league slug for building paths
 * @param {Array} props.participants - Participants array (for My Teams dropdown context)
 */
export default function NavigationBar({ leagueSlug, participants = [] }) {
  const location = useLocation();
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [pressedItem, setPressedItem] = useState(null);
  const overflowRef = useRef(null);
  const moreButtonRef = useRef(null);

  // Partition items: primary (first 4 with isPrimary) shown directly, rest in overflow
  const primaryItems = NAVIGATION_ITEMS.filter((item) => item.isPrimary);
  const overflowItems = NAVIGATION_ITEMS.filter((item) => !item.isPrimary);

  // Determine active item based on current pathname
  const getIsActive = useCallback(
    (item) => {
      const basePath = `/league/${leagueSlug}`;
      const currentPath = location.pathname;

      if (item.path === '') {
        // Dashboard matches exact base path or base path with trailing slash
        return currentPath === basePath || currentPath === `${basePath}/`;
      }

      return currentPath.startsWith(`${basePath}/${item.path}`);
    },
    [leagueSlug, location.pathname]
  );

  // Dismiss overflow on outside click
  useEffect(() => {
    if (!overflowOpen) return;

    const handleClickOutside = (event) => {
      if (
        overflowRef.current &&
        !overflowRef.current.contains(event.target) &&
        moreButtonRef.current &&
        !moreButtonRef.current.contains(event.target)
      ) {
        setOverflowOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [overflowOpen]);

  // Dismiss overflow on route change
  useEffect(() => {
    setOverflowOpen(false);
  }, [location.pathname]);

  const toggleOverflow = () => {
    setOverflowOpen((prev) => !prev);
  };

  const handleOverflowItemClick = () => {
    setOverflowOpen(false);
  };

  // Press feedback handlers
  const handlePressStart = (itemId) => {
    setPressedItem(itemId);
  };

  const handlePressEnd = () => {
    setPressedItem(null);
  };

  const buildPath = (item) => {
    const basePath = `/league/${leagueSlug}`;
    return item.path === '' ? basePath : `${basePath}/${item.path}`;
  };

  const renderNavItem = (item) => {
    const isActive = getIsActive(item);
    const isPressed = pressedItem === item.id;
    const Icon = item.icon;

    const className = [
      'nav-item',
      isActive ? 'nav-item--active' : '',
      isPressed ? 'nav-item--pressed' : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <Link
        key={item.id}
        to={buildPath(item)}
        className={className}
        aria-current={isActive ? 'page' : undefined}
        onMouseDown={() => handlePressStart(item.id)}
        onTouchStart={() => handlePressStart(item.id)}
        onMouseUp={handlePressEnd}
        onTouchEnd={handlePressEnd}
        onMouseLeave={handlePressEnd}
      >
        <span className="nav-item__icon" aria-hidden="true">
          <Icon />
        </span>
        <span className="nav-item__label">{item.label}</span>
      </Link>
    );
  };

  // Check if any overflow item is active (to highlight the More button)
  const isOverflowActive = overflowItems.some((item) => getIsActive(item));

  return (
    <nav className="navigation-bar" aria-label="League navigation">
      <div className="navigation-bar__items">
        {primaryItems.map(renderNavItem)}

        {overflowItems.length > 0 && (
          <div className="nav-overflow-container">
            <button
              ref={moreButtonRef}
              type="button"
              className={[
                'nav-item',
                'nav-item--more',
                overflowOpen ? 'nav-item--active' : '',
                isOverflowActive ? 'nav-item--active' : '',
                pressedItem === 'more' ? 'nav-item--pressed' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={toggleOverflow}
              onMouseDown={() => handlePressStart('more')}
              onTouchStart={() => handlePressStart('more')}
              onMouseUp={handlePressEnd}
              onTouchEnd={handlePressEnd}
              onMouseLeave={handlePressEnd}
              aria-expanded={overflowOpen}
              aria-haspopup="true"
              aria-label="More navigation options"
            >
              <span className="nav-item__icon" aria-hidden="true">
                ⋯
              </span>
              <span className="nav-item__label">More</span>
            </button>

            {overflowOpen && (
              <div
                ref={overflowRef}
                className="nav-overflow-panel"
                role="menu"
              >
                {overflowItems.map((item) => {
                  const isActive = getIsActive(item);
                  const isPressed = pressedItem === item.id;
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.id}
                      to={buildPath(item)}
                      className={[
                        'nav-overflow-item',
                        isActive ? 'nav-overflow-item--active' : '',
                        isPressed ? 'nav-item--pressed' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      role="menuitem"
                      onClick={handleOverflowItemClick}
                      onMouseDown={() => handlePressStart(item.id)}
                      onTouchStart={() => handlePressStart(item.id)}
                      onMouseUp={handlePressEnd}
                      onTouchEnd={handlePressEnd}
                      onMouseLeave={handlePressEnd}
                    >
                      <span
                        className="nav-overflow-item__icon"
                        aria-hidden="true"
                      >
                        <Icon />
                      </span>
                      <span className="nav-overflow-item__label">
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
