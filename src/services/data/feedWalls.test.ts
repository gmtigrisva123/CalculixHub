/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { closedAmong } from './feed';

describe('closedAmong', () => {
  const open = { id: 'open', is_private: false };
  const priv = { id: 'private', is_private: true };

  it('counts a community as open only when its row came back and says so', () => {
    expect([...closedAmong(['open', 'private'], [open, priv])]).toEqual(['private']);
    expect([...closedAmong(['open'], [open])]).toEqual([]);
  });

  it('counts one that could not be read as closed', () => {
    // A private community the viewer is no longer in returns no row at all.
    expect([...closedAmong(['open', 'gone'], [open])]).toEqual(['gone']);
  });

  it('counts every community as closed when the lookup failed', () => {
    expect([...closedAmong(['open', 'private'], null)].sort()).toEqual(['open', 'private']);
    expect([...closedAmong(['open'], [])]).toEqual(['open']);
  });

  it('has nothing to say about a page with no communities in it', () => {
    expect(closedAmong([], null).size).toBe(0);
  });
});
