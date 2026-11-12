/**
 * cast.js - elenco autoral do B7 Studio Cinema.
 *
 * Personagens "bean head" 2D com contorno de tinta, desenhados em canvas
 * 600 x 1000. Cada peca (rosto, cabelo, roupa, membros) e parametrica para
 * permitir poses, expressoes e angulos sem gerar imagens novas.
 */
import { INK, SKIN, SH_CLOTH, SH_SKIN, Pen, blobPts, headBlob, rrect, ellPts, curve, mul, mix, rad, clamp } from './pen.js';

const STEEL = '#9aa7b4';
const BRASS = '#d8a94b';
const LEATHER = '#7d5133';
const ROPE = '#c8a870';

/** roupas: cores e acessorios por personagem */
export const OUTFITS = {
  explorer: { shirt: '#c9713a', pants: '#3b4a5a', jacket: '#8a5a3c', skin: SKIN, hair: '#3a2a1e', hat: 'none', satchel: true, scarf: '#d9d2c4' },
  worker: { shirt: '#3f6f86', pants: '#2f4351', overall: true, skin: '#e8b98d', hair: '#241c18', hat: 'hardhat', vest: '#e0b23c' },
  elder: { robe: '#6d4a8f', robe2: '#543a70', skin: '#efc9a6', beard: '#eae4da', hair: '#eae4da', hat: 'none', sash: '#d8a94b' },
  girl: { dress: '#c8556f', dress2: '#a63f57', skin: '#f3c9a2', hair: '#4a2c1e', hat: 'none', backpack: '#d8a94b', pigtails: true },
  scientist: { coat: '#e9e5da', shirt: '#4a7f8c', skin: '#e8c1a0', hair: '#2b2b2b', hat: 'none', glasses: true },
  guard: { tunic: '#8c3a34', leather: '#5c3a26', skin: '#e5b183', hair: '#2a211c', hat: 'helmet' },
  merchant: { shirt: '#7a8f4a', vest: '#4b3a2c', skin: '#d9a276', hair: '#1f1a17', hat: 'cap', stout: true },
  child: { shirt: '#e0b23c', pants: '#4a6a8a', skin: '#f0c49c', hair: '#33241a', hat: 'none', small: true },
  poolhost: { shirt: '#e6b91f', pants: '#2e5362', skin: '#f4d7bd', hair: '#f0eee5', hat: 'none', sunglasses: true },
};

const LIGHT = -118;

function headW(seed, size = 118) {
  const H = headBlob(seed, size, 0);
  return { H, W: 2 * H.a, HH: 2 * H.b };
}

/**
 * Rosto frontal.
 * expr: neutral | smile | grin | laugh | surprised | shock | scared | sad | angry |
 *       stern | thinking | nervous | squint | sleep | wink
 */
