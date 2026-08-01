import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {registerServiceWorker} from './lib/pwa';
import { Analytics } from "@vercel/analytics/react";
import MotionProvider from './components/motion/MotionProvider';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/*
      Mounted above App so the landing page, the authenticated shell and every
      overlay share one motion runtime, one reduced-motion decision, and one
      lazily-loaded feature bundle.
    */}
    <MotionProvider>
      <App />
    </MotionProvider>
    <Analytics />
  </StrictMode>,
);

// Enables offline support and makes the app installable. No-ops in dev and on
// browsers without service worker support.
registerServiceWorker();
