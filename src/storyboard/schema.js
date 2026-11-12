/**
 * schema.js - formato declarativo do projeto (JSON) + validacao.
 *
 * Regra do plano: a historia nunca e codigo executado, e sim dados validados.
 * Este modulo normaliza o projeto, aplica limites seguros e devolve uma lista
 * de erros legivel em portugues para a interface.
 */
import { CAMERA_MOVES } from '../engine/camera.js';
import { SET_CATALOG } from '../engine/world.js';
import { OUTFITS } from '../engine/cast.js';

export { CAMERA_MOVES, SET_CATALOG };

export const POSES = ['hang', 'point', 'hold', 'hammer', 'lift', 'reach', 'cross', 'hip', 'up', 'wave', 'torch', 'phone'];
export const POSES_PT = {
  hang: 'Parado', point: 'Apontando', hold: 'Segurando', hammer: 'Martelando', lift: 'Levantando',
  reach: 'Alcancando', cross: 'Bracos cruzados', hip: 'Mao na cintura', up: 'Bracos para cima', wave: 'Acenando', torch: 'Com tocha', phone: 'Falando ao telefone',
};
export const EXPRESSIONS = ['neutral', 'smile', 'grin', 'laugh', 'surprised', 'shock', 'scared', 'sad', 'angry', 'stern', 'thinking', 'nervous', 'squint', 'sleep', 'wink'];
export const EXPRESSIONS_PT = {
  neutral: 'Neutro', smile: 'Sorrindo', grin: 'Sorriso aberto', laugh: 'Rindo', surprised: 'Surpreso', shock: 'Chocado',
  scared: 'Assustado', sad: 'Triste', angry: 'Bravo', stern: 'Serio', thinking: 'Pensando', nervous: 'Nervoso',
  squint: 'Desconfiado', sleep: 'Dormindo', wink: 'Piscando',
};
export const PROPS = ['hammer', 'pickaxe', 'lantern', 'torch', 'book', 'key', 'shovel', 'rope', 'phone', 'duck'];
export const PROPS_PT = {
  hammer: 'Martelo', pickaxe: 'Picareta', lantern: 'Lanterna', torch: 'Tocha', book: 'Livro', key: 'Chave', shovel: 'Pa', rope: 'Corda', phone: 'Telefone', duck: 'Patinho',
};
export const LIGHTS = ['day', 'golden', 'torch', 'cavern', 'night', 'dust', 'pool-night'];
export const LIGHTS_PT = { day: 'Dia', golden: 'Fim de tarde', torch: 'Luz de tocha', cavern: 'Caverna (braseiros)', night: 'Noite', dust: 'Neblina / poeira', 'pool-night': 'Piscina à noite' };

export const CHARACTERS = Object.keys(OUTFITS);
export const CHARACTERS_PT = {
  explorer: 'Explorador', worker: 'Operario', elder: 'Anciao', girl: 'Garota', scientist: 'Cientista', poolhost: 'Apresentador da piscina',
  guard: 'Guarda', merchant: 'Comerciante', child: 'Crianca',
};

export const CAPTION_STYLES = {
  impact: { label: 'Impacto (branco + contorno)', color: '#ffffff', outline: '#100c10', highlight: '#ffd84a' },
  warm: { label: 'Quente (amarelo)', color: '#ffe9a8', outline: '#1a1010', highlight: '#ffffff' },
  calm: { label: 'Sereno (azul claro)', color: '#d6ecff', outline: '#0d1620', highlight: '#ffd84a' },
};

export const FPS_OPTIONS = [24, 30];
export const ASPECT = { w: 1080, h: 1920 };

export const uid = (p = 'id') => `${p}_${Math.random().toString(36).slice(2, 8)}`;

export function defaultActor(character = 'explorer') {
  return {
    id: uid('a'),
    character,
    expression: 'neutral',
    L: 'hang',
    R: 'hang',
    prop: null,
    x: 0,
    z: 0,
    scale: 1,
    flip: false,
    look: 0,
    visible: true,
  };
}

