// Không khí đảo: mây trôi, chim bay ngang, bướm chập chờn, sóng lăn tăn quanh bờ, nước lấp lánh,
// khói ống khói, tim bay trên mái khi người nhà khen, hạt lấp lánh khi bé trả lời đúng.
// Tất cả nhẹ nhàng, ít object, không tạo object mới mỗi khung hình (iPad chạy mượt).
import * as THREE from 'three';
import type { IslandScene } from './scene';

const UP = new THREE.Vector3(0, 1, 0);

/** Texture tròn mềm (khói, lấp lánh) vẽ bằng canvas. */
function softDot(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)'): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.55, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function emojiTexture(ch: string): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '100px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  g.fillText(ch, 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ------------------------------------------------------------------ toạ độ "màn hình"
/**
 * Camera orthographic nhìn chéo: đặt vật theo toạ độ màn hình (xs ngang, ys dọc, đơn vị thế giới tính từ tâm khung)
 * và độ sâu d (dương = xa camera hơn tâm đảo). Dùng cho mây/chim để chắc chắn chúng nằm trong khung trời phía trên.
 */
class ScreenSpace {
  readonly right = new THREE.Vector3();
  readonly up = new THREE.Vector3();
  readonly fwd = new THREE.Vector3();
  private readonly center = new THREE.Vector3();
  constructor(private readonly cam: THREE.OrthographicCamera) {
    cam.updateMatrixWorld(true);
    this.right.setFromMatrixColumn(cam.matrixWorld, 0).normalize();
    this.up.setFromMatrixColumn(cam.matrixWorld, 1).normalize();
    this.fwd.setFromMatrixColumn(cam.matrixWorld, 2).normalize().negate();
    // tâm khung = điểm camera nhìn vào (0, 0.4, 0)
    this.center.set(0, 0.4, 0);
  }
  get halfW(): number { return this.cam.right; }
  get halfH(): number { return this.cam.top; }
  at(xs: number, ys: number, d: number, out = new THREE.Vector3()): THREE.Vector3 {
    return out.copy(this.center).addScaledVector(this.right, xs).addScaledVector(this.up, ys).addScaledVector(this.fwd, d);
  }
}

// ------------------------------------------------------------------ mây
class Clouds {
  private readonly list: { g: THREE.Group; xs: number; ys: number; d: number; speed: number }[] = [];
  constructor(scene: THREE.Scene, private readonly ss: ScreenSpace) {
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, emissive: 0xfff6ea, emissiveIntensity: 0.55 });
    // mây trôi ngang dải trời phía trên, nằm sau đảo (bị cây/mái nhà che bớt cho có chiều sâu)
    const seeds: [number, number, number][] = [[-0.7, 0.9, 0.62], [0.15, 0.95, 0.5], [0.85, 0.88, 0.56]];
    for (const [fx, fy, s] of seeds) {
      const g = new THREE.Group();
      const puffs = 4 + Math.floor(Math.random() * 2);
      for (let i = 0; i < puffs; i++) {
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + Math.random() * 0.3, 1), mat);
        m.position.set((i - (puffs - 1) / 2) * 0.55, Math.sin((i / (puffs - 1)) * Math.PI) * 0.25 + Math.random() * 0.1, (Math.random() - 0.5) * 0.3);
        m.scale.y = 0.7;
        g.add(m);
      }
      g.scale.setScalar(s);
      g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(ss.right, ss.up, ss.fwd.clone().negate()));
      scene.add(g);
      this.list.push({ g, xs: fx * ss.halfW, ys: fy, d: 7, speed: 0.1 + Math.random() * 0.08 });
    }
    this.update(0);
  }
  update(dt: number): void {
    const w = this.ss.halfW + 2;
    for (const c of this.list) {
      c.xs += c.speed * dt;
      if (c.xs > w) c.xs -= w * 2;
      this.ss.at(c.xs, c.ys * this.ss.halfH, c.d, c.g.position); // ys = tỉ lệ chiều cao khung (đổi hướng iPad vẫn đúng)
    }
  }
}

