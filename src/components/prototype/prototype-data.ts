export type Topic = 'Algebra' | 'Geometry' | 'Number theory' | 'Combinatorics';

export interface PrototypeQuestion {
  id: string;
  title: string;
  topic: Topic;
  level: 'Warm-up' | 'Explore' | 'Challenge';
  minutes: number;
  prompt: string;
  expression?: string;
  choices: string[];
  correct: number;
  hint: string;
  explanation: string;
}

export const QUESTIONS: PrototypeQuestion[] = [
  { id: 'ALG-01', title: 'The hidden pair', topic: 'Algebra', level: 'Warm-up', minutes: 3, prompt: 'Positive reals a and b satisfy a + b = 5 and ab = 9. What is a² + b²?', expression: 'a² + b² = ?', choices: ['5', '7', '9', '11'], correct: 1, hint: 'Expand (a + b)² and isolate the term a² + b².', explanation: '(a + b)² = a² + 2ab + b², so a² + b² = 5² − 2·9 = 25 − 18 = 7.' },
  { id: 'GEO-01', title: 'Heron in one move', topic: 'Geometry', level: 'Warm-up', minutes: 4, prompt: 'A triangle has sides 13, 14, and 15. If K is its area and r its inradius, what is K + r²?', expression: 'K + r² = ?', choices: ['84', '96', '100', '112'], correct: 2, hint: 'Use Heron’s formula with semiperimeter 21, then r = K/s.', explanation: 'Heron gives K = √(21·8·7·6) = 84. Thus r = 84/21 = 4, so K + r² = 84 + 16 = 100.' },
  { id: 'NUM-01', title: 'A long power, reduced', topic: 'Number theory', level: 'Explore', minutes: 4, prompt: 'What is the remainder when 7²⁰²⁶ is divided by 1000?', expression: '7²⁰²⁶ mod 1000 = ?', choices: ['349', '549', '649', '749'], correct: 2, hint: 'Reduce the exponent using the period modulo 1000, then use repeated squaring.', explanation: 'Because 7¹⁰⁰ ≡ 1 (mod 1000), reduce to 7²⁶. Repeated squaring gives 7²⁶ ≡ 7¹⁶·7⁸·7² ≡ 601·801·49 ≡ 649 (mod 1000).' },
  { id: 'COM-01', title: 'Digit sets and permutations', topic: 'Combinatorics', level: 'Warm-up', minutes: 5, prompt: 'How many four-digit integers have four distinct digits and a digit sum divisible by 9?', expression: 'Count = ?', choices: ['516', '486', '504', '540'], correct: 0, hint: 'Count valid four-digit digit sets, then treat sets containing zero separately.', explanation: 'There are 14 valid digit sets without zero and 10 with zero. They contribute 14·4! and 10·(4!−3!), respectively, for 336 + 180 = 516.' },
  { id: 'ALG-02', title: 'A recurrence in disguise', topic: 'Algebra', level: 'Explore', minutes: 5, prompt: 'If r and s are roots of t² − 7t + 1 = 0, what is the remainder of r⁶ + s⁶ modulo 1000?', expression: 'r⁶ + s⁶ mod 1000 = ?', choices: ['482', '682', '582', '782'], correct: 1, hint: 'Set Sₙ = rⁿ + sⁿ. Each root satisfies t² = 7t − 1.', explanation: 'The recurrence is Sₙ = 7Sₙ₋₁ − Sₙ₋₂ with S₀ = 2 and S₁ = 7. It gives S₆ = 103682, so the remainder is 682.' },
  { id: 'GEO-02', title: 'A cyclic quadrilateral', topic: 'Geometry', level: 'Explore', minutes: 5, prompt: 'A cyclic quadrilateral has side lengths 4, 5, 6, and 7. What is the square of its area?', expression: 'K² = ?', choices: ['720', '800', '840', '960'], correct: 2, hint: 'Use Brahmagupta’s formula with semiperimeter 11.', explanation: 'K² = (11−4)(11−5)(11−6)(11−7) = 7·6·5·4 = 840.' },
  { id: 'NUM-02', title: 'A periodic congruence', topic: 'Number theory', level: 'Warm-up', minutes: 5, prompt: 'How many integers n from 1 through 1000 satisfy n ≡ 2ⁿ (mod 7)?', expression: 'Count = ?', choices: ['142', '132', '140', '144'], correct: 0, hint: 'The condition repeats every lcm(7, 3) = 21.', explanation: 'Testing one period gives residues 11, 15, and 16 modulo 21. There are 47 full periods (141 values), plus 998, for a total of 142.' },
  { id: 'COM-02', title: 'Two forbidden adjacencies', topic: 'Combinatorics', level: 'Explore', minutes: 5, prompt: 'Eight distinct people sit around a circle. Two specified pairs may not sit together. How many arrangements remain?', expression: 'Valid circles = ?', choices: ['2400', '2520', '2640', '2880'], correct: 2, hint: 'Use inclusion-exclusion; one adjacent pair is a circular block with two orientations.', explanation: 'Start with 7! circles. Subtract 2·(2·6!) for one forbidden pair, then add 2²·5! for both: 5040 − 2880 + 480 = 2640.' },
  { id: 'ALG-03', title: 'Power sums without solving', topic: 'Algebra', level: 'Challenge', minutes: 6, prompt: 'A positive x satisfies x + 1/x = 3. What are the last three digits of (x⁵ + 1/x⁵)²?', expression: '(x⁵ + 1/x⁵)² = ?', choices: ['109', '119', '129', '139'], correct: 2, hint: 'Use Tₙ = 3Tₙ₋₁ − Tₙ₋₂ with T₀ = 2 and T₁ = 3.', explanation: 'The recurrence gives T₂ = 7, T₃ = 18, T₄ = 47, T₅ = 123. Then T₅² = 15129, so the last three digits are 129.' },
  { id: 'GEO-03', title: 'The distance between centers', topic: 'Geometry', level: 'Explore', minutes: 6, prompt: 'A triangle has sides 10, 17, and 21. What is the numerator remainder of OI² modulo 1000, in lowest terms?', expression: 'OI² = ?', choices: ['365', '465', '435', '495'], correct: 1, hint: 'Find K and r with Heron, R = abc/(4K), then use OI² = R(R − 2r).', explanation: 'K = 84, r = 7/2, and R = 85/8. Thus OI² = (85/8)(29/8) = 2465/64, whose numerator remainder is 465.' },
  { id: 'NUM-03', title: 'A modular power sum', topic: 'Number theory', level: 'Explore', minutes: 6, prompt: 'Let S = 1²⁰²⁶ + 2²⁰²⁶ + ··· + 2026²⁰²⁶. What is S modulo 1000?', expression: 'S mod 1000 = ?', choices: ['1', '101', '51', '151'], correct: 1, hint: 'Work modulo 8 and 125, using the 125-term block and the Chinese remainder theorem.', explanation: 'Modulo 8, the 1013 odd terms give S ≡ 5. Modulo 125, full blocks vanish and the remaining 26 terms give S ≡ 101. Since 101 ≡ 5 (mod 8), CRT gives S ≡ 101 (mod 1000).' },
  { id: 'COM-03', title: 'A constrained lattice walk', topic: 'Combinatorics', level: 'Warm-up', minutes: 6, prompt: 'A path from (0,0) to (10,10) stays on or below y = x and avoids (5,5). What is the path count modulo 1000?', expression: 'Paths mod 1000 = ?', choices: ['32', '12', '24', '42'], correct: 0, hint: 'Use Catalan numbers and subtract paths that pass through (5,5).', explanation: 'There are C₁₀ = 16796 paths below the diagonal. The paths through (5,5) number C₅² = 42² = 1764. Their difference is 15032, giving remainder 32.' },
];

