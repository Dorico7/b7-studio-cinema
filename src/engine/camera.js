/**
 * camera.js - movimentos de camera cinematicos e deterministicos.
 *
 * Toda a animacao e funcao do tempo (ou do frame), nunca do relogio do
 * navegador: o mesmo instante gera sempre o mesmo enquadramento, o que torna
 * a exportacao de quadros reproduzivel.
 */

const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const clamp01 = (x) => Math.max(0, Math.min(1, x));
export const easeInOut = (t) => {
  t = clamp01(t);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
export const easeOut = (t) => 1 - Math.pow(1 - clamp01(t), 3);

export const CAMERA_MOVES = {
  static: 'Fixo',
  'push-in': 'Aproximar (push-in)',
  'pull-back': 'Afastar (pull-back)',
  'pan-left': 'Panoramica a esquerda',
  'pan-right': 'Panoramica a direita',
  orbit: 'Orbitar',
  reveal: 'Revelar (subir e abrir)',
  'crane-up': 'Grua subindo',
  'tilt-down': 'Inclinar para baixo',
  handheld: 'Camera na mao (leve)',
};

/**
 * @param {{pos:number[],look:number[],fov:number}} base enquadramento do cenario
 * @param {{type?:string,intensity?:number}} move
 * @param {number} t progresso 0..1 dentro da cena
 * @param {number} seed usado no tremor deterministico
 */
export function cameraAt(base, move = {}, t = 0, seed = 0) {
  const type = move.type || 'static';
  const k = Math.max(0, Math.min(1, move.intensity ?? 0.55));
  const e = easeInOut(t);
  let pos = [...base.pos];
  let look = [...base.look];
  let fov = base.fov;
  const dir = [look[0] - pos[0], 0, look[2] - pos[2]];
  const dist = Math.hypot(dir[0], dir[2]) || 1;
  const nx = dir[0] / dist, nz = dir[2] / dist;

  switch (type) {
    case 'push-in': {
      const d = 0.22 * k * dist * e;
      pos = [pos[0] + nx * d, pos[1] - 0.06 * k * e, pos[2] + nz * d];
      fov = base.fov - 4 * k * e;
      break;
    }
    case 'pull-back': {
      const d = 0.3 * k * dist * e;
      pos = [pos[0] - nx * d, pos[1] + 0.12 * k * e, pos[2] - nz * d];
      fov = base.fov + 3 * k * e;
      break;
    }
    case 'pan-left': {
      pos = [pos[0] - 1.1 * k * e, pos[1], pos[2]];
      look = [look[0] - 0.9 * k * e, look[1], look[2]];
      break;
    }
    case 'pan-right': {
      pos = [pos[0] + 1.1 * k * e, pos[1], pos[2]];
      look = [look[0] + 0.9 * k * e, look[1], look[2]];
      break;
    }
    case 'orbit': {
      const a = (Math.PI / 12) * k * (e * 2 - 1);
      const rx = pos[0] - look[0], rz = pos[2] - look[2];
      pos = [look[0] + rx * Math.cos(a) - rz * Math.sin(a), pos[1], look[2] + rx * Math.sin(a) + rz * Math.cos(a)];
      break;
    }
    case 'reveal': {
      const s = easeOut(1 - t); // comeca perto e abre
      pos = [pos[0] - nx * dist * 0.28 * (1 - k * 0.2) * s, pos[1] - 1.5 * s * (0.5 + k), pos[2] - nz * dist * 0.28 * s];
      look = [look[0], look[1] - 0.5 * s, look[2]];
      fov = base.fov + 8 * s;
      break;
    }
    case 'crane-up': {
      pos = [pos[0], pos[1] + 1.6 * k * e, pos[2]];
      look = [look[0], look[1] + 0.4 * k * e, look[2]];
      break;
    }
    case 'tilt-down': {
      look = [look[0], look[1] - 2.2 * k * e, look[2]];
      break;
    }
    case 'handheld': {
      const s = k * 0.05;
      pos = [pos[0] + Math.sin(t * 9 + seed) * s, pos[1] + Math.sin(t * 13 + seed * 2) * s * 0.6, pos[2]];
      look = [look[0] + Math.sin(t * 7 + seed) * s, look[1] + Math.cos(t * 11 + seed) * s * 0.5, look[2]];
      break;
    }
    default:
      break;
  }

  // deriva sutil permanente (evita imagem "congelada")
  const drift = 0.012 * k;
  pos = [pos[0] + Math.sin(t * 3.1 + seed) * drift, pos[1] + Math.sin(t * 2.3 + seed * 1.7) * drift * 0.7, pos[2]];
  return { pos, look, fov, roll: (move.roll || 0) * k * e };
}

/** enquadramento do cenario + deslocamento de foco para o personagem principal */
export function framingFor(base, scene, t) {
  const move = { type: scene.camera?.type || 'static', intensity: scene.camera?.intensity ?? 0.55, roll: scene.camera?.roll || 0 };
  const c = cameraAt(base, move, t, (scene.id || '').length + (scene.startSec || 0));
  const focus = scene.camera?.focus;
  if (focus) {
    c.look = lerp3(c.look, focus, 0.55);
  }
  return c;
}
