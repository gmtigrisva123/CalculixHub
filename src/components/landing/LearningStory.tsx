import { useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, Plus, Minus } from 'lucide-react';
import MathText from '../MathText';

const journeys = [
  { label: 'Find your starting point', title: 'A path that listens.', copy: 'Adaptive placement chooses the next question from your answers. Watch the live IRT estimate take shape, then begin at a level that suits you.', action: 'Sign up to find my level', href: '' },
  { label: 'Learn through a real attempt', title: 'Give the idea a chance.', copy: 'Work through competition-style problems. Submit an answer, rethink a step, and compare your approach with the worked solution when it becomes available.', action: 'Explore Learn', href: '/?auth=signup&tab=learn' },
  { label: 'Put your thinking into play', title: 'Meet a different challenge.', copy: 'Visit Arena for competitions created by an administrator. A live event starts with real participants; available events depend on what has been scheduled.', action: 'Explore Arena', href: '/?auth=signup&tab=arena' },
];
const features = [
  ['Competition practice', 'Available', 'Included', 'Included'],
  ['Adaptive placement & live IRT', 'Available', 'Included', 'Included'],
  ['Worked solutions', 'Available after an attempt', 'Included', 'Included'],
  ['Gemini explanation with your API key', 'Available with your own key', 'Own key initially', 'Own key initially'],
  ['Proof submission & review', 'Locked', 'Planned', 'Planned'],
  ['Deeper progress analysis', 'Practice progress', 'Planned', 'Planned'],
  ['Extended study planning', '—', '—', 'Planned'],
];
const faqs = [
  ['What is CalculixHub?', 'A mathematics learning workspace for competition practice. It brings adaptive placement, answer-based practice, worked solutions, community, and administrator-created Arena events into one place.'],
  ['Do I need to be an Olympiad student?', 'No. Start with a problem that feels approachable, or use placement to choose a starting path. The question bank spans AMC, AIME, USAMO, and IMO-style levels.'],
  ['When can I read a solution?', 'In Learn, a correct answer unlocks the solution. You can also choose the help option, or reach three incorrect attempts; those routes reveal the solution without awarding points for that question.'],
  ['How does the AI explanation work?', 'You provide your own Gemini API key to enable explanations. Provider usage and charges belong to your provider account. A paid CalculixHub plan does not currently include AI credits.'],
  ['Can I buy Pro or Max now?', 'No. Paid plans are in development, with pricing and final limits still to be confirmed. The comparison below describes the intended direction, not a paid subscription you can purchase today.'],
];
export default function LearningStory({ onRegister }: { onRegister: () => void }) {
  const [open, setOpen] = useState<number | null>(0);
  const [plan, setPlan] = useState<'Pro' | 'Max' | null>(null);
  return <>
    <section className="cq-story cq-width" id="how-it-works" aria-labelledby="cq-story-title">
      <div className="cq-story-heading"><span className="cq-small-intro">Meet CalculixHub</span><h2 id="cq-story-title">A mathematics workspace.<br /><em>With room for your thinking.</em></h2><p>For the student working towards a competition, the curious problem-solver, and anyone who wants to understand the step behind the answer.</p></div>
      <div className="cq-journey">{journeys.map((journey, index) => <article key={journey.label}><span className="cq-journey-index" aria-hidden="true">0{index + 1}</span><div><span className="cq-small-intro">{journey.label}</span><h3>{journey.title}</h3><p>{journey.copy}</p>{journey.href ? <a href={journey.href}>{journey.action}<ArrowUpRight size={16} /></a> : <button onClick={onRegister}>{journey.action}<ArrowRight size={16} /></button>}</div></article>)}</div>
    </section>
    <section className="cq-depth cq-width" aria-labelledby="cq-depth-title">
      <div className="cq-depth-sheet"><span className="cq-small-intro">A glimpse of the thinking</span><MathText text="If $x+y+z=0$, why does $x^3+y^3+z^3=3xyz$?" /><div className="cq-depth-pencil">Look for a factor before you expand.</div><svg viewBox="0 0 340 80" fill="none" aria-hidden="true"><path d="M15 60C68 61 60 20 113 21S177 71 225 39 273 17 327 18" stroke="currentColor" strokeWidth="1.5"/><circle cx="113" cy="21" r="5" stroke="currentColor"/><path d="m321 13 6 5-7 5" stroke="currentColor"/></svg><small>An algebra idea to explore</small></div>
      <div className="cq-depth-copy"><span className="cq-small-intro">From an answer to an argument</span><h2 id="cq-depth-title">Small discoveries.<br /><em>Deeper mathematics.</em></h2><p>Move from AMC-style reasoning to AIME problems, then explore the ideas behind Olympiad proofs. Difficulty is a place to begin, not a label to keep.</p><div className="cq-levels"><span>AMC</span><span>AIME</span><span>USAMO</span><span>IMO</span></div><p className="cq-depth-footnote">Numeric practice is available now. Written proof submission remains locked while the Pro experience is developed.</p><a className="cq-underlined-link" href="/?auth=signup&tab=learn">Look inside the question bank <ArrowUpRight size={16} /></a></div>
    </section>
    <section className="cq-plans cq-width" id="plans" aria-labelledby="cq-plans-title">
      <div className="cq-plan-heading"><div><span className="cq-small-intro">Choose your pace</span><h2 id="cq-plans-title">Start freely.<br /><em>Go further, when ready.</em></h2></div><p>Free is a place to begin today. Pro and Max are being designed for deeper study. No paid checkout is available yet.</p></div>
      <div className="cq-plan-list"><article className="cq-plan-free"><span className="cq-plan-status">Available now</span><h3>Free</h3><p className="cq-plan-price">$0 <span>to begin</span></p><p>Explore, practise, and find your starting path.</p><button onClick={onRegister}>Create a free account <ArrowRight size={17} /></button></article><article><span className="cq-plan-status">In development</span><h3>Pro</h3><p className="cq-plan-price">Deeper study</p><p>A planned home for proof practice and richer insight into your learning.</p><button onClick={() => setPlan(plan === 'Pro' ? null : 'Pro')} aria-expanded={plan === 'Pro'}>See the Pro direction <Plus size={16} /></button></article><article><span className="cq-plan-status">In development</span><h3>Max</h3><p className="cq-plan-price">A longer horizon</p><p>The planned Pro experience, with more support for sustained study.</p><button onClick={() => setPlan(plan === 'Max' ? null : 'Max')} aria-expanded={plan === 'Max'}>See the Max direction <Plus size={16} /></button></article></div>
      {plan && <div className="cq-plan-detail" role="status"><strong>{plan} is still taking shape.</strong><p>{plan === 'Pro' ? 'The intended focus is written proof submission, review tools, and deeper progress analysis.' : 'The intended focus is everything planned for Pro, plus extended study planning.'} Pricing, limits, and release dates are not yet set. Nothing is charged or activated here.</p></div>}
      <div className="cq-comparison-wrap" tabIndex={0} role="region" aria-label="Compare membership plans"><table className="cq-comparison"><caption>What belongs in each path</caption><thead><tr><th scope="col">Your learning tools</th><th scope="col">Free <small>Today</small></th><th scope="col">Pro <small>Planned</small></th><th scope="col">Max <small>Planned</small></th></tr></thead><tbody>{features.map(row => <tr key={row[0]}>{row.map((value, i) => i === 0 ? <th scope="row" key={i}>{value}</th> : <td key={i}>{value === 'Included' && <Check size={13} aria-hidden="true" />}{value}</td>)}</tr>)}</tbody></table></div><p className="cq-plan-disclaimer">Planned features may change before release. Gemini uses your own API key; provider costs are separate.</p>
    </section>
    <section className="cq-answers cq-width" aria-labelledby="cq-answers-title"><div><span className="cq-small-intro">Before you settle in</span><h2 id="cq-answers-title">A few useful<br /><em>answers.</em></h2><p>Clear expectations make a better place to learn.</p></div><div className="cq-faq-list">{faqs.map(([question, answer], index) => <article key={question}><h3><button onClick={() => setOpen(open === index ? null : index)} aria-expanded={open === index} aria-controls={`cq-faq-${index}`}>{question}{open === index ? <Minus size={17} /> : <Plus size={17} />}</button></h3><div id={`cq-faq-${index}`} hidden={open !== index}><p>{answer}</p></div></article>)}</div></section>
  </>;
}
