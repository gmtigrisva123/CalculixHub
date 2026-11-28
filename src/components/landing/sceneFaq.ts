/**
 * Questions, answered: the thread underlines the question that is open.
 *
 * On the morning paper the thread is a pencil line again. It comes down from
 * Pro's edge and settles under the open question's last line of text, a
 * hand's underline; open another question and it glides there on the page's
 * follow spring (closing every answer leaves it on the rule above the list).
 * The question's text is measured as a range of text, when the layout changes
 * (opening an answer changes it), never while the page scrolls.
 */

import { docBox, followStep, type Box } from './stageLayout';
import { EMPTY_BOX, place, query, resetSlot } from './threadKit';
import { POLY_SAMPLES, resampleByLength } from './threadShapes';
import { SHAPE } from './threadShaders';
import type { Extra, Leg, Slot, StageFrame, ThreadScene } from './threadTypes';

/** A hand-drawn underline is never quite straight: its rise along its length (px), and how far past the words it runs. */
const WOBBLE = [0.6, -0.4, 0.2, -0.9, 0.3, 0.8, -0.2];
const PAST = 6;
/** How far below the line of text it sits (px). */
const BELOW = 7;

interface Target { left: number; right: number; y: number }

export class FaqScene implements ThreadScene {
  id = 'faq';
  private found = false;
  list: Box = EMPTY_BOX;
  private target: Target = { left: 0, right: 0, y: 0 };
  /** The underline as drawn this frame (page px), chasing the target. */
  private left = { x: 0, v: 0 };
  private right = { x: 0, v: 0 };
  private y = { x: 0, v: 0 };
  private started = false;
  private lastTime = -1;
  private points: [number, number, number][] = WOBBLE.map(() => [0, 0, 0]);

  measure() {
    const list = query('.lx-faq-list');
    this.found = Boolean(list);
    if (!list) return;
    this.list = docBox(list);
    const question = query('.lx-faq-item[data-open] .lx-faq-question');
    const scroll = window.scrollY;
    let target: Target = { left: this.list.left, right: this.list.left + this.list.width, y: this.list.top };
    if (question?.firstChild) {
      // The text itself, not its column: its last line, from the first glyph to the last.
      const range = document.createRange();
      range.selectNodeContents(question);
      const lines = Array.from(range.getClientRects()).filter(rect => rect.width > 1);
      const last = lines[lines.length - 1];
      if (last) {
        const line = lines.filter(rect => Math.abs(rect.bottom - last.bottom) < 4);
        target = {
          left: Math.min(...line.map(rect => rect.left)) - PAST,
          right: Math.max(...line.map(rect => rect.right)) + PAST,
          y: last.bottom + scroll + BELOW,
        };
      }
    }
    this.target = target;
    if (!this.started) {
      this.left.x = target.left;
      this.right.x = target.right;
      this.y.x = target.y;
      this.started = true;
    }
  }

  present() { return this.found && this.list.width > 0; }

  /** True while the underline is still gliding to the question just opened. */
  gliding(): boolean {
    return Math.abs(this.left.x - this.target.left) + Math.abs(this.right.x - this.target.right) + Math.abs(this.y.x - this.target.y) > 0.2
      || Math.abs(this.left.v) + Math.abs(this.right.v) + Math.abs(this.y.v) > 0.5;
  }

  slot(frame: StageFrame, out: Slot, row: number) {
    resetSlot(out);
    if (!this.present()) return;
    // Advance the glide once per frame of stage time (slot may be asked twice in a frame while legs blend).
    if (frame.time !== this.lastTime) {
      this.lastTime = frame.time;
      if (frame.still || frame.dt === 0) {
        this.left.x = this.target.left;
        this.right.x = this.target.right;
        this.y.x = this.target.y;
        this.left.v = this.right.v = this.y.v = 0;
      } else {
        const dt = Math.min(frame.dt, 1 / 30);
        followStep(this.left, this.target.left, dt);
        followStep(this.right, this.target.right, dt);
        followStep(this.y, this.target.y, dt);
      }
    }
    const last = WOBBLE.length - 1;
    WOBBLE.forEach((wobble, i) => {
      const point = this.points[i];
      point[0] = this.left.x + ((this.right.x - this.left.x) * i) / last - frame.cw / 2;
      point[1] = frame.ch / 2 - (this.y.x - frame.y + wobble);
      point[2] = 0;
    });
    out.shape = SHAPE.poly;
    place(out.matrix, frame, frame.cw / 2, frame.ch / 2);
    out.p[0].set(row, 0.1, 0, 1);
    out.data = resampleByLength(this.points, POLY_SAMPLES);
    out.look.set(1.9, 0.92, 0.09, 0);
    out.flowing = !frame.still && this.gliding();
  }
}

/** The thread comes down onto the list as it rises into view. */
export function faqLeg(self: FaqScene): Leg | null {
  return {
    to: 'faq',
    window: frame => {
      if (!self.present()) return null;
      const top = self.list.top;
      return [top - frame.vh * 1.05, top - frame.vh * 0.5];
    },
    stagger: 0.7,
    orderByU: 0.8,
    swirl: 28,
    lift: 50,
  };
}

export function createFaqExtras(_self: FaqScene, _style: CSSStyleDeclaration, _still: boolean): Extra[] {
  return [];
}
