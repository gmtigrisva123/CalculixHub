/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';

/*
 * Instagram's default profile picture: a white head-and-shoulders silhouette on
 * neutral grey. The outline is traced from Instagram's own default image and
 * mirrored about its centre line, in a 150-unit square.
 */
const SILHOUETTE = 'M75 12 C78.0 12.3 84.1 13.2 87.2 14.0 C90.2 14.8 91.3 15.7 93.2 17.0 C95.0 18.3 96.7 20.0 98.2 22.0 C99.6 24.0 100.9 26.3 101.8 29.0 C102.8 31.7 103.6 34.8 104.0 38.0 C104.4 41.2 104.3 44.7 104.0 48.0 C103.7 51.3 103.3 54.8 102.3 58.0 C101.3 61.2 99.5 64.3 98.0 67.0 C96.5 69.7 94.7 71.8 93.5 74.0 C92.3 76.2 91.4 78.0 91.0 80.0 C90.6 82.0 90.8 84.0 91.0 86.0 C91.2 88.0 91.3 90.3 92.3 92.0 C93.3 93.7 94.4 94.7 97.0 96.0 C99.6 97.3 103.5 98.3 108.2 100.0 C112.9 101.7 120.4 103.7 125.2 106.0 C130.0 108.3 133.8 111.0 137.0 114.0 C140.2 117.0 142.8 120.7 144.7 124.0 C146.5 127.3 147.1 130.2 148.0 134.0 C148.9 137.8 149.7 143.8 150.0 147.0 L150 160 L0 160 L0 147.0 C0.3 143.8 1.1 137.8 2.0 134.0 C2.9 130.2 3.5 127.3 5.3 124.0 C7.2 120.7 9.8 117.0 13.0 114.0 C16.2 111.0 20.0 108.3 24.8 106.0 C29.6 103.7 37.1 101.7 41.8 100.0 C46.5 98.3 50.4 97.3 53.0 96.0 C55.6 94.7 56.7 93.7 57.7 92.0 C58.7 90.3 58.8 88.0 59.0 86.0 C59.2 84.0 59.4 82.0 59.0 80.0 C58.6 78.0 57.7 76.2 56.5 74.0 C55.3 71.8 53.5 69.7 52.0 67.0 C50.5 64.3 48.7 61.2 47.7 58.0 C46.7 54.8 46.3 51.3 46.0 48.0 C45.7 44.7 45.6 41.2 46.0 38.0 C46.4 34.8 47.2 31.7 48.2 29.0 C49.1 26.3 50.4 24.0 51.8 22.0 C53.3 20.0 55.0 18.3 56.8 17.0 C58.7 15.7 59.8 14.8 62.8 14.0 C65.9 13.2 72.0 12.3 75 12 Z';
export const DEFAULT_AVATAR_GREY = '#c7c7c7';

/* Fills whatever box the caller sizes, and is round whatever that box's own radius. */
const FILL: React.CSSProperties = { display: 'block', width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', clipPath: 'circle(50%)' };

/** The picture everyone sees for a learner who has not set a photo. */
export function DefaultAvatar({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={{ ...FILL, ...style }} viewBox="0 0 150 150" aria-hidden="true" focusable="false">
      <rect width="150" height="150" fill={DEFAULT_AVATAR_GREY} />
      <path d={SILHOUETTE} fill="#fff" />
    </svg>
  );
}

/**
 * A learner's photo, or the default silhouette when there is none or it fails
 * to load. Decorative by default, since a name is always printed beside it.
 */
export default function UserAvatar({ src, className, style, alt = '' }: { src?: string | null; className?: string; style?: React.CSSProperties; alt?: string }) {
  // Keyed by URL, so a newly uploaded photo gets its own chance to load.
  const [failed, setFailed] = useState<string | null>(null);
  if (src && failed !== src) {
    return <img src={src} alt={alt} className={className} style={{ ...FILL, ...style }} loading="lazy" decoding="async" onError={() => setFailed(src)} />;
  }
  return <DefaultAvatar className={className} style={style} />;
}
