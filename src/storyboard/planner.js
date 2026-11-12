/**
 * planner.js - planejador heuristico de roteiro -> cenas.
 *
 * Nao e IA generativa: e automacao por regras, transparente e editavel. O
 * usuario sempre revisa o resultado. A funcao devolve cenas no formato do
 * projeto, com duracao estimada pela fala em portugues (~2,6 palavras/s).
 */
import { defaultScene, defaultActor, uid } from './schema.js';

const SET_RULES = [
  { set: 'pool', re: /(piscina|boia|patinho|nadar|ver[aã]o|cloro|telefone|ligou|liga[cç][aã]o)/i, light: 'pool-night' },
  { set: 'cutaway', re: /(embaixo|subsolo|abaixo|se[cç][aã]o|corte|debaixo da|camadas?|n[ií]veis?)/i, light: 'day' },
  { set: 'cavern', re: /(caverna|cavernas|subterr[aâ]ne|galeria|sal[aã]o|cidade inteira|compartimento|t[uú]nel de pedra)/i, light: 'torch' },
  { set: 'tunnel', re: /(t[uú]nel|corredor|passagem|escada|degraus|galeria estreita|entrada estreita)/i, light: 'torch' },
  { set: 'cliff', re: /(rocha|pedra|montanha|encosta|fal[eé]sia|abertura|buraco|rachar|quebr)/i, light: 'day' },
  { set: 'room', re: /(parede|quarto|sala|cozinha|casa|por[aã]o|oficina|laborat[oó]rio|muro)/i, light: 'torch' },
  { set: 'surface', re: /(vila|cidade|paisagem|campo|rua|mercado|aldeia|anos|1963|turquia|sol|manh[aã])/i, light: 'day' },
];

const CHAR_RULES = [
  { ch: 'poolhost', re: /(piscina|boia|patinho|ver[aã]o|telefone|ligou|liga[cç][aã]o)/i },
  { ch: 'child', re: /(crian[cç]a|menin[oa]|garoto|filho|filha)/i },
  { ch: 'girl', re: /(garota|mulher|jovem|ela |dela)/i },
  { ch: 'elder', re: /(velho|idoso|anci[aã]o|av[oô]|professor|s[aá]bio|historiador)/i },
  { ch: 'worker', re: /(oper[aá]rio|trabalhador|pedreiro|escav|mineiro|constru)/i },
  { ch: 'scientist', re: /(cientista|pesquisador|engenheir|estudioso|arque[oó]logo)/i },
  { ch: 'guard', re: /(guarda|soldado|sentinela|ex[eé]rcito|imperador)/i },
  { ch: 'merchant', re: /(comerciante|mercador|vendedor|negociante)/i },
];

const POSE_RULES = [
  { pose: 'phone', re: /(telefone|celular|ligou|liga[cç][aã]o|atendeu)/i, prop: 'phone' },
  { pose: 'hammer', re: /(martel|quebr|derrub|bat(e|ia)|golpe)/i, prop: 'hammer' },
  { pose: 'lift', re: /(levant|ergue|carreg|suspend)/i, prop: null },
  { pose: 'point', re: /(apont|mostr|indica|olh(a|ou) para)/i, prop: null },
  { pose: 'torch', re: /(tocha|lanterna|ilumin|escuro)/i, prop: 'torch' },
  { pose: 'reach', re: /(alcan[cç]|peg(a|ou)|toca|encontra)/i, prop: null },
  { pose: 'cross', re: /(pens|duvida|desconfi|espera)/i, prop: null },
];

const STOPWORDS = new Set('a o as os um uma uns umas de do da dos das em no na nos nas por para com que e ou se ao aos à às é era foram foi seu sua seus suas ele ela eles elas isso isto aqui ali mais menos muito pouco como quando onde sobre entre depois antes enquanto porque mas não sim já ainda também todo toda todos todas'.split(/\s+/));

const clean = (s) => s.replace(/\s+/g, ' ').trim();

export function splitSentences(script) {
  return clean(script || '')
    .split(/(?<=[.!?;])\s+|\n+/)
    .map((s) => clean(s))
    .filter((s) => s.length > 2)
    .map((s) => s.replace(/^[-–•\d.\s]+/, ''));
}

function pickSet(sentence, previous) {
  for (const r of SET_RULES) if (r.re.test(sentence)) return r;
  return previous ? { set: previous, light: previous === 'surface' || previous === 'cliff' || previous === 'cutaway' ? 'day' : 'torch' } : { set: 'room', light: 'day' };
}

function pickCharacter(sentence) {
  for (const r of CHAR_RULES) if (r.re.test(sentence)) return r.ch;
  return null;
}

function pickPose(sentence) {
  for (const r of POSE_RULES) if (r.re.test(sentence)) return r;
  return { pose: 'hang', prop: null };
}

