import { useState, useEffect, useRef, useCallback } from 'react';
import './WheelSpinner.css';

/**
 * WheelSpinner component - displays a slot-machine style spinner
 * that scrolls through team names and lands on the server-selected team.
 */
export default function WheelSpinner({ availableTeams, onSpin, disabled, currentParticipantName }) {
  const [animating, setAnimating] = useState(false);
  const [result, setResult] = useState(null);
  const [displayTeams, setDisplayTeams] = useState([]);
  const stripRef = useRef(null);
  const containerRef = useRef(null);
  const animatingRef = useRef(false);

  const ITEM_HEIGHT = 64;

  // Only update the displayed teams when NOT animating
  useEffect(() => {
    if (!animatingRef.current && availableTeams && availableTeams.length > 0) {
      const repeats = 10;
      const teams = [];
      for (let i = 0; i < repeats; i++) {
        teams.push(...availableTeams);
      }
      setDisplayTeams(teams);
      setResult(null);

      if (stripRef.current) {
        stripRef.current.style.transition = 'none';
        stripRef.current.style.transform = 'translateY(0px)';
      }
    }
  }, [availableTeams]);

  const handleSpin = useCallback(async () => {
    if (animating || disabled || !availableTeams || availableTeams.length === 0) {
      return;
    }

    setAnimating(true);
    animatingRef.current = true;
    setResult(null);

    // Reset position instantly
    if (stripRef.current) {
      stripRef.current.style.transition = 'none';
      stripRef.current.style.transform = 'translateY(0px)';
    }

    // Force a reflow so the reset is applied before we start the animation
    stripRef.current?.offsetHeight;

    // Call the server to get the result
    let spinResult;
    try {
      spinResult = await onSpin();
    } catch (err) {
      setAnimating(false);
      animatingRef.current = false;
      return;
    }

    const targetTeam = spinResult.selectedTeam;

    // Find the target by scanning the actual DOM children
    const items = stripRef.current?.children;
    if (!items) {
      setAnimating(false);
      animatingRef.current = false;
      return;
    }

    // Find an occurrence of the target team far enough down for a good spin
    const minIndex = availableTeams.length * 5;
    let targetEl = null;
    let targetIndex = -1;
    for (let i = minIndex; i < items.length; i++) {
      if (items[i].dataset.teamId === targetTeam.id) {
        targetEl = items[i];
        targetIndex = i;
        break;
      }
    }
    if (!targetEl) {
      // Fallback: find first occurrence
      for (let i = 0; i < items.length; i++) {
        if (items[i].dataset.teamId === targetTeam.id) {
          targetEl = items[i];
          targetIndex = i;
          break;
        }
      }
    }

    // Calculate offset by measuring actual DOM positions
    // Get the target element's position relative to the strip
    const stripTop = stripRef.current.getBoundingClientRect().top;
    const targetTop = targetEl.getBoundingClientRect().top;
    const targetMiddle = targetTop + (ITEM_HEIGHT / 2) - stripTop;
    
    // The pointer center is at 50% of the container height
    const containerHeight = containerRef.current?.clientHeight || 320;
    const pointerCenter = containerHeight / 2;
    
    // We need to move the strip so targetMiddle aligns with pointerCenter
    // Current strip translateY is 0 (we just reset it)
    // So finalOffset = pointerCenter - targetMiddle
    const finalOffset = pointerCenter - targetMiddle;

    // Apply the animation
    requestAnimationFrame(() => {
      if (stripRef.current) {
        stripRef.current.style.transition = 'transform 3s cubic-bezier(0.15, 0.6, 0.35, 1)';
        stripRef.current.style.transform = `translateY(${finalOffset}px)`;
      }
    });

    // After animation completes, show result and unlock
    setTimeout(() => {
      setAnimating(false);
      animatingRef.current = false;
      setResult({
        team: targetTeam,
        participantName: currentParticipantName
      });
    }, 3300);
  }, [animating, disabled, availableTeams, onSpin, currentParticipantName]);

  return (
    <div className="wheel-spinner">
      <div className="wheel-container" ref={containerRef}>
        <div className="wheel-viewport">
          <div ref={stripRef} className="wheel-strip">
            {displayTeams.map((team, index) => (
              <div key={`${team.id}-${index}`} className="wheel-item" data-team-id={team.id}>
                <span className="wheel-item__seed">#{team.seedRank}</span>
                {team.name}
              </div>
            ))}
          </div>
        </div>
        <div className="wheel-pointer" />
      </div>

      <button
        className="spin-button"
        onClick={handleSpin}
        disabled={animating || disabled}
        aria-label="Spin the wheel"
      >
        {animating ? 'Spinning...' : 'Spin'}
      </button>

      <div className="wheel-result-container">
        {result && (
          <div className="wheel-result">
            <div className="wheel-result__team">
              <span className="wheel-result__seed">#{result.team.seedRank}</span>
              {result.team.name}
            </div>
            <div className="wheel-result__participant">
              Assigned to <strong>{result.participantName}</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
