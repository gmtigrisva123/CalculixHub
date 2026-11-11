/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * What the tutor remembers on this device: how the learner likes to be helped,
 * and the conversation they were in the middle of.
 *
 * Both live in localStorage under `calculix_` names, so "Forget this device"
 * in Settings clears them with everything else.
 */

import { useEffect, useState } from 'react';
import { TUTOR_KEY_EVENT, connectedModel, readStoredGeminiKey } from './geminiClient';

/* --------------------------------------------------------------------------
 * How much help to give
 * ------------------------------------------------------------------------ */

export type CoachingStyle = 'nudge' | 'guide' | 'solve';

export const COACHING_STYLES: readonly { value: CoachingStyle; label: string; note: string; instruction: string }[] = [
  {
    value: 'nudge',
    label: 'Nudge',
    note: 'One small hint, then it waits for you',
    instruction: 'Give exactly one small hint, two sentences at most, that moves the learner one step forward. Never state the final answer or carry out the next step for them. End by asking what they see now.',
  },
  {
    value: 'guide',
    label: 'Guide',
    note: 'Questions that lead you to the idea',
    instruction: 'Teach by the Socratic method. Draw the next step out of the learner with a question rather than handing over the answer, and confirm what they got right before moving on.',
  },
  {
    value: 'solve',
    label: 'Full solution',
    note: 'A complete worked answer, step by step',
    instruction: 'Give a complete worked solution in numbered steps, with the reason for each step, then state the final answer on its own line. Finish with one sentence on how to recognise this kind of problem next time.',
  },
];

const STYLE_KEY = 'calculix_tutor_style';
const REMEMBER_KEY = 'calculix_tutor_remember';
const CHAT_KEY = 'calculix_tutor_chat';
const PREFS_EVENT = 'calculix:tutor-prefs';

const read = (key: string): string | null => {
  try { return localStorage.getItem(key); } catch { return null; }
};
const write = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch { /* storage is unavailable; the preference lasts for this visit only */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(PREFS_EVENT));
};

export const readCoachingStyle = (): CoachingStyle => {
  const stored = read(STYLE_KEY);
  return COACHING_STYLES.some(style => style.value === stored) ? (stored as CoachingStyle) : 'guide';
};
export const storeCoachingStyle = (style: CoachingStyle) => write(STYLE_KEY, style);

/** On unless the learner has switched it off. */
export const remembersChats = (): boolean => read(REMEMBER_KEY) !== 'off';
export function storeRemembersChats(on: boolean) {
  if (!on) forgetAllChats();
  write(REMEMBER_KEY, on ? null : 'off');
}

const BASE_INSTRUCTION =
  'You are the CalculixHub tutor: a warm but rigorous mathematics teacher for a secondary-school student preparing for competitions. Write clear English with academic substance, and set all mathematics in LaTeX between dollar signs ($x^2$, $\\frac{a}{b}$). Be concise and precise. Do not open with praise or filler.';

export const tutorInstruction = (style: CoachingStyle) =>
  `${BASE_INSTRUCTION} ${COACHING_STYLES.find(item => item.value === style)?.instruction ?? ''}`;

/** The same request for the shared tutor, which takes no separate instruction. */
export const styleNote = (style: CoachingStyle) =>
  style === 'guide' ? '' : `[How to help: ${COACHING_STYLES.find(item => item.value === style)?.instruction}]\n\n`;

/* --------------------------------------------------------------------------
 * The conversation
 * ------------------------------------------------------------------------ */

export interface TutorMessage {
  id: string;
  sender: 'user' | 'tutor';
  text: string;
  /** Milliseconds since the epoch. */
  at: number;
  /** Shown in place of `text` when the message is a long prompt written by the app, not the learner. */
  label?: string;
  /** `canned` is a ready-made reply, `error` a failure worth acting on. Both stay out of what the model is sent. */
  kind?: 'canned' | 'error';
}

const KEPT = 60;
const chatKey = (owner: string) => `${CHAT_KEY}:${owner}`;

export function readChat(owner: string): TutorMessage[] {
  if (!remembersChats()) return [];
  try {
    const stored = JSON.parse(read(chatKey(owner)) ?? '[]');
    if (!Array.isArray(stored)) return [];
    return stored.filter((item): item is TutorMessage =>
      item && typeof item.id === 'string' && typeof item.text === 'string' && typeof item.at === 'number' && (item.sender === 'user' || item.sender === 'tutor'));
  } catch {
    return [];
  }
}

export function storeChat(owner: string, messages: readonly TutorMessage[]) {
  try {
    if (!remembersChats() || messages.length === 0) localStorage.removeItem(chatKey(owner));
    else localStorage.setItem(chatKey(owner), JSON.stringify(messages.slice(-KEPT)));
  } catch { /* over quota or unavailable: the conversation simply is not kept */ }
}

export function forgetAllChats() {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith(`${CHAT_KEY}:`)) localStorage.removeItem(key);
  } catch { /* nothing to forget */ }
}

/* --------------------------------------------------------------------------
 * Hooks
 * ------------------------------------------------------------------------ */

export interface TutorKeyState {
  key: string;
  /** The model that last answered with this key; null until it has worked once. */
  model: string | null;
}

const keyState = (): TutorKeyState => ({ key: readStoredGeminiKey(), model: connectedModel() });

/** The saved key and whether it has worked, kept in step across the panel, Settings and other tabs. */
export function useTutorKey(): TutorKeyState {
  const [state, setState] = useState<TutorKeyState>(keyState);
  useEffect(() => {
    const sync = () => setState(previous => {
      const next = keyState();
      return previous.key === next.key && previous.model === next.model ? previous : next;
    });
    sync();
    window.addEventListener(TUTOR_KEY_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(TUTOR_KEY_EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);
  return state;
}

export function useTutorPrefs(): { style: CoachingStyle; remember: boolean } {
  const [prefs, setPrefs] = useState(() => ({ style: readCoachingStyle(), remember: remembersChats() }));
  useEffect(() => {
    const sync = () => setPrefs({ style: readCoachingStyle(), remember: remembersChats() });
    window.addEventListener(PREFS_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(PREFS_EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);
  return prefs;
}
