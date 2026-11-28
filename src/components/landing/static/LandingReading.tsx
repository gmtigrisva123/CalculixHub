/**
 * The landing page's nine chapters as plain reading matter (SPEC §6.15, §11.4).
 *
 * The live chapters need script to mean anything: the engine replays as the
 * reader scrolls, the chord turns under a finger, the topic slips answer a
 * click. This is the same nine chapters, in the same order and in the same
 * words (copy.ts and the data modules), as plain semantic HTML: for visitors
 * without JavaScript, and for crawlers that do not run it. What needs a click
 * on the live page is a <details> here, every way in is a real link, and the
 * formulas are MathML, typeset at build time (ReadingMath.tsx).
 *
 * It is rendered once, at build time, by renderToStaticMarkup into the static
 * first frame (entry-static.tsx), under the blank paper that holds the live
 * chapters' place, and it is shown only where no script has run
 * (landing-static.css). So it is pure: no state, no effects, no motion,
 * nothing that reads the window. Its styles are src/styles/landing-reading.css,
 * which the build inlines with it.
 *
 * The section ids are the live chapters' own, so a link to /#plans lands on
 * the plans here too; the headings' ids carry a `read-` prefix of their own.
 */

import { Fragment, type ReactNode } from 'react';
import { PLANS, PLAN_ORDER, type PlanId } from '../../../../shared/plans';
import { ARCHIVE_CONTESTS, ARCHIVE_FIGURES } from '../archiveFigures';
import { ARCHIVE_SAMPLES } from '../archiveSamples';
import { ARCHIVE, DESK, ENGINE, FAQ, FINAL, PLAYGROUND, PRICING, READING, TOPICS, WORKSPACE, type ItalicLine, type StrongLine } from '../copy';
import { ENGINE_RUN } from '../engineRun';
import { SIGNUP_HREF } from '../kit';
import { TOPIC_ROOMS } from '../topicRooms';
import ReadingMath from './ReadingMath';

/** A chapter's heading as the live page sets it: `*emphasis*` in <em>, and each `\n` a line break. */
function Heading({ id, text }: { id: string; text: string }) {
  // The parts between asterisks alternate, plain first, then emphasised.
  return (
    <h2 id={`read-${id}-title`}>
      {text.split('*').map((part, index) => {
        const lines = part.split('\n').map((line, at) => <Fragment key={at}>{at > 0 && <br />}{line}</Fragment>);
        return index % 2 ? <em key={index}>{lines}</em> : <Fragment key={index}>{lines}</Fragment>;
      })}
    </h2>
  );
}

/** One chapter, under the id the live chapter uses. */
function Chapter({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`read-${id}-title`}>
      <Heading id={id} text={title} />
      {children}
    </section>
  );
}

const Italic = ({ line }: { line: ItalicLine }) => <>{line.before}<i>{line.italic}</i>{line.after}</>;
const Strong = ({ line }: { line: StrongLine }) => <><b>{line.strong}</b>{` ${line.rest}`}</>;

/** Each plan's way in. The live Free button opens the sign-up form in place; here it is the form's address. */
const PLAN_ACTION: Record<PlanId, { label: string; href: string }> = {
  free: { label: PRICING.actions.free, href: SIGNUP_HREF },
  pro: { label: PRICING.actions.pro.checkout, href: PRICING.href },
  team: { label: PRICING.actions.team, href: PRICING.href },
};

function Engine() {
  return (
    <Chapter id="engine" title={ENGINE.title}>
      <p>{ENGINE.note}</p>
      <ol aria-label={ENGINE.beatsLabel}>
        {ENGINE.beats(ENGINE_RUN).map(beat => <li key={beat.title}><b>{beat.title}</b>{` ${beat.body}`}</li>)}
      </ol>
      <h3>{READING.replay}</h3>
      {/* The lines carry their own question numbers, as the ticker writes them. */}
      <ol className="lx-reading-replay" role="list">
        {ENGINE_RUN.steps.slice(1).map((step, index) => (
          <li key={step.item!.id}>{ENGINE.ticker.line(index + 1, step.item!.source, step.item!.domain, step.correct)}</li>
        ))}
      </ol>
      <dl className="lx-reading-verdict">
        <dt>{ENGINE.verdict.label}</dt>
        <dd>{ENGINE_RUN.tier}</dd>
      </dl>
      <p>{ENGINE.verdict.copy(ENGINE_RUN)}</p>
      <p><a href={SIGNUP_HREF}>{ENGINE.action}</a></p>
    </Chapter>
  );
}

function Playground() {
  return (
    <Chapter id="playground" title={PLAYGROUND.title}>
      <p className="lx-reading-label">{PLAYGROUND.tag}</p>
      <p><Italic line={PLAYGROUND.statement} /></p>
      {PLAYGROUND.givens.map(given => <p key={given}><ReadingMath text={given} /></p>)}
      <p>{PLAYGROUND.ask}</p>
      <details>
        <summary>{PLAYGROUND.solution.show}</summary>
        <ol>{PLAYGROUND.solution.steps.map(step => <li key={step}><ReadingMath text={step} /></li>)}</ol>
      </details>
      <p>{PLAYGROUND.figure.notes.moved}</p>
    </Chapter>
  );
}

