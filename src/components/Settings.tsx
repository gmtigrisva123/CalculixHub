/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { m } from 'motion/react';
import { Settings as SettingsIcon, Bell, Target, Clock, Check, Save, Key, Eye, EyeOff, RefreshCw, Trash2 } from 'lucide-react';
import { spring } from '../lib/motion';

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

  useEffect(() => {
    const savedKey = localStorage.getItem('calculix_gemini_api_key') || '';
    setApiKey(savedKey);
  }, []);

  const handleSaveApiKey = () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      localStorage.removeItem('calculix_gemini_api_key');
      setKeyNotice({ text: 'API Key removed. AI Assistant will use default engine.', success: true });
      return;
    }

    localStorage.setItem('calculix_gemini_api_key', trimmed);
    setKeyNotice({ text: 'Gemini API Key saved successfully!', success: true });
  };

  const handleTestApiKey = async () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      setKeyNotice({ text: 'Please enter a Gemini API Key to test.', success: false });
      return;
    }

    setTestingKey(true);
    setKeyNotice(null);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(trimmed)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Hello' }] }],
          }),
        }
      );

      const data = await response.json();
      if (response.ok && data?.candidates) {
        localStorage.setItem('calculix_gemini_api_key', trimmed);
        setKeyNotice({ text: '✓ API Key verified! Live Gemini AI Tutor is ready.', success: true });
      } else {
        const errorMsg = data?.error?.message || 'Invalid API Key response';
        setKeyNotice({ text: `Connection failed: ${errorMsg}`, success: false });
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Network error';
      setKeyNotice({ text: `Test failed: ${errorMessage}`, success: false });
    } finally {
      setTestingKey(false);
    }
  };

  const handleClearApiKey = () => {
    setApiKey('');
    localStorage.removeItem('calculix_gemini_api_key');
    setKeyNotice({ text: 'API Key cleared.', success: true });
  };
  const goalOptions = [
    'Qualify for AMC 8 / AMC 10',
    'Qualify for AIME',
    'Qualify for USAMO / National Olympiad',
    'Build fundamental mathematical problem-solving skills',
  ];

  const paceOptions = [
    '15 minutes / day (Casual)',
    '30 minutes / day (Recommended)',
    '60 minutes / day (Intensive)',
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-line pb-4">
        <p className="type-eyebrow text-indigo-500 font-mono text-xs uppercase">MAKE THIS SPACE YOURS</p>
        <h1 className="type-title text-2xl font-bold text-content mt-1 flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-indigo-500" /> A rhythm that works for you
        </h1>
      </div>

      <form onSubmit={onSaveSettings} className="space-y-6 max-w-3xl">
        {/* Target Goal Setting */}
        <div className="cx-glass-panel p-6 space-y-4">
          <h3 className="type-title text-base font-bold text-content flex items-center gap-2">
            <Target className="w-5 h-5 text-amber-500" /> Target Competition Goal
          </h3>

          <div className="space-y-2.5">
            {goalOptions.map((goal) => (
              <label
                key={goal}
                className={`p-3.5 rounded-xl border flex items-center gap-3 cursor-pointer transition-colors ${
                  customGoal === goal
                    ? 'border-indigo-500/60 bg-indigo-500/10 font-semibold text-content'
                    : 'border-line bg-surface-sunken/30 text-content-muted hover:border-line-strong'
                }`}
              >
                <input
                  type="radio"
                  name="customGoal"
                  value={goal}
                  checked={customGoal === goal}
                  onChange={(e) => setCustomGoal(e.target.value)}
                  className="accent-indigo-500"
                />
                <span className="text-xs font-mono">{goal}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Daily Pace Setting */}
        <div className="cx-glass-panel p-6 space-y-4">
          <h3 className="type-title text-base font-bold text-content flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-500" /> Daily Practice Pace
          </h3>

          <div className="space-y-2.5">
            {paceOptions.map((pace) => (
              <label
                key={pace}
                className={`p-3.5 rounded-xl border flex items-center gap-3 cursor-pointer transition-colors ${
                  studyPace === pace
                    ? 'border-indigo-500/60 bg-indigo-500/10 font-semibold text-content'
                    : 'border-line bg-surface-sunken/30 text-content-muted hover:border-line-strong'
                }`}
              >
                <input
                  type="radio"
                  name="studyPace"
                  value={pace}
                  checked={studyPace === pace}
                  onChange={(e) => setStudyPace(e.target.value)}
                  className="accent-indigo-500"
                />
                <span className="text-xs font-mono">{pace}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Notification Reminders Setting */}
        <div className="cx-glass-panel p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="type-title text-base font-bold text-content flex items-center gap-2">
              <Bell className="w-5 h-5 text-emerald-500" /> Daily Push Reminders
            </h3>

            <button
              type="button"
              onClick={() => onToggleReminders(!studyReminders)}
              className={`w-12 h-6 rounded-full p-1 transition-colors ${
                studyReminders ? 'bg-indigo-600' : 'bg-line'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  studyReminders ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <p className="text-xs text-content-muted font-mono leading-relaxed">
            Receive daily reminders to maintain your problem-solving streak.
          </p>

          {reminderNotice && (
            <p className="text-xs font-mono text-amber-500 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
              {reminderNotice}
            </p>
          )}
        </div>

        {/* Gemini API Key Configuration */}
        <div className="cx-glass-panel p-6 space-y-4 border border-indigo-500/30">
          <div className="flex items-center justify-between">
            <h3 className="type-title text-base font-bold text-content flex items-center gap-2">
              <Key className="w-5 h-5 text-amber-500" /> Gemini API Key for Math Assistant
            </h3>
            {apiKey.trim() && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 font-bold">
                Key Saved
              </span>
            )}
          </div>

          <p className="text-xs text-content-muted leading-relaxed font-mono">
            Use your own Google Gemini API key for live explanations. Your Google account's usage limits and charges may apply.
          </p>

          <div className="space-y-3">
            <div className="relative flex items-center">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full px-4 py-3 rounded-xl border border-line bg-surface-sunken font-mono text-xs text-content pr-10 focus:outline-hidden focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 text-content-subtle hover:text-content p-1 cursor-pointer"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <m.button
                type="button"
                onClick={handleSaveApiKey}
                whileTap={{ scale: 0.95 }}
                className="cx-btn cx-btn-secondary px-4 py-2 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" /> Save API Key
              </m.button>

              <m.button
                type="button"
                onClick={handleTestApiKey}
                disabled={testingKey || !apiKey.trim()}
                whileTap={{ scale: 0.95 }}
                className="cx-btn cx-btn-primary px-4 py-2 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 disabled:opacity-50"
              >
                {testingKey ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Testing...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" /> Test Connection
                  </>
                )}
              </m.button>

              {apiKey.trim() && (
                <m.button
                  type="button"
                  onClick={handleClearApiKey}
                  whileTap={{ scale: 0.95 }}
                  className="px-3 py-2 rounded-lg text-xs font-mono font-semibold text-rose-500 hover:bg-rose-500/10 border border-rose-500/20 transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear
                </m.button>
              )}
            </div>

            {keyNotice && (
              <p
                className={`text-xs font-mono p-3 rounded-lg border leading-relaxed ${
                  keyNotice.success
                    ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30'
                    : 'text-rose-500 bg-rose-500/10 border-rose-500/30'
                }`}
              >
                {keyNotice.text}
              </p>
            )}
          </div>
        </div>

        {/* Save Actions */}
        <div className="flex items-center gap-4 pt-2">
          <m.button
            type="submit"
            whileTap={{ scale: 0.96 }}
            className="cx-btn cx-btn-fill px-6 py-3 rounded-xl text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium flex items-center gap-2 shadow-lg shadow-indigo-500/25"
          >
            <Save className="w-4 h-4" /> Save Settings
          </m.button>

          {saveSuccessNotify && (
            <m.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-xs font-mono text-emerald-500 flex items-center gap-1 font-bold"
            >
              <Check className="w-4 h-4" /> Settings saved successfully!
            </m.span>
          )}
        </div>
      </form>
    </div>
  );
}
