# CalculixHub · Landing v2 «Signal»

**Bản chỉ dẫn cho AI để làm lại 100% landing page: ý tưởng, thiết kế, chuyển động, kiến trúc, kịch bản từng cảnh, kế hoạch thi công và tiêu chí nghiệm thu.**

| | |
|---|---|
| Phiên bản | 1.0 · 28/11/2026 |
| Áp dụng cho | repo `gmtigrisva123/CalculixHub` (React 19.2 · Vite 6 · TypeScript 5.8) |
| Thay thế | toàn bộ landing hiện tại trong `src/components/landing/` và các file `src/styles/landing-*.css` |
| Ngôn ngữ tài liệu | tiếng Việt (thuật ngữ kỹ thuật giữ tiếng Anh) |
| Ngôn ngữ trên trang | tiếng Anh như sản phẩm hiện tại; toàn bộ chữ gom vào một file `copy.ts` để dịch được |

---

## Prompt khởi động (dán nguyên khối này cho AI)

> Bạn là creative technologist kiêm senior frontend engineer, chuyên WebGL, scroll choreography và hiệu năng trình duyệt. Bạn thiết kế với tiêu chuẩn của một studio đoạt giải, nhưng ship như kỹ sư production: mọi hiệu ứng chạy 60 fps trên điện thoại tầm trung, đọc được bằng screen reader, và nói đúng sự thật về sản phẩm.
>
> Nhiệm vụ: xây lại **100%** landing page của CalculixHub theo tài liệu `docs/landing-v2-brief.md`. Landing hiện tại bị bỏ hoàn toàn; chỉ giữ dữ liệu và các điểm tích hợp ghi ở §4.
>
> Cách làm:
> 1. Đọc toàn bộ tài liệu trước khi viết code. §2 «Không thương lượng» thắng mọi thứ khác.
> 2. Tuân thủ `CLAUDE.md` của repo: chạy `graphify query "<câu hỏi>"` trước khi grep hay đọc file nguồn; chạy `graphify update .` sau khi sửa code.
> 3. Làm lần lượt từng giai đoạn ở §17. Hết mỗi giai đoạn: chạy `npm run lint && npm test && npm run build`, tự kiểm theo mục «Xong khi», báo cáo ngắn (đã làm gì, số đo hiệu năng, ảnh chụp, việc còn lại), rồi dừng chờ lệnh.
> 4. Không bịa số liệu hay tính năng. Mọi con số đọc từ nguồn trong repo (§3.2).
> 5. Chỗ nào tài liệu không nói rõ: chọn phương án đơn giản hơn, nhanh hơn, dễ tiếp cận hơn, rồi ghi quyết định vào `docs/landing-v2-decisions.md`.
> 6. Không thêm thư viện ngoài danh sách ở §9.1.
>
> Bắt đầu với Giai đoạn 0.

---

## Mục lục

0. Cách dùng tài liệu này
1. Mục tiêu và chỉ số thành công
2. Không thương lượng
3. Bối cảnh sản phẩm và nguồn số liệu
4. Bỏ gì, giữ gì, không được phá gì
5. Ý tưởng lớn: «Signal — từ nhiễu thành tín hiệu»
6. Nguyên tắc thiết kế
7. Art direction (màu, chữ, bố cục, vật liệu)
8. Hệ thống chuyển động
9. Kiến trúc kỹ thuật (vòng lặp, cuộn, WebGL, bầy hạt)
10. Kịch bản từng cảnh
11. Thành phần UI dùng chung
12. Responsive, cảm ứng, reduced motion, trợ năng
13. Tải trang và hiệu năng
14. Kiểm thử và nghiệm thu
15. Tích hợp với repo
16. Những điều cấm
17. Lộ trình và prompt cho từng giai đoạn
18. Phụ lục

---

## 0. Cách dùng tài liệu này

### 0.1 Dành cho người giao việc

- Với AI coding agent đang mở repo (Claude Code, Cursor, Windsurf…): dán «Prompt khởi động» ở trên.
- Giao **từng giai đoạn một**. §17 có prompt riêng cho mỗi giai đoạn. Giao cả 8 giai đoạn trong một lệnh thì chất lượng sẽ tụt.
- Xem kết quả: `npm run dev`, mở `http://localhost:8000/?landing=v2`. Landing cũ vẫn là mặc định cho tới Giai đoạn 7, nên lúc nào cũng so sánh được.
- Với AI dạng chat không mở được repo: dán thêm §3, §5, §7, §8, §10. Đủ để dựng một bản demo độc lập, nhưng phần tích hợp (§4, §15) phải làm trong repo.

### 0.2 Dành cho AI: thứ tự ưu tiên khi có mâu thuẫn

1. §2 Không thương lượng.
2. Lời người dùng trong cuộc hội thoại hiện tại.
3. `CLAUDE.md` và quy ước sẵn có của repo.
4. Phần còn lại của tài liệu này.
5. Phán đoán của bạn (ghi vào `docs/landing-v2-decisions.md`).

### 0.3 Từ khoá

- **PHẢI**: bắt buộc.
- **NÊN**: mặc định; chỉ bỏ khi có lý do đo được và đã ghi lại.
- **CÓ THỂ**: tuỳ chọn; làm khi còn ngân sách thời gian và hiệu năng.

---

## 1. Mục tiêu và chỉ số thành công

Một landing page hoàn toàn mới, cảm giác như **một bộ phim đồ hoạ chuyển động liền mạch do thao tác cuộn điều khiển**. Người xem vuốt xuống thì mọi thứ trên màn hình cùng chuyển động trên một nhịp: đồ hoạ 3D, chữ, số liệu, camera. Không giật, không khựng, không có khoảng chết.

Trang PHẢI:

1. Cho người xem hiểu trong 5 giây: CalculixHub là gì và khác các app luyện thi khác ở đâu.
2. Kể câu chuyện sản phẩm bằng chính dữ liệu và thuật toán của sản phẩm, không bằng hình minh hoạ chung chung.
3. Cuộn cực mượt với chuột, trackpad và cảm ứng: 60 fps trên điện thoại tầm trung, 120 fps trên màn 120 Hz khi máy cho phép.
4. Dẫn tới một hành động: **Find my level** (tạo tài khoản) hoặc **Sign in**.

### 1.1 Chỉ số thành công (đo được, dùng để nghiệm thu)

| Chỉ số | Mục tiêu |
|---|---|
| Frame time khi cuộn liên tục qua toàn trang, laptop tầm trung (Chrome) | ≥ 95% khung < 16,7 ms |
| Như trên, điện thoại tầm trung (Pixel 6a, iPhone 12 hoặc tương đương) | ≥ 90% khung < 16,7 ms |
| Màn 120 Hz (MacBook Pro, iPhone Pro) | ≥ 85% khung < 8,4 ms |
| Long task > 50 ms trong lúc cuộn (sau khi trang tải xong) | 0 |
| LCP (mobile, 4G mô phỏng) | ≤ 2,0 s, và phần tử LCP là tiêu đề H1 |
| CLS | ≤ 0,02 |
| INP | ≤ 150 ms |
| Lighthouse mobile | Performance ≥ 90 · Accessibility 100 · Best Practices ≥ 95 · SEO ≥ 95 |
| JS ban đầu của landing (gzip, chưa tính React và entry của app) | ≤ 70 KB |
| Chunk đồ hoạ (three.js + scene, gzip) | ≤ 170 KB |
| Bộ nhớ GPU trên điện thoại | < 150 MB |

---

## 2. Không thương lượng

1. **Bỏ 100% landing cũ**: giao diện, CSS, component, hiệu ứng, ý tưởng hình ảnh. Chỉ giữ dữ liệu và hợp đồng tích hợp ở §4.
2. **Không scroll-jacking.** Thanh cuộn, phím (Space, PageDown, mũi tên), tìm trong trang, anchor link, nút Back vẫn chạy như trang bình thường. Không khoá cuộn để bắt người xem phải xem hết animation. Cuộn ngược thì phim tua ngược đúng.
3. **Không bịa.** Không số người dùng giả, không testimonial giả, không logo trường giả, không câu "AI-powered" chung chung. Dữ liệu mẫu PHẢI có nhãn «Example». Prop `liveStats` hiện bằng 0 và KHÔNG được hiển thị.
4. **Mọi chữ là DOM thật.** Không vẽ chữ trong canvas. Nội dung đọc được đầy đủ khi tắt JavaScript, tắt WebGL hoặc bật reduced motion.
5. **`prefers-reduced-motion: reduce`** cho ra một phiên bản tĩnh đầy đủ nội dung (§12.3).
6. **Trong lúc cuộn chỉ animate `transform` và `opacity`** (kể cả `translate`, `scale`, `rotate` và biến CSS chỉ dẫn tới chúng). Không animate width, height, top, left, margin, `filter: blur()`, `box-shadow`, `backdrop-filter`, hay `clip-path` của phần tử lớn.
7. **Một vòng lặp khung hình duy nhất** cho cả trang (§9.3). Không có `requestAnimationFrame` thứ hai, không có listener `scroll` riêng.
8. **Tuân thủ CSP hiện có** (§15.4): không script, font, ảnh từ domain ngoài; không worker `blob:`; không thêm inline script.
9. **Giữ giọng văn của sản phẩm** (§3.4): câu khẳng định sự thật, không khẩu hiệu, không dấu chấm than, không emoji.
10. Cuối cùng `npm run lint && npm test && npm run build` PHẢI xanh, và đã chạy `graphify update .`.

---

## 3. Bối cảnh sản phẩm và nguồn số liệu

### 3.1 CalculixHub là gì

App luyện thi toán cho học sinh thi AMC, AIME, USAMO, IMO.

- **Điểm khác biệt cốt lõi:** bài xếp lớp (placement) thích nghi dựa trên **Item Response Theory (IRT)**, cùng họ phương pháp với các kỳ thi thích nghi trên máy tính. Engine (`src/domain/irt.ts`) ước lượng trình độ θ kèm sai số (SE); mỗi câu tiếp theo là câu cho nhiều thông tin nhất về người học; engine dừng khi đủ chắc (lý do dừng `precision`). Kết quả là một trong bốn bậc: Foundation, Intermediate, Advanced, Olympiad.
- Luyện tập theo trình độ, có gợi ý và lời giải đầy đủ.
- Tutor AI kiểu Socratic: hỏi gợi mở thay vì đưa đáp án. Chạy bằng Gemini với key miễn phí của chính người dùng (Settings → Live tutor); không có key thì trả lời mẫu.
- Phân tích lỗi: phân biệt **thiếu phương pháp** (conceptual) với **lỗi thực thi** (computational) theo từng chủ đề.
- Kho đề thật từ 1959 tới 2026; làm cả đề hoặc từng bài.
- Arena mỗi tuần, bảng xếp hạng, đếm ngược tới ngày thi, giấy nháp trên mọi màn hình, cộng đồng, app iOS.

### 3.2 Sự thật và nguồn (code PHẢI đọc từ nguồn, không gõ tay số)

| Sự thật | Giá trị hiện tại (để tham khảo) | Nguồn trong repo |
|---|---|---|
| Tổng số bài trong kho | 2,195 | `ARCHIVE_FIGURES.problems` (`src/components/landing/archiveFigures.ts`) |
| Số đề | 233 | `ARCHIVE_FIGURES.papers` |
| Khoảng năm | 1959–2026 | `ARCHIVE_FIGURES.firstYear` / `.lastYear` |
| Bốn họ đề | AMC 12: 27 đề, 580 bài · AIME: 39, 550 · USAMO (gồm USAJMO, USA TST, TSTST): 96, 540 · IMO (gồm Shortlist): 71, 525 | `ARCHIVE_FIGURES.families` |
| Số bài theo từng năm | đủ 68 năm, nhiều nhất 2020 (139 bài) | tính từ `src/data/examArchive/catalog.json`: `papers[].year`, `papers[].questions.length`, `papers[].family` |
| Bốn bậc trình độ | Foundation −4…−0.8 · Intermediate …0.4 · Advanced …1.2 · Olympiad …4 | `TIER_BANDS` (`engineRun.ts`), `tierForTheta` (`irt.ts`) |
| Replay một lần placement thật | 13 câu, θ̂ = 0.92 ± 0.31, Advanced, dừng vì `precision`; học sinh giả lập có θ thật = 1.10 | `ENGINE_RUN` = `simulatePlacement()` chạy engine thật; hậu nghiệm trên lưới 81 điểm từ −4 tới 4 |
| Bốn chủ đề | Algebra, Geometry, Combinatorics, Number Theory | `DOMAIN_ORDER` (`src/domain/skillGraph.ts`) |
| Hồ sơ từng chủ đề trong ngân hàng câu | số câu, phân bố độ khó | `domainBankProfiles()`, `formatDifficulty()` |
| Phân tích lỗi | chủ đề có mastery < 70: accuracy tổng ≥ 70% → `computational`, ngược lại `conceptual`; kèm diagnosis và remediation viết sẵn | `analyzeErrorPatterns()` (`src/domain/analytics.ts`) |
| Bốn bài thử thật có đáp án, gợi ý, lời giải | AMC 12B 2013 #6 · AMC 12B 2018 #4 · AMC 12B 2018 #5 · AMC 12A 2024 #4 | `topicRooms.ts` (+ test `archiveSamples.test.ts`) |
| Arena | 10 câu mới mỗi tuần, cân bằng 4 chủ đề, đáp án tính bằng code, 3 lần nộp mỗi câu, xếp hạng theo điểm | `docs/admin-arena.md`, `scripts/weekly-arena.ts` |
| Giá | Free $0 · Pro $9/tháng hoặc $72/năm (tiết kiệm 33%) · Team $7/học sinh/tháng hoặc $60/năm, tối thiểu 5 học sinh, bán qua trao đổi | `PLANS`, `PLAN_ORDER`, `dollars`, `monthlyEquivalent`, `yearlySaving`, `TEAM_MIN_SEATS` (`shared/plans.ts`) |
| Tính năng đang làm | `state: 'planned'` trong từng gói | `shared/plans.ts` |
| Checkout đã mở chưa | đọc lúc chạy | `billingConfig()` trong `src/services/data/plan` |
| FAQ đã duyệt | 8 câu hỏi | mảng `FAQS` trong `FaqSection.tsx` (chuyển ra file dữ liệu) |
| Logo | chữ "e" viết một nét, chấm tròn ở cuối nét ngang | `MARK_PATH`, `MARK_DOT`, `MARK_STROKE`, `MARK_VIEWBOX` (`src/components/brand.ts`) |
| Màu bốn chủ đề của app | Algebra #c8842a · Geometry #2f9c8c · Combinatorics #8b5cf6 · Number Theory #0ea5e9 | `src/styles/tokens.css` |

### 3.3 Người xem

- Học sinh 12–18 tuổi luyện AMC, AIME, USAMO, IMO (rất nhiều em ở Việt Nam và châu Á). Phần lớn mở trang trên điện thoại.
- Phụ huynh và huấn luyện viên CLB toán: cần thấy sự nghiêm túc và giá rõ ràng.
- Họ đã chán các "AI app" chung chung. Trang PHẢI **chứng minh** bằng dữ liệu thật, không quảng cáo suông.

### 3.4 Giọng văn

Giữ house rules của sản phẩm (`docs/design-refresh-report.md`):

- Câu ngắn, khẳng định một sự thật về sản phẩm. Không khẩu hiệu, không cổ vũ, không dấu chấm than, không emoji.
- Gọi tên theo cách người dùng hiểu (level, problem, contest). Từ "item response theory" chỉ xuất hiện một lần, có giải thích kèm.
- Không có dòng nhãn nhỏ phía trên tiêu đề (eyebrow). Khi cần thông tin đo đạc thì dùng readout chữ mono: đó là dữ liệu, không phải trang trí.
- **Ngoại lệ có chủ đích, chỉ cho landing v2:** quy tắc "Motion happens once / nothing fades by scroll position" của workspace KHÔNG áp dụng ở landing, vì ở đây chuyển động theo cuộn chính là nội dung. Workspace giữ nguyên quy tắc cũ.
- Landing có thế giới màu riêng (Night/Day, §7) và **không đi theo theme sáng/tối** của app.

