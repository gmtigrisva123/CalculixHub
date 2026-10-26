import { ARCHIVE_FAMILIES, type ArchiveFamily, type ArchivePaper } from '../../domain/examArchive';
import { hashString, seededRandom } from './archiveModel';

/**
 * Where every problem sits in the archive's sky.
 *
 * The map is a reading of the catalog, not decoration. Each bank is one ring (IMO nearest the
 * centre, AMC 12 on the outside); going around a ring is going through the years, with the
 * oldest paper just after the gap and the newest just before it. Every paper is a small knot
 * with one star per question. Papers from the same bank and year (AMC 12A and 12B, AIME I and
 * II, USAMO and USAJMO) sit side by side across the ring, and the two adapted sets, which have
 * no single year, sit in the core. A ring that stops short is a bank whose papers here start
 * later: the gaps are part of the reading.
 */

export const RING_RADIUS: Record<ArchiveFamily, number> = { IMO: 1.9, USAMO: 2.95, AIME: 3.85, 'AMC 12': 4.75 };
/** Share of the circle the years use; the rest is the gap where time starts and ends. */
export const YEAR_ARC = Math.PI * 2 * 0.9;
/** The middle of the gap points away from the viewer. */
export const GAP_ANGLE = -Math.PI / 2;
/** Radius of the decade scale outside the outer ring. */
export const SCALE_RADIUS = 5.5;

export type GalaxyLayout = {
  papers: ArchivePaper[];
  /** xyz per star. */
  positions: Float32Array;
  /** Paper index per star (into `papers`). */
  paperOf: Uint16Array;
  /** Question index within its paper, per star. */
  questionOf: Uint16Array;
  /** Bank per star, as an index into ARCHIVE_FAMILIES. */
  familyOf: Uint8Array;
  sizes: Float32Array;
  phases: Float32Array;
  /** First star of each paper; a paper's stars are contiguous and in question order. */
  paperStart: Uint32Array;
  firstYear: number;
  lastYear: number;
  angleOf: (year: number) => number;
};

export function buildGalaxyLayout(papers: ArchivePaper[]): GalaxyLayout {
  const years = papers.flatMap(paper => (paper.year ? [paper.year] : []));
  const firstYear = Math.min(...years);
  const lastYear = Math.max(...years);
  const span = lastYear - firstYear + 1;
  const start = GAP_ANGLE + (Math.PI * 2 - YEAR_ARC) / 2;
  const angleOf = (year: number) => start + YEAR_ARC * ((year - firstYear + 0.5) / span);

  // Papers that share a bank and a year sit side by side across the ring.
  const siblings = new Map<string, ArchivePaper[]>();
  for (const paper of papers) {
    const key = `${paper.family}:${paper.year ?? 'core'}`;
    if (!siblings.has(key)) siblings.set(key, []);
    siblings.get(key)!.push(paper);
  }
  for (const list of siblings.values()) list.sort((a, b) => a.contest.localeCompare(b.contest, 'en', { numeric: true }));

  const total = papers.reduce((sum, paper) => sum + paper.questions.length, 0);
  const positions = new Float32Array(total * 3);
  const paperOf = new Uint16Array(total);
  const questionOf = new Uint16Array(total);
  const familyOf = new Uint8Array(total);
  const sizes = new Float32Array(total);
  const phases = new Float32Array(total);
  const paperStart = new Uint32Array(papers.length);

  let star = 0;
  papers.forEach((paper, paperIndex) => {
    const family = ARCHIVE_FAMILIES.indexOf(paper.family);
    const random = seededRandom(hashString(paper.id));
    const group = siblings.get(`${paper.family}:${paper.year ?? 'core'}`)!;
    const slot = group.indexOf(paper) - (group.length - 1) / 2;
    let cx: number;
    let cz: number;
    if (paper.year) {
      const radius = RING_RADIUS[paper.family] + slot * (paper.family === 'USAMO' ? 0.21 : 0.17);
      const angle = angleOf(paper.year) + (random() - 0.5) * 0.012;
      cx = Math.cos(angle) * radius;
      cz = Math.sin(angle) * radius;
    } else {
      // The adapted sets: a small pair at the heart of the map.
      const angle = family * 1.9 + 0.6;
      cx = Math.cos(angle) * 0.34;
      cz = Math.sin(angle) * 0.34;
    }
    const cy = (random() - 0.5) * 0.05;
    const spin = random() * Math.PI * 2;
    paperStart[paperIndex] = star;
    paper.questions.forEach((question, questionIndex) => {
      // A small sunflower knot: even spacing without a visible grid.
      const rho = 0.03 * Math.sqrt(questionIndex + 0.6);
      const phi = spin + questionIndex * 2.39996;
      positions[star * 3] = cx + Math.cos(phi) * rho;
      positions[star * 3 + 1] = cy + (random() - 0.5) * 0.03;
      positions[star * 3 + 2] = cz + Math.sin(phi) * rho;
      paperOf[star] = paperIndex;
      questionOf[star] = questionIndex;
      familyOf[star] = family;
      sizes[star] = question.kind === 'proof' ? 1.25 : 1;
      phases[star] = random();
      star += 1;
    });
  });

  return { papers, positions, paperOf, questionOf, familyOf, sizes, phases, paperStart, firstYear, lastYear, angleOf };
}
