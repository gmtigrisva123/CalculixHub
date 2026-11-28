/**
 * Every visible string of the landing page's chapters, in one place.
 *
 * The live chapters, the static reading version (static/LandingReading.tsx),
 * the page's structured data (static/jsonLd.ts) and the tests all read from
 * here, so the page a crawler or a visitor without script reads cannot drift
 * from the page everyone else sees.
 *
 * Conventions:
 *   - A heading is the exact source string its `SplitText` takes: `*asterisks*`
 *     mark emphasis (a pencil stroke under the phrase, in the heading's own
 *     roman) and `\n` breaks a line.
 *   - An `ItalicLine` is a sentence with one span in italics, written
 *     `before<i>italic</i>after` on the page: a point or a variable's name.
 *   - A `StrongLine` opens on a bold phrase: `<b>strong</b> rest`.
 *   - Numbers the page can work out are never typed here. They are
 *     interpolated from ARCHIVE_FIGURES, PLANS, ENGINE_RUN or TEAM_MIN_SEATS,
 *     so a new paper, a new price or a change to the engine changes the words
 *     with it. The digits that remain belong to the problems themselves (the
 *     chord problem, the practice sheet) and to their drawings.
 *   - Strings marked [NEW] did not exist on the page before the static reading
 *     version (SPEC §6.15); everything else is the page's own copy, unchanged.
 *
 * This file is light on purpose: the landing shell is meant to read its
 * strings from here too (SPEC §14.1), so it imports nothing but the plans.
 * The engine's run and the archive's figures are passed in by the caller
 * (only the run's type is imported), which keeps the item bank and the
 * placement engine in the chapters' chunk, where they are needed (§14.2).
 * The data the chapters show (the rooms' problems, the archive's samples, the
 * plans' features, the engine's answers) stays in its own modules.
 */

import { PLANS, TEAM_MIN_SEATS, dollars, type BillingCycle, type Plan } from '../../../shared/plans';
import type { EngineRun } from './engineRun';

/** A sentence with one span in italics: `before<i>italic</i>after`. */
export interface ItalicLine {
  before: string;
  italic: string;
  after?: string;
}

/** A sentence that opens on a bold phrase: `<b>strong</b> rest`. */
export interface StrongLine {
  strong: string;
  rest: string;
}

/** The figures of the archive that its lead quotes (ARCHIVE_FIGURES). */
export interface ArchiveLeadFigures {
  problems: number;
  papers: number;
  firstYear: number;
  lastYear: number;
}

/** How many answers a placement run took: steps[0] is the prior, so one fewer than its steps. */
const answersIn = (run: EngineRun) => run.steps.length - 1;

/** A paid plan's two prices in the FAQ's own words: "$9 a month, or $72 a year". */
const bothPrices = (plan: Plan) => `${dollars(plan.price.monthly)} a month, or ${dollars(plan.price.yearly)} a year`;

// ---------------------------------------------------------------------------
// Engine (EngineStory.tsx; the run itself is engineRun.ts)
// ---------------------------------------------------------------------------

/** "Q13": how many questions have been answered. */
const tickerQuestion = (answered: number) => `Q${answered}`;
/** "AIME combinatorics": where the question came from, and its topic in lower case. */
const tickerItem = (source: string, domain: string) => `${source} ${domain.toLowerCase()}`;
const tickerResult = (correct: boolean | null) => (correct ? 'Right' : 'Missed');

export const ENGINE = {
  title: 'Watch it find *your level.*',
  note: 'Scroll to watch one student’s placement, answer by answer.',
  beatsLabel: 'How placement works',
  /** The story's four beats; the last quotes how many answers the run took. */
  beats: (run: EngineRun) => [
    { title: 'It starts open-minded.', body: 'Before the first answer, any level is possible.' },
    { title: 'Each answer narrows it down.', body: 'Right answers move the guess up. Misses move it down.' },
    { title: 'Each question fits.', body: 'Not too easy, not too hard.' },
    { title: 'It stops when it’s sure.', body: `This time, after ${answersIn(run)} questions.` },
  ],
  readouts: { questions: 'Questions', level: 'Level', sure: 'How sure' },
  /** The level readout before the chart's first frame is drawn. */
  levelAtStart: 'Intermediate',
  /** Screen-reader text for the "How sure" meter. */
  sureness: { sure: 'Sure enough to stop', unsure: 'Not sure yet' },
  chartLabel: (run: EngineRun) =>
    `The guess of one student’s level, after each answer. It was sure after ${answersIn(run)} questions: ${run.tier}.`,
  marker: 'YOU',
  axis: { easier: 'easier', harder: 'harder' },
  /** Shown over the run's tier once the engine has stopped. */
  verdict: { label: 'Level found', copy: (run: EngineRun) => `Start with ${run.source} problems.` },
  ticker: {
    question: tickerQuestion,
    item: tickerItem,
    result: tickerResult,
    empty: 'No answers yet',
    /** One whole line, as the ticker shows it: "Q1 AMC 10 combinatorics Right". */
    line: (answered: number, source: string, domain: string, correct: boolean | null) =>
      `${tickerQuestion(answered)} ${tickerItem(source, domain)} ${tickerResult(correct)}`,
  },
  action: 'Find your own level',
  actionNote: 'Free account',
} as const;

