/**
 * One browser per agent, kept alive between commands.
 *
 * Started by `browser.mjs <id> start`; listens on 127.0.0.1 only. Holding the
 * page here (rather than reconnecting per command) is what lets it keep
 * collecting console errors, failed requests and slow calls for the whole
 * session, and keep the refs from the last snapshot valid.
 *
 *   node qa/agent/daemon.mjs <id> <port> <desktop|mobile|tablet>
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { chromium, devices } from 'playwright';
import { OUT, outPath } from '../lib/config.mjs';

const [id, portArg, deviceArg = 'desktop'] = process.argv.slice(2);
const port = Number(portArg);
const IDLE_MS = 45 * 60_000;
const SLOW_MS = 2500;

const PROFILES = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  mobile: { ...devices['iPhone 13'], defaultBrowserType: undefined },
  tablet: { ...devices['iPad Mini'], defaultBrowserType: undefined },
};
const SIZES = { desktop: { width: 1440, height: 900 }, laptop: { width: 1280, height: 800 }, tablet: { width: 768, height: 1024 }, mobile: { width: 390, height: 844 } };

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ...(PROFILES[deviceArg] ?? PROFILES.desktop), locale: 'en-US', timezoneId: 'Asia/Ho_Chi_Minh' });
const page = await context.newPage();
page.setDefaultTimeout(15_000);

let events = [];
let shotCount = 0;
let lastActivity = Date.now();
const started = new Map();

const record = (kind, detail) => events.push({ at: new Date().toISOString(), kind, url: page.url(), ...detail });
page.on('console', (message) => {
  if (['error', 'warning'].includes(message.type())) record(`console.${message.type()}`, { text: message.text().slice(0, 500) });
});
page.on('pageerror', (error) => record('pageerror', { text: String(error?.message ?? error).slice(0, 500) }));
page.on('request', (request) => started.set(request, Date.now()));
page.on('requestfailed', (request) => {
  const reason = request.failure()?.errorText ?? 'failed';
  if (reason !== 'net::ERR_ABORTED') record('request.failed', { request: `${request.method()} ${request.url().slice(0, 200)}`, text: reason });
});
page.on('response', (response) => {
  const request = response.request();
  const elapsed = Date.now() - (started.get(request) ?? Date.now());
  started.delete(request);
  const target = `${request.method()} ${response.url().slice(0, 200)}`;
  if (response.status() >= 400) record('response.error', { request: target, status: response.status() });
  else if (elapsed > SLOW_MS && !/\.(png|jpe?g|webp|gif|woff2?|css|js)(\?|$)/.test(response.url())) record('response.slow', { request: target, ms: elapsed });
});

const log = (entry) => appendFileSync(outPath('agents', id, 'actions.jsonl'), `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);

/** Visible interactive elements, tagged with refs the CLI can act on. */
function snapshot({ all }) {
  for (const el of document.querySelectorAll('[data-qa-ref]')) el.removeAttribute('data-qa-ref');
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05;
  };
  const inView = (el) => {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  };
  const clean = (text) => (text ?? '').replace(/\s+/g, ' ').trim();
  const labelOf = (el) => {
    const by = el.getAttribute('aria-labelledby');
    if (by) return clean(by.split(/\s+/).map((ref) => document.getElementById(ref)?.innerText).join(' '));
    if (el.getAttribute('aria-label')) return clean(el.getAttribute('aria-label'));
    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label) return clean(label.innerText);
    }
    const wrapping = el.closest('label');
    if (wrapping && wrapping !== el) return clean(wrapping.innerText);
    return '';
  };
  const roleOf = (el) => {
    const role = el.getAttribute('role');
    if (role) return role;
    const tag = el.tagName.toLowerCase();
    if (tag === 'a') return 'link';
    if (tag === 'button' || tag === 'summary') return 'button';
    if (tag === 'select') return 'select';
    if (tag === 'textarea') return 'textbox';
    if (tag === 'input') {
      const type = (el.getAttribute('type') ?? 'text').toLowerCase();
      return ({ checkbox: 'checkbox', radio: 'radio', submit: 'button', button: 'button', range: 'slider', file: 'file', search: 'searchbox' })[type] ?? 'textbox';
    }
    if (el.isContentEditable) return 'textbox';
    return 'element';
  };

  const lines = [];
  const selector = 'a[href],button,input:not([type=hidden]),textarea,select,summary,[role=button],[role=link],[role=tab],[role=menuitem],[role=menuitemradio],[role=option],[role=checkbox],[role=switch],[role=radio],[role=slider],[contenteditable=true],[tabindex]:not([tabindex="-1"])';
  let n = 0;
  let offscreen = 0;
  for (const el of document.querySelectorAll(selector)) {
    if (!visible(el) && !(el.tagName === 'INPUT' && el.type === 'file')) continue;
    if (!all && !inView(el)) { offscreen += 1; continue; }
    if (n >= 250) break;
    n += 1;
    const ref = `e${n}`;
    el.setAttribute('data-qa-ref', ref);
    const role = roleOf(el);
    const text = clean(el.innerText ?? '').slice(0, 90);
    const name = labelOf(el) || text || clean(el.getAttribute('placeholder')) || clean(el.getAttribute('title')) || clean(el.getAttribute('alt')) || clean(el.getAttribute('href'));
    const flags = [];
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') flags.push('disabled');
    if (el.checked || el.getAttribute('aria-checked') === 'true') flags.push('checked');
    for (const attr of ['aria-expanded', 'aria-pressed', 'aria-selected', 'aria-current']) {
      const value = el.getAttribute(attr);
      if (value && value !== 'false') flags.push(`${attr.slice(5)}=${value}`);
    }
    let value = '';
    if (role === 'textbox' || role === 'searchbox' || role === 'select' || role === 'slider') {
      const v = el.isContentEditable ? el.innerText : el.value;
      value = ` value="${clean(v).slice(0, 80)}"`;
      if (el.getAttribute('placeholder')) value += ` placeholder="${clean(el.getAttribute('placeholder')).slice(0, 60)}"`;
    }
    lines.push(`${ref} ${role} "${name.slice(0, 90)}"${value}${flags.length ? ` [${flags.join(', ')}]` : ''}`);
  }

  const headings = [...document.querySelectorAll('h1,h2,h3')].filter((h) => visible(h) && (all || inView(h))).slice(0, 14).map((h) => `${h.tagName.toLowerCase()} "${clean(h.innerText).slice(0, 90)}"`);
  const dialogs = [...document.querySelectorAll('dialog[open],[role=dialog],[role=alertdialog]')].filter(visible).map((d) => clean(d.getAttribute('aria-label') ?? d.querySelector('h1,h2,h3')?.innerText ?? 'dialog').slice(0, 80));
  const live = [...document.querySelectorAll('[role=status],[role=alert],[aria-live]')].filter(visible).map((s) => clean(s.innerText)).filter(Boolean).slice(0, 8);
  const root = document.querySelector('main') ?? document.body;
  const text = clean(root.innerText).slice(0, 1400);

  return [
    `URL: ${location.href}`,
    `Title: ${document.title}`,
    `Viewport ${innerWidth}x${innerHeight}, scrolled ${Math.round(scrollY)} of ${Math.max(0, document.documentElement.scrollHeight - innerHeight)}`,
    dialogs.length ? `Open dialog: ${dialogs.join(' | ')}` : '',
    headings.length ? `Headings: ${headings.join(' · ')}` : '',
    live.length ? `Status/alerts: ${live.join(' | ')}` : '',
    '',
    ...lines,
    offscreen ? `(+${offscreen} more controls off-screen; scroll, or snap --all)` : '',
    '',
    `Text: ${text}`,
  ].filter((line, i, arr) => line !== '' || arr[i - 1] !== '').join('\n');
}

