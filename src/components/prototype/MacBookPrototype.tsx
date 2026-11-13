import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowLeft, ArrowUpRight, ChevronLeft, ChevronRight, Lock, MousePointerClick, Smartphone } from 'lucide-react';
import { SCREEN_PX, createStage, screenCentre, type Shot, type StageHandle } from './macbookStage';
import '../../styles/macbook-prototype.css';

/*
 * The film: one camera position per section of the page. Scrolling from one
 * section to the next carries the camera from one shot to the next.
 */
const SCENES: Array<{ id: string; name: string; shot: Shot }> = [
  { id: 'overview', name: 'Overview', shot: { az: -32, el: 13, dist: 84, target: [0, 7.5, -2], lid: 108, shift: [0.36, -0.04], shiftTall: [0, -0.36], span: 24, spanTall: 28 } },
  { id: 'screen', name: 'Screen', shot: { az: 0, el: 8, dist: 68, target: screenCentre(98), lid: 98, shift: [0, 0.1], shiftTall: [0, 0.16], span: 20, spanTall: 20 } },
  { id: 'keyboard', name: 'Keyboard', shot: { az: -12, el: 66, dist: 80, target: [0, 0, 0.5], lid: 108, shift: [-0.36, -0.08], shiftTall: [0, -0.4], span: 21, spanTall: 27, keys: 1 } },
  { id: 'specs', name: 'Specs', shot: { az: 88, el: 3, dist: 86, target: [0, 8, -2.5], lid: 100, shift: [0.2, -0.04], shiftTall: [0, -0.62], span: 15, spanTall: 30 } },
  { id: 'open', name: 'Open it', shot: { az: 34, el: 8, dist: 88, target: [0, 4, 0], lid: 44, shift: [0, 0.26], shiftTall: [0, 0.22], span: 25, spanTall: 25 } },
];
const SHOTS = SCENES.map(s => s.shot);
const SCREEN = 1;

/* The top configuration of the 16-inch MacBook Pro introduced in 2026. */
const SPECS: Array<[string, string, string]> = [
  ['Chip', 'M5 Max', '18-core CPU, 40-core GPU'],
  ['Memory', '128GB', 'the most it takes'],
  ['Storage', '16TB', 'SSD'],
  ['Display', '16.3″ OLED', '120Hz, 2000 nits peak'],
  ['Battery', '22 hours', 'of video on one charge'],
  ['Body', '1.6 cm thin', 'Space Black aluminium'],
];

