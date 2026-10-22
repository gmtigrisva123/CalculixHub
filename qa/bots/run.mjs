/**
 * Scripted browser bots: the same journey, run in parallel, measured.
 *
 *   node qa/bots/run.mjs                 # every bot in identities.json
 *   node qa/bots/run.mjs --only B01      # one bot (the canary)
 *   node qa/bots/run.mjs --concurrency 8 --stagger 15000
 *
 * Each bot signs up (or signs in, on a rerun), takes the placement test, then
 * walks Learn, Community, Arena and every other screen. A step that fails is
 * recorded with a screenshot and the bot moves on, so one broken screen does
 * not hide the rest. Results: qa/out/bots/<id>.json.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium, devices } from 'playwright';
import { BASE_URL, OUT, outPath } from '../lib/config.mjs';
import { COMMENTS, POSTS } from './content.mjs';

const argv = process.argv.slice(2);
const flag = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);
const ONLY = flag('--only', '')?.split(',').filter(Boolean);
const CONCURRENCY = Number(flag('--concurrency', 8));
const STAGGER_MS = Number(flag('--stagger', 15000));
const SLOW_MS = 2500;

const PROFILES = {
  desktop: { viewport: { width: 1440, height: 900 } },
  mobile: { ...devices['iPhone 13'], defaultBrowserType: undefined },
  tablet: { ...devices['iPad Mini'], defaultBrowserType: undefined },
};

const NAV = {
  Dashboard: 'Home', Learn: 'Learn', 'Exam Archive': 'Exams', Arena: 'Arena', Leaderboard: 'Ranks',
  Progress: 'Stats', Community: 'Forum', Profile: 'You', Settings: 'Config', Inbox: 'Inbox',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Small seeded PRNG, so a bot makes the same choices on every run. */
