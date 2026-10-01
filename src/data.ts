// Dữ liệu game: màu, con vật, token đánh vần, số.
// Quy tắc: nền pastel, thứ bấm được màu bão hoà (xem research/report.md mục 2).

// Tông "tươi sáng": cỏ lime pastel, nước xanh trong, cây xanh đậm hơn cỏ một chút cho có lớp.
export const PALETTE = {
  sky: 0xfff4e4,
  grassTop: 0xc6e88e,
  grassDark: 0xa2d276,
  leaf: 0x8fd072,      // tán cây (thay teal của Kenney), mỗi cây jitter nhẹ
  grassProp: 0xaee08a, // bụi, cỏ, đế đá
  bark: 0xd49a6e,      // thân cây, đất
  sand: 0xf1ddb0,
  water: 0x9edff2,
  waterRim: 0xcdeef8,
  waterShade: 0x84cfe6,
  roof: 0xe8876a,
  wall: 0xfffaf0,
  ink: 0x3b3220,
  accent: 0xff9600,
  success: 0x58cc02,
  error: 0xda5e4e,
} as const;

export interface SpellToken {
  audio: string;   // khoá file audio
  lit: number[];   // chỉ số chữ cái được tô sáng khi token phát
}

export interface AnimalDef {
  id: string;           // khoá audio: name_<id>, ask_<id>; token đánh vần ghi rõ trong tokens
  model: string;        // file trong public/models
  word: string;         // chữ hiển thị
  height: number;       // chiều cao sau normalize (nhà cao ~2.2)
  tokens: SpellToken[];
  pos: [number, number, number];
  rotY: number;
  /** đi lang thang: clip đi (không có thì lạch bạch bằng code), tốc độ (đv/s) */
  walk?: string;
  speed: number;
  /** clip "làm trò" thỉnh thoảng chơi khi đứng (ăn cỏ, nhảy, múa...) */
  acts: string[];
  /** đổi màu material theo tên (vd. mèo Mun đen, mèo Rơm vàng cam) */
  tint?: Record<string, number>;
}

/*
 * Đánh vần theo GDPT 2018 (Kết nối tri thức / Cánh Diều):
 *  - vần 1 chữ (o, a): đánh vần tiếng luôn: bờ – o – bo – huyền – bò
 *  - vần 2+ chữ (eo): đánh vần vần trước: e – o – eo, rồi tiếng: hờ – eo – heo
 *  - tiếng có thanh: ... – tiếng không dấu – tên dấu – tiếng
 * Gọi phụ âm theo ÂM (bờ, cờ, hờ, gờ, chờ), không theo tên chữ (bê, xê).
 */
const MEO_TOKENS: SpellToken[] = [
  { audio: 't_meo_1', lit: [1] },        // e
  { audio: 't_meo_2', lit: [2] },        // o
  { audio: 't_meo_3', lit: [1, 2] },     // eo
  { audio: 't_meo_4', lit: [0] },        // mờ
  { audio: 't_meo_5', lit: [1, 2] },     // eo
  { audio: 't_meo_6', lit: [0, 1, 2] },  // meo
  { audio: 't_meo_7', lit: [1] },        // huyền
  { audio: 't_meo_8', lit: [0, 1, 2] },  // mèo
];

