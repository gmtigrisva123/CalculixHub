import { useEffect, useRef, useState } from 'react';
import { Bell, MessageSquare, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { useNotifications, describeNotification, notificationLink } from '../services/data/notifications';
import { useConversations, useMessages } from '../services/data/messaging';
import { searchProfiles } from '../services/data/people';
import type { ProfileRow } from '../services/database.types';
import { Linkified } from '../lib/linkify';
import '../styles/live-data.css';
export default function Inbox() {
 const {user}=useAuth();const notifications=useNotifications(user?.id??null);const conversations=useConversations(user?.id??null);
 const [selected,setSelected]=useState<string|null>(null);const messages=useMessages(selected,user?.id??null);
 const [body,setBody]=useState('');const [query,setQuery]=useState('');const [people,setPeople]=useState<ProfileRow[]>([]);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const requestOwner=useRef(user?.id);requestOwner.current=user?.id;
 useEffect(()=>{setSelected(null);setBody('');setPeople([]);setQuery('');setError('');},[user?.id]);
 const search=async()=>{const owner=user?.id;setError('');try{const found=await searchProfiles(query);if(requestOwner.current===owner)setPeople(found.filter(p=>p.id!==owner));}catch{setError('Could not search learners.');}};
 const start=async(target:string)=>{if(!supabase||busy||!user)return;setBusy(true);setError('');const owner=user.id;const {data,error}=await supabase.rpc('start_conversation',{p_target:target});if(owner===requestOwner.current){if(error)setError('Could not open the conversation. Apply the realtime database setup.');else{setSelected(data);setPeople([]);await conversations.reload();}}setBusy(false);};
 const send=async(e:React.FormEvent)=>{e.preventDefault();if(!supabase||!user||!selected||busy||!body.trim())return;setBusy(true);setError('');const owner=user.id;const {error}=await supabase.from('messages').insert({conversation_id:selected,sender_id:user.id,body:body.trim()});if(owner===requestOwner.current){if(error)setError('Your message was not sent. Please retry.');else{setBody('');await messages.reload();await conversations.reload();}}setBusy(false);};
 return <section className="live-inbox"><header className="arena-heading"><div><p className="arena-kicker"><MessageSquare size={16}/> YOUR INBOX</p><h1>A conversation can open things up.</h1><p>Messages and notifications from the people in your learning space.</p></div></header>
 {!user?<p className="arena-note">Sign in to read your private inbox.</p>:<>
 {[error,notifications.error,conversations.error,messages.error].filter(Boolean).map((text,i)=><p role="alert" className="arena-notice" key={i}>{text}</p>)}
 <section className="live-notifications"><div className="admin-section-head"><h2><Bell size={20}/> Notifications · {notifications.unreadCount} unread</h2><button className="arena-quiet" onClick={()=>void notifications.markAllRead()} disabled={!notifications.unreadCount}>Mark all read</button></div>
 {notifications.loading?<p role="status">Loading notifications…</p>:notifications.data.length===0?<p>No notifications yet.</p>:notifications.data.map(n=>{const link=notificationLink(n);return <article className="admin-row" key={n.id}><div><p>{link?<a href={link} onClick={async e=>{e.preventDefault();if(!n.read_at)await notifications.markRead(n.id);window.location.assign(link);}}>{describeNotification(n)}</a>:describeNotification(n)}</p>{n.body&&n.type!=='system'&&<p className="arena-fine">“{n.body}”</p>}<time>{new Date(n.created_at).toLocaleString()}</time></div><button className="arena-quiet" disabled={Boolean(n.read_at)} onClick={()=>void notifications.markRead(n.id)}>{n.read_at?'Read':'Mark read'}</button></article>;})}
 </section>
 <div className="live-message-layout"><aside><h2>Your conversations</h2><form onSubmit={e=>{e.preventDefault();void search();}}><label>Find a learner<input value={query} onChange={e=>setQuery(e.target.value)} minLength={2} maxLength={80} placeholder="Username or display name"/></label><button className="arena-quiet" disabled={busy||query.trim().length<2}>Search</button></form>
 {people.map(p=><button className="live-conversation" key={p.id} onClick={()=>void start(p.id)} disabled={busy}>{p.display_name||p.username}<small>@{p.username}</small></button>)}
 {conversations.loading?<p role="status">Loading conversations…</p>:!conversations.data.length?<p>No conversations yet. Find a learner to begin.</p>:conversations.data.map(c=><button className="live-conversation" aria-current={selected===c.id?'page':undefined} key={c.id} onClick={()=>{setSelected(c.id);setBody('');}}>{c.title??'Direct conversation'}<small>{new Date(c.last_message_at??c.created_at).toLocaleString()}</small></button>)}
 </aside><section className="live-thread" aria-label="Messages">{!selected?<p>Choose a conversation to start reading.</p>:<>
 <p className="arena-fine">Latest 100 messages in this conversation.</p><div className="live-message-history" aria-live="polite">{messages.loading?<p role="status">Loading messages…</p>:messages.data.length===0?<p>Say hello. The conversation is yours to begin.</p>:messages.data.map(m=><article className={m.sender_id===user.id?'is-mine':''} key={m.id}><strong>{m.sender_id===user.id?'You':'Conversation partner'}</strong><p><Linkified text={m.body}/></p><time>{new Date(m.created_at).toLocaleString()}</time></article>)}</div>
 <form onSubmit={send}><label>Your message<textarea value={body} onChange={e=>setBody(e.target.value)} maxLength={4000} rows={3} required disabled={busy}/></label><button className="arena-primary" disabled={busy||!body.trim()}><Send size={15}/>{busy?'Sending…':'Send message'}</button></form>
 </>}</section></div>
 </>}
 </section>;
}