// ---------------------------------------------------------------------------
// Playground (ChordPlayground.tsx)
// ---------------------------------------------------------------------------

const STATEMENT: ItalicLine = { before: 'Two chords of a circle meet at a point ', italic: 'P', after: ' inside it.' };
const ANSWER_LABEL: ItalicLine = { before: 'Your answer for ', italic: 'r', after: '²' };
const FIGURE_BAR: ItalicLine = { before: 'Move ', italic: 'C', after: '. Watch what stays.' };
const SLIDER_LABEL: ItalicLine = { before: 'Turn chord ', italic: 'CD' };

export const PLAYGROUND = {
  title: 'Two chords.\nOne *hidden radius.*',
  lead: 'Drag the chord wherever you like. One number refuses to move, and that is the way in.',
  tag: 'The problem',
  statement: STATEMENT,
  givens: ['$PA=9$, $PB=21$, $PC=7$, $PD=27$', '$\\cos\\angle APC=\\tfrac{3}{5}$'],
  ask: 'What is the square of the circle’s radius?',
  answer: {
    label: ANSWER_LABEL,
    placeholder: '0 to 999',
    check: 'Check',
    right: 'Right: 289. Compare with the solution below.',
    wrong: 'Not quite. Hint: find the centre from the midpoints of the chords.',
  },
  solution: {
    show: 'Show the solution',
    hide: 'Hide the solution',
    steps: [
      'The intersecting-chord theorem gives $PA\\cdot PB=PC\\cdot PD=189$. Put $P$ at the origin with $PA$ along the vertical axis.',
      'The perpendicular from the centre bisects each chord, so $O$ projects to $-6$ on line $PA$ and to $-10$ on line $PC$.',
      'With $\\cos\\angle APC=3/5$, line $PC$ points along $(4/5,\\,3/5)$. So $O_y=-6$, and $\\tfrac45 O_x+\\tfrac35(-6)=-10$ gives $O_x=-8$.',
      'Then $OP^2=8^2+6^2=100$, and $r^2=OP^2+189=\\boxed{289}$.',
    ],
  },
  figure: {
    bar: FIGURE_BAR,
    reset: 'Reset to the problem’s starting figure',
    label: 'Two chords AB and CD meet at P inside a circle. Turn chord CD with the slider, or drag point C.',
    points: { a: 'A', b: 'B', p: 'P', c: 'C', d: 'D', o: 'O' },
    /** The two lengths the problem gives along chord AB, written on the drawing. */
    lengths: { pa: '9', pb: '21' },
    slider: SLIDER_LABEL,
    /** The slider's spoken value, from the angle already rounded for display. */
    sliderValue: (degrees: string) => `${degrees} degrees`,
    readout: {
      label: 'PC × PD',
      product: (near: string, far: string) => `${near} × ${far}`,
      approx: '≈',
      always: 'always',
    },
    notes: { idle: 'Drag C, or use the slider.', moved: 'The lengths change. Their product never does.' },
  },
} as const;

// ---------------------------------------------------------------------------
// Topics (TopicsChapter.tsx; each room's problem is in topicRooms.ts)
// ---------------------------------------------------------------------------

