/**
 * pen.js - biblioteca de desenho 2D do B7 Studio Cinema.
 *
 * Substitui o `toon.js` do kit original (que nao vem no ZIP: era baixado de um
 * repositorio externo). Implementacao propria, sem dependencia externa, pensada
 * para desenhar personagens "bean head" com contorno de tinta sobre canvas 2D.
 *
 * Sistema de coordenadas dos personagens: 600 x 1000 (igual ao kit), desenhado
 * em um canvas de 1200 x 2000 (2x) para nitidez.
 */

export const INK = '#1b1216';
export const SKIN = '#f2c49b';
/** multiplicador de sombra para tecido e para pele */
export const SH_CLOTH = [0.58, 0.53, 0.62];
export const SH_SKIN = [0.88, 0.74, 0.72];

export const rad = (d) => (d * Math.PI) / 180;
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;

/** #rrggbb -> [r,g,b] */
export function toRgb(hex) {
  let h = String(hex || '#000000').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const hex2 = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
export const rgbHex = (rgb) => `#${hex2(rgb[0])}${hex2(rgb[1])}${hex2(rgb[2])}`;
/** multiplica um rgb por um fator [k,k,k] (sombra) */
export const mul = (hex, f) => rgbHex(toRgb(hex).map((v, i) => v * f[i % f.length]));
/** mistura duas cores (k=0 -> a, k=1 -> b) */
export const mix = (a, b, k) => {
  const A = toRgb(a), B = toRgb(b);
  return rgbHex(A.map((v, i) => v + (B[i] - v) * k));
};
export const alpha = (hex, a) => {
  const [r, g, b] = toRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};
/** direcao de luz (graus) -> angulo usado nos gradientes */
export const thickAngle = (lightDeg = -120) => rad(lightDeg);
export const lidOf = (blink = 0) => clamp(blink);

/** retangulo com cantos arredondados em pontos [x0,y0,x1,y1,r] */
export function rrect(x0, y0, x1, y1, r) {
  const pts = [];
  const rr = Math.min(r, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2);
  const corners = [
    [x1 - rr, y0 + rr, -Math.PI / 2, 0],
    [x1 - rr, y1 - rr, 0, Math.PI / 2],
    [x0 + rr, y1 - rr, Math.PI / 2, Math.PI],
    [x0 + rr, y0 + rr, Math.PI, Math.PI * 1.5],
  ];
  for (const [cx, cy, a0, a1] of corners) {
    for (let i = 0; i <= 6; i++) {
      const a = a0 + ((a1 - a0) * i) / 6;
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
  }
  return pts;
}

/** pontos de uma elipse (arco) */
export function ellPts(cx, cy, rx, ry, a0 = 0, a1 = 360, rotDeg = 0, n = 40) {
  const pts = [];
  const r0 = rad(a0), r1 = rad(a1), rot = rad(rotDeg);
  for (let i = 0; i <= n; i++) {
    const a = r0 + ((r1 - r0) * i) / n;
    const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
  }
  return pts;
}

/** curva quadratica amostrada em n pontos */
export function curve(p0, p1, p2, n = 18) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, mt = 1 - t;
    pts.push([mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0], mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1]]);
  }
  return pts;
}

/** gerador deterministico (mesma cena -> mesmo desenho) */
export function rng(seed = 1) {
  let s = (seed >>> 0) || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/**
 * Blob "bean": forma organica usada para cabeca e tronco.
 * nTop/nBot controlam o quanto o topo/base sao retos; egg arredonda o queixo.
 */
export function blobPts(cx, cy, o = {}) {
  const { a = 80, b = 95, nTop = 2.2, nBot = 2.6, egg = 0.12, asym = 0, noise = 0.008, seed = 1, rot = 0, n = 64 } = o;
  const r = rng(seed * 977 + 13);
  const phases = [r() * 6.28, r() * 6.28, r() * 6.28];
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const nx = Math.cos(t), ny = Math.sin(t);
    const e = ny < 0 ? nTop : nBot;
    let x = Math.sign(nx) * Math.pow(Math.abs(nx), 2 / e);
    let y = Math.sign(ny) * Math.pow(Math.abs(ny), 2 / e);
    // queixo/queixo arredondado: afina a parte de baixo
    if (ny > 0) {
      x *= 1 - egg * Math.pow(ny, 2);
      y *= 1 + egg * 0.35 * Math.pow(ny, 3);
    }
    x += asym * (0.5 - ny * 0.5);
    const k = 1 + noise * (Math.sin(t * 3 + phases[0]) * 0.5 + Math.sin(t * 5 + phases[1]) * 0.3 + Math.sin(t * 2 + phases[2]) * 0.2);
    x *= a * k; y *= b * k;
    const cr = Math.cos(rot), sr = Math.sin(rot);
    pts.push([cx + x * cr - y * sr, cy + x * sr + y * cr]);
  }
  return pts;
}

/** cabeca do personagem: a partir do tamanho base */
export function headBlob(seed = 3, size = 118, facing = 0) {
  const s = 0.5 + ((seed * 37) % 11) / 100;
  return {
    a: size * 0.78 * s,
    b: size * 0.88 * s,
    nTop: 2.05 + ((seed * 13) % 5) / 10,
    nBot: 2.5 + ((seed * 7) % 4) / 10,
    egg: 0.16 + facing * 0.02,
    asym: 0.03 * facing,
    noise: 0.006,
    seed,
  };
}

