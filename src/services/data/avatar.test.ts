import { describe, expect, it } from 'vitest';
import { avatarPathFromUrl, squareCrop } from './avatar';

const base = 'https://project.supabase.co/storage/v1/object/public/community-media';

describe('profile photos', () => {
  it('crops to the centred square', () => {
    expect(squareCrop(1200, 800)).toEqual({ x: 200, y: 0, side: 800 });
    expect(squareCrop(600, 900)).toEqual({ x: 0, y: 150, side: 600 });
    expect(squareCrop(512, 512)).toEqual({ x: 0, y: 0, side: 512 });
  });

  it('finds the stored file behind the learner’s own avatar URL', () => {
    expect(avatarPathFromUrl(`${base}/u1/avatar-abc.webp`, 'u1')).toBe('u1/avatar-abc.webp');
    expect(avatarPathFromUrl(`${base}/u1/avatar-abc.webp?v=2`, 'u1')).toBe('u1/avatar-abc.webp');
  });

  it('never points at a file the learner does not own as their avatar', () => {
    expect(avatarPathFromUrl(null, 'u1')).toBeNull();
    expect(avatarPathFromUrl('https://lh3.googleusercontent.com/a/photo', 'u1')).toBeNull();
    expect(avatarPathFromUrl(`${base}/u2/avatar-abc.webp`, 'u1')).toBeNull();
    expect(avatarPathFromUrl(`${base}/u1/post-image.webp`, 'u1')).toBeNull();
    expect(avatarPathFromUrl(`${base}/u1/avatar-x/../../u2/avatar-y.webp`, 'u1')).toBeNull();
  });
});
