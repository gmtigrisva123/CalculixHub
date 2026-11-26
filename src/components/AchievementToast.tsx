/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The note that says a badge was earned.
 *
 * It is a slip of paper at the edge of the screen, not a celebration: the coin
 * the badge is struck with, its name, what earned it, and a way to the shelf
 * it now sits on. It leaves on its own, and waits while the pointer or the
 * keyboard is on it.
 */

import React, { useEffect, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { X } from 'lucide-react';
import type { Achievement } from '../domain/achievements';
import { duration, ease } from '../lib/motion';
import { badgeIcon } from './badgeIcons';

const STAYS_MS = 6500;

interface AchievementToastProps {
  achievement: Achievement | null;
  onClose: () => void;
  onNavigateToProfile?: () => void;
}

export default function AchievementToast({ achievement, onClose, onNavigateToProfile }: AchievementToastProps) {
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (!achievement || held) return;
    const timer = window.setTimeout(onClose, STAYS_MS);
    return () => window.clearTimeout(timer);
  }, [achievement, held, onClose]);

  const Icon = achievement ? badgeIcon(achievement.id) : null;

  return (
    <AnimatePresence>
      {achievement && Icon && (
        <m.div
          key={achievement.id}
          role="status"
          className="badge-note"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0, transition: { duration: duration.base, ease: ease.standard } }}
          exit={{ opacity: 0, y: 6, transition: { duration: duration.fast, ease: ease.exit } }}
          onPointerEnter={() => setHeld(true)}
          onPointerLeave={() => setHeld(false)}
          onFocus={() => setHeld(true)}
          onBlur={() => setHeld(false)}
        >
          <span className="badge-note-coin" aria-hidden="true">
            <Icon size={19} strokeWidth={1.8} />
          </span>
          <div className="badge-note-text">
            <p className="badge-note-label">New badge</p>
            <p className="badge-note-title">{achievement.title}</p>
            <p className="badge-note-desc">{achievement.desc}</p>
            {onNavigateToProfile && (
              <button
                type="button"
                className="badge-note-link"
                onClick={() => {
                  onClose();
                  onNavigateToProfile();
                }}
              >
                See your badges
              </button>
            )}
          </div>
          <button type="button" className="badge-note-close" onClick={onClose} aria-label="Dismiss">
            <X size={16} aria-hidden="true" />
          </button>
        </m.div>
      )}
    </AnimatePresence>
  );
}
