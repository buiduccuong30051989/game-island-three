// Audio: WebAudio, mở khoá bằng click/touchend (iPad Safari), clip m4a sinh sẵn + sfx ogg.

const clips = new Map<string, AudioBuffer>();
let ctx: AudioContext | null = null;
let unlocked = false;

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    // iPadOS 16.4+: không bị nút gạt im lặng chặn
    const session = (navigator as any).audioSession;
    if (session && 'type' in session) session.type = 'playback';
  }
  return ctx;
}

/** Gọi ĐỒNG BỘ trong handler click/touchend đầu tiên. */
export function unlockAudio(): void {
  const c = getCtx();
  if (c.state === 'suspended') void c.resume();
  if (!unlocked) {
    // phát 1 buffer câm để iOS chịu mở loa
    const buf = c.createBuffer(1, 1, 22050);
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    src.start(0);
    unlocked = true;
  }
}

async function load(key: string, ext: string): Promise<AudioBuffer | null> {
  if (clips.has(key)) return clips.get(key)!;
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}audio/${key}.${ext}`);
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.arrayBuffer();
    const buf = await getCtx().decodeAudioData(data);
    clips.set(key, buf);
    return buf;
  } catch (e) {
    console.warn('[audio] missing', key, e);
    return null;
  }
}

export function preload(keys: string[]): Promise<unknown> {
  return Promise.all(keys.map((k) => load(k, k.startsWith('sfx_') ? 'ogg' : 'm4a')));
}

let current: AudioBufferSourceNode | null = null;
let seqToken = 0;

/** Phát 1 clip, resolve khi phát xong. Clip mới cắt clip giọng đang phát. */
export function play(key: string, opts: { volume?: number; cut?: boolean } = {}): Promise<void> {
  const ext = key.startsWith('sfx_') ? 'ogg' : 'm4a';
  return load(key, ext).then((buf) => {
    if (!buf) return;
    const c = getCtx();
    if (opts.cut !== false && !key.startsWith('sfx_') && current) {
      try { current.stop(); } catch { /* đã dừng */ }
      current = null;
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    const gain = c.createGain();
    gain.gain.value = opts.volume ?? 1;
    src.connect(gain).connect(c.destination);
    if (!key.startsWith('sfx_')) current = src;
    return new Promise<void>((resolve) => {
      src.onended = () => {
        if (current === src) current = null;
        resolve();
      };
      src.start(0);
    });
  });
}

export function sfx(key: string, volume = 0.6): void {
  void play(key, { volume, cut: false });
}

/** Phát tuần tự, gọi onToken(i) trước mỗi clip. Sequence mới huỷ sequence cũ. */
export async function speakSequence(
  keys: string[],
  onToken?: (i: number) => void,
  gapMs = 220,
): Promise<boolean> {
  const my = ++seqToken;
  for (let i = 0; i < keys.length; i++) {
    if (my !== seqToken) return false;
    onToken?.(i);
    await play(keys[i]);
    if (my !== seqToken) return false;
    await new Promise((r) => setTimeout(r, gapMs));
  }
  return my === seqToken;
}

export function stopSpeech(): void {
  seqToken++;
  if (current) {
    try { current.stop(); } catch { /* đã dừng */ }
    current = null;
  }
}
