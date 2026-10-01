// Chế độ đánh vần: khám phá (chạm con vật → nghe tên + đánh vần) và đố (Con nào là con bò?).
// Con vật đang đi dạo thì dừng lại, quay mặt ra bé (Life.hold) cho tới khi đọc xong.
// Người nhà khen: thỉnh thoảng khi khám phá, sau câu đố đúng, và cả nhà cổ vũ khi xong lượt đố.
import * as THREE from 'three';
import { ANIMALS, type AnimalDef } from './data';
import type { IslandScene, Tappable } from './scene';
import type { Life } from './life';
import type { Ambient } from './ambient';
import { play, sfx, speakSequence, stopSpeech } from './audio';
import { showWord, hideWord, confetti } from './ui';
import { familyCheer, familyCheerAll, clearFamily } from './family';
import { wait } from './tween';

const QUIZ_ROUNDS = 4;
/** Khám phá: cứ mỗi N lần bé nghe đánh vần trọn vẹn thì 1 người nhà khen. */
const EXPLORE_CHEER_EVERY = 4;

export const PRAISE_RIGHT = ['right', 'right_2', 'right_3'];
export const PRAISE_DONE = ['good', 'yay', 'yay_2'];
export const pickOne = (keys: string[]) => keys[Math.floor(Math.random() * keys.length)];

export class SpellMode {
  private quizTarget: AnimalDef | null = null;
  private solved = 0;
  private lastAsked = '';
  private locked = false;
  private active = false;
  private explored = 0;

  constructor(
    private scene: IslandScene,
    private animals: Map<string, Tappable>,
    private life: Life,
    private ambient: Ambient,
  ) {}

  async enter(): Promise<void> {
    this.active = true;
    this.quizTarget = null;
    this.solved = 0;
    this.locked = false;
    await Promise.all([...this.animals.values()].map((t) => this.scene.setVisible(t, true)));
  }

  async exit(): Promise<void> {
    this.active = false;
    stopSpeech();
    hideWord();
    clearFamily();
    this.quizTarget = null;
    await Promise.all([...this.animals.values()].map((t) => this.scene.setVisible(t, false)));
  }

  get inQuiz(): boolean { return this.quizTarget !== null; }

  /** Nút 🔊: đọc lại câu hỏi hoặc lời chào. */
  repeat(): void {
    if (this.quizTarget) void play(`ask_${this.quizTarget.id}`);
    else void play('hello');
  }

  async startQuiz(): Promise<void> {
    if (this.locked) return;
    this.solved = 0;
    hideWord();
    await this.ask();
  }

  private async ask(): Promise<void> {
    const pool = ANIMALS.filter((a) => a.id !== this.lastAsked);
    this.quizTarget = pool[Math.floor(Math.random() * pool.length)];
    this.lastAsked = this.quizTarget.id;
    await play(`ask_${this.quizTarget.id}`);
  }

  async onTap(t: Tappable): Promise<void> {
    if (this.locked) return;
    const def = ANIMALS.find((a) => a.id === t.id);
    if (!def) return;
    sfx('sfx_tap', 0.4);
    this.life.hold(t);
    try {
      await this.handleTap(t, def);
    } finally {
      this.life.release(t);
    }
  }

  private async handleTap(t: Tappable, def: AnimalDef): Promise<void> {
    if (!this.quizTarget) {
      // khám phá: nhảy + tên + đánh vần
      void this.scene.jump(t);
      const ok = await this.spell(def);
      if (ok && ++this.explored % EXPLORE_CHEER_EVERY === 0 && this.active) {
        await wait(250);
        await this.cheer();
      }
      return;
    }

    if (def.id !== this.quizTarget.id) {
      sfx('sfx_soft', 0.5);
      void this.scene.wobble(t);
      await play(Math.random() < 0.5 ? 'retry' : 'almost');
      await wait(300);
      if (this.quizTarget) await play(`ask_${this.quizTarget.id}`);
      return;
    }

    // đúng
    this.locked = true;
    try {
      sfx('sfx_win', 0.5);
      this.sparkleAt(t);
      void this.scene.jump(t);
      await play(pickOne(PRAISE_RIGHT));
      await this.spell(def);
      this.solved++;
      if (!this.active) return;
      if (this.solved >= QUIZ_ROUNDS) {
        confetti(60);
        await play(pickOne(PRAISE_DONE));
        hideWord();
        this.quizTarget = null;
        // cả nhà lần lượt cổ vũ (mỗi người khen là tim bay trên mái nhà – hook ở main.ts)
        await familyCheerAll(() => this.active);
        if (this.active) await play('hello');
        return;
      }
      // câu 1 và 3 có người nhà khen (không khen dồn dập mọi câu)
      if (this.solved % 2 === 1) {
        await wait(200);
        await this.cheer();
      } else await wait(500);
      hideWord();
      if (this.active) await this.ask();
    } finally {
      this.locked = false;
    }
  }

  private async cheer(): Promise<void> {
    await familyCheer(() => this.active);
  }

  private sparkleAt(t: Tappable): void {
    const p = new THREE.Vector3();
    t.hit.getWorldPosition(p);
    this.ambient.sparkles.burst(p, 40);
  }

  /** "con bò" / "Mèo Mun đây!" → đánh vần từng token (tô cam chữ đang đọc) → đọc trơn (tô xanh cả từ). */
  private async spell(def: AnimalDef): Promise<boolean> {
    const all = Array.from(def.word).map((_, i) => i);
    showWord(def.word, all, true);
    const keys = [`name_${def.id}`, ...def.tokens.map((t) => t.audio)];
    const ok = await speakSequence(keys, (i) => {
      if (i === 0) showWord(def.word, all, true);
      else showWord(def.word, def.tokens[i - 1].lit, false);
    });
    if (ok) showWord(def.word, all, true);
    return ok;
  }
}
