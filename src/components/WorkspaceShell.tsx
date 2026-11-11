import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowUpRight, Bell, ChevronRight, Command, CornerDownLeft, Flame, Info, Menu, Moon, NotebookPen, Search, Smartphone, Sparkles, Sun, TriangleAlert, X, type LucideIcon } from 'lucide-react';
import { NAV_GROUPS, NAV_ITEMS, TAB_BAR_ITEMS, groupOf, pinStaffNav, staffNavPinned, type TabKey } from '../lib/navigation';
import ThemeToggle from './ThemeToggle';
import UserAvatar from './UserAvatar';
import BrandLogo from './BrandLogo';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../services/data/notifications';
import { useRealtimeSubscription } from '../services/data/realtime';
import { usePlan } from '../services/data/plan';
import { PLANS } from '../../shared/plans';
import '../styles/live-data.css';
import '../styles/shell.css';

export interface WorkspaceNotice {
  tone: 'info' | 'warning';
  text: string;
  action?: { label: string; href?: string; onClick?: () => void };
}

type Props = {
  activeTab: string;
  onSelect: (tab: TabKey) => void;
  name: string;
  points: number;
  streak: number;
  online: boolean;
  pendingGrades: number;
  /** Things the learner should know about this session, said once each. */
  notices?: readonly WorkspaceNotice[];
  onOpenScratch: () => void;
  children: ReactNode;
};

interface PaletteEntry {
  id: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  run: () => void;
}

