import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {registerServiceWorker} from './lib/pwa';
import { Analytics } from "@vercel/analytics/react";
import MotionProvider from './components/motion/MotionProvider';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { SpeedInsights } from "@vercel/speed-insights/react";

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

      ThemeProvider sits between the two. It has to be inside nothing in
      particular -- it writes to <html> rather than rendering chrome -- but it
      must wrap everything that reads `useTheme`, and putting it above
      MotionProvider means the theme is resolved before the first animated
      surface mounts. The document already carries the correct theme by this
      point: the inline boot script in index.html applied it before paint, and
      this provider takes ownership of it from here.
    */}
    <AuthProvider>
      <ThemeProvider>
        <MotionProvider>
          <App />
        </MotionProvider>
      </ThemeProvider>
    </AuthProvider>
    <Analytics />
    <SpeedInsights />
  </StrictMode>,
);

// Enables offline support and makes the app installable. No-ops in dev and on
// browsers without service worker support.
registerServiceWorker();
