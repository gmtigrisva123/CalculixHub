import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowLeft, ArrowUpRight, MessagesSquare, Pencil, Swords } from 'lucide-react';
import '../../styles/iphone-prototype.css';

/* The outer size of the handset, in CSS pixels, before it is scaled to fit. */
const DEVICE_W = 420;
const DEVICE_H = 892;

/* What the three main tabs of the app are for, in the order the app shows them. */
const INSIDE = [
  { icon: Pencil, name: 'Learn', what: 'Practice questions, with help when you get stuck.' },
  { icon: Swords, name: 'Arena', what: 'Race other students on the same problems, live.' },
  { icon: MessagesSquare, name: 'Community', what: 'Ask a question and talk it through.' },
];

function clock() {
  const d = new Date();
  return `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function IPhonePrototype() {
  const slot = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [touched, setTouched] = useState(false);
  const [scale, setScale] = useState(1);
  const [time, setTime] = useState(clock);
  const [chrome, setChrome] = useState({ bg: '#0d1b21', dark: true });

  /* The handset is scaled to whatever room its slot has been given. */
  useEffect(() => {
    const measure = () => {
      const d = slot.current;
      if (d) setScale(Math.max(0.4, Math.min(1, d.clientWidth / DEVICE_W, d.clientHeight / DEVICE_H)));
    };
    measure();
    const ro = new ResizeObserver(measure);
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

  /* Focus moving into the frame is the only sign, from out here, that the phone was tapped. */
  useEffect(() => {
    const onBlur = () => { if (document.activeElement === frame.current) setTouched(true); };
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, []);

  return (
    <main className="iphone-presentation">
      <header className="ip-bar">
        <a className="ip-back" href="/"><ArrowLeft size={15} strokeWidth={1.8} aria-hidden="true" />CalculixHub</a>
        <p className="ip-model"><i aria-hidden="true" />iPhone 18 Pro <span>· live demo</span></p>
      </header>

      <div className="ip-layout">
        <section className="ip-col ip-col-lead">
          <h1 className="ip-word ip-word-lead" aria-label="Try it right here.">Try it</h1>
          <div className="ip-settle" style={{ '--i': 1 } as CSSProperties}>
            <p className="ip-lede">This is CalculixHub on a phone. Tap the screen and use it. No download, no sign-up.</p>
            <a className="ip-cta" href="/?demo=1">Open it full screen<ArrowUpRight size={17} strokeWidth={1.8} aria-hidden="true" /></a>
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
          <p className="ip-hint" data-gone={touched || undefined} aria-hidden="true">
            Tap it, it works
            <svg viewBox="0 0 120 60" width="120" height="60"><path d="M4 12C40 2 84 12 108 44" /><path d="M92 42l17 4 2-18" /></svg>
          </p>
        </div>

        <section className="ip-col ip-col-tail">
          <p className="ip-word ip-word-tail" aria-hidden="true">right here.</p>
          <div className="ip-settle" style={{ '--i': 2 } as CSSProperties}>
            <h2 className="ip-inside-title">What you can do in it</h2>
            <ul className="ip-inside">
              {INSIDE.map(({ icon: Icon, name, what }) => (
                <li key={name}><span className="ip-inside-icon"><Icon size={19} strokeWidth={1.7} aria-hidden="true" /></span><div><b>{name}</b><p>{what}</p></div></li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}
