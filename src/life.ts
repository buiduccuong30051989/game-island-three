// Con vật "sống" trên đảo: tự đi lang thang (clip Walk khi di chuyển, Idle khi đứng), quay đầu mượt,
// né nhà / cây / hàng rào / mép đảo / nhau; thỉnh thoảng làm trò (ăn cỏ, nhảy, múa).
// Bé chạm vào: con vật dừng lại, quay mặt ra phía bé (camera) cho tới khi đánh vần xong.
import * as THREE from 'three';
import type { AnimalDef } from './data';
import type { IslandScene, Tappable } from './scene';

type State = 'idle' | 'walk' | 'act' | 'held' | 'drag' | 'drop';

/** Vùng cỏ con vật được đi: ellipse giữa đảo (nửa trước, không lẫn sau nhà/cây). */
const AREA = { cx: 0.1, cz: 0.55, a: 3.9, b: 2.75 };
/** Hướng nhìn ra camera (camera ở +x +z). Lệch nhẹ để thấy mặt nghiêng 3/4 cho dễ thương. */
const FACE_CAMERA = Math.PI / 4 + 0.3;
const BODY_R = 0.42; // bán kính "thân" khi né vật cản
const TURN_RATE = 2.4; // rad/s khi đi
const HELD_TURN_RATE = 7;

function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

class Wanderer {
  state: State = 'idle';
  timer: number;
  yaw: number;
  target = new THREE.Vector2();
  holds = 0;
  /** nhấc lên (đang kéo / đang rơi): độ cao + vận tốc rơi */
  lift = 0;
  vy = 0;
  swing = 0;
  dragTarget = new THREE.Vector2();
  /** bán kính chiếm chỗ (bò to hơn gà) */
  readonly radius: number;
  private walkPhase = Math.random() * 10;
  private readonly walkAction?: THREE.AnimationAction;
  private readonly acts: THREE.AnimationAction[] = [];
  private current?: THREE.AnimationAction;
  private readonly baseY: number;

  constructor(readonly t: Tappable, readonly def: AnimalDef, scene: IslandScene) {
    this.yaw = t.root.rotation.y;
    this.timer = 1.5 + Math.random() * 4; // các con bắt đầu đi lệch nhau
    this.baseY = t.root.children[0].position.y;
    this.radius = Math.max(0.36, def.height * 0.6);
    if (t.mixer) {
      const walk = def.walk ? scene.findClip(t.clips, def.walk) : undefined;
      if (walk) this.walkAction = t.mixer.clipAction(walk);
      for (const name of def.acts) {
        const clip = scene.findClip(t.clips, name);
        if (!clip) continue;
        const a = t.mixer.clipAction(clip);
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
        this.acts.push(a);
      }
    }
  }

  get pos(): THREE.Vector2 { return new THREE.Vector2(this.t.root.position.x, this.t.root.position.z); }

  /** Chuyển clip mượt (crossfade). undefined = về idle. */
  fadeTo(next: THREE.AnimationAction | undefined, dur = 0.3): void {
    const to = next ?? this.t.idle;
    const from = this.current ?? this.t.idle;
    if (to === from && to?.isRunning()) return;
    if (from && from !== to) from.fadeOut(dur);
    if (to) {
      to.reset();
      to.setEffectiveWeight(1);
      to.fadeIn(dur).play();
    }
    this.current = next;
  }

  setWalkAnim(on: boolean): void {
    if (this.walkAction) {
      this.fadeTo(on ? this.walkAction : undefined, 0.25);
      if (on) this.walkAction.timeScale = Math.min(1.4, Math.max(0.7, this.def.speed / 0.5));
    } else if (!on) {
      // con không có clip đi (heo): trả dáng lạch bạch về thẳng
      const obj = this.t.root.children[0];
      obj.rotation.z = 0;
      obj.position.y = this.baseY;
    }
  }

  /** Làm trò 1 clip (LoopOnce), trả về thời lượng (s). */
  playAct(): number {
    if (!this.acts.length) return 0;
    const a = this.acts[Math.floor(Math.random() * this.acts.length)];
    this.fadeTo(a, 0.2);
    return a.getClip().duration;
  }

  /** Dáng lạch bạch bằng code cho con không có clip đi. */
  waddle(dt: number, moving: number): void {
    if (this.walkAction) return;
    this.walkPhase += dt * 11 * moving;
    const obj = this.t.root.children[0];
    obj.rotation.z = Math.sin(this.walkPhase) * 0.07 * moving;
    obj.position.y = this.baseY + Math.abs(Math.sin(this.walkPhase)) * 0.05 * moving;
  }
}

export class Life {
  private readonly ws = new Map<string, Wanderer>();

  constructor(private readonly scene: IslandScene, animals: Map<string, Tappable>, defs: AnimalDef[]) {
    for (const def of defs) {
      const t = animals.get(def.id);
      if (t) this.ws.set(def.id, new Wanderer(t, def, scene));
    }
    scene.onFrame((dt) => this.update(dt));
  }

