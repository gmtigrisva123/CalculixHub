/**
 * The sheet: the problem the engine is asking, and the place to answer it.
 *
 * This is the first thing on the page that can be used, and it is the product
 * in small. The problem is a real one from a past paper, chosen by the engine
 * for what it knows so far. An answer is marked the way a paper is marked: a
 * red tick or a cross on the choice made, a ring round the right one, and a
 * line saying what the mark did to the engine's estimate. Then the reason, in a
 * sentence, and the next problem, harder or gentler for it.
 *
 * Choosing and handing in are two steps on purpose. A stray tap on a phone
 * should not cost a visitor the problem.
 *
 * Nothing here is kept: see sitting.ts.
 */

import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { recommendedSource } from '../../domain/irt';
import { Arrow, PenCross, PenRing, PenTick } from './kit';
import Tex from './Tex';
import { PAPER_BANK } from './paperBank';
import ScratchPad from './ScratchPad';
import { pitchOfNext, remarkOn, sitting, useSitting, type Mark, type Remark, type Sitting } from './sitting';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

const REMARKS: Record<Remark, string> = {
  'right-moves': 'Right. The engine’s estimate of you moves up.',
  'right-holds': 'Right. The engine saw that coming, so its estimate barely moves.',
  'miss-moves': 'Not this one. The engine’s estimate of you moves down.',
  'miss-holds': 'Not this one, but it was a reach, and the estimate barely moves.',
  blank: 'Left blank. The engine reads a blank as a miss, and its estimate moves down.',
};

const PITCH = { harder: 'a step harder', easier: 'a step gentler', level: 'at about the same level' } as const;

/** Why the engine stopped, by the reason it gives (see evaluatePlacement). */
const STOPPED: Record<string, string> = {
  precision: 'It stopped because its margin of error is as small as it asks for.',
  classification: 'It stopped because the odds it gives that level have passed 95 in 100.',
  'limited-information': 'It stopped because nothing left on this short paper would tell it much more.',
  'bank-exhausted': 'It stopped because you have answered every problem on this paper.',
};

const margin = (sem: number) => `±${sem.toFixed(2)}`;

/**
 * How the five choices are set: in one row, as a paper sets short answers; as
 * three over two; or as a list, one to a line. Which one depends on the widest
 * choice and the width of the sheet, so it is measured rather than guessed:
 * a row of five surds needs more room than a row of five integers. Measured
 * again when the sheet changes size, and once the maths faces have loaded,
 * because the fallback's letters are not the same width.
 */
type Setting = 'row' | 'split' | 'list';

function useSetting(ref: RefObject<HTMLFieldSetElement | null>, problem: string | undefined): Setting {
  const [setting, setSetting] = useState<Setting>('list');
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => {
      const style = getComputedStyle(node);
      const gap = parseFloat(style.columnGap) || 0;
      let widest = 0;
      for (const choice of node.querySelectorAll<HTMLElement>('.p1-opt')) {
        const box = getComputedStyle(choice);
        const face = choice.querySelector<HTMLElement>('.p1-opt-face');
        const letter = choice.querySelector<HTMLElement>('.p1-opt-letter');
        const text = choice.querySelector<HTMLElement>('.p1-opt-text');
        const inner = (letter?.offsetWidth ?? 0) + (face ? parseFloat(getComputedStyle(face).columnGap) || 0 : 0) + (text?.scrollWidth ?? 0);
        widest = Math.max(widest, inner + parseFloat(box.paddingLeft) + parseFloat(box.paddingRight) + 4);
      }
      const room = node.clientWidth;
      setSetting(5 * widest + 4 * gap <= room ? 'row' : 3 * widest + 2 * gap <= room ? 'split' : 'list');
    };
    measure();
    let live = true;
    void document.fonts?.ready.then(() => { if (live) measure(); });
    if (typeof ResizeObserver !== 'function') return () => { live = false; };
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => { live = false; observer.disconnect(); };
  }, [ref, problem]);
  return setting;
}

