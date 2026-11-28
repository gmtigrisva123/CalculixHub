import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';
import {landingNoscript} from './src/components/landing/landingStatic';

/**
 * The landing page's words and links as plain HTML, for a browser that runs no
 * script (src/components/landing/landingStatic.ts): without it, such a visitor
 * would see only the boot screen.
 */
function landingNoscriptPlugin(): Plugin {
  return {
    name: 'landing-noscript',
    transformIndexHtml: {
      order: 'post',
      handler: html => html.replace('<div id="root"></div>', `<div id="root"></div>\n    ${landingNoscript()}`),
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      landingNoscriptPlugin(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    // A second checkout under .claude/worktrees (an agent's) must not be watched, and a dev
    // server may keep its optimised dependencies apart (VITE_CACHE_DIR) so two servers sharing
    // one node_modules never rewrite each other's React.
    cacheDir: process.env.VITE_CACHE_DIR || 'node_modules/.vite',
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify: file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : { ignored: ['**/.claude/**'] },
    },
  };
});
