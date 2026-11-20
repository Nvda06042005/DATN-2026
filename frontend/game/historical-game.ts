/** Original 3D historical dioramas. Only presentation and navigation live here; all outcomes come from the API. */
import * as THREE from 'three';
import type { BdEvent, BdUnit, BdView, ExploreView, TacticsEvent, TacticsUnit, TacticsView, XY } from '@/types/saga';
import type { GameBridge, GameKind } from './bridge';
import { createHistoricalModels } from './historical-models';
import { createLandscape } from './historical-landscape';
import { EXPLORE_CELL, RIVER_CELL, formationOffsets, gridCell, isFree, routeTo, walkGrid, worldCell } from './historical-logic';

type Piece = { object: THREE.Group; ring: THREE.Mesh; bar: THREE.Mesh; status: THREE.Mesh; unit: TacticsUnit | BdUnit; home: THREE.Vector3 };
type RiverMode = { kind: 'none' | 'stake' | 'lure' } | { kind: 'ally'; unit: string };
const UP = new THREE.Vector3(0, 1, 0);
const typing = (): boolean => Boolean(document.activeElement?.closest('input,textarea,select,[contenteditable="true"]'));

export class HistoricalGame {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-32, 32, 19, -19, 0.1, 240);
  readonly renderer: THREE.WebGLRenderer;
  readonly models!: ReturnType<typeof createHistoricalModels>;
  private readonly disposables = new Set<THREE.BufferGeometry | THREE.Material>();
  private readonly offs: Array<() => void> = [];
  private readonly ray = new THREE.Raycaster();
  private readonly plane = new THREE.Plane(UP, 0);
  private readonly target = new THREE.Vector3(0, 0, 0);
  private readonly pieces = new Map<string, Piece>();
  private readonly npcs = new Map<string, THREE.Group>();
  private readonly items = new Map<string, THREE.Group>();
  private readonly effects = new THREE.Group();
  private readonly hints = new THREE.Group();
  private readonly stakes = new THREE.Group();
  private readonly keys = new Set<string>();
  private landscape?: ReturnType<typeof createLandscape>;
  private frame = 0;
  private alive = true;
  private hidden = false;
  private last = 0;
  private elapsed = 0;
  private scanTime = 0;
  private width = 960;
  private height = 540;
  private yaw = 0;
  private pitch = 0.88;
  private zoom = 1;
  private span = 38;
  private pointer: { x: number; y: number; lastX: number; lastY: number; moved: boolean } | null = null;
  private view?: ExploreView;
  private tactics?: TacticsView;
  private river?: BdView;
  private mode: RiverMode = { kind: 'none' };
  private targets = new Set<string>();
  private playing = false;
  private locked = false;
  private blocked: boolean[][] = [];
  private path: XY[] = [];
  private pending: string | null = null;
  private near: string | null = null;
  private zone: string | null = null;
  private player?: THREE.Group;
  private marker?: THREE.Group;
  private hover: XY | null = null;
  private cursor: XY | null = null;
  private readonly tweens = new Set<{ start: number; duration: number; tick: (t: number) => void; resolve: () => void }>();

  constructor(private readonly parent: HTMLElement, private readonly kind: GameKind | 'intro', private readonly bridge: GameBridge, mood = 'village') {
    // Construct before touching the host: a WebGL failure can cleanly use the existing Canvas renderer.
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
    try {
      this.models = createHistoricalModels();
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.12;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.scene.background = new THREE.Color('#acb9ae');
      this.scene.fog = new THREE.Fog('#acb9ae', 65, 150);
      this.scene.add(new THREE.HemisphereLight('#dde8e6', '#695b41', 2));
      const sun = new THREE.DirectionalLight('#fff0cf', 3.4);
      sun.position.set(-22, 45, 25); sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      Object.assign(sun.shadow.camera, { left: -43, right: 43, top: 38, bottom: -38, near: 0.5, far: 120 });
      sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.08;
      this.scene.add(sun, this.effects, this.hints, this.stakes);
      this.offs.push(() => sun.shadow.dispose());
      if (kind === 'explore') this.initExplore();
      else if (kind === 'tactics') this.initTactics();
      else if (kind === 'bachdang') this.initRiver();
      else this.initIntro(mood);
      const canvas = this.renderer.domElement;
      Object.assign(canvas.style, { width: '100%', height: '100%', display: 'block', outline: 'none', touchAction: kind === 'intro' ? 'pan-y' : 'none' });
      canvas.tabIndex = kind === 'intro' ? -1 : 0;
      canvas.setAttribute('aria-label', kind === 'explore' ? 'Sa bàn khám phá. Bấm để đi, phím E để tương tác.' : 'Sa bàn lịch sử. Bấm chọn mục tiêu, kéo để đổi góc nhìn.');
      this.parent.appendChild(canvas);
      this.resize(); this.bind();
      this.offs.push(bridge.on('game:camera', (command: string) => {
        if (command === 'reset') { this.yaw = 0; this.pitch = 0.88; this.zoom = 1; }
        else this.zoom = THREE.MathUtils.clamp(this.zoom * (command === 'in' ? 1.16 : 1 / 1.16), 0.8, 2.2);
        this.cameraPose();
      }));
      this.frame = requestAnimationFrame(this.update);
      if (kind !== 'intro') bridge.emit(`${kind === 'bachdang' ? 'bd' : kind}:ready`);
    } catch (error) { this.destroy(); throw error; }
  }

  private own<T extends THREE.BufferGeometry | THREE.Material>(resource: T): T { this.disposables.add(resource); return resource; }
  private flat(color: string, opacity = 1): THREE.MeshBasicMaterial {
    return this.own(new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity === 1, side: THREE.DoubleSide }));
  }
  private ring(radius: number, color: string): THREE.Mesh {
    const mesh = new THREE.Mesh(this.own(new THREE.RingGeometry(radius - 0.08, radius, 48)), this.flat(color));
    mesh.rotation.x = -Math.PI / 2; mesh.position.y = 0.06; return mesh;
  }
  private point(at: XY, river = false): THREE.Vector3 {
    const [x, z] = worldCell(at, river ? this.river!.grid.w : this.view!.grid[0].length, river ? this.river!.grid.h : this.view!.grid.length, river ? RIVER_CELL : EXPLORE_CELL);
    return new THREE.Vector3(x, 0, z);
  }
  private cell(position: THREE.Vector3, river = false): XY {
    return gridCell(position.x, position.z, river ? this.river!.grid.w : this.view!.grid[0].length, river ? this.river!.grid.h : this.view!.grid.length, river ? RIVER_CELL : EXPLORE_CELL);
  }
  private cameraPose(): void {
    this.camera.position.set(Math.sin(this.yaw) * Math.cos(this.pitch) * 80, Math.sin(this.pitch) * 80, Math.cos(this.yaw) * Math.cos(this.pitch) * 80).add(this.target);
    this.camera.lookAt(this.target);
    const half = this.span / (2 * this.zoom), aspect = this.width / this.height;
    this.camera.left = -half * aspect; this.camera.right = half * aspect; this.camera.top = half; this.camera.bottom = -half;
    this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld();
  }
  private resize = (): void => {
    this.width = Math.max(1, this.parent.clientWidth); this.height = Math.max(1, this.parent.clientHeight);
    this.renderer.setSize(this.width, this.height, false); this.cameraPose();
  };
  private bind(): void {
    const canvas = this.renderer.domElement;
    const on = <K extends keyof HTMLElementEventMap>(type: K, fn: (e: HTMLElementEventMap[K]) => void): void => {
      canvas.addEventListener(type, fn); this.offs.push(() => canvas.removeEventListener(type, fn));
    };
    if (this.kind !== 'intro') {
      on('pointerdown', e => { if (e.button > 0) return; canvas.focus({ preventScroll: true }); canvas.setPointerCapture(e.pointerId); this.pointer = { x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, moved: false }; });
      on('pointermove', e => {
        const p = this.pointer;
        if (p) {
          if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 6) p.moved = true;
          if (p.moved) { this.yaw = THREE.MathUtils.clamp(this.yaw - (e.clientX - p.lastX) * 0.004, -0.55, 0.55); this.pitch = THREE.MathUtils.clamp(this.pitch + (e.clientY - p.lastY) * 0.003, 0.65, 1.22); this.cameraPose(); }
          p.lastX = e.clientX; p.lastY = e.clientY;
        } else if (this.kind === 'bachdang') { const hit = this.groundAt(e); this.hover = hit ? this.cell(hit, true) : null; this.cursor = null; this.riverHints(); }
      });
      on('pointerup', e => { const click = this.pointer && !this.pointer.moved; this.pointer = null; if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId); if (click) this.click(e); });
      on('pointercancel', () => { this.pointer = null; });
      on('keydown', e => this.key(e));
      on('keyup', e => this.keys.delete(e.key.toLowerCase()));
      on('blur', () => this.keys.clear());
      on('contextmenu', e => e.preventDefault());
    }
    const lost = (e: Event): void => { e.preventDefault(); this.hidden = true; this.keys.clear(); this.bridge.emit('game:unavailable'); };
    canvas.addEventListener('webglcontextlost', lost); this.offs.push(() => canvas.removeEventListener('webglcontextlost', lost));
    const visibility = (): void => { this.keys.clear(); this.last = 0; }; document.addEventListener('visibilitychange', visibility); this.offs.push(() => document.removeEventListener('visibilitychange', visibility));
    if (typeof ResizeObserver !== 'undefined') { const observer = new ResizeObserver(this.resize); observer.observe(this.parent); this.offs.push(() => observer.disconnect()); }
    else { window.addEventListener('resize', this.resize); this.offs.push(() => window.removeEventListener('resize', this.resize)); }
  }
  private groundAt(e: PointerEvent): THREE.Vector3 | null {
    // Always measure now: the student page scrolls inside its own container.
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1), this.camera);
    return this.ray.ray.intersectPlane(this.plane, new THREE.Vector3());
  }
  private click(e: PointerEvent): void {
    const ground = this.groundAt(e); if (!ground) return;
    if (this.kind === 'explore') {
      if (this.locked || !this.view || !this.player) return;
      const targets = [...this.npcs, ...this.items].map(([id, object]) => ({ id, object }));
      const meshes = targets.flatMap(({ id, object }) => { const out: THREE.Object3D[] = []; object.traverse(o => { if (o instanceof THREE.Mesh) { o.userData.target = id; out.push(o); } }); return out; });
      const hit = this.ray.intersectObjects(meshes, false)[0];
      const cell = this.cell(ground);
      const record = hit ? targets.find(t => t.id === hit.object.userData.target) : targets.find(t => { const at = this.cell(t.object.position); return at[0] === cell[0] && at[1] === cell[1]; });
      this.pending = record?.id ?? null;
      this.path = routeTo(this.blocked, this.cell(this.player.position), record ? this.cell(record.object.position) : cell, Boolean(record));
      if (!this.path.length && record) { this.scan(); this.interact(); }
    } else if (this.kind === 'tactics' && !this.playing) {
      const hits = this.ray.intersectObjects([...this.pieces.values()].filter(p => p.object.visible).map(p => p.object), true);
      let object: THREE.Object3D | null = hits[0]?.object ?? null;
      while (object && !object.userData.unit) object = object.parent;
      if (object) this.bridge.emit(this.targets.has(object.userData.unit) ? 'tactics:pick' : 'tactics:inspect', object.userData.unit);
    } else if (this.kind === 'bachdang' && !this.playing && this.river) {
      const hit = this.ray.intersectObjects([...this.pieces.values()].filter(p => p.object.visible).map(p => p.object), true)[0];
      let object: THREE.Object3D | null = hit?.object ?? null;
      while (object && !object.userData.unit) object = object.parent;
      const boat = object ? this.river.units.find(u => u.id === object!.userData.unit) : null;
      if (boat) { this.emitRiverCell([boat.x, boat.y]); return; }
      const at = this.cell(ground, true);
      if (at[0] >= 0 && at[1] >= 0 && at[0] < this.river.grid.w && at[1] < this.river.grid.h) this.emitRiverCell(at);
    }
  }
  private key(e: KeyboardEvent): void {
    if (typing()) return;
    const key = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) e.preventDefault();
    if (this.kind === 'explore') { this.keys.add(key); if (!e.repeat && ['e', 'enter', ' '].includes(key)) this.interact(); }
    else if (this.kind === 'bachdang' && !this.playing && this.river) {
      const moves: Record<string, XY> = { arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0], arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1] };
      if (moves[key]) {
        const bait = this.river.units.find(u => u.side === 'ally' && u.role === 'bait');
        const from = this.cursor ?? (bait ? [bait.x, bait.y] : [0, 0]); const [dx, dy] = moves[key];
        this.cursor = [THREE.MathUtils.clamp(from[0] + dx, 0, this.river.grid.w - 1), THREE.MathUtils.clamp(from[1] + dy, 0, this.river.grid.h - 1)]; this.hover = this.cursor; this.riverHints();
      } else if (['e', 'enter', ' '].includes(key) && this.cursor) this.emitRiverCell(this.cursor);
    }
  }
  private emitRiverCell([x, y]: XY): void {
    const unit = this.river?.units.find(u => u.x === x && u.y === y && ['free', 'slow', 'stuck'].includes(u.state));
    this.bridge.emit('bd:cell', { x, y, unit: unit?.id ?? null });
  }

  private initExplore(): void {
    this.view = this.bridge.get<ExploreView>('explore:view')!;
    if (!this.view) throw Error('Missing exploration view');
    this.span = 38;
    this.landscape = createLandscape(this.scene, 'explore', { grid: this.view.grid, mood: this.view.scene, width: this.view.grid[0].length * EXPLORE_CELL, depth: this.view.grid.length * EXPLORE_CELL, prop: this.models.prop });
    for (const npc of this.view.npcs) { const object = this.models.person(npc.sprite); object.position.copy(this.point(npc.at)); this.scene.add(object); this.npcs.set(`npc:${npc.id}`, object); }
    this.player = this.models.person('player'); this.player.position.copy(this.point(this.view.spawn)); this.scene.add(this.player);
    const playerRing = this.ring(0.53, '#e8cd85'); this.player.add(playerRing);
    this.marker = new THREE.Group();
    const diamond = new THREE.Mesh(this.own(new THREE.OctahedronGeometry(0.24)), this.flat('#ffe3a2')); diamond.position.y = 3.2; this.marker.add(diamond, this.ring(0.8, '#f2d18b')); this.scene.add(this.marker);
    this.locked = Boolean(this.bridge.get('explore:lock')); this.syncExplore(this.view);
    this.offs.push(this.bridge.on('explore:view', (v: ExploreView) => this.syncExplore(v)), this.bridge.on('explore:lock', (b: boolean) => { this.locked = b; if (b) { this.path = []; this.pending = null; } }), this.bridge.on('explore:press', () => this.interact()));
  }
  private syncExplore(v: ExploreView): void {
    if (v.progress.step !== this.view?.progress.step) this.zone = null;
    this.view = v;
    this.blocked = walkGrid(v.grid, [...v.npcs, ...v.items].map(n => n.at));
    const live = new Set(v.items.map(i => `item:${i.id}`));
    for (const [key, object] of this.items) if (!live.has(key)) { this.scene.remove(object); this.items.delete(key); }
    for (const item of v.items) if (!this.items.has(`item:${item.id}`)) {
      const kinds: Record<string, string> = { plank: 'logs', rice: 'sacks', flag: 'banner', token: 'token', scroll: 'scroll', torch: 'fire', horn: 'horn', stake: 'stakes' };
      const object = this.models.prop(kinds[item.sprite] ?? 'scroll');
      object.scale.setScalar(0.5); object.position.copy(this.point(item.at)); object.add(this.ring(1.1, '#e8cd85')); this.items.set(`item:${item.id}`, object); this.scene.add(object);
    }
    const marker = v.current?.marker; let at: XY | undefined;
    if (marker?.startsWith('npc:')) at = v.npcs.find(n => `npc:${n.id}` === marker)?.at;
    if (marker?.startsWith('item:')) at = v.items.find(i => `item:${i.id}` === marker)?.at;
    this.clearGroup(this.hints);
    if (marker?.startsWith('zone:')) { const zone = v.zones.find(z => `zone:${z.id}` === marker); if (zone) { const [x, y, w, h] = zone.rect; const center = this.point([x + (w - 1) / 2, y + (h - 1) / 2]); const ring = this.ring(Math.max(1, Math.min(w, h) * EXPLORE_CELL / 2), zone.kind === 'enemy' ? '#db775b' : '#efd89e'); ring.position.add(center); this.hints.add(ring); } }
    if (this.marker) { this.marker.visible = Boolean(at); if (at) this.marker.position.copy(this.point(at)); }
  }
  private scan(): void {
    if (!this.view || !this.player) return;
    const [px, py] = this.cell(this.player.position); let nearest: { target: string; name: string; distance: number } | null = null;
    for (const item of [...this.view.npcs.map(n => ({ target: `npc:${n.id}`, ...n })), ...this.view.items.map(i => ({ target: `item:${i.id}`, ...i }))]) {
      const distance = Math.max(Math.abs(item.at[0] - px), Math.abs(item.at[1] - py));
      if (distance <= 1 && (!nearest || distance < nearest.distance || item.target === this.view.current?.marker)) nearest = { target: item.target, name: item.name, distance };
    }
    if ((nearest?.target ?? null) !== this.near) { this.near = nearest?.target ?? null; this.bridge.emit('explore:near', nearest ? { target: nearest.target, name: nearest.name } : null); }
    const zone = this.view.zones.find(z => px >= z.rect[0] && px < z.rect[0] + z.rect[2] && py >= z.rect[1] && py < z.rect[1] + z.rect[3]);
    if (!zone) this.zone = null;
    else if (!this.locked && zone.id !== this.zone) { this.zone = zone.id; this.bridge.emit('explore:zone', zone.id); }
  }
  private interact(): void {
    if (this.locked || typing() || !this.player) return;
    this.scan(); const target = this.pending ?? this.near;
    this.pending = null;
    if (!target) return;
    const object = this.npcs.get(target) ?? this.items.get(target);
    if (!object) return;
    const at = this.cell(object.position), playerAt = this.cell(this.player.position);
    if (Math.max(Math.abs(at[0] - playerAt[0]), Math.abs(at[1] - playerAt[1])) > 1) return;
    this.player.rotation.y = Math.atan2(object.position.x - this.player.position.x, object.position.z - this.player.position.z);
    this.bridge.emit('explore:interact', { target });
  }
  private movePlayer(dt: number): void {
    if (!this.player || this.locked || typing()) return;
    let dx = Number(this.keys.has('d') || this.keys.has('arrowright')) - Number(this.keys.has('a') || this.keys.has('arrowleft'));
    let dz = Number(this.keys.has('s') || this.keys.has('arrowdown')) - Number(this.keys.has('w') || this.keys.has('arrowup'));
    if (dx || dz) { this.path = []; this.pending = null; }
    else if (this.path.length) { const target = this.point(this.path[0]); const d = target.clone().sub(this.player.position); if (d.length() < 0.12) { this.player.position.copy(target); this.path.shift(); if (!this.path.length && this.pending) this.interact(); } else { dx = d.x; dz = d.z; } }
    const length = Math.hypot(dx, dz); if (!length) return;
    const speed = Math.min(6.4 * dt, length); dx = dx / length * speed; dz = dz / length * speed;
    const free = (x: number, z: number): boolean => [[-0.25, -0.25], [0.25, 0.25], [-0.25, 0.25], [0.25, -0.25]].every(([ox, oz]) => { const [cx, cy] = gridCell(x + ox, z + oz, this.view!.grid[0].length, this.view!.grid.length, EXPLORE_CELL); return isFree(this.blocked, cx, cy); });
    if (free(this.player.position.x + dx, this.player.position.z)) this.player.position.x += dx;
    if (free(this.player.position.x, this.player.position.z + dz)) this.player.position.z += dz;
    this.player.rotation.y = Math.atan2(dx, dz);
    if (!this.bridge.get('game:calm')) this.player.position.y = Math.abs(Math.sin(this.elapsed * 12)) * 0.05;
  }

  private initTactics(): void {
    this.tactics = this.bridge.get<TacticsView>('tactics:view')!;
    if (!this.tactics) throw Error('Missing tactics view');
    this.span = 34;
    const isShip = (u: TacticsUnit): boolean => /thuyen|luong/.test(u.cls + u.sprite);
    const naval = this.tactics.units.some(isShip), allNaval = this.tactics.units.every(isShip);
    this.landscape = createLandscape(this.scene, allNaval ? 'bachdang' : 'tactics', { mood: naval ? 'shore' : undefined, width: 52, depth: 32, prop: this.models.prop });
    for (const side of ['ally', 'enemy'] as const) for (const row of ['front', 'back'] as const) {
      const list = this.tactics.units.filter(u => u.side === side && u.row === row);
      list.forEach((u, i) => {
        const x = (side === 'ally' ? -1 : 1) * (row === 'front' ? 7 : 17);
        const similar = list.filter(n => isShip(n) === isShip(u)), index = similar.indexOf(u);
        const z = naval && !allNaval ? isShip(u) ? 8 + (index - (similar.length - 1) / 2) * 4 : -6 + (index - (similar.length - 1) / 2) * Math.min(5, 14 / Math.max(1, similar.length - 1)) : (i - (list.length - 1) / 2) * Math.min(7, 23 / Math.max(1, list.length - 1));
        this.makePiece(u, new THREE.Vector3(x, 0, z));
      });
    }
    this.syncTactics(this.tactics);
    this.offs.push(this.bridge.on('tactics:view', (v: TacticsView) => { if (!this.playing) this.syncTactics(v); }), this.bridge.on('tactics:targets', (ids: string[]) => { this.targets = new Set(ids); this.tacticRings(); }), this.bridge.on('tactics:play', (p: { events: TacticsEvent[]; view: TacticsView }) => { void this.playTactics(p.events, p.view); }));
  }
  private makePiece(unit: TacticsUnit | BdUnit, at: THREE.Vector3): Piece {
    const object = new THREE.Group(); object.position.copy(at); object.userData.unit = unit.id;
    const river = 'x' in unit, naval = river || ('cls' in unit && /thuyen|luong/.test(unit.cls + unit.sprite)), enemy = unit.side === 'enemy';
    let radius = naval ? 1.4 : 2.2, barY = naval ? 4 : 2.7;
    if (naval) { const boat = this.models.boat(enemy, river ? unit.flagship : unit.cls === 'luong'); boat.rotation.y = enemy ? -Math.PI / 2 : Math.PI / 2; object.add(boat); }
    else {
      const elephant = /voi/.test(unit.sprite + unit.cls), mounted = /ki|cavalry/.test(unit.cls) || /ky|ki/.test(unit.sprite);
      if (mounted) { radius = 3; barY = 3.8; } if (elephant) { radius = 2.6; barY = 4.6; }
      const model = elephant ? this.models.elephant(enemy) : mounted ? this.models.horse(enemy) : this.models.person(unit.sprite, enemy);
      this.addFormation(object, model, formationOffsets(mounted, elephant), enemy ? -Math.PI / 2 : Math.PI / 2);
      const banner = this.models.prop('banner'); banner.scale.setScalar(0.7); banner.position.set(enemy ? 1.8 : -1.8, 0, -1.4); object.add(banner);
    }
    const ring = this.ring(radius, enemy ? '#b4614f' : '#78b5b1'); ring.visible = false; object.add(ring);
    const bar = new THREE.Mesh(this.own(new THREE.PlaneGeometry(river ? 2.6 : 3.6, 0.16)), this.flat(enemy ? '#d77560' : '#80bc9e'));
    const base = new THREE.Mesh(this.own(new THREE.PlaneGeometry(river ? 2.8 : 3.8, 0.28)), this.flat('#263b36'));
    const status = new THREE.Mesh(this.own(new THREE.OctahedronGeometry(0.18)), this.flat('#f3cc78'));
    bar.position.y = base.position.y = barY; bar.position.z = 0.03; status.position.set(0, barY + 0.5, 0); status.visible = false;
    object.add(base, bar, status); this.scene.add(object);
    const piece = { object, ring, bar, status, unit, home: at.clone() }; this.pieces.set(unit.id, piece); return piece;
  }
  private hp(piece: Piece, hp: number): void { piece.bar.scale.x = Math.max(0.01, hp / piece.unit.max_hp); }
  private syncTactics(view: TacticsView): void {
    this.tactics = view;
    for (const unit of view.units) { const p = this.pieces.get(unit.id); if (!p) continue; p.unit = unit; p.object.visible = unit.alive; p.object.position.copy(p.home); p.object.rotation.set(0, 0, 0); this.hp(p, unit.hp); p.status.visible = unit.guard || unit.burn > 0 || unit.fx.length > 0; }
    this.tacticRings();
  }
  private tacticRings(): void {
    for (const [id, p] of this.pieces) {
      p.ring.visible = this.targets.has(id) || id === this.tactics?.actor?.id;
      (p.ring.material as THREE.MeshBasicMaterial).color.set(this.targets.has(id) ? '#eea183' : '#ffe0a0');
    }
  }
  private animate(duration: number, tick: (t: number) => void): Promise<void> {
    if (!this.alive) return Promise.resolve();
    if (this.bridge.get('game:calm')) { tick(1); return Promise.resolve(); }
    return new Promise(resolve => this.tweens.add({ start: performance.now(), duration, tick, resolve }));
  }
  private async slide(piece: Piece, to: THREE.Vector3, duration = 260): Promise<void> { const from = piece.object.position.clone(); await this.animate(duration, t => piece.object.position.lerpVectors(from, to, t * (2 - t))); }
  private async pulse(piece: Piece, damage?: number, hp?: number): Promise<void> {
    if (hp !== undefined) this.hp(piece, hp);
    const ring = this.ring(0.5, damage && damage > 0 ? '#f2c399' : '#9cc6b1'); ring.position.copy(piece.object.position); ring.position.y = 0.15; this.effects.add(ring);
    await this.animate(330, t => { ring.scale.setScalar(1 + t * 6); (ring.material as THREE.MeshBasicMaterial).opacity = 1 - t; (ring.material as THREE.MeshBasicMaterial).transparent = true; }); this.clearGroup(this.effects);
  }
  private async projectile(a: Piece, b: Piece): Promise<void> {
    const arrow = new THREE.Mesh(this.own(new THREE.ConeGeometry(0.08, 0.9, 5)), this.flat('#e0c294')); arrow.rotation.z = -Math.PI / 2;
    this.effects.add(arrow); const from = a.object.position.clone().add(new THREE.Vector3(0, 1.7, 0)), to = b.object.position.clone().add(new THREE.Vector3(0, 1.1, 0));
    await this.animate(270, t => { arrow.position.lerpVectors(from, to, t); arrow.position.y += Math.sin(t * Math.PI) * 2; }); this.clearGroup(this.effects);
  }
  private async playTactics(events: TacticsEvent[], view: TacticsView): Promise<void> {
    if (this.playing) return;
    this.playing = true; this.targets.clear(); this.tacticRings();
    try {
      for (const e of events) {
        if (!this.alive) return; this.bridge.emit('tactics:event', e);
        const a = e.unit ? this.pieces.get(e.unit) : undefined, b = e.target ? this.pieces.get(e.target) : undefined;
        if (e.t === 'attack' && a && b) {
          if ('ranged' in a.unit && a.unit.ranged) await this.projectile(a, b);
          else { const target = a.home.clone().lerp(b.home, 0.55); await this.slide(a, target, 230); }
          await this.pulse(b, e.dmg, e.hp); if (!('ranged' in a.unit && a.unit.ranged)) await this.slide(a, a.home, 230);
        } else if (e.t === 'skill') {
          if (a) await this.pulse(a);
          for (const hit of e.hits ?? []) { const p = this.pieces.get(hit.id); if (p) await this.pulse(p, hit.dmg, hit.hp); }
        } else if (e.t === 'fx' && a) await this.pulse(a, e.dmg, e.hp);
        else if (e.t === 'down' && a) { await this.animate(260, t => { a.object.scale.y = 1 - t * 0.75; }); a.object.visible = false; a.object.scale.y = 1; }
        else if (e.t === 'defend' && a) { a.status.visible = true; await this.pulse(a); }
        else await this.animate(70, () => {});
      }
    } finally { if (this.alive) { this.playing = false; this.syncTactics(view); this.bridge.emit('tactics:played'); } }
  }

  private initRiver(): void {
    this.river = this.bridge.get<BdView>('bd:view')!; if (!this.river) throw Error('Missing river view');
    this.span = 31; this.pitch = 1.02;
    this.landscape = createLandscape(this.scene, 'bachdang', { width: this.river.grid.w * RIVER_CELL, depth: this.river.grid.h * RIVER_CELL, prop: this.models.prop });
    this.mode = this.bridge.get<RiverMode>('bd:mode') ?? { kind: 'none' }; this.syncRiver(this.river);
    this.offs.push(this.bridge.on('bd:view', (v: BdView) => { if (!this.playing) this.syncRiver(v); }), this.bridge.on('bd:mode', (mode: RiverMode) => { this.mode = mode; this.riverHints(); }), this.bridge.on('bd:play', (p: { events: BdEvent[]; view: BdView }) => { void this.playRiver(p.events, p.view); }));
  }
  private clearGroup(group: THREE.Group): void {
    for (const object of [...group.children]) {
      object.traverse(o => { if (!(o instanceof THREE.Mesh)) return; if (this.disposables.delete(o.geometry)) o.geometry.dispose(); for (const m of (Array.isArray(o.material) ? o.material : [o.material])) if (this.disposables.delete(m)) m.dispose(); }); group.remove(object);
    }
  }
  private syncRiver(view: BdView): void {
    this.river = view;
    for (const unit of view.units) {
      const p = this.pieces.get(unit.id) ?? this.makePiece(unit, this.point([unit.x, unit.y], true));
      p.unit = unit; p.object.visible = ['free', 'slow', 'stuck'].includes(unit.state); p.home.copy(this.point([unit.x, unit.y], true)); p.object.position.copy(p.home); p.object.rotation.z = unit.state === 'stuck' ? 0.09 : 0;
      this.hp(p, unit.hp); p.status.visible = unit.state === 'stuck' || unit.burn > 0 || unit.flagship || unit.chasing;
    }
    this.drawRiverTerrain(); this.riverHints();
  }
  private drawRiverTerrain(): void {
    const view = this.river!; this.clearGroup(this.stakes);
    for (const at of view.stakes) {
      const stake = this.models.prop('stakes'); stake.scale.setScalar(0.8); stake.position.copy(this.point(at, true)); stake.position.y = view.tide.level === 2 ? -0.65 : view.tide.level === 1 ? -0.25 : 0; this.stakes.add(stake);
    }
    view.grid.cells.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === 'r') { const rock = this.models.prop('rock'); rock.position.copy(this.point([x, y], true)); this.stakes.add(rock); }
      if (ch === 'b' || (view.grid.revealed && view.tide.level < 2 && 'sm'.includes(ch))) {
        const sand = new THREE.Mesh(this.own(new THREE.CircleGeometry(RIVER_CELL * 0.55, 14)), this.own(new THREE.MeshStandardMaterial({ color: ch === 'b' ? '#697452' : '#a79870', roughness: 1 })));
        sand.rotation.x = -Math.PI / 2; sand.position.copy(this.point([x, y], true)); sand.position.y = 0.015; this.stakes.add(sand);
      }
    }));
  }
  private box(at: XY, color: string, filled = false): void {
    const size = RIVER_CELL * 0.88, shape = filled ? new THREE.PlaneGeometry(size, size) : new THREE.RingGeometry(size * 0.42, size * 0.47, 4, 1, Math.PI / 4);
    const mesh = new THREE.Mesh(this.own(shape), this.flat(color, filled ? 0.16 : 0.85)); mesh.rotation.x = -Math.PI / 2; mesh.position.copy(this.point(at, true)); mesh.position.y = 0.08; this.hints.add(mesh);
  }
  private riverHints(): void {
    if (!this.river) return; this.clearGroup(this.hints); const v = this.river;
    for (const at of v.trail) { const r = this.ring(0.16, '#cfdbca'); r.position.add(this.point(at, true)); this.hints.add(r); }
    if (this.playing || v.status !== 'active' || !v.options) return;
    const mark = (at: XY, color: string): void => { this.box(at, color); if (this.hover?.[0] === at[0] && this.hover[1] === at[1]) this.box(at, color, true); };
    if (this.mode.kind === 'stake' && 'stakeable' in v.options) { for (const at of v.options.stakeable) mark(at, '#a7c9a3'); for (const at of v.options.removable) mark(at, '#e6b68a'); }
    else if (this.mode.kind === 'lure' && 'moves' in v.options) {
      for (const move of v.options.moves) mark(move.to, move.hit ? '#e6a087' : '#ead29b');
      const preview = v.options.moves.find(m => m.to[0] === this.hover?.[0] && m.to[1] === this.hover?.[1]) ?? v.options.wait;
      for (const e of preview.enemies) { const unit = v.units.find(u => u.id === e.id); if (unit && (unit.x !== e.x || unit.y !== e.y)) this.box([e.x, e.y], v.stakes.some(s => s[0] === e.x && s[1] === e.y) ? '#abd2a3' : '#a7c5c7', true); }
    } else if (this.mode.kind === 'ally' && 'allies' in v.options) {
      const id = this.mode.unit; for (const move of v.options.allies.find(a => a.unit === id)?.moves ?? []) mark(move.to, move.attack.length ? '#e7ac78' : '#ead29b');
    }
    if (this.cursor) this.box(this.cursor, '#ffffff');
  }
  private async playRiver(events: BdEvent[], final: BdView): Promise<void> {
    if (this.playing) return; this.playing = true; this.riverHints();
    if (final.grid.revealed && this.river && !this.river.grid.revealed) this.river = { ...this.river, grid: final.grid };
    try {
      for (const e of events) {
        if (!this.alive) return; this.bridge.emit('bd:event', e);
        let a = e.unit ? this.pieces.get(e.unit) : undefined; const b = e.target ? this.pieces.get(e.target) : undefined;
        if (e.t === 'spawn' && e.unit && e.at) { const u = final.units.find(u => u.id === e.unit); if (u && !a) a = this.makePiece(u, this.point(e.at, true)); if (a) { a.object.visible = true; a.object.position.copy(this.point(e.at, true)); } }
        else if (e.t === 'move' && a) { for (const at of e.path ?? []) await this.slide(a, this.point(at, true), 160); }
        else if (['attack', 'fire'].includes(e.t) && a && b) { await this.projectile(a, b); if (e.t !== 'fire' || e.ok) await this.pulse(b, e.dmg, e.hp); }
        else if (['stuck', 'burn', 'arrows', 'slow'].includes(e.t) && (a ?? b)) { await this.pulse((a ?? b)!, e.dmg, e.hp); if (e.t === 'stuck') (a ?? b)!.status.visible = true; }
        else if (['sunk', 'escape'].includes(e.t) && a) { const from = a.object.position.clone(); await this.animate(380, t => { a!.object.position.y = from.y - t * 2; }); a.object.visible = false; }
        else if (e.t === 'stake' && e.at && this.river) { this.river = { ...this.river, stakes: [...this.river.stakes, e.at] }; this.drawRiverTerrain(); }
        else if (e.t === 'unstake' && e.at && this.river) { this.river = { ...this.river, stakes: this.river.stakes.filter(at => at[0] !== e.at![0] || at[1] !== e.at![1]) }; this.drawRiverTerrain(); }
        else if (e.t === 'tide' && e.level !== undefined && this.river) { this.river = { ...this.river, tide: { ...this.river.tide, level: e.level } }; this.drawRiverTerrain(); await this.animate(300, () => {}); }
        else await this.animate(70, () => {});
      }
    } finally { if (this.alive) { this.playing = false; this.syncRiver(final); this.bridge.emit('bd:played'); } }
  }

  private initIntro(mood: string): void {
    this.span = 31; this.pitch = 0.73; this.yaw = -0.14;
    this.landscape = createLandscape(this.scene, 'intro', { mood, width: 48, depth: 28, prop: this.models.prop });
    const army = ['empire', 'border', 'council', 'campaign'].includes(mood);
    if (army) {
      const mounted = mood === 'empire', cols = mounted ? 10 : 13, rows = mounted ? 4 : 5;
      this.addFormation(this.scene, mounted ? this.models.horse(true) : this.models.person('soldier'), Array.from({ length: rows * cols }, (_, i) => [(i % cols - (cols - 1) / 2) * (mounted ? 1.7 : 1.05), Math.floor(i / cols) * (mounted ? 2.5 : 1.45) - 3] as XY), Math.PI);
    }
    else if (['river', 'victory', 'riverside'].includes(mood)) for (let i = 0; i < 5; i++) { const boat = this.models.boat(false, i === 2); boat.position.set((i - 2) * 5, 0, (i % 2) * 4); boat.rotation.y = 0.55; this.scene.add(boat); }
    else for (let i = 0; i < 9; i++) { const person = this.models.person(i === 4 ? 'player' : i % 3 === 0 ? 'soldier' : 'villager'); person.position.set((i % 3 - 1) * 5 + 1, 0, Math.floor(i / 3) * 4 - 2); this.scene.add(person); }
  }
  private addFormation(parent: THREE.Object3D, model: THREE.Group, offsets: XY[], angle: number): void {
    // A whole company uses one GPU draw per material, rather than one per person.
    const matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion().setFromAxisAngle(UP, angle), scale = new THREE.Vector3(1, 1, 1);
    model.traverse(part => {
      if (!(part instanceof THREE.Mesh)) return;
      const batch = new THREE.InstancedMesh(part.geometry, part.material, offsets.length);
      offsets.forEach(([x, z], i) => { matrix.compose(new THREE.Vector3(x, 0, z), rotation, scale); batch.setMatrixAt(i, matrix); });
      batch.castShadow = true; batch.receiveShadow = true; batch.computeBoundingSphere(); parent.add(batch);
    });
  }
  private update = (now: number): void => {
    if (!this.alive) return; this.frame = requestAnimationFrame(this.update);
    if (this.hidden || document.hidden || now - this.last < 32) return;
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0.016; this.last = now; this.elapsed += dt;
    for (const tween of [...this.tweens]) { const t = Math.min(1, (now - tween.start) / tween.duration); tween.tick(t); if (t === 1) { this.tweens.delete(tween); tween.resolve(); } }
    if (this.kind === 'explore') { this.movePlayer(dt); this.scanTime += dt; if (this.scanTime > 0.13) { this.scanTime = 0; this.scan(); } }
    if (this.marker && this.marker.visible && !this.bridge.get('game:calm')) { this.marker.children[0].position.y = 3.1 + Math.sin(this.elapsed * 2) * 0.16; this.marker.children[0].rotation.y = this.elapsed * 0.4; }
    if (!this.bridge.get('game:calm') && this.landscape?.water.length) {
      const material = this.landscape.water[0].material as THREE.MeshStandardMaterial;
      if (material.map) material.map.offset.x = this.elapsed * 0.003;
    }
    for (const p of this.pieces.values()) for (const child of p.object.children) if (child instanceof THREE.Mesh && child.geometry.type === 'PlaneGeometry') child.quaternion.copy(this.camera.quaternion);
    this.renderer.render(this.scene, this.camera);
  };
  destroy(): void {
    if (!this.alive) return; this.alive = false; cancelAnimationFrame(this.frame);
    this.offs.splice(0).forEach(off => off()); this.keys.clear();
    for (const tween of this.tweens) tween.resolve(); this.tweens.clear();
    this.scene.traverse(object => { if (object instanceof THREE.InstancedMesh) object.dispose(); });
    this.landscape?.dispose(); this.models?.dispose(); this.disposables.forEach(resource => resource.dispose()); this.disposables.clear();
    this.scene.clear(); this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove();
  }
}

export function createHistoricalGame(parent: HTMLElement, kind: GameKind, bridge: GameBridge): { destroy: () => void } { return new HistoricalGame(parent, kind, bridge); }
export function createHistoricalPreview(parent: HTMLElement, mood: string, bridge: GameBridge): { destroy: () => void } { return new HistoricalGame(parent, 'intro', bridge, mood); }
