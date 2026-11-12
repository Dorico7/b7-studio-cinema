/**
 * world.js - cenarios 3D estilizados do B7 Studio Cinema.
 *
 * Cada preset monta um "diorama" low-poly com texturas pintadas em canvas e
 * iluminacao toon. Os cenarios sao parametricos: o mesmo construtor gera uma
 * sala de pedra, um corredor, uma caverna ou um corte vertical do subsolo.
 *
 * Convencao: chao em y = 0, personagens em pe sobre y = 0, camera olhando para
 * y ~ 1,2 m.
 */
import * as THREE from 'three';
import * as P from './paint.js';

const gradTex = (() => {
  const d = new Uint8Array([70, 120, 190, 255]);
  const t = new THREE.DataTexture(d, 4, 1);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();

export const toon = (opts = {}) => new THREE.MeshToonMaterial({ gradientMap: gradTex, ...opts });
const texM = (canvas, rx = 1, ry = 1, extra = {}) => {
  const t = P.tex(canvas, rx, ry);
  return toon({ map: t, ...extra });
};

function box(w, h, d, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function cyl(rt, rb, h, seg, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** textura de pedra com UV proporcional ao tamanho (evita esticar) */
function stoneBox(w, h, d, x, y, z, parent, seed = 4, tint = '#ffffff') {
  const mat = texM(P.stone(seed), Math.max(1, w / 3), Math.max(1, h / 3), { color: tint });
  return box(w, h, d, mat, x, y, z, parent);
}

const MATERIAL_CACHE = new Map();
const cacheMat = (key, make) => {
  if (!MATERIAL_CACHE.has(key)) MATERIAL_CACHE.set(key, make());
  return MATERIAL_CACHE.get(key);
};

/* ------------------------------------------------------------------ */
/* aderecos                                                            */
/* ------------------------------------------------------------------ */

export function jar(parent, x, y, z, s = 1, mat) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.34 * s, 14, 10), mat);
  body.scale.set(1, 1.25, 1);
  body.position.y = 0.42 * s;
  body.castShadow = body.receiveShadow = true;
  g.add(body);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.2 * s, 0.18 * s, 12), mat);
  neck.position.y = 0.78 * s;
  neck.castShadow = true;
  g.add(neck);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.16 * s, 0.035 * s, 6, 14), mat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.87 * s;
  g.add(rim);
  parent.add(g);
  return g;
}

export function crate(parent, x, y, z, s = 1) {
  const mat = texM(P.planks(2), 1, 1, { color: '#d8b98c' });
  const m = box(0.8 * s, 0.8 * s, 0.8 * s, mat, 0, 0.4 * s, 0, parent);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  m.position.set(0, 0.4 * s, 0);
  g.add(m);
  parent.add(g);
  return g;
}

export function brazier(parent, x, y, z, intensity = 1) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const metal = toon({ color: '#6b5a45' });
  cyl(0.28, 0.34, 0.55, 10, metal, 0, 0.27, 0, g);
  cyl(0.42, 0.3, 0.16, 12, metal, 0, 0.6, 0, g);
  const flameMat = new THREE.MeshBasicMaterial({ color: '#ffb45a', transparent: true, opacity: 0.92 });
  const f1 = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.7, 8), flameMat);
  f1.position.y = 0.95;
  g.add(f1);
  const f2 = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.45, 8), new THREE.MeshBasicMaterial({ color: '#ffe9a8' }));
  f2.position.y = 0.88;
  g.add(f2);
  const light = new THREE.PointLight('#ffb066', 2.2 * intensity, 12, 1.8);
  light.position.set(0, 1.05, 0);
  g.add(light);
  g.userData.flames = [f1, f2];
  g.userData.light = light;
  parent.add(g);
  return g;
}

export function ladder(parent, x, y, z, h = 3) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const wood = toon({ color: '#8a6038' });
  for (const s of [-0.28, 0.28]) {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, h, 8), wood);
    rail.position.set(s, h / 2, 0);
    rail.castShadow = true;
    g.add(rail);
  }
  const n = Math.floor(h / 0.34);
  for (let i = 1; i <= n; i++) {
    const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.56, 6), wood);
    rung.rotation.z = Math.PI / 2;
    rung.position.set(0, i * (h / (n + 1)), 0);
    g.add(rung);
  }
  parent.add(g);
  return g;
}