function clock() {
  const d = new Date();
  return `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}  ${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

export default function MacBookPrototype() {
  const scroller = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const flatHost = useRef<HTMLDivElement>(null);
  const stage = useRef<StageHandle | null>(null);
  const sections = useRef<Array<HTMLElement | null>>([]);
  const [scene, setScene] = useState(0);
  const [live, setLive] = useState(false);
  const [ready, setReady] = useState(false);
  const [flat, setFlat] = useState(false);
  const [time, setTime] = useState(clock);

  /* The display's contents live in an element of our own, so three.js can move it without React noticing. */
  const screen = useMemo(() => {
    const el = document.createElement('div');
    el.className = 'mb-screen';
    return el;
  }, []);

  useEffect(() => {
    if (!canvas.current || !layer.current) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    try {
      stage.current = createStage({ canvas: canvas.current, layer: layer.current, screen, shots: SHOTS, still, onReady: () => setReady(true) });
    } catch {
      /* No WebGL: the app is still shown, flat, in a plain frame. */
      setFlat(true); setReady(true);
    }
    return () => { stage.current?.dispose(); stage.current = null; };
  }, [screen]);

  useEffect(() => {
    const el = flatHost.current;
    if (!flat || !el) return;
    el.appendChild(screen);
    const fit = () => el.style.setProperty('--s', String(Math.min((window.innerWidth * 0.86) / SCREEN_PX.w, (window.innerHeight * 0.6) / SCREEN_PX.h)));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [flat, screen]);

  /* Scroll position drives everything: the camera, which words are lit, which scene is current. */
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let raf = 0;
    const read = () => {
      raf = 0;
      const p = el.scrollTop / Math.max(1, el.clientHeight);
      stage.current?.setProgress(p);
      sections.current.forEach((s, i) => { if (s) s.style.setProperty('--near', String(Math.max(0, 1 - Math.abs(p - i) * 1.9).toFixed(3))); });
      setScene(Math.max(0, Math.min(SCENES.length - 1, Math.round(p))));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(read); };
    read();
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { el.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(raf); };
  }, []);

  const go = (i: number) => {
    const el = scroller.current;
    if (!el) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ top: Math.max(0, Math.min(SCENES.length - 1, i)) * el.clientHeight, behavior: still ? 'auto' : 'smooth' });
  };

  /*
   * One swipe, one scene. Left to itself a short turn of the wheel would be
   * snapped back to where it started, so the wheel is read as a direction: the
   * first movement sends the page to the next scene, and the rest of that same
   * gesture, including a trackpad's coasting, is ignored until it has stopped.
   */
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let held = false, lastAt = 0, target = 0;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
      e.preventDefault();
      /* The gesture is over once the page has arrived and the wheel has been quiet for a moment. */
      const arrived = Math.abs(el.scrollTop - target * el.clientHeight) < 2;
      if (held && arrived && e.timeStamp - lastAt > 180) held = false;
      lastAt = e.timeStamp;
      if (held || Math.abs(e.deltaY) < 4) return;
      const now = Math.round(el.scrollTop / Math.max(1, el.clientHeight));
      target = Math.max(0, Math.min(SCENES.length - 1, now + (e.deltaY > 0 ? 1 : -1)));
      if (target === now) return;
      held = true;
      go(target);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  /* The page scrolls inside this component, so the keys that scroll a page are wired by hand. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const onControl = e.target instanceof HTMLElement && e.target.closest('a, button, input, textarea');
      const el = scroller.current;
      if (!el) return;
      const now = Math.round(el.scrollTop / Math.max(1, el.clientHeight));
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey && !onControl)) { e.preventDefault(); go(now + 1); }
      else if (e.key === 'ArrowUp' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey && !onControl)) { e.preventDefault(); go(now - 1); }
      else if (e.key === 'Home') { e.preventDefault(); go(0); }
      else if (e.key === 'End') { e.preventDefault(); go(SCENES.length - 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* The app only takes the pointer while its shot is on screen; anywhere else the page must scroll. */
  useEffect(() => { if (scene !== SCREEN) setLive(false); }, [scene]);

  useEffect(() => {
    const id = window.setInterval(() => setTime(clock()), 20_000);
    return () => window.clearInterval(id);
  }, []);

  const ref = (i: number) => (el: HTMLElement | null) => { sections.current[i] = el; };
  const host = typeof window === 'undefined' ? 'calculixhub.com' : window.location.host;

  return (
    <main className="macbook-presentation" ref={scroller} data-scene={SCENES[scene].id} data-ready={ready || undefined} data-flat={flat || undefined}>
      <div className="mb-stage" aria-hidden={flat ? undefined : 'true'}>
        <div className="mb-layer" ref={layer} />
        <canvas className="mb-canvas" ref={canvas} />
        {flat && <div className="mb-flat" ref={flatHost} style={{ width: SCREEN_PX.w, height: SCREEN_PX.h }} />}
      </div>

      {createPortal(
        <div className="mb-display" style={{ width: SCREEN_PX.w, height: SCREEN_PX.h }}>
          <div className="mb-menubar" aria-hidden="true">
            <b>Safari</b><span>File</span><span>Edit</span><span>View</span><span>History</span><span>Bookmarks</span><span>Window</span><span>Help</span>
            <i className="mb-island" />
            <em>{time}</em>
          </div>
          <div className="mb-browser" aria-hidden="true">
            <span className="mb-lights"><i /><i /><i /></span>
            <ChevronLeft size={19} strokeWidth={1.8} /><ChevronRight size={19} strokeWidth={1.8} className="is-dim" />
            <span className="mb-address"><Lock size={12} strokeWidth={2} />{host}</span>
          </div>
          <div className="mb-page">
            <iframe title="CalculixHub live workspace" src="/?demo=1" tabIndex={live ? 0 : -1} style={{ pointerEvents: live ? 'auto' : 'none' }} />
            <button type="button" className="mb-cover" data-on={scene === SCREEN && !live ? '' : undefined} tabIndex={scene === SCREEN && !live ? 0 : -1} onClick={() => setLive(true)}>
              <span><MousePointerClick size={30} strokeWidth={1.6} aria-hidden="true" />Click to use the app</span>
            </button>
          </div>
        </div>,
        screen,
      )}

      <header className="mb-bar">
        <a className="mb-back" href="/"><ArrowLeft size={15} strokeWidth={1.8} aria-hidden="true" />CalculixHub</a>
        <p className="mb-model"><i aria-hidden="true" />MacBook Pro 16″ <span>· M5 Max · live demo</span></p>
      </header>

      <nav className="mb-nav" aria-label="Scenes">
        {SCENES.map((s, i) => (
          <button key={s.id} type="button" aria-current={i === scene ? 'step' : undefined} onClick={() => go(i)}><span>{s.name}</span><i aria-hidden="true" /></button>
        ))}
      </nav>

      <section className="mb-scene mb-at-left" ref={ref(0)}>
        <div className="mb-copy">
          <h1>CalculixHub <em>on a Mac.</em></h1>
          <p>Scroll down. The camera moves around the laptop and shows you each part.</p>
          <button type="button" className="mb-scroll" onClick={() => go(1)}><span><ArrowDown size={16} strokeWidth={2} aria-hidden="true" /></span>Scroll, or press ↓</button>
        </div>
      </section>

      <section className="mb-scene mb-at-bottom" ref={ref(1)}>
        <div className="mb-copy mb-copy-row">
          <div>
            <h2>This screen is <em>the real app.</em></h2>
            <p>{live ? 'It’s yours. Click, type and scroll inside the screen.' : 'Click it and use it, right here on the page.'}</p>
          </div>
          <button type="button" className="mb-cta" onClick={() => setLive(v => !v)}>{live ? 'Done, keep scrolling' : 'Use the app'}</button>
        </div>
      </section>

      <section className="mb-scene mb-at-right" ref={ref(2)}>
        <div className="mb-copy">
          <h2>Press <kbd>⌘</kbd><kbd>K</kbd>. <em>Go anywhere.</em></h2>
          <p>One shortcut finds every page and every action. You never hunt through menus.</p>
          <ul className="mb-shortcuts">
            <li><span><kbd>⌘</kbd><kbd>K</kbd></span>Search everything</li>
            <li><span><kbd>S</kbd></span>Open scratch paper</li>
            <li><span><kbd>G</kbd><small>then a letter</small></span>Jump to a page</li>
          </ul>
        </div>
      </section>

      <section className="mb-scene mb-at-left" ref={ref(3)}>
        <div className="mb-copy">
          <h2>The best MacBook <em>you can buy.</em></h2>
          <dl className="mb-specs">
            {SPECS.map(([name, value, note]) => (<div key={name}><dt>{name}</dt><dd><b>{value}</b>{note}</dd></div>))}
          </dl>
          <p className="mb-note">You don’t need this one. CalculixHub runs in any browser.</p>
        </div>
      </section>

      <section className="mb-scene mb-at-bottom" ref={ref(4)}>
        <div className="mb-copy mb-copy-centre">
          <h2>Now open it <em>on yours.</em></h2>
          <div className="mb-actions">
            <a className="mb-cta" href="/?demo=1">Open CalculixHub<ArrowUpRight size={17} strokeWidth={1.8} aria-hidden="true" /></a>
            <a className="mb-link" href="/?preview=ios"><Smartphone size={16} strokeWidth={1.8} aria-hidden="true" />See it on iPhone</a>
          </div>
        </div>
      </section>
    </main>
  );
}
