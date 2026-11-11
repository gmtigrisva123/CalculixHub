/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Switching the live tutor on.
 *
 * What Google calls a "Gemini API key" is, to a fourteen-year-old, a code they
 * have never heard of from a page they have never seen. So this is written the
 * other way round: it says what the code does, walks the three steps to get
 * one, and checks it the moment it is pasted. One button does save-and-test,
 * because a key that is saved but does not work is not a state anyone wants.
 *
 * Used in Settings and inside the tutor panel, so the two cannot drift apart.
 */

import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, ClipboardPaste, Eye, EyeOff, LoaderCircle, RefreshCw, ShieldCheck, Unplug } from 'lucide-react';
import { maskKey, modelLabel, normalizeGeminiKey, storeGeminiKey, testGeminiKey } from '../../lib/geminiClient';
import { useTutorKey } from '../../lib/tutor';
import '../../styles/tutor-connect.css';

const STUDIO_URL = 'https://aistudio.google.com/apikey';

type Phase = 'idle' | 'checking' | 'failed';

interface TutorConnectProps {
  /** A tighter layout for the tutor panel. */
  compact?: boolean;
  /** Called once a key has been checked and works. */
  onConnected?: () => void;
}

/* Google's keys start "AIza" and run to 39 characters. A hint, never a gate: formats change. */
const looksOdd = (value: string) => value.length > 0 && (!/^AIza/.test(value) || value.length < 30);

export default function TutorConnect({ compact = false, onConnected }: TutorConnectProps) {
  const { key, model } = useTutorKey();
  const [draft, setDraft] = useState('');
  const [shown, setShown] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [problem, setProblem] = useState<string | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [canPaste, setCanPaste] = useState(false);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => { setCanPaste(typeof navigator !== 'undefined' && Boolean(navigator.clipboard?.readText)); }, []);

  const connect = async (raw: string) => {
    const clean = normalizeGeminiKey(raw);
    if (!clean || phase === 'checking') return;
    setPhase('checking');
    setProblem(null);
    storeGeminiKey(clean);
    try {
      await testGeminiKey(clean);
      setDraft('');
      setReplacing(false);
      setPhase('idle');
      onConnected?.();
    } catch (error) {
      setDraft(clean);
      setPhase('failed');
      setProblem(error instanceof Error ? error.message : 'Could not reach Google. Check your connection and try again.');
    }
  };

  const paste = async () => {
    try {
      const text = normalizeGeminiKey(await navigator.clipboard.readText());
      if (text) { setDraft(text); setProblem(null); setPhase('idle'); }
    } catch {
      // The browser declined; the field is still there to paste into by hand.
      field.current?.focus();
    }
  };

  const disconnect = () => {
    storeGeminiKey('');
    setDraft('');
    setProblem(null);
    setPhase('idle');
    setReplacing(false);
  };

  const live = Boolean(key && model) && !replacing;
  const unchecked = Boolean(key) && !model && !replacing && phase !== 'failed';

  if (live) {
    return (
      <div className={`tk${compact ? ' is-compact' : ''}`}>
        <div className="tk-live">
          <span className="tk-live-mark" aria-hidden="true"><Check size={16} strokeWidth={2.6} /></span>
          <div className="tk-live-text">
            <b>The live tutor is on</b>
            <span>Answering with {modelLabel(model!)} · <code>{maskKey(key)}</code></span>
          </div>
          <div className="tk-live-actions">
            <button type="button" className="tk-btn" onClick={() => void connect(key)} disabled={phase === 'checking'}>
              {phase === 'checking' ? <LoaderCircle size={14} className="tk-spin" aria-hidden="true" /> : <RefreshCw size={14} aria-hidden="true" />}
              {phase === 'checking' ? 'Checking…' : 'Check again'}
            </button>
            <button type="button" className="tk-btn" onClick={() => { setReplacing(true); setDraft(''); }}>Use another</button>
            <button type="button" className="tk-btn is-quiet" onClick={disconnect}><Unplug size={14} aria-hidden="true" />Turn off</button>
          </div>
        </div>
        <p className="tk-privacy"><ShieldCheck size={14} aria-hidden="true" />Kept in this browser only. Turn it off before you leave a shared computer.</p>
      </div>
    );
  }

  const value = draft || (unchecked ? key : '');
  return (
    <div className={`tk${compact ? ' is-compact' : ''}`}>
      <ol className="tk-steps">
        <li>
          <div>
            <b>Open Google AI Studio</b>
            <p>Sign in with any Google account. A school account may be blocked; a personal one works.</p>
            <a className="tk-btn is-open" href={STUDIO_URL} target="_blank" rel="noopener noreferrer">Open Google AI Studio<ArrowUpRight size={14} aria-hidden="true" /></a>
          </div>
        </li>
        <li>
          <div>
            <b>Press “Create API key”</b>
            <p>Google makes a long code that starts with <code>AIza</code>. Press the copy button beside it.</p>
          </div>
        </li>
        <li>
          <div>
            <b>Paste it here</b>
            <form className="tk-form" onSubmit={event => { event.preventDefault(); void connect(value); }}>
              <div className={`tk-field${phase === 'failed' ? ' is-bad' : ''}`}>
                <input ref={field} type={shown ? 'text' : 'password'} value={value} placeholder="AIza…" aria-label="Your tutor key" autoComplete="off" autoCapitalize="off" spellCheck={false}
                  onChange={event => { setDraft(event.target.value); setProblem(null); if (phase === 'failed') setPhase('idle'); }} />
                {value
                  ? <button type="button" onClick={() => setShown(!shown)} aria-label={shown ? 'Hide the key' : 'Show the key'}>{shown ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                  : canPaste && <button type="button" className="has-label" onClick={() => void paste()}><ClipboardPaste size={15} aria-hidden="true" />Paste</button>}
              </div>
              <button type="submit" className="tk-btn is-primary" disabled={!normalizeGeminiKey(value) || phase === 'checking'}>
                {phase === 'checking' ? <><LoaderCircle size={15} className="tk-spin" aria-hidden="true" />Checking…</> : 'Connect'}
              </button>
            </form>
            {problem
              ? <p className="tk-problem" role="alert">{problem}</p>
              : looksOdd(normalizeGeminiKey(value)) && <p className="tk-hint">Google’s keys start with <code>AIza</code> and are 39 characters long. This one looks different, but you can still try it.</p>}
            {unchecked && !problem && <p className="tk-hint">This key is saved but has not been checked yet. Press Connect to make sure it works.</p>}
          </div>
        </li>
      </ol>

      <div className="tk-foot">
        <p className="tk-privacy"><ShieldCheck size={14} aria-hidden="true" />Your key stays in this browser and goes straight to Google. It never reaches our servers.</p>
        {(replacing || key) && <button type="button" className="tk-link" onClick={replacing ? () => { setReplacing(false); setDraft(''); setProblem(null); setPhase('idle'); } : disconnect}>{replacing ? 'Keep the current key' : 'Remove the saved key'}</button>}
      </div>

      {!compact && (
        <details className="tk-faq">
          <summary>What is this, and does it cost anything?</summary>
          <div>
            <p>The tutor’s answers are written by Gemini, Google’s AI model. A key is how Google knows which account is asking, a bit like a library card. Developers call it a “Gemini API key”, which is the name you will see on Google’s page.</p>
            <p>Google gives every account a free daily allowance, which is plenty for homework and contest practice. If you ever add billing on Google’s side, their prices apply, not ours.</p>
            <p>Without a key the tutor still opens, but it can only offer a few ready-made hints.</p>
          </div>
        </details>
      )}
    </div>
  );
}