export function arch(parent, x, y, z, w = 2.4, h = 2.8, thickness = 0.5, mat) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const side = (h - w / 2);
  for (const s of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(thickness, side, thickness), mat);
    pillar.position.set(s * (w / 2 + thickness / 2), side / 2, 0);
    pillar.castShadow = pillar.receiveShadow = true;
    g.add(pillar);
  }
  // anel (nao disco): arco externo + arco interno invertido
  const curveShape = new THREE.Shape();
  const rOut = w / 2 + thickness / 2;
  const rIn = w / 2 - thickness / 2;
  curveShape.absarc(0, 0, rOut, 0, Math.PI, false);
  curveShape.absarc(0, 0, rIn, Math.PI, 0, true);
  const ring = new THREE.Mesh(new THREE.ExtrudeGeometry(curveShape, { depth: thickness, bevelEnabled: false, curveSegments: 12 }), mat);
  ring.position.set(0, side, -thickness / 2);
  ring.castShadow = ring.receiveShadow = true;
  g.add(ring);
  parent.add(g);
  return g;
}

/** escada de pedra */
export function stairs(parent, x, y, z, steps = 8, w = 2.6, rise = 0.26, run = 0.34, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  const mat = cacheMat('stairStone', () => texM(P.stone(11, 38, 12, 62), 1, 1, { color: '#cfc4b0' }));
  for (let i = 0; i < steps; i++) {
    const h = rise * (i + 1);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, run), mat);
    m.position.set(0, h / 2, -i * run);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  }
  parent.add(g);
  return g;
}

/* ------------------------------------------------------------------ */
/* construtores de cenario                                             */
/* ------------------------------------------------------------------ */

const wallMatFor = (kind) => {
  if (kind === 'plaster') return cacheMat('wallPlaster', () => texM(P.plaster(8, 36), 2, 1.2));
  if (kind === 'brick') return cacheMat('wallBrick', () => texM(P.stone(21, 12, 22, 58, 64, 32), 2, 1.4));
  return cacheMat('wallStone', () => texM(P.stone(4, 36, 12, 58), 1.6, 1.2));
};

