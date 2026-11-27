/**
 * The landing page's static first frame, written into dist/index.html at build time.
 *
 * A first visit used to paint a night cover and wait for the app's code (the
 * entry bundle, the landing bundle and both stylesheets) before the hero could
 * appear: an LCP of 3.6 s on a slow 4G phone. This plugin renders the landing's
 * own nav, hero, sheet and footer, plus the chapters as plain reading matter,
 * into the HTML itself, with the CSS those elements use inlined. The hero is
 * then the first thing painted, its entrance plays from CSS
 * (src/styles/landing-entrance.css), and the live page takes over the same
 * markup when its code arrives (src/components/landing/entrance.ts).
 *
 * It runs on every client build, so every way the site is built gets it:
 * `npm run build`, `build:vercel`, `build:cloudflare`, the Pages workflow's
 * `vite build --base=…` and `ios:sync`. Anything going wrong fails the build,
 * rather than shipping a page that silently lost its first frame.
 *
 * What it writes:
 *   - <div id="lx-static"> immediately before <div id="root">;
 *   - one <style id="lx-static-css"> at the end of <head>, after the entry
 *     stylesheet so the cascade matches the live page: the rules that decide
 *     who sees the static frame (landing-static.css), the landing's own rules
 *     that apply to that markup (picked by beasties from the CSS this build
 *     emitted for the landing), and the reading version's styles;
 *   - the page's JSON-LD (a data block: it never runs, so the CSP's script
 *     hash is not involved).
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import Beasties from 'beasties';

const ENTRY = '/src/components/landing/static/entry-static.tsx';
const LANDING_MODULE = /src\/components\/landing\/LandingPage\.tsx$/;
const STATIC_CSS = 'src/styles/landing-static.css';
const READING_CSS = 'src/styles/landing-reading.css';
const ROOT_TAG = '<div id="root"></div>';

/** Rules that depend on state the boot script sets on <html>: they match no element at build time but must ship. */
const STATE_RULES = [/data-(?:js|cue|landing|entrance)\b/];

/** JSON for an inline <script> block: nothing in it can close the element. */
const LINE_SEPARATOR = String.fromCharCode(8232);
const PARAGRAPH_SEPARATOR = String.fromCharCode(8233);
const scriptJson = value => JSON.stringify(value)
  .replaceAll('<', '\\u003c')
  .replaceAll(LINE_SEPARATOR, '\\u2028')
  .replaceAll(PARAGRAPH_SEPARATOR, '\\u2029');

async function renderStatic(root) {
  const server = await createServer({
    configFile: false,
    root,
    logLevel: 'error',
    appType: 'custom',
    plugins: [react()],
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    const entry = await server.ssrLoadModule(ENTRY);
    return await entry.renderLandingStatic();
  } finally {
    await server.close();
  }
}

async function criticalCss(landingCss, markup, outDir, base) {
  const probe = `<!doctype html><html data-js data-landing data-cue><head><style>${landingCss}</style></head><body><div id="lx-static">${markup}</div><div id="root"></div></body></html>`;
  const beasties = new Beasties({
    path: outDir,
    publicPath: base,
    reduceInlineStyles: true,
    pruneSource: false,
    mergeStylesheets: false,
    external: false,
    inlineFonts: false,
    preloadFonts: false,
    keyframes: 'critical',
    compress: true,
    allowRules: STATE_RULES,
    logLevel: 'warn',
  });
  const html = await beasties.process(probe);
  const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(match => match[1]);
  if (!styles.length) throw new Error('landing-static: beasties returned no critical CSS');
  return styles.join('\n');
}

/** @returns {import('vite').Plugin} */
export default function landingStatic() {
  let config;
  return {
    name: 'calculix:landing-static',
    apply: 'build',
    enforce: 'post',
    configResolved(resolved) { config = resolved; },
    async writeBundle(options, bundle) {
      // The static frame belongs to the client build only.
      if (config.build.ssr) return;
      const outDir = options.dir ?? path.resolve(config.root, config.build.outDir);

      // The landing's stylesheet exactly as this build emitted it.
      // Rollup may leave the chunk without a facade (its entry shares modules with other chunks), so look for the module itself.
      const holds = file => (file.moduleIds ?? Object.keys(file.modules ?? {})).some(id => LANDING_MODULE.test(id.replaceAll('\\', '/')));
      const landing = Object.values(bundle).find(file => file.type === 'chunk' && holds(file));
      if (!landing) {
        const seen = Object.values(bundle).filter(file => file.type === 'chunk' && /Landing/.test(file.fileName)).map(file => `${file.fileName} <- ${file.facadeModuleId}`);
        throw new Error(`landing-static: no chunk was built for src/components/landing/LandingPage.tsx (landing chunks: ${seen.join(', ') || 'none'})`);
      }
      const cssFiles = [...(landing.viteMetadata?.importedCss ?? [])];
      const landingCss = cssFiles.map(name => {
        const asset = bundle[name];
        return asset && asset.type === 'asset' ? String(asset.source) : '';
      }).join('\n');
      if (!landingCss.trim()) throw new Error('landing-static: the landing chunk imports no CSS');

      const { markup, jsonLd } = await renderStatic(config.root);
      if (!markup.includes('id="lx-hero-title"')) throw new Error('landing-static: the rendered first frame has no hero headline');

      const [staticCss, readingCss] = await Promise.all([
        readFile(path.join(config.root, STATIC_CSS), 'utf8'),
        readFile(path.join(config.root, READING_CSS), 'utf8'),
      ]);
      const critical = await criticalCss(landingCss, markup, outDir, config.base);

      const htmlPath = path.join(outDir, 'index.html');
      let html = await readFile(htmlPath, 'utf8');
      if (html.split(ROOT_TAG).length !== 2) throw new Error(`landing-static: expected exactly one ${ROOT_TAG} in index.html`);
      if (!html.includes('</head>')) throw new Error('landing-static: index.html has no </head>');
      const style = `<style id="lx-static-css">${staticCss}\n${critical}\n${readingCss}</style>`;
      const data = jsonLd.map(item => `<script type="application/ld+json">${scriptJson(item)}</script>`).join('');
      html = html.replace('</head>', `${style}${data}</head>`);
      html = html.replace(ROOT_TAG, `<div id="lx-static">${markup}</div>${ROOT_TAG}`);
      await writeFile(htmlPath, html);

      const kb = bytes => `${(Buffer.byteLength(bytes) / 1024).toFixed(1)} KB`;
      this.info?.(`static first frame: markup ${kb(markup)}, css ${kb(style)}, json-ld ${kb(data)}`);
    },
  };
}
