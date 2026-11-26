/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Circles: small open groups that work through one thing together, the way a
 * maths circle does. A circle has a name, a line about what it is for, and
 * members; a post made inside one is filed under it.
 *
 * Three pieces: the list in the side column, the header a circle gets above
 * its feed, and the dialog that starts one. Data and rules are in
 * `services/data/circles.ts`.
 */

import React, { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { CIRCLE_ABOUT_MAX, CIRCLE_NAME_MAX, type Circle } from '../../services/data/circles';
import { plural } from './model';
import { AutoTextarea, Dialog } from './ui';
import '../../styles/community-circles.css';

const RING_MAX = 12;

/**
 * A circle drawn as its members: one point on the ring for each, up to twelve.
 * An empty circle is a dashed ring waiting for its first.
 */
export function MemberRing({ members, size = 28 }: { members: number; size?: number }) {
  const points = Math.max(0, Math.min(RING_MAX, members));
  const radius = 9.5;
  return (
    <svg className="cc-ring" width={size} height={size} viewBox="0 0 28 28" aria-hidden="true" focusable="false">
      <circle className="cc-ring-line" cx="14" cy="14" r={radius} fill="none" strokeDasharray={points === 0 ? '2.4 3' : undefined} />
      {Array.from({ length: points }, (_, index) => {
        const angle = (index / points) * Math.PI * 2 - Math.PI / 2;
        return <circle key={index} className="cc-ring-point" cx={14 + radius * Math.cos(angle)} cy={14 + radius * Math.sin(angle)} r={points > 8 ? 1.7 : 2.1} />;
      })}
    </svg>
  );
}

/** The circles there are, the ones you are in first, and the way to start another. */
export function CircleList({
  circles,
  joined,
  selected,
  loading,
  error,
  canStart,
  onSelect,
  onStart,
}: {
  circles: Circle[];
  joined: ReadonlySet<string>;
  selected: string | null;
  loading: boolean;
  error: string | null;
  /** False for a guest, who can look but not start one. */
  canStart: boolean;
  onSelect: (circle: Circle | null) => void;
  onStart: () => void;
}) {
  const ordered = [...circles].sort((a, b) => Number(joined.has(b.id)) - Number(joined.has(a.id)));
  return (
    <section className="cm-side-card" aria-labelledby="cm-circles">
      <div className="cc-head">
        <h3 id="cm-circles">Circles</h3>
        {canStart && (
          <button type="button" className="cc-start" onClick={onStart}>
            <Plus size={14} aria-hidden="true" /> Start one
          </button>
        )}
      </div>
      {error ? (
        <p className="cm-muted" role="alert">
          {error}
        </p>
      ) : ordered.length === 0 ? (
        <p className="cm-muted">{loading ? 'Loading circles…' : 'No circles yet. Start one for your school, a contest you are training for, or a topic.'}</p>
      ) : (
        <ul className="cc-list">
          {ordered.map((circle) => (
            <li key={circle.id}>
              <button type="button" className="cc-row" aria-pressed={selected === circle.id} onClick={() => onSelect(selected === circle.id ? null : circle)}>
                <MemberRing members={circle.member_count} />
                <span className="cc-row-name">
                  <strong>{circle.name}</strong>
                  <small>{plural(circle.member_count, 'member')}</small>
                </span>
                {joined.has(circle.id) && (
                  <span className="cc-in">
                    <Check size={13} aria-hidden="true" /> Joined
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** What a circle shows above its own feed: what it is, who is in it, and the way in or out. */
export function CircleHeader({
  circle,
  isMember,
  canJoin,
  busy,
  onToggle,
  onClose,
}: {
  circle: Circle;
  isMember: boolean;
  /** False for a guest. */
  canJoin: boolean;
  busy: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const since = new Date(circle.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  return (
    <section className="cc-header" aria-labelledby="cc-header-name">
      <MemberRing members={circle.member_count} size={52} />
      <div className="cc-header-text">
        <h2 id="cc-header-name">{circle.name}</h2>
        {circle.description && <p className="cc-header-about">{circle.description}</p>}
        <p className="cc-header-meta">
          {plural(circle.member_count, 'member')} · since {since}
          {isMember ? ' · you are in this circle' : ''}
        </p>
      </div>
      <div className="cc-header-actions">
        {canJoin && (
          <button type="button" className={`cm-button ${isMember ? 'is-quiet' : 'is-primary'}`} disabled={busy} onClick={onToggle}>
            {isMember ? 'Leave' : 'Join circle'}
          </button>
        )}
        <button type="button" className="cm-link-button cc-header-back" onClick={onClose}>
          Back to everyone
        </button>
      </div>
    </section>
  );
}

/** Start a circle: a name, and optionally a line about what it is for. */
export function StartCircleDialog({
  onSubmit,
  onClose,
}: {
  onSubmit: (name: string, about: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [about, setAbout] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ready = name.trim().length >= 2 && about.length <= CIRCLE_ABOUT_MAX;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !ready) return;
    setBusy(true);
    setError('');
    const result = await onSubmit(name, about);
    setBusy(false);
    if (result.ok) onClose();
    else setError(result.error);
  };

  return (
    <Dialog title="Start a circle" onClose={busy ? () => undefined : onClose} size="sm">
      <form className="cm-dialog-body cc-form" onSubmit={(event) => void submit(event)}>
        <p className="cm-muted cc-form-lede">A circle is open: anyone can find it, read it and join. Posts made in it are filed under its name.</p>
        <label className="cc-field">
          <span>Name</span>
          <input
            data-autofocus
            value={name}
            maxLength={CIRCLE_NAME_MAX}
            placeholder="AMC 10 spring group"
            onChange={(event) => setName(event.target.value)}
            required
            minLength={2}
          />
        </label>
        <label className="cc-field">
          <span>
            What it is for <small>optional</small>
          </span>
          <AutoTextarea value={about} maxLength={CIRCLE_ABOUT_MAX} maxHeight={160} placeholder="One geometry problem a day until the contest." onChange={(event) => setAbout(event.target.value)} />
        </label>
        {error && (
          <p role="alert" className="cm-error-text">
            {error}
          </p>
        )}
        <div className="cc-form-actions">
          <button type="button" className="cm-button is-quiet" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="cm-button is-primary" disabled={busy || !ready}>
            {busy ? 'Starting…' : 'Start circle'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