/**
 * Caneta: desenha em um CanvasRenderingContext2D no espaco 600x1000.
 * `rot` aplica uma rotacao em torno de um pivo (usada para inclinar o tronco).
 */
export class Pen {
  constructor(g, opts = {}) {
    this.g = g;
    this.ol = opts.ol ?? 1; // multiplicador global de contorno
    this.rot = null;
    this._push = false;
  }

  _applyRot() {
    const g = this.g;
    g.save();
    this._push = true;
    if (this.rot) {
      const [deg, px, py, dx = 0, dy = 0] = this.rot;
      g.translate(px + dx, py + dy);
      g.rotate(rad(deg));
      g.translate(-px, -py);
    }
  }

  _restore() {
    if (this._push) {
      this.g.restore();
      this._push = false;
    }
  }

  _path(pts, close = true) {
    const g = this.g;
    g.beginPath();
    if (!pts || !pts.length) return;
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    if (close) g.closePath();
  }

  clip(pts, fn) {
    const g = this.g;
    g.save();
    this._path(pts, true);
    g.clip();
    fn();
    g.restore();
  }

  poly(pts, fill, lw = 0, strokeCol = INK) {
    const g = this.g;
    this._applyRot();
    this._path(pts, true);
    if (fill) {
      g.fillStyle = fill;
      g.fill();
    }
    if (lw > 0) {
      g.lineJoin = 'round';
      g.lineCap = 'round';
      g.strokeStyle = strokeCol;
      g.lineWidth = lw * this.ol;
      g.stroke();
    }
    this._restore();
  }

  ell(cx, cy, rx, ry, fill, lw = 0, strokeCol = INK, rotDeg = 0) {
    const g = this.g;
    this._applyRot();
    g.beginPath();
    g.ellipse(cx, cy, Math.abs(rx), Math.abs(ry), rad(rotDeg), 0, Math.PI * 2);
    if (fill) {
      g.fillStyle = fill;
      g.fill();
    }
    if (lw > 0) {
      g.strokeStyle = strokeCol;
      g.lineWidth = lw * this.ol;
      g.stroke();
    }
    this._restore();
  }

  dot(x, y, r, col = INK) {
    this.ell(x, y, r, r, col, 0);
  }

  /** linha grossa (membro, cabo, etc.) */
  stroke(pts, w, col = INK, close = false) {
    const g = this.g;
    this._applyRot();
    this._path(pts, close);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = col;
    g.lineWidth = Math.max(0.6, w * this.ol);
    g.stroke();
    this._restore();
  }

  /** faixa com contorno: usada em detalhes de roupa */
  band(pts, col, w, lw = 1.6, cap = 'round') {
    const g = this.g;
    this._applyRot();
    this._path(pts, false);
    g.lineCap = cap;
    g.lineJoin = 'round';
    if (lw > 0) {
      g.strokeStyle = INK;
      g.lineWidth = (w + lw * 2) * this.ol;
      g.stroke();
    }
    g.strokeStyle = col;
    g.lineWidth = w * this.ol;
    g.stroke();
    this._restore();
  }

  /** preenchimento com gradiente na direcao da luz */
  gradFill(pts, cLight, cShade, lightDeg = -120) {
    const g = this.g;
    this._applyRot();
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const R = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * 0.62;
    const a = rad(lightDeg);
    const gr = g.createLinearGradient(cx + Math.cos(a) * R, cy + Math.sin(a) * R, cx - Math.cos(a) * R, cy - Math.sin(a) * R);
    gr.addColorStop(0, cLight);
    gr.addColorStop(0.55, cLight);
    gr.addColorStop(1, cShade);
    this._path(pts, true);
    g.fillStyle = gr;
    g.fill();
    this._restore();
  }

  /** preenchimento sombreado com "core shadow" e brilho */
  shadedFill(pts, base, shade, lightDeg = -120, r = 60, amount = 0.35) {
    const g = this.g;
    this._applyRot();
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const R = Math.max(r, 20);
    const a = rad(lightDeg);
    const gr = g.createLinearGradient(cx + Math.cos(a) * R, cy + Math.sin(a) * R, cx - Math.cos(a) * R * 1.15, cy - Math.sin(a) * R * 1.15);
    gr.addColorStop(0, mix(base, '#ffffff', 0.16 * amount * 2));
    gr.addColorStop(0.42, base);
    gr.addColorStop(0.78, mix(base, shade, amount * 2.0));
    gr.addColorStop(1, mix(base, shade, Math.min(1, amount * 2.8)));
    this._path(pts, true);
    g.fillStyle = gr;
    g.fill();
    this._restore();
  }

  /** contorno de tinta em uma forma fechada */
  inkRing(pts, w = 4, col = INK) {
    this.stroke([...pts, pts[0]], w, col);
  }
}

/** atalhos de desenho usados pelo elenco */
export const P = { rrect, ellPts, curve, blobPts, headBlob };
