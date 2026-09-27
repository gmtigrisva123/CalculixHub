import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';
import { clampVertex, TRIANGLE } from './triangle';

export default function TrianglePlayground() {
  const [x, setX] = useState<number>(TRIANGLE.initialX);
  const [prediction, setPrediction] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [moved, setMoved] = useState(false);
  const [dragging, setDragging] = useState(false);
  const svg = useRef<SVGSVGElement>(null);
  const changeX = (value: number) => { setX(clampVertex(value)); setMoved(true); };
  return <section className="cq-experiment" id="playground" aria-labelledby="cq-experiment-title">
    <div className="cq-question"><span className="cq-pencil-note">a question worth playing with</span><h2 id="cq-experiment-title">Different shape.<br />Different area?</h2><p>Slide the dot sideways. The triangle changes.<br />But does the space inside it?</p><div className="cq-predictions" role="group" aria-label="What happens to the area?">{['It changes', 'It stays the same'].map(answer => <button key={answer} aria-pressed={prediction === answer} onClick={() => { setPrediction(answer); setRevealed(false); }}>{answer}<span aria-hidden="true">↗</span></button>)}</div><div className="cq-experiment-answer" aria-live="polite">{revealed ? <><strong>{prediction === 'It stays the same' ? 'You saw it.' : 'Here’s the lovely part.'}</strong><p>The base hasn’t moved. Neither has the height. So the area stays exactly the same, however far you lean the triangle.</p><span>Same base × same height ÷ 2. Every time.</span></> : <p>{moved ? 'A different-looking triangle. Try another position before you decide.' : 'Make a guess. Then move things around. That’s how an idea becomes yours.'}</p>}</div><button className="cq-reveal" disabled={!prediction} onClick={() => setRevealed(value => !value)}>{revealed ? 'Hide the explanation' : 'Let me in on it'}<ArrowRight size={15}/></button></div>
    <div className="cq-drawing"><div className="cq-drawing-top"><span>A little room to think.</span><button onClick={() => {setX(TRIANGLE.initialX);setPrediction(null);setRevealed(false);setMoved(false);}} aria-label="Reset triangle experiment"><RotateCcw size={15}/></button></div><svg ref={svg} viewBox="0 0 600 350" role="img" aria-label="A triangle whose top vertex can move horizontally while its base and height stay fixed" onPointerMove={event => {if(!dragging || !svg.current)return;const rect=svg.current.getBoundingClientRect();changeX((event.clientX-rect.left)/rect.width*600);}} onPointerUp={() => setDragging(false)} onPointerCancel={() => setDragging(false)}>
      <defs><pattern id="cq-paper-grid" width="25" height="25" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".8" className="cq-grid-dot"/></pattern></defs><rect width="600" height="350" fill="url(#cq-paper-grid)"/>
      <path d="M45 80 H555" className="cq-guide"/><path d="M45 270 H555" className="cq-baseline"/>
      <path d={`M150 270 L${x} 80 L450 270 Z`} className="cq-triangle-fill"/>
      <path d={`M150 270 L${x} 80 L450 270`} className="cq-triangle-line"/>
      <path d={`M${x} 80V270`} className="cq-height-line"/>
      <path d={`M${x} 257h13v13`} className="cq-right-angle"/>
      <circle cx="150" cy="270" r="4" className="cq-fixed-point"/><circle cx="450" cy="270" r="4" className="cq-fixed-point"/>
      <text x="290" y="307" className="cq-diagram-label">same base</text><text x={x > 415 ? x-25 : x+20} y="185" textAnchor={x > 415 ? 'end' : 'start'} className="cq-diagram-label cq-height-label">same height</text>
      <g className={dragging ? 'cq-drag-handle is-dragging' : 'cq-drag-handle'} onPointerDown={event => {event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);setDragging(true);}}><circle cx={x} cy="80" r="27" className="cq-handle-hit"/><circle cx={x} cy="80" r="16" className="cq-handle-halo"/><circle cx={x} cy="80" r="8" className="cq-handle-dot"/></g><text x={x} y="43" textAnchor="middle" className="cq-drag-note">drag me</text>
    </svg><div className="cq-slider-control"><ArrowLeft size={14}/><label className="sr-only" htmlFor="cq-vertex">Move the top of the triangle</label><input id="cq-vertex" type="range" min={TRIANGLE.minX} max={TRIANGLE.maxX} value={x} onChange={event=>changeX(Number(event.target.value))} aria-valuetext={x < 260 ? 'Leaning left' : x > 340 ? 'Leaning right' : 'Near the middle'}/><ArrowRight size={14}/></div><div className="cq-drawing-bottom"><span>No timer. No marks. Just a hunch.</span><span>{moved ? 'Keep looking. You’re onto something.' : 'Go on, move it.'}</span></div></div>
  </section>;
}