---

## 4. Bỏ gì, giữ gì, không được phá gì

### 4.1 Bỏ hoàn toàn (xoá ở Giai đoạn 7, sau khi v2 đã thay thế)

- Mọi component giao diện trong `src/components/landing/`: `LandingPage`, `LandingNav`, `Opening`, `HeroGlow`, `ParticleField`, `GroundTones`, `MarginRails`, `LandingChapters`, `EngineStory`, `ChordPlayground`, `TopicsChapter`, `TopicBoards`, `ArchiveLadder`, `JourneyStack`, `DeskSection`, `PlansSection`, `FaqSection`, `FinalStage`, `LandingFooter`, `kit.tsx`, `smoothScroll.ts`, `chapters.ts`, `chords.ts`, `particleShapes.ts`, `marginFigures.ts`, cùng test của các module bị xoá.
- CSS: `src/styles/landing-margins.css`, `landing-experience.css`, `landing-frame.css`, `landing-desk.css`, `landing-plans.css`, `landing-motion.css`. Trước khi xoá, dùng graphify và grep để chắc không còn file nào import.
- **Không xoá nguyên file** `src/styles/landing-refresh.css`: `src/components/WelcomeScreen.tsx` (dòng 47) đang import nó cho màn đăng nhập/đăng ký. Chỉ gỡ những rule còn phục vụ riêng landing cũ, rồi chụp lại màn đăng nhập/đăng ký để chắc không đổi.
- **Không mang sang bản mới** bất kỳ ý tưởng hình ảnh nào của bản cũ: bướm Lorenz, tờ giấy trượt phủ lên hero, chữ sáng dần từng từ "Not too easy / Not too hard / Just right", bảng phấn, margin rails, nền đổi tông giấy theo chương, marquee tên kỳ thi, thẻ xếp chồng, nút màu kem có ô mũi tên, gạch chân kiểu bút chì, khung viền ánh xà cừ quanh hero.

### 4.2 Giữ dữ liệu (di chuyển sang chỗ mới, giữ nguyên test)

| Module | Vì sao giữ | Chuyển tới |
|---|---|---|
| `archiveFigures.ts` (+ test) | số liệu thật của kho đề | `src/features/landing/data/` |
| `topicRooms.ts`, `archiveSamples.ts` (+ test) | bốn bài thật có đáp án, gợi ý, lời giải | `src/features/landing/data/` |
| `engineRun.ts` (+ test) | replay placement bằng engine thật | `src/features/landing/data/`; chuyển `mulberry32` từ `particleShapes.ts` sang `src/lib/random.ts` |
| `FAQS` trong `FaqSection.tsx` | nội dung đã duyệt | `src/features/landing/data/faq.ts` (câu về giá vẫn đọc từ `PLANS`) |
| Link trong `LandingFooter.tsx` (iPhone preview, MacBook preview…) | tính năng có thật | `src/features/landing/data/footer.ts` |

### 4.3 Hợp đồng tích hợp: không được phá

- `src/components/Welcome.tsx` tải landing bằng `lazyWithPreload(() => import(...))` và truyền props `{ liveStats, onSignIn, onRegister }`. Landing mới PHẢI giữ đúng chữ ký props này.
- `src/components/WelcomeScreen.tsx` cũng render `LandingPage` (import ở dòng 15, dùng quanh dòng 641, là đường quay lại từ form). Cập nhật import ở Giai đoạn 7.
- `index.html` và `src/boot/boot.ts` vẽ khung đầu tiên (`#boot`) cho biến thể `landing`. Khung đầu PHẢI khớp hero mới (§13.1). Sửa **CSS** inline không đổi hash CSP. Sửa **script** inline thì PHẢI cập nhật `THEME_BOOT_SCRIPT_HASH` trong `server/security.ts` và chuỗi CSP trong `vercel.json`, nếu không `server/__tests__/guarantees.test.ts` sẽ đỏ.
- `src/components/brand.test.ts` có danh sách `holders` trỏ tới `src/components/landing/kit.tsx`. Đổi sang file mới có vẽ logo.
- URL đang dùng PHẢI chạy tiếp: `/?auth=signup`, `/?auth=signup&tab=community`, `/?preview=ios`, `/?preview=mac`, `/#plans`, `/#faq`.
- Hash cũ có thể đang được chia sẻ ở nơi khác. Map sang cảnh mới: `#idea → #top`, `#engine → #how-it-works`, `#playground → #try`, `#topics → #try`, `#archive → #archive`, `#workspace → #arena`, `#desk → #arena`, `#begin → #begin`.

---

## 5. Ý tưởng lớn: «Signal — từ nhiễu thành tín hiệu»

### 5.1 Câu chuyện

Trước khi bạn trả lời câu nào, CalculixHub không biết gì về bạn: trình độ của bạn là một đám **nhiễu**. Mỗi câu trả lời làm đám nhiễu co lại, cho tới khi nó thành một **tín hiệu** rõ: trình độ của bạn, kèm sai số. Đó đúng là việc engine IRT làm, và đó là câu chuyện của cả trang.

### 5.2 Hình thức: một cú máy liền mạch

Cả landing là **một cú máy duy nhất (one-take)** đi xuyên qua một thế giới dựng bằng hàng chục nghìn hạt sáng. Bầy hạt là "khối xác suất về trình độ của bạn". Cuộn xuống giống như trả lời thêm câu hỏi.

Bầy hạt không bao giờ biến mất. Nó **biến hình** từ cảnh này sang cảnh khác:

```
đám mây nhiễu → đường cong hậu nghiệm thật của engine → hình vẽ của bài toán
→ các lớp dữ liệu phân tích lỗi → sương mỏng (nhường chỗ cho tutor)
→ chòm sao bốn chủ đề → đường hầm 68 năm đề thi → bốn cột họ đề
→ đường đua Arena → mặt giấy kẻ ô (ban ngày) → logo CalculixHub
```

Camera di chuyển liên tục dọc một "đường ray" 3D. Giữa hai cảnh luôn có chuyển động nối, không bao giờ có màn hình tĩnh trống.

### 5.3 Ngữ pháp màu (màu mang nghĩa)

- **Ánh sáng lạnh = máy đo**: engine, hệ thống, câu hỏi.
- **Ánh sáng ấm = bạn**: câu trả lời của bạn, vị trí ước lượng của bạn, chấm tròn trong logo.
- Bốn màu chủ đề chỉ xuất hiện khi đang nói về chủ đề.
- Xanh lá và đỏ chỉ để nói đúng và sai.
- Độ sáng tăng theo độ khó: hạt càng sáng, bài càng khó.

### 5.4 Năm khoảnh khắc chữ ký (PHẢI làm thật kỹ)

1. **Hạt thở** (cảnh `top`): đám mây hạt thở chậm, dạt ra khi con trỏ đi qua.
2. **Khoá tín hiệu** (cảnh `how-it-works`): khi engine dừng vì đã đủ chắc, dải sai số bật vào vị trí, một vòng sáng lan ra đúng một lần, readout chuyển sang `LOCKED`.
3. **Bóc lớp** (cảnh `why`): hồ sơ người học tách thành các lớp trong không gian 3D, một tia quét đi xuyên qua rồi đưa ra chẩn đoán thật của engine.
4. **Đường hầm thời gian** (cảnh `archive`): camera bay xuyên 68 vòng năm từ 1959 tới 2026; độ dày mỗi vòng bằng số bài thật của năm đó.
5. **Hội tụ thành logo** (cảnh `begin`): mọi hạt hội tụ thành chữ "e" của logo; chấm tròn cuối nét ngang sáng ấm nhất trang. Chấm đó là bạn.

---

## 6. Nguyên tắc thiết kế

1. **Đồ hoạ là nội dung, không phải trang trí.** Mỗi hình bầy hạt tạo ra là một dữ liệu hoặc một khái niệm thật của sản phẩm.
2. **Một cú máy, không cắt cảnh.** Hết cảnh này là đã vào cảnh sau.
3. **Cuộn là động cơ, không phải xiềng xích.** Người xem quyết định tốc độ. Cuộn ngược thì tua ngược.
4. **Chữ luôn đọc được.** Khối chữ nằm ở một phần ba trái hoặc phải, đồ hoạ cân ở phần đối diện. Mọi khối chữ đặt trên scrim đủ tương phản 4,5:1 kể cả lúc đồ hoạ sáng nhất đi qua phía sau.
5. **Mỗi cảnh một ý, một chuyển động chính.** Không chồng ba hiệu ứng để gây ấn tượng.
6. **Hiệu năng là một phần của thiết kế.** Hiệu ứng nào không giữ được 60 fps trên điện thoại tầm trung thì phải có bản rút gọn.
7. **Trung thực.** Số thật, dữ liệu mẫu có nhãn, tính năng đang làm ghi rõ "in the works".
8. **Tôn trọng người dùng.** Reduced motion, bàn phím, screen reader, tiết kiệm pin, không âm thanh tự phát.

---

## 7. Art direction

### 7.1 Hai thế giới: Night và Day

- **Night** (đồ hoạ là chính): từ cảnh `top` tới `arena`, và cảnh `begin`.
- **Day** (đọc và quyết định): `plans`, `faq`. Ít chuyển động, chữ là chính.
- Night → Day là chuyển cảnh «Bình minh» (§10.9): ánh sáng ngày lan ra từ chấm "bạn". Day → Night ở cảnh `begin`: bóng đêm thấm vào từ các mép.

### 7.2 Bảng màu (tokens)

Đã kiểm tra nằm trong gam sRGB và đủ tương phản.

| Token | Vai trò | OKLCH | Hex |
|---|---|---|---|
| `--n-0` | nền đêm | `oklch(0.13 0.028 268)` | `#040712` |
| `--n-1` | nền stage | `oklch(0.17 0.034 268)` | `#090f1e` |
| `--n-2` | bề mặt nổi (thẻ) | `oklch(0.215 0.036 268)` | `#12192a` |
| `--n-line` | đường kẻ mảnh | `oklch(0.34 0.035 268)` | `#30374a` |
| `--n-text` | chữ chính trên đêm | `oklch(0.965 0.006 268)` | `#f2f3f8` |
| `--n-mute` | chữ phụ trên đêm | `oklch(0.75 0.025 268)` | `#a7aebe` |
| `--n-dim` | chú thích (chỉ dùng cỡ ≥ 14px) | `oklch(0.58 0.03 268)` | `#737a8d` |
| `--d-0` | nền ngày (giấy lạnh) | `oklch(0.975 0.005 265)` | `#f5f7fa` |
| `--d-1` | bề mặt ngày | `oklch(0.945 0.008 265)` | `#eaedf2` |
| `--d-line` | kẻ mảnh ngày | `oklch(0.87 0.012 265)` | `#d0d4dc` |
| `--d-text` | chữ chính ngày | `oklch(0.2 0.03 268)` | `#101524` |
| `--d-mute` | chữ phụ ngày | `oklch(0.46 0.03 268)` | `#515869` |
| `--ion` | ánh sáng máy (màu hạt) | `oklch(0.86 0.07 245)` | `#abd7fd` |
| `--ion-strong` | link và focus trên đêm | `oklch(0.78 0.11 250)` | `#80bdfb` |
| `--ion-ink` | link và focus trên ngày | `oklch(0.48 0.17 262)` | `#2256bb` |
| `--sun` | ánh sáng "bạn" (màu hạt) | `oklch(0.92 0.075 85)` | `#fce2ac` |
| `--sun-strong` | điểm nhấn "bạn" trên đêm | `oklch(0.84 0.12 75)` | `#f8bf6c` |
| `--sun-ink` | điểm nhấn "bạn" trên ngày | `oklch(0.52 0.105 65)` | `#925a1a` |
| `--right` | đúng (đêm / ngày) | `oklch(0.80 0.14 160)` / `oklch(0.50 0.105 160)` | `#5ed99e` / `#17754e` |
| `--slip` | sai (đêm / ngày) | `oklch(0.72 0.17 28)` / `oklch(0.53 0.18 28)` | `#fd7466` / `#be3029` |
| Chủ đề | dùng đúng màu của app | Algebra `#c8842a` · Geometry `#2f9c8c` · Combinatorics `#8b5cf6` · Number Theory `#0ea5e9` | biến trong `src/styles/tokens.css` |

Tương phản đã đo: `--n-text` trên `--n-0` 18,2:1 · `--n-mute` trên `--n-0` 9,0:1 · `--n-dim` trên `--n-0` 4,7:1 · `--d-text` trên `--d-0` 16,9:1 · `--d-mute` trên `--d-0` 6,6:1 · `--ion-ink` trên `--d-0` 6,3:1 · `--sun-ink` trên `--d-0` 5,3:1.

Quy tắc màu:

- Không gradient trang trí. "Gradient" duy nhất là ánh sáng của chính bầy hạt và scrim sau chữ.
- Không glassmorphism, không `backdrop-filter` đè lên canvas.
- Một điểm nhấn trên mỗi màn hình: hoặc lạnh (máy), hoặc ấm (bạn), không có màu thứ ba để trang trí.

### 7.3 Chữ

Dùng font đã tự host trong repo, không thêm font mới (Geist có subset tiếng Việt nếu sau này dịch trang):

- **Geist Variable**: tiêu đề và giao diện.
- **Geist Mono Variable**: readout, con số, nhãn đo.
- **Newsreader**: chỉ cho đề bài toán (house rule). Công thức dùng KaTeX.

| Vai trò | Font | Cỡ | Weight | Tracking | Line-height |
|---|---|---|---|---|---|
| H1 | Geist | `clamp(2.75rem, 7.2vw, 7.5rem)` | 300; từ khoá 600 | −0.045em | 0.95 |
| H2 của cảnh | Geist | `clamp(2.25rem, 5vw, 5rem)` | 300; từ khoá 600 | −0.04em | 1.0 |
| H3 | Geist | `clamp(1.25rem, 1.8vw, 1.6rem)` | 500 | −0.01em | 1.2 |
| Lead | Geist | `clamp(1.06rem, 1.3vw, 1.3rem)` | 400 | 0 | 1.5 |
| Body | Geist | `1rem`–`1.06rem` | 400 | 0 | 1.6 |
| Readout số lớn | Geist Mono | `clamp(2rem, 4vw, 3.5rem)` | 400 | −0.02em | 1 |
| Nhãn đo | Geist Mono | `0.75rem`, chữ hoa | 500 | 0.08em | 1.2 |
| Đề bài | Newsreader | `1.15rem` | 400 | 0 | 1.55 |

- Mọi con số dùng `font-variant-numeric: tabular-nums`.
- Tiêu đề dùng `text-wrap: balance`; đoạn văn dài tối đa 58ch; tiêu đề tối đa 18ch mỗi dòng.
- **Cách nhấn mạnh mới**: tương phản độ đậm (cả câu weight 300, từ khoá weight 600) cộng một "ngoặc đo" mảnh `├───┤` vẽ dưới từ khoá bằng SVG, chạy `stroke-dashoffset` 600 ms đúng một lần. Không in nghiêng, không đổi màu cả cụm, không gạch chân bút chì.

### 7.4 Bố cục

- Lưới 12 cột, `max-width: 1440px`, gutter 24px (≥ 1024px: 32px), lề ngoài `max(16px, 5vw)` cộng safe-area.
- Khối chữ đặt ở cột 1–5 (trái) hoặc 8–12 (phải). Đồ hoạ cân ở phần đối diện: camera dịch trọng tâm hình theo `textSide` của cảnh (§9.4).
- HUD bốn góc trên màn ≥ 1024px: trên-trái logo và nav · trên-phải nút CTA · dưới-trái readout θ, ±, Q · dưới-phải số cảnh `03 / 11` (các cảnh là một chuỗi thật nên đánh số là hợp lý).
- Điện thoại: đồ hoạ ở 55% trên của màn hình, chữ ở 45% dưới trên một scrim.

### 7.5 Vật liệu và chi tiết

