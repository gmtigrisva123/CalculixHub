/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Check, Download, Share, Smartphone, SquarePlus, X } from 'lucide-react';
import {
  isInstalled,
  isIosSafari,
  type BeforeInstallPromptEvent,
} from '../lib/pwa';

type Variant = 'nav' | 'row';

interface InstallAppButtonProps {
  /**
   * 'nav' renders the compact brass button for the landing header.
   * 'row' renders a full-width settings row for inside the app.
   */
  variant?: Variant;
}

/**
 * How the current browser can install the app. Each value drives a different
 * sheet body, because the install gesture genuinely differs per platform.
 */
type InstallPath =
  | 'installed' // already running from the home screen
  | 'prompt' // Chromium fired beforeinstallprompt; we can install directly
  | 'ios' // Safari on iOS/iPadOS: manual Share -> Add to Home Screen
  | 'manual'; // everything else: browser-menu install, or no support

/**
 * "Get the app" entry point.
 *
 * The app installs as a PWA rather than shipping from the App Store, so this
 * deliberately never claims to be an App Store download -- the sheet says what
 * actually happens, which is that the site installs to the home screen with its
 * own icon and runs without browser chrome.
 *
 * Chromium is the only engine that exposes a programmatic install, so the three
 * other paths are handled explicitly instead of showing a button that silently
 * does nothing.
 */
export default function InstallAppButton({ variant = 'nav' }: InstallAppButtonProps) {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setInstalled(isInstalled());

    // Chromium fires this instead of showing its own install UI once the
    // manifest and a fetch-handling service worker are both present. Capturing
    // the event lets the button drive the native prompt on demand.
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setPrompt(event as BeforeInstallPromptEvent);
    };

    // Fires when the install completes, including installs started from the
    // browser's own menu rather than this button.
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
      setOpen(false);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const path: InstallPath = installed
    ? 'installed'
    : prompt
      ? 'prompt'
      : isIosSafari()
        ? 'ios'
        : 'manual';

  // Nothing to offer someone already running the installed app.
  if (path === 'installed') return null;

  const handleClick = async () => {
    if (path === 'prompt' && prompt) {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      // The event is single-use; a dismissed prompt cannot be re-fired, so drop
      // it and fall back to manual instructions on any later click.
      setPrompt(null);
      if (outcome === 'dismissed') setOpen(true);
      return;
    }
    setOpen(true);
  };

  return (
    <>
      {variant === 'nav' ? (
        <button
          type="button"
          onClick={handleClick}
          className="flex items-center gap-1.5 border border-brass-500/40 text-brass-300 hover:text-ink-950 hover:bg-brass-500 hover:border-brass-500 font-extrabold text-xs px-3 sm:px-4 py-2.5 rounded-xl transition-all active:scale-95 cursor-pointer"
        >
          <Smartphone className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline whitespace-nowrap">Get the app</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className="w-full flex items-center justify-between gap-3 p-3.5 bg-stone-50/60 hover:bg-stone-100/70 rounded-xl border border-stone-100 transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-ink-950 text-brass-400 shrink-0">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-stone-800 block">Get the mobile app</span>
              <span className="text-[10px] text-stone-400 block font-medium mt-0.5">
                Install CalculixHub to your home screen for offline practice.
              </span>
            </div>
          </div>
          <Download className="w-4 h-4 text-stone-400 shrink-0" />
        </button>
      )}

      {open && <InstallSheet path={path} onClose={() => setOpen(false)} />}
    </>
  );
}

interface InstallSheetProps {
  path: Exclude<InstallPath, 'installed'>;
  onClose: () => void;
}

/**
 * Install instructions.
 *
 * Presented as a centred dialog on desktop and a bottom sheet on mobile, which
 * is where a thumb already is.
 */
function InstallSheet({ path, onClose }: InstallSheetProps) {
  // Escape closes, matching the backdrop click.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-ink-950/60 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-sheet-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl border border-stone-200 shadow-2xl overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="bg-ink-950 px-5 py-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brass-500 to-brass-700 text-ink-950 font-black flex items-center justify-center text-base font-serif shrink-0">
              &#8721;
            </div>
            <div>
              <h2 id="install-sheet-title" className="text-sm font-extrabold text-stone-100 tracking-wide">
                Install CalculixHub
              </h2>
              <p className="text-[10px] text-stone-500 font-bold uppercase tracking-wider mt-0.5">
                Home screen app &middot; works offline
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-stone-500 hover:text-white transition-colors cursor-pointer p-1 -m-1 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {path === 'ios' && <IosSteps />}
          {path === 'manual' && <ManualSteps />}
          {path === 'prompt' && (
            <p className="text-xs text-stone-600 leading-relaxed">
              Your browser will ask for confirmation. Accept it and CalculixHub is added to your
              home screen.
            </p>
          )}

          <div className="bg-stone-50 border border-stone-150 rounded-2xl p-3.5 space-y-1.5">
            <span className="text-[9px] font-bold uppercase tracking-wider text-stone-400 block">
              What you get
            </span>
            <ul className="space-y-1">
              {[
                'Its own icon, no browser address bar',
                'Cached problems that work without a connection',
                'Streak reminders sent to your device',
              ].map((line) => (
                <li key={line} className="flex items-start gap-1.5 text-[11px] text-stone-600 font-medium">
                  <Check className="w-3 h-3 text-proof-500 mt-0.5 shrink-0" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Numbered step, shared by the platform-specific instruction lists. */
function Step({ index, children }: { index: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="w-5 h-5 rounded-full bg-ink-950 text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-px">
        {index}
      </span>
      <span className="text-xs text-stone-600 leading-relaxed flex-1">{children}</span>
    </li>
  );
}

function IosSteps() {
  return (
    <>
      <p className="text-xs text-stone-600 leading-relaxed">
        iPhone and iPad install from the Safari share menu &mdash; Apple does not allow websites to
        trigger it directly.
      </p>
      <ol className="space-y-2.5">
        <Step index={1}>
          Tap the <strong className="text-stone-900 font-bold">Share</strong> button
          <Share className="w-3.5 h-3.5 inline-block mx-1 -mt-0.5 text-brass-600" />
          in the Safari toolbar.
        </Step>
        <Step index={2}>
          Scroll down and choose{' '}
          <strong className="text-stone-900 font-bold">Add to Home Screen</strong>
          <SquarePlus className="w-3.5 h-3.5 inline-block mx-1 -mt-0.5 text-brass-600" />.
        </Step>
        <Step index={3}>
          Tap <strong className="text-stone-900 font-bold">Add</strong>. CalculixHub appears on your
          home screen like any other app.
        </Step>
      </ol>
    </>
  );
}

function ManualSteps() {
  return (
    <>
      <p className="text-xs text-stone-600 leading-relaxed">
        This browser does not expose a one-tap install. You can still add CalculixHub from its own
        menu.
      </p>
      <ol className="space-y-2.5">
        <Step index={1}>Open your browser&rsquo;s menu.</Step>
        <Step index={2}>
          Look for <strong className="text-stone-900 font-bold">Install app</strong>,{' '}
          <strong className="text-stone-900 font-bold">Add to Home screen</strong> or{' '}
          <strong className="text-stone-900 font-bold">Add to Dock</strong>.
        </Step>
        <Step index={3}>Confirm, and CalculixHub installs with its own icon.</Step>
      </ol>
      <p className="text-[11px] text-stone-400 leading-relaxed">
        On iPhone, Chrome and Firefox cannot install home screen apps &mdash; open this page in
        Safari to install it there.
      </p>
    </>
  );
}