interface ProblemSheetProps {
  onRegister: () => void;
}

export default function ProblemSheet({ onRegister }: ProblemSheetProps) {
  const state = useSitting();
  const [choice, setChoice] = useState<number | null>(null);
  const [scratch, setScratch] = useState(false);
  const name = useId();
  const sheetRef = useRef<HTMLElement>(null);
  const choicesRef = useRef<HTMLFieldSetElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const onwardRef = useRef<HTMLButtonElement>(null);
  const { item, status, marks } = state;
  const last: Mark | undefined = marks[marks.length - 1];
  const marked = status === 'marked' ? last : undefined;
  const number = status === 'open' ? marks.length + 1 : marks.length;
  const setting = useSetting(choicesRef, item?.id);

  useEffect(() => { sitting.shown(); }, []);

  // Keep the keyboard where the work is. When a mark lands, the way onward is
  // focused; when the sheet turns over, its heading is, so the new problem is
  // read from the top. Only if focus was already on the sheet: the page never
  // pulls a reader back to it.
  const within = () => Boolean(sheetRef.current?.contains(document.activeElement));
  const held = useRef(false);
  useEffect(() => {
    if (!held.current) return;
    held.current = false;
    if (status === 'marked') onwardRef.current?.focus({ preventScroll: true });
    else titleRef.current?.focus({ preventScroll: true });
  }, [status, item]);

  const handIn = (answer: number | null) => {
    held.current = within();
    sitting.answer(answer);
  };
  const onward = () => {
    held.current = within();
    setChoice(null);
    sitting.next();
  };
  const again = () => {
    held.current = within();
    setChoice(null);
    sitting.restart();
  };

  return (
    <section ref={sheetRef} className="p1-sheet" aria-labelledby={`${name}-title`} data-status={status}>
      <header className="p1-sheet-head">
        <h2 ref={titleRef} id={`${name}-title`} className="p1-sheet-title" tabIndex={-1}>
          {status === 'closed' ? 'The engine has stopped.' : `Problem ${number}.`}
        </h2>
        <Tally marks={marks} />
      </header>

      {item && (
        <form
          key={item.id}
          className="p1-sheet-body"
          onSubmit={event => { event.preventDefault(); if (status === 'open' && choice !== null) handIn(choice); }}
        >
          <p className="p1-sheet-ref">{item.domain}<span aria-hidden="true"> · </span><span className="sr-only">, from </span>{item.ref.replace(' · ', ', ')}</p>
          <Tex as="div" className="p1-sheet-question" text={item.question} />

          <fieldset ref={choicesRef} className="p1-opts" data-setting={setting} disabled={status !== 'open'}>
            <legend className="sr-only">Your answer</legend>
            {item.options.map((option, index) => {
              const chosen = marked ? marked.choice === index : choice === index;
              const outcome = !marked ? undefined : index === item.correctIdx ? (marked.correct ? 'right' : 'key') : marked.choice === index ? 'wrong' : undefined;
              return (
                <label key={option} className="p1-opt" data-outcome={outcome} data-chosen={chosen || undefined}>
                  <input type="radio" name={name} value={index} checked={chosen} onChange={() => setChoice(index)} />
                  <span className="p1-opt-face">
                    <span className="p1-opt-letter">({LETTERS[index]})</span>
                    <Tex className="p1-opt-text" text={option} />
                    {outcome === 'key' && <PenRing className="p1-opt-ring" />}
                  </span>
                  {outcome === 'right' && <PenTick className="p1-opt-pen" />}
                  {outcome === 'wrong' && <PenCross className="p1-opt-pen" />}
                  {outcome && <span className="sr-only">{outcome === 'right' ? ', your answer, marked right' : outcome === 'wrong' ? ', your answer, marked wrong' : ', the right answer'}</span>}
                </label>
              );
            })}
          </fieldset>

          {status === 'open' && (
            <>
              <div className="p1-sheet-foot">
                <button type="submit" className="p1-btn" disabled={choice === null}>Mark my answer</button>
                <button type="button" className="p1-textbtn" onClick={() => handIn(null)}>I don’t know yet</button>
                <button type="button" className="p1-textbtn" aria-expanded={scratch} aria-controls={`${name}-scratch`} onClick={() => setScratch(open => !open)}>
                  {scratch ? 'Put the scratch paper away' : 'Scratch paper'}
                </button>
              </div>
              {scratch && <ScratchPad id={`${name}-scratch`} />}
            </>
          )}

          {marked && (
            <div className="p1-verdict" role="status">
              <p className="p1-verdict-remark">
                {REMARKS[remarkOn(marked)]}{' '}
                {!marked.correct && <>The answer is ({LETTERS[item.correctIdx]}). </>}
                <span className="p1-verdict-margin">{marginLine(marked)}</span>
              </p>
              <p className="p1-verdict-why"><b>Why.</b> <Tex text={item.reason} /></p>
              <div className="p1-sheet-foot">
                <button ref={onwardRef} type="button" className="p1-btn" onClick={onward}>
                  <span>{state.upNext ? 'Next problem' : 'See where it puts you'}</span>
                  <Arrow />
                </button>
                {state.upNext && (
                  <p className="p1-verdict-next">Next: {state.upNext.domain}, {PITCH[pitchOfNext(state) ?? 'level']}.</p>
                )}
              </div>
            </div>
          )}
        </form>
      )}

      {status === 'closed' && <Closed state={state} onRegister={onRegister} onAgain={again} />}
    </section>
  );
}

