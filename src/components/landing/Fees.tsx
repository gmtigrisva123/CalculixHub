/**
 * "Pricing": the three plans as one table, and nothing the page cannot stand behind.
 *
 * Every name, price and feature comes from shared/plans.ts, the file the
 * workspace's Plan screen and the checkout route read, so the front page
 * cannot quote a price the checkout does not charge. The plans are set out as
 * a schedule rather than three cards: one row to a feature, one column to a
 * plan, so what each plan adds to the one before it can be read straight down.
 * A feature still being built is drawn with an open dashed ring and the words
 * "in the works". While checkout is not switched on, Pro says so and offers the
 * preview instead of a purchase.
 */

import { useEffect, useState } from 'react';
import { PLANS, PLAN_ORDER, TEAM_MIN_SEATS, dollars, monthlyEquivalent, yearlySaving, type BillingCycle, type Plan, type PlanId } from '../../../shared/plans';
import { billingConfig } from '../../services/data/plan';
import { Arrow } from './kit';

const FOR: Record<PlanId, string> = { free: 'For every learner', pro: 'For contest season', team: 'For clubs and schools' };

/** Each feature once, with the first plan that has it. Every plan includes all that the plans before it do. */
const SCHEDULE = PLAN_ORDER.flatMap((id, tier) => PLANS[id].features.map(feature => ({ ...feature, tier })));

const PROMISES = [
  { title: 'Free is not a trial.', text: 'Placement, practice, the archive and the Arena do not expire.' },
  { title: 'No adverts, no data for sale.', text: 'Pro and Team are what pay for the servers.' },
  { title: 'Leave with your work.', text: 'Download everything, or delete your account, from Settings.' },
];

export default function Fees({ onRegister }: { onRegister: () => void }) {
  const [cycle, setCycle] = useState<BillingCycle>('yearly');
  // null until the server has answered; Pro then says which of the two it is.
  const [checkout, setCheckout] = useState<boolean | null>(null);
  useEffect(() => { let alive = true; void billingConfig().then(config => { if (alive) setCheckout(config.checkout); }); return () => { alive = false; }; }, []);
  const saving = yearlySaving(PLANS.pro);

  return (
    <section className="p1-sec p1-fees" id="plans" aria-labelledby="p1-fees-title">
      <div className="p1-wrap">
        <header className="p1-fees-head">
          <h2 id="p1-fees-title" className="p1-title">Free to practise. Pro for the season.</h2>
          <div className="p1-seg" role="group" aria-label="Billing period">
            <button type="button" aria-pressed={cycle === 'monthly'} onClick={() => setCycle('monthly')}>Monthly</button>
            <button type="button" aria-pressed={cycle === 'yearly'} onClick={() => setCycle('yearly')}>Yearly, save {saving}%</button>
          </div>
        </header>

        <div className="p1-fees-sheet">
          <div className="p1-plans">
            <p className="p1-plans-note">Read down a column. Each plan includes everything in the one to its left.</p>
            {PLAN_ORDER.map(id => {
              const plan = PLANS[id];
              return (
                <article key={id} className="p1-plan" aria-labelledby={`p1-plan-${id}`}>
                  <h3 id={`p1-plan-${id}`} className="p1-plan-name">{plan.name}</h3>
                  <Price plan={plan} cycle={cycle} />
                  <p className="p1-plan-for"><b>{FOR[id]}.</b> {plan.audience}</p>
                  <div className="p1-plan-action">
                    {id === 'free' && (
                      <button type="button" className="p1-btn" onClick={onRegister}>
                        <span>Create a free account</span>
                        <Arrow />
                      </button>
                    )}
                    {id === 'pro' && (
                      <>
                        <a className="p1-btn is-outline" href="/?auth=signup&tab=plan">
                          <span>{checkout ? 'Start with Pro' : 'Try Pro in the preview'}</span>
                          <Arrow />
                        </a>
                        <p className="p1-caption">
                          {checkout
                            ? 'Cancel any time. You keep Pro until the period you paid for ends.'
                            : 'Checkout isn’t open yet. Until it is, every account gets Pro’s features at no charge, and you’ll hear before that changes.'}
                        </p>
                      </>
                    )}
                    {id === 'team' && (
                      <>
                        <a className="p1-btn is-outline" href="/?auth=signup&tab=plan">
                          <span>Tell us about your group</span>
                          <Arrow />
                        </a>
                        <p className="p1-caption">From {TEAM_MIN_SEATS} students, arranged with you directly.</p>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          <table className="p1-table p1-schedule">
            <caption className="sr-only">What each plan includes</caption>
            <colgroup>
              <col className="p1-col-label" />
              {PLAN_ORDER.map(id => <col key={id} className="p1-col-plan" />)}
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Included</th>
                {PLAN_ORDER.map(id => <th key={id} scope="col" className="is-mark">{PLANS[id].name}</th>)}
              </tr>
            </thead>
            <tbody>
              {SCHEDULE.map(feature => (
                <tr key={feature.label}>
                  <th scope="row">
                    {feature.label}
                    {feature.state === 'planned' && <span className="p1-soon">in the works</span>}
                  </th>
                  {PLAN_ORDER.map((id, tier) => (
                    <td key={id} className="is-mark">
                      {tier >= feature.tier
                        ? feature.state === 'ready'
                          ? <><Check /><span className="sr-only">Included</span></>
                          : <><Soon /><span className="sr-only">Planned, not built yet</span></>
                        : <><span className="p1-none" aria-hidden="true" /><span className="sr-only">Not included</span></>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="p1-promises">
          {PROMISES.map(promise => (
            <li key={promise.title}><b>{promise.title}</b> {promise.text}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Price({ plan, cycle }: { plan: Plan; cycle: BillingCycle }) {
  if (plan.price.monthly === 0) {
    return <p className="p1-plan-price"><b className="p1-num">$0</b> <span>for as long as you like</span></p>;
  }
  const cents = cycle === 'yearly' ? monthlyEquivalent(plan) : plan.price.monthly;
  return (
    <p className="p1-plan-price">
      <b className="p1-num">{dollars(cents)}</b>{' '}
      <span>{plan.unit ? `${plan.unit}, ` : ''}a month{cycle === 'yearly' ? `, billed ${dollars(plan.price.yearly)} a year` : ''}</span>
    </p>
  );
}

function Check() {
  return (
    <svg className="p1-check" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 8.4 6.6 11.4 12.5 4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A planned feature: an open, dashed ring where a tick will go. */
function Soon() {
  return (
    <svg className="p1-check is-soon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.4 2.2" />
    </svg>
  );
}