// ------------------------------------------------------------------ chim
class Bird {
  readonly g = new THREE.Group();
  private readonly wl: THREE.Object3D;
  private readonly wr: THREE.Object3D;
  private phase = Math.random() * 6;
  constructor(color: number) {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true, side: THREE.DoubleSide });
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.42, 5), mat);
    body.rotation.x = Math.PI / 2; // mũi hướng +z
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.085, 0), mat);
    head.position.z = 0.2;
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 4), new THREE.MeshStandardMaterial({ color: 0xffb547, roughness: 1 }));
    beak.rotation.x = Math.PI / 2;
    beak.position.z = 0.3;
    const wingGeo = new THREE.BufferGeometry();
    wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.12, 0, 0, -0.1, 0.42, 0, -0.02], 3));
    wingGeo.computeVertexNormals();
    this.wl = new THREE.Group();
    this.wr = new THREE.Group();
    const l = new THREE.Mesh(wingGeo, mat);
    const r = new THREE.Mesh(wingGeo, mat);
    r.scale.x = -1;
    this.wl.add(l);
    this.wr.add(r);
    this.g.add(body, head, beak, this.wl, this.wr);
    this.g.visible = false;
  }
  flap(dt: number, speed = 9): void {
    this.phase += dt * speed;
    const a = Math.sin(this.phase) * 0.7;
    this.wl.rotation.z = a;
    this.wr.rotation.z = -a;
  }
}

class Flock {
  private readonly birds: Bird[] = [];
  private wait = 3 + Math.random() * 4;
  private t = -1;
  private readonly from = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();
  private readonly offsets: THREE.Vector3[] = [];
  private count = 0;
  private len = 20;
  constructor(scene: THREE.Scene, private readonly ss: ScreenSpace) {
    const colors = [0xffffff, 0x9fd8ff, 0xffffff];
    for (const c of colors) {
      const b = new Bird(c);
      scene.add(b.g);
      this.birds.push(b);
      this.offsets.push(new THREE.Vector3());
    }
  }
  private launch(): void {
    // bay ngang dải trời phía trên đảo, trái → phải hoặc ngược lại
    const ltr = Math.random() < 0.5;
    const ss = this.ss;
    const ys = ss.halfH * (0.62 + Math.random() * 0.22);
    const w = ss.halfW + 1.5;
    ss.at(ltr ? -w : w, ys, 3, this.from);
    const to = ss.at(ltr ? w : -w, ys + (Math.random() - 0.5) * 1.2, 3);
    this.dir.copy(to).sub(this.from);
    this.len = this.dir.length();
    this.dir.normalize();
    this.count = 1 + Math.floor(Math.random() * 3);
    const yaw = Math.atan2(this.dir.x, this.dir.z);
    for (let i = 0; i < this.birds.length; i++) {
      const b = this.birds[i];
      b.g.visible = i < this.count;
      // đội hình chữ V nhỏ
      this.offsets[i].set(i ? (i % 2 ? 0.45 : -0.45) : 0, (i % 2) * 0.2, -i * 0.5).applyAxisAngle(UP, yaw);
      b.g.rotation.y = yaw;
    }
    this.t = 0;
  }
  update(dt: number): void {
    if (this.t < 0) {
      this.wait -= dt;
      if (this.wait <= 0) this.launch();
      return;
    }
    this.t += dt;
    const dur = 13;
    for (let i = 0; i < this.count; i++) {
      const b = this.birds[i];
      const s = this.t * (this.len / dur);
      b.g.position.copy(this.from).addScaledVector(this.dir, s).add(this.offsets[i]);
      b.g.position.y += Math.sin(this.t * 1.6 + i) * 0.18;
      // đập cánh rồi lượn (nghỉ cánh) cho tự nhiên
      const glide = Math.sin(this.t * 0.9 + i) > 0.55;
      b.flap(dt, glide ? 0.6 : 10);
    }
    if (this.t > dur) {
      this.birds.forEach((b) => (b.g.visible = false));
      this.t = -1;
      this.wait = 9 + Math.random() * 10;
    }
  }
}

