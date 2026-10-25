/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Threads 31-40: Olympiad proof problems in combinatorics, number theory,
 * geometry and algebra. Shape as in threads-01.mjs.
 */

const r = String.raw;

export default [
  {
    key: 't31',
    problem: 'gen-usamo-com-019',
    by: 'gabriel_santos3',
    ago: 108,
    body: r`A subset sum divisible by $n$: any 9 integers $a_1, \dots, a_9$ have a nonempty consecutive block whose sum is divisible by 9. I know it's prefix sums + pigeonhole, but I want to write it properly. Draft:

Let $P_0 = 0$ and $P_k = a_1 + \dots + a_k$. That's 10 numbers and only 9 residues mod 9, so $P_i \equiv P_j$ for some $i < j$. Then $a_{i+1} + \dots + a_j = P_j - P_i \equiv 0$. ∎

Did I miss anything?`,
    comments: [
      ['alex_chung_ca', 10, r`Perfect. $P_0 = 0$ is the part people forget; without it you only have 9 prefix sums and need a separate case for "some $P_k \equiv 0$".`],
      ['gabriel_santos3', 16, r`Yes, I originally had the two-case version! $P_0$ makes it one case. Nicer.`, 0],
      ['thao_vy_le', 30, r`Also say that $i < j$ makes the block $a_{i+1}, \dots, a_j$ nonempty. Graders like that sentence.`],
      ['ananya_rk', 50, r`Is it true for any $n$? $n$ integers always have a consecutive block divisible by $n$?`],
      ['jaden_okafor', 58, r`Yes, same proof: $n+1$ prefix sums, $n$ residues.`, 3],
      ['ananya_rk', 66, r`and 9 is just one case. cool`, 3],
      ['kuba_wisniewski', 90, r`Famous harder relative: Erdős–Ginzburg–Ziv. Among any $2n - 1$ integers, some $n$ of them (not necessarily consecutive) sum to a multiple of $n$. Way harder!`],
      ['nina_petrova', 110, r`EGZ is one of my favourite theorems. For prime $n$ it falls to Chevalley–Warning, and then it's multiplicative.`, 6],
      ['riya_kapoor5', 140, r`Why is the prefix-sum idea so natural to you all? I'd never think of it.`],
      ['farah_iqbal', 150, r`"Consecutive block sum" = difference of two prefix sums. Once you see that, every consecutive-sum problem becomes a prefix-sum problem. Do 3 or 4 of these and it's automatic.`, 8],
      ['riya_kapoor5', 158, r`difference of prefix sums. writing that on my wall`, 8],
      ['sam_whitaker', 190, r`Bonus: the bound is tight. With $n - 1$ integers all equal to 1, no consecutive block sums to a multiple of $n$.`],
      ['yuki_morimoto', 220, r`Programming cousin: the "subarray sum divisible by k" interview question uses exactly this prefix-sum idea with a hash map.`],
      ['gabriel_santos3', 260, r`Thanks all! Final version has $P_0$ and the nonempty sentence 🙌`],
      ['mateo_quispe', 300, r`Saving the "$n - 1$ ones" example. Showing a bound is tight is something I never think to do.`],
    ],
  },
  {
    key: 't32',
    problem: 'gen-usamo-com-020',
    by: 'linh_ngoc_tran',
    ago: 101,
    body: r`Mutilated chessboard: remove two opposite corners and it can't be tiled with dominoes. I get the colouring proof (opposite corners have the same colour, so there are 32 squares of one colour and 30 of the other, while each domino covers one of each).

But what if you remove one black and one white square? Can you always tile it then?`,
    comments: [
      ['kuba_wisniewski', 10, r`Yes! That's Gomory's theorem. Draw a single closed path through all 64 squares (a snake that comes back to its start). Removing one black and one white square cuts it into two paths of even length, and each of those tiles with dominoes.`],
      ['linh_ngoc_tran', 17, r`wow, one cycle through the whole board, with colours alternating along it. beautiful`, 0],
      ['hana_yoon22', 35, r`The colouring argument is the prototype of an invariant: find something every piece preserves (one black + one white) and show the target breaks it.`],
      ['noah_fischer_b', 60, r`What about L-shaped trominoes on a board with one square removed?`],
      ['omar_haddad_x', 70, r`For a $2^n \times 2^n$ board with ANY one square removed, L-trominoes always tile it. Induction: split into four quadrants, and place one L in the centre covering a square of each quadrant that doesn't contain the hole.`, 3],
      ['noah_fischer_b', 78, r`induction with the L in the middle 🤯 that's so clever`, 3],
      ['isla_mcbride', 110, r`Another colouring classic: can a $10 \times 10$ board be tiled with $1 \times 4$ strips? Colour square $(i, j)$ with $(i + j) \bmod 4$. Every strip covers one square of each colour, so 25 strips would need 25 of each colour.`],
      ['aisha_rahman_m', 140, r`Just counted: the four colours appear 25, 26, 25 and 24 times. Unequal, so impossible ✅`, 6],
      ['maya_goldberg', 170, r`I love that a puzzle about dominoes is solved just by looking at colours. No trying cases at all.`],
      ['ethan_caldwell9', 200, r`Contest habit: whenever you see a tiling problem, try a colouring before anything else.`],
      ['sofia_marques_mt', 230, r`There's a 3D version with $1\times1\times2$ bricks, and the 3D checkerboard colouring works the same way.`],
      ['riya_kapoor5', 260, r`I printed a chessboard and tried for 10 minutes before reading the proof 😂 now I see why it's impossible`],
      ['farah_iqbal', 290, r`Trying first is the right move though! That's how you notice the colour imbalance yourself.`, 11],
      ['linh_ngoc_tran', 310, r`Thanks @kuba_wisniewski for Gomory's cycle. Drawing it on my notebook cover.`],
    ],
  },
  {
    key: 't33',
    problem: 'gen-usamo-num-022',
    by: 'rafael_ortiz_v',
    ago: 94,
    body: r`Infinitely many primes $\equiv 3 \pmod 4$, Euclid-style:

Suppose $p_1, \dots, p_k$ are all of them and let $N = 4p_1 \cdots p_k - 1$. Then $N \equiv 3 \pmod 4$, so it has a prime factor $\equiv 3 \pmod 4$ (a product of primes that are all $\equiv 1 \pmod 4$ is $\equiv 1$). That factor isn't any $p_i$, since $N \equiv -1 \pmod{p_i}$. Contradiction.

Why does this trick NOT work for primes $\equiv 1 \pmod 4$?`,
    comments: [
      ['duc_anh_pham', 10, r`Because the key step fails: a number $\equiv 1 \pmod 4$ can be a product of primes $\equiv 3 \pmod 4$ (like $3 \cdot 7 = 21$). So $4p_1 \cdots p_k + 1$ isn't forced to have a prime factor $\equiv 1 \pmod 4$.`],
      ['rafael_ortiz_v', 17, r`Right, two 3s multiply to a 1. The asymmetry is the whole point.`, 0],
      ['meilin_chen', 35, r`The $1 \bmod 4$ case uses $N = (2p_1 \cdots p_k)^2 + 1$ instead. Any odd prime $q$ dividing $x^2 + 1$ has $-1$ as a quadratic residue, which forces $q \equiv 1 \pmod 4$. That's the Olympiad version on this site.`, 0],
      ['kofi_mensah_m', 60, r`Why $4p_1 \cdots p_k - 1$ and not just $p_1 \cdots p_k - 1$?`],
      ['bao_nguyen_17', 68, r`Without the 4, $p_1 \cdots p_k$ is $\pm 1 \pmod 4$, so $p_1 \cdots p_k - 1$ could be even. The factor 4 forces $N \equiv 3 \pmod 4$.`, 3],
      ['kofi_mensah_m', 76, r`Ah, the 4 is there to control the residue. got it`, 3],
      ['hana_yoon22', 100, r`Dirichlet's theorem gives infinitely many primes in every class $a \bmod m$ with $\gcd(a, m) = 1$, but its proof needs L-functions. There's a lovely result that a Euclid-style proof exists exactly when $a^2 \equiv 1 \pmod m$.`],
      ['zeynep_aydin', 120, r`So 3 mod 4 works because $3^2 \equiv 1$, and 1 mod 4 trivially. What fails?`, 6],
      ['hana_yoon22', 130, r`Something like 2 mod 5: $2^2 = 4 \not\equiv 1 \pmod 5$. No Euclid-style proof exists for primes $\equiv 2 \pmod 5$.`, 6],
      ['leo_hartmann', 160, r`The same trick works for primes $\equiv 5 \pmod 6$: use $6p_1 \cdots p_k - 1$.`],
      ['sofia_marques_mt', 190, r`Saving this. "Which proofs generalize and why" is gold.`],
      ['isla_mcbride', 220, r`Exercise: show there are infinitely many primes $\equiv 2 \pmod 3$ the same way. (Hint: $3p_1 \cdots p_k - 1$.)`],
      ['rafael_ortiz_v', 240, r`Did it! Same structure: a number $\equiv 2 \pmod 3$ must have a prime factor $\equiv 2 \pmod 3$.`, 11],
      ['alex_chung_ca', 280, r`For the write-up, prove the lemma "a product of primes $\equiv 1 \pmod 4$ is $\equiv 1 \pmod 4$" explicitly. One line, but graders want it.`],
      ['gia_han_tran', 310, r`Learned the words "quadratic residue" today, thanks Mei-Lin 😄`],
    ],
  },
  {
    key: 't34',
    problem: 'gen-usamo-num-024',
    by: 'thao_vy_le',
    ago: 87,
    body: r`Wilson's theorem: $(p-1)! \equiv -1 \pmod p$.

Pairing proof: every $a \in \{1, \dots, p-1\}$ has an inverse mod $p$; pair each element with its inverse. The only self-inverse elements are $1$ and $p - 1$ (since $a^2 \equiv 1$ means $p \mid (a-1)(a+1)$). The pairs multiply to 1, leaving $1 \cdot (p-1) \equiv -1$. ∎

For $p = 7$: $(2\cdot4)(3\cdot5)\cdot1\cdot6 \equiv 1 \cdot 1 \cdot 6 \equiv -1$ ✓

Who has a favourite application?`,
    comments: [
      ['duc_anh_pham', 12, r`Favourite: for $p \equiv 1 \pmod 4$, $\left(\left(\frac{p-1}{2}\right)!\right)^2 \equiv -1 \pmod p$. So $-1$ is a square mod $p$, with an explicit square root!`],
      ['thao_vy_le', 20, r`Oh, that's the link to the "primes ≡ 1 mod 4" problem! An explicit square root of $-1$.`, 0],
      ['meilin_chen', 30, r`Check with $p = 13$: $6! = 720 \equiv 5$, and $5^2 = 25 \equiv -1 \pmod{13}$ ✅`, 0],
      ['ananya_rk', 50, r`Is the converse true? If $(n-1)! \equiv -1 \pmod n$, is $n$ prime?`],
      ['hana_yoon22', 58, r`Yes! If $n$ is composite with a factor $1 < d < n$, then $d \mid (n-1)!$, so $d \nmid (n-1)! + 1$. So Wilson is a primality test (a very slow one 😄).`, 3],
      ['ananya_rk', 65, r`a primality test that needs $(n-1)!$ lol. cool but useless`, 3],
      ['omar_haddad_x', 90, r`Why does $a^2 \equiv 1$ force $a \equiv \pm 1$? I see $p \mid (a-1)(a+1)$, but why can't the factors share it?`],
      ['kuba_wisniewski', 98, r`$p$ is prime, so it divides one of the two factors. There's an Olympiad problem here that's exactly this lemma ("A square modulo an odd prime"). It's false for composites: $3^2 \equiv 1 \pmod 8$.`, 6],
      ['sam_whitaker', 130, r`The pairing idea also proves Fermat's little theorem neatly: multiplying all residues by $a$ just permutes them.`],
      ['jaden_okafor', 150, r`And that one's on the site too ("Fermat through permutations"). These proof problems really form a chain.`, 8],
      ['chloe_tanaka', 180, r`Small cases helped me: $p = 5$: $4! = 24 \equiv -1$ ✓. $p = 3$: $2! = 2 \equiv -1$ ✓.`],
      ['nina_petrova', 210, r`There's a composite version too (Gauss): the product of all units mod $n$ is $-1$ exactly when $n$ is 2, 4, $p^k$ or $2p^k$, and $+1$ otherwise.`],
      ['emma_lindqvist', 240, r`Love these chain-of-ideas threads. Writing Wilson up now.`],
      ['thao_vy_le', 270, r`Thanks all! The $\left(\frac{p-1}{2}\right)!$ fact is my new favourite.`],
    ],
  },
  {
    key: 't35',
    problem: 'gen-usamo-num-028',
    by: 'kofi_mensah_m',
    ago: 80,
    body: r`Determine all positive integer solutions of $x^2 - y^2 = 23$.

I factored $(x-y)(x+y) = 23$. Since 23 is prime, $x - y = 1$ and $x + y = 23$, so $x = 12$, $y = 11$.

Is that really the only one? It seems too easy for an Olympiad problem 🤔`,
    comments: [
      ['alex_chung_ca', 7, r`That's it! For a full proof, justify the case split: $x + y > x - y > 0$ (since $y > 0$ and the product is positive), so the only factorization is $1 \times 23$. Then $(12, 11)$ is the unique solution.`],
      ['kofi_mensah_m', 12, r`so I need to say why $x - y$ can't be 23 with $x + y = 1$. ok!`, 0],
      ['bao_nguyen_17', 25, r`Check: $144 - 121 = 23$ ✅`],
      ['leo_hartmann', 40, r`In general, $x^2 - y^2 = n$ has an integer solution iff $n \not\equiv 2 \pmod 4$, because $x - y$ and $x + y$ have the same parity.`],
      ['maya_goldberg', 60, r`why the same parity?`, 3],
      ['leo_hartmann', 66, r`Their sum is $2x$, which is even. So they're both even or both odd.`, 3],
      ['riya_kapoor5', 90, r`So every odd number is a difference of consecutive squares! $2k + 1 = (k+1)^2 - k^2$.`],
      ['quang_huy_do', 110, r`This is so cool! $23 = 12^2 - 11^2$, $15 = 8^2 - 7^2$ ✓`, 6],
      ['omar_haddad_x', 140, r`Counting version: for odd $n$, the positive solutions correspond to factor pairs $d \cdot e = n$ with $d < e$. For $n = 45$: $1\cdot45$, $3\cdot15$, $5\cdot9$, giving $(23,22)$, $(9,6)$, $(7,2)$.`],
      ['kofi_mensah_m', 150, r`checking $(7, 2)$: $49 - 4 = 45$ ✅ cool`, 8],
      ['ethan_caldwell9', 180, r`Olympiad problems are sometimes "easy" on purpose. The grading is about the justification, not the answer.`],
      ['gia_han_tran', 210, r`That's comforting, I always think I'm missing something 😅`, 10],
      ['duc_anh_pham', 240, r`Related but much harder: $x^2 - 2y^2 = 1$ (Pell) has infinitely many solutions. Squares minus squares is easy; squares minus *twice* squares is a whole theory.`],
      ['kofi_mensah_m', 270, r`Thanks everyone! First proof problem I've done on here 🎉`],
      ['sofia_marques_mt', 280, r`Congrats Kofi!! 🎉`, 13],
    ],
  },
  {
    key: 't36',
    problem: 'gen-usamo-geo-013',
    by: 'priya_sundar07',
    ago: 74,
    body: r`Euler line with vectors, the cleanest proof I know.

Put the circumcenter $O$ at the origin, so $|A| = |B| = |C| = R$. Define $H = A + B + C$. Then
$(H - A)\cdot(B - C) = (B + C)\cdot(B - C) = |B|^2 - |C|^2 = 0$,
so $AH \perp BC$, and the same for the other vertices: $H$ is the orthocenter. And $G = \frac{A+B+C}{3} = \frac H3$, so $\overrightarrow{OH} = 3\overrightarrow{OG}$. ∎

Three lines!`,
    comments: [
      ['kuba_wisniewski', 10, r`This is the proof I show everyone who says "I hate vectors". The choice of origin does all the work.`],
      ['gia_han_tran', 25, r`why is $|B|^2 - |C|^2 = 0$? 🤔`],
      ['priya_sundar07', 31, r`$O$ is the origin and it's the circumcenter, so every vertex is at distance $R$ from it: $|B| = |C| = R$.`, 1],
      ['gia_han_tran', 38, r`ohhh, putting $O$ at the origin makes all the vertices the same length. that's the trick!`, 1],
      ['hana_yoon22', 60, r`And the nine-point center is the midpoint of $OH$, i.e. $N = \frac{A+B+C}{2}$. The same setup gives the nine-point circle radius $R/2$ (another Olympiad problem here).`],
      ['yuki_morimoto', 90, r`Synthetic alternative: the homothety at $G$ with ratio $-\frac12$ maps $ABC$ to its medial triangle, so it maps the orthocenter of $ABC$ to the orthocenter of the medial triangle, which is $O$. Hence $O, G, H$ are collinear with $GH = 2\,GO$.`],
      ['kuba_wisniewski', 100, r`The homothety proof is the "why", the vector proof is the "how". Both worth knowing.`, 5],
      ['emma_lindqvist', 130, r`What if the triangle is equilateral? Then $H = G = O$ and the "line" degenerates. Should a proof mention that?`],
      ['alex_chung_ca', 140, r`It's fine: $\overrightarrow{OH} = 3\overrightarrow{OG}$ still holds (both sides are 0). The vector statement needs no case split, which is another advantage.`, 7],
      ['isla_mcbride', 170, r`Mind blown that $H = A + B + C$. Saving.`],
      ['noah_fischer_b', 200, r`I'm not at Olympiad level but I followed every line. Vectors are amazing.`],
      ['zeynep_aydin', 230, r`Complex numbers version: same thing with $|a| = |b| = |c| = 1$ and $h = a + b + c$. Very handy for olympiad bashing.`],
      ['farah_iqbal', 260, r`Adding to my alternative solutions collection: vectors, homothety, complex numbers 📚`],
      ['omar_haddad_x', 300, r`The Euler line is the reason I started liking geometry. Thanks for the clean writeup, Priya.`],
    ],
  },
  {
    key: 't37',
    problem: 'gen-imo-alg-004',
    by: 'meilin_chen',
    ago: 68,
    body: r`Fun one: all $f: \mathbb R \to \mathbb R$ with $f(x+y) = f(x) + f(y)$ AND $f(xy) = f(x)f(y)$. No continuity given!

Answer: $f \equiv 0$ or $f(x) = x$. The key is that multiplicativity gives you monotonicity for free. Who wants to fill in the steps? 🙂`,
    comments: [
      ['hana_yoon22', 9, r`Step 1: $f(x^2) = f(x)^2 \ge 0$, so $f \ge 0$ on nonnegative numbers. Step 2: if $x \le y$ then $f(y) - f(x) = f(y - x) \ge 0$. So $f$ is increasing.`],
      ['daniel_ivanov8', 20, r`Step 3: additivity gives $f(q) = q f(1)$ for rational $q$. And $f(1) = f(1 \cdot 1) = f(1)^2$, so $f(1) \in \{0, 1\}$.`],
      ['leo_hartmann', 32, r`Step 4: for any $x$, pick rationals $q_1 < x < q_2$. Monotonicity gives $q_1 f(1) \le f(x) \le q_2 f(1)$. If $f(1) = 0$ that's $f(x) = 0$. If $f(1) = 1$, letting $q_1, q_2 \to x$ gives $f(x) = x$.`],
      ['meilin_chen', 40, r`Perfect, that's the whole thing 🎉`, 2],
      ['sofia_marques_mt', 60, r`Why is $f(q) = q f(1)$ for rationals? I see it everywhere`],
      ['kuba_wisniewski', 68, r`Additivity gives $f(nx) = n f(x)$ for positive integers $n$. Then $f(1) = f(n \cdot \frac1n) = n f(\frac1n)$, so $f(\frac1n) = \frac{f(1)}{n}$ and $f(\frac mn) = \frac mn f(1)$. Negatives come from $f(0) = 0$ and $f(-x) = -f(x)$.`, 4],
      ['sofia_marques_mt', 75, r`building up from the integers. makes sense!`, 4],
      ['ananya_rk', 100, r`Why does continuity matter in the other problem (the one with $f(1) = 8$)?`],
      ['duc_anh_pham', 110, r`Without any regularity, Cauchy's equation $f(x+y) = f(x) + f(y)$ has wild non-linear solutions (built from a Hamel basis). Continuity, monotonicity or boundedness on an interval each rule them out. Here multiplicativity gave us monotonicity.`, 7],
      ['ananya_rk', 118, r`wild solutions?! math is weird`, 7],
      ['alex_chung_ca', 140, r`Writing tip for functional equations: label every substitution ($P(x, y)$ notation). Graders love it and it keeps you from circular reasoning.`],
      ['yuki_morimoto', 170, r`Variant: over $\mathbb Q$ only, the same answer holds without monotonicity, since everything is determined by $f(1)$.`],
      ['arjun_mehta_21', 200, r`The moment $f(x^2) = f(x)^2 \ge 0$ gives monotonicity is so elegant. Very shortlist-style trick.`],
      ['nina_petrova', 240, r`Saving the four-step outline. It's a template for a whole family of problems.`],
      ['meilin_chen', 270, r`Thanks all! Collaborative solving is the best ❤️`],
    ],
  },
  {
    key: 't38',
    problem: 'gen-imo-com-016',
    by: 'alex_chung_ca',
    ago: 62,
    body: r`Every tournament has a Hamiltonian path. Induction:

Take a path $v_1 \to v_2 \to \dots \to v_n$ through $n$ vertices and add a new vertex $w$. If $w \to v_1$, put $w$ first. If $v_n \to w$, put $w$ last. Otherwise $v_1 \to w$ and $w \to v_n$, so somewhere along the path the arrows switch: there is an $i$ with $v_i \to w \to v_{i+1}$. Insert $w$ there. ∎

The "arrows must switch" step is a discrete intermediate value theorem 😄`,
    comments: [
      ['jaden_okafor', 11, r`Love the IVT framing. A sequence that starts with "into $w$" and ends with "out of $w$" must switch somewhere.`],
      ['nina_petrova', 25, r`Sports version: the results of any round robin can be listed so that each team beat the next one.`],
      ['mateo_quispe', 40, r`wait, so for any football league I can rank the teams so each one beat the next? even with weird results?`, 1],
      ['nina_petrova', 48, r`Yes! As long as every pair played exactly once with no draws. The ranking might be silly, but it exists 😄`, 1],
      ['kuba_wisniewski', 70, r`Stronger: a tournament on at least 3 vertices has a Hamiltonian *cycle* iff it is strongly connected (Camion's theorem).`],
      ['emma_lindqvist', 100, r`What's the base case? $n = 1$, a single vertex as the path?`],
      ['alex_chung_ca', 108, r`Yes, $n = 1$ is trivial. Some people start at $n = 2$ to feel safer, but $n = 1$ works.`, 5],
      ['thao_vy_le', 130, r`Fun fact: the number of Hamiltonian paths in a tournament is always odd (Rédei's theorem). Much harder to prove!`],
      ['hana_yoon22', 140, r`Rédei's theorem is so surprising. Odd, always!`, 7],
      ['bao_nguyen_17', 170, r`Can this be done fast as an algorithm?`],
      ['yuki_morimoto', 180, r`The induction is the algorithm: insert vertices one at a time, and find the switch point by binary search on the path. About $n \log n$ comparisons.`, 9],
      ['farah_iqbal', 210, r`A good example of an induction that needs no strengthening, just careful handling of the new element.`],
      ['ethan_caldwell9', 240, r`Saving this. Short induction proofs are my weak point and this is a good model.`],
    ],
  },
  {
    key: 't39',
    problem: 'gen-imo-num-027',
    by: 'bao_nguyen_17',
    ago: 57,
    body: r`The two-square obstruction: no integer $\equiv 3 \pmod 4$ is a sum of two squares.

Proof: squares are 0 or 1 mod 4, so a sum of two squares is 0, 1 or 2 mod 4. Never 3. ∎

Super short. But the converse direction is where it gets deep: which numbers ARE sums of two squares?`,
    comments: [
      ['duc_anh_pham', 12, r`Fermat–Euler: $n$ is a sum of two squares iff every prime $\equiv 3 \pmod 4$ divides $n$ to an even power. So $45 = 9 \cdot 5$ works ($36 + 9$), but $21 = 3 \cdot 7$ doesn't.`],
      ['bao_nguyen_17', 18, r`$45 = 6^2 + 3^2$ ✅. And 21 has $3^1$ and $7^1$, odd powers, so no.`, 0],
      ['maya_goldberg', 35, r`why are squares only 0 or 1 mod 4?`],
      ['isla_mcbride', 42, r`Even: $(2k)^2 = 4k^2 \equiv 0$. Odd: $(2k+1)^2 = 4k^2 + 4k + 1 \equiv 1$.`, 2],
      ['maya_goldberg', 48, r`oh that's quick. thanks!`, 2],
      ['meilin_chen', 70, r`Similar obstruction for three squares: they can't be $\equiv 7 \pmod 8$ (squares are 0, 1, 4 mod 8). Legendre's theorem says the only exceptions are $4^a(8b + 7)$.`],
      ['kuba_wisniewski', 100, r`And four squares cover everything (Lagrange). So: two squares (a prime condition), three squares (one family of exceptions), four squares (no exceptions).`, 5],
      ['sofia_marques_mt', 130, r`Is there a nice proof that primes $\equiv 1 \pmod 4$ are sums of two squares?`],
      ['hana_yoon22', 140, r`Zagier's "one-sentence proof" with an involution on a finite set! Or Thue's lemma with pigeonhole. Both are lovely.`, 7],
      ['jaden_okafor', 170, r`Counting representations: $r_2(n) = 4(d_1(n) - d_3(n))$, where $d_i$ counts divisors $\equiv i \pmod 4$. For 25 the divisors 1, 5, 25 are all $\equiv 1$, so $r_2 = 12$: $(\pm5, 0)$, $(0, \pm5)$, $(\pm3, \pm4)$, $(\pm4, \pm3)$.`],
      ['riya_kapoor5', 200, r`12 ways for 25?! I only knew 9 + 16`, 9],
      ['omar_haddad_x', 230, r`Mod 4 is such an underrated tool. First thing I try on any "show there are no integer solutions" problem.`],
      ['rafael_ortiz_v', 260, r`Same idea: $x^2 + y^2 = 4z + 3$ has no solutions, and neither does $x^2 + y^2 + z^2 = 8w + 7$. Mod arithmetic kills both instantly.`],
      ['bao_nguyen_17', 290, r`This thread became a whole tour of sums of squares 😄 thanks!`],
    ],
  },
  {
    key: 't40',
    problem: 'gen-imo-alg-007',
    by: 'yuki_morimoto',
    ago: 51,
    body: r`A recurrence and its invariant: $u_0 = 0$, $u_1 = 1$, $u_{n+1} = 3u_n - u_{n-1}$. Prove $u_{n+1}u_{n-1} - u_n^2 = -1$.

The sequence is 0, 1, 3, 8, 21, 55, 144... every other Fibonacci number!

My proof: let $D_n = u_{n+1}u_{n-1} - u_n^2$. Then
$D_{n+1} = (3u_{n+1} - u_n)u_n - u_{n+1}^2 = u_{n+1}(3u_n - u_{n+1}) - u_n^2 = u_{n+1}u_{n-1} - u_n^2 = D_n$,
and $D_1 = 3 \cdot 0 - 1 = -1$. ∎`,
    comments: [
      ['meilin_chen', 10, r`Matrix proof: $\begin{pmatrix} u_{n+1} & u_n \\ u_n & u_{n-1}\end{pmatrix} = \begin{pmatrix} 3 & -1 \\ 1 & 0\end{pmatrix}\begin{pmatrix} u_n & u_{n-1} \\ u_{n-1} & u_{n-2}\end{pmatrix}$, and the step matrix has determinant 1. So the determinant, which is exactly $D_n$, never changes.`],
      ['yuki_morimoto', 18, r`Determinant = the invariant. That's the conceptual reason!`, 0],
      ['hana_yoon22', 30, r`Since $u_n = F_{2n}$, this is Catalan's Fibonacci identity $F_n^2 - F_{n-r}F_{n+r} = (-1)^{n-r}F_r^2$ with $r = 2$.`],
      ['daniel_ivanov8', 50, r`Application: consecutive terms are coprime, since a common divisor of $u_n$ and $u_{n-1}$ divides $u_n^2 - u_{n+1}u_{n-1} = 1$.`],
      ['linh_ngoc_tran', 80, r`how did you know to compare $D_{n+1}$ with $D_n$? I'd never think of that`],
      ['yuki_morimoto', 88, r`When a problem says "prove X for every $n$", try to show X is preserved by one step. That's what an invariant is. Then check the start.`, 4],
      ['linh_ngoc_tran', 95, r`preserved by one step + check the start = induction. ok that makes sense now`, 4],
      ['kuba_wisniewski', 120, r`Rearranged with the recurrence, it says consecutive terms satisfy $x^2 - 3xy + y^2 = 1$. Check $(3, 8)$: $9 - 72 + 64 = 1$ ✅. A Vieta jumping setup in disguise.`],
      ['zeynep_aydin', 140, r`Vieta jumping and recurrences are the same idea seen from two sides. Love it.`, 7],
      ['arjun_mehta_21', 170, r`Numeric check: $u_4 u_2 - u_3^2 = 21 \cdot 3 - 64 = -1$ ✅`],
      ['gabriel_santos3', 200, r`Really clean model solution. Saving it as a template for "prove an identity for all $n$".`],
      ['noah_fischer_b', 230, r`every other Fibonacci number, I'd never have noticed. Nice catch Yuki`],
      ['sam_whitaker', 260, r`The recurrence threads on this forum are elite. Lucas, Fibonacci, Catalan, all in one week 😂`],
      ['farah_iqbal', 290, r`Determinant, invariant, Catalan's identity: three proofs. Into the collection 📚`],
    ],
  },
];