function rng(seedText) {
  let h = 2166136261;
  for (const c of seedText) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function settle(page, ms = 400) {
  await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

const visible = (locator) => locator.first().isVisible().catch(() => false);

async function navigate(page, label) {
  const sidebar = page.locator('aside[aria-label="Main navigation"]');
  if (await visible(sidebar)) {
    await sidebar.getByRole('button', { name: label, exact: true }).click();
  } else {
    const quick = page.getByRole('navigation', { name: 'Quick navigation' });
    const tab = quick.getByRole('button', { name: NAV[label], exact: true });
    if (await visible(tab)) await tab.click();
    else {
      await quick.getByRole('button', { name: 'More' }).click();
      await sidebar.getByRole('button', { name: label, exact: true }).click();
    }
  }
  await settle(page, 700);
}

function confirmationLink(email) {
  const file = `${OUT}/confirm/${email}.url`;
  return existsSync(file) ? readFileSync(file, 'utf8').trim() : null;
}

async function runBot(person, browser) {
  const random = rng(person.id + person.email);
  const pick = (list) => list[Math.floor(random() * list.length)];
  const context = await browser.newContext({ ...(PROFILES[person.device] ?? PROFILES.desktop), locale: 'en-US', timezoneId: 'Asia/Ho_Chi_Minh' });
  await context.addInitScript(() => {
    window.__qa = { lcp: 0, cls: 0 };
    try {
      new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__qa.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((list) => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__qa.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
    } catch { /* older engines */ }
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);

  const result = { id: person.id, displayName: person.displayName, device: person.device, startedAt: new Date().toISOString(), steps: [], events: [], vitals: {} };
  const started = new Map();
  const event = (kind, detail) => result.events.push({ at: new Date().toISOString(), step: current, kind, url: page.url(), ...detail });
  let current = 'start';
  page.on('console', (m) => { if (m.type() === 'error') event('console.error', { text: m.text().slice(0, 400) }); });
  page.on('pageerror', (e) => event('pageerror', { text: String(e?.message ?? e).slice(0, 400) }));
  page.on('request', (r) => started.set(r, Date.now()));
  page.on('requestfailed', (r) => { if (r.failure()?.errorText !== 'net::ERR_ABORTED') event('request.failed', { request: `${r.method()} ${r.url().slice(0, 180)}`, text: r.failure()?.errorText }); });
  page.on('response', (res) => {
    const r = res.request();
    const ms = Date.now() - (started.get(r) ?? Date.now());
    started.delete(r);
    if (res.status() >= 400) event('response.error', { request: `${r.method()} ${res.url().slice(0, 180)}`, status: res.status() });
    else if (ms > SLOW_MS && !/\.(png|jpe?g|webp|gif|woff2?|css|js)(\?|$)/.test(res.url())) event('response.slow', { request: `${r.method()} ${res.url().slice(0, 180)}`, ms });
  });

  let shots = 0;
  const shot = async (name) => {
    shots += 1;
    const file = outPath('bots', person.id, `${String(shots).padStart(2, '0')}-${name}.png`);
    await page.screenshot({ path: file }).catch(() => {});
    return file.replace(`${process.cwd()}/`, '');
  };

  const step = async (name, fn, { critical = false } = {}) => {
    current = name;
    const t0 = Date.now();
    try {
      const detail = await fn();
      result.steps.push({ name, ok: true, ms: Date.now() - t0, detail: detail ?? null, screenshot: await shot(name) });
    } catch (error) {
      result.steps.push({ name, ok: false, ms: Date.now() - t0, error: String(error?.message ?? error).split('\n')[0].slice(0, 300), screenshot: await shot(`${name}-failed`) });
      if (critical) throw error;
    }
  };

  const lang = person.language === 'vi' ? 'vi' : 'en';

  try {
    await step('landing', async () => {
      const response = await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      await settle(page, 1500);
      const timing = await page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0];
        return { ttfb: Math.round(nav?.responseStart ?? 0), domContentLoaded: Math.round(nav?.domContentLoadedEventEnd ?? 0), load: Math.round(nav?.loadEventEnd ?? 0), lcp: Math.round(window.__qa?.lcp ?? 0), cls: Number((window.__qa?.cls ?? 0).toFixed(3)) };
      });
      result.vitals.landing = timing;
      return `HTTP ${response?.status()}; LCP ${timing.lcp} ms; CLS ${timing.cls}`;
    }, { critical: true });

    let outcome = '';
    await step('account', async () => {
      const signUp = page.getByRole('button', { name: 'Sign up', exact: true });
      if (!(await visible(signUp))) await page.getByRole('button', { name: /open menu/i }).click();
      await signUp.first().click();
      await page.locator('#auth-name').fill(person.displayName);
      await page.locator('#auth-email').fill(person.email);
      await page.locator('#auth-password').fill(person.password);
      await page.getByRole('button', { name: 'Create account' }).click();
      outcome = await waitForAuthOutcome(page);
      if (outcome === 'exists') {
        // A rerun: the account is already there, so sign in instead.
        await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
        await page.locator('#auth-email').fill(person.email);
        await page.locator('#auth-password').fill(person.password);
        await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
        outcome = await waitForAuthOutcome(page);
      }
      if (outcome.startsWith('error')) throw new Error(outcome);
      return outcome;
    }, { critical: true });

    if (outcome === 'verify') {
      await step('confirm-email', async () => {
        const deadline = Date.now() + 15 * 60_000;
        let link = confirmationLink(person.email);
        while (!link && Date.now() < deadline) { await sleep(5000); link = confirmationLink(person.email); }
        if (!link) throw new Error('No confirmation link within 15 minutes');
        await page.goto(link, { waitUntil: 'domcontentloaded' });
        await settle(page, 1500);
        outcome = await waitForAuthOutcome(page);
        if (outcome === 'login') {
          await page.locator('#auth-email').fill(person.email);
          await page.locator('#auth-password').fill(person.password);
          await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
          outcome = await waitForAuthOutcome(page);
        }
        return outcome;
      }, { critical: true });
    }

    if (outcome === 'placement') {
      await step('placement', async () => {
        let answered = 0;
        for (let i = 0; i < 40; i += 1) {
          const begin = page.getByRole('button', { name: /Begin learning/ });
          if (await visible(begin)) { await begin.click(); break; }
          const choices = page.locator('.placement-choice');
          const count = await choices.count();
          if (count === 0) { await sleep(800); continue; }
          if (random() < 0.12) await page.getByRole('button', { name: /not sure yet/ }).click();
          else {
            await choices.nth(Math.floor(random() * count)).click();
            await page.getByRole('button', { name: /^Continue/ }).click();
          }
          answered += 1;
          await sleep(400 + random() * 900);
        }
        await page.locator('aside[aria-label="Main navigation"], nav[aria-label="Quick navigation"]').first().waitFor({ timeout: 30_000 });
        return `${answered} answers`;
      }, { critical: true });
    }

    await step('dashboard', async () => {
      await page.locator('aside[aria-label="Main navigation"], nav[aria-label="Quick navigation"]').first().waitFor({ timeout: 30_000 });
      await settle(page, 800);
      return await page.locator('main h1, main h2').first().innerText().catch(() => '');
    });

    await step('learn', async () => {
      await navigate(page, 'Learn');
      const outcomes = [];
      for (let n = 0; n < 3; n += 1) {
        const cards = page.locator('main button.text-left');
        await cards.first().waitFor({ timeout: 20_000 });
        await cards.nth(Math.min(n * 2, (await cards.count()) - 1)).click();
        await settle(page, 600);
        const grid = page.getByRole('group', { name: /^Digit 1$/ });
        if (await visible(grid)) {
          const columns = await page.getByRole('group', { name: /^Digit \d+$/ }).count();
          for (let c = 1; c <= columns; c += 1) await page.getByRole('button', { name: `Column ${c}, digit ${Math.floor(random() * 10)}` }).click();
        } else if (await visible(page.getByPlaceholder(/numerical or algebraic/))) {
          await page.getByPlaceholder(/numerical or algebraic/).fill(String(Math.floor(random() * 200)));
        } else {
          const options = page.locator('main .space-y-2 > button');
          if (await options.count()) await options.nth(Math.floor(random() * (await options.count()))).click();
        }
        await page.getByRole('button', { name: /Submit Your Answer/ }).click();
        await settle(page, 900);
        outcomes.push((await page.locator('[role=status], [role=alert]').allInnerTexts().catch(() => [])).join(' ').slice(0, 120) || 'submitted');
        await navigate(page, 'Learn');
      }
      return outcomes.join(' | ');
    });

    await step('community-post', async () => {
      await navigate(page, 'Community');
      await page.getByRole('region', { name: 'Create a post' }).getByRole('button').first().click();
      const box = page.getByRole('textbox', { name: 'Create post' });
      await box.waitFor();
      await box.click();
      await page.keyboard.type(pick(POSTS[lang]), { delay: 8 });
      await page.getByRole('button', { name: 'Post', exact: true }).click();
      await box.waitFor({ state: 'hidden', timeout: 15_000 });
      await settle(page, 800);
      return 'posted';
    });

    await step('community-comment-react', async () => {
      const feed = page.getByRole('region', { name: 'Community feed' });
      const posts = feed.locator('article');
      const total = await posts.count();
      if (total === 0) return 'feed empty';
      const target = posts.nth(Math.floor(random() * Math.min(total, 6)));
      await target.scrollIntoViewIfNeeded();
      const like = target.getByRole('button', { name: 'Like' }).first();
      if (await visible(like)) await like.click();
      const commentButton = target.getByRole('button', { name: /^Comment/ }).first();
      if (await visible(commentButton)) await commentButton.click();
      const input = page.getByRole('textbox', { name: /Write a comment|Be the first to comment/ }).first();
      await input.waitFor({ timeout: 10_000 });
      await input.click();
      await page.keyboard.type(pick(COMMENTS[lang]), { delay: 8 });
      await page.getByRole('button', { name: 'Send comment' }).first().click();
      await settle(page, 900);
      return `of ${total} posts`;
    });

    await step('arena', async () => {
      await navigate(page, 'Arena');
      await page.getByText('THE MATCH BOARD').waitFor();
      await settle(page, 800);
      const live = page.locator('article.arena-match', { has: page.getByText('Live now') }).first();
      if (!(await visible(live))) return 'no live match';
      await live.getByRole('button', { name: /Take a seat/ }).click();
      await settle(page, 800);
      const enter = page.getByRole('button', { name: /Enter the arena/ });
      if (await visible(enter)) await enter.click();
      await page.locator('[aria-label="Question navigator"]').waitFor({ timeout: 20_000 });
      const rounds = await page.locator('[aria-label="Question navigator"] button').count();
      let submitted = 0;
      for (let q = 0; q < Math.min(rounds, 4); q += 1) {
        await page.locator('[aria-label="Question navigator"] button').nth(q).click();
        await settle(page, 300);
        if (random() < 0.15) { await page.getByRole('button', { name: /Pass this question/ }).click(); await settle(page, 500); continue; }
        const columns = await page.getByRole('group', { name: /^Digit \d+$/ }).count();
        for (let c = 1; c <= columns; c += 1) await page.getByRole('button', { name: `Column ${c}, digit ${Math.floor(random() * 10)}` }).click();
        await page.getByRole('button', { name: 'Submit answer' }).click();
        await settle(page, 700);
        submitted += 1;
      }
      await page.getByRole('button', { name: /Finish my match/ }).click();
      await page.getByRole('button', { name: 'Confirm finish' }).click();
      await page.getByText('Your match, in perspective.').waitFor({ timeout: 20_000 });
      return `${submitted} answers in ${rounds} questions`;
    });

    for (const screen of ['Exam Archive', 'Leaderboard', 'Progress', 'Inbox', 'Profile', 'Settings']) {
      await step(screen.toLowerCase().replace(' ', '-'), async () => {
        const t0 = Date.now();
        await navigate(page, screen);
        await page.locator('main').waitFor();
        return `${Date.now() - t0} ms to settle`;
      });
    }

    await step('dark-theme', async () => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await navigate(page, 'Community');
      return await page.evaluate(() => document.documentElement.dataset.theme ?? 'unset');
    });

    await step('sign-out-in', async () => {
      await page.emulateMedia({ colorScheme: 'light' });
      await navigate(page, 'Profile');
      await page.getByRole('button', { name: /Sign out/ }).click();
      await settle(page, 1200);
      const signIn = page.getByRole('button', { name: 'Sign in', exact: true });
      if (!(await visible(signIn))) await page.getByRole('button', { name: /open menu/i }).click();
      await signIn.first().click();
      await page.locator('#auth-email').fill(person.email);
      await page.locator('#auth-password').fill(person.password);
      await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
      const back = await waitForAuthOutcome(page);
      if (back !== 'workspace') throw new Error(`after sign-in: ${back}`);
      return 'signed back in';
    });
  } catch {
    // A critical step failed; its record is already in result.steps.
  } finally {
    result.finishedAt = new Date().toISOString();
    writeFileSync(outPath('bots', `${person.id}.json`), JSON.stringify(result, null, 2));
    await context.close().catch(() => {});
  }
  return result;
}

