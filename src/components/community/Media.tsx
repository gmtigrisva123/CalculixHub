/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Images in the feed: the grid a post shows them in, the full-screen viewer,
 * and the upload tray a composer uses while they are on their way.
 */

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, m } from 'motion/react';
import { AlertCircle, ChevronLeft, ChevronRight, ExternalLink, Loader2, X } from 'lucide-react';
import { mediaUrl, rejectReason, removeImages, uploadImage } from '../../services/data/media';
import { duration, ease, spring } from '../../lib/motion';
import { useToast } from './ui';

// ---------------------------------------------------------------------------
// Grid
// ---------------------------------------------------------------------------

/**
 * One to four images, laid out the way a feed does: one at its own shape, two
 * side by side, three as one large and two small, four as a square grid.
 */
export function MediaGrid({
  paths,
  label,
  onOpen,
  compact = false,
}: {
  paths: string[];
  /** Who attached them, for the images' accessible names. */
  label: string;
  onOpen: (index: number) => void;
  compact?: boolean;
}) {
  if (paths.length === 0) return null;
  return (
    <div className={`cm-media is-${Math.min(paths.length, 4)} ${compact ? 'is-compact' : ''}`}>
      {paths.slice(0, 4).map((path, index) => (
        <button key={path} type="button" className="cm-media-item" onClick={() => onOpen(index)} aria-label={`Open image ${index + 1} of ${paths.length} from ${label}`}>
          <img src={mediaUrl(path)} alt="" loading="lazy" decoding="async" />
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Viewer
// ---------------------------------------------------------------------------

/** Full-screen viewer: arrow keys or a swipe to move, Escape to close. */
export function Lightbox({ paths, start, onClose }: { paths: string[]; start: number; onClose: () => void }) {
  const [index, setIndex] = useState(start);
  const [direction, setDirection] = useState(0);
  const titleId = useId();
  const close = useRef(onClose);
  close.current = onClose;
  const closeButton = useRef<HTMLButtonElement>(null);

  const go = useCallback(
    (step: number) => {
      if (paths.length < 2) return;
      setDirection(step);
      setIndex((current) => (current + step + paths.length) % paths.length);
    },
    [paths.length],
  );

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close.current();
      else if (event.key === 'ArrowRight') go(1);
      else if (event.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [go]);

  const url = mediaUrl(paths[index] ?? '');

  return createPortal(
    <m.div
      className="cm-layer cm-lightbox"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: duration.base, ease: ease.standard } }}
      exit={{ opacity: 0, transition: { duration: duration.fast, ease: ease.exit } }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <h2 id={titleId} className="sr-only">
        Image {index + 1} of {paths.length}
      </h2>
      <div className="cm-lightbox-bar">
        {paths.length > 1 && <span aria-hidden="true">{index + 1} / {paths.length}</span>}
        <a className="cm-lightbox-button" href={url} target="_blank" rel="noreferrer" aria-label="Open the original image in a new tab">
          <ExternalLink size={20} aria-hidden="true" />
        </a>
        <button ref={closeButton} type="button" className="cm-lightbox-button" aria-label="Close" onClick={onClose}>
          <X size={22} aria-hidden="true" />
        </button>
      </div>

      <AnimatePresence initial={false} custom={direction} mode="popLayout">
        <m.img
          key={paths[index]}
          src={url}
          alt=""
          className="cm-lightbox-image"
          custom={direction}
          initial={{ opacity: 0, x: direction * 60 }}
          animate={{ opacity: 1, x: 0, transition: spring.smooth }}
          exit={{ opacity: 0, x: direction * -60, transition: { duration: duration.fast, ease: ease.exit } }}
          drag={paths.length > 1 ? 'x' : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.5}
          onDragEnd={(_, info) => {
            if (info.offset.x < -70) go(1);
            else if (info.offset.x > 70) go(-1);
          }}
        />
      </AnimatePresence>

      {paths.length > 1 && (
        <>
          <button type="button" className="cm-lightbox-nav is-prev" aria-label="Previous image" onClick={() => go(-1)}>
            <ChevronLeft size={28} aria-hidden="true" />
          </button>
          <button type="button" className="cm-lightbox-nav is-next" aria-label="Next image" onClick={() => go(1)}>
            <ChevronRight size={28} aria-hidden="true" />
          </button>
        </>
      )}
    </m.div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Uploads
// ---------------------------------------------------------------------------

export interface Attachment {
  key: string;
  preview: string;
  status: 'uploading' | 'ready' | 'failed';
  path?: string;
  /** Already part of the post being edited: kept in storage if taken out. */
  existing?: boolean;
}

/**
 * Images attached to a draft. Each file starts uploading the moment it is
 * picked, so by the time the learner has written their post the pictures are
 * usually already stored.
 */
export function useAttachments(userId: string | null, max: number, initialPaths: string[] = []) {
  const toast = useToast();
  const [items, setItems] = useState<Attachment[]>(() =>
    initialPaths.map((path) => ({ key: path, preview: mediaUrl(path), status: 'ready', path, existing: true })),
  );
  const latest = useRef(items);
  latest.current = items;

  // Object URLs hold the decoded file in memory until revoked.
  useEffect(
    () => () => {
      for (const item of latest.current) if (!item.existing) URL.revokeObjectURL(item.preview);
    },
    [],
  );

  const add = useCallback(
    (files: File[]) => {
      if (!userId) return;
      const room = max - latest.current.length;
      if (room <= 0) {
        toast(max === 1 ? 'You can attach one image.' : `You can attach up to ${max} images.`, 'error');
        return;
      }
      const accepted: File[] = [];
      for (const file of files) {
        const reason = rejectReason(file);
        if (reason) toast(reason, 'error');
        else accepted.push(file);
      }
      if (accepted.length > room) toast(`Only the first ${room} image${room === 1 ? '' : 's'} were attached.`, 'error');

      for (const file of accepted.slice(0, room)) {
        const key = crypto.randomUUID();
        const preview = URL.createObjectURL(file);
        setItems((list) => [...list, { key, preview, status: 'uploading' }]);
        void uploadImage(userId, file).then((result) => {
          // Removed while it was uploading: tidy the file up instead of keeping it.
          if (!latest.current.some((item) => item.key === key)) {
            if (result.ok) void removeImages([result.path]);
            return;
          }
          if (!result.ok) toast(result.error, 'error');
          setItems((list) =>
            list.map((item) => (item.key === key ? { ...item, status: result.ok ? 'ready' : 'failed', path: result.ok ? result.path : undefined } : item)),
          );
        });
      }
    },
    [userId, max, toast],
  );

  const remove = useCallback((key: string) => {
    const item = latest.current.find((entry) => entry.key === key);
    if (!item) return;
    if (!item.existing) {
      URL.revokeObjectURL(item.preview);
      if (item.path) void removeImages([item.path]);
    }
    setItems((list) => list.filter((entry) => entry.key !== key));
  }, []);

  /** Delete what this draft uploaded, when it is discarded rather than posted. */
  const discard = useCallback(() => {
    const uploaded = latest.current.filter((item) => !item.existing && item.path).map((item) => item.path!);
    void removeImages(uploaded);
  }, []);

  /**
   * Forget the draft's images after they were posted. Cleared synchronously as
   * well, so a composer that unmounts in the same update -- a reply box closing
   * on send -- does not mistake its posted images for a discarded draft.
   */
  const reset = useCallback(() => {
    for (const item of latest.current) if (!item.existing) URL.revokeObjectURL(item.preview);
    latest.current = [];
    setItems([]);
  }, []);

  return {
    items,
    paths: items.filter((item) => item.status === 'ready' && item.path).map((item) => item.path!),
    uploading: items.some((item) => item.status === 'uploading'),
    full: items.length >= max,
    add,
    remove,
    discard,
    reset,
  };
}

/** Image files from a paste or a drop, ignoring text and other files. */
export function imageFiles(list: FileList | DataTransferItemList | null | undefined): File[] {
  if (!list) return [];
  const files: File[] = [];
  for (const entry of Array.from(list as ArrayLike<File | DataTransferItem>)) {
    const file = entry instanceof File ? entry : entry.kind === 'file' ? entry.getAsFile() : null;
    if (file && file.type.startsWith('image/')) files.push(file);
  }
  return files;
}

export function AttachmentTray({ items, onRemove, compact = false }: { items: Attachment[]; onRemove: (key: string) => void; compact?: boolean }) {
  if (items.length === 0) return null;
  return (
    <ul className={`cm-tray ${compact ? 'is-compact' : ''}`} aria-label="Attached images">
      <AnimatePresence initial={false}>
        {items.map((item, index) => (
          <m.li
            key={item.key}
            layout
            className={`cm-tray-item is-${item.status}`}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1, transition: spring.snappy }}
            exit={{ opacity: 0, scale: 0.85, transition: { duration: duration.fast, ease: ease.exit } }}
          >
            <img src={item.preview} alt="" />
            {item.status === 'uploading' && (
              <span className="cm-tray-state" role="status" aria-label={`Uploading image ${index + 1}`}>
                <Loader2 size={20} className="cm-spin" aria-hidden="true" />
              </span>
            )}
            {item.status === 'failed' && (
              <span className="cm-tray-state is-failed" title="This image could not be uploaded">
                <AlertCircle size={20} aria-hidden="true" />
              </span>
            )}
            <button type="button" className="cm-tray-remove" aria-label={`Remove image ${index + 1}`} onClick={() => onRemove(item.key)}>
              <X size={14} aria-hidden="true" />
            </button>
          </m.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
