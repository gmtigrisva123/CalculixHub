/**
 * @visual: the landing at eleven scroll points (SPEC §16.3).
 *
 * Progress 0, 0.1 ... 1.0 of the scroll range, in the light and dark themes,
 * in three modes: default (whatever the browser offers; this container and
 * CI rasterise with SwiftShader, so the hero draws its 2D fallback), reduced
 * motion, and no WebGL. Per project: 11 x 2 x 3 = 66 images, 132 in all.
 *
 * Snapshots are never committed. The comparison is two passes over two builds
 * (qa/landing/README.md): the base build writes them with --update-snapshots
 * into LX_SNAPSHOT_DIR, then the head build is compared against them.
 */
import { expect, test } from '@playwright/test';
import { mountAllChapters, noWebGL, scrollToProgress, withTheme } from './helpers.mjs';

const MODES = ['default', 'reduced', 'nowebgl'];
const THEMES = ['light', 'dark'];
const POINTS = Array.from({ length: 11 }, (_, index) => index);

for (const mode of MODES) {
  for (const theme of THEMES) {
    test(`${mode} mode, ${theme} theme: progress 0 to 1 @visual`, async ({ browser }) => {
      // Eleven screenshots, each allowed 30 s to settle: more than the default test timeout when a page never settles.
      test.slow();
      const context = await browser.newContext();
      try {
        await withTheme(context, theme);
        if (mode === 'nowebgl') await noWebGL(context);
        const page = await context.newPage();
        if (mode === 'reduced') await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto('/');
        // The hero's entrance.
        await page.waitForTimeout(4000);
        await mountAllChapters(page);
        for (const index of POINTS) {
          await scrollToProgress(page, index / 10);
          await expect.soft(page).toHaveScreenshot(`${mode}-${theme}-p${String(index).padStart(2, '0')}.png`, {
            animations: 'disabled',
            caret: 'hide',
            // The canvas draws in the default mode; the other two are DOM only.
            maxDiffPixelRatio: mode === 'default' ? 0.01 : 0.002,
            timeout: 30_000,
          });
        }
      } finally {
        await context.close();
      }
    });
  }
}
