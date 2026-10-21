/**
 * What the scripted bots write in Community. Everything a bot posts stays in
 * the QA cohort, but it should still read like the feed it is exercising:
 * short, on-topic, with LaTeX, in Vietnamese and English.
 */
export const POSTS = {
  vi: [
    'Có ai giải được bài này chưa: tìm số nghiệm nguyên dương của $x + y + z = 10$? Mình ra 36 mà không chắc lắm.',
    'Mẹo nhỏ: với bất đẳng thức đối xứng 3 biến, thử $a = b = c$ trước để đoán dấu bằng, đỡ mất thời gian lắm.',
    'Hôm nay làm placement ra mức Intermediate, hơi bất ngờ 😅 mọi người ra mức nào?',
    'Bài hình hôm qua mình dùng phương tích: $PA \\cdot PB = PC \\cdot PD$ là ra luôn bán kính.',
    'Cho mình hỏi cách chứng minh $\\sqrt{2}$ là số vô tỉ mà dễ hiểu cho lớp 8 với?',
    'Mình vừa thử Arena lần đầu, 20 phút trôi nhanh thật sự. Câu 3 tổ hợp khó quá.',
    'Ai có kinh nghiệm ôn AMC 10 không, nên làm đề cũ theo năm hay theo chủ đề?',
    'Lời giải gọn: $\\sum_{k=1}^{n} k^3 = \\left(\\frac{n(n+1)}{2}\\right)^2$, quy nạp 3 dòng là xong.',
  ],
  en: [
    'Anyone else find the modular arithmetic set harder than expected? Stuck on $7^{2024} \\bmod 13$.',
    'Quick trick: for $x^2 + y^2 = n$ problems, check $n \\bmod 4$ first. Saves a lot of casework.',
    'Just finished my first Arena match. The timer is stressful in a good way.',
    'Is there a cleaner way to see why the angle bisector theorem holds than the area argument?',
    'My solution to the chord problem: power of a point gives $r^2 = 189 + d^2$, then the cosine fixes $d$.',
    'Study group idea: one geometry problem a day, post your approach here before checking solutions?',
    'Placement put me at Advanced, but number theory still feels shaky. Where would you start?',
    'Pigeonhole is underrated. Half the "impossible" combinatorics problems fold once you find the boxes.',
  ],
};

export const COMMENTS = {
  vi: [
    'Mình cũng ra 36 nè, dùng chia kẹo Euler: $\\binom{9}{2}$.',
    'Hay quá, cảm ơn bạn!',
    'Chỗ bước 2 mình chưa hiểu lắm, giải thích thêm được không?',
    'Thử dùng Cauchy-Schwarz xem, ra nhanh hơn đó.',
    'Bài này đi thi gặp hoài luôn 😂',
    'Mình làm cách khác: xét đồng dư mod 3.',
    'Đúng rồi, dấu bằng khi $a=b=c$.',
    'Lưu lại để tối làm thử.',
  ],
  en: [
    'Nice, I got the same answer with stars and bars.',
    'Could you explain the second step? Lost you there.',
    'Try Fermat\'s little theorem, it collapses quickly.',
    'This is a great approach, thanks for sharing.',
    'I think there\'s a sign error in the last line?',
    'Same problem tripped me up last week 😅',
    'Saving this for later.',
    'Equality case is when all three are equal, right?',
  ],
};
