/**
 * Original, compact historical scenery. The shapes suggest a thirteenth-century setting;
 * they are an artistic reconstruction, not a reconstruction of a documented building or uniform.
 * All models stand on y=0 and face +Z. Templates share geometry and materials across clones.
 */
import * as THREE from 'three';

export interface HistoricalModels {
  person(style: string, enemy?: boolean): THREE.Group;
  horse(enemy?: boolean): THREE.Group;
  elephant(enemy?: boolean): THREE.Group;
  boat(enemy?: boolean, large?: boolean): THREE.Group;
  prop(kind: string): THREE.Group;
  dispose(): void;
}

export function createHistoricalModels(): HistoricalModels {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const templates = new Map<string, THREE.Group>();
  const own = <T extends THREE.BufferGeometry>(geometry: T): T => { geometries.add(geometry); return geometry; };
  const box = own(new THREE.BoxGeometry(1, 1, 1));
  const sphere = own(new THREE.SphereGeometry(1, 10, 8));
  const cylinder = own(new THREE.CylinderGeometry(1, 1, 1, 10));
  const cone = own(new THREE.ConeGeometry(1, 1, 10));
  const circle = own(new THREE.CylinderGeometry(1, 1, 1, 20));
  const leaf = own(new THREE.SphereGeometry(1, 6, 3));
  const mat = (color: string, metalness = 0, emissive?: string): THREE.MeshStandardMaterial => {
    const key = `${color}/${metalness}/${emissive ?? ''}`;
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: metalness ? 0.65 : 0.93, metalness, side: THREE.DoubleSide, ...(emissive ? { emissive, emissiveIntensity: 0.55 } : {}) }));
    return materials.get(key)!;
  };
  const timber = mat('#67503a'), endgrain = mat('#94704b'), darkwood = mat('#352c24');
  const stone = mat('#8b8d7e'), mortar = mat('#c3bc9e'), roof = mat('#55413a');
  const iron = mat('#555a58', 0.5), bronze = mat('#a18b55', 0.5), skin = mat('#b18a68');
  const black = mat('#24231f'), linen = mat('#c8bba0'), red = mat('#85392f'), enemyCloth = mat('#4c5660');

  function mesh(g: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number): THREE.Mesh {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; m.receiveShadow = true;
    g.add(m); return m;
  }
  const block = (g: THREE.Group, m: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number): THREE.Mesh => mesh(g, box, m, x, y, z, w, h, d);
  const ellipsoid = (g: THREE.Group, m: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number): THREE.Mesh => mesh(g, sphere, m, x, y, z, w, h, d);
  function rod(g: THREE.Group, m: THREE.Material, a: THREE.Vector3, b: THREE.Vector3, radius: number): THREE.Mesh {
    const diff = b.clone().sub(a), mid = a.clone().add(b).multiplyScalar(0.5);
    const r = mesh(g, cylinder, m, mid.x, mid.y, mid.z, radius, diff.length(), radius);
    r.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), diff.normalize());
    return r;
  }
  const beam = (g: THREE.Group, m: THREE.Material, a: number[], b: number[], radius: number): THREE.Mesh => rod(g, m, new THREE.Vector3(a[0], a[1], a[2]), new THREE.Vector3(b[0], b[1], b[2]), radius);

  /** Bake a template into one mesh per material so a company of soldiers stays inexpensive. */
  function bake(source: THREE.Group): THREE.Group {
    source.updateMatrixWorld(true);
    const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
    source.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const material = obj.material as THREE.Material;
      if (!buckets.has(material)) buckets.set(material, []);
      const copy = obj.geometry.clone().applyMatrix4(obj.matrixWorld);
      buckets.get(material)!.push(copy.index ? copy.toNonIndexed() : copy);
      if (copy.index) copy.dispose();
    });
    const result = new THREE.Group();
    for (const [material, list] of buckets) {
      const length = list.reduce((sum, g) => sum + g.getAttribute('position').count * 3, 0);
      const positions = new Float32Array(length), normals = new Float32Array(length);
      let offset = 0;
      for (const g of list) {
        const pos = g.getAttribute('position'), nor = g.getAttribute('normal');
        for (let i = 0; i < pos.count; i++) {
          positions.set([pos.getX(i), pos.getY(i), pos.getZ(i)], offset);
          normals.set([nor.getX(i), nor.getY(i), nor.getZ(i)], offset); offset += 3;
        }
        g.dispose();
      }
      const geometry = own(new THREE.BufferGeometry());
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      geometry.computeBoundingSphere();
      const part = new THREE.Mesh(geometry, material); part.castShadow = true; part.receiveShadow = true; result.add(part);
    }
    return result;
  }
  function cached(key: string, build: () => THREE.Group): THREE.Group {
    if (!templates.has(key)) templates.set(key, bake(build()));
    return templates.get(key)!.clone();
  }

  function buildPerson(style: string, enemy: boolean): THREE.Group {
    const g = new THREE.Group();
    const civilian = ['villager', 'woman', 'elder', 'boy', 'youth', 'scholar'].includes(style);
    const general = /general|commander|tuong/.test(style);
    const royal = /king|vua/.test(style);
    const archer = /cung|nỏ|no/.test(style) || style === 'scout';
    const cloth = royal ? mat('#a9955d') : civilian ? mat(style === 'woman' ? '#655156' : style === 'scholar' ? '#465967' : '#75654c') : enemy ? enemyCloth : red;
    // Human proportions: small head, shoulders, tapered clothing, separate hands and boots.
    for (const x of [-0.11, 0.11]) {
      ellipsoid(g, darkwood, x, 0.075, 0.055, 0.085, 0.075, 0.15);
      mesh(g, cylinder, civilian ? cloth : black, x, 0.36, 0, 0.072, 0.50, 0.075);
    }
    mesh(g, cone, cloth, 0, 0.78, 0, 0.24, 0.50, 0.18);
    ellipsoid(g, cloth, 0, 1.105, 0, 0.235, 0.33, 0.13);
    block(g, darkwood, 0, 0.88, 0, 0.40, 0.07, 0.27);
    block(g, bronze, 0, 0.88, 0.145, 0.055, 0.055, 0.025);
    for (const side of [-1, 1]) {
      beam(g, cloth, [side * 0.20, 1.30, 0], [side * 0.29, 1.02, 0.025], 0.081);
      beam(g, cloth, [side * 0.29, 1.02, 0.025], [side * 0.31, 0.89, 0.10], 0.065);
      ellipsoid(g, skin, side * 0.31, 0.86, 0.105, 0.057, 0.065, 0.052);
    }
    mesh(g, cylinder, skin, 0, 1.43, 0, 0.065, 0.11, 0.062);
    ellipsoid(g, skin, 0, 1.59, 0.015, 0.125, 0.16, 0.115);
    ellipsoid(g, skin, 0, 1.57, 0.116, 0.027, 0.035, 0.027);
    for (const x of [-0.046, 0.046]) ellipsoid(g, black, x, 1.62, 0.113, 0.011, 0.010, 0.009);
    if (style === 'elder' || general) {
      const beard = style === 'elder' ? mat('#bcb4a4') : black;
      mesh(g, cone, beard, 0, 1.425, 0.085, 0.065, 0.16, 0.045).rotation.x = Math.PI;
    }
    if (civilian) {
      ellipsoid(g, black, 0, 1.70, -0.015, 0.127, 0.08, 0.11);
      if (style === 'scholar') block(g, black, 0, 1.73, 0, 0.26, 0.10, 0.23);
      else if (style !== 'boy' && style !== 'youth') {
        mesh(g, cone, linen, 0, 1.79, 0, 0.29, 0.17, 0.29);
        beam(g, linen, [-0.15, 1.73, 0], [0, 1.45, 0.03], 0.008);
        beam(g, linen, [0.15, 1.73, 0], [0, 1.45, 0.03], 0.008);
      }
    } else {
      const armor = royal ? bronze : iron;
      ellipsoid(g, armor, 0, 1.13, 0.017, 0.205, 0.255, 0.14);
      // Lamellar rows and shoulder plates add scale without a cartoon silhouette.
      for (let row = 0; row < 4; row++) for (let col = -2; col <= 2; col++) {
        block(g, row % 2 ? armor : bronze, col * 0.067, 0.985 + row * 0.072, 0.148 - Math.abs(col) * 0.014, 0.053, 0.053, 0.025);
      }
      for (const side of [-1, 1]) ellipsoid(g, armor, side * 0.225, 1.31, 0, 0.115, 0.075, 0.135);
      ellipsoid(g, armor, 0, 1.72, 0, 0.146, 0.105, 0.138);
      mesh(g, cylinder, armor, 0, 1.69, 0, 0.16, 0.035, 0.153);
      for (const side of [-1, 1]) block(g, armor, side * 0.125, 1.58, -0.02, 0.035, 0.17, 0.12);
      if (general || royal) {
        mesh(g, cone, red, 0, 1.865, -0.005, 0.065, 0.22, 0.065);
        block(g, bronze, 0, 1.73, 0.136, 0.06, 0.11, 0.025);
        const cape = block(g, enemy ? enemyCloth : red, 0, 0.99, -0.17, 0.43, 0.80, 0.045); cape.rotation.x = -0.12;
      }
      if (!royal && archer) {
        const points: THREE.Vector3[] = [];
        for (let i = 0; i <= 12; i++) { const t = -Math.PI / 2 + i * Math.PI / 12; points.push(new THREE.Vector3(0.34 + Math.cos(t) * 0.13, 1.02 + Math.sin(t) * 0.38, 0.15)); }
        const bow = own(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 12, 0.018, 5, false));
        mesh(g, bow, endgrain, 0, 0, 0, 1, 1, 1);
        beam(g, linen, [0.34, 0.64, 0.15], [0.34, 1.40, 0.15], 0.004);
        block(g, darkwood, -0.10, 1.17, -0.20, 0.13, 0.48, 0.13);
      } else if (!royal) {
        beam(g, timber, [0.33, 0.04, 0.15], [0.33, 2.24, 0.15], 0.018);
        mesh(g, cone, iron, 0.33, 2.32, 0.15, 0.045, 0.23, 0.026);
        const shield = mesh(g, circle, timber, -0.32, 1.03, 0.19, 0.19, 0.045, 0.25); shield.rotation.x = Math.PI / 2;
        const boss = ellipsoid(g, iron, -0.32, 1.03, 0.22, 0.07, 0.07, 0.04); boss.rotation.z = 0.1;
      }
    }
    if (style === 'player' || style === 'youth' || style === 'boy') g.scale.setScalar(0.89);
    return g;
  }

  function buildHorse(enemy: boolean): THREE.Group {
    const g = new THREE.Group(), coat = mat(enemy ? '#514333' : '#73523a');
    ellipsoid(g, coat, 0, 0.98, 0, 0.31, 0.37, 0.66);
    ellipsoid(g, coat, 0, 1.28, 0.46, 0.21, 0.45, 0.27).rotation.x = -0.43;
    ellipsoid(g, coat, 0, 1.58, 0.66, 0.16, 0.20, 0.32).rotation.x = -0.35;
    ellipsoid(g, coat, 0, 1.49, 0.88, 0.13, 0.10, 0.14);
    for (const side of [-1, 1]) {
      mesh(g, cone, coat, side * 0.09, 1.83, 0.59, 0.055, 0.23, 0.06).rotation.x = -0.12;
      ellipsoid(g, black, side * 0.147, 1.62, 0.72, 0.017, 0.018, 0.025);
      for (const z of [-0.41, 0.41]) {
        beam(g, coat, [side * 0.22, 0.91, z], [side * 0.23, 0.43, z - 0.05], 0.07);
        beam(g, coat, [side * 0.23, 0.43, z - 0.05], [side * 0.24, 0.10, z + 0.03], 0.044);
        ellipsoid(g, black, side * 0.24, 0.065, z + 0.06, 0.075, 0.065, 0.11);
      }
    }
    beam(g, black, [0, 1.18, -0.60], [0, 0.58, -0.86], 0.07);
    block(g, enemy ? enemyCloth : red, 0, 1.21, 0, 0.68, 0.06, 0.66);
    block(g, darkwood, 0, 1.28, 0.02, 0.45, 0.13, 0.48);
    for (const side of [-1, 1]) beam(g, linen, [side * 0.17, 1.53, 0.82], [side * 0.15, 1.56, 0.02], 0.011);
    const rider = buildPerson('soldier', enemy); rider.scale.setScalar(0.82); rider.position.y = 0.98; g.add(rider);
    return g;
  }

  function buildElephant(enemy: boolean): THREE.Group {
    const g = new THREE.Group(), hide = mat('#777971'), ivory = mat('#d0c8ab');
    ellipsoid(g, hide, 0, 1.61, -0.08, 0.80, 0.85, 1.25);
    ellipsoid(g, hide, 0, 2.02, 1.00, 0.58, 0.63, 0.57);
    for (const side of [-1, 1]) {
      const ear = ellipsoid(g, mat('#828279'), side * 0.61, 2.04, 0.91, 0.14, 0.56, 0.46); ear.rotation.z = side * -0.18;
      ellipsoid(g, black, side * 0.47, 2.15, 1.29, 0.033, 0.028, 0.024);
      for (const z of [-0.83, 0.71]) {
        mesh(g, cylinder, hide, side * 0.54, 0.71, z, 0.22, 1.24, 0.23);
        ellipsoid(g, hide, side * 0.54, 0.13, z + 0.04, 0.24, 0.15, 0.26);
        for (let i = -1; i <= 1; i++) ellipsoid(g, ivory, side * 0.54 + i * 0.095, 0.10, z + 0.245, 0.038, 0.06, 0.02);
      }
      const tuskCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.29, 1.79, 1.37), new THREE.Vector3(side * 0.38, 1.56, 1.75), new THREE.Vector3(side * 0.44, 1.69, 2.15),
      ]);
      mesh(g, own(new THREE.TubeGeometry(tuskCurve, 10, 0.045, 7, false)), ivory, 0, 0, 0, 1, 1, 1);
      mesh(g, cone, ivory, side * 0.44, 1.74, 2.19, 0.045, 0.19, 0.045).rotation.x = Math.PI / 3;
    }
    const trunkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 1.95, 1.42), new THREE.Vector3(0, 1.31, 1.72), new THREE.Vector3(0, 0.59, 1.81), new THREE.Vector3(0, 0.38, 1.98),
    ]);
    mesh(g, own(new THREE.TubeGeometry(trunkCurve, 14, 0.135, 8, false)), hide, 0, 0, 0, 1, 1, 1);
    beam(g, hide, [0, 1.53, -1.20], [0, 0.60, -1.50], 0.033);
    ellipsoid(g, black, 0, 0.57, -1.51, 0.06, 0.11, 0.06);
    block(g, enemy ? enemyCloth : red, 0, 2.40, -0.10, 1.48, 0.08, 1.55);
    block(g, timber, 0, 2.48, -0.20, 1.10, 0.12, 1.2);
    for (const x of [-0.50, 0.50]) for (const z of [-0.73, 0.33]) beam(g, timber, [x, 2.48, z], [x, 3.02, z], 0.04);
    for (const z of [-0.73, 0.33]) beam(g, timber, [-0.5, 2.94, z], [0.5, 2.94, z], 0.04);
    for (const x of [-0.50, 0.50]) beam(g, timber, [x, 2.94, -0.73], [x, 2.94, 0.33], 0.04);
    const rider = buildPerson('general', enemy); rider.scale.setScalar(0.76); rider.position.set(0, 2.48, -0.2); g.add(rider);
    return g;
  }

  function curvedRoof(width: number, depth: number, height: number): THREE.BufferGeometry {
    const positions: number[] = [];
    const point = (x: number, z: number): number[] => {
      const t = Math.abs(z) / (depth / 2);
      return [x, height * (1 - t) + 0.19 * t ** 5, z];
    };
    for (let side = -1; side <= 1; side += 2) for (let i = 0; i < 8; i++) {
      const za = side * depth / 2 * i / 8, zb = side * depth / 2 * (i + 1) / 8;
      const a = point(-width / 2, za), b = point(width / 2, za), c = point(width / 2, zb), d = point(-width / 2, zb);
      positions.push(...a, ...b, ...c, ...a, ...c, ...d);
    }
    const geometry = own(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.computeVertexNormals();
    return geometry;
  }
  function roofPart(g: THREE.Group, x: number, y: number, z: number, width: number, depth: number, height: number, palace = false): void {
    mesh(g, curvedRoof(width, depth, height), palace ? mat('#68634a') : roof, x, y, z, 1, 1, 1);
    beam(g, palace ? bronze : timber, [x - width / 2 - 0.1, y + height + 0.03, z], [x + width / 2 + 0.1, y + height + 0.03, z], 0.055);
    for (const side of [-1, 1]) {
      beam(g, endgrain, [x - width / 2, y + 0.17, z + side * depth / 2], [x + width / 2, y + 0.17, z + side * depth / 2], 0.07);
      for (let i = 0; i <= Math.floor(width / 0.22); i++) {
        const tx = x - width / 2 + i * 0.22;
        beam(g, palace ? mat('#797358') : mat('#695247'), [tx, y + height + 0.02, z], [tx, y + height * 0.52 + 0.02, z + side * depth * 0.25], 0.018);
        beam(g, palace ? mat('#797358') : mat('#695247'), [tx, y + height * 0.52 + 0.02, z + side * depth * 0.25], [tx, y + 0.20, z + side * depth * 0.5], 0.018);
      }
    }
  }
  function buildHouse(palace: boolean): THREE.Group {
    const g = new THREE.Group(), w = palace ? 6.4 : 3.5, d = palace ? 3.7 : 2.65, h = palace ? 2.5 : 1.8;
    block(g, stone, 0, 0.16, 0, w + 0.65, 0.32, d + 0.65);
    block(g, mortar, 0, h / 2 + 0.3, 0, w, h, d);
    for (const x of [-w / 2 + 0.12, -w / 4, 0, w / 4, w / 2 - 0.12]) {
      for (const z of [-d / 2, d / 2]) mesh(g, cylinder, palace ? red : timber, x, h / 2 + 0.3, z, 0.10, h + 0.2, 0.10);
    }
    for (const z of [-d / 2 - 0.02, d / 2 + 0.02]) {
      block(g, timber, 0, 0.64, z, w, 0.12, 0.10);
      block(g, timber, 0, h + 0.23, z, w, 0.12, 0.14);
      for (const x of palace ? [-2.2, -1.1, 0, 1.1, 2.2] : [-0.9, 0, 0.9]) {
        block(g, darkwood, x, 1.15, z + Math.sign(z) * 0.04, palace ? 0.72 : 0.57, palace ? 1.45 : 1.0, 0.04);
        for (let i = -2; i <= 2; i++) block(g, endgrain, x + i * 0.095, 1.23, z + Math.sign(z) * 0.065, 0.024, 0.65, 0.025);
      }
    }
    roofPart(g, 0, h + 0.2, 0, w + 1.05, d + 1.25, palace ? 1.0 : 0.9, palace);
    if (palace) {
      roofPart(g, 0, h + 1.0, 0, w - 0.35, d - 0.15, 0.85, true);
      for (let i = 0; i < 3; i++) block(g, stone, 0, 0.05 + i * 0.07, d / 2 + 0.53 - i * 0.16, 2.1, 0.10, 0.8 - i * 0.12);
      for (const x of [-w / 2 - 0.2, w / 2 + 0.2]) {
        mesh(g, cylinder, stone, x, 0.62, d / 2 + 0.1, 0.17, 0.9, 0.17);
        ellipsoid(g, stone, x, 1.1, d / 2 + 0.1, 0.24, 0.13, 0.24);
      }
    } else {
      block(g, stone, 0, 0.07, d / 2 + 0.34, 1.1, 0.14, 0.65);
      for (const x of [-1.25, 1.25]) block(g, timber, x, 1.03, 0, 0.1, 1.8, d + 0.1);
    }
    return g;
  }

  function buildBoat(enemy: boolean, large: boolean): THREE.Group {
    const g = new THREE.Group(), length = large ? 4.6 : 3.6, width = large ? 0.85 : 0.66;
    const positions: number[] = [], rings = [-1, -0.78, -0.38, 0.34, 0.75, 1];
    const section = (i: number, j: number): number[] => {
      const z = rings[i] * length / 2, w = width * (0.06 + 0.94 * Math.sin((rings[i] + 1) * Math.PI / 2));
      const xs = [-1, -0.76, -0.25, 0.25, 0.76, 1], ys = [0.75, 0.32, 0.14, 0.14, 0.32, 0.75];
      return [xs[j] * w, ys[j] + Math.abs(rings[i]) ** 4 * 0.36, z];
    };
    for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < 5; j++) {
      const a = section(i, j), b = section(i + 1, j), c = section(i + 1, j + 1), d = section(i, j + 1);
      positions.push(...a, ...b, ...c, ...a, ...c, ...d);
    }
    const hull = own(new THREE.BufferGeometry()); hull.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); hull.computeVertexNormals();
    mesh(g, hull, enemy ? darkwood : timber, 0, 0, 0, 1, 1, 1);
    for (let i = 0; i < rings.length - 1; i++) for (const side of [0, 5]) beam(g, endgrain, section(i, side), section(i + 1, side), 0.045);
    for (let z = -length * 0.37; z <= length * 0.37; z += 0.16) {
      const w = width * Math.sqrt(Math.max(0.1, 1 - (z / (length * 0.5)) ** 2));
      block(g, endgrain, 0, 0.69, z, w * 1.88, 0.055, 0.14);
    }
    mesh(g, cylinder, timber, 0, 1.68, -0.1, 0.045, 2.1, 0.045);
    const sailPositions: number[] = [], sailWidth = large ? 1.75 : 1.35, sailHeight = large ? 1.75 : 1.45;
    const sailPoint = (u: number, v: number): number[] => [(u - 0.5) * sailWidth * (0.80 + v * 0.20), 1.04 + v * sailHeight, 0.02 + Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.25];
    for (let u = 0; u < 8; u++) for (let v = 0; v < 6; v++) {
      const a = sailPoint(u / 8, v / 6), b = sailPoint((u + 1) / 8, v / 6), c = sailPoint((u + 1) / 8, (v + 1) / 6), d = sailPoint(u / 8, (v + 1) / 6);
      sailPositions.push(...a, ...b, ...c, ...a, ...c, ...d);
    }
    const sail = own(new THREE.BufferGeometry()); sail.setAttribute('position', new THREE.Float32BufferAttribute(sailPositions, 3)); sail.computeVertexNormals();
    mesh(g, sail, enemy ? mat('#9e9680') : linen, 0, 0, 0, 1, 1, 1);
    for (let i = 0; i < 5; i++) beam(g, timber, [sailWidth * -0.48, 1.08 + i * sailHeight / 4, 0.08], [sailWidth * 0.48, 1.08 + i * sailHeight / 4, 0.08], 0.014);
    beam(g, linen, [0, 2.75, -0.1], [-width * 0.8, 0.78, -length * 0.36], 0.009);
    beam(g, linen, [0, 2.75, -0.1], [width * 0.8, 0.78, length * 0.36], 0.009);
    for (const side of [-1, 1]) for (let i = 0; i < (large ? 5 : 3); i++) {
      const z = -length * 0.29 + i * 0.48;
      beam(g, timber, [side * width * 0.6, 0.77, z], [side * (width + 0.83), 0.29, z - 0.38], 0.022);
      const paddle = block(g, endgrain, side * (width + 0.73), 0.32, z - 0.34, 0.36, 0.035, 0.12); paddle.rotation.z = side * -0.35;
    }
    const pennant = block(g, enemy ? enemyCloth : red, 0.2, 2.86, -0.1, 0.40, 0.23, 0.025); pennant.rotation.y = 0.1;
    block(g, darkwood, 0, 0.88, -length * 0.30, width * 1.4, 0.25, 0.42);
    return g;
  }

  function buildProp(kind: string): THREE.Group {
    const g = new THREE.Group();
    if (kind === 'house' || kind === 'hall') return buildHouse(kind === 'hall');
    if (kind === 'tree') {
      const bark = mat('#625341');
      beam(g, bark, [0, 0, 0], [0.08, 2.55, 0], 0.17);
      for (let i = 0; i < 7; i++) {
        const angle = i * 2.4, radius = 0.45 + (i % 3) * 0.35;
        const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius, y = 2.5 + (i % 3) * 0.37;
        beam(g, bark, [0, 1.6, 0], [x, y, z], 0.055);
        ellipsoid(g, mat(['#586145', '#4a573e', '#65704b'][i % 3]), x, y + 0.3, z, 0.9, 0.64, 0.83);
      }
    } else if (kind === 'bamboo') {
      for (let i = 0; i < 6; i++) {
        const x = Math.sin(i * 2.4) * 0.5, z = Math.cos(i * 2.4) * 0.5, h = 2.6 + i % 3 * 0.3;
        beam(g, mat('#687454'), [x, 0, z], [x + 0.12, h, z], 0.045);
        for (let y = 0.5; y < h; y += 0.42) {
          mesh(g, cylinder, mat('#88916c'), x + y / h * 0.12, y, z, 0.052, 0.025, 0.052);
          for (const side of [-1, 1]) {
            const blade = mesh(g, leaf, mat('#526246'), x + side * 0.25, y + 0.12, z, 0.36, 0.027, 0.09); blade.rotation.z = side * 0.35;
          }
        }
      }
    } else if (kind === 'tent') {
      const shape = new THREE.Shape(); shape.moveTo(-1.28, 0); shape.lineTo(0, 1.70); shape.lineTo(1.28, 0); shape.closePath();
      const geometry = own(new THREE.ExtrudeGeometry(shape, { depth: 2.4, bevelEnabled: false }));
      mesh(g, geometry, linen, 0, 0, -1.2, 1, 1, 1);
      block(g, darkwood, 0, 0.56, 1.205, 0.6, 1.1, 0.015);
      for (const z of [-1.32, 1.32]) beam(g, timber, [0, 0, z], [0, 1.78, z], 0.045);
      for (const side of [-1, 1]) for (const z of [-1.1, 1.1]) beam(g, linen, [side * 1.08, 0.2, z], [side * 1.7, 0.02, z], 0.015);
    } else if (kind === 'fence') {
      for (const x of [-0.96, 0, 0.96]) { mesh(g, cylinder, timber, x, 0.75, 0, 0.12, 1.5, 0.12); mesh(g, cone, endgrain, x, 1.56, 0, 0.12, 0.2, 0.12); }
      for (const y of [0.45, 1.08]) block(g, timber, 0, y, 0, 2.4, 0.10, 0.09);
    } else if (kind === 'rock') {
      const geo = own(new THREE.DodecahedronGeometry(1, 0));
      for (let i = 0; i < 3; i++) { const r = mesh(g, geo, i % 2 ? mortar : stone, Math.sin(i * 2.4) * 0.45, 0.30 + i * 0.07, Math.cos(i * 2.4) * 0.3, 0.55, 0.45 + i * 0.13, 0.50); r.rotation.y = i * 1.1; }
    } else if (kind === 'drum') {
      for (const x of [-0.36, 0.36]) for (const z of [-0.35, 0.35]) beam(g, timber, [x, 0, z], [x * 0.7, 0.9, z * 0.6], 0.045);
      mesh(g, cylinder, red, 0, 0.93, 0, 0.47, 0.54, 0.47).rotation.x = Math.PI / 2;
      for (const z of [-0.285, 0.285]) mesh(g, circle, linen, 0, 0.93, z, 0.44, 0.018, 0.44).rotation.x = Math.PI / 2;
      for (let i = 0; i < 14; i++) ellipsoid(g, bronze, Math.cos(i / 14 * Math.PI * 2) * 0.40, 0.93 + Math.sin(i / 14 * Math.PI * 2) * 0.40, 0.3, 0.025, 0.025, 0.015);
      beam(g, endgrain, [-0.3, 1.36, -0.15], [0.27, 1.40, 0.1], 0.025);
    } else if (kind === 'banner') {
      beam(g, timber, [0, 0, 0], [0, 2.7, 0], 0.035);
      mesh(g, cone, bronze, 0, 2.82, 0, 0.06, 0.2, 0.06);
      block(g, red, 0.49, 2.11, 0, 0.92, 0.85, 0.025);
      for (const y of [1.71, 2.51]) block(g, bronze, 0.49, y, 0.015, 0.92, 0.045, 0.025);
      block(g, bronze, 0.92, 2.11, 0.015, 0.045, 0.85, 0.025);
      block(g, bronze, 0.46, 2.11, 0.02, 0.16, 0.28, 0.025);
    } else if (kind === 'scroll') {
      block(g, timber, 0, 0.48, 0, 0.95, 0.12, 0.7);
      block(g, linen, 0, 0.56, 0, 0.70, 0.025, 0.48);
      for (const x of [-0.36, 0.36]) mesh(g, cylinder, linen, x, 0.59, 0, 0.07, 0.54, 0.07).rotation.x = Math.PI / 2;
      for (let i = 0; i < 4; i++) block(g, darkwood, -0.08, 0.578, -0.15 + i * 0.09, 0.29, 0.008, 0.013);
      for (const x of [-0.35, 0.35]) for (const z of [-0.23, 0.23]) block(g, timber, x, 0.23, z, 0.06, 0.46, 0.06);
    } else if (kind === 'token') {
      mesh(g, circle, timber, 0, 0.15, 0, 0.43, 0.30, 0.43);
      block(g, bronze, 0, 0.48, 0, 0.28, 0.60, 0.06);
      block(g, red, 0, 0.67, 0.038, 0.12, 0.13, 0.02);
      mesh(g, cylinder, linen, 0, 0.85, 0, 0.04, 0.22, 0.04);
    } else if (kind === 'horn') {
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.32, 0.36, 0), new THREE.Vector3(-0.12, 0.31, 0), new THREE.Vector3(0.15, 0.47, 0), new THREE.Vector3(0.32, 0.72, 0)]);
      mesh(g, own(new THREE.TubeGeometry(curve, 12, 0.08, 7, false)), bronze, 0, 0, 0, 1, 1, 1);
      const bell = mesh(g, cone, bronze, 0.32, 0.76, 0, 0.17, 0.27, 0.17); bell.rotation.z = -0.35;
      block(g, timber, 0, 0.15, 0, 0.85, 0.30, 0.55);
    } else if (kind === 'sacks') {
      for (let i = 0; i < 5; i++) {
        const x = i < 3 ? (i - 1) * 0.35 : (i - 3.5) * 0.38, y = i < 3 ? 0.28 : 0.66, z = i % 2 * 0.20;
        ellipsoid(g, linen, x, y, z, 0.24, 0.29, 0.24);
        mesh(g, cylinder, timber, x, y + 0.24, z, 0.07, 0.045, 0.07);
      }
    } else if (kind === 'well') {
      const geo = own(new THREE.TorusGeometry(0.65, 0.17, 6, 18));
      for (let i = 0; i < 3; i++) { const ring = mesh(g, geo, i % 2 ? stone : mortar, 0, 0.16 + i * 0.21, 0, 1, 1, 1); ring.rotation.x = Math.PI / 2; }
      mesh(g, circle, mat('#334747'), 0, 0.14, 0, 0.50, 0.03, 0.50);
      for (const x of [-0.75, 0.75]) beam(g, timber, [x, 0, 0], [x, 1.90, 0], 0.065);
      beam(g, timber, [-0.83, 1.7, 0], [0.83, 1.7, 0], 0.07);
      beam(g, linen, [0, 0.55, 0], [0, 1.75, 0], 0.012);
      roofPart(g, 0, 1.84, 0, 2.1, 1.5, 0.5);
    } else if (kind === 'pillar') {
      block(g, stone, 0, 0.1, 0, 0.67, 0.2, 0.67);
      mesh(g, cylinder, red, 0, 1.20, 0, 0.18, 2.2, 0.18);
      block(g, bronze, 0, 2.3, 0, 0.53, 0.13, 0.53);
    } else if (kind === 'logs') {
      for (let i = 0; i < 5; i++) {
        const x = i < 3 ? (i - 1) * 0.34 : (i - 3.5) * 0.34, y = i < 3 ? 0.18 : 0.47;
        const log = mesh(g, cylinder, timber, x, y, 0, 0.17, 1.75, 0.17); log.rotation.x = Math.PI / 2;
        for (const z of [-0.885, 0.885]) mesh(g, circle, endgrain, x, y, z, 0.148, 0.015, 0.148).rotation.x = Math.PI / 2;
      }
    } else if (kind === 'stakes') {
      for (let i = 0; i < 7; i++) {
        const x = Math.sin(i * 2.4) * 0.65, z = Math.cos(i * 2.4) * 0.65;
        const stake = mesh(g, cylinder, darkwood, x, 0.55, z, 0.065, 1.1, 0.065); stake.rotation.z = 0.12;
        const tip = mesh(g, cone, endgrain, x - 0.07, 1.16, z, 0.066, 0.28, 0.066); tip.rotation.z = 0.12;
      }
    } else if (kind === 'fire') {
      for (let i = 0; i < 5; i++) { const angle = i * Math.PI / 5; beam(g, darkwood, [Math.cos(angle) * -0.4, 0.07, Math.sin(angle) * -0.4], [Math.cos(angle) * 0.4, 0.07, Math.sin(angle) * 0.4], 0.065); }
      for (let i = 0; i < 5; i++) { const flame = mesh(g, cone, mat(i % 2 ? '#d08a36' : '#b45e28', 0, '#a85118'), Math.sin(i * 2.4) * 0.16, 0.35, Math.cos(i * 2.4) * 0.16, 0.12, 0.55 + i % 2 * 0.2, 0.13); flame.rotation.z = Math.sin(i) * 0.15; }
    } else if (kind === 'boat') return buildBoat(false, false);
    return g;
  }

  return {
    person: (style, enemy = false) => cached(`person/${style}/${enemy}`, () => buildPerson(style, enemy)),
    horse: (enemy = false) => cached(`horse/${enemy}`, () => buildHorse(enemy)),
    elephant: (enemy = false) => cached(`elephant/${enemy}`, () => buildElephant(enemy)),
    boat: (enemy = false, large = false) => cached(`boat/${enemy}/${large}`, () => buildBoat(enemy, large)),
    prop: (kind) => cached(`prop/${kind}`, () => buildProp(kind)),
    dispose: () => { for (const geometry of geometries) geometry.dispose(); for (const material of materials.values()) material.dispose(); geometries.clear(); materials.clear(); templates.clear(); },
  };
}
