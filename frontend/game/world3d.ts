/**
 * Thế giới khối vuông 3D của bước Nhập vai (21/11/2026; người dùng chọn 3D nhìn chéo, bạn cùng lớp chơi chung). Tệp chỉ nạp động từ WorldViewport.web.tsx
 * (không nằm trong game/index – cảnh Phaser 2D cũ giữ nguyên). Mỗi khung một cảnh; hủy sạch renderer, hình khối, vật liệu, bộ nghe khi rời màn.
 * Cảnh chỉ lo hiển thị, đi lại, va chạm, chọn ô; mọi lệnh có ảnh hưởng (thu thập, đặt vật, nói chuyện) gửi qua cầu nối để giao diện gửi máy chủ chấm.
 * Hình khối, màu, nhân vật do nhóm tự thiết kế; không dùng tài nguyên, kết cấu hay nhân vật của trò chơi khác. Chữ tiếng Việt là phần tử DOM, không vẽ vào canvas.
 */
import * as THREE from 'three';
import type { GameBridge } from './bridge';
import {
  blockedFn, buildZoneAt, cellAt, chebyshev, inRect, key, markerCells, reachable, routeNear, standNear, stepAvoid, tideAt,
  type Cell, type PlacedBlock, type TerrainInfo, type WorldChangeInfo, type WorldMapInfo,
} from '@/lib/world-map';
import type { WorldLook, WorldSession } from '@/types/saga';

type Look = { robe: string; hat: string; skin?: string; beard?: boolean; gender?: 'nam' | 'nu' };
type Char = { group: THREE.Group; legs: THREE.Object3D[]; arms: THREE.Object3D[] };
type Peer = { char: Char; x: number; z: number; tx: number; tz: number; ry: number; name: string; label: HTMLDivElement; bubble: HTMLDivElement; bubbleUntil: number };
type Pending = { kind: 'gather' | 'place' | 'npc' | 'station'; at: Cell; id?: string; item?: string } | null;

const BOTTOM = -1.4;
const WATER_LOW = -0.25;
const WATER_HIGH = 0.95;
const SPEED = 3.6;
const TOP: Record<string, number> = { '~': -1.2, ',': 0.15, D: 1, '.': 1, ':': 1, '=': 1, P: 1.05, r: 1, T: 1, B: 1, H: 1, C: 1, W: 1, K: 1.05, M: 2 };
const TOP_COLOR: Record<string, string> = { '.': '#7fb05a', ':': '#e2cf96', '=': '#c9a473', P: '#cdbfa6', r: '#86a447', ',': '#8a7a5a', '~': '#6f6650', M: '#a2a294', D: '#a07a4c', T: '#76a653', B: '#7aa858', H: '#c9a473', C: '#7fb05a', W: '#7fb05a', K: '#cdbfa6' };
const SIDE_COLOR: Record<string, string> = { ':': '#cdb984', ',': '#6f604a', '~': '#5d5544', M: '#86867a', D: '#7a5a36', P: '#b3a58b', K: '#b3a58b' };
const SAY: Record<string, string> = { come: 'Lại đây!', need_wood: 'Cần thêm gỗ!', need_bamboo: 'Cần thêm tre!', need_rice: 'Cần thêm lúa!', done: 'Xong phần mình rồi!', thanks: 'Cảm ơn bạn!', wait_tide: 'Chờ con nước!', go: 'Đi thôi!' };
const typing = (): boolean => Boolean(document.activeElement?.closest('input,textarea,select,[contenteditable="true"]'));
const hash = (x: number, z: number): number => { const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return n - Math.floor(n); };