export const TOPICS: Topic[] = ['Algebra', 'Geometry', 'Number theory', 'Combinatorics'];
export interface PrototypeProfile {
  name: string;
  goal: number;
  theme: 'light' | 'dark';
  completed: string[];
  saved: string[];
  attempts: number;
  correctAnswers: number;
  activity: Record<string, number>;
}

export const DEFAULT_PROFILE: PrototypeProfile = { name: 'Explorer', goal: 3, theme: 'light', completed: [], saved: [], attempts: 0, correctAnswers: 0, activity: {} };
const ids = new Set(QUESTIONS.map(question => question.id));

export function localDay(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Local storage is user-controlled: validate every field, not just valid JSON. */
export function parseProfile(raw: string | null): PrototypeProfile {
  const fresh = { ...DEFAULT_PROFILE, completed: [], saved: [], activity: {} };
  if (!raw) return fresh;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return fresh;
    const data = value as Record<string, unknown>;
    const validIds = (input: unknown) => Array.isArray(input) ? [...new Set(input.filter((id): id is string => typeof id === 'string' && ids.has(id)))] : [];
    const validCount = (input: unknown) => typeof input === 'number' && Number.isSafeInteger(input) && input >= 0 ? Math.min(input, 1_000_000) : 0;
    const activity: Record<string, number> = {};
    if (data.activity && typeof data.activity === 'object' && !Array.isArray(data.activity)) {
      for (const [day, count] of Object.entries(data.activity)) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(day)) activity[day] = Math.min(validCount(count), QUESTIONS.length);
      }
    }
    const attempts = validCount(data.attempts);
    return {
      name: typeof data.name === 'string' && data.name.trim() ? data.name.trim().slice(0, 24) : fresh.name,
      goal: typeof data.goal === 'number' && [3, 5, 8].includes(data.goal) ? data.goal : fresh.goal,
      theme: data.theme === 'dark' ? 'dark' : 'light',
      completed: validIds(data.completed), saved: validIds(data.saved), attempts,
      correctAnswers: Math.min(validCount(data.correctAnswers), attempts), activity,
    };
  } catch { return fresh; }
}

export function recordAnswer(profile: PrototypeProfile, questionId: string, correct: boolean, day = localDay()): PrototypeProfile {
  if (!ids.has(questionId)) return profile;
  const firstCompletion = correct && !profile.completed.includes(questionId);
  return {
    ...profile,
    attempts: profile.attempts + 1,
    correctAnswers: profile.correctAnswers + (correct ? 1 : 0),
    completed: firstCompletion ? [...profile.completed, questionId] : profile.completed,
    activity: firstCompletion ? { ...profile.activity, [day]: (profile.activity[day] || 0) + 1 } : profile.activity,
  };
}

export function activeStreak(activity: Record<string, number>, now = new Date()): number {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!activity[localDay(day)]) day.setDate(day.getDate() - 1);
  let streak = 0;
  while (activity[localDay(day)] > 0 && streak < 3660) {
    streak += 1;
    day.setDate(day.getDate() - 1);
  }
  return streak;
}

export function shuffledQuestions(): PrototypeQuestion[] {
  const result = [...QUESTIONS];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result.slice(0, 5);
}
