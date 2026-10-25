/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Threads 41-50: two more Olympiad discussions, then the general threads
 * that are not filed under a problem (study tips, a mistake log, a mini
 * challenge). Shape as in threads-01.mjs.
 */

const r = String.raw;

export default [
  {
    key: 't41',
    problem: 'gen-imo-geo-013',
    by: 'kuba_wisniewski',
    ago: 46,
    body: r`Orthocenter reflection: in acute $\triangle ABC$, the reflection $H'$ of $H$ over $BC$ lies on the circumcircle.

Angle chase: $\angle HBC = 90^\circ - \angle C$ and $\angle HCB = 90^\circ - \angle B$, so $\angle BHC = \angle B + \angle C = 180^\circ - \angle A$. Reflection preserves angles, so $\angle BH'C = 180^\circ - \angle A$. Since $H'$ is on the opposite side of $BC$ from $A$ and $\angle BH'C + \angle BAC = 180^\circ$, the quadrilateral $ABH'C$ is cyclic. ∎`,
    comments: [
      ['priya_sundar07', 9, r`Clean. The "opposite side of $BC$" sentence matters: the supplementary-angle criterion only works for points on opposite arcs.`],
      ['kuba_wisniewski', 15, r`Yes, always say which side when you use it.`, 0],
      ['gia_han_tran', 30, r`I drew it in GeoGebra and dragged the vertices around. It really stays on the circle 😍`],
      ['omar_haddad_x', 50, r`Corollary: the circumcircles of $BHC$, $CHA$ and $AHB$ all have radius $R$, since each is the reflection of the circumcircle over a side.`],
      ['emma_lindqvist', 70, r`Ooh, neat consequence. Same radius as the original circle.`, 3],
      ['hana_yoon22', 90, r`Also, the reflection of $H$ over the *midpoint* of $BC$ is the antipode of $A$. Two reflections, two points on the circle.`],
      ['zeynep_aydin', 110, r`That one I use all the time in olympiad geo: $H$ and the antipode of $A$ are symmetric about the midpoint of $BC$.`, 5],
      ['isla_mcbride', 140, r`What about obtuse triangles? Does it still work?`],
      ['kuba_wisniewski', 150, r`Yes. With directed angles mod $180^\circ$ the same proof covers every configuration. That's the main reason people use directed angles.`, 7],
      ['isla_mcbride', 158, r`directed angles... adding to my list of things to learn`, 7],
      ['alex_chung_ca', 190, r`Complex numbers check: on the unit circle, $h = a + b + c$, and reflection over the chord $bc$ is $z \mapsto b + c - bc\bar z$. For $z = h$ this gives $-\frac{bc}{a}$, which has modulus 1 ✅`],
      ['sam_whitaker', 220, r`This + the Euler line + the nine-point circle: the orthocenter trilogy on this site 😄`],
      ['nina_petrova', 250, r`Saving. The writeup is a great template: compute one angle, reflect, apply the cyclic criterion.`],
      ['farah_iqbal', 280, r`Two proofs, angle chase and complex. Into the collection!`],
    ],
  },
  {
    key: 't42',
    problem: 'gen-imo-com-020',
    by: 'jaden_okafor',
    ago: 43,
    body: r`Euler's formula $V - E + F = 2$ for connected plane graphs. My proof, by induction on $E$:

If the graph is a tree, $E = V - 1$ and $F = 1$, so $V - (V - 1) + 1 = 2$ ✓. Otherwise there is a cycle; removing an edge of the cycle merges two faces into one and keeps the graph connected, so $E$ and $F$ each drop by 1. ∎

Is "removing a cycle edge merges two faces" acceptable without proof?`,
    comments: [
      ['alex_chung_ca', 10, r`At olympiad level, yes, it's normally accepted (it's the Jordan curve theorem for polygons). State it as a fact: "an edge on a cycle borders two distinct faces".`],
      ['jaden_okafor', 16, r`Good, I'll phrase it that way.`, 0],
      ['nina_petrova', 30, r`Fun application: $K_5$ isn't planar. A simple planar graph with $V \ge 3$ has $E \le 3V - 6$, and $K_5$ has $10 > 9$.`],
      ['maya_goldberg', 50, r`where does $3V - 6$ come from?`, 2],
      ['nina_petrova', 58, r`Each face has at least 3 edges and each edge borders at most 2 faces, so $3F \le 2E$. Put that into Euler: $V - E + \frac{2E}{3} \ge 2$, so $E \le 3V - 6$.`, 2],
      ['maya_goldberg', 65, r`ohh, combining the two. nice`, 2],
      ['thao_vy_le', 90, r`And $K_{3,3}$ fails too: a bipartite graph has no triangles, so faces have at least 4 edges and $E \le 2V - 4$. Here $9 > 8$.`],
      ['kofi_mensah_m', 120, r`Checked it on a cube: $V = 8$, $E = 12$, $F = 6$, and $8 - 12 + 6 = 2$ ✅`],
      ['riya_kapoor5', 130, r`and a tetrahedron: $4 - 6 + 4 = 2$. this formula is magic`, 7],
      ['leo_hartmann', 160, r`Classic consequence: there are only 5 Platonic solids. Euler plus "$p \ge 3$ edges per face, $q \ge 3$ faces per vertex" gives $\frac1p + \frac1q > \frac12$.`],
      ['hana_yoon22', 190, r`And only $(3,3)$, $(3,4)$, $(4,3)$, $(3,5)$, $(5,3)$ satisfy it: tetrahedron, octahedron, cube, icosahedron, dodecahedron.`, 9],
      ['sofia_marques_mt', 220, r`Learning that the Platonic solids come from a two-line inequality made my week.`],
      ['chloe_tanaka', 250, r`Soccer ball: 12 pentagons + 20 hexagons, and $60 - 90 + 32 = 2$ ✅ The 12 pentagons are actually forced by Euler!`],
      ['jaden_okafor', 280, r`Thanks all, the soccer ball fact is incredible 😄`],
      ['emma_lindqvist', 300, r`Saving the $E \le 3V - 6$ derivation, that's the part I always forget.`],
    ],
  },
  {
    key: 't43',
    problem: null,
    by: 'minh_khoa_math',
    ago: 38,
    body: r`Compiling a "mod 1000 toolkit" from the threads here. Add yours!

1. Split: $1000 = 8 \cdot 125$. Solve mod 8 and mod 125, then CRT.
2. $\lambda(1000) = 100$: if $\gcd(a, 10) = 1$ then $a^{100} \equiv 1$.
3. If some power is $\equiv 1 + 200m$, its 5th power is $\equiv 1$ (thanks @meilin_chen).
4. For bases not coprime to 1000, only reduce the exponent above the pre-period (thanks @zeynep_aydin).
5. Power sums of roots: $S_{2n} = S_n^2 - 2(rs)^n$.`,
    comments: [
      ['rafael_ortiz_v', 6, r`6. $(1 + 400)^k \equiv 1 + 400k$. The 401 trick 😄`],
      ['bao_nguyen_17', 14, r`7. For the last two digits, work mod 4 and mod 25. $\lambda(100) = 20$.`],
      ['arjun_mehta_21', 25, r`8. Squares are restricted mod 1000. Even the last digit can't be 2, 3, 7 or 8, which kills a lot of cases fast.`],
      ['jaden_okafor', 40, r`9. Binomial theorem for $(1 + 10k)^n \equiv 1 + 10kn + 100\binom n2 k^2 \pmod{1000}$.`],
      ['meilin_chen', 50, r`10. Wilson: $(p-1)! \equiv -1 \pmod p$, handy for factorial residues mod a prime.`],
      ['ethan_caldwell9', 70, r`11. Always sanity-check the final answer mod 8 (or mod 2 and mod 5). Catches a ton of arithmetic slips.`],
      ['linh_ngoc_tran', 90, r`This is so helpful, saving the whole list 🙏`],
      ['duc_anh_pham', 110, r`12. Lifting the exponent: $v_p(a^n - b^n) = v_p(a - b) + v_p(n)$ for an odd prime $p$ with $p \mid a - b$ and $p \nmid ab$. Great for "divisible by $5^3$" questions.`],
      ['hana_yoon22', 130, r`LTE deserves its own thread honestly`, 7],
      ['zeynep_aydin', 150, r`Honoured to be on the list 😂 13. When grinding a power by hand, write the exponent in binary first.`],
      ['sofia_marques_mt', 180, r`14. Numbers ending in 5 or 6 keep that last digit in every power. Small, but saves time.`],
      ['gia_han_tran', 210, r`Can we pin this? 📌`],
      ['minh_khoa_math', 220, r`I'll keep updating the post as people add more!`, 11],
      ['omar_haddad_x', 260, r`15. Euler's criterion: $a^{(p-1)/2} \equiv \pm 1 \pmod p$, with $+1$ exactly when $a$ is a square mod $p$.`],
      ['noah_fischer_b', 300, r`Beginner question: what's $\lambda$? Is it like $\varphi$?`],
      ['bao_nguyen_17', 310, r`The Carmichael function: the smallest exponent that works for EVERY unit. $\varphi(n)$ always works too; $\lambda(n)$ is the smallest. $\lambda(1000) = 100$ vs $\varphi(1000) = 400$.`, 14],
    ],
  },
  {
    key: 't44',
    problem: null,
    by: 'chloe_tanaka',
    ago: 33,
    body: r`My first big contest is in about three weeks (AMC 10!) 😬 How do you spend the last stretch?

I score around 90-100 on mock tests and I panic on the last five problems.`,
    comments: [
      ['ethan_caldwell9', 8, r`Full timed mocks twice a week, and spend MORE time reviewing than taking them. Every miss goes in a mistake log with the "why".`],
      ['isla_mcbride', 15, r`For the last five: don't panic-read all of them. Skim, pick the one that feels most familiar, and commit 10 minutes. One solved hard problem beats five half-read ones.`],
      ['chloe_tanaka', 22, r`pick one and commit, I like that. I always jump between them`, 1],
      ['sam_whitaker', 40, r`Accuracy on 1-15 matters more than people think. A careless miss there costs as much as a hard problem. I do 1-15 slowly and double-check.`],
      ['maya_goldberg', 55, r`this is me. I rush 1-10 and lose easy points 😭`, 3],
      ['aisha_rahman_m', 70, r`Check the current scoring rules for your contest before deciding on a guessing strategy. Blank vs guess depends on them.`],
      ['jaden_okafor', 90, r`Topic-wise, counting/probability and number theory are the most "trainable" in a few weeks. Geometry takes longer to improve.`],
      ['noah_fischer_b', 110, r`good to know, focusing on counting then`, 6],
      ['riya_kapoor5', 130, r`How many hours a day do you all do? I can only manage about 1 hour on school days`],
      ['farah_iqbal', 140, r`One focused hour beats three distracted ones. Consistency > volume.`, 8],
      ['mateo_quispe', 160, r`SLEEP the night before!! Last year I stayed up doing problems and blanked on easy ones.`],
      ['kofi_mensah_m', 180, r`underrated advice`, 10],
      ['zeynep_aydin', 200, r`Redo the problems you got wrong a week later without looking at the solution. If you can't, you didn't really learn it yet.`],
      ['linh_ngoc_tran', 230, r`Not doing AMC this year but saving this for next year 📌`],
      ['alex_chung_ca', 260, r`The Foundation and Advanced sets here make good warmups: 10 problems, timed, every morning for the last week.`],
      ['chloe_tanaka', 290, r`Thank you all!! Plan: mocks Tue/Sat, mistake log, accuracy drills on 1-15, and SLEEP 😴`],
    ],
  },
  {
    key: 't45',
    problem: null,
    by: 'ethan_caldwell9',
    ago: 27,
    body: r`Share a problem that humbled you this week 🙃

Mine: I assumed $n^2 + n + 41$ is always prime (Euler's famous polynomial!). Then $n = 40$ gives $40^2 + 40 + 41 = 41^2$. Patterns lie.`,
    comments: [
      ['jaden_okafor', 6, r`It's prime for $n = 0, 1, \dots, 39$ and then fails at 40. The classic "patterns lie" example.`],
      ['priya_sundar07', 15, r`Mine: "Is $1 + \frac12 + \dots + \frac1n$ ever an integer for $n > 1$?" I brute-forced for an hour. The answer is never, and the largest-power-of-2 argument is so slick.`],
      ['leo_hartmann', 30, r`"The circle through the midpoints of the sides has radius $R/2$." I bashed coordinates for two pages before seeing the homothety.`],
      ['ananya_rk', 45, r`I counted circular arrangements with $n!$ instead of $(n-1)!$. Humbled by the basics.`],
      ['kofi_mensah_m', 60, r`Mine was $x + 1/x = 3$ in my first week 😂`],
      ['duc_anh_pham', 80, r`The $\sum k^{2026} \bmod 1000$ one. Three attempts to get the mod 125 part right.`],
      ['maya_goldberg', 100, r`Probability: "flip a coin until you get two heads in a row; expected number of flips?" I said 4. It's 6.`],
      ['meilin_chen', 110, r`And for HT it IS 4! Same chance for each pair of flips, different expected waiting time. Mind-bending.`, 6],
      ['sofia_marques_mt', 130, r`Monty Hall. Every single time 😅`],
      ['thao_vy_le', 150, r`Counting lattice paths through a point and forgetting both halves have constraints. Same as Aisha in the Catalan thread 😂`],
      ['emma_lindqvist', 180, r`A proof where I divided by $(a - b)$ without checking $a \ne b$. My teacher circled it three times in red.`],
      ['noah_fischer_b', 200, r`I forgot 1 isn't prime. Lost a whole problem.`],
      ['ethan_caldwell9', 230, r`This thread is therapeutic. We're all humbled together 🫂`],
    ],
  },
  {
    key: 't46',
    problem: null,
    by: 'farah_iqbal',
    ago: 22,
    body: r`Proof-writing peer review circle: who's in? ✍️

Idea: each week we pick two Olympiad proof problems from the bank, everyone posts a writeup in the thread, and we review each other's proofs for clarity, gaps and equality cases.

Week 1 suggestion: Wilson's theorem and the monochromatic triangle in $K_6$.`,
    comments: [
      ['emma_lindqvist', 8, r`IN. I've been writing proofs alone and have no idea if they're readable.`],
      ['nina_petrova', 15, r`In! I can review the graph theory ones.`],
      ['sam_whitaker', 22, r`In. Can we also do one easier problem each week so beginners can join?`],
      ['farah_iqbal', 28, r`Great idea: one beginner-friendly proof + one harder. Maybe $x^2 - y^2 = 23$ for week 1?`, 2],
      ['kofi_mensah_m', 35, r`I'd join for the easier one!! @farah_iqbal count me in`, 2],
      ['sofia_marques_mt', 50, r`Count me in. Rubric suggestion: (1) correct? (2) every step justified? (3) equality and edge cases? (4) readable by someone who hasn't solved it?`],
      ['farah_iqbal', 58, r`Perfect rubric, adopting it.`, 5],
      ['alex_chung_ca', 80, r`In, and happy to review. Tip for reviewers: say what's good before what's missing. Posting a proof is vulnerable 😄`],
      ['gabriel_santos3', 100, r`In! My prefix-sums writeup got great feedback here already, so this format works.`],
      ['hana_yoon22', 130, r`I'll review inequalities. Daniel and I can split them.`],
      ['daniel_ivanov8', 140, r`Deal 🤝`, 9],
      ['maya_goldberg', 170, r`Can Foundation people join? I've never written a proof`],
      ['thao_vy_le', 178, r`Yes!! The point is learning. Start with the $x^2 - y^2 = 23$ one, it's very friendly.`, 11],
      ['quang_huy_do', 200, r`I want to join too!`],
      ['farah_iqbal', 230, r`Amazing response! Week 1: $x^2 - y^2 = 23$ (everyone) and Wilson's theorem (stretch). Post writeups as replies by Sunday 📝`],
    ],
  },
  {
    key: 't47',
    problem: null,
    by: 'leo_hartmann',
    ago: 16,
    body: r`Hot take: projective geometry is NOT worth learning before you're comfortable with angle chasing, power of a point and similar triangles.

Change my mind 🔥`,
    comments: [
      ['kuba_wisniewski', 5, r`Agree 100%. Cross-ratios without a solid foundation is like calculus before fractions.`],
      ['priya_sundar07', 12, r`Partly disagree. Harmonic divisions explain WHY so many configurations work. Learning a little early made basic geometry more fun for me.`],
      ['leo_hartmann', 18, r`Fair. "A little" vs "a whole chapter" might be the real distinction.`, 1],
      ['omar_haddad_x', 30, r`For AIME specifically: almost never needed. Coordinates, trig and power of a point cover nearly everything.`],
      ['zeynep_aydin', 45, r`Agree for AIME. For olympiads it starts paying off.`, 3],
      ['gia_han_tran', 60, r`As someone at the similar-triangles stage: thank you for saying this, I felt behind for not knowing projective 😅`],
      ['isla_mcbride', 68, r`You're not behind! Fundamentals first is the right order.`, 5],
      ['alex_chung_ca', 90, r`My order: angle chasing → similar triangles → power of a point → trig and ratio lemmas → homothety → inversion → projective. Complex and barycentric as tools alongside.`],
      ['hana_yoon22', 110, r`Counterpoint: complex numbers early is great because it gives you a guaranteed method when synthetic ideas run out.`],
      ['kuba_wisniewski', 118, r`As a synthetic person I'm contractually obliged to disagree 😂 but yes, a bash fallback reduces stress.`, 8],
      ['riya_kapoor5', 140, r`what's power of a point? (sorry, Foundation here)`],
      ['omar_haddad_x', 148, r`If two chords $AB$ and $CD$ meet at $P$, then $PA \cdot PB = PC \cdot PD$. Same for secants from an outside point. The most useful circle fact there is.`, 10],
      ['riya_kapoor5', 155, r`oh that's simple! thank you`, 10],
      ['meilin_chen', 180, r`Generating-function people watching geometry people fight 🍿`],
      ['leo_hartmann', 200, r`Verdict: fundamentals first, a taste of harmonics is fine, full projective later. Thanks all 😄`],
      ['sam_whitaker', 220, r`Late, but agree with the verdict. Power of a point alone solved about half my geometry mocks.`],
    ],
  },
  {
    key: 't48',
    problem: null,
    by: 'quang_huy_do',
    ago: 10,
    body: r`I'm in grade 8 and I started contest math a few weeks ago. Where should I start? Everything here looks very hard 😅`,
    comments: [
      ['bao_nguyen_17', 6, r`Welcome! Start with the Foundation set here. Do 1-2 problems a day, and ALWAYS read the solution afterwards, even when you got it right.`],
      ['linh_ngoc_tran', 12, r`I'm in grade 9 and started 2 months ago! "The Hidden Pair" and "Reciprocal echoes" were my first ones. You'll get faster, I promise.`],
      ['quang_huy_do', 18, r`thank you! I'll start with those`, 1],
      ['minh_khoa_math', 30, r`Learn these five first: (1) factoring identities like $a^2 - b^2$, (2) counting basics (multiplication principle, $\binom nk$), (3) divisibility and remainders, (4) area formulas, (5) Pythagorean triples.`],
      ['maya_goldberg', 45, r`I'm new too (Foundation)! Want to be study buddies? We could do the same problem each day.`],
      ['quang_huy_do', 52, r`Yes!! 🤝`, 4],
      ['duc_anh_pham', 70, r`One piece of advice: don't be scared of the hard-looking threads. Read them for fun, understand 10%, and next month you'll understand 30%. That's how everyone learned.`],
      ['noah_fischer_b', 90, r`I was in the same spot a month ago. What helped: a notebook of tricks I learn (like squaring $x + \frac1x$).`],
      ['riya_kapoor5', 110, r`notebook gang 📒`, 7],
      ['kofi_mensah_m', 130, r`And ask questions here, everyone is super nice. I asked how to factor 121500 and got five answers in 20 minutes 😄`],
      ['thao_vy_le', 150, r`Grade 8 is a great time to start. No rush. Enjoy the "aha" moments.`],
      ['chloe_tanaka', 170, r`Mathcounts-style problems are great practice at your level too.`],
      ['gia_han_tran', 190, r`Feel free to ask anything, anytime! 💛`],
      ['isla_mcbride', 220, r`And when you get one wrong, that's the best learning moment. Write down WHY.`],
      ['quang_huy_do', 250, r`Thank you all so much! Starting tomorrow with Maya 💪`],
    ],
  },
  {
    key: 't49',
    problem: null,
    by: 'kuba_wisniewski',
    ago: 6,
    body: r`Mistake log thread 📓 Post the dumbest mistake you made this week, plus the rule you wrote so it never happens again.

Mine: I used Ptolemy on a quadrilateral that wasn't cyclic. Rule: check "cyclic?" before Ptolemy or Brahmagupta.`,
    comments: [
      ['zeynep_aydin', 5, r`Used the perimeter instead of the semiperimeter (again). Rule: write "s = SEMI" at the top of every page, as Duc Anh said 😂`],
      ['ethan_caldwell9', 12, r`$7 \times 8 = 54$. Rule: slow down on the arithmetic I "know".`],
      ['aisha_rahman_m', 20, r`Counted $\binom{10}{5}^2$ paths through $(5,5)$ and forgot the diagonal constraint. Rule: constraints apply to every piece.`],
      ['gabriel_santos3', 32, r`Forgot $P_0 = 0$ in a prefix-sum argument. Rule: always include the empty prefix.`],
      ['sofia_marques_mt', 45, r`Counted a digit set containing 0 as 24 arrangements. Rule: deal with leading zeros first.`],
      ['bao_nguyen_17', 60, r`Reduced an exponent mod 100 with a base not coprime to 1000. Rule: check the gcd before Euler.`],
      ['isla_mcbride', 75, r`Wrote $\sqrt{a^2 + b^2} = a + b$ in a rush. Rule: never simplify roots while tired.`],
      ['mateo_quispe', 90, r`Read "at least" as "at most". Rule: underline the quantifiers.`],
      ['hana_yoon22', 110, r`Assumed WLOG $a \ge b \ge c$ in an inequality that was only cyclic, not symmetric. Rule: WLOG needs symmetry (cyclic only lets you assume $a$ is the largest).`],
      ['daniel_ivanov8', 118, r`That one is evil. Cyclic ≠ symmetric gets everyone at least once.`, 8],
      ['riya_kapoor5', 140, r`Forgot that 1 isn't prime 🙈 Rule: primes start at 2.`],
      ['jaden_okafor', 160, r`Got a probability bigger than 1 and didn't notice. Rule: sanity-check that every probability is between 0 and 1.`],
      ['alex_chung_ca', 190, r`Proved the converse instead of the statement. Rule: write "To prove: ..." as the first line.`],
      ['kuba_wisniewski', 210, r`Love this. I'll compile all the rules into a checklist at the end of the week 📋`],
      ['linh_ngoc_tran', 240, r`Forgot to subtract 2 when squaring $x + \frac1x$. Rule: $(a+b)^2$ has a middle term!! 😂`],
    ],
  },
  {
    key: 't50',
    problem: null,
    by: 'omar_haddad_x',
    ago: 3,
    body: r`Mini challenge ⚡ Find all positive integers $n$ such that $n + 1$ divides $n^2 + 1$.

Post your answer and a one-line reason. Spoilers in the replies!`,
    comments: [
      ['minh_khoa_math', 4, r`$n = 1$. $n^2 + 1 = (n+1)(n-1) + 2$, so $n + 1 \mid 2$.`],
      ['omar_haddad_x', 7, r`Fastest gun in the forum 🤠 ✅`, 0],
      ['linh_ngoc_tran', 12, r`I found $n = 1$ by trying small cases, then saw Minh's reason. The division trick is so clean.`],
      ['sam_whitaker', 18, r`Same thing in mod language: $n \equiv -1 \pmod{n+1}$, so $n^2 + 1 \equiv 1 + 1 = 2$.`],
      ['noah_fischer_b', 25, r`Follow-up: $n + 1 \mid n^3 + 1$ is always true, since $n^3 + 1 = (n+1)(n^2 - n + 1)$.`],
      ['omar_haddad_x', 30, r`Nice. In general $n^k + 1 \equiv (-1)^k + 1 \pmod{n+1}$: always divisible for odd $k$, and for even $k$ only when $n + 1 \mid 2$.`, 4],
      ['meilin_chen', 40, r`Harder follow-up: all $n$ with $n + 2 \mid n^3 + 5$. Plug in $n = -2$: the remainder is $-8 + 5 = -3$, so $n + 2 \mid 3$ and $n = 1$.`],
      ['chloe_tanaka', 55, r`the remainder theorem with integers! so $n + 2 \mid 3$, $n = 1$ ✅`, 6],
      ['duc_anh_pham', 70, r`Trap version: $n^2 + 1 \mid n^3 + n + 1$. Since $n^3 + n + 1 = n(n^2 + 1) + 1$, we'd need $n^2 + 1 \mid 1$. No positive solutions 😄`],
      ['kofi_mensah_m', 85, r`I love these mini challenges!! More please 🙏`],
      ['gia_han_tran', 95, r`Same! Can we do one every day?`, 9],
      ['omar_haddad_x', 100, r`Deal. A new one every evening ⚡`, 9],
      ['rafael_ortiz_v', 120, r`AMC-style twist: for how many integers $n$ (negatives allowed) is $\frac{n^2+1}{n+1}$ an integer? Now $n + 1 \in \{\pm1, \pm2\}$, so $n \in \{0, -2, 1, -3\}$. Four.`],
      ['thao_vy_le', 140, r`"Divide and look at the remainder" is the #1 tool for these. Great warmup, Omar!`],
      ['riya_kapoor5', 160, r`got $n = 1$ in 2 minutes, I'm so proud of myself 😂`],
    ],
  },
];
