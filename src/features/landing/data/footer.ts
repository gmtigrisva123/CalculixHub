/**
 * The footer's links to the native-app previews, moved from the old landing's
 * LandingFooter.tsx (docs/landing-v2-brief.md §4.2). Both are real: App.tsx
 * serves the iPhone prototype at `?preview=ios` and the MacBook one at
 * `?preview=mac`.
 */

export interface FooterLink {
  label: string;
  href: string;
}

export const FOOTER_LINKS: readonly FooterLink[] = [
  { label: 'iPhone preview', href: '/?preview=ios' },
  { label: 'MacBook preview', href: '/?preview=mac' },
];
