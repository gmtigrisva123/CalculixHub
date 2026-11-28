/**
 * The landing page as plain HTML, for a browser that runs no script.
 *
 * The page is a React application; without JavaScript a visitor would see the
 * boot screen and nothing else. So at build time (see vite.config.ts) this
 * renders the page's words and links into a <noscript> block in index.html:
 * every heading, every claim, every price and every question, in reading
 * order, with the same links the live page has. It is built from the same
 * modules the live page reads (the archive figures, the topic rooms, the
 * plans, the questions), so it cannot quote a number the page does not.
 *
 * Nothing here touches the DOM or React; it is a string, made once.
 */

import { PLANS, PLAN_ORDER, TEAM_MIN_SEATS, dollars, monthlyEquivalent } from '../../../shared/plans';
import { ARCHIVE_FIGURES } from './archiveFigures';
import { TOPIC_ROOMS } from './topicRooms';
import { FAQS } from './faqContent';
import { ANSWERS } from './engineReplay';

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Inline maths ($...$ or \(...\)) read aloud as plain text: the symbols stay, the markup goes. */
const plainMaths = (text: string) => text
  .replace(/\\\(|\\\)|\$/g, '')
  .replace(/\\(frac|tfrac)\{([^}]*)\}\{([^}]*)\}/g, '($2)/($3)')
  .replace(/\\cdot/g, '·')
  .replace(/\\pi/g, 'π')
  .replace(/\\\{|\\\}/g, m => (m === '\\{' ? '{' : '}'))
  .replace(/\\[a-zA-Z]+/g, '')
  .replace(/[{}]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const p = (text: string) => `<p>${escape(text)}</p>`;
const link = (href: string, text: string) => `<a href="${escape(href)}">${escape(text)}</a>`;

export function landingNoscript(): string {
  const figures = ARCHIVE_FIGURES;
  const plans = PLAN_ORDER.map(id => {
    const plan = PLANS[id];
    const price = plan.price.monthly === 0
      ? '$0 for as long as you like'
      : `${dollars(plan.price.monthly)}${plan.unit ? ` ${plan.unit},` : ''} a month, or ${dollars(monthlyEquivalent(plan))} a month billed ${dollars(plan.price.yearly)} a year`;
    const features = plan.features.map(feature => `<li>${escape(feature.label)}${feature.state === 'planned' ? ' (in the works)' : ''}</li>`).join('');
    const action = id === 'free' ? link('/?auth=signup', 'Create a free account')
      : id === 'pro' ? link('/?auth=signup&tab=plan', 'Start with Pro')
      : `${link('/?auth=signup&tab=plan', 'Tell us about your group')} ${escape(`From ${TEAM_MIN_SEATS} students, arranged with you directly.`)}`;
    return `<article><h3>${escape(plan.name)}</h3>${p(price)}${p(plan.audience)}<ul>${features}</ul><p>${action}</p></article>`;
  }).join('');

  const rooms = TOPIC_ROOMS.map(room => `<article><h3>${escape(room.topic)}</h3>${p(room.feel)}${p(room.covers)}<p>${escape(room.problem.ref)}: ${escape(plainMaths(room.problem.prompt))}</p><p>${link(`/?auth=signup&tab=learn&topic=${encodeURIComponent(room.topic)}`, `Start with ${room.topic.toLowerCase()}`)}</p></article>`).join('');
  const banks = figures.families.map(bank => `<li>${escape(bank.family)}: ${escape(bank.format)}, ${bank.problems.toLocaleString('en-US')} problems</li>`).join('');
  const faqs = FAQS.map(([question, answer]) => `<h3>${escape(question)}</h3>${p(answer)}`).join('');

  return `<noscript>
<style>
#boot { display: none !important; }
.lx-static { max-width: 44rem; margin: 0 auto; padding: 32px 22px 64px; font: 17px/1.6 Georgia, 'Iowan Old Style', serif; color: #22333b; background: #f7f4ee; }
.lx-static h1, .lx-static h2, .lx-static h3 { font-family: system-ui, -apple-system, sans-serif; line-height: 1.15; letter-spacing: -0.02em; }
.lx-static h1 { font-size: 2.6rem; margin: 0.6em 0 0.3em; }
.lx-static h2 { font-size: 1.8rem; margin: 2.2em 0 0.5em; }
.lx-static a { color: #1d5872; }
.lx-static nav a { margin-right: 1em; }
.lx-static article { margin: 1.2em 0; padding-left: 1em; border-left: 2px solid #d9d2c3; }
</style>
<div class="lx-static">
<header><p><strong>calculixhub.</strong></p><nav aria-label="Sections">${link('#engine', 'How it works')}${link('#playground', 'Try one')}${link('#topics', 'Topics')}${link('#archive', 'Past papers')}${link('#plans', 'Pricing')}</nav>
${p('CalculixHub runs in your browser: turn on JavaScript to sign in, find your level and practise.')}
<p>${link('/?auth=signup', 'Start free')}</p></header>
<main>
<section id="top"><p>Competition mathematics · AMC to IMO</p><h1>Stay with the question.</h1>
${p('Contest problems chosen to fit your level, each with a hint and a full solution.')}
<p>${link('/?auth=signup', 'Find your level')} · ${link('#playground', 'Try a problem')}</p>
<ul><li>${figures.problems.toLocaleString('en-US')} past problems</li><li>${figures.papers} real exams</li><li>${figures.firstYear}–${figures.lastYear} years of contests</li></ul>
${p('Three short equations draw this one path. It never repeats, never crosses itself — chaos, but it never gets lost.')}</section>
<section id="idea"><h2>Not too easy. Not too hard. Just right.</h2>${p('CalculixHub finds your level, then gives you problems that fit.')}<p>${link('#engine', 'See how it works')}</p></section>
<section id="engine"><h2>Watch it find your level.</h2><ol>
<li>It starts open-minded. Before the first answer, any level is possible.</li>
<li>Each answer narrows it down. Right answers move the guess up. Misses move it down.</li>
<li>Each question fits. Not too easy, not too hard.</li>
<li>It stops when it’s sure. This time, after ${ANSWERS} questions.</li></ol><p>${link('/?auth=signup', 'Find your own level')} (Free account)</p></section>
<section id="playground"><h2>Two chords. One hidden radius.</h2>
${p('Two chords of a circle meet at a point P inside it.')}${p('PA = 9, PB = 21, PC = 7, PD = 27, cos∠APC = 3/5.')}${p('What is the square of the circle’s radius?')}
${p('PC × PD ≈ always 189. The lengths change. Their product never does.')}</section>
<section id="topics"><h2>Four kinds of problem. Which one is yours?</h2>${p('Contest problems fall into four topics. Try one real problem from the archive in each.')}${rooms}
${p('Can’t pick one? Start with a short placement and we’ll find your level.')}<p>${link('/?auth=signup', 'Find your level')}</p></section>
<section id="archive"><h2>Every past paper, from AMC to IMO.</h2>${p(`${figures.problems.toLocaleString('en-US')} problems from ${figures.papers} past exams, ${figures.firstYear} to ${figures.lastYear}. Take a whole paper, or one problem at a time.`)}<ul>${banks}</ul><p>${link('/?auth=signup&tab=archive', 'Open the archive')}</p></section>
<section id="workspace"><h2>Practise, compete, get unstuck.</h2>
<article><h3>Find your level.</h3>${p('A quiz that adapts to every answer you give.')}<p>${link('/?auth=signup', 'Find my level')}</p></article>
<article><h3>Practise with hints and solutions.</h3>${p('Try a problem, take a hint, then read the full solution.')}<p>${link('/?auth=signup&tab=learn', 'Start practising')}</p></article>
<article><h3>Compete in timed contests.</h3>${p('Live, timed contests against other students.')}<p>${link('/?auth=signup&tab=compete', 'See the Arena')}</p></article>
<article><h3>A nudge, not the answer.</h3>${p('Stuck? The tutor asks a guiding question. You can also post the problem in the community.')}<p>${link('/?auth=signup&tab=community', 'Ask in the community')}</p></article></section>
<section id="desk"><h2>Pen, paper, and a date.</h2>${p('Contest maths is done by hand, toward a day on the calendar. So every page has scratch paper under it, and your practice counts down to the day that matters.')}<ul>
<li>Scratch paper on every screen. Press S and it slides in beside the problem.</li>
<li>A countdown to your contest, with the weeks before it planned: build, sharpen, taper.</li>
<li>A card to share when a streak or a rank is worth showing someone.</li></ul></section>
<section id="plans"><h2>Free to practise. Pro for the season.</h2>${plans}<ul>
<li>Free is not a trial. Placement, practice, the archive and the Arena don’t expire.</li>
<li>No adverts, no data for sale. Pro and Team are what pay for the servers.</li>
<li>Leave with your work. Download everything, or delete your account, from Settings.</li></ul></section>
<section id="faq"><h2>Questions, answered.</h2>${faqs}<p>${link('/?auth=signup&tab=community', 'Ask in the community')}</p></section>
<section id="begin"><h2>You’re allowed to not know yet.</h2>${p('Cross things out. Try a smaller case. Come back tomorrow.')}
<p>${link('/?auth=signup&tab=learn', 'Try a problem')}: Pick one and give it a go.</p><p>${link('/?auth=signup', 'Find your level')}: A quiz that adapts as you answer.</p></section>
</main>
<footer>${p('Competition mathematics practice, AMC to IMO.')}<p>${link('/?preview=ios', 'iPhone preview')} · ${link('/?preview=mac', 'MacBook preview')} · ${link('#top', 'Back to top')}</p></footer>
</div>
</noscript>`;
}
