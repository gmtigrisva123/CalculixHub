# Landing v2 «Signal» · Nhật ký quyết định

Mọi quyết định lệch khỏi `docs/landing-v2-brief.md`, hoặc lấp chỗ bản chỉ dẫn không nói rõ (prompt khởi động, bước 5). Mỗi mục theo mẫu ở phụ lục D. Khi có mâu thuẫn, thứ tự ưu tiên vẫn là §0.2.

---

## 2026-11-28 · Đưa bản chỉ dẫn vào repo

Bối cảnh: prompt khởi động và prompt của mọi giai đoạn trỏ tới `docs/landing-v2-brief.md`, nhưng file này chưa có trong repo. Bản gốc là artifact «Signal Landing Brief».

Quyết định: chép nguyên văn phần Markdown gốc của artifact (1.631 dòng) vào `docs/landing-v2-brief.md`, không sửa chữ nào.

Lý do: mọi giai đoạn sau đọc cùng một bản, và bản đó có lịch sử trong git.

Ảnh hưởng tới: `docs/landing-v2-brief.md`.

## 2026-11-28 · Cây thư mục §9.2: tạo thư mục, file nào thuộc giai đoạn nào thì giai đoạn đó tạo

Bối cảnh: Giai đoạn 0 yêu cầu «Tạo cây thư mục §9.2», nhưng phần lớn file trong cây (`motion.ts`, `director/loop.ts`, `gl/Stage.tsx`, `sections/*`, `ui/*`…) là việc của Giai đoạn 1–6. Tài liệu không nói có tạo trước file rỗng hay không.

Quyết định: tạo đủ các thư mục của §9.2 (`director/`, `gl/swarm/`, `gl/fx/`, `sections/`, `ui/`, `data/`, `styles/`, `__tests__/`, `qa/landing-v2/`); thư mục còn rỗng được giữ bằng `.gitkeep`. Chỉ tạo những file Giai đoạn 0 cần:

- `LandingPage.tsx`, `copy.ts`, `scenes.ts`, `styles/layout.css`: 11 section shell.
- `gl/swarm/forms.ts`: chỉ danh sách 14 form theo thứ tự §9.11, để kiểu `FormId` của registry có nguồn. Cách tính từng form thêm ở Giai đoạn 2.
- `styles/tokens.css`: nền đêm của các shell cần `--n-0`. File chứa trọn bảng §7.2 và phần CSS của §8.2, vì §8.2 đặt phần CSS đó ở đây.

`motion.ts` (§8.2) chưa tạo: chưa có gì dùng nó; Giai đoạn 1 tạo khi nav cần `SPRING.ui`. Không tạo `public/landing/posters/` lúc này: Vite chép mọi thứ trong `public/` vào bản build, nên một `.gitkeep` ở đó sẽ bị deploy. Thư mục này do script poster tạo (§14.4, Giai đoạn 6).

Lý do: đơn giản hơn. Không có module nào mà không ai import, và mỗi file ra đời cùng code thật của nó.

Ảnh hưởng tới: `src/features/landing/**`, `public/landing/posters/`.

## 2026-11-28 · Nhãn của 11 cảnh

Bối cảnh: theo §9.4, `label` là «tên ngắn trong nav và thước cảnh (EN, lấy từ copy.ts)». Phụ lục C chỉ cho nhãn nav của năm cảnh. Cột «Cảnh» ở §9.4 có cả tên làm việc như `Arrival`, `Collapse`.

Quyết định: `top` → `Top` · `how-it-works` → `How it works` · `try` → `Try one` · `why` → `Why you missed` · `tutor` → `Tutor` · `map` → `Map` · `archive` → `Archive` · `arena` → `Arena` · `plans` → `Pricing` · `faq` → `FAQ` · `begin` → `Begin`.

Lý do: cảnh nào có nhãn nav ở phụ lục C thì dùng đúng nhãn đó; các cảnh còn lại lấy tên ở cột «Cảnh». `Arrival` và `Collapse` là tên làm việc, không phải tên người đọc hiểu (§3.4): `Collapse` đã có nhãn nav `How it works`, còn `Arrival` thành `Top`, khớp id `#top` và việc map hash cũ `#idea → #top`.

Ảnh hưởng tới: `copy.ts`, `scenes.ts`; nav và SceneRuler (Giai đoạn 1).

## 2026-11-28 · Shell chưa có tiêu đề thì đặt tên bằng `aria-label`

Bối cảnh: mẫu section ở §9.4 dùng ``aria-labelledby={`${scene.id}-title`}``. Giai đoạn 0 chưa làm giao diện nên chưa có heading nào mang id đó, mà `aria-labelledby` trỏ tới một id không tồn tại là ARIA không hợp lệ.

