/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The Plan screen: what you have, what the other plans add, and the one
 * button that changes it.
 *
 * It never shows a price it cannot charge without saying so. While checkout is
 * not switched on the page says Pro is in preview, the upgrade button becomes
 * "tell me when it opens", and nothing in the app is held back. Features that
 * are still being built carry an "in the works" mark wherever they are listed.
 */

import { useEffect, useState, type CSSProperties } from 'react';
import { m } from 'motion/react';
import { ArrowUpRight, Check, CreditCard, Sparkles, Users } from 'lucide-react';
import { PLANS, PLAN_ORDER, TEAM_MIN_SEATS, dollars, monthlyEquivalent, yearlySaving, type BillingCycle, type Plan as PlanData, type PlanId } from '../../shared/plans';
import { useAuth } from '../context/AuthContext';
import { openBillingPortal, registerInterest, startCheckout, usePlan } from '../services/data/plan';
import '../styles/plan.css';

type Vars = CSSProperties & Record<`--${string}`, string | number>;
type Notice = { text: string; tone: 'ok' | 'error' | 'info' };

const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });

/** What came back from Stripe, read once from the address and then removed from it. */
function useCheckoutReturn(): 'success' | 'cancelled' | null {
  const [outcome] = useState<'success' | 'cancelled' | null>(() => {
    const value = new URLSearchParams(window.location.search).get('checkout');
    return value === 'success' || value === 'cancelled' ? value : null;
  });
  useEffect(() => {
    if (!outcome) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('checkout');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  }, [outcome]);
  return outcome;
}

function Price({ plan, cycle }: { plan: PlanData; cycle: BillingCycle }) {
  if (plan.price.monthly === 0) return <p className="pl-price"><strong>$0</strong><span>for as long as you like</span></p>;
  const cents = cycle === 'yearly' ? monthlyEquivalent(plan) : plan.price.monthly;
  return (
    <p className="pl-price">
      <strong>{dollars(cents)}</strong>
      <span>{plan.unit ? `${plan.unit}, ` : ''}a month{cycle === 'yearly' ? <>, billed {dollars(plan.price.yearly)} a year</> : null}</span>
    </p>
  );
}