/** What the page settled on after an auth action. */
async function waitForAuthOutcome(page) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await visible(page.getByText('Check your inbox'))) return 'verify';
    if (await visible(page.locator('[aria-label="Placement test window"]'))) return 'placement';
    if (await visible(page.locator('aside[aria-label="Main navigation"], nav[aria-label="Quick navigation"]'))) return 'workspace';
    const alert = page.locator('[role=alert]');
    if (await visible(alert)) {
      const text = (await alert.first().innerText()).trim();
      if (/already|registered|exists/i.test(text)) return 'exists';
      if (text) return `error: ${text.slice(0, 160)}`;
    }
    if (await visible(page.getByRole('heading', { name: 'Welcome back' }))) return 'login';
    await sleep(500);
  }
  return 'error: no outcome within 30 s';
}

async function main() {
  const { people } = JSON.parse(readFileSync(`${OUT}/identities.json`, 'utf8'));
  const bots = people.filter((p) => p.kind === 'bot' && (!ONLY.length || ONLY.includes(p.id)));
  if (!bots.length) throw new Error('No bots selected. Run qa/identities.mjs first.');
  const browser = await chromium.launch({ headless: true });
  console.log(`Running ${bots.length} bot(s) against ${BASE_URL}, ${CONCURRENCY} at a time, sign-ups ${STAGGER_MS / 1000}s apart.`);

  const queue = [...bots];
  const results = [];
  const startTime = Date.now();
  let slot = 0;
  const worker = async () => {
    while (queue.length) {
      const person = queue.shift();
      // Sign-ups are spaced out so the auth rate limit sees a trickle, not a burst.
      const wait = startTime + slot++ * STAGGER_MS - Date.now();
      if (wait > 0) await sleep(wait);
      const r = await runBot(person, browser);
      const failed = r.steps.filter((s) => !s.ok).map((s) => s.name);
      console.log(`${r.id} ${r.displayName}: ${r.steps.filter((s) => s.ok).length}/${r.steps.length} steps ok${failed.length ? ` (failed: ${failed.join(', ')})` : ''}, ${r.events.length} events`);
      results.push(r);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, bots.length) }, worker));
  await browser.close();
  console.log(`Done. Results in ${OUT}/bots/`);
}

await main();
