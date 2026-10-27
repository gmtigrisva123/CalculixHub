/**
 * The landing page's navigation: a floating island over the page.
 *
 * It does four things on its own, all of them driven by where the reader is:
 *
 *   - takes the colour of whatever it floats over — dark glass on an ink stage,
 *     paper glass on paper — read from the `data-tone` of the section under it;
 *   - marks the chapter in view with a pill that slides between links;
 *   - steps out of the way while the reader scrolls down and comes back the
 *     moment they scroll up (never while it holds focus or its menu is open);
 *   - on narrow screens, folds into a two-line button that opens a full-screen
 *     menu, revealed from the button outwards.
 */

import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { AnimatePresence, m, useMotionValueEvent, useScroll } from 'motion/react';
import { Arrow, BrandMark, GLIDE } from './kit';
import { scrollToTarget, setScrollLocked } from './smoothScroll';

/** The chapters worth a jump, numbered as the page numbers them. */
export const NAV_LINKS = [
  { id: 'engine', label: 'How it works', chapter: '02' },
  { id: 'playground', label: 'Try one', chapter: '03' },
  { id: 'worlds', label: 'Topics', chapter: '04' },
  { id: 'archive', label: 'Past papers', chapter: '05' },
  { id: 'plans', label: 'Plans', chapter: '07' },
] as const;

/** Where a jump lands relative to its section, so a heading never hides under the island. */
const JUMP_OFFSET = -12;

export function scrollToSection(id: string) {
  const target = document.getElementById(id);
  if (target) scrollToTarget(target, { offset: JUMP_OFFSET });
}

/** An in-page link, travelled smoothly instead of jumped. */
export function jumpTo(event: MouseEvent<HTMLAnchorElement>, id: string) {
  if (!document.getElementById(id)) return;
  event.preventDefault();
  scrollToSection(id);
}

interface LandingNavProps {
  onSignIn: () => void;
  onRegister: () => void;
}

export default function LandingNav({ onSignIn, onRegister }: LandingNavProps) {
  const [hidden, setHidden] = useState(false);
  const [tone, setTone] = useState<'ink' | 'paper'>('ink');
  const [active, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [lifted, setLifted] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const { scrollY } = useScroll();

  const close = () => {
    setOpen(false);
    toggleRef.current?.focus();
  };

  useMotionValueEvent(scrollY, 'change', y => {
    const delta = y - (scrollY.getPrevious() ?? y);
    setLifted(y > 24);
    const holding = headerRef.current?.contains(document.activeElement);
    if (y < 160 || holding) setHidden(false);
    else if (delta > 4) setHidden(true);
    else if (delta < -4) setHidden(false);
  });

  // The tone under the island, and the chapter in the middle of the screen.
  useEffect(() => {
    const toned = Array.from(document.querySelectorAll<HTMLElement>('[data-tone]'));
    const chapters = NAV_LINKS.map(link => document.getElementById(link.id)).filter((node): node is HTMLElement => Boolean(node));
    const under = new Set<Element>();
    const middle = new Set<Element>();
    let observers: IntersectionObserver[] = [];

    const build = () => {
      observers.forEach(observer => observer.disconnect());
      under.clear();
      middle.clear();
      const band = 34;
      // Only surfaces wide enough to read as the ground count: a dark plan card in
      // one column of three should not turn the whole island dark.
      const grounds = toned.filter(node => node.getBoundingClientRect().width >= window.innerWidth * 0.6);
      const toneObserver = new IntersectionObserver(entries => {
        for (const entry of entries) entry.isIntersecting ? under.add(entry.target) : under.delete(entry.target);
        // Later sections are drawn over earlier ones (the sheet over the hero), so the last one wins.
        const top = grounds.filter(node => under.has(node)).pop();
        if (top) setTone(top.dataset.tone === 'ink' ? 'ink' : 'paper');
      }, { rootMargin: `-${band}px 0px -${Math.max(0, window.innerHeight - band - 2)}px 0px` });
      grounds.forEach(node => toneObserver.observe(node));
      const spy = new IntersectionObserver(entries => {
        for (const entry of entries) entry.isIntersecting ? middle.add(entry.target) : middle.delete(entry.target);
        const current = chapters.filter(node => middle.has(node)).pop();
        setActive(current ? current.id : null);
      }, { rootMargin: '-45% 0px -54% 0px' });
      chapters.forEach(node => spy.observe(node));
      observers = [toneObserver, spy];
    };

    build();
    let timer = 0;
    const onResize = () => { window.clearTimeout(timer); timer = window.setTimeout(build, 150); };
    window.addEventListener('resize', onResize);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', onResize);
      observers.forEach(observer => observer.disconnect());
    };
  }, []);

  useEffect(() => {
    setScrollLocked(open);
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      setScrollLocked(false);
    };
  }, [open]);

  const go = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (!open) {
      jumpTo(event, id);
      return;
    }
    // From the menu: release the page first — a locked page cannot be scrolled — then travel.
    event.preventDefault();
    setOpen(false);
    setScrollLocked(false);
    requestAnimationFrame(() => scrollToSection(id));
  };

  return (
    <>
      <m.header
        ref={headerRef}
        className="lx-nav"
        data-tone={open ? 'paper' : tone}
        data-lifted={lifted || undefined}
        initial={{ y: -28, opacity: 0 }}
        animate={{ y: hidden && !open ? -120 : 0, opacity: 1 }}
        transition={{ y: { duration: 0.7, ease: GLIDE }, opacity: { duration: 0.6, delay: 0.15 } }}
      >
        <div className="lx-nav-bar">
          <a className="lx-brand" href="/?home=1" aria-label="CalculixHub, back to the top" onClick={event => { event.preventDefault(); setOpen(false); scrollToTarget(0); }}>
            <BrandMark draw />
            <span className="lx-brand-word">calculix<span>hub</span></span>
          </a>
          <nav className="lx-nav-links" aria-label="Sections">
            {NAV_LINKS.map(link => (
              <a key={link.id} href={`#${link.id}`} onClick={event => go(event, link.id)} aria-current={active === link.id ? 'location' : undefined}>
                {active === link.id && <m.span className="lx-nav-pill" layoutId="lx-nav-pill" transition={{ type: 'spring', visualDuration: 0.45, bounce: 0.18 }} />}
                <span className="lx-nav-label">{link.label}</span>
              </a>
            ))}
          </nav>
          <div className="lx-nav-actions">
            <button type="button" className="lx-nav-signin" onClick={onSignIn}>Sign in</button>
            <button type="button" className="lx-nav-cta" onClick={onRegister}>
              <span>Start free</span>
              <span className="lx-nav-cta-icon" aria-hidden="true"><Arrow size={13} /></span>
            </button>
            <button
              ref={toggleRef}
              type="button"
              className="lx-burger"
              aria-expanded={open}
              aria-controls="lx-menu"
              aria-label={open ? 'Close menu' : 'Open menu'}
              onClick={() => setOpen(value => !value)}
            >
              <span /><span />
            </button>
          </div>
        </div>
      </m.header>

      <AnimatePresence>
        {open && <NavMenu onClose={close} onSignIn={() => { setOpen(false); onSignIn(); }} onRegister={() => { setOpen(false); onRegister(); }} onGo={go} />}
      </AnimatePresence>
    </>
  );
}