export function faceFront(p, cx, hc, W, expr = 'neutral', facing = 0, look = 0, lid = 0, skin = SKIN, opts = {}) {
  const u = W / 100;
  const ex = cx + 2 * u * facing;
  const eyeDX = 19 * u, eyeY = hc + 2 * u;
  const rEye = 7.4 * u;
  const browY = eyeY - 15 * u;

  const eye = (side, kind) => {
    const x = ex + side * eyeDX + look * 4 * u;
    switch (kind) {
      case 'arc': // olho fechado sorrindo
        p.stroke(curve([x - 8 * u, eyeY + 1 * u], [x, eyeY - 7 * u], [x + 8 * u, eyeY + 1 * u]), 3.4 * u, INK);
        break;
      case 'line':
        p.stroke([[x - 8 * u, eyeY], [x + 8 * u, eyeY]], 3.2 * u, INK);
        break;
      case 'wide': {
        p.ell(x, eyeY, rEye * 1.25, rEye * 1.35, '#ffffff', 2.6 * u);
        p.dot(x + look * 2.2 * u, eyeY + 0.6 * u, rEye * 0.62);
        p.dot(x + look * 2.2 * u - 2 * u, eyeY - 1.8 * u, 1.5 * u, '#ffffff');
        break;
      }
      case 'half': // palpebra caida
        p.ell(x, eyeY, rEye, rEye, '#ffffff', 0);
        p.dot(x + look * 2 * u, eyeY + 1.2 * u, rEye * 0.55);
        p.poly(rrect(x - rEye - 1 * u, eyeY - rEye - 2 * u, x + rEye + 1 * u, eyeY - 0.4 * u, 1.5 * u), skin, 0);
        p.stroke([[x - rEye, eyeY - 0.4 * u], [x + rEye, eyeY - 0.4 * u]], 2.6 * u, INK);
        break;
      case 'dot':
      default: {
        const lidK = clamp(lid);
        if (lidK > 0.92) {
          p.stroke(curve([x - 7 * u, eyeY], [x, eyeY + 5 * u], [x + 7 * u, eyeY]), 3 * u, INK);
        } else {
          if (lidK > 0.05) {
            p.ell(x, eyeY, rEye, rEye, '#ffffff', 0);
            p.clip(rrect(x - rEye - 2, eyeY - rEye - 2, x + rEye + 2, eyeY + rEye + 2, 2 * u), () => {});
          }
          p.dot(x + look * 2.4 * u, eyeY + lidK * 2 * u, rEye * (1 - lidK * 0.35));
          p.dot(x + look * 2.4 * u - 1.8 * u, eyeY - 2 * u, 1.4 * u, '#ffffff');
        }
      }
    }
  };

  const brow = (side, tilt, lift = 0) => {
    const x = ex + side * eyeDX;
    const y = browY - lift * u;
    p.stroke([[x - 9 * u, y + tilt * 1.8 * u], [x + 9 * u, y - tilt * 1.8 * u]], 3.2 * u, opts.browCol || '#3b2a20');
  };

  const mouth = (kind) => {
    const mx = ex + look * 1.5 * u, my = hc + 33 * u;
    switch (kind) {
      case 'smile': p.stroke(curve([mx - 10 * u, my - 2 * u], [mx, my + 6 * u], [mx + 10 * u, my - 2 * u]), 3 * u, INK); break;
      case 'grin':
        p.poly([[mx - 13 * u, my - 3 * u], [mx + 13 * u, my - 3 * u], [mx + 9 * u, my + 8 * u], [mx - 9 * u, my + 8 * u]], '#5a1e28', 2.6 * u);
        p.poly([[mx - 11 * u, my - 2 * u], [mx + 11 * u, my - 2 * u], [mx + 9 * u, my + 1.5 * u], [mx - 9 * u, my + 1.5 * u]], '#ffffff', 0);
        break;
      case 'laugh':
        p.poly(blobPts(mx, my + 3 * u, { a: 12 * u, b: 10 * u, nTop: 2, nBot: 3, egg: 0, noise: 0, seed: 2 }), '#5a1e28', 2.6 * u);
        p.poly(rrect(mx - 9 * u, my - 4 * u, mx + 9 * u, my + 1 * u, 2 * u), '#ffffff', 0);
        break;
      case 'o': p.ell(mx, my + 1 * u, 6 * u, 7.5 * u, '#5a1e28', 2.4 * u); break;
      case 'bigO': p.ell(mx, my + 3 * u, 9 * u, 11 * u, '#4a1820', 2.6 * u); break;
      case 'frown': p.stroke(curve([mx - 9 * u, my + 4 * u], [mx, my - 3 * u], [mx + 9 * u, my + 4 * u]), 3 * u, INK); break;
      case 'flat': p.stroke([[mx - 8 * u, my], [mx + 8 * u, my]], 3 * u, INK); break;
      case 'wave': p.stroke([[mx - 10 * u, my], [mx - 4 * u, my - 3 * u], [mx + 1 * u, my + 2 * u], [mx + 6 * u, my - 2 * u], [mx + 10 * u, my + 1 * u]], 2.8 * u, INK); break;
      default: p.stroke(curve([mx - 7 * u, my - 1 * u], [mx, my + 3 * u], [mx + 7 * u, my - 1 * u]), 3 * u, INK);
    }
  };

  switch (expr) {
    case 'smile': eye(-1, 'dot'); eye(1, 'dot'); brow(-1, 0.5); brow(1, -0.5); mouth('smile'); break;
    case 'grin': eye(-1, 'dot'); eye(1, 'dot'); brow(-1, 1); brow(1, -1); mouth('grin'); break;
    case 'laugh': eye(-1, 'arc'); eye(1, 'arc'); brow(-1, 1.5, 2); brow(1, -1.5, 2); mouth('laugh'); break;
    case 'surprised': eye(-1, 'wide'); eye(1, 'wide'); brow(-1, 0, 6); brow(1, 0, 6); mouth('o'); break;
    case 'shock': eye(-1, 'wide'); eye(1, 'wide'); brow(-1, -1.4, 7); brow(1, 1.4, 7); mouth('bigO'); break;
    case 'scared': eye(-1, 'wide'); eye(1, 'wide'); brow(-1, 1.6, 4); brow(1, -1.6, 4); mouth('wave'); break;
    case 'sad': eye(-1, 'dot'); eye(1, 'dot'); brow(-1, -2.4, 0); brow(1, 2.4, 0); mouth('frown'); break;
    case 'angry': eye(-1, 'dot'); eye(1, 'dot'); brow(-1, 3.2, -2); brow(1, -3.2, -2); mouth('flat'); break;
    case 'stern': eye(-1, 'dot'); eye(1, 'dot'); brow(-1, 1.8, -1); brow(1, -1.8, -1); mouth('flat'); break;
    case 'thinking': eye(-1, 'dot'); eye(1, 'dot'); brow(-1, 0.6, 5); brow(1, -0.6, 0); mouth('wave'); break;
    case 'nervous': eye(-1, 'dot'); eye(1, 'dot'); brow(-1, -1, 3); brow(1, 1, 3); mouth('wave');
      p.stroke(curve([ex + 30 * u, hc - 12 * u], [ex + 38 * u, hc - 4 * u], [ex + 32 * u, hc + 6 * u]), 2.4 * u, '#9fd0e8');
      break;
    case 'squint': eye(-1, 'half'); eye(1, 'half'); brow(-1, 1, 0); brow(1, -1, 0); mouth('flat'); break;
    case 'sleep': eye(-1, 'line'); eye(1, 'line'); brow(-1, -0.4); brow(1, 0.4); mouth('o'); break;
    case 'wink': eye(-1, 'arc'); eye(1, 'dot'); brow(-1, 1, 2); brow(1, -1, 0); mouth('smile'); break;
    default: eye(-1, 'dot'); eye(1, 'dot'); brow(-1, 0.6); brow(1, -0.6); mouth('flat');
  }
  if (opts.blush) {
    for (const s of [-1, 1]) p.ell(ex + s * 32 * u, hc + 18 * u, 9 * u, 5 * u, 'rgba(226,110,110,.35)', 0);
  }
}