- Bo góc nhỏ: 2px cho control, 10px cho thẻ (rất ít thẻ).
- Night không có đổ bóng; Day dùng viền 1px `--d-line`.
- Hạt là đĩa tròn mềm vẽ trong shader, không dùng sprite ảnh.
- Film grain làm trong fragment shader của lớp nền (rẻ), không dùng ảnh PNG đè lên với blend mode.
- Icon: `lucide-react` (đã có), nét 1.5, cỡ 16 hoặc 20.
- Giữ con trỏ hệ thống. Chỉ thêm "reticle" đo đạc bên trong các stage đồ hoạ (§11.5).

---

## 8. Hệ thống chuyển động

### 8.1 Nguyên tắc

- **Cuộn → tiến trình → trạng thái.** Chuyển động gắn với cuộn được tính từ tiến trình của cảnh, không bằng `setTimeout` hay IntersectionObserver.
- Thứ **đi vào** màn hình thì giảm tốc (ease-out). Thứ **rời đi** thì tăng tốc (ease-in). Thứ **di chuyển trên màn hình** thì ease-in-out.
- Thứ người dùng chạm hoặc kéo thì dùng **spring**, để ngắt và đổi hướng giữa chừng không bị giật.
- Mọi chuyển động gắn với cuộn PHẢI đảo ngược được khi cuộn ngược. Ngoại lệ: phản hồi của tương tác (chọn đáp án) và vài sự kiện một lần đã ghi rõ.
- Chỉ ba chuyển động được tự chạy (ambient): hạt thở, runner trên đường đua Arena, nhịp nháy của chấm "bạn" khi hover nút. Có nút **Pause motion** để dừng cả ba (§11.7).

### 8.2 Tokens

```ts
// src/features/landing/motion.ts (bản CSS tương ứng ở styles/tokens.css)
export const DUR = { micro: 0.12, short: 0.2, base: 0.32, long: 0.56, scene: 0.9, cinematic: 1.4 } as const;

export const EASE = {
  out: [0.16, 1, 0.3, 1],      // đi vào (expo-out)
  in: [0.5, 0, 0.75, 0],       // rời đi (quart-in)
  inOut: [0.65, 0, 0.35, 1],   // di chuyển trên màn hình, bay tới cảnh
  outSoft: [0.25, 1, 0.5, 1],  // số liệu ổn định (quart-out)
} as const;

export const SPRING = {
  press: { type: 'spring', visualDuration: 0.25, bounce: 0.2 },  // nút, chạm
  ui:    { type: 'spring', visualDuration: 0.45, bounce: 0.08 }, // panel, pill, sắp xếp lại
  text:  { type: 'spring', visualDuration: 0.8,  bounce: 0.1 },  // tiêu đề trồi lên
  lock:  { type: 'spring', visualDuration: 0.55, bounce: 0.35 }, // chỉ dùng cho Lock-on
} as const;

export const STAGGER = { word: 0.04, line: 0.08, item: 0.06, max: 0.4 } as const;

// Hệ số λ cho damping độc lập tần số khung: x += (target - x) * (1 - Math.exp(-λ * dt))
export const DAMP = { camera: 6, pointer: 12, reticle: 18, readout: 10, parallax: 4 } as const;
```

```css
/* styles/tokens.css */
.lx2 {
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in: cubic-bezier(0.5, 0, 0.75, 0);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --dur-short: 200ms; --dur-base: 320ms; --dur-long: 560ms;
}
```

Spring cho CSS (khi không dùng Motion): dùng `linear()` lấy mẫu từ phản hồi của một spring có tắt dần, kèm fallback `var(--ease-out)` khai báo phía trước.

### 8.3 Quy ước tiến trình của cảnh

Mỗi cảnh có tiến trình `p ∈ [0, 1]` chạy suốt đoạn cuộn của nó:

| Dải | p | Việc xảy ra |
|---|---|---|
| `enter` | 0 → 0.12 | morph từ form của cảnh trước sang form cảnh này hoàn tất (morph đã bắt đầu từ p = 0.88 của cảnh trước) |
| `act` | 0.12 → 0.88 | hành động chính của cảnh |
| `exit` | 0.88 → 1 | chữ rời đi, morph sang form tiếp theo bắt đầu |

- Tiêu đề vào ở p 0.02 → 0.14, rời ở p 0.90 → 0.98.
- Helper: `range(p, a, b) = clamp((p - a) / (b - a), 0, 1)`, sau đó áp easing từ `EASE`.
- Không có "khoảng chết": luôn có ít nhất một thứ (hạt, camera hoặc chữ) đang chuyển động khi người xem đang cuộn.

### 8.4 Chuyển động của chữ

- **SplitHeading**: tách theo từ (dấu câu dính với từ), mỗi từ trong một mask `overflow: clip`; `translateY 105% → 0`, `opacity 0 → 1`, stagger 40 ms, `SPRING.text`. Thẻ heading giữ `aria-label` bằng câu đầy đủ; các span tách ra mang `aria-hidden="true"`.
- **Khi rời đi**: `translateY 0 → −40%`, `opacity → 0`, `EASE.in`, 320 ms, không stagger. Rời đi nhanh và gọn.
- **Decode readout**: mỗi ký tự lướt qua bảng `0123456789θσ±.` sáu tới tám lần trong 480 ms rồi dừng đúng giá trị; ký tự sau dừng trễ 30 ms so với ký tự trước. Font mono và tabular-nums nên không xê dịch bố cục.
- **Odometer** cho giá: mỗi chữ số là một cột 0–9 trượt dọc bằng transform, `SPRING.ui`.
- **Không bao giờ** đổi `font-weight` hay `font-variation-settings` theo từng frame cuộn (gây reflow). Đổi độ đậm chỉ theo sự kiện, tối đa một lần mỗi cảnh, bằng transition 400 ms.

### 8.5 Không làm

- Không nảy (bounce) khi vào cảnh; spring có bounce chỉ dành cho thứ người dùng chạm và cho Lock-on.
- Không xoay chữ, không parallax nhiều lớp chữ lệch nhau.
- Không hiệu ứng gõ từng ký tự cho đoạn dài.
- Không fade-in từng đoạn văn dài khi đang đọc.
- Không animation chạy vô hạn ngoài ba ambient đã cho phép.

---

## 9. Kiến trúc kỹ thuật

### 9.1 Stack (đều đã có trong `package.json`, không thêm thư viện)

| Thư viện | Phiên bản trong repo | Dùng cho |
|---|---|---|
| React / React DOM | 19.2 | component, `flushSync` cho view transition |
| Vite | 6.4 | build, worker module, code splitting |
| `lenis` | 1.3.26 | nội suy cuộn chuột/trackpad |
| `motion` (`motion/react`) | 12.42 | vòng lặp khung hình (`frame`), MotionValue, animation DOM, layout animation |
| `three` | 0.180 | WebGL2: `WebGLRenderer`, `Points`, `ShaderMaterial`, `DataTexture` (three ≥ r163 chỉ còn WebGL2, nên `texelFetch` dùng được trong `ShaderMaterial`) |
| `katex` | 0.18 | công thức (tải lười) |
| `lucide-react` | 0.546 | icon |

**Cấm thêm** GSAP, React Three Fiber, drei, thư viện postprocessing, Theatre.js, Barba, Locomotive Scroll hay bất kỳ runtime animation thứ hai nào. Lý do: hai hệ thời gian chạy song song là nguồn giật số một, và bundle tăng. Muốn thêm thì phải có số đo chứng minh và ghi vào `docs/landing-v2-decisions.md`.

CÓ THỂ chuyển sang `WebGPURenderer` (`three/webgpu`) sau này. Vì vậy shader và logic bầy hạt PHẢI nằm trong module riêng, không trộn với React.

### 9.2 Cấu trúc thư mục

```
src/features/landing/
  LandingPage.tsx            # entry; props { liveStats, onSignIn, onRegister } giữ nguyên
  copy.ts                    # TOÀN BỘ chữ hiển thị (EN), một chỗ để dịch
  motion.ts                  # tokens §8.2
  scenes.ts                  # scene registry §9.4
  director/
    loop.ts                  # vòng lặp khung hình duy nhất §9.3
    lenis.ts                 # tạo và cấu hình Lenis
    ScrollDirector.ts        # đo section, tính tiến trình, story time, vận tốc §9.5
    useScene.ts              # hook: MotionValue tiến trình của một cảnh
    anchors.ts               # gắn nhãn DOM vào điểm 3D §9.12
    quality.ts               # phân hạng thiết bị + governor §9.10
  gl/
    Stage.tsx                # canvas cố định, tải lười
    renderer.ts
    camera.ts                # camera theo cảnh + damping §9.9
    swarm/
      Swarm.ts
      swarm.vert.glsl
      swarm.frag.glsl
      forms.ts               # khai báo form §9.11
      bake.worker.ts         # tính toạ độ form trong worker §9.8
      posterior.ts           # ENGINE_RUN → DataTexture
    fx/
      Lines.ts               # cạnh chòm sao, làn đường đua, đường 13 câu
      Pulse.ts               # vòng sáng Lock-on
      Dawn.ts                # chuyển Night ↔ Day
  sections/
    Arrival.tsx  HowItWorks.tsx  TryOne.tsx  WhyMissed.tsx  Tutor.tsx  Map.tsx
    Archive.tsx  Arena.tsx  Plans.tsx  Faq.tsx  Begin.tsx  Footer.tsx
  ui/
    Nav.tsx  SceneRuler.tsx  Hud.tsx  Button.tsx  SplitHeading.tsx  Readout.tsx
    Odometer.tsx  Reticle.tsx  MotionToggle.tsx  Scrim.tsx  MeasureBracket.tsx
  data/                      # dữ liệu chuyển từ landing cũ §4.2
  styles/
    tokens.css  layout.css  sections.css
  __tests__/
public/landing/posters/      # ảnh tĩnh từng cảnh (AVIF + WebP), sinh bằng script §14.4
qa/landing-v2/               # Playwright: ảnh chụp, đo khung hình
```

### 9.3 Vòng lặp khung hình duy nhất

Mọi thứ chuyển động trên trang chạy trong frameloop của Motion: Lenis, director, camera, DOM, WebGL. Không component nào được gọi `requestAnimationFrame` riêng.

```ts
// director/loop.ts
import { frame, cancelFrame } from 'motion';

type Step = (dt: number, time: number) => void;
type FrameInfo = { delta: number; timestamp: number };
const updates = new Set<Step>();
const renders = new Set<Step>();

function runUpdates({ delta, timestamp }: FrameInfo) {
  const dt = Math.min(delta, 50) / 1000;          // chặn bước nhảy khi tab quay lại
  for (const step of updates) step(dt, timestamp / 1000);
}
function runRenders({ delta, timestamp }: FrameInfo) {
  const dt = Math.min(delta, 50) / 1000;
  for (const step of renders) step(dt, timestamp / 1000);
}

export function startLoop() {
  frame.update(runUpdates, true);                  // keepAlive: chạy mọi khung
  frame.render(runRenders, true);
}
export function stopLoop() { cancelFrame(runUpdates); cancelFrame(runRenders); }
export const onUpdate = (step: Step) => { updates.add(step); return () => updates.delete(step); };
export const onRender = (step: Step) => { renders.add(step); return () => renders.delete(step); };
```

Thứ tự trong một khung:

```
frame.update:  lenis.raf(timestamp) → director.update(dt) → camera/uniform damping → anchors (tính toạ độ)
frame.render:  Motion ghi style DOM (MotionValue) → anchors (ghi transform) → renderer.render(scene, camera)
```

```
 chuột / trackpad / phím / cảm ứng
            │
            ▼
   Lenis (lerp 0.085) ──► window.scrollY        (chỉ chuột/trackpad được nội suy)
            │
            ▼  mỗi khung, trong frame.update
   ScrollDirector ──► tiến trình từng cảnh (MotionValue) ──► chữ, HUD, nav (transform/opacity)
            │
            ├──► story time s ──► form A, form B, morph ──► uniform của bầy hạt
            ├──► camera theo cảnh (damped) ─────────────────► camera three.js
            └──► vận tốc, hướng cuộn ───────────────────────► gió xoáy, nghiêng nhẹ, ẩn/hiện nav
                                                                     │
                                                     frame.render: renderer.render()
```

Lenis:

```ts
// director/lenis.ts
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

export function createLenis() {
  return new Lenis({
    autoRaf: false,            // vòng lặp chung gọi lenis.raf()
    lerp: 0.085,               // 0.07–0.1: trơn mà không thấy trễ
    smoothWheel: true,
    syncTouch: false,          // cảm ứng giữ quán tính gốc của iOS/Android
    wheelMultiplier: 1,
    touchMultiplier: 1,
    anchors: false,            // anchor do director xử lý (cảnh đích có thể chưa mount nội dung)
    allowNestedScroll: true,   // vùng cuộn con (bảng giá trên mobile, khung chat) cuộn tự nhiên
    stopInertiaOnNavigate: true,
    autoResize: true,
  });
}
```

- Reduced motion: **không tạo Lenis** (trình duyệt tự cuộn).
- Phần tử cần cuộn riêng: gắn `data-lenis-prevent`.
- Khi mở menu toàn màn hình: `lenis.stop()`, đóng thì `lenis.start()`.
- Bay tới một cảnh: `lenis.scrollTo(y, { duration: clamp(0.9 + distance / 5200, 0.9, 2.2), easing: easeInOutExpo })`. Quãng ngắn không bò, quãng dài không dịch chuyển tức thời.

### 9.4 Scene registry

```ts
// scenes.ts
export type SceneId = 'top' | 'how-it-works' | 'try' | 'why' | 'tutor' | 'map'
  | 'archive' | 'arena' | 'plans' | 'faq' | 'begin';

export interface Scene {
  id: SceneId;               // cũng là id của <section> và hash trên URL
  label: string;             // tên ngắn trong nav và thước cảnh (EN, lấy từ copy.ts)
  world: 'night' | 'day';
  budget: { desktop: number; mobile: number } | 'content'; // chiều cao đoạn cuộn, đơn vị svh
  pinned: boolean;           // có stage sticky bên trong không
  form: FormId;              // form của bầy hạt trong dải act
  textSide: 'left' | 'right' | 'center';
  cameraAt: (p: number, aspect: number) => CameraPose; // hàm thuần, xem §9.9
}
```

| # | id | Cảnh | World | Ngân sách (svh) desktop / mobile | Sticky | Form | Chữ |
|---|---|---|---|---|---|---|---|
| 1 | `top` | Arrival | night | 100 / 100 | không (hero) | `cloud` | trái |
| 2 | `how-it-works` | Collapse | night | 300 / 220 | có | `posterior` | trái |
| 3 | `try` | Try one | night | theo nội dung, tối thiểu 100 | không | `figure-*` | phải |
| 4 | `why` | Why you missed | night | 160 / 130 | có | `layers` | trái |
| 5 | `tutor` | Tutor | night | 120 / 110 | có | `quiet` | trái |
| 6 | `map` | Map | night | 180 / 140 | có | `constellation` | trái |
| 7 | `archive` | Archive | night | 240 / 170 | có | `tunnel` → `banks` | giữa |
| 8 | `arena` | Arena | night | 130 / 110 | có | `track` | trái |
| 9 | `plans` | Plans | day | theo nội dung (+60 cho Bình minh) | không | `grid` | giữa |
| 10 | `faq` | FAQ | day | theo nội dung | không | `grid` (canvas ngủ) | trái |
| 11 | `begin` | Begin | night | 130 / 110 | có | `mark` | giữa |

Tổng khoảng 17 màn hình trên desktop và 14 trên điện thoại (bản cũ khoảng 22). Nav và thước cảnh cho phép nhảy thẳng tới phần muốn xem.

Mọi section shell (với chiều cao lấy từ registry) PHẢI có mặt trong DOM ngay từ lần render đầu, kể cả khi nội dung bên trong còn chưa mount. Nhờ vậy chiều cao trang không đổi, vị trí cuộn không bao giờ nhảy.

