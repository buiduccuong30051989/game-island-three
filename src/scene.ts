// Cảnh đảo: renderer, camera isometric, ánh sáng, đảo + props, loader GLB, raycast chạm.
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { PALETTE } from './data';
import { tween, updateTweens, easeOutBack, easeInOutSine } from './tween';

export interface Tappable {
  id: string;
  kind: 'animal' | 'apple';
  root: THREE.Object3D;
  hit: THREE.Mesh;
  mixer?: THREE.AnimationMixer;
  clips: THREE.AnimationClip[];
  idle?: THREE.AnimationAction;
  baseScale: number;
  busy: boolean;
}

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
    g.add(wall, roof, door, win);
    g.position.set(-3.3, 0, -2.3);
    g.rotation.y = Math.PI * 0.08;
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
  async instance(name: string): Promise<{ obj: THREE.Object3D; clips: THREE.AnimationClip[] }> {
    const gltf = await this.load(name);
    const obj = SkeletonUtils.clone(gltf.scene);
    obj.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = false; // không tự đổ bóng lên mình → màu pastel giữ được, chỉ đất nhận bóng
        mesh.material = this.recolor(mesh.material);
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

  async addProp(name: string, x: number, z: number, opts: { scale?: number; rotY?: number; tint?: number } = {}): Promise<THREE.Object3D> {
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
    return obj;
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
    for (const [n, x, z, s] of trees) jobs.push(this.addProp(n + '.glb', x, z, { scale: s, rotY: rnd() * Math.PI * 2, tint: rnd() }));

    const smalls = ['plant_bush', 'plant_bushSmall', 'flower_yellowA', 'flower_redA', 'flower_purpleA',
      'rock_smallA', 'rock_smallB', 'mushroom_red', 'grass', 'grass_large'];
    for (let i = 0; i < 34; i++) {
      // rải quanh vành đảo (ellipse a=6.2, b=4.7), tránh vùng giữa dành cho con vật/táo
      const a = rnd() * Math.PI * 2;
      const r = 0.72 + rnd() * 0.24;
      const x = Math.cos(a) * 6.2 * r, z = Math.sin(a) * 4.7 * r;
      if (Math.abs(x) < 3.2 && z > -1.2 && z < 3.2) continue;
      const name = smalls[Math.floor(rnd() * smalls.length)];
      jobs.push(this.addProp(name + '.glb', x, z, { scale: 0.9 + rnd() * 0.5, rotY: rnd() * Math.PI * 2 }));
    }
    jobs.push(this.addProp('stump_round.glb', -2.6, -1.6, { scale: 1.1 }));
    jobs.push(this.addProp('log.glb', 2.6, -1.9, { scale: 1.1, rotY: 0.5 }));
    // hàng rào trước nhà
    for (let i = 0; i < 3; i++) jobs.push(this.addProp('fence_simple.glb', -4.3 + i, -0.9, { scale: 1 }));
    // lối đá
    for (let i = 0; i < 4; i++) jobs.push(this.addProp('path_stone.glb', -1.6 + i * 0.9, -1.4 + i * 0.25, { scale: 1, rotY: rnd() }));
    await Promise.all(jobs);
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

  private findClip(clips: THREE.AnimationClip[], part: string): THREE.AnimationClip | undefined {
    const p = part.toLowerCase();
    return clips.find((c) => c.name.toLowerCase().endsWith(p) || c.name.toLowerCase() === p)
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

  start(): void {
    this.renderer.setAnimationLoop(() => {
      this.timer.update();
      const dt = Math.min(this.timer.getDelta(), 0.05);
      this.mixers.forEach((m) => m.update(dt));
      updateTweens(dt);
      this.renderer.render(this.scene, this.camera);
    });
  }
}
