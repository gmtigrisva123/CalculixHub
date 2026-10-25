import {
  archiveTally, isArchiveAnswerCorrect, isArchiveAttempted, readProofMark,
  type ArchiveFamily, type ArchivePaper, type ArchiveQuestionRef,
} from '../../domain/examArchive';
import type { ArchiveProgress, ArchiveProgressMap } from '../../services/data/examArchiveProgress';

export type FamilySlug = 'amc' | 'aime' | 'usamo' | 'imo';
export type PaperStatus = 'new' | 'progress' | 'done';
export type StatusFilter = 'all' | 'progress' | 'done' | 'saved';
export type SortOrder = 'newest' | 'oldest';
/** What one star (one question) shows: untouched, worked on, or right / self-marked solved. */
export type StarState = 0 | 1 | 2;

export const FAMILY_SLUG: Record<ArchiveFamily, FamilySlug> = { 'AMC 12': 'amc', AIME: 'aime', USAMO: 'usamo', IMO: 'imo' };

/** How each bank asks for answers, in the learner's words. */
export const FAMILY_FORMAT: Record<ArchiveFamily, string> = {
  'AMC 12': 'Multiple choice',
  AIME: 'Answers 000–999',
  USAMO: 'Written proofs',
  IMO: 'Written proofs',
};

export function paperStatus(paper: ArchivePaper, progress: ArchiveProgress | undefined): PaperStatus {
  if (!progress) return 'new';
  if (progress.completedAt) return 'done';
  return paper.questions.some(question => isArchiveAttempted(question, progress.answers)) ? 'progress' : 'new';
}

export function kindLine(paper: ArchivePaper): string {
  const n = paper.questions.length;
  const count = `${n} ${n === 1 ? 'problem' : 'problems'}`;
  if (paper.questions.every(question => question.kind === 'proof')) return `${count} · written proofs`;
  if (paper.questions.every(question => question.kind === 'choice')) return `${count} · multiple choice`;
  if (paper.questions.every(question => question.kind === 'numeric')) return `${count} · answers 000–999`;
  return `${count} · checkable answers`;
}

/** The plate's one-line status, in plain words. Proof marks are the learner's own, and say so. */
export function statusLine(paper: ArchivePaper, progress: ArchiveProgress | undefined): string {
  const status = paperStatus(paper, progress);
  const answers = progress?.answers ?? {};
  const tally = archiveTally(paper, answers);
  if (status === 'done') {
    if (tally.proofs === tally.total) {
      if (!tally.solved && !tally.partial) return 'Finished · not self-reviewed yet';
      return `Finished · ${tally.solved} solved${tally.partial ? `, ${tally.partial} partly` : ''} (your review)`;
    }
    return `Finished · ${tally.correct} of ${tally.checkable} correct`;
  }
  if (status === 'progress') {
    const verb = tally.proofs === tally.total ? 'attempted' : 'answered';
    return `${tally.attempted} of ${tally.total} ${verb}`;
  }
  return 'Not started';
}

export function starState(question: ArchiveQuestionRef, answers: Record<string, string> | undefined): StarState {
  if (!answers) return 0;
  if (question.kind === 'proof') {
    const mark = readProofMark(answers, question.id);
    if (mark === 'solved') return 2;
    return isArchiveAttempted(question, answers) ? 1 : 0;
  }
  if (isArchiveAnswerCorrect(question, answers[question.id])) return 2;
  return isArchiveAttempted(question, answers) ? 1 : 0;
}

