/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, type CSSProperties } from 'react';
import { m } from 'motion/react';
import { Bell, Check, Command, Download, Eraser, FileJson, Flag, KeyRound, LogOut, Mail, Monitor, Moon, Palette, RotateCcw, Save, ShieldAlert, Sparkles, Sun, Target, Timer, Trash2, UserRound, type LucideIcon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { reminderHour } from '../platform/reminders';
import type { ThemePreference } from '../lib/theme';
import { COACHING_STYLES, storeCoachingStyle, storeRemembersChats, useTutorKey, useTutorPrefs } from '../lib/tutor';
import TutorConnect from './tutor/TutorConnect';
import { useAuth } from '../context/AuthContext';
import MathText from './MathText';
import UserAvatar from './UserAvatar';
import { clearLocalData, deleteMyAccount, downloadJson, exportMyData, resetMyProgress, signOutEverywhere, updateProfile, type AccountResult } from '../services/data/account';
import '../styles/settings.css';
import '../styles/settings-account.css';

export type SaveOutcome = 'saved' | 'guest' | 'error';

interface SettingsProps {
  customGoal: string;
  studyPace: string;
  /** Goal and pace save as they are chosen; there is no separate save step. */
  onChangePreferences: (next: { goal: string; pace: string }) => Promise<SaveOutcome>;
  studyReminders: boolean;
  /** `hour` is the hour of the day, 0 to 23, the reminder should arrive at. */
  onToggleReminders: (enabled: boolean, hour?: number) => void;
  reminderNotice: string | null;
  onLogout: () => void;
  /** Called after the practice record has been cleared, so every figure on screen is re-read. */
  onProgressReset: () => void;
}

type Vars = CSSProperties & Record<`--${string}`, string | number>;

/*
 * The stored values are the full sentences; the short names are for display.
 * Listed in the order the competitions actually climb, so the staircase is
 * true: fundamentals, then AMC, then AIME, then the olympiad.
 */
const GOALS = [
  { value: 'Build fundamental mathematical problem-solving skills', short: 'Foundations', note: 'Problem-solving habits' },
  { value: 'Qualify for AMC 8 / AMC 10', short: 'AMC 8 / 10', note: 'First contest' },
  { value: 'Qualify for AIME', short: 'AIME', note: 'Invitational' },
  { value: 'Qualify for USAMO / National Olympiad', short: 'USAMO', note: 'National olympiad' },
];

const PACES = [
  { value: '15 minutes / day (Casual)', minutes: 15, tag: 'Casual' },
  { value: '30 minutes / day (Recommended)', minutes: 30, tag: 'Recommended' },
  { value: '60 minutes / day (Intensive)', minutes: 60, tag: 'Intensive' },
];

const THEMES: Array<{ value: ThemePreference; label: string; hint: string; Icon: typeof Sun }> = [
  { value: 'light', label: 'Day', hint: 'Always the daylight theme', Icon: Sun },
  { value: 'system', label: 'Auto', hint: 'Follows your device', Icon: Monitor },
  { value: 'dark', label: 'Night', hint: 'Always the lamplight theme', Icon: Moon },
];

/*
 * Three groups, by what a setting belongs to: how you study, how this device
 * shows and runs the app, and the account itself. The order inside the last
 * one runs from the everyday to the irreversible, so the destructive actions
 * are the final thing on the page and never sit next to a routine one.
 */
const GROUPS: readonly { id: string; label: string; items: readonly { id: string; label: string; Icon: LucideIcon }[] }[] = [
  { id: 'study', label: 'Study', items: [
    { id: 'goal', label: 'Goal', Icon: Target },
    { id: 'pace', label: 'Daily pace', Icon: Timer },
    { id: 'reminders', label: 'Reminders', Icon: Bell },
  ] },
  { id: 'device', label: 'This device', items: [
    { id: 'appearance', label: 'Appearance', Icon: Palette },
    { id: 'tutor', label: 'Live tutor', Icon: Sparkles },
    { id: 'shortcuts', label: 'Shortcuts', Icon: Command },
  ] },
  { id: 'account', label: 'Account', items: [
    { id: 'account', label: 'Profile & sign-in', Icon: UserRound },
    { id: 'data', label: 'Your data', Icon: Download },
    { id: 'danger', label: 'Danger zone', Icon: ShieldAlert },
  ] },
];
const SECTIONS = GROUPS.flatMap(group => group.items);

/* The hours a school day leaves free, morning to late evening. */
const REMINDER_HOURS = [7, 12, 16, 17, 18, 19, 20, 21];
const hourLabel = (hour: number) => new Date(2000, 0, 1, hour).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/* Every key the workspace listens for, so none of them has to be discovered by accident. */
const SHORTCUTS: readonly { id: string; keys: readonly string[]; then?: boolean; does: string }[] = [
  { id: 'search', keys: ['Ctrl', 'K'], does: 'Search, or jump to any page' },
  { id: 'goto', keys: ['G', 'L'], then: true, does: 'Go to Learn. H is Home, P is Progress, A is Arena, R is the leaderboard' },
  { id: 'scratch', keys: ['S'], does: 'Open or close scratch paper' },
  { id: 'rail', keys: ['['], does: 'Fold or unfold the side rail' },
  { id: 'send', keys: ['Enter'], does: 'Send a message to the tutor' },
  { id: 'newline', keys: ['Shift', 'Enter'], does: 'New line in a message' },
  { id: 'close', keys: ['Esc'], does: 'Close whatever is open on top' },
];

/* The keyboard drawn beside the list: four rows, each key with the width a real one has. */
const KEY_ROWS: readonly (readonly [label: string, width?: number])[][] = [
  [['Esc', 1.4], ['Q'], ['W'], ['E'], ['R'], ['T'], ['Y'], ['U'], ['I'], ['O'], ['P'], ['[']],
  [['Ctrl', 1.7], ['A'], ['S'], ['D'], ['F'], ['G'], ['H'], ['J'], ['K'], ['L'], ['Enter', 1.7]],
  [['Shift', 2.2], ['Z'], ['X'], ['C'], ['V'], ['B'], ['N'], ['M'], [',', 1], ['.', 1], ['', 1.2]],
];

/* One question, answered three ways, so the choice of help can be seen before it is made. */
const SAMPLE_QUESTION = 'How do I find the last two digits of $7^{2024}$?';
const SAMPLE_REPLY: Record<string, string> = {
  nudge: 'Try the first few powers of $7$ modulo $100$. What do you notice by the fourth?',
  guide: 'Last two digits means working modulo $100$. What are $7^1$, $7^2$, $7^3$ and $7^4$ there? Once you have them, what does $7^4$ tell you about $7^{2024}$?',
  solve: '**1.** Work modulo $100$: $7^2 = 49$ and $7^4 = 2401 \\equiv 1$.\n**2.** Since $2024 = 4 \\cdot 506$, we get $7^{2024} = (7^4)^{506} \\equiv 1$.\n**3.** The last two digits are $01$.',
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const minutesOf = (pace: string) => PACES.find(p => p.value === pace)?.minutes ?? (Number(pace.match(/\d+/)?.[0]) || 30);
const duration = (minutes: number) => {
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  return hours ? `${hours} h${rest ? ` ${rest} min` : ''}` : `${rest} min`;
};

/* The share of an hour a pace takes, drawn as a slice of a clock face. */
function MinuteDial({ minutes }: { minutes: number }) {
  const angle = (minutes / 60) * 2 * Math.PI;
  const x = 32 + 24 * Math.sin(angle), y = 32 - 24 * Math.cos(angle);
  const slice = minutes >= 60 ? 'M32 8 A24 24 0 1 1 31.99 8 Z' : `M32 32 L32 8 A24 24 0 ${minutes > 30 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`;
  return (
    <svg className="se-dial" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="29" className="se-dial-face" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * 30 * Math.PI) / 180;
        return <line key={i} x1={32 + 26 * Math.sin(a)} y1={32 - 26 * Math.cos(a)} x2={32 + (i % 3 ? 28 : 29.5) * Math.sin(a)} y2={32 - (i % 3 ? 28 : 29.5) * Math.cos(a)} className="se-dial-tick" />;
      })}
      <path d={slice} className="se-dial-slice" />
      <circle cx="32" cy="32" r="2.5" className="se-dial-pin" />
    </svg>
  );
}