export function defaultScene(index = 0, set = 'room') {
  return {
    id: uid('s'),
    set,
    setParams: {},
    light: 'torch',
    startSec: 0,
    durationSec: 4,
    camera: { type: 'push-in', intensity: 0.5 },
    actors: [defaultActor()],
    caption: { text: '', y: 0.78, style: 'impact' },
    sfx: [],
    fx: [],
  };
}

export function defaultProject(title = 'Novo projeto') {
  return {
    schema: 'b7studio/project@1',
    title,
    script: '',
    fps: 30,
    resolution: { w: 1080, h: 1920 },
    style: 'equilibrado',
    captionsEnabled: true,
    voice: null,
    music: null,
    scenes: [defaultScene(0, 'room')],
    updatedAt: new Date().toISOString(),
  };
}

const num = (v, fallback = 0) => (Number.isFinite(+v) ? +v : fallback);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** normaliza um projeto vindo de JSON/IndexedDB, preenchendo defaults */
export function normalizeProject(input) {
  const p = input && typeof input === 'object' ? input : {};
  const out = defaultProject(typeof p.title === 'string' ? p.title : 'Projeto sem titulo');
  out.script = typeof p.script === 'string' ? p.script : '';
  out.fps = FPS_OPTIONS.includes(+p.fps) ? +p.fps : 30;
  out.style = ['eco', 'equilibrado', 'cinema'].includes(p.style) ? p.style : 'equilibrado';
  out.captionsEnabled = p.captionsEnabled !== false;
  out.id = typeof p.id === 'string' ? p.id : undefined;
  out.voice = p.voice && typeof p.voice === 'object' ? { ...p.voice } : null;
  out.music = p.music && typeof p.music === 'object' ? { ...p.music } : null;
  const scenes = Array.isArray(p.scenes) ? p.scenes : [];
  out.scenes = scenes.length ? scenes.map((s, i) => normalizeScene(s, i)) : [defaultScene()];
  // recalcula o inicio de cada cena para manter a linha do tempo continua
  let t = 0;
  for (const s of out.scenes) {
    s.startSec = +t.toFixed(3);
    t += s.durationSec;
  }
  out.durationSec = +t.toFixed(3);
  out.updatedAt = new Date().toISOString();
  return out;
}

function normalizeScene(s, i) {
  const sc = defaultScene(i);
  sc.id = typeof s?.id === 'string' ? s.id : uid('s');
  sc.set = SET_CATALOG[s?.set] ? s.set : 'room';
  sc.setParams = s?.setParams && typeof s.setParams === 'object' ? { ...s.setParams } : {};
  sc.light = LIGHTS.includes(s?.light) ? s.light : 'day';
  sc.durationSec = clamp(num(s?.durationSec, 4), 0.4, 60);
  const cam = s?.camera || {};
  sc.camera = {
    type: CAMERA_MOVES[cam.type] ? cam.type : 'static',
    intensity: clamp(num(cam.intensity, 0.5), 0, 1),
    roll: clamp(num(cam.roll, 0), -8, 8),
  };
  if (Array.isArray(cam.focus) && cam.focus.length === 3) sc.camera.focus = cam.focus.map((v) => num(v, 0));
  const actors = Array.isArray(s?.actors) ? s.actors : [];
  sc.actors = actors.length
    ? actors.map((a) => ({
        id: typeof a?.id === 'string' ? a.id : uid('a'),
        character: CHARACTERS.includes(a?.character) ? a.character : 'explorer',
        expression: EXPRESSIONS.includes(a?.expression) ? a.expression : 'neutral',
        L: POSES.includes(a?.L) ? a.L : 'hang',
        R: POSES.includes(a?.R) ? a.R : 'hang',
        prop: PROPS.includes(a?.prop) ? a.prop : null,
        x: clamp(num(a?.x, 0), -40, 40),
        z: clamp(num(a?.z, 0), -40, 40),
        y: clamp(num(a?.y, 0), -40, 40),
        scale: clamp(num(a?.scale, 1), 0.3, 3),
        flip: !!a?.flip,
        look: clamp(num(a?.look, 0), -1, 1),
        visible: a?.visible !== false,
      }))
    : [defaultActor()];
  const cap = s?.caption || {};
  sc.caption = {
    text: typeof cap.text === 'string' ? cap.text.slice(0, 90) : '',
    y: clamp(num(cap.y, 0.78), 0.45, 0.9),
    style: CAPTION_STYLES[cap.style] ? cap.style : 'impact',
  };
  sc.sfx = Array.isArray(s?.sfx) ? s.sfx.filter((x) => x && typeof x.type === 'string').slice(0, 6) : [];
  sc.fx = Array.isArray(s?.fx) ? s.fx.filter((x) => x && typeof x.type === 'string').slice(0, 8) : [];
  return sc;
}

