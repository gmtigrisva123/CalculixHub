/**
 * The closing pencil line, shared by the SVG that draws it without WebGL and
 * the 3D tube that draws it on the stage.
 *
 * It keeps to the floor of the stage under the words, then climbs behind the
 * two path cards and breaks out above them: it never crosses a line of text.
 * It dips, loops back, and still ends higher than it started. The SVG is laid
 * out with preserveAspectRatio "xMidYMid slice", so the stage maps the same
 * viewBox onto its box the same way.
 */

export const FINAL_PATH = 'M-20 652C80 652 140 612 220 616S330 668 400 642 470 566 540 592 610 662 680 612 720 482 760 422 820 302 880 332 960 382 1010 262 1080 122 1150 140 1196 96 1222 70';

export const FINAL_VIEWBOX = { width: 1240, height: 700 } as const;

/** The key under which FinalStage publishes how much of the line is drawn (readStageValue). */
export const FINAL_DRAWN_KEY = 'final-drawn';
/** The key under which FinalStage publishes its stage's arrival spring. */
export const FINAL_ARRIVAL_KEY = 'final-arrival';

/** Where the viewBox lands in a box of the given size, with "xMidYMid slice". */
export function sliceFit(width: number, height: number) {
  const scale = Math.max(width / FINAL_VIEWBOX.width, height / FINAL_VIEWBOX.height);
  return {
    scale,
    x: (width - FINAL_VIEWBOX.width * scale) / 2,
    y: (height - FINAL_VIEWBOX.height * scale) / 2,
  };
}

/** How far the line has been drawn for a scroll progress (before the spring), as the SVG had it. */
export const drawnFor = (progress: number, still: boolean) => (still ? 1 : Math.min(1, 0.02 + (progress / 0.85) * 0.98));
