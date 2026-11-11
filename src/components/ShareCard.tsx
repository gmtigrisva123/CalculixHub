/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The share-card dialog: preview the picture, pick a design, save or share it.
 */

import { useEffect, useRef, useState } from 'react';
import { Download, Lock, Share2, X } from 'lucide-react';
import { CARD_FONTS, CARD_HEIGHT, CARD_WIDTH, DESIGNS, drawShareCard, type CardData, type CardDesign } from '../domain/shareCard';
import '../styles/share-card.css';

interface ShareCardProps {
  open: boolean;
  onClose: () => void;
  data: CardData;
  /** Whether the designs beyond the first are available to this learner. */
  allDesigns: boolean;
  onSeePlans: () => void;
}

const toBlob = (canvas: HTMLCanvasElement) => new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));

export default function ShareCard({ open, onClose, data, allDesigns, onSeePlans }: ShareCardProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [design, setDesign] = useState<CardDesign>('night');
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) { setNote(null); node.showModal(); }
    else if (!open && node.open) node.close();
  }, [open]);

  // Drawn once the page's own fonts are ready, or the first card would be set in a fallback face.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const paint = () => {
      const context = canvas.current?.getContext('2d');
      if (alive && context) drawShareCard(context, data, design);
    };
    paint();
    if (document.fonts) void Promise.all(CARD_FONTS.map(face => document.fonts.load(face))).then(paint, paint);
    return () => { alive = false; };
  }, [open, data, design]);

  const filename = `calculixhub-${data.handle ?? 'progress'}.png`;

  const save = async () => {
    const blob = canvas.current && await toBlob(canvas.current);
    if (!blob) { setNote('Could not make the image. Please try again.'); return; }
    const url = URL.createObjectURL(blob);
    const link = Object.assign(document.createElement('a'), { href: url, download: filename });
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNote('Saved to your downloads.');
  };

  const share = async () => {
    const blob = canvas.current && await toBlob(canvas.current);
    if (!blob) return;
    const file = new File([blob], filename, { type: 'image/png' });
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'My CalculixHub progress' });
      else await save();
    } catch { /* the share sheet was dismissed */ }
  };

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <dialog ref={dialog} className="sc-dialog" aria-labelledby="sc-title" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === dialog.current) onClose(); }}>
      <header>
        <div><h2 id="sc-title">Your progress, as a card</h2><p>Made from the figures on your profile. Nothing is posted anywhere; you decide where it goes.</p></div>
        <button type="button" className="sc-close" onClick={onClose} aria-label="Close"><X size={19} /></button>
      </header>

      <canvas ref={canvas} width={CARD_WIDTH} height={CARD_HEIGHT} className="sc-canvas" role="img"
        aria-label={`${data.name}: ${data.points} points, ${data.solved} solved, ${data.streak}-day streak`} />

      <div className="sc-designs" role="radiogroup" aria-label="Design">
        {(Object.keys(DESIGNS) as CardDesign[]).map(key => {
          const locked = DESIGNS[key].pro && !allDesigns;
          return (
            <button key={key} type="button" role="radio" aria-checked={design === key} className={`is-${key}`} disabled={locked} onClick={() => setDesign(key)} title={locked ? 'Part of Pro' : undefined}>
              <i aria-hidden="true" />{DESIGNS[key].label}{locked && <Lock size={12} aria-label="Part of Pro" />}
            </button>
          );
        })}
        {!allDesigns && <button type="button" className="sc-upsell" onClick={onSeePlans}>More designs with Pro</button>}
      </div>

      <footer>
        {note && <p role="status">{note}</p>}
        <button type="button" className="sc-btn" onClick={() => void save()}><Download size={16} /> Save image</button>
        {canShare && <button type="button" className="sc-btn is-solid" onClick={() => void share()}><Share2 size={16} /> Share</button>}
      </footer>
    </dialog>
  );
}
