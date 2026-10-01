// Chế độ đánh vần: khám phá (chạm con vật → nghe tên + đánh vần) và đố (Con nào là con bò?).
import { ANIMALS, type AnimalDef } from './data';
import type { IslandScene, Tappable } from './scene';
import { play, sfx, speakSequence, stopSpeech } from './audio';
import { showWord, hideWord, confetti } from './ui';
import { wait } from './tween';

const QUIZ_ROUNDS = 4;

export class SpellMode {
  private quizTarget: AnimalDef | null = null;
  private solved = 0;
  private lastAsked = '';
  private locked = false;

  constructor(private scene: IslandScene, private animals: Map<string, Tappable>) {}

  async enter(): Promise<void> {
    this.quizTarget = null;
    this.solved = 0;
    await Promise.all([...this.animals.values()].map((t) => this.scene.setVisible(t, true)));
  }

  async exit(): Promise<void> {
    stopSpeech();
    hideWord();
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

    if (!this.quizTarget) {
      // khám phá: nhảy + tên + đánh vần
      void this.scene.jump(t);
      await this.spell(def);
      return;
    }

    if (def.id !== this.quizTarget.id) {
      sfx('sfx_soft', 0.5);
      void this.scene.wobble(t);
      await play(Math.random() < 0.5 ? 'retry' : 'almost');
      await wait(300);
      await play(`ask_${this.quizTarget.id}`);
      return;
    }

    // đúng
    this.locked = true;
    sfx('sfx_win', 0.5);
    void this.scene.jump(t);
    await play('right');
    await this.spell(def);
    this.solved++;
    if (this.solved >= QUIZ_ROUNDS) {
      confetti(60);
      await play('yay');
      await wait(600);
      hideWord();
      this.quizTarget = null;
      this.locked = false;
      await play('hello');
      return;
    }
    await wait(500);
    hideWord();
    this.locked = false;
    await this.ask();
  }

  /** "con bò" → đánh vần từng token (tô cam chữ đang đọc) → đọc trơn (tô xanh cả từ). */
  private async spell(def: AnimalDef): Promise<void> {
    const all = Array.from(def.word).map((_, i) => i);
    showWord(def.word, all, true);
    const keys = [`name_${def.id}`, ...def.tokens.map((t) => t.audio)];
    const ok = await speakSequence(keys, (i) => {
      if (i === 0) showWord(def.word, all, true);
      else showWord(def.word, def.tokens[i - 1].lit, false);
    });
    if (ok) showWord(def.word, all, true);
  }
}