/** sala/camara fechada: usada para interior, parede quebrada e deposito */
function buildRoom(params = {}) {
  const {
    w = 10, d = 9, h = 4.6, wall = 'stone', floorMat = 'dirt',
    hole = 0, props = [], torches = 1, shelves = false, ceiling = true,
  } = params;
  const g = new THREE.Group();
  const wm = wallMatFor(wall);
  // chao
  const floorTex = floorMat === 'planks' ? P.planks(3) : P.dirt(7);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), texM(floorTex, w / 3, d / 3, { color: '#d9c9ac' }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);
  // paredes
  const back = stoneBox(w, h, 0.5, 0, h / 2, -d / 2 - 0.25, g, 4, '#e2d6c2');
  stoneBox(0.5, h, d, -w / 2 - 0.25, h / 2, 0, g, 9, '#d6c8b4');
  stoneBox(0.5, h, d, w / 2 + 0.25, h / 2, 0, g, 13, '#d6c8b4');
  if (ceiling) {
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), texM(P.stone(17, 30, 10, 42), 2, 2, { color: '#9c9182' }));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = h;
    g.add(ceil);
  }
  // buraco na parede (parede quebrada / passagem)
  if (hole > 0) {
    const r = 0.55 + hole * 0.5;
    const dark = new THREE.Mesh(new THREE.CircleGeometry(r, 20), new THREE.MeshBasicMaterial({ color: '#120d10' }));
    dark.position.set(0.6, 1.45, -d / 2 + 0.02);
    g.add(dark);
    const rimMat = texM(P.stone(27, 34, 10, 44), 1, 1);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const s = 0.24 + (i % 3) * 0.09;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rimMat);
      rock.position.set(0.6 + Math.cos(a) * (r + 0.12), 1.45 + Math.sin(a) * (r + 0.12), -d / 2 + 0.08);
      rock.rotation.set(i, i * 2, i * 3);
      rock.castShadow = true;
      g.add(rock);
    }
    // escombros no chao
    const rubbleMat = texM(P.stone(31, 34, 10, 50), 1, 1);
    for (let i = 0; i < 12; i++) {
      const s = 0.1 + ((i * 37) % 10) / 60;
      const r2 = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rubbleMat);
      r2.position.set(0.6 + ((i * 53) % 100) / 40 - 1.25, s * 0.7, -d / 2 + 0.35 + ((i * 29) % 60) / 100);
      r2.rotation.set(i, i * 1.7, i * 0.6);
      g.add(r2);
    }
  }
  // prateleiras/niches
  if (shelves) {
    const nicheMat = texM(P.stone(41, 32, 10, 40), 0.6, 0.6);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 2; j++) {
        const nx = -w / 2 + 1.6 + i * 2.4;
        const ny = 1.0 + j * 1.1;
        const holeM = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.85, 0.34), new THREE.MeshBasicMaterial({ color: '#191216' }));
        holeM.position.set(nx, ny, -d / 2 + 0.06);
        g.add(holeM);
        const frame = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.1, 0.42), nicheMat);
        frame.position.set(nx, ny - 0.46, -d / 2 + 0.12);
        g.add(frame);
        // potes dentro do nicho
        const jarMatN = texM(P.stone(51 + i, 26, 30, 54), 1, 1, { color: '#d8a878' });
        jar(g, nx - 0.25, ny - 0.4, -d / 2 + 0.18, 0.42, jarMatN);
        jar(g, nx + 0.28, ny - 0.4, -d / 2 + 0.18, 0.5, jarMatN);
      }
    }
  }
  // aderecos declarados na cena
  const jarMat = cacheMat('jarMat', () => texM(P.stone(51, 26, 30, 54), 1, 1, { color: '#d8a878' }));
  const crateMat = texM(P.planks(5), 1, 1, { color: '#c9a578' });
  for (const pr of props) {
    const [kind, px, pz, ps = 1] = pr;
    if (kind === 'jar') jar(g, px, 0, pz, ps, jarMat);
    else if (kind === 'crate') {
      const c = box(0.8 * ps, 0.8 * ps, 0.8 * ps, crateMat, px, 0.4 * ps, pz, g);
      c.rotation.y = (px * 37) % 1;
    } else if (kind === 'ladder') ladder(g, px, 0, pz, 3.2);
    else if (kind === 'table') {
      const t = box(1.8, 0.12, 0.9, crateMat, px, 0.78, pz, g);
      for (const s of [-0.7, 0.7]) for (const tz of [-0.3, 0.3]) box(0.1, 0.78, 0.1, toon({ color: '#6b4a2c' }), px + s, 0.39, pz + tz, g);
      t.castShadow = true;
    }
  }
  // aderecos padrao de interior (quebram a parede vazia)
  if (!props.length) {
    box(0.8, 0.8, 0.8, crateMat, -w / 2 + 1.5, 0.4, -d / 2 + 1.6, g);
    box(0.6, 0.6, 0.6, crateMat, -w / 2 + 2.3, 0.3, -d / 2 + 2.2, g);
    jar(g, w / 2 - 1.6, 0, -d / 2 + 1.5, 1, jarMat);
    jar(g, w / 2 - 2.3, 0, -d / 2 + 2.0, 0.8, jarMat);
  }
  for (let i = 0; i < torches; i++) {
    const bx = -w / 2 + 2 + i * ((w - 4) / Math.max(1, torches - 1 || 1));
    brazier(g, bx, 0, -d / 2 + 1.1, 0.9);
  }
  // braseiro de primeiro plano: cria poca de luz perto do personagem
  if (torches > 0) brazier(g, w / 2 - 1.4, 0, d / 2 - 2.2, 1.1);
  g.userData.cam = { pos: [0, 1.72, d / 2 - 0.45], look: [0, 1.15, -d / 2 + 1.5], fov: 46 };
  return g;
}

