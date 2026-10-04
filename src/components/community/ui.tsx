/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Small interface primitives for the Community feed: avatars, menus, dialogs,
 * toasts and an auto-growing text box.
 *
 * Dialogs and toasts render through a portal into `document.body`. The feed
 * sits inside transformed ancestors (tab and stagger animations), and a
 * `position: fixed` element inside a transformed ancestor is fixed to that
 * ancestor rather than to the viewport -- so an inline dialog would scroll
 * away with the card that opened it.
 */

import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, m } from 'motion/react';
import { AlertCircle, CheckCircle2, UserRound, X, type LucideIcon } from 'lucide-react';
import type { AuthorSummary } from '../../services/database.types';
import { duration, ease, scaleIn, spring } from '../../lib/motion';
import { authorName, avatarHue, initials } from './model';

// ---------------------------------------------------------------------------
// Clock
// ---------------------------------------------------------------------------

/** One shared clock for every relative timestamp on the page. */
export const NowContext = createContext<number>(Date.now());

export function useTicker(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export const useNow = () => useContext(NowContext);

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------

export function Avatar({
  author,
  size = 40,
  className = '',
}: {
  author: Pick<AuthorSummary, 'id' | 'display_name' | 'username' | 'avatar_url'> | null | undefined;
  size?: number;
  className?: string;
}) {
  const name = authorName(author);
  const [broken, setBroken] = useState(false);
  const style = {
    width: size,
    height: size,
    fontSize: Math.max(10, Math.round(size * 0.38)),
    '--cm-hue': avatarHue(author?.id ?? name),
  } as React.CSSProperties;

  // Signed out: a silhouette, not the initials of a placeholder name.
  if (!author) {
    return (
      <span className={`cm-avatar cm-avatar-guest ${className}`} style={style} aria-hidden="true">
        <UserRound size={Math.round(size * 0.55)} />
      </span>
    );
  }

  // The name is always printed beside the avatar, so the image itself is
  // decorative and is not announced a second time.
  if (author.avatar_url && !broken) {
    return <img src={author.avatar_url} alt="" className={`cm-avatar ${className}`} style={style} onError={() => setBroken(true)} />;
  }
  return (
    <span className={`cm-avatar cm-avatar-initials ${className}`} style={style} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Auto-growing text box
// ---------------------------------------------------------------------------

type AutoTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { maxHeight?: number };

export const AutoTextarea = forwardRef<HTMLTextAreaElement, AutoTextareaProps>(function AutoTextarea(
  { value, maxHeight = 320, rows = 1, ...rest },
  forwarded,
) {
  const inner = useRef<HTMLTextAreaElement | null>(null);
  useImperativeHandle(forwarded, () => inner.current as HTMLTextAreaElement);

  useLayoutEffect(() => {
    const element = inner.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, maxHeight)}px`;
    element.style.overflowY = element.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [value, maxHeight]);

  return <textarea ref={inner} value={value} rows={rows} {...rest} />;
});

/** Insert text at the caret (or around the selection) and keep editing there. */
export function insertAtCaret(
  element: HTMLTextAreaElement | null,
  value: string,
  before: string,
  after = '',
  placeholder = '',
): { next: string; caret: [number, number] } {
  const start = element?.selectionStart ?? value.length;
  const end = element?.selectionEnd ?? value.length;
  const selected = value.slice(start, end) || placeholder;
  const next = value.slice(0, start) + before + selected + after + value.slice(end);
  const caretStart = start + before.length;
  return { next, caret: [caretStart, caretStart + selected.length] };
}

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------

export type MenuEntry =
  | { key: string; label: string; icon: LucideIcon; onSelect: () => void; description?: string; danger?: boolean }
  | { key: string; separator: true };

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A disclosure menu: one trigger, a list of actions.
 *
 * Opens upward when there is not room below, so the menus at the bottom of a
 * card never open off-screen. Arrow keys move between items, Escape returns
 * focus to the trigger.
 */
export function Menu({
  label,
  items,
  children,
  buttonClassName = 'cm-icon-button',
  align = 'end',
  disabled = false,
}: {
  label: string;
  items: MenuEntry[];
  children: React.ReactNode;
  buttonClassName?: string;
  align?: 'start' | 'end';
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [upward, setUpward] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    const frame = requestAnimationFrame(() => list.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus());
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
      cancelAnimationFrame(frame);
    };
  }, [open]);

  const toggle = () => {
    if (!open && trigger.current) {
      const rect = trigger.current.getBoundingClientRect();
      const needed = items.length * 46 + 24;
      setUpward(window.innerHeight - rect.bottom < needed && rect.top > needed);
    }
    setOpen((value) => !value);
  };

  const onListKey = (event: React.KeyboardEvent) => {
    const entries = [...(list.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const index = entries.indexOf(document.activeElement as HTMLElement);
    const move = (to: number) => {
      event.preventDefault();
      entries[(to + entries.length) % entries.length]?.focus();
    };
    if (event.key === 'ArrowDown') move(index + 1);
    else if (event.key === 'ArrowUp') move(index - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(entries.length - 1);
    else if (event.key === 'Tab') setOpen(false);
  };

  return (
    <div className="cm-menu-wrap" ref={wrapper}>
      <button
        ref={trigger}
        type="button"
        className={buttonClassName}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        disabled={disabled}
        onClick={toggle}
      >
        {children}
      </button>
      <AnimatePresence>
        {open && (
          <m.div
            ref={list}
            id={id}
            role="menu"
            aria-label={label}
            className={`cm-menu ${align === 'start' ? 'is-start' : 'is-end'} ${upward ? 'is-up' : ''}`}
            onKeyDown={onListKey}
            initial={{ opacity: 0, scale: 0.96, y: upward ? 6 : -6 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: spring.snappy }}
            exit={{ opacity: 0, scale: 0.98, transition: { duration: duration.fast, ease: ease.exit } }}
          >
            {items.map((item) =>
              'separator' in item ? (
                <div key={item.key} className="cm-menu-separator" role="separator" />
              ) : (
                <button
                  key={item.key}
                  type="button"
                  role="menuitem"
                  className={`cm-menu-item ${item.danger ? 'is-danger' : ''}`}
                  onClick={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                >
                  <span className="cm-menu-icon">
                    <item.icon size={18} aria-hidden="true" />
                  </span>
                  <span className="cm-menu-text">
                    <span>{item.label}</span>
                    {item.description && <small>{item.description}</small>}
                  </span>
                </button>
              ),
            )}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------

/**
 * A modal dialog. Mount it to open it; unmount it (inside an
 * `AnimatePresence`) to close it with its exit animation.
 *
 * Focus moves into the dialog on open, is held there while it is open, and
 * returns to whatever had it before on close. The page behind stops
 * scrolling.
 */
export function Dialog({
  title,
  onClose,
  children,
  size = 'md',
  className = '',
  hideHeader = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  hideHeader?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const frame = requestAnimationFrame(() => {
      const target = panel.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panel.current?.querySelector<HTMLElement>(FOCUSABLE);
      target?.focus();
    });

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close.current();
        return;
      }
      if (event.key !== 'Tab' || !panel.current) return;
      const focusable = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  return createPortal(
    <m.div
      className="cm-layer cm-scrim"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: duration.base, ease: ease.standard } }}
      exit={{ opacity: 0, transition: { duration: duration.fast, ease: ease.exit } }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <m.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`cm-dialog is-${size} ${className}`}
        variants={scaleIn}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        {hideHeader ? (
          <h2 id={titleId} className="sr-only">
            {title}
          </h2>
        ) : (
          <header className="cm-dialog-header">
            <h2 id={titleId}>{title}</h2>
            <button type="button" className="cm-icon-button cm-dialog-close" aria-label="Close" onClick={onClose}>
              <X size={20} aria-hidden="true" />
            </button>
          </header>
        )}
        {children}
      </m.div>
    </m.div>,
    document.body,
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog title={title} onClose={() => !busy && onClose()} size="sm">
      <div className="cm-dialog-body">
        <p className="cm-confirm-text">{message}</p>
      </div>
      <footer className="cm-dialog-footer">
        <button type="button" className="cm-button is-quiet" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className="cm-button is-danger"
          data-autofocus
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onConfirm();
            setBusy(false);
          }}
        >
          {busy ? 'Working…' : confirmLabel}
        </button>
      </footer>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------

type ToastTone = 'neutral' | 'error';
interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

const ToastContext = createContext<(message: string, tone?: ToastTone) => void>(() => undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((toast) => toast.id !== id)), []);
  const push = useCallback(
    (message: string, tone: ToastTone = 'neutral') => {
      const id = ++counter.current;
      setToasts((list) => [...list.slice(-2), { id, message, tone }]);
      window.setTimeout(() => dismiss(id), tone === 'error' ? 6000 : 3200);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={push}>
      {children}
      {createPortal(
        <div className="cm-layer cm-toasts" role="status" aria-live="polite">
          <AnimatePresence initial={false}>
            {toasts.map((toast) => (
              <m.div
                key={toast.id}
                layout
                className={`cm-toast is-${toast.tone}`}
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1, transition: spring.snappy }}
                exit={{ opacity: 0, y: 8, transition: { duration: duration.fast, ease: ease.exit } }}
              >
                {toast.tone === 'error' ? <AlertCircle size={18} aria-hidden="true" /> : <CheckCircle2 size={18} aria-hidden="true" />}
                <span>{toast.message}</span>
                <button type="button" aria-label="Dismiss" onClick={() => dismiss(toast.id)}>
                  <X size={16} aria-hidden="true" />
                </button>
              </m.div>
            ))}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

// ---------------------------------------------------------------------------
// Clipboard and the system share sheet
// ---------------------------------------------------------------------------

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the selection-based copy below.
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand('copy');
    area.remove();
    return copied;
  } catch {
    return false;
  }
}

export const canNativeShare = (): boolean => typeof navigator !== 'undefined' && typeof navigator.share === 'function';

export async function nativeShare(data: ShareData): Promise<'shared' | 'cancelled' | 'failed'> {
  try {
    await navigator.share(data);
    return 'shared';
  } catch (error) {
    return error instanceof DOMException && error.name === 'AbortError' ? 'cancelled' : 'failed';
  }
}