/** cabelo / chapeu */
function hairOn(p, O, H, cx, hc, u, seed) {
  const a = H.a, b = H.b;
  const col = O.hair || '#33241a';
  if (O.hat === 'hardhat') {
    const hp = ellPts(cx, hc - b * 0.42, a * 1.12, b * 0.78, 180, 360, 0, 32);
    hp.push([cx + a * 1.12, hc - b * 0.3], [cx - a * 1.12, hc - b * 0.3]);
    p.gradFill(hp, '#f2c33c', '#c48f1c', LIGHT);
    p.inkRing(hp, 4.2 * u);
    p.band([[cx - a * 1.18, hc - b * 0.3], [cx + a * 1.18, hc - b * 0.3]], '#e0b23c', 8 * u, 2.2 * u);
    p.stroke([[cx - a * 0.5, hc - b * 0.95], [cx + a * 0.1, hc - b * 1.02]], 5 * u, '#ffe9a8');
    return;
  }
  if (O.hat === 'helmet') {
    const hp = ellPts(cx, hc - b * 0.3, a * 1.06, b * 0.72, 180, 360, 0, 32);
    hp.push([cx + a * 1.06, hc - b * 0.08], [cx - a * 1.06, hc - b * 0.08]);
    p.gradFill(hp, '#b9a17a', '#7d6849', LIGHT);
    p.inkRing(hp, 4.2 * u);
    p.band([[cx - a * 1.12, hc - b * 0.1], [cx + a * 1.12, hc - b * 0.1]], '#8a6a44', 9 * u, 2.2 * u);
    p.stroke([[cx, hc - b * 1.0], [cx, hc - b * 0.2]], 4 * u, '#c9b48c');
    return;
  }
  if (O.hat === 'cap') {
    const hp = ellPts(cx, hc - b * 0.45, a * 1.05, b * 0.62, 180, 360, 0, 28);
    hp.push([cx + a * 1.05, hc - b * 0.35], [cx - a * 1.05, hc - b * 0.35]);
    p.gradFill(hp, '#4a6f8c', '#2f4a60', LIGHT);
    p.inkRing(hp, 4 * u);
    p.poly([[cx + a * 0.2, hc - b * 0.4], [cx + a * 1.5, hc - b * 0.28], [cx + a * 1.4, hc - b * 0.06], [cx + a * 0.1, hc - b * 0.22]], '#3a5a74', 3.4 * u);
    return;
  }
  if (O.hat === 'hood') {
    const hp = blobPts(cx, hc - b * 0.1, { a: a * 1.28, b: b * 1.2, nTop: 2.1, nBot: 1.7, egg: -0.1, noise: 0.012, seed: seed + 3 });
    p.gradFill(hp, '#5c6b8a', '#3a4459', LIGHT);
    p.inkRing(hp, 4.4 * u);
    p.poly(blobPts(cx + 2 * u, hc + 4 * u, { a: a * 0.94, b: b * 0.96, nTop: 2.1, nBot: 2.6, egg: 0.16, noise: 0.006, seed }), '#f0c9a4', 0);
    faceFront(p, cx, hc, 2 * a, opts.expr, opts.facing, opts.look, opts.lid, '#f0c9a4', opts);
    return true;
  }
  // cabelo comum: cobre apenas o topo da cabeca (nunca os olhos)
  const long = O.pigtails || O.longHair;
  if (long) {
    for (const s of [-1, 1]) {
      const bx = cx + s * a * 0.95, by = hc + b * 0.25;
      p.ell(bx, by, a * 0.34, b * 0.55, mul(col, [1, 1, 1]), 3.4 * u);
      if (O.pigtails) p.band([[bx, by + b * 0.3], [bx + s * a * 0.1, by + b * 0.62]], '#d97f92', 7 * u, 2 * u);
    }
  }
  const hp = blobPts(cx, hc - b * 0.62, { a: a * 1.04, b: b * 0.52, nTop: 1.8, nBot: 2.2, egg: -0.06, noise: 0.012, seed: seed + 11 });
  p.shadedFill(hp, col, mul(col, [0.55, 0.52, 0.6]), LIGHT, a * 0.8, 0.3);
  p.inkRing(hp, 4 * u);
  // franja: cobre as laterais e parte da testa, sem descer sobre os olhos
  for (const s of [-1, 1]) {
    p.poly([[cx + s * a * 0.72, hc - b * 0.7], [cx + s * a * 1.0, hc - b * 0.42], [cx + s * a * 1.02, hc - b * 0.12], [cx + s * a * 0.88, hc - b * 0.4]], col, 0);
  }
  p.poly([[cx - a * 0.86, hc - b * 0.52], [cx - a * 0.5, hc - b * 0.8], [cx + a * 0.1, hc - b * 0.84], [cx + a * 0.74, hc - b * 0.6], [cx + a * 0.6, hc - b * 0.5], [cx - a * 0.2, hc - b * 0.58]], col, 0);
  if (O.glasses) {
    for (const s of [-1, 1]) {
      p.ell(cx + s * 19 * u, hc + 2 * u, 15 * u, 13 * u, 'rgba(200,230,240,.25)', 3 * u);
    }
    p.stroke([[cx - 4 * u, hc + 2 * u], [cx + 4 * u, hc + 2 * u]], 2.6 * u, INK);
  }
  if (O.sunglasses) {
    for (const s of [-1, 1]) {
      p.ell(cx + s * 19 * u, hc + 2 * u, 16 * u, 12 * u, '#33404b', 3.5 * u);
      p.ell(cx + s * 15 * u, hc - 1 * u, 5 * u, 3 * u, 'rgba(255,255,255,.55)', 0);
    }
    p.stroke([[cx - 4 * u, hc + 2 * u], [cx + 4 * u, hc + 2 * u]], 3 * u, INK);
  }
  return false;
}