function Topics() {
  return (
    <Chapter id="topics" title={TOPICS.title}>
      <p>{TOPICS.lead}</p>
      <p>{TOPICS.handNote}</p>
      {TOPIC_ROOMS.map(room => {
        const { problem } = room;
        const answer = READING.answer(TOPICS.slip.letters[problem.answer], problem.options[problem.answer]);
        return (
          <article key={room.topic}>
            <h3><span aria-hidden="true">{room.symbol}</span> {room.topic}</h3>
            <p>{room.feel}</p>
            <p>{room.covers}</p>
            <p className="lx-reading-label">{problem.ref}</p>
            <p><ReadingMath text={problem.prompt} /></p>
            <ol type="A" aria-label={TOPICS.slip.choicesLabel}>
              {problem.options.map(option => <li key={option}><ReadingMath text={option} /></li>)}
            </ol>
            <details>
              <summary>{TOPICS.slip.nudge}</summary>
              <p><ReadingMath text={room.hint} /></p>
            </details>
            <details>
              <summary>{READING.showAnswer}</summary>
              <p><ReadingMath text={answer} /></p>
              <p><ReadingMath text={room.reason} /></p>
            </details>
            <p><a href={TOPICS.room.href(room.topic)}>{TOPICS.room.start(room.topic)}</a></p>
          </article>
        );
      })}
      <p>{`${TOPICS.foot.note} ${TOPICS.foot.line}`}</p>
      <p><a href={SIGNUP_HREF}>{TOPICS.foot.action}</a></p>
    </Chapter>
  );
}

function Archive() {
  return (
    <Chapter id="archive" title={ARCHIVE.title}>
      <p>{ARCHIVE.lead(ARCHIVE_FIGURES)}</p>
      <ul className="lx-reading-row" role="list" aria-label={ARCHIVE.contestsLabel}>
        {ARCHIVE_CONTESTS.map(contest => <li key={contest}>{contest}</li>)}
      </ul>
      <ol className="lx-reading-banks" aria-label={ARCHIVE.ladderLabel}>
        {ARCHIVE_FIGURES.families.map(entry => (
          <li key={entry.family}>
            <b>{entry.family}</b> <span>{entry.format}</span> <span>{`${entry.problems.toLocaleString('en-US')} ${ARCHIVE.problems}`}</span>
          </li>
        ))}
      </ol>
      <ul className="lx-reading-plain" role="list">
        {ARCHIVE_SAMPLES.map(sample => (
          <li key={sample.ref}><span className="lx-reading-label">{sample.ref}</span> <ReadingMath text={sample.prompt} /></li>
        ))}
      </ul>
      <p><a href={ARCHIVE.href}>{ARCHIVE.action}</a></p>
    </Chapter>
  );
}

function Workspace() {
  return (
    <Chapter id="workspace" title={WORKSPACE.title}>
      {WORKSPACE.steps.map(step => (
        <article key={step.title}>
          <h3>{step.title}</h3>
          <p>{step.copy}</p>
          {/* The first card's action opens the sign-up form in place on the live page. */}
          <p><a href={step.href ?? SIGNUP_HREF}>{step.action}</a></p>
        </article>
      ))}
    </Chapter>
  );
}

/** The desk's sheet and countdown need script to mean anything, so only its words are here. */
function Desk() {
  return (
    <Chapter id="desk" title={DESK.title}>
      <p>{DESK.lead}</p>
      <ul>{DESK.points.map(point => <li key={point.strong}><Strong line={point} /></li>)}</ul>
    </Chapter>
  );
}

function Plans() {
  return (
    <Chapter id="plans" title={PRICING.title}>
      {PLAN_ORDER.map(id => {
        const plan = PLANS[id];
        const action = PLAN_ACTION[id];
        return (
          <article key={id}>
            <h3>{plan.name}</h3>
            {/* No monthly/yearly switch here: a paid plan states both of its prices. */}
            <p className="lx-reading-price">
              {plan.price.monthly === 0 ? <><b>{PRICING.free.price}</b>{` ${PRICING.free.note}`}</> : READING.price(plan)}
            </p>
            <p>{plan.audience}</p>
            {id !== 'free' && <p>{PRICING.plus[id]}</p>}
            <ul>
              {plan.features.map(feature => (
                <li key={feature.label}>{feature.state === 'planned' ? READING.planned(feature.label) : feature.label}</li>
              ))}
            </ul>
            <p><a href={action.href}>{action.label}</a></p>
            {id === 'team' && <p>{PRICING.fine.team}</p>}
          </article>
        );
      })}
      <ul>{PRICING.promises.map(promise => <li key={promise.strong}><Strong line={promise} /></li>)}</ul>
    </Chapter>
  );
}

/** Every answer open: there is nothing to click without script. */
function Faq() {
  return (
    <Chapter id="faq" title={FAQ.title}>
      <p><a href={FAQ.href}>{FAQ.link}</a></p>
      {FAQ.items.map(item => (
        <Fragment key={item.question}>
          <h3>{item.question}</h3>
          <p>{item.answer}</p>
        </Fragment>
      ))}
    </Chapter>
  );
}

function Begin() {
  // In page order: practice first, then the featured way in, which opens the sign-up form on the live page.
  const paths = [FINAL.paths.practice, FINAL.paths.level];
  return (
    <Chapter id="begin" title={FINAL.title}>
      <p>{FINAL.lead}</p>
      <ul className="lx-reading-paths" role="list">
        {paths.map(path => (
          <li key={path.title}>
            <a href={path.href ?? SIGNUP_HREF}>
              <b>{path.title}</b> <span>{path.copy}</span> <span>{path.action}</span>
            </a>
          </li>
        ))}
      </ul>
    </Chapter>
  );
}

export default function LandingReading() {
  return (
    <div className="lx-reading">
      {/* [NEW] SPEC §6.15 */}
      <p className="lx-reading-note">{READING.note}</p>
      <Engine />
      <Playground />
      <Topics />
      <Archive />
      <Workspace />
      <Desk />
      <Plans />
      <Faq />
      <Begin />
    </div>
  );
}
