import { build } from 'esbuild';

// Vercel runs the file in api/ directly. Bundle our TypeScript router into
// that entry point so no extensionless source imports remain at runtime.
await build({
  entryPoints: ['server/vercelEntry.ts'],
  outfile: 'api/[...path].mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  packages: 'external',
  legalComments: 'none',
});

// Execute the exact artifact Vercel will load. This catches unresolved local
// imports in CI/builds, before a deployment can become "Ready" but fail at
// its first request.
const { default: handler } = await import('../api/[...path].mjs');
if (typeof handler?.fetch !== 'function') throw new Error('Vercel API bundle has no Web Handler.');
