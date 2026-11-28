import { readFileSync } from 'node:fs';
import { createElement, createRef, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PLANS, yearlySaving } from '../../../shared/plans';
import { PHASE_LABEL } from '../../domain/raceDay';
import { parseSegments } from '../MathText';
import ArchiveLadder from './ArchiveLadder';
import ChordPlayground from './ChordPlayground';
import DeskSection from './DeskSection';
import EngineStory from './EngineStory';
import FaqSection from './FaqSection';
import FinalStage from './FinalStage';
import JourneyStack from './JourneyStack';
import LandingFooter from './LandingFooter';
import PlansSection from './PlansSection';
import TopicsChapter from './TopicsChapter';
import { ARCHIVE_FIGURES } from './archiveFigures';
import { INITIAL_CHORD_ANGLE, chordEndpoints } from './chords';
import { ARCHIVE, DESK, ENGINE, FAQ, FINAL, FOOTER, PLAYGROUND, PRICING, TOPICS, WORKSPACE } from './copy';
import { ENGINE_RUN } from './engineRun';
import { TOPIC_ROOMS } from './topicRooms';

/**
 * copy.ts is the one source of the chapters' words. Each chapter is rendered
 * as a first visit sees it, and every string its part of copy.ts holds must be
 * on the page: so a chapter that stops reading copy.ts, or a string that
 * changes in the chapter rather than in copy.ts, fails here. The few strings
 * a first render cannot show (they wait for a click, a scroll or the server's
 * reply) are named below, and the chapter must still read each from copy.ts.
 */

interface Page {
  /** The text as a reader sees it: inline tags add nothing, a line break reads as a space. */
  text: string;
  /** Labels, values and addresses held in attributes. */
  attributes: string[];
  /** Every formula's TeX source, from KaTeX's annotations. */
  tex: string[];
}

const decode = (value: string) => value
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, '\'').replace(/&amp;/g, '&');

function page(html: string): Page {
  return {
    text: decode(html.replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' '),
    attributes: [...html.matchAll(/\s(?:aria-label|aria-valuetext|placeholder|title|alt|href)="([^"]*)"/g)].map(match => decode(match[1])),
    tex: [...html.matchAll(/<annotation encoding="application\/x-tex">([\s\S]*?)<\/annotation>/g)].map(match => decode(match[1])),
  };
}

/** Whether a copy string is on the page: as text, as an attribute, or as text around typeset formulas. */
function shows(on: Page, value: string): boolean {
  // Headings are SplitText sources: asterisks mark emphasis and a newline breaks the line.
  const plain = value.replace(/\*/g, '').replace(/\s+/g, ' ').trim();
  if (on.text.includes(plain) || on.attributes.includes(plain)) return true;
  const segments = parseSegments(value);
  return segments.some(segment => segment.type === 'math') && segments.every(segment => segment.type === 'math'
    ? on.tex.includes(segment.content)
    : on.text.includes(segment.content.replace(/\s+/g, ' ').trim()));
}

/** Keys whose values are state, not words: a card's tone, who says a line. */
const NOT_WORDS = new Set(['tone', 'who']);