```tsx
<section id={scene.id} className="lx2-scene" data-world={scene.world}
  style={{ '--budget': budget } as React.CSSProperties} aria-labelledby={`${scene.id}-title`}>
  <div className="lx2-stage">{/* position: sticky; top: 0; height: 100svh */}</div>
</section>
/* CSS: .lx2-scene[data-pinned] { height: calc(var(--budget) * 1svh); } */
```

### 9.5 ScrollDirector

Trách nhiệm:

- **Đo** `top` và `height` của từng section bằng `offsetTop`/`offsetHeight` (cộng dồn qua offsetParent) chỉ khi: mount, `ResizeObserver` báo đổi kích thước (body và từng section), `document.fonts.ready`, và khi nội dung của một cảnh vừa mount. **Không bao giờ** gọi `getBoundingClientRect` trong vòng lặp.
- **Mỗi khung**: đọc `y = lenis?.scroll ?? window.scrollY`; chiều cao khung `vh` đã cache (đo một phần tử ẩn cao `100svh` để ổn định trên mobile).
- **Tiến trình cảnh**:
  - cảnh sticky: `p = clamp((y − top) / (height − vh), 0, 1)`
  - cảnh thường: `p = clamp((y − top + vh) / (height + vh), 0, 1)`
- **Story time** `s`: số thực tăng đơn điệu theo `y`; phần nguyên là chỉ số cảnh, phần thập phân là `p`. Bầy hạt và camera chỉ đọc `s`.
- **Form đang morph**: hàm `formState(s) → { formA, formB, morph }`. Cửa sổ morph giữa cảnh i và i+1 trải từ p = 0.88 của cảnh i tới p = 0.12 của cảnh i+1. PHẢI liên tục: không nhảy giá trị khi qua ranh giới hai cảnh (có unit test).
- **Vận tốc**: `velocity = damp(velocity, lenis.velocity, λ = 10, dt)`, đơn vị px mỗi khung, dùng cho gió xoáy và ẩn/hiện nav.
- **Xuất ra**: `progress[id]: MotionValue<number>`, `story: MotionValue<number>`, `velocity`, `direction`, `activeScene` (React state, chỉ đổi khi sang cảnh khác).
- Chỉ `set` MotionValue khi giá trị đổi lớn hơn 0.0005, để Motion không ghi DOM thừa.

### 9.6 Stage WebGL

- Một `<canvas>` duy nhất: `position: fixed; inset: 0; z-index: 0; pointer-events: none`, `aria-hidden="true"`. Các section nằm trên (`z-index: 1`) với nền trong suốt ở thế giới Night.
- **Tải lười**: `import('./gl/Stage')` chỉ sau khi chữ của hero đã vào xong và trình duyệt rảnh (`requestIdleCallback`, timeout 1200 ms; Safari dùng `setTimeout`). Trong lúc chờ, poster tĩnh của đám mây hiển thị ở đúng vị trí canvas.
- Renderer: `new WebGLRenderer({ antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance' })`, `setClearColor('#040712')`, `setPixelRatio(min(devicePixelRatio, tier.maxDpr))`.
- **Biên dịch shader trước**: `await renderer.compileAsync(scene, camera)` rồi mới vẽ khung đầu. Sau đó crossfade poster → canvas trong 800 ms.
- **Ngủ**: không render khi `document.hidden`, khi Plans/FAQ đã phủ kín màn hình bằng nền đặc, hoặc khi người dùng bật Pause motion và không cuộn (vẽ lại một khung khi có thay đổi).
- **Mất context**: nghe `webglcontextlost` → hiện poster của cảnh hiện tại; `webglcontextrestored` → dựng lại tài nguyên.
- Kích thước: đổi theo `ResizeObserver` của canvas, có debounce 100 ms; không đổi kích thước canvas khi thanh địa chỉ mobile co giãn (dùng `lvh` cho canvas).

### 9.7 Bầy hạt (Swarm)

**Dữ liệu trên GPU**

- `N` hạt theo hạng máy (§9.10). Thứ tự hạt được xáo ngẫu nhiên từ đầu, nên `geometry.setDrawRange(0, n)` với `n < N` luôn cho một mẫu đều của mọi hình: governor giảm số hạt mà không lộ lỗ.
- Attribute: `aIndex` (float), `aSeed` (vec4 ngẫu nhiên [0, 1)), `aRole` (0 = hạt máy, 1 = hạt "bạn"; khoảng 3% là hạt "bạn"). Thêm `position` giả (three cần) và đặt `points.frustumCulled = false`.
- **Texture form**: `DataTexture` RGBA16F (`HalfFloatType`), rộng 1024, cao `rowsPerForm × số form`, `NearestFilter`, không mipmap. Mỗi form chiếm `rowsPerForm = ceil(N / 1024)` hàng. Kênh `xyz` là toạ độ, kênh `w = id + độ sáng` (id là số nguyên ≥ 0: cụm, lớp, năm…; độ sáng ∈ [0, 0.999]; tách bằng `floor` và `fract`).
- **Texture hậu nghiệm** `uPost`: RGBA32F, rộng 81 (lưới θ từ −4 tới 4, bước 0.1), cao = số bước của `ENGINE_RUN` (kể cả prior). Kênh R = mật độ chia cho `ENGINE_RUN.peak`, G = CDF.
- Mỗi khung chỉ đổi **uniform**. Không upload buffer, không tạo material mới khi đang cuộn.

**Material**

```ts
new ShaderMaterial({
  vertexShader, fragmentShader,
  uniforms: {
    uForms: { value: formsTexture }, uRowsPerForm: { value: rows },
    uFormA: { value: 0 }, uFormB: { value: 1 }, uMorph: { value: 0 }, uStagger: { value: 0.35 },
    uTime: { value: 0 }, uTurb: { value: 0.12 }, uSize: { value: 2.4 }, uDpr: { value: 1 },
    uPointer: { value: new Vector3(1e3, 0, 0) }, uPointerR: { value: 0.9 }, uPointerK: { value: 0.35 },
    uPost: { value: posteriorTexture }, uPostRows: { value: new Vector2(0, 0) }, uPostMix: { value: 0 },
    uFocus: { value: 10 }, uBlur: { value: 0 }, uHighlight: { value: -1 },
    uCool: { value: new Vector3(0.671, 0.843, 0.992) },   // #abd7fd dạng sRGB thô
    uWarm: { value: new Vector3(0.988, 0.886, 0.675) },   // #fce2ac
    uAdditive: { value: 1 }, uFade: { value: 1 },
  },
  transparent: true, depthTest: false, depthWrite: false,
  blending: CustomBlending, blendEquation: AddEquation,
  blendSrc: OneFactor, blendDst: OneMinusSrcAlphaFactor,   // premultiplied alpha
});
```

Màu truyền dạng `vec3` sRGB thô và **không** include `colorspace_fragment`, để màu hạt khớp đúng màu CSS cạnh nó.

**Vertex shader (khung sườn)**

```glsl
// swarm.vert.glsl — three tự thêm #version 300 es và các define attribute/varying
uniform sampler2D uForms;  uniform float uRowsPerForm;
uniform int uFormA;        uniform int uFormB;
uniform float uMorph;      uniform float uStagger;
uniform float uTime;       uniform float uTurb;
uniform float uSize;       uniform float uDpr;
uniform vec3 uPointer;     uniform float uPointerR;  uniform float uPointerK;
uniform sampler2D uPost;   uniform vec2 uPostRows;   uniform float uPostMix;
uniform float uFocus;      uniform float uBlur;      uniform float uHighlight;
uniform vec3 uCool;        uniform vec3 uWarm;

attribute float aIndex;  attribute vec4 aSeed;  attribute float aRole;
varying vec3 vColor;     varying float vAlpha;

const int FORM_POSTERIOR = 1;

vec4 baked(int form) {
  ivec2 uv = ivec2(int(mod(aIndex, 1024.0)), int(floor(aIndex / 1024.0) + float(form) * uRowsPerForm));
  return texelFetch(uForms, uv, 0);
}

vec2 post(int col) {   // (mật độ, CDF) nội suy giữa hai bước của engine
  vec2 a = texelFetch(uPost, ivec2(col, int(uPostRows.x)), 0).rg;
  vec2 b = texelFetch(uPost, ivec2(col, int(uPostRows.y)), 0).rg;
  return mix(a, b, uPostMix);
}

// Lấy mẫu ngược theo CDF hậu nghiệm THẬT của engine: tìm nhị phân 7 bước trên 81 ô.
vec4 posterior() {
  int lo = 0; int hi = 80;
  for (int k = 0; k < 7; k++) {
    int mid = (lo + hi) / 2;
    if (post(mid).y < aSeed.x) lo = mid + 1; else hi = mid;
  }
  float theta = -4.0 + float(lo) * 0.1 + (aSeed.w - 0.5) * 0.1;
  float h = post(lo).x;
  vec3 p = vec3(theta * 1.4, aSeed.y * h * 3.2, (aSeed.z - 0.5) * 1.2 * (1.0 - 0.6 * h));
  return vec4(p, 0.55 + 0.4 * h);
}

vec4 formAt(int f) { return f == FORM_POSTERIOR ? posterior() : baked(f); }

// Trường xoáy rẻ (Tier B/C). Tier A CÓ THỂ thay bằng curl noise thật.
vec3 flow(vec3 p, float t) {
  return 0.5 * vec3(sin(p.y * 1.7 + t * 0.9) + sin(p.z * 0.8 - t * 0.6),
                    sin(p.z * 1.3 + t * 0.7) + sin(p.x * 0.9 + t * 0.5),
                    sin(p.x * 1.5 - t * 0.8) + sin(p.y * 0.7 + t * 0.4));
}

void main() {
  vec4 A = formAt(uFormA);
  vec4 B = formAt(uFormB);
  float t = clamp((uMorph - aSeed.x * uStagger) / (1.0 - uStagger), 0.0, 1.0);
  t = t * t * (3.0 - 2.0 * t);                                  // mỗi hạt khởi hành lệch nhau một chút
  vec3 p = mix(A.xyz, B.xyz, t);
  float swirl = uTurb + sin(3.14159 * t) * 0.6;                 // xoáy mạnh nhất ở giữa lúc morph
  p += flow(p * 0.55 + aSeed.w * 3.0, uTime * 0.35) * swirl * (0.4 + 0.6 * aSeed.y);

  vec3 d = p - uPointer;                                        // dạt ra khi con trỏ đi qua
  float r = length(d);
  p += (r > 1e-4 ? d / r : vec3(0.0)) * uPointerK * (1.0 - smoothstep(0.0, uPointerR, r));

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float depth = -mv.z;
  float coc = abs(depth - uFocus) * uBlur;                      // DOF rẻ: xa tiêu cự thì to và mờ
  float size = uSize * uDpr * (0.7 + 0.6 * aSeed.y) * (aRole > 0.5 ? 1.6 : 1.0) * (1.0 + coc) * (10.0 / depth);
  gl_PointSize = min(size, 28.0 * uDpr);                        // chặn kích thước: chống bùng fill-rate
  float near = smoothstep(0.4, 1.6, depth);                     // hạt sát camera mờ đi (bắt buộc cho đường hầm)

  float lightA = fract(A.w), lightB = fract(B.w);
  float idB = floor(B.w);
  float focus = (uHighlight < 0.0 || abs(idB - uHighlight) < 0.5) ? 1.0 : 0.35;
  vAlpha = mix(lightA, lightB, t) * near * focus / (1.0 + coc * coc);
  vColor = mix(uCool, uWarm, aRole);
}
```

**Fragment shader**

```glsl
// swarm.frag.glsl
uniform float uAdditive;   // 1 = cộng sáng (Night), 0 = phủ mực (Day)
uniform float uFade;       // tắt cả bầy (trước khi chuyển trang)
varying vec3 vColor;  varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d2 = dot(c, c);
  if (d2 > 0.25) discard;
  float a = (1.0 - smoothstep(0.0, 0.25, d2)) * vAlpha * uFade;
  // premultiplied: alpha ra = a·(1 − additive). additive = 1 là cộng sáng thuần; 0 là phủ bình thường.
  gl_FragColor = vec4(vColor * a, a * (1.0 - uAdditive));
}
```

Mẹo blend này cho phép chuyển mượt từ "ánh sáng trên nền đêm" sang "mực trên giấy" chỉ bằng một uniform, không phải đổi blend mode giữa chừng.

### 9.8 Worker tính toạ độ các form

- Tạo bằng `new Worker(new URL('./swarm/bake.worker.ts', import.meta.url), { type: 'module' })`. Vite xuất worker thành file cùng origin, hợp với CSP `worker-src 'self'`. **Cấm** worker `blob:` hoặc inline.
- Đầu vào: `{ n, seed, rowsPerForm, forms: FormSpec[], data }`, trong đó `data` gồm số bài theo năm và theo họ đề, hồ sơ chủ đề, 13 câu của `ENGINE_RUN`, `MARK_PATH`, `MARK_DOT`, nét vẽ của bốn bài thử.
- Đầu ra: `Uint16Array` (half float), chuyển bằng transfer, không copy.
- Tất định: dùng `mulberry32(seed)`. Mỗi lần ghé trang đều ra cùng một hình.
- Ngân sách: dưới 120 ms trên điện thoại tầm trung cho 18 000 hạt × 14 form. Nếu worker lỗi: tính trên main thread theo từng mẻ nhỏ, nhường luồng bằng `scheduler.yield()` (fallback `setTimeout(0)`).
- Chuyển float sang half: `DataUtils.toHalfFloat` của three (import có tên để tree-shake) hoặc hàm tự viết.
- Lấy mẫu nét logo: `MARK_PATH` chỉ có lệnh `M`, `C`, `c` và một đoạn thẳng. Worker không có DOM nên tự lấy mẫu đường Bézier bậc ba theo độ dài cung (chia mỗi đoạn 200 khúc, rồi phân bố hạt đều theo độ dài).

### 9.9 Camera

- Mỗi cảnh định nghĩa hàm thuần `cameraAt(p, aspect) → { position, target, fov, roll }`.
- Trong cửa sổ morph giữa hai cảnh: nội suy giữa `cameraAt(1)` của cảnh trước và `cameraAt(0)` của cảnh sau bằng `EASE.inOut`, rồi đuổi theo bằng damping λ = 6. Damping làm mềm mọi góc gãy.
- **Bố cục lệch tâm**: dùng `camera.setViewOffset(...)` dịch khung nhìn để trọng tâm hình nằm ở một phần ba không có chữ (theo `textSide`, lệch khoảng 18–22% chiều rộng). Dịch frustum không làm méo phối cảnh như dịch camera.
- Lắc nhẹ khi đứng yên: ±0.6° bằng nhiễu tần số thấp (thuộc ambient "hạt thở", dừng khi Pause motion).
- Parallax theo con trỏ (chỉ con trỏ mịn): lệch tối đa 0.15 đơn vị, λ = 4.
- Điện thoại dọc: lùi camera khoảng 1.35 lần và căn giữa; FOV 42°.

Giá trị khởi điểm (mọi form đặt quanh gốc toạ độ; chỉnh bằng mắt):

| Cảnh | Camera | Nhìn vào | FOV |
|---|---|---|---|
| `top` | (2.0, 0.6, 9.5), góc ba phần tư | (0, 0, 0) | 35° |
| `how-it-works` | chính diện, hơi cao: (0, 1.4, 11.5) | (0, 1.3, 0) | 32° |
| `try` | (−1.0, 0.3, 8.5) | (0, 0, 0) | 35° |
| `why` | xoay ngang ~28°, cúi ~12°: (6.0, 3.0, 9.0) | (0, 0, −1.5) | 35° |
| `tutor` | lùi xa: (0, 0, 13) | (0, 0, 0) | 40° |
| `map` | quỹ đạo bán kính 11 quanh gốc, góc 0° → 110° theo p | (0, 0, 0) | 35° |
| `archive` | bay dọc trục z trong đường hầm, từ z = +4 tới z = −84 | điểm phía trước 6 đơn vị | 50° |
| `arena` | nhìn chéo xuống sân: (0, 6.5, 10.5) | (0, 0, 0) | 35° |
| `plans`, `faq` | (0, 0, 14) | (0, 0, 0) | 35° |
| `begin` | (0, 0, 9) | (0, 0, 0) | 30° |