Quyết định: trong lúc chưa có heading, mỗi section mang `aria-label` bằng nhãn cảnh. Khi heading của cảnh xuất hiện (Giai đoạn 3–5) thì đổi sang `aria-labelledby` như §9.4.

Lý do: hợp lệ và tiếp cận được ngay từ bây giờ.

Ảnh hưởng tới: `LandingPage.tsx` (`SceneShell`).

## 2026-11-28 · Chiều cao: `data-budget` thay cho selector `[data-pinned]`

Bối cảnh: CSS mẫu ở §9.4 chỉ đặt chiều cao cho `.lx2-scene[data-pinned]`, với một biến `--budget`. Nhưng `top` có ngân sách 100/100 mà không sticky, và mỗi ngân sách cố định có hai con số (desktop và mobile).

Quyết định: registry đưa ngân sách xuống CSS bằng `--budget-desktop` và `--budget-mobile`; `layout.css` chọn `--budget` theo bề rộng (dưới 768px dùng mobile, theo §12.1). Mỗi section mang `data-budget="fixed"` (cao đúng `--budget × 1svh`) hoặc `data-budget="content"`. `data-pinned` vẫn có, nhưng chỉ để đánh dấu cảnh có stage sticky. Chiều cao chỉ dùng `svh`, không kèm dòng `vh` dự phòng: mọi trình duyệt ở §14.5 đều có `svh`, và một dòng `vh` đặt trước dòng `svh` có `var()` không bao giờ được dùng làm dự phòng.

Lý do: một quy tắc cho mọi cảnh có ngân sách, sticky hay không. CSS là nơi duy nhất quyết định chiều cao; ScrollDirector (Giai đoạn 1) chỉ việc đo.

Ảnh hưởng tới: `LandingPage.tsx`, `styles/layout.css`.

## 2026-11-28 · Cảnh theo nội dung khi còn rỗng: sàn 100svh

Bối cảnh: §9.4 chỉ cho `try` mức tối thiểu 100svh; `plans` và `faq` cao «theo nội dung», `plans` cộng 60svh cho Bình minh. Ở Giai đoạn 0 các cảnh này chưa có nội dung nên sẽ cao 0 (hoặc 60).

Quyết định: cả ba cảnh có `min-height: 100svh`, cộng `--dawn` (60 cho `plans`, khai báo trong registry là `dawn: 60`). Giai đoạn 5 xem lại sàn này cho `plans` và `faq` khi có nội dung thật.

Lý do: để 11 shell rỗng nhìn thấy và đo được; dùng chung con số brief đã cho `try`.

Ảnh hưởng tới: `scenes.ts`, `styles/layout.css`.

## 2026-11-28 · `Scene` chưa có `cameraAt`

Bối cảnh: interface ở §9.4 có `cameraAt: (p, aspect) => CameraPose`, nhưng camera theo cảnh là việc của Giai đoạn 2 (§9.9).

Quyết định: ở Giai đoạn 0 registry có mọi cột tĩnh của bảng §9.4 (id, nhãn, world, ngân sách, sticky, form, phía chữ) và `dawn`. `cameraAt` thêm ở Giai đoạn 2, `posterAt` (§14.4) ở Giai đoạn 6.

Lý do: không viết hàm camera giả trước khi có camera.

Ảnh hưởng tới: `scenes.ts`.

## 2026-11-28 · Form của cảnh `try` trong registry là `figure-algebra`

Bối cảnh: bảng §9.4 ghi `figure-*` cho `try`, vì mỗi tab có một form riêng (§10.3).

Quyết định: `form: 'figure-algebra'`, vì tab đầu là Algebra. Đổi tab thì morph giữa bốn form `figure-*`.

Lý do: registry cần một form cho dải act của cảnh.

Ảnh hưởng tới: `scenes.ts`.

## 2026-11-28 · Test dữ liệu nằm cạnh module trong `data/`, test mới nằm trong `__tests__/`

Bối cảnh: §9.2 có thư mục `__tests__/`; §4.2 nói chuyển dữ liệu và «giữ nguyên test».

Quyết định: test của dữ liệu đã chuyển (`archiveFigures`, `archiveSamples`, `engineRun`) đi cùng module vào `data/` và chỉ đổi đường import, theo quy ước của repo (test đặt cạnh file). Test mới của v2 (registry, shell, tokens) nằm ở `__tests__/`. Thêm hai test cho dữ liệu đã chuyển:

- `data/faq.test.ts`: đủ 8 câu, và câu về giá đọc từ `PLANS` (§14.1). Test đổi giá trong `PLANS` và thấy câu trả lời đổi theo.
- `src/lib/random.test.ts`: `mulberry32` cho đúng dãy số như trước khi chuyển, vì replay placement (seed 5) phụ thuộc vào dãy này.

Lý do: thay đổi ít nhất ở các test đã có; chặn được đúng hai rủi ro của việc chuyển dữ liệu.

