import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './index.css';

// HashRouter: works identically in a browser (PWA) and in Electron (app://).
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);

// Offline-first PWA: register the service worker only over http(s), and never
// in dev — the cache-first asset handler (with ignoreSearch) would serve stale
// modules to Vite's HMR queries (`?t=…`) and break hot reload.
if (!import.meta.env.DEV
  && 'serviceWorker' in navigator
  && /^https?:$/.test(window.location.protocol)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
