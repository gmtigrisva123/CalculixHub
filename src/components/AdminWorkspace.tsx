import React, { useEffect, useRef, useState } from 'react';
import { Activity, AlertTriangle, Archive, CalendarClock, Check, Copy, Download, FileQuestion, KeyRound, LockKeyhole, Pencil, Plus, RefreshCw, Search, ShieldCheck, Swords, Trash2, Trophy, UserCheck, UserX, Users, X, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/apiBase';
import type { Problem } from '../../shared/types';
import type { Arena } from '../../shared/arena';
import MathText from './MathText';
import '../styles/admin.css';
import { useRealtimeSubscription } from '../services/data/realtime';

type State={arenas:Arena[];bank:Problem[];catalog:{id:string;document:Problem;archived:boolean}[];audit:{id:number;action:string;target?:string;created_at:string;user_id:string}[];members:{user_id:string}[];codeEnabled:boolean};
type UserRow={id:string;email?:string;created_at:string;last_sign_in_at?:string;banned_until?:string};
type Entry={user_id?:string;score?:number;theta?:number;sem?:number;started_at?:string|null;finished_at?:string|null};
const blankQuestion=():Problem=>({id:'custom-'+Date.now().toString(36),title:'',question:'',correctAnswer:'',solution:'',hint:'',topic:'Algebra',level:'Advanced',type:'text',points:0,estimatedSteps:4,abstraction:3,answerMode:'numeric-grid'});
const dateInput=(value:string)=>new Date(Date.parse(value)-new Date(value).getTimezoneOffset()*60000).toISOString().slice(0,16);

/* Elevated sessions are minted for 30 minutes on the server (server/adminSecurity.ts). */
const SESSION_MS=30*60_000;
const TABS=[{name:'Arenas',icon:Swords},{name:'Questions',icon:FileQuestion},{name:'People',icon:Users},{name:'Security',icon:KeyRound},{name:'Activity',icon:Activity}] as const;
const ACTIONS:Record<string,string>={unlock:'Unlocked Admin','set-code':'Changed the security code','remove-code':'Removed code entry','revoke-sessions':'Revoked other sessions','save-arena':'Saved an arena','close-arena':'Closed an arena','delete-arena':'Deleted an arena','save-problem':'Saved a question','archive-problem':'Archived a question','suspend-user':'Suspended an account','restore-user':'Restored an account'};
const DESTRUCTIVE=new Set(['delete-arena','close-arena','archive-problem','suspend-user','remove-code','revoke-sessions']);
const TOPIC_CLASS:Record<string,string>={Algebra:'is-algebra',Geometry:'is-geometry',Combinatorics:'is-combinatorics','Number Theory':'is-number'};

/* A stable hue per account, so the same person is always the same colour. */
const hue=(text:string)=>[...text].reduce((h,c)=>(h*31+c.charCodeAt(0))%360,7);
const shortId=(id:string)=>id.length>12?`${id.slice(0,8)}…`:id;
const when=(iso:string)=>new Date(iso).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
function ago(iso:string){
 const seconds=(Date.parse(iso)-Date.now())/1000;const format=new Intl.RelativeTimeFormat(undefined,{numeric:'auto'});
 for(const [unit,size] of [['day',86400],['hour',3600],['minute',60]] as const)if(Math.abs(seconds)>=size)return format.format(Math.round(seconds/size),unit);
 return format.format(Math.round(seconds),'second');
}
function timing(arena:Arena,now:number){
 const start=Date.parse(arena.starts_at),end=Date.parse(arena.ends_at);
 const progress=Math.min(1,Math.max(0,(now-start)/Math.max(end-start,1)));
 return {progress,phase:now<start?'Upcoming':now>end?'Ended':'Live now'};
}

/* The elevated session draining away, read off the clock once a second. */
function SessionClock({expiresAt,onExpire}:{expiresAt:number;onExpire:()=>void}){
 const [now,setNow]=useState(()=>Date.now());
 const expire=useRef(onExpire);expire.current=onExpire;
 useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer);},[]);
 const remaining=Math.max(0,expiresAt-now);
 useEffect(()=>{if(remaining<=0)expire.current();},[remaining]);
 const minutes=Math.floor(remaining/60000),seconds=Math.floor(remaining/1000)%60;
 const share=remaining/SESSION_MS;
 return <div className={`ad-clock${share<.15?' is-low':''}`} role="timer" aria-label={`Elevated session ends in ${minutes} minutes`}>
  <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20" className="ad-clock-track"/><circle cx="24" cy="24" r="20" className="ad-clock-fill" pathLength={1} style={{strokeDashoffset:1-share}}/></svg>
  <span><small>Session</small><strong>{minutes}:{String(seconds).padStart(2,'0')}</strong></span>
 </div>;
}

