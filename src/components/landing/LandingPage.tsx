import { useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, Check, Menu, X } from 'lucide-react';
import ChordPlayground from './ChordPlayground';
import LearningStory from './LearningStory';
import ThoughtShelf from './ThoughtShelf';
import { useSurfaceReveal } from '../../hooks/useSurfaceReveal';
import '../../styles/landing-refresh.css';

interface LandingPageProps {
  liveStats: { registeredUsers: number; testsCompleted: number; problemsSolved: number };
  onSignIn: () => void;
  onRegister: () => void;
}
export default function LandingPage({ onSignIn, onRegister }: LandingPageProps) {
  const surfaceRef = useSurfaceReveal('.cq-experiment, .ts-equation-sheet, .cq-depth-sheet, .cq-plan-list article, .cq-journey article');
  const [menuOpen, setMenuOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  return <div className="quiet-calculix" ref={surfaceRef}>
    <a className="cq-skip" href="#cq-main">Skip to the question</a>
    <header className="cq-masthead cq-width">
      <a className="cq-wordmark" href="/?home=1" aria-label="CalculixHub home"><span className="cq-symbol" aria-hidden="true"><svg viewBox="0 0 40 40" fill="none"><path d="M30 9C11 2 2 27 18 32c7 3 15-3 15-10M7 23 32 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/><circle cx="31" cy="12" r="3" fill="currentColor"/></svg></span>calculix<span>hub</span></a>
      <span className="cq-masthead-note">A place to think.</span>
      <nav className={menuOpen ? 'cq-navigation is-open' : 'cq-navigation'} aria-label="Main navigation"><a href="#playground" onClick={() => setMenuOpen(false)}>Take a moment</a><a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a><a href="#plans" onClick={() => setMenuOpen(false)}>Plans</a><a href="/?auth=signup">My workspace <ArrowUpRight size={13}/></a></nav>
      <div className="cq-header-auth"><button className="cq-signin" onClick={onSignIn}>Sign in <ArrowRight size={15}/></button><button className="cq-signup" onClick={onRegister}>Sign up</button></div><button className="cq-menu" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(v=>!v)}>{menuOpen ? <X size={20}/> : <Menu size={20}/>}</button>
    </header>
    <main id="cq-main">
      <section className="cq-opening cq-width" aria-labelledby="cq-opening-title"><div className="cq-opening-title"><span className="cq-small-intro">Mathematics, at your own pace.</span><h1 id="cq-opening-title">Stay with<br />the <span>question<svg viewBox="0 0 530 22" aria-hidden="true"><path d="M3 14C150 3 331 5 526 12"/></svg></span>.</h1></div><div className="cq-opening-aside"><p>You don’t have to see it straight away.</p><p>CalculixHub is your workspace for competition mathematics: adaptive placement, thoughtful practice, worked solutions, and room to grow from AMC to Olympiad ideas.</p><a href="#playground" className="cq-down-link"><span>Start with this one</span><ArrowDown size={18}/></a></div></section>
      <div className="cq-width cq-playground-wrap"><ChordPlayground/><div className="cq-afterthought"><span>There’s more than one way to understand something.</span><a href="/?auth=signup&tab=learn">Find your own way in <ArrowRight size={14}/></a></div></div>
      <ThoughtShelf />
      <LearningStory onRegister={onRegister} />
      <section className="cq-open-letter cq-width"><div className="cq-letter-rule"><span aria-hidden="true">↳</span><p>A note before you begin</p></div><div className="cq-letter-body"><h2>You’re allowed<br />to <span>not know yet.</span></h2><p>To cross something out. To try a smaller example. To put a problem down and come back to it.</p><p>We built CalculixHub for that part of learning. The working-it-out part. A place to sit with a question, follow an idea, and gradually make it your own.</p><p className="cq-letter-signoff">Bring a little patience. We’ll bring the questions.</p><button className="cq-note-toggle" onClick={()=>setNoteOpen(value=>!value)} aria-expanded={noteOpen}>What happens when I get stuck? <span>{noteOpen?'−':'+'}</span></button>{noteOpen&&<div className="cq-expanded-note"><p>Begin with a hint. It gives you a direction without taking the discovery away. When you’re ready, read the worked solution and compare it with your own approach. You can revisit a problem as often as you need.</p><a href="/?auth=signup&tab=learn">Open a practice problem <ArrowRight size={14}/></a></div>}</div><div className="cq-margin-drawing" aria-hidden="true"><svg viewBox="0 0 200 245" fill="none"><path d="M30 201H175M52 222V39" className="cq-sketch-axis"/><path d="M24 174C53 200 52 72 80 115S104 187 124 78S151 79 170 36" className="cq-sketch-line"/><path d="m168 35-13 8m13-8 2 14" className="cq-sketch-line"/><circle cx="79" cy="116" r="20" className="cq-sketch-circle"/><text x="23" y="244">progress is rarely a straight line.</text></svg></div></section>
      <section className="cq-next cq-width" aria-labelledby="cq-next-title">
        <div className="cq-next-intro">
          <p className="cq-next-eyebrow">Your next step</p>
          <h2 id="cq-next-title">An idea becomes yours<br />when you <em>try it.</em></h2>
          <p>Take a question that catches your curiosity, or let your answers help us find a starting point.</p>
          <span className="cq-next-signature" aria-hidden="true"><svg viewBox="0 0 180 45" fill="none"><path d="M3 30c25-28 31 13 55-9s30 21 55-2 31 7 62-11M164 5l12 3-7 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>There’s a way in for you.</span>
        </div>
        <div className="cq-next-paths">
          <a className="cq-next-path cq-next-practice" href="/?auth=signup&tab=learn">
            <span className="cq-next-path-note">Follow your curiosity</span>
            <span className="cq-next-path-title">Explore a problem <ArrowUpRight size={25} aria-hidden="true"/></span>
            <span className="cq-next-path-copy">Browse competition mathematics. Choose an idea, try an approach, and work through the solution.</span>
            <span className="cq-next-path-link">Open practice <ArrowRight size={18} aria-hidden="true"/></span>
          </a>
          <button className="cq-next-path cq-next-placement" onClick={onRegister}>
            <span className="cq-next-path-note">Find your starting point</span>
            <span className="cq-next-path-title">Discover your level <ArrowUpRight size={25} aria-hidden="true"/></span>
            <span className="cq-next-path-copy">Create your free account, then begin adaptive placement. Each answer helps us find practice that fits.</span>
            <span className="cq-next-path-link">Create a free account <ArrowRight size={18} aria-hidden="true"/></span>
          </button>
        </div>
      </section>
    </main>
    <footer className="cq-footer cq-width"><div className="cq-footer-top"><a className="cq-wordmark" href="/?home=1">calculix<span>hub</span><span className="cq-footer-period">.</span></a><div><p>Keep a little room for a good question.</p><a href="/?preview=ios">Take a look at the iPhone experience <ArrowUpRight size={13}/></a></div></div><div className="cq-footer-bottom"><span>Made for the working-it-out part.</span><a href="/?auth=signup&tab=community">Find company in the conversation <ArrowRight size={13}/></a><span>© {new Date().getFullYear()} CalculixHub</span></div></footer>
  </div>;
}