/** desenha o personagem inteiro no canvas (espaco 600x1000) */
export function character(p, outfitKey = 'explorer', opts = {}) {
  const O = typeof outfitKey === 'string' ? OUTFITS[outfitKey] || OUTFITS.explorer : outfitKey;
  const {
    expr = 'neutral', blink = 0, look = 0, facing = 0, seed = 3,
    L = 'hang', R = 'hang', tilt = 0, headTilt = 0, bob = 0, flip = false,
    prop = null, propHand = 'R',
  } = opts;
  const scale = O.small ? 0.9 : 1;
  const { H, W, HH } = headW(seed, 150 * scale);
  const u = W / 100;
  const sole = 941;
  const hc = 58 + H.b; // topo da cabeca com margem
  const chin = hc + H.b;
  const neck = 20 * u;
  const torsoTop = chin + neck - 6 * u;
  const torsoH = 358 * scale;
  const torsoBot = torsoTop + torsoH;
  const cx = 300;
  const ow = 4.4 * u;
  const legCol = O.pants || mul(O.robe || O.dress || O.tunic || O.shirt || '#5a6b7a', [0.8, 0.8, 0.85]);

  p.g.save();
  if (flip) {
    p.g.translate(600, 0);
    p.g.scale(-1, 1);
  }

  // sombra de contato
  p.ell(cx, sole + 6 * u, 70 * u, 13 * u, 'rgba(20,16,20,.25)', 0);

  // ---- pernas ----
  for (const s of [-1, 1]) {
    const hx = cx + s * 17 * u, fx = cx + s * 20 * u;
    p.stroke([[hx, torsoBot - 22 * u], [fx, sole]], 13 * u, INK);
    p.stroke([[hx, torsoBot - 22 * u], [fx, sole]], 8.6 * u, legCol);
    // sapato
    p.poly([[fx - 12 * u, sole - 9 * u], [fx + 18 * u, sole - 9 * u], [fx + 19 * u, sole + 3 * u], [fx - 13 * u, sole + 3 * u]], '#3a2a20', 3.2 * u);
  }

  // ---- bracos (atras) ----
  const shoulderY = torsoTop + 12 * u;
  const armX = (s) => cx + s * (0.5 * W);
  const handPos = (s, pose) => {
    const sx = armX(s), sy = shoulderY;
    switch (pose) {
      case 'up': return [sx + s * 22 * u, sy - 100 * u];
      case 'wave': return [sx + s * 34 * u, sy - 82 * u];
      case 'point': return [sx + s * 78 * u, sy - 6 * u];
      case 'reach': return [sx + s * 56 * u, sy - 26 * u];
      case 'hold': return [sx + s * 34 * u, sy + 34 * u];
      case 'hammer': return [sx + s * 46 * u, sy + 6 * u];
      case 'lift': return [sx + s * 26 * u, sy - 56 * u];
      case 'cross': return [cx - s * 26 * u, sy + 18 * u];
      case 'hip': return [sx + s * 12 * u, torsoBot - 20 * u];
      case 'torch': return [sx + s * 40 * u, sy + 4 * u];
      case 'phone': return [sx + s * 35 * u, sy - 15 * u];
      default: return [sx + s * 12 * u, sy + 96 * u];
    }
  };
  const drawArm = (s, pose) => {
    const sx = armX(s), sy = shoulderY;
    const [hx, hy] = handPos(s, pose);
    const midX = (sx + hx) / 2 + s * 8 * u, midY = (sy + hy) / 2 + 10 * u;
    p.stroke(curve([sx, sy], [midX, midY], [hx, hy]), 11.5 * u, INK);
    p.stroke(curve([sx, sy], [midX, midY], [hx, hy]), 7.4 * u, O.skin || SKIN);
    p.ell(hx, hy, 7.2 * u, 7.2 * u, O.skin || SKIN, 2.8 * u);
    return [hx, hy];
  };

  const behind = (pose) => ['hip', 'hold', 'cross'].includes(pose);
  if (behind(L)) drawArm(-1, L);
  if (behind(R) && !prop) drawArm(1, R);

  // ---- corpo ----
  const clothes = O.shirt || O.tunic || O.coat || O.dress || '#7a8fa0';
  const bodyTop = torsoTop;
  const bodyW = (O.stout ? 0.68 : 0.62) * W;
  const torso = blobPts(cx, (bodyTop + torsoBot) / 2, {
    a: bodyW, b: (torsoBot - bodyTop) / 2, nTop: 2.0, nBot: 2.1,
    egg: O.dress ? 0.3 : 0.04, noise: 0.006, seed: seed + 5,
  });
  p.shadedFill(torso, O.dress || O.robe || clothes, mul(O.dress || O.robe || clothes, SH_CLOTH), LIGHT, bodyW, 0.34);
  p.inkRing(torso, ow);

  const inner = (fn) => p.clip(torso, fn);
  inner(() => {
    if (O.overall) {
      p.poly([[cx - bodyW * 0.62, bodyTop + 30 * u], [cx + bodyW * 0.62, bodyTop + 30 * u], [cx + bodyW * 0.55, torsoBot], [cx - bodyW * 0.55, torsoBot]], O.vest || '#3c5566', 0);
      for (const s of [-1, 1]) p.band([[cx + s * 26 * u, bodyTop + 34 * u], [cx + s * 30 * u, bodyTop + 4 * u]], O.vest || '#3c5566', 11 * u, 2 * u);
      p.poly(rrect(cx - 20 * u, bodyTop + 60 * u, cx + 20 * u, bodyTop + 84 * u, 3 * u), '#2f4351', 2 * u);
    }
    if (O.robe) {
      p.band([[cx - bodyW * 0.5, torsoBot - 40 * u], [cx + bodyW * 0.5, torsoBot - 44 * u]], O.sash || BRASS, 14 * u, 2 * u);
      p.stroke([[cx, bodyTop + 12 * u], [cx + 4 * u, torsoBot - 44 * u]], 3 * u, mul(O.robe, [0.7, 0.7, 0.75]));
    }
    if (O.coat) {
      p.poly([[cx, bodyTop + 6 * u], [cx + 16 * u, bodyTop + 40 * u], [cx + 8 * u, torsoBot], [cx - 2 * u, torsoBot]], '#d8d2c4', 2 * u);
      p.stroke([[cx - 40 * u, bodyTop + 60 * u], [cx - 20 * u, bodyTop + 120 * u]], 2.6 * u, '#8a8478');
    }
    if (O.scarf) p.band([[cx - bodyW * 0.55, chin + 10 * u], [cx + bodyW * 0.55, chin + 14 * u]], O.scarf, 12 * u, 2.2 * u);
    if (O.dress) {
      p.band([[cx - bodyW * 0.5, bodyTop + 40 * u], [cx + bodyW * 0.5, bodyTop + 40 * u]], mul(O.dress, [0.9, 0.85, 0.9]), 6 * u, 1.6 * u);
    }
  });

  // pescoco (desenhado depois do tronco para ficar visivel)
  p.poly(rrect(cx - 14 * u, chin - 30 * u, cx + 14 * u, torsoTop + 12 * u, 7 * u), mul(O.skin || SKIN, SH_SKIN), ow * 0.8);

  // ---- cabeca ----
  p.rot = headTilt ? [headTilt, cx, chin] : null;
  const head = blobPts(cx, hc, H);
  p.shadedFill(head, O.skin || SKIN, mul(O.skin || SKIN, SH_SKIN), LIGHT, H.a, 0.3);
  p.inkRing(head, ow);
  // orelhas
  for (const s of [-1, 1]) p.ell(cx + s * (H.a + 1 * u), hc + 6 * u, 5.5 * u, 8 * u, mul(O.skin || SKIN, SH_SKIN), 3 * u);

  const hooded = hairOn(p, { ...O, expr, facing, look, lid: blink }, H, cx, hc, u, seed);
  if (O.beard) {
    const bd = blobPts(cx + 3 * u * facing, hc + 1.16 * H.b, { a: 0.54 * H.a, b: 0.56 * H.b, nTop: 2.2, nBot: 1.4, egg: -0.4, noise: 0.02, seed: seed + 4 });
    p.shadedFill(bd, O.beard, mul(O.beard, [0.82, 0.82, 0.88]), LIGHT, 0.6 * H.a, 0.3);
    p.inkRing(bd, ow * 0.85);
  }
  if (!hooded) faceFront(p, cx, hc, W, expr, facing, look, blink, O.skin || SKIN, { blush: O.blush, browCol: O.beard });
  if (O.moustache) p.poly([[cx - 12 * u, hc + 26 * u], [cx - 2 * u, hc + 22 * u], [cx + 12 * u, hc + 26 * u], [cx, hc + 30 * u]], O.moustache, 0);
  p.rot = null;

  // ---- bracos (frente) ----
  let hand = null;
  if (!behind(L)) drawArm(-1, L);
  if (!behind(R) || prop) hand = drawArm(1, R);

  // ---- acessorios ----
  if (O.satchel) {
    p.band([[cx - bodyW * 0.4, bodyTop + 10 * u], [cx + bodyW * 0.45, torsoBot - 20 * u]], '#6b452c', 8 * u, 2 * u);
    p.poly(rrect(cx + bodyW * 0.3, torsoBot - 60 * u, cx + bodyW * 0.72, torsoBot - 10 * u, 6 * u), '#8a5a3c', 3 * u);
  }
  if (O.backpack) {
    p.poly(rrect(cx - bodyW * 0.98, bodyTop + 40 * u, cx - bodyW * 0.6, torsoBot - 30 * u, 8 * u), O.backpack, 3 * u);
  }

  if (prop && hand) {
    const draw = PROP_DRAW[prop];
    if (draw) {
      p.g.save();
      p.g.translate(hand[0], hand[1]);
      draw(p, u, opts);
      p.g.restore();
    }
  }
  p.g.restore();
  return { hand, headTop: hc - H.b, u };
}

