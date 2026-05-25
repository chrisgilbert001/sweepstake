import { useState, useRef, useEffect, useCallback, Component } from 'react';
import './TabPanel.css';

/**
 * Error boundary for individual tab content.
 * Catches render errors and shows a fallback UI while keeping tab controls interactive.
 */
class TabErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  reset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="tab-error" role="alert">
          <p className="tab-error__message">
            Something went wrong loading this content
          </p>
          <button
            className="tab-error__retry"
            onClick={this.reset}
            type="button"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * TabPanel component — a reusable tabbed container for consolidating related views.
 *
 * @param {object} props
 * @param {Array<{ id: string, label: string, content: React.ReactNode }>} props.tabs
 * @param {string} [props.defaultTab] - ID of the initially active tab (defaults to first tab)
 * @param {boolean} [props.preserveScroll=true] - Whether to preserve scroll position per tab
 * @param {'horizontal' | 'none'} [props.animationDirection='horizontal'] - Animation style for tab transitions
 */
export default function TabPanel({
  tabs,
  defaultTab,
  preserveScroll = true,
  animationDirection = 'horizontal',
}) {
  const initialTab = defaultTab || (tabs.length > 0 ? tabs[0].id : '');
  const [activeTab, setActiveTab] = useState(initialTab);
  const [slideClass, setSlideClass] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);

  // Track previous tab index for slide direction
  const prevIndexRef = useRef(tabs.findIndex((t) => t.id === initialTab));

  // Store scroll positions per tab id
  const scrollPositions = useRef({});

  // Ref to the content container for scroll management
  const contentRef = useRef(null);

  // Ref to error boundaries for resetting on tab switch
  const errorBoundaryRef = useRef(null);

  const getTabIndex = useCallback(
    (tabId) => tabs.findIndex((t) => t.id === tabId),
    [tabs]
  );

  const handleTabSwitch = useCallback(
    (newTabId) => {
      if (newTabId === activeTab || isAnimating) return;

      const currentIndex = getTabIndex(activeTab);
      const newIndex = getTabIndex(newTabId);

      // Save current scroll position before switching
      if (preserveScroll && contentRef.current) {
        scrollPositions.current[activeTab] = contentRef.current.scrollTop;
      }

      // Determine slide direction
      if (animationDirection === 'horizontal') {
        const direction =
          newIndex > currentIndex ? 'slide-left' : 'slide-right';
        setSlideClass(`tab-content--${direction}`);
        setIsAnimating(true);
      }

      prevIndexRef.current = currentIndex;
      setActiveTab(newTabId);
    },
    [activeTab, isAnimating, getTabIndex, preserveScroll, animationDirection]
  );

  // Restore scroll position when active tab changes
  useEffect(() => {
    if (preserveScroll && contentRef.current) {
      const savedPosition = scrollPositions.current[activeTab] || 0;
      contentRef.current.scrollTop = savedPosition;
    }
  }, [activeTab, preserveScroll]);

  // Clear animation class after transition completes
  useEffect(() => {
    if (!slideClass) return;

    const timer = setTimeout(() => {
      setSlideClass('');
      setIsAnimating(false);
    }, 150);

    return () => clearTimeout(timer);
  }, [slideClass]);

  const activeTabData = tabs.find((t) => t.id === activeTab);

  return (
    <div className="tab-panel">
      <div className="tab-panel__controls" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={tab.id === activeTab}
            aria-controls={`tabpanel-${tab.id}`}
            id={`tab-${tab.id}`}
            className={`tab-panel__tab ${
              tab.id === activeTab ? 'tab-panel__tab--active' : ''
            }`}
            onClick={() => handleTabSwitch(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        ref={contentRef}
        className={`tab-panel__content ${slideClass}`}
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
      >
        <TabErrorBoundary key={activeTab} ref={errorBoundaryRef}>
          {activeTabData ? activeTabData.content : null}
        </TabErrorBoundary>
      </div>
    </div>
  );
}
