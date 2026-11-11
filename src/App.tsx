/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Suspense, lazy, useState } from 'react';
import type { Level } from '../shared/types';
import { useAuth } from './context/AuthContext';
import { lazyWithPreload } from './lib/lazy';
import { openingTab, preloadScreen } from './lib/screens';
import { bootVariant } from './boot/boot';
import BootLift, { BootHold } from './boot/BootLift';
import Welcome from './components/Welcome';

const IPhonePrototype = lazy(() => import('./components/prototype/IPhonePrototype'));
const Workspace = lazyWithPreload(() => import('./components/Workspace'));

/*
 * The entry bundle holds only what every visit needs: React, the session, and
 * this gate. What sits behind the gate is fetched separately, and started here,
 * as this file is evaluated, so the download overlaps React's own start-up
 * instead of waiting for the first render to ask for it. index.html has
 * already worked out which side of the gate this visit is headed for.
 */
if (bootVariant === 'workspace') {
  void Workspace.preload();
  preloadScreen(openingTab());
}

export default function App() {
  return new URLSearchParams(window.location.search).get('preview') === 'ios'
    ? <Suspense fallback={<BootHold label="Opening your pocket-sized learning space…" />}><IPhonePrototype /><BootLift /></Suspense>
    : <LearningApp />;
}

function LearningApp() {
  /**
   * Authentication.
   *
   * The session is a server-signed JWT that Supabase verifies on every request
   * and that every row-level security policy reads. `status` distinguishes
   * "still restoring" from "definitely signed out", which is what stops a
   * refresh flashing the landing page at a signed-in learner before the
   * session is rehydrated.
   */
  const { status: authStatus, authError, hasOnboarded, confirmedElsewhere } = useAuth();
  const isLoggedIn = authStatus === 'authenticated';

  const [guestAllowed, setGuestAllowed] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('home') || params.has('auth') || params.has('code') || params.has('error') || window.location.hash.includes('error=')) return false;
    return params.get('demo') === '1' || localStorage.getItem('calculix_guest_access') === 'true';
  });

  const handleLoginSuccess = (_name: string, _level: Level) => {
    const destination = new URL(window.location.href);
    destination.searchParams.delete('auth');
    window.history.replaceState(null, '', destination.pathname + destination.search + destination.hash);
    localStorage.setItem('calculix_guest_access', 'true');
    setGuestAllowed(true);
  };

  // Still restoring a stored session. The cover from index.html is on screen,
  // so there is nothing to draw underneath it yet.
  if (authStatus === 'loading') return null;

  const params = new URLSearchParams(window.location.search);
  const registrationRequested = params.get('auth') === 'signup';
  const recoveryRequested = params.get('recovery') === '1';
  if (confirmedElsewhere || (registrationRequested && !isLoggedIn) || recoveryRequested || (!isLoggedIn && (!guestAllowed || authError)) || (isLoggedIn && !hasOnboarded)) {
    return <Welcome onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <Suspense fallback={<BootHold label="Opening your learning space…" />}>
      <Workspace onSignedOut={() => setGuestAllowed(false)} />
    </Suspense>
  );
}
