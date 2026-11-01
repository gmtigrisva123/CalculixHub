import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, AtSign, Bell, Check, CheckCheck, CornerDownLeft, Heart, Mail, Megaphone, MessageCircle, MessageSquare, Repeat2, Search, Send, UserPlus, Users, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { useNotifications, describeNotification, notificationLink } from '../services/data/notifications';
import { useConversations, useMessages, type ConversationWithPeople } from '../services/data/messaging';
import { searchProfiles } from '../services/data/people';
import type { NotificationWithActor, ProfileRow } from '../services/database.types';
import { Linkified } from '../lib/linkify';
import UserAvatar from './UserAvatar';
import '../styles/inbox.css';

type View = 'notifications' | 'messages';
type Filter = 'all' | 'unread' | 'replies' | 'messages' | 'social';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'unread', label: 'Unread' }, { key: 'replies', label: 'Replies & mentions' },
  { key: 'messages', label: 'Messages' }, { key: 'social', label: 'Reactions & follows' },
];
const matches = (n: NotificationWithActor, filter: Filter) =>
  filter === 'all' ? true
  : filter === 'unread' ? !n.read_at
  : filter === 'replies' ? ['post_comment', 'comment_reply', 'mention'].includes(n.type)
  : filter === 'messages' ? n.type === 'message'
  : ['follow', 'post_like', 'comment_like', 'post_share'].includes(n.type);

const KIND: Record<string, { icon: typeof Bell; tone: string }> = {
  follow: { icon: UserPlus, tone: 'is-sky' }, post_like: { icon: Heart, tone: 'is-rose' }, comment_like: { icon: Heart, tone: 'is-rose' },
  post_comment: { icon: MessageCircle, tone: 'is-indigo' }, comment_reply: { icon: MessageCircle, tone: 'is-indigo' },
  mention: { icon: AtSign, tone: 'is-amber' }, post_share: { icon: Repeat2, tone: 'is-mint' }, message: { icon: MessageSquare, tone: 'is-violet' },
  system: { icon: Megaphone, tone: 'is-slate' },
};

const rtf = typeof Intl !== 'undefined' ? new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'short' }) : null;
function relative(iso: string, now = Date.now()) {
  const seconds = (Date.parse(iso) - now) / 1000;
  if (Math.abs(seconds) < 45) return 'now';
  for (const [unit, size] of [['day', 86400], ['hour', 3600], ['minute', 60]] as const) {
    if (Math.abs(seconds) >= size) return Math.abs(seconds) >= 7 * 86400 ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : rtf?.format(Math.round(seconds / size), unit) ?? '';
  }
  return 'now';
}
const clock = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const dayKey = (iso: string) => new Date(iso).toDateString();
function dayLabel(iso: string) {
  const day = new Date(iso); const today = new Date();
  const diff = Math.round((new Date(today.toDateString()).getTime() - new Date(day.toDateString()).getTime()) / 86400000);
  return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : day.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}
const bucket = (iso: string) => { const label = dayLabel(iso); return label === 'Today' || label === 'Yesterday' ? label : 'Earlier'; };
const maskEmail = (email?: string | null) => {
  if (!email) return null;
  const [name, domain] = email.split('@');
  return `${name.slice(0, 2)}${'•'.repeat(Math.max(2, Math.min(6, name.length - 2)))}@${domain}`;
};

function others(c: ConversationWithPeople, me: string) {
  return (c.participants ?? []).filter(p => p.user_id !== me && p.profile).map(p => p.profile!);
}
function conversationName(c: ConversationWithPeople, me: string) {
  if (c.title) return c.title;
  const people = others(c, me);
  return people.length ? people.map(p => p.display_name || p.username).join(', ') : 'Direct conversation';
}

/** The notification's headline with the actor's name set apart. */
function Headline({ n }: { n: NotificationWithActor }) {
  const text = describeNotification(n);
  const who = n.actor?.display_name ?? n.actor?.username;
  if (!who || !text.startsWith(who)) return <>{text}</>;
  return <><b>{who}</b>{text.slice(who.length)}</>;
}

