/**
 * "Past papers", and Fig. 4: the archive, one square to a paper.
 *
 * A number like 233 is easy to print and hard to picture, so the page does not
 * ask anyone to take it on trust. The shelf lays the archive out by year, from
 * the first Olympiad in 1959 to this year's papers, with one square for every
 * paper it holds, stacked where a year has several. The shape is the archive's
 * own history: the IMO alone for thirteen years, the USAMO joining in 1972,
 * the selection tests and the short-answer contests arriving as the years fill.
 *
 * It can be read as well as looked at. Running a pointer or a finger along it,
 * or the arrow keys once it has focus, names the papers of each year. Beside
 * it is one problem quoted from the archive, which follows the year when the
 * year has one to show.
 *
 * Every square is checked against the catalog by archiveFigures.test.ts.
 */

import { memo, useRef, useState } from 'react';
import { ARCHIVE_FIGURES, ARCHIVE_SHELF, ARCHIVE_UNDATED, shelfAt, yearsOf } from './archiveFigures';
import { ARCHIVE_SAMPLES } from './archiveSamples';
import { Arrow } from './kit';
import Tex from './Tex';

const FIRST = ARCHIVE_FIGURES.firstYear;
const LAST = ARCHIVE_FIGURES.lastYear;
const YEARS = Array.from({ length: LAST - FIRST + 1 }, (_, index) => FIRST + index);

/** How many papers each bank holds in each year, by position along the shelf. */
const ROWS = ARCHIVE_SHELF.map(row => {
  const counts = YEARS.map(() => 0);
  for (const entry of row.contests) for (const year of yearsOf(entry.years)) counts[year - FIRST] += 1;
  const figures = ARCHIVE_FIGURES.families.find(family => family.family === row.family)!;
  return { family: row.family, counts, tallest: Math.max(...counts), papers: figures.papers, problems: figures.problems, format: figures.format };
});

/** The year each quoted problem was set, read from the citation ("IMO 1988 · Problem 6"). */
const SAMPLES = ARCHIVE_SAMPLES.map(sample => ({ ...sample, year: Number(sample.ref.match(/\b(19|20)\d{2}\b/)?.[0]) }));
const NOTES: Record<string, string> = { 'imo-1959-1': 'The first problem of the first Olympiad.' };
const DECADES = YEARS.filter(year => year % 10 === 0);

const count = (papers: number) => `${papers} ${papers === 1 ? 'paper' : 'papers'}`;

/** What the archive holds for one year, in words. */
function describe(year: number): string {
  const held = shelfAt(year).flatMap(row => row.contests);
  if (held.length === 0) return `${year}: nothing on the shelf.`;
  return `${year}: ${held.join(', ')}. ${count(held.length)}.`;
}

