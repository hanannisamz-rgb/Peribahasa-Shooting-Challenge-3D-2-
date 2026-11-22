export type AnswerOptionKey = 'A' | 'B' | 'C';

export interface ProverbOption {
  key: AnswerOptionKey;
  text: string;
}

export interface ProverbQuestion {
  id: number;
  stageNumber: number;
  stageName: string;
  stageSubtitle: string;
  peribahasa: string;
  prompt: string;
  options: ProverbOption[];
  correctKey: AnswerOptionKey;
  explanation: string;
  themeColors: {
    skyHex: number;
    fogHex: number;
    accentHex: number;
    secondaryHex: number;
    ringHex: number;
  };
  /**
   * 3 spatial slot coordinates [x, y, z] in the arena for A, B, C
   * arranged distinctly per stage so the correct answer is never in the same spot.
   */
  targetPositions: [
    [number, number, number],
    [number, number, number],
    [number, number, number],
  ];
  /** Optional gentle oscillation pattern per stage */
  targetMotion: 'hover' | 'staggered' | 'elevated' | 'pillars' | 'garden' | 'orbit' | 'championship';
}

export interface AchievementBadge {
  id: string;
  name: string;
  description: string;
  requiredCorrect: number;
  accentColor: string;
}

export const ACHIEVEMENT_BADGES: AchievementBadge[] = [
  {
    id: 'penembak-baharu',
    name: 'Penembak Baharu',
    description: 'Berjaya menewaskan sasaran pertama dengan tepat.',
    requiredCorrect: 1,
    accentColor: '#38BDF8',
  },
  {
    id: 'pemburu-peribahasa',
    name: 'Pemburu Peribahasa',
    description: 'Menjawab 3 soalan peribahasa dengan cemerlang.',
    requiredCorrect: 3,
    accentColor: '#818CF8',
  },
  {
    id: 'pakar-sasaran',
    name: 'Pakar Sasaran',
    description: 'Mengumpul 50 mata dengan ketepatan tinggi.',
    requiredCorrect: 5,
    accentColor: '#22D3EE',
  },
  {
    id: 'juara-arena',
    name: 'Juara Arena',
    description: 'Menakluki kesemua 7 tahap arena futuristik.',
    requiredCorrect: 7,
    accentColor: '#A855F7',
  },
  {
    id: 'wira-peribahasa',
    name: 'Wira Peribahasa',
    description: 'Mengumpul 70/70 mata penuh dan menjadi wira bahasa.',
    requiredCorrect: 7,
    accentColor: '#FBBF24',
  },
];

