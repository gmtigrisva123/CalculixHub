# Design — CalculixHub

The locked design system for this product: **Ink & Measure**. Every screen is built
from it. Read this before changing any interface; amend this file when the system
needs to grow, rather than overriding it locally.

- Tokens: [`tokens.css`](tokens.css) (source of truth) · bridge: [`src/styles/tokens.css`](src/styles/tokens.css)
- Type and elements: [`src/index.css`](src/index.css), [`src/styles/typography.css`](src/styles/typography.css)
- Components: [`src/styles/components.css`](src/styles/components.css) (`ui-*`), [`src/styles/page.css`](src/styles/page.css) (`pg-*`)
- Frame: [`src/styles/shell.css`](src/styles/shell.css), `src/components/WorkspaceShell.tsx`

## The idea

**Ink on paper. Colour belongs to mathematics. Yellow marks where you are.**

CalculixHub is a place to stay with a hard question, and its engine is honest
measurement: a level estimated with a margin of error. So the interface is a
typeset sheet you can write on, and every quantity on it is a position on a ruled
scale.

1. **One sheet.** One paper, one ink. Structure is drawn with rules, alignment and
   space. Nothing is boxed for the sake of being boxed, nothing is rounded past a
   corner that is just broken (2 px), and nothing casts a shadow unless it floats
   above the page (a menu, a dialog, the tutor).
2. **Colour belongs to mathematics.** Four flat pigments, one per topic, appear only
   in figures and data marks: a curve, a bar, a square in a key. The interface
   around them stays ink.
3. **Yellow marks where you are.** One accent, the yellow of the "yellow books" on
   every mathematician's shelf. It is a highlighter with a meaning: the page you are
   on, your row, your answer, your position on a scale, and the one action that
   matters on a view. By day it is never a text colour.
4. **Numbers are mathematics.** Every numeral anywhere in the product is set in
   Computer Modern, the face of the formulas, with no markup (`CM Digits`).

## System

- Genre · editorial, bespoke (not a catalogue theme)
- Structure · app pages: a ruled data sheet in a side-rail frame · marketing: a long
  typeset document with large figures · forms: a single ruled column
- Axes · light paper / roman serif (Modern) / chromatic-other (yellow ≈ 92°)
- Themes · day and night share every rule. Night keeps the hue and moves lightness:
  green-black paper, bone ink, and there the accent may also colour text and lines.

## Tokens

Use tokens for **every** colour, font, size, space, radius, rule width, easing and
duration. No hex, `rgb()`, `oklch()` or font name in a stylesheet or a component.
A shade that does not exist is `color-mix(in oklch, var(--a) N%, var(--b))`, or a
new name added to `tokens.css`. Canvas code reads tokens with
`getComputedStyle(document.documentElement).getPropertyValue('--ink')` and re-reads
them when `data-theme` changes.

| Role | Tokens |
| --- | --- |
| Paper | `--paper` · `--paper-2` (recessed, hover) · `--paper-3` (pressed, track) · `--paper-raised` (floating layers, fields) |
| Ink | `--ink` · `--ink-2` (secondary) · `--ink-3` (tertiary text, control outlines at rest) |
| Rules | `--rule` (hairline) · `--rule-2` (faint) · widths `--line-hair` 1px · `--line-medium` 1.5px · `--line-heavy` 2px |
| Accent | `--accent` (fill) · `--accent-ink` (text on it) · `--accent-soft` (wash; text on it is `--ink`) · `--accent-deep` (pressed) · `--accent-text` / `--accent-line` (ink by day, yellow at night) · `--focus` |
| Pigments | `--algebra` · `--geometry` · `--combinatorics` · `--number-theory`, each with `-ink` (small text) and `-soft` (wash). Inside `[data-topic="Algebra"]` (or `.hue-algebra`) they are `--hue`, `--hue-ink`, `--hue-soft` |
| Status | `--positive` · `--caution` · `--critical`, each with `-ink` and `-soft` · medals `--gold` `--silver` `--bronze` |
| Type | `--font-display` / `--font-reading` (Old Standard TT) · `--font-body` (Archivo) · `--font-math` (Computer Modern) · sizes `--fs-2xs … --fs-4xl`, `--fs-display` · widths `--wdth-ui` 95%, `--wdth-dense` 84%, `--wdth-wide` 112% |
| Space | 4 pt scale `--s-1 … --s-36` (the number × 4 px) · `--page-max` · `--page-gutter` · `--measure` 62ch |
| Shape | `--r-0` · `--r-control` 2px · `--r-round` (bubbles, dots only) · `--control-h` 44px · `--control-h-sm` 36px |
| Motion | `--ease-out` · `--ease-in` · `--ease-in-out` · `--dur-micro` 120ms · `--dur-short` 200ms · `--dur-long` 400ms |
| Layers | `--z-base … --z-tooltip` · `--shadow-float` (floating layers only) |

