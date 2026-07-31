/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X, Bot, HelpCircle } from 'lucide-react';
import MathText from './MathText';
import { apiUrl } from '../lib/apiBase';

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
      <button
        id="btn-ai-tutor-toggle"
        onClick={() => setIsOpen(!isOpen)}
        className="tutor-fab fixed right-3.5 md:right-6 z-50 flex items-center gap-2 bg-gradient-to-r from-brass-600 to-brass-500 hover:from-brass-500 hover:to-brass-400 text-ink-950 px-4 md:px-5 py-3 md:py-3.5 rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 group cursor-pointer"
      >
        <Sparkles className="w-5 h-5 animate-pulse group-hover:scale-110 transition-transform" />
        <span className="font-bold tracking-wide text-sm">Ask AI Tutor</span>
        <div className="absolute -top-1 -right-1 block h-3 w-3 rounded-full bg-proof-400 ring-2 ring-white animate-ping" />
      </button>

      {/* Slide-out Sidebar Drawer for Chat */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity duration-300">
          <div className="flex-1" onClick={() => setIsOpen(false)} />

          <div id="panel-ai-tutor" className="w-full max-w-md h-full bg-white shadow-2xl flex flex-col relative border-l border-stone-100">
            <div className="bg-ink-950 text-white p-4 flex items-center justify-between border-b border-ink-800">
              <div className="flex items-center gap-2.5">
                <div className="bg-gradient-to-tr from-brass-500 to-brass-700 p-2 rounded-lg"><Bot className="w-5 h-5 text-ink-950" /></div>
                <div>
                  <h3 className="font-bold text-sm tracking-wide">Calculix AI Tutor</h3>
                  <p className="text-[11px] text-proof-400 font-medium flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-proof-400 animate-pulse" /> Socratic math coach
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
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex items-start gap-2.5 max-w-[85%] ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                    {msg.sender === 'tutor' && (
                      <div className="bg-stone-100 p-1.5 rounded-lg shrink-0 border border-stone-200"><Bot className="w-4 h-4 text-stone-700" /></div>
                    )}
                    <div className={`rounded-2xl p-3.5 shadow-xs text-sm leading-relaxed ${msg.sender === 'user' ? 'bg-ink-950 text-white rounded-tr-none font-medium' : 'bg-white text-stone-800 rounded-tl-none border border-stone-100'}`}>
                      <MathText text={msg.text} as="div" />
                      <span className="text-[9px] block text-right mt-1.5 text-stone-400">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2.5">
                    <div className="bg-stone-100 p-1.5 rounded-lg border border-stone-200"><Bot className="w-4 h-4 text-stone-500 animate-bounce" /></div>
                    <div className="bg-white text-stone-500 text-xs px-4 py-2.5 rounded-2xl rounded-tl-none border border-stone-100 shadow-xs flex items-center gap-1.5 italic">
                      <span className="animate-bounce">&bull;</span>
                      <span className="animate-bounce delay-75">&bull;</span>
                      <span className="animate-bounce delay-150">&bull;</span>
                      Thinking...
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            <div className="px-4 py-2 bg-white border-t border-stone-100 flex gap-2 overflow-x-auto whitespace-nowrap no-scrollbar scroll-smooth">
              <button onClick={() => sendQuickOption('Walk me through the handshake lemma')} className="text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-1.5 rounded-lg border border-stone-200 transition-all shrink-0 cursor-pointer">
                Handshake lemma
              </button>
              <button onClick={() => sendQuickOption('How do I apply the AM-GM inequality?')} className="text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-1.5 rounded-lg border border-stone-200 transition-all shrink-0 cursor-pointer">
                AM-GM inequality
              </button>
              <button onClick={() => sendQuickOption('Give me a hint on combinatorial geometry')} className="text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-1.5 rounded-lg border border-stone-200 transition-all shrink-0 cursor-pointer">
                Combinatorial geometry
              </button>
            </div>

            <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-stone-100 flex gap-2">
              <input
                id="field-chat-input"
                type="text"
                placeholder="Ask about inequalities, remainders, derivatives..."
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                disabled={loading}
                className="flex-1 bg-stone-50 border border-stone-200 focus:border-brass-500 rounded-xl px-4 py-3 text-sm outline-hidden transition-all text-stone-800 disabled:opacity-55 placeholder:text-stone-400"
              />
              <button
                id="btn-send-chat"
                type="submit"
                disabled={!inputVal.trim() || loading}
                className="bg-ink-950 hover:bg-black text-white p-3 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none cursor-pointer flex items-center justify-center shrink-0 w-11 h-11"
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
