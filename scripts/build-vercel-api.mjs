import { build } from 'esbuild';

// Vercel runs the file in api/ directly. Bundle our TypeScript router into
// that entry point so no extensionless source imports remain at runtime.
const entries = [
  'api/[...path].mjs',
  // Vercel's root-level dynamic function does not match nested API paths.
  // Give each nested route a concrete function path.
  'api/arena/action.mjs',
  'api/live-stats/event.mjs',
];

for (const outfile of entries) {
  await build({
    entryPoints: ['server/vercelEntry.ts'],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    packages: 'external',
    legalComments: 'none',
  });
}

// Execute the exact artifact Vercel will load. This catches unresolved local
// imports in CI/builds, before a deployment can become "Ready" but fail at
// its first request.
for (const entry of entries) {
  const { default: handler } = await import(`../${entry}`);
  if (typeof handler?.fetch !== 'function') throw new Error(`${entry} has no Web Handler.`);
}