export const TOPICS = {
  title: 'Four kinds of problem.\nWhich one is *yours?*',
  lead: 'Contest problems fall into four topics. Try one real problem from the archive in each.',
  handNote: 'no sign-up, no timer — just have a go',
  /** Faint remains of what was rubbed out before the lesson (aria-hidden). */
  ghosts: ['a² + b² = c²', 'e^{iπ} + 1 = 0', '∑ 1/n² = π²/6', 'n! ≡ ?', '(n choose k)', '∠ABC = 90°'],
  slip: {
    choicesLabel: 'Answer choices',
    letters: ['A', 'B', 'C', 'D', 'E'],
    nudge: 'Need a nudge?',
    solved: 'Yes — that’s it.',
    lastOne: 'Only one left…',
    wrong: 'Not quite — have another go.',
  },
  room: {
    start: (topic: string) => `Start with ${topic.toLowerCase()}`,
    more: (topic: string) => `More ${topic.toLowerCase()}`,
    href: (topic: string) => `/?auth=signup&tab=learn&topic=${encodeURIComponent(topic)}`,
  },
  foot: {
    note: 'Can’t pick one?',
    line: 'Start with a short placement and we’ll find your level.',
    action: 'Find your level',
  },
} as const;

// ---------------------------------------------------------------------------
// Archive (ArchiveLadder.tsx; the figures are in archiveFigures.ts)
// ---------------------------------------------------------------------------

export const ARCHIVE = {
  title: 'Every past paper,\nfrom *AMC to IMO.*',
  /** Called with ARCHIVE_FIGURES. */
  lead: (figures: ArchiveLeadFigures) =>
    `${figures.problems.toLocaleString('en-US')} problems from ${figures.papers} past exams, ${figures.firstYear} to ${figures.lastYear}. Take a whole paper, or one problem at a time.`,
  contestsLabel: 'Contests in the archive',
  /** One beside each contest's name in the band (aria-hidden). */
  glyphs: ['∑', '∫', '≡', 'π', '∞', '√', '∂', '≅', 'ℤ', '∴'],
  ladderLabel: 'The archive, from easier contests to harder ones',
  /** The word under each bank's count. */
  problems: 'problems',
  axis: { easier: 'easier', harder: 'harder' },
  action: 'Open the archive',
  href: '/?auth=signup&tab=archive',
} as const;

// ---------------------------------------------------------------------------
// Workspace (JourneyStack.tsx)
// ---------------------------------------------------------------------------

export interface WorkspaceStep {
  title: string;
  copy: string;
  action: string;
  /** Absent for the first card, whose action opens sign-up in place. */
  href?: string;
  tone: 'paper' | 'mist' | 'ink' | 'cream';
}

const WORKSPACE_STEPS: readonly WorkspaceStep[] = [
  {
    title: 'Find your level.',
    copy: 'A quiz that adapts to every answer you give.',
    action: 'Find my level',
    tone: 'paper',
  },
  {
    title: 'Practise with hints and solutions.',
    copy: 'Try a problem, take a hint, then read the full solution.',
    action: 'Start practising',
    href: '/?auth=signup&tab=learn',
    tone: 'mist',
  },
  {
    title: 'Compete in timed contests.',
    copy: 'Live, timed contests against other students.',
    action: 'See the Arena',
    href: '/?auth=signup&tab=compete',
    tone: 'ink',
  },
  {
    title: 'A nudge, not the answer.',
    copy: 'Stuck? The tutor asks a guiding question. You can also post the problem in the community.',
    action: 'Ask in the community',
    href: '/?auth=signup&tab=community',
    tone: 'cream',
  },
];

export interface TutorLine {
  who: 'learner' | 'tutor';
  text: string;
}

const TUTOR_CHAT: readonly TutorLine[] = [
  { who: 'learner', text: 'I’m stuck on the two chords.' },
  { who: 'tutor', text: 'What do you know about where two chords cross?' },
  { who: 'learner', text: 'PA × PB = PC × PD?' },
  { who: 'tutor', text: 'Exactly. Now, where could the centre be?' },
];

export const WORKSPACE = {
  title: 'Practise, compete,\nget *unstuck.*',
  steps: WORKSPACE_STEPS,
  /** The small working pictures on the cards (aria-hidden). */
  pictures: {
    placement: { start: 'Before the first answer', question: 'Question', caption: 'Each answer narrows it down.' },
    learn: {
      tag: 'Algebra',
      question: 'If $x+y+z=0$, why does $x^3+y^3+z^3=3xyz$?',
      pencil: 'Look for a factor before you expand.',
      steps: ['$x^3+y^3+z^3-3xyz$', '$=(x+y+z)(x^2+y^2+z^2-xy-yz-zx)$', '$=0$'],
      check: '✓ so the two sides agree',
    },
    arena: { live: 'Live', you: 'You' },
    tutor: { label: 'Tutor', chat: TUTOR_CHAT },
  },
} as const;

