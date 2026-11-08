import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MARK_DOT, MARK_PATH, MARK_STROKE } from './brand';

const root = join(__dirname, '..', '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('the CalculixHub logo', () => {
  it('is drawn by favicon.svg exactly as brand.ts draws it, in colours crawlers can read', () => {
    const svg = read('public/favicon.svg');
    expect(svg).toContain(`d="${MARK_PATH}"`);
    expect(svg).toContain(`stroke-width="${MARK_STROKE}"`);
    expect(svg).toContain(`cx="${MARK_DOT.cx}" cy="${MARK_DOT.cy}" r="${MARK_DOT.r}"`);
    // oklch() in an SVG favicon renders as nothing in link previews and older browsers.
    expect(svg).not.toMatch(/oklch|hsl\(|var\(/i);
  });

  it('is the mark the generated icons are built from', () => {
    const script = read('scripts/generate-icons.py');
    expect(script).toContain(`MARK_PATH = "${MARK_PATH}"`);
    expect(script).toContain(`STROKE_WIDTH = ${MARK_STROKE}`);
  });

  it('is not redrawn anywhere else: every other surface imports it', () => {
    // The path may appear only in brand.ts, the SVG and the icon script.
    const holders = ['src/components/landing/kit.tsx', 'src/components/WorkspaceShell.tsx', 'src/components/WelcomeScreen.tsx', 'src/components/MobileHeader.tsx', 'src/components/PlacementExperience.tsx'];
    for (const file of holders) expect(read(file), file).not.toContain('M30 9C11 2');
  });

  it('has every file the page head points at, at the size it promises', () => {
    const html = read('index.html');
    const local = [...html.matchAll(/(?:href|src)="(\/[^"]+\.(?:svg|png|ico|webmanifest))"/g)].map(match => match[1]);
    expect(local).toEqual(expect.arrayContaining(['/favicon.svg', '/favicon.ico', '/icons/icon-180.png']));
    for (const path of local) expect(existsSync(join(root, 'public', path)), path).toBe(true);

    // The share card is announced as 1200x630; make sure it is.
    const card = readFileSync(join(root, 'public', 'og-image.png'));
    expect(card.subarray(1, 4).toString()).toBe('PNG');
    expect(card.readUInt32BE(16)).toBe(1200);
    expect(card.readUInt32BE(20)).toBe(630);
    expect(html).toMatch(/og:image" content="https:\/\/[^"]+\/og-image\.png"/);
    expect(html).toMatch(/twitter:image" content="https:\/\/[^"]+\/og-image\.png"/);
    expect(html).toContain('property="og:image:width" content="1200"');
    expect(html).toContain('property="og:image:height" content="630"');

    // favicon.ico: an ICO header with three images.
    const ico = readFileSync(join(root, 'public', 'favicon.ico'));
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(3);
  });

  it('says the same thing in the tab, the share card and the install prompt', () => {
    const html = read('index.html');
    const content = (selector: string) => html.match(new RegExp(`<meta ${selector} content="([^"]*)"`))?.[1];
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1];
    const description = content('name="description"');
    expect(title).toBeTruthy();
    expect(description).toBeTruthy();
    expect(content('property="og:title"')).toBe(title);
    expect(content('name="twitter:title"')).toBe(title);
    expect(content('property="og:description"')).toBe(description);
    expect(content('name="twitter:description"')).toBe(description);
    expect(JSON.parse(read('public/manifest.webmanifest')).description).toBe(description);
    // A link preview truncates at about this length.
    expect(description!.length).toBeLessThanOrEqual(160);
  });
});