function Features({ plan }: { plan: PlanData }) {
  return (
    <ul className="pl-features">
      {plan.features.map(feature => (
        <li key={feature.label} className={feature.state === 'planned' ? 'is-planned' : undefined}>
          {feature.state === 'ready'
            ? <Check size={15} strokeWidth={2.6} aria-hidden="true" />
            : <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="5.6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.4 2.2" /></svg>}
          <span>{feature.label}{feature.state === 'planned' && <em>in the works</em>}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Plan() {
  const { user } = useAuth();
  const plan = usePlan(user?.id ?? null);
  const returned = useCheckoutReturn();
  const [cycle, setCycle] = useState<BillingCycle>('yearly');
  const [busy, setBusy] = useState<'checkout' | 'portal' | 'pro' | 'team' | null>(null);
  const [notice, setNotice] = useState<Notice | null>(returned === 'cancelled' ? { text: 'Checkout was closed. No charge was made.', tone: 'info' } : null);
  const [teamOpen, setTeamOpen] = useState(false);
  const [teamNote, setTeamNote] = useState('');

  // The webhook lands a moment after Stripe sends the learner back, so the plan is re-read a few times.
  useEffect(() => {
    if (returned !== 'success') return;
    setNotice({ text: 'Thank you. Your payment went through, and Pro is being switched on.', tone: 'ok' });
    const timers = [1500, 4000, 9000].map(delay => window.setTimeout(() => void plan.reload(), delay));
    return () => timers.forEach(window.clearTimeout);
  }, [returned]);

  const current = plan.plan;
  const saving = yearlySaving(PLANS.pro);
  const subscription = plan.subscription;
  const ending = Boolean(subscription?.cancel_at_period_end || subscription?.status === 'canceled');

  const leave = async (kind: 'checkout' | 'portal') => {
    setBusy(kind);
    setNotice(null);
    const result = kind === 'checkout' ? await startCheckout(cycle) : await openBillingPortal();
    if (result.ok) { window.location.assign(result.url); return; }
    setBusy(null);
    setNotice({ text: result.error, tone: 'error' });
  };

  const join = async (target: Exclude<PlanId, 'free'>, note?: string) => {
    if (!user) return;
    setBusy(target);
    const result = await registerInterest(user.id, target, note);
    setBusy(null);
    if (!result.ok) { setNotice({ text: result.error ?? 'Could not save that just now.', tone: 'error' }); return; }
    await plan.reload();
    if (target === 'team') setTeamOpen(false);
    setNotice({ text: target === 'team' ? 'Thanks. We’ll write to the email on your account about your group.' : 'You’re on the list. We’ll email you the day Pro opens.', tone: 'ok' });
  };

  const status = !user ? 'You’re exploring as a guest.'
    : current === 'free' ? (plan.preview ? 'You’re on Free, with Pro’s features open during the preview.' : 'You’re on Free.')
    : subscription?.current_period_end
      ? `You’re on ${PLANS[current].name}. ${ending ? 'It ends' : 'It renews'} on ${formatDate(subscription.current_period_end)}.`
      : `You’re on ${PLANS[current].name}.`;

  const action = (id: PlanId) => {
    if (!user) return id === 'free'
      ? <a className="pl-btn is-ink" href="/?auth=signup">Create a free account <ArrowUpRight size={15} /></a>
      : <a className="pl-btn is-quiet" href="/?auth=signup">Sign up to choose this</a>;

    if (id === current) return current !== 'free' && plan.checkout
      ? <button type="button" className="pl-btn is-quiet" onClick={() => void leave('portal')} disabled={busy === 'portal'}><CreditCard size={15} /> {busy === 'portal' ? 'Opening…' : 'Manage billing'}</button>
      : <span className="pl-current"><Check size={15} strokeWidth={2.6} /> Your plan</span>;

    if (id === 'free') return <span className="pl-current is-muted">Included in {PLANS[current].name}</span>;

    if (id === 'pro') {
      if (current === 'team') return <span className="pl-current is-muted">Included in Team</span>;
      if (plan.checkout) return <button type="button" className="pl-btn is-brass" onClick={() => void leave('checkout')} disabled={busy === 'checkout'}>{busy === 'checkout' ? 'Opening checkout…' : <>Upgrade to Pro <ArrowUpRight size={15} /></>}</button>;
      return plan.interested.includes('pro')
        ? <span className="pl-current"><Check size={15} strokeWidth={2.6} /> You’re on the list</span>
        : <button type="button" className="pl-btn is-brass" onClick={() => void join('pro')} disabled={busy === 'pro'}>{busy === 'pro' ? 'Saving…' : 'Tell me when Pro opens'}</button>;
    }

    return plan.interested.includes('team')
      ? <span className="pl-current"><Check size={15} strokeWidth={2.6} /> We’ll be in touch</span>
      : <button type="button" className="pl-btn is-quiet" onClick={() => setTeamOpen(open => !open)} aria-expanded={teamOpen}><Users size={15} /> Tell us about your group</button>;
  };

  return (
    <div className="plan-page">
      <header className="pl-hero">
        <div className="pl-hero-copy">
          <p className="pl-eyebrow"><span aria-hidden="true" />Your plan</p>
          <h1>Practice is free. <em>Pro is for the season.</em></h1>
          <p className="pl-status">{status}</p>
        </div>
        {/* Three steps, each a little taller: the plans as a staircase rather than a table. */}
        <div className="pl-steps" aria-hidden="true">
          {PLAN_ORDER.map((id, index) => (
            <div key={id} className={`pl-step${id === current ? ' is-here' : ''}`} style={{ '--h': (index + 1) / PLAN_ORDER.length, '--i': index } as Vars}>
              <span>{id === current && <i />}</span><small>{PLANS[id].name}</small>
            </div>
          ))}
        </div>
      </header>

      {plan.preview && !plan.loading && (
        <p className="pl-preview"><Sparkles size={16} aria-hidden="true" /><span><b>Pro is in preview.</b> Checkout isn’t open yet, so everything Pro includes is unlocked for every account in the meantime. The prices below are what it will cost when it opens.</span></p>
      )}
      {notice && <p className={`pl-notice is-${notice.tone}`} role="status">{notice.text}</p>}

      <div className="pl-cycle" role="radiogroup" aria-label="Billing period">
        {(['monthly', 'yearly'] as const).map(value => (
          <button key={value} type="button" role="radio" aria-checked={cycle === value} onClick={() => setCycle(value)}>
            {cycle === value && <m.span layoutId="pl-cycle-thumb" className="pl-cycle-thumb" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
            <span>{value === 'monthly' ? 'Monthly' : 'Yearly'}{value === 'yearly' && <em>save {saving}%</em>}</span>
          </button>
        ))}
      </div>

      <div className="pl-grid">
        {PLAN_ORDER.map((id, index) => {
          const data = PLANS[id];
          return (
            <m.section key={id} className={`pl-card is-${id}${id === current ? ' is-current' : ''}`} aria-labelledby={`pl-${id}`}
              initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}>
              {id === 'pro' && <span className="pl-ribbon">Most chosen for contest season</span>}
              <h2 id={`pl-${id}`}>{data.name}</h2>
              <p className="pl-audience">{data.audience}</p>
              <Price plan={data} cycle={cycle} />
              {id !== 'free' && <p className="pl-plus">Everything in {id === 'pro' ? 'Free' : 'Pro'}, and:</p>}
              <Features plan={data} />
              <div className="pl-action">{action(id)}</div>
              {id === 'team' && <p className="pl-fine">From {TEAM_MIN_SEATS} students. Arranged with you directly while the coach tools are being built.</p>}
              {id === 'team' && teamOpen && user && (
                <form className="pl-team-form" onSubmit={event => { event.preventDefault(); void join('team', teamNote); }}>
                  <label htmlFor="pl-team-note">Your club or class, and roughly how many students</label>
                  <textarea id="pl-team-note" rows={3} maxLength={500} value={teamNote} onChange={event => setTeamNote(event.target.value)} placeholder="e.g. A school math team, about 20 students, preparing for AMC 10" />
                  <button type="submit" className="pl-btn is-ink" disabled={busy === 'team' || teamNote.trim().length < 4}>{busy === 'team' ? 'Sending…' : 'Send'}</button>
                </form>
              )}
            </m.section>
          );
        })}
      </div>

      <section className="pl-notes" aria-label="How billing works">
        <div><h3>Free stays free</h3><p>Placement, practice, every past paper and the Arena are not a trial. They don’t expire and they won’t move behind Pro.</p></div>
        <div><h3>Cancel in two clicks</h3><p>Manage or cancel from this page. You keep Pro until the end of the period you’ve paid for.</p></div>
        <div><h3>Paid for by learners</h3><p>No adverts and no selling of data. Pro and Team are what keep the servers on and the problems coming.</p></div>
      </section>
    </div>
  );
}
