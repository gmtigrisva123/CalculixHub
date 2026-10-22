/**
 * Checks, against the live site, that a QA run is safe to start.
 *
 *   node qa/preflight.mjs              # before anything signs up
 *   node qa/preflight.mjs --canary B01 # after the first bot has signed up
 *
 * The first form proves the deploy carries this branch and that the QA cohort
 * migration is applied. The second signs the canary in and proves, from the
 * outside, that the cohort works: the database calls it "qa", and a signed-out
 * visitor cannot find its profile. Nothing else should run until both pass.
 *
 * The Supabase URL and anon key are read from the deployed bundle, where they
 * are public by design.
 */
import { readFileSync } from 'node:fs';
import { BASE_URL, OUT } from './lib/config.mjs';

const argv = process.argv.slice(2);
const canaryId = argv.includes('--canary') ? argv[argv.indexOf('--canary') + 1] : null;
let failures = 0;
const pass = (text) => console.log(`  ok    ${text}`);
const fail = (text) => { failures += 1; console.log(`  FAIL  ${text}`); };

async function supabaseFromBundle() {
  const html = await (await fetch(BASE_URL)).text();
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((m) => new URL(m[1], BASE_URL).href);
  for (const src of scripts) {
    const js = await (await fetch(src)).text();
    const url = js.match(/https:\/\/[a-z0-9]{20}\.supabase\.co/)?.[0];
    const key = js.match(/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g)?.find((token) => {
      try { return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).role === 'anon'; } catch { return false; }
    });
    if (url && key) return { url, key };
  }
  throw new Error('Could not find the Supabase URL and anon key in the deployed bundle.');
}

async function rpc({ url, key }, name, token) {
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: key, authorization: `Bearer ${token ?? key}`, 'content-type': 'application/json' },
    body: '{}',
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

async function main() {
  console.log(`Preflight for ${BASE_URL}`);

  const home = await fetch(BASE_URL);
  if (home.ok) pass(`site answers (HTTP ${home.status})`); else fail(`site answered HTTP ${home.status}`);
  const csp = home.headers.get('content-security-policy') ?? '';
  if (csp.includes("'sha256-")) pass('this branch is deployed (theme script allowed by hash)');
  else fail('the deploy predates this branch: merge and deploy it first');

  const arenas = await fetch(`${BASE_URL}/api/arenas`);
  if (arenas.ok) pass(`arena API answers (${(await arenas.json()).length} public arenas)`); else fail(`arena API answered HTTP ${arenas.status}`);

  const supabase = await supabaseFromBundle();
  pass(`Supabase project ${new URL(supabase.url).hostname.split('.')[0]}`);
  const cohort = await rpc(supabase, 'viewer_cohort');
  if (cohort.status === 200 && cohort.body === 'live') pass('QA cohort migration is applied (signed-out visitors are "live")');
  else fail(`QA cohort migration is missing (viewer_cohort: HTTP ${cohort.status}). Run supabase/qa-cohort-setup.sql in the SQL Editor.`);

  if (canaryId) {
    const { people } = JSON.parse(readFileSync(`${OUT}/identities.json`, 'utf8'));
    const canary = people.find((p) => p.id === canaryId);
    if (!canary) throw new Error(`No identity ${canaryId}`);
    const auth = await fetch(`${supabase.url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: supabase.key, 'content-type': 'application/json' },
      body: JSON.stringify({ email: canary.email, password: canary.password }),
    });
    const session = await auth.json();
    if (!auth.ok) {
      fail(`canary ${canaryId} cannot sign in: ${session.error_description ?? session.msg ?? auth.status}`);
    } else {
      const mine = await rpc(supabase, 'viewer_cohort', session.access_token);
      if (mine.body === 'qa') pass(`canary ${canaryId} is in the QA cohort`); else fail(`canary ${canaryId} is "${mine.body}", not "qa": its address must contain +cxqa-`);
      const id = session.user.id;
      const asVisitor = await fetch(`${supabase.url}/rest/v1/profiles?select=id&id=eq.${id}`, { headers: { apikey: supabase.key } });
      const asSelf = await fetch(`${supabase.url}/rest/v1/profiles?select=id&id=eq.${id}`, { headers: { apikey: supabase.key, authorization: `Bearer ${session.access_token}` } });
      const [visitorRows, selfRows] = [await asVisitor.json(), await asSelf.json()];
      if (Array.isArray(visitorRows) && visitorRows.length === 0) pass('a signed-out visitor cannot see the canary'); else fail('a signed-out visitor CAN see the canary: stop and check the migration');
      if (Array.isArray(selfRows) && selfRows.length === 1) pass('the canary sees itself'); else fail('the canary cannot see its own profile');
      const board = await fetch(`${supabase.url}/rest/v1/leaderboard_view?select=user_id&user_id=eq.${id}`, { headers: { apikey: supabase.key } });
      const boardRows = await board.json();
      if (Array.isArray(boardRows) && boardRows.length === 0) pass('the public leaderboard does not list the canary'); else fail('the public leaderboard lists the canary');
    }
  }

  console.log(failures ? `\n${failures} check(s) failed. Do not start the run.` : '\nAll checks passed.');
  process.exit(failures ? 1 : 0);
}

await main();
