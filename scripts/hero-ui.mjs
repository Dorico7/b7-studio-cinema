/**
 * hero-ui.mjs - gera docs/img/app_ui.png com o palco composto a partir dos
 * pixels reais do canvas (o screenshot do compositor headless escurece WebGL).
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(dist, url === '/' ? 'index.html' : url);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.json') ? 'application/json' : 'text/html' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 940 }, deviceScaleFactor: 1 });
await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
await page.waitForFunction(() => window.__B7_READY__ === true, null, { timeout: 120000 });
await page.waitForTimeout(1200);
await page.evaluate(() => window.b7.renderFrame(2.2));
await page.waitForTimeout(200);

const box = await page.locator('#stage').boundingBox();
const shot = await page.screenshot();
const stageB64 = await page.evaluate(() => window.b7.captureRGBA());
fs.mkdirSync(path.join(root, 'out/dbg'), { recursive: true });
fs.writeFileSync(path.join(root, 'out/dbg/page.png'), shot);
fs.writeFileSync(path.join(root, 'out/dbg/stage.png'), PNG.sync.write(Object.assign(new PNG({ width: 540, height: 960 }), { data: Buffer.from(stageB64, 'base64') })));
fs.writeFileSync(path.join(root, 'out/dbg/box.json'), JSON.stringify(box));
await browser.close();
server.close();

// composicao com PIL (resample de alta qualidade)
const py = `
from PIL import Image
box = ${JSON.stringify(box)}
page = Image.open('out/dbg/page.png').convert('RGB')
stage = Image.open('out/dbg/stage.png').convert('RGB')
w, h = int(box['width']), int(box['height'])
stage = stage.resize((w, h), Image.LANCZOS)
page.paste(stage, (int(box['x']), int(box['y'])))
page.save('docs/img/app_ui.png')
print('ok', page.size)
`;
fs.writeFileSync(path.join(root, 'out/dbg/compose.py'), py);
const r = spawnSync('python3', [path.join(root, 'out/dbg/compose.py')], { cwd: root, encoding: 'utf8' });
console.log(r.stdout.trim() || r.stderr.trim());
