/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The drawing each badge is struck with, by badge id. One table, so the note
 * that announces a badge and the shelf that keeps it show the same coin.
 */

import { Crown, Dices, Flame, Ruler, Sprout, Trophy, Zap, type LucideIcon } from 'lucide-react';

const BADGE_ICONS: Record<string, LucideIcon> = { b1: Sprout, b2: Ruler, b3: Dices, b4: Trophy, b5: Flame, b6: Zap, b7: Crown };

export const badgeIcon = (id: string): LucideIcon => BADGE_ICONS[id] ?? Trophy;