export default function AdminWorkspace({onContentChange}:{onContentChange:()=>void}) {
 const {user,signIn}=useAuth();
 const userId=useRef(user?.id);userId.current=user?.id;
 const [token,setToken]=useState('');const [code,setCode]=useState('');const [email,setEmail]=useState('');const [password,setPassword]=useState('');
 const [state,setState]=useState<State|null>(null);const [tab,setTab]=useState('Arenas');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');
 const [draft,setDraft]=useState<Arena|null>(null);const [question,setQuestion]=useState<Problem|null>(null);const [search,setSearch]=useState('');const [users,setUsers]=useState<UserRow[]>([]);
 const [confirmation,setConfirmation]=useState<{action:string;id?:string;title:string}|null>(null);const [confirmText,setConfirmText]=useState('');
 const [expiresAt,setExpiresAt]=useState<number|null>(null);
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(confirmation&&!dialog.current?.open)dialog.current?.showModal();},[confirmation]);
 const [results,setResults]=useState<unknown[]|null>(null);
 useEffect(()=>{setToken('');setState(null);setCode('');setDraft(null);setQuestion(null);setUsers([]);setResults(null);setConfirmation(null);setExpiresAt(null);},[user?.id]);
 const elevate=(next:string,expiresIn?:number)=>{setToken(next);setExpiresAt(Date.now()+(expiresIn?expiresIn*1000:SESSION_MS));};
 const lock=()=>{setToken('');setState(null);setExpiresAt(null);};
 const request=async(action:string,payload?:unknown,codeValue?:string,currentToken=token)=>{
  const actingUser=user?.id;
  const response=await apiFetch('/api/admin',{method:'POST',headers:currentToken?{'X-Admin-Session':currentToken}:{},body:JSON.stringify({action,payload,code:codeValue})});
  const data=await response.json();if(userId.current!==actingUser)throw Error('Your account changed. Unlock again.');if(!response.ok){if(response.status===403&&action!=='unlock')lock();throw Error(data.error??'Admin request failed.');}return data;
 };
 const run=async(operation:()=>Promise<void>)=>{if(busy)return;setBusy(true);setError('');setNotice('');try{await operation();}catch(e){setError(e instanceof Error?e.message:'Could not complete the action.');}finally{setBusy(false);}};
 const refresh=async(currentToken=token)=>setState(await request('state',undefined,undefined,currentToken));
 const unlock=()=>void run(async()=>{const data=await request('unlock',undefined,code);setCode('');elevate(data.token,data.expiresIn);await refresh(data.token);});
 const saveArena=()=>void run(async()=>{if(!draft)return;await request('save-arena',{id:draft.id||undefined,arena:{...draft,starts_at:new Date(draft.starts_at).toISOString(),ends_at:new Date(draft.ends_at).toISOString(),questions:draft.questions}});setDraft(null);await refresh();setNotice('Arena saved to the database.');});
 const [revision,setRevision]=useState(0);const processed=useRef(0);const [resultsArena,setResultsArena]=useState<string|null>(null);
 useRealtimeSubscription({table:'realtime_signals',enabled:Boolean(token),onReconnect:()=>setRevision(v=>v+1)},()=>setRevision(v=>v+1));
 useEffect(()=>{
  if(!token||busy||revision===processed.current)return;processed.current=revision;
  void run(async()=>{await refresh();if(tab==='People')setUsers((await request('users')).users);if(resultsArena)setResults((await request('results',{id:resultsArena})).entries);});
 },[revision,busy,token]);
 const bank=state?[...new Map([...state.bank,...state.catalog.filter(q=>!q.archived).map(q=>q.document)].map(q=>[q.id,q])).values()].filter(q=>!state.catalog.some(row=>row.id===q.id&&row.archived)):[];
 const newArena=()=>setDraft({id:'',title:'',description:'',starts_at:new Date(Date.now()+3600000).toISOString(),ends_at:new Date(Date.now()+86400000).toISOString(),duration_minutes:45,status:'draft',questions:[]});
 const confirm=()=>void run(async()=>{
  if(!confirmation)return;
  const response=await request(confirmation.action,confirmation.id?{id:confirmation.id,confirmation:confirmText}:undefined);
  if(response.token)elevate(response.token);setConfirmation(null);setConfirmText('');await refresh(response.token??token);setNotice('Change saved.');onContentChange();
 });
 const exportResults=()=>{
  if(!results)return;
  const text=JSON.stringify(results,null,2);const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='arena-results.json';link.click();URL.revokeObjectURL(url);
 };
 const switchTab=(name:string)=>{setTab(name);setDraft(null);setQuestion(null);setResults(null);setResultsArena(null);};
 const cancelConfirmation=()=>{setConfirmation(null);setConfirmText('');};

 const now=Date.now();
 const liveCount=state?state.arenas.filter(a=>a.status==='published'&&timing(a,now).phase==='Live now').length:0;
 const counts:Record<string,number|undefined>={Arenas:state?.arenas.length,Questions:bank.length,People:users.length||undefined,Activity:state?.audit.length};
 const entries=results?[...(results as Entry[])].sort((a,b)=>(b.score??0)-(a.score??0)):null;
 const arenaTitle=resultsArena?state?.arenas.find(a=>a.id===resultsArena)?.title:undefined;

 return <section className="admin-console" aria-busy={busy}>
  <header className="ad-top">
   <div className="ad-top-title">
    <p className="ad-crumb"><ShieldCheck size={14}/>Administration</p>
    <h1>Admin</h1>
    <p className="ad-lede">{token&&state?<>Signed in as <b>{user?.email??'administrator'}</b>. Every change here is recorded in the audit log.</>:'Manage arenas, the question bank and member accounts.'}</p>
   </div>
   {token&&expiresAt?<div className="ad-session"><SessionClock expiresAt={expiresAt} onExpire={()=>{lock();setNotice('');setError('Your elevated session ended after 30 minutes. Unlock Admin again to continue.');}}/><button className="ad-btn is-quiet" onClick={lock}><LockKeyhole size={15}/>Lock</button></div>
    :<span className="ad-session is-locked"><LockKeyhole size={14}/>Locked</span>}
  </header>

  {error&&<div className="ad-banner is-error" role="alert"><XCircle size={17}/><span>{error}</span><button className="ad-icon is-small" onClick={()=>setError('')} aria-label="Dismiss"><X size={15}/></button></div>}
  {notice&&<div className="ad-banner is-ok" role="status"><Check size={17}/><span>{notice}</span><button className="ad-icon is-small" onClick={()=>setNotice('')} aria-label="Dismiss"><X size={15}/></button></div>}

  {!user||!token?<div className="ad-gate">
    <div className="ad-gate-art" aria-hidden="true">
     <span className="ad-blob is-a"/><span className="ad-blob is-b"/><span className="ad-blob is-c"/>
     <div className="ad-gate-art-copy">
      <span className="ad-gate-lock">{!user?<LockKeyhole size={26} strokeWidth={1.8}/>:<KeyRound size={26} strokeWidth={1.8}/>}</span>
      <p>Admin access is limited to approved accounts and lasts 30 minutes at a time.</p>
     </div>
    </div>
    {!user?<form className="ad-gate-form" onSubmit={e=>{e.preventDefault();void run(async()=>{const result=await signIn({email,password});setPassword('');if(!result.ok)throw Error(result.error);});}}>
      <ol className="ad-steps" aria-label="Progress"><li className="is-current"><span>1</span>Sign in</li><li><span>2</span>Unlock</li></ol>
      <h2>Sign in to continue</h2><p>Use your CalculixHub account. Anything you change will be attributed to it.</p>
      <label className="ad-field">Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="username" placeholder="you@example.com"/></label>
      <label className="ad-field">Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/></label>
      <button className="ad-btn is-primary is-wide" disabled={busy}>{busy?'Signing in…':'Sign in'}</button>
     </form>
    :<form className="ad-gate-form" onSubmit={e=>{e.preventDefault();unlock();}}>
      <ol className="ad-steps" aria-label="Progress"><li className="is-done"><span><Check size={12} strokeWidth={3}/></span>Sign in</li><li className="is-current"><span>2</span>Unlock</li></ol>
      <h2>Enter the security code</h2><p>If code entry has been turned off, an approved administrator can leave this empty.</p>
      <label className="ad-field">Security code<input type="password" value={code} onChange={e=>setCode(e.target.value)} autoComplete="off" maxLength={128} placeholder="••••••••••••"/></label>
      <button className="ad-btn is-primary is-wide" disabled={busy}><ShieldCheck size={16}/>{busy?'Verifying…':'Unlock Admin'}</button>
      <small className="ad-fine">Signed in as {user.email}. The code is checked on the server and never stored in this browser.</small>
     </form>}
   </div>
  :state&&<>
   <dl className="ad-kpis">
    <div className="is-indigo"><span className="ad-kpi-icon"><Swords size={17}/></span><dt>Arenas</dt><dd>{state.arenas.length}</dd><p>{liveCount?<><i className="ad-live-dot"/>{liveCount} live now</>:'None live right now'}</p></div>
    <div className="is-amber"><span className="ad-kpi-icon"><FileQuestion size={17}/></span><dt>Questions</dt><dd>{bank.length}</dd><p>In Learn and arenas</p></div>
    <div className="is-teal"><span className="ad-kpi-icon"><Users size={17}/></span><dt>Administrators</dt><dd>{state.members.length}</dd><p>Approved accounts</p></div>
    <div className="is-violet"><span className="ad-kpi-icon"><Activity size={17}/></span><dt>Last change</dt><dd className="is-small">{state.audit[0]?ago(state.audit[0].created_at):'—'}</dd><p>{state.audit[0]?ACTIONS[state.audit[0].action]??state.audit[0].action:'Nothing yet'}</p></div>
   </dl>

   <nav className="ad-tabs" aria-label="Admin sections">{TABS.map(({name,icon:Icon})=><button key={name} aria-current={tab===name?'page':undefined} onClick={()=>switchTab(name)}><Icon size={16}/><span>{name}</span>{counts[name]!=null&&<small>{counts[name]}</small>}</button>)}</nav>

   <div className="ad-panel">
   {tab==='Arenas'&&<>
    <div className="ad-head"><div><h2>Arenas</h2><p>Timed contests. Questions are frozen into an arena when you save it.</p></div>{!draft&&<button className="ad-btn is-primary" onClick={newArena} disabled={busy}><Plus size={16}/>New arena</button>}</div>
    {draft?<form className="ad-card ad-editor" onSubmit={e=>{e.preventDefault();saveArena();}}>
      <div className="ad-card-head"><h3>{draft.id?'Edit arena':'New arena'}</h3><button type="button" className="ad-icon" onClick={()=>setDraft(null)} aria-label="Close arena editor"><X size={18}/></button></div>
      <div className="ad-editor-grid">
       <div>
        <label className="ad-field">Title<input value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})} required minLength={3} maxLength={120} placeholder="Weekly Arena — 2026-11-09"/></label>
        <label className="ad-field">Description<textarea value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})} maxLength={1200} placeholder="What makes this set worth sitting down for?"/></label>
        <div className="ad-fields">
         <label className="ad-field">Opens<input type="datetime-local" value={dateInput(draft.starts_at)} onChange={e=>{if(e.target.value)setDraft({...draft,starts_at:new Date(e.target.value).toISOString()});}} required/></label>
         <label className="ad-field">Closes<input type="datetime-local" value={dateInput(draft.ends_at)} onChange={e=>{if(e.target.value)setDraft({...draft,ends_at:new Date(e.target.value).toISOString()});}} required/></label>
         <label className="ad-field">Duration (minutes)<input type="number" min={5} max={240} value={draft.duration_minutes} onChange={e=>setDraft({...draft,duration_minutes:Number(e.target.value)})}/></label>
         <label className="ad-field">Visibility<select value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value as Arena['status']})}><option value="draft">Draft · only admins</option><option value="published">Published · registration open</option><option value="closed">Closed</option></select></label>
        </div>
       </div>
       <div className="ad-picker">
        <div className="ad-picker-head"><h4>Questions</h4><span><b>{draft.questions?.length??0}</b> / 30</span></div>
        <div className="ad-meter" aria-hidden="true"><span style={{width:`${(draft.questions?.length??0)/30*100}%`}}/></div>
        <p>Later edits in Learn won’t change this arena’s answers or rewards. For a private contest, write fresh questions.</p>
        <label className="ad-search"><Search size={15}/><input aria-label="Search question bank" placeholder="Search questions" value={search} onChange={e=>setSearch(e.target.value)}/></label>
        <div className="ad-picker-list">{bank.filter(q=>q.title.toLowerCase().includes(search.toLowerCase())&&/^\d+$/.test(q.correctAnswer)).map(q=><label key={q.id} className="ad-pick"><input type="checkbox" checked={Boolean(draft.questions?.some(p=>p.id===q.id))} disabled={busy||!draft.questions?.some(p=>p.id===q.id)&&(draft.questions?.length??0)>=30} onChange={e=>setDraft({...draft,questions:e.target.checked?[...(draft.questions??[]),q]:(draft.questions??[]).filter(p=>p.id!==q.id)})}/><span className="ad-pick-box" aria-hidden="true"><Check size={12} strokeWidth={3}/></span><span className="ad-pick-text">{q.title}<small><i className={`ad-topic ${TOPIC_CLASS[q.topic]??''}`}/>{q.topic} · {q.points} pts</small></span></label>)}</div>
       </div>
      </div>
      <div className="ad-editor-foot"><button type="button" className="ad-btn is-quiet" onClick={()=>setDraft(null)}>Cancel</button><button className="ad-btn is-primary" disabled={busy||!draft.questions?.length}>{busy?'Saving…':'Save arena'}</button></div>
     </form>
    :!state.arenas.length?<div className="ad-card ad-empty"><span className="ad-empty-icon"><Trophy size={22}/></span><h3>No arenas yet</h3><p>Create one, pick its questions and publish when it’s ready.</p><button className="ad-btn is-primary" onClick={newArena} disabled={busy}><Plus size={16}/>New arena</button></div>
    :<div className="ad-card ad-arenas">{state.arenas.map(a=>{const t=timing(a,now);const count=a.questions?.length??a.question_count??0;return <article className={`ad-arena is-${a.status}`} key={a.id}>
      <div className="ad-arena-info">
       <div className="ad-arena-tags"><span className={`ad-status is-${a.status}`}><i/>{a.status==='published'?'Published':a.status==='draft'?'Draft':'Closed'}</span>{a.status!=='closed'&&<span className={`ad-phase${t.phase==='Live now'?' is-live':''}`}>{t.phase}</span>}</div>
       <h3>{a.title}</h3>
       {a.description&&<p>{a.description}</p>}
      </div>
      <div className="ad-arena-when">
       <div className="ad-arena-meta"><span><FileQuestion size={13}/>{count} {count===1?'question':'questions'}</span><span><CalendarClock size={13}/>{a.duration_minutes} min</span></div>
       <div className="ad-timeline-track" aria-hidden="true"><span style={{width:`${t.progress*100}%`}}/>{t.phase==='Live now'&&<i style={{left:`${t.progress*100}%`}}/>}</div>
       <div className="ad-timeline-dates"><span>{when(a.starts_at)}</span><span>{when(a.ends_at)}</span></div>
      </div>
      <div className="ad-actions">
       <button className="ad-btn is-small" disabled={busy} onClick={()=>setDraft(a)}><Pencil size={14}/>Edit</button>
       <button className="ad-btn is-small" disabled={busy} onClick={()=>void run(async()=>(setResultsArena(a.id),setResults((await request('results',{id:a.id})).entries)))}><Trophy size={14}/>Results</button>
       <span className="ad-actions-more">
        <button className="ad-icon" disabled={busy} title="Duplicate" aria-label="Duplicate" onClick={()=>setDraft({...a,id:'',title:a.title+' · new edition',status:'draft'})}><Copy size={15}/></button>
        <button className="ad-icon" disabled={busy} title="Close" aria-label="Close" onClick={()=>setConfirmation({action:'close-arena',id:a.id,title:'Close this arena? Active matches will end.'})}><CalendarClock size={15}/></button>
        <button className="ad-icon is-danger" disabled={busy} title="Delete" aria-label="Delete" onClick={()=>setConfirmation({action:'delete-arena',id:a.id,title:'Delete this arena and its results permanently?'})}><Trash2 size={15}/></button>
       </span>
      </div>
     </article>;})}</div>}
    {entries&&<div className="ad-card ad-results">
     <div className="ad-card-head"><div><h3>Results{arenaTitle?` · ${arenaTitle}`:''}</h3><p>{entries.length} {entries.length===1?'entry':'entries'}, highest score first</p></div><div className="ad-actions"><button className="ad-btn is-small" onClick={exportResults}><Download size={14}/>Export JSON</button><button className="ad-icon" onClick={()=>{setResults(null);setResultsArena(null);}} aria-label="Close results"><X size={18}/></button></div></div>
     {entries.length?<div className="ad-table-wrap"><table className="ad-table"><thead><tr><th>#</th><th>Participant</th><th>Score</th><th>Ability (θ ± SEM)</th><th>Status</th></tr></thead><tbody>{entries.map((row,i)=><tr key={row.user_id??i}><td className="ad-rank">{i+1}</td><td><code>{row.user_id?shortId(row.user_id):'—'}</code></td><td><strong>{row.score??0}</strong></td><td>{(row.theta??0).toFixed(2)} ± {(row.sem??0).toFixed(2)}</td><td>{row.finished_at?<span className="ad-tag is-ok">Finished</span>:row.started_at?<span className="ad-tag is-live">In progress</span>:<span className="ad-tag">Registered</span>}</td></tr>)}</tbody></table></div>:<p className="ad-muted">No one has entered this arena yet.</p>}
    </div>}
   </>}

   {tab==='Questions'&&<>
    <div className="ad-head"><div><h2>Question bank</h2><p>What learners practise in Learn. Archived questions stay inside arenas that already use them.</p></div>{!question&&<button className="ad-btn is-primary" disabled={busy} onClick={()=>setQuestion(blankQuestion())}><Plus size={16}/>New question</button>}</div>
    {question?<form className="ad-card ad-editor" onSubmit={e=>{e.preventDefault();void run(async()=>{await request('save-problem',question);setQuestion(null);await refresh();onContentChange();setNotice('Question saved. Learn will use the updated version.');});}}>
      <div className="ad-card-head"><h3>{bank.some(q=>q.id===question.id)?'Edit question':'New question'}</h3><button type="button" className="ad-icon" onClick={()=>setQuestion(null)} aria-label="Close question editor"><X size={18}/></button></div>
      <div className="ad-editor-grid is-question">
       <div>
        <div className="ad-fields">
         <label className="ad-field">Stable ID<input value={question.id} onChange={e=>setQuestion({...question,id:e.target.value})} pattern="[a-z0-9][a-z0-9\-]{0,63}" required/></label>
         <label className="ad-field">Title<input value={question.title} onChange={e=>setQuestion({...question,title:e.target.value})} required/></label>
        </div>
        <label className="ad-field">Question <em>LaTeX supported</em><textarea rows={5} value={question.question} onChange={e=>setQuestion({...question,question:e.target.value})} required/></label>
        <div className="ad-fields is-three">
         <label className="ad-field">Topic<select value={question.topic} onChange={e=>setQuestion({...question,topic:e.target.value as Problem['topic']})}>{['Algebra','Geometry','Combinatorics','Number Theory'].map(s=><option key={s}>{s}</option>)}</select></label>
         <label className="ad-field">Level<select value={question.level} onChange={e=>setQuestion({...question,level:e.target.value as Problem['level']})}>{['Foundation','Intermediate','Advanced','Olympiad'].map(s=><option key={s}>{s}</option>)}</select></label>
         <label className="ad-field">Numeric answer<input value={question.correctAnswer} onChange={e=>setQuestion({...question,correctAnswer:e.target.value})} pattern="[0-9]{1,6}" required/></label>
         <label className="ad-field">Reasoning steps<input type="number" min={1} max={15} value={question.estimatedSteps??4} onChange={e=>setQuestion({...question,estimatedSteps:Number(e.target.value)})}/></label>
         <label className="ad-field">Abstraction (1–5)<input type="number" min={1} max={5} value={question.abstraction??3} onChange={e=>setQuestion({...question,abstraction:Number(e.target.value)})}/></label>
        </div>
        <label className="ad-field">Hint<textarea value={question.hint} onChange={e=>setQuestion({...question,hint:e.target.value})}/></label>
        <label className="ad-field">Worked solution<textarea rows={5} value={question.solution} onChange={e=>setQuestion({...question,solution:e.target.value})} required/></label>
       </div>
       <aside className="ad-preview" aria-label="Live preview">
        <p className="ad-preview-label">Preview</p>
        <div className="ad-preview-card">
         <div className="ad-preview-meta"><span><i className={`ad-topic ${TOPIC_CLASS[question.topic]??''}`}/>{question.topic}</span><span>{question.level}</span></div>
         <h4>{question.title||'Untitled question'}</h4>
         {question.question?<MathText as="div" className="ad-preview-math" text={question.question}/>:<p className="ad-muted">The question renders here as you type, LaTeX included.</p>}
         <div className="ad-preview-answer"><span>Answer</span><code>{question.correctAnswer||'—'}</code></div>
         {question.hint&&<div className="ad-preview-block"><span>Hint</span><MathText as="div" text={question.hint}/></div>}
         {question.solution&&<div className="ad-preview-block"><span>Solution</span><MathText as="div" text={question.solution}/></div>}
        </div>
       </aside>
      </div>
      <div className="ad-editor-foot"><button className="ad-btn is-quiet" type="button" onClick={()=>setQuestion(null)}>Cancel</button><button className="ad-btn is-primary" disabled={busy}>Save question</button></div>
     </form>
    :<div className="ad-card is-flush">
     <div className="ad-toolbar"><label className="ad-search"><Search size={15}/><input aria-label="Search questions" placeholder="Search by title" value={search} onChange={e=>setSearch(e.target.value)}/></label><span className="ad-muted">{bank.filter(q=>q.title.toLowerCase().includes(search.toLowerCase())).length} of {bank.length}</span></div>
     <div className="ad-table-wrap"><table className="ad-table is-rows"><thead><tr><th>Question</th><th>Topic</th><th>Level</th><th className="is-num">Points</th><th aria-label="Actions"/></tr></thead><tbody>
      {bank.filter(q=>q.title.toLowerCase().includes(search.toLowerCase())).map(q=><tr key={q.id}>
       <td><strong>{q.title}</strong><code>{q.id}</code></td>
       <td><span className={`ad-topic-chip ${TOPIC_CLASS[q.topic]??''}`}><i className={`ad-topic ${TOPIC_CLASS[q.topic]??''}`}/>{q.topic}</span></td>
       <td>{q.level}</td>
       <td className="is-num">{q.points}</td>
       <td><div className="ad-actions is-end"><button className="ad-btn is-small" disabled={busy} onClick={()=>setQuestion(q)}><Pencil size={14}/>Edit</button><button className="ad-icon" disabled={busy} title="Archive" aria-label={`Archive ${q.title}`} onClick={()=>setConfirmation({action:'archive-problem',id:q.id,title:'Archive this question from Learn? Existing arenas retain their snapshots.'})}><Archive size={15}/></button></div></td>
      </tr>)}
     </tbody></table></div>
    </div>}
   </>}

   {tab==='People'&&<>
    <div className="ad-head"><div><h2>Members</h2><p>Up to 100 accounts. A suspension lasts seven days; restoring takes effect immediately.</p></div><button className="ad-btn is-primary" disabled={busy} onClick={()=>void run(async()=>setUsers((await request('users')).users))}><RefreshCw size={15}/>{users.length?'Refresh':'Load accounts'}</button></div>
    {users.length?<div className="ad-card is-flush"><div className="ad-table-wrap"><table className="ad-table is-rows"><thead><tr><th>Account</th><th>Joined</th><th>Last seen</th><th>Status</th><th aria-label="Actions"/></tr></thead><tbody>
     {users.map(u=>{const suspended=Boolean(u.banned_until&&Date.parse(u.banned_until)>Date.now());const label=u.email??u.id;return <tr key={u.id} className={suspended?'is-suspended':undefined}>
      <td><span className="ad-person"><span className="ad-initials" style={{'--h':hue(label)} as React.CSSProperties}>{label.slice(0,1).toUpperCase()}</span><span><strong>{label}</strong>{u.id===user.id&&<small>That’s you</small>}</span></span></td>
      <td>{new Date(u.created_at).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</td>
      <td>{u.last_sign_in_at?ago(u.last_sign_in_at):'Never'}</td>
      <td>{suspended?<span className="ad-tag is-danger">Suspended</span>:<span className="ad-tag is-ok">Active</span>}</td>
      <td><div className="ad-actions is-end">{suspended?<button className="ad-btn is-small" disabled={busy} onClick={()=>setConfirmation({action:'restore-user',id:u.id,title:'Restore this account?'})}><UserCheck size={14}/>Restore</button>:<button className="ad-btn is-small" disabled={busy||u.id===user.id} onClick={()=>setConfirmation({action:'suspend-user',id:u.id,title:'Suspend this account for seven days?'})}><UserX size={14}/>Suspend</button>}</div></td>
     </tr>;})}
    </tbody></table></div></div>:<div className="ad-card ad-empty"><span className="ad-empty-icon"><Users size={22}/></span><h3>Accounts load on request</h3><p>Load the directory to review and moderate member accounts.</p></div>}
   </>}

   {tab==='Security'&&<>
    <div className="ad-head"><div><h2>Security</h2><p>Who can unlock Admin, and how.</p></div></div>
    <div className="ad-security">
     <div className="ad-card">
      <div className="ad-card-head"><h3>Code entry</h3><span className={`ad-tag ${state.codeEnabled?'is-ok':''}`}>{state.codeEnabled?'On':'Off'}</span></div>
      <p className="ad-muted">{state.codeEnabled?'A signed-in account that enters the correct code becomes an administrator.':'Only accounts that are already approved can unlock Admin.'}</p>
      <form onSubmit={e=>{e.preventDefault();void run(async()=>{const result=await request('set-code',undefined,code);elevate(result.token);setCode('');await refresh(result.token);setNotice('Code changed. Other elevated sessions were revoked.');});}}>
       <label className="ad-field">New security code<input type="password" autoComplete="new-password" value={code} minLength={12} maxLength={128} onChange={e=>setCode(e.target.value)} required/></label>
       <div className="ad-meter" aria-hidden="true"><span className={code.length>=12?'is-ok':''} style={{width:`${Math.min(code.length/12,1)*100}%`}}/></div>
       <p className="ad-fine">{code.length>=12?'Long enough.':`At least 12 characters · ${Math.max(0,12-code.length)} to go`}</p>
       <button className="ad-btn is-primary" disabled={busy}>Change code</button>
      </form>
     </div>
     <div className="ad-card">
      <div className="ad-card-head"><h3>Administrators</h3><span className="ad-muted">{state.members.length}</span></div>
      <ul className="ad-members">{state.members.map(m=><li key={m.user_id}><span className="ad-initials" style={{'--h':hue(m.user_id)} as React.CSSProperties}><ShieldCheck size={14}/></span><code title={m.user_id}>{shortId(m.user_id)}</code>{m.user_id===user.id&&<small>you</small>}</li>)}</ul>
      <p className="ad-fine">The service-role credential lives only on the server and is never shown here.</p>
     </div>
     <div className="ad-card ad-danger">
      <div className="ad-card-head"><h3><AlertTriangle size={16}/>Danger zone</h3></div>
      <div className="ad-danger-row"><div><strong>Revoke other sessions</strong><p>Everyone else is signed out of Admin immediately.</p></div><button className="ad-btn is-small" disabled={busy} onClick={()=>setConfirmation({action:'revoke-sessions',title:'Revoke all other elevated Admin sessions?'})}>Revoke</button></div>
      <div className="ad-danger-row"><div><strong>Turn off code entry</strong><p>Only existing administrators keep access.</p></div><button className="ad-btn is-danger is-small" disabled={busy||!state.codeEnabled} onClick={()=>setConfirmation({action:'remove-code',title:'Remove code entry? Only existing Admin members will retain access.'})}>Remove code</button></div>
     </div>
    </div>
   </>}

   {tab==='Activity'&&<>
    <div className="ad-head"><div><h2>Audit log</h2><p>The latest 50 administrator actions, newest first.</p></div></div>
    {state.audit.length?<ol className="ad-card ad-trail">{state.audit.map(row=><li key={row.id} className={DESTRUCTIVE.has(row.action)?'is-alert':undefined}>
     <span className="ad-trail-dot" aria-hidden="true">{DESTRUCTIVE.has(row.action)?<AlertTriangle size={13}/>:<Check size={13}/>}</span>
     <div><h3>{ACTIONS[row.action]??row.action}</h3><p><code>{row.action}</code>{row.target?<> · {row.target}</>:null} · by <span title={row.user_id}>{row.user_id===user.id?'you':shortId(row.user_id)}</span></p></div>
     <time dateTime={row.created_at} title={new Date(row.created_at).toLocaleString()}>{ago(row.created_at)}</time>
    </li>)}</ol>:<div className="ad-card ad-empty"><span className="ad-empty-icon"><Activity size={22}/></span><h3>Nothing recorded yet</h3></div>}
   </>}
   </div>
  </>}

  {confirmation&&<dialog ref={dialog} className="ad-confirm" aria-label="Confirm admin action" onCancel={cancelConfirmation}><div>
   <span className={`ad-confirm-mark${DESTRUCTIVE.has(confirmation.action)?' is-danger':''}`} aria-hidden="true">{DESTRUCTIVE.has(confirmation.action)?<AlertTriangle size={20}/>:<ShieldCheck size={20}/>}</span>
   <h2>{confirmation.title}</h2>
   <p className="ad-muted">{DESTRUCTIVE.has(confirmation.action)?'This can’t be undone from here.':'You can change this again later.'}</p>
   {confirmation.action==='delete-arena'&&<label className="ad-field">Type DELETE to confirm<input value={confirmText} onChange={e=>setConfirmText(e.target.value)} autoFocus/></label>}
   <div className="ad-actions is-end"><button className="ad-btn is-quiet" onClick={cancelConfirmation} disabled={busy}>Cancel</button><button className={`ad-btn ${DESTRUCTIVE.has(confirmation.action)?'is-danger-solid':'is-primary'}`} disabled={busy||confirmation.action==='delete-arena'&&confirmText!=='DELETE'} onClick={confirm}>Confirm</button></div>
  </div></dialog>}
 </section>;
}