// ------------------------------------------------------------------ bướm
class Butterfly {
  readonly g = new THREE.Group();
  private readonly wl = new THREE.Group();
  private readonly wr = new THREE.Group();
  private readonly target = new THREE.Vector3();
  private readonly vel = new THREE.Vector3();
  private phase = Math.random() * 10;
  private rest = 0;
  constructor(color: number, private readonly home: THREE.Vector3) {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 1, side: THREE.DoubleSide, emissive: color, emissiveIntensity: 0.15 });
    const geo = new THREE.CircleGeometry(0.11, 6);
    geo.translate(0.1, 0.02, 0);
    geo.rotateX(-Math.PI / 2);
    const l = new THREE.Mesh(geo, mat);
    const r = new THREE.Mesh(geo, mat);
    r.scale.x = -1;
    const low = new THREE.Mesh(geo, mat);
    low.scale.setScalar(0.7);
    low.position.z = -0.08;
    const low2 = low.clone();
    low2.scale.x = -0.7;
    this.wl.add(l, low);
    this.wr.add(r, low2);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.12, 2, 4), new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 1 }));
    body.rotation.x = Math.PI / 2;
    this.g.add(this.wl, this.wr, body);
    this.g.position.copy(home).setY(0.8);
    this.pick();
  }
  private pick(): void {
    this.target.set(this.home.x + (Math.random() - 0.5) * 3, 0.35 + Math.random() * 1.0, this.home.z + (Math.random() - 0.5) * 3);
  }
  update(dt: number): void {
    this.phase += dt;
    if (this.rest > 0) {
      // đậu nghỉ: cánh khép mở chậm
      this.rest -= dt;
      const a = 0.3 + Math.sin(this.phase * 3) * 0.3;
      this.wl.rotation.z = a; this.wr.rotation.z = -a;
      return;
    }
    const to = this.target.clone().sub(this.g.position);
    if (to.length() < 0.2) {
      if (Math.random() < 0.25) this.rest = 1.5 + Math.random() * 2;
      this.pick();
    }
    to.normalize().multiplyScalar(1.4);
    // chập chờn: lệch hướng theo sin
    to.x += Math.sin(this.phase * 2.3) * 0.8;
    to.z += Math.cos(this.phase * 1.9) * 0.8;
    to.y += Math.sin(this.phase * 4.1) * 0.9;
    this.vel.lerp(to, Math.min(1, dt * 2));
    this.g.position.addScaledVector(this.vel, dt * 0.55);
    this.g.rotation.y = Math.atan2(this.vel.x, this.vel.z);
    const a = Math.sin(this.phase * 22) * 0.9;
    this.wl.rotation.z = a; this.wr.rotation.z = -a;
  }
}

// ------------------------------------------------------------------ nước: sóng lăn tăn + lấp lánh
class Water {
  private readonly ripples: { m: THREE.Mesh; t: number }[] = [];
  private readonly glints: { s: THREE.Sprite; t: number; dur: number }[] = [];
  private readonly glintMat: THREE.SpriteMaterial[] = [];
  constructor(scene: THREE.Scene) {
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(
        new THREE.RingGeometry(5.65, 5.82, 72),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }),
      );
      m.rotation.x = -Math.PI / 2;
      m.position.y = -0.985;
      scene.add(m);
      this.ripples.push({ m, t: i * 2.2 });
    }
    const tex = softDot();
    for (let i = 0; i < 10; i++) {
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false });
      this.glintMat.push(mat);
      const s = new THREE.Sprite(mat);
      scene.add(s);
      this.glints.push({ s, t: Math.random() * 3, dur: 1.4 + Math.random() });
      this.place(this.glints[i]);
    }
  }
  private place(g: { s: THREE.Sprite; t: number; dur: number }): void {
    // chỉ ở nửa trước (phía camera) nơi thấy nước
    const a = -Math.PI * 0.25 + (Math.random() - 0.5) * Math.PI * 1.3;
    const r = 6.0 + Math.random() * 1.4;
    g.s.position.set(Math.cos(a) * r * 1.32, -0.95, Math.sin(a) * r);
    g.s.scale.set(0.22, 0.08, 1);
  }
  update(dt: number): void {
    const dur = 6.6;
    for (const r of this.ripples) {
      r.t = (r.t + dt) % dur;
      const k = r.t / dur;
      const s = 1 + k * 0.28;
      r.m.scale.set(1.32 * s, s, 1);
      (r.m.material as THREE.MeshBasicMaterial).opacity = Math.sin(k * Math.PI) * 0.45;
    }
    for (const g of this.glints) {
      g.t += dt;
      if (g.t > g.dur) { g.t = 0; g.dur = 1.4 + Math.random(); this.place(g); }
      (g.s.material as THREE.SpriteMaterial).opacity = Math.sin((g.t / g.dur) * Math.PI) * 0.9;
    }
  }
}

