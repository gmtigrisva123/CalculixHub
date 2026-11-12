import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import '../../styles/iphone-prototype.css';

/* The outer size of the handset, in CSS pixels, before it is scaled to fit. */
const DEVICE_W = 420;
const DEVICE_H = 892;

/* The curve drawn across the stage, and its derivative. */
const f = (x: number) => Math.sin(x) + x / 4;
const df = (x: number) => Math.cos(x) + 0.25;

const TICKS: Array<[number, string]> = [
  [-1.5, '−3π/2'], [-1, '−π'], [-0.5, '−π/2'], [0.5, 'π/2'], [1, 'π'], [1.5, '3π/2'],
];

type Size = { w: number; h: number };

/* Maps the function's own coordinates onto the stage. */
function plotFrame({ w, h }: Size) {
  const half = w >= 900 ? 2 * Math.PI : Math.PI;
  const ux = w / (2 * half);
  const uy = Math.min(h * 0.05, 54);
  const y0 = h * 0.8;
  return { half, ux, uy, y0, px: (x: number) => w / 2 + x * ux, py: (x: number) => y0 - f(x) * uy };
}

function clock() {
  const d = new Date();
  return `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function IPhonePrototype() {
  const stage = useRef<HTMLElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const tangent = useRef<SVGGElement>(null);
  const pointerX = useRef<number | null>(null);
  const [size, setSize] = useState<Size>({ w: 1440, h: 900 });
  const [scale, setScale] = useState(1);
  const [time, setTime] = useState(clock);
  const [chrome, setChrome] = useState({ bg: '#0d1b21', dark: true });

  /* The stage and the phone's slot both drive layout that CSS cannot express. */
  useEffect(() => {
    const measure = () => {
      const s = stage.current, d = slot.current;
      if (s) setSize({ w: s.clientWidth, h: s.clientHeight });
      if (d) setScale(Math.max(0.4, Math.min(1, d.clientWidth / DEVICE_W, d.clientHeight / DEVICE_H)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (stage.current) ro.observe(stage.current);
    if (slot.current) ro.observe(slot.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setTime(clock()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  /*
   * The status bar belongs to the phone, not to the app inside it, so it takes
   * its colour from whatever the app has painted behind its own first screen.
   */
  useEffect(() => {
    const read = () => {
      try {
        const doc = frame.current?.contentDocument;
        if (!doc?.body) return;
        const at = doc.elementsFromPoint(doc.documentElement.clientWidth / 2, 4);
        for (const el of [...at, doc.body, doc.documentElement]) {
          const m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g)?.map(Number);
          if (!m || m.length < 3 || (m.length > 3 && m[3] < 0.9)) continue;
          const bg = `rgb(${m[0]} ${m[1]} ${m[2]})`;
          const dark = (m[0] * 299 + m[1] * 587 + m[2] * 114) / 1000 < 140;
          setChrome(c => (c.bg === bg ? c : { bg, dark }));
          return;
        }
      } catch { /* a cross-origin frame keeps the default */ }
    };
    const id = window.setInterval(read, 1200);
    read();
    return () => window.clearInterval(id);
  }, []);

  const plot = useMemo(() => {
    const p = plotFrame(size);
    let d = '';
    for (let i = 0; i <= 240; i++) {
      const x = -p.half + (i / 240) * 2 * p.half;
      d += `${i ? 'L' : 'M'}${p.px(x).toFixed(1)} ${p.py(x).toFixed(1)}`;
    }
    return { ...p, d };
  }, [size]);

  /* The tangent follows the pointer; left alone, it wanders along the curve. */
  useEffect(() => {
    const g = tangent.current;
    if (!g) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const p = plotFrame(size);
    const [line, drop, dot, label] = Array.from(g.children) as SVGElement[];
    let x = p.half * 0.3, phase = 0.42, raf = 0, last = performance.now();
    const draw = () => {
      const cx = p.px(x), cy = p.py(x), m = df(x);
      const dx = p.ux, dy = -m * p.uy, len = Math.hypot(dx, dy), r = Math.min(150, size.w * 0.16);
      line.setAttribute('x1', String(cx - (dx / len) * r)); line.setAttribute('y1', String(cy - (dy / len) * r));
      line.setAttribute('x2', String(cx + (dx / len) * r)); line.setAttribute('y2', String(cy + (dy / len) * r));
      drop.setAttribute('x1', String(cx)); drop.setAttribute('x2', String(cx));
      drop.setAttribute('y1', String(cy)); drop.setAttribute('y2', String(p.y0));
      dot.setAttribute('cx', String(cx)); dot.setAttribute('cy', String(cy));
      /* The label sits on the side the line falls away from, and stays on the stage. */
      const before = cx > size.w - 170 || (m > 0 && cx > 170);
      label.setAttribute('x', String(cx + (before ? -14 : 14)));
      label.setAttribute('y', String(cy - 16));
      label.setAttribute('text-anchor', before ? 'end' : 'start');
      label.textContent = `f′(${x.toFixed(2).replace('-', '−')}) = ${m.toFixed(2).replace('-', '−')}`;
    };
    const tick = (now: number) => {
      const dt = Math.min(64, now - last); last = now;
      let target: number;
      if (pointerX.current !== null) target = (pointerX.current - size.w / 2) / p.ux;
      else { phase += dt * 0.00022; target = p.half * 0.78 * Math.sin(phase); }
      x += (target - x) * (still ? 1 : Math.min(1, dt * 0.006));
      draw();
      raf = requestAnimationFrame(tick);
    };
    draw();
    if (!still) raf = requestAnimationFrame(tick);
    const onMove = still ? (e: PointerEvent) => { x = (e.clientX - size.w / 2) / p.ux; draw(); } : null;
    if (onMove) window.addEventListener('pointermove', onMove);
    return () => { cancelAnimationFrame(raf); if (onMove) window.removeEventListener('pointermove', onMove); };
  }, [size]);

  return (
    <main
      className="iphone-presentation"
      ref={stage}
      onPointerMove={e => { if (e.pointerType === 'mouse') pointerX.current = e.clientX - (stage.current?.getBoundingClientRect().left ?? 0); }}
      onPointerLeave={() => { pointerX.current = null; }}
    >
      <svg className="ip-plot" width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`} aria-hidden="true">
        <line className="ip-axis" x1="0" x2={size.w} y1={plot.y0} y2={plot.y0} />
        {TICKS.filter(([k]) => Math.abs(k * Math.PI) < plot.half && Math.abs(k * Math.PI) * plot.ux > 250).map(([k, name]) => (
          <g key={name} transform={`translate(${plot.px(k * Math.PI)} ${plot.y0})`}>
            <line className="ip-axis" y1="-4" y2="4" />
            <text className="ip-tick" y="22" textAnchor="middle">{name}</text>
          </g>
        ))}
        <path className="ip-curve" d={plot.d} pathLength={1} />
        <text className="ip-fn" x={Math.max(18, Math.min(52, size.w * 0.034))} y={size.h - 30}>f(x) = sin x + x/4</text>
        <g className="ip-tangent" ref={tangent}>
          <line className="ip-tangent-line" />
          <line className="ip-tangent-drop" />
          <circle className="ip-tangent-dot" r="5" />
          <text className="ip-tangent-label" />
        </g>
      </svg>

      <header className="ip-bar">
        <a className="ip-back" href="/"><ArrowLeft size={15} strokeWidth={1.8} aria-hidden="true" />CalculixHub</a>
        <p className="ip-model"><i aria-hidden="true" />iPhone 18 Pro <span>· running live</span></p>
      </header>

      <div className="ip-layout">
        <section className="ip-col ip-col-lead">
          <h1 className="ip-word ip-word-lead" aria-label="Calculus, in hand.">Calculus,</h1>
          <div className="ip-settle" style={{ '--i': 1 } as CSSProperties}>
            <p className="ip-lede">This phone is running the real CalculixHub, not a recording. Tap through it the way you would on your own.</p>
            <a className="ip-cta" href="/?demo=1">Open the full workspace<ArrowUpRight size={17} strokeWidth={1.8} aria-hidden="true" /></a>
          </div>
        </section>

        <div className="ip-slot" ref={slot}>
          <div className="ip-device-box" style={{ width: DEVICE_W * scale, height: DEVICE_H * scale }}>
            <div className="ip-device" style={{ transform: `scale(${scale})`, '--chrome': chrome.bg } as CSSProperties} data-chrome={chrome.dark ? 'dark' : 'light'}>
              <span className="ip-key ip-key-action" aria-hidden="true" />
              <span className="ip-key ip-key-up" aria-hidden="true" />
              <span className="ip-key ip-key-down" aria-hidden="true" />
              <span className="ip-key ip-key-side" aria-hidden="true" />
              <span className="ip-key ip-key-camera" aria-hidden="true" />
              <div className="ip-screen">
                <div className="ip-status" aria-hidden="true">
                  <span className="ip-time">{time}</span>
                  <span className="ip-island"><i /></span>
                  <span className="ip-indicators">
                    <svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" /><rect x="5" y="5.5" width="3" height="6.5" rx="1" /><rect x="10" y="3" width="3" height="9" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" /></svg>
                    <svg width="17" height="12" viewBox="0 0 17 12"><path d="M8.5 2.6c2.3 0 4.4.9 6 2.4l1.1-1.2A10.4 10.4 0 0 0 8.5 1 10.4 10.4 0 0 0 1.4 3.8L2.5 5a8.7 8.7 0 0 1 6-2.400Zm0 3.500c1.3 0 2.5.500 3.5 1.300l1.1-1.200a6.9 6.9 0 0 0-9.2 0L5 7.400a5.2 5.2 0 0 1 3.5-1.300Zm0 3.400c-.700 0-1.3.300-1.8.700l1.8 1.8 1.8-1.800c-.500-.400-1.1-.700-1.8-.700Z" /></svg>
                    <svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.8" fill="none" stroke="currentColor" opacity=".4" /><rect x="2" y="2" width="17" height="9" rx="2.4" /><path d="M25 4.500v4c.800-.300 1.5-1.1 1.5-2s-.700-1.7-1.5-2Z" opacity=".45" /></svg>
                  </span>
                </div>
                <iframe ref={frame} title="CalculixHub live mobile workspace" src="/?demo=1" />
                <div className="ip-home" aria-hidden="true"><span /></div>
              </div>
            </div>
          </div>
          <span className="ip-contact" aria-hidden="true" />
        </div>

        <section className="ip-col ip-col-tail">
          <p className="ip-word ip-word-tail" aria-hidden="true">in hand.</p>
          <dl className="ip-facts ip-settle" style={{ '--i': 2 } as CSSProperties}>
            <div><dt>Same account</dt><dd>Saved questions and progress carry over from any screen.</dd></div>
            <div><dt>Same arenas</dt><dd>Live rounds and conversations, as they happen.</dd></div>
          </dl>
        </section>
      </div>
    </main>
  );
}
