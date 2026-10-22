/**
 * Hands a sign-up confirmation link to the bot or agent waiting for it.
 *
 *   node qa/confirm.mjs <email> <link>
 *   node qa/confirm.mjs --file links.json   # [{ "email": "...", "link": "..." }]
 *
 * Only needed when the project requires email confirmation. Whoever can read
 * the QA inbox (the orchestrating Claude session, through the Gmail connector)
 * finds each "Confirm your signup" mail and passes its link here; the waiting
 * bot or agent picks it up within five seconds.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { outPath } from './lib/config.mjs';

const argv = process.argv.slice(2);
const pairs = argv[0] === '--file'
  ? JSON.parse(readFileSync(argv[1], 'utf8'))
  : [{ email: argv[0], link: argv[1] }];

for (const { email, link } of pairs) {
  if (!/\+cxqa-/.test(email ?? '') || !/^https:\/\//.test(link ?? '')) throw new Error(`Refusing ${email}: QA addresses and https links only.`);
  writeFileSync(outPath('confirm', `${email}.url`), link);
  console.log(`Queued confirmation for ${email}`);
}
