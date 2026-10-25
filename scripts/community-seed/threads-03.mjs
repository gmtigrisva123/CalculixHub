/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Threads 21-30: Advanced counting and geometry, and the first Olympiad proof
 * discussions. Shape as in threads-01.mjs.
 */

const r = String.raw;

export default [
  {
    key: 't21',
    problem: 'gen-aime-geo-010',
    by: 'sofia_marques_mt',
    ago: 188,
    body: r`Altitude from area (Advanced): legs 7 and 24, hypotenuse 25. The altitude to the hypotenuse is $\frac{7\cdot24}{25} = \frac{168}{25}$, numerator 168.

It took me a minute to see why "area two ways" works so well. What are your favourite "compute X two ways" tricks?`,
    comments: [
      ['farah_iqbal', 10, r`Double counting area is my favourite tool. Another one: the inradius of a right triangle is $r = \frac{a + b - c}{2}$. For 7-24-25 that's 3, and $K/s = 84/28 = 3$ too ✅ two ways again.`],
      ['sofia_marques_mt', 17, r`the $a+b-c$ one is new to me, love it`, 0],
      ['omar_haddad_x', 30, r`Similar triangles give it as well: the altitude splits the hypotenuse into $\frac{49}{25}$ and $\frac{576}{25}$, and $h^2 = \frac{49}{25}\cdot\frac{576}{25}$, so $h = \frac{7\cdot24}{25}$.`],
      ['riya_kapoor5', 50, r`the geometric mean thing! we learned it in class but I never used it`, 2],
      ['jaden_okafor', 70, r`Two ways in combinatorics too: count handshakes per person ($n(n-1)/2$) or per pair ($\binom n2$). Same idea everywhere.`],
      ['hana_yoon22', 90, r`And in inequalities: Cauchy–Schwarz is basically "compute a dot product two ways". Double counting is a whole worldview 😄`],
      ['chloe_tanaka', 110, r`The Foundation version (8-15-17) gives $\frac{120}{17}$. Is the fraction always already reduced?`],
      ['isla_mcbride', 120, r`For a primitive Pythagorean triple, yes: $c$ shares no prime factor with $a$ or $b$, so $\gcd(ab, c) = 1$. For a non-primitive one like 6-8-10 you get $\frac{48}{10} = \frac{24}{5}$, so reduce!`, 6],
      ['chloe_tanaka', 128, r`good to know, I'd have entered 48 😅`, 6],
      ['aisha_rahman_m', 150, r`Mnemonic: altitude to the hypotenuse = leg × leg / hypotenuse. The two short ones over the long one.`],
      ['mateo_quispe', 180, r`how do you recognize 7-24-25 as a right triangle so fast?`],
      ['ethan_caldwell9', 186, r`Memorize the common triples: 3-4-5, 5-12-13, 8-15-17, 7-24-25, 20-21-29, 9-40-41. They show up constantly.`, 10],
      ['mateo_quispe', 195, r`making flashcards now 📇`, 10],
      ['yuki_morimoto', 240, r`Generator for primitive triples: $(m^2 - n^2,\ 2mn,\ m^2 + n^2)$. 7-24-25 is $m = 4$, $n = 3$.`],
    ],
  },
  {
    key: 't22',
    problem: 'gen-aime-com-017',
    by: 'isla_mcbride',
    ago: 179,
    body: r`A circular block (Advanced): 9 people around a circle, two specific people must sit together → $2 \cdot 7! = 10080$, remainder 80.

Follow-up I can't crack: what if THREE specific people must sit together, in any order?`,
    comments: [
      ['thao_vy_le', 12, r`Glue them into one block: $3!$ internal orders, and the circle now has 7 units, so $(7-1)! = 720$ arrangements. Total $6 \cdot 720 = 4320$.`],
      ['isla_mcbride', 18, r`Oh so it's the same idea, the block just has more internal orders.`, 0],
      ['jaden_okafor', 35, r`And "the three sit together with A in the middle" would be $2 \cdot 720 = 1440$.`, 0],
      ['noah_fischer_b', 55, r`Why $(n-1)!$ for circles again? I keep mixing up when to use $n!$`],
      ['sam_whitaker', 62, r`Line: $n!$. Circle where rotations count as the same: $(n-1)!$. Circle where rotations AND reflections count as the same (a necklace you can flip): $(n-1)!/2$.`, 3],
      ['noah_fischer_b', 70, r`necklaces! so that's the third case`, 3],
      ['omar_haddad_x', 100, r`Complement version: two specific people must NOT sit together: $8! - 2\cdot7! = 40320 - 10080 = 30240$.`],
      ['riya_kapoor5', 130, r`wait that's a nice check, $30240/40320 = 3/4$. So they're together a quarter of the time?`, 6],
      ['omar_haddad_x', 138, r`Yes! A's two neighbours are 2 of the other 8 people, so B is one of them with probability $2/8 = 1/4$ ✅`, 6],
      ['linh_ngoc_tran', 170, r`The answer box wants 080, I almost typed 800 lol`],
      ['farah_iqbal', 185, r`Pad on the left, not the right 😂 80 → 080.`, 9],
      ['kuba_wisniewski', 220, r`Nice variation: $n$ couples around a circle, every couple sits together: $2^n (n-1)!$. For 4 couples, $16 \cdot 6 = 96$.`],
      ['gabriel_santos3', 260, r`And "no couple sits together" needs full inclusion–exclusion over the couples. It's a cousin of the famous ménage problem.`, 11],
      ['emma_lindqvist', 300, r`Saving this as my circular arrangements reference page 📌`],
    ],
  },
  {
    key: 't23',
    problem: 'gen-aime-com-019',
    by: 'jaden_okafor',
    ago: 171,
    body: r`Distinct digits, one residue (Advanced, 5 digits): 9072. Sharing a tidy way to organize it.

Residue classes R0 = {0,3,6,9}, R1 = {1,4,7}, R2 = {2,5,8}. Pick $(a, b, c)$ digits from each class with $a + b + c = 5$; the number is divisible by 3 iff $b \equiv c \pmod 3$. Valid patterns: (3,1,1), (1,2,2), (2,3,0), (2,0,3).

That's 84 digit sets: exactly 42 contain a 0 and 42 don't (cute coincidence). So $42 \cdot 5! + 42 \cdot (5! - 4!) = 5040 + 4032 = 9072$.`,
    comments: [
      ['thao_vy_le', 11, r`The 42/42 split is so satisfying. Checked each pattern: (3,1,1) has 27 with a 0 and 9 without, (1,2,2) has 9 and 27, (2,3,0) and (2,0,3) have 3 and 3 each.`],
      ['jaden_okafor', 18, r`Yep, exactly my table 🙌`, 0],
      ['gia_han_tran', 30, r`this is the thread I needed after my 4-digit fiasco 😂 same method worked for me this time`],
      ['bao_nguyen_17', 45, r`Why $b \equiv c \pmod 3$? I'd have written $b + 2c \equiv 0$.`],
      ['meilin_chen', 52, r`Same thing: $b + 2c \equiv b - c \pmod 3$ because $2 \equiv -1$. The $b \equiv c$ form is easier to enumerate.`, 3],
      ['bao_nguyen_17', 60, r`Ah, $2 \equiv -1$, nice`, 3],
      ['ethan_caldwell9', 80, r`Density check: there are $9 \cdot 9 \cdot 8 \cdot 7 \cdot 6 = 27216$ five-digit numbers with distinct digits, and $27216/3 = 9072$. Exactly one third this time!`],
      ['aisha_rahman_m', 95, r`WAIT, exactly a third? For 4 digits it wasn't (1548 vs 1512). Why?`, 6],
      ['meilin_chen', 120, r`Nice question. I don't have a slick reason. Anyone?`, 6],
      ['kuba_wisniewski', 150, r`Partial idea: a 5-digit set and its complement have digit sums adding to 45, so their residues are negatives of each other. That's a symmetry between residues 1 and 2, but not yet a proof of exactly one third. Would love a clean argument.`, 6],
      ['duc_anh_pham', 200, r`A roots-of-unity filter should settle it: show that $\sum \omega^{\text{digit sum}}$ over all valid numbers is 0. I'll try tonight and post if it's clean.`, 6],
      ['chloe_tanaka', 230, r`this thread went from counting to roots of unity real fast 😂`],
      ['sam_whitaker', 260, r`The best kind of thread.`, 11],
      ['nina_petrova', 300, r`@duc_anh_pham waiting for the roots-of-unity writeup 👀`],
    ],
  },
  {
    key: 't24',
    problem: 'gen-usamo-alg-001',
    by: 'daniel_ivanov8',
    ago: 162,
    body: r`Nesbitt's inequality: how many proofs can we collect? I'll start.

**Cauchy (Engel form).** $\sum \frac{a}{b+c} = \sum \frac{a^2}{ab+ac} \ge \frac{(a+b+c)^2}{2(ab+bc+ca)} \ge \frac32$, the last step being $a^2+b^2+c^2 \ge ab+bc+ca$.

Your turn 👇`,
    comments: [
      ['leo_hartmann', 8, r`**AM-HM.** Let $x = b+c$, $y = c+a$, $z = a+b$. Then $\sum \frac{a}{b+c} + 3 = (a+b+c)\sum\frac1x = \frac{x+y+z}{2}\sum\frac1x \ge \frac92$. Subtract 3.`],
      ['daniel_ivanov8', 14, r`Classic. Adding 1 to each term is such a useful trick.`, 0],
      ['hana_yoon22', 25, r`**Rearrangement.** WLOG $a \ge b \ge c$, so $\frac1{b+c} \ge \frac1{c+a} \ge \frac1{a+b}$. The similarly sorted sum $\sum \frac{a}{b+c}$ is at least each of the two cyclic shifts, $\frac{b}{b+c} + \frac{c}{c+a} + \frac{a}{a+b}$ and $\frac{c}{b+c} + \frac{a}{c+a} + \frac{b}{a+b}$. Add them: $2\sum \frac{a}{b+c} \ge 3$.`],
      ['kuba_wisniewski', 40, r`Rearrangement is my favourite here. No algebra at all.`, 2],
      ['meilin_chen', 55, r`**Tangent line.** Normalize $a + b + c = 3$. $f(t) = \frac{t}{3-t}$ is convex on $(0,3)$, so it lies above its tangent at $t = 1$: $f(t) \ge \frac12 + \frac34(t-1)$. Summing, the linear parts cancel and $\sum f \ge \frac32$.`],
      ['emma_lindqvist', 75, r`The tangent line trick finally makes sense to me. The linear terms cancel *because of* the normalization!`, 4],
      ['ananya_rk', 100, r`Question: why are we allowed to assume $a + b + c = 3$?`],
      ['daniel_ivanov8', 108, r`The inequality is homogeneous: replacing $(a,b,c)$ with $(ta,tb,tc)$ changes no term. So we can scale to any convenient sum.`, 6],
      ['ananya_rk', 115, r`Oh, because each fraction has degree 0. Got it.`, 6],
      ['alex_chung_ca', 140, r`**Pure algebra.** Clearing denominators, it's equivalent to $2\sum a^3 \ge \sum_{sym} a^2 b$. That's Muirhead, or AM-GM term by term: $a^3 + a^3 + b^3 \ge 3a^2 b$.`],
      ['zeynep_aydin', 170, r`Equality in all of these is $a = b = c$. State it in the proof!`],
      ['farah_iqbal', 200, r`Best thread. Five proofs of one inequality. Collecting them all 📚`],
      ['arjun_mehta_21', 230, r`Also note it's one-sided: there's no upper bound. Take $a = 1$ and $b, c \to 0$ and the first term blows up.`],
      ['sofia_marques_mt', 260, r`I only knew the Cauchy proof. The rearrangement one is going in my notes!`],
      ['daniel_ivanov8', 290, r`Thanks all! Cauchy, AM-HM, rearrangement, tangent line, Muirhead. Anyone have a 6th? 😏`],
      ['priya_sundar07', 320, r`Sixth: with $x = b+c$ etc. we get $a = \frac{y+z-x}{2}$, and the sum becomes $\frac12\left[\left(\frac xy + \frac yx\right) + \left(\frac yz + \frac zy\right) + \left(\frac zx + \frac xz\right) - 3\right] \ge \frac12(6 - 3)$, each pair being $\ge 2$ by AM-GM.`, 14],
    ],
  },
  {
    key: 't25',
    problem: 'gen-usamo-alg-002',
    by: 'hana_yoon22',
    ago: 155,
    body: r`Schur's inequality ($t = 1$): $a(a-b)(a-c) + b(b-c)(b-a) + c(c-a)(c-b) \ge 0$ for $a, b, c \ge 0$.

The proof is three lines once you order the variables, but I want to understand *why* ordering is the key move. Any intuition?`,
    comments: [
      ['daniel_ivanov8', 12, r`The sum is symmetric, so ordering costs nothing. With $a \ge b \ge c$ the last term $c(c-a)(c-b)$ is $c \ge 0$ times two nonpositive factors, so it's $\ge 0$. You only need to handle the first two, and they pair up nicely.`],
      ['hana_yoon22', 19, r`so ordering makes the sign of every factor known. that's the real gain`, 0],
      ['leo_hartmann', 30, r`The pairing: $a(a-b)(a-c) + b(b-c)(b-a) = (a-b)[a(a-c) - b(b-c)] = (a-b)^2(a+b-c) \ge 0$.`],
      ['ananya_rk', 50, r`What's Schur used for? It looks random`],
      ['daniel_ivanov8', 58, r`Expanded, it says $a^3 + b^3 + c^3 + 3abc \ge ab(a+b) + bc(b+c) + ca(c+a)$. Muirhead can't prove that (it isn't a majorization), so Schur fills a real gap.`, 3],
      ['meilin_chen', 70, r`And that expanded form is exactly the Olympiad problem "An inequality with a sharp remainder" here. Same inequality, different outfit.`, 3],
      ['ananya_rk', 78, r`Ohh, so it's the tool for when AM-GM style bounds aren't strong enough. Thanks!`, 3],
      ['kuba_wisniewski', 100, r`Look at the equality cases: $a = b = c$, and also $a = b$, $c = 0$ (and permutations). Two equality families is a red flag that plain AM-GM won't work.`],
      ['emma_lindqvist', 130, r`The general Schur is $\sum a^t(a-b)(a-c) \ge 0$ for any $t > 0$. Does the same proof work?`],
      ['hana_yoon22', 140, r`Yes, same ordering argument: $a^t(a-c) \ge b^t(b-c)$ when $a \ge b \ge c$, so the first two terms combine to something $\ge 0$.`, 8],
      ['yuki_morimoto', 170, r`Fun equivalent form: Schur with $t = 1$ is the same as $abc \ge (a+b-c)(b+c-a)(c+a-b)$. For the sides of a triangle, that's $R \ge 2r$ in disguise!`],
      ['zeynep_aydin', 190, r`WAIT, Schur is Euler's inequality?? 🤯`, 10],
      ['kuba_wisniewski', 200, r`For triangles, yes: $abc = 4RK$ and the right side is $8(s-a)(s-b)(s-c) = 8K^2/s = 8rK$. So it reads $4RK \ge 8rK$.`, 10],
      ['sofia_marques_mt', 240, r`This forum keeps connecting things I thought were unrelated. Saving.`],
      ['gabriel_santos3', 280, r`Writing up Schur for practice tonight. Thanks for the intuition thread @hana_yoon22!`],
      ['farah_iqbal', 320, r`Adding "two equality families" to my list of signs that AM-GM isn't enough. Great point, Kuba.`],
    ],
  },
  {
    key: 't26',
    problem: 'gen-usamo-alg-006',
    by: 'emma_lindqvist',
    ago: 147,
    body: r`Trying to write a clean proof for "The reciprocal barrier": positive $a, b, c$ with $abc = 1$, prove $a^2 + b^2 + c^2 \ge a + b + c$.

My attempt: by AM-GM, $a + b + c \ge 3$. By QM-AM, $a^2 + b^2 + c^2 \ge \frac{(a+b+c)^2}{3} = (a+b+c)\cdot\frac{a+b+c}{3} \ge a + b + c$.

Is this complete? It feels too short.`,
    comments: [
      ['alex_chung_ca', 9, r`It's complete. Short proofs are good proofs. The key is using $\frac{a+b+c}{3} \ge 1$ as the multiplier. Maybe say explicitly where $abc = 1$ is used (only in the AM-GM step).`],
      ['emma_lindqvist', 15, r`Thank you! I'll add a sentence about where the condition is used.`, 0],
      ['daniel_ivanov8', 30, r`Equality: $a = b = c = 1$. Worth adding too.`],
      ['leo_hartmann', 45, r`Alternative: $a^2 + 1 \ge 2a$, so $\sum a^2 \ge 2\sum a - 3$. And $2\sum a - 3 \ge \sum a$ iff $\sum a \ge 3$, which is AM-GM. Same ingredients, different glue.`],
      ['hana_yoon22', 60, r`I like this one, everything is linear after the first step.`, 3],
      ['sofia_marques_mt', 80, r`Why can't we just say $a^2 \ge a$ for each one? Because $a$ could be less than 1?`],
      ['daniel_ivanov8', 86, r`Exactly. If $a = \frac12$ then $a^2 = \frac14 < \frac12$. Individual terms can fail; it's the sum that works, thanks to the constraint.`, 5],
      ['sofia_marques_mt', 92, r`right, the constraint balances them out. good to see a concrete failure`, 5],
      ['meilin_chen', 120, r`Generalization: with $abc = 1$, $a^n + b^n + c^n \ge a^m + b^m + c^m$ whenever $n \ge m \ge 0$.`],
      ['kuba_wisniewski', 140, r`And the proof is power means: $M_n \ge M_m \ge M_0 = 1$, so $M_n^n \ge M_m^n \ge M_m^m$.`, 8],
      ['riya_kapoor5', 170, r`I'm Foundation level but I could follow this! AM-GM is so powerful`],
      ['nina_petrova', 200, r`Proof-writing tip from this thread: name the inequality at each step and state the equality case. That alone makes a proof look professional.`],
      ['duc_anh_pham', 230, r`Also notice the inequality is NOT homogeneous (degree 2 vs degree 1). That's exactly why $abc = 1$ has to be used somewhere. When the degrees don't match, look for where the constraint fills the gap.`],
      ['emma_lindqvist', 260, r`This is such good advice. Rewrote my proof with all of it. Thanks everyone 🙏`],
      ['isla_mcbride', 300, r`Bookmarking "degrees don't match → find where the constraint is used".`],
    ],
  },
  {
    key: 't27',
    problem: 'gen-usamo-alg-007',
    by: 'arjun_mehta_21',
    ago: 139,
    body: r`A quadratic form: find all $k$ with $a^2 + b^2 + c^2 + k(ab + bc + ca) \ge 0$ for all reals $a, b, c$.

Testing: $a = b = c = 1$ gives $3 + 3k \ge 0$, so $k \ge -1$. $a = 1, b = -1, c = 0$ gives $2 - k \ge 0$, so $k \le 2$.

So I claim exactly $-1 \le k \le 2$. How do I prove the "sufficient" direction cleanly?`,
    comments: [
      ['hana_yoon22', 12, r`Let $S = a^2 + b^2 + c^2$ and $q = ab + bc + ca$. Two classic bounds: $q \le S$ (since $S - q = \frac12\sum(a-b)^2$) and $q \ge -\frac S2$ (since $S + 2q = (a+b+c)^2$). The expression $S + kq$ is linear in $q$ on $[-\frac S2, S]$, so check the endpoints: $S(1+k) \ge 0$ and $S(1 - \frac k2) \ge 0$. That's exactly $-1 \le k \le 2$.`],
      ['arjun_mehta_21', 20, r`Linear in $q$ on an interval, check the endpoints. That's so clean!!`, 0],
      ['meilin_chen', 40, r`Matrix view: it's the quadratic form of the matrix with 1 on the diagonal and $\frac k2$ off it. The eigenvalues are $1 + k$ (for $(1,1,1)$) and $1 - \frac k2$ (twice, for vectors summing to 0). It's $\ge 0$ everywhere iff both are $\ge 0$. And it explains why your test vectors were the right ones: they're eigenvectors!`],
      ['kuba_wisniewski', 55, r`Eigenvectors as test cases is such a good heuristic.`, 2],
      ['ananya_rk', 70, r`What's an eigenvalue? 😅`],
      ['meilin_chen', 78, r`A direction the matrix only stretches. Don't worry if you haven't seen it, Hana's proof needs nothing like that.`, 4],
      ['ethan_caldwell9', 100, r`The question asks for the least $k$ AND the full range. Make sure the writeup answers both!`],
      ['yuki_morimoto', 130, r`At $k = 2$ the expression is $(a+b+c)^2$, and at $k = -1$ it's $\frac12\sum(a-b)^2$. The two endpoints are the two famous perfect squares.`],
      ['arjun_mehta_21', 140, r`oh that's a lovely way to see the endpoints`, 7],
      ['omar_haddad_x', 170, r`How did you come up with the test vectors? I'd never have tried $(1, -1, 0)$.`],
      ['arjun_mehta_21', 178, r`All-equal is always the first try. Then "make the cross terms as negative as possible" → opposite signs, with $c = 0$ to keep it simple.`, 9],
      ['nina_petrova', 210, r`In 2 variables, $a^2 + b^2 + kab \ge 0$ iff $-2 \le k \le 2$. The 3-variable range is lopsided, which surprised me.`],
      ['duc_anh_pham', 240, r`In $n$ variables the range is $-\frac{2}{n-1} \le k \le 2$. As $n$ grows the lower bound creeps up to 0.`, 11],
      ['zeynep_aydin', 280, r`This thread is a mini linear algebra lesson. Love it.`],
      ['thao_vy_le', 310, r`"Linear in $q$, check the endpoints": saving this pattern.`],
    ],
  },
  {
    key: 't28',
    problem: 'gen-usamo-com-015',
    by: 'nina_petrova',
    ago: 130,
    body: r`Monochromatic triangle in $K_6$, my proof for feedback:

Pick a vertex $v$. It has 5 edges, so by pigeonhole at least 3 share a colour, say red, going to $x, y, z$. If any edge among $x, y, z$ is red, it forms a red triangle with $v$. Otherwise $xyz$ is an all-blue triangle. ∎

Is this rigorous enough for a USAMO-style grader?`,
    comments: [
      ['alex_chung_ca', 10, r`Yes, that's the full proof. One small improvement: say "5 edges, 2 colours, so some colour has at least $\lceil 5/2 \rceil = 3$ edges" to make the pigeonhole explicit.`],
      ['nina_petrova', 17, r`Good point, adding the ceiling.`, 0],
      ['jaden_okafor', 30, r`And 6 is optimal: colour $K_5$ as a pentagon (red) plus a pentagram (blue). No monochromatic triangle. So $R(3,3) = 6$.`],
      ['maya_goldberg', 45, r`I drew this! the pentagon and the star have no triangles in them. so cool`, 2],
      ['kuba_wisniewski', 60, r`Stronger fact: $K_6$ always has at least TWO monochromatic triangles. Fun exercise.`],
      ['sofia_marques_mt', 80, r`how do you prove two? one is already hard for me 😅`, 4],
      ['kuba_wisniewski', 92, r`Count "bichromatic angles": pairs of edges at a vertex with different colours. A non-monochromatic triangle has exactly 2 of them. A vertex with $r$ red and $5 - r$ blue edges has $r(5-r) \le 6$, so there are at most $6 \cdot 6 / 2 = 18$ non-monochromatic triangles out of $\binom63 = 20$.`, 4],
      ['sofia_marques_mt', 100, r`counting angles 🤯 thank you`, 4],
      ['riya_kapoor5', 130, r`Party version: among any 6 people, either 3 all know each other or 3 all don't. I tried it with my friends and it worked haha`],
      ['emma_lindqvist', 150, r`It always works, that's the point 😄`, 8],
      ['thao_vy_le', 180, r`Next level: $R(3,4) = 9$ and $R(4,4) = 18$. And $R(5,5)$ is still unknown! Ramsey numbers get hard insanely fast.`],
      ['omar_haddad_x', 200, r`Unknown?? Like nobody in the world knows?`, 10],
      ['hana_yoon22', 210, r`Nobody knows. There's a famous Erdős quote about aliens demanding the value of $R(5,5)$ 👽`, 10],
      ['duc_anh_pham', 250, r`There's an Olympiad problem here for the recursive bound $R(r,s) \le R(r-1,s) + R(r,s-1)$. Same pigeonhole idea as Nina's proof, one level up.`],
      ['nina_petrova', 280, r`Thanks everyone, this turned into a Ramsey theory crash course 😄`],
    ],
  },
  {
    key: 't29',
    problem: 'gen-usamo-com-016',
    by: 'omar_haddad_x',
    ago: 122,
    body: r`Erdős–Szekeres question: any sequence of 37 distinct reals has a monotone subsequence of length 7.

I know the proof labels each term with (longest increasing subsequence ending there, longest decreasing subsequence ending there). But why are the labels all different?`,
    comments: [
      ['priya_sundar07', 9, r`Take $i < j$. If $x_i < x_j$, you can append $x_j$ to the longest increasing subsequence ending at $x_i$, so $j$'s increasing label is bigger. If $x_i > x_j$, same for decreasing. Either way the pairs differ.`],
      ['omar_haddad_x', 15, r`Oh, the comparison between $x_i$ and $x_j$ decides which coordinate grows. That's the whole trick.`, 0],
      ['jaden_okafor', 30, r`Then pigeonhole: with no monotone subsequence of length 7, both labels lie in $\{1, \dots, 6\}$. Only 36 possible pairs, but 37 terms.`],
      ['linh_ngoc_tran', 50, r`where does 37 come from? 6 × 6 + 1?`],
      ['jaden_okafor', 56, r`Exactly. In general, $rs + 1$ terms force an increasing subsequence of length $r+1$ or a decreasing one of length $s+1$.`, 3],
      ['aisha_rahman_m', 80, r`And 37 is sharp: 36 terms can avoid it. Take 6 blocks of 6: 31-36, 25-30, ..., 1-6, each block increasing. Longest increasing is 6 (inside a block), longest decreasing is 6 (one per block).`],
      ['omar_haddad_x', 90, r`That construction is beautiful. Blocks going down, each block going up.`, 5],
      ['hana_yoon22', 120, r`There's also a cute proof via patience sorting (the card game): the number of piles is the length of the longest increasing subsequence. Fun to look up.`],
      ['noah_fischer_b', 150, r`So 10 numbers always have a monotone subsequence of length 4? $3\cdot3 + 1 = 10$ ✅`],
      ['sam_whitaker', 156, r`Yes! Good use of the formula.`, 8],
      ['gabriel_santos3', 190, r`Love that this is a pigeonhole problem in disguise. The hard part is choosing what goes in the pigeonholes.`],
      ['alex_chung_ca', 220, r`That's the core skill in olympiad combinatorics: find the right labels.`, 10],
      ['meilin_chen', 260, r`For the bigger picture, look up Dilworth's theorem. Erdős–Szekeres is a special case of it.`],
      ['zeynep_aydin', 300, r`Saving this. The label trick shows up elsewhere too, like longest chains in posets.`],
    ],
  },
  {
    key: 't30',
    problem: 'gen-usamo-com-018',
    by: 'sam_whitaker',
    ago: 115,
    body: r`A graph degree constraint: any simple graph on 8 vertices has two vertices with the same degree.

My attempt: degrees range over 0..7, which is 8 values for 8 vertices, so pigeonhole doesn't immediately work... I'm stuck on the last step. Help?`,
    comments: [
      ['kuba_wisniewski', 8, r`Key observation: degrees 0 and 7 can't both occur. A degree-7 vertex is adjacent to everyone, so nobody has degree 0. That leaves only 7 possible values for 8 vertices. Pigeonhole ✓`],
      ['sam_whitaker', 14, r`OHHH. 0 and 7 exclude each other. that's the missing piece`, 0],
      ['riya_kapoor5', 30, r`Real-life version: at any party, two people have the same number of friends at the party!`],
      ['isla_mcbride', 45, r`As long as friendship is mutual, which is the "simple undirected graph" part 😄`, 2],
      ['nina_petrova', 70, r`It's true for every $n \ge 2$, same argument with degrees $0, \dots, n-1$.`],
      ['mateo_quispe', 100, r`What about directed graphs? Can all the out-degrees be different?`],
      ['nina_petrova', 110, r`Yes they can! A transitive tournament on $n$ vertices has out-degrees $0, 1, \dots, n-1$, all different. The symmetry of friendship is essential.`, 5],
      ['mateo_quispe', 118, r`so the "mutual" part really matters. cool`, 5],
      ['leo_hartmann', 140, r`Follow-up: if exactly one pair of vertices shares a degree, what can that degree be? Classic extension.`],
      ['jaden_okafor', 170, r`I remember the answer involves $\lfloor n/2 \rfloor$... let me actually work it out before claiming anything 😅`, 8],
      ['chloe_tanaka', 200, r`Such a satisfying proof. Short, but with a real idea.`],
      ['bao_nguyen_17', 230, r`For the write-up, split into two cases. Case 1: some vertex has degree 0, so the max degree is at most 6 and degrees lie in {0..6}. Case 2: no vertex has degree 0, so degrees lie in {1..7}. Either way, 7 values.`],
      ['sam_whitaker', 250, r`Writing it exactly like that, thanks!`, 11],
      ['thao_vy_le', 290, r`Classic first-week-of-olympiad-training problem. Everyone should know it.`],
      ['ethan_caldwell9', 320, r`The other must-know from this chapter: the handshake lemma, sum of degrees = 2 × number of edges.`],
    ],
  },
];
