// Khởi động: dựng cảnh, load model, mở khoá audio ở lần chạm đầu, điều phối 2 chế độ.
// Đảo "sống": con vật đi dạo (life.ts), mây/chim/bướm/khói/sóng (ambient.ts), nhà Nhím + bảng ảnh gia đình.
// Bé ngồi im ~10 s: nhắc nhẹ + bàn tay 👇 nhún trên 1 con vật / quả táo.
import * as THREE from 'three';
import { ANIMALS } from './data';
import { IslandScene, type Tappable } from './scene';
import { unlockAudio, preload, play, stopSpeech, isSpeaking, sfx } from './audio';
import { els, setMode } from './ui';
import { SpellMode } from './spell';
import { CountMode } from './count';
import { Life } from './life';
import { Ambient } from './ambient';
import { FAMILY_KEYS, drawFamilyBoard, familyBusy, familyCheer, setCheerHook } from './family';

const AUDIO_KEYS = [...new Set([
  'hello', 'ask_count', 'ask_pick_number', 'good', 'right', 'right_2', 'right_3', 'yay', 'yay_2', 'retry', 'almost',
  'mode_spell', 'mode_count', 'hint_tap', 'hint_count',
  'sfx_tap', 'sfx_pop', 'sfx_win', 'sfx_soft',
  ...['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8', 'n9', 'n10'],
  ...ANIMALS.flatMap((a) => [`name_${a.id}`, `ask_${a.id}`, ...a.tokens.map((t) => t.audio)]),
  ...FAMILY_KEYS,
])];

/** Thời gian ngồi im trước lần nhắc đầu; sau đó giãn dần (đừng nhắc dồn). */
const HINT_DELAYS = [10, 20, 35];

async function boot(): Promise<void> {
  const scene = new IslandScene(document.getElementById('app')!);
  scene.start();

  // load props + con vật song song
  const animals = new Map<string, Tappable>();
  await Promise.all([
    scene.buildProps(),
    ...ANIMALS.map(async (def) => {
      const { obj, clips } = await scene.instance(def.model, def.tint);
      const t = scene.addTappable(def.id, 'animal', obj, clips, def.height, def.pos, def.rotY);
      animals.set(def.id, t);
    }),
    scene.load('apple.glb'),
  ]);
  const board = scene.addFamilyBoard(drawFamilyBoard, [-1.25, 0, -2.75]);

  const life = new Life(scene, animals, ANIMALS);
  const ambient = new Ambient(scene);
  setCheerHook(() => ambient.heartsFromHouse());
  const spell = new SpellMode(scene, animals, life, ambient);
  const count = new CountMode(scene, ambient);
  let mode: 'spell' | 'count' = 'spell';
  let switching = false;
  let started = false;

  if (import.meta.env.DEV) (window as any).__island = { scene, animals, spell, count, life, ambient, board };

  els.startBtn.classList.add('ready');
  els.startBtn.textContent = '🦔';

  els.startBtn.addEventListener('click', async () => {
    unlockAudio(); // phải đồng bộ trong handler click
    els.start.classList.add('hide');
    setTimeout(() => (els.start.hidden = true), 500);
    await preload(AUDIO_KEYS);
    setMode('spell');
    await spell.enter();
    started = true;
    await play('hello');
  }, { once: true });

  // ---------- gợi ý khi bé ngồi im ----------
  let idle = 0;
  let hintStep = 0;
  let pointerTarget: THREE.Object3D | null = null;
  let pointerHeight = 1;
  let pointerLeft = 0;
  const pointerPos = new THREE.Vector3();
  const pointer = document.getElementById('pointer')!;

  function hidePointer(): void {
    pointerTarget = null;
    pointer.hidden = true;
  }
  function poke(): void {
    idle = 0;
    hintStep = 0;
    hidePointer();
  }
  function showPointer(t: Tappable): void {
    pointerTarget = t.root;
    pointerHeight = t.hit.position.y * 2 + 0.3;
    pointerLeft = 5;
    pointer.hidden = false;
  }

  async function hint(): Promise<void> {
    if (mode === 'spell') {
      if (spell.inQuiz) { spell.repeat(); return; }
      const t = life.randomVisible();
      if (t) showPointer(t);
      await play('hint_tap');
    } else if (count.phaseNow === 'count') {
      const t = count.uncounted();
      if (t) showPointer(t);
      await play('hint_count');
    } else if (count.phaseNow === 'pick') {
      count.repeat();
    }
  }

  scene.onFrame((dt) => {
    // mũi tay bám theo con vật (nó vẫn đi dạo)
    if (pointerTarget) {
      pointerLeft -= dt;
      if (pointerLeft <= 0 || !pointerTarget.visible) hidePointer();
      else {
        pointerPos.copy(pointerTarget.position).setY(pointerTarget.position.y + pointerHeight);
        const p = scene.toScreen(pointerPos);
        pointer.style.transform = `translate(${p.x - 30}px, ${p.y - 76}px)`;
      }
    }
    if (!started || switching) return;
    if (isSpeaking() || familyBusy()) { idle = 0; return; }
    idle += dt;
    if (idle >= HINT_DELAYS[Math.min(hintStep, HINT_DELAYS.length - 1)]) {
      idle = 0;
      hintStep++;
      void hint();
    }
  });

  // ---------- chạm ----------
  let boardBusy = false;
  async function tapBoard(): Promise<void> {
    if (boardBusy || familyBusy()) return;
    boardBusy = true;
    try {
      sfx('sfx_tap', 0.4);
      void scene.pop(board, 1.08);
      await play('fam_house');
      await familyCheer();
    } finally {
      boardBusy = false;
    }
  }

  scene.renderer.domElement.addEventListener('click', (e) => {
    if (!started) return;
    poke();
    if (switching) return;
    const t = scene.pick(e.clientX, e.clientY);
    if (!t) return;
    if (t.kind === 'family') { void tapBoard(); return; }
    if (mode === 'spell' && t.kind === 'animal') void spell.onTap(t);
    if (mode === 'count' && t.kind === 'apple') void count.onTap(t);
  });
  document.addEventListener('pointerdown', () => { if (started) poke(); }, { capture: true });

  async function switchMode(next: 'spell' | 'count'): Promise<void> {
    if (switching || next === mode) {
      if (next === mode) void play(next === 'spell' ? 'mode_spell' : 'mode_count');
      return;
    }
    switching = true;
    stopSpeech();
    setMode(next);
    void play(next === 'spell' ? 'mode_spell' : 'mode_count');
    if (mode === 'spell') await spell.exit(); else await count.exit();
    mode = next;
    if (mode === 'spell') await spell.enter(); else await count.enter();
    switching = false;
  }

  els.modeSpell.addEventListener('click', () => void switchMode('spell'));
  els.modeCount.addEventListener('click', () => void switchMode('count'));
  els.repeat.addEventListener('click', () => (mode === 'spell' ? spell.repeat() : count.repeat()));
  els.quiz.addEventListener('click', () => { if (mode === 'spell') void spell.startQuiz(); });
}

void boot();