export default function ArchiveShelf() {
  const plot = useRef<HTMLDivElement>(null);
  const [year, setYear] = useState<number | null>(null);
  const [sample, setSample] = useState(0);
  const shown = SAMPLES[sample];

  const pick = (next: number) => {
    const bounded = Math.max(FIRST, Math.min(LAST, next));
    setYear(bounded);
    const match = SAMPLES.findIndex(entry => entry.year === bounded);
    if (match >= 0) setSample(match);
  };
  const follow = (event: React.PointerEvent) => {
    const box = plot.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    pick(FIRST + Math.floor(((event.clientX - box.left) / box.width) * YEARS.length));
  };
  const onKey = (event: React.KeyboardEvent) => {
    const from = year ?? shown.year;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') pick(from + 1);
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') pick(from - 1);
    else if (event.key === 'PageUp') pick(from + 10);
    else if (event.key === 'PageDown') pick(from - 10);
    else if (event.key === 'Home') pick(FIRST);
    else if (event.key === 'End') pick(LAST);
    else return;
    event.preventDefault();
  };
  const another = () => {
    const next = (sample + 1) % SAMPLES.length;
    setSample(next);
    setYear(SAMPLES[next].year);
  };

  const at = year ?? shown.year;
  const position = `${(((at - FIRST + 0.5) / YEARS.length) * 100).toFixed(3)}%`;

  return (
    <section className="p1-sec p1-archive" id="archive" aria-labelledby="p1-archive-title">
      <div className="p1-wrap">
        <header className="p1-archive-head">
          <h2 id="p1-archive-title" className="p1-title">{ARCHIVE_FIGURES.papers} past papers, one shelf.</h2>
          <p className="p1-prose">
            {ARCHIVE_FIGURES.problems.toLocaleString('en-US')} problems from the AMC 12, the AIME, the USAMO and its selection tests, and the IMO,
            back to the first Olympiad in {FIRST}. Take a whole paper or one problem at a time.{' '}
            {ARCHIVE_FIGURES.proofs.toLocaleString('en-US')} of them are written proofs, which you mark yourself.
          </p>
        </header>

        <figure className="p1-shelf" aria-labelledby="p1-shelf-caption">
          <div
            className="p1-shelf-chart"
            style={{ ['--years' as string]: YEARS.length }}
            role="slider"
            tabIndex={0}
            aria-label="The archive, year by year"
            aria-valuemin={FIRST}
            aria-valuemax={LAST}
            aria-valuenow={at}
            aria-valuetext={describe(at)}
            onKeyDown={onKey}
            onPointerDown={follow}
            onPointerMove={event => { if (event.pointerType === 'mouse' || event.buttons > 0) follow(event); }}
          >
            <ShelfRows />
            <div ref={plot} className="p1-shelf-plot" aria-hidden="true">
              <span className="p1-shelf-cursor" style={{ left: position }} data-idle={year === null || undefined} />
              {SAMPLES.map(entry => (
                <span key={entry.id} className="p1-shelf-pin" style={{ left: `${(((entry.year - FIRST + 0.5) / YEARS.length) * 100).toFixed(3)}%` }} data-on={entry.id === shown.id || undefined} />
              ))}
            </div>
            <div className="p1-shelf-decades" aria-hidden="true">
              {DECADES.map(decade => (
                <span key={decade} className="p1-num" style={{ left: `${(((decade - FIRST + 0.5) / YEARS.length) * 100).toFixed(3)}%` }}>{decade}</span>
              ))}
            </div>
          </div>

          <p className="p1-shelf-readout">
            {year === null
              ? 'Every square is one paper. Run along the shelf to read a year.'
              : describe(year)}
          </p>

          <figcaption id="p1-shelf-caption" className="p1-caption">
            <b>Fig. 4.</b> The archive by year, {FIRST} to {LAST}, one square to a paper. The marks along the top are the years of the
            problems quoted beside it. {ARCHIVE_UNDATED} further collections carry no year and are not drawn.
          </figcaption>
        </figure>

        <div className="p1-archive-foot">
          <article className="p1-specimen" aria-live="polite">
            <p className="p1-specimen-ref">{shown.ref.replace(' · ', ', ')}</p>
            <Tex as="p" className="p1-specimen-text" text={shown.prompt} />
            {NOTES[shown.id] && <p className="p1-caption">{NOTES[shown.id]}</p>}
            <button type="button" className="p1-textbtn" onClick={another}>Another from the shelf</button>
          </article>

          <div className="p1-archive-banks">
            <table className="p1-table">
              <caption className="sr-only">What each bank of the archive holds</caption>
              <thead>
                <tr><th scope="col">Bank</th><th scope="col">Answers</th><th scope="col" className="is-num">Papers</th><th scope="col" className="is-num">Problems</th></tr>
              </thead>
              <tbody>
                {ROWS.map(row => (
                  <tr key={row.family}>
                    <th scope="row"><span className="p1-key" data-family={row.family} aria-hidden="true" />{row.family}</th>
                    <td>{row.format}</td>
                    <td className="is-num p1-num">{row.papers}</td>
                    <td className="is-num p1-num">{row.problems}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <a className="p1-btn is-outline" href="/?auth=signup&tab=archive">
              <span>Open the archive</span>
              <Arrow />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/** The squares. They never change, so they are drawn once and left alone while the cursor moves over them. */
const ShelfRows = memo(function ShelfRows() {
  return (
    <div className="p1-shelf-rows">
      {ROWS.map(row => (
        <div key={row.family} className="p1-shelf-row" data-family={row.family} style={{ ['--tallest' as string]: row.tallest }}>
          <span className="p1-shelf-name">{row.family}</span>
          <span className="p1-shelf-cells" aria-hidden="true">
            {row.counts.map((papers, index) => (
              <span key={index} className="p1-shelf-col">
                {Array.from({ length: papers }, (_, paper) => <i key={paper} />)}
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
});