  /** Bé chạm: dừng lại, quay ra phía bé. Gọi release() khi đọc xong. */
  hold(t: Tappable): void {
    const w = this.ws.get(t.id);
    if (!w) return;
    w.holds++;
    if (w.state !== 'held') {
      w.setWalkAnim(false);
      w.fadeTo(undefined, 0.15);
      w.state = 'held';
    }
  }

  release(t: Tappable): void {
    const w = this.ws.get(t.id);
    if (!w || w.holds === 0) return;
    w.holds--;
    if (w.holds === 0) {
      w.state = 'idle';
      w.timer = 1.8 + Math.random() * 2.5; // đứng nhìn bé thêm chút rồi mới đi tiếp
    }
  }

  /** Bé giữ và kéo: nhấc con vật lên. */
  grab(t: Tappable): boolean {
    const w = this.ws.get(t.id);
    if (!w || t.busy || w.state === 'drag' || w.state === 'drop') return false;
    w.setWalkAnim(false);
    w.fadeTo(undefined, 0.15);
    w.state = 'drag';
    w.dragTarget.copy(w.pos);
    return true;
  }

  /** Kéo tới điểm (x, z) trên mặt đất — bị kẹp vào vùng cỏ, né vật cản. */
  dragTo(t: Tappable, x: number, z: number): void {
    const w = this.ws.get(t.id);
    if (!w || w.state !== 'drag') return;
    w.dragTarget.copy(this.clampFree(x, z));
  }

  /** Thả: rơi xuống, nảy nhẹ, rồi đứng nhìn bé. Trả về vị trí chạm đất. */
  drop(t: Tappable): THREE.Vector3 | null {
    const w = this.ws.get(t.id);
    if (!w || w.state !== 'drag') return null;
    w.state = 'drop';
    w.vy = 0;
    return new THREE.Vector3(w.dragTarget.x, 0, w.dragTarget.y);
  }

  /** Đang kéo con nào không. */
  get dragging(): boolean {
    for (const w of this.ws.values()) if (w.state === 'drag' || w.state === 'drop') return true;
    return false;
  }

  /** Điểm gần nhất đứng được: kẹp vào ellipse cỏ rồi đẩy ra khỏi vật cản. */
  private clampFree(x: number, z: number): THREE.Vector2 {
    let ex = (x - AREA.cx) / AREA.a, ez = (z - AREA.cz) / AREA.b;
    const k = Math.hypot(ex, ez);
    if (k > 0.97) { ex *= 0.97 / k; ez *= 0.97 / k; }
    let px = AREA.cx + ex * AREA.a, pz = AREA.cz + ez * AREA.b;
    for (const o of this.scene.obstacles) {
      const dx = px - o.x, dz = pz - o.z, d = Math.hypot(dx, dz), min = o.r + BODY_R;
      if (d < min) {
        const n = d > 1e-4 ? 1 / d : 0;
        px = o.x + (n ? dx * n : 1) * min;
        pz = o.z + (n ? dz * n : 0) * min;
      }
    }
    return new THREE.Vector2(px, pz);
  }

  /** 1 con vật đang hiện, chọn ngẫu nhiên (cho mũi tên gợi ý). */
  randomVisible(): Tappable | null {
    const list = [...this.ws.values()].filter((w) => w.t.root.visible);
    return list.length ? list[Math.floor(Math.random() * list.length)].t : null;
  }

  private stop(w: Wanderer, pause: number): void {
    w.setWalkAnim(false);
    w.state = 'idle';
    w.timer = pause;
  }

  private update(dt: number): void {
    for (const w of this.ws.values()) {
      const root = w.t.root;
      if (!root.visible) continue;
      if (w.state === 'drag') {
        // bay lơ lửng theo ngón tay, chân đung đưa, mặt quay ra bé
        const p = w.pos;
        const f = Math.min(1, dt * 14);
        root.position.x = p.x + (w.dragTarget.x - p.x) * f;
        root.position.z = p.y + (w.dragTarget.y - p.y) * f;
        w.lift += (0.9 - w.lift) * Math.min(1, dt * 10);
        w.swing += dt * 9;
        root.position.y = w.lift + Math.sin(w.swing * 0.5) * 0.05;
        root.rotation.z = Math.sin(w.swing) * 0.18;
        const d = wrapAngle(FACE_CAMERA - w.yaw);
        w.yaw += Math.sign(d) * Math.min(Math.abs(d), HELD_TURN_RATE * dt);
        root.rotation.y = w.yaw;
        continue;
      }
      if (w.state === 'drop') {
        root.position.x = w.dragTarget.x;
        root.position.z = w.dragTarget.y;
        root.rotation.z *= Math.max(0, 1 - dt * 12);
        w.vy -= 22 * dt;
        w.lift += w.vy * dt;
        if (w.lift <= 0) {
          if (Math.abs(w.vy) > 2.5) { w.lift = 0.001; w.vy = -w.vy * 0.35; } // nảy 1 cái
          else {
            w.lift = 0; w.vy = 0; root.rotation.z = 0;
            w.state = 'idle';
            w.timer = 2 + Math.random() * 2; // đứng ngơ ngác nhìn bé một chút
          }
        }
        root.position.y = w.lift;
        continue;
      }
      if (w.state === 'held') {
        // quay mặt ra bé
        const d = wrapAngle(FACE_CAMERA - w.yaw);
        w.yaw += Math.sign(d) * Math.min(Math.abs(d), HELD_TURN_RATE * dt);
        root.rotation.y = w.yaw;
        continue;
      }
      if (w.t.busy) continue;
      w.timer -= dt;

      if (w.state === 'idle' && w.timer <= 0) {
        // chọn việc tiếp theo: đa số là đi dạo, đôi khi làm trò tại chỗ
        const actDur = Math.random() < 0.25 ? w.playAct() : 0;
        if (actDur > 0) {
          w.state = 'act';
          w.timer = Math.min(actDur, 3.5);
        } else if (this.pickTarget(w)) {
          w.state = 'walk';
          w.setWalkAnim(true);
          w.timer = 14; // không tới nơi thì thôi, đứng nghỉ
        } else {
          w.timer = 1 + Math.random() * 2;
        }
      } else if (w.state === 'act' && w.timer <= 0) {
        w.fadeTo(undefined, 0.3);
        w.state = 'idle';
        w.timer = 2 + Math.random() * 3;
      } else if (w.state === 'walk') {
        this.step(w, dt);
      }
    }
  }