### 9.10 Hạng máy và governor

| Hạng | Điều kiện | Số hạt | DPR tối đa | DOF | Đường (Lines) |
|---|---|---|---|---|---|
| A | con trỏ mịn, ≥ 8 lõi CPU, `deviceMemory` ≥ 8 (nếu đọc được) | 80 000 | 2 | có | đầy đủ |
| B | máy tính còn lại | 40 000 | 1.5 | có | đầy đủ |
| C | con trỏ thô (điện thoại, tablet) | 18 000 | 1.5 (1.25 nếu màn hẹp hơn 400px) | không | rút gọn |
| D | không có WebGL2; renderer phần mềm (SwiftShader, llvmpipe); `saveData`; reduced motion | 0 | — | — | — |

Hạng D dùng poster tĩnh của từng cảnh (§14.4).

```ts
// director/quality.ts (khung sườn)
export function detectTier(forceGl = false): Tier {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return 'D';
  if ((navigator as { connection?: { saveData?: boolean } }).connection?.saveData) return 'D';
  const probe = document.createElement('canvas').getContext('webgl2');
  if (!probe) return 'D';
  const info = probe.getExtension('WEBGL_debug_renderer_info');
  const name = info ? String(probe.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
  probe.getExtension('WEBGL_lose_context')?.loseContext();
  if (!forceGl && /swiftshader|llvmpipe|software|basic render/i.test(name)) return 'D';
  if (matchMedia('(pointer: coarse)').matches) return 'C';
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as { deviceMemory?: number }).deviceMemory ?? 8;
  return cores >= 8 && memory >= 8 ? 'A' : 'B';
}
```

**Governor** (tự hạ, tự nâng chất lượng):

- Đo trung bình trượt của khoảng cách giữa các khung (`dt`).
- Trung bình > 19 ms suốt 40 khung liền: hạ một bậc. Thứ tự hạ: số hạt × 0.7, rồi DPR − 0.25, rồi tắt DOF, rồi giảm Lines.
- Trung bình < 12 ms suốt 240 khung và đang dưới mức ban đầu: nâng lại một bậc.
- Tối đa 4 lần đổi mỗi phiên, có trễ (hysteresis) để không dao động.
- `?debug=perf` hiện HUD: hạng, số hạt, DPR, frame time p50/p95.

### 9.11 Danh sách form

| Form | Cảnh | Hình | Cách tạo | `w` = id + độ sáng |
|---|---|---|---|---|
| `cloud` | `top` | đám mây Gauss 3D không đẳng hướng, σ = (1.7, 1.1, 1.3), lõi dày, rìa thưa | worker | độ sáng giảm theo bán kính |
| `posterior` | `how-it-works` | hậu nghiệm thật của engine | shader (`uPost`) | — |
| `figure-algebra` | `try` | các đường tròn đồng tâm tại (5, −3) | worker | độ sáng dọc nét |
| `figure-geometry` | `try` | đường tròn, dây cung dài 10, đoạn vuông góc từ tâm dài 5, bán kính tới đầu dây | worker | id nét |
| `figure-combinatorics` | `try` | 8 phần tử {2…9} và lưới 16 × 16 = 256 tập con | worker | id ô |
| `figure-number` | `try` | cây thừa số 2024 = 2³ · 11 · 23 và dãy 1…23 | worker | id nút |
| `layers` | `why` | 3 mặt phẳng hạt xếp chồng theo trục z | worker | id lớp |
| `quiet` | `tutor` | sương mỏng trải rộng, rất thưa | worker | độ sáng thấp |
| `constellation` | `map` | 4 cụm ở 4 đỉnh một tứ diện | worker | id chủ đề |
| `tunnel` | `archive` | 68 vòng năm dọc trục z | worker | id năm (0 = 1959) |
| `banks` | `archive` (exit) | 4 cột theo họ đề | worker | id họ đề |
| `track` | `arena` | sân đua hình sân vận động, 6 làn | worker | id làn |
| `grid` | `plans`, `faq` | lưới chấm như giấy kẻ ô | worker | — |
| `mark` | `begin` | chữ "e" của logo và chấm tròn | worker (`MARK_PATH`, `MARK_DOT`) | vị trí dọc nét |

Thứ tự trong bảng là chỉ số form (`cloud` = 0, `posterior` = 1, …). `posterior` được tính trong shader nhưng vẫn giữ một khối hàng trống trong texture, để chỉ số form luôn trùng chỉ số khối hàng: tốn chưa tới 1 MB, đổi lại shader không cần bảng tra.

### 9.12 Gắn nhãn DOM vào điểm 3D

Nhãn của lớp, cụm chủ đề, mốc năm là DOM thật (đọc được, chọn được), nhưng phải bám theo điểm 3D:

- Mỗi khung, với tối đa 12 nhãn đang thấy: `v.copy(world).project(camera)` → toạ độ màn hình → ghi `el.style.transform = translate3d(x, y, 0)` qua ref.
- Ẩn nhãn khi điểm nằm sau camera (`v.z > 1`) hoặc ra ngoài khung.
- Không qua React state. Không đọc layout của nhãn trong vòng lặp (kích thước nhãn đo một lần khi mount).

---

## 10. Kịch bản từng cảnh

Mỗi cảnh viết theo cùng một khuôn: **Mục đích · Copy · Bố cục · Bầy hạt và camera · Timeline · Tương tác · Dữ liệu · Điện thoại · Reduced motion · Xong khi**. Toàn bộ copy tiếng Anh dưới đây đưa vào `copy.ts`.

### 10.1 Cảnh 1 · `top` · Arrival — «Nhiễu»

**Mục đích.** Trong 5 giây: người xem hiểu sản phẩm làm gì, khác gì, và thấy thế giới hạt đang sống.

**Copy.**

- H1, dòng 1: `Most practice apps guess your level.`
- H1, dòng 2: `CalculixHub measures it.` (từ khoá `measures` weight 600, có ngoặc đo)
- Phương án thay thế nếu không muốn so sánh với app khác: `Your level, measured. Not guessed.`
- Lead: `Placement built on item response theory, the maths behind computer-adaptive exams. You get your level with its margin of error, then problems from AMC to IMO that fit it.`
- Nút chính: `Find my level` → `onRegister()`.
- Nút phụ: `Watch it work` → bay tới `#how-it-works`.
- Dòng số liệu (mono): `2,195 past problems · 233 real exams · 1959–2026` (từ `ARCHIVE_FIGURES`, định dạng `toLocaleString('en-US')`).
- HUD dưới-trái: `θ  ?` · `±  ∞` · `Q  0`.

**Bố cục.** Chữ ở cột 1–7. Đám mây chiếm hai phần ba bên phải và tràn ra mép.

**Bầy hạt và camera.** Form `cloud`. Hạt "thở" (biên độ xoáy 0.12, chu kỳ khoảng 7 giây). Con trỏ đi qua thì hạt dạt ra (bán kính 0.9, lực 0.35). Hạt "bạn" (ấm) nằm rải rác trong đám mây: bạn đang ở đâu đó trong nhiễu.

**Timeline vào trang (theo thời gian, chạy một lần).**

T là lúc font sẵn sàng (chờ tối đa 900 ms kể từ khi trang mở).

| Thời điểm | Việc |
|---|---|
| 0 ms | khung boot: nền đêm và poster đám mây tĩnh bằng CSS |
| T | H1 dòng 1 trồi lên theo từ, stagger 40 ms |
| T + 250 ms | H1 dòng 2 trồi lên |
| T + 450 ms | lead hiện |
| T + 550 ms | hai nút hiện (vẫn bấm được ngay từ khung đầu tiên, trước cả khi hiện xong) |
| T + 700 ms | dòng số liệu decode |
| T + 900 ms | `measures` đổi weight 300 → 600 (transition 400 ms) và ngoặc đo vẽ ra (600 ms) |
| khoảng 1,2–2,5 s | canvas sẵn sàng: crossfade poster → canvas 800 ms; hạt co tụ từ bán kính 1,6 lần về đám mây trong 2 s (`EASE.out`) |

**Timeline theo cuộn** (p của hero chạy từ 0 tới 100svh cuộn):

| p | Việc |
|---|---|
| 0 → 0.55 | H1 dịch lên −12svh; opacity 1 → 0 trong khoảng p 0.15 → 0.55 |
| 0.3 → 0.6 | lead, nút, số liệu rời đi (`EASE.in`) |
| 0.5 → 1 | morph `cloud → posterior` (bước prior của engine); camera từ góc ba phần tư về chính diện |

**CÓ THỂ (Giai đoạn 6).** Từ `guess` tan thành hạt khi bắt đầu cuộn: vẽ từ đó lên canvas 2D ẩn bằng đúng font, lấy mẫu điểm ảnh đặc, gán làm điểm xuất phát cho khoảng 600 hạt; chữ DOM mờ đi cùng lúc.

**Điện thoại.** Cỡ H1 theo clamp; đám mây ở nửa trên; chữ ở nửa dưới trên scrim. Không có con trỏ thì không dạt hạt.

**Reduced motion.** Poster tĩnh của đám mây; chữ hiện sẵn.

**Xong khi.** Phần tử LCP là H1, không phải canvas. CLS = 0. Hai nút bấm được trước khi three.js tải. Rê chuột trên đám mây vẫn 60 fps ở Tier B.

### 10.2 Cảnh 2 · `how-it-works` · Collapse — «Nhiễu co lại»

**Mục đích.** Chứng minh engine đo thật, bằng chính trạng thái của engine. Đây là cảnh quan trọng nhất trang.

**Dữ liệu.** `ENGINE_RUN`: một lần placement thật, engine IRT thật, học sinh giả lập θ = 1.10, seed 5. Hiện tại cho 13 câu, kết thúc ở θ̂ = 0.92 ± 0.31, bậc Advanced, dừng vì `precision`. Năm câu đầu đúng (θ̂ lên 1.41, chạm Olympiad), câu 6 và 7 sai (θ̂ về 0.82), sau đó ổn định dần. **Không gõ tay các số này**: đọc từ `ENGINE_RUN`, vì chúng đổi khi ngân hàng câu đổi.

**Bố cục.** Chữ ở cột 1–4, sticky. Đồ thị hạt ở giữa-phải. Dưới đồ thị là trục θ từ −4 tới 4 chia bốn dải bậc theo `TIER_BANDS`, nhãn `FOUNDATION · INTERMEDIATE · ADVANCED · OLYMPIAD`. Thẻ câu hỏi bay vào từ chiều sâu phía trên đồ thị.

**Ánh xạ cuộn.** Dải act (p 0.12 → 0.86) chia đều cho K = `ENGINE_RUN.steps.length − 1` câu. Trong khoảng của mỗi câu:

| Phần của khoảng | Việc |
|---|---|
| 0 → 35% | thẻ câu hỏi bay vào từ sâu (z −6 → 0), `EASE.out` |
| 35 → 55% | dấu ✓ (`--right`) hoặc ✗ (`--slip`) đóng lên thẻ |
| 55 → 100% | đường cong morph từ bước k−1 sang k (`uPostRows = (k−1, k)`, `uPostMix` 0 → 1) |

**Bầy hạt và camera.** Form `posterior`, tính trong shader (§9.7): mỗi hạt lấy mẫu ngược theo CDF hậu nghiệm thật, nên đám hạt là phân phối của engine chứ không phải hình vẽ. Hạt lấp dưới đường cong như cát. Hạt "bạn" (ấm) tụ quanh θ̂ hiện tại. Mỗi câu trả lời phát một gợn sóng chạy dọc trục từ vị trí độ khó của câu đó: đúng thì gợn lạnh, sai thì gợn đỏ; biên độ 0.15, 450 ms. Gợn chỉ phát khi cuộn tới, không phát lại khi tua ngược.

**Readout** (trong cảnh và HUD): `QUESTIONS 7` · `LEVEL Advanced` · `θ̂ 0.82` · `± 0.44` · thanh `HOW SURE` lấy từ `certainty(ENGINE_RUN, k)`. Số đổi bằng decode ngắn 240 ms.

**Thẻ câu hỏi.** Ví dụ `Q4 · AIME 2025 · Algebra · Right`: lấy contest, năm, số bài từ `step.item` (tra id trong catalog), chủ đề từ item, đúng/sai từ `step.correct`.

**Copy theo nhịp** (đổi theo khoảng p, crossfade 240 ms):

1. Bước prior: `Before your first answer, every level is possible.`
2. Các câu đúng đầu tiên: `Right answers push the estimate up.`
3. Từ câu sai đầu tiên: `Misses pull it back. Both make it surer.`
4. Các câu sau: `Each next question is the one it can least predict.`
5. Kết: `It stops when it is sure: {K} questions, {tier}, ±{sem}.` (điền từ `ENGINE_RUN`)

H2 của cảnh: `Every answer narrows it down.`

**Lock-on** (p 0.86 → 0.95, khoảnh khắc chữ ký số 2):

- Ngoặc đo ấm `[θ̂ − SE, θ̂ + SE]` bật vào vị trí trên trục bằng `SPRING.lock`.
- Hạt trong dải sáng ấm lên; hạt ngoài dải mờ xuống 40%.
- Một vòng sáng (`Pulse`) lan ra từ θ̂ đúng một lần, 700 ms.
- Readout chuyển `LOCKED` (mono, `--sun-strong`).
- Một vạch mờ hiện ở θ = 1.10 kèm chú thích nhỏ: `True level of the simulated student. The engine never sees it.` Người xem tự thấy ước lượng cuối bao được giá trị thật.
- Nút phụ hiện: `Find your own level`.

**Trung thực.** Không vẽ "gai nhọn" giả để trông ấn tượng. "Khoá" là quyết định dừng của engine, đường cong cuối giữ đúng độ rộng ± 0.31.

**Tương tác.** Reticle trên đồ thị hiển thị `θ 0.87 · density 0.62`, tra từ hàng hậu nghiệm đang hiển thị.

**Điện thoại.** 220svh; chữ nhịp ở nửa dưới; thẻ câu hỏi gọn một dòng; bỏ reticle.

**Reduced motion.** Bốn hình SVG tĩnh vẽ trực tiếp từ `ENGINE_RUN` (prior, sau 5 câu đúng, sau câu sai, lúc dừng) xếp lưới 2 × 2, kèm đủ 5 câu nhịp.

**Xong khi.** Unit test: CDF trong texture khớp `weights` của từng bước (sai số < 1e-3). Tua ngược cho đúng hình. Không khung nào > 16,7 ms khi cuộn qua cảnh trên Tier B.

### 10.3 Cảnh 3 · `try` · Try one — «Chạm vào sản phẩm»

**Mục đích.** Thử một bài thật, không cần tài khoản.

**Dữ liệu.** Bốn bài thật trong `topicRooms.ts`, mỗi bài có đề, 5 lựa chọn, đáp án, gợi ý, lời giải ngắn:

| Tab | Bài | Hình bằng hạt |
|---|---|---|
| Algebra | AMC 12B 2013 #6: x² + y² = 10x − 6y − 34, tìm x + y | các đường tròn đồng tâm tại (5, −3); khi trả lời đúng, bán kính co về 0 thành một điểm, vì (x − 5)² + (y + 3)² = 0 |
| Geometry | AMC 12B 2018 #4: dây cung dài 10, cách tâm 5, tìm diện tích | đường tròn, dây cung, đoạn vuông góc từ tâm, bán kính tới đầu dây; đúng thì tam giác vuông 5–5–r sáng lên |
| Combinatorics | AMC 12B 2018 #5: số tập con của {2,…,9} chứa ít nhất một số nguyên tố | 8 phần tử (4 số nguyên tố sáng hơn) và lưới 16 × 16 = 256 tập con; đúng thì 16 ô không chứa số nguyên tố tắt, còn 240 |
| Number Theory | AMC 12A 2024 #4: n nhỏ nhất để n! chia hết cho 2024 | cây thừa số 2024 = 2³ · 11 · 23, rồi dãy 1…23; đúng thì 23 sáng lên |