// ---------------------------------------------------------------------------
// Desk (DeskSection.tsx)
// ---------------------------------------------------------------------------

const DESK_POINTS: readonly StrongLine[] = [
  { strong: 'Scratch paper', rest: 'on every screen. Press S and it slides in beside the problem.' },
  { strong: 'A countdown', rest: 'to your contest, with the weeks before it planned: build, sharpen, taper.' },
  { strong: 'A card to share', rest: 'when a streak or a rank is worth showing someone.' },
];

export const DESK = {
  title: 'Pen, paper,\nand *a date.*',
  lead: 'Contest maths is done by hand, toward a day on the calendar. So every page has scratch paper under it, and your practice counts down to the day that matters.',
  points: DESK_POINTS,
  sheet: {
    label: 'Scratch paper with a right triangle drawn on it. You can draw on it with a mouse, finger or stylus.',
    /** The triangle's labels, written on the sheet (aria-hidden): a 5-12-13 triangle and its altitude. */
    figure: { base: '12', side: '5', hypotenuse: '13', altitude: 'h = ?' },
    toolsLabel: 'Tool',
    tools: { pen: 'Pen', accent: 'Red pen', mark: 'Highlighter', eraser: 'Eraser' },
    clear: 'Fresh sheet',
    nudge: 'go on, draw on it',
  },
  card: {
    date: 'My contest is on',
    /** Where the count goes while no day ahead is picked. */
    noCount: '—',
    /** The words after the count. */
    toGo: (days: number) => `${days === 1 ? 'day' : 'days'} to go`,
    pickDay: 'pick a day ahead of today',
    track: (weeks: number) => `${weeks} weeks: build, sharpen, taper`,
    legend: { build: 'Build', sharpen: 'Sharpen', taper: 'Taper' },
    /** The bold half of the week's line, with the phase in lower case. */
    thisWeek: (phase: string) => `This week: ${phase}.`,
    perDay: (problems: number) => `${problems} problems a day, your weakest topic first.`,
    action: 'Start my countdown',
  },
} as const;

// ---------------------------------------------------------------------------
// Plans (PlansSection.tsx; names, audiences, prices and features are in shared/plans.ts)
// ---------------------------------------------------------------------------

const PROMISES: readonly StrongLine[] = [
  { strong: 'Free is not a trial.', rest: 'Placement, practice, the archive and the Arena don’t expire.' },
  { strong: 'No adverts, no data for sale.', rest: 'Pro and Team are what pay for the servers.' },
  { strong: 'Leave with your work.', rest: 'Download everything, or delete your account, from Settings.' },
];

export const PRICING = {
  title: 'Free to practise.\n*Pro* for the season.',
  billing: {
    label: 'Billing period',
    cycle: { monthly: 'Monthly', yearly: 'Yearly' } satisfies Record<BillingCycle, string>,
    /** Beside "Yearly", with yearlySaving(PLANS.pro). */
    save: (percent: number) => `save ${percent}%`,
  },
  free: { price: dollars(PLANS.free.price.monthly), note: 'for as long as you like' },
  /** What follows a paid plan's figure: "per student, a month, billed $60 a year". */
  cadence: (plan: Plan, cycle: BillingCycle) =>
    `${plan.unit ? `${plan.unit}, ` : ''}a month${cycle === 'yearly' ? `, billed ${dollars(plan.price.yearly)} a year` : ''}`,
  /** Over a paid plan's features: what it adds to the plan before it. */
  plus: { pro: `Everything in ${PLANS.free.name}, and`, team: `Everything in ${PLANS.pro.name}, and` },
  /** Beside a feature that is still being built. */
  soon: 'in the works',
  actions: {
    free: 'Create a free account',
    /** Pro's button, by whether checkout is switched on. */
    pro: { checkout: 'Start with Pro', preview: 'Try Pro in the preview' },
    team: 'Tell us about your group',
  },
  href: '/?auth=signup&tab=plan',
  fine: {
    checkout: 'Cancel any time. You keep Pro until the period you paid for ends.',
    preview: 'Checkout isn’t open yet. Until it is, every account gets Pro’s features at no charge, and you’ll hear before that changes.',
    team: `From ${TEAM_MIN_SEATS} students, arranged with you directly.`,
  },
  promises: PROMISES,
} as const;

// ---------------------------------------------------------------------------
// FAQ (FaqSection.tsx)
// ---------------------------------------------------------------------------

export interface FaqEntry {
  question: string;
  answer: string;
}