interface NavMenuProps {
  onClose: () => void;
  onSignIn: () => void;
  onRegister: () => void;
  onGo: (event: MouseEvent<HTMLAnchorElement>, id: string) => void;
}

/** The full-screen menu. A dialog: focus moves in, stays in, and returns to the toggle. */
function NavMenu({ onClose, onSignIn, onRegister, onGo }: NavMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>('a, button')?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>('a, button'));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', trap);
    return () => window.removeEventListener('keydown', trap);
  }, []);

  return (
    <m.div
      ref={panelRef}
      id="lx-menu"
      className="lx-menu"
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      initial={{ clipPath: 'circle(0% at calc(100% - 44px) 44px)' }}
      animate={{ clipPath: 'circle(150% at calc(100% - 44px) 44px)', transition: { duration: 0.75, ease: GLIDE } }}
      exit={{ clipPath: 'circle(0% at calc(100% - 44px) 44px)', transition: { duration: 0.45, ease: [0.7, 0, 0.84, 0] } }}
      data-lenis-prevent
    >
      <button type="button" className="lx-menu-close" aria-label="Close menu" onClick={onClose}><span /><span /></button>
      <m.ol className="lx-menu-links" initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.06, delayChildren: 0.18 } } }}>
        {NAV_LINKS.map(link => (
          <li key={link.id} className="lx-menu-item">
            <m.a
              href={`#${link.id}`}
              onClick={event => onGo(event, link.id)}
              variants={{ hidden: { y: '110%' }, shown: { y: '0%', transition: { duration: 0.8, ease: GLIDE } } }}
            >
              <span className="lx-menu-index">{link.chapter}</span>
              {link.label}
            </m.a>
          </li>
        ))}
      </m.ol>
      <m.div className="lx-menu-actions" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.5, duration: 0.6, ease: GLIDE } }}>
        <button type="button" className="lx-btn lx-btn-ink" onClick={onRegister}>
          <span>Start free</span>
          <span className="lx-btn-icon" aria-hidden="true"><Arrow /></span>
        </button>
        <button type="button" className="lx-menu-signin" onClick={onSignIn}>I already have an account</button>
      </m.div>
    </m.div>
  );
}