/** corredor subterraneo com arcos, lampadas e escada opcional */
function buildTunnel(params = {}) {
  const { len = 26, w = 4.2, h = 3.4, lamps = 4, stair = false, exitLight = false } = params;
  const g = new THREE.Group();
  const wm = wallMatFor('stone');
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, len), texM(P.dirt(19), w / 3, len / 3, { color: '#c9bda8' }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);
  // paredes laterais em blocos para dar variacao
  const seg = 6;
  for (let i = 0; i < seg; i++) {
    const z = -len / 2 + (len / seg) * (i + 0.5);
    stoneBox(0.4, h, len / seg, -w / 2 - 0.2, h / 2, z, g, 4 + i, '#ded2be');
    stoneBox(0.4, h, len / seg, w / 2 + 0.2, h / 2, z, g, 9 + i, '#d2c6b2');
    // teto
    const ceil = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.4, len / seg), texM(P.stone(23 + i, 32, 10, 44), 1, 1, { color: '#a89a88' }));
    ceil.position.set(0, h + 0.2, z);
    g.add(ceil);
  }
  const archMat = cacheMat('archStone', () => texM(P.stone(33, 36, 12, 60), 0.8, 0.8, { color: '#e6dccb' }));
  for (let i = 0; i < 4; i++) arch(g, 0, 0, -len / 2 + 2 + i * (len / 4.5), w - 0.9, h - 0.5, 0.4, archMat);
  for (let i = 0; i < lamps; i++) {
    const z = -len / 2 + 4 + i * (len / (lamps + 0.5));
    const lampG = new THREE.Group();
    lampG.position.set(0.35, h - 0.55, z);
    const cage = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.2), new THREE.MeshBasicMaterial({ color: '#ffd08a' }));
    lampG.add(cage);
    const metal = toon({ color: '#3b3128' });
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.3), metal);
    cap.position.y = 0.19;
    lampG.add(cap);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 5, 10), metal);
    ring.position.y = 0.26;
    lampG.add(ring);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 4), metal);
    chain.position.y = 0.48;
    lampG.add(chain);
    const l = new THREE.PointLight('#ffb066', 1.6, 9, 2);
    lampG.add(l);
    g.add(lampG);
  }
  if (exitLight) {
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.4), new THREE.MeshBasicMaterial({ color: '#ffe9c4' }));
    door.position.set(0, 1.2, len / 2 - 0.3);
    door.rotation.y = Math.PI;
    g.add(door);
    const dl = new THREE.PointLight('#ffe3b0', 2.4, 14, 1.6);
    dl.position.set(0, 1.6, len / 2 - 1.4);
    g.add(dl);
  }
  if (stair) stairs(g, 0, -0.2, -len / 2 + 2.4, 7, w - 1.2, 0.26, 0.34, 0);
  g.userData.cam = { pos: [0, 1.62, len / 2 - 0.9], look: [0, 1.5, -len / 2], fov: 50 };
  return g;
}

/** grande caverna com niveis empilhados (a "cidade" subterranea) */
function buildCavern(params = {}) {
  const { radius = 17, height = 22, levels = 3, columns = 8, braziers = 3 } = params;
  const g = new THREE.Group();
  // parede cilindrica vista por dentro
  const shellMat = texM(P.stone(7, 34, 12, 52), 6, 5, { color: '#d8cbb6', side: THREE.BackSide });
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.94, height, 28, 1, true), shellMat);
  shell.position.y = height / 2 - 1;
  shell.receiveShadow = true;
  g.add(shell);
  // chao
  const floor = new THREE.Mesh(new THREE.CircleGeometry(radius, 32), texM(P.dirt(11), 5, 5, { color: '#cbbfa8' }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);
  // teto (cone achatado) com estalactites
  const ceil = new THREE.Mesh(new THREE.ConeGeometry(radius * 1.02, height * 0.5, 28, 1, true), new THREE.MeshBasicMaterial({ color: '#2a2026', side: THREE.BackSide }));
  ceil.position.y = height - 1 + height * 0.25;
  g.add(ceil);
  const stalMat = texM(P.stone(15, 34, 10, 48), 0.4, 1.4);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + 0.4;
    const r = radius * (0.35 + ((i * 13) % 10) / 22);
    const hh = 1.4 + ((i * 7) % 10) / 4;
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.45, hh, 7), stalMat);
    c.position.set(Math.cos(a) * r, height - 1 - hh / 2, Math.sin(a) * r);
    c.rotation.x = Math.PI;
    g.add(c);
  }
  // niveis/plataformas com corrimao
  const platMat = texM(P.stone(29, 36, 12, 58), 2, 2, { color: '#e0d4c0' });
  const railMat = toon({ color: '#7a5a3c' });
  for (let l = 0; l < levels; l++) {
    const y = 3.2 + l * 3.4;
    const r = radius * (0.86 - l * 0.13);
    const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.62, r, 26, 1), platMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = y;
    ring.receiveShadow = true;
    g.add(ring);
    // pilares de apoio
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + l * 0.4;
      cyl(0.22, 0.26, y, 8, platMat, Math.cos(a) * r * 0.8, y / 2, Math.sin(a) * r * 0.8, g);
    }
    // corrimao externo
    const rail = new THREE.Mesh(new THREE.TorusGeometry(r * 0.99, 0.045, 5, 30, Math.PI * 1.4), railMat);
    rail.rotation.x = Math.PI / 2;
    rail.position.y = y + 0.5;
    g.add(rail);
  }
  // colunas centrais
  for (let i = 0; i < columns; i++) {
    const a = (i / columns) * Math.PI * 2;
    const r = radius * 0.62;
    const c = cyl(0.42, 0.5, height - 1, 10, platMat, Math.cos(a) * r, (height - 1) / 2, Math.sin(a) * r, g);
    c.castShadow = false;
  }
  for (let i = 0; i < Math.max(4, braziers + 2); i++) {
    const a = (i / Math.max(4, braziers + 2)) * Math.PI * 2 + 0.8;
    brazier(g, Math.cos(a) * radius * 0.7, 0, Math.sin(a) * radius * 0.7, 1.5);
  }
  // janelas aquecidas nas paredes: sugerem a cidade habitada
  const glow = new THREE.MeshBasicMaterial({ color: '#ffb45a' });
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + 0.2;
    const lvl = i % 3;
    const y = 2.6 + lvl * 3.4 + ((i * 7) % 5) * 0.06;
    const rr = radius * 0.955;
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.75), glow);
    win.position.set(Math.cos(a) * rr, y, Math.sin(a) * rr);
    win.lookAt(0, y, 0);
    g.add(win);
  }
  // moradias escavadas: blocos com janela acesa em cada nivel
  const houseMat = texM(P.stone(33, 32, 16, 46), 1.4, 1.4, { color: '#cbb9a0' });
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + 0.45;
    const lvl = i % 2;
    const y = 3.4 + lvl * 3.3;
    const r = radius * 0.83;
    const hx = Math.cos(a) * r, hz = Math.sin(a) * r;
    const w = 0.95, hh = 0.8 + (i % 3) * 0.12;
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, hh, 0.7), houseMat);
    box.position.set(hx, y + hh / 2, hz);
    box.rotation.y = -a;
    box.castShadow = false;
    box.receiveShadow = true;
    g.add(box);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.34), glow);
    win.position.set(hx + Math.cos(a) * 0.36, y + hh * 0.55, hz + Math.sin(a) * 0.36);
    win.lookAt(hx + Math.cos(a) * 2, y + hh * 0.55, hz + Math.sin(a) * 2);
    g.add(win);
  }
  g.userData.cam = { pos: [0, 1.9, radius * 0.5], look: [0, 4.2, -radius * 0.66], fov: 66 };
  g.userData.big = true;
  return g;
}