const FAQ_ITEMS: readonly FaqEntry[] = [
  { question: 'What is CalculixHub?', answer: 'A place to practise contest maths: find your level, solve real past problems, and learn from full solutions.' },
  { question: 'Do I need to be an Olympiad student?', answer: 'No. The quiz finds a good starting point for you, from AMC up to IMO.' },
  { question: 'Is Free really free?', answer: 'Yes. Placement, practice, every past paper and the Arena are free, with no trial clock and no adverts.' },
  { question: 'What does Pro add, and what does it cost?', answer: `${bothPrices(PLANS.pro)}. It adds a week-by-week plan up to your contest date, printable progress reports and every share-card design. Anything still being built is marked on the pricing table.` },
  { question: 'Can I cancel?', answer: 'Any time, from the Plan page. You keep Pro until the period you paid for ends.' },
  { question: 'What if I get stuck?', answer: 'Take a hint first. When you’re ready, read the full solution. You can come back to any problem.' },
  { question: 'How do the AI explanations work?', answer: 'The tutor answers with Google’s Gemini. In Settings, under Live tutor, three steps walk you through getting a free key from your own Google account. Google’s free allowance covers normal practice, and anything beyond it is between you and Google, not us.' },
  { question: 'Can I take my data with me, or delete it?', answer: 'Both. Settings has a download of everything stored about you, and a delete-account button that removes it for good.' },
];

export const FAQ = {
  title: 'Questions,\nanswered.',
  link: 'Ask in the community',
  href: '/?auth=signup&tab=community',
  items: FAQ_ITEMS,
} as const;

// ---------------------------------------------------------------------------
// Final stage (FinalStage.tsx)
// ---------------------------------------------------------------------------

export interface FinalPath {
  title: string;
  copy: string;
  action: string;
  /** Absent for the featured card, whose action opens sign-up in place. */
  href?: string;
}

const PRACTICE_PATH: FinalPath = {
  title: 'Try a problem',
  copy: 'Pick one and give it a go.',
  action: 'Open practice',
  href: '/?auth=signup&tab=learn',
};

const LEVEL_PATH: FinalPath = {
  title: 'Find your level',
  copy: 'A quiz that adapts as you answer.',
  action: 'Create a free account',
};

export const FINAL = {
  title: 'You’re allowed\nto *not know yet.*',
  lead: 'Cross things out. Try a smaller case. Come back tomorrow.',
  /** In page order: practice first, then the featured way in. */
  paths: { practice: PRACTICE_PATH, level: LEVEL_PATH },
  /** Under the stage, in the hand (aria-hidden). */
  caption: 'progress is rarely a straight line.',
} as const;

// ---------------------------------------------------------------------------
// Footer (LandingFooter.tsx)
// ---------------------------------------------------------------------------

export const FOOTER = {
  lede: 'Competition mathematics practice, AMC to IMO.',
  /** What a screen reader hears for the wordmark. */
  name: 'CalculixHub',
  /** The wordmark, drawn letter by letter (aria-hidden), before its dot. */
  wordmark: 'calculixhub',
  links: {
    iphone: { label: 'iPhone preview', href: '/?preview=ios' },
    mac: { label: 'MacBook preview', href: '/?preview=mac' },
    top: { label: 'Back to top', href: '#top' },
  },
} as const;

// ---------------------------------------------------------------------------
// The static reading version only (static/LandingReading.tsx)
// ---------------------------------------------------------------------------

export const READING = {
  /** [NEW] SPEC §6.15: the note at the top of the reading version. */
  note: 'The moving figures and signing up need JavaScript. Everything to read is here.',
  /** [NEW] SPEC §6.15: the heading over the engine's replay, written out as a list. */
  replay: 'One student’s placement, answer by answer.',
  /** [NEW] SPEC §6.15: the summary of a topic room's answer. */
  showAnswer: 'Show the answer',
  /** What a room's answer opens to: "B: $2$". */
  answer: (letter: string, choice: string) => `${letter}: ${choice}`,
  /** A planned feature, for a page that cannot draw the dashed ring: "Feedback on written proofs (in the works)". */
  planned: (label: string) => `${label} (${PRICING.soon})`,
  /**
   * [NEW] SPEC §6.15: a paid plan's price without the monthly/yearly switch, in
   * the FAQ's own words: "$9 a month, or $72 a year." and "$7 a month, or $60 a
   * year, per student."
   */
  price: (plan: Plan) => `${bothPrices(plan)}${plan.unit ? `, ${plan.unit}` : ''}.`,
} as const;
