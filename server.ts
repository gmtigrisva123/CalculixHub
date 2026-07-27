/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { Problem, LeaderboardEntry, WeeklyChallenge, Contest, CommunityDiscussion } from './src/components/types';

dotenv.config();

// Global error handlers to surface uncaught exceptions and promise rejections
process.on('uncaughtException', (err) => {
  console.error('[Server] uncaughtException:', err && (err.stack || err.message || err));
});

process.on('unhandledRejection', (reason) => {
  console.error('[Server] unhandledRejection:', reason && (reason.stack || reason));
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT || '8000') || 8000;

// Lazy initialization of Gemini client
let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Graceful handler for Gemini errors to activate high-fidelity offline system
function handleGeminiError(context: string, error: any) {
  const errMsg = typeof error === 'string' ? error : (error?.message || JSON.stringify(error));
  const isQuotaExceeded = errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('limit') || error?.status === 'RESOURCE_EXHAUSTED' || error?.status === 429;
  if (isQuotaExceeded) {
    console.warn(`[Calculix Offline Engine] Gemini Quota Exceeded during ${context}. Activating local high-fidelity math fallback.`);
  } else {
    console.warn(`[Calculix Offline Engine] Gemini API issue during ${context}. Activating fallback: ${errMsg}`);
  }
}

// Global server-side databases (mock)
const problems: Problem[] = [
  // --- ALGEBRA ---
  {
    id: 'alg-f01',
    title: 'Những thừa số của phương trình bậc hai (Quadratic Roots)',
    topic: 'Algebra',
    level: 'Foundation',
    question: 'Tìm tổng tất cả các nghiệm thực của phương trình: $x^2 - 7x + 12 = 0$. (Nhập số câu trả lời của bạn, ví dụ: 7)',
    type: 'text',
    correctAnswer: '7',
    hint: 'Sử dụng định lý Viète cho phương trình bậc hai $ax^2 + bx + c = 0$, tổng các nghiệm là $-b/a$.',
    solution: 'Phương trình $x^2 - 7x + 12 = 0$ có thể phân tách thành $(x-3)(x-4) = 0$. Các nghiệm là $x = 3$ và $x = 4$. Tổng các nghiệm là $3 + 4 = 7$. Theo định lý Viète, tổng là $-(-7)/1 = 7$.',
    points: 10,
  },
  {
    id: 'alg-a01',
    title: 'Cực trị của biểu thức phân số (Minimum Fraction Value)',
    topic: 'Algebra',
    level: 'Advanced',
    question: 'Cho 3 số thực dương $a, b, c$ sao cho $a + b + c = 1$. Giá trị nhỏ nhất của biểu thức: $P = \\frac{1}{a} + \\frac{1}{b} + \\frac{1}{c}$ là bao nhiêu?',
    type: 'text',
    correctAnswer: '9',
    hint: 'Sử dụng bất đẳng thức Cauchy (AM-GM) hoặc bất đẳng thức Cauchy-Schwarz dạng phân số (Shed-Titu).',
    solution: 'Áp dụng bất đẳng thức Cauchy-Schwarz dạng cộng mẫu: $\\frac{1}{a} + \\frac{1}{b} + \\frac{1}{c} \\ge \\frac{(1+1+1)^2}{a+b+c} = \\frac{9}{1} = 9$. Đẳng thức xảy ra khi $a = b = c = 1/3$.',
    points: 20,
  },
  {
    id: 'alg-o01',
    title: 'Phương trình hàm Olympiad (Functional Equation)',
    topic: 'Algebra',
    level: 'Olympiad',
    question: 'Tìm giá trị của $f(2026)$ nếu hàm $f: \\mathbb{R} \\to \\mathbb{R}$ thỏa mãn $f(x + y) + f(x - y) = 2f(x)\\cos(y)$ với mọi $x, y \\in \\mathbb{R}$, biết $f(0) = 0$ và $f(\\pi/2) = 1$. (Gõ đáp án số hoặc biểu thức dạng lượng giác, kết quả cuối cùng là một giá trị hàm lượng giác đơn giản $f(x) = \\sin(x)$)',
    type: 'text',
    correctAnswer: 'sin(2026)',
    hint: 'Đặt $x = 0$ để tìm thông tin về tính chẵn lẻ của hàm, sau đó đặt các giá trị thích hợp khác.',
    solution: 'Hàm thỏa mãn phương trình d’Alembert liên kết với hàm lượng giác. Với $f(0) = 0$ và $f(\\pi/2) = 1$, nghiệm duy nhất hành xử tốt là $f(x) = \\sin(x)$. Vậy $f(2026) = \\sin(2026)$.',
    points: 35,
  },
  // --- GEOMETRY ---
  {
    id: 'geo-f01',
    title: 'Diện tích tam giác vuông (Right Triangle Area)',
    topic: 'Geometry',
    level: 'Foundation',
    question: 'Một tam giác có độ dài ba cạnh lần lượt là 5, 12, và 13. Diện tích tam giác này là bao nhiêu?',
    type: 'text',
    correctAnswer: '30',
    hint: 'Kiểm tra xem đây có phải là tam giác vuông không bằng cách dùng định lý Pythagore đảo ($5^2 + 12^2 = 13^2$).',
    solution: 'Ta có $25 + 144 = 169$, tức $5^2 + 12^2 = 13^2$. Đây là một tam giác vuông với hai cạnh góc vuông là 5 và 12. Diện tích là $S = (5 \\times 12)/2 = 30$.',
    points: 10,
  },
  {
    id: 'geo-a01',
    title: 'Diện tích tứ giác nội tiếp (Brahmagupta Formula)',
    topic: 'Geometry',
    level: 'Advanced',
    question: 'Một tứ giác nội tiếp đường tròn có độ dài các cạnh liên tiếp là $a=3, b=4, c=5, d=6$. Tính diện tích của tứ giác này (làm tròn đến hai chữ số thập phân, dùng công thức Brahmagupta).',
    type: 'text',
    correctAnswer: '18.97',
    hint: 'Sử dụng công thức Brahmagupta: $S = \\sqrt{(p-a)(p-b)(p-c)(p-d)}$ với $p$ là nửa chu vi.',
    solution: 'Chu vi tứ giác $2p = 3 + 4 + 5 + 6 = 18 \\Rightarrow p = 9$. Diện tích $S = \\sqrt{(9-3)(9-4)(9-5)(9-6)} = \\sqrt{6 \\times 5 \\times 4 \\times 3} = \\sqrt{360} \\approx 18.97$.',
    points: 20,
  },
  {
    id: 'geo-o01',
    title: 'Định lý Ptolemy mở rộng (Ptolemy Inequality)',
    topic: 'Geometry',
    level: 'Olympiad',
    question: 'Cho tam giác đều $ABC$ nội tiếp đường tròn. Điểm $M$ nằm trên cung nhỏ $BC$. Nếu $MB = 5$ và $MC = 8$, độ dài đoạn $MA$ là bao nhiêu?',
    type: 'text',
    correctAnswer: '13',
    hint: 'Sử dụng định lý Ptolemy cho tứ giác nội tiếp $ABMC$: $MA \\times BC = MB \\times AC + MC \\times AB$.',
    solution: 'Vì tam giác $ABC$ đều nên $AB = BC = CA$. Áp dụng định lý Ptolemy cho tứ giác nội tiếp $ABMC$: $MA \\cdot BC = MB \\cdot CA + MC \\cdot AB$. Vì các cạnh đều bằng nhau, chia cả hai vế cho độ dài cạnh tam giác đều, ta có: $MA = MB + MC = 5 + 8 = 13$.',
    points: 30,
  },
  // --- COMBINATORICS ---
  {
    id: 'comb-f01',
    title: 'Cái ôm bắt tay (Handshake Problem)',
    topic: 'Combinatorics',
    level: 'Foundation',
    question: 'Trong một căn phòng có 10 người, mỗi người đều bắt tay với những người còn lại đúng 1 lần. Hỏi có tất cả bao nhiêu cái bắt tay?',
    type: 'text',
    correctAnswer: '45',
    hint: 'Để có một cái bắt tay cần chọn ra 2 người trong số 10 người. Dùng tổ hợp chập 2 của 10: $C^{2}_{10}$.',
    solution: 'Số cái bắt tay là tổ hợp chập 2 của 10 phần tử: $C^2_{10} = \\frac{10 \\times 9}{2} = 45$. Có thể hiểu mỗi người bắt tay 9 người khác, vậy $10 \\times 9 = 90$ cái bắt tay chia đôi vì tính lặp lại.',
    points: 10,
  },
  {
    id: 'comb-a01',
    title: 'Xếp hàng có điều kiện (Conditional Arrangements)',
    topic: 'Combinatorics',
    level: 'Advanced',
    question: 'Có 5 nam sinh và 3 nữ sinh xếp thành một hàng ngang. Có bao nhiêu cách xếp sao cho không có 2 nữ sinh nào đứng cạnh nhau?',
    type: 'text',
    correctAnswer: '14400',
    hint: 'Sử dụng phương pháp vách ngăn. Xếp 5 nam sinh trước, tạo ra các khoảng trống để đặt các nữ sinh.',
    solution: 'Xếp 5 nam sinh có $5! = 120$ cách. Tạo ra 6 vị trí trống xen kẽ và ở hai đầu. Chọn 3 vị trí trống trong số 6 để xếp 3 nữ sinh có $A^3_6 = 6 \\times 5 \\times 4 = 120$ cách. Tổng số cách xếp là $120 \\times 120 = 14400$.',
    points: 20,
  },
  {
    id: 'comb-o01',
    title: 'Cầu nối đồ thị (Graph Connectivity Challenge)',
    topic: 'Combinatorics',
    level: 'Olympiad',
    question: 'Một đồ thị vô hướng đơn có 8 đỉnh. Số lượng cạnh ít nhất của đồ thị để chắc chắn rằng đồ thị này luôn liên thông (bất kể cách bố trí các cạnh) là bao nhiêu?',
    type: 'text',
    correctAnswer: '22',
    hint: 'Đồ thị sẽ KHÔNG liên thông nếu có một nhóm $k$ đỉnh cô lập khỏi nhóm còn lại. Để đảm bảo liên thông bất kể cấu trúc, số cạnh phải nhiều hơn số cạnh tối đa của đồ thị 8 đỉnh mà vẫn không liên thông.',
    solution: 'Một đồ thị 8 đỉnh sẽ không liên thông trong trường hợp tệ nhất nếu có 7 đỉnh liên thông hoàn toàn với nhau và đỉnh thứ 8 cô lập. Số cạnh tối đa của đồ thị này là $C^2_7 = 21$ cạnh. Chỉ cần thêm 1 cạnh nữa (tổng 22 cạnh), đỉnh cô lập bắt buộc phải kết nối, làm đồ thị chắc chắn liên thông. Đáp án là 22.',
    points: 35,
  },
  // --- NUMBER THEORY ---
  {
    id: 'num-f01',
    title: 'Tính đồng dư của lũy thừa (Modular Congruence)',
    topic: 'Number Theory',
    level: 'Foundation',
    question: 'Tìm số dư của phép chia $3^{2026}$ cho 5. (Hãy suy nghĩ về chu kỳ số dư hoặc định lý Fermat nhỏ)',
    type: 'text',
    correctAnswer: '4',
    hint: 'Xét chu kỳ các lũy thừa của 3 theo module 5: $3^1 \\equiv 3$, $3^2 \\equiv 4$, $3^3 \\equiv 2$, $3^4 \\equiv 1 \\pmod 5$.',
    solution: 'Theo Định lý Fermat nhỏ, vì 5 là số nguyên tố và $UCLN(3, 5)=1$ nên $3^4 \\equiv 1 \\pmod 5$. Ta phân tích số mũ: $2026 = 506 \\times 4 + 2$. Do đó, $3^{2026} = (3^4)^{506} \\times 3^2 \\equiv 1^{506} \\times 9 \\equiv 9 \\equiv 4 \\pmod 5$. Vậy số dư là 4.',
    points: 10,
  },
  {
    id: 'num-a01',
    title: 'Số nguyên tố cùng nhau và Hàm Phi Euler (Euler Totient Function)',
    topic: 'Number Theory',
    level: 'Advanced',
    question: 'Có bao nhiêu số nguyên dương nhỏ hơn 120 và nguyên tố cùng nhau với 120?',
    type: 'text',
    correctAnswer: '32',
    hint: 'Dùng hàm phi Euler $\\varphi(n) = n \\prod_{p|n} (1 - \\frac{1}{p})$, với các thừa số nguyên tố của 120.',
    solution: 'Ta phân tích $120 = 2^3 \\times 3 \\times 5$. Hàm Euler $\\varphi(120) = 120 \\times (1 - 1/2) \\times (1 - 1/3) \\times (1 - 1/5) = 120 \\times \\frac{1}{2} \\times \\frac{2}{3} \\times \\frac{4}{5} = 120 \\times \\frac{8}{30} = 32$. Vậy có 32 số thỏa mãn.',
    points: 20,
  },
  {
    id: 'num-o01',
    title: 'Bộ ba số Py-ta-go và Ước lượng (Pythagorean Triples & Primes)',
    topic: 'Number Theory',
    level: 'Olympiad',
    question: 'Xác định số lượng các bộ số nguyên dương nguyên tố cùng nhau $(x, y, z)$ thỏa mãn $x^2 + y^2 = z^2$ và $z \\le 50$, có $x$ là số chẵn. (Ví dụ tiêu biểu: bộ $8, 15, 17$...)',
    type: 'text',
    correctAnswer: '7',
    hint: 'Sử dụng công thức mô tả bộ ba Pythagoras nguyên thủy: $x=2uv, y=u^2-v^2, z=u^2+v^2$ với $u > v > 0$, $u, v$ khác tính chẵn lẻ và nguyên tố cùng nhau. Tìm số cặp $(u,v)$ sao cho $u^2+v^2 \\le 50$.',
    solution: 'Ta tìm các cặp $(u,v)$ thỏa mãn điều kiện nguyên thủy: 1. $u > v > 0$; 2. $UCLN(u,v) = 1$; 3. $u,v$ khác tính chẵn lẻ; 4. $u^2 + v^2 \\le 50$.\nHãy liệt kê u:\n- u = 2: v = 1 => z = 5 (thỏa mãn)\n- u = 3: v = 2 => z = 13 (thỏa mãn)\n- u = 4: v = 1 => z = 17 (thỏa mãn), v = 3 => z = 25 (thỏa mãn)\n- u = 5: v = 2 => z = 29 (thỏa mãn), v = 4 => z = 41 (thỏa mãn)\n- u = 6: v = 1 => z = 37 (thỏa mãn), v = 5 => z = 61 (loại vì > 50)\n- u = 7: v = 2 => z = 53 (loại vì > 50)\nTổng các bộ nguyên thủy hợp lệ là: (2,1)->5, (3,2)->13, (4,1)->17, (4,3)->25, (5,2)->29, (5,4)->41, (6,1)->37. Tổng cộng có 7 bộ như vậy.',
    points: 35,
  },
];

const initialLeaderboard: LeaderboardEntry[] = [];

const initialWeeklyChallenges: WeeklyChallenge[] = [];

const initialContests: Contest[] = [];

const initialDiscussions: CommunityDiscussion[] = [
  {
    id: 'disc-1',
    problemId: 'comb-f01',
    problemTitle: 'Cái ôm bắt tay (Handshake Problem)',
    user: 'Lê Hoài Nam',
    role: 'Student',
    content: 'Cách giải thích dùng tổ hợp $C^2_{10}$ thật sự rất đẹp và trực quan. Đối với những ai mới học, vẽ 10 chấm trên giấy rồi nối dây lại cũng cho ra kết quả chính xác 45 cạnh!',
    timestamp: '2 giờ trước',
    likes: 12,
    replies: 2,
    avatarSeed: 'triet',
  },
  {
    id: 'disc-2',
    problemId: 'alg-a01',
    problemTitle: 'Cực trị của biểu thức phân số',
    user: 'Thầy Hoàng (Mentor)',
    role: 'Mentor',
    content: 'Lưu ý cực kỳ quan trọng cho các bạn thi Chuyên: Khi dùng Cauchy-Schwarz hay AM-GM dạng phân số, ĐỒNG ĐỀU ĐIỀU KIỆN xảy ra dấu bằng là tiên quyết. Tránh trường hợp chọn điểm rơi tầm thường mà không đối chiếu điều kiện $a+b+c=1$.',
    timestamp: '1 ngày trước',
    likes: 34,
    replies: 5,
    avatarSeed: 'hoang',
  },
];

// --- REAL-TIME LIVE STATISTICS STATE & SIMULATOR ---
const liveStats = {
  activeUsers: 0,
  testsCompleted: 0,
  activeContestsCount: 0,
  facebookAcquisitions: 0,
  tiktokAcquisitions: 0,
  youtubeAcquisitions: 0,
  improvementRate: 0
};

// Background simulation disabled to keep stats clean without demo data
/*
setInterval(() => {
  // Active users hover and fluctuate between 1,200 and 1,800
  const userDelta = Math.floor(Math.random() * 7) - 3; // -3 to +3
  liveStats.activeUsers = Math.max(1200, Math.min(1800, liveStats.activeUsers + userDelta));

  // Small increments to simulate real-time social channel acquisitions
  if (Math.random() > 0.75) liveStats.facebookAcquisitions += 1;
  if (Math.random() > 0.8) liveStats.tiktokAcquisitions += 1;
  if (Math.random() > 0.85) liveStats.youtubeAcquisitions += 1;

  // Occasional completed tests (representing other users completing their IRT test)
  if (Math.random() > 0.92) liveStats.testsCompleted += 1;
}, 4000);
*/

// --- API ENDPOINTS ---

// Get real-time live statistics
app.get('/api/live-stats', (req, res) => {
  res.json(liveStats);
});

// Post live user activity events
app.post('/api/live-stats/event', (req, res) => {
  const { event } = req.body;
  if (event === 'test-completed') {
    liveStats.testsCompleted += 1;
    liveStats.activeUsers = Math.min(1800, liveStats.activeUsers + 1);
  } else if (event === 'problem-solved') {
    // Solve event reflects on active users engagement
    if (Math.random() > 0.5) {
      liveStats.improvementRate = Math.min(99.9, +(liveStats.improvementRate + 0.01).toFixed(2));
    }
  } else if (event === 'user-joined') {
    liveStats.activeUsers = Math.min(1800, liveStats.activeUsers + 1);
  }
  res.json({ success: true, liveStats });
});

// Get all problems
app.get('/api/problems', (req, res) => {
  res.json(problems);
});

// AI Personalization Layer: Recommend adaptive tasks based on student metrics
app.post('/api/recommend', async (req, res) => {
  const { points, completedCount, accuracy, skills } = req.body;

  // Find user weaknesses or top opportunities
  const skillValues = Object.entries(skills || {}) as [string, number][];
  skillValues.sort((a, b) => a[1] - b[1]); // Sort lowest to highest
  const weakestTopic = skillValues[0] ? skillValues[0][0] : 'Combinatorics';
  const weakestValue = skillValues[0] ? skillValues[0][1] : 40;

  // Determine target level
  let targetLevel: 'Foundation' | 'Advanced' | 'Olympiad' = 'Foundation';
  if (points > 300) targetLevel = 'Olympiad';
  else if (points > 100) targetLevel = 'Advanced';

  const ai = getAI();
  if (ai) {
    try {
      const prompt = `Bạn là một hệ thống Trí tuệ Nhân tạo thông minh "EduReach Core" nằm trong nền tảng học Toán cao cấp Calculix Hub.
Nhiệm vụ của bạn là đưa ra một phân tích học tập ĐỘC ĐÁO, CÁ NHÂN HÓA cho học sinh dựa trên thống kê năng lực hiện tại:
- Điểm số tích lũy: ${points} điểm
- Số bài hoàn thành: ${completedCount} bài
- Tỷ lệ chính xác trung bình: ${accuracy}%
- Bản đồ kỹ năng hiện tại:
  + Algebra (Đại số): ${skills?.Algebra ?? 50}%
  + Geometry (Hình học): ${skills?.Geometry ?? 50}%
  + Combinatorics (Tổ hợp): ${skills?.Combinatorics ?? 50}%
  + Number Theory (Số học): ${skills?.['Number Theory'] ?? 50}%

Dựa trên dữ liệu này:
1. Đọc vị điểm yếu nhất của học sinh (đang xếp thứ tự: ${weakestTopic} là thấp nhất, đạt ${weakestValue}%).
2. Hãy gợi ý một hướng phát triển và khích lệ người học bằng phong cách học thuật truyền cảm hứng nhưng rất nghiêm túc, đậm chất chuyên gia.
3. Xuất kết quả dưới cấu trúc JSON chuẩn (chỉ chứa JSON thuần túy, không có mã markdown \`\`\`json ở ngoài). Cấu trúc:
{
  "recommendation": "Lời nhận định phân tích thông minh đầy cảm hứng về điểm mạnh, điểm yếu và xu hướng",
  "recommendedTopic": "${weakestTopic}",
  "suggestedLevel": "${targetLevel}",
  "rationale": "Lý giải tường tận khoa học vì sao nên tập trung cải thiện kỹ năng này ngay bây giờ để bứt phá ranh giới điểm số"
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              recommendation: { type: Type.STRING },
              recommendedTopic: { type: Type.STRING },
              suggestedLevel: { type: Type.STRING },
              rationale: { type: Type.STRING },
            },
            required: ['recommendation', 'recommendedTopic', 'suggestedLevel', 'rationale'],
          },
        },
      });

      const parsed = JSON.parse(response.text?.trim() || '{}');
      parsed.isFallback = false;
      return res.json(parsed);
    } catch (e: any) {
      handleGeminiError('Recommendation Generation', e);
      // Fallback below
    }
  }

  // High-fidelity fallback recommendations when API Key is missing or errored
  const genericRecommendations: Record<string, any> = {
    'Combinatorics': {
      recommendation: `Bản đồ năng lực chỉ ra rằng khả năng suy luận Đại số của bạn khá vững vàng, tuy nhiên kỹ năng Đếm và phân tích Tổ hợp (${weakestValue}%) đang là rào cản chính. Bạn cần gia cố nền tảng vách ngăn và chu kỳ hoán vị lượng để tối đa hóa điểm số.`,
      recommendedTopic: 'Combinatorics',
      suggestedLevel: targetLevel,
      rationale: 'Nâng cao tư duy xây dựng mô hình rời rạc sẽ giúp bạn giải quyết các câu hỏi khó nhất trong đề thi AMC và Olympic.',
    },
    'Geometry': {
      recommendation: `Bạn có trực giác đại số xuất sắc nhưng Hình học (${weakestValue}%) đang là "điểm mù" của bạn. Việc vẽ thêm đường phụ hoặc áp dụng linh hoạt định lý Ptolemy/Brahmagupta chưa đạt phản xạ tối ưu.`,
      recommendedTopic: 'Geometry',
      suggestedLevel: targetLevel,
      rationale: 'Mục tiêu cải thiện 15% kỹ năng Hình học sẽ giúp đạt cực trị hiệu suất rèn luyện.',
    },
    'Algebra': {
      recommendation: `Đại số (${weakestValue}%) đang là thử thách chính của bạn trong nấc thang học tập hiện tại. Các dạng bài bất đẳng thức hàm số chưa thực sự thuần thục điểm rơi.`,
      recommendedTopic: 'Algebra',
      suggestedLevel: targetLevel,
      rationale: 'Học cách biến đổi đại số tương đương và phân tích đa thức thành nhân tử giúp ích cho mọi phân môn khác.',
    },
    'Number Theory': {
      recommendation: `Các quy luật đồng dư đại số và tính chất số nguyên tốt trong Số học (${weakestValue}%) đang kìm hãm thành tích tổng thể của bạn.`,
      recommendedTopic: 'Number Theory',
      suggestedLevel: targetLevel,
      rationale: 'Nắm chắc hàm phi Euler và định lý dư số Trung Hoa sẽ giải phóng tư duy số nguyên của bạn.',
    },
  };

  const defaultRec = genericRecommendations[weakestTopic] || genericRecommendations['Combinatorics'];
  res.json({
    ...defaultRec,
    isFallback: true
  });
});

// API endpoint: Smart Feedback for solutions & formulas submitted by student
app.post('/api/evaluate', async (req, res) => {
  const { problemId, userAnswer } = req.body;

  const problem = problems.find((p) => p.id === problemId);
  if (!problem) {
    return res.status(404).json({ error: 'Không tìm thấy bài tập này!' });
  }

  const cleanAnswer = userAnswer?.trim().toLowerCase();
  const cleanCorrect = problem.correctAnswer.trim().toLowerCase();
  const isCorrect = cleanAnswer === cleanCorrect;

  const ai = getAI();
  if (ai) {
    try {
      const prompt = `Bạn là một Giáo sư Toán học xuất chúng kiêm Trợ lý AI giáo dục thông minh tại Calculix Hub.
Bạn cần đánh giá câu trả lời của học sinh cho bài toán sau:
- Tên bài toán: "${problem.title}"
- Chủ đề: ${problem.topic}
- Cấp độ: ${problem.level}
- Đề bài: "${problem.question}"
- Lời giải mẫu của hệ thống: "${problem.solution}"
- Học sinh nhập đáp án là: "${userAnswer}"
- Kết quả kiểm tra đáp án tự động: ${isCorrect ? 'ĐÚNG' : 'SAI'} (đáp án chính xác mong đợi là: "${problem.correctAnswer}")

Hãy phân tích kết quả này một cách tế nhị, thông thái, mang tính học thuật cao:
1. Nếu ĐÚNG: Khen ngợi ngắn gọn cách tiếp cận, chỉ ra vẻ đẹp của phương pháp toán học được dùng (ví dụ: định lý Viète hay Brahmagupta), và khích lệ tư duy mở rộng.
2. Nếu SAI: Hãy ôn tồn phân tích xem học sinh có thể đã mắc sai sót ở bước nào (ví dụ: nhầm lẫn đếm hoán vị, quên ranh giới điểm rơi, tính toán nhầm lũy thừa lượng cực...) và chỉ ra một manh mối mở (không giải hẳn ra) để họ tự sửa.
3. Xuất ra JSON chuẩn (không chứa markdown \`\`\`json):
{
  "correct": ${isCorrect},
  "explanation": "Nhận xét chi tiết học thuật chất lượng cao về câu trả lời của học sinh.",
  "guidance": "Gợi ý hoặc thử thách tiếp theo để rèn luyện thói quen tư duy chống lỗi sai."
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              correct: { type: Type.BOOLEAN },
              explanation: { type: Type.STRING },
              guidance: { type: Type.STRING },
            },
            required: ['correct', 'explanation', 'guidance'],
          },
        },
      });

      const parsed = JSON.parse(response.text?.trim() || '{}');
      return res.json(parsed);
    } catch (e: any) {
      handleGeminiError('Result Evaluation', e);
    }
  }

  // High-fidelity fallback smart feedback
  let explanation = '';
  let guidance = '';

  if (isCorrect) {
    explanation = `Đáp án của bạn chính xác tuyệt đối! Bạn đã phân tích thấu đáo cấu trúc logic của bài toán chủ đề ${problem.topic}.`;
    guidance = `Hãy tiếp tục thử thách bản thân với mức độ ${problem.level === 'Foundation' ? 'Advanced' : 'Olympiad'} tiếp theo!`;
  } else {
    explanation = `Rất tiếc, câu trả lời "${userAnswer}" chưa chính xác. Bạn dường như đã bị vấp ở các phép tính trung gian hoặc chưa áp dụng đúng mẹo từ gợi ý.`;
    guidance = `Gợi ý: ${problem.hint} - Hãy thử nháp lại cẩn thận từng bước nhé!`;
  }

  res.json({
    correct: isCorrect,
    explanation,
    guidance,
  });
});

// API endpoint: Ask the Math Tutor Chatbot
app.post('/api/chat', async (req, res) => {
  const { message, history } = req.body;

  const ai = getAI();
  if (ai) {
    try {
      const prompt = `Bạn là "Calculix AI Tutor" - Người thầy dạy toán huyền thoại, cực kỳ uyên bác, ân cần nhưng đầy tính khoa học, luôn kích thích tư duy người học bằng phương pháp Socratic thay vì chỉ đưa ra đáp án trực tiếp.
Bạn đang trò chuyện với một học sinh trung học say mê rèn luyện tư duy toán chất lượng cao.
Hãy giao tiếp hoàn toàn bằng tiếng Việt tự nhiên, rõ ràng, giàu tính học thuật nhưng dễ tiếp thu. Sử dụng biểu thức toán học định dạng LaTeX nếu cần thiết (ví dụ: $x^2$, $\\frac{a}{b}$).

Tin nhắn mới nhất của học sinh: "${message}"

Hãy trả lời thật súc tích, tinh tế và tập trung hỗ trợ rèn luyện sâu sắc.`;

      // Simulating a structured call
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          temperature: 0.7,
        },
      });

      return res.json({ reply: response.text || 'Thầy rất tiếc chưa xử lý được câu hỏi lúc này, hãy thử hỏi lại nhé!' });
    } catch (e: any) {
      handleGeminiError('Tutor Chat', e);
    }
  }

  // Fallback Tutor answers
  let reply = `Chào bạn! Thầy là Calculix AI Tutor. Thầy luôn ở đây để giúp bạn khai mở vẻ đẹp kỳ diệu của Toán học. 
Hiện tại khóa kết nối AI chính sinh động đang bảo trì, nhưng thầy có thể gợi ý cho bạn:
- Hãy làm chủ phần **Đại số** bằng cách rèn luyện các biểu thức đối xứng.
- Đối với **Hình học**, việc dựng hình phụ luôn là chìa khóa mở lối các góc khuất.
- Bạn có câu hỏi cụ thể nào về bài toán bắt tay hay bất đẳng thức Cauchy-Schwarz không?`;

  const normalizedMessage = message.toLowerCase();
  if (normalizedMessage.includes('bắt tay') || normalizedMessage.includes('handshake')) {
    reply = `Để thầy giải thích bài toán Bắt tay nhé! Đại thể, nếu có $n$ người, người thứ nhất bắt với $n-1$ người khác, người thứ hai bắt với $n-2$ người (tránh bắt lại với người thứ nhất), vân vân. 
Công thức tổng quát cho số cái bắt tay là: $S = \\frac{n(n-1)}{2}$. Với $n=10$, ta có $\\frac{10 \\times 9}{2} = 45$. Đây chính là sự quyến rũ của Tổ hợp học đấy!`;
  } else if (normalizedMessage.includes('cauchy') || normalizedMessage.includes('am-gm') || normalizedMessage.includes('bất đẳng thức')) {
    reply = `Phát biểu xuất sắc! Bất đẳng thức AM-GM (Trung bình cộng - Trung bình nhân) cho các số thực dương $x_1, x_2, \\dots, x_n$ có dạng:
$\\frac{x_1 + x_2 + \\dots + x_n}{n} \\ge \\sqrt[n]{x_1 x_2 \\dots x_n}$
Dấu bằng xảy ra khi và chỉ khi tất cả các số bằng nhau. Trong bài toán cực trị $P = 1/a + 1/b + 1/c$ với $a+b+c=1$, dấu bằng đạt được khi $a=b=c=1/3$, cho giá trị tối thiểu là 9. Một kết quả tuyệt vời và cân xứng cực điểm!`;
  }

  res.json({ reply });
});

// Express route for user metadata & details
app.get('/api/statistics-seed', (req, res) => {
  res.json({
    leaderboard: initialLeaderboard,
    weeklyChallenges: initialWeeklyChallenges,
    contests: initialContests,
    discussions: [],
  });
});

// Configure Vite middleware in development or static hosting in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Attempt to listen and retry on EADDRINUSE by incrementing the port
  async function attemptListen(port: number, host = '0.0.0.0', attempts = 10): Promise<any> {
    return new Promise((resolve, reject) => {
      const srv = app.listen(port, host, () => {
        console.log(`[Calculix Hub] Server running at http://localhost:${port}`);
        resolve(srv);
      });

      srv.on('error', (err: any) => {
        if (err && err.code === 'EADDRINUSE') {
          console.warn(`[Calculix Hub] Port ${port} in use, trying ${port + 1}...`);
          try {
            srv.close();
          } catch (e) {}
          if (attempts > 1) {
            // small delay before retrying
            setTimeout(() => {
              attemptListen(port + 1, host, attempts - 1).then(resolve).catch(reject);
            }, 200);
          } else {
            reject(err);
          }
        } else {
          reject(err);
        }
      });
    });
  }

  try {
    await attemptListen(PORT, '0.0.0.0', 10);
  } catch (e: any) {
    console.error('[Calculix Hub] Failed to bind to a port:', e && (e.message || e));
    process.exit(1);
  }
}

startServer();