export const ANIMALS: AnimalDef[] = [
  {
    id: 'bo', model: 'cow.glb', word: 'bò', height: 1.15,
    tokens: [
      { audio: 't_bo_1', lit: [0] },      // bờ
      { audio: 't_bo_2', lit: [1] },      // o
      { audio: 't_bo_3', lit: [0, 1] },   // bo
      { audio: 't_bo_4', lit: [1] },      // huyền
      { audio: 't_bo_5', lit: [0, 1] },   // bò
    ],
    pos: [-2.2, 0, 1.0], rotY: Math.PI * 0.55,
    walk: 'WalkSlow', speed: 0.42, acts: ['Jump'],
  },
  {
    id: 'heo', model: 'pig.glb', word: 'heo', height: 0.85,
    tokens: [
      { audio: 't_heo_1', lit: [1] },        // e
      { audio: 't_heo_2', lit: [2] },        // o
      { audio: 't_heo_3', lit: [1, 2] },     // eo
      { audio: 't_heo_4', lit: [0] },        // hờ
      { audio: 't_heo_5', lit: [1, 2] },     // eo
      { audio: 't_heo_6', lit: [0, 1, 2] },  // heo
    ],
    pos: [0.4, 0, 2.2], rotY: Math.PI * 0.5,
    speed: 0.38, acts: ['Jump'],
  },
  {
    id: 'ga', model: 'chicken.glb', word: 'gà', height: 0.7,
    tokens: [
      { audio: 't_ga_1', lit: [0] },      // gờ
      { audio: 't_ga_2', lit: [1] },      // a
      { audio: 't_ga_3', lit: [0, 1] },   // ga
      { audio: 't_ga_4', lit: [1] },      // huyền
      { audio: 't_ga_5', lit: [0, 1] },   // gà
    ],
    pos: [2.6, 0, 0.9], rotY: Math.PI * 0.45,
    walk: 'Walk', speed: 0.5, acts: ['Bite_Front', 'Yes', 'Dance'],
  },
  {
    id: 'cho', model: 'dog.glb', word: 'chó', height: 0.8,
    tokens: [
      { audio: 't_cho_1', lit: [0, 1] },     // chờ
      { audio: 't_cho_2', lit: [2] },        // o
      { audio: 't_cho_3', lit: [0, 1, 2] },  // cho
      { audio: 't_cho_4', lit: [2] },        // sắc
      { audio: 't_cho_5', lit: [0, 1, 2] },  // chó
    ],
    pos: [0.2, 0, -0.4], rotY: Math.PI * 0.4,
    walk: 'AnimalArmature|Walk', speed: 0.6, acts: ['AnimalArmature|Eating', 'AnimalArmature|Idle_2_HeadLow', 'AnimalArmature|Jump_ToIdle'],
  },
  // Hai bé mèo nhà Nhím. Cùng từ "mèo" nên dùng chung token t_meo_*; tên riêng ở name_mun / name_rom.
  // Vần 2 chữ (eo) + thanh huyền: e – o – eo – mờ – eo – meo – huyền – mèo
  {
    id: 'mun', model: 'cat.glb', word: 'mèo', height: 0.72,
    tokens: MEO_TOKENS,
    pos: [-1.0, 0, 2.5], rotY: Math.PI * 0.3,
    walk: 'Walk', speed: 0.55, acts: ['Yes', 'Dance', 'Bite_Front'],
    tint: { Cat_Main: 0x3a3a44, Cat_Secondary: 0x26262d },
  },
  {
    id: 'rom', model: 'cat.glb', word: 'mèo', height: 0.72,
    tokens: MEO_TOKENS,
    pos: [2.1, 0, 2.2], rotY: Math.PI * 0.6,
    walk: 'Walk', speed: 0.55, acts: ['Yes', 'Dance', 'Bite_Front'],
    tint: { Cat_Main: 0xf3a64e, Cat_Secondary: 0xd8742a },
  },
];

export const NUMBER_AUDIO = ['', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8', 'n9', 'n10'];

export const APPLE_HEIGHT = 0.5;

/** Vị trí táo theo lưới trên bãi cỏ trước (để bé chạm từng quả không nhầm). */
export const APPLE_SLOTS: [number, number, number][] = [
  [-2.4, 0, 1.8], [-1.2, 0, 2.2], [0.0, 0, 2.4], [1.2, 0, 2.2], [2.4, 0, 1.8],
  [-2.0, 0, 0.2], [-0.9, 0, 0.5], [0.3, 0, 0.6], [1.5, 0, 0.5], [2.6, 0, 0.1],
];