/* Goal and pace save themselves; this says so, in the corner of the card. */
function SaveNote({ state }: { state: 'idle' | 'saving' | SaveOutcome }) {
  if (state === 'idle') return null;
  const text = { saving: 'Saving…', saved: 'Saved', guest: 'Sign in to keep this', error: 'Not saved. Try again' }[state];
  return <span className={`se-key-state is-${state === 'saved' ? 'verified' : state === 'error' ? 'error' : 'saved'}`} role="status">{state === 'saved' && <Check size={11} strokeWidth={3} aria-hidden="true" />}{text}</span>;
}

/* --------------------------------------------------------------------------
 * A confirmation that has to be typed
 * ------------------------------------------------------------------------ */

interface ConfirmProps {
  open: boolean;
  title: string;
  /** What will happen, in the order it matters. */
  consequences: readonly string[];
  /** The exact text to type. Omitted for actions that are safe to undo by hand. */
  phrase?: string;
  action: string;
  busyAction: string;
  onConfirm: () => Promise<AccountResult>;
  onClose: () => void;
}

function ConfirmDialog({ open, title, consequences, phrase, action, busyAction, onConfirm, onClose }: ConfirmProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) { setTyped(''); setError(null); node.showModal(); }
    else if (!open && node.open) node.close();
  }, [open]);

  const matches = !phrase || typed.trim().toLowerCase() === phrase.toLowerCase();
  const dismiss = () => { if (!busy) onClose(); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!matches || busy) return;
    setBusy(true);
    setError(null);
    const result = await onConfirm();
    setBusy(false);
    if (result.ok) onClose();
    else setError(result.error);
  };

  return (
    <dialog ref={dialog} className="se-confirm" aria-labelledby="se-confirm-title" aria-busy={busy}
      onCancel={event => { event.preventDefault(); dismiss(); }}
      onClick={event => { if (event.target === dialog.current) dismiss(); }}>
      <form onSubmit={submit}>
        <span className="se-confirm-mark" aria-hidden="true"><ShieldAlert size={20} /></span>
        <h2 id="se-confirm-title">{title}</h2>
        <ul>{consequences.map(line => <li key={line}>{line}</li>)}</ul>
        {phrase && (
          <label className="se-confirm-field">
            <span>Type <b>{phrase}</b> to confirm</span>
            <input value={typed} onChange={event => setTyped(event.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} disabled={busy} />
          </label>
        )}
        {error && <p className="se-notice is-error" role="alert">{error}</p>}
        <div className="se-confirm-actions">
          <button type="button" className="se-btn is-quiet" onClick={dismiss} disabled={busy}>Keep everything</button>
          <button type="submit" className="se-btn is-destructive" disabled={!matches || busy}>{busy ? busyAction : action}</button>
        </div>
      </form>
    </dialog>
  );
}

