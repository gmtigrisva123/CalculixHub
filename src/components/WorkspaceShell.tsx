import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Bell, ArrowUpRight, BookOpen, Check, ChevronRight, Command, Flame, Menu, Search, Smartphone, Sparkles, X } from 'lucide-react';
import { NAV_ITEMS, TAB_BAR_ITEMS, type TabKey } from '../lib/navigation';
import ThemeToggle from './ThemeToggle';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../services/data/notifications';
import { useRealtimeSubscription } from '../services/data/realtime';
import '../styles/live-data.css';

type Props = {
  activeTab: string;
  onSelect: (tab: TabKey) => void;
  name: string;
  points: number;
  streak: number;
  online: boolean;
  pendingGrades: number;
  children: ReactNode;
};

export default function WorkspaceShell({ activeTab, onSelect, name, points, streak, online, pendingGrades, children }: Props) {
  const {user}=useAuth();
  const notices=useNotifications(user?.id??null);
  const [connection,setConnection]=useState('Connecting');
  useRealtimeSubscription({table:'realtime_signals',onStatus:status=>setConnection(status==='SUBSCRIBED'?'Live connection':status==='CHANNEL_ERROR'||status==='TIMED_OUT'?'Reconnecting':'Connecting')},()=>{});
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [query, setQuery] = useState('');
  const searchInput = useRef<HTMLInputElement>(null);
  const searchTrigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const primary = NAV_ITEMS.filter(item => ['dashboard', 'learn', 'archive', 'compete', 'leaderboard', 'progress', 'community'].includes(item.key));
  const secondary = NAV_ITEMS.filter(item => !primary.includes(item));
  const selected = NAV_ITEMS.find(item => item.key === activeTab);
  const results = NAV_ITEMS.filter(item => `${item.label} ${item.shortLabel}`.toLowerCase().includes(query.toLowerCase()));
  const navigate = (tab: TabKey) => {
    onSelect(tab);
    setMobileMenu(false);
    setSearchOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

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
      dialog.current?.showModal();
      searchInput.current?.focus();
    } else if (dialog.current?.open) {
      dialog.current.close();
      searchTrigger.current?.focus();
    }
  }, [searchOpen]);

  return (
    <div className="workspace-refresh">
      <a className="workspace-skip" href="#workspace-main">Skip to content</a>
      <aside className={`workspace-sidebar ${mobileMenu ? 'is-open' : ''}`} aria-label="Main navigation">
        <a className="workspace-brand" href="/?home=1"><span className="workspace-logo">c<span>·</span></span>calculix<span>hub</span></a>
        <button className="workspace-menu-close" aria-label="Close navigation" onClick={() => setMobileMenu(false)}><X size={20} /></button>
        <div className="workspace-space"><span className="workspace-space-icon"><BookOpen size={18} /></span><span><strong>My learning space</strong><small>A place to think</small></span><Check size={14} /></div>
        <p className="workspace-nav-label">YOUR WORKSPACE</p>
        <nav>{primary.map(({ key, label, icon: Icon }) => <button key={key} className="workspace-nav-item" aria-current={activeTab === key ? 'page' : undefined} onClick={() => navigate(key)}><Icon size={19} /><span>{label}</span>{activeTab === key && <span className="workspace-active-dot" />}</button>)}</nav>
        <p className="workspace-nav-label">PERSONAL</p>
        <nav>{secondary.map(({ key, label, icon: Icon }) => <button key={key} className="workspace-nav-item" aria-current={activeTab === key ? 'page' : undefined} onClick={() => navigate(key)}><Icon size={19} /><span>{label}</span></button>)}</nav>
        <a className="workspace-pocket" href="/?preview=ios"><span><Smartphone size={22} /><ArrowUpRight size={17} /></span><strong>A question for the way.</strong><p>A little space to learn, wherever you are.</p><small>Try the iPhone prototype <ChevronRight size={13} /></small></a>
        <div className="workspace-sidebar-bottom"><button className="workspace-user" onClick={() => navigate('profile')}><span className="workspace-avatar">{name.slice(0, 2).toUpperCase()}</span><span><strong>{name}</strong><small>Your learning journey</small></span><ChevronRight size={16} /></button></div>
      </aside>
      {mobileMenu && <button className="workspace-menu-backdrop" aria-label="Close navigation" onClick={() => setMobileMenu(false)} />}
      <div className="workspace-body">
        <header className="workspace-topbar">
          <div className="workspace-breadcrumb"><button className="workspace-mobile-menu" aria-label="Open navigation" aria-expanded={mobileMenu} onClick={() => setMobileMenu(true)}><Menu size={21} /></button><span className="workspace-breadcrumb-root">Workspace</span><ChevronRight size={14} /><strong>{selected?.label ?? 'Overview'}</strong></div>
          <div className="workspace-tools"><button className="workspace-search" ref={searchTrigger} onClick={() => setSearchOpen(true)} aria-label="Search workspace"><Search size={16} /><span>Find your next step</span><kbd><Command size={11} /> K</kbd></button><span className="workspace-streak"><Flame size={17} /> {streak}<span> day{streak === 1 ? '' : 's'}</span></span><span className="workspace-live-state" role="status">{online?connection:'Offline'}</span><button className="workspace-inbox-button" onClick={()=>navigate('inbox')} aria-label={`Inbox: ${notices.unreadCount} unread notifications`}><Bell size={18}/>{notices.unreadCount>0&&<span>{notices.unreadCount}</span>}</button><ThemeToggle variant="bar" /><button className="workspace-avatar workspace-avatar-button" onClick={() => navigate('profile')} aria-label="Your profile">{name.slice(0, 1).toUpperCase()}</button></div>
        </header>
        {!online && <div className="workspace-offline" role="status">You're offline. Saved exercises are still available.{pendingGrades > 0 ? ` ${pendingGrades} answers waiting to sync.` : ''}</div>}
        <main id="workspace-main" tabIndex={-1} className="workspace-content">{children}</main>
        <footer className="workspace-footer"><span><Sparkles size={13} /> At your own pace.</span><span>{points.toLocaleString()} learning points</span></footer>
      </div>
      <nav className="workspace-mobile-tabs" aria-label="Quick navigation">{TAB_BAR_ITEMS.slice(0, 4).map(({ key, shortLabel, icon: Icon }) => <button key={key} aria-current={activeTab === key ? 'page' : undefined} onClick={() => navigate(key)}><Icon size={21} /><span>{shortLabel}</span></button>)}<button onClick={() => setMobileMenu(true)} aria-expanded={mobileMenu}><Menu size={21} /><span>More</span></button></nav>
      <dialog className="workspace-command" ref={dialog} onCancel={() => setSearchOpen(false)} onClick={event => { if (event.target === dialog.current) setSearchOpen(false); }} aria-labelledby="workspace-search-title">
        <div className="workspace-command-input"><Search size={20} /><label id="workspace-search-title" className="sr-only" htmlFor="workspace-query">Search workspace</label><input id="workspace-query" ref={searchInput} value={query} onChange={event => setQuery(event.target.value)} placeholder="Where would you like to go?" /><button onClick={() => setSearchOpen(false)} aria-label="Close search"><X size={20} /></button></div>
        <div className="workspace-command-results">{results.length ? results.map(({ key, label, icon: Icon }) => <button key={key} onClick={() => navigate(key)}><Icon size={19} /><span>{label}</span><ArrowUpRight size={16} /></button>) : <p>No matching pages. Try “Learn” or “Progress”.</p>}</div><p className="workspace-command-hint">Tab to explore · Enter to open · Esc to close</p>
      </dialog>
    </div>
  );
}
