// Lớp UI DOM đè lên canvas: thẻ chữ, bộ đếm, nút số, nút chế độ, pháo giấy.

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

export const els = {
  start: $('#start'),
  startBtn: $('#start-btn'),
  word: $('#word'),
  counter: $('#counter'),
  numbers: $('#numbers'),
  modeSpell: $('#mode-spell'),
  modeCount: $('#mode-count'),
  repeat: $('#repeat'),
  quiz: $('#quiz'),
  confetti: $('#confetti'),
};

/** Hiện từ, tô sáng các chữ cái có chỉ số trong `lit`. `whole` = đọc trơn cả từ (tô xanh). */
export function showWord(word: string, lit: number[] = [], whole = false): void {
  const w = els.word;
  w.hidden = false;
  w.innerHTML = '';
  Array.from(word).forEach((ch, i) => {
    const s = document.createElement('span');
    s.textContent = ch;
    s.className = lit.includes(i) ? 'lit' : '';
    w.appendChild(s);
  });
  w.classList.toggle('whole', whole);
}

export function hideWord(): void {
  els.word.hidden = true;
  els.word.classList.remove('whole');
}

export function setCounter(n: number | null): void {
  if (n === null) { els.counter.hidden = true; return; }
  els.counter.hidden = false;
  els.counter.textContent = String(n);
  els.counter.classList.remove('bump');
  void els.counter.offsetWidth; // restart animation
  els.counter.classList.add('bump');
}

export function showNumbers(options: number[], onPick: (n: number, btn: HTMLButtonElement) => void): void {
  const box = els.numbers;
  box.innerHTML = '';
  for (const n of options) {
    const b = document.createElement('button');
    b.className = 'num';
    b.textContent = String(n);
    b.addEventListener('click', () => onPick(n, b));
    box.appendChild(b);
  }
  box.hidden = false;
}

export function hideNumbers(): void {
  els.numbers.hidden = true;
  els.numbers.innerHTML = '';
}

export function wobbleEl(el: HTMLElement): void {
  el.classList.remove('wobble');
  void el.offsetWidth;
  el.classList.add('wobble');
}

export function setMode(mode: 'spell' | 'count'): void {
  els.modeSpell.classList.toggle('active', mode === 'spell');
  els.modeCount.classList.toggle('active', mode === 'count');
  els.quiz.hidden = mode !== 'spell';
}

const CONFETTI_COLORS = ['#ff9600', '#58cc02', '#1cb0f6', '#ffd887', '#f064a0', '#da5e4e'];
export function confetti(count = 40): void {
  const box = els.confetti;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('i');
    p.style.left = `${Math.random() * 100}%`;
    p.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    p.style.animationDelay = `${Math.random() * 0.4}s`;
    p.style.animationDuration = `${1.4 + Math.random() * 0.8}s`;
    p.style.transform = `rotate(${Math.random() * 360}deg)`;
    box.appendChild(p);
    setTimeout(() => p.remove(), 2600);
  }
}