export default function Settings({
  customGoal,
  studyPace,
  onChangePreferences,
  studyReminders,
  onToggleReminders,
  reminderNotice,
  onLogout,
  onProgressReset,
}: SettingsProps) {
  const { user, profile, refreshProfile, requestPasswordReset } = useAuth();
  const [saveState, setSaveState] = useState<'idle' | 'saving' | SaveOutcome>('idle');
  const [edit, setEdit] = useState({ displayName: '', bio: '', country: '' });
  const [profileNotice, setProfileNotice] = useState<{ text: string; success: boolean } | null>(null);
  const [accountNotice, setAccountNotice] = useState<{ text: string; success: boolean } | null>(null);
  const [dataNotice, setDataNotice] = useState<{ text: string; success: boolean } | null>(null);
  const [working, setWorking] = useState<'profile' | 'reset-link' | 'everywhere' | 'export' | null>(null);
  const [confirming, setConfirming] = useState<'reset' | 'delete' | 'device' | null>(null);
  const [hour, setHour] = useState<number>(reminderHour);
  const [lit, setLit] = useState<string>('search');
  const [active, setActive] = useState<string>('goal');
  const { preference, resolved, setPreference } = useTheme();
  const tutorKey = useTutorKey();
  const tutorPrefs = useTutorPrefs();
  const keyState = tutorKey.key ? (tutorKey.model ? 'verified' : 'saved') : 'none';
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  const chooseHour = (next: number) => {
    setHour(next);
    // Already on: move the reminder. Off: remembered for when it is switched on.
    if (studyReminders) onToggleReminders(true, next);
  };

  // The form follows the profile, including after a save refreshes it.
  useEffect(() => {
    setEdit({ displayName: profile?.display_name ?? '', bio: profile?.bio ?? '', country: profile?.country ?? '' });
  }, [profile?.display_name, profile?.bio, profile?.country]);

  const changePreferences = async (next: { goal: string; pace: string }) => {
    setSaveState('saving');
    setSaveState(await onChangePreferences(next));
  };

  const profileDirty = Boolean(profile) && (edit.displayName !== (profile?.display_name ?? '') || edit.bio !== (profile?.bio ?? '') || edit.country !== (profile?.country ?? ''));
  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile || !profileDirty) return;
    setWorking('profile');
    const result = await updateProfile(profile.id, edit);
    if (result.ok) await refreshProfile();
    setWorking(null);
    setProfileNotice(result.ok ? { text: 'Profile saved.', success: true } : { text: result.error, success: false });
  };

  const sendResetLink = async () => {
    if (!user?.email) return;
    setWorking('reset-link');
    const result = await requestPasswordReset(user.email);
    setWorking(null);
    setAccountNotice(result.ok ? { text: `A link to set a new password is on its way to ${user.email}.`, success: true } : { text: result.error ?? 'Could not send the link. Please try again.', success: false });
  };

  const leaveEverywhere = async () => {
    setWorking('everywhere');
    const result = await signOutEverywhere();
    setWorking(null);
    if (result.ok) onLogout();
    else setAccountNotice({ text: result.error, success: false });
  };

  const downloadData = async () => {
    if (!user) return;
    setWorking('export');
    const data = await exportMyData(user.id, user.email ?? null);
    setWorking(null);
    if (!data) { setDataNotice({ text: 'Could not gather your data. Please try again.', success: false }); return; }
    downloadJson(`calculixhub-${profile?.username ?? 'my'}-data-${data.exported_at.slice(0, 10)}.json`, data);
    setDataNotice({ text: 'Your data has been downloaded as a JSON file.', success: true });
  };

  const confirmReset = async (): Promise<AccountResult> => {
    const result = await resetMyProgress();
    if (result.ok) { onProgressReset(); setDataNotice(null); setAccountNotice({ text: 'Your practice record has been cleared. You are starting fresh.', success: true }); }
    return result;
  };
  const confirmDelete = async (): Promise<AccountResult> => {
    const result = await deleteMyAccount();
    // Nothing of the session survives, so the page is reloaded rather than patched.
    if (result.ok) window.location.assign('/?home=1');
    return result;
  };
  const confirmDevice = async (): Promise<AccountResult> => {
    clearLocalData();
    window.location.reload();
    return { ok: true };
  };

  // Light up the section being read in the index.
  useEffect(() => {
    if (typeof IntersectionObserver !== 'function') return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible) setActive(visible.target.id.replace('se-', ''));
    }, { rootMargin: '-25% 0px -55% 0px' });
    SECTIONS.forEach(({ id }) => { const node = document.getElementById(`se-${id}`); if (node) observer.observe(node); });
    return () => observer.disconnect();
  }, []);

  const goalIndex = GOALS.findIndex(g => g.value === customGoal);
  const goal = GOALS[goalIndex];
  const minutes = minutesOf(studyPace);
  const reminderTime = hourLabel(hour);
  const tierOfGoal = goal?.short ?? 'Custom';
  const now: Record<string, string> = {
    goal: tierOfGoal,
    pace: `${minutes} min`,
    reminders: studyReminders ? reminderTime : 'Off',
    appearance: THEMES.find(theme => theme.value === preference)?.label ?? '',
    tutor: keyState === 'verified' ? 'On' : 'Off',
  };
  const today = (new Date().getDay() + 6) % 7;
  const litKeys = SHORTCUTS.find(shortcut => shortcut.id === lit)?.keys ?? [];
  const jump = (id: string) => { setActive(id); document.getElementById(`se-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const chooseTheme = (value: ThemePreference) => (event: React.MouseEvent<HTMLButtonElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    setPreference(value, { x: box.left + box.width / 2, y: box.top + box.height / 2 });
  };

  return (
    <div className="settings-page">
      <header className="se-hero">
        <div className="se-hero-copy">
          <p className="se-eyebrow"><span aria-hidden="true" />Make this space yours</p>
          <h1>A rhythm that works <em>for you.</em></h1>
          <p className="se-summary">
            Aiming for <b>{goal?.short ?? customGoal}</b>, <b>{minutes} minutes</b> a day{studyReminders ? <>, with a reminder at <b>{reminderTime}</b></> : <>, no reminders</>}.
          </p>
        </div>
        <figure className="se-rhythm" aria-label={`${duration(minutes * 7)} of practice a week`}>
          <div className="se-rhythm-bars" aria-hidden="true">
            {DAYS.map((day, index) => (
              <div key={day} className={`se-beat${index === today ? ' is-today' : ''}`} style={{ '--fill': minutes / 60, '--i': index } as Vars}>
                <span className="se-beat-track"><span className="se-beat-fill" />{studyReminders && <i className="se-beat-bell" />}</span>
                <small>{day}</small>
              </div>
            ))}
          </div>
          <figcaption><strong>{duration(minutes * 7)}</strong><span>of practice a week</span></figcaption>
        </figure>
      </header>

      <div className="se-body">
        <nav className="se-index" aria-label="Settings sections">
          {GROUPS.map(group => (
            <React.Fragment key={group.id}>
              <p className="se-index-label">{group.label}</p>
              {group.items.map(({ id, label, Icon }) => (
                <button key={id} type="button" className={id === 'danger' ? 'is-danger' : undefined} aria-current={active === id ? 'true' : undefined} onClick={() => jump(id)}><Icon size={16} /><span>{label}</span>{now[id] && <small>{now[id]}</small>}</button>
              ))}
            </React.Fragment>
          ))}
        </nav>

        <div className="se-sections">
          <p className="se-group">Study</p>
          <section id="se-goal" className="se-card" aria-labelledby="se-goal-title">
            <div className="se-card-head">
              <span className="se-card-icon" aria-hidden="true"><Target size={18} /></span>
              <div><h2 id="se-goal-title">Where you are headed</h2><p>Your target competition shapes the problems Learn puts in front of you.</p></div>
              <SaveNote state={saveState} />
            </div>
            <fieldset className="se-ascent">
              <legend className="se-sr">Target competition goal</legend>
              {GOALS.map((g, index) => (
                <label key={g.value} className={`se-step${index === goalIndex ? ' is-chosen' : index < goalIndex ? ' is-climbed' : ''}`} style={{ '--h': (index + 1) / GOALS.length } as Vars}>
                  <input type="radio" name="customGoal" value={g.value} checked={customGoal === g.value} onChange={(e) => void changePreferences({ goal: e.target.value, pace: studyPace })} />
                  <span className="se-step-column" aria-hidden="true">{index === goalIndex && <span className="se-step-flag"><Flag size={13} strokeWidth={2.4} /></span>}</span>
                  <span className="se-step-label"><b>{g.short}</b><small>{g.note}</small></span>
                </label>
              ))}
            </fieldset>
            <p className="se-chosen">{goal ? <><Check size={15} aria-hidden="true" /> {goal.value}</> : <>Current goal: {customGoal}. Choose a step above to change it.</>}</p>
          </section>

          <section id="se-pace" className="se-card" aria-labelledby="se-pace-title">
            <div className="se-card-head">
              <span className="se-card-icon" aria-hidden="true"><Timer size={18} /></span>
              <div><h2 id="se-pace-title">Daily practice pace</h2><p>How much of each day you want to give to practice.</p></div>
              <SaveNote state={saveState} />
            </div>
            <fieldset className="se-paces">
              <legend className="se-sr">Daily practice pace</legend>
              {PACES.map((pace) => (
                <label key={pace.value} className={`se-pace${studyPace === pace.value ? ' is-chosen' : ''}`}>
                  <input type="radio" name="studyPace" value={pace.value} checked={studyPace === pace.value} onChange={(e) => void changePreferences({ goal: customGoal, pace: e.target.value })} />
                  <MinuteDial minutes={pace.minutes} />
                  <span className="se-pace-text">
                    <b>{pace.minutes} min <small>a day</small></b>
                    <span className={`se-pace-tag${pace.tag === 'Recommended' ? ' is-recommended' : ''}`}>{pace.tag}</span>
                    <small>{duration(pace.minutes * 7)} a week</small>
                  </span>
                  <span className="se-radio-mark" aria-hidden="true"><Check size={12} strokeWidth={3} /></span>
                </label>
              ))}
            </fieldset>
          </section>

          <section id="se-reminders" className="se-card" aria-labelledby="se-reminders-title">
            <div className="se-card-head">
              <span className="se-card-icon" aria-hidden="true"><Bell size={18} /></span>
              <div><h2 id="se-reminders-title">Daily reminders</h2><p>A nudge each day to keep your problem-solving streak going.</p></div>
              <button type="button" role="switch" aria-checked={studyReminders} aria-labelledby="se-reminders-title" className="se-switch" onClick={() => onToggleReminders(!studyReminders, hour)}><span /></button>
            </div>
            <div className={`se-notification${studyReminders ? ' is-on' : ''}`} aria-hidden="true">
              <span className="se-notification-app">c<span>·</span></span>
              <div>
                <p className="se-notification-meta"><b>CalculixHub</b><span>{reminderTime}</span></p>
                <p className="se-notification-title">Keep your streak alive</p>
                <p className="se-notification-body">One problem is enough to hold today. Your weakest domain is waiting.</p>
              </div>
            </div>
            <div className="se-times" role="radiogroup" aria-label="Reminder time">
              {REMINDER_HOURS.map(option => (
                <button key={option} type="button" role="radio" aria-checked={hour === option} onClick={() => chooseHour(option)}>{hourLabel(option)}</button>
              ))}
            </div>
            <p className="se-hint">{studyReminders ? `On. You will be reminded every day at ${reminderTime}.` : `Off. Turn it on and your device will ask for permission once. It will arrive at ${reminderTime}.`}</p>
            {reminderNotice && <p className="se-notice is-warning" role="status">{reminderNotice}</p>}
          </section>

          <p className="se-group">This device</p>
          <section id="se-appearance" className="se-card" aria-labelledby="se-appearance-title">
            <div className="se-card-head">
              <span className="se-card-icon" aria-hidden="true"><Palette size={18} /></span>
              <div><h2 id="se-appearance-title">Appearance</h2><p>Applies straight away, on this device.</p></div>
            </div>
            <div className="se-themes" role="radiogroup" aria-labelledby="se-appearance-title">
              {THEMES.map(({ value, label, hint, Icon }) => (
                <button key={value} type="button" role="radio" aria-checked={preference === value} className={`se-theme is-${value}`} onClick={chooseTheme(value)}>
                  <span className="se-theme-preview" aria-hidden="true"><i /><i /><i /><i /></span>
                  <span className="se-theme-label"><Icon size={15} /> {label}{value === 'system' && <small>now {resolved === 'dark' ? 'Night' : 'Day'}</small>}</span>
                  <span className="se-theme-hint">{hint}</span>
                </button>
              ))}
            </div>
          </section>

          <section id="se-tutor" className="se-card" aria-labelledby="se-tutor-title">
            <div className="se-card-head">
              <span className="se-card-icon" aria-hidden="true"><Sparkles size={18} /></span>
              <div><h2 id="se-tutor-title">Live tutor</h2><p>The tutor answers with Google’s Gemini. Connect it once with a free key from your own Google account and it will work through your actual question, not a ready-made hint.</p></div>
              <span className={`se-key-state is-${keyState}`}>{keyState === 'verified' ? 'On' : keyState === 'saved' ? 'Not checked' : 'Off'}</span>
            </div>
            <TutorConnect />

            <div className="se-rows">
              <div className="se-row is-stacked">
                <div><b id="se-style-label">How much help it gives</b><p>You can change this for a single question from the tutor itself.</p></div>
                <div className="se-help">
                  <div className="se-choices" role="radiogroup" aria-labelledby="se-style-label">
                    {COACHING_STYLES.map(option => (
                      <button key={option.value} type="button" role="radio" aria-checked={tutorPrefs.style === option.value} onClick={() => storeCoachingStyle(option.value)}>
                        <b>{option.label}</b><small>{option.note}</small>
                      </button>
                    ))}
                  </div>
                  <figure className="se-sample" aria-label={`An example of a ${COACHING_STYLES.find(option => option.value === tutorPrefs.style)?.label} answer`}>
                    <figcaption>For example</figcaption>
                    <p className="se-sample-ask"><MathText text={SAMPLE_QUESTION} /></p>
                    <div className="se-sample-reply" key={tutorPrefs.style}><MathText text={SAMPLE_REPLY[tutorPrefs.style]} as="div" /></div>
                  </figure>
                </div>
              </div>
              <div className="se-row">
                <div><b id="se-remember-label">Pick up where you left off</b><p>Keeps your last conversation in this browser so it is still there tomorrow. Turning this off deletes what is saved.</p></div>
                <button type="button" role="switch" aria-checked={tutorPrefs.remember} aria-labelledby="se-remember-label" className="se-switch" onClick={() => storeRemembersChats(!tutorPrefs.remember)}><span /></button>
              </div>
            </div>
          </section>

          <section id="se-shortcuts" className="se-card" aria-labelledby="se-shortcuts-title">
            <div className="se-card-head">
              <span className="se-card-icon" aria-hidden="true"><Command size={18} /></span>
              <div><h2 id="se-shortcuts-title">Keyboard shortcuts</h2><p>For when your hands are already on the keys.</p></div>
            </div>
            <div className="se-keys">
              <dl className="se-shortcuts" onMouseLeave={() => setLit('search')}>
                {SHORTCUTS.map(shortcut => (
                  <div key={shortcut.id} className={lit === shortcut.id ? 'is-lit' : undefined} tabIndex={0} onMouseEnter={() => setLit(shortcut.id)} onFocus={() => setLit(shortcut.id)}>
                    <dt>{shortcut.keys.map((key, index) => (
                      <React.Fragment key={key}>{index > 0 && <i>{shortcut.then ? 'then' : '+'}</i>}<kbd>{key === 'Ctrl' && isMac ? '⌘' : key}</kbd></React.Fragment>
                    ))}</dt>
                    <dd>{shortcut.does}</dd>
                  </div>
                ))}
              </dl>
              <div className="se-board" aria-hidden="true">
                {KEY_ROWS.map((row, index) => (
                  <div key={index} style={{ '--inset': index * 0.35 } as Vars}>
                    {row.map(([label, width = 1], column) => {
                      const order = litKeys.indexOf(label);
                      return <span key={column} className={label && order >= 0 ? 'is-lit' : undefined} style={{ '--w': width, '--o': Math.max(order, 0) } as Vars}>{label === 'Ctrl' && isMac ? '⌘' : label}</span>;
                    })}
                  </div>
                ))}
                <div style={{ '--inset': 1.05 } as Vars}><span style={{ '--w': 1.6 } as Vars} /><span style={{ '--w': 6.4 } as Vars} /><span style={{ '--w': 1.6 } as Vars} /></div>
              </div>
            </div>
          </section>

          <p className="se-group">Account</p>
          <section id="se-account" className="se-card" aria-labelledby="se-account-title">
            <div className="se-card-head">
              <span className="se-card-icon" aria-hidden="true"><UserRound size={18} /></span>
              <div><h2 id="se-account-title">Profile &amp; sign-in</h2><p>How you appear to other learners, and how you get in.</p></div>
            </div>
            {profile && user ? (
              <>
                <div className="se-identity">
                  <span className="se-identity-face"><UserAvatar src={profile.avatar_url} /></span>
                  <div><b>{profile.display_name}</b><span>@{profile.username}</span></div>
                  <span className="se-identity-mail"><Mail size={14} aria-hidden="true" />{user.email ?? 'No email on file'}</span>
                </div>
                <form className="se-fields" onSubmit={saveProfile}>
                  <label className="se-field"><span>Name</span><input value={edit.displayName} maxLength={60} onChange={event => { setEdit({ ...edit, displayName: event.target.value }); setProfileNotice(null); }} autoComplete="name" /></label>
                  <label className="se-field"><span>Country <small>optional</small></span><input value={edit.country} maxLength={56} onChange={event => { setEdit({ ...edit, country: event.target.value }); setProfileNotice(null); }} autoComplete="country-name" /></label>
                  <label className="se-field is-wide"><span>Bio <small>{280 - edit.bio.length} left</small></span><textarea value={edit.bio} maxLength={280} rows={2} onChange={event => { setEdit({ ...edit, bio: event.target.value }); setProfileNotice(null); }} placeholder="What are you working toward?" /></label>
                  <div className="se-fields-foot">
                    <m.button type="submit" whileTap={{ scale: 0.96 }} className="se-btn is-primary" disabled={!profileDirty || working === 'profile'}><Save size={15} /> {working === 'profile' ? 'Saving…' : 'Save profile'}</m.button>
                    {profileNotice && <span className={profileNotice.success ? 'is-ok' : 'is-error'} role="status">{profileNotice.text}</span>}
                  </div>
                </form>
                <div className="se-rows">
                  <div className="se-row">
                    <span className="se-row-mark" aria-hidden="true"><KeyRound size={16} /></span><div><b>Password</b><p>We’ll email you a link to choose a new one.</p></div>
                    <m.button type="button" whileTap={{ scale: 0.96 }} className="se-btn is-quiet" onClick={sendResetLink} disabled={!user.email || working === 'reset-link'}><KeyRound size={15} /> {working === 'reset-link' ? 'Sending…' : 'Email a reset link'}</m.button>
                  </div>
                  <div className="se-row">
                    <span className="se-row-mark" aria-hidden="true"><LogOut size={16} /></span><div><b>Sign out</b><p>Of this browser, or of every device at once if one has gone missing.</p></div>
                    <div className="se-row-actions">
                      <m.button type="button" whileTap={{ scale: 0.96 }} className="se-btn is-quiet" onClick={onLogout}><LogOut size={15} /> Sign out</m.button>
                      <m.button type="button" whileTap={{ scale: 0.96 }} className="se-btn is-quiet" onClick={leaveEverywhere} disabled={working === 'everywhere'}>{working === 'everywhere' ? 'Signing out…' : 'Everywhere'}</m.button>
                    </div>
                  </div>
                </div>
                {accountNotice && <p className={`se-notice ${accountNotice.success ? 'is-ok' : 'is-error'}`} role="status">{accountNotice.text}</p>}
              </>
            ) : (
              <div className="se-guest">
                <p>You’re exploring as a guest, so there is no account to manage yet.</p>
                <a className="se-btn is-primary" href="/?auth=signup">Create a free account</a>
              </div>
            )}
          </section>

          <section id="se-data" className="se-card" aria-labelledby="se-data-title">
            <div className="se-card-head">
              <span className="se-card-icon" aria-hidden="true"><Download size={18} /></span>
              <div><h2 id="se-data-title">Your data</h2><p>It’s yours. Take a copy whenever you like.</p></div>
            </div>
            {user && (
              <div className="se-export" aria-hidden="true">
                <ul>{['Profile', 'Answers', 'Posts', 'Messages', 'Settings'].map((part, index) => <li key={part} style={{ '--i': index } as Vars}>{part}</li>)}</ul>
                <span className="se-export-flow" />
                <span className="se-export-file"><FileJson size={16} />calculixhub-{profile?.username ?? 'my'}-data.json</span>
              </div>
            )}
            <div className="se-rows">
              {user && (
                <div className="se-row">
                  <span className="se-row-mark" aria-hidden="true"><Download size={16} /></span><div><b>Download everything</b><p>Your profile, every answer you’ve given, posts, messages and settings, in one JSON file.</p></div>
                  <m.button type="button" whileTap={{ scale: 0.96 }} className="se-btn is-quiet" onClick={downloadData} disabled={working === 'export'}><Download size={15} /> {working === 'export' ? 'Gathering…' : 'Download my data'}</m.button>
                </div>
              )}
              <div className="se-row">
                <span className="se-row-mark" aria-hidden="true"><Eraser size={16} /></span><div><b>Forget this device</b><p>Clears what this browser remembers: theme, scratch paper, your contest date, tutor conversations and your tutor key. Your account is untouched.</p></div>
                <m.button type="button" whileTap={{ scale: 0.96 }} className="se-btn is-quiet" onClick={() => setConfirming('device')}><Eraser size={15} /> Clear this browser</m.button>
              </div>
            </div>
            {dataNotice && <p className={`se-notice ${dataNotice.success ? 'is-ok' : 'is-error'}`} role="status">{dataNotice.text}</p>}
          </section>

          {user && profile && (
            <section id="se-danger" className="se-card is-danger" aria-labelledby="se-danger-title">
              <div className="se-card-head">
                <span className="se-card-icon" aria-hidden="true"><ShieldAlert size={18} /></span>
                <div><h2 id="se-danger-title">Danger zone</h2><p>These can’t be undone. Each one asks you to type a word first, so nothing here happens by accident.</p></div>
              </div>
              <div className="se-rows">
                <div className="se-row">
                  <span className="se-row-mark" aria-hidden="true"><RotateCcw size={16} /></span><div><b>Reset my progress</b><p>Clears your answers, points, streak and topic mastery. Your account, posts and Arena results stay.</p></div>
                  <m.button type="button" whileTap={{ scale: 0.96 }} className="se-btn is-danger" onClick={() => setConfirming('reset')}><RotateCcw size={15} /> Reset progress</m.button>
                </div>
                <div className="se-row">
                  <span className="se-row-mark" aria-hidden="true"><Trash2 size={16} /></span><div><b>Delete my account</b><p>Removes your account and everything attached to it, for good. Download your data first if you want a copy.</p></div>
                  <m.button type="button" whileTap={{ scale: 0.96 }} className="se-btn is-destructive" onClick={() => setConfirming('delete')}><Trash2 size={15} /> Delete account</m.button>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      <ConfirmDialog open={confirming === 'reset'} title="Reset your progress?" phrase="reset" action="Reset my progress" busyAction="Resetting…" onConfirm={confirmReset} onClose={() => setConfirming(null)}
        consequences={['Every answer you have given is deleted.', 'Points, streak and topic mastery go back to zero, and you leave the leaderboard until you solve again.', 'Your account, posts, messages and Arena results are kept.']} />
      <ConfirmDialog open={confirming === 'delete'} title="Delete your account?" phrase={profile?.username ?? 'delete'} action="Delete my account" busyAction="Deleting…" onConfirm={confirmDelete} onClose={() => setConfirming(null)}
        consequences={['Your profile, progress, posts, comments and messages are permanently deleted.', 'Your username becomes available to someone else.', 'There is no way to bring any of it back.']} />
      <ConfirmDialog open={confirming === 'device'} title="Clear this browser?" action="Clear and reload" busyAction="Clearing…" onConfirm={confirmDevice} onClose={() => setConfirming(null)}
        consequences={['Theme, scratch paper, contest date, tutor conversations and your tutor key are removed from this browser.', 'Nothing in your account changes.']} />
    </div>
  );
}
