/** Numeric grids accept leading zeros while expressions retain exact grading. */
export function compareAnswer(submitted: string, expected: string): boolean {
  const actual = submitted.trim().toLowerCase();
  const target = expected.trim().toLowerCase();
  if (/^\d+$/.test(actual) && /^\d+$/.test(target)) {
    return actual.replace(/^0+(?=\d)/, '') === target.replace(/^0+(?=\d)/, '');
  }
  return actual === target;
}
