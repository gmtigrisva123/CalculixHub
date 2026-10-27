/**
 * "Answers": the questions a visitor asks before signing up, answered plainly.
 *
 * The heading stays put while the list scrolls past it. Each answer opens in
 * place — the height eases open while the text fades up — and the plus turns
 * into a minus rather than being swapped for one.
 */

import { useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { Arrow, Eyebrow, GLIDE, Rise, SplitText } from './kit';

const FAQS: [string, string][] = [
  ['What is CalculixHub?', 'A mathematics workspace for competition practice. It brings adaptive placement, answer-based practice, worked solutions, an archive of past papers, community, and administrator-created Arena events into one place.'],
  ['Do I need to be an Olympiad student?', 'No. Start with a problem that feels approachable, or let placement choose a starting point. The question bank spans AMC, AIME, USAMO and IMO-style levels.'],
  ['What happens when I get stuck?', 'Begin with a hint: it gives you a direction without taking the discovery away. When you are ready, read the worked solution and compare it with your own approach. You can come back to a problem as often as you need.'],
  ['When can I read a solution?', 'In Learn, a correct answer unlocks the solution. You can also choose the help option, or reach three incorrect attempts; those routes reveal the solution without awarding points for that question.'],
  ['How does the AI explanation work?', 'You provide your own Gemini API key to enable explanations. Provider usage and charges belong to your provider account. A paid CalculixHub plan does not currently include AI credits.'],
  ['Can I buy Pro or Max now?', 'No. Paid plans are in development, with pricing and final limits still to be confirmed. The comparison above describes the intended direction, not a subscription you can buy today.'],
];

export default function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="lx-faq" id="faq" data-tone="paper" aria-labelledby="lx-faq-title">
      <div className="lx-wrap lx-faq-grid">
        <header className="lx-faq-head">
          <Eyebrow index="08">Answers</Eyebrow>
          <SplitText as="h2" id="lx-faq-title" className="lx-h2" text={'A few useful\n*answers.*'} />
          <Rise as="p" className="lx-lead" delay={0.1}>Clear expectations make a better place to learn.</Rise>
          <Rise delay={0.16}>
            <a className="lx-link" href="/?auth=signup&tab=community">Ask in the community <Arrow size={15} /></a>
          </Rise>
        </header>
        <m.div className="lx-faq-list" initial="hidden" whileInView="shown" viewport={{ once: true, amount: 0.15 }} variants={{ shown: { transition: { staggerChildren: 0.07 } } }}>
          {FAQS.map(([question, answer], index) => {
            const expanded = open === index;
            return (
              <m.article
                key={question}
                className="lx-faq-item"
                data-open={expanded || undefined}
                variants={{ hidden: { opacity: 0, y: 22 }, shown: { opacity: 1, y: 0, transition: { duration: 0.7, ease: GLIDE } } }}
              >
                <h3>
                  <button type="button" onClick={() => setOpen(expanded ? null : index)} aria-expanded={expanded} aria-controls={`lx-faq-${index}`} id={`lx-faq-q-${index}`}>
                    <span className="lx-faq-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                    <span className="lx-faq-question">{question}</span>
                    <span className="lx-faq-sign" aria-hidden="true" />
                  </button>
                </h3>
                <AnimatePresence initial={false}>
                  {expanded && (
                    <m.div
                      id={`lx-faq-${index}`}
                      role="region"
                      aria-labelledby={`lx-faq-q-${index}`}
                      className="lx-faq-answer"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ height: { duration: 0.5, ease: GLIDE }, opacity: { duration: 0.3 } }}
                    >
                      <p>{answer}</p>
                    </m.div>
                  )}
                </AnimatePresence>
              </m.article>
            );
          })}
        </m.div>
      </div>
    </section>
  );
}