// ------------------------------------------------------------------ khói ống khói
class Smoke {
  private readonly puffs: { s: THREE.Sprite; t: number }[] = [];
  private readonly dur = 4.2;
  constructor(scene: THREE.Scene, private readonly origin: THREE.Vector3) {
    const tex = softDot('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xf2eee8, transparent: true, opacity: 0, depthWrite: false }));
      scene.add(s);
      this.puffs.push({ s, t: (i / 6) * this.dur });
    }
  }
  update(dt: number): void {
    for (const p of this.puffs) {
      p.t = (p.t + dt) % this.dur;
      const k = p.t / this.dur;
      p.s.position.set(this.origin.x + k * 0.5 + Math.sin(k * 6 + p.t) * 0.06, this.origin.y + k * 1.5, this.origin.z - k * 0.3);
      p.s.scale.setScalar(0.22 + k * 0.6);
      (p.s.material as THREE.SpriteMaterial).opacity = (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85) * 0.75;
    }
  }
}

// ------------------------------------------------------------------ tim bay + hạt lấp lánh
class Floaters {
  private readonly items: { s: THREE.Sprite; t: number; dur: number; from: THREE.Vector3; drift: number }[] = [];
  private readonly heart: THREE.SpriteMaterial;
  constructor(private readonly scene: THREE.Scene) {
    this.heart = new THREE.SpriteMaterial({ map: emojiTexture('💖'), transparent: true, depthWrite: false });
  }
  /** Vài trái tim bay lên từ 1 điểm (mái nhà). */
  hearts(at: THREE.Vector3, n = 3): void {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(this.heart.clone());
      s.renderOrder = 5;
      this.scene.add(s);
      this.items.push({ s, t: -i * 0.35, dur: 2.2, from: at.clone(), drift: (Math.random() - 0.5) * 0.8 });
    }
  }
  update(dt: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;
      const k = Math.max(0, it.t / it.dur);
      it.s.visible = it.t >= 0;
      it.s.position.set(it.from.x + it.drift * k + Math.sin(k * 8) * 0.08, it.from.y + k * 1.6, it.from.z - it.drift * k);
      it.s.scale.setScalar(0.35 + Math.sin(Math.min(1, k * 3) * Math.PI / 2) * 0.15);
      (it.s.material as THREE.SpriteMaterial).opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      if (k >= 1) {
        this.scene.remove(it.s);
        (it.s.material as THREE.SpriteMaterial).dispose();
        this.items.splice(i, 1);
      }
    }
  }
}