Tailwind utilities exist for all of them (`bg-paper`, `text-ink-2`, `border-rule`,
`bg-accent`, `text-algebra-ink`). The older semantic names (`--sf`, `--ct`, `--ln`,
`--ac`, `stone-*`) are aliases kept for screens not yet rewritten; do not use them
in new work.

## Typography

Three voices. Three families is the ceiling: there is **no monospace** and no
handwriting face.

| Voice | Face | Used for |
| --- | --- | --- |
| Reading | Old Standard TT 400 / 400 italic / 700 | Page titles, headings, problem statements, prose, quotes: words meant to be read and thought about |
| Interface | Archivo (variable weight and width) | Navigation, buttons, fields, labels, tables, captions, anything under 17 px |
| Mathematics | Computer Modern (KaTeX) | Formulas, and every numeral (`CM Digits` is first in both stacks). A number standing alone (a score, a count, a year) uses `.t-num` / `.t-figure` / `.ui-stat` |

- **Headings are upright, always.** Emphasis inside a heading is **weight** (regular
  beside bold): `A little time **to understand.**` An `<em>` in a heading is rendered
  bold and upright. Italic lives only in running body copy and inside mathematics.
- **No eyebrows.** No small label above a heading, no numbered tag (`01 · THE IDEA`),
  no label in a column beside a heading. If existing markup has one, it is dropped or
  folded into the body. The only small-capital labels allowed are column heads of a
  table and field labels (`.t-label`), sitting directly on the data they name.
- The serif is never set below `--fs-md` (17 px). Reading text is `--fs-lg` (19 px) at
  1.6 line height, at most `--measure` wide. Page titles are `.pg-title`; display type
  never exceeds `--fs-display` and is drawn in with `--track-display`.
- Interface text is 15 px, `font-stretch: var(--wdth-ui)`; dense tables may use
  `--wdth-dense`. Tabular figures wherever numbers align.
- Curly quotes, en dashes in ranges, real ellipses. No all-caps sentences.

## Colour in use

- **Accent, at most about 5 % of a view.** Allowed: the current page in the rail and
  tab bar; the active row in a command list; the learner's own row, bar, marker or
  score; a chosen answer (`mark`); a live streak; the single primary button of a
  view. Not allowed: section backgrounds, decorative shapes, icons, more than one
  primary button in a view.
- **Pigments are data.** A topic is a small flat square (`.ui-sq`) plus its name, a
  line or bar in its pigment, or the fill of a mathematical figure. Never a button, a
  card tint or a gradient. Levels, contests and rank tiers are not topics: they are
  ink, told apart by name and by a glyph.
- **Status** is `--positive`, `--caution`, `--critical`, always with a word or an
  icon, never colour alone. A wrong answer is struck through and marked, not merely
  red.
- No gradients (except the hard-stop band of a `mark`), no glows, no blur, no glass,
  no grain, no tinted shadows.

## Layout

- **Rows, not cards.** A list is rows separated by hairlines. A group of facts is a
  ruled table or a definition list. A "card" from the old interface becomes either a
  section (heavy rule + heading), a row, or a figure with a caption. Never nest a
  bordered box in a bordered box. A box is legitimate only for: a control (button,
  field), a floating layer, and a sheet the learner writes on (scratch paper, the
  answer form).
- **A section opens with a heavy rule** (`.pg-section` / `.ui-section`): 2 px of ink,
  then the heading directly beneath it in the same column, then the content. Sections
  are not evenly padded: let the important one breathe.
- **Left-biased.** Titles, text and actions align to the left edge of the content
  column. Do not centre a heading over its content; do not centre everything in an
  empty state. Break symmetry on purpose: unequal columns (for example 7 : 5), a
  figure that takes more room than its text.
- Content width `--page-max`; prose `--measure`. Spacing only from the 4 pt scale.
- Phone (≤ 767 px): one column, 16 px gutters, controls 44 px tall, no horizontal
  scroll (wide tables scroll inside their own block, formulas inside theirs), no
  button or tab label wrapping to two lines.

## Components

Use these before inventing. Each carries rest, hover, focus-visible, active and
disabled; fields also invalid, buttons also busy.

