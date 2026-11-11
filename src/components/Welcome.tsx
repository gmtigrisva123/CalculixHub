/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Suspense, startTransition, useEffect, useState } from 'react';
import type { Level } from '../../shared/types';
import { useAuth } from '../context/AuthContext';
import { lazyWithPreload, whenIdle } from '../lib/lazy';
import { bootVariant } from '../boot/boot';
import BootLift, { BootHold } from '../boot/BootLift';
import { initialConfirmationElsewhere, initialEmailConfirmation, initialPasswordRecovery } from '../services/socialAuth';

/*
 * Two pieces of code, fetched separately.
 *
 * The landing page is what a first-time visitor sees, and it is all they
 * should have to download. Sign-in, sign-up and the placement test come with
 * the adaptive engine, its item bank and the maths typesetter: a large bundle
 * that most landing visits never use. It loads when someone asks for it, and
 * in the background once the landing page has settled, so the form is already
 * there by the time a button is pressed.
 */
export const LandingPage = lazyWithPreload(() => import('./landing/LandingPage'));
export const AuthFlow = lazyWithPreload(() => import('./WelcomeScreen'));

if (bootVariant === 'landing') void LandingPage.preload();
if (bootVariant === 'paper') void AuthFlow.preload();

const NO_STATS = { registeredUsers: 0, testsCompleted: 0, problemsSolved: 0 };

/** True when this page load opens on the landing page rather than on a form. */
const opensOnLanding = (): boolean =>
  !initialPasswordRecovery && !initialConfirmationElsewhere && !initialEmailConfirmation
  && new URLSearchParams(window.location.search).get('auth') !== 'signup';

interface WelcomeProps {
  onLoginSuccess: (name: string, level: Level) => void;
}

export default function Welcome({ onLoginSuccess }: WelcomeProps) {
  const { authError, status, hasOnboarded } = useAuth();
  const [requested, setRequested] = useState<'login' | 'register' | null>(null);
  // Once the forms have been shown they own the rest of the visit, including
  // the way back to the landing page, so they are never unmounted again.
  const [inFlow, setInFlow] = useState(() => !opensOnLanding());
  const mustFlow = Boolean(authError) || (status === 'authenticated' && !hasOnboarded);
  if ((mustFlow || requested) && !inFlow) setInFlow(true);

  // Fetch the forms well after the landing page has drawn and settled: they are
  // not needed until a button is pressed, and pressing one fetches them anyway.
  useEffect(() => {
    if (inFlow) return;
    let cancelIdle = () => {};
    const timer = window.setTimeout(() => { cancelIdle = whenIdle(() => void AuthFlow.preload(), 4000); }, 5000);
    return () => { window.clearTimeout(timer); cancelIdle(); };
  }, [inFlow]);

  const open = (mode: 'login' | 'register') => {
    void AuthFlow.preload();
    // A transition keeps the landing page on screen until the form is ready
    // to draw, instead of blanking the page while its code arrives.
    startTransition(() => setRequested(mode));
  };

  if (inFlow) {
    return (
      <Suspense fallback={<BootHold label="Opening sign-in…" />}>
        <AuthFlow onLoginSuccess={onLoginSuccess} initialMode={requested ?? undefined} />
        <BootLift />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={null}>
      <LandingPage liveStats={NO_STATS} onSignIn={() => open('login')} onRegister={() => open('register')} />
      <BootLift />
    </Suspense>
  );
}
