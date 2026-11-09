/**
 * The hero's frame, melting.
 *
 * The strip of paper either side of the hero stage is drawn as cream: thick,
 * glossy, and running slowly down both edges. Bulges swell out of the strip
 * onto the dark stage and slide down it, some leaving a thin trail behind them,
 * and fall away at the bottom of the screen.
 *
 * Each edge is one SVG. Its shapes are plain circles and bars; a "goo" filter
 * melts them into one liquid surface, and a specular light gives that surface
 * its gloss. Only positions change from frame to frame, and only while the
 * hero is on screen. The layer fades as the next sheet slides over the hero,
 * because by then the stage has started to recede from the screen edge.
 */

import { useEffect, useRef } from 'react';
import { m, useReducedMotion, useTransform, type MotionValue } from 'motion/react';

interface Drop {
  y: number; // head centre
  v: number; // px per second
  r: number; // current head radius
  max: number; // full head radius
  trail: number; // trail length behind the head
  wait: number; // seconds before it forms again
  age: number;
}

const DROPS = 7;
const SWELLS = 4;

export default function HeroCream({ cover }: { cover: MotionValue<number> }) {
  const reduce = Boolean(useReducedMotion());
  const opacity = useTransform(cover, [0, 0.22], [1, 0]);
  const leftRef = useRef<SVGSVGElement>(null);
  const rightRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const sides = [leftRef.current, rightRef.current].filter(Boolean) as SVGSVGElement[];
    if (!sides.length) return;

    const state = sides.map(svg => {
      const heads = Array.from(svg.querySelectorAll<SVGCircleElement>('.lxc-head'));
      const trails = Array.from(svg.querySelectorAll<SVGRectElement>('.lxc-trail'));
      const swells = Array.from(svg.querySelectorAll<SVGEllipseElement>('.lxc-swell'));
      const drops: Drop[] = heads.map(() => ({ y: 0, v: 0, r: 0, max: 0, trail: 0, wait: 0, age: 0 }));
      const phases = swells.map(() => ({ y: Math.random(), speed: 0.004 + Math.random() * 0.006, seed: Math.random() * 10 }));
      return { svg, heads, trails, swells, drops, phases };
    });

    let H = 0;
    let edge = 0; // the x of the stage edge inside each svg
    const measure = () => {
      const box = sides[0].getBoundingClientRect();
      H = box.height;
      const frame = parseFloat(getComputedStyle(sides[0]).getPropertyValue('--lxc-frame')) || 16;
      edge = frame;
      sides.forEach(svg => {
        const strip = svg.querySelector('.lxc-strip');
        strip?.setAttribute('width', String(edge + 20));
        strip?.setAttribute('height', String(H + 40));
      });
    };

    const form = (d: Drop, first: boolean) => {
      d.max = (6 + Math.random() * 8) * Math.max(0.6, edge / 16);
      d.y = first ? Math.random() * H * 0.85 : 10 + Math.random() * H * 0.25;
      d.v = 4 + Math.random() * 8;
      d.r = first ? d.max : 0;
      d.trail = 0;
      d.age = first ? 2 : 0;
      d.wait = 0;
    };

    measure();
    state.forEach(s => s.drops.forEach(d => form(d, true)));

    const ro = new ResizeObserver(measure);
    sides.forEach(svg => ro.observe(svg));

    const draw = (dt: number, t: number) => {
      for (const s of state) {
        s.drops.forEach((d, i) => {
          const head = s.heads[i];
          const trail = s.trails[i];
          if (d.wait > 0) {
            d.wait -= dt;
            if (d.wait <= 0) form(d, false);
            head.setAttribute('r', '0');
            trail.setAttribute('height', '0');
            return;
          }
          d.age += dt;
          // A bulge swells out of the strip first, then gives in to gravity: cream is slow to start.
          d.r += (d.max - d.r) * Math.min(1, dt * 1.4);
          if (d.age > 1.2) {
            d.v = Math.min(d.v + dt * (5 + d.max * 1.2), 24 + d.max * 3);
            d.y += d.v * dt;
            d.trail = Math.min(d.trail + d.v * dt * 0.92, 120 + d.max * 30);
          }
          if (d.y - d.trail > H + 20) {
            d.wait = 0.6 + Math.random() * 4;
            return;
          }
          // The head leans out a little further the heavier it is, and wobbles as it runs.
          const wobble = Math.sin(t * 2.1 + i * 1.7) * 0.6;
          head.setAttribute('cx', (edge + d.r * 0.55 + wobble).toFixed(1));
          head.setAttribute('cy', d.y.toFixed(1));
          head.setAttribute('r', d.r.toFixed(2));
          const width = Math.max(2, d.r * 0.72);
          trail.setAttribute('x', (edge - 2).toFixed(1));
          trail.setAttribute('y', (d.y - d.trail).toFixed(1));
          trail.setAttribute('width', (width + 2).toFixed(1));
          trail.setAttribute('height', Math.max(0, d.trail).toFixed(1));
        });

        // Slow swells: the edge itself is never quite straight.
        s.swells.forEach((el, i) => {
          const p = s.phases[i];
          p.y = (p.y + p.speed * dt) % 1.2;
          const size = (6 + Math.sin(t * 0.7 + p.seed) * 3) * Math.max(0.6, edge / 16);
          el.setAttribute('cx', edge.toFixed(1));
          el.setAttribute('cy', ((p.y - 0.1) * H).toFixed(1));
          el.setAttribute('rx', size.toFixed(2));
          el.setAttribute('ry', (size * 4.5).toFixed(2));
        });
      }
    };

    if (reduce) {
      draw(0, 0);
      return () => ro.disconnect();
    }

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (window.scrollY > window.innerHeight * 1.1) return; // the hero is covered: nothing to melt
      draw(dt, now / 1000);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [reduce]);

  return (
    <m.div className="lxc" aria-hidden="true" style={reduce ? undefined : { opacity }}>
      <svg className="lxc-svg" width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <filter id="lxc-cream" x="-60%" y="-2%" width="220%" height="104%" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -10" result="goo" />
            <feGaussianBlur in="goo" stdDeviation="1.6" result="soft" />
            <feSpecularLighting in="soft" surfaceScale="4" specularConstant="1.05" specularExponent="22" lightingColor="#fffaf0" result="spec">
              <feDistantLight azimuth="225" elevation="26" />
            </feSpecularLighting>
            <feComposite in="spec" in2="goo" operator="in" result="gloss" />
            <feComposite in="goo" in2="gloss" operator="arithmetic" k1="0" k2="1" k3="0.9" k4="0" />
          </filter>
        </defs>
      </svg>
      {(['left', 'right'] as const).map(side => (
        <svg key={side} ref={side === 'left' ? leftRef : rightRef} className={`lxc-side lxc-${side}`}>
          <g filter="url(#lxc-cream)">
            <rect className="lxc-strip" x="-20" y="-20" width="36" height="4000" />
            {Array.from({ length: SWELLS }, (_, i) => <ellipse key={`s${i}`} className="lxc-swell" />)}
            {Array.from({ length: DROPS }, (_, i) => <rect key={`t${i}`} className="lxc-trail" rx="2" />)}
            {Array.from({ length: DROPS }, (_, i) => <circle key={`h${i}`} className="lxc-head" />)}
          </g>
        </svg>
      ))}
    </m.div>
  );
}