**Copy.** H2 `Try one. No account needed.` · nút `Hint` · đúng: `Right. {reason}` · sai: `Not this one. Want a hint?` · cuối thẻ: `Every problem in the archive works like this.`

**Bố cục.** Thẻ đề bài ở cột 7–12 (nền `--n-2`, đề bằng Newsreader, công thức KaTeX). Hình hạt ở bên trái.

**Bầy hạt.** Form `figure-<topic>`. Đổi tab thì morph giữa bốn hình trong 600 ms theo thời gian (vì đây là tương tác, không gắn với cuộn).

**Tương tác.**

- Tab là `role="tablist"`; đáp án là radio group; Enter để kiểm tra; kết quả đọc qua `aria-live="polite"`.
- Đúng: hình "tự giải" (nét phụ vẽ bằng hạt chạy dọc nét), readout ấm ✓.
- Sai: lựa chọn bị gạch, bầy hạt rung nhẹ 2px trong 200 ms (không lắc cả trang), gợi ý mở ra bằng animation chiều cao.
- Analytics: `landing_try_answer { topic, correct }`.

**Điện thoại.** Hình ở trên (40svh), thẻ đề bài full width bên dưới.

**Reduced motion.** Hình SVG tĩnh của từng bài; không rung.

**Xong khi.** Chấm đúng/sai theo `answer`. Test `archiveSamples` vẫn xanh. KaTeX chỉ tải khi cảnh cách màn hình không quá 1,5 lần chiều cao khung.

### 10.4 Cảnh 4 · `why` · Why you missed — «Bóc lớp»

**Mục đích.** Cho thấy CalculixHub phân biệt **thiếu phương pháp** với **lỗi thực thi**, đúng như `analyzeErrorPatterns()` làm: không hứa nhiều hơn engine thật sự làm.

**Dữ liệu.** Một người học mẫu, có nhãn `Example learner`: mastery Algebra 82, Geometry 48, Combinatorics 64, Number Theory 71; accuracy tổng 76%; đã có lượt làm. Chạy **chính hàm** `analyzeErrorPatterns()` trên dữ liệu này và hiển thị `diagnosis` cùng `remediation` nó trả về; không viết tay chẩn đoán. Với số liệu trên, Geometry (48) và Combinatorics (64) dưới 70, accuracy 76 ≥ 70, nên cả hai được xếp `computational`; Geometry mức `moderate`.

**Copy.**

- H2: `When you miss, it tells you why.`
- Lead: `A missing method and a careless slip need different practice. CalculixHub reads your mastery in each topic against your overall accuracy to tell them apart.`
- Nhãn ba lớp: `Your answers` · `Mastery by topic` · `Overall accuracy`.
- Thẻ kết luận: `Geometry · Execution slips, not a missing method` + `diagnosis` + `remediation`.

**Bầy hạt (form `layers`).** Ba mặt phẳng hạt xếp chồng theo trục z: (1) lưới chấm đúng/sai, (2) bốn cột mastery theo màu chủ đề, (3) cung tròn 76%.

**Timeline.**

| p | Việc |
|---|---|
| 0.12 → 0.45 | ba lớp tách ra theo z (exploded view); camera xoay ngang ~28°, cúi ~12°; nhãn DOM bám theo từng lớp (§9.12) |
| 0.45 → 0.70 | một tia quét (mặt phẳng sáng `--ion`, rất mảnh) đi xuyên qua; lớp nào bị chạm thì sáng lên |
| 0.70 → 0.88 | các lớp gập lại làm một; cột Geometry sáng ấm; thẻ kết luận hiện (`SPRING.ui`) |

**Điện thoại.** Hai lớp (bỏ lớp `Your answers`); camera xoay ít hơn.

**Reduced motion.** Sơ đồ tĩnh ba lớp đặt cạnh nhau và thẻ kết luận.

**Xong khi.** Unit test: nội dung thẻ kết luận trùng output của `analyzeErrorPatterns()` cho người học mẫu.

### 10.5 Cảnh 5 · `tutor` · Tutor — «Hỏi trước khi chỉ»

**Mục đích.** Tutor AI gợi mở, không đưa đáp án.

**Copy.**

- H2: `Stuck? The tutor asks before it tells.`
- Nhãn: `Example conversation`
- Chú thích: `The live tutor runs on Google's Gemini with your own free key, set up in Settings.`

**Hội thoại mẫu** (dùng chính bài Algebra của cảnh `try`, dừng trước đáp án):

1. Student: `I don't see where to start.`
2. Tutor: `What happens if you bring every term to one side?`
3. Student: `x² − 10x + y² + 6y + 34 = 0`
4. Tutor: `Good. Can you write the x-terms as part of a perfect square?`
5. Student: `(x − 5)² − 25 …`
6. Tutor: `Now the y-terms. When can a sum of two squares be zero?`

**Bố cục.** Khung chat ở bên phải, rộng tối đa 440px. Bầy hạt chuyển sang form `quiet` (sương mỏng, rất chậm) để nhường sân khấu cho giao diện.

**Timeline.** Sáu tin nhắn chia đều dải act. Mỗi tin trượt lên 12px và hiện (`SPRING.ui`). Tin của tutor có ba chấm "đang gõ" 400 ms rồi chữ hiện theo cụm từ, không gõ từng ký tự. Công thức render sẵn bằng KaTeX.

**Tương tác.** Một nút thật ở cuối: `Try this problem` → bay về `#try` và chọn tab Algebra. Không đặt nút trông bấm được mà không làm gì.

**Reduced motion.** Cả hội thoại hiện sẵn.

### 10.6 Cảnh 6 · `map` · Map — «Chòm sao bốn chủ đề»

**Mục đích.** Cho thấy ngân hàng câu có cấu trúc, và placement đi qua cả bốn chủ đề.

**Dữ liệu.** `domainBankProfiles()`: số câu và phân bố độ khó theo chủ đề (`formatDifficulty` để hiển thị). 13 câu của `ENGINE_RUN`, mỗi câu có chủ đề và độ khó.

**Copy.**

- H2: `Four topics. One map of what you know.`
- Lead: `Every problem in the bank sits on this map by topic and difficulty. Placement walks across all four, and practice starts at your level.`
- Nhãn mỗi cụm: tên chủ đề, số câu, khoảng độ khó.

**Bầy hạt (form `constellation`).** Bốn cụm ở bốn đỉnh một tứ diện (bán kính 3.2). Trong mỗi cụm, hạt phân bố theo phân phối độ khó thật: câu khó ở vỏ ngoài và sáng hơn, câu dễ ở lõi. Màu theo chủ đề, pha 30% `--ion` để vẫn là "ánh sáng". Một đường ấm (Lines) nối 13 câu của placement theo đúng thứ tự, mỗi điểm nằm trong cụm của câu đó, ở bán kính theo độ khó. Một hạt "bạn" chạy dọc đường này.

**Camera.** Quỹ đạo 0° → 110° theo p. Dải act chia bốn đoạn; mỗi đoạn camera hướng về một cụm và nhãn cụm đó sáng.

**Tương tác.** Danh sách chủ đề (DOM) bên trái: hover hoặc focus một chủ đề thì cụm tương ứng sáng, các cụm khác mờ (`uHighlight`).

**Điện thoại.** Quỹ đạo 60°; danh sách chủ đề thành hàng chip.

**Reduced motion.** Hình 2D tĩnh bốn cụm và đường 13 câu.

### 10.7 Cảnh 7 · `archive` · Archive — «Đường hầm thời gian»

**Mục đích.** Cho cảm nhận quy mô kho đề, như đi xuyên lịch sử các kỳ thi.

**Dữ liệu.** Từ `catalog.json`: số bài của từng năm 1959–2026 (đủ 68 năm, nhiều nhất 2020 với 139 bài), tỷ lệ họ đề mỗi năm, năm đầu tiên mỗi họ đề có trong kho (tính từ dữ liệu, không ghi tay lịch sử). Từ `ARCHIVE_FIGURES`: tổng và số liệu bốn họ.

**Copy.**

- H2: `Every past paper since 1959.`
- Lead: `2,195 problems from 233 exams: AMC 12, AIME, USAMO and IMO. Take a whole paper, or one problem at a time.`
- Bốn bộ đếm: `AMC 12 · 27 papers · 580 problems` · `AIME · 39 · 550` · `USAMO family · 96 · 540` · `IMO · 71 · 525`.
- Mốc khi bay qua: `First {family} paper in the archive: {year}`.

**Bầy hạt (form `tunnel`).** 68 vòng tròn dọc trục z, mỗi năm một vòng, cách nhau 1.2 đơn vị, bán kính 3. Số hạt mỗi vòng tỷ lệ với số bài năm đó. Độ sáng và cỡ hạt theo họ đề, tăng dần theo độ khó: AMC 12 mờ và nhỏ nhất, IMO sáng nhất.

**Camera.** Bay dọc trục từ 1959 tới 2026 theo p (dải act), `EASE.inOut`. Nghiêng (roll) ±4° theo vận tốc cuộn, damped. Năm ở vị trí camera hiển thị bằng số mono rất lớn (`clamp(5rem, 16vw, 14rem)`, opacity 12%) ở giữa màn hình; đổi năm thì chữ số decode.

**Exit (p 0.86 → 1).** Đường hầm mở ra thành bốn cột theo họ đề (form `banks`), cao theo số bài. Bốn thẻ bộ đếm hiện, đếm lên 900 ms (`EASE.outSoft`).

**Chống giật (bắt buộc).** Hạt sát camera mờ dần (đã có `near` trong shader) và kích thước hạt bị chặn; nếu không, fill-rate bùng nổ khi camera ở trong đường hầm.

**Điện thoại.** 170svh; không roll; ít hạt mỗi vòng hơn.

**Reduced motion.** Biểu đồ cột SVG tĩnh: số bài theo năm, và bốn thẻ số.

### 10.8 Cảnh 8 · `arena` · Arena — «Cuộc thi mỗi tuần»

**Mục đích.** Động lực và cộng đồng.

**Copy.**

- H2: `A new contest every week.`
- Lead: `Ten fresh problems each week, balanced across the four topics, with every answer checked in code. Three tries per question. Rankings by points.`
- Dòng phụ: `Set your contest date and the countdown starts. Pro adds a week-by-week plan up to it.`
- Nhãn bảng xếp hạng: `Example standings`.

**Bầy hạt (form `track`).** Sân đua hình sân vận động, 6 làn. 40–60 "runner" sáng chạy theo thời gian (ambient), tốc độ mỗi runner ngẫu nhiên nhưng cố định; một runner ấm là "You". Phần hạt còn lại dựng vạch làn và khán đài mờ.

**DOM.** Bảng xếp hạng 6 dòng dữ liệu mẫu: thứ hạng cập nhật khi runner vượt nhau, dùng layout animation của Motion (`layout`, `SPRING.ui`). Dòng "You" có viền ấm. Đồng hồ đếm ngược ngày thi mẫu dạng odometer, ví dụ `AMC 12 · 11 weeks`.

**Điện thoại.** Bảng 4 dòng; 24 runner.

**Reduced motion.** Bảng tĩnh; runner đứng yên.

### 10.9 Bình minh: chuyển Night → Day (giữa `arena` và `plans`)

- Section `plans` có 60svh đầu trong suốt làm "vùng bình minh".
- Shader `Dawn` (một quad toàn màn hình, vẽ cuối cùng trên cùng canvas) lộ màu `--d-0` theo mặt nạ lan ra từ vị trí chấm "bạn": `mask = smoothstep(edge, edge + 0.06, distance(uv, you) * 0.9 + noise(uv * 3.0) * 0.25)`, trong đó `edge` chạy theo tiến trình cuộn.
- Cùng lúc: `uAdditive` 1 → 0 (ánh sáng thành mực), màu hạt chuyển về `--d-text` ở opacity 35%, form chuyển sang `grid`.
- Khi mặt nạ phủ kín, section `plans` có nền `--d-0` đặc, canvas **ngủ** cho tới khi cảnh `begin` cách màn hình không quá một chiều cao khung.
- Nav và HUD đổi tông theo `world` bằng crossfade 240 ms.

### 10.10 Cảnh 9 · `plans` · Plans (Day)

**Dữ liệu.** `PLANS`, `PLAN_ORDER`, `dollars`, `monthlyEquivalent`, `yearlySaving`, `TEAM_MIN_SEATS`; trạng thái checkout từ `billingConfig()`.

**Copy.**

- H2: `Free to practise. Pro for the season you're training for.`
- Công tắc: `Monthly` / `Yearly · save {yearlySaving(pro)}%` (hiện là 33%).
- Tên gói, giá, câu mô tả (`audience`) và danh sách tính năng đọc từ `PLANS`; không gõ lại bằng tay. Hiện tại:
- Free: `$0` · `Everything you need to practise seriously.` · nút `Start free`.
- Pro: `$9 / month` hoặc `$72 / year` (hiện kèm `$6 / month` từ `monthlyEquivalent`) · `For the season you are training for something.`
- Team: `$7 per student / month` hoặc `$60 / year` · `For clubs, coaches and schools.` · `From {TEAM_MIN_SEATS} students. Talk to us.`
- Tính năng `planned`: vòng nét đứt và chữ `in the works`.
- Khi `checkout === false`: nút Pro là `Try Pro in the preview`, kèm dòng `Checkout isn't open yet. Every account has Pro's features in a preview.`

**Chuyển động.** Pill của công tắc trượt (`layoutId`, `SPRING.ui`). Giá đổi bằng Odometer. Danh sách tính năng hiện stagger 40 ms một lần. Hover thẻ: nâng 2px, viền đậm hơn bằng pseudo-element đổi opacity.

**Bố cục.** Ba cột từ 1024px. Điện thoại: Pro lên đầu, xếp dọc, không carousel.

**Quy tắc Day.** Không chuyển động theo cuộn ngoài một lần hiện; đây là chỗ để đọc.

### 10.11 Cảnh 10 · `faq` · FAQ (Day)

- Dữ liệu: 8 câu trong `data/faq.ts`, giữ nguyên chữ; câu về giá đọc từ `PLANS`.
- Dùng `<details>`/`<summary>` (mở được kể cả khi không có JS). Animation chiều cao bằng `interpolate-size: allow-keywords` và `::details-content` khi trình duyệt hỗ trợ (`@supports`); fallback bằng Motion.
- Dấu `+` thành `−` bằng cách xoay một nét 90°.
- Link: `Ask in the community` → `/?auth=signup&tab=community` (giữ hành vi hiện tại).

### 10.12 Cảnh 11 · `begin` · Begin — «Hội tụ thành logo»

**Chuyển Day → Night.** Bóng đêm thấm vào từ bốn mép (shader `Dawn` chạy ngược, mặt nạ đi từ mép vào), trong 50svh. Canvas thức dậy trước đó một nhịp.

**Bầy hạt (form `mark`).** Lấy mẫu dọc nét chữ "e" của logo (`MARK_PATH`, độ dày theo `MARK_STROKE` trên hộp 40 × 40) và chấm tròn `MARK_DOT`. Hạt máy hội tụ thành nét; hạt "bạn" hội tụ thành chấm tròn và là thứ sáng ấm nhất trang.

**Timeline.**

| p | Việc |
|---|---|
| 0.10 → 0.60 | hội tụ với stagger lớn (`uStagger` 0.5): hạt về theo từng đợt như đàn chim |
| 0.60 → 0.75 | nét logo "được vẽ": độ sáng chạy dọc nét theo độ dài cung |
| 0.75 | chấm "bạn" bật sáng, một Pulse nhỏ |
| 0.75 → 0.88 | H2, lead, nút vào |

**Copy.** H2 `Find your level.` · Lead `Free account. The placement stops as soon as it is sure.` · nút `Find my level` và `Sign in`.

**Footer.** Nền `--n-0`. Wordmark `calculixhub` cỡ lớn (Geist 300, tracking −0.05em) trồi lên từng chữ cái khi vào (stagger 30 ms, một lần). Link: `Pricing`, `FAQ`, `iPhone preview`, `MacBook preview` (lấy từ `data/footer.ts`), `© 2026 CalculixHub`. Có nút `Pause motion`.

