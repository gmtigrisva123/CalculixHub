/**
 * The landing page's questions and answers.
 *
 * Kept apart from FaqSection.tsx so the same words reach two readers: the
 * section a visitor opens one answer at a time, and the plain page served to a
 * browser that runs no script (landingStatic.ts). The Pro price is read from
 * shared/plans.ts, as everywhere else on the page.
 */

import { PLANS, dollars } from '../../../shared/plans';

export const FAQS: readonly (readonly [string, string])[] = [
  ['What is CalculixHub?', 'A place to practise contest maths: find your level, solve real past problems, and learn from full solutions.'],
  ['Do I need to be an Olympiad student?', 'No. The quiz finds a good starting point for you, from AMC up to IMO.'],
  ['Is Free really free?', 'Yes. Placement, practice, every past paper and the Arena are free, with no trial clock and no adverts.'],
  ['What does Pro add, and what does it cost?', `${dollars(PLANS.pro.price.monthly)} a month, or ${dollars(PLANS.pro.price.yearly)} a year. It adds a week-by-week plan up to your contest date, printable progress reports and every share-card design. Anything still being built is marked on the pricing table.`],
  ['Can I cancel?', 'Any time, from the Plan page. You keep Pro until the period you paid for ends.'],
  ['What if I get stuck?', 'Take a hint first. When you’re ready, read the full solution. You can come back to any problem.'],
  ['How do the AI explanations work?', 'The tutor answers with Google’s Gemini. In Settings, under Live tutor, three steps walk you through getting a free key from your own Google account. Google’s free allowance covers normal practice, and anything beyond it is between you and Google, not us.'],
  ['Can I take my data with me, or delete it?', 'Both. Settings has a download of everything stored about you, and a delete-account button that removes it for good.'],
];
