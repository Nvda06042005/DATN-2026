/**
 * Sa bàn 3D (HK.HS.137, HK.GV.084) dựng bằng Three.js trên trình duyệt: địa hình có đồi núi, sông và biển, địa điểm, hai đội quân di chuyển theo từng bước
 * (mũi tên xanh = tiến quân, đỏ = rút quân), xoay – phóng to – kéo bằng chuột hoặc ngón tay (OrbitControls).
 * Dữ liệu cảnh là sơ đồ minh họa do quản trị tổng soạn; máy yếu hoặc không có WebGL thì `onFail` được gọi để trang chuyển về bản vẽ 2D nhẹ.
 * Tệp riêng cho web; bản điện thoại dùng SandCanvas.tsx (không có 3D).
 */
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { positionsAt, type Pt, type SandScene } from '@/types/sandtable';

export interface SandCanvasProps { scene: SandScene; step: number; speed: number; height?: number; onFail?: (reason: string) => void }

const SIDE_COLOR = { tran: 0xe0a526, nguyen: 0x3f6fb5 } as const;
const MODE_COLOR = { advance: 0x16a34a, retreat: 0xdc2626, hold: 0x64748b } as const;

/** Khoảng cách từ điểm tới đoạn thẳng */
function distToSegment(px: number, pz: number, a: Pt, b: Pt): number {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz;
  const t = len2 ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / len2)) : 0;
  return Math.hypot(px - (a[0] + t * dx), pz - (a[1] + t * dz));
}

/** Độ cao địa hình tại (x, z): đồi núi dạng chuông, lòng sông và biển hạ thấp dưới mặt nước */
function heightAt(scene: SandScene, x: number, z: number): { y: number; water: number } {
  let y = 0;
  for (const h of scene.hills) {
    const d2 = (x - h.x) ** 2 + (z - h.y) ** 2;
    const sigma = h.r / 2;
    y += h.h * Math.exp(-d2 / (2 * sigma * sigma));
  }
  let water = 0;
  for (const r of scene.rivers) {
    for (let i = 0; i + 1 < r.points.length; i++) {
      const d = distToSegment(x, z, r.points[i], r.points[i + 1]);
      const half = r.width / 2;
      if (d < half + 1.2) water = Math.max(water, Math.min(1, (half + 1.2 - d) / 1.2));
    }
  }
  for (const s of scene.sea) if (x >= s.x && x <= s.x + s.w && z >= s.y && z <= s.y + s.h) water = 1;
  return { y: y * (1 - water) - water * 0.9, water };
}

/** Nhãn chữ luôn quay về phía người xem */
function label(text: string, color = '#ffffff', bg = 'rgba(15,23,42,0.78)'): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const font = '600 34px Manrope, Arial, sans-serif';
  ctx.font = font;
  const w = Math.min(560, Math.ceil(ctx.measureText(text).width) + 36);
  canvas.width = w;
  canvas.height = 64;
  ctx.font = font;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect?.(0, 4, w, 56, 16);
  if (!ctx.roundRect) ctx.rect(0, 4, w, 56);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 18, 33, w - 30);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.scale.set(w / 26, 64 / 26, 1);
  sprite.renderOrder = 10;
  return sprite;
}

function buildTerrain(scene: SandScene): THREE.Group {
  const [w, d] = scene.size;
  const g = new THREE.Group();
  const seg = 1.25;
  const nx = Math.round(w / seg), nz = Math.round(d / seg);
  const geo = new THREE.PlaneGeometry(w, d, nx, nz);
  geo.rotateX(-Math.PI / 2);
  geo.translate(w / 2, 0, d / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const grass = new THREE.Color(0x6a9f47), hill = new THREE.Color(0x8a7a52), rock = new THREE.Color(0x9a9588), bed = new THREE.Color(0x2f6f8f), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const { y, water } = heightAt(scene, pos.getX(i), pos.getZ(i));
    pos.setY(i, y);
    if (water > 0.2) tmp.copy(bed).lerp(grass, 1 - water);
    else tmp.copy(grass).lerp(hill, Math.min(1, y / 3)).lerp(rock, Math.max(0, Math.min(1, (y - 3.5) / 3)));
    colors.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })));
  // mặt nước nằm trên lòng sông và biển
  const water = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color: 0x3b8fd1, transparent: true, opacity: 0.72, roughness: 0.25, metalness: 0.1 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(w / 2, -0.28, d / 2);
  g.add(water);
  // bệ gỗ của sa bàn
  const base = new THREE.Mesh(new THREE.BoxGeometry(w + 4, 2.2, d + 4), new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.8 }));
  base.position.set(w / 2, -1.9, d / 2);
  g.add(base);
  const rim = new THREE.Mesh(new THREE.BoxGeometry(w + 4.6, 0.5, d + 4.6), new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.7 }));
  rim.position.set(w / 2, -0.55, d / 2);
  g.add(rim);
  return g;
}

