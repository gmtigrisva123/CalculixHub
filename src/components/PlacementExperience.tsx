import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Leaf } from 'lucide-react';
import MathText from './MathText';
import { evaluatePlacement, tierForTheta, recommendedSource, type IRTItem, type ResponseRecord } from '../domain/irt';
import { ITEM_BANK } from '../domain/itemBank';
import '../styles/placement.css';
import { useSurfaceReveal } from '../hooks/useSurfaceReveal';

interface Props {
  item: IRTItem; selected: number | null; onSelect: (index: number) => void;
  onNext: () => void; onUnsure: () => void; onHome: () => void;
  error: string; completed: boolean; level: string; provisional: boolean;
  onFinish: () => Promise<void>;
  theta: number; sem: number; responses: ResponseRecord[]; log: string[];
}

export default function PlacementExperience(props: Props) {
  const surfaceRef = useSurfaceReveal('.placement-work, .placement-irt');
  const decision = evaluatePlacement(props.responses, ITEM_BANK);
  const position = (value: number) => Math.max(0, Math.min(100, ((value + 4) / 8) * 100));
  const domains = ['Algebra', 'Geometry', 'Combinatorics', 'Number Theory'];
  const heading = useRef<HTMLHeadingElement>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { heading.current?.focus(); }, [props.item.id, props.completed]);
  const finish = async () => {
    if (busy) return;
    setBusy(true);
    try { await props.onFinish(); } finally { setBusy(false); }
  };
  return <div className="quiet-calculix placement-study" ref={surfaceRef}>
    <div className="placement-window">
    <div className="placement-window-bar" aria-label="Placement test window">
      <div className="placement-window-controls" aria-hidden="true"><span /><span /><span /></div>
      <span className="placement-window-title">CalculixHub · Adaptive placement</span>
      <span className="placement-window-spacer" aria-hidden="true" />
    </div>
    <header className="placement-header">
      <button className="placement-brand" onClick={props.onHome} aria-label="CalculixHub home">Calculix<span>Hub</span><span className="placement-brand-dot" /></button>
      <button className="placement-back" onClick={props.onHome}><ArrowLeft size={16} /> Back home</button>
    </header>
    <main className="placement-layout">
      <aside className="placement-intro">
        <div className="placement-intro-copy">
        <span className="placement-eyebrow">A beginning, made for you</span>
        <h1>Find your <br /><em>own rhythm.</em></h1>
        <p>A little mathematics. A clearer place to start. Take your time — there’s no clock to race.</p>
        <svg className="placement-drawing" viewBox="0 0 260 120" fill="none" aria-hidden="true">
          <path d="M8 99H250M28 110V10" stroke="currentColor" opacity=".2" />
          <path d="M30 93C65 93 70 80 97 77S130 82 153 56 188 24 235 22" stroke="currentColor" strokeWidth="2" />
          <circle cx="153" cy="56" r="5" fill="currentColor" /><path d="M153 63V98" stroke="currentColor" strokeDasharray="3 5" opacity=".3" />
        </svg>
        <div className="placement-note"><Leaf size={19} /><p>Your answers shape what comes next. We’ll stop when we have a useful starting point.</p></div>
        </div>
        <section className="placement-irt" aria-label="Live IRT analysis">
          <div className="placement-irt-title"><span className="placement-live-dot" /><h2>Live IRT analysis</h2><span>3PL · EAP</span></div>
          <p className="placement-irt-description">A changing estimate, shaped by your answers.</p>
          <div className="placement-ability-label"><span>Ability estimate <span aria-hidden="true">θ</span></span><strong>{props.theta.toFixed(2)}</strong></div>
          <div className="placement-ability-scale" role="img" aria-label={`Ability estimate ${props.theta.toFixed(2)}, posterior standard deviation ${props.sem.toFixed(2)}`}>
            <span className="placement-ability-interval" style={{ left: `${position(props.theta - props.sem)}%`, width: `${position(props.theta + props.sem) - position(props.theta - props.sem)}%` }} />
            <span className="placement-ability-marker" style={{ left: `${position(props.theta)}%` }} />
          </div>
          <div className="placement-scale-labels"><span>−4</span><span>0</span><span>+4</span></div>
          <dl className="placement-irt-metrics">
            <div><dt>Posterior SD (SEM)</dt><dd>± {props.sem.toFixed(2)}</dd></div>
            <div><dt>Tier confidence</dt><dd>{Math.round(decision.confidence * 100)}%</dd></div>
            <div><dt>Estimated path</dt><dd>{tierForTheta(props.theta)}</dd></div>
            <div><dt>Matched level</dt><dd>{recommendedSource(props.theta)}</dd></div>
          </dl>
          <div className="placement-coverage"><h3>Domain coverage</h3>{domains.map(domain => <div key={domain}><span>{domain}</span><span>{props.responses.some(response => response.item.domain === domain) ? 'Explored' : 'Awaiting evidence'}</span></div>)}</div>
          <p className="placement-irt-status" role="status">{props.completed ? (props.provisional ? 'A tentative starting point is ready.' : 'Enough evidence for a starting path.') : props.responses.length ? 'Updating your estimate as you go.' : 'Your first answer begins the estimate.'}</p>
          <details className="placement-irt-log"><summary>How the model is adapting</summary><div>{props.log.slice(-5).map((line, index) => <p key={`${index}-${line}`}>{line}</p>)}</div></details>
          <p className="placement-irt-caveat">The band shows ±1 posterior SD. Confidence is model-based; item parameters are provisional.</p>
        </section>
      </aside>
      <section className="placement-work" aria-label="Adaptive placement">
        {props.completed ? <div className="placement-result">
          <span className="placement-eyebrow">Ready when you are</span>
          <h2 ref={heading} tabIndex={-1}>A place to begin.</h2>
          <p className="placement-result-copy">Your starting path is <strong>{props.level}</strong>.</p>
          <p>{props.provisional ? 'This is a tentative starting point: the available questions can only tell us so much.' : 'Your answers give us enough evidence to choose a starting path.'} Your practice will help you grow from here.</p>
          <div className="placement-result-note">A starting point, never a ceiling.</div>
          <button className="placement-primary" disabled={busy} onClick={finish}>{busy ? 'Opening your workspace…' : 'Begin learning'}<ArrowRight size={19} /></button>
        </div> : <div key={props.item.id} className="placement-question">
          <div className="placement-question-meta"><span>{props.item.domain}</span><span>{props.item.source} level</span></div>
          <h2 ref={heading} tabIndex={-1}><MathText text={props.item.question} /></h2>
          <fieldset className="placement-choices"><legend className="sr-only">Choose your answer</legend>
            {props.item.options.map((option, index) => <label key={index} className={`placement-choice ${props.selected === index ? 'is-selected' : ''}`}>
              <input type="radio" name={`placement-${props.item.id}`} checked={props.selected === index} onChange={() => props.onSelect(index)} />
              <span className="placement-radio">{props.selected === index && <Check size={14} />}</span><MathText text={option} />
            </label>)}
          </fieldset>
          {props.error && <p role="alert" className="placement-error">{props.error}</p>}
          <div className="placement-actions"><button className="placement-primary" onClick={props.onNext} disabled={props.selected === null}>Continue <ArrowRight size={19} /></button><button className="placement-unsure" onClick={props.onUnsure}>I’m not sure yet</button></div>
          <p className="placement-reassurance">It’s okay not to know. An honest answer helps us find the right path.</p>
        </div>}
      </section>
    </main>
    <footer className="placement-footer"><span>Space to think. Room to grow.</span><span>Adaptive placement · CalculixHub</span></footer>
    </div>
  </div>;
}
