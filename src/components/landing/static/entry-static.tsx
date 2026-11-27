/**
 * Build entry for the landing's static first frame (scripts/landing-static-plugin.mjs).
 *
 * Renders the live page's own components, in static mode (../staticMode.tsx),
 * inside the same motion setup the app uses, so the HTML a first visit paints
 * is the markup the live page will render over it. Below the first two screens
 * comes the reading version of the chapters, for visitors without JavaScript.
 *
 * Runs in Node at build time only; nothing here ships to the browser.
 */

import { renderToStaticMarkup } from 'react-dom/server';
import MotionProvider from '../../motion/MotionProvider';
import LandingPage from '../LandingPage';
import { StaticRender } from '../staticMode';
import LandingReading from './LandingReading';
import { landingJsonLd } from './jsonLd';

const nothing = () => {};

export function renderLandingStatic(): { markup: string; jsonLd: object[] } {
  const markup = renderToStaticMarkup(
    <MotionProvider>
      <StaticRender>
        <LandingPage
          liveStats={{ registeredUsers: 0, testsCompleted: 0, problemsSolved: 0 }}
          onSignIn={nothing}
          onRegister={nothing}
          readingVersion={<LandingReading />}
        />
      </StaticRender>
    </MotionProvider>,
  );
  return { markup, jsonLd: landingJsonLd() };
}