| Class | What it is |
| --- | --- |
| `.ui-btn` (+ `.is-primary` yellow · `.is-solid` ink · `.is-quiet` · `.is-danger` · `.is-sm` · `.is-lg` · `.is-block`) · `.ui-icon-btn` · `.ui-link` | Actions. One `.is-primary` per view |
| `.ui-field` · `.ui-label` · `.ui-help` (`.is-error`) · `.ui-check` · `.ui-radio` · `.ui-switch` | Forms. Field and button on one row share `--control-h` |
| `.ui-tag` (`.is-solid` `.is-accent` `.is-hue` `.is-positive` `.is-caution` `.is-critical`) · `.ui-chip` (toggle, `aria-pressed`) · `kbd` · `.ui-count` | Small facts and filters |
| `.ui-tabs` · `.ui-segment` | Views of one thing · one of a few |
| `.ui-table` (`td.is-num`, `tr.is-you`) | Booktabs table: heavy rule, head rule, heavy rule; no vertical rules |
| `.ui-scale` (`style="--value: 64"`, optional `<i>` flag, `--hue`) · `.ui-meter` | A quantity on a ruled scale · a plain progress line. These replace progress pills and radial gauges |
| `.ui-stat` · `.ui-sq` · `.ui-topic` · `.ui-avatar` · `.ui-fig` + `figcaption` | Numeral with its label · pigment square · topic · square avatar · figure with caption |
| `.ui-bubble` (`.is-on`) · `mark` / `.ui-mark` | Answer-form bubble · highlighter band |
| `.ui-notice` (`.is-warning` `.is-critical` `.is-positive`) · `.ui-empty` · `.ui-skel` | Messages and absences |
| `.ui-dialog` · `.ui-menu` + `.ui-menu-item` · `.ui-toast` | The only things that cast a shadow |
| `.pg-head` `.pg-title` `.pg-lede` `.pg-tally` `.pg-section` `.pg-toolbar` `.pg-search` `.pg-segment` `.pg-chip` `.pg-btn` `.pg-link` `.pg-empty` | The page skeleton shared by workspace screens |
| `.t-display` `.t-title` `.t-head` `.t-reading` `.t-lede` `.t-note` `.t-ui` `.t-small` `.t-label` `.t-num` `.t-figure` | The type voices |

Icons: `lucide-react` only, 1.75 stroke, as small supports to a word. No icon in a
tinted rounded tile, no emoji as an icon.

## Figures and data

- A figure is flat pigment and ink line: fills are solid, lines are 1 to 1.5 px of
  ink (construction lines `--rule`), points are small ink dots. No gradient fills, no
  glow, no drop shadow, no 3-D. Axes are hairlines; tick labels are interface text at
  `--fs-xs`; values are in the mathematics face.
- Series use the four pigments in topic order; a single series is ink. The learner's
  own point, bar or line carries the yellow flag (yellow with an ink edge).
- Prefer a ruled scale or a small table to a gauge, a ring or a KPI tile. Four numbers
  about a learner are a score line (`.ui-stat` in a row, ruled above and below), not
  four cards.
- Every figure has a text alternative (`role="img"` + `aria-label`, or a caption).

## Motion

- Only `transform` and `opacity`; easing `--ease-out` entering, `--ease-in` leaving;
  durations from the three tokens. Exits are shorter than entrances.
- One orchestrated entrance per page at most (a short fade and 8 px rise, staggered
  across a few blocks, done within half a second). After that, content is simply
  there: no reveal-on-scroll on every section, no word-by-word blur, no parallax, no
  pointer spotlights, no tilt, no hover lift or scale on rows and blocks.
- Hover is a change of ground (`--paper-2`), of rule, or of underline. Press is
  `translateY(1px)`.
- What may move with meaning: the yellow band gliding to the new page, a scale's flag
  travelling to its value, a number counting up once, a mathematical figure being
  drawn. Loops are for status only (a live dot, a spinner).
- `prefers-reduced-motion`: movement stops, state changes remain, opacity only.
- Focus rings appear instantly: `outline: 2px solid var(--focus)`, never animated.

## Accessibility floor

Body text ≥ 4.5 : 1, large text, icons and focus rings ≥ 3 : 1, in both themes
(the pairs in `tokens.css` are checked). Hit targets ≥ 44 px on touch. Colour is
never the only signal. Everything reachable by pointer is reachable by keyboard.

## Areas

- **Workspace pages** follow "A page": `.pg-head` (title with the phrase that matters
  in bold, lede in the reading face), then ruled sections. No hero panel, no dark
  band at the top of a page.
- **The problem** is the heart of the product. A statement is set like a real paper:
  reading face at 19 to 21 px, mathematics in Computer Modern, choices as lettered
  bubbles in ruled rows, the chosen one marked in yellow, one primary button.
- **Marketing page** may be louder: display type up to `--fs-display`, a large
  mathematical figure per chapter, wide ruled bands. It follows the theme like every
  other screen (no permanently dark "stage"). Navigation is a ruled masthead, not a
  floating glass pill; the footer is a short colophon, not four link columns.
- **Forms** (sign-in, onboarding, settings): one ruled column, labels above fields,
  errors under the field in words.
- **Device previews** (`?preview=ios`, `?preview=mac`) keep their purpose; the app
  drawn inside them follows this system.

## Not in this system

Italic or two-typeface emphasis in headings · eyebrow tags and numbered section
labels · card grids, card-in-card, side-stripe cards, KPI tile rows, icon tiles ·
dark gradient hero panels, glows, blur, glass, grain, blobs · pill buttons and pill
chips · radial gauges and rings · monospace labels · handwriting fonts · hover lifts,
spotlights, tilt, scroll-reveal on everything · raw colour values · invented numbers
or testimonials · redrawn browser or phone chrome in marketing.

## Exports

`tokens.css` at the repository root is plain CSS custom properties on `:root` (day)
and `:root[data-theme='dark']` (night) and can be dropped into another project as
is. `src/styles/tokens.css` shows the Tailwind v4 `@theme inline` mapping.
