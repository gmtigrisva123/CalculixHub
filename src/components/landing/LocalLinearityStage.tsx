/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The hero object: one curve, magnified until it is a straight line.
 *
 * ---------------------------------------------------------------------------
 * What is being drawn
 *
 * The curve is the item characteristic curve of a real item in the bank — the
 * sharpest one, meaning the highest discrimination `a` — plotted with the same
 * `probCorrect` the placement test calls when it decides what to ask next.
 * Nothing here is a stand-in for data the platform does not hold: it is the
 * model, drawn at its own parameters, and if an item with a higher `a` is added
 * to the bank tomorrow the hero re-plots itself around that item instead.
 *
 * ---------------------------------------------------------------------------
 * Why a zoom
 *
 * Scroll magnifies the plane 125x about a single point on that curve. Two
 * things happen on the way down, and both of them are true rather than staged:
 *
 *   - The dashed tangent line, which at 1x exits the top of the panel while the
 *     curve is still climbing, converges onto the curve until the two are the
 *     same line. That is local linearity, and it is real geometry — the page is
 *     not drawing a straighter curve, it is looking at a smaller piece of the
 *     same one.
 *
 *   - The grid subdivides at ratio 5, four times. 5^3 = 125, so the final frame
 *     is dimensionally identical to the first: same rule spacing, same visual
 *     density. The paper never changed. Only the curve did.
 *
 * ---------------------------------------------------------------------------
 * Three constraints the construction has to satisfy
 *
 *   1. Strokes must not scale. Everything geometric is SVG with
 *      `vector-effect: non-scaling-stroke` (declared once in landing.css), so a
 *      1px rule is 1px at both ends of the scroll.
 *
 *   2. The curve must not become a polygon. Sampling is geometric rather than
 *      uniform — points cluster toward the anchor down to 1e-4 plane units — so
 *      the segment length near the point being magnified stays far below a
 *      pixel even at 125x. A uniformly sampled path is smooth at 1x and visibly
 *      faceted by the bottom of the scroll.
 *
 *   3. The magnification must be exponential in scroll position. A linear ramp
 *      from 1 to 125 spends four fifths of the gesture below 25x and then
 *      lurches; `125^p` holds the perceived rate of zoom constant, which is the
 *      difference between falling into the plane and watching something inflate.
 */

import type React from 'react';
import { useEffect, useRef } from 'react';
import { m, useMotionValue, useMotionValueEvent, useTransform, type MotionValue } from 'motion/react';
import { ITEM_BANK } from '../../lib/itemBank';
import { probCorrect } from '../../lib/irt';

/* -------------------------------------------------------------------------- */
/* Geometry                                                                    */
/* -------------------------------------------------------------------------- */

/** Total magnification across the pinned scroll. 5^3, so the grid closes a cycle. */
const ZOOM_MAX = 125;

/** The plotted box, in plane units. See the note on the `viewBox` below. */
const VIEW_W = 100;
const VIEW_H = 56;

/**
 * Plane units per unit of ability, and per unit of probability.
 *
 * These two numbers are the composition, and they were tuned against the shape
 * on screen rather than picked for roundness.
 *
 * `SX = 40` puts 2.5 theta across the panel's 100 units, which is wide enough
 * that the logistic's transition — about 1.0 theta at this item's
 * discrimination — spends nearly half the width climbing. At the 20 it started
 * on, the same curve rose through a sixth of the frame and read as a step, not
 * a curve, which is a poor advertisement for an argument about curvature.
 *
 * `SY = 32` is then set by what fits. The anchor sits at P = 0.41, so 79% of
 * the curve's total height is above it and 21% below; against a panel showing
 * roughly ±23 units either side of the anchor, anything past ~34 pushes the
 * upper asymptote off the top — and the asymptote is the half of the 3PL worth
 * showing, since "you never reach certainty" is the claim it encodes.
 */
const SX = 40;
const SY = 32;

/**
 * The item the hero plots: the highest discrimination in the bank, because a
 * high `a` is a visibly sharper curve and the whole hero is an argument about
 * curvature. Ties break toward the harder item.
 */
