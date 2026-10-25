/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Threads 11-20: number theory and counting from the Foundation and Advanced
 * sets. Shape as in threads-01.mjs.
 */

const r = String.raw;

export default [
  {
    key: 't11',
    problem: 'num-a01',
    by: 'ananya_rk',
    ago: 305,
    body: r`A Periodic Congruence (how many $n \le 1000$ have $n \equiv 2^n \pmod 7$): I get why the period is 21, but how do you find the residues 11, 15, 16 quickly? I made a 21-row table and it took forever.`,
    comments: [
      ['bao_nguyen_17', 10, r`You only need 3 small cases, not 21 rows. $2^n \bmod 7$ cycles 2, 4, 1 for $n \equiv 1, 2, 0 \pmod 3$. So split by $n \bmod 3$:
• $n \equiv 1 \pmod 3$: need $n \equiv 2 \pmod 7$, so $n \equiv 16 \pmod{21}$
• $n \equiv 2 \pmod 3$: need $n \equiv 4 \pmod 7$, so $n \equiv 11 \pmod{21}$
• $n \equiv 0 \pmod 3$: need $n \equiv 1 \pmod 7$, so $n \equiv 15 \pmod{21}$
Three tiny CRTs.`],
      ['ananya_rk', 18, r`OH. that's so much faster. three CRTs instead of a table`, 0],
      ['rafael_ortiz_v', 35, r`Then the counting: $1000 = 47 \cdot 21 + 13$. 47 full periods give 141. The leftover 988-1000 covers residues 1-13, which includes 11 ($n = 998$). Total 142.`],
      ['gabriel_santos3', 50, r`I got 141 because I stopped at 987 😩 the leftover always gets me`],
      ['rafael_ortiz_v', 58, r`Write the leftover range out explicitly: "988-1000 ↔ residues 1-13". Then just check which of 11, 15, 16 land inside.`, 3],
      ['omar_haddad_x', 80, r`Sanity check: density is $3/21 = 1/7$ and $1000/7 \approx 142.9$. So 142 is very believable.`],
      ['linh_ngoc_tran', 110, r`I like these density checks, going to use them more`, 5],
      ['jaden_okafor', 140, r`The Foundation and Advanced versions only change the upper limit (511 and 548). Same residues, good practice for the leftover step: $511 = 24 \cdot 21 + 7$ gives 72, and $548 = 26 \cdot 21 + 2$ gives 78.`],
      ['sofia_marques_mt', 170, r`Why is the period lcm(7, 3) and not 7·3? (same here, but in general?)`],
      ['duc_anh_pham', 180, r`In general it's the lcm. The condition depends on $n \bmod 7$ (left side) and $n \bmod 3$ (the cycle of $2^n$), and both are determined by $n \bmod \operatorname{lcm}(7,3)$. Here the gcd is 1, so lcm = product = 21.`, 8],
      ['sofia_marques_mt', 188, r`Ah, the two pieces just need a common period. Thanks!`, 8],
      ['thao_vy_le', 230, r`Fun variant: with $n \equiv 3^n \pmod 7$ the cycle of $3^n$ has length 6, so the period becomes lcm(7, 6) = 42.`],
      ['chloe_tanaka', 280, r`@bao_nguyen_17 your split-by-mod-3 trick should be pinned somewhere 📌`],
      ['bao_nguyen_17', 290, r`haha thanks! it's just CRT in small pieces`, 12],
      ['kofi_mensah_m', 320, r`Did the Foundation one with the 3-case split, took 4 minutes. Thanks Bảo and Ananya for asking!`],
    ],
  },
  {
    key: 't12',
    problem: 'num-o01',
    by: 'duc_anh_pham',
    ago: 292,
    body: r`Writeup for A Modular Power Sum, $S = \sum_{k=1}^{2026} k^{2026} \bmod 1000$, since a few people asked.

**Mod 8.** Even $k$ give $k^{2026} \equiv 0$, odd $k$ give 1 (odd squares are 1 mod 8). There are 1013 odd numbers, so $S \equiv 1013 \equiv 5 \pmod 8$.

**Mod 125.** $k^{2026}$ depends only on $k \bmod 125$, and multiples of 5 give 0. For units $k^{100} \equiv 1$, so $k^{2026} \equiv k^{26}$. Over a full block of 125 residues the unit terms sum to 0 (take a generator $g$; $\sum_j g^{26j}$ is a geometric series that vanishes). Since $2026 = 16 \cdot 125 + 26$, we get $S \equiv \sum_{k=1}^{26} k^{26} \equiv 101 \pmod{125}$.

**CRT.** $101 \equiv 5 \pmod 8$ already, so $S \equiv$ **101** $\pmod{1000}$.`,
    comments: [
      ['meilin_chen', 15, r`Subtle point worth flagging: the geometric series argument needs $g^{26} - 1$ to be invertible mod 125. It is, because $g^{26} \not\equiv 1 \pmod 5$ (that would need $4 \mid 26$). With a different exponent you'd have to check this again.`],
      ['duc_anh_pham', 24, r`Great catch, I skipped that step. Thanks Mei-Lin.`, 0],
      ['hana_yoon22', 40, r`Alternative for the full-block claim without generators: let $\Sigma$ be the sum of $k^{26}$ over units. Multiplying every unit by $2$ permutes the units, so $2^{26}\Sigma \equiv \Sigma$, i.e. $(2^{26} - 1)\Sigma \equiv 0$. And $2^{26} - 1$ is not divisible by 5, so $\Sigma \equiv 0$.`],
      ['meilin_chen', 48, r`Yes! The permutation trick is cleaner. You don't even need to know the unit group is cyclic.`, 2],
      ['leo_hartmann', 70, r`How did you do $\sum_{k=1}^{26} k^{26} \bmod 125$ by hand? That's still 21 nonzero terms.`],
      ['duc_anh_pham', 78, r`Patience and repeated squaring. Write $k^{26} = (k^2)^{13}$ and reuse squares. I sanity-checked each term mod 25 using $k^{20} \equiv 1 \pmod{25}$.`, 4],
      ['leo_hartmann', 90, r`Respect. That's a real AIME-style grind.`, 4],
      ['alex_chung_ca', 120, r`Nice cross-check on the grind: for units $k^{26} \equiv k^6 \pmod{25}$, so the tail mod 25 is $\sum k^6$ over $k \le 26$ coprime to 5. That's a much smaller computation, and it should match $101 \equiv 1 \pmod{25}$. It does.`],
      ['zeynep_aydin', 150, r`This is the kind of problem where I'd write a quick program if allowed 😅 Respect for doing it by hand.`],
      ['jaden_okafor', 165, r`Real contests don't allow it, so the structure is the point. The mod 8 part is super clean at least.`, 8],
      ['priya_sundar07', 190, r`Small note for the proof: "even $k$ gives 0 mod 8" needs the exponent to be at least 3. It's 2026 here so fine, but say it explicitly.`],
      ['duc_anh_pham', 200, r`Agreed, adding "exponent ≥ 3" to the writeup. Thanks Priya.`, 10],
      ['arjun_mehta_21', 240, r`The final CRT being trivial (101 is already 5 mod 8) is such a nice touch. Problem setters having fun.`],
      ['nina_petrova', 280, r`Saving this. "A power sum over a full residue system vanishes" is a general and powerful lemma.`],
      ['kuba_wisniewski', 330, r`The standard prime version: $\sum_{k=0}^{p-1} k^e \equiv 0 \pmod p$ unless $(p-1) \mid e$, in which case it's $-1$. The prime-power versions need more care, as this thread shows.`, 13],
      ['thao_vy_le', 360, r`Read this three times. The permutation trick from @hana_yoon22 is going in my notebook.`],
    ],
  },
  {
    key: 't13',
    problem: 'gen-amc-com-016',
    by: 'chloe_tanaka',
    ago: 280,
    body: r`Binary strings of length 9 with no two consecutive 1s: 89.

I listed small cases: length 1 → 2, length 2 → 3, length 3 → 5, length 4 → 8... Fibonacci!! But WHY Fibonacci? 🤔`,
    comments: [
      ['jaden_okafor', 6, r`Look at the first character. If it's 0, the rest is any valid string of length $n-1$. If it's 1, the next must be 0, and the rest is any valid string of length $n-2$. So $a_n = a_{n-1} + a_{n-2}$.`],
      ['chloe_tanaka', 12, r`omg that's so simple. the first character decides everything`, 0],
      ['thao_vy_le', 25, r`The same recurrence counts tilings of a $1 \times n$ strip with $1\times1$ and $1\times2$ tiles, and ways to climb $n$ stairs taking 1 or 2 steps at a time. All the same object.`],
      ['maya_goldberg', 40, r`the stairs one! I did that in Mathcounts and never connected it`, 2],
      ['mateo_quispe', 55, r`So length 10 is 144? That's the Advanced version I think`],
      ['kofi_mensah_m', 60, r`Yes, 144 ✅`, 4],
      ['aisha_rahman_m', 80, r`Closed form if you like: $a_n = F_{n+2}$, so length 9 gives $F_{11} = 89$.`],
      ['isla_mcbride', 100, r`Variation: no *three* consecutive 1s gives tribonacci, $a_n = a_{n-1} + a_{n-2} + a_{n-3}$. Length 4 gives 13.`],
      ['noah_fischer_b', 120, r`how do you start that one? $a_1 = 2$, $a_2 = 4$, $a_3 = 7$?`, 7],
      ['isla_mcbride', 128, r`Exactly: 2, 4, 7, then 13, 24, 44...`, 7],
      ['sam_whitaker', 150, r`And the circular version (first and last can't both be 1) gives the Lucas numbers. Length 9 → $L_9 = 76$.`],
      ['meilin_chen', 170, r`Lucas again! These two sequences are following us around this forum 😂`, 10],
      ['riya_kapoor5', 200, r`I love that the answer is a Fibonacci number. Feels like a secret handshake.`],
      ['farah_iqbal', 240, r`Write-up tip: when you claim a recurrence, also state the base cases, $a_1 = 2$ and $a_2 = 3$. Half the "proofs" I see skip them.`],
      ['chloe_tanaka', 260, r`thank you everyone!! favourite thread so far 💕`],
    ],
  },
  {
    key: 't14',
    problem: 'gen-amc-com-019',
    by: 'gia_han_tran',
    ago: 268,
    body: r`Distinct digits, one residue (4-digit integers, distinct digits, divisible by 3): the answer is 1548, but I got 1560 😭 Can someone find my bug?

I grouped digits by residue: R0 = {0,3,6,9}, R1 = {1,4,7}, R2 = {2,5,8}. The residue patterns (R0, R1, R2) that work are (4,0,0), (2,1,1), (1,3,0), (1,0,3), (0,2,2), which gives 72 digit sets. Then I subtracted the arrangements with a leading 0 for the sets containing 0, but I think I missed some.`,
    comments: [
      ['thao_vy_le', 9, r`Your 72 sets are right. Sets containing 0: (4,0,0) → 1, (2,1,1) → 0 plus one of {3,6,9}, so $3\cdot3\cdot3 = 27$, (1,3,0) → 1, (1,0,3) → 1, (0,2,2) → 0. Total 30. My guess: you forgot (1,3,0) and (1,0,3), where the single R0 digit can be 0.`],
      ['gia_han_tran', 16, r`YES that's exactly it. I only thought about 0 in the big groups. 1560 − 12 = 1548 ✅`, 0],
      ['bao_nguyen_17', 30, r`Then $42 \cdot 24 + 30 \cdot 18 = 1008 + 540 = 1548$. Clean.`],
      ['ethan_caldwell9', 45, r`Sanity check: roughly 1/3 of all distinct-digit 4-digit numbers should work. There are $9\cdot9\cdot8\cdot7 = 4536$ of those, and $4536/3 = 1512$. 1548 is close but not exactly a third, which is fine.`],
      ['jaden_okafor', 60, r`Right, residue 0 has four digits (0, 3, 6, 9) and the others have three, so it isn't perfectly balanced.`, 3],
      ['mateo_quispe', 80, r`What's R0 R1 R2? sorry if obvious`],
      ['sofia_marques_mt', 86, r`Digits grouped by remainder mod 3: R0 = {0,3,6,9}, R1 = {1,4,7}, R2 = {2,5,8}. A number is divisible by 3 iff its digit sum is, so only the remainders matter.`, 5],
      ['mateo_quispe', 95, r`ohh that's smart, thanks!`, 5],
      ['aisha_rahman_m', 120, r`The 5-digit version (answer 9072) is a great test of the method: same residue idea with 5 digits, same zero handling.`],
      ['isla_mcbride', 150, r`I always forget the leading-zero step entirely 🙈 good to see "count the sets with 0 separately" spelled out.`],
      ['noah_fischer_b', 180, r`This is the same skeleton as the digit-sum-divisible-by-9 thread!`],
      ['farah_iqbal', 210, r`Another way to organize it: choose the leading digit first (nonzero), then the other three as an ordered selection with the right residue. Less splitting on zero, more on residues. Use whichever feels safer to you.`],
      ['gia_han_tran', 240, r`thank you @thao_vy_le 🙏 you found my bug in 9 minutes lol`],
      ['thao_vy_le', 250, r`haha I made the exact same mistake last month 😅`, 12],
      ['kuba_wisniewski', 300, r`Debugging by comparing your answer to the right one (1560 − 1548 = 12 = 2 × 6) is a seriously good skill. The difference tells you what you over-counted.`],
    ],
  },
  {
    key: 't15',
    problem: 'gen-amc-num-024',
    by: 'kofi_mensah_m',
    ago: 255,
    body: r`Counting divisors by exponents: $121500 = 2^2 \cdot 3^5 \cdot 5^3$, so $(2+1)(5+1)(3+1) = 72$.

I understand the formula, but how do I factor 121500 fast? I did trial division forever.`,
    comments: [
      ['minh_khoa_math', 7, r`Peel off the obvious first: $121500 = 1215 \times 100$. $100 = 2^2 5^2$ and $1215 = 5 \times 243 = 5 \times 3^5$. Done: $2^2 3^5 5^3$.`],
      ['kofi_mensah_m', 13, r`1215 = 5 × 243, I would never have seen that`, 0],
      ['bao_nguyen_17', 20, r`Digit sum of 1215 is 9, so divide by 9: 135. Digit sum 9 again: 15. So $1215 = 81 \cdot 15 = 3^5 \cdot 5$. Digit sums are your friend.`, 0],
      ['riya_kapoor5', 40, r`why is the number of divisors $(e_1+1)(e_2+1)\cdots$?`],
      ['isla_mcbride', 48, r`Every divisor is $2^a 3^b 5^c$ with $0 \le a \le 2$, $0 \le b \le 5$, $0 \le c \le 3$. That's $3 \cdot 6 \cdot 4$ independent choices = 72.`, 3],
      ['riya_kapoor5', 56, r`the +1 is for choosing exponent 0! ok that clicks now`, 3],
      ['leo_hartmann', 80, r`Related: the sum of divisors is $(1+2+4)(1+3+\dots+243)(1+5+25+125) = 7 \cdot 364 \cdot 156$. Same idea, add within each prime and multiply.`],
      ['maya_goldberg', 100, r`How many of the 72 divisors are perfect squares?`],
      ['omar_haddad_x', 110, r`Even exponents only: $a \in \{0,2\}$, $b \in \{0,2,4\}$, $c \in \{0,2\}$, so $2 \cdot 3 \cdot 2 = 12$.`, 7],
      ['maya_goldberg', 118, r`oh nice, same trick with fewer choices`, 7],
      ['sam_whitaker', 150, r`Advanced version: $9720 = 972 \times 10 = 4 \cdot 243 \cdot 10 = 2^3 3^5 5$, so $4 \cdot 6 \cdot 2 = 48$.`],
      ['quang_huy_do', 200, r`Em hiểu rồi! So $360 = 2^3 3^2 5$ has $4 \cdot 3 \cdot 2 = 24$ divisors. Correct?`],
      ['bao_nguyen_17', 207, r`Chuẩn! 24 ✅`, 11],
      ['noah_fischer_b', 260, r`Fun one: which number below 100 has the most divisors? I think it's a tie between 60, 72, 84, 90 and 96, with 12 each.`],
      ['kofi_mensah_m', 270, r`that's a fun fact, checking all five now`, 13],
      ['gabriel_santos3', 300, r`Bookmarking "peel off powers of 10 first". Most contest numbers are built that way.`],
    ],
  },
  {
    key: 't16',
    problem: 'gen-amc-num-027',
    by: 'mateo_quispe',
    ago: 243,
    body: r`Powers of five inside a factorial: the exponent of 5 in $45!$ is $\lfloor 45/5 \rfloor + \lfloor 45/25 \rfloor = 9 + 1 = 10$.

Is this the same as the number of zeros at the end of $45!$? 🤔`,
    comments: [
      ['ethan_caldwell9', 8, r`Yes! Trailing zeros = number of factors of 10 = min(exponent of 2, exponent of 5). There are way more 2s, so the 5s decide. $45!$ ends in 10 zeros.`],
      ['mateo_quispe', 14, r`so cool, thanks!`, 0],
      ['linh_ngoc_tran', 30, r`why do we add $\lfloor 45/25 \rfloor$ separately? 25 is already counted in $\lfloor 45/5 \rfloor$`],
      ['jaden_okafor', 38, r`$25 = 5 \cdot 5$ has two 5s. $\lfloor 45/5 \rfloor$ counts one 5 from each multiple of 5; $\lfloor 45/25 \rfloor$ adds the second 5 from 25. Each term counts one more "layer".`, 2],
      ['linh_ngoc_tran', 47, r`layers! makes sense`, 2],
      ['rafael_ortiz_v', 70, r`Legendre's formula has a neat closed form: the exponent of $p$ in $n!$ is $\frac{n - s_p(n)}{p - 1}$, where $s_p(n)$ is the digit sum of $n$ in base $p$. 45 in base 5 is 140, digit sum 5, so $(45 - 5)/4 = 10$ ✅`],
      ['hana_yoon22', 85, r`So elegant. For $p = 2$ it says the exponent of 2 in $n!$ is $n$ minus the number of 1s in binary.`, 5],
      ['noah_fischer_b', 110, r`Fun fact I found: no factorial ends in exactly 5 zeros. $24!$ has 4 and $25!$ has 6.`],
      ['chloe_tanaka', 125, r`wait that's wild. because 25 adds two 5s at once?`, 7],
      ['noah_fischer_b', 133, r`exactly!`, 7],
      ['sofia_marques_mt', 160, r`Advanced version is $50!$: $10 + 2 = 12$. Same idea.`],
      ['maya_goldberg', 190, r`100! has 24 trailing zeros right? I remember that from somewhere`],
      ['isla_mcbride', 196, r`Yes: $20 + 4 = 24$ ✅`, 11],
      ['arjun_mehta_21', 240, r`Classic twist: trailing zeros of $n!$ in base 12 is $\min(\lfloor v_2/2 \rfloor, v_3)$, since $12 = 2^2 \cdot 3$. Now the "other" prime can be the bottleneck. Try it for $45!$.`],
      ['mateo_quispe', 280, r`$v_2(45!) = 22 + 11 + 5 + 2 + 1 = 41$, so 20. $v_3(45!) = 15 + 5 + 1 = 21$. So 20 zeros? 🤞`, 13],
      ['arjun_mehta_21', 292, r`20 ✅ nice!`, 13],
    ],
  },
  {
    key: 't17',
    problem: 'gen-amc-geo-011',
    by: 'maya_goldberg',
    ago: 231,
    body: r`Coordinates with area: vertices $(0,0)$, $(8,0)$, $(10,4)$, $(2,6)$.

I don't know the shoelace formula yet 😬 so I boxed it: the bounding rectangle is $10 \times 6 = 60$, then I subtracted the three corner triangles. Got 42!

Is the shoelace formula worth learning?`,
    comments: [
      ['isla_mcbride', 9, r`Boxing is a great method and 42 is right. Your three triangles should be 4, 8 and 6 ($60 - 18 = 42$).`],
      ['maya_goldberg', 14, r`yes exactly those three!`, 0],
      ['omar_haddad_x', 25, r`Shoelace is 100% worth it. For vertices in order, area $= \frac12\left|\sum (x_i y_{i+1} - x_{i+1} y_i)\right|$. Here: $0 + 32 + 52 + 0 = 84$, half is 42.`],
      ['riya_kapoor5', 40, r`Why does shoelace work though? it looks like magic`],
      ['leo_hartmann', 52, r`Each term $\frac12(x_i y_{i+1} - x_{i+1} y_i)$ is the signed area of the triangle from the origin to edge $i$. Going around the polygon, the parts outside cancel and you're left with the polygon. Draw it once for a pentagon and it's clear.`, 3],
      ['riya_kapoor5', 61, r`signed area... ok I need to draw this`, 3],
      ['gabriel_santos3', 80, r`Pick's theorem also works since the vertices are lattice points: $A = I + \frac{B}{2} - 1$. Counting $I$ is annoying though.`],
      ['kofi_mensah_m', 100, r`never heard of Pick's theorem, looking it up now`, 6],
      ['emma_lindqvist', 130, r`Important shoelace gotcha: list the vertices in order around the polygon. If the order crosses over itself you get garbage.`],
      ['chloe_tanaka', 150, r`The Advanced version with $(9,0)$ and $(11,4)$ gives 47. I boxed that one too 😄`],
      ['maya_goldberg', 160, r`boxing gang 🤝`, 9],
      ['jaden_okafor', 200, r`Boxing is shoelace in disguise anyway. Both are "add up signed pieces".`],
      ['alex_chung_ca', 240, r`For contest speed: shoelace for coordinates, boxing for pictures, Heron or trig for side lengths. Have all three ready.`],
      ['bao_nguyen_17', 280, r`Shoelace mnemonic: write the coordinates in two columns, repeat the first point at the bottom, multiply along the diagonals down-right, subtract the ones going up-right. Like lacing a shoe 👟`],
      ['maya_goldberg', 320, r`ok learning shoelace tonight. thanks everyone!!`],
    ],
  },
  {
    key: 't18',
    problem: 'gen-amc-geo-014',
    by: 'noah_fischer_b',
    ago: 214,
    body: r`A regular hexagon with side 8: area $/\sqrt3 = 96$.

I split it into 6 equilateral triangles, each $\frac{\sqrt3}{4}\cdot64 = 16\sqrt3$, so $96\sqrt3$ in total. Is there a way to see this without the $\frac{\sqrt3}{4}$ formula? I keep forgetting it.`,
    comments: [
      ['priya_sundar07', 11, r`Derive it instead of memorizing: an equilateral triangle with side $s$ has height $\sqrt{s^2 - (s/2)^2} = \frac{\sqrt3}{2}s$, so its area is $\frac12 \cdot s \cdot \frac{\sqrt3}{2}s = \frac{\sqrt3}{4}s^2$. Derive it twice and you'll never forget it.`],
      ['noah_fischer_b', 18, r`The Pythagoras version makes sense, I'll derive it from now on`, 0],
      ['omar_haddad_x', 30, r`Alternative: a central $8 \times 8\sqrt3$ rectangle plus two side triangles of area $16\sqrt3$ each: $64\sqrt3 + 32\sqrt3 = 96\sqrt3$. Works, but the 6 triangles are cleaner.`],
      ['isla_mcbride', 45, r`Direct formula for the hexagon: $\frac{3\sqrt3}{2}s^2$. With $s = 8$: $\frac{3\sqrt3}{2}\cdot64 = 96\sqrt3$.`],
      ['aisha_rahman_m', 60, r`Cute fact: the triangle formed by every other vertex of a regular hexagon has exactly half the hexagon's area.`],
      ['noah_fischer_b', 75, r`half?? that's surprising, checking... yes! side $s\sqrt3$, area $\frac{3\sqrt3}{4}s^2$`, 4],
      ['riya_kapoor5', 95, r`I love hexagon problems because you can draw them on triangle grid paper`],
      ['kuba_wisniewski', 120, r`Triangle grids are underrated. A side-8 hexagon is $6 \cdot 64 = 384$ unit triangles, and lots of hexagon problems become "count the small triangles".`, 6],
      ['sofia_marques_mt', 150, r`Advanced version with side 12: $6 \cdot 144/4 = 216$ ✅`],
      ['yuki_morimoto', 170, r`Shortcut: area $/\sqrt3$ for side $s$ is $\frac32 s^2$. So $96 = 1.5 \cdot 64$ and $216 = 1.5 \cdot 144$.`],
      ['linh_ngoc_tran', 200, r`this thread made hexagons not scary anymore 😌`],
      ['quang_huy_do', 230, r`Cạnh 6 thì area $/\sqrt3 = 54$ phải không ạ? (side 6 → 54?)`],
      ['gia_han_tran', 236, r`Đúng rồi, 54 ✅`, 11],
      ['ethan_caldwell9', 280, r`Hexagon + inscribed circle shows up a lot on AMC 10: the radius is the apothem, $\frac{\sqrt3}{2}s$.`],
    ],
  },
  {
    key: 't19',
    problem: 'gen-amc-num-026',
    by: 'quang_huy_do',
    ago: 205,
    body: r`Two clocks, one residue: $x \equiv 1 \pmod 5$ and $x \equiv 7 \pmod{11}$.

Em liệt kê 1, 6, 11, 16, ... until 51, which is 7 mod 11. Listing works, but is there a faster way when the numbers are bigger?`,
    comments: [
      ['bao_nguyen_17', 6, r`Substitute: $x = 5k + 1$, so $5k + 1 \equiv 7 \pmod{11}$, i.e. $5k \equiv 6$. The inverse of 5 mod 11 is 9 (since $45 \equiv 1$), so $k \equiv 54 \equiv 10$ and $x = 51$ ✅`],
      ['quang_huy_do', 12, r`inverse of 5 mod 11, how do I find that fast?`, 0],
      ['minh_khoa_math', 20, r`For small moduli just try multiples: $5\cdot2 = 10$, $5\cdot3 = 15 \equiv 4$, ..., $5\cdot9 = 45 \equiv 1$. For big ones use the extended Euclidean algorithm.`, 0],
      ['linh_ngoc_tran', 40, r`Or list by the *bigger* modulus: 7, 18, 29, 40, 51... and check which is 1 mod 5. Five steps instead of eleven.`],
      ['quang_huy_do', 47, r`oh smart, step by the bigger number!`, 3],
      ['rafael_ortiz_v', 60, r`And "1 mod 5" just means the last digit is 1 or 6. Scan 7, 18, 29, 40, 51: 51 ends in 1. Done.`, 3],
      ['noah_fischer_b', 75, r`last digit trick 🔥`, 3],
      ['aisha_rahman_m', 100, r`Advanced version: $x \equiv 1 \pmod 6$, $x \equiv 8 \pmod{13}$. List by 13: 8, 21, 34, 47, 60, 73. And $73 = 72 + 1$ ✅`],
      ['sam_whitaker', 130, r`The theory behind it: since $\gcd(5, 11) = 1$ there is exactly one solution mod 55. So 51 is the least one and the next is 106.`],
      ['chloe_tanaka', 160, r`The Chinese Remainder Theorem was so intimidating until I saw it's just "substitute and solve".`],
      ['omar_haddad_x', 190, r`Classic word-problem version: count the eggs in a basket by 5s and 1 is left, by 11s and 7 are left. How many eggs? 51 🥚`],
      ['duc_anh_pham', 210, r`For three or more congruences, solve two at a time: combine them into one congruence mod the product, then combine that with the next.`],
      ['kofi_mensah_m', 240, r`the egg problem made me laugh, saving 😂`, 10],
      ['quang_huy_do', 260, r`Cảm ơn mọi người! I did the Advanced one with Linh's method in 1 minute.`],
    ],
  },
  {
    key: 't20',
    problem: 'gen-aime-num-022',
    by: 'zeynep_aydin',
    ago: 196,
    body: r`Question about "A long power, reduced" (Advanced): $4^{2043} \bmod 1000$.

I reduced the exponent mod 100 like for 7 and 3, computed $4^{43} \bmod 1000 = 264$, and it was accepted. But then I realized 4 is NOT coprime to 1000, so Euler's theorem doesn't apply. Did I just get lucky?`,
    comments: [
      ['duc_anh_pham', 10, r`Not luck, but it needs a justification. Split with CRT. Mod 125: 4 is a unit, so $4^{2043} \equiv 4^{43}$ legitimately. Mod 8: both are $\equiv 0$, since $4^2 = 16 \equiv 0 \pmod 8$. They agree mod 8 and mod 125, so they agree mod 1000.`],
      ['zeynep_aydin', 17, r`Ahh so it's legal because both exponents are big enough to kill the factor 8.`, 0],
      ['meilin_chen', 30, r`Right, and here's where it breaks: $4^{101}$ vs $4^1$. They agree mod 125, but $4 \not\equiv 0 \pmod 8$ while $4^{101} \equiv 0$. So reducing the exponent is fine only if you stay above the threshold where the non-unit part dies.`, 0],
      ['leo_hartmann', 45, r`Concretely $4^{101} \equiv 504 \pmod{1000}$, not 4. Nice counterexample.`, 2],
      ['arjun_mehta_21', 70, r`My mod 125 computation: $4^5 = 1024 \equiv 24$, $4^{10} \equiv 576 \equiv 76$, $4^{20} \equiv 5776 \equiv 26$, $4^{40} \equiv 676 \equiv 51$, and $4^{43} = 4^{40}\cdot64 \equiv 3264 \equiv 14$.`],
      ['zeynep_aydin', 78, r`And then 0 mod 8 with 14 mod 125: 14, 139, 264 → 264 ✅`, 4],
      ['hana_yoon22', 100, r`General principle: when $\gcd(a, m) \ne 1$, the sequence $a^k \bmod m$ is *eventually* periodic, not purely periodic. The pre-period is the part you can't reduce away.`],
      ['ethan_caldwell9', 120, r`eventually periodic, great way to say it. Like the shape of the letter ρ.`, 6],
      ['riya_kapoor5', 140, r`the rho picture is so cute omg`, 6],
      ['kofi_mensah_m', 160, r`So for $2^n \bmod 1000$ the pre-period is 3 (you need $2^3 = 8$ to kill the mod 8 part)?`],
      ['meilin_chen', 170, r`Exactly. For $n \ge 3$, $2^n \bmod 1000$ repeats with period 100 (the order of 2 mod 125). Before that it's just 1, 2, 4.`, 9],
      ['thao_vy_le', 200, r`This belongs on every "mod 1000 tricks" cheat sheet. Thanks @zeynep_aydin for asking instead of just taking the accepted answer.`],
      ['zeynep_aydin', 210, r`Haha my teacher always says "a right answer for the wrong reason is a future wrong answer"`, 11],
      ['sam_whitaker', 260, r`Stealing that quote ^`, 11],
      ['alex_chung_ca', 300, r`For proofs: whenever you reduce an exponent, name the theorem and check its hypotheses. Graders look specifically for the gcd condition.`],
    ],
  },
];
