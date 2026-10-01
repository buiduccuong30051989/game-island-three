// GIA ĐÌNH NHÍM sống trên đảo: Ba Cường, Mẹ Yến, Bà Tuyết, Ông Cương, Bác Hanh lần lượt khen bé.
// Bong bóng trượt vào từ mép phải ~2.5 s (ảnh thật hoặc emoji + tên + câu nói) kèm giọng đọc.
// Ảnh thật: thả public/family/<id>.jpg (hoặc .jpeg/.png/.webp) → tự thay emoji (xem README).
// Danh sách ảnh có sẵn lấy từ module ảo 'virtual:family-photos' (vite.config.ts quét thư mục lúc dev/build)
// → không gọi thử file không tồn tại, console sạch 404.
import photos from 'virtual:family-photos';
import { play, sfx } from './audio';
import { wait } from './tween';

export type FamilyId = 'ba-cuong' | 'me-yen' | 'ba-tuyet' | 'ong-cuong' | 'bac-hanh';

export interface FamilyMember {
  id: FamilyId;
  /** tên hiện trên bong bóng */
  name: string;
  emoji: string;
  /** màu viền bong bóng */
  color: string;
  /** câu khen ngẫu nhiên: [audio key, chữ hiện] (câu đọc đầy đủ ở scripts/audio-manifest.txt) */
  lines: [string, string][];
  /** câu ngắn khi cả nhà lần lượt cổ vũ */
  all: [string, string];
}

export const FAMILY: FamilyMember[] = [
  {
    id: 'ba-cuong', name: 'Ba Cường', emoji: '👨', color: '#2f9df5',
    lines: [['fam_ba_cuong_1', 'Nhím của ba giỏi quá! 👍'], ['fam_ba_cuong_2', 'Ba giơ ngón cái cho Hà An nè! 👍'], ['fam_ba_cuong_3', 'Nhím đọc hay quá! 🎉']],
    all: ['fam_ba_cuong_all', 'Hoan hô Nhím!'],
  },
  {
    id: 'me-yen', name: 'Mẹ Yến', emoji: '👩', color: '#ff5fb4',
    lines: [['fam_me_yen_1', 'Mẹ thơm Nhím một cái! 😘'], ['fam_me_yen_2', 'Hà An của mẹ ngoan quá!'], ['fam_me_yen_3', 'Mẹ thương Nhím nhất trên đời! 💕']],
    all: ['fam_me_yen_all', 'Nhím giỏi nhất!'],
  },
  {
    id: 'ba-tuyet', name: 'Bà Tuyết', emoji: '👵', color: '#8b5cf6',
    lines: [['fam_ba_tuyet_1', 'Bà ôm Nhím thật chặt! 🤗'], ['fam_ba_tuyet_2', 'Cháu bà giỏi quá!'], ['fam_ba_tuyet_3', 'Bà thương Hà An nhiều lắm! 💕']],
    all: ['fam_ba_tuyet_all', 'Bà thương Nhím!'],
  },
  {
    id: 'ong-cuong', name: 'Ông Cương', emoji: '👴', color: '#58a700',
    lines: [['fam_ong_cuong_1', 'Nhím giỏi quá! 👏'], ['fam_ong_cuong_2', 'Ông vỗ tay cho Hà An nè! 👏'], ['fam_ong_cuong_3', 'Ông cười tít mắt vì Nhím! 😄']],
    all: ['fam_ong_cuong_all', 'Tuyệt vời cháu ơi!'],
  },
  {
    id: 'bac-hanh', name: 'Bác Hanh', emoji: '👩‍🦱', color: '#ff9600',
    lines: [['fam_bac_hanh_1', 'Bác thơm Nhím một cái! 😘'], ['fam_bac_hanh_2', 'Hà An thông minh quá!'], ['fam_bac_hanh_3', 'Nhím ơi, hoan hô! 🎉']],
    all: ['fam_bac_hanh_all', 'Thơm Nhím nào!'],
  },
];

/** Mọi audio key của gia đình (tải trước lúc vào game). */
export const FAMILY_KEYS = [...FAMILY.flatMap((m) => [...m.lines.map(([k]) => k), m.all[0]]), 'fam_all', 'fam_house'];

/** URL ảnh thật của 1 người (nếu bố mẹ đã thả ảnh vào public/family/), không thì null. */
export function photoUrl(id: FamilyId): string | null {
  const f = photos[id];
  return f ? `${import.meta.env.BASE_URL}family/${f}` : null;
}

// ------------------------------------------------------------------ bong bóng DOM
let box: HTMLElement | null = null;
function container(): HTMLElement {
  if (!box) {
    box = document.createElement('div');
    box.id = 'family';
    document.body.appendChild(box);
  }
  return box;
}

/** Ô ảnh tròn: ảnh thật nếu có, lỗi tải thì về emoji. */
function avatarEl(m: FamilyMember): HTMLElement {
  const a = document.createElement('div');
  a.className = 'fam-ava';
  a.style.borderColor = m.color;
  const url = photoUrl(m.id);
  if (url) {
    const img = document.createElement('img');
    img.alt = m.name;
    img.src = url;
    img.onerror = () => { img.remove(); a.textContent = m.emoji; };
    a.appendChild(img);
  } else a.textContent = m.emoji;
  return a;
}

