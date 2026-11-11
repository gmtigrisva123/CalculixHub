/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The tutor: one panel, opened from the corner or from a problem.
 *
 * On a desktop it floats beside the page and leaves the page usable, because
 * the thing being asked about is usually the problem still on screen. On a
 * phone there is no beside, so it rises as a sheet.
 */

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { ArrowUp, Check, ChevronDown, Copy, Maximize2, Minimize2, RotateCcw, Sigma, Sparkles, Square, SquarePen, TriangleAlert, X, Zap } from 'lucide-react';
import MathText from './MathText';
import TutorConnect from './tutor/TutorConnect';
import { apiUrl } from '../services/apiBase';
import { backdrop, spring } from '../lib/motion';
import { useAmbient } from '../hooks/useAmbient';
import { useMediaQuery } from '../hooks/useBreakpoint';
import { useAuth } from '../context/AuthContext';
import { generateWithKey, modelLabel } from '../lib/geminiClient';
import { COACHING_STYLES, readChat, storeChat, storeCoachingStyle, styleNote, tutorInstruction, useTutorKey, useTutorPrefs, type TutorMessage } from '../lib/tutor';
import '../styles/tutor.css';

interface AITutorChatProps {
  /** A new request opens the single tutor, optionally with problem context. `label` is what the learner sees in place of the full prompt. */
  request?: { id: number; prompt?: string; label?: string } | null;
}

type Shown = TutorMessage;

const STARTERS: readonly { topic: string; hue: string; title: string; prompt: string }[] = [
  { topic: 'Algebra', hue: '#c8842a', title: 'When does AM-GM give the minimum?', prompt: 'How do I know when AM-GM gives the minimum of an expression, and how do I check the equality case?' },
  { topic: 'Geometry', hue: '#209d8c', title: 'Spotting a cyclic quadrilateral', prompt: 'What are the quickest ways to spot that four points lie on a circle in a geometry problem?' },
  { topic: 'Combinatorics', hue: '#8b5cf6', title: 'Why the handshake count is n(n-1)/2', prompt: 'Walk me through why the number of handshakes among $n$ people is $\\frac{n(n-1)}{2}$.' },
  { topic: 'Number Theory', hue: '#0484c0', title: 'Last two digits of a big power', prompt: 'How do I find the last two digits of $7^{2024}$ without a calculator?' },
];

