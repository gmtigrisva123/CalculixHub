import { useEffect, useState } from 'react';
import { ArrowUpRight, Check } from 'lucide-react';
import '../../styles/iphone-prototype.css';
/** The phone hosts the real app, sharing the same account, database and live subscriptions. */
export default function IPhonePrototype() {
 const [scale,setScale]=useState(1);
 useEffect(()=>{const size=()=>setScale(Math.min(1,Math.max(.5,(window.innerWidth-32)/411),(window.innerHeight-70)/870));size();window.addEventListener('resize',size);return()=>window.removeEventListener('resize',size);},[]);
 return <main className="iphone-presentation"><section className="ip-presentation-copy">
  <div className="ip-presentation-eyebrow"><i className="ip-status-dot" aria-hidden="true"/>THE CALCULIXHUB MOBILE EXPERIENCE</div>
  <h1><span>Big ideas.</span><span>Pocket size.</span></h1>
  <p className="ip-presentation-lede">Your real learning space, in a smaller frame. Sign in with the same account to pick up where you left off.</p>
  <ul className="ip-presentation-features">
    <li><span className="ip-feature-check"><Check size={13} strokeWidth={2.75}/></span>Your saved questions and progress</li>
    <li><span className="ip-feature-check"><Check size={13} strokeWidth={2.75}/></span>The same live arenas and conversations</li>
  </ul>
  <div className="ip-presentation-actions">
    <a className="ip-presentation-cta" href="/?demo=1">Open the full workspace<span aria-hidden="true"><ArrowUpRight size={18}/></span></a>
    <p className="ip-presentation-hint">Tap, explore, solve. This phone runs the real application.</p>
  </div>
</section><div className="ip-device-area"><div className="ip-mobile-preview-label">iPhone 16 · Live workspace</div><div className="ip-device-scaler" style={{width:411*scale,height:870*scale}}><div className="ip-device" style={{transform:`scale(${scale})`}}><span className="ip-hardware-button ip-action-button" aria-hidden="true"/><span className="ip-hardware-button ip-volume-up" aria-hidden="true"/><span className="ip-hardware-button ip-volume-down" aria-hidden="true"/><span className="ip-hardware-button ip-power-button" aria-hidden="true"/><div className="ip-screen"><div className="ip-status-bar" aria-hidden="true"><span>CalculixHub</span><div className="ip-dynamic-island"/></div><iframe title="CalculixHub live mobile workspace" src="/?demo=1" style={{width:'100%',flex:1,border:0,minHeight:0}}/><div className="ip-home-indicator" aria-hidden="true"><span/></div></div></div></div></div></main>;
}
