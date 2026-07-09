/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X, MessageSquare, Bot, HelpCircle, ArrowRight } from 'lucide-react';

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
      text: 'Welcome! My name is *Calculix AI Tutor*. I am always ready to accompany you in exploring the beauty of mathematics from algebra to graphs using the Socratic method of asking guiding questions. What content are you having trouble with or would you like me to guide you through?',
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
      const response = await fetch('/api/chat', {
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
          text: data.reply || 'I didn\'t quite understand that question. Could you rephrase it?',
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
          text: 'I am facing some technical difficulties regarding connection, please try again!',
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
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-5 py-3.5 rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 group cursor-pointer"
      >
        <Sparkles className="w-5 h-5 animate-pulse text-yellow-300 group-hover:scale-110 transition-transform" />
        <span className="font-semibold tracking-wide text-sm">Ask AI Tutor</span>
        <div className="absolute -top-1 -right-1 block h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-white animate-ping" />
      </button>

      {/* Slide-out Sidebar Drawer for Chat */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity duration-300">
          {/* Overlay dismissal */}
          <div className="flex-1" onClick={() => setIsOpen(false)} />

          {/* Chat Container */}
          <div
            id="panel-ai-tutor"
            className="w-full max-w-md h-full bg-white shadow-2xl flex flex-col relative animate-in slide-in-from-right duration-300 border-l border-slate-100"
          >
            {/* Header */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="bg-gradient-to-tr from-blue-500 to-indigo-500 p-2 rounded-lg">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-wide">Calculix AI Tutor</h3>
                  <p className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Socratic Math Coach
                  </p>
                </div>
              </div>
              <button
                id="btn-close-ai-tutor"
                onClick={() => setIsOpen(false)}
                className="hover:bg-slate-800 p-2 rounded-full transition-colors text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Info Banner */}
            <div className="bg-blue-50/70 border-b border-blue-100/60 p-3 text-xs text-blue-800 flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                <strong>Thinking tip:</strong> Ask about theorems, inequalities, reasoning, or send your problem-solving approach for the most scientific guided analysis.
              </span>
            </div>

            {/* Message Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex items-start gap-2.5 max-w-[85%] ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                    {msg.sender === 'tutor' && (
                      <div className="bg-slate-100 p-1.5 rounded-lg shrink-0 border border-slate-200">
                        <Bot className="w-4 h-4 text-slate-700" />
                      </div>
                    )}
                    <div
                      className={`rounded-2xl p-3.5 shadow-xs text-sm leading-relaxed ${
                        msg.sender === 'user'
                          ? 'bg-slate-900 text-white rounded-tr-none font-medium'
                          : 'bg-white text-slate-800 rounded-tl-none border border-slate-100'
                      }`}
                    >
                      {/* Simple Inline Markdown Styling */}
                      <p className="whitespace-pre-wrap">
                        {msg.text.split('\n').map((line, idx) => {
                          // Simple formatting for bold and italic
                          let formatted = line
                            .replace(/\*\*(.*?)\*\*/g, '$1')
                            .replace(/\*(.*?)\*/g, '$1');
                          return (
                            <span key={idx} className="block mt-1 first:mt-0">
                              {formatted}
                            </span>
                          );
                        })}
                      </p>
                      <span
                        className={`text-[9px] block text-right mt-1.5 ${
                          msg.sender === 'user' ? 'text-slate-400' : 'text-slate-400'
                        }`}
                      >
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2.5">
                    <div className="bg-slate-100 p-1.5 rounded-lg border border-slate-200">
                      <Bot className="w-4 h-4 text-slate-500 animate-bounce" />
                    </div>
                    <div className="bg-white text-slate-500 text-xs px-4 py-2.5 rounded-2xl rounded-tl-none border border-slate-100 shadow-xs flex items-center gap-1.5 italic">
                      <span className="dot animate-bounce">●</span>
                      <span className="dot animate-bounce delay-75">●</span>
                      <span className="dot animate-bounce delay-150">●</span>
                      Teacher is analyzing...
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Quick Suggestions list */}
            <div className="px-4 py-2 bg-white border-t border-slate-100 flex gap-2 overflow-x-auto whitespace-nowrap no-scrollbar scroll-smooth">
              <button
                onClick={() => sendQuickOption('Deeper analysis on the handshake problem')}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 transition-all shrink-0 cursor-pointer"
              >
                🤝 Handshake Challenge
              </button>
              <button
                onClick={() => sendQuickOption('How to apply the AM-GM inequality')}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 transition-all shrink-0 cursor-pointer"
              >
                ⚖️ AM-GM Inequality
              </button>
              <button
                onClick={() => sendQuickOption('Give me study tips for combinatorial geometry')}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 transition-all shrink-0 cursor-pointer"
              >
                📐 Combinatorial Geometry
              </button>
            </div>

            {/* Input Footer */}
            <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-100 flex gap-2">
              <input
                id="field-chat-input"
                type="text"
                placeholder="Discuss inequalities, modular arithmetic, derivatives..."
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                disabled={loading}
                className="flex-1 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl px-4 py-3 text-sm outline-hidden transition-all text-slate-800 disabled:opacity-55 placeholder:text-slate-400"
              />
              <button
                id="btn-send-chat"
                type="submit"
                disabled={!inputVal.trim() || loading}
                className="bg-slate-900 hover:bg-black text-white p-3 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none cursor-pointer flex items-center justify-center shrink-0 w-11 h-11"
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