function card(m: FamilyMember, text: string, mini: boolean): HTMLElement {
  const c = document.createElement('div');
  c.className = 'fam-card' + (mini ? ' mini' : '');
  c.style.setProperty('--fam', m.color);
  c.appendChild(avatarEl(m));
  const body = document.createElement('div');
  body.className = 'fam-body';
  const name = document.createElement('div');
  name.className = 'fam-name';
  name.textContent = m.name;
  const say = document.createElement('div');
  say.className = 'fam-say';
  say.textContent = text;
  body.append(name, say);
  c.appendChild(body);
  container().appendChild(c);
  return c;
}

function dismiss(c: HTMLElement): void {
  c.classList.add('out');
  setTimeout(() => c.remove(), 450);
}

/** Túi xáo trộn: lần lượt đủ 5 người rồi mới lặp lại (không ai bị "quên"). */
let bag: FamilyMember[] = [];
function nextMember(): FamilyMember {
  if (!bag.length) bag = [...FAMILY].sort(() => Math.random() - 0.5);
  return bag.pop()!;
}

let showing = false;
/** Đang có bong bóng gia đình trên màn. */
export function familyBusy(): boolean { return showing; }

/** Hook để cảnh 3D phản ứng (vd. tim bay trên nhà) khi có người khen. */
let onCheer: ((m: FamilyMember) => void) | null = null;
export function setCheerHook(fn: (m: FamilyMember) => void): void { onCheer = fn; }

/** 1 người nhà khen: bong bóng ~2.5 s + giọng đọc. Resolve khi xong. Đang có bong bóng khác thì bỏ qua. */
export async function familyCheer(alive: () => boolean = () => true): Promise<void> {
  if (showing) return;
  showing = true;
  try {
    const m = nextMember();
    const [key, text] = m.lines[Math.floor(Math.random() * m.lines.length)];
    sfx('sfx_pop', 0.4);
    onCheer?.(m);
    const c = card(m, text, false);
    await Promise.all([alive() ? play(key) : Promise.resolve(), wait(2500)]);
    dismiss(c);
    await wait(250);
  } finally {
    showing = false;
  }
}

/** Cả nhà lần lượt cổ vũ (xong 1 lượt đố): bong bóng xếp chồng, đủ 5 người rồi cùng trượt ra. */
export async function familyCheerAll(alive: () => boolean = () => true): Promise<void> {
  if (showing) return;
  showing = true;
  const cards: HTMLElement[] = [];
  try {
    for (const m of FAMILY) {
      if (!alive()) break;
      sfx('sfx_pop', 0.4);
      onCheer?.(m);
      cards.push(card(m, m.all[1], true));
      await Promise.all([play(m.all[0]), wait(1300)]);
    }
    if (alive()) await play('fam_all');
    await wait(500);
  } finally {
    cards.forEach((c, i) => setTimeout(() => dismiss(c), i * 90));
    showing = false;
  }
}

/** Đổi chế độ: dọn bong bóng còn sót. */
export function clearFamily(): void {
  if (box) box.innerHTML = '';
}

// ------------------------------------------------------------------ bảng ảnh "Nhà của Nhím" trên đảo
function loadImg(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Vẽ bảng ảnh: nền giấy kem, tiêu đề, 5 ảnh tròn (3 trên, 2 dưới) + tên. Ảnh thật nếu có, không thì emoji. */
export async function drawFamilyBoard(c: HTMLCanvasElement): Promise<void> {
  const imgs = new Map<FamilyId, HTMLImageElement>();
  await Promise.all(FAMILY.map(async (m) => {
    const url = photoUrl(m.id);
    const img = url ? await loadImg(url) : null;
    if (img) imgs.set(m.id, img);
  }));
  try { await document.fonts.load('800 40px "Baloo 2"'); } catch { /* font chưa tải được thì dùng font hệ thống */ }
  const g = c.getContext('2d')!;
  const w = c.width, h = c.height;
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#fffaf0'); bg.addColorStop(1, '#ffe9c7');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.font = '30px "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
  g.globalAlpha = 0.3;
  for (let i = 0; i < 12; i++) g.fillText(i % 2 ? '💗' : '🌼', (i * 149) % w, 30 + ((i * 97) % (h - 30)));
  g.globalAlpha = 1;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '800 62px "Baloo 2", "Nunito", system-ui, sans-serif';
  g.lineWidth = 10; g.strokeStyle = '#3b3220'; g.fillStyle = '#ffffff';
  g.strokeText('Nhà của Nhím', w / 2, 48); g.fillText('Nhà của Nhím', w / 2, 48);
  const slots = [[w * 0.18, 175], [w * 0.5, 175], [w * 0.82, 175], [w * 0.33, 375], [w * 0.67, 375]];
  FAMILY.forEach((m, i) => {
    const [x, y] = slots[i];
    const r = 78;
    g.fillStyle = m.color;
    g.beginPath(); g.arc(x, y, r + 9, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    const img = imgs.get(m.id);
    if (img) {
      g.save();
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.clip();
      const s = Math.min(img.width, img.height);
      g.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, x - r, y - r, r * 2, r * 2);
      g.restore();
    } else {
      g.font = '104px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
      g.fillText(m.emoji, x, y + 8);
    }
    g.font = '800 38px "Baloo 2", "Nunito", system-ui, sans-serif';
    g.lineWidth = 8; g.strokeStyle = '#ffffff'; g.fillStyle = m.color;
    g.strokeText(m.name, x, y + r + 30); g.fillText(m.name, x, y + r + 30);
  });
}
