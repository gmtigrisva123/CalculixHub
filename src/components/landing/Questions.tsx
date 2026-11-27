/**
 * "Questions": what a visitor asks before signing up, answered in a line or two.
 *
 * All eight are set out open, as a column of questions and answers. They are
 * short, and a reader looking for one should not have to open seven others to
 * find it.
 */

import { PLANS, dollars } from '../../../shared/plans';

const FAQS: [string, string][] = [
  ['What is CalculixHub?', 'A place to practise contest maths: find your level, solve real past problems, and learn from full solutions.'],
  ['Do I need to be an Olympiad student?', 'No. The placement finds a good starting point for you, anywhere from the AMC up to the IMO.'],
  ['Is Free really free?', 'Yes. Placement, practice, every past paper and the Arena are free, with no trial clock and no adverts.'],
  ['What does Pro add, and what does it cost?', `${dollars(PLANS.pro.price.monthly)} a month, or ${dollars(PLANS.pro.price.yearly)} a year. It adds a week-by-week plan up to your contest date, printable progress reports and every share-card design. Anything still being built is marked on the table above.`],
  ['Can I cancel?', 'Any time, from the Plan page. You keep Pro until the period you paid for ends.'],
  ['What if I get stuck?', 'Take a hint first. When you’re ready, read the full solution. You can come back to any problem.'],
  ['How do the AI explanations work?', 'The tutor answers with Google’s Gemini. In Settings, under Live tutor, three steps walk you through getting a free key from your own Google account. Google’s free allowance covers normal practice, and anything beyond it is between you and Google, not us.'],
  ['Can I take my data with me, or delete it?', 'Both. Settings has a download of everything stored about you, and a delete-account button that removes it for good.'],
];

export default function Questions() {
  return (
    <section className="p1-sec p1-faq" id="faq" aria-labelledby="p1-faq-title">
      <div className="p1-wrap p1-faq-grid">
        <header className="p1-faq-head">
          <h2 id="p1-faq-title" className="p1-title">Before you sign up.</h2>
          <p className="p1-prose">
            Something else? <a className="p1-link is-inline" href="/?auth=signup&tab=community">Ask in the community</a>
          </p>
        </header>
        <dl className="p1-faq-list">
          {FAQS.map(([question, answer]) => (
            <div key={question}>
              <dt>{question}</dt>
              <dd>{answer}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