---

## 11. Thành phần UI dùng chung

### 11.1 Nav (thanh điều hướng nổi)

- Một viên nang cách mép trên 16px cộng `env(safe-area-inset-top)`, cao 52px.
- Nền đặc hơi trong: `color-mix(in oklch, var(--n-1) 86%, transparent)`. **Không** dùng `backdrop-filter`: nằm đè lên canvas đang chuyển động thì trình duyệt phải làm mờ lại mỗi khung.
- Nội dung: logo · `How it works` · `Try one` · `Archive` · `Arena` · `Pricing` · `Sign in` · nút `Find my level`.
- Một pill đánh dấu cảnh hiện tại, trượt giữa các link (`layoutId`, `SPRING.ui`).
- Ẩn khi cuộn xuống nhanh hơn 120 px/giây; hiện lại ngay khi cuộn lên (`translateY`, `SPRING.ui`). Không ẩn khi đang có focus hoặc con trỏ nằm trên nav.
- Đổi tông theo `world` của cảnh bên dưới (Night/Day), crossfade 240 ms.
- Điện thoại: logo và nút `Menu`. Menu là một sheet toàn màn hình trượt từ dưới lên, kéo xuống để đóng (spring), khoá Lenis khi mở, trả focus về nút khi đóng.

### 11.2 SceneRuler (thước cảnh, từ 1024px)

- Dải dọc ở mép phải, 11 vạch (mỗi cảnh một vạch, dài ngắn theo ngân sách cuộn). Vạch của cảnh hiện tại sáng; một con trỏ nhỏ chạy theo story time.
- Hover hoặc focus một vạch: hiện tên cảnh. Bấm: bay tới cảnh đó (§9.3).
- Về ngữ nghĩa là `<nav aria-label="Sections">` chứa danh sách link thật.

### 11.3 HUD readout

- Góc dưới-trái: θ, ±, Q. Cập nhật trong cảnh `how-it-works`; các cảnh sau giữ trạng thái cuối (`LOCKED`); ẩn ở thế giới Day.
- Geist Mono 12px, `aria-hidden="true"` (thông tin đã có trong nội dung chính).

### 11.4 Button

- **Chính**: pill màu `--n-text`, chữ `--n-0`, có chấm tròn ấm 6px ở bên trái (gợi chấm của logo). Chấm "thở" nhẹ khi hover.
- **Phụ**: viền 1px `--n-line`, chữ `--n-text`.
- Con trỏ mịn: hút nhẹ về phía con trỏ (tối đa 6px, `SPRING.press`). Nhấn: `scale(0.97)`.
- `:focus-visible`: vòng 2px `--ion-strong`, offset 3px (Day: `--ion-ink`).
- Vùng chạm tối thiểu 44 × 44px.

### 11.5 Reticle (con trỏ đo)

- Chỉ xuất hiện trong stage Night có đồ hoạ, chỉ với con trỏ mịn. **Không** ẩn con trỏ hệ thống.
- Hình: vòng 20px, hai vạch chữ thập 6px, nhãn mono hiển thị toạ độ có nghĩa của cảnh: θ và mật độ ở `how-it-works`, năm ở `archive`, chủ đề ở `map`.
- Bám theo chuột với damping λ = 18, ghi bằng transform.

### 11.6 View transition sang trang đăng ký

1. Bấm `Find my level`: `await AuthFlow.preload()` (đã có `lazyWithPreload` trong `Welcome.tsx`).
2. `uFade` của bầy hạt về 0 trong 200 ms, để hạt tắt chứ không đứng hình trong ảnh chụp chuyển cảnh.
3. `document.startViewTransition(() => flushSync(() => onRegister()))`.
4. Nút được bấm mang `view-transition-name: lx-cta`; khung form đăng ký trong `WelcomeScreen` mang cùng tên, nên nút nở ra thành form (380 ms, `EASE.out`). Phần còn lại crossfade 240 ms.
5. Trình duyệt không hỗ trợ: giữ hành vi hiện tại.

### 11.7 MotionToggle

- Nút `Pause motion` / `Play motion` ở footer và trong menu.
- Dừng ba ambient (hạt thở, runner, chấm thở). Đồ hoạ vẫn đổi theo cuộn vì đó là thao tác của người dùng.
- Lưu lựa chọn vào `localStorage`, bọc `try/catch`.

### 11.8 Các mảnh nhỏ

- **Scrim**: phần tử tĩnh sau mỗi khối chữ, `radial-gradient` từ `--n-0` 80% về trong suốt. Tĩnh nên không tốn chi phí vẽ lại.
- **SplitHeading**: §8.4.
- **Readout**: hiệu ứng decode §8.4, mono, tabular-nums.
- **Odometer**: §8.4.
- **MeasureBracket**: ngoặc đo `├───┤` bằng SVG, rộng bằng từ khoá (đo một lần khi font đã tải), vẽ bằng `stroke-dashoffset` 600 ms đúng một lần.

---

## 12. Responsive, cảm ứng, reduced motion, trợ năng

### 12.1 Breakpoint

| Tên | Chiều rộng | Khác biệt chính |
|---|---|---|
| wide | ≥ 1440px | lưới 12 cột tối đa 1440px, HUD và thước cảnh |
| desktop | 1024–1439px | như wide |
| tablet | 768–1023px | ẩn thước cảnh; nav đầy đủ; ngân sách cuộn desktop |
| phone | < 768px | ngân sách cuộn mobile; camera dọc; Tier C; chữ ở nửa dưới trên scrim; nav thành nút Menu; ẩn HUD |

- Chiều cao stage dùng `svh` (không nhảy khi thanh địa chỉ co giãn). Canvas và nền tràn dùng `lvh`.
- Không phần tử nào rộng hơn màn hình; không cuộn ngang.

### 12.2 Cảm ứng

- Không nội suy cuộn cảm ứng (`syncTouch: false`): giữ quán tính gốc của hệ điều hành.
- Không bắt cử chỉ vuốt ngang trong stage (xung đột với cuộn dọc). Tab và lựa chọn dùng chạm.
- Không có thông tin chỉ hiện khi hover: mọi thứ hover hiện ra cũng phải có bản focus hoặc chạm.
- Không dùng `scroll-snap` trong các cảnh có tiến trình theo cuộn (snap đánh nhau với scrub).

### 12.3 Reduced motion (bản tĩnh đầy đủ)

- Không tạo Lenis. Không tải WebGL (Tier D).
- Mỗi cảnh hiện poster tĩnh (§14.4) hoặc SVG vẽ trực tiếp từ dữ liệu thật (`how-it-works`, `archive`).
- Section không sticky; chiều cao theo nội dung.
- Mọi chữ hiện sẵn. Chỉ còn fade 200 ms cho thay đổi trạng thái (mở FAQ, chọn đáp án).

### 12.4 Trợ năng

- Thứ tự DOM là thứ tự đọc. Mỗi cảnh là `<section aria-labelledby>`. Cả trang một H1.
- Skip link: `Skip to content` và `Skip to pricing`.
- Canvas `aria-hidden="true"`; mọi số liệu quan trọng có trong chữ.
- Tương phản ≥ 4,5:1 kể cả lúc đồ hoạ sáng nhất đi qua sau chữ. Kiểm bằng ảnh chụp khung sáng nhất của từng cảnh.
- `prefers-contrast: more`: scrim đậm hơn, tắt DOF, chữ phụ dùng `--n-text`.
- WCAG 2.2.2: có Pause motion cho chuyển động tự chạy quá 5 giây.
- Focus không bị nav che: `scroll-margin-top: 96px`.
- Bài thử ở cảnh `try` dùng được hoàn toàn bằng bàn phím; kết quả đọc qua `aria-live`.
- Nội dung `lang="en"`. Khi dịch sang tiếng Việt, Geist và Geist Mono đã có subset `vietnamese`.

---

## 13. Tải trang và hiệu năng

### 13.1 Khung đầu tiên

- Trong `index.html`, khung `#boot` của biến thể `landing` đổi thành: nền `#040712` và một poster đám mây bằng 2–3 `radial-gradient` tĩnh, không logo nhấp nháy (hero tự lo phần vào trang).
- `meta[name="theme-color"]` cho landing: `#040712`.
- Chỉ sửa **CSS** inline. Nếu buộc phải sửa **script** inline: cập nhật hash ở `server/security.ts` và `vercel.json`, chạy lại `server/__tests__/guarantees.test.ts`.

### 13.2 Trình tự tải (mục tiêu)

| Thời điểm | Việc |
|---|---|
| 0 ms | HTML và khung boot (đêm) |
| ~300 ms | entry JS; shell của LandingPage và chữ hero (ẩn chờ font) |
| ≤ 900 ms | font sẵn sàng (chờ tối đa) → chữ hero vào; LCP là H1 |
| sau khi chữ vào xong và trình duyệt rảnh (≤ 1,5 s) | tải chunk đồ hoạ → worker tính form → `compileAsync` |
| ~1,5–2,5 s | crossfade poster → canvas |
| những lúc rảnh tiếp theo | mount nội dung nặng của cảnh 2–4 (KaTeX tải lười) |
| khi cảnh cách màn hình ≤ 1,5 chiều cao khung | mount nội dung các cảnh sau |

### 13.3 Ngân sách

- JS ban đầu của landing ≤ 70 KB gzip; chunk đồ hoạ ≤ 170 KB gzip; KaTeX tải lười.
- Poster WebP ≤ 40 KB mỗi ảnh, chỉ tải khi cần.
- ≤ 12 draw call mỗi khung; GPU ≤ 6 ms mỗi khung ở Tier B; không render target nào lớn hơn viewport.
- Preload đúng 1 file font: Geist latin.

### 13.4 Mười lăm việc bắt buộc để cuộn «cực mượt»

1. Một vòng lặp duy nhất (§9.3); `lenis.raf()` chạy bên trong.
2. Không đọc layout trong vòng lặp. Chỉ đo khi resize, khi font tải xong, khi nội dung cảnh mount.
3. Giá trị thay đổi theo khung đi qua MotionValue hoặc ref, không qua React state.
4. Chỉ `transform` và `opacity`. `will-change: transform` chỉ cho phần tử đang chuyển động trong cảnh hiện tại, gỡ khi rời cảnh.
5. Không `backdrop-filter` hay `filter: blur()` trên phần tử nằm đè canvas.
6. Morph chạy trên GPU; mỗi khung chỉ đổi uniform.
7. Shader biên dịch trước (`compileAsync`); không tạo material hay geometry mới khi đang cuộn.
8. Tính toạ độ form trong worker, tất định.
9. Hạt xếp ngẫu nhiên sẵn, nên giảm số hạt bằng `setDrawRange` không lộ lỗ.
10. Governor tự hạ chất lượng; canvas ngủ khi bị che hoặc tab bị ẩn.
11. `content-visibility: auto` cho Plans, FAQ, footer (không dùng cho section sticky).
12. Damping độc lập tần số khung (`1 − exp(−λ·dt)`), nên 60 Hz và 120 Hz cho cùng cảm giác.
13. Không listener `scroll` nào ngoài Lenis; IntersectionObserver chỉ dùng để mount lười, không để chạy animation.
14. Font, ảnh tự host; chiều cao section cố định ngay từ đầu, không có layout shift khi cuộn.
15. Luôn thử với CPU giảm tốc 4 lần và trên máy GPU tích hợp, không chỉ trên máy mạnh của bạn.

---

## 14. Kiểm thử và nghiệm thu

### 14.1 Unit test (vitest)

- Công thức tiến trình cảnh; tính liên tục và đơn điệu của story time khi qua ranh giới cảnh.
- Tổng ngân sách cuộn của registry; mọi `SceneId` có section tương ứng.
- CDF trong texture hậu nghiệm khớp `weights` của `ENGINE_RUN` ở mọi bước (sai số < 1e-3).
- Worker tính form tất định (cùng seed thì cùng hash).
- Số hạt mỗi vòng của đường hầm tỷ lệ đúng với số bài theo năm trong `catalog.json`.
- Thẻ kết luận ở cảnh `why` trùng output của `analyzeErrorPatterns()` cho người học mẫu.
- Giá hiển thị khớp `PLANS`; câu FAQ về giá đọc từ `PLANS`.
- Map hash cũ sang mới (§4.3).
- Test dữ liệu đã chuyển chỗ (archiveFigures, archiveSamples, engineRun) vẫn xanh.

### 14.2 Playwright (`qa/landing-v2/`)

- Ảnh chụp ở 390 × 844, 768 × 1024, 1440 × 900, 1920 × 1080; mỗi cảnh ở p = 0.2, 0.5, 0.8 (cuộn bằng `window.scrollTo`, chờ 2 khung).
- Chạy lại với `emulateMedia({ reducedMotion: 'reduce' })`.
- Chạy với renderer phần mềm (mặc định trong CI không có GPU) để xác nhận Tier D ra poster. Dùng `?forceGl=1` khi cần ép vẽ WebGL để chụp.
- Kiểm: không lỗi console; không cuộn ngang; `Find my level` mở form đăng ký; `/#plans` tới đúng chỗ; Tab đi qua toàn trang và luôn thấy focus; hash cũ chuyển đúng.

### 14.3 Đo khung hình tự động

```ts
// qa/landing-v2/frames.ts — vòng rAF đo này chỉ có trong script QA, không có trong code sản phẩm
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const cdp = await page.context().newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await page.goto('http://localhost:8000/?landing=v2&forceGl=1', { waitUntil: 'networkidle' });
await page.evaluate(() => {
  const w = window as unknown as { __frames: number[]; __long: number };
  w.__frames = []; w.__long = 0;
  let last = performance.now();
  const tick = (now: number) => { w.__frames.push(now - last); last = now; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  new PerformanceObserver(list => { w.__long += list.getEntries().length; }).observe({ type: 'longtask' });
});
const height = await page.evaluate(() => document.documentElement.scrollHeight);
for (let y = 0; y < height; y += 120) { await page.mouse.wheel(0, 120); await page.waitForTimeout(16); }
const { frames, long } = await page.evaluate(() => {
  const w = window as unknown as { __frames: number[]; __long: number };
  return { frames: w.__frames, long: w.__long };
});
const sorted = [...frames].sort((a, b) => a - b);
const pct = (q: number) => sorted[Math.floor(q * (sorted.length - 1))].toFixed(1);
console.log({ p50: pct(0.5), p95: pct(0.95), p99: pct(0.99),
  over16: `${((frames.filter(f => f > 16.7).length / frames.length) * 100).toFixed(1)}%`, longTasks: long });
await browser.close();
```

Lưu ý: số đo trong container không có GPU chỉ để so sánh giữa các lần chạy. Nghiệm thu §1.1 PHẢI đo trên máy thật (laptop tầm trung, Pixel 6a hoặc tương đương, iPhone 12 trở lên) và ghi kết quả vào báo cáo.

### 14.4 Poster

- `scripts/landing-posters.ts`: Playwright mở `?landing=v2&poster=<sceneId>&forceGl=1`. Ở chế độ này trang nhảy tới `p` đẹp nhất của cảnh (khai báo `posterAt` trong registry), dừng vòng lặp sau khi governor ổn định, rồi đặt `window.__posterReady = true`.
- Renderer bật `preserveDrawingBuffer` **chỉ** ở chế độ poster; trang xuất `canvas.toDataURL('image/webp', 0.82)`; script ghi ra `public/landing/posters/<sceneId>.webp`.
- Poster dùng cho Tier D, reduced motion, lúc chờ WebGL, và ảnh OG (1200 × 630, từ cảnh `top`).

### 14.5 Trình duyệt

Chrome và Edge (Windows, macOS) · Safari macOS 17+ · Safari iOS 17+ (iPhone 12 trở lên) · Firefox bản mới nhất · Chrome Android (Pixel 6a hoặc tương đương) · Samsung Internet.

### 14.6 Kiểm tay trước khi gộp

