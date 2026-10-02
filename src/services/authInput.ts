/** A public handle candidate; the database trigger resolves collisions. */
export function deriveSignupUsername(displayName: string, email: string): string {
  const clean = (value: string) => value
    .replace(/đ/gi, 'd')
    .normalize('NFKD')
    .replace(/\p{Mark}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .replace(/^_+|_+$/g, '');

  for (const source of [displayName, email.split('@')[0]]) {
    const candidate = clean(source).slice(0, 20);
    if (candidate.length >= 3) return candidate;
  }
  return 'learner';
}