function normalise(text: string): string {
  return text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

const ALIASES: Record<string, string> = {
  shortlist: 'imo shortlist isl', jmo: 'usajmo', usajmo: 'usajmo jmo', tstst: 'usa tstst', tst: 'usa tst',
};

function haystack(paper: ArchivePaper): string {
  const contest = normalise(paper.contest);
  const extra = Object.entries(ALIASES).filter(([key]) => contest.includes(key)).map(([, value]) => value).join(' ');
  return normalise(`${paper.title} ${paper.contest} ${paper.family} ${paper.year ?? ''} ${extra}`);
}

/** Every word of the query must appear; '12b' and '2019' both work, and so does 'jmo 2020'. */
export function matchesQuery(paper: ArchivePaper, query: string): boolean {
  const words = normalise(query).split(' ').filter(Boolean);
  if (!words.length) return true;
  const text = haystack(paper);
  return words.every(word => text.includes(word));
}

export type DecadeGroup = { key: string; label: string; decade: number | null; papers: ArchivePaper[] };

export function paperOrder(a: ArchivePaper, b: ArchivePaper): number {
  // Newest first, then by contest so 12A precedes 12B and AIME I precedes AIME II.
  return (b.year ?? 0) - (a.year ?? 0) || a.contest.localeCompare(b.contest, 'en', { numeric: true });
}

export function groupByDecade(papers: ArchivePaper[], order: SortOrder): DecadeGroup[] {
  const groups = new Map<string, DecadeGroup>();
  const sorted = [...papers].sort(paperOrder);
  if (order === 'oldest') sorted.sort((a, b) => (a.year ?? 0) - (b.year ?? 0) || a.contest.localeCompare(b.contest, 'en', { numeric: true }));
  for (const paper of sorted) {
    const decade = paper.year ? Math.floor(paper.year / 10) * 10 : null;
    const key = decade === null ? 'mixed' : String(decade);
    if (!groups.has(key)) groups.set(key, { key, decade, label: decade === null ? 'Adapted sets' : `${decade}s`, papers: [] });
    groups.get(key)!.papers.push(paper);
  }
  // Adapted sets (no single year) always close the list.
  return [...groups.values()].sort((a, b) => a.decade === null ? 1 : b.decade === null ? -1 : order === 'newest' ? b.decade - a.decade : a.decade - b.decade);
}

export function filterPapers(papers: ArchivePaper[], options: { family: ArchiveFamily | 'All'; status: StatusFilter; query: string; progress: ArchiveProgressMap }): ArchivePaper[] {
  return papers.filter(paper => {
    if (options.family !== 'All' && paper.family !== options.family) return false;
    const record = options.progress[paper.id];
    if (options.status === 'saved' && !record?.saved) return false;
    if (options.status === 'progress' && paperStatus(paper, record) !== 'progress') return false;
    if (options.status === 'done' && paperStatus(paper, record) !== 'done') return false;
    return matchesQuery(paper, options.query);
  });
}

/** Papers with work in them and not finished, most recently touched first. */
export function papersInProgress(papers: ArchivePaper[], progress: ArchiveProgressMap, limit = 3): ArchivePaper[] {
  return papers
    .filter(paper => paperStatus(paper, progress[paper.id]) === 'progress')
    .sort((a, b) => Date.parse(progress[b.id]!.updatedAt) - Date.parse(progress[a.id]!.updatedAt))
    .slice(0, limit);
}

// ------------------------------------------------------------------ deterministic shapes

/** FNV-1a, so a paper's cover and its place in the sky never change between visits. */
export function hashString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function seededRandom(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type CoverStar = { x: number; y: number; r: number };

/**
 * One star per question, joined in question order. Long papers string out along a gentle
 * wave; short ones (an olympiad's six problems) wander into a small asterism of their own.
 * Either way the lower left stays clear for the year, and the upper right for the bookmark.
 */
export function coverStars(paperId: string, count: number, width = 240, height = 120): CoverStar[] {
  const random = seededRandom(hashString(paperId));
  const clear = (x: number, y: number): [number, number] => {
    let ny = y;
    if (x < width * 0.5 && ny > height * 0.6) ny = height * (0.6 - random() * 0.12);
    if (x > width * 0.72 && ny < height * 0.45) ny = height * (0.45 + random() * 0.1);
    return [x, ny];
  };
  if (count <= 10) {
    // A short walk with gentle turns, then fitted to the cover so every asterism fills its sky.
    const walk: [number, number][] = [];
    let x = 0;
    let y = 0;
    let heading = random() * Math.PI * 2;
    for (let index = 0; index < count; index += 1) {
      walk.push([x, y]);
      heading += (random() - 0.5) * 2;
      const step = 0.8 + random() * 0.5;
      x += Math.cos(heading) * step;
      y += Math.sin(heading) * step;
    }
    const xs = walk.map(point => point[0]);
    const ys = walk.map(point => point[1]);
    const spanX = Math.max(...xs) - Math.min(...xs) || 1;
    const spanY = Math.max(...ys) - Math.min(...ys) || 1;
    const boxW = width * (count === 1 ? 0 : 0.6 + random() * 0.18);
    const boxH = height * (count === 1 ? 0 : 0.5 + random() * 0.14);
    // Keep the figure's own proportions within reason, so it reads as a shape and not a smear.
    const scale = Math.min(boxW / spanX, boxH / spanY * 1.6);
    const offsetX = width * 0.5 - ((Math.min(...xs) + Math.max(...xs)) / 2) * scale;
    const offsetY = height * 0.46 - ((Math.min(...ys) + Math.max(...ys)) / 2) * Math.min(scale, boxH / spanY);
    return walk.map(([px, py]) => {
      const [cx, cy] = clear(offsetX + px * scale, offsetY + py * Math.min(scale, boxH / spanY));
      return { x: Math.min(width * 0.93, Math.max(width * 0.07, cx)), y: Math.min(height * 0.88, Math.max(height * 0.12, cy)), r: 1.3 + random() * 1 };
    });
  }
  const phase = random() * Math.PI * 2;
  const waves = 1.1 + random() * 1.4;
  const amplitude = height * (0.16 + random() * 0.12);
  const marginX = width * 0.08;
  const span = width - marginX * 2;
  return Array.from({ length: count }, (_, index) => {
    const t = index / (count - 1);
    const x = marginX + span * t + (random() - 0.5) * (span / count) * 0.7;
    const y = height * 0.5 + Math.sin(phase + t * Math.PI * 2 * waves) * amplitude + (random() - 0.5) * height * 0.22;
    const [cx, cy] = clear(x, Math.min(height * 0.88, Math.max(height * 0.12, y)));
    return { x: cx, y: cy, r: 1.15 + random() * 0.9 };
  });
}
