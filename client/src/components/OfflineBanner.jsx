import React, { useState, useEffect, useCallback, useRef } from 'react';
import './OfflineBanner.css';

/**
 * OfflineBanner - Displays an inline message when the device is offline.
 * On reconnection, triggers a data refresh with up to 3 retries at 5-second intervals.
 *
 * Props:
 * - onReconnect: optional callback invoked when connectivity is restored and data should be refreshed
 */
export default function OfflineBanner({ onReconnect }) {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef(null);

  const MAX_RETRIES = 3;
  const RETRY_INTERVAL_MS = 5000;

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const attemptReconnect = useCallback(async () => {
    if (!onReconnect) return;

    try {
      await onReconnect();
      retryCountRef.current = 0;
    } catch (error) {
      retryCountRef.current += 1;
      if (retryCountRef.current < MAX_RETRIES) {
        retryTimerRef.current = setTimeout(attemptReconnect, RETRY_INTERVAL_MS);
      }
    }
  }, [onReconnect]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      retryCountRef.current = 0;
      attemptReconnect();
    };

    const handleOffline = () => {
      setIsOffline(true);
      clearRetryTimer();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearRetryTimer();
    };
  }, [attemptReconnect, clearRetryTimer]);

  if (!isOffline) {
    return null;
  }

  return (
    <div className="offline-banner" role="alert" aria-live="polite">
      <span className="offline-banner__icon" aria-hidden="true">⚠️</span>
      <span className="offline-banner__message">
        You're offline — live data is unavailable
      </span>
    </div>
  );
}