/** desenhos de objetos, na origem da mao */
export const PROP_DRAW = {
  hammer(p, u) {
    p.stroke([[0, 10 * u], [0, -18 * u]], 7 * u, '#8a5a34');
    p.poly([[-16 * u, -20 * u], [16 * u, -20 * u], [18 * u, -34 * u], [-18 * u, -34 * u]], '#9aa3ad', 3 * u);
    p.poly([[-16 * u, -26 * u], [16 * u, -26 * u], [16 * u, -30 * u], [-16 * u, -30 * u]], '#c8d0d8', 0);
  },
  pickaxe(p, u) {
    p.stroke([[0, 12 * u], [0, -26 * u]], 7 * u, '#8a5a34');
    p.stroke([[-26 * u, -24 * u], [0, -34 * u], [26 * u, -22 * u]], 7 * u, '#9aa3ad');
  },
  lantern(p, u) {
    p.stroke([[0, 6 * u], [0, -10 * u]], 3 * u, INK);
    p.poly(rrect(-11 * u, -34 * u, 11 * u, -10 * u, 3 * u), '#ffd98a', 3 * u);
    p.poly(rrect(-13 * u, -38 * u, 13 * u, -32 * u, 2 * u), '#8a7a5a', 2 * u);
    p.ell(0, -22 * u, 8 * u, 9 * u, 'rgba(255,226,150,.55)', 0);
  },
  torch(p, u) {
    p.stroke([[0, 14 * u], [0, -24 * u]], 7 * u, '#6b452c');
    p.poly([[0, -24 * u], [10 * u, -40 * u], [3 * u, -56 * u], [-4 * u, -42 * u], [-9 * u, -50 * u], [-10 * u, -36 * u]], '#f2a03c', 2.4 * u);
    p.poly([[0, -28 * u], [5 * u, -40 * u], [0, -48 * u], [-5 * u, -38 * u]], '#ffe08a', 0);
  },
  book(p, u) {
    p.poly([[-18 * u, -30 * u], [0, -24 * u], [18 * u, -30 * u], [18 * u, -6 * u], [0, -1 * u], [-18 * u, -6 * u]], '#7a3a3a', 3 * u);
    p.stroke([[0, -24 * u], [0, -2 * u]], 2.4 * u, '#d8c9a6');
    p.poly([[-16 * u, -26 * u], [-2 * u, -21 * u], [-2 * u, -6 * u], [-16 * u, -10 * u]], '#efe6d2', 0);
  },
  key(p, u) {
    p.ell(0, -22 * u, 8 * u, 8 * u, null, 4 * u, BRASS);
    p.stroke([[0, -14 * u], [0, 14 * u]], 4.4 * u, BRASS);
    p.stroke([[0, 8 * u], [10 * u, 8 * u]], 4 * u, BRASS);
    p.stroke([[0, 14 * u], [8 * u, 14 * u]], 4 * u, BRASS);
  },
  phone(p, u) {
    p.poly(rrect(-12 * u, -35 * u, 12 * u, 8 * u, 4 * u), '#222a35', 3 * u);
    p.poly(rrect(-8 * u, -29 * u, 8 * u, -1 * u, 2 * u), '#8bd2df', 0);
    p.ell(0, 3 * u, 2 * u, 2 * u, '#9aa7b4', 0);
  },
  shovel(p, u) {
    p.stroke([[0, 18 * u], [0, -18 * u]], 6.4 * u, '#8a5a34');
    p.poly([[-10 * u, -18 * u], [10 * u, -18 * u], [8 * u, -40 * u], [-8 * u, -40 * u]], '#9aa3ad', 3 * u);
  },
  rope(p, u) {
    p.stroke([[0, 20 * u], [8 * u, 0], [0, -18 * u], [-8 * u, -34 * u]], 6 * u, ROPE);
  },
};

