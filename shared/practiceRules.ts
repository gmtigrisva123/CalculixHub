export interface PracticeState { count: number; finished: boolean; forfeited: boolean }
export const EMPTY_PRACTICE: PracticeState = { count: 0, finished: false, forfeited: false };
export function submitPractice(state: PracticeState, correct: boolean): PracticeState {
  if (state.finished) return state;
  const count = Math.min(3, state.count + 1);
  return { count, finished: correct || count === 3, forfeited: !correct && count === 3 };
}
