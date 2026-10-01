// Khởi động: dựng cảnh, load model, mở khoá audio ở lần chạm đầu, điều phối 2 chế độ.
import { ANIMALS } from './data';
import { IslandScene, type Tappable } from './scene';
import { unlockAudio, preload, play, stopSpeech } from './audio';
import { els, setMode } from './ui';
import { SpellMode } from './spell';
import { CountMode } from './count';

const AUDIO_KEYS = [
  'hello', 'ask_count', 'ask_pick_number', 'good', 'right', 'yay', 'retry', 'almost', 'mode_spell', 'mode_count',
  'sfx_tap', 'sfx_pop', 'sfx_win', 'sfx_soft',
  ...['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8', 'n9', 'n10'],
  ...ANIMALS.flatMap((a) => [`name_${a.id}`, `ask_${a.id}`, ...a.tokens.map((t) => t.audio)]),
];

async function boot(): Promise<void> {
  const scene = new IslandScene(document.getElementById('app')!);
  scene.start();

  // load props + con vật song song
  const animals = new Map<string, Tappable>();
  await Promise.all([
    scene.buildProps(),
    ...ANIMALS.map(async (def) => {
      const { obj, clips } = await scene.instance(def.model);
      const t = scene.addTappable(def.id, 'animal', obj, clips, def.height, def.pos, def.rotY);
      animals.set(def.id, t);
    }),
    scene.load('apple.glb'),
  ]);

  const spell = new SpellMode(scene, animals);
  const count = new CountMode(scene);
  let mode: 'spell' | 'count' = 'spell';
  let switching = false;

  if (import.meta.env.DEV) (window as any).__island = { scene, animals, spell, count };

  els.startBtn.classList.add('ready');
  els.startBtn.textContent = '🌴';

  els.startBtn.addEventListener('click', async () => {
    unlockAudio(); // phải đồng bộ trong handler click
    els.start.classList.add('hide');
    setTimeout(() => (els.start.hidden = true), 500);
    await preload(AUDIO_KEYS);
    setMode('spell');
    await spell.enter();
    await play('hello');
  }, { once: true });

  // chạm vào cảnh
  scene.renderer.domElement.addEventListener('click', (e) => {
    if (switching) return;
    const t = scene.pick(e.clientX, e.clientY);
    if (!t) return;
    if (mode === 'spell' && t.kind === 'animal') void spell.onTap(t);
    if (mode === 'count' && t.kind === 'apple') void count.onTap(t);
  });

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
