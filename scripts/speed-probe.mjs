import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const project = JSON.parse(fs.readFileSync(path.join(dist, 'presets/derinkuyu.b7.json'), 'utf8'));
const W = +(process.argv[2] || 540);
const H = Math.round((W * 16) / 9);

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
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.addInitScript((p) => { window.__B7_PROJECT__ = p; }, project);
await page.goto(`http://127.0.0.1:${port}/index.html?render=1`);
await page.waitForFunction(() => window.__B7_READY__ === true, null, { timeout: 120000 });
await page.evaluate(([w, h]) => window.b7.setResolution(w, h), [W, H]);

const res = await page.evaluate(async ([w, h]) => {
  const gl = document.querySelector('#gl');
  const cap = document.querySelector('#captions');
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const ctx = out.getContext('2d');
  const times = { render: 0, dataUrl: 0, compose: 0, shot: 0 };
  const t0 = performance.now();
  for (let i = 0; i < 12; i++) {
    const a = performance.now();
    window.b7.renderFrame(0.4 + i * 0.7);
    times.render += performance.now() - a;
    const b = performance.now();
    const g = gl.toDataURL('image/png');
    const c = cap.toDataURL('image/png');
    times.dataUrl += performance.now() - b;
    const d = performance.now();
    await new Promise((r) => { const im = new Image(); im.onload = () => { ctx.drawImage(im, 0, 0, w, h); r(); }; im.src = g; });
    await new Promise((r) => { const im = new Image(); im.onload = () => { ctx.drawImage(im, 0, 0, w, h); r(); }; im.src = c; });
    times.compose += performance.now() - d;
  }
  times.total = performance.now() - t0;
  return times;
}, [W, H]);
console.log('por quadro (ms):', Object.fromEntries(Object.entries(res).map(([k, v]) => [k, Math.round((v / 12) * 10) / 10])));

const t1 = Date.now();
for (let i = 0; i < 5; i++) {
  await page.evaluate(([f]) => window.b7.renderFrame(f), [1 + i]);
  await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: W, height: H } });
}
console.log('screenshot clip (ms/quadro):', Math.round((Date.now() - t1) / 5));
await browser.close();
server.close();
