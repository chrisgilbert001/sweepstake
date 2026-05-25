import { useState, useEffect } from 'react';

/**
 * CountdownTimer component that displays a live countdown (HH:MM:SS) to a kickoff time.
 * Transitions to "LIVE" when kickoff time is reached.
 *
 * @param {{ kickoffTime: string, status?: string }} props
 * - kickoffTime: ISO 8601 date string of the fixture kickoff
 * - status: optional fixture status ('completed' | 'scheduled')
 */
export default function CountdownTimer({ kickoffTime, status }) {
  const [timeRemaining, setTimeRemaining] = useState(null);

  useEffect(() => {
    if (status === 'completed') return;

    function calculateRemaining() {
      const now = new Date();
      const kickoff = new Date(kickoffTime);
      const diff = kickoff - now;
      return diff;
    }

    setTimeRemaining(calculateRemaining());

    const interval = setInterval(() => {
      setTimeRemaining(calculateRemaining());
    }, 1000);

    return () => clearInterval(interval);
  }, [kickoffTime, status]);

  if (status === 'completed') {
    return <span className="countdown-status countdown-completed">FT</span>;
  }

  if (timeRemaining === null) {
    return null;
  }

  if (timeRemaining <= 0) {
    return <span className="countdown-status countdown-live">LIVE</span>;
  }

  const totalSeconds = Math.floor(timeRemaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const formatted = [
    String(hours).padStart(2, '0'),
    String(minutes).padStart(2, '0'),
    String(seconds).padStart(2, '0'),
  ].join(':');

  return <span className="countdown-status countdown-timer">{formatted}</span>;
}
