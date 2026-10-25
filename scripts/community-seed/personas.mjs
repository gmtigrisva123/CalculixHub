/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The learners who write the opening Community Solutions threads.
 *
 * `joined` is days before the seed is applied; every persona joins before the
 * first thread they take part in, which build.mjs checks.
 */

export const personas = [
  { handle: 'minh_khoa_math', name: 'Minh Khoa', country: 'Vietnam', level: 'Advanced', joined: 41, bio: 'AIME prep. Number theory is my comfort food.' },
  { handle: 'priya_sundar07', name: 'Priya Sundar', country: 'India', level: 'Olympiad', joined: 44, bio: 'Geometry is algebra wearing a costume.' },
  { handle: 'leo_hartmann', name: 'Leo Hartmann', country: 'Germany', level: 'Advanced', joined: 39, bio: 'Inequalities, chess, too much coffee.' },
  { handle: 'ananya_rk', name: 'Ananya R.', country: 'India', level: 'Intermediate', joined: 33, bio: 'Slowly turning wrong answers into right ones.' },
  { handle: 'jaden_okafor', name: 'Jaden Okafor', country: 'Nigeria', level: 'Advanced', joined: 40, bio: 'Combinatorics > sleep.' },
  { handle: 'sofia_marques_mt', name: 'Sofia Marques', country: 'Brazil', level: 'Intermediate', joined: 30, bio: 'OBMEP survivor. Learning to write proofs properly.' },
  { handle: 'hana_yoon22', name: 'Hana Yoon', country: 'South Korea', level: 'Olympiad', joined: 43, bio: 'Functional equations and long walks.' },
  { handle: 'ethan_caldwell9', name: 'Ethan Caldwell', country: 'United States', level: 'Advanced', joined: 38, bio: 'AMC 12 / AIME. I check my arithmetic twice and still miss.' },
  { handle: 'linh_ngoc_tran', name: 'Linh Tran', country: 'Vietnam', level: 'Foundation', joined: 29, bio: 'Grade 9. Asking lots of questions here.' },
  { handle: 'mateo_quispe', name: 'Mateo Quispe', country: 'Peru', level: 'Foundation', joined: 27, bio: 'New to contest math, loving it.' },
  { handle: 'aisha_rahman_m', name: 'Aisha Rahman', country: 'Bangladesh', level: 'Intermediate', joined: 35, bio: 'Counting things for fun.' },
  { handle: 'kuba_wisniewski', name: 'Kuba Wiśniewski', country: 'Poland', level: 'Olympiad', joined: 44, bio: 'Synthetic geometry or nothing. (Okay, sometimes complex numbers.)' },
  { handle: 'chloe_tanaka', name: 'Chloe Tanaka', country: 'Canada', level: 'Foundation', joined: 26, bio: 'Trying AMC 10 this year!' },
  { handle: 'bao_nguyen_17', name: 'Bao Nguyen', country: 'Vietnam', level: 'Intermediate', joined: 34, bio: 'Provincial math team. Mod arithmetic fan.' },
  { handle: 'omar_haddad_x', name: 'Omar Haddad', country: 'Jordan', level: 'Advanced', joined: 37, bio: 'If in doubt, draw it bigger.' },
  { handle: 'isla_mcbride', name: 'Isla McBride', country: 'United Kingdom', level: 'Intermediate', joined: 31, bio: 'UKMT fan. Mostly here for the geometry threads.' },
  { handle: 'arjun_mehta_21', name: 'Arjun Mehta', country: 'India', level: 'Advanced', joined: 42, bio: 'Writes every solution twice: once fast, once right.' },
  { handle: 'meilin_chen', name: 'Mei-Lin Chen', country: 'Taiwan', level: 'Olympiad', joined: 43, bio: 'Polynomials, generating functions, bubble tea.' },
  { handle: 'noah_fischer_b', name: 'Noah Fischer', country: 'Austria', level: 'Foundation', joined: 24, bio: 'Started a month ago. Everything is new and exciting.' },
  { handle: 'zeynep_aydin', name: 'Zeynep Aydın', country: 'Turkey', level: 'Advanced', joined: 36, bio: 'Clean solutions only. (I am lying, mine are messy.)' },
  { handle: 'gabriel_santos3', name: 'Gabriel Santos', country: 'Philippines', level: 'Intermediate', joined: 32, bio: 'PMO hopeful.' },
  { handle: 'duc_anh_pham', name: 'Duc Anh Pham', country: 'Vietnam', level: 'Olympiad', joined: 45, bio: 'VMO training. Happy to help with NT and inequalities.' },
  { handle: 'emma_lindqvist', name: 'Emma Lindqvist', country: 'Sweden', level: 'Intermediate', joined: 30, bio: 'Proof-writing practice, one problem a day.' },
  { handle: 'kofi_mensah_m', name: 'Kofi Mensah', country: 'Ghana', level: 'Foundation', joined: 25, bio: 'Learning the tricks one at a time.' },
  { handle: 'riya_kapoor5', name: 'Riya Kapoor', country: 'India', level: 'Foundation', joined: 23, bio: 'I like problems with pictures.' },
  { handle: 'sam_whitaker', name: 'Sam Whitaker', country: 'Australia', level: 'Intermediate', joined: 33, bio: 'AMO prep. Will trade geometry hints for NT hints.' },
  { handle: 'yuki_morimoto', name: 'Yuki Morimoto', country: 'Japan', level: 'Advanced', joined: 39, bio: 'Short solutions, long thinking.' },
  { handle: 'thao_vy_le', name: 'Thao Vy Le', country: 'Vietnam', level: 'Advanced', joined: 37, bio: 'Counting things is my favourite hobby. Combinatorics girl.' },
  { handle: 'daniel_ivanov8', name: 'Daniel Ivanov', country: 'Bulgaria', level: 'Olympiad', joined: 44, bio: 'Inequalities until they surrender.' },
  { handle: 'maya_goldberg', name: 'Maya Goldberg', country: 'United States', level: 'Foundation', joined: 22, bio: 'Mathcounts → AMC. Here to learn.' },
  { handle: 'rafael_ortiz_v', name: 'Rafael Ortiz', country: 'Mexico', level: 'Intermediate', joined: 34, bio: 'Number theory and football.' },
  { handle: 'farah_iqbal', name: 'Farah Iqbal', country: 'Pakistan', level: 'Advanced', joined: 38, bio: 'I collect alternative solutions.' },
  { handle: 'quang_huy_do', name: 'Quang Huy Do', country: 'Vietnam', level: 'Foundation', joined: 21, bio: 'Grade 8. Getting a little better at math every day.' },
  { handle: 'nina_petrova', name: 'Nina Petrova', country: 'Serbia', level: 'Advanced', joined: 36, bio: 'Graph theory enjoyer.' },
  { handle: 'alex_chung_ca', name: 'Alex Chung', country: 'Canada', level: 'Olympiad', joined: 42, bio: 'Writing up solutions so future me understands them.' },
  { handle: 'gia_han_tran', name: 'Gia Han Tran', country: 'Vietnam', level: 'Intermediate', joined: 28, bio: 'Geometry diagrams are my love language.' },
];
