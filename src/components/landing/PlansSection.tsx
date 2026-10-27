/**
 * "Plans": what is free today, and what is still being built.
 *
 * Free is the one plan that exists, so it is the one set in ink. Pro and Max
 * say "Coming soon" in their first line and list only what they would add;
 * nothing on this page charges or activates anything. The cards light under
 * the pointer.
 */

import type { ReactNode } from 'react';
import { ARCHIVE_FIGURES } from './archiveFigures';
import { Arrow, Eyebrow, Magnetic, Rise, SplitText, useSpotlight } from './kit';

const FREE_INCLUDES = [
  'Find your level',
  'Practice with full solutions',
  `All ${ARCHIVE_FIGURES.papers} past exams`,
  'Live Arena contests',
];

export default function PlansSection({ onRegister }: { onRegister: () => void }) {
  return (
    <section className="lx-plans" id="plans" data-tone="paper" aria-labelledby="lx-plans-title">
      <div className="lx-wrap">
        <header className="lx-section-head lx-section-head-split">
          <div>
            <Eyebrow index="07">Plans</Eyebrow>
            <SplitText as="h2" id="lx-plans-title" className="lx-h2" text={'Free to start.\n*More on the way.*'} />
          </div>
        </header>

        <div className="lx-plan-grid">
          <PlanCard featured delay={0}>
            <span className="lx-plan-status"><span className="lx-live" aria-hidden="true" />Available now</span>
            <h3 className="lx-plan-name">Free</h3>
            <p className="lx-plan-price"><strong>$0</strong></p>
            <ul className="lx-plan-list">
              {FREE_INCLUDES.map(item => <li key={item}><Check />{item}</li>)}
            </ul>
            <Magnetic className="lx-plan-action">
              <button type="button" className="lx-btn lx-btn-cream" onClick={onRegister}>
                <span>Create a free account</span>
                <span className="lx-btn-icon" aria-hidden="true"><Arrow /></span>
              </button>
            </Magnetic>
          </PlanCard>

          <PlanCard delay={0.08}>
            <span className="lx-plan-status">Coming soon</span>
            <h3 className="lx-plan-name">Pro</h3>
            <p className="lx-plan-price"><strong>Everything in Free, plus</strong></p>
            <ul className="lx-plan-list">
              <li><Soon />Feedback on written proofs</li>
              <li><Soon />Deeper progress reports</li>
            </ul>
            <p className="lx-plan-foot">No price yet</p>
          </PlanCard>

          <PlanCard delay={0.16}>
            <span className="lx-plan-status">Coming soon</span>
            <h3 className="lx-plan-name">Max</h3>
            <p className="lx-plan-price"><strong>Everything in Pro, plus</strong></p>
            <ul className="lx-plan-list">
              <li><Soon />Long-term study plans</li>
            </ul>
            <p className="lx-plan-foot">No price yet</p>
          </PlanCard>
        </div>
      </div>
    </section>
  );
}

function PlanCard({ children, featured = false, delay }: { children: ReactNode; featured?: boolean; delay: number }) {
  const ref = useSpotlight<HTMLDivElement>();
  return (
    <Rise className={featured ? 'lx-plan is-featured' : 'lx-plan'} delay={delay} y={44} blur={false}>
      <div ref={ref} className="lx-plan-inner lx-spot" data-tone={featured ? 'ink' : undefined}>{children}</div>
    </Rise>
  );
}

function Check() {
  return (
    <svg className="lx-check" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 8.4 6.6 11.4 12.5 4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A planned feature: an open, dashed ring where a tick will go. */
function Soon() {
  return (
    <svg className="lx-check is-soon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.4 2.2" />
    </svg>
  );
}