/** paredao de rocha com abertura para o exterior (entrada descoberta) */
function buildCliff(params = {}) {
  const { hole = 1.6, size = 12 } = params;
  const g = new THREE.Group();
  const rockMat = texM(P.stone(43, 30, 14, 34), 3.2, 2.2, { color: '#c9b99c' });
  const darkRock = texM(P.stone(47, 30, 10, 40), 3, 3, { color: '#a99a80' });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(size * 2.6, size * 1.8), texM(P.dirt(23), 7, 5, { color: '#cdb894' }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  g.add(ground);

  // macico rochoso: blocos enormes empilhados (evita face plana de "tijolo")
  const boulders = [
    [-0.95, 0.55, 1.0], [-0.55, 1.15, 1.15], [0.55, 1.1, 1.1], [0.95, 0.6, 0.95],
    [-0.25, 0.45, 1.25], [0.25, 0.5, 1.2],
  ];
  boulders.forEach(([bx, by, bs], i) => {
    const b = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), i % 2 ? rockMat : darkRock);
    b.scale.set(bs * size * 0.2, bs * size * 0.26, 2.0);
    b.position.set(bx * size * 1.05, by * size * 0.5, -4.8 + (i % 3) * 0.6);
    b.rotation.set(i * 0.3, i * 0.8, i * 0.2);
    b.castShadow = b.receiveShadow = true;
    g.add(b);
  });

  // silhueta irregular no topo e nas laterais
  for (let i = 0; i < 12; i++) {
    const x = -size * 1.05 + i * (size * 2.1 / 11);
    const s = 1.5 + ((i * 17) % 9) / 5;
    const b = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), darkRock);
    b.scale.set(s * 1.2, s * 0.9, 1.8);
    b.position.set(x, size * 1.35 + ((i * 7) % 5) * 0.3, -3.4 + ((i * 11) % 5) * 0.2);
    b.rotation.set(((i * 13) % 7) / 9, ((i * 7) % 11) / 8, ((i * 5) % 9) / 12);
    b.castShadow = b.receiveShadow = true;
    g.add(b);
  }
  // blocos salientes para quebrar a superficie do macico
  for (let i = 0; i < 10; i++) {
    const x = -size * 0.85 + i * (size * 1.7 / 9);
    const y = 0.8 + ((i * 5) % 4) * 1.5;
    if (Math.abs(x) < hole * 1.4 && y < 3.6) continue;
    const b = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), i % 2 ? darkRock : rockMat);
    b.scale.set(1.5 + ((i * 3) % 5) / 6, 1.2 + ((i * 7) % 4) / 5, 1.1);
    b.position.set(x, y, -2.35);
    b.rotation.set(i * 0.4, i * 0.9, i * 0.2);
    b.castShadow = b.receiveShadow = true;
    g.add(b);
  }
  // contrafortes nas laterais
  for (const s of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), rockMat);
    b.scale.set(2.6, size * 0.55, 2.2);
    b.position.set(s * size * 0.92, size * 0.5, -2.6);
    b.rotation.y = s * 0.4;
    b.castShadow = b.receiveShadow = true;
    g.add(b);
  }

  // a abertura: escuridao e moldura de pedra
  const dark = new THREE.Mesh(new THREE.PlaneGeometry(hole * 1.35, 3.0), new THREE.MeshBasicMaterial({ color: '#140f11' }));
  dark.position.set(0, 1.5, -2.6);
  g.add(dark);
  const frameMat = texM(P.stone(27, 34, 10, 44), 1.4, 1.4, { color: '#ded0b8' });
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.DodecahedronGeometry(0.75, 0), frameMat);
    p.scale.set(0.5, 1.9, 1.1);
    p.position.set(s * (hole * 0.82), 1.45, -2.5);
    p.castShadow = true;
    g.add(p);
  }
  const lintel = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9, 0), frameMat);
  lintel.scale.set(hole * 0.9, 0.55, 1);
  lintel.position.set(0, 3.15, -2.5);
  lintel.castShadow = true;
  g.add(lintel);

  // pedras soltas e trilha
  for (let i = 0; i < 14; i++) {
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1 + ((i * 13) % 7) / 34, 0), darkRock);
    r.position.set(((i * 31) % 90) / 9 - 5, 0.09, ((i * 17) % 50) / 12 + 0.4);
    r.rotation.set(i, i * 0.7, i * 0.3);
    r.castShadow = true;
    g.add(r);
  }
  g.userData.cam = { pos: [1.7, 1.9, 6.3], look: [0, 2.5, -2.2], fov: 46 };
  return g;
}