/** Every string in a part of copy.ts, by path. Functions are checked through what they build. */
function strings(value: unknown, path = ''): { path: string; value: string }[] {
  if (typeof value === 'string') return [{ path, value }];
  if (value === null || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  // An ItalicLine and a StrongLine are each one sentence on the page.
  if (typeof record.italic === 'string') return [{ path, value: `${record.before}${record.italic}${record.after ?? ''}` }];
  if (typeof record.strong === 'string' && typeof record.rest === 'string') return [{ path, value: `${record.strong} ${record.rest}` }];
  return Object.entries(record).flatMap(([key, child]) => (NOT_WORDS.has(key) ? [] : strings(child, path ? `${path}.${key}` : key)));
}

const onRegister = () => {};
const chord = chordEndpoints(INITIAL_CHORD_ANGLE);

interface Case {
  Chapter: ComponentType<{ onRegister: () => void }>;
  file: string;
  /** The chapter's part of copy.ts, and the name the chapter reads it by. */
  name: string;
  copy: object;
  /** What copy.ts's functions build for the first render. */
  built?: string[];
  /** Strings of which the first render shows exactly one, depending on today's date. */
  oneOf?: string[][];
  /** Paths (or their prefixes) the first render does not show. */
  later?: string[];
}

const CASES: Case[] = [
  {
    Chapter: EngineStory, file: 'EngineStory.tsx', name: 'ENGINE', copy: ENGINE,
    built: [...ENGINE.beats(ENGINE_RUN).flatMap(beat => [beat.title, beat.body]), ENGINE.chartLabel(ENGINE_RUN), ENGINE.ticker.question(0)],
    // The verdict and the full meter wait for the scroll to reach the end of the run.
    later: ['sureness.sure', 'verdict.label'],
  },
  {
    Chapter: ChordPlayground, file: 'ChordPlayground.tsx', name: 'PLAYGROUND', copy: PLAYGROUND,
    built: [
      PLAYGROUND.figure.sliderValue(INITIAL_CHORD_ANGLE.toFixed(1)),
      PLAYGROUND.figure.readout.product(chord.near.toFixed(2), chord.far.toFixed(2)),
    ],
    // An answer checked, the solution opened, the chord moved.
    later: ['answer.right', 'answer.wrong', 'solution.hide', 'solution.steps', 'figure.points.o', 'figure.notes.moved'],
  },
  {
    Chapter: TopicsChapter, file: 'TopicsChapter.tsx', name: 'TOPICS', copy: TOPICS,
    built: TOPIC_ROOMS.flatMap(room => [TOPICS.room.start(room.topic), TOPICS.room.href(room.topic)]),
    // A choice picked.
    later: ['slip.solved', 'slip.lastOne', 'slip.wrong'],
  },
  {
    Chapter: ArchiveLadder, file: 'ArchiveLadder.tsx', name: 'ARCHIVE', copy: ARCHIVE,
    built: [ARCHIVE.lead(ARCHIVE_FIGURES)],
  },
  {
    Chapter: JourneyStack, file: 'JourneyStack.tsx', name: 'WORKSPACE', copy: WORKSPACE,
    // The pictures play once their card is on screen.
    later: ['pictures.placement.question', 'pictures.tutor'],
  },
  {
    Chapter: DeskSection, file: 'DeskSection.tsx', name: 'DESK', copy: DESK,
    // The card starts seventy days ahead of today.
    built: [DESK.card.toGo(70)],
    oneOf: [
      Array.from({ length: 60 }, (_, weeks) => DESK.card.track(weeks + 1)),
      Object.values(PHASE_LABEL).map(phase => DESK.card.thisWeek(phase.toLowerCase())),
      Array.from({ length: 60 }, (_, problems) => DESK.card.perDay(problems + 1)),
    ],
    // The nudge waits for the triangle to be drawn; the other two for a date that is not ahead.
    later: ['sheet.nudge', 'card.noCount', 'card.pickDay'],
  },
  {
    Chapter: PlansSection, file: 'PlansSection.tsx', name: 'PRICING', copy: PRICING,
    built: [PRICING.billing.save(yearlySaving(PLANS.pro)), PRICING.cadence(PLANS.pro, 'yearly'), PRICING.cadence(PLANS.team, 'yearly')],
    // Which of Pro's two states the card shows waits for the server.
    later: ['actions.pro.checkout', 'fine.checkout', 'fine.preview'],
  },
  {
    Chapter: FaqSection, file: 'FaqSection.tsx', name: 'FAQ', copy: FAQ,
    // The first answer is open; the others open on a click.
    later: FAQ.items.slice(1).map((_, index) => `items.${index + 1}.answer`),
  },
  { Chapter: FinalStage, file: 'FinalStage.tsx', name: 'FINAL', copy: FINAL },
];

describe('copy.ts is what the chapters say', () => {
  for (const { Chapter, file, name, copy, built = [], oneOf = [], later = [] } of CASES) {
    it(`${file} shows every string of ${name}`, () => {
      const on = page(renderToStaticMarkup(createElement(Chapter, { onRegister })));
      const waiting = (path: string) => later.some(prefix => path === prefix || path.startsWith(`${prefix}.`));
      const all = strings(copy);
      const missing = [...all.filter(entry => !waiting(entry.path)), ...built.map(value => ({ path: '(built)', value }))]
        .filter(entry => !shows(on, entry.value));
      expect(missing).toEqual([]);
      for (const choices of oneOf) expect(choices.filter(value => shows(on, value)), choices[0]).toHaveLength(1);

      // A string the first render cannot show must still come from copy.ts: the chapter reads it by name.
      const source = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
      for (const prefix of later) {
        expect(all.some(entry => entry.path === prefix || entry.path.startsWith(`${prefix}.`)), `${name}.${prefix} is in copy.ts`).toBe(true);
        const parts = prefix.split('.');
        const index = parts.findIndex(part => /^\d+$/.test(part));
        const reference = [name, ...(index < 0 ? parts : parts.slice(0, index))].join('.');
        expect(source, `${file} reads ${reference}`).toContain(reference);
      }
    });
  }

  it('the footer\'s strings are the live footer\'s', () => {
    const on = page(renderToStaticMarkup(createElement(LandingFooter, { contentRef: createRef<HTMLDivElement>() })));
    expect(strings(FOOTER).filter(entry => !shows(on, entry.value))).toEqual([]);
  });
});
