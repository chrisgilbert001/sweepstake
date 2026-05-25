import { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import { get } from '../api/client.js';
import './ShareExportButtons.css';

/**
 * ShareExportButtons provides "Share" (copy text to clipboard) and "Export as Image" (PNG download)
 * buttons for the standings view.
 *
 * Props:
 * - leagueSlug: string - the league slug for API calls and filename
 * - leagueName: string - the league name for display in headers
 * - standingsRef: React ref - ref to the standings table DOM element for image capture
 */
export default function ShareExportButtons({ leagueSlug, leagueName, standingsRef }) {
  const [copyStatus, setCopyStatus] = useState('idle'); // 'idle' | 'copied' | 'fallback'
  const [fallbackText, setFallbackText] = useState('');
  const [exporting, setExporting] = useState(false);
  const textareaRef = useRef(null);

  function formatDate() {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  function formatISODate() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  async function handleShare() {
    try {
      const text = await get(`/leagues/${leagueSlug}/standings/export`);

      // Try clipboard API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(text);
          setCopyStatus('copied');
          setTimeout(() => setCopyStatus('idle'), 3000);
          return;
        } catch {
          // Clipboard write failed, fall through to fallback
        }
      }

      // Fallback: show text in a read-only textarea
      setFallbackText(text);
      setCopyStatus('fallback');
    } catch (err) {
      console.error('Failed to fetch standings text:', err);
    }
  }

  async function handleExportImage() {
    if (!standingsRef?.current || exporting) return;

    setExporting(true);
    try {
      // Create a wrapper element with header for the image
      const wrapper = document.createElement('div');
      wrapper.style.padding = '24px';
      wrapper.style.backgroundColor = '#ffffff';
      wrapper.style.maxWidth = '800px';
      wrapper.style.fontFamily = 'system-ui, -apple-system, sans-serif';

      // Add header with league name and date
      const header = document.createElement('div');
      header.style.marginBottom = '16px';
      header.style.textAlign = 'center';

      const title = document.createElement('h2');
      title.textContent = leagueName;
      title.style.margin = '0 0 4px 0';
      title.style.fontSize = '20px';
      title.style.color = '#1a1a2e';

      const dateEl = document.createElement('p');
      dateEl.textContent = formatDate();
      dateEl.style.margin = '0';
      dateEl.style.fontSize = '14px';
      dateEl.style.color = '#666';

      header.appendChild(title);
      header.appendChild(dateEl);
      wrapper.appendChild(header);

      // Clone the standings table
      const tableClone = standingsRef.current.cloneNode(true);
      // Remove any popup overlays from the clone
      const popups = tableClone.querySelectorAll('.participant-popup-overlay');
      popups.forEach((p) => p.remove());
      wrapper.appendChild(tableClone);

      // Temporarily add to DOM (off-screen) for html2canvas
      wrapper.style.position = 'absolute';
      wrapper.style.left = '-9999px';
      wrapper.style.top = '0';
      document.body.appendChild(wrapper);

      const canvas = await html2canvas(wrapper, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        width: Math.min(wrapper.scrollWidth, 800),
      });

      // Clean up
      document.body.removeChild(wrapper);

      // Trigger download
      const link = document.createElement('a');
      link.download = `standings-${leagueSlug}-${formatISODate()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Failed to export image:', err);
    } finally {
      setExporting(false);
    }
  }

  function handleCloseFallback() {
    setCopyStatus('idle');
    setFallbackText('');
  }

  return (
    <div className="share-export-buttons">
      <div className="share-export-buttons__actions">
        <button
          className="share-btn"
          onClick={handleShare}
          aria-label="Share standings as text"
        >
          📋 Share
        </button>
        <button
          className="export-btn"
          onClick={handleExportImage}
          disabled={exporting}
          aria-label="Export standings as PNG image"
        >
          {exporting ? '⏳ Exporting...' : '📸 Export as Image'}
        </button>
      </div>

      {copyStatus === 'copied' && (
        <div className="share-export-buttons__confirmation" role="status" aria-live="polite">
          ✓ Copied!
        </div>
      )}

      {copyStatus === 'fallback' && (
        <div className="share-export-buttons__fallback">
          <div className="fallback-header">
            <span>Copy the text below:</span>
            <button
              className="fallback-close"
              onClick={handleCloseFallback}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <textarea
            ref={textareaRef}
            className="fallback-textarea"
            readOnly
            value={fallbackText}
            rows={8}
            onClick={(e) => e.target.select()}
          />
        </div>
      )}
    </div>
  );
}
