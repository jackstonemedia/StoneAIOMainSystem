import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initSentry } from './lib/sentry.ts';

// Error monitoring (B-2): no-op when VITE_SENTRY_DSN is unset.
initSentry();

// Automatically handle stale dynamic import chunk errors on redeployment or Vite rebuilds
window.addEventListener('vite:preloadError', () => {
  window.location.reload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