function buildMarkers(scene: SandScene): THREE.Group {
  const g = new THREE.Group();
  for (const m of scene.markers) {
    const y = Math.max(0, heightAt(scene, m.x, m.y).y);
    const item = new THREE.Group();
    item.position.set(m.x, y, m.y);
    const wall = new THREE.MeshStandardMaterial({ color: 0xe8dcc0 }), roof = new THREE.MeshStandardMaterial({ color: 0x8c2f2f });
    if (m.kind === 'city') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(5, 1.8, 4), wall);
      body.position.y = 0.9;
      const top = new THREE.Mesh(new THREE.ConeGeometry(3.6, 1.6, 4), roof);
      top.position.y = 2.6;
      top.rotation.y = Math.PI / 4;
      item.add(body, top);
    } else if (m.kind === 'camp') {
      const tent = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2.2, 6), new THREE.MeshStandardMaterial({ color: 0xc7b27a }));
      tent.position.y = 1.1;
      item.add(tent);
    } else if (m.kind === 'fort') {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.6, 3, 8), wall);
      tower.position.y = 1.5;
      const cap = new THREE.Mesh(new THREE.ConeGeometry(1.8, 1.2, 8), roof);
      cap.position.y = 3.6;
      item.add(tower, cap);
    } else if (m.kind === 'dock') {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 1.6), new THREE.MeshStandardMaterial({ color: 0x8b5a2b }));
      plank.position.y = 0.3;
      item.add(plank);
    } else {
      // bãi cọc ngầm: hàng cọc nhọn cắm trên lòng sông
      const mat = new THREE.MeshStandardMaterial({ color: 0x5b3a1e });
      for (let i = -5; i <= 5; i++) {
        const stake = new THREE.Mesh(new THREE.ConeGeometry(0.22, 2.2, 6), mat);
        stake.position.set(0.9 * i, 0.1, (i % 2) * 0.5);
        item.add(stake);
      }
    }
    const tag = label(m.label);
    tag.position.y = m.kind === 'stakes' ? 3.4 : 5.4;
    item.add(tag);
    g.add(item);
  }
  return g;
}

interface ArmyNode { group: THREE.Group; id: string }

function buildArmies(scene: SandScene): ArmyNode[] {
  return scene.armies.map((a) => {
    const group = new THREE.Group();
    const color = SIDE_COLOR[a.side];
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2b2118 });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 5.9, 0.4, 28), new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.55 }));
    disc.position.y = 0.2;
    group.add(disc);
    const count = a.kind === 'fleet' ? 3 : 6;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r = (a.kind === 'fleet' ? 1.5 : 1.6) * 1.9;
      const unit = new THREE.Group();
      unit.scale.setScalar(1.8);
      unit.position.set(Math.cos(angle) * r * (count === 3 ? 1 : 0.85), 0.35, Math.sin(angle) * r * (count === 3 ? 1 : 0.85));
      if (a.kind === 'fleet') {
        const hull = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.9), dark);
        hull.position.y = 0.25;
        const sail = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.6, 3), mat);
        sail.position.y = 1.2;
        unit.add(hull, sail);
      } else if (a.kind === 'cavalry') {
        const horse = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.45), dark);
        horse.position.y = 0.55;
        const rider = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.9, 8), mat);
        rider.position.y = 1.15;
        unit.add(horse, rider);
      } else {
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 1, 8), mat);
        body.position.y = 0.55;
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), new THREE.MeshStandardMaterial({ color: 0xf2c9a0 }));
        head.position.y = 1.25;
        unit.add(body, head);
      }
      group.add(unit);
    }
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 5.2, 6), dark);
    pole.position.y = 2.8;
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1), new THREE.MeshStandardMaterial({ color: a.side === 'tran' ? 0xc8102e : 0x1d4ed8, side: THREE.DoubleSide }));
    banner.position.set(1.2, 4.8, 0);
    banner.scale.setScalar(1.3);
    group.add(pole, banner);
    const tag = label(a.label, '#ffffff', a.side === 'tran' ? 'rgba(160,100,10,0.9)' : 'rgba(30,64,140,0.9)');
    tag.position.y = 7.4;
    group.add(tag);
    return { group, id: a.id };
  });
}

function arrow(from: Pt, to: Pt, color: number, opacity: number, y: (x: number, z: number) => number): THREE.Group | null {
  const dx = to[0] - from[0], dz = to[1] - from[1];
  const len = Math.hypot(dx, dz);
  if (len < 1) return null;
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, len - 2.2, 8), mat);
  shaft.position.set((from[0] + to[0]) / 2, 0, (from[1] + to[1]) / 2);
  shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, 0, dz).normalize());
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.2, 12), mat);
  head.position.set(to[0] - (dx / len) * 1.1, 0, to[1] - (dz / len) * 1.1);
  head.quaternion.copy(shaft.quaternion);
  g.add(shaft, head);
  g.position.y = Math.max(y((from[0] + to[0]) / 2, (from[1] + to[1]) / 2), 0) + 0.9;
  g.renderOrder = 5;
  return g;
}

