/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { Sparkles, Send, X, Bot, HelpCircle, Key, Check } from 'lucide-react';
import MathText from './MathText';
import { apiUrl } from '../services/apiBase';
import { backdrop, duration, ease, spring, travel } from '../lib/motion';
import { useAmbient } from '../hooks/useAmbient';
import { useIsDesktop } from '../hooks/useBreakpoint';

interface ChatMessage {
  id: string;
  sender: 'user' | 'tutor';
  text: string;
  timestamp: Date;
}

export default function AITutorChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [userApiKey, setUserApiKey] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init',
      sender: 'tutor',
      text: "Hello! I'm your Calculix Math Coach. I help you work through challenging competition problems step-by-step through guided reasoning. What concept or problem would you like to explore today?",
      timestamp: new Date(),
    },
  ]);
  const [inputVal, setInputVal] = useState('');
  const [loading, setLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const sparkleRef = useAmbient<SVGSVGElement>();
  const pingRef = useAmbient<HTMLDivElement>();
  const statusDotRef = useAmbient<HTMLSpanElement>();

  const isDesktop = useIsDesktop();

  useEffect(() => {
    const saved = localStorage.getItem('calculix_gemini_api_key') || '';
    setUserApiKey(saved);
  }, [isOpen]);

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSaveInlineKey = (key: string) => {
    const trimmed = key.trim();
    setUserApiKey(trimmed);
    if (trimmed) {
      localStorage.setItem('calculix_gemini_api_key', trimmed);
    } else {
      localStorage.removeItem('calculix_gemini_api_key');
    }
    setShowKeyModal(false);
  };

function getSmartFallbackReply(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes('handshake')) {
    return `Let's break down the Handshake Problem. With $n$ people, the first shakes hands with $n-1$ others, the second with $n-2$ remaining, and so on.
The general formula is $S = \\frac{n(n-1)}{2}$. For $n=10$: $\\frac{10 \\times 9}{2} = 45$. That's the elegance of combinatorics!`;
  }

  if (normalized.includes('am-gm') || normalized.includes('cauchy') || normalized.includes('inequality')) {
    return `Great question! The AM-GM inequality for positive reals $x_1, x_2, \\dots, x_n$ states:
$\\frac{x_1 + x_2 + \\dots + x_n}{n} \\ge \\sqrt[n]{x_1 x_2 \\dots x_n}$
Equality holds exactly when all terms are equal. In the classic minimisation $P = 1/a + 1/b + 1/c$ with $a+b+c=1$, equality at $a=b=c=1/3$ gives the minimum value of 9!`;
  }

  return `Hi! I'm your Calculix AI Tutor.
Let's work through this step-by-step:
- For **Algebra**, examine symmetric expressions and factorizations.
- For **Geometry**, try drawing auxiliary lines or using angle chasing.
- For **Combinatorics**, look for recurrence relations or invariants.`;
}

  const handleSendMessage = async (e?: React.FormEvent, overrideText?: string) => {
    if (e) e.preventDefault();
    const textToSend = overrideText || inputVal;
    if (!textToSend.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!overrideText) setInputVal('');
    setLoading(true);

    try {
      const savedKey = localStorage.getItem('calculix_gemini_api_key')?.trim();

      if (savedKey) {
        // Direct call to Gemini API using user's personal API Key
        const systemInstruction =
          'You are the Calculix AI Tutor: a warm but rigorous mathematics teacher for a secondary-school student. Teach by the Socratic method. Draw the next step out of the learner rather than handing over the answer. Write clear English with academic substance and LaTeX notation ($x^2$, $\\frac{a}{b}$). Be concise and precise.';

        // Try gemini-2.0-flash first, then gemini-1.5-flash
        for (const modelName of ['gemini-2.0-flash', 'gemini-1.5-flash']) {
          try {
            const resp = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(savedKey)}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [
                    {
                      role: 'user',
                      parts: [{ text: `${systemInstruction}\n\nUser Question: ${userMsg.text}` }],
                    },
                  ],
                }),
              }
            );

            const data = await resp.json();
            const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

            if (resp.ok && replyText) {
              setMessages((prev) => [
                ...prev,
                {
                  id: (Date.now() + 1).toString(),
                  sender: 'tutor',
                  text: replyText,
                  timestamp: new Date(),
                },
              ]);
              return;
            } else if (data?.error?.message) {
              // Return clear API error message to user
              setMessages((prev) => [
                ...prev,
                {
                  id: (Date.now() + 1).toString(),
                  sender: 'tutor',
                  text: `⚠️ **Gemini API Error:** ${data.error.message}\n\nPlease check your Gemini API Key in Settings or click the 🔑 key icon above to re-enter a valid key.`,
                  timestamp: new Date(),
                },
              ]);
              return;
            }
          } catch (modelErr) {
            console.warn(`Model ${modelName} fetch failed, trying fallback model...`, modelErr);
          }
        }
      }

      // Default backend route call
      try {
        const response = await fetch(apiUrl('/api/chat'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(savedKey ? { 'x-gemini-api-key': savedKey } : {}),
          },
          body: JSON.stringify({
            message: userMsg.text,
            history: messages.map((m) => ({ role: m.sender, content: m.text })),
          }),
        });

        if (response.ok) {
          const data = await response.json();
          let replyText = data.reply || "I didn't quite follow that — could you rephrase it?";
          if (data.isFallback && !savedKey) {
            replyText += '\n\n💡 *Tip: Enter your personal Gemini API Key using the 🔑 key icon above (or in Settings) for unlimited live AI Tutor responses!*';
          }

          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              sender: 'tutor',
              text: replyText,
              timestamp: new Date(),
            },
          ]);
          return;
        }
      } catch (backendErr) {
        console.warn('Backend API /api/chat unreachable, serving smart fallback engine.', backendErr);
      }

      // Smart fallback reply when backend/network is unavailable
      const fallbackText = getSmartFallbackReply(userMsg.text);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'tutor',
          text: fallbackText + '\n\n💡 *Tip: Enter your personal Gemini API Key using the 🔑 key icon above for live AI Tutor responses!*',
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      console.error('Chat error:', err);
      const fallbackText = getSmartFallbackReply(userMsg.text);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'tutor',
          text: fallbackText,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Quick suggestions
  const sendQuickOption = (promptText: string) => {
    void handleSendMessage(undefined, promptText);
  };

  return (
    <>
      {/* Floating Chat Button */}
      <m.button
        id="btn-ai-tutor-toggle"
        onClick={() => setIsOpen(!isOpen)}
        whileTap={{ scale: 0.95 }}
        transition={spring.press}
        className="tutor-fab fixed right-3.5 md:right-6 bottom-20 md:bottom-6 top-auto h-auto max-h-12 z-50 flex items-center gap-2.5 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-semibold text-xs px-4 md:px-5 py-3 rounded-full shadow-lg shadow-indigo-500/25 border border-indigo-400/30 transition-all duration-200 group cursor-pointer"
      >
        <Sparkles
          ref={sparkleRef}
          className="w-4 h-4 animate-pulse group-hover:scale-110 transition-transform duration-160"
        />
        <span className="font-bold tracking-wide text-xs md:text-sm">Ask Math Assistant</span>
        <div
          ref={pingRef}
          className="absolute -top-1 -right-1 block h-3 w-3 rounded-full bg-cyan-400 ring-2 ring-white dark:ring-stone-900 animate-ping"
        />
      </m.button>

      {/* Slide-out Sidebar Drawer for Chat */}
      <AnimatePresence>
      {isOpen && (
        <m.div
          variants={backdrop}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 z-50 flex flex-col md:flex-row md:justify-end bg-black/40 backdrop-blur-xs"
        >
          <div className="flex-1" onClick={() => setIsOpen(false)} />

          <m.div
            id="panel-ai-tutor"
            initial={isDesktop ? { x: '100%' } : { y: '100%' }}
            animate={isDesktop ? { x: 0 } : { y: 0 }}
            exit={isDesktop ? { x: '100%' } : { y: '100%' }}
            transition={spring.gentle}
            className="w-full md:max-w-md h-[80%] md:h-full bg-surface-raised shadow-2xl flex flex-col relative border-l border-line rounded-t-3xl md:rounded-none overflow-hidden"
          >
            {/* Grab handle: the affordance that says this panel is dismissable. */}
            <div className="md:hidden absolute top-2 left-1/2 -translate-x-1/2 w-9 h-1 rounded-full bg-line z-10" />
            
            <div className="ramp-static bg-ink-950 text-white p-4 flex items-center justify-between border-b border-ink-800">
              <div className="flex items-center gap-2.5">
                <div className="material-accent p-2 rounded-control"><Bot className="w-5 h-5 text-white" /></div>
                <div>
                  <h3 className="font-bold text-sm tracking-wide">Calculix AI Tutor</h3>
                  <p className="text-[12px] text-emerald-400 font-medium flex items-center gap-1">
                    <span
                      ref={statusDotRef}
                      className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"
                    />{' '}
                    {userApiKey ? '🔑 Custom API Key' : 'Socratic math coach'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  title="Configure Gemini API Key"
                  onClick={() => setShowKeyModal(!showKeyModal)}
                  className={`p-2 rounded-full transition-colors cursor-pointer ${
                    userApiKey ? 'text-amber-400 hover:bg-ink-800' : 'text-stone-400 hover:text-white hover:bg-ink-800'
                  }`}
                >
                  <Key className="w-4 h-4" />
                </button>
                <button id="btn-close-ai-tutor" onClick={() => setIsOpen(false)} className="hover:bg-ink-800 p-2 rounded-full transition-colors text-stone-400 hover:text-white cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Inline Key Configuration Modal */}
            {showKeyModal && (
              <div className="bg-surface-sunken p-4 border-b border-line space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-content flex items-center gap-1.5 font-mono">
                    <Key className="w-4 h-4 text-amber-500" /> Enter Gemini API Key
                  </span>
                  <button type="button" onClick={() => setShowKeyModal(false)} className="text-content-subtle hover:text-content text-xs">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <input
                  type="password"
                  value={userApiKey}
                  onChange={(e) => setUserApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-content text-xs font-mono"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleSaveInlineKey('')}
                    className="px-3 py-1 rounded text-xs text-rose-500 hover:bg-rose-500/10 font-mono"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveInlineKey(userApiKey)}
                    className="px-3 py-1 rounded bg-indigo-600 text-white text-xs font-mono font-semibold flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" /> Save
                  </button>
                </div>
              </div>
            )}

            <div className="bg-indigo-500/10 border-b border-indigo-500/20 p-3 text-xs text-indigo-400 flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <span><strong>Tip:</strong> Ask about a theorem, an inequality, or paste your own approach for feedback.</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-surface-sunken/60">
              {messages.map((msg) => (
                <m.div
                  key={msg.id}
                  initial={{ opacity: 0, y: travel.sm, x: msg.sender === 'user' ? travel.md : -travel.md }}
                  animate={{ opacity: 1, y: 0, x: 0 }}
                  transition={spring.smooth}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex items-start gap-2.5 max-w-[85%] ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                    {msg.sender === 'tutor' && (
                      <div className="bg-surface-sunken p-1.5 rounded-lg shrink-0 border border-line"><Bot className="w-4 h-4 text-indigo-500" /></div>
                    )}
                    <div className={`rounded-xl p-3.5 text-xs leading-relaxed font-mono shadow-sm ${msg.sender === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-surface-raised text-content rounded-tl-none border border-line'}`}>
                      <MathText text={msg.text} as="div" />
                      <span className="text-[10px] block text-right mt-1.5 opacity-60">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </m.div>
              ))}

              <AnimatePresence>
                {loading && (
                  <m.div
                    key="thinking"
                    initial={{ opacity: 0, y: travel.sm, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96, transition: { duration: duration.instant, ease: ease.exit } }}
                    transition={spring.snappy}
                    className="flex justify-start"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="bg-surface-sunken p-1.5 rounded-lg border border-line"><Bot className="w-4 h-4 text-indigo-500 animate-bounce" /></div>
                      <div className="bg-surface-raised text-content-muted text-xs px-4 py-2.5 rounded-xl rounded-tl-none border border-line shadow-sm flex items-center gap-1.5 italic font-mono">
                        <span className="animate-bounce">&bull;</span>
                        <span className="animate-bounce delay-75">&bull;</span>
                        <span className="animate-bounce delay-150">&bull;</span>
                        Thinking...
                      </div>
                    </div>
                  </m.div>
                )}
              </AnimatePresence>
              <div ref={chatBottomRef} />
            </div>

            <div className="px-4 py-2 bg-surface-raised border-t border-line flex gap-2 overflow-x-auto whitespace-nowrap no-scrollbar scroll-smooth">
              <m.button onClick={() => sendQuickOption('Walk me through the handshake lemma')} whileTap={{ scale: 0.94 }} transition={spring.press} className="text-xs bg-surface-sunken hover:bg-surface-sunken/80 text-content-muted px-3 py-1.5 rounded-lg border border-line transition-colors duration-160 ease-standard shrink-0 cursor-pointer font-mono">
                Handshake lemma
              </m.button>
              <m.button onClick={() => sendQuickOption('How do I apply the AM-GM inequality?')} whileTap={{ scale: 0.94 }} transition={spring.press} className="text-xs bg-surface-sunken hover:bg-surface-sunken/80 text-content-muted px-3 py-1.5 rounded-lg border border-line transition-colors duration-160 ease-standard shrink-0 cursor-pointer font-mono">
                AM-GM inequality
              </m.button>
              <m.button onClick={() => sendQuickOption('Give me a hint on combinatorial geometry')} whileTap={{ scale: 0.94 }} transition={spring.press} className="text-xs bg-surface-sunken hover:bg-surface-sunken/80 text-content-muted px-3 py-1.5 rounded-lg border border-line transition-colors duration-160 ease-standard shrink-0 cursor-pointer font-mono">
                Combinatorial geometry
              </m.button>
            </div>

            <form onSubmit={handleSendMessage} className="p-3 bg-surface-raised border-t border-line flex gap-2">
              <input
                id="field-chat-input"
                type="text"
                placeholder="Ask about inequalities, remainders, derivatives..."
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                disabled={loading}
                className="flex-1 bg-surface-sunken border border-line focus:border-indigo-500 rounded-xl px-4 py-3 text-xs outline-hidden text-content disabled:opacity-55 placeholder:text-content-subtle font-mono"
              />
              <m.button
                id="btn-send-chat"
                type="submit"
                disabled={!inputVal.trim() || loading}
                whileTap={{ scale: 0.92 }}
                transition={spring.press}
                className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-xl shadow-md transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer flex items-center justify-center shrink-0 w-11 h-11"
              >
                <Send className="w-4 h-4" />
              </m.button>
            </form>
          </m.div>
        </m.div>
      )}
      </AnimatePresence>
    </>
  );
}
