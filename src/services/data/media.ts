/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Images on community posts and comments.
 *
 * Files go to the public `community-media` bucket under the uploader's own
 * folder, `<user id>/<random>.<ext>` -- the storage policies in
 * `20261004000100_community_social.sql` refuse a write anywhere else, and the
 * posts table refuses a path outside its author's folder.
 *
 * Photos are re-encoded in the browser before upload: phone cameras produce
 * 4-12 MB files at resolutions no feed displays, so scaling to 2048px and
 * WebP cuts most uploads by an order of magnitude and strips the location
 * metadata a raw photo carries. GIFs are uploaded as they are, to keep the
 * animation.
 */

import { supabase } from '../supabase';

export const MEDIA_BUCKET = 'community-media';
export const MAX_POST_IMAGES = 4;
export const MAX_COMMENT_IMAGES = 1;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
/** Accepted before compression; anything larger is not worth decoding in a tab. */
export const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;

const MAX_EDGE = 2048;
const EXTENSIONS: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

export type UploadResult = { ok: true; path: string } | { ok: false; error: string };

/** The public URL of a stored image. */
export function mediaUrl(path: string): string {
  if (!supabase) return '';
  return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Why a file cannot be attached, or null when it can. */
export function rejectReason(file: Pick<File, 'type' | 'size'>): string | null {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) return 'Only PNG, JPEG, WebP and GIF images can be attached.';
  if (file.size > MAX_SOURCE_BYTES) return 'That image is too large (25 MB maximum).';
  if (file.type === 'image/gif' && file.size > MAX_UPLOAD_BYTES) return 'GIFs are uploaded unchanged, so they must be 5 MB or smaller.';
  return null;
}

/** The dimensions a picture is scaled to so its longest edge fits `limit`. */
export function fitWithin(width: number, height: number, limit = MAX_EDGE): { width: number; height: number } {
  const scale = Math.min(1, limit / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Scale and re-encode a photo for upload. Falls back to the original file
 * when the browser cannot decode it, or when re-encoding would not help.
 */
export async function prepareImage(file: File): Promise<Blob> {
  if (file.type === 'image/gif' || typeof createImageBitmap !== 'function') return file;

  let bitmap: ImageBitmap;
  try {
    // `from-image` applies the EXIF rotation, so portrait phone photos stay upright.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file;
  }

  const original = { width: bitmap.width, height: bitmap.height };
  const size = fitWithin(original.width, original.height);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    return file;
  }
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();

  // Older Safari silently returns PNG for an unsupported type, so check what came back.
  let blob = await canvasBlob(canvas, 'image/webp', 0.86);
  if (!blob || blob.type !== 'image/webp') blob = await canvasBlob(canvas, 'image/jpeg', 0.86);
  if (!blob) return file;

  const resized = size.width < original.width || size.height < original.height;
  return blob.size < file.size || resized ? blob : file;
}

/** Compress and upload one image into the uploader's folder. */
export async function uploadImage(userId: string, file: File): Promise<UploadResult> {
  if (!supabase) return { ok: false, error: 'Image uploads are unavailable in this build.' };

  const reason = rejectReason(file);
  if (reason) return { ok: false, error: reason };

  const blob = await prepareImage(file);
  if (blob.size > MAX_UPLOAD_BYTES) return { ok: false, error: 'That image is still larger than 5 MB after compression.' };

  const type = blob.type || file.type;
  const path = `${userId}/${crypto.randomUUID()}.${EXTENSIONS[type] ?? 'jpg'}`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, blob, {
    contentType: type,
    cacheControl: '31536000',
    upsert: false,
  });

  if (error) {
    console.error('[CalculixHub] Image upload failed', error.message);
    return {
      ok: false,
      error: /bucket not found|not found/i.test(error.message)
        ? 'Image uploads are not set up yet. Ask an admin to apply the community database setup.'
        : 'That image could not be uploaded. Please try again.',
    };
  }
  return { ok: true, path };
}

/**
 * Remove uploads that never made it into a post -- a discarded draft, or an
 * image taken out before posting. Best effort: an orphaned file costs storage,
 * not correctness, so a failure here is not reported.
 */
export async function removeImages(paths: string[]): Promise<void> {
  if (!supabase || paths.length === 0) return;
  await supabase.storage.from(MEDIA_BUCKET).remove(paths);
}
