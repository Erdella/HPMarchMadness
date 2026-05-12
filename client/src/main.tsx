import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

// Build marker — bump this to force a new bundle hash if CF Pages serves a
// stale/corrupt content-addressed asset. (See deploy notes in DEPLOY.md.)
const BUILD_ID = '2026-05-11-004-final-four-pairings';
console.log(`HP March Madness build ${BUILD_ID}`);

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root element in index.html');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