/* What a learner reaches for most, in the order a solution tends to need them. */
const SYMBOLS: readonly { face: string; name: string; before: string; after?: string }[] = [
  { face: 'x²', name: 'power', before: '^{', after: '}' },
  { face: 'a⁄b', name: 'fraction', before: '\\frac{', after: '}{}' },
  { face: '√', name: 'square root', before: '\\sqrt{', after: '}' },
  { face: '≤', name: 'at most', before: '\\le ' },
  { face: '≥', name: 'at least', before: '\\ge ' },
  { face: '≠', name: 'not equal', before: '\\ne ' },
  { face: '≡', name: 'congruent', before: '\\equiv ' },
  { face: 'π', name: 'pi', before: '\\pi ' },
  { face: '∠', name: 'angle', before: '\\angle ' },
  { face: '∑', name: 'sum', before: '\\sum_{i=1}^{n} ' },
  { face: 'nCk', name: 'choose', before: '\\binom{n}{', after: '}' },
];

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
/* A displayed formula already sits on its own line; the blank lines a model puts round it would double the gap. */
const tidy = (text: string) => text.replace(/\n*(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\])\n*/g, '$1').replace(/\n{3,}/g, '\n\n');
const hasMath = (text: string) => /\$[^$\n]+\$|\\\(|\\\[/.test(text);

/* Used only when the server cannot be reached at all. */
function offlineHint(message: string): string {
  const text = message.toLowerCase();
  if (text.includes('handshake')) {
    return 'With $n$ people, the first shakes hands with $n-1$ others, the second with $n-2$ who are left, and so on. Adding those up gives $\\frac{n(n-1)}{2}$. For $n=10$ that is $\\frac{10 \\times 9}{2} = 45$.';
  }
  if (text.includes('am-gm') || text.includes('cauchy') || text.includes('inequality')) {
    return 'For positive reals, AM-GM says $\\frac{x_1 + x_2 + \\dots + x_n}{n} \\ge \\sqrt[n]{x_1 x_2 \\dots x_n}$, with equality exactly when every term is equal. So the first thing to check is whether the equality case can actually happen under your constraint.';
  }
  return 'A few places to start:\n- **Algebra**: look for symmetry, then try factoring.\n- **Geometry**: draw one extra line and chase the angles.\n- **Combinatorics**: count a small case by hand and look for the pattern.';
}

export default function AITutorChat({ request }: AITutorChatProps) {
  const { profile } = useAuth();
  const owner = profile?.id ?? 'guest';
  const { key, model } = useTutorKey();
  const { style } = useTutorPrefs();

  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<'chat' | 'connect'>('chat');
  const [messages, setMessages] = useState<Shown[]>(() => readChat(owner));
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [wide, setWide] = useState(false);
  const [symbols, setSymbols] = useState(false);
  const [styleMenu, setStyleMenu] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, setPending] = useState<{ prompt: string; label?: string } | null>(null);

  const floats = useMediaQuery('(min-width: 64rem)');
  const sparkleRef = useAmbient<SVGSVGElement>();
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const abort = useRef<AbortController | null>(null);
  const styleRef = useRef<HTMLDivElement>(null);

  useEffect(() => { storeChat(owner, messages); }, [messages, owner]);

  useEffect(() => {
    if (!request) return;
    setPending(request.prompt ? { prompt: request.prompt, label: request.label } : null);
    setIsOpen(true);
  }, [request?.id]);

  /* Keep the newest line in view, and the field ready on a desktop. */
  useEffect(() => {
    const node = scroller.current;
    if (node) node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' });
  }, [messages, loading, isOpen, view]);
  useEffect(() => { if (isOpen && floats && view === 'chat') input.current?.focus({ preventScroll: true }); }, [isOpen, floats, view]);

  /* The field grows with what is typed, up to a third of the panel. */
  useLayoutEffect(() => {
    const node = input.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${Math.min(node.scrollHeight, 168)}px`;
  }, [draft, isOpen, view]);

  const ask = useCallback(async (history: readonly Shown[], signal: AbortSignal): Promise<Shown> => {
    const said = history.filter(message => !message.kind);
    const last = said[said.length - 1];
    const reply = (text: string, kind?: TutorMessage['kind']): Shown => ({ id: newId(), sender: 'tutor', text, at: Date.now(), kind });

    if (key) {
      // Straight to Google with the learner's own key; it never reaches our server.
      try {
        const { text } = await generateWithKey(key, said.map(message => ({ role: message.sender === 'user' ? 'user' as const : 'model' as const, text: message.text })), { systemInstruction: tutorInstruction(style), signal });
        return reply(text);
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') throw error;
        return reply(error instanceof Error ? error.message : String(error), 'error');
      }
    }

    try {
      const response = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({ message: styleNote(style) + last.text, history: said.slice(0, -1).slice(-20).map(message => ({ role: message.sender, content: message.text })) }),
      });
      if (response.ok) {
        const data = await response.json();
        return reply(data.reply || 'I didn’t quite follow that. Could you put it another way?', data.isFallback ? 'canned' : undefined);
      }
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') throw error;
    }
    return reply(offlineHint(last.text), 'canned');
  }, [key, style]);

  const run = async (history: Shown[]) => {
    setMessages(history);
    setLoading(true);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const answer = await ask(history, controller.signal);
      setMessages(current => [...current, answer]);
    } catch {
      /* Stopped by the learner: the question stays, nothing is added. */
    } finally {
      if (abort.current === controller) abort.current = null;
      setLoading(false);
    }
  };

  const send = (text: string, label?: string) => {
    const clean = text.trim();
    if (!clean || loading) return;
    void run([...messages, { id: newId(), sender: 'user', text: clean, at: Date.now(), label }]);
  };
  const submit = (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!draft.trim() || loading) return;
    send(draft);
    setDraft('');
    setSymbols(false);
  };
  const retry = () => {
    if (loading) return;
    let cut = messages.length;
    while (cut > 0 && messages[cut - 1].sender === 'tutor') cut--;
    if (cut > 0) void run(messages.slice(0, cut));
  };
  const stop = () => abort.current?.abort();
  const startOver = () => { stop(); setMessages([]); setDraft(''); setPending(null); setView('chat'); };

  /* An explanation asked for from a problem needs the live tutor, so it waits for a key. */
  useEffect(() => {
    if (!isOpen || !pending || loading) return;
    if (!key) { setView('connect'); return; }
    const { prompt, label } = pending;
    setPending(null);
    setView('chat');
    send(prompt, label);
  }, [key, isOpen, loading, pending]);

  const copy = async (message: Shown) => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(message.id);
      window.setTimeout(() => setCopied(current => (current === message.id ? null : current)), 1600);
    } catch { /* the clipboard is not available here */ }
  };

  const insert = (before: string, after = '') => {
    const node = input.current;
    if (!node) return;
    const start = node.selectionStart ?? draft.length, end = node.selectionEnd ?? draft.length;
    // Open a maths span if the caret is not already inside one.
    const outside = (draft.slice(0, start).match(/\$/g)?.length ?? 0) % 2 === 0;
    const head = `${outside ? '$' : ''}${before}`, tail = `${after}${outside ? '$' : ''}`;
    const selected = draft.slice(start, end);
    setDraft(draft.slice(0, start) + head + selected + tail + draft.slice(end));
    const caret = start + head.length + selected.length;
    requestAnimationFrame(() => { node.focus(); node.setSelectionRange(caret, caret); });
  };

  /* Escape closes the innermost thing that is open. */
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (styleMenu) setStyleMenu(false);
      else if (view === 'connect') setView('chat');
      else if (!floats || document.getElementById('panel-ai-tutor')?.contains(document.activeElement)) setIsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, styleMenu, view, floats]);
  useEffect(() => {
    if (!styleMenu) return;
    const away = (event: PointerEvent) => { if (!styleRef.current?.contains(event.target as Node)) setStyleMenu(false); };
    window.addEventListener('pointerdown', away);
    return () => window.removeEventListener('pointerdown', away);
  }, [styleMenu]);

  const lastCanned = [...messages].reverse().find(message => message.sender === 'tutor')?.kind === 'canned';
  const status = key
    ? model ? { tone: 'live', text: `Live · ${modelLabel(model)}` } : { tone: 'idle', text: 'Key saved, not checked yet' }
    : lastCanned ? { tone: 'warn', text: 'Ready-made hints only' } : { tone: 'idle', text: 'Turn on live answers' };
  const lastTutor = [...messages].reverse().find(message => message.sender === 'tutor')?.id;
  const current = COACHING_STYLES.find(item => item.value === style)!;

  return (
    <>
      {!isOpen && (
        <m.button id="btn-ai-tutor-toggle" aria-label="Ask the tutor" onClick={() => setIsOpen(true)} whileTap={{ scale: 0.95 }} transition={spring.press}
          className="tutor-fab fixed right-3.5 md:right-6 bottom-20 md:bottom-6 top-auto h-auto max-h-12 z-50 flex items-center gap-2.5 font-semibold text-xs px-4 md:px-5 py-3 rounded-full group cursor-pointer">
          <Sparkles ref={sparkleRef} className="tutor-fab-spark w-4 h-4 group-hover:rotate-12 transition-transform duration-300" />
          <span className="tutor-fab-label text-xs md:text-sm">Ask the tutor</span>
          {messages.length > 0 && <span className="tu-fab-note" aria-label="Conversation in progress" />}
        </m.button>
      )}

      <AnimatePresence>
        {isOpen && !floats && <m.div key="scrim" className="tu-scrim" variants={backdrop} initial="hidden" animate="visible" exit="exit" onClick={() => setIsOpen(false)} />}
        {isOpen && (
          <m.aside key="panel" id="panel-ai-tutor" className={`tu${floats ? ' is-floating' : ' is-sheet'}${wide && floats ? ' is-wide' : ''}`} role={floats ? 'complementary' : 'dialog'} aria-modal={floats ? undefined : true} aria-label="Tutor"
            initial={floats ? { opacity: 0, x: 28, scale: 0.985 } : { y: '100%' }} animate={floats ? { opacity: 1, x: 0, scale: 1 } : { y: 0 }} exit={floats ? { opacity: 0, x: 20, scale: 0.985, transition: { duration: 0.16 } } : { y: '100%' }} transition={spring.gentle}>
            {!floats && <span className="tu-grab" aria-hidden="true" />}

            <header className="tu-head">
              <span className="tu-mark" aria-hidden="true"><Sparkles size={17} /></span>
              <div className="tu-title">
                <h2>Tutor</h2>
                <button type="button" className={`tu-status is-${status.tone}`} onClick={() => setView(view === 'connect' ? 'chat' : 'connect')} aria-expanded={view === 'connect'}>
                  <i aria-hidden="true" />{status.text}
                </button>
              </div>
              <div className="tu-tools">
                <button type="button" onClick={startOver} disabled={messages.length === 0 && !draft} aria-label="Start a new conversation" title="New conversation"><SquarePen size={17} /></button>
                {floats && <button type="button" onClick={() => setWide(!wide)} aria-label={wide ? 'Make the tutor narrower' : 'Make the tutor wider'} aria-pressed={wide} title={wide ? 'Narrower' : 'Wider'}>{wide ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>}
                <button type="button" id="btn-close-ai-tutor" onClick={() => setIsOpen(false)} aria-label="Close the tutor" title="Close"><X size={18} /></button>
              </div>
            </header>

            {view === 'connect' ? (
              <div className="tu-body tu-connect" ref={scroller}>
                <div className="tu-connect-head">
                  <p className="tu-kicker">Live tutor</p>
                  <h3>{pending ? 'This explanation needs the live tutor' : key && model ? 'You’re connected' : 'Get real answers, not ready-made hints'}</h3>
                  <p>{pending ? 'Connect once and the explanation you asked for starts straight away.' : 'The tutor answers with Google’s Gemini. It needs a free key from your own Google account, which takes about a minute to get.'}</p>
                </div>
                <TutorConnect compact onConnected={() => setView('chat')} />
                <button type="button" className="tu-back" onClick={() => { setPending(null); setView('chat'); }}>{key && model ? 'Back to the conversation' : 'Not now'}</button>
              </div>
            ) : (
              <>
                <div className="tu-body" ref={scroller}>
                  {messages.length === 0 && !loading ? (
                    <div className="tu-empty">
                      <h3>What are you <em>stuck on?</em></h3>
                      <p>Paste a problem, or your own attempt at one. Type maths between dollar signs, like <code>$x^2$</code>, and it is typeset as you write.</p>
                      <p className="tu-kicker">Or start from one of these</p>
                      <ul className="tu-starters">
                        {STARTERS.map(starter => (
                          <li key={starter.topic}>
                            <button type="button" onClick={() => send(starter.prompt)} style={{ '--hue': starter.hue } as React.CSSProperties}>
                              <i aria-hidden="true" /><span><small>{starter.topic}</small>{starter.title}</span><ArrowUp size={15} aria-hidden="true" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <ol className="tu-thread">
                      {messages.map(message => message.sender === 'user' ? (
                        <li key={message.id} className="tu-msg is-user"><div className="tu-bubble">{message.label ? <span className="tu-context">{message.label}</span> : <MathText text={message.text} as="div" />}</div></li>
                      ) : message.kind === 'error' ? (
                        <li key={message.id} className="tu-msg is-error">
                          <TriangleAlert size={16} aria-hidden="true" />
                          <div><b>The live tutor couldn’t answer</b><p>{message.text}</p>
                            <div className="tu-msg-actions is-shown"><button type="button" onClick={() => setView('connect')}>Check the connection</button><button type="button" onClick={retry}><RotateCcw size={13} aria-hidden="true" />Try again</button></div>
                          </div>
                        </li>
                      ) : (
                        <li key={message.id} className="tu-msg is-tutor">
                          <MathText text={tidy(message.text)} as="div" className="tu-prose" />
                          {message.kind === 'canned' && !key && <button type="button" className="tu-upsell" onClick={() => setView('connect')}><Zap size={14} aria-hidden="true" /><span>That was a ready-made hint. <b>Turn on live answers</b> to have your actual question worked through.</span></button>}
                          <div className={`tu-msg-actions${message.id === lastTutor ? ' is-shown' : ''}`}>
                            <button type="button" onClick={() => void copy(message)}>{copied === message.id ? <><Check size={13} aria-hidden="true" />Copied</> : <><Copy size={13} aria-hidden="true" />Copy</>}</button>
                            {message.id === lastTutor && !loading && <button type="button" onClick={retry}><RotateCcw size={13} aria-hidden="true" />Try again</button>}
                            <time dateTime={new Date(message.at).toISOString()}>{new Date(message.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>
                          </div>
                        </li>
                      ))}
                      {loading && <li className="tu-msg is-thinking" role="status"><span aria-hidden="true"><i /><i /><i /></span>Working on it</li>}
                    </ol>
                  )}
                </div>

                <form className="tu-composer" onSubmit={submit}>
                  {hasMath(draft) && <div className="tu-preview" aria-label="How your message will look"><MathText text={draft} as="div" /></div>}
                  {symbols && (
                    <div className="tu-symbols" role="toolbar" aria-label="Insert a symbol">
                      {SYMBOLS.map(symbol => <button key={symbol.name} type="button" onClick={() => insert(symbol.before, symbol.after)} aria-label={`Insert ${symbol.name}`} title={symbol.name}>{symbol.face}</button>)}
                    </div>
                  )}
                  <textarea id="field-chat-input" ref={input} rows={1} value={draft} placeholder="Ask about a problem…" aria-label="Message to the tutor" enterKeyHint="send"
                    onChange={event => setDraft(event.target.value)}
                    onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); } }} />
                  <div className="tu-composer-row">
                    <div className="tu-style" ref={styleRef}>
                      <button type="button" className="tu-chip" onClick={() => setStyleMenu(!styleMenu)} aria-haspopup="menu" aria-expanded={styleMenu} title="How much help the tutor gives">{current.label}<ChevronDown size={14} aria-hidden="true" /></button>
                      {styleMenu && (
                        <div className="tu-menu" role="menu" aria-label="How much help">
                          {COACHING_STYLES.map(item => (
                            <button key={item.value} type="button" role="menuitemradio" aria-checked={item.value === style} onClick={() => { storeCoachingStyle(item.value); setStyleMenu(false); input.current?.focus(); }}>
                              <span><b>{item.label}</b><small>{item.note}</small></span>{item.value === style && <Check size={15} aria-hidden="true" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button type="button" className="tu-chip is-icon" onClick={() => setSymbols(!symbols)} aria-pressed={symbols} aria-label="Maths symbols" title="Maths symbols"><Sigma size={15} /></button>
                    <span className="tu-keys" aria-hidden="true"><kbd>Enter</kbd> to send</span>
                    {loading
                      ? <button type="button" className="tu-send is-stop" onClick={stop} aria-label="Stop"><Square size={13} fill="currentColor" /></button>
                      : <button type="submit" id="btn-send-chat" className="tu-send" disabled={!draft.trim()} aria-label="Send"><ArrowUp size={18} strokeWidth={2.4} /></button>}
                  </div>
                </form>
              </>
            )}
          </m.aside>
        )}
      </AnimatePresence>
    </>
  );
}