  private step(w: Wanderer, dt: number): void {
    const root = w.t.root;
    const p = w.pos;
    const to = w.target.clone().sub(p);
    const dist = to.length();
    if (dist < 0.15 || w.timer <= 0) {
      this.stop(w, 2 + Math.random() * 4);
      return;
    }
    // forward của model = +Z → yaw = atan2(dx, dz)
    const want = Math.atan2(to.x, to.y);
    const d = wrapAngle(want - w.yaw);
    w.yaw += Math.sign(d) * Math.min(Math.abs(d), TURN_RATE * dt);
    root.rotation.y = w.yaw;
    // quay gần đúng hướng mới bước (đi vòng cung, không trượt ngang); chậm dần khi tới nơi
    const align = Math.max(0, Math.cos(d));
    const ease = Math.min(1, dist / 0.6);
    const v = w.def.speed * align * align * (0.35 + 0.65 * ease);
    const nx = p.x + Math.sin(w.yaw) * v * dt;
    const nz = p.y + Math.cos(w.yaw) * v * dt;
    // sắp đụng con khác ở phía trước → dừng, nhường đường
    for (const o of this.ws.values()) {
      if (o === w || !o.t.root.visible) continue;
      const op = o.pos;
      const dx = op.x - nx, dz = op.y - nz;
      const dd = Math.hypot(dx, dz);
      const ahead = dx * Math.sin(w.yaw) + dz * Math.cos(w.yaw);
      // chỉ nhường khi đang lại gần con kia (đi ra xa thì cứ đi, tránh 2 con đứng kẹt nhau mãi)
      if (dd < w.radius + o.radius + 0.2 && ahead > 0 && dd < Math.hypot(op.x - p.x, op.y - p.y)) {
        this.stop(w, 0.8 + Math.random() * 1.5);
        return;
      }
    }
    if (!this.free(nx, nz)) {
      this.stop(w, 0.5 + Math.random());
      return;
    }
    root.position.x = nx;
    root.position.z = nz;
    w.waddle(dt, v / w.def.speed);
  }

  /** Điểm có đứng được không: trong vùng cỏ + ngoài vật cản. */
  private free(x: number, z: number, pad = BODY_R): boolean {
    const ex = (x - AREA.cx) / AREA.a, ez = (z - AREA.cz) / AREA.b;
    if (ex * ex + ez * ez > 1) return false;
    for (const o of this.scene.obstacles) {
      if (Math.hypot(x - o.x, z - o.z) < o.r + pad) return false;
    }
    return true;
  }

  /** Chọn đích ngẫu nhiên: đường thẳng tới đó không vướng gì, không trùng chỗ con khác. */
  private pickTarget(w: Wanderer): boolean {
    const p = w.pos;
    for (let tries = 0; tries < 16; tries++) {
      const a = Math.random() * Math.PI * 2;
      const r = 1.1 + Math.random() * 2.4;
      const tx = p.x + Math.cos(a) * r, tz = p.y + Math.sin(a) * r;
      if (!this.free(tx, tz, BODY_R + 0.1)) continue;
      let ok = true;
      for (let s = 0.25; s < r && ok; s += 0.25) {
        if (!this.free(p.x + Math.cos(a) * s, p.y + Math.sin(a) * s)) ok = false;
      }
      if (!ok) continue;
      for (const o of this.ws.values()) {
        if (o === w) continue;
        const op = o.state === 'walk' ? o.target : o.pos;
        if (Math.hypot(op.x - tx, op.y - tz) < w.radius + o.radius + 0.6) { ok = false; break; }
      }
      if (!ok) continue;
      w.target.set(tx, tz);
      return true;
    }
    return false;
  }
}