// A ref from the last snapshot, or else a name: accessible name first (it
// covers icon buttons labelled only by aria-label), then visible text.
const locate = (target) => (/^e\d+$/.test(target)
  ? page.locator(`[data-qa-ref="${target}"]`)
  : page.getByRole('button', { name: target }).or(page.getByRole('link', { name: target })).or(page.getByText(target, { exact: false })).first());

async function settle() {
  await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(350);
}

function confirmationLink(email) {
  const file = `${OUT}/confirm/${email}.url`;
  return existsSync(file) ? readFileSync(file, 'utf8').trim() : null;
}

const commands = {
  async goto([url]) {
    const t0 = Date.now();
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await settle();
    return `Loaded ${page.url()} (HTTP ${response?.status() ?? '?'}) in ${Date.now() - t0} ms`;
  },
  async snap(args) { return page.evaluate(snapshot, { all: args.includes('--all') }); },
  async read() { return page.evaluate(() => (document.querySelector('main') ?? document.body).innerText.replace(/\n{3,}/g, '\n\n').slice(0, 12_000)); },
  async click([target]) { await locate(target).click(); await settle(); return `Clicked ${target}`; },
  async hover([target]) { await locate(target).hover(); return `Hovering ${target}`; },
  async fill([target, ...text]) { await locate(target).fill(text.join(' ')); return `Filled ${target}`; },
  async type([target, ...text]) { await locate(target).click(); await page.keyboard.type(text.join(' '), { delay: 30 }); return `Typed into ${target}`; },
  async secret([target, name]) {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is not set for this session.`);
    await locate(target).fill(value);
    return `Entered ${name} into ${target}`;
  },
  async press([key]) { await page.keyboard.press(key); await settle(); return `Pressed ${key}`; },
  async select([target, ...value]) { await locate(target).selectOption({ label: value.join(' ') }).catch(() => locate(target).selectOption(value.join(' '))); await settle(); return `Selected ${value.join(' ')}`; },
  async upload([target, path]) { await locate(target).setInputFiles(path); await settle(); return `Attached ${path}`; },
  async scroll([direction = 'down']) {
    await page.evaluate((d) => {
      if (d === 'top') scrollTo(0, 0);
      else if (d === 'bottom') scrollTo(0, document.documentElement.scrollHeight);
      else scrollBy(0, (d === 'up' ? -0.8 : 0.8) * innerHeight);
    }, direction);
    await page.waitForTimeout(300);
    return `Scrolled ${direction}`;
  },
  async shot([name = 'screen', ...flags]) {
    shotCount += 1;
    const file = outPath('agents', id, 'shots', `${String(shotCount).padStart(3, '0')}-${name.replace(/[^a-z0-9-]+/gi, '-').slice(0, 60)}.png`);
    await page.screenshot({ path: file, fullPage: flags.includes('--full') });
    return `Saved ${file.replace(`${process.cwd()}/`, '')}`;
  },
  async logs() {
    const batch = events;
    events = [];
    if (batch.length === 0) return 'No console errors, failed requests or slow calls since the last check.';
    return batch.map((e) => `${e.kind}${e.status ? ` ${e.status}` : ''}${e.ms ? ` ${e.ms}ms` : ''} ${e.request ?? ''} ${e.text ?? ''} (on ${e.url})`.replace(/\s+/g, ' ')).join('\n');
  },
  async theme([scheme = 'dark']) { await page.emulateMedia({ colorScheme: scheme === 'light' ? 'light' : 'dark' }); await page.waitForTimeout(300); return `Colour scheme: ${scheme}`; },
  async resize([size = 'desktop']) { await page.setViewportSize(SIZES[size] ?? SIZES.desktop); await page.waitForTimeout(300); return `Viewport: ${size}`; },
  async wait([what = '1000']) {
    if (/^\d+$/.test(what)) { await page.waitForTimeout(Math.min(Number(what), 60_000)); return `Waited ${what} ms`; }
    await page.getByText(what, { exact: false }).first().waitFor({ timeout: 30_000 });
    return `"${what}" is on screen`;
  },
  async back() { await page.goBack(); await settle(); return `Back to ${page.url()}`; },
  async reload() { await page.reload(); await settle(); return `Reloaded ${page.url()}`; },
  async confirm() {
    const people = JSON.parse(readFileSync(`${OUT}/identities.json`, 'utf8')).people;
    const me = people.find((p) => p.id === id);
    if (!me) throw new Error(`No identity for ${id}.`);
    const deadline = Date.now() + 15 * 60_000;
    let link = confirmationLink(me.email);
    while (!link && Date.now() < deadline) { await new Promise((r) => setTimeout(r, 5000)); link = confirmationLink(me.email); }
    if (!link) throw new Error('No confirmation link arrived within 15 minutes. Report it as a blocker.');
    await page.goto(link, { waitUntil: 'domcontentloaded' });
    await settle();
    return `Opened the confirmation link; now at ${page.url()}`;
  },
  async stop() { setTimeout(async () => { await browser.close().catch(() => {}); process.exit(0); }, 50); return 'Browser closed.'; },
};

createServer(async (request, response) => {
  lastActivity = Date.now();
  if (request.url === '/health') { response.end('ok'); return; }
  let body = '';
  for await (const chunk of request) body += chunk;
  const { cmd, args = [] } = JSON.parse(body || '{}');
  const handler = commands[cmd];
  try {
    if (!handler) throw new Error(`Unknown command "${cmd}".`);
    const text = await handler(args);
    log({ cmd, args: cmd === 'secret' ? [args[0], args[1]] : args, ok: true });
    response.end(JSON.stringify({ ok: true, text }));
  } catch (error) {
    const message = String(error?.message ?? error).split('\n')[0];
    log({ cmd, args: cmd === 'secret' ? [args[0], args[1]] : args, ok: false, error: message });
    response.end(JSON.stringify({ ok: false, text: message }));
  }
}).listen(port, '127.0.0.1', () => {
  writeFileSync(outPath('agents', id, 'port'), String(port));
});

setInterval(async () => {
  if (Date.now() - lastActivity > IDLE_MS) { await browser.close().catch(() => {}); process.exit(0); }
}, 60_000).unref();