/** efeitos 2D desenhados em cards */
export const FX_DRAW = {
  dust(p, k = 0.5, col = '#e8dcc4') {
    // poeira: nuvens suaves, sem contorno, que sobem e somem
    const g = p.g;
    g.save();
    g.globalAlpha = Math.max(0, 0.5 * (1 - k));
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + k;
      const r = 26 + 90 * k + (i % 3) * 12;
      const x = 300 + Math.cos(a) * r * 1.1;
      const y = 500 + Math.sin(a) * r * 0.65 - k * 40;
      const rad = 26 + (i % 4) * 7;
      const gr = g.createRadialGradient(x, y, 1, x, y, rad);
      gr.addColorStop(0, col);
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(x, y, rad, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  },
  sparkle(p, k = 0.5, col = '#ffe9a8') {
    const s = Math.sin(k * Math.PI) * 1.1;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + k * 2, r = (40 + 90 * k) * 1.1;
      const x = 300 + Math.cos(a) * r, y = 470 + Math.sin(a) * r;
      p.stroke([[x - 26 * s, y], [x + 26 * s, y]], 7, col);
      p.stroke([[x, y - 26 * s], [x, y + 26 * s]], 7, col);
    }
  },
  glow(p, k = 0.5, col = '#ffd27a') {
    const g = p.g;
    const gr = g.createRadialGradient(300, 480, 20, 300, 480, 240 + 120 * k);
    gr.addColorStop(0, 'rgba(255,222,150,.55)');
    gr.addColorStop(1, 'rgba(255,222,150,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 600, 1000);
  },
  zzz(p, t = 0) {
    const g = p.g;
    g.save();
    g.font = '900 110px Arial Black, Arial';
    g.lineJoin = 'round';
    for (let i = 0; i < 3; i++) {
      const k = (t + i / 3) % 1, x = 250 + i * 60 + Math.sin(k * 6) * 16, y = 620 - k * 420, s = 0.5 + k * 0.7;
      g.save();
      g.translate(x, y);
      g.scale(s, s);
      g.globalAlpha = Math.min(1, (1 - k) * 2.2);
      g.lineWidth = 14;
      g.strokeStyle = INK;
      g.strokeText('Z', 0, 0);
      g.fillStyle = '#ffffff';
      g.fillText('Z', 0, 0);
      g.restore();
    }
    g.restore();
  },
  flame(p, t = 0) {
    const k = 0.5 + 0.5 * Math.sin(t * Math.PI * 4);
    p.poly([[300, 520], [330, 460 - k * 20], [315, 400], [300, 430], [285, 390], [272, 460], [280, 512]], '#f2982f', 8);
    p.poly([[300, 500], [315, 460], [300, 420], [288, 462]], '#ffe08a', 0);
  },
};

export { headW };
