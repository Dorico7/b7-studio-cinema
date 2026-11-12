#!/usr/bin/env node
/**
 * render.mjs - renderiza um projeto do B7 Studio Cinema em video MP4.
 *
 * Uso:
 *   node local-renderer/render.mjs <pacote.b7zip | project.json> [opcoes]
 *
 * Opcoes:
 *   --video <arquivo.mp4>  gera o MP4 direto (video + legendas + audio)
 *   --out <pasta>          se sem --video, grava a sequencia de PNGs
 *   --times a,b,c          grava apenas stills nos tempos indicados (PNG)
 *   --fps <n>              forca FPS (padrao: fps do projeto)
 *   --width/--height       resolucao (padrao 1080x1920)
 *   --range a-b            intervalo de quadros (0-based)
 *   --step <n>             grava 1 a cada n quadros
 *   --no-audio             nao embute a narracao
 *   --crf <n>              qualidade x264 (padrao 18)
 *
 * Requisitos: Node 18+, Playwright + Chromium, FFmpeg no PATH.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { unzipSync, strFromU8 } from 'fflate';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith('--'));
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const flag = (name) => args.includes(`--${name}`);

function parseProject(inputPath) {
  const buf = new Uint8Array(fs.readFileSync(inputPath));
  if (inputPath.endsWith('.json')) {
    const dir = path.dirname(inputPath);
    const media = {};
    for (const f of fs.readdirSync(dir)) {
      if (f.startsWith('voice.') || f.startsWith('music.')) media[f] = new Uint8Array(fs.readFileSync(path.join(dir, f)));
    }
    return { project: JSON.parse(strFromU8(buf)), media };
  }
  const files = unzipSync(buf);
  if (!files['project.json']) throw new Error('O pacote precisa conter project.json');
  const project = JSON.parse(strFromU8(files['project.json']));
  const media = {};
  for (const [p, data] of Object.entries(files)) if (p.startsWith('media/')) media[p.slice(6)] = data;
  return { project, media };
}

function contentType(p) {
  if (p.endsWith('.js')) return 'text/javascript';
  if (p.endsWith('.css')) return 'text/css';
  if (p.endsWith('.json')) return 'application/json';
  if (p.endsWith('.html')) return 'text/html';
  if (p.endsWith('.png')) return 'image/png';
  if (p.endsWith('.mp3')) return 'audio/mpeg';
  if (p.endsWith('.wav')) return 'audio/wav';
  return 'application/octet-stream';
}

function ffmpegBin() {
  return process.env.FFMPEG || 'ffmpeg';
}

function startFfmpeg({ outFile, width, height, fps, audioPath, crf }) {
  const ffArgs = ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${width}x${height}`, '-r', String(fps), '-i', '-'];
  if (audioPath) ffArgs.push('-i', audioPath);
  ffArgs.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart');
  if (audioPath) ffArgs.push('-c:a', 'aac', '-b:a', '192k', '-shortest');
  ffArgs.push(outFile);
  const proc = spawn(ffmpegBin(), ffArgs, { stdio: ['pipe', 'inherit', 'inherit'] });
  return proc;
}

const writeAsync = (stream, buf) =>
  new Promise((resolve, reject) => {
    if (stream.write(buf)) return resolve();
    // remove os ouvintes depois do evento para nao acumular listeners no socket
    const onDrain = () => {
      stream.off('error', onError);
      resolve();
    };
    const onError = (err) => {
      stream.off('drain', onDrain);
      reject(err);
    };
    stream.once('drain', onDrain);
    stream.once('error', onError);
  });

async function main() {
  const dist = path.join(root, 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) {
    console.error('Build ausente. Rode "npm run build" antes de renderizar.');
    process.exit(1);
  }
  if (!input) {
    console.error('Informe o pacote .b7zip ou project.json');
    process.exit(1);
  }
  const { project, media } = parseProject(input);
  const fps = +opt('fps', project.fps || 30);
  const width = +opt('width', 1080);
  const height = +opt('height', 1920);
  const step = Math.max(1, +opt('step', 1));
  const total = project.scenes.reduce((a, s) => a + s.durationSec, 0);
  const frames = Math.max(1, Math.round(total * fps));
  const times = (opt('times') || '').split(',').map(Number).filter((v) => Number.isFinite(v));
  const videoPath = opt('video');
  let range = [0, frames - 1];
  const r = opt('range');
  if (r && r.includes('-')) range = r.split('-').map(Number);

  const baseName = path.basename(input).replace(/\.[^.]+$/, '');
  const outDir = path.resolve(opt('out', path.join(root, 'out', baseName)));
  if (!videoPath) fs.mkdirSync(outDir, { recursive: true });

  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(dist, url === '/' ? 'index.html' : url);
    if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      return res.end('not found');
    }
    res.writeHead(200, { 'Content-Type': contentType(file) });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));

  await page.addInitScript(([p]) => { window.__B7_PROJECT__ = p; }, [project]);
  await page.goto(`http://127.0.0.1:${port}/index.html?render=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__B7_READY__ === true, null, { timeout: 180000 });
  await page.evaluate(([w, h]) => window.b7.setResolution(w, h), [width, height]);

  // audio do pacote (se houver)
  let audioPath = null;
  if (!flag('no-audio') && !times.length) {
    const voiceKey = Object.keys(media).find((k) => k.startsWith('voice.'));
    if (voiceKey) {
      audioPath = path.join(root, 'out', `tmp-${Date.now()}-${voiceKey}`);
      fs.mkdirSync(path.dirname(audioPath), { recursive: true });
      fs.writeFileSync(audioPath, Buffer.from(media[voiceKey]));
    }
  }

  const t0 = Date.now();
  let n = 0;
  const report = { project: project.title, fps, width, height, frames: 0, secondsPerFrame: 0, consoleErrors: errors, at: new Date().toISOString() };

  if (videoPath) {
    fs.mkdirSync(path.dirname(path.resolve(videoPath)), { recursive: true });
    const ff = startFfmpeg({ outFile: videoPath, width, height, fps, audioPath, crf: opt('crf', 18) });
    const list = Array.from({ length: Math.floor((range[1] - range[0]) / step) + 1 }, (_, i) => range[0] + i * step);
    for (const f of list) {
      await page.evaluate(([fps_, f]) => window.b7.renderFrame(f / fps_), [fps, f]);
      const b64 = await page.evaluate(() => window.b7.captureRGBA());
      await writeAsync(ff.stdin, Buffer.from(b64, 'base64'));
      n++;
      if (n % 20 === 0) {
        const per = (Date.now() - t0) / n / 1000;
        process.stdout.write(`\r${n}/${list.length} quadros · ${per.toFixed(2)} s/quadro · ${(((list.length - n) * per) / 60).toFixed(1)} min restantes   `);
      }
    }
    ff.stdin.end();
    await new Promise((resolve, reject) => {
      ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg saiu com codigo ${code}`))));
    });
    console.log(`\nvideo: ${videoPath}`);
    report.frames = n;
  } else if (times.length) {
    for (const t of times) {
      const f = Math.round(t * fps);
      await page.evaluate(([fps_, f]) => window.b7.renderFrame(f / fps_), [fps, f]);
      const b64 = await page.evaluate(() => window.b7.captureRGBA());
      const { PNG } = await import('pngjs').catch(() => ({ PNG: null }));
      if (!PNG) throw new Error('pngjs ausente: use --video ou instale pngjs');
      const raw = Buffer.from(b64, 'base64');
      const png = new PNG({ width, height });
      png.data = raw;
      fs.writeFileSync(path.join(outDir, `still-${String(t).replace('.', '_')}.png`), PNG.sync.write(png));
      n++;
    }
    console.log(`\nstills em ${outDir}`);
    report.frames = n;
  } else {
    const list = [];
    for (let f = range[0]; f <= range[1]; f += step) list.push(f);
    for (const f of list) {
      await page.evaluate(([fps_, f]) => window.b7.renderFrame(f / fps_), [fps, f]);
      const b64 = await page.evaluate(() => window.b7.captureRGBA());
      const { PNG } = await import('pngjs').catch(() => ({ PNG: null }));
      if (!PNG) throw new Error('pngjs ausente: instale com npm i pngjs');
      const raw = Buffer.from(b64, 'base64');
      const png = new PNG({ width, height });
      png.data = raw;
      fs.writeFileSync(path.join(outDir, `f${String(f).padStart(5, '0')}.png`), PNG.sync.write(png));
      n++;
      if (n % 15 === 0) process.stdout.write(`\r${n} quadros   `);
    }
    console.log(`\nok: ${n} quadros em ${outDir}`);
    report.frames = n;
    fs.writeFileSync(path.join(outDir, 'render-report.json'), JSON.stringify({ ...report, secondsPerFrame: +((Date.now() - t0) / n / 1000).toFixed(3) }, null, 2));
  }

  if (audioPath) fs.unlink(audioPath, () => {});
  if (errors.length) console.warn('AVISOS do console:', errors.slice(0, 5));
  await browser.close();
  server.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
