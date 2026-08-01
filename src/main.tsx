import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {registerServiceWorker} from './lib/pwa';
import { Analytics } from "@vercel/analytics/react";
import MotionProvider from './components/motion/MotionProvider';
import { AuthProvider } from './context/AuthContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/*
      AuthProvider is outermost: the session is restored once, before anything
      renders a signed-out view, and every consumer -- including the motion
      runtime's route transitions -- sees the same resolved state. Mounting it
      lower would mean each consumer re-deriving the session and flashing the
      landing page on refresh.

      MotionProvider sits inside it so the landing page, the authenticated
      shell and every overlay share one motion runtime, one reduced-motion
      decision, and one lazily-loaded feature bundle.
    */}
    <AuthProvider>
      <MotionProvider>
        <App />
      </MotionProvider>
    </AuthProvider>
    <Analytics />
  </StrictMode>,
);

// Enables offline support and makes the app installable. No-ops in dev and on
// browsers without service worker support.
registerServiceWorker();
