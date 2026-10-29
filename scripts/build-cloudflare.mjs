import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';

// Workers static assets serve dist/ without running the Worker, so the headers
// vercel.json declares for static files have to be written to dist/_headers.
// The document policy is read from server/security.ts, the same source the
// Worker and the Express server use, so it cannot drift from theirs.
const { outputFiles } = await build({
  entryPoints: ['server/security.ts'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'neutral',
  logLevel: 'silent',
});
const source = Buffer.from(outputFiles[0].text).toString('base64');
const { securityHeaders } = await import(`data:text/javascript;base64,${source}`);

const rules = {
  '/*': securityHeaders('document', { isProduction: true }),
  '/sw.js': { 'cache-control': 'no-cache, no-store, must-revalidate' },
  '/assets/*': { 'cache-control': 'public, max-age=31536000, immutable' },
};

const file = Object.entries(rules)
  .map(([path, headers]) => [path, ...Object.entries(headers).map(([name, value]) => `  ${name}: ${value}`)].join('\n'))
  .join('\n');

await writeFile('dist/_headers', `${file}\n`);