/** validacao: erros impedem render; avisos apenas informam */
export function validateProject(project) {
  const errors = [];
  const warnings = [];
  const p = project || {};
  if (!Array.isArray(p.scenes) || p.scenes.length === 0) errors.push('O projeto precisa de pelo menos uma cena.');
  if (!FPS_OPTIONS.includes(+p.fps)) warnings.push('FPS fora do padrao (24/30); usando 30.');
  let t = 0;
  (p.scenes || []).forEach((s, i) => {
    const n = i + 1;
    if (!SET_CATALOG[s.set]) errors.push(`Cena ${n}: cenario "${s.set}" nao existe.`);
    if (!CAMERA_MOVES[s.camera?.type]) errors.push(`Cena ${n}: movimento de camera invalido.`);
    if (!(+s.durationSec > 0)) errors.push(`Cena ${n}: duracao precisa ser maior que zero.`);
    if (+(+(s.startSec || 0)).toFixed(2) !== +t.toFixed(2)) warnings.push(`Cena ${n}: inicio ajustado para ${t.toFixed(2)}s.`);
    t += Math.max(0, +s.durationSec || 0);
    (s.actors || []).forEach((a, j) => {
      if (!CHARACTERS.includes(a.character)) errors.push(`Cena ${n}, ator ${j + 1}: personagem invalido.`);
      if (!EXPRESSIONS.includes(a.expression)) errors.push(`Cena ${n}, ator ${j + 1}: expressao invalida.`);
      if (!POSES.includes(a.L) || !POSES.includes(a.R)) errors.push(`Cena ${n}, ator ${j + 1}: pose invalida.`);
      if (a.prop && !PROPS.includes(a.prop)) errors.push(`Cena ${n}, ator ${j + 1}: objeto invalido.`);
    });
    if (!s.caption?.text) warnings.push(`Cena ${n}: sem legenda.`);
    if (!(s.durationSec <= 60)) errors.push(`Cena ${n}: duracao acima de 60 s.`);
  });
  if (t < 5) warnings.push('Vídeo com menos de 5 s: o Shorts costuma render mais com 25-60 s.');
  if (t > 180) errors.push('Duracao acima de 180 s nao e suportada.');
  return { ok: errors.length === 0, errors, warnings, durationSec: t };
}

export function totalDuration(project) {
  return (project?.scenes || []).reduce((acc, s) => acc + (+s.durationSec || 0), 0);
}

export function sceneIndexAt(project, sec) {
  const scenes = project?.scenes || [];
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    if (sec >= s.startSec && sec < s.startSec + s.durationSec) return i;
  }
  return Math.max(0, scenes.length - 1);
}

export function sceneAt(project, sec) {
  const scenes = project?.scenes || [];
  return scenes[sceneIndexAt(project, sec)] || null;
}

/** tempo local normalizado dentro da cena (0..1) */
export function sceneProgress(scene, sec) {
  if (!scene || !scene.durationSec) return 0;
  return Math.max(0, Math.min(1, (sec - scene.startSec) / scene.durationSec));
}
