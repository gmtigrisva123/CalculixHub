/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Offline connectivity state and the deferred grading queue.
 */

import { useEffect, useState } from 'react';
import { apiFetch } from './apiBase';

const QUEUE_KEY = 'calculix_pending_grades';

/** A grading request captured while offline, awaiting replay. */
export interface QueuedGrade {
  id: string;
  problemId: string;
  answer: string;
  /** Epoch ms, so a replayed grade can be attributed to when it was submitted. */
  submittedAt: number;
}

/**
 * Tracks connectivity.
 *
 * navigator.onLine is the only synchronous signal available, and it is
 * famously optimistic: it reports true for a connected interface even when that
 * interface reaches nothing. It is accurate about the transition that matters
 * here -- going offline -- so it drives the banner, while the grading queue
 * additionally treats any failed request as evidence of being offline.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}

function readQueue(): QueuedGrade[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedGrade[]) : [];
  } catch {
    // A corrupt queue must not brick the app. Drop it and carry on.
    return [];
  }
}

function writeQueue(queue: QueuedGrade[]): void {
  if (queue.length === 0) {
    localStorage.removeItem(QUEUE_KEY);
    return;
  }
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/** Number of grades waiting to be sent. Drives the queued-count in the banner. */
export function pendingGradeCount(): number {
  return readQueue().length;
}

/**
 * Grade an answer without the network.
 *
 * This is not a weaker approximation of server grading: server.ts decides
 * correctness with exactly this comparison (trimmed, lower-cased equality
 * against correctAnswer) and calls Gemini only to word the explanation. The
 * item bank reaches the client with correctAnswer intact, so an offline verdict
 * is as authoritative as an online one.
 *
 * What is genuinely lost offline is the personalised explanation, which is why
 * the attempt is still queued for replay.
 */
export function gradeLocally(userAnswer: string, correctAnswer: string): boolean {
  return userAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
}

/**
 * Defer a grading request until connectivity returns.
 *
 * Stored in localStorage rather than memory so that closing the app -- or iOS
 * evicting the WebView, which it does aggressively in the background -- does not
 * discard work the learner has already done.
 */
export function queueGrade(problemId: string, answer: string): QueuedGrade {
  const entry: QueuedGrade = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    problemId,
    answer,
    submittedAt: Date.now(),
  };

  writeQueue([...readQueue(), entry]);
  return entry;
}

/**
 * Replay queued grades against the backend.
 *
 * Entries are removed only on a definitive outcome. A network failure leaves
 * the entry queued for the next attempt; a 4xx drops it, because a request the
 * server rejects as malformed will be rejected identically forever and would
 * otherwise be retried on every reconnect for the life of the install.
 *
 * @returns how many entries were successfully graded.
 */
export async function flushGradeQueue(): Promise<number> {
  const queue = readQueue();
  if (queue.length === 0) return 0;

  const remaining: QueuedGrade[] = [];
  let flushed = 0;

  for (const entry of queue) {
    try {
      const response = await apiFetch('/api/evaluate', {
        method: 'POST',
        // Field name matches the server contract in server.ts (`userAnswer`).
        body: JSON.stringify({
          problemId: entry.problemId,
          userAnswer: entry.answer,
        }),
      });

      if (response.ok) {
        flushed += 1;
        continue;
      }

      // Server understood and refused. Retrying cannot change that.
      if (response.status >= 400 && response.status < 500) {
        console.warn(
          `[CalculixHub] Dropping queued grade ${entry.id}: server responded ${response.status}.`,
        );
        continue;
      }

      // 5xx: transient. Keep for the next attempt.
      remaining.push(entry);
    } catch {
      // Still offline, or the request never left. Keep everything after this
      // point queued rather than hammering a connection that is not there.
      remaining.push(entry);
    }
  }

  writeQueue(remaining);
  return flushed;
}

/**
 * Flush the queue whenever connectivity returns.
 *
 * Also attempts once on mount, which covers the common case of the app being
 * reopened already online after having been closed offline -- no 'online' event
 * fires in that situation because the transition happened while nothing was
 * listening.
 */
export function useGradeQueueFlush(online: boolean): number {
  const [pending, setPending] = useState(() => pendingGradeCount());

  useEffect(() => {
    let cancelled = false;

    if (!online) {
      setPending(pendingGradeCount());
      return;
    }

    void flushGradeQueue().then(() => {
      if (!cancelled) setPending(pendingGradeCount());
    });

    return () => {
      cancelled = true;
    };
  }, [online]);

  return pending;
}
