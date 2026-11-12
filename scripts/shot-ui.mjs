import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
await page.waitForTimeout(2500);
fs.mkdirSync(path.join(root, 'docs/img'), { recursive: true });
await page.screenshot({ path: path.join(root, 'docs/img/app_ui.png') });
console.log('ok');
await browser.close();
server.close();
