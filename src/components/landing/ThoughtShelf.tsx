import { useState } from 'react';
import { ArrowRight, ArrowUpRight, Plus, Minus } from 'lucide-react';
import MathText from '../MathText';

const ideas = [
  { topic: 'Algebra', symbol: '∑', theorem: 'Schur’s inequality', level: 'USAMO-style algebra', title: 'Symmetry hides a bound.', formula: String.raw`$$a^3+b^3+c^3+3abc$$
$$\geq\sum_{\mathrm{sym}}a^2b$$`, condition: String.raw`$a,b,c\geq0$. The symmetric sum contains all six terms such as $a^2b$ and $ab^2$.`, question: 'What becomes possible when three variables share a fixed sum?', thought: 'A symmetric expression can look untidy until you rewrite it in terms of its sum, pairwise products, and product.', insight: String.raw`Write $p=a+b+c$, $q=ab+bc+ca$, and $r=abc$. Schur becomes $p^3+9r\geq4pq$. With $p$ fixed, a three-variable problem becomes a relation between just $q$ and $r$.` },
  { topic: 'Geometry', symbol: '◯', theorem: 'Ptolemy’s theorem', level: 'AIME geometry', title: 'The circle ties it together.', formula: String.raw`$$AC\cdot BD$$
$$=AB\cdot CD+AD\cdot BC$$`, condition: String.raw`A, B, C, D lie on one circle, in that cyclic order.`, question: 'Can the diagonals reveal a length the sides cannot?', thought: 'Four points on a circle carry more structure than four points on a page. Connect the diagonals and a hidden relation appears.', insight: String.raw`Ptolemy connects both diagonals to the four sides. Combine it with equal chords or an angle condition before reaching for coordinates. The cyclic-order condition is essential.` },
  { topic: 'Combinatorics', symbol: '⋮', theorem: 'Roots-of-unity filter', level: 'AIME counting', title: 'Count what the pattern keeps.', formula: String.raw`$$\sum_{k\equiv r\; (\mathrm{mod}\;m)}\binom nk$$
$$=\frac1m\sum_{j=0}^{m-1}\omega^{-rj}(1+\omega^j)^n$$`, condition: String.raw`$\omega=e^{2\pi i/m}$; integers $n\geq0$, $m\geq2$, $0\leq r<m$. On the left, $0\leq k\leq n$.`, question: 'How many subsets of a 60-element set have a size divisible by three?', thought: 'Sometimes the fastest way to count is to let unwanted cases cancel themselves. Complex numbers become a surprisingly practical sieve.', insight: String.raw`For $m=3$ and $r=0$, use the three cube roots of unity. Since $(1+\omega)^{60}=(1+\omega^2)^{60}=1$, the answer is $(2^{60}+2)/3$.` },
  { topic: 'Number Theory', symbol: '≡', theorem: 'Lifting the exponent', level: 'USAMO-style number theory', title: 'A huge power. A small clue.', formula: String.raw`$$v_p(a^n-b^n)$$
$$=v_p(a-b)+v_p(n)$$`, condition: String.raw`Distinct positive integers $a,b$; $p$ is an odd prime, $p\mid(a-b)$, $p\nmid ab$, and $n\geq1$. Here $v_p$ counts factors of $p$.`, question: 'What is the largest power of three dividing 10²⁰²⁵ − 1?', thought: 'You do not need to expand the number. Understand the prime factors of the base difference and the exponent instead.', insight: String.raw`Take $p=3$, $a=10$, $b=1$, and $n=2025$. Then $v_3(9)=2$ and $v_3(2025)=4$, so the valuation is $6$: $3^6$ divides the number but $3^7$ does not.` },
];

