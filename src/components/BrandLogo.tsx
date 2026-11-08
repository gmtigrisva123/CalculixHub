import { MARK_DOT, MARK_PATH, MARK_STROKE, MARK_VIEWBOX } from './brand';

/**
 * The CalculixHub "e", in whatever colour the surrounding text is. The size is
 * the caller's to set (the parent's CSS, or `className`); the mark fills it.
 */
export default function BrandLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox={MARK_VIEWBOX} fill="none" aria-hidden="true" focusable="false">
      <path d={MARK_PATH} stroke="currentColor" strokeWidth={MARK_STROKE} strokeLinecap="round" />
      <circle cx={MARK_DOT.cx} cy={MARK_DOT.cy} r={MARK_DOT.r} fill="currentColor" />
    </svg>
  );
}
