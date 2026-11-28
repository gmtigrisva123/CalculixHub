/**
 * @fallback: the fallback passes of SPEC §16.4 that the page can be held to
 * today, and the JavaScript-off pass that M1 delivers (@m1).
 *
 * Still to come, each with its milestone: no three.js chunk without WebGL
 * (M4, the test.fixme below), at most 2 rAF callbacks in an idle 2 s under
 * reduced motion (M2, the director), Save-Data and context loss (M4).
 */
import { expect, test } from '@playwright/test';
import { CHAPTER_IDS, mountAllChapters, noWebGL } from './helpers.mjs';

/** The chapter headings, as a reader sees them (SPEC §6.4-§6.12). */
const HEADINGS = [
  'Watch it find your level.',
  'Two chords. One hidden radius.',
  'Four kinds of problem. Which one is yours?',
  'Every past paper, from AMC to IMO.',
  'Practise, compete, get unstuck.',
  'Pen, paper, and a date.',
  'Free to practise. Pro for the season.',
  'Questions, answered.',
  'You’re allowed to not know yet.',
];

/** The eight questions of SPEC §6.11. */
const FAQ_QUESTIONS = [
  'What is CalculixHub?',
  'Do I need to be an Olympiad student?',
  'Is Free really free?',
  'What does Pro add, and what does it cost?',
  'Can I cancel?',
  'What if I get stuck?',
  'How do the AI explanations work?',
  'Can I take my data with me, or delete it?',
];

/** The two prices of the reading version, without the billing toggle (SPEC §6.15). */
const PRICES = ['$9 a month, or $72 a year.', '$7 a month, or $60 a year, per student.'];

const HERO_TITLE = 'Stay with the question.';

test('reduced motion: no Lenis, the headline shown @fallback', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  // Lenis puts the `lenis` class on <html> while it runs; reduced motion must leave the browser in charge.
  expect(await page.evaluate(() => document.documentElement.classList.contains('lenis')), 'html.lenis (a Lenis instance) under reduced motion').toBe(false);
  await expect(page.locator('h1').first()).toBeVisible();
});

test('no WebGL: the 2D fallback, and no page errors @fallback', async ({ browser }) => {
  const context = await browser.newContext();
  try {
    await noWebGL(context);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await page.waitForTimeout(9000);
    await mountAllChapters(page);
    await expect(page.locator('.lx-hero-field canvas').first(), 'the hero field draws its 2D fallback').toBeAttached();
    expect(errors, 'uncaught page errors without WebGL').toEqual([]);
  } finally {
    await context.close();
  }
});

// Today the hero's field asks for three.js (and its WebGL context request fails) even when WebGL is unavailable.
test.fixme('no three.js chunk is requested without WebGL (M4) @fallback', async () => {});

/**
 * Runs in the page: what a reader without script sees. Everything is read in
 * one pass, since with scripts off nothing changes after load.
 */
function readPage({ ids, prices, heroTitle }) {
  const visible = element => {
    if (!element) return false;
    const box = element.getBoundingClientRect();
    if (!(box.width > 0 && box.height > 0) || getComputedStyle(element).visibility === 'hidden') return false;
    return typeof element.checkVisibility === 'function' ? element.checkVisibility() : true;
  };
  const squash = text => text.replace(/\s+/g, ' ').trim();
  // The text as laid out: textContent runs "Stay with<br>the" together, innerText turns <br> and block boundaries into line breaks.
  const readable = element => (element ? squash(element.innerText || '') : '');
  // Effective opacity: the element's own and every ancestor's.
  const opacity = element => {
    let value = 1;
    for (let node = element; node && node.nodeType === Node.ELEMENT_NODE; node = node.parentElement) value *= Number(getComputedStyle(node).opacity);
    return value;
  };
  const describe = element => (element ? {
    visible: visible(element),
    display: getComputedStyle(element).display,
    opacity: getComputedStyle(element).opacity,
    effectiveOpacity: Number(opacity(element).toFixed(3)),
    href: element.getAttribute('href'),
    text: squash(element.textContent || '').slice(0, 60),
  } : null);

  const staticFrame = document.getElementById('lx-static');
  const hero = staticFrame ? staticFrame.querySelector('h1#lx-hero-title') : null;
  const reading = staticFrame ? staticFrame.querySelector('.lx-reading') : null;

  const sections = {};
  for (const id of ids) {
    const section = reading ? reading.querySelector(`section[id="${id}"]`) : null;
    sections[id] = { exists: Boolean(section), visible: visible(section) };
  }

  // Raw TeX in visible text: a "$" right before a letter or a backslash, once the prices are taken out.
  const tex = [];
  if (reading) {
    const walker = document.createTreeWalker(reading, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!visible(node.parentElement)) continue;
      let value = node.data;
      for (const price of prices) value = value.split(price).join(' ');
      if (/\$[A-Za-z\\]/.test(value)) tex.push(squash(value).slice(0, 100));
    }
  }

  // In-page links that point at nothing (SPEC §16.4, JS off: "Every link resolves").
  const brokenLinks = [...new Set([...document.querySelectorAll('a[href^="#"]')]
    .map(link => link.getAttribute('href'))
    .filter(href => href.length > 1 && !document.getElementById(decodeURIComponent(href.slice(1)))))];

  return {
    bootVisible: visible(document.getElementById('boot')),
    hasStatic: Boolean(staticFrame),
    h1s: [...document.querySelectorAll('h1')].map(h1 => ({ id: h1.id, text: readable(h1) })),
    hero: hero ? { ...describe(hero), readable: readable(hero), textContent: squash(hero.textContent || '') } : null,
    heroWords: hero ? [...hero.querySelectorAll('.lx-wi')].map(word => ({ word: squash(word.textContent || ''), transform: getComputedStyle(word).transform })) : [],
    heroTitle,
    lead: describe(staticFrame && staticFrame.querySelector('#top .lx-hero-lead')),
    buttons: staticFrame ? [...staticFrame.querySelectorAll('#top .lx-hero-actions a')].map(describe) : [],
    hasReading: Boolean(reading),
    sections,
    text: { readable: readable(document.body), textContent: squash(document.body.textContent || '') },
    tex,
    brokenLinks,
  };
}