/** legenda curta: tenta achar o trecho mais "concreto" da frase */
export function captionFor(sentence) {
  const words = sentence.replace(/[^\p{L}\p{N}\s%-]/gu, '').split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  const scored = words.map((w, i) => ({ w, i, s: (STOPWORDS.has(w.toLowerCase()) ? 0 : 2) + Math.min(3, w.length / 4) + (i < 6 ? 0.8 : 0) }));
  const best = scored.slice().sort((a, b) => b.s - a.s)[0];
  const start = Math.max(0, Math.min(words.length - 3, best.i - 1));
  let cap = words.slice(start, start + 4).join(' ');
  if (cap.length > 42) cap = cap.slice(0, 42).replace(/\s+\S*$/, '');
  return cap.replace(/[.,;:!?]+$/, '');
}

export function estimateSeconds(text) {
  const words = clean(text).split(/\s+/).filter(Boolean).length;
  return Math.max(2.2, Math.min(9, words / 2.6 + 0.55));
}

/**
 * @param {string} script roteiro em PT-BR
 * @param {{durationSec?:number, maxScenes?:number}} opts
 * @returns {{scenes:Array, notes:string[]}}
 */
export function planScenes(script, opts = {}) {
  const notes = [];
  let sentences = splitSentences(script);
  if (!sentences.length) {
    return { scenes: [], notes: ['Roteiro vazio: escreva pelo menos uma frase.'] };
  }
  const maxScenes = Math.max(3, Math.min(10, opts.maxScenes || 8));
  // frases muito longas viram duas cenas
  const expanded = [];
  for (const s of sentences) {
    if (s.split(/\s+/).length > 26 && expanded.length < maxScenes) {
      const mid = s.length / 2;
      let cut = s.indexOf(',', Math.floor(mid));
      if (cut < 0) cut = s.lastIndexOf(' ', Math.floor(mid));
      if (cut > 20) {
        expanded.push(clean(s.slice(0, cut)), clean(s.slice(cut + 1)));
        continue;
      }
    }
    expanded.push(s);
  }
  sentences = expanded;
  // frases demais: agrupa as menores
  while (sentences.length > maxScenes) {
    let idx = 0;
    for (let i = 1; i < sentences.length - 1; i++) if (sentences[i].length < sentences[idx].length) idx = i;
    if (idx === 0) idx = 1;
    const merged = clean(`${sentences[idx - 1]} ${sentences[idx]}`);
    sentences.splice(idx - 1, 2, merged);
  }

  const scenes = [];
  let clock = 0;
  let prevSet = null;
  let prevChar = 'explorer';
  let prevProp = null;
  for (const s of sentences) {
    const rule = pickSet(s, prevSet);
    prevSet = rule.set;
    let ch = pickCharacter(s);
    if (!ch) ch = rule.set === 'cavern' || rule.set === 'tunnel' ? 'worker' : prevChar;
    prevChar = ch;
    const pose = pickPose(s);
    const prop = pose.prop || null;
    const dur = Math.round(estimateSeconds(s) * 10) / 10;
    const sc = defaultScene(scenes.length, rule.set);
    sc.light = rule.light;
    sc.durationSec = dur;
    sc.camera = { type: scenes.length === 0 ? 'push-in' : ['push-in', 'pan-right', 'crane-up', 'reveal'][scenes.length % 4], intensity: 0.45 + (scenes.length % 3) * 0.12 };
    sc.actors = [
      {
        ...defaultActor(ch),
        L: pose.pose === 'hammer' ? 'hold' : 'hang',
        R: pose.pose,
        prop,
        expression: /(desco|surpres|encontr|revela)/i.test(s) ? 'surprised' : /(medo|perigo|morre|morte)/i.test(s) ? 'scared' : 'neutral',
        look: 0.2,
      },
    ];
    sc.caption = { text: captionFor(s), y: 0.78, style: 'impact' };
    sc.sourceText = s;
    sc.startSec = +clock.toFixed(3);
    clock += dur;
    scenes.push(sc);
    prevProp = prop;
  }

  // ajuste de duracao total, se o audio real informar a duracao
  const total = scenes.reduce((a, s) => a + s.durationSec, 0);
  if (opts.durationSec && opts.durationSec > 1) {
    const factor = opts.durationSec / total;
    if (Math.abs(factor - 1) > 0.08) {
      for (const s of scenes) s.durationSec = Math.max(1.6, Math.round(s.durationSec * factor * 10) / 10);
      notes.push(`Duracoes ajustadas para caber em ${opts.durationSec.toFixed(1)} s de narracao.`);
    }
  }
  notes.push('Sugestao automatica por regras: revise cenario, poses e legendas antes de renderizar.');
  return { scenes, notes };
}

/** aplica o plano ao projeto, preservando titulo e audio */
export function applyPlan(project, script, opts = {}) {
  const { scenes, notes } = planScenes(script, opts);
  let t = 0;
  for (const s of scenes) {
    s.startSec = +t.toFixed(3);
    t += s.durationSec;
  }
  return { project: { ...project, script, scenes, durationSec: +t.toFixed(3) }, notes };
}
