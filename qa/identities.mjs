/**
 * Generates the run's people: 50 agent personas and 15 scripted bots.
 *
 * Names come from Faker's locale datasets, mixed by country. Every address is a
 * plus-address of QA_EMAIL_BASE carrying the `+cxqa-` tag, which is what puts
 * the account in the QA cohort, so no mail ever reaches a stranger.
 *
 *   QA_EMAIL_BASE=team@gmail.com node qa/identities.mjs
 *
 * Writes qa/out/identities.json (with passwords) and one brief per agent in
 * qa/out/agents/<id>/brief.md. Seeded, so the same base gives the same people.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as fakers from '@faker-js/faker';
import { BASE_URL, QA_ROOT, emailBase, outPath, qaAddress } from './lib/config.mjs';

const SEED = Number(process.env.QA_SEED ?? 20261021);
const AGENTS = 50;
const BOTS = 15;

// [faker locale, people, country, name order]
const MIX = [
  ['VI', 21, 'Vietnam', 'family-first'],
  ['EN_US', 6, 'United States'],
  ['EN_IN', 5, 'India'],
  ['EN_GB', 3, 'United Kingdom'],
  ['ID_ID', 3, 'Indonesia'],
  ['DE', 3, 'Germany'],
  ['FR', 3, 'France'],
  ['ES_MX', 3, 'Mexico'],
  ['PT_BR', 3, 'Brazil'],
  ['IT', 2, 'Italy'],
  ['PL', 2, 'Poland'],
  ['TR', 2, 'Türkiye'],
  ['EN_NG', 2, 'Nigeria'],
  ['NL', 1, 'Netherlands'],
  ['SV', 1, 'Sweden'],
  ['RO', 1, 'Romania'],
  ['JA', 1, 'Japan', 'native'],
  ['KO', 1, 'South Korea', 'native'],
  ['ZH_CN', 1, 'China', 'native'],
  ['UK', 1, 'Ukraine'],
];

const ROLES = [
  'Grade 10 student preparing for the provincial maths contest',
  'Grade 12 student revising for the university entrance exam',
  'First-year engineering student who struggles with proofs',
  'Olympiad contender who trains every evening',
  'Secondary-school maths teacher looking for class material',
  'Software engineer relearning maths for fun',
  'Parent checking whether the site suits their child',
  'Grade 8 student who found the site through a friend',
  'University maths major who likes hard problems',
  'Adult learner returning to maths after ten years',
];
const LEVELS = ['Foundation', 'Intermediate', 'Advanced', 'Olympiad'];
const TRAITS = [
  'impatient, skims text, clicks the first big button',
  'careful, reads every label, notices small inconsistencies',
  'chatty, loves commenting and reacting',
  'quiet lurker, reads a lot, posts rarely',
  'competitive, checks rankings constantly',
  'easily confused by jargon, needs clear wording',
  'design-savvy, judges visual polish harshly',
  'keyboard-first, uses Tab and Enter instead of the mouse',
  'on a slow phone connection, notices every spinner',
  'perfectionist, retries until everything is right',
];

const FOCUS = {
  admin: {
    title: 'Run the arenas as an administrator',
    tasks: [
      '1. Sign up, finish the placement test, and get to your workspace.',
      '2. Open **Admin** from the navigation. Unlock it with the access code. Use',
      '   `secret <ref> QA_ADMIN_CODE` on the code field: it types the code from the',
      '   environment without printing it. Never type or write the code yourself.',
      '3. Follow your administrator duty above. Build each arena from the question',
      '   bank with a mix of topics and difficulties, and a clear title and',
      '   description a student would want to join.',
      '4. Watch entries and results come in through **Results** while other people',
      '   compete. Export JSON once.',
      '5. Critique the Admin workspace as a teacher would. Can you build an arena',
      '   without help? What is confusing or slow? What is missing?',
      '',
      '**Never** use Change code, Remove code, Revoke sessions, Suspend, or the',
      'question editor (Write a question, Edit, Archive). Those are not part of this',
      'test, even though the buttons exist.',
    ],
  },
  arena: {
    title: 'Compete in the Arena',
    tasks: [
      '1. Sign up and complete the placement test honestly for your level.',
      '2. Open **Arena**. Find a live match, register, enter, and solve as many',
      '   questions as you can. Use realistic wrong answers sometimes; each question',
      '   allows three tries. Use the question navigator and pass on one you can\'t do.',
      '3. Finish, read the solutions, check your place in the match ranking, then',
      '   the **Leaderboard**.',
      '4. If a match is upcoming, register for it too and check how its start is',
      '   communicated.',
      '5. Post about the match in Community: what you found hard, a nicer solution,',
      '   banter with rivals.',
      '6. Critique the competition experience: is the timer clear? Is it fair? Is',
      '   the tension right? On your device, do the controls fit?',
    ],
  },
  community: {
    title: 'Live in Community Solutions',
    tasks: [
      '1. Sign up and finish the placement test.',
      '2. Open **Community**. Read the feed first, then:',
      '   - write two posts of your own: one question, one solution with LaTeX;',
      '   - comment on at least five other posts, including a threaded reply;',
      '   - react with different reactions;',
      '   - share a post;',
      '   - @mention someone;',
      '   - save a post;',
      '   - edit one of your comments and delete another.',
      '3. Use the problem filter and search. Check that "here now" and "is writing"',
      '   presence make sense.',
      '4. Check your **Inbox** for replies and mentions, and follow a notification',
      '   back to its post.',
      '5. Critique the feed as a social product: does it invite you to take part?',
      '   Is the composer pleasant? Are reactions and comments smooth? How do',
      '   typography and spacing feel at your device size?',
    ],
  },
  'community-media': {
    title: 'Community with images',
    tasks: [
      '1. Do everything in the Community assignment.',
      '2. Also attach an image to one post and one comment. Use the PNG at',
      '   `qa/agent/assets/sketch.png`; the `upload <ref> <path>` command sets it on',
      '   a file input. Check the preview, the posted image, removing an image',
      '   before posting, and how images look on your device.',
    ],
  },
  learn: {
    title: 'Practise in Learn',
    tasks: [
      '1. Sign up and finish the placement test.',
      '2. Open **Learn**. Work through at least eight problems across topics:',
      '   - answer some right, some wrong;',
      '   - use hints;',
      '   - pass on one;',
      '   - check that points, streak and mastery update.',
      '3. Ask the AI tutor one genuine question about a problem you got wrong.',
      '4. Go to **Progress** and check that it reflects what you just did.',
      '5. Critique the problem screen: maths rendering, the answer input on your',
      '   device, feedback after an answer, and motivation to continue.',
    ],
  },
  onboarding: {
    title: 'First-time experience and placement',
    tasks: [
      '1. Arrive at the landing page as a newcomer. Read it, scroll it, and judge',
      '   whether it makes you want to sign up. Look closely at the hero, sections,',
      '   motion and footer.',
      '2. Sign up. Try one realistic mistake first: a short password, or a bad email.',
      '3. Take the placement test carefully, including "I\'m not sure yet" once, and',
      '   judge whether the result feels right.',
      '4. Explore the Dashboard as a first-day user. Is the next step obvious?',
      '5. Sign out and sign back in. Then try "Forgot password" up to the point',
      '   where an email would be sent.',
      '6. Critique the whole first ten minutes: the moment you would have left, and',
      '   the moment you were won over.',
    ],
  },
  archive: {
    title: 'Exam Archive',
    tasks: [
      '1. Sign up and finish the placement test.',
      '2. Open **Exam Archive**. Browse collections, start one, answer several',
      '   questions, and leave halfway.',
      '3. Come back and check that progress was saved. Finish one collection.',
      '4. Save a collection and find it again.',
      '5. Critique browsing, reading long problems on your device, and the sense',
      '   of progress.',
    ],
  },
  'progress-profile': {
    title: 'Progress, Profile, Settings and look and feel',
    tasks: [
      '1. Sign up and finish the placement test. Solve a few Learn problems so there',
      '   is data.',
      '2. Inspect:',
      '   - **Progress**: charts, numbers, and whether they are honest.',
      '   - **Leaderboard**: search and scope switching.',
      '   - **Profile**: edit your bio and display name.',
      '   - **Settings**: every toggle.',
      '3. Switch between light and dark theme on every screen, and resize between',
      '   your device and desktop with `resize`. Screenshot anything that breaks.',
      '4. Use the workspace search (Ctrl+K or the search button) to jump around.',
      '5. Critique visual consistency across screens: type, colour, spacing, icons,',
      '   empty states. Name the screen that looks least finished.',
    ],
  },
  inbox: {
    title: 'Messages and notifications',
    tasks: [
      '1. Sign up and finish the placement test.',
      '2. Find two other people through Community or the Leaderboard. Start a',
      '   conversation with each from their profile or the Inbox, and keep a short',
      '   back-and-forth going while you do other things.',
      '3. Follow someone and check what they see.',
      '4. Watch the Inbox while others react to and reply to you. Check unread',
      '   counts, read state, and following a notification to its post.',
      '5. Critique the Inbox: clarity, timing of realtime updates, and whether you',
      '   would notice a new message.',
    ],
  },
};

const ADMIN_DUTIES = [
  'Create the **main live arena**: published, starting now, open for the next 8 hours, 20-minute attempts, 6 to 8 questions. Do this first, other people are waiting to compete. Then create a second, short live arena (10-minute attempts, 4 questions, open 6 hours).',
  'Create an **upcoming arena** (published, starting in 2 hours, open 4 hours, 30-minute attempts) and a **draft** you keep editing. Duplicate one arena and adjust it.',
  'Wait until the first arenas exist, then act as the **match steward**: review the arena list, check Results and the export as entries arrive, and close the short arena near the end of your session.',
];

// Spread across focus areas: admins first (they create the arenas), the rest interleaved.
const FOCUS_PLAN = [
  ...Array(3).fill('admin'),
  ...interleave({ arena: 10, community: 8, 'community-media': 2, learn: 8, onboarding: 6, archive: 4, 'progress-profile': 5, inbox: 4 }),
];

function interleave(counts) {
  const left = { ...counts };
  const order = [];
  while (Object.values(left).some((n) => n > 0)) {
    for (const key of Object.keys(left)) if (left[key]-- > 0) order.push(key);
  }
  return order;
}

const fold = (text) => text.replace(/đ/gi, 'd').replace(/ł/gi, 'l').replace(/ø/gi, 'o').replace(/ß/g, 'ss').replace(/æ/gi, 'ae').normalize('NFKD').replace(/\p{Mark}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '');

function personName(locale, order, f) {
  if (order === 'native') return f.person.fullName();
  const first = f.person.firstName();
  const last = f.person.lastName();
  return order === 'family-first' ? `${last} ${first}` : `${first} ${last}`;
}

function slugFor(name, locale, order, f, taken) {
  const parts = name.split(/\s+/).map(fold).filter(Boolean);
  let base;
  if (order === 'native' || parts.length === 0) base = `${locale.toLowerCase().split('_')[0]}${f.number.int({ min: 10, max: 99 })}`;
  else if (order === 'family-first') base = `${parts.slice(1).join('')}.${parts[0]}`; // Lam Khanh Van -> khanhvan.lam
  else base = `${parts[0]}.${fold(name.split(/\s+/).pop().split('-')[0])}`; // Parisian-Satterfield -> parisian
  let slug = base;
  while (taken.has(slug)) slug = `${base}${f.number.int({ min: 2, max: 99 })}`;
  taken.add(slug);
  return slug;
}

function password(f) {
  return `${f.string.alphanumeric({ length: 10 })}-${f.string.alphanumeric({ length: 6 })}!`;
}

function main() {
  const base = emailBase();
  const people = [];
  const taken = new Set();
  const total = AGENTS + BOTS;

  const pool = [];
  for (const [locale, count, country, order] of MIX) for (let i = 0; i < count; i += 1) pool.push({ locale, country, order });
  if (pool.length !== total) throw new Error(`Locale mix covers ${pool.length} people, expected ${total}.`);

  const shuffler = fakers.fakerEN;
  shuffler.seed(SEED);
  const shuffled = shuffler.helpers.shuffle(pool);

  shuffled.forEach(({ locale, country, order }, index) => {
    const f = fakers[`faker${locale}`];
    f.seed(SEED + index);
    const isAgent = index < AGENTS;
    const focus = isAgent ? FOCUS_PLAN[index] : null;
    const name = personName(locale, order, f);
    const slug = slugFor(name, locale, order, f, taken);
    const device = focus === 'admin' ? 'desktop' : f.helpers.weightedArrayElement([
      { weight: 6, value: 'desktop' }, { weight: 3, value: 'mobile' }, { weight: 1, value: 'tablet' },
    ]);
    people.push({
      id: isAgent ? `A${String(index + 1).padStart(2, '0')}` : `B${String(index - AGENTS + 1).padStart(2, '0')}`,
      kind: isAgent ? 'agent' : 'bot',
      displayName: name,
      email: qaAddress(base, slug),
      password: password(f),
      locale,
      country,
      // The whole site is in English, so every persona writes in English.
      language: 'en',
      device,
      role: focus === 'admin' ? f.helpers.arrayElement(['Secondary-school maths teacher who runs the school maths club', 'Olympiad coach organising weekly practice matches', 'University teaching assistant running a problem-solving seminar']) : f.helpers.arrayElement(ROLES),
      level: focus === 'admin' ? f.helpers.arrayElement(['Advanced', 'Olympiad']) : f.helpers.arrayElement(LEVELS),
      traits: f.helpers.arrayElements(device === 'mobile' ? TRAITS : TRAITS.filter((t) => !t.includes('phone')), 2),
      focus,
      admin: focus === 'admin',
      adminDuty: focus === 'admin' ? ADMIN_DUTIES[index] : null,
      // Agents run in waves of eight; admins go first so arenas exist.
      wave: isAgent ? (focus === 'admin' ? 1 : 1 + Math.floor((index + 5) / 8)) : null,
      bio: f.helpers.arrayElement([
        'Maths is just puzzles with better notation.',
        'Here to get better at geometry, one triangle at a time.',
        'Learning slowly, but every day.',
        'Number theory fan. Bad at combinatorics (for now).',
        'Teacher by day, problem solver by night.',
        'Trying to make proofs less scary.',
      ]),
    });
  });

  const identitiesPath = outPath('identities.json');
  writeFileSync(identitiesPath, JSON.stringify({ baseUrl: BASE_URL, emailBase: base, seed: SEED, people }, null, 2));

  const template = readFileSync(join(QA_ROOT, 'agent', 'BRIEF.md'), 'utf8');
  for (const person of people.filter((p) => p.kind === 'agent')) {
    const focus = FOCUS[person.focus];
    const values = {
      ...person,
      baseUrl: BASE_URL,
      languageName: 'English',
      traits: person.traits.join('; '),
      focusTitle: focus.title,
      focusTasks: focus.tasks.join('\n'),
      adminBlock: person.admin
        ? `\n**You are an administrator for this run.** Your duty: ${person.adminDuty}\n`
        : '',
    };
    const brief = template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(values[key] ?? ''));
    writeFileSync(outPath('agents', person.id, 'brief.md'), brief);
  }

  const byWave = {};
  for (const p of people.filter((x) => x.kind === 'agent')) (byWave[p.wave] ??= []).push(`${p.id}:${p.focus}`);
  console.log(`Wrote ${people.length} identities to ${identitiesPath}`);
  console.log(`Agents by wave: ${Object.entries(byWave).map(([w, ids]) => `\n  wave ${w}: ${ids.join(' ')}`).join('')}`);
  console.log(`Bots: ${people.filter((p) => p.kind === 'bot').map((p) => p.id).join(' ')}`);
}

main();
