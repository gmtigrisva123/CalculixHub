import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { ArrowUpRight, Check } from 'lucide-react';
import ParticleField from './ParticleField';
import '../../styles/iphone-prototype.css';
const GLYPHS = [
 {c:'∫',x:'4%',y:'12%',s:'120px',d:1.2,t:0},{c:'π',x:'44%',y:'7%',s:'84px',d:.7,t:1.4},{c:'∑',x:'38%',y:'78%',s:'110px',d:1,t:2.2},
 {c:'√',x:'91%',y:'10%',s:'96px',d:.9,t:.8},{c:'∞',x:'88%',y:'80%',s:'100px',d:1.3,t:3},{c:'Δ',x:'3%',y:'74%',s:'72px',d:.6,t:1.8},
 {c:'θ',x:'60%',y:'46%',s:'64px',d:.5,t:2.6},{c:'≈',x:'24%',y:'92%',s:'60px',d:.8,t:.4},
];
/** The phone hosts the real app, sharing the same account, database and live subscriptions. */
export default function IPhonePrototype() {
 const [scale,setScale]=useState(1);
 const stage=useRef<HTMLElement>(null);
 const track=(e:PointerEvent<HTMLElement>)=>{const el=stage.current;if(!el)return;const r=el.getBoundingClientRect();el.style.setProperty('--mx',String(((e.clientX-r.left)/r.width*2-1).toFixed(3)));el.style.setProperty('--my',String(((e.clientY-r.top)/r.height*2-1).toFixed(3)));};
 const rest=()=>{stage.current?.style.setProperty('--mx','0');stage.current?.style.setProperty('--my','0');};
 useEffect(()=>{const size=()=>setScale(Math.min(1,Math.max(.5,(window.innerWidth-32)/411),(window.innerHeight-70)/870));size();window.addEventListener('resize',size);return()=>window.removeEventListener('resize',size);},[]);
 return <main className="iphone-presentation" ref={stage} onPointerMove={track} onPointerLeave={rest}>
  <div className="ip-bg" aria-hidden="true">
   <span className="ip-aurora ip-aurora-lime"/><span className="ip-aurora ip-aurora-teal"/><span className="ip-aurora ip-aurora-mint"/>
   <span className="ip-grid"/>
   <ParticleField className="ip-particles"/>
   {GLYPHS.map((g,i)=><span key={i} className="ip-glyph" style={{left:g.x,top:g.y,fontSize:g.s,'--depth':g.d,'--delay':`${g.t}s`} as CSSProperties}>{g.c}</span>)}
   <span className="ip-vignette"/><span className="ip-grain"/>
  </div>
  <section className="ip-presentation-copy">
   <div className="ip-presentation-eyebrow ip-rise" style={{'--i':0} as CSSProperties}><i className="ip-status-dot"/>THE CALCULIXHUB MOBILE EXPERIENCE</div>
   <h1><span className="ip-rise" style={{'--i':1} as CSSProperties}>Big ideas.</span><span className="ip-rise ip-h1-accent" style={{'--i':2} as CSSProperties}>Pocket size.</span></h1>
   <p className="ip-presentation-lede ip-rise" style={{'--i':3} as CSSProperties}>Your real learning space, in a smaller frame. Sign in with the same account to pick up where you left off.</p>
   <ul className="ip-presentation-features ip-rise" style={{'--i':4} as CSSProperties}>
    <li><span className="ip-feature-check"><Check size={13} strokeWidth={2}/></span>Your saved questions and progress</li>
    <li><span className="ip-feature-check"><Check size={13} strokeWidth={2}/></span>The same live arenas and conversations</li>
   </ul>
   <div className="ip-presentation-actions ip-rise" style={{'--i':5} as CSSProperties}>
    <a className="ip-cta-shell" href="/?demo=1"><span className="ip-presentation-cta">Open the full workspace<span className="ip-cta-orb" aria-hidden="true"><ArrowUpRight size={17} strokeWidth={1.75}/></span></span></a>
    <p className="ip-presentation-hint">Tap, explore, solve. This phone runs the real application.</p>
   </div>
  </section>
  <div className="ip-device-area ip-rise" style={{'--i':3} as CSSProperties}>
   <div className="ip-mobile-preview-label">iPhone 16 · Live workspace</div>
   <div className="ip-stage-glow" aria-hidden="true"/>
   <div className="ip-float">
    <span className="ip-chip ip-chip-live" aria-hidden="true"><i className="ip-chip-dot"/><b>Live arenas</b><small>Compete in real time</small></span>
    <span className="ip-chip ip-chip-sync" aria-hidden="true"><span className="ip-chip-icon"><Check size={13} strokeWidth={2}/></span><b>Progress synced</b><small>Same account, any screen</small></span>
    <span className="ip-chip ip-chip-math" aria-hidden="true"><b>∫₀¹ x² dx</b><small>= 1⁄3</small></span>
    <div className="ip-tilt">
     <div className="ip-device-scaler" style={{width:411*scale,height:870*scale}}><div className="ip-device" style={{transform:`scale(${scale})`}}><span className="ip-hardware-button ip-action-button" aria-hidden="true"/><span className="ip-hardware-button ip-volume-up" aria-hidden="true"/><span className="ip-hardware-button ip-volume-down" aria-hidden="true"/><span className="ip-hardware-button ip-power-button" aria-hidden="true"/><div className="ip-screen"><div className="ip-status-bar" aria-hidden="true"><span>CalculixHub</span><div className="ip-dynamic-island"/></div><iframe title="CalculixHub live mobile workspace" src="/?demo=1" style={{width:'100%',flex:1,border:0,minHeight:0}}/><div className="ip-home-indicator" aria-hidden="true"><span/></div></div><span className="ip-glare" aria-hidden="true"/></div></div>
    </div>
   </div>
   <div className="ip-reflection" aria-hidden="true"/>
  </div>
 </main>;
}
