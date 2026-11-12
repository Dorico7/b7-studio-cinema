#!/usr/bin/env node
/**
 * run.mjs - testes do B7 Studio Cinema.
 *
 * 1) unidade: normalizacao/validacao do projeto e planejador de roteiro
 *    (executados no Chromium via servidor de desenvolvimento do Vite);
 * 2) fumaca: abre o app em modo render, desenha quadros e verifica pixels,
 *    legendas, duracao e ausencia de erros de console.
 *
 * Uso: node tests/run.mjs
 */
import { createServer } from 'vite';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const results = [];
let failures = 0;

function check(name, fn) {
  try {
    const out = fn();
    results.push({ name, ok: true, details: out || '' });
  } catch (err) {
    failures++;
    results.push({ name, ok: false, details: err.message });
  }
}

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const server = await createServer({ root, server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push(e.message));
await page.goto(base, { waitUntil: 'load' });
await page.waitForFunction(() => window.__B7_READY__ === true, null, { timeout: 120000 });

/* ---------------- unidade ---------------- */
const unit = await page.evaluate(async () => {
  const schema = await import('/src/storyboard/schema.js');
  const planner = await import('/src/storyboard/planner.js');
  const out = {};

  const p = schema.normalizeProject({ title: 'T', fps: 24, scenes: [
    { set: 'cavern', durationSec: 3, camera: { type: 'crane-up' }, actors: [{ character: 'worker' }], caption: { text: 'oi' } },
    { set: 'tunnel', durationSec: 2, camera: { type: 'push-in' }, actors: [] },
  ] });
  out.retime = p.scenes.map((s) => s.startSec).join(',') + '|' + p.durationSec;
  out.defaults = { fps: p.fps, actors: p.scenes[1].actors.length, cap: p.scenes[1].caption.text };
  out.clamp = schema.normalizeProject({ scenes: [{ durationSec: 999, actors: [{ x: 900 }], camera: { type: 'x' } }] });
  out.valid = schema.validateProject(p);

  // validacao recebe o objeto cru (o normalizador consertaria os campos)
  out.invalid = schema.validateProject({
    fps: 17,
    scenes: [{ set: 'nada', camera: { type: 'nada' }, durationSec: 0, actors: [{ character: 'x', expression: 'y', L: 'z', R: 'z', prop: 'w' }], caption: { text: '' } }],
  });

  // ida e volta do pacote .b7zip (projeto + midia)
  const store = await import('/src/app/store.js');
  const proj = schema.normalizeProject({ title: 'Teste Pacote', scenes: [{ set: 'tunnel', durationSec: 2 }] });
  const fakeMedia = [{ name: 'voice.mp3', blob: new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: 'audio/mpeg' }) }];
  const pkg = await store.exportPackage(proj, fakeMedia);
  const file = new File([pkg.blob], pkg.filename);
  const back = await store.importFile(file);
  out.pkg = {
    filename: pkg.filename,
    title: back.project.title,
    scenes: back.project.scenes.length,
    media: back.media.length,
    bytes: back.media[0] ? (await back.media[0].blob.arrayBuffer()).byteLength : 0,
  };

  const script =
    'Em 1963, um homem quebrou uma parede do porão da própria casa e encontrou uma passagem escura. ' +
    'Ele cavou durante dias e descobriu corredores que desciam dezoito níveis abaixo da terra. ' +
    'Era Derinkuyu, uma cidade subterrânea inteira, com depósitos, capelas e túneis de ventilação. ' +
    'Cerca de vinte mil pessoas podiam viver ali, protegidas de invasores. ' +
    'Durante séculos, a cidade existiu embaixo dos pés de quem caminhava na superfície.';
  const plan = planner.planScenes(script, { maxScenes: 6 });
  out.plan = {
    n: plan.scenes.length,
    sets: plan.scenes.map((s) => s.set),
    caps: plan.scenes.map((s) => s.caption.text),
    total: plan.scenes.reduce((a, s) => a + s.durationSec, 0),
    starts: plan.scenes.map((s) => s.startSec),
    notes: plan.notes,
  };
  out.planSingle = planner.planScenes('Uma frase curta.').scenes.length;
  out.planEmpty = planner.planScenes('   ').scenes.length;
  out.idx = [0, 2.9, 3, 4.9, 5, 99].map((t) => schema.sceneIndexAt(p, t));
  const refPlan = planner.planScenes('Na piscina ele atendeu o telefone e viu um patinho amarelo.', { maxScenes: 3 });
  out.reference = { set: refPlan.scenes[0]?.set, character: refPlan.scenes[0]?.actors[0]?.character, pose: refPlan.scenes[0]?.actors[0]?.R, prop: refPlan.scenes[0]?.actors[0]?.prop, light: refPlan.scenes[0]?.light };
  return out;
});

