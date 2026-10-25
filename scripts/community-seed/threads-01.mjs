/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Threads 1-10: the original twelve-problem bank.
 *
 * Each thread: `ago` is hours before the seed runs; each comment is
 * [author, minutes after the post, body, index of the comment it replies to].
 */

const r = String.raw;

export default [
  {
    key: 't01',
    problem: 'alg-f01',
    by: 'linh_ngoc_tran',
    ago: 470,
    body: r`Quick question about The Hidden Pair ($x + 1/x = 3$, find $x^2 + 1/x^2$). I solved the quadratic $x^2 - 3x + 1 = 0$, got $x = \frac{3+\sqrt5}{2}$, and then tried to square it directly... took me 10 minutes and two arithmetic mistakes before I got 7.

The solution just squares the equation. How do you know to do that instead of solving for $x$? 😅`,
    comments: [
      ['minh_khoa_math', 9, r`The moment you see $x + \frac1x$, think "symmetric". Whatever you're asked ($x^2 + \frac1{x^2}$, $x^3 + \frac1{x^3}$, ...) is also symmetric in $x$ and $\frac1x$, so it can be written using $x + \frac1x$ alone. Solving for $x$ throws that structure away.`],
      ['ananya_rk', 14, r`Same thing happened to me last week lol. Rule I wrote in my notebook: **if the answer doesn't care which root you picked, don't pick a root.** Both $\frac{3\pm\sqrt5}{2}$ give 7 here.`],
      ['linh_ngoc_tran', 22, r`oh that's a really nice way to say it. both roots give the same answer, so the answer can't need the root 🤯`, 1],
      ['duc_anh_pham', 31, r`Bonus: once you have $T_1 = 3$ and $T_2 = 7$ where $T_n = x^n + x^{-n}$, you get everything else from $T_{n+1} = 3T_n - T_{n-1}$. So $T_3 = 18$, $T_4 = 47$, $T_5 = 123$. The Olympiad problem "Power Sums Without Solving" is literally this recurrence.`],
      ['mateo_quispe', 40, r`Wait why is it $3T_n - T_{n-1}$? where does the minus come from`],
      ['duc_anh_pham', 47, r`Multiply out: $(x + x^{-1})(x^n + x^{-n}) = x^{n+1} + x^{-(n+1)} + x^{n-1} + x^{-(n-1)}$. So $3T_n = T_{n+1} + T_{n-1}$. Rearrange and you're done.`, 4],
      ['mateo_quispe', 53, r`ohhh the cross terms are just the $n-1$ term. that's beautiful, thank you`, 4],
      ['chloe_tanaka', 75, r`For $x^3 + \frac1{x^3}$ there's also the cube identity: $(x+\frac1x)^3 = x^3 + \frac1{x^3} + 3(x + \frac1x)$, so $27 = T_3 + 9$ and $T_3 = 18$. Matches Duc Anh's recurrence ✅`],
      ['kofi_mensah_m', 102, r`Saving this thread. I always forget to subtract the 2 when squaring and pick 9 from the choices 🙃`],
      ['isla_mcbride', 118, r`The choices are built for exactly that mistake: 9 is $3^2$, 7 is the real answer. Classic AMC trap.`, 8],
      ['quang_huy_do', 160, r`Em lớp 8, first time seeing this trick. So with $x + \frac1x = 4$ the answer would be $16 - 2 = 14$?`],
      ['bao_nguyen_17', 171, r`Đúng rồi! 14. That's exactly "Reciprocal echoes" in the Foundation set, go try it.`, 10],
      ['riya_kapoor5', 240, r`What if it's $x - \frac1x = 3$ instead? Then squaring gives $x^2 - 2 + \frac1{x^2} = 9$, so $x^2 + \frac1{x^2} = 11$?`],
      ['leo_hartmann', 262, r`Yes, 11. The middle term flips sign because $x \cdot (-\frac1x) = -1$. Nice check.`, 12],
      ['linh_ngoc_tran', 300, r`Thanks everyone!! Retried with the recurrence and did the Olympiad one in 3 minutes. This community is the best 💛`],
    ],
  },
  {
    key: 't02',
    problem: 'alg-a01',
    by: 'ethan_caldwell9',
    ago: 452,
    body: r`Found a shortcut for A Recurrence in Disguise that skips most of the recurrence.

Since $rs = 1$: $r^6 + s^6 = (r^3 + s^3)^2 - 2(rs)^3 = S_3^2 - 2$.
And $S_3 = (r+s)^3 - 3rs(r+s) = 343 - 21 = 322$.

So $r^6 + s^6 = 322^2 - 2 = 103684 - 2 = 103682$, answer **682**. Two lines instead of six terms.`,
    comments: [
      ['farah_iqbal', 12, r`Love it. It generalizes: $S_{2n} = S_n^2 - 2(rs)^n$. With $rs = 1$ it's just $S_n^2 - 2$. Doubling instead of stepping.`],
      ['arjun_mehta_21', 20, r`I ran the recurrence mod 1000 to keep the numbers small: 2, 7, 47, 322, 207, 127, 682. Careful at $S_4$: $7 \cdot 322 - 47 = 2207 \to 207$.`],
      ['ethan_caldwell9', 26, r`Yep, mod 1000 all the way is safest. Just add 1000 back if a subtraction goes negative.`, 1],
      ['jaden_okafor', 41, r`Even faster: $S_2 = 49 - 2 = 47$, $S_3 = S_1 S_2 - S_1 = 7\cdot47 - 7 = 322$, then $S_6 = S_3^2 - 2$. Basically binary exponentiation for power sums.`],
      ['ananya_rk', 58, r`Can someone explain where $S_n = 7S_{n-1} - S_{n-2}$ comes from? I see it everywhere but don't get it`],
      ['omar_haddad_x', 66, r`Each root satisfies $t^2 = 7t - 1$. Multiply by $t^{n-2}$: $t^n = 7t^{n-1} - t^{n-2}$. Write that for $r$ and for $s$ and add. That's the whole proof.`, 4],
      ['ananya_rk', 80, r`oh wow so it's literally just the equation times a power. ok I feel dumb but happy 😂`, 4],
      ['hana_yoon22', 95, r`Not dumb at all, this is Newton's identities in their simplest form. Everyone learns it once.`, 4],
      ['yuki_morimoto', 130, r`Fun fact: every $S_n$ here ends in 2 or 7 (2, 7, 47, 322, 2207, 15127, 103682...). Mod 5 the recurrence is $S_n \equiv 2S_{n-1} - S_{n-2}$ starting from $2, 2$, so it's stuck at 2 forever.`],
      ['sofia_marques_mt', 151, r`That's such a random but cool observation haha`, 8],
      ['minh_khoa_math', 190, r`There's a closed form too: the roots are $\frac{7 \pm 3\sqrt5}{2}$, which are $\phi^4$ and $\phi^{-4}$! So $S_n = \phi^{4n} + \phi^{-4n} = L_{4n}$, the Lucas numbers. $L_{24} = 103682$ ✅`],
      ['ethan_caldwell9', 205, r`WAIT. So this whole problem is secretly Lucas numbers??`, 10],
      ['priya_sundar07', 260, r`This is why I love this site. You come for a mod-1000 problem and leave with powers of the golden ratio.`, 10],
      ['zeynep_aydin', 330, r`Bookmarking $S_{2n} = S_n^2 - 2$. AIME loves these.`],
      ['gabriel_santos3', 420, r`Just tried it on the Advanced "Power sums in disguise" ($r^5 + s^5$ for the same quadratic): $S_5 = S_2 S_3 - S_1 = 47\cdot322 - 7 = 15127$. 127 ✅`],
    ],
  },
  {
    key: 't03',
    problem: 'alg-o01',
    by: 'bao_nguyen_17',
    ago: 431,
    body: r`Power Sums Without Solving: I got 129 but I almost entered 123 😭

$T_5 = 123$ is $x^5 + x^{-5}$, but the question asks for $(x^5 + x^{-5})^2 = 15129$. Read the question, people!! Anyone else fall for this?`,
    comments: [
      ['kofi_mensah_m', 7, r`guilty 🙋‍♂️ entered 123 first try`],
      ['isla_mcbride', 15, r`Sneaky but fair. Also $T_5^2 = T_{10} + 2$, so $T_{10} = 15127$, the same number as $r^5 + s^5$ in the Recurrence in Disguise thread, because $y = x^2$ satisfies $y + \frac1y = 7$!`],
      ['bao_nguyen_17', 24, r`WAIT that's so cool. so the two problems are connected`, 1],
      ['duc_anh_pham', 38, r`Exactly. The substitution $y = x^2$ turns the 3-recurrence into the 7-recurrence. In general, if $x + \frac1x = a$, then $y = x^2$ has $y + \frac1y = a^2 - 2$.`, 1],
      ['noah_fischer_b', 55, r`Could I also just compute $x$ numerically? $x \approx 2.618$, $x^5 \approx 122.99$...`],
      ['leo_hartmann', 61, r`For sanity checks, sure (and $2.618 \approx \phi^2$!). But for "last three digits" of a big power the decimals won't save you. The integers from the recurrence are exact.`, 4],
      ['noah_fischer_b', 70, r`makes sense, I'll use it only as a check then`, 4],
      ['meilin_chen', 92, r`Generating function view if anyone's curious: $\sum_{n\ge0} T_n z^n = \frac{2 - 3z}{1 - 3z + z^2}$. The denominator *is* the recurrence.`],
      ['gia_han_tran', 120, r`this is above my level but saving it for later 😅`, 7],
      ['farah_iqbal', 144, r`Another route to $T_5$: $T_5 = T_2 T_3 - T_1 = 7 \cdot 18 - 3 = 123$, from $T_m T_n = T_{m+n} + T_{m-n}$.`],
      ['rafael_ortiz_v', 170, r`Lesson of the thread: underline what's actually asked. Putting a sticky note on my monitor.`],
      ['thao_vy_le', 200, r`Same lol. In contests I now write the asked quantity in a box before I start.`, 10],
      ['bao_nguyen_17', 215, r`Thanks all, especially for the $y = x^2$ connection. Feels like the problems in this bank are designed to talk to each other.`],
      ['sam_whitaker', 280, r`They are! Do Hidden Pair → Power Sums Without Solving → A Recurrence in Disguise in a row. It's a mini course.`],
    ],
  },
  {
    key: 't04',
    problem: 'geo-f01',
    by: 'riya_kapoor5',
    ago: 415,
    body: r`Heron in One Move... without Heron!

Drop the altitude onto the side of length 14. It splits the triangle into a 5-12-13 and a 9-12-15 right triangle (5 + 9 = 14). So the height is 12 and the area is $\frac12 \cdot 14 \cdot 12 = 84$.

Then $r = K/s = 84/21 = 4$ and $K + r^2 = 100$. I drew it and it felt like magic ✨`,
    comments: [
      ['omar_haddad_x', 11, r`Best way to remember 13-14-15: two Pythagorean triangles glued along the 12.`],
      ['isla_mcbride', 18, r`13-14-15 shows up so often that I just memorized it: area 84, inradius 4, circumradius $\frac{65}{8}$, altitude to 14 is 12.`],
      ['chloe_tanaka', 26, r`How do you get 65/8?`, 1],
      ['isla_mcbride', 34, r`$R = \frac{abc}{4K} = \frac{13\cdot14\cdot15}{4\cdot84} = \frac{2730}{336} = \frac{65}{8}$.`, 1],
      ['maya_goldberg', 49, r`how did you know to drop it onto 14 specifically? I tried 13 and got fractions`],
      ['riya_kapoor5', 57, r`Honestly I tried 14 first because it's the even one. The altitude to 13 is $\frac{2\cdot84}{13} = \frac{168}{13}$, so not nice.`, 4],
      ['priya_sundar07', 68, r`Good question. If the foot splits 14 into $p$ and $14 - p$, then $13^2 - p^2 = 15^2 - (14-p)^2$, which gives $p = 5$. You can always do this; it just happens to be clean for 14.`, 4],
      ['maya_goldberg', 80, r`oh that equation is really nice, thank you!`, 4],
      ['kuba_wisniewski', 104, r`Generalization: triangles with sides $(n-1, n, n+1)$ and integer area are 3-4-5, 13-14-15, 51-52-53, 193-194-195, ... A Pell equation in disguise.`],
      ['jaden_okafor', 130, r`and the middle sides 4, 14, 52, 194 satisfy $b_{k+1} = 4b_k - b_{k-1}$. recurrences everywhere on this site lol`, 8],
      ['linh_ngoc_tran', 170, r`Saving this. I always use Heron and then struggle with $\sqrt{21\cdot8\cdot7\cdot6}$.`],
      ['bao_nguyen_17', 183, r`Tip: factor first. $21\cdot8\cdot7\cdot6 = 2^4\cdot3^2\cdot7^2$, so the root is $4\cdot3\cdot7 = 84$. Never multiply out under a root.`, 10],
      ['mateo_quispe', 230, r`The picture explanation made this click for me. Thanks Riya!`],
      ['alex_chung_ca', 300, r`And $K + r^2 = 100$ is a cute final answer. Someone designed that on purpose.`],
    ],
  },
  {
    key: 't05',
    problem: 'geo-a01',
    by: 'gabriel_santos3',
    ago: 398,
    body: r`Why does Brahmagupta's formula only work for cyclic quadrilaterals?

In "A Cyclic Quadrilateral" (sides 4, 5, 6, 7) I plugged in $s = 11$ and got $K^2 = 7\cdot6\cdot5\cdot4 = 840$. But I don't understand why the four side lengths alone aren't enough for a general quadrilateral.`,
    comments: [
      ['kuba_wisniewski', 14, r`Because a general quadrilateral with fixed sides is *flexible*. Push two opposite corners together and the area changes while the sides stay the same. Four sides don't pin down the shape; "cyclic" is the extra condition that does.`],
      ['gabriel_santos3', 22, r`oh like a hinged frame! that makes sense physically`, 0],
      ['leo_hartmann', 40, r`The general version is Bretschneider: $K^2 = (s-a)(s-b)(s-c)(s-d) - abcd\cos^2\frac{\alpha+\gamma}{2}$, with $\alpha, \gamma$ opposite angles. Cyclic means $\alpha + \gamma = 180^\circ$, so the cosine term dies.`],
      ['nina_petrova', 58, r`And that proves the cyclic one has the *maximum* area among quadrilaterals with those sides, since you're subtracting something nonnegative.`, 2],
      ['aisha_rahman_m', 75, r`And set one side to 0 and you get Heron: $(s-a)(s-b)(s-c)(s-0)$. Triangles are degenerate cyclic quadrilaterals!`],
      ['sofia_marques_mt', 92, r`this is the kind of thing nobody tells you in school 😭`, 4],
      ['farah_iqbal', 130, r`Sanity check on 840: $K = \sqrt{840} \approx 28.98$. A square with the same perimeter 22 has area $5.5^2 = 30.25$, and the square is the max for a fixed perimeter. 28.98 < 30.25 ✅`],
      ['thao_vy_le', 160, r`Why ask for the *square* of the area? Because $\sqrt{840} = 2\sqrt{210}$ isn't an integer and they want an integer answer.`],
      ['gia_han_tran', 171, r`ahh that explains the weird wording, I thought I misread`, 7],
      ['emma_lindqvist', 210, r`Does anyone have a nice proof of Brahmagupta? The ones I find are pages of trig.`],
      ['priya_sundar07', 235, r`Cleanest I know: split along diagonal $AC$. Area $= \frac12(ab + cd)\sin B$ since $\sin D = \sin B$. Law of cosines on $AC$ from both sides with $\cos D = -\cos B$ gives $\cos B$. Then $\sin^2 B = 1 - \cos^2 B$ factors as a difference of squares twice. Half a page.`, 9],
      ['emma_lindqvist', 260, r`The double difference-of-squares at the end is the satisfying part. Thank you!`, 9],
      ['omar_haddad_x', 300, r`Also worth knowing for cyclic quads: Ptolemy, $pq = ac + bd$ for the diagonals. Together with Brahmagupta you can get the diagonals too.`],
      ['duc_anh_pham', 350, r`For 4, 5, 6, 7 the diagonals come out as square roots of fractions, not pretty, but a good exercise if anyone wants Ptolemy practice.`, 12],
    ],
  },
  {
    key: 't06',
    problem: 'geo-o01',
    by: 'yuki_morimoto',
    ago: 380,
    body: r`The Distance Between Centers: I kept getting the wrong numerator and finally found my bug. I computed $4K$ as $4 \cdot 84 = 326$ (??).

Correct: $R = \frac{10\cdot17\cdot21}{336} = \frac{85}{8}$, $r = \frac{84}{24} = \frac72$, and $OI^2 = R(R - 2r) = \frac{85}{8}\cdot\frac{29}{8} = \frac{2465}{64}$. Answer 465.

Post your silly arithmetic bugs so I feel better 🙃`,
    comments: [
      ['ethan_caldwell9', 9, r`Yesterday I wrote $7 \times 8 = 54$ on an AIME mock. Lost a 3-step problem to times tables.`],
      ['hana_yoon22', 17, r`I once "proved" $OI^2$ was negative for a triangle. That's how I learned $R \ge 2r$ the hard way.`],
      ['yuki_morimoto', 25, r`lol that's actually a good sanity check here: $R - 2r = \frac{85}{8} - 7 = \frac{29}{8} > 0$ ✅`, 1],
      ['arjun_mehta_21', 40, r`Funny that 10-17-21 has the same area as 13-14-15. There's a whole family of integer triangles with area 84.`],
      ['riya_kapoor5', 55, r`7-24-25 is another one! $\frac12\cdot7\cdot24 = 84$`, 3],
      ['kuba_wisniewski', 70, r`For the proof of Euler's formula: extend $AI$ to meet the circumcircle again at $M$. Then $MI = MB = MC$ (incenter-excenter lemma), and the power of $I$ gives $R^2 - OI^2 = AI \cdot IM = 2Rr$.`],
      ['emma_lindqvist', 88, r`The incenter-excenter lemma is SO useful. It's in half the olympiad geometry I read.`, 5],
      ['alex_chung_ca', 102, r`There's an Olympiad proof problem on here for exactly this ("Euler's relation"), if anyone wants to write it up properly.`, 5],
      ['jaden_okafor', 130, r`Numerator check: $\gcd(2465, 64) = 1$ since 2465 is odd, so the fraction is already in lowest terms. Always check that before taking the remainder!`],
      ['maya_goldberg', 170, r`I'm only Foundation level but I followed this! $r = K/s$ is so useful.`],
      ['zeynep_aydin', 200, r`My silly bug: I used the perimeter as $s$ instead of half of it. Got $r = \frac74$, then $R - 2r$ looked fine so I never noticed 🤦‍♀️`],
      ['duc_anh_pham', 240, r`Classic. Write "s = SEMI" at the top of every geometry page, I'm serious.`, 10],
      ['omar_haddad_x', 300, r`Also via $OI^2 = R^2 - 2Rr$: $\frac{7225}{64} - \frac{595}{8} = \frac{7225 - 4760}{64} = \frac{2465}{64}$. Both forms agree.`],
      ['yuki_morimoto', 330, r`Thank you all, I feel much better now 😂 and I learned the incenter-excenter lemma.`],
    ],
  },
  {
    key: 't07',
    problem: 'comb-f01',
    by: 'aisha_rahman_m',
    ago: 364,
    body: r`Breakdown for Digit Sets and Permutations (four-digit numbers, distinct digits, digit sum divisible by 9).

Four distinct digits sum to somewhere between 6 and 30, so the sum must be 9, 18 or 27.
• Sum 9: {0,1,2,6}, {0,1,3,5}, {0,2,3,4}, all contain 0
• Sum 27: {3,7,8,9}, {4,6,8,9}, {5,6,7,9}, none contain 0
• Sum 18: 18 sets, 7 with a 0 and 11 without

So 14 sets without 0 (24 orders each) and 10 sets with 0 (18 orders each): $336 + 180 =$ **516**.`,
    comments: [
      ['thao_vy_le', 10, r`Clean. The $4! - 3! = 18$ step for sets containing zero is where most people slip.`],
      ['kofi_mensah_m', 19, r`why minus 3! ?`, 0],
      ['thao_vy_le', 25, r`Of the 24 orders, the ones starting with 0 aren't four-digit numbers. Put 0 first and arrange the other 3: $3! = 6$ bad ones. $24 - 6 = 18$.`, 0],
      ['kofi_mensah_m', 31, r`got it, thanks!`, 0],
      ['jaden_okafor', 48, r`How did you list the 18 sets for sum 18 without missing any? That's the part I find error-prone.`],
      ['aisha_rahman_m', 60, r`I fixed the smallest digit and went up. Smallest 0: three distinct digits from 1-9 summing to 18, which gives 7 sets. Smallest 1: three from 2-9 summing to 17, and so on. Slow but safe.`, 4],
      ['meilin_chen', 75, r`Or let a generating function do it: the coefficient of $t^4$ in $\prod_{d=0}^{9}(1 + tz^d)$, filtered mod 9. Overkill here, but it never misses a case.`, 4],
      ['nina_petrova', 95, r`Symmetry check I like: $d \mapsto 9 - d$ sends a sum-18 set to another sum-18 set (since $36 - 18 = 18$) and swaps "contains 0" with "contains 9". So the count with a 0 must equal the count with a 9. Quick test for your list.`, 4],
      ['sofia_marques_mt', 120, r`My first answer was 522, I treated {0,2,3,4} as 24 orders instead of 18. Exactly the trap above.`],
      ['ethan_caldwell9', 140, r`522 isn't even one of the choices, so at least multiple choice saved you 😂`, 8],
      ['linh_ngoc_tran', 170, r`the lists for 9 and 27 make sense, 18 is scary though`],
      ['rafael_ortiz_v', 190, r`Do 18 last and check against the total: 3 + 3 + 18 = 24 sets. If your list doesn't hit a known total, recount.`, 10],
      ['gabriel_santos3', 250, r`Bookmarking. The digit-sum + leading-zero combo shows up in the "distinct digits divisible by 3" problems too.`],
      ['bao_nguyen_17', 300, r`Yes! Same structure: 1548 for 4 digits, 9072 for 5 digits. Leading zero handled the same way.`, 12],
    ],
  },
  {
    key: 't08',
    problem: 'comb-a01',
    by: 'sam_whitaker',
    ago: 350,
    body: r`Two Forbidden Adjacencies: my first answer was 2160 because I forgot to add back the intersection 🤦

Right version: unrestricted $7! = 5040$, one pair adjacent $2\cdot6! = 1440$, both pairs adjacent $2^2\cdot5! = 480$.
Inclusion–exclusion: $5040 - 1440 - 1440 + 480 = 2640$.

Anyone have a different way to double-check this?`,
    comments: [
      ['thao_vy_le', 13, r`A direct count is painful because the constraints wrap around the circle. Inclusion–exclusion really is the right tool here.`],
      ['jaden_okafor', 21, r`Ballpark check: a given pair sits together with probability $\frac27$ at a table of 8. If the two pairs were independent you'd get $5040\cdot(\frac57)^2 \approx 2571$. The real 2640 is close, so nothing is wildly off.`],
      ['sam_whitaker', 30, r`ballpark checks are underrated`, 1],
      ['noah_fischer_b', 45, r`Why is it $7!$ and not $8!$ for a circle?`],
      ['isla_mcbride', 52, r`Rotations of the same seating count once. Fix one person's seat to kill the rotation, then arrange the other 7: $7!$.`, 3],
      ['noah_fischer_b', 60, r`and with a glued pair there are 7 units, so $6!$ times 2 orders. ok yes I get it now`, 3],
      ['farah_iqbal', 80, r`General formula worth knowing: $k$ disjoint forbidden pairs among $n$ people in a circle gives $\sum_{j=0}^{k} (-1)^j \binom{k}{j} 2^j (n-j-1)!$. For $n = 8, k = 2$: $5040 - 2880 + 480 = 2640$.`],
      ['chloe_tanaka', 110, r`The Foundation version (8 people, two specific people *together*) is just the 1440 term. Nice ladder of problems.`],
      ['omar_haddad_x', 135, r`What if the pairs share a person? Like A can't sit next to B, and A can't sit next to C.`],
      ['meilin_chen', 150, r`Then "both adjacent" means B-A-C or C-A-B as one block of 3: $2\cdot5! = 240$. So $5040 - 2\cdot1440 + 240 = 2400$.`, 8],
      ['omar_haddad_x', 166, r`Oh nice, the shape of the overlap changes the last term. Thanks!`, 8],
      ['kuba_wisniewski', 200, r`At AIME level inclusion–exclusion is almost always about getting the intersections right. The formula is the easy part.`],
      ['riya_kapoor5', 240, r`Saving Farah's formula for my notes 📒`],
      ['alex_chung_ca', 290, r`Tip for write-ups: name the events ($E_1$: pair 1 adjacent, $E_2$: pair 2 adjacent) and write $|E_1^c \cap E_2^c| = N - |E_1| - |E_2| + |E_1 \cap E_2|$. Graders love explicit structure.`],
    ],
  },
  {
    key: 't09',
    problem: 'comb-o01',
    by: 'meilin_chen',
    ago: 333,
    body: r`A Constrained Lattice Walk is a great Catalan exercise.

Key insight: if a path that stays below $y = x$ passes through $(5,5)$, then the halves $(0,0)\to(5,5)$ and $(5,5)\to(10,10)$ are each independently below-diagonal paths. So the count through $(5,5)$ is $C_5 \cdot C_5 = 42^2 = 1764$.

Total $C_{10} = 16796$, so the answer is $16796 - 1764 = 15032 \to$ **32**.

Who wants to discuss *why* Catalan numbers count these paths? 🙂`,
    comments: [
      ['jaden_okafor', 12, r`Reflection principle! A bad path touches $y = x + 1$; reflect it after the first touch and it becomes a path to $(9, 11)$. So good paths $= \binom{20}{10} - \binom{20}{9} = 184756 - 167960 = 16796$.`],
      ['maya_goldberg', 25, r`what does "reflect after the first touch" mean? 😵`, 0],
      ['jaden_okafor', 34, r`Take a bad path and find the first point where it hits $y = x + 1$. From there on, swap every E step with N. The endpoint $(10,10)$ becomes $(9,11)$. Every path to $(9,11)$ has to cross that line, so it's a bijection. Draw it once and it sticks.`, 0],
      ['maya_goldberg', 46, r`drew it. it stuck. wow`, 0],
      ['aisha_rahman_m', 60, r`I first counted paths through (5,5) as $\binom{10}{5}^2$ and got a negative answer lol. Forgot the halves also have to stay below the diagonal.`],
      ['meilin_chen', 68, r`That's the main trap. A negative count is at least a loud alarm 😄`, 4],
      ['hana_yoon22', 90, r`Other Catalan objects counted by the same 16796: balanced strings of 10 pairs of parentheses, triangulations of a 12-gon, full binary trees with 11 leaves. The bijections are a great rabbit hole.`],
      ['nina_petrova', 110, r`Dyck paths ↔ binary trees is my favourite. And there's an Olympiad problem here on $C_{n+1} = \sum C_k C_{n-k}$, which is exactly the "first return to the diagonal" decomposition.`, 6],
      ['thao_vy_le', 140, r`Follow-up: what if the path must avoid two points, (3,3) and (7,7)? Inclusion–exclusion with $C_3C_7$, $C_7C_3$ and $C_3C_4C_3$?`],
      ['meilin_chen', 152, r`Yes: $C_{10} - C_3C_7 - C_7C_3 + C_3C_4C_3 = 16796 - 2145 - 2145 + 350 = 12856$.`, 8],
      ['thao_vy_le', 165, r`Perfect, matches what I got. Thanks!`, 8],
      ['duc_anh_pham', 200, r`This plus the reflection principle is probably the best "level up" problem in the combinatorics set.`],
      ['kofi_mensah_m', 250, r`Foundation question: is $C_7 = 429$ the one for (7,7)? I just did "A diagonal boundary" and got 429.`],
      ['sofia_marques_mt', 262, r`Yep! $C_7 = \frac18\binom{14}{7} = \frac{3432}{8} = 429$.`, 12],
      ['emma_lindqvist', 330, r`Thread of the week for me. The "draw it once" advice is real.`],
      ['gabriel_santos3', 360, r`Reflection principle is going straight into my cheat sheet. Thanks Jaden & Mei-Lin!`],
    ],
  },
  {
    key: 't10',
    problem: 'num-f01',
    by: 'rafael_ortiz_v',
    ago: 318,
    body: r`A Long Power, Reduced: the official solution uses period 100, but I found something even shorter.

$7^4 = 2401 \equiv 401 \pmod{1000}$. Then I multiplied by 401 a few times: $401^2 \equiv 801$, $801\cdot401 \equiv 201$, $201\cdot401 \equiv 601$, $601\cdot401 \equiv 1$.

So $7^{20} \equiv 1$! Since $2026 = 20\cdot101 + 6$, the answer is $7^6 = 117649 \to$ **649**.`,
    comments: [
      ['minh_khoa_math', 8, r`Beautiful. And you can skip the multiplications: $401^k \equiv 1 + 400k \pmod{1000}$ because $400^2 \equiv 0$. So $401^5 \equiv 1 + 2000 \equiv 1$ instantly.`],
      ['rafael_ortiz_v', 15, r`WHAT. binomial theorem saves the day again`, 0],
      ['bao_nguyen_17', 30, r`So the order of 7 mod 1000 is exactly 20? ($7^{10} \equiv 249$ and $7^4 \equiv 401$, neither is 1)`],
      ['duc_anh_pham', 41, r`Exactly 20. Your check is right: every proper divisor of 20 divides 10 or 4, and neither works.`, 2],
      ['leo_hartmann', 60, r`General lesson: $\lambda(1000) = 100$ is only an upper bound for the period. A specific base can have a much smaller order. Checking $a^4$, $a^{10}$, $a^{20}$ is cheap.`],
      ['chloe_tanaka', 80, r`I did it with CRT: mod 8, $7^{2026} = 49^{1013} \equiv 1$. Mod 125, reduce the exponent by 100 and grind $7^{26}$. Longer, but also 649.`],
      ['rafael_ortiz_v', 88, r`649 ≡ 1 mod 8 ✅ nice cross-check`, 5],
      ['linh_ngoc_tran', 120, r`Can someone explain why period 100 works in the first place? $\varphi(1000) = 400$ right?`],
      ['bao_nguyen_17', 131, r`$\varphi(1000) = 400$, but the Carmichael function is $\lambda(1000) = \operatorname{lcm}(\lambda(8), \lambda(125)) = \operatorname{lcm}(2, 100) = 100$. Every unit mod 1000 has $a^{100} \equiv 1$. Both 400 and 100 work; 100 is just smaller.`, 7],
      ['linh_ngoc_tran', 140, r`ohh so Euler's theorem gives a valid exponent, just not the smallest. Got it!`, 7],
      ['arjun_mehta_21', 170, r`The Foundation $3^{2026}$ one works the same way: $3^{10} = 59049 \equiv 49$, $3^{20} \equiv 49^2 = 2401 \equiv 401$, then the 401 trick gives $3^{100} \equiv 1$. Everything flows through 401 lol`],
      ['ananya_rk', 200, r`401 is the hero of this thread 😂`, 10],
      ['kofi_mensah_m', 240, r`Is there a list of these "nice" powers mod 1000? $7^4 = 2401$ and $3^{20} \equiv 401$ seem lucky.`],
      ['meilin_chen', 255, r`Not luck exactly. If some power of $a$ is $1 + 200m$, its 5th power is $1 + 1000m \equiv 1 \pmod{1000}$, because $200^2 \equiv 0$. So hunt for a power ending in 001, 201, 401, 601 or 801.`, 12],
      ['kofi_mensah_m', 270, r`That's a great search rule. Thanks!`, 12],
      ['zeynep_aydin', 320, r`Saving "ends in 201/401/601/801 → fifth power is 1". Instant tool.`],
    ],
  },
];
