/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, type CSSProperties } from 'react';
import { m } from 'motion/react';
import { Bell, Check, Eye, EyeOff, Flag, KeyRound, Monitor, Moon, Palette, RefreshCw, Save, Sun, Target, Timer, Trash2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { reminderHour } from '../platform/reminders';
import type { ThemePreference } from '../lib/theme';
import { normalizeGeminiKey, readStoredGeminiKey, storeGeminiKey, testGeminiKey } from '../lib/geminiClient';
import '../styles/settings.css';

interface SettingsProps {
  customGoal: string;
  setCustomGoal: (goal: string) => void;
  studyPace: string;
  setStudyPace: (pace: string) => void;
  studyReminders: boolean;
  onToggleReminders: (enabled: boolean) => void;
  reminderNotice: string | null;
  onSaveSettings: (e: React.FormEvent) => void;
  saveSuccessNotify: boolean;
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

const SECTIONS = [
  { id: 'goal', label: 'Goal', Icon: Target },
  { id: 'pace', label: 'Daily pace', Icon: Timer },
  { id: 'reminders', label: 'Reminders', Icon: Bell },
  { id: 'appearance', label: 'Appearance', Icon: Palette },
  { id: 'tutor', label: 'AI tutor key', Icon: KeyRound },
] as const;

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

export default function Settings({
  customGoal,
  setCustomGoal,
  studyPace,
  setStudyPace,
  studyReminders,
  onToggleReminders,
  reminderNotice,
  onSaveSettings,
  saveSuccessNotify,
}: SettingsProps) {
  const [apiKey, setApiKey] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);
  const [testingKey, setTestingKey] = useState<boolean>(false);
  const [keyNotice, setKeyNotice] = useState<{ text: string; success: boolean } | null>(null);
  const [keyState, setKeyState] = useState<'none' | 'saved' | 'verified'>('none');
  const [touched, setTouched] = useState(false);
  const [active, setActive] = useState<string>('goal');
  const { preference, resolved, setPreference } = useTheme();

  useEffect(() => {
    const savedKey = readStoredGeminiKey();
    setApiKey(savedKey);
    setKeyState(savedKey ? 'saved' : 'none');
  }, []);

  // A successful save settles whatever was changed here.
  useEffect(() => { if (saveSuccessNotify) setTouched(false); }, [saveSuccessNotify]);

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

  const handleSaveApiKey = () => {
    const trimmed = normalizeGeminiKey(apiKey);
    storeGeminiKey(trimmed);
    setApiKey(trimmed);
    if (!trimmed) {
      setKeyState('none');
      setKeyNotice({ text: 'API Key removed. AI Assistant will use default engine.', success: true });
      return;
    }
    setKeyState('saved');
    setKeyNotice({ text: 'Gemini API Key saved. Press "Test" to verify it works.', success: true });
  };

  const handleTestApiKey = async () => {
    const trimmed = normalizeGeminiKey(apiKey);
    if (!trimmed) {
      setKeyNotice({ text: 'Please enter a Gemini API Key to test.', success: false });
      return;
    }

    setTestingKey(true);
    setKeyNotice(null);

    try {
      storeGeminiKey(trimmed);
      setApiKey(trimmed);
      const { model } = await testGeminiKey(trimmed);
      setKeyState('verified');
      setKeyNotice({ text: `API Key verified with ${model}. Live Gemini AI Tutor is ready.`, success: true });
    } catch (err: unknown) {
      setKeyState('saved');
      const errorMessage = err instanceof Error ? err.message : 'Network error';
      setKeyNotice({ text: `Connection failed: ${errorMessage}`, success: false });
    } finally {
      setTestingKey(false);
    }
  };

  const handleClearApiKey = () => {
    setApiKey('');
    storeGeminiKey('');
    setKeyState('none');
    setKeyNotice({ text: 'API Key cleared.', success: true });
  };

  const goalIndex = GOALS.findIndex(g => g.value === customGoal);
  const goal = GOALS[goalIndex];
  const minutes = minutesOf(studyPace);
  const reminderTime = new Date(2000, 0, 1, reminderHour()).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
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
              <div key={day} className="se-beat" style={{ '--fill': minutes / 60, '--i': index } as Vars}>
                <span className="se-beat-track"><span className="se-beat-fill" />{studyReminders && <i className="se-beat-bell" />}</span>
                <small>{day}</small>
              </div>
            ))}
          </div>
          <figcaption><strong>{duration(minutes * 7)}</strong><span>of practice a week</span></figcaption>
        </figure>
      </header>

      <form onSubmit={onSaveSettings} className="se-body">
        <nav className="se-index" aria-label="Settings sections">
          {SECTIONS.map(({ id, label, Icon }) => (
            <button key={id} type="button" aria-current={active === id ? 'true' : undefined} onClick={() => jump(id)}><Icon size={16} />{label}</button>
          ))}
        </nav>

        <div className="se-sections">
          <section id="se-goal" className="se-card" aria-labelledby="se-goal-title">
            <div className="se-card-head">
              <span className="se-card-icon" aria-hidden="true"><Target size={18} /></span>
              <div><h2 id="se-goal-title">Where you are headed</h2><p>Your target competition shapes the problems Learn puts in front of you.</p></div>
            </div>
            <fieldset className="se-ascent">
              <legend className="se-sr">Target competition goal</legend>
              {GOALS.map((g, index) => (
                <label key={g.value} className={`se-step${index === goalIndex ? ' is-chosen' : index < goalIndex ? ' is-climbed' : ''}`} style={{ '--h': (index + 1) / GOALS.length } as Vars}>
                  <input type="radio" name="customGoal" value={g.value} checked={customGoal === g.value} onChange={(e) => { setCustomGoal(e.target.value); setTouched(true); }} />
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
            </div>
            <fieldset className="se-paces">
              <legend className="se-sr">Daily practice pace</legend>
              {PACES.map((pace) => (
                <label key={pace.value} className={`se-pace${studyPace === pace.value ? ' is-chosen' : ''}`}>
                  <input type="radio" name="studyPace" value={pace.value} checked={studyPace === pace.value} onChange={(e) => { setStudyPace(e.target.value); setTouched(true); }} />
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
              <button type="button" role="switch" aria-checked={studyReminders} aria-labelledby="se-reminders-title" className="se-switch" onClick={() => onToggleReminders(!studyReminders)}><span /></button>
            </div>
            <div className={`se-notification${studyReminders ? ' is-on' : ''}`} aria-hidden="true">
              <span className="se-notification-app">c<span>·</span></span>
              <div>
                <p className="se-notification-meta"><b>CalculixHub</b><span>{reminderTime}</span></p>
                <p className="se-notification-title">Keep your streak alive</p>
                <p className="se-notification-body">One problem is enough to hold today. Your weakest domain is waiting.</p>
              </div>
            </div>
            <p className="se-hint">{studyReminders ? `On. You will be reminded every day at ${reminderTime}.` : 'Off. Turn it on and your device will ask for permission once.'}</p>
            {reminderNotice && <p className="se-notice is-warning" role="status">{reminderNotice}</p>}
          </section>

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
              <span className="se-card-icon" aria-hidden="true"><KeyRound size={18} /></span>
              <div><h2 id="se-tutor-title">Gemini API key for the math assistant</h2><p>Use your own Google Gemini API key for live explanations. Your Google account's usage limits and charges may apply.</p></div>
              <span className={`se-key-state is-${keyState}`}>{keyState === 'verified' ? 'Verified' : keyState === 'saved' ? 'Key saved' : 'Not set'}</span>
            </div>
            <div className="se-key">
              <KeyRound size={16} aria-hidden="true" />
              <input type={showKey ? 'text' : 'password'} value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="AIzaSy..." aria-label="Gemini API key" autoComplete="off" spellCheck={false} />
              <button type="button" onClick={() => setShowKey(!showKey)} aria-label={showKey ? 'Hide key' : 'Show key'}>{showKey ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </div>
            <p className="se-hint">Stored in this browser only, not in your account. Remove it here before using a shared device.</p>
            <div className="se-key-actions">
              <m.button type="button" onClick={handleSaveApiKey} whileTap={{ scale: 0.96 }} className="se-btn is-quiet"><Save size={15} /> Save key</m.button>
              <m.button type="button" onClick={handleTestApiKey} disabled={testingKey || !apiKey.trim()} whileTap={{ scale: 0.96 }} className="se-btn is-quiet">
                {testingKey ? <><RefreshCw size={15} className="se-spin" /> Testing…</> : <><Check size={15} /> Test connection</>}
              </m.button>
              {apiKey.trim() && <m.button type="button" onClick={handleClearApiKey} whileTap={{ scale: 0.96 }} className="se-btn is-danger"><Trash2 size={15} /> Clear</m.button>}
            </div>
            {keyNotice && <p className={`se-notice ${keyNotice.success ? 'is-ok' : 'is-error'}`} role="status">{keyNotice.text}</p>}
          </section>

          <div className={`se-savebar${touched ? ' is-dirty' : ''}`}>
            <p>{touched ? <><i aria-hidden="true" /> <span>Unsaved changes<span className="se-wide"> to your goal or pace</span></span></> : saveSuccessNotify ? <><Check size={15} aria-hidden="true" /> Settings saved successfully!</> : 'Goal and pace are saved to your account.'}</p>
            <m.button type="submit" whileTap={{ scale: 0.96 }} className="se-btn is-primary"><Save size={16} /> Save settings</m.button>
          </div>
        </div>
      </form>
    </div>
  );
}
