import archive from '../data/examArchive.json';

export type ArchiveQuestion = {
  id: string;
  number: number;
  prompt: string;
  kind: 'choice' | 'numeric';
  options?: string[];
  answerIndex?: number;
  answer?: string;
  sourceUrl?: string;
};

export type ExamCollection = {
  id: string;
  title: string;
  family: 'AMC 12' | 'AIME' | 'USAMO' | 'IMO';
  description: string;
  sourceUrl: string;
  questions: ArchiveQuestion[];
};

/** A fixed, inspectable snapshot. Exam answers never enter Learn or placement scoring. */
export const EXAM_COLLECTIONS = archive as ExamCollection[];

export function isArchiveAnswerCorrect(question: ArchiveQuestion, answer: string | undefined): boolean {
  if (answer === undefined || answer.trim() === '') return false;
  if (question.kind === 'choice') return Number(answer) === question.answerIndex;
  return /^\d{1,3}$/.test(answer.trim()) && Number(answer) === Number(question.answer);
}

export function archiveScore(collection: ExamCollection, answers: Record<string, string>): number {
  return collection.questions.filter(question => isArchiveAnswerCorrect(question, answers[question.id])).length;
}