- Cuộn bằng chuột có nấc, trackpad, phím Space/PageDown/Home/End, kéo thanh cuộn, Ctrl/Cmd+F tìm "IMO".
- Cuộn thật nhanh từ trên xuống dưới rồi ngược lên: không cảnh nào kẹt ở trạng thái sai.
- Đổi kích thước cửa sổ giữa chừng một cảnh sticky.
- Chuyển tab đi rồi quay lại: không có bước nhảy.
- Bật VoiceOver (macOS/iOS) và đọc hết trang.

---

## 15. Tích hợp với repo

### 15.1 Feature flag và thay thế

- Giai đoạn 0–6: `Welcome.tsx` chọn landing v2 khi URL có `?landing=v2` hoặc `import.meta.env.VITE_LANDING_V2 === '1'`. Landing cũ vẫn là mặc định.
- Giai đoạn 7: v2 thành mặc định, rồi xoá landing cũ (§4.1), cập nhật `WelcomeScreen.tsx`, `brand.test.ts`, CSS boot trong `index.html`, xoá CSS cũ, chạy lint/test/build, chạy `graphify update .`.

### 15.2 SEO và meta

- Giữ route và các URL ở §4.3.
- Cập nhật `<meta name="description">` theo lead của cảnh `top`; ảnh OG từ poster cảnh `top` (1200 × 630, tự host).
- Một H1; heading theo thứ bậc; link là `<a href>` thật.

### 15.3 Analytics (`@vercel/analytics`, không PII)

| Event | Thuộc tính |
|---|---|
| `landing_cta` | `where`: `hero`, `how-it-works`, `plans`, `begin`, `nav` |
| `landing_scene` | `id` (một lần mỗi cảnh mỗi phiên) |
| `landing_try_answer` | `topic`, `correct` |
| `landing_tier` | `tier`: `A`, `B`, `C`, `D` |

### 15.4 CSP hiện tại và hệ quả

- `script-src 'self'` cộng một hash: không thêm inline script; không CDN.
- `worker-src 'self'`: worker phải là file cùng origin (Vite `new URL(..., import.meta.url)`); cấm `blob:`.
- `img-src 'self' data:` và `font-src 'self' data:`: ảnh và font tự host.
- `style-src 'self' 'unsafe-inline'`: Motion ghi style inline được.
- WebGL không cần đổi CSP.

### 15.5 Tài liệu cần cập nhật

- `docs/design-refresh-report.md`: thêm mục «Landing v2» (đã làm gì, số đo trước/sau, chỗ nào chưa kiểm được).
- `docs/landing-v2-decisions.md`: mọi quyết định lệch khỏi tài liệu này.
- README: không đổi, trừ khi có lệnh chạy mới (`scripts/landing-posters.ts`).

---

## 16. Những điều cấm

1. Scroll-jacking, khoá cuộn, `scroll-snap` trong cảnh scrub.
2. Màn hình chờ có phần trăm, preloader giả.
3. Âm thanh tự phát.
4. Con trỏ tự vẽ thay thế con trỏ hệ thống.
5. `backdrop-filter`, `filter: blur()` động, `box-shadow` động trên phần tử lớn.
6. Vòng `requestAnimationFrame` thứ hai, listener `scroll` riêng, IntersectionObserver để chạy animation theo cuộn.
7. Cập nhật React state mỗi khung.
8. Đọc layout (`getBoundingClientRect`, `offsetTop`…) trong vòng lặp.
9. Animate width, height, top, left, margin; đổi `font-weight` theo từng khung.
10. Bloom hoặc hậu kỳ toàn màn hình trên điện thoại; render target lớn hơn viewport.
11. Tạo material hay geometry khi đang cuộn; upload buffer mỗi khung.
12. Số liệu giả, testimonial giả, "1,428 active users", logo đối tác hay trường học giả.
13. Gradient tím-xanh, glow trang trí, icon "AI sparkles", emoji, icon trong ô bo tròn, thẻ có sọc màu ở cạnh.
14. Chữ vẽ trong canvas; nội dung chỉ đọc được khi cuộn tới đúng chỗ.
15. Carousel tự chạy, marquee.
16. Thư viện animation thứ hai (GSAP, R3F…).
17. CDN ngoài, Google Fonts, ảnh hotlink.
18. Sửa inline script trong `index.html` mà không cập nhật hash CSP.
19. Thông tin chỉ hiện khi hover.
20. Chữ nằm trên đồ hoạ mà không có scrim.

Ngoài phạm vi (không làm trong đợt này): dịch sang tiếng Việt (nhưng `copy.ts` phải sẵn sàng), CMS, framework A/B test, API backend mới, thay đổi workspace.

---

## 17. Lộ trình và prompt cho từng giai đoạn

**Mẫu báo cáo cuối mỗi giai đoạn** (AI PHẢI dùng):

```
## Giai đoạn N — báo cáo
Đã làm:
Số đo: frame p50/p95/p99, % khung > 16,7 ms, long tasks, kích thước bundle (gzip), Lighthouse nếu có
Ảnh chụp: (đường dẫn trong qa/landing-v2/shots/)
Lệch khỏi brief và lý do: (đã ghi vào docs/landing-v2-decisions.md)
Việc còn lại / rủi ro:
```

### Giai đoạn 0 · Khảo sát và dựng khung

- **Việc.** Đọc tài liệu; chạy `graphify query` cho: entry và props của landing, khung boot, nơi vẽ logo, nguồn số liệu kho đề. Tạo cây thư mục §9.2. Chuyển dữ liệu §4.2 (tạm giữ re-export ở vị trí cũ để landing cũ vẫn chạy). Thêm `src/lib/random.ts`. Thêm feature flag §15.1. Tạo `docs/landing-v2-decisions.md`.
- **Xong khi.** Lint/test/build xanh. `/` vẫn là landing cũ. `/?landing=v2` hiện 11 section shell rỗng đúng chiều cao. Test dữ liệu vẫn xanh.
- **Prompt.**

> Làm Giai đoạn 0 trong `docs/landing-v2-brief.md` (§17). Chỉ dựng khung, di chuyển dữ liệu và thêm feature flag; chưa làm giao diện; không xoá landing cũ. Kết thúc bằng báo cáo theo mẫu ở §17.

### Giai đoạn 1 · Xương sống cuộn

- **Việc.** `loop.ts`, `lenis.ts`, `ScrollDirector`, `scenes.ts` đủ 11 cảnh, `useScene`, Nav bản thô, SceneRuler, HUD, overlay `?debug=scroll` (id cảnh, p, s, vận tốc, fps), xử lý hash (gồm map hash cũ), nhánh reduced motion (không Lenis).
- **Xong khi.** Cuộn qua 11 cảnh rỗng ổn định 60 fps. Unit test công thức tiến trình và tính liên tục của story time. `/#plans` tới đúng chỗ. Tab, Space, PageDown, Home, End chạy. Trong code không có listener `scroll` hay `requestAnimationFrame` nào khác.
- **Prompt.**

> Làm Giai đoạn 1 trong `docs/landing-v2-brief.md`: vòng lặp duy nhất, Lenis, ScrollDirector, scene registry, nav thô, thước cảnh, HUD, overlay debug, hash routing, nhánh reduced motion (§9.3–§9.5, §11.1–§11.3). Chưa làm WebGL. Báo cáo theo mẫu.

### Giai đoạn 2 · Bầy hạt

- **Việc.** Stage tải lười, renderer, phân hạng máy và governor, worker tính form (đủ 14 form, cho phép bản thô), texture hậu nghiệm, shader bầy hạt, morph theo story time, camera theo cảnh, lực con trỏ, poster cho Tier D, xử lý mất context, chế độ ngủ.
- **Xong khi.** Mọi form hiện đúng và morph liên tục khi cuộn xuôi lẫn ngược. Tier D chạy được. Chunk đồ hoạ ≤ 170 KB gzip. Đo theo §14.3 và ghi số; trên máy thật Tier B đạt §1.1.
- **Prompt.**

> Làm Giai đoạn 2 trong `docs/landing-v2-brief.md`: toàn bộ §9.6–§9.12. Ưu tiên đúng và mượt hơn đẹp; hình của từng form sẽ tinh chỉnh ở giai đoạn sau. Báo cáo theo mẫu, kèm ảnh chụp mỗi form.

### Giai đoạn 3 · Cảnh `top`, `how-it-works`, `try`

- **Việc.** Copy, bố cục, chuyển động DOM, readout, replay `ENGINE_RUN` qua texture hậu nghiệm, Lock-on, bài thử bốn chủ đề với bốn hình hạt, reticle cho `how-it-works`.
- **Xong khi.** Đạt mục «Xong khi» của §10.1–§10.3. Unit test hậu nghiệm xanh.
- **Prompt.**

> Làm Giai đoạn 3 trong `docs/landing-v2-brief.md`: các cảnh §10.1, §10.2, §10.3, đúng copy, đúng timeline, đúng dữ liệu nguồn. Khoảnh khắc Lock-on phải đúng §10.2 và trung thực với dữ liệu. Báo cáo theo mẫu.

### Giai đoạn 4 · Cảnh `why`, `tutor`, `map`, `archive`, `arena`

- **Việc.** §10.4–§10.8: lớp phân tích lỗi chạy `analyzeErrorPatterns()` thật, hội thoại tutor, chòm sao từ `domainBankProfiles()` và đường 13 câu, đường hầm từ `catalog.json` cùng bốn cột họ đề, đường đua và bảng xếp hạng mẫu.
- **Xong khi.** Đạt mục «Xong khi» của từng cảnh. Đường hầm không tụt khung trên Tier C.
- **Prompt.**

> Làm Giai đoạn 4 trong `docs/landing-v2-brief.md`: các cảnh §10.4 tới §10.8. Mọi dữ liệu mẫu phải có nhãn «Example»; mọi con số đọc từ nguồn. Báo cáo theo mẫu.

### Giai đoạn 5 · Day, cảnh cuối và chuyển trang

- **Việc.** Shader Bình minh (§10.9), Plans (§10.10), FAQ (§10.11), cảnh `begin` hội tụ thành logo và footer (§10.12), view transition sang đăng ký (§11.6), canvas ngủ trong Day.
- **Xong khi.** Giá và trạng thái checkout đúng nguồn. FAQ dùng được không cần JS. CTA mở form đăng ký có hiệu ứng nở (trình duyệt hỗ trợ) và vẫn chạy khi không hỗ trợ.
- **Prompt.**

> Làm Giai đoạn 5 trong `docs/landing-v2-brief.md`: §10.9 tới §10.12 và §11.6. Báo cáo theo mẫu.

### Giai đoạn 6 · Đánh bóng

- **Việc.** Năm khoảnh khắc chữ ký ở mức hoàn thiện (§5.4), hiệu ứng `guess` tan thành hạt (CÓ THỂ), micro-interaction (§11), script poster (§14.4), ảnh OG, rà trợ năng (§12.4), rà điện thoại, rà hiệu năng (§13.4), rà copy theo §3.4.
- **Xong khi.** Đạt toàn bộ §1.1 trên máy thật. Lighthouse Accessibility 100. Ảnh chụp §14.2 đủ bộ và không lỗi.
- **Prompt.**

> Làm Giai đoạn 6 trong `docs/landing-v2-brief.md`: đánh bóng theo §5.4, §11, §12, §13.4, §14. Đo lại mọi chỉ số §1.1 và báo cáo theo mẫu, kèm bảng chỉ số đạt/chưa đạt.

### Giai đoạn 7 · Thay thế và dọn dẹp

- **Việc.** v2 thành mặc định; xoá landing cũ (§4.1); cập nhật `WelcomeScreen.tsx`, `brand.test.ts`, CSS boot và `theme-color` trong `index.html` (§13.1); xoá CSS cũ không còn ai dùng; cập nhật tài liệu (§15.5); `npm run lint && npm test && npm run build`; `graphify update .`.
- **Xong khi.** Không còn file nào của landing cũ; không còn import trỏ tới `src/components/landing/`; mọi kiểm tra xanh; `/` là landing v2.
- **Prompt.**

> Làm Giai đoạn 7 trong `docs/landing-v2-brief.md`: thay landing cũ bằng v2 và dọn sạch theo §4.1, §4.3, §13.1, §15. Liệt kê mọi file đã xoá. Báo cáo theo mẫu.

---

## 18. Phụ lục

### A. Thuật ngữ

| Thuật ngữ | Nghĩa |
|---|---|
| θ (theta) | trình độ ước lượng trên thang IRT (ở đây từ −4 tới 4) |
| SE, ± | sai số chuẩn của ước lượng; càng nhỏ, engine càng chắc |
| Prior | phân phối trình độ trước câu trả lời đầu tiên |
| Posterior (hậu nghiệm) | phân phối trình độ sau các câu đã trả lời; đường cong ở cảnh `how-it-works` |
| CDF | hàm phân phối tích luỹ; dùng để lấy mẫu ngược cho vị trí hạt |
| IRT | Item Response Theory: mô hình xác suất trả lời đúng theo trình độ và độ khó câu hỏi |
| Tier (bậc trình độ) | Foundation, Intermediate, Advanced, Olympiad |
| Tier A–D (hạng máy) | mức chất lượng đồ hoạ theo thiết bị (§9.10) |
| Form | một hình mà bầy hạt có thể tạo |
| Morph | chuyển bầy hạt từ form này sang form khác |
| Story time `s` | thời gian câu chuyện: chỉ số cảnh cộng tiến trình trong cảnh |
| Scrim | lớp nền mờ tĩnh phía sau chữ để giữ tương phản |
| DOF | depth of field: hạt xa tiêu cự to và mờ hơn |
| Fill-rate | số điểm ảnh GPU phải tô mỗi khung; hạt to và chồng nhiều thì tốn |
| DPR | device pixel ratio |
| Governor | bộ tự điều chỉnh chất lượng theo thời gian khung đo được |

### B. Tham chiếu về cảm giác (học nhịp và độ chuẩn, không sao chép)

- Trang sản phẩm của Apple: cách cuộn điều khiển một chuỗi hình liền mạch, nhịp vào và ra của chữ.
- lusion.co, igloo.inc, activetheory.net: thế giới WebGL liền mạch, chuyển cảnh không cắt.
- linear.app: độ chuẩn của chữ, lưới, khoảng trắng trên nền tối.
- stripe.com: đồ hoạ nền nhẹ mà vẫn trau chuốt, hiệu năng tốt.

Chỉ học nhịp điệu, độ mượt và độ chuẩn. Không sao chép bố cục, màu, hình ảnh hay mã nguồn của bất kỳ trang nào.

### C. Khung `copy.ts`

```ts
export const COPY = {
  nav: { howItWorks: 'How it works', try: 'Try one', archive: 'Archive', arena: 'Arena',
         pricing: 'Pricing', signIn: 'Sign in', cta: 'Find my level', menu: 'Menu' },
  top: {
    h1: ['Most practice apps guess your level.', 'CalculixHub *measures* it.'],
    lead: 'Placement built on item response theory, the maths behind computer-adaptive exams. You get your level with its margin of error, then problems from AMC to IMO that fit it.',
    primary: 'Find my level', secondary: 'Watch it work',
  },
  howItWorks: {
    h2: 'Every answer narrows it down.',
    beats: [
      'Before your first answer, every level is possible.',
      'Right answers push the estimate up.',
      'Misses pull it back. Both make it surer.',
      'Each next question is the one it can least predict.',
      'It stops when it is sure: {count} questions, {tier}, ±{sem}.',
    ],
    truth: 'True level of the simulated student. The engine never sees it.',
    cta: 'Find your own level',
  },
  // try, why, tutor, map, archive, arena, plans, faq, begin, footer: chép đúng từ §10
} as const;
```

`*dấu sao*` đánh dấu từ khoá được nhấn mạnh (weight 600 và ngoặc đo).

### D. Mẫu `docs/landing-v2-decisions.md`

```
## YYYY-MM-DD · <tên quyết định>
Bối cảnh: tài liệu nói gì / không nói gì
Quyết định:
Lý do (kèm số đo nếu có):
Ảnh hưởng tới: (file, cảnh)
```
