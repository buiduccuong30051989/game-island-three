// Tween tối giản, không thư viện. Cập nhật trong render loop qua updateTweens(dt).

type Ease = (t: number) => number;
export const easeOutBack: Ease = (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);
export const easeOutQuad: Ease = (t) => 1 - (1 - t) * (1 - t);
export const easeInOutSine: Ease = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
export const linear: Ease = (t) => t;

interface Tween { t: number; dur: number; ease: Ease; fn: (k: number) => void; done?: () => void }
const active: Tween[] = [];

export function tween(durMs: number, fn: (k: number) => void, ease: Ease = easeOutQuad): Promise<void> {
  return new Promise((resolve) => {
    active.push({ t: 0, dur: durMs / 1000, ease, fn, done: resolve });
  });
}

export function updateTweens(dt: number): void {
  for (let i = active.length - 1; i >= 0; i--) {
    const tw = active[i];
    tw.t += dt;
    const k = Math.min(1, tw.t / tw.dur);
    tw.fn(tw.ease(k));
    if (k >= 1) {
      active.splice(i, 1);
      tw.done?.();
    }
  }
}

export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
