// Chế độ đếm: táo rơi từ cây táo xuống bãi cỏ (nảy nảy), chạm từng quả (một, hai, ba...), rồi chạm số đúng.
// Xong mỗi vòng: 1 người nhà khen Nhím.
import * as THREE from 'three';
import { APPLE_HEIGHT, APPLE_SLOTS, NUMBER_AUDIO } from './data';
import type { IslandScene, Tappable } from './scene';
import type { Ambient } from './ambient';
import { play, sfx } from './audio';
import { setCounter, showNumbers, hideNumbers, wobbleEl, confetti } from './ui';
import { familyCheer, clearFamily } from './family';
import { PRAISE_DONE, pickOne } from './spell';
import { wait } from './tween';

export class CountMode {
  private apples: Tappable[] = [];
  private counted = new Set<string>();
  private target = 0;
  private round = 0;
  private phase: 'idle' | 'count' | 'pick' = 'idle';
  private active = false;
  private session = 0; // tăng mỗi lần enter/exit để bỏ qua continuation cũ

  constructor(private scene: IslandScene, private ambient: Ambient) {}

  get phaseNow(): 'idle' | 'count' | 'pick' { return this.phase; }

  /** 1 quả táo chưa đếm (cho mũi tên gợi ý). */
  uncounted(): Tappable | null {
    const left = this.apples.filter((a) => !this.counted.has(a.id) && a.hit.visible);
    return left.length ? left[Math.floor(Math.random() * left.length)] : null;
  }

  async enter(): Promise<void> {
    this.session++;
    this.active = true;
    this.round = 0;
    await this.nextRound();
  }

  async exit(): Promise<void> {
    this.session++;
    this.active = false;
    this.phase = 'idle';
    hideNumbers();
    setCounter(null);
    clearFamily();
    for (const a of this.apples) this.scene.removeTappable(a);
    this.apples = [];
  }

  repeat(): void {
    if (this.phase === 'count') void play('ask_count');
    else if (this.phase === 'pick') void play('ask_pick_number');
  }

  private async nextRound(): Promise<void> {
    if (!this.active) return;
    this.round++;
    // 3 vòng đầu 1–5, sau đó 3–10
    const max = this.round <= 3 ? 5 : 10;
    const min = this.round <= 3 ? 1 : 3;
    this.target = min + Math.floor(Math.random() * (max - min + 1));
    this.counted.clear();
    setCounter(null);
    hideNumbers();

    // chọn ngẫu nhiên N ô trong lưới, giữ thứ tự đọc
    const idx = APPLE_SLOTS.map((_, i) => i).sort(() => Math.random() - 0.5).slice(0, this.target).sort((a, b) => a - b);
    const jobs = idx.map(async (i, k) => {
      const { obj, clips } = await this.scene.instance('apple.glb');
      const [x, y, z] = APPLE_SLOTS[i];
      const t = this.scene.addTappable(`apple_${k}`, 'apple', obj, clips, APPLE_HEIGHT, [x, y, z], Math.random() * Math.PI);
      t.root.visible = false;
      t.hit.visible = false;
      return t;
    });
    const s = this.session;
    this.apples = await Promise.all(jobs);
    if (!this.active || s !== this.session) return;
    // táo rơi lần lượt từ cây (cây rung), chạm đất kêu "bụp"
    await Promise.all(this.apples.map((a, i) => this.scene.dropFromTree(a, i * 260, () => sfx('sfx_pop', 0.3))));
    if (!this.active || s !== this.session) return;
    this.phase = 'count';
    await play('ask_count');
  }

  async onTap(t: Tappable): Promise<void> {
    if (this.phase !== 'count' || t.kind !== 'apple') return;
    if (this.counted.has(t.id)) {
      void this.scene.pop(t, 1.15);
      return;
    }
    const s = this.session;
    this.counted.add(t.id);
    const n = this.counted.size;
    sfx('sfx_pop', 0.5);
    void this.scene.pop(t);
    setCounter(n);
    await play(NUMBER_AUDIO[n]);
    if (s !== this.session) return;

    if (n === this.target) {
      this.phase = 'pick';
      await wait(350);
      await play('ask_pick_number');
      if (s !== this.session || this.phase !== 'pick') return;
      this.showChoices();
    }
  }

  private showChoices(): void {
    const opts = new Set<number>([this.target]);
    while (opts.size < 3) {
      const d = this.target + (Math.floor(Math.random() * 5) - 2);
      if (d >= 1 && d <= 10) opts.add(d);
    }
    const list = [...opts].sort(() => Math.random() - 0.5);
    showNumbers(list, (n, btn) => void this.onPick(n, btn));
  }

  private async onPick(n: number, btn: HTMLButtonElement): Promise<void> {
    if (this.phase !== 'pick') return;
    if (n !== this.target) {
      sfx('sfx_soft', 0.5);
      wobbleEl(btn);
      await play('retry');
      await wait(200);
      await play(NUMBER_AUDIO[this.target]); // nhắc lại số vừa đếm
      return;
    }
    this.phase = 'idle';
    btn.classList.add('correct');
    const s = this.session;
    sfx('sfx_win', 0.5);
    confetti(50);
    setCounter(this.target);
    for (const a of this.apples) this.ambient.sparkles.burst(a.root.position.clone().add(new THREE.Vector3(0, 0.3, 0)), 8);
    await play(pickOne(PRAISE_DONE));
    if (s !== this.session) return;
    hideNumbers();
    await Promise.all(this.apples.map((a, i) => wait(i * 60).then(() => this.scene.flyAway(a))));
    this.apples = [];
    if (s !== this.session) return;
    // người nhà khen sau mỗi vòng đếm
    await familyCheer(() => this.active && s === this.session);
    await wait(300);
    if (s !== this.session) return;
    await this.nextRound();
  }
}
