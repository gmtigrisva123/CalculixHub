/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * A learner's profile photo.
 *
 * Photos live in the public `community-media` bucket, in the learner's own
 * folder as `<user id>/avatar-<random>.<ext>`, which the bucket's storage
 * policies already confine writes to; `profiles.avatar_url` holds the public
 * URL. Each photo is cropped to a centred square and scaled to 512px in the
 * browser, so an avatar is tens of kilobytes rather than a full camera frame.
 *
 * Without a photo, `avatar_url` is null and every surface draws the default
 * silhouette (see components/UserAvatar.tsx).
 */

import { supabase } from '../supabase';
import { ACCEPTED_IMAGE_TYPES, MAX_SOURCE_BYTES, MEDIA_BUCKET, mediaUrl } from './media';

export const AVATAR_EDGE = 512;

export type AvatarResult = { ok: true; url: string | null } | { ok: false; error: string };

/** The centred square a width × height picture is cropped to. */
export function squareCrop(width: number, height: number): { x: number; y: number; side: number } {
  const side = Math.min(width, height);
  return { x: Math.round((width - side) / 2), y: Math.round((height - side) / 2), side };
}

/**
 * The storage path behind one of this learner's avatar URLs, or null for any
 * other URL -- a photo from a sign-in provider, or a file someone else owns,
 * is never deleted from here.
 */
export function avatarPathFromUrl(url: string | null | undefined, userId: string): string | null {
  if (!url) return null;
  const marker = `/object/public/${MEDIA_BUCKET}/`;
  const at = url.indexOf(marker);
  if (at < 0) return null;
  const path = decodeURIComponent(url.slice(at + marker.length).split(/[?#]/)[0]);
  return path.startsWith(`${userId}/avatar-`) && !path.includes('..') ? path : null;
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** The photo cropped to its centred square and scaled to at most 512px, or null if it cannot be decoded. */
export async function croppedSquare(file: File): Promise<Blob | null> {
  if (typeof createImageBitmap !== 'function') return null;
  let bitmap: ImageBitmap;
  try {
    // `from-image` applies the EXIF rotation, so portrait phone photos stay upright.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return null;
  }
  const { x, y, side } = squareCrop(bitmap.width, bitmap.height);
  const edge = Math.min(AVATAR_EDGE, side);
  const canvas = document.createElement('canvas');
  canvas.width = edge;
  canvas.height = edge;
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    return null;
  }
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, x, y, side, side, 0, 0, edge, edge);
  bitmap.close();

  // Older Safari silently returns PNG for an unsupported type, so check what came back.
  let blob = await canvasBlob(canvas, 'image/webp', 0.9);
  if (!blob || blob.type !== 'image/webp') blob = await canvasBlob(canvas, 'image/jpeg', 0.9);
  return blob;
}

/** Best effort: an orphaned file costs storage, not correctness. */
async function removeOwnAvatar(userId: string, url: string | null | undefined): Promise<void> {
  const path = avatarPathFromUrl(url, userId);
  if (supabase && path) await supabase.storage.from(MEDIA_BUCKET).remove([path]);
}

/** Crop, upload and set a new profile photo, then tidy away the old one. */
export async function saveAvatar(userId: string, file: File, previousUrl: string | null | undefined): Promise<AvatarResult> {
  if (!supabase) return { ok: false, error: 'Profile photos are unavailable in this build.' };
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) return { ok: false, error: 'Choose a PNG, JPEG, WebP or GIF image.' };
  if (file.size > MAX_SOURCE_BYTES) return { ok: false, error: 'That image is too large (25 MB maximum).' };

  const blob = await croppedSquare(file);
  if (!blob) return { ok: false, error: 'That image could not be read. Try a different photo.' };

  const type = blob.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
  const path = `${userId}/avatar-${crypto.randomUUID()}.${type === 'image/webp' ? 'webp' : 'jpg'}`;
  const upload = await supabase.storage.from(MEDIA_BUCKET).upload(path, blob, { contentType: type, cacheControl: '31536000', upsert: false });
  if (upload.error) {
    console.error('[CalculixHub] Avatar upload failed', upload.error.message);
    return {
      ok: false,
      error: /bucket not found|not found/i.test(upload.error.message)
        ? 'Photo uploads are not set up yet. Ask an admin to apply the community database setup.'
        : 'Your photo could not be uploaded. Please try again.',
    };
  }

  const url = mediaUrl(path);
  const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId);
  if (error) {
    await supabase.storage.from(MEDIA_BUCKET).remove([path]);
    return { ok: false, error: 'Your photo could not be saved. Please try again.' };
  }

  await removeOwnAvatar(userId, previousUrl);
  return { ok: true, url };
}

/** Go back to the default silhouette. */
export async function clearAvatar(userId: string, previousUrl: string | null | undefined): Promise<AvatarResult> {
  if (!supabase) return { ok: false, error: 'Profile photos are unavailable in this build.' };
  const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', userId);
  if (error) return { ok: false, error: 'Your photo could not be removed. Please try again.' };
  await removeOwnAvatar(userId, previousUrl);
  return { ok: true, url: null };
}