/** corte vertical: casa na superficie e salas escavadas abaixo */
function buildCutaway(params = {}) {
  const { depth = 12, width = 14 } = params;
  const g = new THREE.Group();
  const earthMat = texM(P.dirt(13), 5, 7, { color: '#c69a6a' });
  const cutMat = texM(P.stone(37, 34, 12, 54), 1.2, 1.2, { color: '#d8c8b0' });
  const roomMat = new THREE.MeshBasicMaterial({ color: '#1b1317' });

  // parede de fundo do corte (a "fatia" de terra)
  box(width, depth, 0.7, earthMat, 0, -depth / 2 + 0.2, -4.2, g);
  // laterais de terra para dar volume ao corte
  for (const s of [-1, 1]) {
    box(0.7, depth, 7, earthMat, s * (width / 2 - 0.35), -depth / 2 + 0.2, -1.2, g);
  }
  // superficie gramada
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(width, 10), texM(P.grass(6), 4, 3));
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(0, 0.01, 1.6);
  grass.receiveShadow = true;
  g.add(grass);

  // casa da superficie (com porao ligado ao subsolo)
  const houseMat = texM(P.plaster(8, 40), 2, 1.4, { color: '#f0e2c8' });
  const roofMat = texM(P.roof(9), 2, 2);
  const hw = 4.6, hh = 2.5, hd = 4;
  box(hw, hh, hd, houseMat, 0, hh / 2, -1.6, g);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(hw * 0.8, 1.3, 4), roofMat);
  roof.rotation.y = Math.PI / 4;
  roof.position.set(0, hh + 0.62, -1.6);
  roof.scale.set(1, 1, 0.86);
  roof.castShadow = true;
  g.add(roof);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.6, 0.1), toon({ color: '#5a3a24' }));
  door.position.set(0, 0.8, 0.42);
  g.add(door);

  // niveis escavados, cada um como um vao escuro com moldura de pedra
  const levels = [
    { y: -2.4, rooms: [[-3.4, 3.6, 2.1], [0.2, 3.0, 2.2], [3.4, 3.4, 2.0]] },
    { y: -5.4, rooms: [[-2.6, 3.2, 2.1], [1.2, 3.8, 2.3], [4.2, 2.4, 1.9]] },
    { y: -8.2, rooms: [[-1.4, 4.0, 2.0], [2.8, 3.0, 2.1]] },
  ];
  for (const lvl of levels) {
    // laje de piso entre niveis
    box(width - 1.2, 0.25, 3.2, cutMat, 0, lvl.y + 1.25, -3.4, g);
    for (const [x, w2, h2] of lvl.rooms) {
      const cavity = new THREE.Mesh(new THREE.BoxGeometry(w2, h2, 1.6), roomMat);
      cavity.position.set(x, lvl.y, -3.6);
      g.add(cavity);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(w2 + 0.35, h2 + 0.3, 0.16), cutMat);
      frame.position.set(x, lvl.y, -2.78);
      g.add(frame);
      const inner = new THREE.Mesh(new THREE.BoxGeometry(w2 - 0.1, h2 - 0.1, 0.2), roomMat);
      inner.position.set(x, lvl.y, -2.74);
      g.add(inner);
      // vigas de escora
      for (const s of [-1, 1]) {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(0.22, h2, 0.22), cutMat);
        beam.position.set(x + s * (w2 / 2 - 0.15), lvl.y, -2.6);
        g.add(beam);
      }
    }
  }
  // chamine de ventilacao ligando a casa ao terceiro nivel
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.9, 8.4, 0.9), roomMat);
  shaft.position.set(1.3, -3.9, -2.9);
  g.add(shaft);

  // escada externa de acesso
  stairs(g, -5.2, 0, 2.4, 6, 1.5, 0.24, 0.3, Math.PI);
  g.userData.cam = { pos: [0, 0.9, 12.6], look: [0, -3.1, -3], fov: 48 };
  return g;
}

