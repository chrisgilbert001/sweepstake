import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/variables.css';
import './styles/global.css';
import './styles/components.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Dynamically update manifest start_url to current page so "Add to Home Screen"
// opens directly to the user's league instead of the homepage.
function updateManifestStartUrl() {
  const manifestLink = document.querySelector('link[rel="manifest"]');
  if (!manifestLink) return;

  const currentPath = window.location.pathname;
  // Only override for league pages
  if (currentPath.startsWith('/league/')) {
    const blob = new Blob(
      [JSON.stringify({
        name: "World Cup Sweepstake",
        short_name: "Sweepstake",
        description: "World Cup Sweepstake league tracker",
        start_url: currentPath,
        display: "standalone",
        background_color: "#0b1512",
        theme_color: "#0b1512",
        icons: [
          { src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
        ]
      })],
      { type: 'application/json' }
    );
    manifestLink.href = URL.createObjectURL(blob);
  }
}

// Update manifest when the page loads.
// For SPA route changes, we observe URL mutations since React Router uses pushState.
updateManifestStartUrl();

let lastUrl = window.location.pathname;
const observer = new MutationObserver(() => {
  if (window.location.pathname !== lastUrl) {
    lastUrl = window.location.pathname;
    updateManifestStartUrl();
  }
});
observer.observe(document.body, { childList: true, subtree: true });

// Register service worker for PWA support (Requirement 8.2, 8.7)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Check for updates in background
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'activated') {
                console.log('Service worker updated and activated.');
              }
            });
          }
        });
      })
      .catch((error) => {
        // Graceful fallback: app continues without offline support (Requirement 8.7)
        console.warn('Service worker registration failed:', error);
      });
  });
}
