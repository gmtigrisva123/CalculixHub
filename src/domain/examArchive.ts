import catalog from '../data/examArchive/catalog.json';

export type ArchiveFamily = 'AMC 12' | 'AIME' | 'USAMO' | 'IMO';
export type ArchiveKind = 'choice' | 'numeric' | 'proof';

export const ARCHIVE_FAMILIES: ArchiveFamily[] = ['AMC 12', 'AIME', 'USAMO', 'IMO'];

/** A full question, as a paper file holds it. Proofs carry reference solutions instead of a key. */
export type ArchiveQuestion = {
  id: string;
  number: number;
  label: string;
  prompt: string;
  kind: ArchiveKind;
  options?: string[];
  answerIndex?: number;
  answer?: string;
  /** Reference solutions, rendered with MathText. */
  solutions?: string[];
  /** The only solutions in the source are notes whose proof boxes were lost in conversion. */
  sketch?: boolean;
  /** A solution refers to a figure that the archive does not ship. */
  figureOmitted?: boolean;
  /** The answer as the source states it (text with math), for problems that ask for one. */
  finalAnswer?: string;
  topic?: string;
  origin?: string;
  sourceUrl?: string;
};

/** The catalog's view of a question: enough to count, score and show progress without the paper. */
export type ArchiveQuestionRef = { id: string; label: string; kind: ArchiveKind; key: string | null };

export type ArchiveSource = { name: string; url: string; license: string; rights: string };

export type ArchivePaper = {
  id: string;
  title: string;
  family: ArchiveFamily;
  contest: string;
  year: number | null;
  description: string;
  source: string;
  sourceUrl: string;
  /** One of the eight papers the archive launched with (adapted result questions for USAMO and IMO). */
  legacy: boolean;
  questions: ArchiveQuestionRef[];
};

type CatalogFile = {
  version: number;
  sources: Record<string, ArchiveSource>;
  papers: (Omit<ArchivePaper, 'legacy' | 'questions'> & { legacy?: boolean; questions: [string, string, ArchiveKind, string | null][] })[];
};

const file = catalog as unknown as CatalogFile;

export const ARCHIVE_SOURCES: Record<string, ArchiveSource> = file.sources;

export const ARCHIVE_PAPERS: ArchivePaper[] = file.papers.map(paper => ({
  ...paper,
  legacy: Boolean(paper.legacy),
  questions: paper.questions.map(([id, label, kind, key]) => ({ id, label, kind, key })),
}));

const byId = new Map(ARCHIVE_PAPERS.map(paper => [paper.id, paper]));

export function findArchivePaper(id: string | null | undefined): ArchivePaper | undefined {
  return id ? byId.get(id) : undefined;
}

export function isArchivePaperId(id: string): boolean {
  return byId.has(id);
}

// Each paper is its own small chunk, fetched when a learner opens it.
const paperFiles = import.meta.glob<{ id: string; questions: ArchiveQuestion[] }>('../data/examArchive/papers/*.json', { import: 'default' });
const loaded = new Map<string, Promise<ArchiveQuestion[]>>();

export function loadArchivePaper(id: string): Promise<ArchiveQuestion[]> {
  const cached = loaded.get(id);
  if (cached) return cached;
  const load = paperFiles[`../data/examArchive/papers/${id}.json`];
  if (!load) return Promise.reject(new Error(`Unknown exam paper: ${id}`));
  const request = load().then(data => data.questions);
  loaded.set(id, request);
  request.catch(() => loaded.delete(id));
  return request;
}

/** Proofs are not machine-marked: the learner reviews the reference solution and marks their own work. */
export type ProofMark = 'solved' | 'partial' | 'stuck';
export const PROOF_MARKS: ProofMark[] = ['solved', 'partial', 'stuck'];

/** Where a proof's self-review is kept inside a paper's saved answers. */
export function proofMarkKey(questionId: string): string {
  return `${questionId}#mark`;
}

export function readProofMark(answers: Record<string, string>, questionId: string): ProofMark | null {
  const mark = answers[proofMarkKey(questionId)];
  return mark === 'solved' || mark === 'partial' || mark === 'stuck' ? mark : null;
}

function keyOf(question: ArchiveQuestion | ArchiveQuestionRef): string | null {
  if ('key' in question) return question.key;
  if (question.kind === 'choice') return question.answerIndex === undefined ? null : String(question.answerIndex);
  if (question.kind === 'numeric') return question.answer ?? null;
  return null;
}

export function isArchiveAnswerCorrect(question: ArchiveQuestion | ArchiveQuestionRef, answer: string | undefined): boolean {
  if (answer === undefined || answer.trim() === '') return false;
  const key = keyOf(question);
  if (key === null) return false;
  if (question.kind === 'choice') return Number(answer) === Number(key);
  if (question.kind === 'numeric') return /^\d{1,3}$/.test(answer.trim()) && Number(answer) === Number(key);
  return false;
}

/** A question counts as attempted once it has an answer, a written proof or a self-review. */
export function isArchiveAttempted(question: ArchiveQuestionRef | ArchiveQuestion, answers: Record<string, string>): boolean {
  if ((answers[question.id] ?? '').trim() !== '') return true;
  return question.kind === 'proof' && readProofMark(answers, question.id) !== null;
}

export function archiveScore(paper: { questions: (ArchiveQuestion | ArchiveQuestionRef)[] }, answers: Record<string, string>): number {
  return paper.questions.filter(question => isArchiveAnswerCorrect(question, answers[question.id])).length;
}

export type ArchiveTally = {
  /** Questions with a checkable key (choice and numeric). */
  checkable: number;
  correct: number;
  proofs: number;
  solved: number;
  partial: number;
  attempted: number;
  total: number;
};

export function archiveTally(paper: { questions: (ArchiveQuestion | ArchiveQuestionRef)[] }, answers: Record<string, string>): ArchiveTally {
  const tally: ArchiveTally = { checkable: 0, correct: 0, proofs: 0, solved: 0, partial: 0, attempted: 0, total: paper.questions.length };
  for (const question of paper.questions) {
    if (isArchiveAttempted(question, answers)) tally.attempted += 1;
    if (question.kind === 'proof') {
      tally.proofs += 1;
      const mark = readProofMark(answers, question.id);
      if (mark === 'solved') tally.solved += 1;
      if (mark === 'partial') tally.partial += 1;
    } else {
      tally.checkable += 1;
      if (isArchiveAnswerCorrect(question, answers[question.id])) tally.correct += 1;
    }
  }
  return tally;
}

/** Honest totals for the archive header, straight from the catalog. */
export function archiveCounts() {
  const families = Object.fromEntries(ARCHIVE_FAMILIES.map(family => [family, { papers: 0, questions: 0, proofs: 0 }])) as Record<ArchiveFamily, { papers: number; questions: number; proofs: number }>;
  let questions = 0;
  let proofs = 0;
  let firstYear = Infinity;
  let lastYear = -Infinity;
  for (const paper of ARCHIVE_PAPERS) {
    const entry = families[paper.family];
    entry.papers += 1;
    entry.questions += paper.questions.length;
    const paperProofs = paper.questions.filter(question => question.kind === 'proof').length;
    entry.proofs += paperProofs;
    questions += paper.questions.length;
    proofs += paperProofs;
    if (paper.year) {
      firstYear = Math.min(firstYear, paper.year);
      lastYear = Math.max(lastYear, paper.year);
    }
  }
  return { papers: ARCHIVE_PAPERS.length, questions, proofs, firstYear, lastYear, families };
}