export const SandCanvas: React.FC<SandCanvasProps> = ({ scene, step, speed, height = 460, onFail }) => {
  const host = useRef<HTMLDivElement | null>(null);
  const api = useRef<{ goto: (step: number, speed: number) => void } | null>(null);
  const latest = useRef({ step, speed });
  latest.current = { step, speed };

  useEffect(() => {
    const el = host.current;
    if (!el) return undefined;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
    } catch (e) {
      onFail?.('Thiết bị này không hỗ trợ WebGL');
      return undefined;
    }
    const [w, d] = scene.size;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0xdfe9f2);
    el.appendChild(renderer.domElement);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.setAttribute('aria-hidden', 'true');

    const three = new THREE.Scene();
    three.add(new THREE.HemisphereLight(0xffffff, 0x7a8a6a, 1.05));
    const sun = new THREE.DirectionalLight(0xfff4d6, 1.3);
    sun.position.set(w * 0.2, 60, d * 1.2);
    three.add(sun);
    three.add(buildTerrain(scene));
    three.add(buildMarkers(scene));
    const armies = buildArmies(scene);
    for (const a of armies) three.add(a.group);
    const trails = new THREE.Group();
    three.add(trails);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 600);
    camera.position.set(w / 2, Math.max(w, d) * 0.72, d * 1.35);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(w / 2, 0, d / 2);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI * 0.47;
    controls.minDistance = 18;
    controls.maxDistance = Math.max(w, d) * 2;
    controls.update();

    const groundY = (x: number, z: number) => heightAt(scene, x, z).y;
    const setPos = (a: ArmyNode, p: Pt) => a.group.position.set(p[0], Math.max(groundY(p[0], p[1]), 0), p[1]);
    // vị trí đang hiển thị của từng đội và hoạt ảnh di chuyển giữa hai bước
    const shown: Record<string, Pt> = {};
    for (const a of scene.armies) { shown[a.id] = a.start; setPos(armies.find((x) => x.id === a.id)!, a.start); }
    let tween: { from: Record<string, Pt>; to: Record<string, Pt>; t0: number; ms: number } | null = null;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    const goto = (stepIndex: number, spd: number) => {
      const target = positionsAt(scene, stepIndex);
      const to: Record<string, Pt> = Object.fromEntries(Object.entries(target).map(([id, v]) => [id, v.pos]));
      tween = { from: { ...shown }, to, t0: performance.now(), ms: reduce ? 1 : 1800 / Math.max(0.25, spd) };
      // mũi tên: các bước đã qua mờ, bước hiện tại đậm
      while (trails.children.length) { const c = trails.children.pop()!; c.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); (m.material as THREE.Material | undefined)?.dispose(); }); }
      let prev = positionsAt(scene, -1);
      for (let i = 0; i <= stepIndex && i < scene.steps.length; i++) {
        const cur = positionsAt(scene, i);
        for (const m of scene.steps[i].moves) {
          const a = arrow(prev[m.army].pos, m.to, MODE_COLOR[m.mode], i === stepIndex ? 0.95 : 0.3, groundY);
          if (a) trails.add(a);
        }
        prev = cur;
      }
    };
    api.current = { goto };
    goto(latest.current.step, latest.current.speed);

    const resize = () => {
      const r = el.getBoundingClientRect();
      const width = Math.max(200, r.width), h = Math.max(200, r.height);
      renderer.setSize(width, h, false);
      camera.aspect = width / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(el);

    renderer.setAnimationLoop(() => {
      if (tween) {
        const k = Math.min(1, (performance.now() - tween.t0) / tween.ms);
        const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
        for (const a of armies) {
          const f = tween.from[a.id] ?? scene.armies.find((x) => x.id === a.id)!.start, t = tween.to[a.id] ?? f;
          shown[a.id] = [f[0] + (t[0] - f[0]) * e, f[1] + (t[1] - f[1]) * e];
          setPos(a, shown[a.id]);
          a.group.children.forEach((c, i) => { if (i > 0 && i <= 6) c.position.y = 0.35 + (k < 1 && (f[0] !== t[0] || f[1] !== t[1]) ? Math.abs(Math.sin(k * 24 + i)) * 0.18 : 0); });
        }
        if (k >= 1) tween = null;
      }
      controls.update();
      renderer.render(three, camera);
    });

    return () => {
      renderer.setAnimationLoop(null);
      ro?.disconnect();
      controls.dispose();
      three.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        for (const x of Array.isArray(mat) ? mat : mat ? [mat] : []) { (x as THREE.MeshBasicMaterial).map?.dispose(); x.dispose(); }
      });
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      api.current = null;
    };
  }, [scene]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { api.current?.goto(step, speed); }, [step, speed]);

  return React.createElement('div', {
    ref: host, role: 'img', 'aria-label': 'Sa bàn 3D của trận đánh; xem lời dẫn từng bước ở bên dưới',
    style: { width: '100%', height, borderRadius: 16, overflow: 'hidden', touchAction: 'none', background: '#dfe9f2', border: '2px solid #cbd5e1' },
  });
};
