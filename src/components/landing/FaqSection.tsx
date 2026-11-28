/**
 * "FAQ": the questions a visitor asks before signing up, answered in a line or two.
 *
 * The heading stays put while the list scrolls past it. Each answer opens in
 * place — the height eases open while the text fades up — and the plus turns
 * into a minus rather than being swapped for one.
 */

import { useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { FAQS } from './faqContent';
import { Arrow, GLIDE, Rise, SPRING, SplitText, fade } from './kit';


export default function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="lx-faq" id="faq" data-tone="paper" aria-labelledby="lx-faq-title">
      <div className="lx-wrap lx-faq-grid">
        <header className="lx-faq-head">
          <SplitText as="h2" id="lx-faq-title" className="lx-h2" text={'Questions,\nanswered.'} />
          <Rise delay={0.12}>
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
                variants={{ hidden: { opacity: 0, y: 22 }, shown: { opacity: 1, y: 0, transition: { ...SPRING.arrive, opacity: fade() } } }}
              >
                <h3>
                  <button type="button" onClick={() => setOpen(expanded ? null : index)} aria-expanded={expanded} aria-controls={`lx-faq-${index}`} id={`lx-faq-q-${index}`}>
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