const HERO_ITEM = ITEM_BANK.reduce(
  (best, item) => (item.a > best.a || (item.a === best.a && item.b > best.b) ? item : best),
  ITEM_BANK[0],
);

/**
 * Where the zoom lands.
 *
 * `u = 1.7a(theta - b)` is the logistic's argument, and |sigma''| is maximal at
 * u = ±1.3170 — the two knees of the S. Anchoring at the lower knee picks the
 * most curved point on the whole curve, which is the honest place to make a
 * claim about local linearity: anywhere flatter would be cheating, and the
 * inflection point at u = 0 would be cheating outright, since a logistic is
 * already linear to second order there.
 */
const U_KNEE = -1.3169579;
const ANCHOR_THETA = HERO_ITEM.b + U_KNEE / (1.7 * HERO_ITEM.a);
const ANCHOR_P = probCorrect(ANCHOR_THETA, HERO_ITEM);

/** Plane y for a probability. Negative because SVG y grows downward. */
const planeY = (p: number) => -(p - ANCHOR_P) * SY;

/**
 * One `<path>` per grid level rather than one per line.
 *
 * The five levels come to roughly 900 rules between them. As individual
 * elements that is 900 nodes the browser walks on every frame of the scroll;
 * folded into five `d` strings it is five, and the rasteriser does the same
 * work either way.
 */
function gridPath(step: number, extent: number): string {
  const n = Math.floor(extent / step);
  let d = '';
  for (let i = -n; i <= n; i += 1) {
    const v = (i * step).toFixed(6);
    d += `M${v} ${-extent}V${extent}M${-extent} ${v}H${extent}`;
  }
  return d;
}

/**
 * Grid levels, coarsest first, each a fifth of the one above it.
 *
 * The extents are not uniform and must not be. Each level is drawn out to
 * roughly the half-width of the widest plausible viewport *at the moment that
 * level fades in* — about 125 plane units of screen at 1x, divided by the
 * magnification where the level appears. Draw less and the level visibly stops
 * partway across a wide display, leaving a rectangle of finer paper sitting on
 * coarser paper; draw the 0.016 level out to ±70 like the coarse one and it
 * emits forty thousand rules in order to show two hundred.
 *
 * The extents therefore have to move whenever the fade windows below do. They
 * are two halves of one decision.
 */
const GRID_COARSE = gridPath(10, 70);
const GRID_MAJOR = gridPath(2, 70);
const GRID_FINE = gridPath(0.4, 36);
const GRID_FINER = gridPath(0.08, 7.5);
const GRID_FINEST = gridPath(0.016, 2);

