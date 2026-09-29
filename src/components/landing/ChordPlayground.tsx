import { useRef, useState } from 'react';
import { ArrowRight, RotateCcw } from 'lucide-react';
import MathText from '../MathText';
import { chordEndpoints, INITIAL_CHORD_ANGLE } from './chords';

export default function ChordPlayground() {
  const [angle, setAngle] = useState(INITIAL_CHORD_ANGLE);
  const [revealed, setRevealed] = useState(false);
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);
  const [dragging, setDragging] = useState(false);
  const svg = useRef<SVGSVGElement>(null);
  const geometry = chordEndpoints(angle);
  const xy = (point: { x: number; y: number }) => ({ x: 300 + point.x * 8, y: 190 - point.y * 8 });
  const c = xy(geometry.c), d = xy(geometry.d), p = xy({ x: 8, y: 6 });
  const reset = () => { setAngle(INITIAL_CHORD_ANGLE); setRevealed(false); setAnswer(''); setChecked(false); };
  return <section className="cq-experiment cq-chords" id="playground" aria-labelledby="cq-experiment-title">
    <div className="cq-question"><span className="cq-pencil-note">An original AIME-style exploration</span><h2 id="cq-experiment-title">Two chords.<br />One hidden radius.</h2><p>In the starting figure, two chords meet at P. Can you find the square of the circle’s radius?</p>
      <div className="cq-chord-givens"><MathText text="$PA=9,\;PB=21,\;PC=7,\;PD=27$" /><MathText text="$\cos\angle APC=\frac{3}{5}$" /></div>
      <form className="cq-chord-answer" onSubmit={event => { event.preventDefault(); setChecked(true); }}><label htmlFor="cq-radius-answer">Your answer for r²</label><div><input id="cq-radius-answer" inputMode="numeric" pattern="[0-9]{1,3}" maxLength={3} value={answer} onChange={event => { setAnswer(event.target.value.replace(/[^0-9]/g, '')); setChecked(false); }} placeholder="Try an integer" /><button disabled={!answer} type="submit">Check <ArrowRight size={17}/></button></div></form>
      {checked && <p className="cq-chord-feedback" role="status">{Number(answer) === 289 ? 'Exactly — 289. Now compare your reasoning with the solution.' : 'Not quite. Try locating the centre using the chord midpoints.'}</p>}
      <button className="cq-reveal" onClick={() => { setRevealed(!revealed); setAngle(INITIAL_CHORD_ANGLE); }}>{revealed ? 'Close the reasoning' : 'Explore the reasoning'}<ArrowRight size={17}/></button>
      {revealed && <div className="cq-chord-solution"><p>The intersecting-chord theorem gives <MathText text="$PA\cdot PB=PC\cdot PD=189$." /> Put P at the origin and PA on the vertical axis. The centre O projects to −6 on PA and −10 on PC, because the perpendicular from the centre bisects each chord.</p><p><MathText text="With $\cos\angle APC=3/5$, the direction of PC is $(4/5,3/5)$. Thus $O_y=-6$ and $(4/5)O_x+(3/5)(-6)=-10$, giving $O_x=-8$." /></p><p><MathText text="So $OP^2=8^2+6^2=100$ and $r^2=OP^2+189=\boxed{289}$." /></p></div>}
    </div>
    <div className="cq-drawing"><div className="cq-drawing-top"><span>Move the chord. Follow the invariant.</span><button onClick={reset} aria-label="Reset chord exploration"><RotateCcw size={19}/></button></div>
      <svg ref={svg} viewBox="0 0 600 390" role="img" aria-label="Two chords AB and CD intersect at P inside a circle. Rotate chord CD with the slider or drag point C." onPointerMove={event => { if (!dragging || !svg.current) return; const matrix=svg.current.getScreenCTM(); if (!matrix) return; const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse()); const degrees=Math.atan2(p.y-point.y,point.x-p.x)*180/Math.PI;setAngle(Math.max(-25,Math.min(155,degrees))); }} onPointerUp={() => setDragging(false)} onPointerCancel={() => setDragging(false)}>
        <defs><pattern id="cq-chord-grid" width="25" height="25" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".8" className="cq-grid-dot"/></pattern></defs><rect width="600" height="390" fill="url(#cq-chord-grid)"/>
        <circle cx="300" cy="190" r="136" className="cq-chord-circle"/>
        <path d={`M364 70L364 310M${c.x} ${c.y}L${d.x} ${d.y}`} className="cq-triangle-line"/>
        <path d={`M364 70L${c.x} ${c.y}L364 310L${d.x} ${d.y}Z`} className="cq-chord-inscribed"/>
        <circle cx={p.x} cy={p.y} r="4" className="cq-fixed-point"/><circle cx="364" cy="70" r="4" className="cq-fixed-point"/><circle cx="364" cy="310" r="4" className="cq-fixed-point"/><circle cx={d.x} cy={d.y} r="4" className="cq-fixed-point"/>
        <text x="372" y="58" className="cq-diagram-label">A</text><text x="372" y="334" className="cq-diagram-label">B</text><text x={p.x-24} y={p.y-6} className="cq-diagram-label">P</text><text x={c.x+14} y={c.y-13} className="cq-diagram-label">C</text><text x={d.x-22} y={d.y+24} className="cq-diagram-label">D</text>
        <text x="380" y="109" className="cq-chord-length">9</text><text x="380" y="230" className="cq-chord-length">21</text>
        <g className={dragging ? 'cq-drag-handle is-dragging' : 'cq-drag-handle'} onPointerDown={event => {event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);setDragging(true);}}><circle cx={c.x} cy={c.y} r="27" className="cq-handle-hit"/><circle cx={c.x} cy={c.y} r="13" className="cq-handle-halo"/><circle cx={c.x} cy={c.y} r="6" className="cq-handle-dot"/></g>
        {revealed && <><path d="M300 190L364 142M300 190H364" className="cq-height-line"/><circle cx="300" cy="190" r="4" className="cq-fixed-point"/><text x="279" y="208" className="cq-diagram-label">O</text></>}
      </svg>
      <div className="cq-chord-control"><label htmlFor="cq-chord-angle">Rotate chord CD</label><input id="cq-chord-angle" type="range" min="-25" max="155" step="0.1" value={angle} onChange={event => setAngle(Number(event.target.value))} aria-valuetext={`${angle.toFixed(1)} degrees`} /></div>
      <div className="cq-chord-invariant"><div><span>PC × PD</span><strong>{geometry.near.toFixed(2)} × {geometry.far.toFixed(2)}</strong></div><span className="cq-chord-equals">≈</span><div><span>The invariant</span><strong>{geometry.power}</strong></div></div>
      <p className="cq-chord-note">Rotating changes the lengths, but their product stays 189. Reset to return to the problem’s starting figure.</p>
    </div>
  </section>;
}
