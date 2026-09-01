/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Achievement Unlocked Toast Notification.
 */

import React, { useEffect } from 'react';
import { m, AnimatePresence } from 'motion/react';
import { Sparkles, X, ArrowRight, Award } from 'lucide-react';
import type { Achievement } from '../domain/achievements';
import { spring } from '../lib/motion';

interface AchievementToastProps {
  achievement: Achievement | null;
  onClose: () => void;
  onNavigateToProfile?: () => void;
}

export default function AchievementToast({ achievement, onClose, onNavigateToProfile }: AchievementToastProps) {
  useEffect(() => {
    if (!achievement) return;
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [achievement, onClose]);

  return (
    <AnimatePresence>
      {achievement && (
        <m.div
          initial={{ opacity: 0, y: 32, scale: 0.9, rotateX: -10 }}
          animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={spring.snappy}
          className="fixed bottom-6 right-3.5 md:right-6 z-[9999] max-w-sm w-[calc(100vw-1.75rem)] sm:w-full bg-surface-raised/95 border-2 border-amber-500/50 rounded-2xl p-5 shadow-[0_20px_50px_rgba(245,158,11,0.25)] backdrop-blur-2xl overflow-hidden"
        >
          {/* Ambient Glowing Halo */}
          <div
            className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full opacity-40 blur-3xl animate-pulse"
            style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.9), transparent 70%)' }}
            aria-hidden="true"
          />

          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-start gap-4">
              {/* Glowing 3D Badge Icon Box */}
              <m.div
                initial={{ scale: 0, rotate: -15 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.1 }}
                className="relative flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500/30 to-amber-300/10 border-2 border-amber-400/60 shadow-lg shadow-amber-500/30 text-2xl"
              >
                <span>{achievement.icon}</span>
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
                </span>
              </m.div>

              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/30 text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-300 font-mono">
                  <Sparkles className="h-3 w-3 text-amber-500 animate-spin" style={{ animationDuration: '3s' }} />
                  <span>Achievement Unlocked</span>
                </div>

                <h4 className="font-serif text-lg font-bold text-content leading-tight">
                  {achievement.title}
                </h4>

                <p className="text-xs text-content-muted leading-snug font-sans">
                  {achievement.desc}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="text-content-subtle hover:text-content p-1 rounded-full hover:bg-surface-sunken transition-colors cursor-pointer shrink-0"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Action Row */}
          {onNavigateToProfile && (
            <div className="mt-4 pt-3 border-t border-line flex items-center justify-between">
              <span className="text-[10px] font-mono text-content-subtle uppercase tracking-wider flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-amber-500" /> Badge Added
              </span>

              <m.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  onClose();
                  onNavigateToProfile();
                }}
                className="text-xs font-semibold text-amber-500 hover:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer font-mono"
              >
                <span>View in Profile</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </m.button>
            </div>
          )}

          {/* Auto-Dismiss Progress Bar */}
          <m.div
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: 5, ease: 'linear' }}
            className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-amber-500 to-amber-300"
          />
        </m.div>
      )}
    </AnimatePresence>
  );
}
