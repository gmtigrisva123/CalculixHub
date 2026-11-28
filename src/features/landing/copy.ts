/**
 * Every word landing v2 shows, in one place, so the page can be translated
 * without touching a component (docs/landing-v2-brief.md §9.2, appendix C).
 *
 * For now it holds the scenes' short names, which the nav and the scene ruler
 * use. Each later phase adds the copy of the scenes it builds, word for word
 * from §10. In that copy a word in *asterisks* is a keyword: weight 600, with a
 * measure bracket under it (§7.3).
 */

export const COPY = {
  scenes: {
    top: 'Top',
    'how-it-works': 'How it works',
    try: 'Try one',
    why: 'Why you missed',
    tutor: 'Tutor',
    map: 'Map',
    archive: 'Archive',
    arena: 'Arena',
    plans: 'Pricing',
    faq: 'FAQ',
    begin: 'Begin',
  },
} as const;