test.describe('JavaScript off', () => {
  test.use({ javaScriptEnabled: false });

  test('first screen: no cover, the static hero settled @fallback @m1', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    const facts = await page.evaluate(readPage, { ids: CHAPTER_IDS, prices: PRICES, heroTitle: HERO_TITLE });

    expect.soft(facts.bootVisible, 'the #boot cover is not shown').toBe(false);
    expect.soft(facts.hasStatic, '#lx-static is in the page').toBe(true);
    expect.soft(facts.hero && [facts.hero.readable, facts.hero.textContent], `the static h1 reads "${HERO_TITLE}" (h1s: ${JSON.stringify(facts.h1s)})`).toContain(HERO_TITLE);
    expect.soft(facts.hero && facts.hero.visible, 'the static h1 is visible').toBe(true);
    expect.soft(facts.heroWords.length, 'the h1 is split into words (.lx-wi)').toBeGreaterThan(0);
    for (const { word, transform } of facts.heroWords) expect.soft(transform, `the word "${word}" stands in place (computed transform)`).toBe('none');
    expect.soft(facts.lead, 'the hero lead').toMatchObject({ visible: true, opacity: '1', effectiveOpacity: 1 });
    expect.soft(facts.buttons.length, 'the two hero buttons are in the markup').toBe(2);
    // At 760 px and below the stylesheet drops "Try a problem" (display: none, landing-experience.css), live and static alike.
    const narrow = page.viewportSize().width <= 760;
    facts.buttons.forEach((button, index) => {
      if (narrow && button.display === 'none' && button.href === '#playground') return;
      expect.soft(button, `hero button ${index + 1} (${button.text})`).toMatchObject({ visible: true, opacity: '1', effectiveOpacity: 1 });
    });
    expect.soft(facts.buttons.some(button => button.href === '/?auth=signup' && button.visible), 'the sign-up button ("Find your level", /?auth=signup) is shown').toBe(true);
  });

  // Fails until the reading version (static/LandingReading.tsx) replaces its placeholder.
  test('reading version: every chapter, the FAQ and the prices readable @fallback @m1', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    const facts = await page.evaluate(readPage, { ids: CHAPTER_IDS, prices: PRICES, heroTitle: HERO_TITLE });
    // A phrase is read when either the whitespace-normalised textContent or the text as laid out (<br> and blocks as spaces) holds it.
    const reads = phrase => facts.text.textContent.includes(phrase) || facts.text.readable.includes(phrase);

    expect.soft(facts.hasReading, '#lx-static holds the reading version (.lx-reading)').toBe(true);
    for (const id of CHAPTER_IDS) {
      expect.soft(facts.sections[id], `#lx-static .lx-reading section#${id} is there and visible`).toEqual({ exists: true, visible: true });
    }
    for (const heading of HEADINGS) expect.soft(reads(heading), `the page reads the heading "${heading}"`).toBe(true);
    for (const question of FAQ_QUESTIONS) expect.soft(reads(question), `the page reads the question "${question}"`).toBe(true);
    for (const price of PRICES) expect.soft(reads(price), `the page reads the price "${price}"`).toBe(true);
    expect.soft(facts.tex, 'no raw TeX ("$" before a letter or a backslash) in a visible text node of the reading version').toEqual([]);
    expect.soft(facts.brokenLinks, 'every in-page link resolves to an element (SPEC §16.4)').toEqual([]);
  });
});
