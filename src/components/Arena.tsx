/* Hallmark · pre-emit critique: P5 H4 E4 S5 R3 V5 */
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { ArrowUpRight, Clock, Flag, RefreshCw, Swords, Trophy } from 'lucide-react';
import type { Arena as ArenaInfo, ArenaView } from '../../shared/arena';
import { apiFetch } from '../services/apiBase';
import { useAuth } from '../context/AuthContext';
import MathText from './MathText';
import NumericAnswerGrid from './NumericAnswerGrid';
import GeometryDiagram from './GeometryDiagram';
import '../styles/arena-admin.css';
import '../styles/arena-lobby.css';
import ArenaHero from './arena/ArenaHero';
import ArenaRules from './arena/ArenaRules';
import MatchTicket, { BoardEmpty, TicketSkeleton } from './arena/MatchTicket';
import { matchStatus } from './arena/lobbyModel';
import { useRealtimeSubscription } from '../services/data/realtime';
import { readArenaResponse } from '../services/arenaResponse';

export default function Arena() {
 const {user}=useAuth();
 const userId=useRef(user?.id);userId.current=user?.id;
 const reduce=useReducedMotion();
 const [arenas,setArenas]=useState<ArenaInfo[]>([]);
 const [view,setView]=useState<ArenaView|null>(null);
 const [selected,setSelected]=useState(0);
 const [answer,setAnswer]=useState('');
 const [busy,setBusy]=useState(false);
 const lock=useRef(false);
 const [error,setError]=useState('');
 const [catalogError,setCatalogError]=useState(false);
 const [loaded,setLoaded]=useState(false);
 const [clock,setClock]=useState(Date.now());
 const serverOffset=useRef(0);
 const [finishConfirm,setFinishConfirm]=useState(false);
 const catalog=async()=>{
  try { const response=await apiFetch('/api/arenas'); const data=await readArenaResponse<ArenaInfo[]>(response,'The match board is temporarily unavailable. Please try Refresh.');setArenas(data);setCatalogError(false);setError(''); }
  catch(e){setCatalogError(true);setError(e instanceof Error?e.message:'Could not connect.');}finally{setLoaded(true);}
 };
 useEffect(()=>{void catalog();const timer=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{setView(null);setAnswer('');},[user?.id]);
 const action=async(arenaId:string,operation:string)=>{
  if(lock.current)return;lock.current=true;setBusy(true);setError('');
  const actingUser=user?.id;
  try {
   const response=await apiFetch('/api/arena/action',{method:'POST',body:JSON.stringify({arenaId,action:operation,problemId:view?.questions[selected]?.id,answer})});
   const data=await readArenaResponse<ArenaView>(response,'Could not open this match right now. Please try again.');if(userId.current!==actingUser)return;
   serverOffset.current=Date.parse(data.server_time)-Date.now();setView(data);setFinishConfirm(false);
   if(operation==='register'||operation==='view'&&view?.arena.id!==arenaId){setSelected(0);setAnswer('');}
  }catch(e){
   if(userId.current===actingUser){
    const message=e instanceof Error?e.message:'';
    const ended=arenas.some(a=>a.id===arenaId&&(a.status==='closed'||Date.now()>=Date.parse(a.ends_at)));
    setError(message==='Register before entering'
     ? ended?'This match has ended. Only participants who joined before it closed can review their results.':'Join this match before opening it.'
     : message||'Connection lost. Your saved answers are safe.');
   }
  }finally{setBusy(false);lock.current=false;}
 };
 const [revision,setRevision]=useState(0);const processed=useRef(0);
 useRealtimeSubscription({table:'realtime_signals',filter:'scope=eq.arena',onReconnect:()=>setRevision(v=>v+1)},()=>setRevision(v=>v+1));
 useEffect(()=>{
  if(busy||revision===processed.current)return;processed.current=revision;
  void catalog();if(view&&user)void action(view.arena.id,'view');
 },[revision,busy]);
 const deadline=view?.deadline?Date.parse(view.deadline):null;
 const remaining=deadline?Math.max(0,Math.ceil((deadline-clock-serverOffset.current)/1000)):0;
 useEffect(()=>{
  if(view?.entry.started_at && !view.entry.finished_at && deadline && remaining===0 && !lock.current) void action(view.arena.id,'view');
 },[remaining,deadline,view?.entry.finished_at]);
 const item=view?.questions[selected];
 const state=item?view?.entry.answers[item.id]:undefined;
 const finished=Boolean(view?.entry.finished_at);
 const closed=finished || Boolean(state?.finished) || remaining===0;
 const viewEnded=Boolean(view&&(clock>=Date.parse(view.arena.ends_at)||arenas.some(a=>a.id===view.arena.id&&a.status==='closed')));
 const choose=(index:number)=>{setSelected(index);setAnswer('');setError('');};
 return <section className="arena-space" aria-busy={busy}>
  {view?<header className="arena-heading"><div><p className="arena-kicker"><Swords size={15}/> THE MATHEMATICS ARENA</p><h1>{view.arena.title}</h1><p>{view.arena.description}</p></div><button className="arena-quiet" onClick={()=>{setView(null);void catalog();}} disabled={busy}><RefreshCw size={16}/>All arenas</button></header>
   :<ArenaHero arenas={arenas} clock={clock} loaded={loaded} catalogError={catalogError} still={Boolean(reduce)}/>}
  {error && <div className="arena-notice" role="alert">{error}</div>}
  {!user && <div className="arena-note">You can browse the schedule. <a href="/?auth=signup">Sign in or create an account</a> to register and save your match.</div>}
  {!view ? <>
   <section className="al-board" aria-labelledby="arena-board-title">
    <div className="al-board-head"><div><h2 id="arena-board-title">The match board</h2><p className="al-board-count">{!loaded?'Checking the schedule…':catalogError?'Connection unavailable':arenas.length+' scheduled'}</p></div><button className="arena-quiet al-refresh" onClick={()=>{setView(null);void catalog();}} disabled={busy}><RefreshCw size={16}/>Refresh</button></div>
    {!loaded?<div className="al-board-list" role="status"><span className="sr-only">Loading matches…</span><TicketSkeleton/><TicketSkeleton/></div>:!arenas.length?<BoardEmpty catalogError={catalogError}/>:<div className="al-board-list">{arenas.map(a=>{
      const status=matchStatus(a,clock);
      return <MatchTicket key={a.id} arena={a} status={status} clock={clock}>{status!=='Finished'&&<button className="arena-primary" disabled={busy||!user} onClick={()=>void action(a.id,'register')}>Take a seat <ArrowUpRight size={16}/></button>}<button className="arena-quiet" disabled={busy||!user} onClick={()=>void action(a.id,'view')}>{status==='Finished'?'View my match':'Resume match'}</button>{status==='Finished'&&<small className="arena-action-hint">For participants who joined this match</small>}</MatchTicket>;
     })}</div>}
   </section>
   <ArenaRules/>
  </> : !view.entry.started_at ? <div className="arena-waiting"><div className="arena-seat">{viewEnded?<Flag size={42}/>:<Swords size={42}/>}</div>{viewEnded?<><p className="arena-kicker">MATCH ENDED</p><h2>This match has finished.</h2><p>You reserved a seat but did not start before the match closed. No score was recorded.</p><button className="arena-quiet" onClick={()=>setView(null)}>Back to the match board</button></>:<><p className="arena-kicker">YOUR SEAT IS RESERVED</p><h2>A little calm before the challenge.</h2><p>The match opens {new Date(view.arena.starts_at).toLocaleString()}. Once you enter, your {view.arena.duration_minutes}-minute clock starts. Answers are saved as you go.</p><button className="arena-primary" disabled={busy||clock<Date.parse(view.arena.starts_at)} onClick={()=>void action(view.arena.id,'start')}>Enter the arena <ArrowUpRight size={17}/></button></>}</div> : <>
   <div className="arena-scoreline"><span><Clock size={18}/>{finished?'Match complete':Math.floor(remaining/60)+':'+String(remaining%60).padStart(2,'0')}</span><span><Trophy size={18}/>{view.entry.score} points</span><span>IRT θ {view.entry.theta.toFixed(2)} · uncertainty {view.entry.sem.toFixed(2)}</span></div>
   <div className="arena-rounds" aria-label="Question navigator">{view.questions.map((q,i)=><button key={q.id} className={selected===i?'is-current':''} aria-current={selected===i?'step':undefined} onClick={()=>choose(i)}><span>{String(i+1).padStart(2,'0')}</span><small>{view.entry.answers[q.id]?.correct?'Solved':view.entry.answers[q.id]?.finished?'Closed':'Open'}</small></button>)}</div>
   {item && <div className="arena-workbench"><article className="arena-problem"><p className="arena-kicker">{item.topic} · {item.points} POINTS</p><h2>{item.title}</h2><MathText text={item.question}/>{item.figure&&<GeometryDiagram figure={item.figure}/>}</article><aside className="arena-response"><h3>{finished?'Your review':'Make your move.'}</h3><p>{state?.count??0} of 3 attempts used{state?.forfeited?' · No points available':''}</p>{!finished&&<form onSubmit={e=>{e.preventDefault();void action(view.arena.id,'submit');}}><NumericAnswerGrid digits={item.answerDigits??3} value={answer} onChange={setAnswer} disabled={busy||closed}/><button className="arena-primary" disabled={busy||closed||!answer||answer.includes('_')}>{busy?'Saving…':'Submit answer'}</button></form>}
    {state?.correct&&<p className="arena-success" role="status">Correct. Your points are saved.</p>}
    {state && !state.correct && !state.finished &&<p role="status">Not quite. You still have {3-state.count} attempts.</p>}
    {!closed&&<button className="arena-quiet" disabled={busy} onClick={()=>void action(view.arena.id,'forfeit')}>Pass this question · no points</button>}
    {finished&&item.solution&&<div><h4>Worked solution</h4><MathText text={item.solution}/></div>}
    {!finished&&<p className="arena-fine">Solutions appear when you finish the match.</p>}
   </aside></div>}
   {!finished&&<div className="arena-finish">{finishConfirm?<><p>Finish now? Unanswered questions earn no points and you cannot resume.</p><button className="arena-primary" disabled={busy} onClick={()=>void action(view.arena.id,'finish')}>Confirm finish</button><button className="arena-quiet" onClick={()=>setFinishConfirm(false)}>Keep thinking</button></>:<button className="arena-quiet" disabled={busy} onClick={()=>setFinishConfirm(true)}>Finish my match <Flag size={16}/></button>}</div>}
   {finished&&<section className="arena-results"><h2>Your match, in perspective.</h2><p>You earned {view.entry.score} points. Your provisional IRT estimate is {view.entry.theta.toFixed(2)} with posterior uncertainty {view.entry.sem.toFixed(2)}. Points determine the ranking; IRT is a separate learning signal.</p><h3>Finished matches</h3>{!view.leaderboard.length?<p>No finished results yet.</p>:<ol>{view.leaderboard.map((row,i)=><li key={i}><span>{row.name}</span><strong>{row.score} pts</strong></li>)}</ol>}</section>}
   <p className="arena-fine">IRT item parameters are editorial priors, not empirically calibrated difficulty. This estimate does not certify an exam score.</p>
  </>}
 </section>;
}