export class BlockWorld {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-10, 10, 6, -6, 0.1, 400);
  private readonly ray = new THREE.Raycaster();
  private readonly owned = new Set<{ dispose: () => void }>();
  private readonly mats = new Map<string, THREE.MeshLambertMaterial>();
  private readonly offs: Array<() => void> = [];
  private readonly keys = new Set<string>();
  private readonly labels: HTMLDivElement;
  private readonly pickables: THREE.Object3D[] = [];
  private readonly cellOfPick = new Map<THREE.Object3D, Cell[]>();
  private readonly npcs = new Map<string, { char: Char; label: HTMLDivElement; at: Cell }>();
  private readonly marks: Array<{ el: HTMLDivElement; pos: THREE.Vector3 }> = [];
  private readonly peers = new Map<number, Peer>();
  private readonly placed = new Map<string, THREE.Object3D>();
  private readonly nodes = new Map<string, number>();
  private readonly resInst = new Map<string, Array<{ mesh: THREE.InstancedMesh; index: number; matrix: THREE.Matrix4; spent: THREE.Matrix4 }>>();
  private view!: WorldSession;
  private map!: WorldMapInfo;
  private terrain!: TerrainInfo;
  private blocked: (x: number, z: number) => boolean = () => true;
  private player!: Char;
  private me = { x: 0, z: 0, y: 1, ry: 0 };
  private meLabel!: HTMLDivElement;
  private meBubble!: HTMLDivElement;
  private meBubbleUntil = 0;
  private path: Cell[] = [];
  private pending: Pending = null;
  private water!: THREE.Mesh;
  private waterY = WATER_LOW;
  private marker!: THREE.Group;
  private zonePlates = new THREE.Group();
  private readonly changeGroup = new THREE.Group();
  private readonly routeGroup = new THREE.Group();
  private changeKey = '';
  private routeKey = '';
  private skew = 0;
  private yaw = Math.PI / 4;
  private yawTarget = Math.PI / 4;
  private zoom = 1;
  private focus = new THREE.Vector3();
  private width = 960;
  private height = 540;
  private frame = 0;
  private last = 0;
  private alive = true;
  private locked = false;
  private calm = false;
  private mode: string | null = null;
  private near = '';
  private zoneIn = '';
  private lastPos = { x: -1, z: -1, at: 0 };
  private nearAt = 0;
  private markerAt = 0;
  private markerKey = '';
  private pointer: { id: number; x: number; y: number; moved: boolean } | null = null;
  private resize?: ResizeObserver;

  constructor(private readonly host: HTMLElement, private readonly bridge: GameBridge) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.touchAction = 'none';
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    host.appendChild(this.renderer.domElement);
    this.labels = document.createElement('div');
    Object.assign(this.labels.style, { position: 'absolute', inset: '0', pointerEvents: 'none', overflow: 'hidden', fontFamily: 'Manrope_700Bold, Manrope, system-ui, sans-serif' });
    host.appendChild(this.labels);
    this.scene.background = new THREE.Color('#bcd9e6');
    this.scene.fog = new THREE.Fog('#bcd9e6', 70, 140);
    this.scene.add(new THREE.HemisphereLight('#f4f1e6', '#5b5a44', 1.9));
    const sun = new THREE.DirectionalLight('#fff3d6', 1.6);
    sun.position.set(-30, 60, 20);
    this.scene.add(sun);
    this.scene.add(this.zonePlates, this.changeGroup, this.routeGroup);
    this.calm = Boolean(bridge.get<boolean>('game:calm'));
    const view = bridge.get<WorldSession>('world:view');
    if (!view) throw new Error('Chưa có dữ liệu thế giới khối');
    this.build(view);
    this.bind();
    this.measure();
    this.resize = new ResizeObserver(() => this.measure());
    this.resize.observe(host);
    this.last = performance.now();
    const loop = (t: number) => { if (!this.alive) return; this.tick(Math.min(0.05, (t - this.last) / 1000)); this.last = t; this.frame = requestAnimationFrame(loop); };
    this.frame = requestAnimationFrame(loop);
    bridge.set('world:ready', true);
  }

  // ------------------------------------------------------------------ vật liệu, hình khối
  private own<T extends { dispose: () => void }>(x: T): T { this.owned.add(x); return x; }
  private mat(color: string, opts: { transparent?: boolean; opacity?: number; map?: THREE.Texture } = {}): THREE.MeshLambertMaterial {
    const k = `${color}|${opts.opacity ?? 1}|${opts.map ? opts.map.uuid : ''}`;
    let m = this.mats.get(k);
    if (!m) { m = this.own(new THREE.MeshLambertMaterial({ color, ...(opts.transparent ? { transparent: true, opacity: opts.opacity ?? 1 } : {}), ...(opts.map ? { map: opts.map } : {}) })); this.mats.set(k, m); }
    return m;
  }
  /** Mặt trên có hạt nhiễu kiểu điểm ảnh (tự sinh, không dùng kết cấu có sẵn) */
  private pixelTex(base: string, seed: number): THREE.CanvasTexture {
    const c = document.createElement('canvas'); c.width = 16; c.height = 16;
    const g = c.getContext('2d')!;
    g.fillStyle = base; g.fillRect(0, 0, 16, 16);
    const col = new THREE.Color(base);
    for (let i = 0; i < 70; i++) {
      const r = hash(i * 3.1 + seed, i * 7.7 - seed);
      const shade = col.clone().offsetHSL(0, 0, (r - 0.5) * 0.14);
      g.fillStyle = `#${shade.getHexString()}`;
      g.fillRect(Math.floor(hash(i, seed) * 16), Math.floor(hash(seed, i * 1.3) * 16), 1 + Math.floor(r * 2), 1);
    }
    const t = this.own(new THREE.CanvasTexture(c));
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  private box(w: number, h: number, d: number): THREE.BoxGeometry { return this.own(new THREE.BoxGeometry(w, h, d)); }
  private mesh(geo: THREE.BufferGeometry, color: string, x = 0, y = 0, z = 0): THREE.Mesh { const m = new THREE.Mesh(geo, this.mat(color)); m.position.set(x, y, z); return m; }
  private topOf(x: number, z: number): number {
    const ch = cellAt(this.map, x, z);
    if (ch === 'M') return 2 + Math.floor(hash(x, z) * 2.6);
    return TOP[ch] ?? 1;
  }

  // ------------------------------------------------------------------ dựng thế giới
  private build(view: WorldSession): void {
    this.view = view; this.map = view.map; this.terrain = view.terrain;
    this.skew = view.server_now - Date.now();
    const m = this.map;
    // cột địa hình: mỗi ký hiệu một InstancedMesh, mặt trên có hạt điểm ảnh, mặt bên màu đất / đá
    const cells = new Map<string, Cell[]>();
    for (let z = 0; z < m.h; z++) for (let x = 0; x < m.w; x++) { const ch = cellAt(m, x, z); if (!cells.has(ch)) cells.set(ch, []); cells.get(ch)!.push([x, z]); }
    const unit = this.box(1, 1, 1);
    const tmp = new THREE.Object3D();
    let seed = 1;
    for (const [ch, list] of cells) {
      const side = this.mat(SIDE_COLOR[ch] ?? '#8a6a45');
      const top = this.mat('#ffffff', { map: this.pixelTex(TOP_COLOR[ch] ?? '#7fb05a', seed++) });
      const inst = new THREE.InstancedMesh(unit, [side, side, top, side, side, side], list.length);
      list.forEach(([x, z], i) => {
        const top2 = this.topOf(x, z);
        const bottom = ch === 'D' ? 0.75 : BOTTOM;
        tmp.position.set(x + 0.5, (top2 + bottom) / 2, z + 0.5); tmp.scale.set(1, top2 - bottom, 1); tmp.rotation.set(0, 0, 0); tmp.updateMatrix();
        inst.setMatrixAt(i, tmp.matrix);
      });
      inst.instanceMatrix.needsUpdate = true;
      this.scene.add(inst); this.pickables.push(inst); this.cellOfPick.set(inst, list);
    }
    // đồ vật theo ô: cây, tre, lúa, nhà, lều, tường, điện, cột cầu tàu
    const spawnInst = (geo: THREE.BufferGeometry, color: string, list: Array<{ cell: Cell; pos: [number, number, number]; scale?: [number, number, number]; rot?: number; res?: boolean; spent?: [number, number, number] }>, pick = true): void => {
      if (!list.length) return;
      const inst = new THREE.InstancedMesh(geo, this.mat(color), list.length);
      list.forEach((it, i) => {
        tmp.position.set(...it.pos); tmp.scale.set(...(it.scale ?? [1, 1, 1])); tmp.rotation.set(0, it.rot ?? 0, 0); tmp.updateMatrix();
        inst.setMatrixAt(i, tmp.matrix);
        if (it.res) {
          const matrix = tmp.matrix.clone();
          // sau khi thu hoạch: gốc cây / gốc tre / gốc rạ thấp, vẫn đứng trên mặt đất; tán lá biến mất
          const sp = it.spent ?? [0.001, 0.001, 0.001];
          const geoH = geo instanceof THREE.BoxGeometry ? geo.parameters.height : 1;
          const bottom = it.pos[1] - (geoH * (it.scale ? it.scale[1] : 1)) / 2;
          tmp.scale.set(sp[0], sp[1], sp[2]);
          tmp.position.y = it.spent ? bottom + (geoH * sp[1]) / 2 : it.pos[1];
          tmp.updateMatrix();
          const k = key(it.cell[0], it.cell[1]);
          if (!this.resInst.has(k)) this.resInst.set(k, []);
          this.resInst.get(k)!.push({ mesh: inst, index: i, matrix, spent: tmp.matrix.clone() });
        }
      });
      inst.instanceMatrix.needsUpdate = true;
      this.scene.add(inst);
      if (pick) { this.pickables.push(inst); this.cellOfPick.set(inst, list.map((it) => it.cell)); }
    };
    const trunks: Parameters<typeof spawnInst>[2] = [], leaves: Parameters<typeof spawnInst>[2] = [], poles: Parameters<typeof spawnInst>[2] = [], tufts: Parameters<typeof spawnInst>[2] = [];
    const walls: Parameters<typeof spawnInst>[2] = [], roofs: Parameters<typeof spawnInst>[2] = [], tents: Parameters<typeof spawnInst>[2] = [], fences: Parameters<typeof spawnInst>[2] = [];
    const palace: Parameters<typeof spawnInst>[2] = [], palaceRoof: Parameters<typeof spawnInst>[2] = [], posts: Parameters<typeof spawnInst>[2] = [], bamboLeaf: Parameters<typeof spawnInst>[2] = [];
    for (let z = 0; z < m.h; z++) for (let x = 0; x < m.w; x++) {
      const ch = cellAt(m, x, z), t = this.topOf(x, z), cx = x + 0.5, cz = z + 0.5, cell: Cell = [x, z];
      if (ch === 'T') { trunks.push({ cell, pos: [cx, t + 0.75, cz], res: true, spent: [1, 0.25, 1] }); leaves.push({ cell, pos: [cx, t + 1.85, cz], scale: [1, 1, 1], res: true }); }
      else if (ch === 'B') { for (const [dx, dz, hh] of [[-0.22, -0.15, 1.9], [0.18, -0.2, 1.6], [0, 0.22, 2.1]] as const) poles.push({ cell, pos: [cx + dx, t + hh / 2, cz + dz], scale: [1, hh, 1], res: true, spent: [1, 0.15, 1] }); bamboLeaf.push({ cell, pos: [cx, t + 1.95, cz], res: true }); }
      else if (ch === 'r') { for (const [dx, dz] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]] as const) tufts.push({ cell, pos: [cx + dx, t + 0.22, cz + dz], res: true, spent: [1, 0.2, 1] }); }
      else if (ch === 'H') { walls.push({ cell, pos: [cx, t + 0.45, cz] }); roofs.push({ cell, pos: [cx, t + 1.2, cz], rot: Math.PI / 4 }); }
      else if (ch === 'C') tents.push({ cell, pos: [cx, t + 0.5, cz], rot: Math.PI / 4 });
      else if (ch === 'W') fences.push({ cell, pos: [cx, t + 0.65, cz] });
      else if (ch === 'K') { palace.push({ cell, pos: [cx, t + 0.8, cz] }); palaceRoof.push({ cell, pos: [cx, t + 1.78, cz] }); }
      else if (ch === 'D') posts.push({ cell, pos: [cx, (0.75 + BOTTOM) / 2, cz] }, { cell, pos: [cx + 0.38, (0.75 + BOTTOM) / 2, cz + 0.38] });
    }
    spawnInst(this.box(0.32, 1.5, 0.32), '#7a5634', trunks);
    spawnInst(this.box(1.15, 1.05, 1.15), '#3f7f45', leaves);
    spawnInst(this.box(0.11, 1, 0.11), '#6f9a4e', poles);
    spawnInst(this.box(0.8, 0.28, 0.8), '#7fae5a', bamboLeaf);
    spawnInst(this.box(0.17, 0.44, 0.17), '#c9c25a', tufts);
    spawnInst(this.box(0.92, 0.9, 0.92), '#e2cfa2', walls);
    spawnInst(this.own(new THREE.ConeGeometry(0.86, 0.62, 4)), '#6b4a36', roofs);
    spawnInst(this.own(new THREE.ConeGeometry(0.6, 1, 4)), '#eadcb5', tents);
    spawnInst(this.box(0.96, 1.3, 0.96), '#8a6238', fences);
    spawnInst(this.box(1, 1.5, 1), '#a83226', palace);
    spawnInst(this.box(1.12, 0.36, 1.12), '#2f3f46', palaceRoof);
    spawnInst(this.box(0.14, 1, 0.14), '#5c4128', posts.map((p) => ({ ...p, scale: [1, 0.75 - BOTTOM, 1] as [number, number, number] })), false);
    // mặt nước dâng / rút theo con nước
    this.water = new THREE.Mesh(this.own(new THREE.PlaneGeometry(m.w, m.h)), this.mat('#3d8db0', { transparent: true, opacity: 0.72 }));
    this.water.rotation.x = -Math.PI / 2; this.water.position.set(m.w / 2, WATER_LOW, m.h / 2);
    this.scene.add(this.water);
    this.waterY = this.tideTarget();
    // bàn chế tạo, người, địa danh
    for (const st of m.stations) {
      const g = new THREE.Group();
      g.add(this.mesh(this.box(0.8, 0.5, 0.8), '#9c7347', 0, 0.25, 0), this.mesh(this.box(0.86, 0.08, 0.86), '#c99a62', 0, 0.54, 0), this.mesh(this.box(0.16, 0.16, 0.5), '#6b6b6b', 0.16, 0.66, 0));
      g.position.set(st.at[0] + 0.5, this.topOf(st.at[0], st.at[1]), st.at[1] + 0.5);
      this.scene.add(g); g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { this.pickables.push(o); this.cellOfPick.set(o, [st.at]); } });
      this.mark(st.name, new THREE.Vector3(st.at[0] + 0.5, this.topOf(st.at[0], st.at[1]) + 1.1, st.at[1] + 0.5), 'station');
    }
    for (const n of m.npcs) {
      const char = this.char({ robe: n.look.robe, hat: n.look.hat, beard: n.look.beard });
      char.group.position.set(n.at[0] + 0.5, this.topOf(n.at[0], n.at[1]), n.at[1] + 0.5);
      char.group.rotation.y = hash(n.at[0], n.at[1]) * Math.PI * 2;
      char.group.userData.npc = n.id;
      char.group.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.userData.npc = n.id; this.pickables.push(o); } });
      this.scene.add(char.group);
      const label = this.label(n.name, n.fictional ? 'npc' : 'hero');
      this.npcs.set(n.id, { char, label, at: n.at });
    }
    for (const l of m.labels) this.mark(l.name, new THREE.Vector3(l.at[0] + 0.5, this.topOf(l.at[0], l.at[1]) + 1.6, l.at[1] + 0.5), 'place');
    // người chơi
    this.player = this.char(this.lookOf(view.look));
    this.scene.add(this.player.group);
    // quay lại sau trận: đứng đúng chỗ đã vào trận nếu ô đó còn đi được, không thì chỗ xuất phát
    const back = this.bridge.get<Cell>('world:start');
    const at: Cell = back && !blockedFn(m, this.terrain, view.blocks)(back[0], back[1]) ? back : m.spawn;
    this.me.x = at[0] + 0.5; this.me.z = at[1] + 0.5; this.me.y = this.topOf(at[0], at[1]);
    if (at !== m.spawn) setTimeout(() => this.bridge.emit('world:pos', { x: this.me.x, z: this.me.z, ry: this.me.ry, cell: at }), 0);
    this.meLabel = this.label('Em', 'me');
    this.meBubble = this.bubble();
    // mũi tên chỉ mục tiêu
    this.marker = new THREE.Group();
    const cone = this.mesh(this.own(new THREE.ConeGeometry(0.32, 0.6, 4)), '#f2c230'); cone.rotation.x = Math.PI;
    this.marker.add(cone, this.mesh(this.box(0.16, 0.4, 0.16), '#f2c230', 0, 0.48, 0));
    this.marker.visible = false;
    this.scene.add(this.marker);
    this.applyView(view, true);
  }

  private lookOf(l: WorldLook & { chosen?: boolean }): Look { return { robe: l.robe, hat: l.hat, skin: l.skin, gender: l.gender }; }

  /** Nhân vật khối: chân, áo dài, đai, tay, đầu, tóc, mũ (nón lá / khăn / mũ trụ / mũ quan / vương miện), râu */
  private char(look: Look): Char {
    const g = new THREE.Group();
    const skin = look.skin ?? '#f1cfae', robe = look.robe, dark = `#${new THREE.Color(robe).offsetHSL(0, 0, -0.12).getHexString()}`;
    const legs = [-0.1, 0.1].map((dx) => { const p = new THREE.Group(); p.position.set(dx, 0.42, 0); p.add(this.mesh(this.box(0.15, 0.42, 0.15), '#3a2f28', 0, -0.21, 0)); g.add(p); return p; });
    g.add(this.mesh(this.box(0.5, 0.72, 0.32), robe, 0, 0.76, 0), this.mesh(this.box(0.53, 0.07, 0.35), dark, 0, 0.74, 0), this.mesh(this.box(0.2, 0.3, 0.02), '#f3ead8', 0, 1.0, 0.165));
    const arms = [-0.33, 0.33].map((dx) => { const p = new THREE.Group(); p.position.set(dx, 1.08, 0); p.add(this.mesh(this.box(0.15, 0.5, 0.15), robe, 0, -0.22, 0), this.mesh(this.box(0.13, 0.1, 0.13), skin, 0, -0.5, 0)); g.add(p); return p; });
    g.add(this.mesh(this.box(0.42, 0.42, 0.42), skin, 0, 1.34, 0));
    g.add(this.mesh(this.box(0.06, 0.07, 0.01), '#1d1712', -0.09, 1.37, 0.212), this.mesh(this.box(0.06, 0.07, 0.01), '#1d1712', 0.09, 1.37, 0.212));
    g.add(this.mesh(this.box(0.44, 0.13, 0.44), '#211915', 0, 1.56, 0));
    if (look.gender === 'nu') g.add(this.mesh(this.box(0.44, 0.46, 0.1), '#211915', 0, 1.3, -0.2));
    if (look.beard) g.add(this.mesh(this.box(0.26, 0.1, 0.04), '#2a2420', 0, 1.18, 0.215));
    const hat = look.hat;
    if (hat === 'non') { const c = this.mesh(this.own(new THREE.ConeGeometry(0.46, 0.24, 12)), '#d9c47f', 0, 1.72, 0); g.add(c); }
    else if (hat === 'khan') g.add(this.mesh(this.box(0.47, 0.12, 0.47), '#1f2a33', 0, 1.6, 0));
    else if (hat === 'helmet') g.add(this.mesh(this.box(0.48, 0.2, 0.48), '#7a7f86', 0, 1.62, 0), this.mesh(this.box(0.08, 0.14, 0.08), '#b8261b', 0, 1.79, 0));
    else if (hat === 'crown') g.add(this.mesh(this.box(0.46, 0.17, 0.46), '#c99a2e', 0, 1.62, 0));
    else if (hat === 'mu') g.add(this.mesh(this.box(0.38, 0.22, 0.38), '#18181f', 0, 1.66, 0), this.mesh(this.box(0.24, 0.05, 0.08), '#18181f', -0.3, 1.62, 0), this.mesh(this.box(0.24, 0.05, 0.08), '#18181f', 0.3, 1.62, 0));
    const shadow = new THREE.Mesh(this.own(new THREE.CircleGeometry(0.3, 12)), this.mat('#000000', { transparent: true, opacity: 0.18 }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; g.add(shadow);
    g.scale.setScalar(0.85);
    return { group: g, legs, arms };
  }

  private label(text: string, kind: 'npc' | 'hero' | 'me' | 'peer'): HTMLDivElement {
    const el = document.createElement('div');
    el.textContent = text;
    const bg = kind === 'me' ? '#0f5d58' : kind === 'peer' ? '#2875a7' : kind === 'hero' ? '#8f1f17' : '#3b3128';
    Object.assign(el.style, { position: 'absolute', left: '0', top: '0', padding: '2px 7px', borderRadius: '8px', background: `${bg}e6`, color: '#fff8e6', fontSize: '11px', whiteSpace: 'nowrap', transform: 'translate(-9999px,-9999px)', willChange: 'transform' });
    this.labels.appendChild(el);
    return el;
  }
  private bubble(): HTMLDivElement {
    const el = document.createElement('div');
    Object.assign(el.style, { position: 'absolute', left: '0', top: '0', padding: '4px 9px', borderRadius: '12px', background: '#fffaf0', color: '#2b1d16', border: '2px solid #e3b244', fontSize: '12px', whiteSpace: 'nowrap', transform: 'translate(-9999px,-9999px)', display: 'none' });
    this.labels.appendChild(el);
    return el;
  }
  private mark(text: string, pos: THREE.Vector3, kind: 'place' | 'station'): void {
    const el = document.createElement('div');
    el.textContent = text;
    Object.assign(el.style, kind === 'place'
      ? { position: 'absolute', left: '0', top: '0', color: '#fffaf0', fontSize: '13px', fontStyle: 'italic', textShadow: '0 1px 3px #000, 0 0 2px #000', whiteSpace: 'nowrap', transform: 'translate(-9999px,-9999px)' }
      : { position: 'absolute', left: '0', top: '0', padding: '1px 6px', borderRadius: '6px', background: '#6b4a2ee0', color: '#fff3d6', fontSize: '10px', whiteSpace: 'nowrap', transform: 'translate(-9999px,-9999px)' });
    this.labels.appendChild(el);
    this.marks.push({ el, pos });
  }

  // ------------------------------------------------------------------ trạng thái từ giao diện / máy chủ
  private applyView(view: WorldSession, first = false): void {
    this.view = view;
    this.skew = view.server_now - Date.now();
    this.blocked = blockedFn(this.map, this.terrain, view.blocks);
    const seen = new Set<string>();
    for (const b of view.blocks) { const k = key(b.x, b.z); seen.add(k); if (!this.placed.has(k)) this.addBlock(b, !first); }
    for (const [k, obj] of this.placed) if (!seen.has(k)) this.dropBlock(k, obj);
    for (const n of view.nodes) this.takeNode(n.x, n.z, n.until);
    this.markerKey = '';
    this.refreshPlates();
    this.refreshChanges(view.changes ?? []);
    this.refreshRoutes(view.routes_open ?? []);
  }

  /** Dấu ấn của em: các chặng đã xong để lại người, kho lương, thuyền, cờ, lều, lửa trại trên bản đồ (chỉ trang trí, không chặn đường) */
  private refreshChanges(changes: WorldChangeInfo[]): void {
    const k = changes.map((c) => c.stage).join('|');
    if (k === this.changeKey) return;
    this.changeKey = k;
    for (const c of [...this.changeGroup.children]) this.changeGroup.remove(c);
    const robes = ['#7a5a3a', '#2f5f8f', '#8a3a24', '#3f5a3a', '#6a4c9c'];
    changes.forEach((ch, ci) => ch.props.forEach((pp, i) => {
      const g = new THREE.Group();
      if (pp.kind === 'villager') {
        const c = this.char({ robe: robes[(ci + i) % robes.length], hat: (ci + i) % 2 ? 'non' : 'khan', gender: (ci + i) % 2 ? 'nu' : 'nam' });
        c.group.rotation.y = hash(pp.at[0], pp.at[1]) * Math.PI * 2;
        g.add(c.group);
      } else if (pp.kind === 'granary') g.add(this.mesh(this.box(0.9, 0.7, 0.9), '#c9a473', 0, 0.35, 0), this.mesh(this.own(new THREE.ConeGeometry(0.8, 0.5, 4)), '#7a5232', 0, 0.95, 0), this.mesh(this.box(0.62, 0.2, 0.4), '#d9c48f', 0.25, 0.1, 0.5));
      else if (pp.kind === 'boat') g.add(this.mesh(this.box(0.95, 0.22, 0.5), '#7a5232', 0, 0.13, 0), this.mesh(this.box(1, 0.08, 0.56), '#a87a4c', 0, 0.26, 0), this.mesh(this.box(0.06, 0.8, 0.06), '#5c4128', 0, 0.65, 0), this.mesh(this.box(0.04, 0.5, 0.4), '#efe2c4', 0.04, 0.75, 0));
      else if (pp.kind === 'flag') g.add(this.mesh(this.box(0.07, 1.7, 0.07), '#5c4128', 0, 0.85, 0), this.mesh(this.box(0.04, 0.34, 0.56), '#b8261b', 0, 1.5, 0.3), this.mesh(this.box(0.05, 0.06, 0.56), '#e3b244', 0, 1.34, 0.3));
      else if (pp.kind === 'tent') g.add(this.mesh(this.own(new THREE.ConeGeometry(0.55, 0.95, 4)), '#eadcb5', 0, 0.48, 0));
      else if (pp.kind === 'fire') {
        g.add(this.mesh(this.box(0.5, 0.08, 0.12), '#5c4128', 0, 0.04, 0), this.mesh(this.box(0.12, 0.08, 0.5), '#5c4128', 0, 0.04, 0));
        const flame = this.mesh(this.own(new THREE.ConeGeometry(0.2, 0.5, 6)), '#f08a2a', 0, 0.3, 0);
        flame.userData.fire = true;
        g.add(flame, this.mesh(this.own(new THREE.ConeGeometry(0.1, 0.3, 6)), '#ffd36a', 0, 0.26, 0));
      }
      g.position.set(pp.at[0] + 0.5, this.topOf(pp.at[0], pp.at[1]), pp.at[1] + 0.5);
      this.changeGroup.add(g);
    }));
  }

  /** Bến của các tuyến vận chuyển em đã mở: cột đèn và chiếc thuyền chờ ở mỗi đầu */
  private refreshRoutes(open: string[]): void {
    const k = open.join('|');
    if (k === this.routeKey) return;
    this.routeKey = k;
    for (const c of [...this.routeGroup.children]) this.routeGroup.remove(c);
    for (const r of this.map.routes ?? []) {
      if (!open.includes(r.id)) continue;
      for (const end of [r.a, r.b]) {
        const g = new THREE.Group();
        g.add(this.mesh(this.box(0.1, 1.4, 0.1), '#5c4128', -0.38, 0.7, -0.38), this.mesh(this.box(0.22, 0.26, 0.22), '#f2c230', -0.38, 1.45, -0.38),
          this.mesh(this.box(0.8, 0.16, 0.42), '#7a5232', 0.15, 0.1, 0.2), this.mesh(this.box(0.84, 0.06, 0.46), '#a87a4c', 0.15, 0.2, 0.2));
        g.position.set(end[0] + 0.5, this.topOf(end[0], end[1]), end[1] + 0.5);
        this.routeGroup.add(g);
      }
    }
  }

  private addBlock(b: PlacedBlock, pop: boolean): void {
    const g = new THREE.Group();
    const t = this.topOf(b.x, b.z);
    if (b.block === 'coc') { g.add(this.mesh(this.box(0.22, 0.55, 0.22), '#5a3a22', 0, 0.28, 0)); const tip = this.mesh(this.own(new THREE.ConeGeometry(0.16, 0.26, 4)), '#3b2614', 0, 0.68, 0); g.add(tip); }
    else if (b.block === 'rao') g.add(this.mesh(this.box(0.12, 0.8, 0.12), '#6b4a2a', -0.38, 0.4, 0), this.mesh(this.box(0.12, 0.8, 0.12), '#6b4a2a', 0.38, 0.4, 0), this.mesh(this.box(0.9, 0.1, 0.1), '#a77d4e', 0, 0.55, 0), this.mesh(this.box(0.9, 0.1, 0.1), '#a77d4e', 0, 0.3, 0));
    else if (b.block === 'bao') g.add(this.mesh(this.box(0.62, 0.48, 0.55), '#d9c48f', 0, 0.24, 0), this.mesh(this.box(0.64, 0.06, 0.57), '#a8925e', 0, 0.36, 0));
    else if (b.block === 'leu') g.add(this.mesh(this.own(new THREE.ConeGeometry(0.5, 0.85, 4)), '#eadcb5', 0, 0.43, 0), this.mesh(this.box(0.2, 0.34, 0.02), '#6b4a2a', 0, 0.17, 0.33));
    else if (b.block === 'thuyen') g.add(this.mesh(this.box(0.92, 0.22, 0.5), '#7a5232', 0, 0.13, 0), this.mesh(this.box(0.98, 0.08, 0.56), '#a87a4c', 0, 0.26, 0), this.mesh(this.box(0.06, 0.7, 0.06), '#5c4128', 0, 0.6, 0));
    else g.add(this.mesh(this.box(0.6, 0.6, 0.6), '#9c7347', 0, 0.3, 0));
    g.position.set(b.x + 0.5, t, b.z + 0.5);
    g.rotation.y = (hash(b.x, b.z) - 0.5) * 0.6;
    if (pop && !this.calm) { g.scale.setScalar(0.2); g.userData.grow = 0.2; }
    g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { this.pickables.push(o); this.cellOfPick.set(o, [[b.x, b.z]]); } });
    this.scene.add(g);
    this.placed.set(key(b.x, b.z), g);
  }

  /** Gỡ khối (bị dời đi khi vùng đầy): bỏ khỏi cảnh và khỏi danh sách chọn bằng chuột */
  private dropBlock(k: string, obj: THREE.Object3D): void {
    this.scene.remove(obj);
    this.placed.delete(k);
    obj.traverse((o) => { const i = this.pickables.indexOf(o); if (i >= 0) this.pickables.splice(i, 1); this.cellOfPick.delete(o); });
  }

  private takeNode(x: number, z: number, until: number): void {
    const k = key(x, z);
    this.nodes.set(k, until);
    for (const r of this.resInst.get(k) ?? []) { r.mesh.setMatrixAt(r.index, r.spent); r.mesh.instanceMatrix.needsUpdate = true; }
  }
  private regrow(now: number): void {
    for (const [k, until] of this.nodes) {
      if (until > now) continue;
      this.nodes.delete(k);
      for (const r of this.resInst.get(k) ?? []) { r.mesh.setMatrixAt(r.index, r.matrix); r.mesh.instanceMatrix.needsUpdate = true; }
    }
  }
  private nodeTaken(x: number, z: number): boolean { const u = this.nodes.get(key(x, z)); return Boolean(u && u > Date.now() + this.skew); }

  /** Ô sáng của vùng xây dựng: vùng của bước đang làm, hoặc mọi vùng nhận vật em đang cầm */
  private refreshPlates(): void {
    for (const c of [...this.zonePlates.children]) this.zonePlates.remove(c);
    const cur = this.view.current;
    const ids = new Set<string>();
    if (cur?.type === 'place' && cur.need?.zone) ids.add(cur.need.zone);
    if (cur?.type === 'pick') for (const z of cur.need?.zones ?? []) ids.add(z);
    if (cur?.type === 'drill' && cur.need?.next) ids.add(cur.need.next);
    if (this.mode) for (const z of this.map.zones) if (z.kind === 'build' && z.accepts.includes(this.mode)) ids.add(z.id);
    const plate = this.box(0.92, 0.04, 0.92);
    for (const z of this.map.zones) {
      if (!ids.has(z.id)) continue;
      for (let zz = z.rect[1]; zz < z.rect[1] + z.rect[3]; zz++) for (let x = z.rect[0]; x < z.rect[0] + z.rect[2]; x++) {
        const ch = cellAt(this.map, x, zz);
        if (z.kind === 'build' ? !z.on.includes(ch) : !this.terrain[ch]?.walk) continue;
        const p = new THREE.Mesh(plate, this.mat('#f7d84a', { transparent: true, opacity: 0.45 }));
        p.position.set(x + 0.5, this.topOf(x, zz) + 0.03, zz + 0.5);
        this.zonePlates.add(p);
      }
    }
  }

  private tideTarget(): number { return tideAt(Date.now() + this.skew).state === 'high' ? WATER_HIGH : WATER_LOW; }

  // ------------------------------------------------------------------ bạn cùng lớp
  private peerEvent(e: { type: string; players?: Array<{ id: number; name: string; look: Look; x: number; z: number; ry: number }>; id?: number; name?: string; look?: Look; x?: number; z?: number; ry?: number; code?: string }): void {
    const add = (p: { id: number; name: string; look: Look; x: number; z: number; ry: number }): void => {
      if (this.peers.has(p.id)) return;
      const char = this.char({ ...p.look, robe: p.look?.robe ?? '#2f5f8f', hat: p.look?.hat ?? 'non' });
      char.group.position.set(p.x, this.topOf(Math.floor(p.x), Math.floor(p.z)), p.z);
      this.scene.add(char.group);
      this.peers.set(p.id, { char, x: p.x, z: p.z, tx: p.x, tz: p.z, ry: p.ry, name: p.name, label: this.label(p.name, 'peer'), bubble: this.bubble(), bubbleUntil: 0 });
    };
    const drop = (id: number): void => { const p = this.peers.get(id); if (!p) return; this.scene.remove(p.char.group); p.label.remove(); p.bubble.remove(); this.peers.delete(id); };
    if (e.type === 'snapshot') { for (const id of [...this.peers.keys()]) drop(id); for (const p of e.players ?? []) add(p); }
    else if (e.type === 'join' && e.id) add({ id: e.id, name: e.name ?? 'Bạn cùng lớp', look: e.look ?? { robe: '#2f5f8f', hat: 'non' }, x: e.x ?? this.map.spawn[0] + 0.5, z: e.z ?? this.map.spawn[1] + 0.5, ry: 0 });
    else if (e.type === 'leave' && e.id) drop(e.id);
    else if (e.type === 'move' && e.id) { const p = this.peers.get(e.id); if (p) { p.tx = e.x ?? p.tx; p.tz = e.z ?? p.tz; p.ry = e.ry ?? p.ry; } }
    else if (e.type === 'say' && e.id) {
      const text = SAY[e.code ?? ''] ?? '';
      const p = this.peers.get(e.id);
      if (p) { p.bubble.textContent = text; p.bubble.style.display = 'block'; p.bubbleUntil = performance.now() + 3500; }
      else if (e.id === -1) { this.meBubble.textContent = text; this.meBubble.style.display = 'block'; this.meBubbleUntil = performance.now() + 3500; }
    }
  }

  // ------------------------------------------------------------------ bộ nghe
  private bind(): void {
    const b = this.bridge;
    this.offs.push(
      b.on('world:view', (v: WorldSession) => this.applyView(v)),
      b.on('world:node', (n: { x: number; z: number; until: number }) => this.takeNode(n.x, n.z, n.until)),
      b.on('world:peers', (e) => this.peerEvent(e)),
      b.on('world:lock', (v: boolean) => { this.locked = Boolean(v); if (v) { this.keys.clear(); this.path = []; } }),
      b.on('world:mode', (item: string | null) => { this.mode = item; this.refreshPlates(); }),
      b.on('game:calm', (v: boolean) => { this.calm = Boolean(v); }),
      b.on('world:look', (look: WorldLook) => {
        this.scene.remove(this.player.group);
        this.player = this.char(this.lookOf(look));
        this.scene.add(this.player.group);
      }),
      b.on('world:camera', (k: string) => {
        if (k === 'left') this.yawTarget += Math.PI / 2; else if (k === 'right') this.yawTarget -= Math.PI / 2;
        else if (k === 'in') this.zoom = Math.min(1.9, this.zoom * 1.2); else if (k === 'out') this.zoom = Math.max(0.55, this.zoom / 1.2);
        else if (k === 'reset') { this.zoom = 1; this.yawTarget = Math.PI / 4; }
        this.measure();
      }),
      b.on('world:press', () => this.press()),
      b.on('world:walk', (dir: string) => { this.keys.clear(); if (dir) this.keys.add(dir); }),
    );
    const canvas = this.renderer.domElement;
    const down = (e: KeyboardEvent): void => {
      if (typing() || this.locked) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { this.keys.add(k); this.path = []; this.pending = null; e.preventDefault(); }
      else if (k === 'q') { this.yawTarget += Math.PI / 2; } else if (k === 'r') { this.yawTarget -= Math.PI / 2; }
      else if (k === 'e' || k === 'enter' || k === ' ') { if (document.activeElement === canvas || document.activeElement === document.body) { this.press(); e.preventDefault(); } }
    };
    const up = (e: KeyboardEvent): void => { this.keys.delete(e.key.toLowerCase()); };
    const blur = (): void => this.keys.clear();
    const pdown = (e: PointerEvent): void => { canvas.setPointerCapture?.(e.pointerId); this.pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false }; };
    const pmove = (e: PointerEvent): void => {
      if (!this.pointer || e.pointerId !== this.pointer.id) return;
      const dx = e.clientX - this.pointer.x;
      if (!this.pointer.moved && Math.abs(dx) + Math.abs(e.clientY - this.pointer.y) > 8) this.pointer.moved = true;
      if (this.pointer.moved) { this.yaw += dx * 0.008; this.yawTarget = this.yaw; this.pointer.x = e.clientX; this.pointer.y = e.clientY; }
    };
    const pup = (e: PointerEvent): void => {
      if (!this.pointer || e.pointerId !== this.pointer.id) return;
      const tap = !this.pointer.moved;
      this.pointer = null;
      if (tap && !this.locked) this.tap(e);
    };
    const wheel = (e: WheelEvent): void => { e.preventDefault(); this.zoom = Math.max(0.55, Math.min(1.9, this.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1))); this.measure(); };
    const vis = (): void => { if (document.hidden) this.keys.clear(); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    canvas.addEventListener('pointerdown', pdown); canvas.addEventListener('pointermove', pmove); canvas.addEventListener('pointerup', pup);
    canvas.addEventListener('wheel', wheel, { passive: false }); document.addEventListener('visibilitychange', vis);
    canvas.tabIndex = 0;
    this.offs.push(() => {
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur);
      canvas.removeEventListener('pointerdown', pdown); canvas.removeEventListener('pointermove', pmove); canvas.removeEventListener('pointerup', pup);
      canvas.removeEventListener('wheel', wheel); document.removeEventListener('visibilitychange', vis);
    });
  }

  private myCell(): Cell { return [Math.floor(this.me.x), Math.floor(this.me.z)]; }

  /**
   * Thứ ở cạnh em mà nút "Tương tác" / phím E sẽ dùng. Ưu tiên đúng thứ bước hiện tại cần (người cần gặp, bàn chế tạo khi đang chế tạo) – nếu không,
   * em đứng giữa một người và bàn chế tạo sẽ bấm mãi mà chỉ nghe người đó nói lại. Sau đó là bến của tuyến thuyền đã mở (người chèo thuyền đứng ngay
   * ở bến, không thì nút luôn là "Nói chuyện"), rồi tới người, bàn, tài nguyên gần nhất.
   */
  private nearThing(cell: Cell): { kind: 'npc' | 'station' | 'route' | 'res'; id: string; name: string; at: Cell } | null {
    const cur = this.view.current;
    const npcs = [...this.npcs].filter(([, n]) => chebyshev(n.at, cell) <= 1).map(([id, n]) => ({ kind: 'npc' as const, id, name: this.map.npcs.find((x) => x.id === id)?.name ?? '', at: n.at }));
    const stations = this.map.stations.filter((st) => chebyshev(st.at, cell) <= 1).map((st) => ({ kind: 'station' as const, id: st.id, name: st.name, at: st.at }));
    const wanted = npcs.find((n) => cur?.marker === `npc:${n.id}`);
    if (wanted) return wanted;
    if (cur?.type === 'craft' && stations[0]) return stations[0];
    const ride = routeNear(this.map, this.view.routes_open ?? [], cell);
    if (ride) return { kind: 'route', id: ride.route.id, name: ride.route.name, at: ride.to };
    if (npcs[0]) return npcs[0];
    if (stations[0]) return stations[0];
    const r = this.resNear(cell);
    if (r) { const t = this.terrain[cellAt(this.map, r[0], r[1])]; return { kind: 'res', id: t.res!, name: t.name, at: r }; }
    return null;
  }

  /** Nút "Tương tác" / phím E: nói chuyện, mở bàn chế tạo, đi thuyền, thu thập ở ô cạnh em */
  private press(): void {
    if (this.locked) return;
    const me = this.myCell();
    const t = this.nearThing(me);
    if (!t) return;
    if (t.kind === 'npc') { this.face(t.at); this.bridge.emit('world:act', { type: 'interact', target: `npc:${t.id}` }); }
    else if (t.kind === 'station') this.bridge.emit('world:craft', t.id);
    else if (t.kind === 'route') this.travel(t.at, t.name);
    else { this.face(t.at); this.bridge.emit('world:act', { type: 'gather', at: t.at, from: me }); }
  }
  /** Đi thuyền theo tuyến đã mở: sang bến bên kia (chỉ đổi chỗ đứng; vị trí không ảnh hưởng điểm) */
  private travel(to: Cell, name: string): void {
    this.path = []; this.pending = null;
    this.me.x = to[0] + 0.5; this.me.z = to[1] + 0.5; this.me.y = this.topOf(to[0], to[1]);
    this.focus.set(this.me.x, this.me.y, this.me.z);
    this.lastPos.at = 0;
    this.bridge.emit('world:travel', name);
    this.bridge.emit('world:pos', { x: this.me.x, z: this.me.z, ry: this.me.ry, cell: to });
  }

  private resNear(me: Cell): Cell | null {
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const x = me[0] + dx, z = me[1] + dz;
      if (this.terrain[cellAt(this.map, x, z)]?.res && !this.nodeTaken(x, z)) return [x, z];
    }
    return null;
  }
  private face(at: Cell): void { this.me.ry = Math.atan2(at[0] + 0.5 - this.me.x, at[1] + 0.5 - this.me.z); }

  /** Chạm / bấm vào cảnh: người → tới nói chuyện; bàn chế tạo → mở; tài nguyên → thu thập; vùng xây dựng (đang cầm vật) → đặt; ô trống → đi tới */
  private tap(e: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    const hits = this.ray.intersectObjects(this.pickables, false);
    const hit = hits[0];
    if (!hit) return;
    // Đang cầm vật: ô sáng của vùng xây dựng nằm sau núi / nhà / khối đã đặt (nhìn chéo nên bị che) vẫn chạm được – lấy ô còn trống đầu tiên dọc theo tia
    // chỉ xuyên qua khi chạm trúng vật che (núi, nhà, khối đã đặt) hoặc chính ô của vùng; chạm người / bàn / cây / đất trống thì làm việc bình thường
    const first = hit.object.userData.npc ? null : this.cellOfHit(hit);
    const occluder = Boolean(first && this.blocked(first[0], first[1]) && !this.map.stations.some((st) => st.at[0] === first[0] && st.at[1] === first[1]) && !this.terrain[cellAt(this.map, first[0], first[1])]?.res);
    if (this.mode && first && (occluder || buildZoneAt(this.map, first[0], first[1], this.mode))) {
      const cells = hits.map((h) => this.cellOfHit(h)).filter((c): c is Cell => Boolean(c && buildZoneAt(this.map, c[0], c[1], this.mode!)));
      const c = cells.find((x) => !this.placed.has(key(x[0], x[1]))) ?? cells[0];
      if (c) { this.goNear(c, { kind: 'place', at: c, item: this.mode }, 2); return; }
    }
    const npc = hit.object.userData.npc as string | undefined;
    if (npc) { const n = this.npcs.get(npc)!; this.goNear(n.at, { kind: 'npc', at: n.at, id: npc }); return; }
    const cell = this.cellOfHit(hit);
    if (!cell) return;
    const st = this.map.stations.find((s) => s.at[0] === cell[0] && s.at[1] === cell[1]);
    if (st) { this.goNear(st.at, { kind: 'station', at: st.at, id: st.id }); return; }
    if (this.terrain[cellAt(this.map, cell[0], cell[1])]?.res) {
      if (this.nodeTaken(cell[0], cell[1])) { this.bridge.emit('world:hint', 'Chỗ này vừa được thu hoạch. Tìm chỗ khác hoặc chờ một lát.'); return; }
      this.goNear(cell, { kind: 'gather', at: cell });
      return;
    }
    if (this.mode && buildZoneAt(this.map, cell[0], cell[1], this.mode)) { this.goNear(cell, { kind: 'place', at: cell, item: this.mode }, 2); return; }
    // chạm trúng núi / đá / tường / nhà cao (nhìn chéo nên che ô phía sau): đi tới ô đi được đầu tiên dọc theo tia chạm
    const ground = !this.blocked(cell[0], cell[1]) ? cell
      : hits.map((h) => this.cellOfHit(h)).find((c): c is Cell => Boolean(c && !this.blocked(c[0], c[1]) && !this.terrain[cellAt(this.map, c[0], c[1])]?.res));
    if (ground) {
      const r = this.plan(ground, this.myCell(), 0);
      if (r) { this.path = r.path; this.pending = null; }
    }
  }

  /** Tìm đường tới gần ô đích; ở bước chọn nơi / luyện đội hình thì tránh các vùng khác của bước (xem stepAvoid), không có đường như vậy mới đi thẳng */
  private plan(target: Cell, me: Cell, range: number): { cell: Cell; path: Cell[] } | null {
    const avoid = stepAvoid(this.map, this.view.current, target);
    if (avoid.size) {
      const r = standNear(this.map, (x, z) => this.blocked(x, z) || avoid.has(key(x, z)), target, me, range);
      if (r) return r;
    }
    return standNear(this.map, this.blocked, target, me, range);
  }

  /** Ô bản đồ ứng với một điểm chạm (khối địa hình dùng InstancedMesh: mỗi bản sao một ô) */
  private cellOfHit(h: THREE.Intersection): Cell | null {
    const list = this.cellOfPick.get(h.object);
    if (!list) return null;
    return (h.instanceId !== undefined && list.length > 1 ? list[h.instanceId] : list[0]) ?? null;
  }

  private goNear(target: Cell, pending: NonNullable<Pending>, range = 1): void {
    const me = this.myCell();
    if (chebyshev(me, target) <= range && !this.blocked(me[0], me[1])) { this.path = []; this.pending = pending; this.finish(); return; }
    const r = this.plan(target, me, range);
    if (!r) { this.bridge.emit('world:hint', 'Không tìm được đường tới đó. Thử đi vòng hoặc chọn chỗ khác.'); return; }
    this.path = r.path; this.pending = pending;
  }

  /** Tới nơi: gửi lệnh tương ứng qua cầu nối (giao diện gửi máy chủ) */
  private finish(): void {
    const p = this.pending;
    this.pending = null;
    if (!p) return;
    const me = this.myCell();
    this.face(p.at);
    if (p.kind === 'npc') this.bridge.emit('world:act', { type: 'interact', target: `npc:${p.id}` });
    else if (p.kind === 'station') this.bridge.emit('world:craft', p.id);
    else if (p.kind === 'gather' && reachable(p.at, me)) this.bridge.emit('world:act', { type: 'gather', at: p.at, from: me });
    else if (p.kind === 'place' && reachable(p.at, me)) this.bridge.emit('world:act', { type: 'place', at: p.at, from: me, item: p.item });
  }

  // ------------------------------------------------------------------ vòng lặp
  private measure(): void {
    this.width = Math.max(1, this.host.clientWidth); this.height = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(this.width, this.height, false);
    this.renderer.domElement.style.width = '100%'; this.renderer.domElement.style.height = '100%';
    const half = (this.width < 600 ? 7.5 : 9.5) / this.zoom, aspect = this.width / this.height;
    Object.assign(this.camera, { left: -half * aspect, right: half * aspect, top: half, bottom: -half });
    this.camera.updateProjectionMatrix();
  }

  private moveMe(dt: number): boolean {
    let vx = 0, vz = 0;
    const f: [number, number] = [-Math.sin(this.yaw), -Math.cos(this.yaw)], r: [number, number] = [Math.cos(this.yaw), -Math.sin(this.yaw)];
    if (this.keys.has('w') || this.keys.has('arrowup')) { vx += f[0]; vz += f[1]; }
    if (this.keys.has('s') || this.keys.has('arrowdown')) { vx -= f[0]; vz -= f[1]; }
    if (this.keys.has('d') || this.keys.has('arrowright')) { vx += r[0]; vz += r[1]; }
    if (this.keys.has('a') || this.keys.has('arrowleft')) { vx -= r[0]; vz -= r[1]; }
    if (!vx && !vz && this.path.length) {
      const [cx, cz] = this.path[0];
      const tx = cx + 0.5 - this.me.x, tz = cz + 0.5 - this.me.z, d = Math.hypot(tx, tz);
      if (d < 0.08) { this.me.x = cx + 0.5; this.me.z = cz + 0.5; this.path.shift(); if (!this.path.length) this.finish(); return true; }
      vx = tx / d; vz = tz / d;
      const step = Math.min(d, SPEED * dt);
      this.me.x += vx * step; this.me.z += vz * step; this.me.ry = Math.atan2(vx, vz);
      return true;
    }
    if (!vx && !vz) return false;
    const len = Math.hypot(vx, vz); vx /= len; vz /= len;
    const step = SPEED * dt, pad = 0.28;
    const nx = this.me.x + vx * step, nz = this.me.z + vz * step;
    if (!this.blocked(Math.floor(nx + Math.sign(vx) * pad), Math.floor(this.me.z))) this.me.x = nx;
    if (!this.blocked(Math.floor(this.me.x), Math.floor(nz + Math.sign(vz) * pad))) this.me.z = nz;
    this.me.ry = Math.atan2(vx, vz);
    return true;
  }

  private animateChar(c: Char, moving: boolean, t: number): void {
    const s = moving ? Math.sin(t * 10) * 0.6 : 0;
    c.legs[0].rotation.x = s; c.legs[1].rotation.x = -s; c.arms[0].rotation.x = -s * 0.8; c.arms[1].rotation.x = s * 0.8;
  }

  private place(el: HTMLElement, pos: THREE.Vector3, dy = 0): void {
    const v = pos.clone().project(this.camera);
    if (v.z > 1 || v.x < -1.2 || v.x > 1.2 || v.y < -1.2 || v.y > 1.2) { el.style.transform = 'translate(-9999px,-9999px)'; return; }
    const x = (v.x * 0.5 + 0.5) * this.width, y = (-v.y * 0.5 + 0.5) * this.height + dy;
    el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
  }

  private tick(dt: number): void {
    const now = performance.now(), t = now / 1000, server = Date.now() + this.skew;
    const moving = !this.locked && this.moveMe(dt);
    const cell = this.myCell();
    const ground = this.topOf(cell[0], cell[1]);
    this.me.y += (ground - this.me.y) * Math.min(1, dt * 12);
    this.player.group.position.set(this.me.x, this.me.y, this.me.z);
    this.player.group.rotation.y = this.me.ry;
    this.animateChar(this.player, moving, t);
    // vị trí của em cho giao diện (gửi bạn cùng lớp, dùng làm "đứng ở đâu" khi gửi lệnh)
    if (moving && now - this.lastPos.at > 120 && (Math.abs(this.me.x - this.lastPos.x) > 0.05 || Math.abs(this.me.z - this.lastPos.z) > 0.05)) {
      this.lastPos = { x: this.me.x, z: this.me.z, at: now };
      this.bridge.emit('world:pos', { x: this.me.x, z: this.me.z, ry: this.me.ry, cell });
    }
    // gần ai / gần cái gì, đang ở vùng nào
    if (now - this.nearAt > 150) {
      this.nearAt = now;
      const t = this.nearThing(cell);
      const near = t ? `${t.kind}:${t.id}:${this.view.current?.id ?? ''}` : '';
      if (near !== this.near) { this.near = near; this.bridge.emit('world:near', t ? { kind: t.kind, id: t.id, name: t.name } : null); }
      const zone = this.map.zones.find((z) => inRect(z.rect, cell[0], cell[1]))?.id ?? '';
      // báo cả khi rời vùng ('' = không ở vùng nào) để giao diện biết em còn đứng trong vùng hay không
      if (zone !== this.zoneIn) { this.zoneIn = zone; this.bridge.emit('world:zone', zone); }
    }
    // nước triều, ô mọc lại
    this.waterY += (this.tideTarget() - this.waterY) * Math.min(1, dt * (this.calm ? 3 : 0.8));
    this.water.position.y = this.waterY + (this.calm ? 0 : Math.sin(t * 1.3) * 0.02);
    if ((this.frame & 31) === 0) this.regrow(server);
    // lửa trại bập bùng (đứng yên khi giảm chuyển động)
    if (!this.calm) this.changeGroup.traverse((o) => { if (o.userData.fire) o.scale.set(1, 0.8 + Math.sin(t * 9 + o.id) * 0.25, 1); });
    // khối vừa đặt lớn dần
    for (const obj of this.placed.values()) if (obj.userData.grow !== undefined) { obj.userData.grow = Math.min(1, obj.userData.grow + dt * 3); obj.scale.setScalar(obj.userData.grow); if (obj.userData.grow >= 1) delete obj.userData.grow; }
    // bạn cùng lớp
    for (const p of this.peers.values()) {
      const dx = p.tx - p.x, dz = p.tz - p.z, d = Math.hypot(dx, dz);
      const go = d > 0.02;
      if (d > 6) { p.x = p.tx; p.z = p.tz; } else if (go) { const k = Math.min(1, dt * 8); p.x += dx * k; p.z += dz * k; }
      const pc: Cell = [Math.floor(p.x), Math.floor(p.z)];
      p.char.group.position.set(p.x, this.topOf(pc[0], pc[1]), p.z);
      p.char.group.rotation.y = p.ry;
      this.animateChar(p.char, go, t);
      const head = p.char.group.position.clone(); head.y += 1.75;
      this.place(p.label, head);
      if (p.bubbleUntil && now > p.bubbleUntil) { p.bubble.style.display = 'none'; p.bubbleUntil = 0; }
      if (p.bubbleUntil) this.place(p.bubble, head, -20);
    }
    // mũi tên chỉ mục tiêu
    if (now - this.markerAt > 600) {
      this.markerAt = now;
      const cur = this.view.current;
      const mk = cur?.type === 'drill' && cur.need?.next ? `zone:${cur.need.next}` : cur?.marker ?? null;
      const target = markerCells(mk, this.map, this.terrain, cell, (x, z) => this.nodeTaken(x, z))[0];
      const k = target ? key(target[0], target[1]) : '';
      if (k !== this.markerKey) { this.markerKey = k; this.marker.visible = Boolean(target); if (target) this.marker.position.set(target[0] + 0.5, this.topOf(target[0], target[1]) + 2.7, target[1] + 0.5); }
    }
    if (this.marker.visible && !this.calm) this.marker.children.forEach((c, i) => { c.position.y = (i ? 0.48 : 0) + Math.sin(t * 3) * 0.15; });
    // máy quay theo em
    this.yaw += (this.yawTarget - this.yaw) * Math.min(1, dt * (this.calm ? 20 : 7));
    this.focus.lerp(new THREE.Vector3(this.me.x, this.me.y, this.me.z), this.calm ? 1 : Math.min(1, dt * 6));
    const dist = 60, pitch = 0.62;
    this.camera.position.set(this.focus.x + dist * Math.cos(pitch) * Math.sin(this.yaw), this.focus.y + dist * Math.sin(pitch), this.focus.z + dist * Math.cos(pitch) * Math.cos(this.yaw));
    this.camera.lookAt(this.focus);
    this.camera.updateMatrixWorld();
    // nhãn
    const head = this.player.group.position.clone(); head.y += 1.75;
    this.place(this.meLabel, head);
    if (this.meBubbleUntil && now > this.meBubbleUntil) { this.meBubble.style.display = 'none'; this.meBubbleUntil = 0; }
    if (this.meBubbleUntil) this.place(this.meBubble, head, -20);
    for (const [, n] of this.npcs) { const pos = n.char.group.position.clone(); pos.y += 1.75; this.place(n.label, pos); }
    for (const mk of this.marks) this.place(mk.el, mk.pos);
    this.renderer.render(this.scene, this.camera);
  }

  destroy(): void {
    this.alive = false;
    cancelAnimationFrame(this.frame);
    this.resize?.disconnect();
    for (const off of this.offs) off();
    for (const o of this.owned) o.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labels.remove();
  }
}

/** Tạo cảnh trong `host` (WorldViewport.web.tsx); ném lỗi khi trình duyệt không có WebGL để khung hiện thông báo */
export function createWorld(host: HTMLElement, bridge: GameBridge): { destroy: () => void } {
  const w = new BlockWorld(host, bridge);
  return { destroy: () => w.destroy() };
}