function IdeaSketch({ index }: { index: number }) {
  if (index === 1) {
    const points = [{x:140,y:24},{x:215,y:99},{x:140,y:174},{x:65,y:99}];
    return <svg viewBox="0 0 280 200" fill="none" aria-hidden="true"><circle cx="140" cy="99" r="75" className="ts-sketch-rule"/><path d="M140 24L215 99L140 174L65 99Z" className="ts-sketch-ink"/><path d="M140 24V174M65 99H215" className="ts-sketch-pencil"/>{points.map((p,i)=><g key={i}><circle cx={p.x} cy={p.y} r="3" className="ts-sketch-point"/><text x={p.x+(i===3?-18:9)} y={p.y+(i===0?-9:14)}>{'ABCD'[i]}</text></g>)}</svg>;
  }
  if (index === 2) {
    const points = Array.from({length:5},(_,i)=>({x:140+70*Math.cos(i*2*Math.PI/5-Math.PI/2),y:100+70*Math.sin(i*2*Math.PI/5-Math.PI/2)}));
    return <svg viewBox="0 0 280 200" fill="none" aria-hidden="true"><circle cx="140" cy="100" r="70" className="ts-sketch-rule"/>{points.map((p,i)=><g key={i}><path d={`M140 100L${p.x} ${p.y}`} className="ts-sketch-rule"/><circle cx={p.x} cy={p.y} r="4" className="ts-sketch-point"/></g>)}<path d={points.map((_,i)=>{const p=points[(i*2)%5];return `${i?'L':'M'}${p.x} ${p.y}`;}).join(' ')+'Z'} className="ts-sketch-ink"/><text x="238" y="108">ω</text></svg>;
  }
  if (index === 3) return <svg viewBox="0 0 280 200" fill="none" aria-hidden="true">{[0,1,2,3,4,5].map(i=><g key={i}><path d={`M55 ${35+i*26}H${215-i*20}`} className="ts-sketch-ink"/><circle cx={215-i*20} cy={35+i*26} r="3" className="ts-sketch-point"/></g>)}<path d="M45 20V185" className="ts-sketch-rule"/><text x="222" y="39">p</text></svg>;
  return <svg viewBox="0 0 280 200" fill="none" aria-hidden="true"><path d="M35 162H250M140 178V22" className="ts-sketch-rule"/><path d="M50 150Q140 -52 230 150" className="ts-sketch-ink"/><path d="M63 150Q140 16 217 150" className="ts-sketch-pencil"/><circle cx="140" cy="49" r="4" className="ts-sketch-point"/><text x="150" y="38">a = b = c</text></svg>;
}

export default function ThoughtShelf() {
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const idea = ideas[active];
  const choose = (index: number) => { setActive(index); setOpen(false); };
  return <section className="thought-shelf cq-width" id="find-a-question" aria-labelledby="cq-shelf-title">
    <header className="ts-heading"><div><span className="cq-small-intro">Follow an idea a little further</span><h2 id="cq-shelf-title">What’s on<br/><em>your mind?</em></h2></div><p>A circle. A symmetry. A number that refuses to be ordinary. Choose a thread — see where it leads.</p></header>
    <div className="ts-tabs" role="tablist" aria-label="Explore a mathematical idea">{ideas.map((item,index)=><button key={item.topic} role="tab" id={`ts-tab-${index}`} aria-selected={active===index} aria-controls="ts-panel" tabIndex={active===index?0:-1} onClick={()=>choose(index)} onKeyDown={event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?3:(active+(event.key==='ArrowRight'?1:-1)+4)%4;choose(next);document.getElementById(`ts-tab-${next}`)?.focus();}}}><span aria-hidden="true">{item.symbol}</span>{item.topic}<ArrowUpRight size={17}/></button>)}</div>
    <div key={idea.topic} id="ts-panel" className="ts-panel" role="tabpanel" aria-labelledby={`ts-tab-${active}`}>
      <div className="ts-equation-sheet"><div className="ts-sheet-heading"><span>{idea.theorem}</span><span>{idea.level}</span></div><div className="ts-equation"><MathText text={idea.formula} /></div><p className="ts-conditions"><MathText text={idea.condition} /></p><div className="ts-sketch"><IdeaSketch index={active}/><span>A way of seeing,<br/>before a way of solving.</span></div></div>
      <div className="ts-invitation"><span className="ts-topic-label">{idea.topic} / a closer look</span><h3>{idea.title}</h3><p>{idea.thought}</p><div className="ts-prompt"><span>Something to think about</span><p>{idea.question}</p></div><button className="ts-nudge" onClick={()=>setOpen(!open)} aria-expanded={open} aria-controls="ts-insight">{open?'Put the idea away':'A way into the idea'}{open?<Minus size={17}/>:<Plus size={17}/>}</button>{open&&<div id="ts-insight" className="ts-insight"><MathText text={idea.insight}/></div>}<a href={`/?auth=signup&tab=learn&topic=${encodeURIComponent(idea.topic)}`}>Explore {idea.topic.toLowerCase()}<ArrowRight size={18}/></a></div>
    </div>
  </section>;
}