export default function WorkspaceShell({ activeTab, onSelect, name, points, streak, online, pendingGrades, notices = [], onOpenScratch, children }: Props) {
  const { user, profile } = useAuth();
  const { resolved, setPreference } = useTheme();
  const inbox = useNotifications(user?.id ?? null);
  const plan = usePlan(user?.id ?? null);
  const [connection, setConnection] = useState<'live' | 'connecting' | 'reconnecting'>('connecting');
  useRealtimeSubscription({ table: 'realtime_signals', onStatus: status => setConnection(status === 'SUBSCRIBED' ? 'live' : status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' ? 'reconnecting' : 'connecting') }, () => {});
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const [staff, setStaff] = useState(staffNavPinned);
  const searchInput = useRef<HTMLInputElement>(null);
  const searchTrigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const results = useRef<HTMLDivElement>(null);

  // Opening Admin once, by address or from the palette, pins it to this device's sidebar.
  useEffect(() => { if (activeTab === 'admin' && !staff) { pinStaffNav(); setStaff(true); } }, [activeTab, staff]);

  const selected = NAV_ITEMS.find(item => item.key === activeTab);
  const group = NAV_GROUPS.find(entry => entry.key === groupOf(activeTab));
  const groups = NAV_GROUPS.filter(entry => entry.key !== 'staff' || staff).map(entry => ({ ...entry, items: NAV_ITEMS.filter(item => item.group === entry.key) }));

  const navigate = (tab: TabKey) => {
    onSelect(tab);
    setMobileMenu(false);
    setSearchOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const close = (run: () => void) => () => { setSearchOpen(false); run(); };
  const entries: PaletteEntry[] = [
    ...NAV_ITEMS.map(item => ({ id: item.key, label: item.label, hint: item.hint, icon: item.icon, run: () => navigate(item.key) })),
    { id: 'scratch', label: 'Open scratch paper', hint: 'Think with a pen, on any page', icon: NotebookPen, run: close(onOpenScratch) },
    { id: 'theme', label: resolved === 'dark' ? 'Switch to day' : 'Switch to night', hint: 'Change how the page is lit', icon: resolved === 'dark' ? Sun : Moon, run: close(() => setPreference(resolved === 'dark' ? 'light' : 'dark')) },
    { id: 'pocket', label: 'Pocket preview', hint: 'The iPhone prototype', icon: Smartphone, run: () => window.location.assign('/?preview=ios') },
  ];

  const needle = query.trim().toLowerCase();
  // Staff is findable by name, never suggested: a learner browsing the palette does not meet it.
  const matches = entries.filter(entry => needle ? `${entry.label} ${entry.hint}`.toLowerCase().includes(needle) : entry.id !== 'admin' || staff);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(open => !open);
      }
      if (event.key === 'Escape') setMobileMenu(false);
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

  const paletteKey = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setCursor(index => Math.min(matches.length - 1, index + 1)); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setCursor(index => Math.max(0, index - 1)); }
    if (event.key === 'Enter' && matches[cursor]) { event.preventDefault(); matches[cursor].run(); }
  };

  const signedIn = Boolean(user);
  const planName = PLANS[plan.plan].name;

  return (
    <div className="workspace-refresh">
      <a className="workspace-skip" href="#workspace-main">Skip to content</a>
      <aside className={`workspace-sidebar ${mobileMenu ? 'is-open' : ''}`} aria-label="Main navigation">
        <a className="workspace-brand" href="/?home=1"><span className="workspace-logo"><BrandLogo /></span>calculix<span>hub</span></a>
        <button className="workspace-menu-close" aria-label="Close navigation" onClick={() => setMobileMenu(false)}><X size={20} /></button>

        <div className="ws-groups">
          {groups.map(entry => (
            <nav key={entry.key} aria-labelledby={`ws-group-${entry.key}`}>
              <p className="workspace-nav-label" id={`ws-group-${entry.key}`}>{entry.label}</p>
              {entry.items.map(({ key, label, icon: Icon }) => (
                <button key={key} className="workspace-nav-item" aria-current={activeTab === key ? 'page' : undefined} onClick={() => navigate(key)}>
                  <Icon size={18} strokeWidth={1.9} /><span>{label}</span>
                  {/* The bell in the top bar announces the count; here it is a visual echo, so the button is still just "Inbox". */}
                  {key === 'inbox' && inbox.unreadCount > 0 && <span className="ws-nav-count" aria-hidden="true">{inbox.unreadCount > 99 ? '99+' : inbox.unreadCount}</span>}
                  {key === 'plan' && plan.plan !== 'free' && <span className="ws-nav-plan">{planName}</span>}
                </button>
              ))}
            </nav>
          ))}
        </div>

        {!signedIn
          ? <a className="ws-upsell" href="/?auth=signup"><span className="ws-upsell-kicker">Guest session</span><strong>Keep what you solve.</strong><p>A free account saves your progress and finds your level.</p><small>Create a free account <ChevronRight size={13} /></small></a>
          : plan.plan === 'free' && !plan.loading && activeTab !== 'plan'
            ? <button type="button" className="ws-upsell" onClick={() => navigate('plan')}><span className="ws-upsell-kicker"><Sparkles size={12} /> {plan.preview ? 'Pro preview' : 'Pro'}</span><strong>Training for a contest?</strong><p>{plan.preview ? 'Pro is open to everyone while it is being finished.' : 'Get a week-by-week plan up to the day.'}</p><small>See the plans <ChevronRight size={13} /></small></button>
            : null}

        <div className="workspace-sidebar-bottom">
          <button className="workspace-user" onClick={() => navigate('profile')}>
            <span className="workspace-avatar"><UserAvatar src={profile?.avatar_url} /></span>
            <span><strong>{name}</strong><small>{signedIn ? `${planName} plan` : 'Not signed in'}</small></span>
            <ChevronRight size={16} />
          </button>
        </div>
      </aside>
      {mobileMenu && <button className="workspace-menu-backdrop" aria-label="Close navigation" onClick={() => setMobileMenu(false)} />}

      <div className="workspace-body">
        <header className="workspace-topbar">
          <div className="workspace-breadcrumb">
            <button className="workspace-mobile-menu" aria-label="Open navigation" aria-expanded={mobileMenu} onClick={() => setMobileMenu(true)}><Menu size={21} /></button>
            <span className="workspace-breadcrumb-root">{group?.label ?? 'Workspace'}</span><ChevronRight size={14} /><strong>{selected?.label ?? 'Home'}</strong>
          </div>
          <div className="workspace-tools">
            <button className="workspace-search" ref={searchTrigger} onClick={() => setSearchOpen(true)} aria-label="Search and commands"><Search size={16} /><span>Go anywhere</span><kbd><Command size={11} /> K</kbd></button>
            <button className="ws-tool" onClick={onOpenScratch} aria-label="Open scratch paper" title="Scratch paper"><NotebookPen size={18} /></button>
            <span className="workspace-streak" title={streak > 0 ? `${streak}-day streak` : 'Solve one problem to start a streak'}><Flame size={17} /> {streak}<span> day{streak === 1 ? '' : 's'}</span></span>
            {signedIn && <span className={`ws-live is-${online ? connection : 'offline'}`} role="status"><i aria-hidden="true" /><span>{!online ? 'Offline' : connection === 'live' ? 'Live' : connection === 'reconnecting' ? 'Reconnecting' : 'Connecting'}</span></span>}
            <button className="workspace-inbox-button" onClick={() => navigate('inbox')} aria-label={`Inbox: ${inbox.unreadCount} unread notifications`}><Bell size={18} />{inbox.unreadCount > 0 && <span>{inbox.unreadCount}</span>}</button>
            <ThemeToggle variant="bar" />
            <button className="workspace-avatar workspace-avatar-button" onClick={() => navigate('profile')} aria-label="Your profile"><UserAvatar src={profile?.avatar_url} /></button>
          </div>
        </header>
        {!online && <div className="workspace-offline" role="status">You’re offline. CalculixHub will reconnect on its own as soon as the connection is back.{pendingGrades > 0 ? ` ${pendingGrades} answers waiting to sync.` : ''}</div>}
        <main id="workspace-main" tabIndex={-1} className="workspace-content">
          {notices.length > 0 && (
            <div className="ws-notices">
              {notices.map(notice => (
                <div key={notice.text} className={`ws-notice is-${notice.tone}`} role={notice.tone === 'warning' ? 'alert' : 'note'}>
                  {notice.tone === 'warning' ? <TriangleAlert size={16} aria-hidden="true" /> : <Info size={16} aria-hidden="true" />}
                  <p>{notice.text}</p>
                  {notice.action && (notice.action.href
                    ? <a href={notice.action.href}>{notice.action.label} <ArrowUpRight size={14} /></a>
                    : <button type="button" onClick={notice.action.onClick}>{notice.action.label}</button>)}
                </div>
              ))}
            </div>
          )}
          {children}
        </main>
        <footer className="workspace-footer"><span><Sparkles size={13} /> At your own pace.</span><span>{points.toLocaleString()} learning points</span></footer>
      </div>

      <nav className="workspace-mobile-tabs" aria-label="Quick navigation">
        {TAB_BAR_ITEMS.map(({ key, shortLabel, icon: Icon }) => <button key={key} aria-current={activeTab === key ? 'page' : undefined} onClick={() => navigate(key)}><Icon size={21} /><span>{shortLabel}</span></button>)}
        <button onClick={() => setMobileMenu(true)} aria-expanded={mobileMenu} aria-current={selected && !selected.inTabBar ? 'page' : undefined}><Menu size={21} /><span>More</span></button>
      </nav>

      <dialog className="workspace-command" ref={dialog} onCancel={() => setSearchOpen(false)} onClick={event => { if (event.target === dialog.current) setSearchOpen(false); }} aria-labelledby="workspace-search-title">
        <div className="workspace-command-input">
          <Search size={20} />
          <label id="workspace-search-title" className="sr-only" htmlFor="workspace-query">Search pages and commands</label>
          <input id="workspace-query" ref={searchInput} value={query} onChange={event => setQuery(event.target.value)} onKeyDown={paletteKey} placeholder="Where would you like to go?" autoComplete="off" spellCheck={false}
            role="combobox" aria-expanded="true" aria-controls="workspace-command-results" aria-activedescendant={matches[cursor] ? `ws-entry-${matches[cursor].id}` : undefined} />
          <button onClick={() => setSearchOpen(false)} aria-label="Close search"><X size={20} /></button>
        </div>
        <div className="workspace-command-results" id="workspace-command-results" role="listbox" ref={results}>
          {matches.length ? matches.map(({ id, label, hint, icon: Icon, run }, index) => (
            <button key={id} id={`ws-entry-${id}`} role="option" aria-selected={index === cursor} data-active={index === cursor} tabIndex={-1} onClick={run} onPointerMove={() => setCursor(index)}>
              <Icon size={18} /><span>{label}<small>{hint}</small></span>{index === cursor && <CornerDownLeft size={15} />}
            </button>
          )) : <p>Nothing by that name. Try “Learn”, “Arena” or “scratch”.</p>}
        </div>
        <p className="workspace-command-hint"><kbd>↑</kbd><kbd>↓</kbd> to move · <kbd>Enter</kbd> to open · <kbd>Esc</kbd> to close</p>
      </dialog>
    </div>
  );
}
