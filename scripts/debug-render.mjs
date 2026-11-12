/** Script de depuracao: isola iluminacao, sombra e pos-processamento. */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const project = JSON.parse(fs.readFileSync(path.join(dist, 'presets/derinkuyu.b7.json'), 'utf8'));

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
const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
page.on('console', (m) => console.log('PAGE', m.type(), m.text()));
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.addInitScript((p) => { window.__B7_PROJECT__ = p; }, project);
await page.goto(`http://127.0.0.1:${port}/index.html?render=1`);
await page.waitForFunction(() => window.__B7_READY__ === true, null, { timeout: 120000 });
await page.evaluate(() => window.b7.setResolution(540, 960));

const shot = async (name, time = 2) => {
  const data = await page.evaluate(async ([t]) => {
    window.b7.renderFrame(t);
    await new Promise((r) => requestAnimationFrame(r));
    return document.querySelector('#gl').toDataURL('image/png');
  }, [time]);
  fs.writeFileSync(path.join(root, 'out/debug', `${name}.png`), Buffer.from(data.split(',')[1], 'base64'));
};

fs.mkdirSync(path.join(root, 'out/debug'), { recursive: true });
await shot('01-baseline', 2);

// diagnostico: intensidades e tipos de material
const info = await page.evaluate(() => {
  const st = window.__B7_STAGE__;
  const out = { lights: [], materials: {} };
  st.scene.traverse((o) => {
    if (o.isLight) out.lights.push({ type: o.type, intensity: o.intensity, color: '#' + o.color.getHexString() });
    if (o.isMesh && !o.userData.isCard) {
      const m = o.material;
      const k = m.type + (m.map ? '+map' : '');
      out.materials[k] = (out.materials[k] || 0) + 1;
    }
  });
  out.camera = st.camera.position.toArray().map((v) => +v.toFixed(2));
  return out;
});
console.log(JSON.stringify(info, null, 1));

// teste 1: sem sombra
await page.evaluate(() => { window.__B7_STAGE__.renderer.shadowMap.enabled = false; });
await shot('02-noshadow', 2);
await page.evaluate(() => { window.__B7_STAGE__.renderer.shadowMap.enabled = true; });

// teste 2: hemisferio forte
await page.evaluate(() => {
  const st = window.__B7_STAGE__;
  st.scene.traverse((o) => { if (o.isHemisphereLight) { o.intensity = 3; o.color.set('#ffffff'); o.groundColor.set('#ffffff'); } });
});
await shot('03-hemi3', 2);

// teste 3: desliga o pos-processamento (renderiza a cena direto)
const noPost = await page.evaluate(() => {
  const st = window.__B7_STAGE__;
  st.renderer.setRenderTarget(null);
  st.renderer.clear();
  st.renderer.render(st.scene, st.camera);
  return document.querySelector('#gl').toDataURL('image/png');
});
fs.writeFileSync(path.join(root, 'out/debug/04-nopost.png'), Buffer.from(noPost.split(',')[1], 'base64'));

await browser.close();
server.close();