Ảnh hưởng tới: `src/features/landing/data/*.test.ts`, `src/lib/random.test.ts`.

## 2026-11-28 · Màu chủ đề ghi thẳng giá trị hex

Bối cảnh: theo §7.2, chủ đề «dùng đúng màu của app», là biến trong `src/styles/tokens.css`. Ba trong bốn biến đó (`--hu-amber-500`, `--hu-violet-500`, `--hu-sky-500`) đổi giá trị theo theme tối của app; màu Geometry là `--color-proof-500` trong `src/index.css`. Còn landing không theo theme của app (§3.4).

Quyết định: `styles/tokens.css` của v2 ghi thẳng `#c8842a`, `#2f9c8c`, `#8b5cf6`, `#0ea5e9`. `__tests__/tokens.test.ts` kiểm bốn giá trị này trùng với màu của app trên nền sáng, để hai nơi không lệch nhau.

Lý do: đúng màu của app mà không đổi theo theme.

Ảnh hưởng tới: `styles/tokens.css`, `__tests__/tokens.test.ts`.

## 2026-11-28 · `data/footer.ts` chỉ chứa hai link preview

Bối cảnh: §4.2 bảo chuyển «link trong `LandingFooter.tsx` (iPhone preview, MacBook preview…)». Footer cũ chỉ có hai link đó, cộng nút «Back to top» (không phải link). §10.12 liệt kê thêm `Pricing` và `FAQ` cho footer mới.

Quyết định: `FOOTER_LINKS` giữ đúng hai link đã chuyển, và footer cũ đọc từ đó. `Pricing` và `FAQ` là link tới cảnh `#plans` và `#faq`, sẽ được ghép ở Giai đoạn 5 từ registry và `copy.ts`.

Lý do: chỉ chuyển dữ liệu đang có, không tạo trước dữ liệu của Giai đoạn 5.

Ảnh hưởng tới: `data/footer.ts`, `src/components/landing/LandingFooter.tsx`.

## 2026-11-28 · Script QA là `.mjs`, không phải `.ts`

Bối cảnh: §14.3 đặt tên máy đo khung hình là `qa/landing-v2/frames.ts`.

Quyết định: các script trong `qa/landing-v2/` là `.mjs` (`frames.mjs` chuyển nguyên từng bước của §14.3; `shells.mjs` là bài kiểm nghiệm thu của Giai đoạn 0). Chạy bằng `node`, Playwright lấy từ `qa/` (`cd qa && npm ci`).

Lý do: `tsconfig.json` không có `include`, nên `npm run lint` kiểm kiểu mọi file `.ts` trong repo, kể cả `qa/`; còn `playwright` chỉ là phụ thuộc của `qa/`, CI không cài. Một file `.ts` import `playwright` ở đó sẽ làm lint đỏ (đã thử: `TS2307: Cannot find module 'playwright'`). Mọi script khác trong `qa/` cũng là `.mjs` (§0.2: quy ước của repo đứng trên phần còn lại của tài liệu).

Ảnh hưởng tới: `qa/landing-v2/frames.mjs`, `qa/landing-v2/shells.mjs`.

## 2026-11-28 · Tới Giai đoạn 7, lượt xem v2 vẫn tải landing cũ

Bối cảnh: §4.3 để `WelcomeScreen.tsx` (các form đăng nhập/đăng ký) tiếp tục import landing cũ, làm đường quay lại từ form, cho tới Giai đoạn 7. `Welcome.tsx` preload các form khoảng 5 giây sau khi landing hiện (hoặc ngay khi bấm Sign in), ở cả hai landing.

Quyết định: giữ nguyên như brief, không đổi `WelcomeScreen.tsx` trước Giai đoạn 7. Ghi lại hệ quả. Đo trên bản build hiện tại: khoảng 5,1 giây sau khi mở `/?landing=v2`, ngoài code của chính các form, trang tải thêm JS của landing cũ (17,1 KB gzip), CSS của nó (20,7 KB gzip; mọi rule đều gắn với class của landing cũ, trừ CSS chuẩn của Lenis như `html.lenis`, chỉ có tác dụng khi Lenis chạy và cũng là file v2 sẽ tự import ở Giai đoạn 1 theo §9.3; không rule nào chạm vào `.lx2`), và các chương mà module đó tự tải (`LandingChapters` 28,0 KB gzip cùng vài module nhỏ): khoảng 70 KB gzip. Nút «Back to the landing page» trên form vẫn mở landing cũ.

Lý do: làm đúng thứ tự của brief. Biết trước để không nhầm khi đo.

Ảnh hưởng tới: mọi số đo mạng và hiệu năng của v2 trước Giai đoạn 7 (§1.1, §13.3, §14.3) phải trừ phần này, hoặc đo xong trước giây thứ 5. `src/components/Welcome.tsx`, `.env.example` ghi rõ điều này.