/** Hạt lấp lánh (THREE.Points, 1 draw call). NormalBlending để vẫn thấy trên nền sáng. */
class Sparkles {
  private readonly max = 160;
  private readonly pos = new Float32Array(this.max * 3);
  private readonly col = new Float32Array(this.max * 3);
  private readonly alpha = new Float32Array(this.max);
  private readonly size = new Float32Array(this.max);
  private readonly vel: number[] = [];
  private readonly life: number[] = [];
  private readonly geo = new THREE.BufferGeometry();
  private n = 0;
  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.geo.setDrawRange(0, 0);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.NormalBlending,
      uniforms: { uScale: { value: renderer.getPixelRatio() } },
      vertexShader: /* glsl */ `
        attribute vec3 aColor; attribute float aAlpha; attribute float aSize;
        uniform float uScale; varying vec3 vColor; varying float vAlpha;
        void main() { vColor = aColor; vAlpha = aAlpha; gl_PointSize = aSize * uScale;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        varying vec3 vColor; varying float vAlpha;
        void main() { vec2 p = gl_PointCoord - 0.5;
          // ngôi sao 4 cánh mềm
          float d = length(p); float star = max(0.0, 0.5 - (abs(p.x) * abs(p.y) * 18.0 + d * 0.9));
          float a = smoothstep(0.0, 0.25, star) * vAlpha;
          if (a < 0.01) discard; gl_FragColor = vec4(mix(vColor, vec3(1.0), 0.35 * (1.0 - d * 2.0)), a); }`,
    });
    const pts = new THREE.Points(this.geo, mat);
    pts.frustumCulled = false;
    pts.renderOrder = 8;
    scene.add(pts);
  }
  burst(at: THREE.Vector3, count = 36, colors = [0xffc93c, 0xff7aa8, 0x7fd6ff, 0x9be36d]): void {
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      let k = this.n;
      if (k >= this.max) k = Math.floor(Math.random() * this.max); else this.n++;
      this.pos.set([at.x, at.y, at.z], k * 3);
      const a = Math.random() * Math.PI * 2, up = 1.2 + Math.random() * 2.2, out = 0.8 + Math.random() * 1.4;
      this.vel[k * 3] = Math.cos(a) * out; this.vel[k * 3 + 1] = up; this.vel[k * 3 + 2] = Math.sin(a) * out;
      c.setHex(colors[i % colors.length]);
      this.col.set([c.r, c.g, c.b], k * 3);
      this.life[k] = 1;
      this.size[k] = 18 + Math.random() * 16;
    }
  }
  update(dt: number): void {
    if (!this.n) return;
    let w = 0;
    for (let i = 0; i < this.n; i++) {
      const l = this.life[i] - dt / 1.2;
      if (l <= 0) continue;
      // nén mảng: copy hạt còn sống về đầu
      const vx = this.vel[i * 3], vy = this.vel[i * 3 + 1] - 4.5 * dt, vz = this.vel[i * 3 + 2];
      this.pos[w * 3] = this.pos[i * 3] + vx * dt;
      this.pos[w * 3 + 1] = this.pos[i * 3 + 1] + vy * dt;
      this.pos[w * 3 + 2] = this.pos[i * 3 + 2] + vz * dt;
      this.vel[w * 3] = vx * 0.98; this.vel[w * 3 + 1] = vy; this.vel[w * 3 + 2] = vz * 0.98;
      this.col[w * 3] = this.col[i * 3]; this.col[w * 3 + 1] = this.col[i * 3 + 1]; this.col[w * 3 + 2] = this.col[i * 3 + 2];
      this.size[w] = this.size[i];
      this.life[w] = l;
      this.alpha[w] = Math.min(1, l * 2.5);
      w++;
    }
    this.n = w;
    this.geo.setDrawRange(0, w);
    for (const name of ['position', 'aColor', 'aAlpha', 'aSize']) (this.geo.getAttribute(name) as THREE.BufferAttribute).needsUpdate = true;
  }
}

export class Ambient {
  private readonly clouds: Clouds;
  private readonly flock: Flock;
  private readonly flies: Butterfly[] = [];
  private readonly water: Water;
  private readonly smoke: Smoke;
  private readonly floaters: Floaters;
  readonly sparkles: Sparkles;

  constructor(private readonly island: IslandScene) {
    const s = island.scene;
    const ss = new ScreenSpace(island.camera);
    this.clouds = new Clouds(s, ss);
    this.flock = new Flock(s, ss);
    const homes: [number, number, number][] = [[0xff9ecb, -3.6, 1.6], [0xffd84d, 3.4, 0.6], [0xb9a2ff, -0.6, -1.8]];
    for (const [c, x, z] of homes) {
      const b = new Butterfly(c, new THREE.Vector3(x, 0, z));
      s.add(b.g);
      this.flies.push(b);
    }
    this.water = new Water(s);
    this.smoke = new Smoke(s, island.chimneyTop);
    this.floaters = new Floaters(s);
    this.sparkles = new Sparkles(s, island.renderer);
    island.onFrame((dt) => this.update(dt));
  }

  /** Tim bay lên từ mái nhà (người nhà đang khen). */
  heartsFromHouse(): void {
    this.floaters.hearts(this.island.roofTop, 3);
  }

  private update(dt: number): void {
    this.clouds.update(dt);
    this.flock.update(dt);
    for (const b of this.flies) b.update(dt);
    this.water.update(dt);
    this.smoke.update(dt);
    this.floaters.update(dt);
    this.sparkles.update(dt);
  }
}
