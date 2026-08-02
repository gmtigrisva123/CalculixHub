/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { Sparkles, Send, X, Bot, HelpCircle } from 'lucide-react';
import MathText from './MathText';
import { apiUrl } from '../lib/apiBase';
import { backdrop, duration, ease, spring, travel } from '../lib/motion';
import { useAmbient } from '../lib/useAmbient';
import { useIsDesktop } from '../lib/useBreakpoint';

interface ChatMessage {
  id: string;
  sender: 'user' | 'tutor';
  text: string;
  timestamp: Date;
}

export default function AITutorChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init',
      sender: 'tutor',
      text: "Hi, I'm the Calculix AI Tutor. I like to work through problems Socratically, from algebra to graph theory, rather than just handing you an answer. What are you stuck on, or what kind of problem would you like to train on?",
      timestamp: new Date(),
    },
  ]);
  const [inputVal, setInputVal] = useState('');
  const [loading, setLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // The launcher's two perpetual loops. Both stop once the button scrolls out
  // of view or the app is backgrounded; neither changes appearance while shown.
  const sparkleRef = useAmbient<SVGSVGElement>();
  const pingRef = useAmbient<HTMLDivElement>();
  const statusDotRef = useAmbient<HTMLSpanElement>();

  // Picks the axis the panel travels along: up from the bottom on a phone,
  // in from the right on a desktop.
  const isDesktop = useIsDesktop();

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputVal.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: inputVal,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputVal('');
    setLoading(true);

    try {
      const response = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.text,
          history: messages.map((m) => ({ role: m.sender, content: m.text })),
        }),
      });
      const data = await response.json();
      
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'tutor',
          text: data.reply || "I didn't quite follow that — could you rephrase it?",
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'tutor',
          text: 'Hit a connection hiccup on my end — try again in a moment.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Quick suggestions
  const sendQuickOption = (promptText: string) => {
    setInputVal(promptText);
    setTimeout(() => {
      // Trigger send automatically
      setInputVal(promptText);
    }, 50);
  };

  return (
    <>
      {/* Floating Chat Button */}
      <m.button
        id="btn-ai-tutor-toggle"
        onClick={() => setIsOpen(!isOpen)}
        whileTap={{ scale: 0.95 }}
        transition={spring.press}
        className="tutor-fab fixed right-3.5 md:right-6 z-50 flex items-center gap-2 bg-gradient-to-r from-brass-600 to-brass-500 hover:from-brass-500 hover:to-brass-400 text-ink-950 px-4 md:px-5 py-3 md:py-3.5 rounded-full shadow-e3 hover:shadow-e4 transition-[box-shadow,background-color] duration-300 ease-standard group cursor-pointer"
      >
        <Sparkles
          ref={sparkleRef}
          className="w-5 h-5 animate-pulse group-hover:scale-110 transition-transform duration-160 ease-standard"
        />
        <span className="font-bold tracking-wide text-sm">Ask AI Tutor</span>
        <div
          ref={pingRef}
          className="absolute -top-1 -right-1 block h-3 w-3 rounded-full bg-proof-400 ring-2 ring-white animate-ping"
        />
      </m.button>

      {/* Slide-out Sidebar Drawer for Chat */}
      <AnimatePresence>
      {isOpen && (
        /*
          Bottom sheet on mobile, right-hand drawer at md+.

          flex-col puts the dismiss area above the panel so the sheet rises from
          the bottom edge, where a thumb already is; flex-row at md+ restores
          the original side drawer. Both share the same dismiss-on-backdrop
          child, so there is one panel, not two.

          The scrim and the panel animate as two separate elements rather than
          one. The scrim is a plain crossfade — blurring and un-blurring a
          full-screen backdrop is the single most expensive thing this component
          can do, so it is kept to opacity and given the shortest exit that
          still reads. The panel travels on a spring underneath it.
        */
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
            /*
              One panel, two geometries. Below md it is a bottom sheet and rises
              from the bottom edge; at md+ it is a right-hand drawer and comes
              in from the side. Both are declared here and selected at runtime,
              because animating the wrong axis for the current breakpoint is
              worse than not animating at all — the original CSS keyframe had to
              be disabled at md+ for exactly this reason.
            */
            initial={isDesktop ? { x: '100%' } : { y: '100%' }}
            animate={isDesktop ? { x: 0 } : { y: 0 }}
            exit={isDesktop ? { x: '100%' } : { y: '100%' }}
            transition={spring.gentle}
            className="w-full md:max-w-md h-[76%] md:h-full bg-surface-raised shadow-e4 flex flex-col relative border-l border-stone-100 rounded-t-3xl md:rounded-none overflow-hidden"
          >
            {/* Grab handle: the affordance that says this panel is dismissable. */}
            <div className="md:hidden absolute top-2 left-1/2 -translate-x-1/2 w-9 h-1 rounded-full bg-surface-raised/25 z-10" />
            <div className="bg-ink-950 text-white p-4 flex items-center justify-between border-b border-ink-800">
              <div className="flex items-center gap-2.5">
                <div className="bg-gradient-to-tr from-brass-500 to-brass-700 p-2 rounded-lg"><Bot className="w-5 h-5 text-ink-950" /></div>
                <div>
                  <h3 className="font-bold text-sm tracking-wide">Calculix AI Tutor</h3>
                  <p className="text-[11px] text-proof-400 font-medium flex items-center gap-1">
                    <span
                      ref={statusDotRef}
                      className="inline-block w-1.5 h-1.5 rounded-full bg-proof-400 animate-pulse"
                    />{' '}
                    Socratic math coach
                  </p>
                </div>
              </div>
              <button id="btn-close-ai-tutor" onClick={() => setIsOpen(false)} className="hover:bg-ink-800 p-2 rounded-full transition-colors text-stone-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-brass-50/70 border-b border-brass-100 p-3 text-xs text-brass-800 flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-brass-600 shrink-0 mt-0.5" />
              <span><strong>Tip:</strong> Ask about a theorem, an inequality, or paste your own approach for feedback.</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-stone-50/50">
              {/*
                Each message arrives from the side it belongs to — the
                learner's from the right, the tutor's from the left — so the
                direction of travel reinforces who is speaking before the
                colour of the bubble is even read. The offset is small; this is
                a cue, not a slide-in.
              */}
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
                      <div className="bg-stone-100 p-1.5 rounded-lg shrink-0 border border-stone-200"><Bot className="w-4 h-4 text-stone-700" /></div>
                    )}
                    <div className={`rounded-2xl p-3.5 shadow-e1 text-sm leading-relaxed ${msg.sender === 'user' ? 'bg-ink-950 text-white rounded-tr-none font-medium' : 'bg-surface-raised text-stone-800 rounded-tl-none border border-stone-100'}`}>
                      <MathText text={msg.text} as="div" />
                      <span className="text-[9px] block text-right mt-1.5 text-stone-400">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </m.div>
              ))}
              {/*
                The thinking indicator gets a real exit, so the reply does not
                appear in the same frame the dots vanish. The three dots keep
                their CSS bounce, which is already the right idiom and costs
                nothing while the panel is open.
              */}
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
                      <div className="bg-stone-100 p-1.5 rounded-lg border border-stone-200"><Bot className="w-4 h-4 text-stone-500 animate-bounce" /></div>
                      <div className="bg-surface-raised text-stone-500 text-xs px-4 py-2.5 rounded-2xl rounded-tl-none border border-stone-100 shadow-e1 flex items-center gap-1.5 italic">
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

            <div className="px-4 py-2 bg-surface-raised border-t border-stone-100 flex gap-2 overflow-x-auto whitespace-nowrap no-scrollbar scroll-smooth">
              <m.button onClick={() => sendQuickOption('Walk me through the handshake lemma')} whileTap={{ scale: 0.94 }} transition={spring.press} className="text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-1.5 rounded-lg border border-stone-200 transition-colors duration-160 ease-standard shrink-0 cursor-pointer">
                Handshake lemma
              </m.button>
              <m.button onClick={() => sendQuickOption('How do I apply the AM-GM inequality?')} whileTap={{ scale: 0.94 }} transition={spring.press} className="text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-1.5 rounded-lg border border-stone-200 transition-colors duration-160 ease-standard shrink-0 cursor-pointer">
                AM-GM inequality
              </m.button>
              <m.button onClick={() => sendQuickOption('Give me a hint on combinatorial geometry')} whileTap={{ scale: 0.94 }} transition={spring.press} className="text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-1.5 rounded-lg border border-stone-200 transition-colors duration-160 ease-standard shrink-0 cursor-pointer">
                Combinatorial geometry
              </m.button>
            </div>

            <form onSubmit={handleSendMessage} className="p-3 bg-surface-raised border-t border-stone-100 flex gap-2">
              <input
                id="field-chat-input"
                type="text"
                placeholder="Ask about inequalities, remainders, derivatives..."
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                disabled={loading}
                className="flex-1 bg-stone-50 border border-stone-200 focus:border-brass-500 rounded-xl px-4 py-3 text-sm outline-hidden transition-[border-color,opacity] duration-160 ease-standard text-stone-800 disabled:opacity-55 placeholder:text-stone-400"
              />
              <m.button
                id="btn-send-chat"
                type="submit"
                disabled={!inputVal.trim() || loading}
                whileTap={{ scale: 0.92 }}
                transition={spring.press}
                className="bg-content hover:bg-content-muted text-surface-raised p-3 rounded-xl shadow-e2 transition-[background-color,opacity] duration-160 ease-standard disabled:opacity-30 disabled:pointer-events-none cursor-pointer flex items-center justify-center shrink-0 w-11 h-11"
              >
                <Send className="w-4 h-4 text-white" />
              </m.button>
            </form>
          </m.div>
        </m.div>
      )}
      </AnimatePresence>
    </>
  );
}
