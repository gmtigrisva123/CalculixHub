import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PLANS, PLAN_ORDER, dollars } from '../../../../shared/plans';
import { parseSegments } from '../../MathText';
import { ARCHIVE_CONTESTS, ARCHIVE_FIGURES } from '../archiveFigures';
import { ARCHIVE_SAMPLES } from '../archiveSamples';
import { ARCHIVE, DESK, ENGINE, FAQ, FINAL, PLAYGROUND, PRICING, READING, TOPICS, WORKSPACE } from '../copy';
import { ENGINE_RUN } from '../engineRun';
import { SIGNUP_HREF } from '../kit';
import { TOPIC_ROOMS } from '../topicRooms';
import LandingReading from './LandingReading';

/**
 * The reading version is the whole page for a visitor without JavaScript and
 * for a crawler that does not run it, so it must say everything the live
 * chapters say, in their words, with nothing left behind a click that needs
 * script, and with every formula typeset.
 */

const html = renderToStaticMarkup(createElement(LandingReading));

const decode = (value: string) => value
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, '\'').replace(/&amp;/g, '&');
/** A formula's TeX source is kept in its <annotation>, which no browser shows. */
const withoutAnnotations = (markup: string) => markup.replace(/<annotation\b[^>]*>[\s\S]*?<\/annotation>/g, '');
/** The text as a reader sees it: inline tags add nothing, a line break reads as a space. */
const reading = (markup: string) => decode(withoutAnnotations(markup).replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
/** Every TeX source typeset in a stretch of markup. */
const annotations = (markup: string) => [...markup.matchAll(/<annotation encoding="application\/x-tex">([\s\S]*?)<\/annotation>/g)].map(match => decode(match[1]));
/** The inner markup of every element with this tag (none of them nest here). */
const inner = (markup: string, tag: string) => [...markup.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'g'))].map(match => match[1]);
/** Every link: its address and its text. */
const links = (markup: string) => [...markup.matchAll(/<a href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map(match => ({ href: decode(match[1]), text: reading(match[2]) }));
/** What the formulas in a string are, in order: the text a reader sees around them is checked separately. */
const formulas = (source: string) => parseSegments(source).filter(segment => segment.type === 'math').map(segment => segment.content);
/** A string with formulas, as the reader sees it beside its typeset maths: the text between the formulas. */
const prose = (source: string) => parseSegments(source).filter(segment => segment.type === 'text').map(segment => segment.content.trim()).filter(Boolean);

const IDS = ['engine', 'playground', 'topics', 'archive', 'workspace', 'desk', 'plans', 'faq', 'begin'] as const;
type Id = typeof IDS[number];

const TITLES: Record<Id, string> = {
  engine: ENGINE.title,
  playground: PLAYGROUND.title,
  topics: TOPICS.title,
  archive: ARCHIVE.title,
  workspace: WORKSPACE.title,
  desk: DESK.title,
  plans: PRICING.title,
  faq: FAQ.title,
  begin: FINAL.title,
};

function section(id: Id): string {
  const found = html.match(new RegExp(`<section id="${id}" aria-labelledby="read-${id}-title">([\\s\\S]*?)</section>`));
  expect(found, `no reading section #${id}`).not.toBeNull();
  return found![1];
}

/** The formula strings as written in the sources, with each one's text and TeX expected on the page. */
function expectTypeset(markup: string, source: string) {
  const text = reading(markup);
  for (const part of prose(source)) expect(text).toContain(part);
  const typeset = annotations(markup);
  for (const tex of formulas(source)) expect(typeset).toContain(tex);
}

describe('the reading version', () => {
  it('opens with the note on what needs JavaScript', () => {
    expect(html.startsWith(`<div class="lx-reading"><p class="lx-reading-note">${READING.note}</p>`)).toBe(true);
  });

  it('has the nine chapters, under the live chapters\' ids, each labelled by its heading', () => {
    const order = [...html.matchAll(/<section id="([^"]+)" aria-labelledby="read-([^"]+)-title">/g)].map(match => [match[1], match[2]]);
    expect(order).toEqual(IDS.map(id => [id, id]));
    for (const id of IDS) expect(section(id)).toMatch(new RegExp(`^<h2 id="read-${id}-title">`));
  });

  it('sets every chapter heading in the live page\'s words, emphasis and all', () => {
    for (const id of IDS) {
      const h2 = inner(section(id), 'h2')[0];
      expect(reading(h2)).toBe(TITLES[id].replace(/\*/g, '').replace(/\n/g, ' '));
      const emphasised = [...TITLES[id].matchAll(/\*([^*]+)\*/g)].map(match => match[1]);
      expect(inner(h2, 'em')).toEqual(emphasised);
      expect((h2.match(/<br\/>/g) ?? []).length).toBe(TITLES[id].split('\n').length - 1);
    }
  });

  it('tells the engine\'s four beats, then its whole placement, answer by answer', () => {
    const engine = section('engine');
    const answers = ENGINE_RUN.steps.length - 1;
    const beats = inner(inner(engine, 'ol')[0], 'li').map(reading);
    expect(beats).toEqual(ENGINE.beats(ENGINE_RUN).map(beat => `${beat.title} ${beat.body}`));
    expect(beats[3]).toContain(`after ${answers} questions`);

    expect(inner(engine, 'h3')).toEqual([READING.replay]);
    const replay = engine.match(/<ol class="lx-reading-replay"[^>]*>([\s\S]*?)<\/ol>/)![1];
    // Written as the live ticker writes each answer: "Q1 AMC 10 combinatorics Right".
    const expected = ENGINE_RUN.steps.slice(1).map((step, index) =>
      `Q${index + 1} ${step.item!.source} ${step.item!.domain.toLowerCase()} ${step.correct ? 'Right' : 'Missed'}`);
    expect(inner(replay, 'li').map(reading)).toEqual(expected);
    expect(expected).toHaveLength(answers);

    expect(engine).toContain(`<dt>${ENGINE.verdict.label}</dt><dd>${ENGINE_RUN.tier}</dd>`);
    expect(engine).toContain(`<p>Start with ${ENGINE_RUN.source} problems.</p>`);
    expect(links(engine)).toEqual([{ href: SIGNUP_HREF, text: ENGINE.action }]);
  });

  it('sets the chord problem, with its solution behind a summary', () => {
    const playground = section('playground');
    const text = reading(playground);
    const { before, italic, after } = PLAYGROUND.statement;
    expect(playground).toContain(`${before}<i>${italic}</i>${after}`);
    expect(text).toContain(PLAYGROUND.tag);
    expect(text).toContain(PLAYGROUND.ask);
    for (const given of PLAYGROUND.givens) expectTypeset(playground, given);

    const details = playground.match(/<details><summary>([^<]*)<\/summary>([\s\S]*?)<\/details>/)!;
    expect(details[1]).toBe(PLAYGROUND.solution.show);
    const steps = inner(details[2], 'li');
    expect(steps).toHaveLength(PLAYGROUND.solution.steps.length);
    PLAYGROUND.solution.steps.forEach((step, index) => expectTypeset(steps[index], step));
    expect(text).toContain(PLAYGROUND.figure.notes.moved);
  });

  it('puts every topic room\'s problem on the page, with its nudge and answer behind summaries', () => {
    const topics = section('topics');
    expect(reading(topics)).toContain(TOPICS.lead);
    expect(reading(topics)).toContain(TOPICS.handNote);
    const rooms = inner(topics, 'article');
    expect(rooms).toHaveLength(TOPIC_ROOMS.length);
    TOPIC_ROOMS.forEach((room, index) => {
      const card = rooms[index];
      const { problem } = room;
      expect(card).toContain(`<h3><span aria-hidden="true">${room.symbol}</span> ${room.topic}</h3>`);
      expect(reading(card)).toContain(room.feel);
      expect(reading(card)).toContain(room.covers);
      expect(reading(card)).toContain(problem.ref);
      expectTypeset(card, problem.prompt);

      const choices = card.match(/<ol type="A" aria-label="([^"]*)">([\s\S]*?)<\/ol>/)!;
      expect(choices[1]).toBe(TOPICS.slip.choicesLabel);
      const options = inner(choices[2], 'li');
      expect(options).toHaveLength(problem.options.length);
      problem.options.forEach((option, choice) => expect(annotations(options[choice])).toEqual(formulas(option)));

      const summaries = [...card.matchAll(/<details><summary>([^<]*)<\/summary>([\s\S]*?)<\/details>/g)];
      expect(summaries.map(match => match[1])).toEqual([TOPICS.slip.nudge, READING.showAnswer]);
      expectTypeset(summaries[0][2], room.hint);
      const [answer, reason] = inner(summaries[1][2], 'p');
      // "B: 2": the right choice's letter, then the choice itself, typeset.
      expect(reading(answer).startsWith(`${'ABCDE'[problem.answer]}: `)).toBe(true);
      expect(annotations(answer)).toEqual(formulas(problem.options[problem.answer]));
      expectTypeset(reason, room.reason);

      expect(links(card)).toEqual([{ href: TOPICS.room.href(room.topic), text: `Start with ${room.topic.toLowerCase()}` }]);
    });
    expect(reading(topics)).toContain(`${TOPICS.foot.note} ${TOPICS.foot.line}`);
    expect(links(topics).at(-1)).toEqual({ href: SIGNUP_HREF, text: TOPICS.foot.action });
  });

  it('lays out the archive: its contests, its four banks and real problems from it', () => {
    const archive = section('archive');
    const text = reading(archive);
    expect(text).toContain(`${ARCHIVE_FIGURES.problems.toLocaleString('en-US')} problems from ${ARCHIVE_FIGURES.papers} past exams, ${ARCHIVE_FIGURES.firstYear} to ${ARCHIVE_FIGURES.lastYear}.`);
    expect(text).toContain(ARCHIVE.lead(ARCHIVE_FIGURES));
    const lists = inner(archive, 'ul');
    expect(inner(lists[0], 'li')).toEqual([...ARCHIVE_CONTESTS]);
    const banks = inner(archive.match(/<ol class="lx-reading-banks"[^>]*>([\s\S]*?)<\/ol>/)![1], 'li').map(reading);
    expect(banks).toEqual(ARCHIVE_FIGURES.families.map(entry => `${entry.family} ${entry.format} ${entry.problems.toLocaleString('en-US')} problems`));
    const samples = inner(lists[1], 'li');
    expect(samples).toHaveLength(ARCHIVE_SAMPLES.length);
    ARCHIVE_SAMPLES.forEach((sample, index) => {
      expect(reading(samples[index]).startsWith(sample.ref)).toBe(true);
      expectTypeset(samples[index], sample.prompt);
    });
    expect(links(archive)).toEqual([{ href: '/?auth=signup&tab=archive', text: ARCHIVE.action }]);
  });

  it('gives each workspace card its words and a way in', () => {
    const workspace = section('workspace');
    expect(inner(workspace, 'h3')).toEqual(WORKSPACE.steps.map(step => step.title));
    for (const step of WORKSPACE.steps) expect(reading(workspace)).toContain(step.copy);
    expect(links(workspace)).toEqual(WORKSPACE.steps.map(step => ({ href: step.href ?? SIGNUP_HREF, text: step.action })));
    expect(links(workspace)[0].href).toBe(SIGNUP_HREF);
  });

  it('keeps the desk\'s words, not its sheet or countdown', () => {
    const desk = section('desk');
    expect(reading(desk)).toContain(DESK.lead);
    expect(inner(desk, 'li')).toEqual(DESK.points.map(point => `<b>${point.strong}</b> ${point.rest}`));
    expect(desk).not.toMatch(/<(canvas|input|button)/);
  });

  it('prices every plan from PLANS, both periods at once, with every feature', () => {
    const plans = section('plans');
    const cards = inner(plans, 'article');
    expect(cards.map(card => inner(card, 'h3')[0])).toEqual(PLAN_ORDER.map(id => PLANS[id].name));
    PLAN_ORDER.forEach((id, index) => {
      const plan = PLANS[id];
      const features = inner(inner(cards[index], 'ul')[0], 'li').map(reading);
      expect(features).toEqual(plan.features.map(feature => feature.state === 'planned' ? `${feature.label} (in the works)` : feature.label));
      expect(reading(cards[index])).toContain(plan.audience);
    });

    const prices = cards.map(card => reading(card.match(/<p class="lx-reading-price">([\s\S]*?)<\/p>/)![1]));
    expect(prices[0]).toBe(`${dollars(PLANS.free.price.monthly)} for as long as you like`);
    // [NEW] in SPEC §6.15: the FAQ's own phrasing of both prices, for a page without the switch.
    expect(prices[1]).toBe(`${dollars(PLANS.pro.price.monthly)} a month, or ${dollars(PLANS.pro.price.yearly)} a year.`);
    expect(prices[2]).toBe(`${dollars(PLANS.team.price.monthly)} a month, or ${dollars(PLANS.team.price.yearly)} a year, ${PLANS.team.unit}.`);

    expect(reading(cards[1])).toContain('Everything in Free, and');
    expect(reading(cards[2])).toContain('Everything in Pro, and');
    expect(reading(cards[2])).toContain(PRICING.fine.team);
    expect(cards.map(card => links(card))).toEqual([
      [{ href: SIGNUP_HREF, text: 'Create a free account' }],
      [{ href: '/?auth=signup&tab=plan', text: 'Start with Pro' }],
      [{ href: '/?auth=signup&tab=plan', text: 'Tell us about your group' }],
    ]);
    for (const promise of PRICING.promises) expect(plans).toContain(`<li><b>${promise.strong}</b> ${promise.rest}</li>`);
  });

  it('answers every question in the open', () => {
    const faq = section('faq');
    expect(links(faq)[0]).toEqual({ href: '/?auth=signup&tab=community', text: FAQ.link });
    expect(FAQ.items).toHaveLength(8);
    expect(inner(faq, 'h3')).toEqual(FAQ.items.map(item => item.question));
    for (const item of FAQ.items) expect(faq).toContain(`<h3>${item.question}</h3><p>${item.answer}</p>`);
    expect(faq).not.toContain('<details');
  });

  it('closes on the two ways in, as links', () => {
    const begin = section('begin');
    expect(reading(begin)).toContain(FINAL.lead);
    expect(links(begin)).toEqual([
      { href: '/?auth=signup&tab=learn', text: `${FINAL.paths.practice.title} ${FINAL.paths.practice.copy} ${FINAL.paths.practice.action}` },
      { href: SIGNUP_HREF, text: `${FINAL.paths.level.title} ${FINAL.paths.level.copy} ${FINAL.paths.level.action}` },
    ]);
  });

  it('typesets every formula as MathML, and leaves no TeX in the text', () => {
    expect(html).toContain('<math');
    // Each formula once: the givens, the solution, the four rooms (prompt, choices, hint, answer, reason) and the archive's samples.
    const sources = [
      ...PLAYGROUND.givens,
      ...PLAYGROUND.solution.steps,
      ...TOPIC_ROOMS.flatMap(room => [room.problem.prompt, ...room.problem.options, room.hint, room.problem.options[room.problem.answer], room.reason]),
      ...ARCHIVE_SAMPLES.map(sample => sample.prompt),
    ];
    expect((html.match(/<math\b/g) ?? []).length).toBe(sources.flatMap(formulas).length);
    // MathML only: none of KaTeX's HTML rendering, which needs its stylesheet and fonts.
    expect(html).not.toContain('katex-html');
    expect(html).not.toContain('class="katex');

    const text = reading(html);
    expect(text).not.toMatch(/\$[A-Za-z\\{]/);
    expect(text).not.toContain('\\frac');
    expect(text).not.toMatch(/\\[A-Za-z([]/);
  });

  it('works without script: real links, no buttons, nothing that runs', () => {
    const all = links(html);
    expect(all.length).toBeGreaterThan(10);
    for (const link of all) expect(link.href).toMatch(/^\/\?auth=signup(&|$)/);
    expect(all.filter(link => link.href === SIGNUP_HREF).length).toBeGreaterThanOrEqual(5);
    expect(html).not.toMatch(/<(button|script|form|input)\b/);
    expect(html).not.toMatch(/\son[a-z]+="/i);
    expect(html).not.toMatch(/\sstyle="/);
  });

  it('renders the same HTML every time', () => {
    expect(renderToStaticMarkup(createElement(LandingReading))).toBe(html);
  });
});
