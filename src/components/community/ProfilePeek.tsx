/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * A learner at a glance: who they are, whether you follow them, and a way to
 * read only what they have written. Opened from a name or an avatar anywhere
 * in the feed.
 */

import { useEffect, useRef, useState } from 'react';
import { Check, ScrollText, UserPlus } from 'lucide-react';
import { figureFor } from '../../domain/figure';
import type { AuthorSummary, ProfileRow } from '../../services/database.types';
import { fetchProfile } from '../../services/data/people';
import { authorName } from './model';
import { Avatar, Dialog } from './ui';

export default function ProfilePeek({
  person,
  isSelf,
  canFollow,
  following,
  onToggleFollow,
  onSeePosts,
  onClose,
}: {
  /** What the feed already knows about them, shown while the rest loads. */
  person: Pick<AuthorSummary, 'id' | 'username' | 'display_name' | 'avatar_url'> & { level?: string | null };
  isSelf: boolean;
  /** False for a guest, who is shown the profile without the button. */
  canFollow: boolean;
  following: boolean;
  onToggleFollow: () => void;
  onSeePosts: () => void;
  onClose: () => void;
}) {
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchProfile(person.id)
      .then((row) => alive && setProfile(row))
      .catch((reason: unknown) => alive && setError(reason instanceof Error ? reason.message : 'Could not load that profile.'));
    return () => {
      alive = false;
    };
  }, [person.id]);

  const shown = profile ?? person;
  const level = profile?.level ?? person.level;
  const joined = profile?.created_at ? new Date(profile.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : null;
  // The count moves with the button, without waiting for the profile to be read again.
  const loadedAs = useRef(following);
  const followers = profile ? Math.max(0, profile.follower_count + (following === loadedAs.current ? 0 : following ? 1 : -1)) : null;

  return (
    <Dialog title={authorName(shown)} onClose={onClose} size="sm" className="cm-peek-dialog" hideHeader>
      <div className="cm-peek">
        <div className="cm-peek-top">
          <Avatar author={shown} size={76} />
          <div className="cm-peek-id">
            <h2>{authorName(shown)}</h2>
            <p>
              {shown.username ? `@${shown.username}` : 'Learner'}
              {level ? ` · ${level}` : ''}
              {profile?.country ? ` · ${profile.country}` : ''}
            </p>
          </div>
        </div>

        {profile?.bio && <p className="cm-peek-bio">{profile.bio}</p>}
        {error && (
          <p role="alert" className="cm-error-text">
            {error}
          </p>
        )}

        <dl className="cm-peek-facts">
          <div>
            <dt>Followers</dt>
            <dd>{followers === null ? '–' : followers.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Following</dt>
            <dd>{profile ? profile.following_count.toLocaleString() : '–'}</dd>
          </div>
          <div>
            <dt>Joined</dt>
            <dd>{joined ?? '–'}</dd>
          </div>
        </dl>

        {!shown.avatar_url && (
          <p className="cm-peek-figure">
            Their figure is <strong>{figureFor(person.id).phrase}</strong>. Everyone without a photo is drawn as a curve of their own.
          </p>
        )}

        <div className="cm-peek-actions">
          {!isSelf && canFollow && (
            <button type="button" className={`cm-button ${following ? 'is-quiet' : 'is-primary'}`} aria-pressed={following} onClick={onToggleFollow}>
              {following ? <Check size={16} aria-hidden="true" /> : <UserPlus size={16} aria-hidden="true" />}
              {following ? 'Following' : 'Follow'}
            </button>
          )}
          <button type="button" className="cm-button is-quiet" onClick={onSeePosts}>
            <ScrollText size={16} aria-hidden="true" /> {isSelf ? 'Your posts' : 'See their posts'}
          </button>
          <button type="button" className="cm-button is-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </Dialog>
  );
}