/** paisagem aberta (superficie): colinas, arvores, caminho */
function buildSurface(params = {}) {
  const { trees = 14, hills = 8, house = true } = params;
  const g = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), texM(P.grass(6), 16, 16));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  g.add(ground);
  const rnd = P.rng(31);
  for (let i = 0; i < hills; i++) {
    const a = (i / hills) * Math.PI * 2 + rnd();
    const d = 26 + rnd() * 34;
    const hill = new THREE.Mesh(new THREE.SphereGeometry(9 + rnd() * 9, 16, 10), toon({ color: i % 2 ? '#7fa94f' : '#8cb75c' }));
    hill.position.set(Math.cos(a) * d, -5 - rnd() * 3, Math.sin(a) * d);
    hill.scale.y = 0.6;
    hill.receiveShadow = true;
    g.add(hill);
  }
  const trunkMat = toon({ color: '#6a4a32' });
  const leafMat = toon({ color: '#4f7f3a' });
  for (let i = 0; i < trees; i++) {
    const a = rnd() * Math.PI * 2, d = 8 + rnd() * 26;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.hypot(x, z) < 6) continue;
    const h = 2.6 + rnd() * 2;
    cyl(0.16, 0.22, h, 6, trunkMat, x, h / 2, z, g);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(1.3 + rnd() * 0.7, 10, 8), leafMat);
    crown.position.set(x, h + 0.5, z);
    crown.scale.y = 1.25;
    crown.castShadow = true;
    g.add(crown);
  }
  if (house) {
    const hm = texM(P.plaster(8, 38), 2, 1.4, { color: '#f2e4ca' });
    const rm = texM(P.roof(9), 2, 2);
    box(6, 3, 5, hm, -8, 1.5, -6, g);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.6, 1.7, 4), rm);
    roof.rotation.y = Math.PI / 4;
    roof.position.set(-8, 3.85, -6);
    roof.scale.set(1, 1, 0.84);
    roof.castShadow = true;
    g.add(roof);
  }
  g.userData.cam = { pos: [6.5, 3.2, 12], look: [-2, 1.6, -4], fov: 44 };
  return g;
}

