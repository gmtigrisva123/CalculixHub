/**
 * "Pricing": three plans, one switch between monthly and yearly, and nothing
 * the page cannot stand behind.
 *
 * Every name, price and feature comes from shared/plans.ts, the same file the
 * workspace Plan screen and the checkout route read, so the front page cannot
 * quote a price the checkout does not charge. A feature still being built is
 * drawn with an open dashed ring and the words "in the works". While checkout
 * is not switched on, the Pro card says so and offers the preview instead of a
 * purchase.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { m } from 'motion/react';
import { PLANS, PLAN_ORDER, dollars, monthlyEquivalent, yearlySaving, type BillingCycle, type Plan, type PlanId } from '../../../shared/plans';
import { billingConfig } from '../../services/data/plan';
import { PRICING } from './copy';
import { Arrow, Magnetic, Rise, SPRING, SplitText, Stagger, StaggerItem, useSpotlight } from './kit';


export default function PlansSection({ onRegister }: { onRegister: () => void }) {
  const [cycle, setCycle] = useState<BillingCycle>('yearly');
  // null until the server has answered; the card then says which of the two it is.
  const [checkout, setCheckout] = useState<boolean | null>(null);
  useEffect(() => { let alive = true; void billingConfig().then(config => { if (alive) setCheckout(config.checkout); }); return () => { alive = false; }; }, []);
  const saving = yearlySaving(PLANS.pro);

  return (
    <section className="lx-plans" id="plans" data-tone="paper" aria-labelledby="lx-plans-title">
      <div className="lx-wrap">
        <header className="lx-section-head lx-plans-head">
          <div>
            <SplitText as="h2" id="lx-plans-title" className="lx-h2" text={PRICING.title} />
          </div>
          <Rise className="lx-cycle-wrap" delay={0.1}>
            <div className="lx-cycle" role="radiogroup" aria-label={PRICING.billing.label}>
              {(['monthly', 'yearly'] as const).map(value => (
                <button key={value} type="button" role="radio" aria-checked={cycle === value} onClick={() => setCycle(value)}>
                  {cycle === value && <m.span layoutId="lx-cycle-thumb" className="lx-cycle-thumb" transition={SPRING.press} />}
                  <span>{PRICING.billing.cycle[value]}{value === 'yearly' && <em>{PRICING.billing.save(saving)}</em>}</span>
                </button>
              ))}
            </div>
          </Rise>
        </header>

        <div className="lx-plan-grid">
          {PLAN_ORDER.map((id, index) => {
            const plan = PLANS[id];
            return (
              <PlanCard key={id} featured={id === 'pro'} delay={index * 0.08}>
                <h3 className="lx-plan-name">{plan.name}</h3>
                <Price plan={plan} cycle={cycle} />
                <p className="lx-plan-audience">{plan.audience}</p>
                {id !== 'free' && <p className="lx-plan-plus">{PRICING.plus[id]}</p>}
                <ul className="lx-plan-list">
                  {plan.features.map(feature => (
                    <li key={feature.label} className={feature.state === 'planned' ? 'is-soon' : undefined}>
                      {feature.state === 'ready' ? <Check /> : <Soon />}
                      <span>{feature.label}{feature.state === 'planned' && <em>{PRICING.soon}</em>}</span>
                    </li>
                  ))}
                </ul>
                <div className="lx-plan-action">
                  {id === 'free' && (
                    <Magnetic>
                      <button type="button" className="lx-btn lx-btn-ink" onClick={onRegister}>
                        <span>{PRICING.actions.free}</span>
                        <span className="lx-btn-icon" aria-hidden="true"><Arrow /></span>
                      </button>
                    </Magnetic>
                  )}
                  {id === 'pro' && (
                    <>
                      <Magnetic>
                        <a className="lx-btn lx-btn-cream" href={PRICING.href}>
                          <span>{checkout ? PRICING.actions.pro.checkout : PRICING.actions.pro.preview}</span>
                          <span className="lx-btn-icon" aria-hidden="true"><Arrow /></span>
                        </a>
                      </Magnetic>
                      {checkout === false && <p className="lx-plan-fine">{PRICING.fine.preview}</p>}
                      {checkout && <p className="lx-plan-fine">{PRICING.fine.checkout}</p>}
                    </>
                  )}
                  {id === 'team' && (
                    <>
                      <a className="lx-link" href={PRICING.href}>{PRICING.actions.team} <Arrow size={15} /></a>
                      <p className="lx-plan-fine">{PRICING.fine.team}</p>
                    </>
                  )}
                </div>
              </PlanCard>
            );
          })}
        </div>

        <Stagger as="ul" className="lx-plan-promises" gap={0.1}>
          {PRICING.promises.map(promise => <StaggerItem key={promise.strong} as="li"><b>{promise.strong}</b>{` ${promise.rest}`}</StaggerItem>)}
        </Stagger>
      </div>
    </section>
  );
}

function Price({ plan, cycle }: { plan: Plan; cycle: BillingCycle }) {
  if (plan.price.monthly === 0) return <p className="lx-plan-price"><strong>{PRICING.free.price}</strong><span>{PRICING.free.note}</span></p>;
  const cents = cycle === 'yearly' ? monthlyEquivalent(plan) : plan.price.monthly;
  return (
    <p className="lx-plan-price">
      {/* Keyed on the figure so a change of period swaps the number with a small lift instead of a jump. */}
      <m.strong key={cents} className="lx-tabular" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.press, opacity: { duration: 0.2 } }}>{dollars(cents)}</m.strong>
      <span>{PRICING.cadence(plan, cycle)}</span>
    </p>
  );
}

function PlanCard({ children, featured = false, delay }: { children: ReactNode; featured?: boolean; delay: number }) {
  const ref = useSpotlight<HTMLDivElement>();
  return (
    <Rise className={featured ? 'lx-plan is-featured' : 'lx-plan'} delay={delay} y={44} panel>
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
