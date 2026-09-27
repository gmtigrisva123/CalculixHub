import type { Problem } from './types';
/** Provisional rewards, not calibrated psychometric ability scores. */
export function problemScore(item: Pick<Problem, 'estimatedSteps' | 'abstraction' | 'answerMode' | 'figure'>): number {
  const burden = item.answerMode === 'proof' ? 5 : item.answerMode === 'numeric-grid' ? 2 : 1;
  return 8 + (item.estimatedSteps ?? 3) * 7 + (item.abstraction ?? 2) * 6 + burden * 3 + (item.figure ? 2 : 0);
}