/** piscina noturna: cenário de referência com casa, cordão de lâmpadas e água refletiva */
function buildPool(params = {}) {
  const { bulbs = 12 } = params;
  const g = new THREE.Group();
  const deck = texM(P.planks(14), 3, 3, { color: '#2d5e66' });
  const wall = new THREE.MeshBasicMaterial({ color: '#e8e1d2' });
  const roof = texM(P.roof(11), 2, 2, { color: '#8a5537' });
  const wood = toon({ color: '#8b5535' });
  const dark = toon({ color: '#11182d' });
  const warm = new THREE.MeshBasicMaterial({ color: '#ffd27a' });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), texM(P.dirt(91), 8, 8, { color: '#263241' }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; g.add(ground);
  const waterMat = new THREE.MeshPhongMaterial({ color: '#12aeca', shininess: 120, specular: '#b7ffff', transparent: true, opacity: 0.92 });
  const waterM = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.12, 5.2), waterMat);
  waterM.position.set(0, 0.14, 2.2); waterM.receiveShadow = true; g.add(waterM);
  const rimMat = toon({ color: '#f0e6d2' });
  for (const x of [-5.5, 5.5]) box(0.35, 0.28, 5.6, rimMat, x, 0.2, 2.2, g);
  for (const z of [-0.5, 4.9]) box(11.2, 0.28, 0.35, rimMat, 0, 0.2, z, g);
  box(11, 4.5, 1.0, wall, 0, 2.25, -5.0, g);
  const roofM = new THREE.Mesh(new THREE.ConeGeometry(7.8, 1.7, 4), roof);
  roofM.rotation.y = Math.PI / 4; roofM.position.set(0, 5.35, -5.0); roofM.scale.set(1, 1, 0.55); g.add(roofM);
  box(1.5, 2.7, 0.08, toon({ color: '#493325' }), -0.1, 1.35, -4.42, g);
  for (const x of [-3.8, 3.8]) { box(1.55, 1.35, 0.08, warm, x, 2.6, -4.42, g); box(0.08, 1.55, 0.12, wood, x, 2.6, -4.34, g); box(1.7, 0.08, 0.12, wood, x, 2.6, -4.34, g); }
  for (let i = 0; i < 4; i++) box(1.7 - i * 0.18, 0.14, 0.45, rimMat, -3.9 + i * 0.18, 0.25 + i * 0.16, 0.1 + i * 0.32, g);
  const cableMat = new THREE.LineBasicMaterial({ color: '#c7a76a' });
  const cablePts = [new THREE.Vector3(-11, 6.6, 1.8), new THREE.Vector3(-3, 7.2, -1), new THREE.Vector3(6, 6.7, -1), new THREE.Vector3(12, 5.8, 1.5)];
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(cablePts), cableMat));
  for (let i = 0; i < bulbs; i++) {
    const q = i / Math.max(1, bulbs - 1), x = -10 + q * 20, z = 1.2 - Math.sin(q * Math.PI) * 2.3, y = 6.55 + Math.sin(q * Math.PI) * 0.65;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), warm); bulb.position.set(x, y - 0.2, z); g.add(bulb);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.35, 5), cableMat); cord.position.set(x, y - 0.02, z); g.add(cord);
    const light = new THREE.PointLight('#ffd27a', 0.65, 4.5, 2); light.position.copy(bulb.position); light.userData.bulbIndex = i; g.add(light);
  }
  const duck = new THREE.Group(); duck.position.set(1.35, 0.38, 2.2);
  const yellow = new THREE.MeshBasicMaterial({ color: '#f5d51d' }), orange = new THREE.MeshBasicMaterial({ color: '#ee8e1d' });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.48, 14, 10), yellow); body.scale.set(1.25, 0.72, 0.9); duck.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 10), yellow); head.position.set(0.18, 0.35, 0); duck.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.28, 6), orange); beak.rotation.z = Math.PI / 2; beak.position.set(0.48, 0.32, 0); duck.add(beak);
  for (const z of [-0.13, 0.13]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), dark); eye.position.set(0.31, 0.46, z); duck.add(eye); }
  g.add(duck);
  g.userData.animate = (sec) => { waterM.position.y = 0.14 + Math.sin(sec * 2.4) * 0.018; duck.position.y = 0.38 + Math.sin(sec * 2.1) * 0.045; duck.rotation.z = Math.sin(sec * 1.7) * 0.025; g.traverse((o) => { if (o.userData.bulbIndex !== undefined && o.isLight) o.intensity = 0.55 + 0.16 * Math.sin(sec * 3.2 + o.userData.bulbIndex); }); };
  g.userData.cam = { pos: [0, 2.95, 9.7], look: [0, 1.85, 0.35], fov: 46 };
  return g;
}

export const SETS = {
  room: buildRoom,
  tunnel: buildTunnel,
  cavern: buildCavern,
  cliff: buildCliff,
  cutaway: buildCutaway,
  surface: buildSurface,
  pool: buildPool,
};

/** lista usada pelo planejador e pela UI */
export const SET_CATALOG = {
  room: { label: 'Sala / parede', hint: 'interior, descoberta, deposito' },
  tunnel: { label: 'Tunel / corredor', hint: 'passagem, escadaria, fuga' },
  cavern: { label: 'Caverna / cidade', hint: 'revelacao, escala, multidoes' },
  cliff: { label: 'Rocha / entrada', hint: 'descoberta ao ar livre' },
  cutaway: { label: 'Corte do subsolo', hint: 'mostrar o que existe embaixo' },
  surface: { label: 'Superficie / vila', hint: 'contexto, epoca, cotidiano' },
  pool: { label: 'Piscina / noite', hint: 'lifestyle, comedia, personagem ao telefone' },
};

export function buildWorld(setId, params = {}) {
  const builder = SETS[setId] || SETS.room;
  const g = builder(params);
  g.userData.setId = setId;
  return g;
}