export default function Inbox() {
  const { user } = useAuth();
  const me = user?.id ?? null;
  const notifications = useNotifications(me);
  const conversations = useConversations(me);
  const [view, setView] = useState<View>(() => new URLSearchParams(window.location.search).get('view') === 'messages' ? 'messages' : 'notifications');
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const messages = useMessages(selected, me);
  const [body, setBody] = useState('');
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<ProfileRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requestOwner = useRef(me); requestOwner.current = me;
  const history = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const searchBox = useRef<HTMLInputElement>(null);

  useEffect(() => { setSelected(null); setBody(''); setPeople([]); setQuery(''); setError(''); }, [me]);
  useEffect(() => { const node = history.current; if (node) node.scrollTop = node.scrollHeight; }, [messages.data.length, selected]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = (event.target as HTMLElement)?.closest('input, textarea, [contenteditable]');
      if (event.key === '/' && !typing && view === 'messages') { event.preventDefault(); searchBox.current?.focus(); }
      if (event.key === 'Escape' && selected && !typing) setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, selected]);

  const search = async () => {
    const owner = me; setError('');
    try { const found = await searchProfiles(query); if (requestOwner.current === owner) setPeople(found.filter(p => p.id !== owner)); }
    catch { setError('Could not search learners.'); }
  };
  const start = async (target: string) => {
    if (!supabase || busy || !user) return;
    setBusy(true); setError(''); const owner = user.id;
    const { data, error } = await supabase.rpc('start_conversation', { p_target: target });
    if (owner === requestOwner.current) {
      if (error) setError('Could not open the conversation. Apply the realtime database setup.');
      else { setSelected(data); setPeople([]); setQuery(''); await conversations.reload(); }
    }
    setBusy(false);
  };
  const send = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!supabase || !user || !selected || busy || !body.trim()) return;
    setBusy(true); setError(''); const owner = user.id;
    const { error } = await supabase.from('messages').insert({ conversation_id: selected, sender_id: user.id, body: body.trim() });
    if (owner === requestOwner.current) {
      if (error) setError('Your message was not sent. Please retry.');
      else { setBody(''); await messages.reload(); await conversations.reload(); }
    }
    setBusy(false);
    composer.current?.focus();
  };
  const openNotification = async (n: NotificationWithActor) => {
    if (!n.read_at) await notifications.markRead(n.id);
    if (n.type === 'message' && n.entity_id) { setView('messages'); setSelected(n.entity_id); return; }
    const link = notificationLink(n);
    if (link) window.location.assign(link);
  };

  const shown = useMemo(() => notifications.data.filter(n => matches(n, filter)), [notifications.data, filter]);
  const groups = useMemo(() => {
    const out: { label: string; items: NotificationWithActor[] }[] = [];
    for (const n of shown) { const label = bucket(n.created_at); const last = out[out.length - 1]; if (last?.label === label) last.items.push(n); else out.push({ label, items: [n] }); }
    return out;
  }, [shown]);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map(f => [f.key, notifications.data.filter(n => matches(n, f.key)).length])) as Record<Filter, number>, [notifications.data]);
  const active = conversations.data.find(c => c.id === selected) ?? null;
  const partner = active && me ? others(active, me) : [];
  const errors = [error, notifications.error, conversations.error, messages.error].filter(Boolean);
  const mailbox = maskEmail(user?.email);

  if (!user) return <section className="ib"><div className="ib-signedout"><Mail size={22} /><h1>Inbox</h1><p>Sign in to read your private inbox.</p></div></section>;

  return <section className="ib" aria-labelledby="ib-title">
    <header className="ib-head">
      <div className="ib-title">
        <h1 id="ib-title">Inbox</h1>
        <p>{notifications.unreadCount ? `${notifications.unreadCount} unread · ` : 'All caught up · '}{conversations.data.length} {conversations.data.length === 1 ? 'conversation' : 'conversations'}</p>
      </div>
      <div className="ib-status">
        <span className={`ib-pill ${errors.length ? 'is-warn' : 'is-live'}`}><i aria-hidden="true" />{errors.length ? 'Degraded' : 'Realtime'}</span>
        {mailbox && <span className="ib-pill is-mail" title="Every notification is also delivered to your email address"><Mail size={13} aria-hidden="true" />Email copies → <code>{mailbox}</code></span>}
      </div>
    </header>

    <div className="ib-tabs" role="tablist" aria-label="Inbox sections">
      <button role="tab" aria-selected={view === 'notifications'} onClick={() => setView('notifications')}><Bell size={15} />Notifications{notifications.unreadCount > 0 && <span className="ib-count">{notifications.unreadCount}</span>}</button>
      <button role="tab" aria-selected={view === 'messages'} onClick={() => setView('messages')}><MessageSquare size={15} />Messages{conversations.data.length > 0 && <span className="ib-count is-quiet">{conversations.data.length}</span>}</button>
      <span className="ib-tabs-glider" data-view={view} aria-hidden="true" />
    </div>

    {errors.map((text, i) => <p role="alert" className="ib-alert" key={i}>{text}</p>)}

    {view === 'notifications' ? <div className="ib-panel ib-notes">
      <div className="ib-toolbar">
        <div className="ib-filters" role="group" aria-label="Filter notifications">
          {FILTERS.map(f => <button key={f.key} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>{f.label}<small>{counts[f.key]}</small></button>)}
        </div>
        <button className="ib-btn" onClick={() => void notifications.markAllRead()} disabled={!notifications.unreadCount}><CheckCheck size={15} />Mark all read</button>
      </div>
      {notifications.loading ? <div className="ib-skeleton" role="status" aria-label="Loading notifications">{[0, 1, 2, 3].map(i => <span key={i} />)}</div>
      : !shown.length ? <div className="ib-empty"><Bell size={22} /><h2>{filter === 'all' ? 'No notifications yet' : 'Nothing here'}</h2><p>{filter === 'all' ? 'Replies, reactions, follows and messages will show up here — and in your email.' : 'Try another filter.'}</p></div>
      : groups.map(group => <section key={group.label} className="ib-group" aria-label={group.label}>
          <h2 className="ib-group-label">{group.label}</h2>
          <ul>{group.items.map(n => {
            const kind = KIND[n.type] ?? KIND.system; const Icon = kind.icon;
            const clickable = Boolean(notificationLink(n)) || (n.type === 'message' && n.entity_id);
            return <li key={n.id} className={`ib-note${n.read_at ? '' : ' is-unread'}`}>
              <span className={`ib-note-icon ${kind.tone}`} aria-hidden="true">{n.actor ? <span className="ib-note-face"><UserAvatar src={n.actor.avatar_url} /></span> : null}<Icon size={14} strokeWidth={2.2} /></span>
              <div className="ib-note-main">
                {clickable ? <a href={notificationLink(n) ?? '?tab=inbox&view=messages'} onClick={event => { event.preventDefault(); void openNotification(n); }}><Headline n={n} /></a> : <p><Headline n={n} /></p>}
                {n.body && n.type !== 'system' && <blockquote>{n.body}</blockquote>}
                <p className="ib-note-meta"><time dateTime={n.created_at} title={new Date(n.created_at).toLocaleString()}>{relative(n.created_at)}</time><span><Mail size={11} aria-hidden="true" />Sent to email</span></p>
              </div>
              {n.read_at ? <span className="ib-note-read" title="Read"><Check size={14} /></span>
                : <button className="ib-icon-btn" onClick={() => void notifications.markRead(n.id)} aria-label="Mark as read" title="Mark as read"><span className="ib-dot" /></button>}
            </li>;
          })}</ul>
        </section>)}
    </div>

    : <div className={`ib-panel ib-chat${selected ? ' has-thread' : ''}`}>
      <aside className="ib-list" aria-label="Conversations">
        <form className="ib-search" onSubmit={event => { event.preventDefault(); void search(); }}>
          <Search size={15} aria-hidden="true" />
          <input ref={searchBox} value={query} onChange={event => { setQuery(event.target.value); if (event.target.value.trim().length < 2) setPeople([]); }} minLength={2} maxLength={80} placeholder="Find a learner…" aria-label="Find a learner by username or display name" />
          {query ? <button type="button" className="ib-icon-btn" aria-label="Clear search" onClick={() => { setQuery(''); setPeople([]); }}><X size={14} /></button> : <kbd>/</kbd>}
        </form>
        {people.length > 0 && <div className="ib-results"><p className="ib-list-label">Start a conversation</p>{people.map(p => <button className="ib-convo" key={p.id} onClick={() => void start(p.id)} disabled={busy}>
          <span className="ib-avatar"><UserAvatar src={p.avatar_url} /></span><span className="ib-convo-text"><strong>{p.display_name || p.username}</strong><small>@{p.username}</small></span><Send size={14} className="ib-convo-go" />
        </button>)}</div>}
        <p className="ib-list-label">Conversations</p>
        {conversations.loading ? <div className="ib-skeleton is-tight" role="status" aria-label="Loading conversations">{[0, 1, 2].map(i => <span key={i} />)}</div>
        : !conversations.data.length ? <p className="ib-list-empty">No conversations yet. Search for a learner above to begin.</p>
        : conversations.data.map(c => {
            const faces = others(c, user.id);
            const mine = c.participants?.find(p => p.user_id === user.id);
            const unread = Boolean(c.last_message_at && mine && (!mine.last_read_at || Date.parse(mine.last_read_at) < Date.parse(c.last_message_at)));
            return <button className={`ib-convo${unread ? ' is-unread' : ''}`} aria-current={selected === c.id ? 'true' : undefined} key={c.id} data-conversation={c.id} onClick={() => { setSelected(c.id); setBody(''); }}>
              <span className={`ib-avatar${faces.length > 1 ? ' is-group' : ''}`}>{faces.length > 1 ? <Users size={16} /> : <UserAvatar src={faces[0]?.avatar_url} />}</span>
              <span className="ib-convo-text"><strong>{conversationName(c, user.id)}</strong><small>{faces.length > 1 ? `${faces.length + 1} people` : faces[0] ? `@${faces[0].username}` : 'Direct conversation'}</small></span>
              <time dateTime={c.last_message_at ?? c.created_at}>{relative(c.last_message_at ?? c.created_at)}</time>
            </button>;
          })}
      </aside>

      <section className="ib-thread" aria-label="Messages">
        {!active && !selected ? <div className="ib-empty is-thread"><MessageSquare size={24} /><h2>Pick a conversation</h2><p>Or press <kbd>/</kbd> to find a learner and start one.</p></div> : <>
          <header className="ib-thread-head">
            <button className="ib-icon-btn ib-back" onClick={() => setSelected(null)} aria-label="Back to conversations"><ArrowLeft size={17} /></button>
            <span className={`ib-avatar${partner.length > 1 ? ' is-group' : ''}`}>{partner.length > 1 ? <Users size={16} /> : <UserAvatar src={partner[0]?.avatar_url} />}</span>
            <div><strong>{active ? conversationName(active, user.id) : 'Conversation'}</strong><small>{partner.length === 1 ? `@${partner[0].username}` : partner.length ? partner.map(p => `@${p.username}`).join(' · ') : 'Private conversation'}</small></div>
            <span className="ib-pill is-live is-small"><i aria-hidden="true" />Live</span>
          </header>
          <div className="ib-history" ref={history} aria-live="polite">
            {messages.loading ? <div className="ib-skeleton is-bubbles" role="status" aria-label="Loading messages">{[0, 1, 2].map(i => <span key={i} />)}</div>
            : messages.data.length === 0 ? <div className="ib-empty is-thread"><p>Say hello — the conversation is yours to begin.</p></div>
            : messages.data.map((m, i) => {
                const prev = messages.data[i - 1]; const next = messages.data[i + 1];
                const newDay = !prev || dayKey(prev.created_at) !== dayKey(m.created_at);
                const mine = m.sender_id === user.id;
                const joinsPrev = !newDay && prev?.sender_id === m.sender_id && Date.parse(m.created_at) - Date.parse(prev.created_at) < 5 * 60000;
                const joinsNext = next && next.sender_id === m.sender_id && dayKey(next.created_at) === dayKey(m.created_at) && Date.parse(next.created_at) - Date.parse(m.created_at) < 5 * 60000;
                const author = mine ? null : active?.participants?.find(p => p.user_id === m.sender_id)?.profile;
                return <React.Fragment key={m.id}>
                  {newDay && <p className="ib-day"><span>{dayLabel(m.created_at)}</span></p>}
                  <article className={`ib-msg${mine ? ' is-mine' : ''}${joinsPrev ? ' joins-prev' : ''}${joinsNext ? ' joins-next' : ''}`}>
                    {!mine && <span className="ib-msg-face">{!joinsNext && <UserAvatar src={author?.avatar_url} />}</span>}
                    <div className="ib-bubble">
                      {!mine && !joinsPrev && partner.length > 1 && <strong>{author?.display_name ?? author?.username ?? 'Learner'}</strong>}
                      <p><Linkified text={m.body} /></p>
                      {!joinsNext && <time dateTime={m.created_at} title={new Date(m.created_at).toLocaleString()}>{clock(m.created_at)}{mine && <CheckCheck size={12} aria-label="Delivered" />}</time>}
                    </div>
                  </article>
                </React.Fragment>;
              })}
          </div>
          <form className="ib-composer" onSubmit={send}>
            <label className="ib-sr" htmlFor="ib-message">Your message</label>
            <textarea id="ib-message" ref={composer} value={body} onChange={event => setBody(event.target.value)} maxLength={4000} rows={1} required disabled={busy} placeholder="Write a message…"
              onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} />
            <div className="ib-composer-bar">
              <span className="ib-hint"><kbd><CornerDownLeft size={11} /></kbd> send <kbd>⇧</kbd>+<kbd><CornerDownLeft size={11} /></kbd> new line</span>
              <span className={`ib-chars${body.length > 3800 ? ' is-near' : ''}`}>{body.length}/4000</span>
              <button className="ib-send" disabled={busy || !body.trim()} aria-label={busy ? 'Sending…' : 'Send message'}><Send size={15} />{busy ? 'Sending' : 'Send'}</button>
            </div>
          </form>
        </>}
      </section>
    </div>}
  </section>;
}
