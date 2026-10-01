// Cảnh đảo: renderer, camera isometric, ánh sáng, đảo + props, loader GLB, raycast chạm.
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { PALETTE } from './data';
import { tween, updateTweens, easeOutBack, easeInOutSine } from './tween';

export interface Tappable {
  id: string;
  kind: 'animal' | 'apple' | 'family';
  root: THREE.Object3D;
  hit: THREE.Mesh;
  mixer?: THREE.AnimationMixer;
  clips: THREE.AnimationClip[];
  idle?: THREE.AnimationAction;
  baseScale: number;
  busy: boolean;
}

/** Vật cản tròn trên mặt đảo (con vật đi lang thang né ra). */
export interface Obstacle { x: number; z: number; r: number }

/** Thứ đung đưa theo gió (cây, bụi): xoay nhẹ quanh gốc. */
interface Swayer { obj: THREE.Object3D; phase: number; amp: number; speed: number; kick: number }

type FrameFn = (dt: number, t: number) => void;

// PRNG có seed để bố cục props ổn định giữa các lần mở
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class IslandScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  readonly tappables: Tappable[] = [];
  private readonly timer = new THREE.Timer();
  private readonly mixers = new Set<THREE.AnimationMixer>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly loader = new GLTFLoader();
  private readonly cache = new Map<string, Promise<GLTF>>();
  private readonly frustumH = 4.7;
  private readonly hitMeshes: THREE.Mesh[] = [];
  private readonly frameFns: FrameFn[] = [];
  private readonly swayers: Swayer[] = [];
  private elapsed = 0;
  /** vật cản cho con vật đi lang thang (nhà, cây, gốc cây, hàng rào, bảng ảnh) */
  readonly obstacles: Obstacle[] = [];
  /** đỉnh ống khói (thế giới) – khói bốc lên từ đây */
  readonly chimneyTop = new THREE.Vector3();
  /** trước cửa nhà – tim bay lên khi người nhà khen */
  readonly roofTop = new THREE.Vector3();
  /** cây táo: táo đếm rơi từ tán này xuống */
  appleTree: { obj: THREE.Object3D; crown: THREE.Vector3; radius: number } | null = null;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap; // r186: PCFSoftShadowMap đã bị xoá
    this.renderer.toneMapping = THREE.NoToneMapping;
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(PALETTE.sky);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    this.camera.position.set(10, 8.2, 10);
    this.camera.lookAt(0, 0.4, 0);
    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.buildLights();
    this.buildIsland();
  }

  private resize(): void {
    const w = window.innerWidth, h = window.innerHeight;
    const aspect = w / h;
    // màn hình dọc (iPad portrait) thì nới chiều cao để đảo vẫn lọt
    const fh = aspect < 1 ? this.frustumH / aspect * 0.85 : this.frustumH;
    this.camera.left = -fh * aspect;
    this.camera.right = fh * aspect;
    this.camera.top = fh;
    this.camera.bottom = -fh;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private buildLights(): void {
    const hemi = new THREE.HemisphereLight(0xfff9ec, 0xbfe09c, 1.25);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff5e2, 2.5);
    sun.position.set(6, 12, 5);
    sun.castShadow = true;
    sun.shadow.intensity = 0.45; // bóng nhạt, nắng dịu kiểu diorama
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -10; sun.shadow.camera.right = 10;
    sun.shadow.camera.top = 10; sun.shadow.camera.bottom = -10;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 40;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    sun.shadow.radius = 4;
    this.scene.add(sun);
  }

  private buildIsland(): void {
    const sand = new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 1 });
    const grass = new THREE.MeshStandardMaterial({ color: PALETTE.grassTop, roughness: 1 });
    const island = new THREE.Mesh(new THREE.CylinderGeometry(5.1, 5.6, 1.4, 72), [sand, grass, sand]);
    island.position.y = -0.7;
    island.scale.x = 1.32;
    island.receiveShadow = true;
    this.scene.add(island);

    // viền cỏ đậm mỏng quanh mép trên
    const rim = new THREE.Mesh(
      new THREE.RingGeometry(4.75, 5.12, 72),
      new THREE.MeshStandardMaterial({ color: PALETTE.grassDark, roughness: 1 }),
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.005;
    rim.scale.x = 1.32;
    rim.receiveShadow = true;
    this.scene.add(rim);

    // vũng nước quanh đảo, ngoài là nền kem (diorama đặt trên bàn)
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(7.6, 72),
      new THREE.MeshStandardMaterial({ color: PALETTE.water, roughness: 0.9 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = -1.0;
    water.scale.x = 1.32;
    water.receiveShadow = true;
    this.scene.add(water);
    const waterRim = new THREE.Mesh(
      new THREE.RingGeometry(7.6, 8.1, 72),
      new THREE.MeshBasicMaterial({ color: PALETTE.waterRim }),
    );
    waterRim.rotation.x = -Math.PI / 2;
    waterRim.position.y = -1.0;
    waterRim.scale.x = 1.32;
    this.scene.add(waterRim);

    // bóng mờ của đảo dưới nước
    const shade = new THREE.Mesh(
      new THREE.CircleGeometry(6.2, 64),
      new THREE.MeshBasicMaterial({ color: PALETTE.waterShade, transparent: true, opacity: 0.5 }),
    );
    shade.rotation.x = -Math.PI / 2;
    shade.position.y = -0.99;
    shade.scale.x = 1.32;
    this.scene.add(shade);

    this.scene.add(this.buildHouse());
  }

  private buildHouse(): THREE.Group {
    const g = new THREE.Group();
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 1.3, 1.5),
      new THREE.MeshStandardMaterial({ color: PALETTE.wall, roughness: 1 }),
    );
    wall.position.y = 0.65;
    wall.castShadow = true; wall.receiveShadow = true;
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(1.55, 0.95, 4),
      new THREE.MeshStandardMaterial({ color: PALETTE.roof, roughness: 1, flatShading: true }),
    );
    roof.position.y = 1.3 + 0.47;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.7, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x7fc8d8, roughness: 1 }),
    );
    door.position.set(0.2, 0.35, 0.77);
    const win = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.4, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x7fc8d8, roughness: 1 }),
    );
    win.position.set(0.92, 0.8, -0.2);
    // ống khói gạch trên mái (khói do ambient.ts thả)
    const brick = new THREE.MeshStandardMaterial({ color: 0xd98a6c, roughness: 1 });
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.62, 0.26), brick);
    chimney.position.set(0.42, 1.88, -0.3);
    chimney.castShadow = true;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.34), new THREE.MeshStandardMaterial({ color: 0xb86d52, roughness: 1 }));
    cap.position.set(0.42, 2.2, -0.3);
    // ô cửa sổ thứ 2 mặt trước + bậu hoa cho nhà có hơi người
    const win2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.06), new THREE.MeshStandardMaterial({ color: 0xfff1b8, roughness: 1, emissive: 0xffe7a0, emissiveIntensity: 0.25 }));
    win2.position.set(-0.45, 0.82, 0.77);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.14), new THREE.MeshStandardMaterial({ color: 0xd49a6e, roughness: 1 }));
    box.position.set(-0.45, 0.58, 0.82);
    const blooms = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), new THREE.MeshStandardMaterial({ color: [0xff7aa8, 0xffd23f, 0xff9a6b, 0xc59bff][i], roughness: 1, flatShading: true }));
      b.position.set(-0.63 + i * 0.12, 0.67, 0.84);
      blooms.add(b);
    }
    g.add(wall, roof, door, win, chimney, cap, win2, box, blooms);
    g.position.set(-3.3, 0, -2.3);
    g.rotation.y = Math.PI * 0.08;
    g.updateMatrixWorld(true);
    this.chimneyTop.set(0.42, 2.26, -0.3).applyMatrix4(g.matrixWorld);
    this.roofTop.set(0.1, 1.1, 0.85).applyMatrix4(g.matrixWorld); // trước cửa (mái bị thẻ chữ che)
    this.obstacles.push({ x: -3.3, z: -2.3, r: 1.35 });
    return g;
  }

  // ---------- GLB ----------

  load(name: string): Promise<GLTF> {
    let p = this.cache.get(name);
    if (!p) {
      p = this.loader.loadAsync(`${import.meta.env.BASE_URL}models/${name}`);
      this.cache.set(name, p);
    }
    return p;
  }

  /** Tạo instance (clone) của model, bật bóng. */
  async instance(name: string, tint?: Record<string, number>): Promise<{ obj: THREE.Object3D; clips: THREE.AnimationClip[] }> {
    const gltf = await this.load(name);
    const obj = SkeletonUtils.clone(gltf.scene);
    const tinted = new Map<THREE.Material, THREE.Material>();
    obj.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = false; // không tự đổ bóng lên mình → màu pastel giữ được, chỉ đất nhận bóng
        mesh.material = this.recolor(mesh.material);
        if (tint) {
          // đổi màu riêng cho instance này (2 con mèo dùng chung 1 model)
          const swap = (m: THREE.Material): THREE.Material => {
            const hex = tint[m.name];
            if (hex === undefined) return m;
            let c = tinted.get(m);
            if (!c) {
              c = m.clone();
              (c as THREE.MeshStandardMaterial).color.setHex(hex);
              tinted.set(m, c);
            }
            return c;
          };
          mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
        }
      }
    });
    return { obj, clips: gltf.animations };
  }

  /** Kenney dùng xanh ngọc (teal) mặc định; đổi sang tông sage pastel theo palette. */
  private readonly recolorMap: Record<string, number> = {
    leafsGreen: PALETTE.leaf,
    grass: PALETTE.grassProp,
    woodBark: PALETTE.bark,
    dirt: PALETTE.bark,
  };
  private readonly recolored = new Map<THREE.Material, THREE.Material>();

  /** glTF mặc định metallicFactor=1 → không có env map thì tối đen. Đặt metalness 0 + đổi màu theo map. */
  private recolor(mat: THREE.Material | THREE.Material[]): THREE.Material | THREE.Material[] {
    if (Array.isArray(mat)) return mat.map((m) => this.recolor(m) as THREE.Material);
    let out = this.recolored.get(mat);
    if (!out) {
      const m = (mat as THREE.MeshStandardMaterial).clone();
      if ('metalness' in m) { m.metalness = 0; m.roughness = 0.95; }
      const target = this.recolorMap[mat.name];
      if (target !== undefined) m.color.setHex(target);
      out = m;
      this.recolored.set(mat, out);
    }
    return out;
  }

  /** Đo bbox thật (kể cả skinned) rồi scale về chiều cao mong muốn, chân chạm y=0. */
  fitHeight(obj: THREE.Object3D, height: number): number {
    obj.updateMatrixWorld(true);
    obj.traverse((o) => {
      const sm = o as THREE.SkinnedMesh;
      if (sm.isSkinnedMesh) sm.computeBoundingBox();
    });
    const box = new THREE.Box3().setFromObject(obj, true);
    const size = new THREE.Vector3();
    box.getSize(size);
    const s = height / Math.max(size.y, 1e-4);
    obj.scale.multiplyScalar(s);
    obj.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(obj, true);
    obj.position.y -= box2.min.y; // chân chạm đất
    return s;
  }

  async addProp(name: string, x: number, z: number, opts: { scale?: number; rotY?: number; tint?: number; block?: number; sway?: number } = {}): Promise<THREE.Object3D> {
    if (opts.block) this.obstacles.push({ x, z, r: opts.block });
    const { obj } = await this.instance(name);
    obj.position.set(x, 0, z);
    obj.rotation.y = opts.rotY ?? 0;
    obj.scale.setScalar(opts.scale ?? 1);
    if (opts.tint !== undefined) {
      // mỗi cây một sắc xanh hơi khác (tint 0..1) cho rừng không bị đều màu
      obj.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh && !Array.isArray(mesh.material) && mesh.material.name === 'leafsGreen') {
          const m = (mesh.material as THREE.MeshStandardMaterial).clone();
          m.color.offsetHSL((opts.tint! - 0.5) * 0.06, 0, (opts.tint! - 0.5) * 0.12);
          mesh.material = m;
        }
      });
    }
    this.scene.add(obj);
    if (opts.sway) this.swayers.push({ obj, phase: x * 1.7 + z * 0.9, amp: opts.sway, speed: 0.7 + ((x * 13 + z * 7) % 1 + 1) % 1 * 0.4, kick: 0 });
    return obj;
  }

  /** Lắc 1 cây (táo rơi). */
  shake(obj: THREE.Object3D, power = 1): void {
    const s = this.swayers.find((w) => w.obj === obj);
    if (s) s.kick = Math.max(s.kick, power);
  }

  private updateSway(dt: number): void {
    for (const s of this.swayers) {
      s.kick = Math.max(0, s.kick - dt * 1.6);
      const t = this.elapsed * s.speed + s.phase;
      // gió nhẹ + rung khi bị lắc (tắt dần)
      const k = s.kick * s.kick;
      s.obj.rotation.x = Math.sin(t) * s.amp + Math.sin(this.elapsed * 18) * 0.05 * k;
      s.obj.rotation.z = Math.sin(t * 0.77 + 1.3) * s.amp * 0.8 + Math.cos(this.elapsed * 16) * 0.05 * k;
    }
  }

  /** Cây cối, bụi, hoa, đá. Cây to ở nửa sau (xa camera) để không che con vật. */
  async buildProps(): Promise<void> {
    const rnd = mulberry32(20260929);
    const jobs: Promise<unknown>[] = [];
    // camera nhìn từ (+x,+z): x+z lớn = gần camera, |x−z| lớn = lệch sang hai bên.
    // Cây chỉ ở phía sau hoặc hai bên rìa, không đứng trước vùng con vật.
    const trees: [string, number, number, number][] = [
      ['tree_fat', -1.4, -3.6, 1.7], ['tree_default', 1.2, -3.9, 1.6], ['tree_oak', 3.4, -3.0, 1.6],
      ['tree_detailed', -5.0, -0.6, 1.5], ['tree_small', -5.4, 1.6, 1.15], ['tree_oak', -4.9, 3.2, 1.2],
      ['tree_small', 4.9, -2.2, 1.3], ['tree_default', 5.6, -0.4, 1.4], ['tree_fat', 5.7, 1.6, 1.25],
    ];
    for (const [n, x, z, s] of trees) {
      const rot = rnd() * Math.PI * 2, tint = rnd();
      const isAppleTree = x === 1.2 && z === -3.9;
      jobs.push(this.addProp(n + '.glb', x, z, { scale: s, rotY: rot, tint, block: 0.75, sway: 0.018 }).then((obj) => {
        if (isAppleTree) return this.decorateAppleTree(obj);
      }));
    }

    const smalls = ['plant_bush', 'plant_bushSmall', 'flower_yellowA', 'flower_redA', 'flower_purpleA',
      'rock_smallA', 'rock_smallB', 'mushroom_red', 'grass', 'grass_large'];
    for (let i = 0; i < 34; i++) {
      // rải quanh vành đảo (ellipse a=6.2, b=4.7), tránh vùng giữa dành cho con vật/táo
      const a = rnd() * Math.PI * 2;
      const r = 0.72 + rnd() * 0.24;
      const x = Math.cos(a) * 6.2 * r, z = Math.sin(a) * 4.7 * r;
      if (Math.abs(x) < 3.2 && z > -1.2 && z < 3.2) continue;
      const name = smalls[Math.floor(rnd() * smalls.length)];
      const solid = /bush|rock|mushroom/.test(name);
      const soft = /bush|grass|flower/.test(name);
      jobs.push(this.addProp(name + '.glb', x, z, { scale: 0.9 + rnd() * 0.5, rotY: rnd() * Math.PI * 2, block: solid ? 0.4 : undefined, sway: soft ? 0.05 : undefined }));
    }
    jobs.push(this.addProp('stump_round.glb', -2.6, -1.6, { scale: 1.1, block: 0.5 }));
    jobs.push(this.addProp('log.glb', 2.6, -1.9, { scale: 1.1, rotY: 0.5, block: 0.75 }));
    // hàng rào trước nhà
    for (let i = 0; i < 3; i++) jobs.push(this.addProp('fence_simple.glb', -4.3 + i, -0.9, { scale: 1, block: 0.5 }));
    // lối đá
    for (let i = 0; i < 4; i++) jobs.push(this.addProp('path_stone.glb', -1.6 + i * 0.9, -1.4 + i * 0.25, { scale: 1, rotY: rnd() }));
    await Promise.all(jobs);
  }

  /** Gắn vài quả táo đỏ lên tán cây (mặt hướng camera) + ghi lại tâm tán để táo đếm rơi từ đó. */
  private async decorateAppleTree(tree: THREE.Object3D): Promise<void> {
    tree.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(tree);
    const size = box.getSize(new THREE.Vector3());
    const crown = new THREE.Vector3(tree.position.x, box.min.y + size.y * 0.68, tree.position.z);
    const radius = Math.min(size.x, size.z) * 0.42;
    this.appleTree = { obj: tree, crown, radius };
    const gltf = await this.load('apple.glb');
    const toCam = new THREE.Vector3(1, 0, 1).normalize();
    const inv = new THREE.Matrix4().copy(tree.matrixWorld).invert();
    for (let i = 0; i < 6; i++) {
      const a = -1.1 + i * 0.45; // quạt quanh hướng camera
      const dir = toCam.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
      const p = crown.clone().addScaledVector(dir, radius * 0.95);
      p.y += (i % 2 ? 0.25 : -0.2) * radius;
      const apple = SkeletonUtils.clone(gltf.scene);
      apple.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.material = this.recolor(m.material); m.castShadow = false; } });
      const s = 0.28 / Math.max(new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3()).y, 1e-4);
      apple.scale.setScalar(s / tree.scale.x);
      apple.position.copy(p.applyMatrix4(inv));
      tree.add(apple);
    }
  }

  /** Táo rơi từ tán cây xuống chỗ của nó rồi nảy 2 lần. */
  async dropFromTree(t: Tappable, delayMs = 0, onLand?: () => void): Promise<void> {
    const obj = t.root.children[0];
    const s = t.baseScale;
    const end = t.root.position.clone();
    const tree = this.appleTree;
    if (!tree) { await this.setVisible(t, true); onLand?.(); return; }
    const a = Math.random() * Math.PI * 2;
    const start = tree.crown.clone().add(new THREE.Vector3(Math.cos(a) * tree.radius * 0.6, 0, Math.sin(a) * tree.radius * 0.6));
    t.root.visible = false;
    t.hit.visible = false;
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    this.shake(tree.obj, 0.8);
    t.root.position.copy(start);
    obj.scale.setScalar(s * 0.6);
    t.root.visible = true;
    const peak = 0.7; // bật nhẹ lên khỏi tán rồi rơi theo trọng lực
    const h0 = start.y;
    await tween(900, (k) => {
      t.root.position.x = start.x + (end.x - start.x) * k;
      t.root.position.z = start.z + (end.z - start.z) * k;
      // parabol: y(k) qua (0,h0), đỉnh h0+peak, chạm đất ở k=1
      const b = 2 * peak + 2 * Math.sqrt(peak * (peak + h0));
      const c = -h0 - b;
      t.root.position.y = Math.max(0, h0 + b * k + c * k * k);
      obj.scale.setScalar(s * (0.6 + 0.4 * Math.min(1, k * 3)));
      t.root.rotation.x = k * 4;
    });
    t.root.rotation.x = 0;
    onLand?.();
    // nảy 2 lần, bẹp nhẹ khi chạm đất
    for (const [h, ms] of [[0.35, 300], [0.12, 200]] as const) {
      await tween(ms, (k) => {
        const up = Math.sin(k * Math.PI);
        t.root.position.y = end.y + up * h;
        const sq = k < 0.15 || k > 0.85 ? 0.12 : 0;
        obj.scale.set(s * (1 + sq), s * (1 - sq), s * (1 + sq));
      });
    }
    obj.scale.setScalar(s);
    t.root.position.copy(end);
    t.hit.visible = true;
  }

  /** Bảng ảnh "Nhà Nhím" trên 2 cọc gỗ cạnh nhà: 5 ảnh tròn gia đình (ảnh thật nếu có). Chạm được. */
  addFamilyBoard(draw: (c: HTMLCanvasElement) => Promise<void> | void, pos: [number, number, number]): Tappable {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0xc98a5c, roughness: 1 });
    const W = 1.95, H = 1.32, cy = 1.3;
    for (const x of [-W / 2 + 0.12, W / 2 - 0.12]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, cy + H / 2 + 0.05, 0.1), wood);
      post.position.set(x, (cy + H / 2 + 0.05) / 2, -0.06);
      post.castShadow = true;
      g.add(post);
    }
    const frame = new THREE.Mesh(new THREE.BoxGeometry(W + 0.16, H + 0.16, 0.08), wood);
    frame.position.set(0, cy, 0);
    frame.castShadow = true;
    g.add(frame);
    const canvas = document.createElement('canvas');
    canvas.width = 768; canvas.height = 520;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    pic.position.set(0, cy, 0.045);
    g.add(pic);
    const redraw = async () => { await draw(canvas); tex.needsUpdate = true; };
    void redraw();
    const t = this.addTappable('family', 'family', g, [], cy + H / 2 + 0.08, pos, Math.PI / 4);
    this.obstacles.push({ x: pos[0], z: pos[2], r: 0.9 });
    return t;
  }

  // ---------- vật chạm được ----------

  /** Thêm vật chạm được kèm hitbox cầu (vùng chạm to hơn model ~30%). */
  addTappable(id: string, kind: Tappable['kind'], obj: THREE.Object3D, clips: THREE.AnimationClip[], height: number, pos: [number, number, number], rotY = 0): Tappable {
    const baseScale = this.fitHeight(obj, height);
    const root = new THREE.Group();
    root.add(obj);
    root.position.set(pos[0], pos[1], pos[2]);
    root.rotation.y = rotY;
    this.scene.add(root);

    // vùng chạm tối thiểu ~1 đơn vị đường kính (≈ 2 cm trên iPad) dù model nhỏ
    const radius = Math.max(height * 0.62, 0.52);
    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 12, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    );
    hit.position.y = Math.max(height * 0.5, radius * 0.7);
    root.add(hit);
    this.hitMeshes.push(hit);

    const t: Tappable = { id, kind, root, hit, clips, baseScale, busy: false };
    hit.userData.tappable = t;
    if (clips.length) {
      const mixer = new THREE.AnimationMixer(obj);
      this.mixers.add(mixer);
      t.mixer = mixer;
      const idleClip = this.findClip(clips, 'idle');
      if (idleClip) {
        t.idle = mixer.clipAction(idleClip);
        t.idle.play();
        // lệch pha cho các con không nhún cùng lúc
        t.idle.time = Math.random() * idleClip.duration;
      }
    }
    return t;
  }

  removeTappable(t: Tappable): void {
    this.scene.remove(t.root);
    const i = this.hitMeshes.indexOf(t.hit);
    if (i >= 0) this.hitMeshes.splice(i, 1);
    if (t.mixer) { t.mixer.stopAllAction(); this.mixers.delete(t.mixer); }
  }

  findClip(clips: THREE.AnimationClip[], part: string): THREE.AnimationClip | undefined {
    const p = part.toLowerCase();
    return clips.find((c) => c.name === part) ?? clips.find((c) => c.name.toLowerCase().endsWith(p) || c.name.toLowerCase() === p)
      ?? clips.find((c) => c.name.toLowerCase().includes(p));
  }

  /** Nhảy: animation Jump nếu có + nhún scale. */
  async jump(t: Tappable): Promise<void> {
    if (t.busy) return;
    t.busy = true;
    const obj = t.root.children[0];
    const jumpClip = t.mixer && this.findClip(t.clips, 'jump');
    if (t.mixer && jumpClip) {
      const a = t.mixer.clipAction(jumpClip);
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = false;
      t.idle?.fadeOut(0.1);
      a.reset().fadeIn(0.05).play();
      const dur = jumpClip.duration * 1000;
      setTimeout(() => { a.fadeOut(0.15); t.idle?.reset().fadeIn(0.15).play(); }, Math.max(200, dur - 120));
    }
    const s = t.baseScale;
    const y0 = t.root.position.y;
    await tween(520, (k) => {
      const up = Math.sin(k * Math.PI);
      t.root.position.y = y0 + up * 0.9;
      obj.scale.set(s * (1 - up * 0.08), s * (1 + up * 0.18), s * (1 - up * 0.08));
    }, easeInOutSine);
    obj.scale.setScalar(s);
    t.root.position.y = y0;
    t.busy = false;
  }

  /** Lắc nhẹ khi chọn sai (không phạt). */
  async wobble(t: Tappable): Promise<void> {
    const r0 = t.root.rotation.z;
    await tween(420, (k) => { t.root.rotation.z = r0 + Math.sin(k * Math.PI * 4) * 0.12 * (1 - k); });
    t.root.rotation.z = r0;
  }

  /** Nảy scale (táo khi đếm). */
  async pop(t: Tappable, mult = 1.35): Promise<void> {
    const obj = t.root.children[0];
    const s = t.baseScale;
    await tween(380, (k) => obj.scale.setScalar(s * (1 + (mult - 1) * (1 - k))), easeOutBack);
    obj.scale.setScalar(s);
  }

  /** Bay lên rồi biến mất. */
  async flyAway(t: Tappable): Promise<void> {
    const obj = t.root.children[0];
    const s = t.baseScale, y0 = t.root.position.y;
    await tween(600, (k) => {
      t.root.position.y = y0 + k * 3;
      obj.scale.setScalar(s * (1 - k));
    });
    this.removeTappable(t);
  }

  /** Hiện/ẩn mượt. */
  async setVisible(t: Tappable, visible: boolean): Promise<void> {
    const obj = t.root.children[0];
    const s = t.baseScale;
    if (visible) {
      t.root.visible = true;
      await tween(420, (k) => obj.scale.setScalar(s * k), easeOutBack);
    } else {
      await tween(260, (k) => obj.scale.setScalar(s * (1 - k)));
      t.root.visible = false;
    }
    obj.scale.setScalar(s);
    t.hit.visible = visible;
  }

  pick(clientX: number, clientY: number): Tappable | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.hitMeshes.filter((m) => m.visible), false);
    return hits.length ? (hits[0].object.userData.tappable as Tappable) : null;
  }

  /** Gọi fn(dt, t) mỗi khung hình (con vật đi lang thang, chim, mây, khói...). */
  onFrame(fn: FrameFn): void {
    this.frameFns.push(fn);
  }

  /** Toạ độ màn hình (px) của 1 điểm thế giới. */
  toScreen(p: THREE.Vector3): { x: number; y: number } {
    const v = p.clone().project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return { x: rect.left + (v.x + 1) / 2 * rect.width, y: rect.top + (1 - v.y) / 2 * rect.height };
  }

  start(): void {
    this.renderer.setAnimationLoop(() => {
      this.timer.update();
      const dt = Math.min(this.timer.getDelta(), 0.05);
      this.elapsed += dt;
      this.mixers.forEach((m) => m.update(dt));
      updateTweens(dt);
      this.updateSway(dt);
      for (const fn of this.frameFns) fn(dt, this.elapsed);
      this.renderer.render(this.scene, this.camera);
    });
  }
}
