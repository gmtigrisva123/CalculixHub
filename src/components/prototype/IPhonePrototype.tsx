import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { ArrowLeft, ArrowUpRight, Check } from 'lucide-react';
import '../../styles/iphone-prototype.css';
export default function IPhonePrototype() {
 const [scale,setScale]=useState(1);
 const stage=useRef<HTMLElement>(null);
 const track=(e:PointerEvent<HTMLElement>)=>{const el=stage.current;if(!el)return;const r=el.getBoundingClientRect();el.style.setProperty('--mx',String(((e.clientX-r.left)/r.width*2-1).toFixed(3)));el.style.setProperty('--my',String(((e.clientY-r.top)/r.height*2-1).toFixed(3)));};
 const rest=()=>{stage.current?.style.setProperty('--mx','0');stage.current?.style.setProperty('--my','0');};
 useEffect(()=>{const size=()=>setScale(Math.min(1,Math.max(.5,(window.innerWidth-32)/411),(window.innerHeight-70)/870));size();window.addEventListener('resize',size);return()=>window.removeEventListener('resize',size);},[]);
 return <main className="iphone-presentation" ref={stage} onPointerMove={track} onPointerLeave={rest}>
  <div className="ip-bg" aria-hidden="true">
   <span className="ip-aurora ip-aurora-lime"/><span className="ip-aurora ip-aurora-teal"/><span className="ip-aurora ip-aurora-mint"/>
   <span className="ip-spot"/><span className="ip-grid"/>
   <svg className="ip-plot" viewBox="0 0 1200 400" preserveAspectRatio="none">
    <path pathLength={1} d="M-20 300 C 120 300, 160 120, 300 120 S 480 300, 620 300 S 800 60, 940 60 S 1120 250, 1220 250"/>
    <path pathLength={1} d="M-20 220 C 100 220, 180 340, 320 340 S 520 150, 660 150 S 860 330, 1000 330 S 1160 180, 1220 180"/>
   </svg>
   <span className="ip-vignette"/><span className="ip-grain"/>
  </div>
  <a className="ip-back-website" href="/"><ArrowLeft size={15} strokeWidth={1.9} aria-hidden="true"/>Back to CalculixHub</a>
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
   <svg className="ip-orbits" viewBox="0 0 400 400" aria-hidden="true">
    <circle cx="200" cy="200" r="118"/><circle className="is-dashed" cx="200" cy="200" r="156"/><circle cx="200" cy="200" r="196"/>
    <g style={{'--t':'34s'} as CSSProperties}><circle className="ip-orbit-dot" cx="318" cy="200" r="3.2"/></g>
    <g className="is-back" style={{'--t':'52s'} as CSSProperties}><circle className="ip-orbit-dot is-mint" cx="200" cy="44" r="2.8"/></g>
    <g style={{'--t':'76s'} as CSSProperties}><circle className="ip-orbit-dot is-chalk" cx="61" cy="339" r="2.4"/></g>
   </svg>
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