/** What the mark did to the margin of error. It usually narrows; a surprising answer can widen it, and the page says so. */
function marginLine(mark: Mark): string {
  const before = margin(mark.before.sem);
  const after = margin(mark.after.sem);
  if (mark.after.sem < mark.before.sem - 0.004) return `Margin of error: ${after}, down from ${before}.`;
  if (mark.after.sem > mark.before.sem + 0.004) return `That one surprised it: the margin of error widens from ${before} to ${after}.`;
  return `Margin of error: ${after}, unchanged.`;
}

/** The marks so far, in the order they were given. */
function Tally({ marks }: { marks: readonly Mark[] }) {
  if (marks.length === 0) return null;
  const right = marks.filter(mark => mark.correct).length;
  return (
    <p className="p1-tally">
      <span className="sr-only">{marks.length} marked, {right} right.</span>
      <span aria-hidden="true">
        {marks.map(mark => (mark.correct ? <PenTick key={mark.item.id} /> : <PenCross key={mark.item.id} />))}
      </span>
    </p>
  );
}

function Closed({ state, onRegister, onAgain }: { state: Sitting; onRegister: () => void; onAgain: () => void }) {
  const { belief, marks, decision } = state;
  const right = marks.filter(mark => mark.correct).length;
  const tally = right === 0 ? 'none of them right' : right === marks.length ? 'all of them right' : `${right} of them right`;
  return (
    <div className="p1-sheet-body p1-closed" role="status">
      <p className="p1-closed-lead">
        After {marks.length} problems, {tally}, it places you at <b>{belief.tier}</b>, give or take {belief.sem.toFixed(2)}.
        It would start you on {recommendedSource(belief.theta)} problems.
      </p>
      <p className="p1-closed-note">
        {STOPPED[decision.reason] ?? ''} This paper is {PAPER_BANK.length} multiple-choice problems; the placement in the app
        draws on a wider range, harder and gentler, and starts fresh.
      </p>
      <div className="p1-sheet-foot">
        <button type="button" className="p1-btn" onClick={onRegister}>
          <span>Take the full placement</span>
          <Arrow />
        </button>
        <button type="button" className="p1-textbtn" onClick={onAgain}>Sit this paper again</button>
      </div>
    </div>
  );
}
