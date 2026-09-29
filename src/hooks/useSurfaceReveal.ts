import { useEffect, useRef } from 'react';

/** One gentle reveal per surface; content stays readable if animation is unavailable. */
export function useSurfaceReveal(selector: string) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || typeof IntersectionObserver === 'undefined') return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const animations = new Set<Animation>();
    const onKeyboard = () => { root.dataset.input = 'keyboard'; animations.forEach(animation => animation.cancel()); };
    const onPointer = () => { root.dataset.input = 'pointer'; };
    const onPreference = () => { if (preference.matches) animations.forEach(animation => animation.cancel()); };
    root.addEventListener('keydown', onKeyboard);
    root.addEventListener('pointerdown', onPointer);
    preference.addEventListener('change', onPreference);
    const observer = new IntersectionObserver(entries => {
      let stagger = 0;
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        if (preference.matches || root.dataset.input === 'keyboard') return;
        const element = entry.target as HTMLElement;
        if (typeof element.animate !== 'function') return;
        const base = getComputedStyle(element).transform;
        const resting = base === 'none' ? 'translateY(0)' : base;
        const animation = element.animate([
          { opacity: 0.75, transform: `translateY(10px) ${base === 'none' ? '' : base}` },
          { opacity: 1, transform: resting },
        ], { duration: 280, delay: Math.min(stagger++ * 35, 105), easing: 'cubic-bezier(.22,1,.36,1)' });
        animations.add(animation);
        animation.finished.catch(() => {}).finally(() => animations.delete(animation));
      });
    }, { threshold: 0.08 });
    root.querySelectorAll(selector).forEach(element => observer.observe(element));
    return () => {
      observer.disconnect();
      animations.forEach(animation => animation.cancel());
      root.removeEventListener('keydown', onKeyboard);
      root.removeEventListener('pointerdown', onPointer);
      preference.removeEventListener('change', onPreference);
    };
  }, [selector]);
  return ref;
}