/** The curve, sampled geometrically outward from the anchor in both directions. */
const CURVE_PATH = (() => {
  const N = 150;
  const near = 1e-4;
  const far = 70;
  const ratio = (far / near) ** (1 / N);

  const xs: number[] = [];
  for (let i = N; i >= 0; i -= 1) xs.push(-near * ratio ** i);
  xs.push(0);
  for (let i = 0; i <= N; i += 1) xs.push(near * ratio ** i);

  return xs
    .map((x, i) => {
      const y = planeY(probCorrect(ANCHOR_THETA + x / SX, HERO_ITEM));
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(6)} ${y.toFixed(6)}`;
    })
    .join('');
})();

/**
 * The tangent at the anchor, by central difference.
 *
 * Numerically rather than in closed form on purpose: `probCorrect` is the
 * authority on what the curve is, and a hand-differentiated copy of it here
 * would be a second definition free to drift from the first.
 */
const TANGENT_PATH = (() => {
  const h = 1e-5;
  const dP =
    (probCorrect(ANCHOR_THETA + h, HERO_ITEM) - probCorrect(ANCHOR_THETA - h, HERO_ITEM)) / (2 * h);
  const slope = (-dP * SY) / SX;
  return `M-70 ${(-70 * slope).toFixed(6)}L70 ${(70 * slope).toFixed(6)}`;
})();

/** The 3PL's two horizontal asymptotes: the guessing floor and certainty. */
const FLOOR_Y = planeY(HERO_ITEM.c).toFixed(4);
const CEILING_Y = planeY(1).toFixed(4);

/* -------------------------------------------------------------------------- */
/* Readout formatting                                                          */
/* -------------------------------------------------------------------------- */

function formatZoom(z: number): string {
  if (z < 10) return `${z.toFixed(2)}×`;
  if (z < 100) return `${z.toFixed(1)}×`;
  return `${z.toFixed(0)}×`;
}

/** Fixed notation at a precision that follows the window, never exponent form. */
function formatWindow(value: number): string {
  if (value >= 1) return value.toFixed(3);
  if (value >= 0.1) return value.toFixed(4);
  if (value >= 0.01) return value.toFixed(5);
  return value.toFixed(6);
}

/**
 * Significant digits track magnification.
 *
 * Quoting the anchor to six decimals at 1x would be a lie about precision, and
 * quoting it to two at 125x would round away the part of the number the zoom
 * has just spent two screens of scrolling resolving.
 */
function formatAnchor(value: number, zoom: number): string {
  const digits = Math.min(7, Math.max(2, 2 + Math.round(Math.log10(zoom) * 1.6)));
  return value.toFixed(digits);
}

/* -------------------------------------------------------------------------- */
/* Live text                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A span whose text follows a motion value without re-rendering React.
 *
 * These update on every frame of the scroll. Routing them through `useState`
 * would re-render this component and its whole subtree — five grid paths and a
 * three-hundred-point curve — sixty times a second, to change nine characters.
 */
function Live({ value, className }: { value: MotionValue<string>; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useMotionValueEvent(value, 'change', (next) => {
    if (ref.current) ref.current.textContent = next;
  });
  return (
    <span ref={ref} className={className}>
      {value.get()}
    </span>
  );
}

/* -------------------------------------------------------------------------- */

interface LocalLinearityStageProps {
  /** 0 at the top of the pinned scroll, 1 at the bottom of it. */
  progress: MotionValue<number>;
  /** When true the stage renders its 1x state and never moves. */
  still: boolean;
}

export default function LocalLinearityStage({ progress, still }: LocalLinearityStageProps) {
  const zoom = useTransform(progress, (p) => ZOOM_MAX ** p);

  /*
   * The reciprocal of the magnification, published to CSS as `--zk`.
   *
   * Every stroke width and dash length in landing.css is a multiple of it, so
   * the whole plane holds one-pixel rules the entire way down. See the comment
   * over `.plot-ink` for why `vector-effect` alone does not get this done.
   */
  const inverseZoom = useTransform(zoom, (z) => 1 / z);

  /*
   * Each level arrives as its own rules reach about 16px apart, which is where
   * the level above it has spread to roughly 80px and the paper is starting to
   * look empty. In magnification terms that is 3.9x, 19.5x and 97.6x, and
   * `125^p` puts those at p = 0.28, 0.62 and 0.95 — so each window is centred
   * there. No level ever fades out; a coarse one simply walks off the edges of
   * the viewport as it spreads, which is what happens on real paper.
   */
  const fineIn = useTransform(progress, [0.24, 0.4], [0, 1]);
  const finerIn = useTransform(progress, [0.56, 0.72], [0, 1]);
  const finestIn = useTransform(progress, [0.86, 1], [0, 1]);

  /* The frame leaves early, while its edge is still near the viewport edge. */
  const bezelOut = useTransform(progress, [0.04, 0.2], [1, 0]);

  /*
   * The reticle and its coordinates arrive, then leave before the closing line
   * does.
   *
   * They exist to say "this exact point is what is being magnified", which is a
   * claim that only needs making while the magnifying is legible as motion. By
   * the time the statement fades in over the centre of the screen, the reticle
   * is a target drawn on top of a sentence and the coordinates are running
   * through its second line — so both are gone by then, and the readout at the
   * bottom carries the magnification on alone.
   */
  const reticleIn = useTransform(progress, [0.06, 0.3, 0.6, 0.78], [0.3, 1, 1, 0]);
  const labelsIn = useTransform(progress, [0.16, 0.36, 0.5, 0.62], [0, 1, 1, 0]);
  const hudIn = useTransform(progress, [0.1, 0.28], [0, 1]);

  /*
   * How much ability is actually on screen.
   *
   * Not `2.5 / magnification`, which is what this started as and which is only
   * true while the panel is the thing you are looking through. Once the panel
   * outgrows the viewport — around 1.4x on a laptop — the frame stops being the
   * limit and the window edge takes over, and the shortcut was overstating the
   * span by the ratio between the two. So: the plot is `panelWidth * zoom`
   * pixels wide, the screen shows the smaller of that and its own width, and
   * dividing by pixels-per-unit and by SX turns the result into theta.
   *
   * The two measurements come off the panel element rather than the SVG,
   * because `getBoundingClientRect` on anything inside the stage reports the
   * magnified size and would cancel the very term being measured. `offsetWidth`
   * is the layout box and ignores transforms.
   */
  const panelRef = useRef<HTMLDivElement>(null);
  const metrics = useRef({ panelWidth: 0, pxPerUnit: 0 });
  const remeasured = useMotionValue(0);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return undefined;

    const measure = () => {
      const width = panel.offsetWidth;
      const height = panel.offsetHeight;
      if (!width || !height) return;
      // `slice` resolves the viewBox by whichever axis demands the larger scale.
      metrics.current = {
        panelWidth: width,
        pxPerUnit: Math.max(width / VIEW_W, height / VIEW_H),
      };
      remeasured.set(remeasured.get() + 1);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [remeasured]);

  const zoomText = useTransform(zoom, formatZoom);
  const windowText = useTransform([zoom, remeasured], ([z]: number[]) => {
    const { panelWidth, pxPerUnit } = metrics.current;
    if (!pxPerUnit) return formatWindow(VIEW_W / SX);
    const onScreenPx = Math.min(panelWidth * z, window.innerWidth);
    return formatWindow(onScreenPx / pxPerUnit / z / SX);
  });
  const thetaText = useTransform(zoom, (z) => formatAnchor(ANCHOR_THETA, z));
  const probText = useTransform(zoom, (z) => formatAnchor(ANCHOR_P, z));

  return (
    <div className="plot-stage absolute inset-0">
      {/* ---------------- the magnified plane ---------------- */}
      <m.div
        style={still ? undefined : { scale: zoom }}
        className="absolute inset-0 grid place-items-center"
      >
        <div ref={panelRef} className="plot-panel relative">
          {/*
            The viewBox is 100 x 56, not 100 x 100, and the difference is what
            makes this work on a phone.

            `slice` scales the box to cover, so the *larger* of width/100 and
            height/56 wins. On a wide desktop panel the width wins and the box
            behaves exactly as a square one would — 100 units across, cropped
            top and bottom. On a narrow panel a square viewBox would instead
            hand the whole 100 units to the vertical, and since the curve only
            occupies 24 of them the phone got a screenful of empty paper with a
            small graph in the middle. At 56 the height wins there instead, and
            it crops horizontally — which costs the far tail of a curve that is
            asymptotic anyway.
          */}
          <m.svg
            className="plot-ink absolute inset-0 w-full h-full"
            viewBox={`${-VIEW_W / 2} ${-VIEW_H / 2} ${VIEW_W} ${VIEW_H}`}
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
            style={still ? undefined : ({ '--zk': inverseZoom } as React.CSSProperties)}
          >
            <defs>
              <linearGradient id="icc-ink" gradientUnits="userSpaceOnUse" x1="-50" y1="0" x2="50" y2="0">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="50%" stopColor="#7dd3fc" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
            </defs>

            <path className="plot-grid" d={GRID_COARSE} />
            <path className="plot-grid-fine" d={GRID_MAJOR} />
            <m.path
              className="plot-grid-fine"
              d={GRID_FINE}
              style={still ? { opacity: 0 } : { opacity: fineIn }}
            />
            <m.path
              className="plot-grid-fine"
              d={GRID_FINER}
              style={still ? { opacity: 0 } : { opacity: finerIn }}
            />
            <m.path
              className="plot-grid-fine"
              d={GRID_FINEST}
              style={still ? { opacity: 0 } : { opacity: finestIn }}
            />

            {/* The 3PL's floor and ceiling — the two values the curve never reaches. */}
            <path className="plot-asymptote" d={`M-70 ${FLOOR_Y}H70`} />
            <path className="plot-asymptote" d={`M-70 ${CEILING_Y}H70`} />

            <path className="plot-tangent" d={TANGENT_PATH} />
            <path className="plot-curve" d={CURVE_PATH} stroke="url(#icc-ink)" />
          </m.svg>

          {/* ---------------- the bezel ---------------- */}
          <m.div
            style={still ? undefined : { opacity: bezelOut }}
            className="plot-bezel absolute inset-0 pointer-events-none"
          >
            {/*
              Each segment drops out at the width where it would start wrapping.
              A plotter header that reflows onto two lines stops reading as a
              machine label, which is the entire job this strip has.
            */}
            <div className="plot-strip absolute inset-x-0 top-0 hidden sm:flex items-center justify-between gap-4 px-4 py-2.5 text-[10.5px] sm:text-[11px] font-mono uppercase tracking-[0.14em] text-white/40 whitespace-nowrap">
              <span>
                P(correct | <span className="font-serif italic tracking-normal lowercase">θ</span>) · 3PL
              </span>
              <span className="hidden lg:inline truncate">
                {HERO_ITEM.source} · {HERO_ITEM.concept}
              </span>
              <span className="hidden sm:inline tnum">
                a {HERO_ITEM.a.toFixed(1)} · b {HERO_ITEM.b.toFixed(1)} · c {HERO_ITEM.c.toFixed(2)}
              </span>
            </div>

            <span className="plot-corner border-l border-t left-3 top-3 sm:top-10" />
            <span className="plot-corner border-r border-t right-3 top-3 sm:top-10" />
            <span className="plot-corner border-l border-b left-3 bottom-3" />
            <span className="plot-corner border-r border-b right-3 bottom-3" />

            <span className="absolute left-9 bottom-2.5 text-[10.5px] font-mono uppercase tracking-[0.16em] text-white/30">
              ability <span className="font-serif italic tracking-normal lowercase">θ</span> →
            </span>
          </m.div>
        </div>
      </m.div>

      {/* ---------------- the reticle ---------------- */}
      {/*
        Screen space, dead centre, which is the transform origin — so it marks
        the point being magnified without ever having to move or counter-scale.
      */}
      <m.div
        style={still ? { opacity: 0.55 } : { opacity: reticleIn }}
        className="absolute inset-0 grid place-items-center pointer-events-none"
      >
        <div className="relative grid place-items-center">
          <span className="reticle-hair absolute w-28 h-px" />
          <span className="reticle-hair-v absolute h-28 w-px" />
          <span className="reticle-ring absolute w-4 h-4 rounded-full" />
          <span className="reticle-dot absolute w-1 h-1 rounded-full" />
        </div>
      </m.div>

      <m.div
        style={still ? { opacity: 0 } : { opacity: labelsIn }}
        className="absolute inset-0 grid place-items-center pointer-events-none"
      >
        <div className="relative">
          <div className="absolute left-6 -top-1 whitespace-nowrap text-[11px] font-mono tnum text-azure-200/80 leading-[1.5]">
            <div>
              <span className="font-serif italic">θ</span> = <Live value={thetaText} />
            </div>
            <div className="text-white/45">
              P = <Live value={probText} />
            </div>
          </div>
        </div>
      </m.div>

      {/* ---------------- the readout ---------------- */}
      <m.div
        style={still ? { opacity: 0 } : { opacity: hudIn }}
        className="absolute inset-x-0 bottom-8 sm:bottom-10 flex justify-center px-5 pointer-events-none"
      >
        <div className="hud-strip rounded-pill flex items-center divide-x divide-white/10 text-[11px] font-mono uppercase tracking-[0.12em]">
          <span className="px-4 sm:px-5 py-2.5">
            <span className="text-white/35">mag </span>
            <Live value={zoomText} className="text-white/85" />
          </span>
          <span className="px-4 sm:px-5 py-2.5">
            <span className="text-white/35">window <span className="font-serif italic lowercase tracking-normal">Δθ</span> </span>
            <Live value={windowText} className="text-white/85" />
          </span>
          <span className="hidden sm:inline px-5 py-2.5 text-white/35 normal-case tracking-[0.06em]">
            item {HERO_ITEM.id}
          </span>
        </div>
      </m.div>
    </div>
  );
}