export const PROVERB_QUESTIONS: ProverbQuestion[] = [
  {
    id: 1,
    stageNumber: 1,
    stageName: 'Tahap 1: Arena Permulaan',
    stageSubtitle: 'Zon Latihan Bandar Raya Cyber',
    peribahasa: '“Tidak lapuk dek hujan, tidak lekang dek panas.”',
    prompt: 'Apakah maksud peribahasa tersebut?',
    options: [
      { key: 'A', text: 'Sesuatu yang mudah rosak apabila terkena hujan.' },
      {
        key: 'B',
        text: 'Sesuatu yang tetap utuh dan tidak berubah walaupun menghadapi perubahan zaman.',
      },
      { key: 'C', text: 'Sesuatu yang hanya bertahan untuk tempoh yang singkat.' },
    ],
    correctKey: 'B',
    explanation:
      'Adat, budaya atau perkara yang baik terus kekal diamalkan walaupun zaman silih berganti.',
    themeColors: {
      skyHex: 0x0a1638,
      fogHex: 0x0c1b44,
      accentHex: 0x00e5ff,
      secondaryHex: 0x6366f1,
      ringHex: 0x38bdf8,
    },
    // Correct (B) is on Center-Right elevated
    targetPositions: [
      [-10.5, 4.2, -16],
      [0, 5.2, -19],
      [10.5, 4.2, -16],
    ],
    targetMotion: 'hover',
  },
  {
    id: 2,
    stageNumber: 2,
    stageName: 'Tahap 2: Bandar Neon',
    stageSubtitle: 'Laluan Cahaya Biru & Ungu',
    peribahasa: '“Lain padang, lain belalang.”',
    prompt: 'Apakah maksud peribahasa tersebut?',
    options: [
      {
        key: 'A',
        text: 'Setiap tempat mempunyai adat resam, budaya dan peraturan yang berbeza.',
      },
      { key: 'B', text: 'Semua tempat mempunyai keadaan yang sama.' },
      { key: 'C', text: 'Setiap orang mempunyai makanan kegemaran yang berbeza.' },
    ],
    correctKey: 'A',
    explanation:
      'Setiap negeri, kampung atau masyarakat mempunyai cara hidup dan peraturan yang tersendiri.',
    themeColors: {
      skyHex: 0x130e3a,
      fogHex: 0x18124a,
      accentHex: 0x22d3ee,
      secondaryHex: 0xa855f7,
      ringHex: 0xc084fc,
    },
    // Correct (A) placed on Right; B left-high; C center-low
    targetPositions: [
      [11.5, 5.5, -18],
      [-11.0, 6.2, -15],
      [-0.5, 3.8, -22],
    ],
    targetMotion: 'staggered',
  },
  {
    id: 3,
    stageNumber: 3,
    stageName: 'Tahap 3: Zon Digital',
    stageSubtitle: 'Platform Apungan Hologram',
    peribahasa: '“Adat lama pusaka usang.”',
    prompt: 'Apakah maksud peribahasa tersebut?',
    options: [
      {
        key: 'A',
        text: 'Adat atau amalan lama yang diwarisi secara turun-temurun.',
      },
      { key: 'B', text: 'Adat baharu yang baru diperkenalkan.' },
      { key: 'C', text: 'Amalan yang tidak pernah dilakukan oleh masyarakat.' },
    ],
    correctKey: 'A',
    explanation:
      'Tradisi dan amalan murni nenek moyang yang diwariskan dari satu generasi ke generasi seterusnya.',
    themeColors: {
      skyHex: 0x071d3d,
      fogHex: 0x0a254d,
      accentHex: 0x06b6d4,
      secondaryHex: 0x3b82f6,
      ringHex: 0x67e8f9,
    },
    // Correct (A) placed on Left-High; B Center-Far; C Right-Low
    targetPositions: [
      [-12.0, 6.8, -17],
      [0.5, 4.4, -23],
      [11.5, 4.0, -15],
    ],
    targetMotion: 'elevated',
  },
  {
    id: 4,
    stageNumber: 4,
    stageName: 'Tahap 4: Menara Teknologi',
    stageSubtitle: 'Menara Kuasa Siber Kota',
    peribahasa: '“Bagai aur dengan tebing.”',
    prompt: 'Apakah maksud peribahasa tersebut?',
    options: [
      {
        key: 'A',
        text: 'Saling membantu dan bekerjasama antara satu sama lain.',
      },
      { key: 'B', text: 'Suka melakukan kerja secara bersendirian.' },
      { key: 'C', text: 'Tidak mengambil berat terhadap orang lain.' },
    ],
    correctKey: 'A',
    explanation:
      'Seperti rumpun buluh yang menguatkan tebing sungai, kita perlu saling membantu dalam hidup bermasyarakat.',
    themeColors: {
      skyHex: 0x160f3d,
      fogHex: 0x1e1452,
      accentHex: 0x8b5cf6,
      secondaryHex: 0x00e5ff,
      ringHex: 0x38bdf8,
    },
    // Correct (A) placed on Center-High; B Left-Mid; C Right-High
    targetPositions: [
      [0, 7.2, -20],
      [-11.8, 4.3, -16],
      [12.2, 5.8, -19],
    ],
    targetMotion: 'pillars',
  },
  {
    id: 5,
    stageNumber: 5,
    stageName: 'Tahap 5: Taman Futuristik',
    stageSubtitle: 'Taman Cahaya & Air Pancut Tenaga',
    peribahasa: '“Bagai katak di bawah tempurung.”',
    prompt: 'Apakah maksud peribahasa tersebut?',
    options: [
      { key: 'A', text: 'Orang yang suka meneroka tempat baharu.' },
      {
        key: 'B',
        text: 'Orang yang kurang pengetahuan tentang perkara yang berlaku di sekelilingnya.',
      },
      { key: 'C', text: 'Orang yang mempunyai banyak pengalaman.' },
    ],
    correctKey: 'B',
    explanation:
      'Seseorang yang sempit pengetahuannya kerana tidak mengikuti perkembangan dunia luar.',
    themeColors: {
      skyHex: 0x0a2142,
      fogHex: 0x0f2c56,
      accentHex: 0x2dd4bf,
      secondaryHex: 0x7c3aed,
      ringHex: 0x5eead4,
    },
    // Correct (B) placed on Left-Mid; A Right-Mid; C Center-High
    targetPositions: [
      [12.0, 5.0, -17],
      [-12.5, 4.8, -18],
      [0, 6.8, -22],
    ],
    targetMotion: 'garden',
  },
  {
    id: 6,
    stageNumber: 6,
    stageName: 'Tahap 6: Pusat Kawalan',
    stageSubtitle: 'Gelanggang Gelung Tenaga Berputar',
    peribahasa: '“Menatang minyak yang penuh.”',
    prompt: 'Apakah maksud peribahasa tersebut?',
    options: [
      {
        key: 'A',
        text: 'Menjaga seseorang dengan penuh kasih sayang dan berhati-hati.',
      },
      { key: 'B', text: 'Membazirkan minyak untuk memasak.' },
      { key: 'C', text: 'Membiarkan seseorang melakukan sesuatu sendiri.' },
    ],
    correctKey: 'A',
    explanation:
      'Memelihara dan mendidik seseorang dengan penuh perhatian, cermat serta kasih sayang.',
    themeColors: {
      skyHex: 0x1a1045,
      fogHex: 0x24165c,
      accentHex: 0x38bdf8,
      secondaryHex: 0xc026d3,
      ringHex: 0xe879f9,
    },
    // Correct (A) placed on Right-Elevated; B Left-Elevated; C Center-Mid
    targetPositions: [
      [11.5, 6.6, -18],
      [-11.5, 5.6, -18],
      [0, 4.4, -21],
    ],
    targetMotion: 'orbit',
  },
  {
    id: 7,
    stageNumber: 7,
    stageName: 'Tahap 7: Arena Juara',
    stageSubtitle: 'Pentas Akhir Wira Peribahasa',
    peribahasa: '“Sedikit-sedikit, lama-lama jadi bukit.”',
    prompt: 'Apakah maksud peribahasa tersebut?',
    options: [
      { key: 'A', text: 'Sesuatu yang kecil tidak mempunyai nilai.' },
      {
        key: 'B',
        text: 'Usaha atau simpanan yang dilakukan sedikit demi sedikit akhirnya akan menghasilkan sesuatu yang banyak.',
      },
      { key: 'C', text: 'Sesuatu yang besar boleh menjadi kecil.' },
    ],
    correctKey: 'B',
    explanation:
      'Ketekunan berusaha atau menabung sedikit demi sedikit akhirnya membuahkan kejayaan yang besar.',
    themeColors: {
      skyHex: 0x120f42,
      fogHex: 0x1c175e,
      accentHex: 0x00f0ff,
      secondaryHex: 0xa855f7,
      ringHex: 0xfbbf24,
    },
    // Correct (B) placed on Center-Crown; A Left-High; C Right-High
    targetPositions: [
      [-12.5, 5.6, -18],
      [0, 7.4, -21],
      [12.5, 5.6, -18],
    ],
    targetMotion: 'championship',
  },
];
