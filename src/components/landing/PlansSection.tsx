/**
 * "Plans": what is free today, and what is honestly still being built.
 *
 * Free is the one plan that exists, so it is the one set in ink. Pro and Max
 * say "in development" in their first line and open a note rather than a
 * checkout; nothing on this page charges or activates anything. The cards
 * light under the pointer, and the comparison fills in row by row.
 */

import { useState, type ReactNode } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { ARCHIVE_FIGURES } from './archiveFigures';
import { Arrow, Eyebrow, GLIDE, Magnetic, Rise, SplitText, useSpotlight } from './kit';

const FEATURES: [string, string, string, string][] = [
  ['Competition practice', 'Available', 'Included', 'Included'],
  ['Adaptive placement & live IRT', 'Available', 'Included', 'Included'],
  [`Exam archive · ${ARCHIVE_FIGURES.problems.toLocaleString('en-US')} problems`, 'Available', 'Included', 'Included'],
  ['Worked solutions', 'Available after an attempt', 'Included', 'Included'],
  ['Gemini explanation with your API key', 'Available with your own key', 'Own key initially', 'Own key initially'],
  ['Proof submission & review', 'Locked', 'Planned', 'Planned'],
  ['Deeper progress analysis', 'Practice progress', 'Planned', 'Planned'],
  ['Extended study planning', '—', '—', 'Planned'],
];

const FREE_INCLUDES = [
  'Adaptive placement, from your first answer',
  'Competition practice with worked solutions',
  `The full exam archive: ${ARCHIVE_FIGURES.papers} papers`,
  'Arena events, as they are scheduled',
];

export default function PlansSection({ onRegister }: { onRegister: () => void }) {
  const [plan, setPlan] = useState<'Pro' | 'Max' | null>(null);
  const toggle = (name: 'Pro' | 'Max') => setPlan(current => (current === name ? null : name));

  return (
    <section className="lx-plans" id="plans" data-tone="paper" aria-labelledby="lx-plans-title">
      <div className="lx-wrap">
        <header className="lx-section-head lx-section-head-split">
          <div>
            <Eyebrow index="07">Plans</Eyebrow>
            <SplitText as="h2" id="lx-plans-title" className="lx-h2" text={'Start freely.\n*Go further, when ready.*'} />
          </div>
          <Rise as="p" className="lx-lead" delay={0.1}>
            Free is a place to begin today. Pro and Max are being designed for deeper study; their pricing and limits are not set, and no paid checkout exists yet.
          </Rise>
        </header>

        <div className="lx-plan-grid">
          <PlanCard featured delay={0}>
            <span className="lx-plan-status"><span className="lx-live" aria-hidden="true" />Available now</span>
            <h3 className="lx-plan-name">Free</h3>
            <p className="lx-plan-price"><strong>$0</strong> to begin</p>
            <p className="lx-plan-copy">Explore, practise, and find your starting path.</p>
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
            <span className="lx-plan-status">In development</span>
            <h3 className="lx-plan-name">Pro</h3>
            <p className="lx-plan-price"><strong>Deeper study</strong></p>
            <p className="lx-plan-copy">A planned home for proof practice and richer insight into your learning.</p>
            <button type="button" className="lx-reveal lx-plan-toggle" onClick={() => toggle('Pro')} aria-expanded={plan === 'Pro'} aria-controls="lx-plan-detail">
              <span>See the Pro direction</span>
              <span className="lx-reveal-sign" aria-hidden="true" />
            </button>
          </PlanCard>

          <PlanCard delay={0.16}>
            <span className="lx-plan-status">In development</span>
            <h3 className="lx-plan-name">Max</h3>
            <p className="lx-plan-price"><strong>A longer horizon</strong></p>
            <p className="lx-plan-copy">The planned Pro experience, with more support for sustained study.</p>
            <button type="button" className="lx-reveal lx-plan-toggle" onClick={() => toggle('Max')} aria-expanded={plan === 'Max'} aria-controls="lx-plan-detail">
              <span>See the Max direction</span>
              <span className="lx-reveal-sign" aria-hidden="true" />
            </button>
          </PlanCard>
        </div>

        <div id="lx-plan-detail" role="status">
          <AnimatePresence initial={false} mode="wait">
            {plan && (
              <m.div
                key={plan}
                className="lx-plan-detail"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ height: { duration: 0.55, ease: GLIDE }, opacity: { duration: 0.3 } }}
              >
                <div>
                  <strong>{plan} is still taking shape.</strong>
                  <p>
                    {plan === 'Pro'
                      ? 'The intended focus is written proof submission, review tools, and deeper progress analysis.'
                      : 'The intended focus is everything planned for Pro, plus extended study planning.'}{' '}
                    Pricing, limits and release dates are not yet set. Nothing is charged or activated here.
                  </p>
                </div>
              </m.div>
            )}
          </AnimatePresence>
        </div>

        <Rise className="lx-compare" y={50} amount={0.12} blur={false}>
          <div className="lx-compare-scroll" tabIndex={0} role="region" aria-label="Compare membership plans" data-lenis-prevent-horizontal>
            <table>
              <caption>What belongs in each path</caption>
              <thead>
                <tr>
                  <th scope="col">Your learning tools</th>
                  <th scope="col">Free <small>Today</small></th>
                  <th scope="col">Pro <small>Planned</small></th>
                  <th scope="col">Max <small>Planned</small></th>
                </tr>
              </thead>
              <m.tbody initial="hidden" whileInView="shown" viewport={{ once: true, amount: 0.2 }} variants={{ shown: { transition: { staggerChildren: 0.06 } } }}>
                {FEATURES.map(row => (
                  <m.tr key={row[0]} variants={{ hidden: { opacity: 0, y: 12 }, shown: { opacity: 1, y: 0, transition: { duration: 0.6, ease: GLIDE } } }}>
                    <th scope="row">{row[0]}</th>
                    {row.slice(1).map((value, index) => (
                      <td key={index} data-value={value === 'Included' || value === 'Available' ? 'yes' : value === '—' || value === 'Locked' ? 'no' : undefined}>
                        {(value === 'Included' || value === 'Available') && <Check />}
                        {value}
                      </td>
                    ))}
                  </m.tr>
                ))}
              </m.tbody>
            </table>
          </div>
        </Rise>
        <p className="lx-plan-disclaimer">Planned features may change before release. Gemini uses your own API key; provider costs are separate.</p>
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
