import { EXAM_COLLECTIONS } from '../../domain/examArchive';
import { supabase } from '../supabase';

export type ArchiveProgress = {
  saved: boolean;
  answers: Record<string, string>;
  currentIndex: number;
  completedAt: string | null;
  updatedAt: string;
};

export type ArchiveProgressMap = Record<string, ArchiveProgress>;

const validIds = new Set(EXAM_COLLECTIONS.map(collection => collection.id));
const pending = new Map<string, Promise<void>>();

function safeAnswers(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}

export function emptyArchiveProgress(): ArchiveProgress {
  return { saved: true, answers: {}, currentIndex: 0, completedAt: null, updatedAt: new Date().toISOString() };
}

function storageKey(userId: string | null): string {
  return `calculix_exam_archive_v1:${userId ?? 'guest'}`;
}

export function readArchiveProgress(userId: string | null): ArchiveProgressMap {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(userId)) ?? '{}') as ArchiveProgressMap;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const result: ArchiveProgressMap = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (!validIds.has(id) || !value || typeof value !== 'object') continue;
      result[id] = {
        saved: Boolean(value.saved),
        answers: safeAnswers(value.answers),
        currentIndex: Number.isInteger(value.currentIndex) && value.currentIndex >= 0 ? value.currentIndex : 0,
        completedAt: typeof value.completedAt === 'string' ? value.completedAt : null,
        updatedAt: typeof value.updatedAt === 'string' && Number.isFinite(Date.parse(value.updatedAt)) ? value.updatedAt : new Date(0).toISOString(),
      };
    }
    return result;
  } catch { return {}; }
}

export function writeArchiveProgress(userId: string | null, progress: ArchiveProgressMap): boolean {
  try { localStorage.setItem(storageKey(userId), JSON.stringify(progress)); return true; }
  catch { return false; }
}

export async function loadAccountArchiveProgress(userId: string): Promise<ArchiveProgressMap> {
  if (!supabase) return {};
  const { data, error } = await supabase.from('exam_archive_progress')
    .select('collection_id,saved,answers,current_index,completed_at,updated_at').eq('user_id', userId);
  if (error) throw error;
  const result: ArchiveProgressMap = {};
  for (const row of data ?? []) {
    if (!validIds.has(row.collection_id)) continue;
    result[row.collection_id] = {
      saved: Boolean(row.saved),
      answers: safeAnswers(row.answers),
      currentIndex: row.current_index,
      completedAt: row.completed_at,
      updatedAt: row.updated_at,
    };
  }
  return result;
}

/** Serializes writes per exam, so a slower older response cannot overwrite newer work. */
export function queueAccountArchiveSave(userId: string, collectionId: string, progress: ArchiveProgress): Promise<void> {
  const client = supabase;
  if (!client) return Promise.resolve();
  const key = `${userId}:${collectionId}`;
  const previous = pending.get(key) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(async () => {
    const { error } = await client.from('exam_archive_progress').upsert({
      user_id: userId, collection_id: collectionId, saved: progress.saved,
      answers: progress.answers, current_index: progress.currentIndex,
      completed_at: progress.completedAt, updated_at: progress.updatedAt,
    }, { onConflict: 'user_id,collection_id' });
    if (error) throw error;
  });
  pending.set(key, next);
  void next.finally(() => { if (pending.get(key) === next) pending.delete(key); }).catch(() => {});
  return next;
}
