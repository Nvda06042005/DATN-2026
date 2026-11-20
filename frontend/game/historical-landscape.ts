/** Original landscape reconstruction for the learning game; this is not a geographical map. */
import * as THREE from 'three';

export interface LandscapeOptions {
  grid?: string[];
  mood?: string;
  width: number;
  depth: number;
  prop: (kind: string) => THREE.Group;
}

const CELL = 2.4;
const PROP: Record<string, string> = { T: 'tree', B: 'bamboo', H: 'house', h: 'tent', '#': 'fence', R: 'rock', b: 'boat', D: 'drum', f: 'banner', c: 'sacks', W: 'well', P: 'pillar', w: 'hall', L: 'logs', S: 'stakes', F: 'fire' };
const ROAD = ',=_:+';
const WATER = '~b';

function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}

export function createLandscape(scene: THREE.Scene, mode: 'explore' | 'tactics' | 'bachdang' | 'intro', options: LandscapeOptions): { water: THREE.Mesh[]; dispose: () => void } {
  const root = new THREE.Group();
  root.name = 'historical-landscape';
  scene.add(root);
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const water: THREE.Mesh[] = [];
  const rng = random(mode === 'explore' ? 1258 : mode === 'tactics' ? 1285 : 1288);
  const { width, depth, grid, prop } = options;
  const river = mode === 'bachdang' || (mode === 'intro' && ['river', 'victory'].includes(options.mood ?? ''));
  const shore = mode === 'tactics' && options.mood === 'shore';
  const sx = width + 66, sz = depth + 58;

  const ownMaterial = <T extends THREE.Material>(mat: T): T => { materials.add(mat); return mat; };
  const ownGeometry = <T extends THREE.BufferGeometry>(geo: T): T => { geometries.add(geo); return geo; };
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh => {
    const object = new THREE.Mesh(ownGeometry(geo), mat);
    object.position.set(x, y, z);
    object.receiveShadow = true;
    root.add(object);
    return object;
  };
  const put = (kind: string, x: number, z: number, scale = 1, angle = 0): THREE.Group => {
    const object = prop(kind);
    object.position.set(x, 0, z);
    object.rotation.y = angle;
    object.scale.multiplyScalar(scale);
    root.add(object);
    return object;
  };

  // A single large material blends soil, worn paths, grass and mud. The server's
  // movement grid remains hidden; individual squares are never drawn.
  const canvas = document.createElement('canvas');
  canvas.width = 1536;
  canvas.height = 1152;
  const ctx = canvas.getContext('2d')!;
  const px = (x: number): number => (x / sx + 0.5) * canvas.width;
  const pz = (z: number): number => (z / sz + 0.5) * canvas.height;
  ctx.fillStyle = river ? '#6c6d4b' : mode === 'tactics' ? '#777a50' : '#74805a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 1800; i++) {
    const x = rng() * canvas.width, y = rng() * canvas.height, radius = 6 + rng() * 44;
    const tone = i % 3 === 0 ? '127,111,80' : i % 3 === 1 ? '53,77,41' : '181,167,123';
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(${tone},0.16)`);
    gradient.addColorStop(1, `rgba(${tone},0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  const brush = (x: number, z: number, radius: number, color: string): void => {
    const r = radius / sx * canvas.width;
    const gradient = ctx.createRadialGradient(px(x), pz(z), r * 0.25, px(x), pz(z), r);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.65, color);
    gradient.addColorStop(1, 'rgba(156,137,101,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(px(x) - r, pz(z) - r, r * 2, r * 2);
  };
  const at = (x: number, z: number): string => {
    const row = Math.floor((z + depth / 2) / CELL), col = Math.floor((x + width / 2) / CELL);
    return grid?.[row]?.[col] ?? '.';
  };
  if (grid) {
    for (let row = 0; row < grid.length; row++) for (let col = 0; col < grid[row].length; col++) {
      const char = grid[row][col];
      const x = (col + 0.5) * CELL - width / 2, z = (row + 0.5) * CELL - depth / 2;
      if (ROAD.includes(char) || ['H', 'h', 'W', 'D', 'c', 'F'].includes(char)) brush(x, z, CELL * 0.85, char === '_' ? '#a39d8c' : '#a39470');
      if (WATER.includes(char)) brush(x, z, CELL * 0.92, '#6f806e');
      if (char === '%') {
        brush(x, z, CELL * 0.7, '#526744');
        ctx.strokeStyle = '#8c9560';
        ctx.lineWidth = 1;
        for (let j = -3; j <= 3; j++) {
          ctx.beginPath(); ctx.moveTo(px(x - CELL * 0.45), pz(z + j * 0.22)); ctx.lineTo(px(x + CELL * 0.45), pz(z + j * 0.22)); ctx.stroke();
        }
      }
    }
  } else if (!river) {
    for (let i = 0; i < 80; i++) brush((rng() - 0.5) * width * 0.9, (rng() - 0.5) * depth * 0.85, 2 + rng() * 4, '#9a8967');
    // Cart tracks lead into the camp rather than a decorative central rectangle.
    for (let z = -depth / 2; z < depth / 2 + 5; z += 0.6) {
      const bend = Math.sin(z * 0.13) * 1.1;
      brush(bend - 0.45, z, 1.5, '#ac9b77'); brush(bend + 0.45, z, 1.4, '#ac9b77');
    }
  }
  for (let i = 0; i < 53000; i++) {
    const x = rng() * canvas.width, y = rng() * canvas.height;
    ctx.fillStyle = i % 4 === 0 ? 'rgba(219,205,164,.17)' : i % 3 === 0 ? 'rgba(42,54,32,.16)' : 'rgba(142,131,98,.22)';
    ctx.fillRect(x, y, 0.5 + rng() * 1.6, 0.5 + rng() * 1.3);
  }
  const groundTexture = new THREE.CanvasTexture(canvas);
  groundTexture.colorSpace = THREE.SRGBColorSpace;
  groundTexture.anisotropy = 4;
  textures.add(groundTexture);
  const ground = ownMaterial(new THREE.MeshStandardMaterial({ map: groundTexture, roughness: 0.97, color: '#ebe4d4' }));
  const floor = mesh(new THREE.PlaneGeometry(sx, sz), ground, 0, river ? -0.24 : -0.025);
  floor.rotation.x = -Math.PI / 2;

  const waterCanvas = document.createElement('canvas');
  waterCanvas.width = 256; waterCanvas.height = 256;
  const wc = waterCanvas.getContext('2d')!;
  wc.fillStyle = '#657f79'; wc.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 390; i++) {
    wc.strokeStyle = i % 3 === 0 ? 'rgba(224,231,206,.18)' : 'rgba(29,62,61,.12)';
    wc.lineWidth = 0.6 + rng();
    const x = rng() * 256, y = rng() * 256;
    wc.beginPath(); wc.moveTo(x, y); wc.bezierCurveTo(x + 5, y - 2, x + 10, y + 2, x + 14 + rng() * 12, y); wc.stroke();
  }
  const waterTexture = new THREE.CanvasTexture(waterCanvas);
  waterTexture.colorSpace = THREE.SRGBColorSpace;
  waterTexture.wrapS = waterTexture.wrapT = THREE.RepeatWrapping;
  waterTexture.repeat.set(8, 5);
  textures.add(waterTexture);
  const waterMat = ownMaterial(new THREE.MeshStandardMaterial({ map: waterTexture, color: '#8ca9a3', roughness: 0.36, metalness: 0.24, transparent: true, opacity: 0.94 }));
  const addWater = (w: number, d: number, x: number, z: number): void => {
    const plane = mesh(new THREE.PlaneGeometry(w, d), waterMat, x, river ? -0.1 : 0.01, z);
    plane.rotation.x = -Math.PI / 2; water.push(plane);
  };
  if (river) addWater(sx, depth + 4.2, 0, 0);
  else if (shore) {
    // Mixed battles keep infantry on the bank and ships in one continuous river.
    const shape = new THREE.Shape();
    shape.moveTo(-sx / 2, -sz / 2);
    shape.lineTo(sx / 2, -sz / 2);
    for (let x = sx / 2; x >= -sx / 2; x -= 1) shape.lineTo(x, -(3.7 + Math.sin(x * 0.25) * 0.35));
    shape.closePath();
    const surface = mesh(new THREE.ShapeGeometry(shape), waterMat, 0, 0.012, 0);
    surface.rotation.x = -Math.PI / 2; water.push(surface);
  }
  else if (grid) {
    // Merged contiguous strips share one material, so there are no tile borders.
    grid.forEach((row, y) => {
      let start = -1;
      for (let x = 0; x <= row.length; x++) {
        if (x < row.length && WATER.includes(row[x])) { if (start < 0) start = x; }
        else if (start >= 0) {
          addWater((x - start) * CELL + 0.025, CELL + 0.025, (start + (x - start) / 2) * CELL - width / 2, (y + 0.5) * CELL - depth / 2);
          start = -1;
        }
      }
    });
  }

  if (grid) grid.forEach((row, y) => [...row].forEach((char, x) => {
    // A w tile denotes the occupied palace region, not an entire building.
    // Repeating a whole roof on every occupied cell buries the courtyard.
    if (char === 'w') return;
    const kind = PROP[char];
    if (!kind) return;
    const object = put(kind, (x + 0.5) * CELL - width / 2, (y + 0.5) * CELL - depth / 2, kind === 'house' ? 0.68 : kind === 'hall' ? 0.65 : 1, kind === 'tree' || kind === 'rock' ? rng() * Math.PI * 2 : 0);
    if (char === '#') {
      const horizontal = grid[y]?.[x - 1] === '#' || grid[y]?.[x + 1] === '#';
      const vertical = grid[y - 1]?.[x] === '#' || grid[y + 1]?.[x] === '#';
      if (vertical && !horizontal) object.rotation.y = Math.PI / 2;
    }
    if (char === 'b') { object.scale.multiplyScalar(0.55); object.rotation.y = Math.PI / 2; }
  }));

  if (grid?.some(row => row.includes('w'))) {
    const palaceStone = ownMaterial(new THREE.MeshStandardMaterial({ color: '#7e7b69', roughness: 0.98 }));
    const visited = new Set<string>();
    for (let y = 0; y < grid.length; y++) for (let x = 0; x < grid[y].length; x++) {
      if (grid[y][x] !== 'w' || visited.has(`${x},${y}`)) continue;
      const cells: Array<[number, number]> = [[x, y]];
      visited.add(`${x},${y}`);
      for (let i = 0; i < cells.length; i++) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const [cx, cy] = cells[i], nx = cx + dx, ny = cy + dy, key = `${nx},${ny}`;
        if (grid[ny]?.[nx] === 'w' && !visited.has(key)) { visited.add(key); cells.push([nx, ny]); }
      }
      const topRow = Math.min(...cells.map(c => c[1]));
      const topCells = cells.filter(c => c[1] === topRow).map(c => c[0]);
      const minX = Math.min(...topCells), maxX = Math.max(...topCells);
      const hall = put('hall', ((minX + maxX) / 2 + 0.5) * CELL - width / 2, (topRow + 0.5) * CELL - depth / 2);
      // Fit the full roof inside occupied tiles, including its eaves. The open
      // underscore cells in the row below remain unobscured and navigable.
      hall.scale.set(Math.min(1.9, (maxX - minX + 1) * CELL / 7.7), 0.95, CELL * 0.85 / 5.4);
      hall.position.y = 0.3;
      const rows = [...new Set(cells.map(c => c[1]))];
      for (const row of rows) {
        const cols = cells.filter(c => c[1] === row).map(c => c[0]).sort((a, b) => a - b);
        let from = cols[0], last = from;
        const wall = (a: number, b: number): void => {
          const stone = mesh(new THREE.BoxGeometry((b - a + 1) * CELL - 0.08, 0.6, CELL * 0.88), palaceStone, ((a + b) / 2 + 0.5) * CELL - width / 2, 0.28, (row + 0.5) * CELL - depth / 2);
          stone.castShadow = true;
        };
        for (let i = 1; i <= cols.length; i++) {
          if (cols[i] === last + 1) last = cols[i];
          else { wall(from, last); from = last = cols[i]; }
        }
      }
    }
  }

  // Groundcover is a single mesh of crossed blades; it stays below the feet and
  // never creates hidden obstacles on the authoritative movement grid.
  const grassPositions: number[] = [], grassColors: number[] = [];
  const grassColor = new THREE.Color();
  for (let i = 0; i < 2300; i++) {
    const x = (rng() - 0.5) * (width + 18), z = (rng() - 0.5) * (depth + 14);
    if ((river && Math.abs(z) < depth / 2 + 2.5) || (shore && z > 3.2) || (grid && (ROAD + '~b_HhPw').includes(at(x, z)))) continue;
    const size = 0.045 + rng() * 0.08, h = 0.12 + rng() * 0.24;
    grassColor.setHSL(0.19 + rng() * 0.09, 0.2 + rng() * 0.18, 0.22 + rng() * 0.16);
    for (const [dx, dz] of [[size, 0], [0, size]]) {
      grassPositions.push(x - dx, 0, z - dz, x + dx, 0, z + dz, x + size * 0.5, h, z + size * 0.3);
      for (let v = 0; v < 3; v++) grassColors.push(grassColor.r, grassColor.g, grassColor.b);
    }
  }
  const grassGeo = new THREE.BufferGeometry();
  grassGeo.setAttribute('position', new THREE.Float32BufferAttribute(grassPositions, 3));
  grassGeo.setAttribute('color', new THREE.Float32BufferAttribute(grassColors, 3));
  grassGeo.computeVertexNormals();
  mesh(grassGeo, ownMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide })));

  // Layered distant ridges: muted colours and fog establish scale without
  // replacing the three historical campaign maps used elsewhere in the app.
  const ridgeMat = ownMaterial(new THREE.MeshStandardMaterial({ color: '#637465', roughness: 1, flatShading: false }));
  const ridgeFar = ownMaterial(new THREE.MeshStandardMaterial({ color: '#82918a', roughness: 1 }));
  const hillGeo = ownGeometry(new THREE.SphereGeometry(1, 12, 8));
  for (let i = 0; i < 16; i++) {
    const angle = i / 16 * Math.PI * 2;
    const radius = Math.max(width, depth) * 0.7 + 18 + rng() * 12;
    const x = Math.sin(angle) * radius, z = Math.cos(angle) * radius;
    const hill = new THREE.Mesh(hillGeo, i % 2 ? ridgeMat : ridgeFar);
    hill.position.set(x, -3.4, z);
    hill.scale.set(7 + rng() * 9, 5 + rng() * 9, 7 + rng() * 7);
    root.add(hill);
  }
  const treeCount = mode === 'intro' ? 38 : 30;
  for (let i = 0; i < treeCount; i++) {
    let x: number, z: number;
    if (river) {
      x = (rng() - 0.5) * (width + 27);
      z = (i % 2 ? 1 : -1) * (depth / 2 + 3.8 + rng() * 10);
    } else {
      const angle = i / treeCount * Math.PI * 2;
      x = Math.sin(angle) * (width / 2 + 4 + rng() * 7);
      z = Math.cos(angle) * (depth / 2 + 4 + rng() * 7);
    }
    put(i % 5 === 0 ? 'bamboo' : 'tree', x, z, 0.85 + rng() * 0.7, rng() * Math.PI * 2);
    if (i % 4 === 0) put('rock', x - 1, z + 1, 0.6 + rng() * 0.6, rng() * 4);
  }

  if (mode === 'tactics' || mode === 'intro') {
    const mood = options.mood ?? 'border';
    if (!river && mood !== 'empire') {
      const campZ = -depth / 2 - 1.4;
      put('hall', 0, campZ - 1.5, mode === 'intro' && mood === 'council' ? 1.25 : 0.95);
      for (const x of [-width * 0.32, -width * 0.22, width * 0.22, width * 0.32]) {
        put(mode === 'intro' && mood === 'village' ? 'house' : 'tent', x, campZ + (Math.abs(x) > width * 0.25 ? 2 : -1), 0.9);
      }
      for (let x = -width / 2 - 1; x <= width / 2 + 1; x += 2.1) {
        if (Math.abs(x) > 3.4) put('fence', x, campZ, 1);
      }
      put('banner', -3.9, campZ + 1, 1.35); put('banner', 3.9, campZ + 1, 1.35);
      put('drum', -width * 0.22, -depth * 0.3, 1.15);
      put('sacks', width * 0.25, -depth * 0.3, 1.1);
      put('logs', width * 0.34, -depth * 0.28, 1.1);
    }
    if (mode === 'intro' && mood === 'village') {
      put('house', -width * 0.29, depth * 0.22, 1.1, 0.3);
      put('house', width * 0.3, depth * 0.2, 0.95, -0.3);
      put('well', -width * 0.18, depth * 0.1, 1.2);
      put('sacks', width * 0.18, depth * 0.25, 1);
    }
  }
  if (river) {
    // A timber landing, supplies and reeds read as a working riverbank rather
    // than a rectangular swimming pool. All are outside the playable cells.
    const plank = ownMaterial(new THREE.MeshStandardMaterial({ color: '#78654b', roughness: 0.96 }));
    const dockZ = depth / 2 + 1.2;
    for (let i = 0; i < 14; i++) {
      const deck = mesh(new THREE.BoxGeometry(3.7, 0.12, 0.23), plank, -width * 0.3, 0.08, dockZ - i * 0.26);
      deck.castShadow = true;
    }
    for (const x of [-width * 0.3 - 1.55, -width * 0.3 + 1.55]) for (const z of [dockZ, dockZ - 3.3]) {
      const post = mesh(new THREE.CylinderGeometry(0.1, 0.14, 1.25, 7), plank, x, 0.04, z); post.castShadow = true;
    }
    put('house', -width * 0.3 - 3, depth / 2 + 5.8, 0.9);
    put('sacks', -width * 0.3 + 3.4, depth / 2 + 3, 1);
    if (mode === 'intro') { put('boat', -width * 0.2, -depth * 0.16, 1.3, 0.4); put('boat', width * 0.2, depth * 0.1, 1.5, -0.15); }
  }

  return {
    water,
    dispose: () => {
      scene.remove(root);
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
    },
  };
}