check('normalizacao recalcula a linha do tempo', () => assert(unit.retime === '0,3|5', `recebido ${unit.retime}`));
check('normalizacao preenche defaults', () => assert(unit.defaults.fps === 24 && unit.defaults.actors === 1 && unit.defaults.cap === '', JSON.stringify(unit.defaults)));
check('limites sao aplicados (duracao, posicao, camera)', () => {
  const s = unit.clamp.scenes[0];
  assert(s.durationSec === 60, `duracao ${s.durationSec}`);
  assert(s.actors[0].x === 40, `x ${s.actors[0].x}`);
  assert(s.camera.type === 'static', `camera ${s.camera.type}`);
});
check('projeto valido passa na validacao', () => assert(unit.valid.ok === true, JSON.stringify(unit.valid.errors)));
check('projeto invalido e reprovado com mensagens', () => assert(unit.invalid.ok === false && unit.invalid.errors.length >= 2, JSON.stringify(unit.invalid)));
check('planejador cria cenas dentro do limite', () => assert(unit.plan.n >= 3 && unit.plan.n <= 6, `n=${unit.plan.n}`));
check('planejador usa cenarios conhecidos', () => assert(unit.plan.sets.every((s) => ['room', 'tunnel', 'cavern', 'cliff', 'cutaway', 'surface'].includes(s)), unit.plan.sets.join(',')));
check('planejador gera legendas curtas', () => assert(unit.plan.caps.every((c) => c.length > 0 && c.length <= 45), unit.plan.caps.join(' | ')));
check('planejador estima duracao plausivel', () => assert(unit.plan.total > 8 && unit.plan.total < 45, `total=${unit.plan.total}`));
check('planejador mantem inicio continuo', () => assert(unit.plan.starts.every((s, i) => i === 0 || s > unit.plan.starts[i - 1]), unit.plan.starts.join(',')));
check('planejador lida com roteiro vazio', () => assert(unit.planEmpty === 0, `n=${unit.planEmpty}`));
check('pacote .b7zip ida e volta', () => {
  const r = unit.pkg;
  assert(r.filename.endsWith('.b7zip'), r.filename);
  assert(r.title === 'Teste Pacote' && r.scenes === 1, JSON.stringify(r));
  assert(r.media === 1 && r.bytes === 5, JSON.stringify(r));
});
check('sceneIndexAt respeita limites', () => assert(JSON.stringify(unit.idx) === JSON.stringify([0, 0, 1, 1, 1, 1]), JSON.stringify(unit.idx)));
check('planejador reconhece o estilo piscina', () => assert(JSON.stringify(unit.reference) === JSON.stringify({ set: 'pool', character: 'poolhost', pose: 'phone', prop: 'phone', light: 'pool-night' }), JSON.stringify(unit.reference)));

/* ---------------- fumaca de renderizacao ---------------- */
await page.goto(`${base}index.html?render=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__B7_READY__ === true, null, { timeout: 120000 });
await page.evaluate(() => window.b7.setResolution(540, 960));

const meta = await page.evaluate(() => ({ duration: window.b7.duration(), fps: 30 }));
check('duracao do piloto', () => assert(Math.abs(meta.duration - 32) < 0.5, `duracao=${meta.duration}`));

async function grab(sec) {
  const b64 = await page.evaluate(([s]) => {
    window.b7.renderFrame(s);
    return window.b7.captureRGBA();
  }, [sec]);
  // captureRGBA devolve RGBA cru; monta um objeto compativel com pngjs
  const png = new PNG({ width: 540, height: 960 });
  png.data = Buffer.from(b64, 'base64');
  return png;
}

const frames = {};
for (const t of [1, 6.5, 15, 21.5, 26, 30.5]) frames[t] = await grab(t);

function stats(png) {
  const { data, width, height } = png;
  let sum = 0, sum2 = 0, n = 0, bright = 0;
  for (let y = 0; y < height; y += 4) {
    for (let x = 0; x < width; x += 4) {
      const i = (y * width + x) * 4;
      const l = (data[i] + data[i + 1] + data[i + 2]) / 3;
      sum += l; sum2 += l * l; n++;
      if (l > 110) bright++;
    }
  }
  const mean = sum / n;
  return { mean, std: Math.sqrt(sum2 / n - mean * mean), brightRatio: bright / n };
}

const s1 = stats(frames[1]);
check('quadro nao esta preto', () => assert(s1.mean > 18 && s1.std > 8, JSON.stringify(s1)));
check('quadro tem areas claras (personagem/legenda)', () => assert(s1.brightRatio > 0.005, JSON.stringify(s1)));

const distinct = new Set(Object.values(frames).map((f) => {
  let h = 0;
  for (let i = 0; i < f.data.length; i += 997) h = (h * 31 + f.data[i]) % 1e9;
  return h;
}));
check('cenas diferentes geram quadros diferentes', () => assert(distinct.size >= 5, `distintos=${distinct.size}`));

const captionPixels = await page.evaluate(() => {
  const c = document.querySelector('#captions');
  const g = c.getContext('2d');
  const d = g.getImageData(0, Math.floor(c.height * 0.68), c.width, Math.floor(c.height * 0.22)).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++;
  return n;
});
check('legenda desenhada na area segura', () => assert(captionPixels > 800, `pixels=${captionPixels}`));

const project = await page.evaluate(() => (window.b7.getProject ? window.b7.getProject() : null));
check('projeto do piloto tem 7 cenas', () => assert(project && project.scenes.length === 7, `cenas=${project?.scenes?.length}`));

const realErrors = consoleErrors.filter((e) => !/favicon|Download the React/i.test(e));
check('sem erros de console', () => assert(realErrors.length === 0, realErrors.slice(0, 3).join(' | ')));

await browser.close();
await server.close();

/* ---------------- relatorio ---------------- */
const okCount = results.filter((r) => r.ok).length;
console.log('');
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : `\n      -> ${r.details}`}`);
console.log(`\n${okCount}/${results.length} testes aprovados`);
fs.mkdirSync(path.join(root, 'out'), { recursive: true });
fs.writeFileSync(path.join(root, 'out/test-report.json'), JSON.stringify({ at: new Date().toISOString(), ok: failures === 0, results }, null, 2));
process.exit(failures === 0 ? 0 : 1);
