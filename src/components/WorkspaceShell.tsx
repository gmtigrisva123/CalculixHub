/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The workspace's frame: a desk, and a sheet of paper on it.
 *
 * The sidebar sits directly on the desk. It lists the eight pages a learner
 * moves between, in three groups, and nothing else; who you are and how the
 * app is set up live in the menu under your name. The page itself is the sheet:
 * a top bar that says where you are and holds the tools you reach for on any
 * page, then the content.
 *
 * Everything that can be reached with the pointer can be reached from the
 * keyboard: Ctrl or ⌘ K opens the palette, G then a letter goes to a page, S
 * opens scratch paper, and [ folds the sidebar.
 */

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { AnimatePresence, m } from 'motion/react';
import {
  ArrowUpRight, Bell, ChevronsUpDown, CornerDownLeft, Flame, Info, Laptop, LogOut, Menu, Monitor, Moon, NotebookPen, PanelLeft,
  Search, Smartphone, Sparkles, Sun, TriangleAlert, UserPlus, X, type LucideIcon,
} from 'lucide-react';
import { NAV_GROUPS, NAV_ITEMS, RAIL_GROUPS, TAB_BAR_ITEMS, groupOf, itemsIn, pinStaffNav, railCollapsed, rememberRail, staffNavPinned, type NavItem, type TabKey } from '../lib/navigation';
import { preloadScreen } from '../lib/screens';
import { useMediaQuery } from '../hooks/useBreakpoint';
import UserAvatar from './UserAvatar';
import BrandLogo from './BrandLogo';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import type { ThemePreference } from '../lib/theme';
import { useNotifications } from '../services/data/notifications';
import { useRealtimeSubscription } from '../services/data/realtime';
import { usePlan } from '../services/data/plan';
import { PLANS } from '../../shared/plans';
import '../styles/live-data.css';
import '../styles/shell.css';
import '../styles/page.css';

export interface WorkspaceNotice {
  tone: 'info' | 'warning';
  text: string;
  action?: { label: string; href?: string; onClick?: () => void };
}

type Props = {
  activeTab: string;
  onSelect: (tab: TabKey) => void;
  name: string;
  streak: number;
  online: boolean;
  pendingGrades: number;
  /** A contest is running right now; the Arena link says so. */
  arenaLive?: boolean;
  /** Things the learner should know about this session, said once each. */
  notices?: readonly WorkspaceNotice[];
  onOpenScratch: () => void;
  onLogout: () => void;
  children: ReactNode;
};

interface PaletteEntry {
  id: string;
  section: 'Go to' | 'Do';
  label: string;
  hint: string;
  icon: LucideIcon;
  /** Keys that do the same thing without opening the palette. */
  keys?: readonly string[];
  run: () => void;
}

/** ⌘ on Apple keyboards, Ctrl everywhere else. */
const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

/** The title index.html gives the site, restored when the workspace is left. */
const SITE_TITLE = typeof document !== 'undefined' ? document.title : 'CalculixHub';

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

const DISMISSED = 'calculix_notices_dismissed';
const readDismissed = (): string[] => {
  try { return JSON.parse(sessionStorage.getItem(DISMISSED) ?? '[]') as string[]; } catch { return []; }
};

const glide = { type: 'spring', stiffness: 520, damping: 40, mass: 0.7 } as const;

const THEMES: readonly { value: ThemePreference; label: string; icon: LucideIcon }[] = [
  { value: 'light', label: 'Day', icon: Sun },
  { value: 'system', label: 'Match this device', icon: Monitor },
  { value: 'dark', label: 'Night', icon: Moon },
];

/** Day, device or night: three icons in a row, small enough for a menu. Settings has the roomier version. */
function ThemeSwitch() {
  const { preference, setPreference } = useTheme();
  return (
    <div className="ws-theme" role="radiogroup" aria-label="Appearance">
      {THEMES.map(({ value, label, icon: Icon }) => (
        <button key={value} type="button" role="radio" aria-checked={preference === value} aria-label={label} title={label}
          onClick={event => { const box = event.currentTarget.getBoundingClientRect(); setPreference(value, { x: box.left + box.width / 2, y: box.top + box.height / 2 }); }}>
          {preference === value && <m.i layoutId="ws-theme-thumb" transition={glide} aria-hidden="true" />}
          <Icon size={15} strokeWidth={1.9} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

export default function WorkspaceShell({ activeTab, onSelect, name, streak, online, pendingGrades, arenaLive = false, notices = [], onOpenScratch, onLogout, children }: Props) {
  const { user, profile } = useAuth();
  const { resolved, setPreference } = useTheme();
  const inbox = useNotifications(user?.id ?? null);
  const plan = usePlan(user?.id ?? null);
  const [connection, setConnection] = useState<'live' | 'connecting' | 'reconnecting'>('connecting');
  useRealtimeSubscription({ table: 'realtime_signals', onStatus: status => setConnection(status === 'SUBSCRIBED' ? 'live' : status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' ? 'reconnecting' : 'connecting') }, () => {});

  const compact = useMediaQuery('(max-width: 767px)');
  const [collapsed, setCollapsed] = useState(railCollapsed);
  const [drawer, setDrawer] = useState(false);
  const [account, setAccount] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const [staff, setStaff] = useState(staffNavPinned);
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);

  const searchInput = useRef<HTMLInputElement>(null);
  const searchTrigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const results = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const accountTrigger = useRef<HTMLButtonElement>(null);

  // The browser tab is named for the page, so several open at once can be told apart.
  useEffect(() => {
    const page = NAV_ITEMS.find(item => item.key === activeTab)?.label;
    document.title = page ? `${page} · CalculixHub` : SITE_TITLE;
    return () => { document.title = SITE_TITLE; };
  }, [activeTab]);

  // Opening Admin once, by address or from the palette, pins it to this device's sidebar.
  useEffect(() => { if (activeTab === 'admin' && !staff) { pinStaffNav(); setStaff(true); } }, [activeTab, staff]);

  const selected = NAV_ITEMS.find(item => item.key === activeTab);
  const group = NAV_GROUPS.find(entry => entry.key === groupOf(activeTab));
  const signedIn = Boolean(user);
  const planName = PLANS[plan.plan].name;
  // On a phone the sidebar is a drawer, always at full width whatever was remembered.
  const folded = collapsed && !compact;

  const navigate = (tab: TabKey) => {
    onSelect(tab);
    setDrawer(false);
    setAccount(false);
    setSearchOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const toggleRail = () => {
    rememberRail(!collapsed);
    setCollapsed(!collapsed);
  };

  const dismiss = (text: string) => {
    const next = [...dismissed, text];
    try { sessionStorage.setItem(DISMISSED, JSON.stringify(next)); } catch { /* it comes back on reload, which is fine */ }
    setDismissed(next);
  };

  // ---------------------------------------------------------------- palette

  const close = (run: () => void) => () => { setSearchOpen(false); run(); };
  const entries: PaletteEntry[] = [
    ...NAV_ITEMS.map(item => ({
      id: item.key, section: 'Go to' as const, label: item.label, hint: item.hint, icon: item.icon,
      keys: item.shortcut ? ['G', item.shortcut.toUpperCase()] : undefined, run: () => navigate(item.key),
    })),
    { id: 'scratch', section: 'Do', label: 'Open scratch paper', hint: 'Think with a pen, on any page', icon: NotebookPen, keys: ['S'], run: close(onOpenScratch) },
    { id: 'theme', section: 'Do', label: resolved === 'dark' ? 'Switch to day' : 'Switch to night', hint: 'Change how the page is lit', icon: resolved === 'dark' ? Sun : Moon, run: close(() => setPreference(resolved === 'dark' ? 'light' : 'dark')) },
    ...(compact ? [] : [{ id: 'rail', section: 'Do' as const, label: folded ? 'Open the sidebar' : 'Fold the sidebar', hint: 'More room for the page', icon: PanelLeft, keys: ['['], run: close(toggleRail) }]),
    { id: 'pocket', section: 'Do', label: 'Pocket preview', hint: 'The iPhone prototype', icon: Smartphone, run: () => window.location.assign('/?preview=ios') },
    { id: 'desk', section: 'Do', label: 'Desk preview', hint: 'The MacBook prototype', icon: Laptop, run: () => window.location.assign('/?preview=mac') },
    signedIn
      ? { id: 'signout', section: 'Do', label: 'Sign out', hint: 'End this session on this device', icon: LogOut, run: close(onLogout) }
      : { id: 'signup', section: 'Do', label: 'Create a free account', hint: 'Keep what you solve', icon: UserPlus, run: () => window.location.assign('/?auth=signup') },
  ];

  const needle = query.trim().toLowerCase();
  // Staff is findable by name, never suggested: a learner browsing the palette does not meet it.
  const matches = entries.filter(entry => needle ? `${entry.label} ${entry.hint}`.toLowerCase().includes(needle) : entry.id !== 'admin' || staff);

  // ------------------------------------------------------------------ keys

  // The handlers below are rebuilt on every render; the listener reads them through a ref so it is attached once.
  const act = useRef({ navigate, toggleRail });
  act.current = { navigate, toggleRail };

  useEffect(() => {
    let armed = 0;
    const keydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(open => !open);
        return;
      }
      if (event.key === 'Escape') { setDrawer(false); setAccount(false); return; }
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target) || document.querySelector('dialog[open]')) return;
      if (event.key === '[') { act.current.toggleRail(); return; }
      const key = event.key.toLowerCase();
      // G, then a page's letter, within a second or so.
      if (armed && Date.now() - armed < 1200) {
        armed = 0;
        const target = NAV_ITEMS.find(item => item.shortcut === key);
        if (target) { event.preventDefault(); act.current.navigate(target.key); }
        return;
      }
      if (key === 'g') armed = Date.now();
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, []);

  useEffect(() => {
    if (searchOpen) {
      setQuery('');
      setCursor(0);
      dialog.current?.showModal();
      searchInput.current?.focus();
    } else if (dialog.current?.open) {
      dialog.current.close();
      searchTrigger.current?.focus();
    }
  }, [searchOpen]);

  useEffect(() => { setCursor(0); }, [needle]);
  useEffect(() => { results.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }); }, [cursor]);

  const paletteKey = (event: ReactKeyboardEvent) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setCursor(index => Math.min(matches.length - 1, index + 1)); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setCursor(index => Math.max(0, index - 1)); }
    if (event.key === 'Enter' && matches[cursor]) { event.preventDefault(); matches[cursor].run(); }
  };

  // The account menu closes on a click anywhere else, and hands focus back to its button.
  useEffect(() => {
    if (!account) return;
    accountRef.current?.querySelector<HTMLElement>('.ws-menu button, .ws-menu a')?.focus();
    const outside = (event: PointerEvent) => { if (!accountRef.current?.contains(event.target as Node)) setAccount(false); };
    window.addEventListener('pointerdown', outside);
    return () => window.removeEventListener('pointerdown', outside);
  }, [account]);

  // A drawer left open must not stay open when the window grows past it.
  useEffect(() => { if (!compact) setDrawer(false); }, [compact]);

  // ---------------------------------------------------------------- pieces

  const railItem = ({ key, label, icon: Icon }: NavItem) => {
    const current = activeTab === key;
    const unread = key === 'inbox' ? inbox.unreadCount : 0;
    return (
      <button key={key} type="button" className="ws-nav-item" aria-current={current ? 'page' : undefined} data-tip={folded ? label : undefined}
        onClick={() => navigate(key)} onPointerEnter={() => preloadScreen(key)} onFocus={() => preloadScreen(key)}>
        {/* One raised tab, carried from the old page to the new one, rather than two that swap. */}
        {current && <m.span layoutId="ws-nav-tab" className="ws-nav-tab" transition={glide} aria-hidden="true" />}
        <Icon size={18} strokeWidth={1.85} aria-hidden="true" />
        <span className="ws-nav-text">{label}</span>
        {/* The bell in the top bar announces the count; here it is a visual echo, so the button is still just "Inbox". */}
        {unread > 0 && <span className="ws-nav-count" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}
        {key === 'compete' && arenaLive && <span className="ws-nav-live" aria-hidden="true"><i />Live</span>}
        {key === 'plan' && plan.plan !== 'free' && <span className="ws-nav-plan" aria-hidden="true">{planName}</span>}
      </button>
    );
  };

  const upsell = !signedIn
    ? <a className="ws-upsell" href="/?auth=signup"><span className="ws-upsell-kicker">Guest session</span><strong>Keep what you solve.</strong><p>A free account saves your progress and finds your level.</p><small>Create a free account <ArrowUpRight size={13} /></small></a>
    : plan.plan === 'free' && !plan.loading && activeTab !== 'plan'
      ? <button type="button" className="ws-upsell" onClick={() => navigate('plan')}><span className="ws-upsell-kicker"><Sparkles size={12} /> {plan.preview ? 'Pro preview' : 'Pro'}</span><strong>Training for a contest?</strong><p>{plan.preview ? 'Pro is open to everyone while it is being finished.' : 'Get a week-by-week plan up to the day.'}</p><small>See the plans <ArrowUpRight size={13} /></small></button>
      : null;

  const visible = useMemo(() => notices.filter(notice => notice.tone === 'warning' || !dismissed.includes(notice.text)), [notices, dismissed]);
  const liveLabel = !online ? 'Offline' : connection === 'live' ? 'Live' : connection === 'reconnecting' ? 'Reconnecting' : 'Connecting';

  return (
    <div className="workspace-refresh ws" data-rail={folded ? 'folded' : 'open'}>
      <a className="ws-skip" href="#workspace-main">Skip to content</a>

      <aside className={`ws-rail ${drawer ? 'is-open' : ''}`} aria-label="Main navigation">
        <div className="ws-rail-head">
          <a className="ws-brand" href="/?home=1" aria-label="CalculixHub: back to the front page"><span className="ws-brand-mark"><BrandLogo /></span><span className="ws-brand-word">calculix<i>hub</i></span></a>
          {compact
            ? <button type="button" className="ws-icon" aria-label="Close navigation" onClick={() => setDrawer(false)}><X size={19} /></button>
            : <button type="button" className="ws-icon ws-fold" aria-label={folded ? 'Open the sidebar' : 'Fold the sidebar'} aria-pressed={folded} data-tip={folded ? 'Open the sidebar' : undefined} onClick={toggleRail}><PanelLeft size={18} strokeWidth={1.85} /></button>}
        </div>

        <button type="button" className="ws-search" ref={searchTrigger} onClick={() => setSearchOpen(true)} aria-label="Search pages and commands" data-tip={folded ? 'Search' : undefined}>
          <Search size={16} strokeWidth={2} aria-hidden="true" /><span>Search or jump to…</span><kbd>{MOD} K</kbd>
        </button>

        <div className="ws-rail-scroll">
          {RAIL_GROUPS.map(key => {
            const entry = NAV_GROUPS.find(candidate => candidate.key === key)!;
            const titled = key !== 'home';
            return (
              <nav key={key} className="ws-group" aria-label={titled ? undefined : 'Home'} aria-labelledby={titled ? `ws-group-${key}` : undefined}>
                {titled && <p className="ws-group-label" id={`ws-group-${key}`}><span>{entry.label}</span></p>}
                {itemsIn(key).map(railItem)}
              </nav>
            );
          })}
          {/* On a phone there is no room for a menu that opens upward, so the account pages are listed in the drawer. */}
          {compact && (
            <nav className="ws-group" aria-labelledby="ws-group-account">
              <p className="ws-group-label" id="ws-group-account"><span>Account</span></p>
              {itemsIn('account').map(railItem)}
            </nav>
          )}
          {staff && (
            <nav className="ws-group" aria-labelledby="ws-group-staff">
              <p className="ws-group-label" id="ws-group-staff"><span>Staff</span></p>
              {itemsIn('staff').map(railItem)}
            </nav>
          )}
        </div>

        <div className="ws-rail-foot">
          {upsell}

          {compact ? (
            <div className="ws-drawer-foot">
              <div className="ws-drawer-who"><span className="ws-avatar"><UserAvatar src={profile?.avatar_url} /></span><span><strong>{name}</strong><small>{signedIn ? `${planName} plan` : 'Not signed in'}</small></span><ThemeSwitch /></div>
              {signedIn && <button type="button" className="ws-menu-item" onClick={() => { setDrawer(false); onLogout(); }}><LogOut size={17} strokeWidth={1.85} /><span>Sign out</span></button>}
            </div>
          ) : (
            <div className="ws-account" ref={accountRef}>
              <AnimatePresence>
                {account && (
                  <m.div className="ws-menu" id="ws-account-menu" role="group" aria-label="Account"
                    initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.98, transition: { duration: 0.12 } }} transition={glide}
                    onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); setAccount(false); accountTrigger.current?.focus(); } }}>
                    <div className="ws-menu-who">
                      <span className="ws-avatar"><UserAvatar src={profile?.avatar_url} /></span>
                      <span><strong>{name}</strong><small>{signedIn ? user?.email ?? `${planName} plan` : 'Exploring as a guest'}</small></span>
                    </div>
                    <div className="ws-menu-list">
                      {itemsIn('account').map(({ key, label, hint, icon: Icon }) => (
                        <button key={key} type="button" className="ws-menu-item" aria-label={label} title={hint} aria-current={activeTab === key ? 'page' : undefined} onClick={() => navigate(key)} onPointerEnter={() => preloadScreen(key)}>
                          <Icon size={17} strokeWidth={1.85} aria-hidden="true" /><span>{label}<small>{hint}</small></span>
                          {key === 'plan' && <em>{planName}</em>}
                        </button>
                      ))}
                    </div>
                    <div className="ws-menu-list">
                      <a className="ws-menu-item" href="/?preview=ios" title="The iPhone prototype"><Smartphone size={17} strokeWidth={1.85} aria-hidden="true" /><span>iPhone preview<small>CalculixHub in your pocket</small></span></a>
                      <a className="ws-menu-item" href="/?preview=mac" title="The MacBook prototype"><Laptop size={17} strokeWidth={1.85} aria-hidden="true" /><span>MacBook preview<small>CalculixHub on a laptop, filmed</small></span></a>
                    </div>
                    <div className="ws-menu-row"><span>Appearance</span><ThemeSwitch /></div>
                    <div className="ws-menu-list">
                      {signedIn
                        ? <button type="button" className="ws-menu-item" onClick={() => { setAccount(false); onLogout(); }}><LogOut size={17} strokeWidth={1.85} aria-hidden="true" /><span>Sign out</span></button>
                        : <a className="ws-menu-item is-accent" href="/?auth=signup"><UserPlus size={17} strokeWidth={1.85} aria-hidden="true" /><span>Create a free account</span></a>}
                    </div>
                  </m.div>
                )}
              </AnimatePresence>
              <button type="button" ref={accountTrigger} className="ws-account-trigger" aria-expanded={account} aria-controls="ws-account-menu"
                aria-label={`Account menu: ${name}`} data-tip={folded && !account ? 'Account' : undefined} onClick={() => setAccount(open => !open)}>
                <span className="ws-avatar"><UserAvatar src={profile?.avatar_url} /></span>
                <span className="ws-account-who"><strong>{name}</strong><small>{signedIn ? `${planName} plan` : 'Not signed in'}</small></span>
                <ChevronsUpDown size={15} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </aside>
      {drawer && <button type="button" className="ws-scrim" aria-label="Close navigation" onClick={() => setDrawer(false)} />}

      <div className="ws-sheet">
        <header className="ws-top">
          <div className="ws-crumb">
            <button type="button" className="ws-icon ws-top-menu" aria-label="Open navigation" aria-expanded={drawer} onClick={() => setDrawer(true)}><Menu size={20} /></button>
            {group && group.key !== 'home' && <><span className="ws-crumb-group">{group.label}</span><i aria-hidden="true">/</i></>}
            <strong>{selected?.label ?? 'Home'}</strong>
            {selected && <span className="ws-crumb-hint">{selected.hint}</span>}
          </div>
          <div className="ws-tools">
            {signedIn && <span className={`ws-live is-${online ? connection : 'offline'}`} role="status" data-tip={liveLabel === 'Live' ? 'Live: this page updates on its own' : undefined}><i aria-hidden="true" /><span>{liveLabel}</span></span>}
            <span className={`ws-streak ${streak > 0 ? 'is-lit' : ''}`} data-tip={streak > 0 ? `${streak}-day streak. Solve one today to keep it.` : 'Solve one problem to start a streak'}>
              <Flame size={16} strokeWidth={2} aria-hidden="true" /><b>{streak}</b><span> day{streak === 1 ? '' : 's'}</span>
            </span>
            <button type="button" className="ws-icon ws-top-search" onClick={() => setSearchOpen(true)} aria-label="Search pages and commands"><Search size={18} /></button>
            <button type="button" className="ws-tool" onClick={onOpenScratch} aria-label="Open scratch paper" data-tip="Scratch paper"><NotebookPen size={17} strokeWidth={1.85} aria-hidden="true" /><span>Scratch</span><kbd>S</kbd></button>
            <button type="button" className="ws-icon ws-bell" onClick={() => navigate('inbox')} onPointerEnter={() => preloadScreen('inbox')} aria-label={`Inbox: ${inbox.unreadCount} unread notifications`} data-tip="Inbox">
              <Bell size={18} strokeWidth={1.85} />{inbox.unreadCount > 0 && <span>{inbox.unreadCount > 9 ? '9+' : inbox.unreadCount}</span>}
            </button>
          </div>
        </header>

        {!online && <div className="ws-offline" role="status">You’re offline. CalculixHub will reconnect on its own as soon as the connection is back.{pendingGrades > 0 ? ` ${pendingGrades} answers waiting to sync.` : ''}</div>}

        <main id="workspace-main" tabIndex={-1} className="workspace-content ws-main">
          {visible.length > 0 && (
            <div className="ws-notices">
              {visible.map(notice => (
                <div key={notice.text} className={`ws-notice is-${notice.tone}`} role={notice.tone === 'warning' ? 'alert' : 'note'}>
                  {notice.tone === 'warning' ? <TriangleAlert size={15} aria-hidden="true" /> : <Info size={15} aria-hidden="true" />}
                  <p>{notice.text}</p>
                  {notice.action && (notice.action.href
                    ? <a href={notice.action.href}>{notice.action.label} <ArrowUpRight size={13} /></a>
                    : <button type="button" onClick={notice.action.onClick}>{notice.action.label}</button>)}
                  {notice.tone === 'info' && <button type="button" className="ws-notice-close" aria-label="Dismiss this note" onClick={() => dismiss(notice.text)}><X size={14} /></button>}
                </div>
              ))}
            </div>
          )}
          {children}
        </main>
      </div>

      <nav className="ws-tabs" aria-label="Quick navigation">
        {TAB_BAR_ITEMS.map(({ key, shortLabel, icon: Icon }) => (
          <button key={key} type="button" aria-current={activeTab === key ? 'page' : undefined} onClick={() => navigate(key)} onPointerEnter={() => preloadScreen(key)}>
            {activeTab === key && <m.i layoutId="ws-tab-pill" transition={glide} aria-hidden="true" />}
            <Icon size={21} strokeWidth={1.85} /><span>{shortLabel}</span>
          </button>
        ))}
        <button type="button" onClick={() => setDrawer(true)} aria-expanded={drawer} aria-current={selected && !selected.inTabBar ? 'page' : undefined}>
          {selected && !selected.inTabBar && <m.i layoutId="ws-tab-pill" transition={glide} aria-hidden="true" />}
          <Menu size={21} strokeWidth={1.85} /><span>More</span>
        </button>
      </nav>

      <dialog className="ws-palette" ref={dialog} onCancel={() => setSearchOpen(false)} onClick={event => { if (event.target === dialog.current) setSearchOpen(false); }} aria-labelledby="workspace-search-title">
        <div className="ws-palette-input">
          <Search size={18} aria-hidden="true" />
          <label id="workspace-search-title" className="sr-only" htmlFor="workspace-query">Search pages and commands</label>
          <input id="workspace-query" ref={searchInput} value={query} onChange={event => setQuery(event.target.value)} onKeyDown={paletteKey} placeholder="Where would you like to go?" autoComplete="off" spellCheck={false}
            role="combobox" aria-expanded="true" aria-controls="workspace-command-results" aria-activedescendant={matches[cursor] ? `ws-entry-${matches[cursor].id}` : undefined} />
          <kbd>Esc</kbd>
        </div>
        <div className="ws-palette-results" id="workspace-command-results" role="listbox" ref={results}>
          {matches.length ? matches.map(({ id, section, label, hint, icon: Icon, keys, run }, index) => (
            <div key={id} role="presentation">
              {(index === 0 || matches[index - 1].section !== section) && <p className="ws-palette-section" role="presentation">{section}</p>}
              <button type="button" id={`ws-entry-${id}`} role="option" aria-selected={index === cursor} data-active={index === cursor} tabIndex={-1} onClick={run} onPointerMove={() => { if (cursor !== index) setCursor(index); }}>
                <span className="ws-palette-icon"><Icon size={17} strokeWidth={1.85} aria-hidden="true" /></span>
                <span className="ws-palette-text">{label}<small>{hint}</small></span>
                {index === cursor
                  ? <CornerDownLeft size={15} aria-hidden="true" />
                  : keys && <span className="ws-palette-keys" aria-hidden="true">{keys.map(key => <kbd key={key}>{key}</kbd>)}</span>}
              </button>
            </div>
          )) : <p className="ws-palette-empty">Nothing by that name. Try “Learn”, “Arena” or “scratch”.</p>}
        </div>
        <p className="ws-palette-hint"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>G</kbd> then a letter goes straight to a page</span></p>
      </dialog>
    </div>
  );
}
