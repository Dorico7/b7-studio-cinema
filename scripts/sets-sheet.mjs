/** Gera uma folha de contato com todos os cenarios para revisar enquadramento. */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const SETS = JSON.parse(process.argv[2] || '["room","tunnel","cavern","cliff","cutaway","surface"]');
const t = +(process.argv[3] || 1.5);

const scenes = SETS.map((set, i) => ({
  id: `s${i}`,
  set,
  setParams: {},
  light: set === 'surface' || set === 'cliff' || set === 'cutaway' ? 'day' : 'torch',
  startSec: i * 4,
  durationSec: 4,
  camera: { type: 'static', intensity: 0 },
  actors: [
    { id: `a${i}`, character: 'explorer', expression: 'neutral', L: 'hang', R: 'point', prop: null, x: 0.6, z: -1.6, scale: 1, flip: false, look: 0.2 },
  ],
  caption: { text: String(set).toUpperCase(), y: 0.82, style: 'impact' },
  sfx: [],
  fx: [],
}));
const project = { schema: 'b7studio/project@1', title: 'sets', script: '', fps: 30, resolution: { w: 1080, h: 1920 }, style: 'equilibrado', captionsEnabled: true, scenes, voice: null, music: null };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(dist, url === '/' ? 'index.html' : url);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.json') ? 'application/json' : 'text/html' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 360, height: 640 } });
page.on('pageerror', (e) => console.log('ERR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE', m.text()); });
await page.addInitScript((p) => { window.__B7_PROJECT__ = p; }, project);
await page.goto(`http://127.0.0.1:${port}/index.html?render=1`);
await page.waitForFunction(() => window.__B7_READY__ === true, null, { timeout: 120000 });
await page.evaluate(() => window.b7.setResolution(360, 640));

const outDir = path.join(root, 'out/sets');
fs.mkdirSync(outDir, { recursive: true });
for (let i = 0; i < scenes.length; i++) {
  const data = await page.evaluate(async ([sec]) => {
    window.b7.renderFrame(sec);
    await new Promise((r) => requestAnimationFrame(r));
    const gl = document.querySelector('#gl').toDataURL('image/png');
    const cap = document.querySelector('#captions').toDataURL('image/png');
    const c = document.createElement('canvas');
    c.width = 360; c.height = 640;
    const ctx = c.getContext('2d');
    const load = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = src; });
    ctx.drawImage(await load(gl), 0, 0);
    ctx.drawImage(await load(cap), 0, 0);
    return c.toDataURL('image/png');
  }, [i * 4 + t]);
  fs.writeFileSync(path.join(outDir, `set-${SETS[i]}.png`), Buffer.from(data.split(',')[1], 'base64'));
}
await browser.close();
server.close();
console.log('ok', outDir);
