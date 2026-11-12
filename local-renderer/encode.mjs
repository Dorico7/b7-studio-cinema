#!/usr/bin/env node
/**
 * encode.mjs - junta quadros PNG + audio em MP4 e roda o QA com ffprobe.
 *
 * Uso:
 *   node local-renderer/encode.mjs <pasta-de-quadros> <saida.mp4> [opcoes]
 *
 * Opcoes:
 *   --fps 30          quadros por segundo (padrao 30)
 *   --audio voz.mp3   faixa de audio (opcional)
 *   --crf 18          qualidade x264 (menor = melhor)
 *   --report qa.json  caminho do relatorio de QA
 *
 * O QA verifica duracao, resolucao, fps, presenca de audio e quadros pretos.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const [dir, outArg] = args.filter((a) => !a.startsWith('--'));
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
if (!dir) {
  console.error('Uso: node local-renderer/encode.mjs <pasta-de-quadros> <saida.mp4> [--fps 30] [--audio voz.mp3]');
  process.exit(1);
}
const out = outArg || path.join(dir, 'video.mp4');
const fps = +opt('fps', 30);
const crf = opt('crf', '18');
const audio = opt('audio');
const reportPath = opt('report', path.join(path.dirname(out), 'qa-report.json'));
const FF = process.env.FFMPEG || 'ffmpeg';
const FP = process.env.FFPROBE || 'ffprobe';

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
if (!files.length) {
  console.error('Nenhum PNG encontrado em', dir);
  process.exit(1);
}

const ffArgs = ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(dir, 'f%05d.png')];
if (audio && fs.existsSync(audio)) ffArgs.push('-i', audio);
ffArgs.push('-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart');
if (audio && fs.existsSync(audio)) ffArgs.push('-c:a', 'aac', '-b:a', '192k', '-shortest');
ffArgs.push(out);

console.log('codificando', files.length, 'quadros ->', out);
const r = spawnSync(FF, ffArgs, { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status || 1);

// ---------- QA ----------
const probe = spawnSync(FP, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', out], { encoding: 'utf8' });
let info = null;
try {
  info = JSON.parse(probe.stdout || '{}');
} catch {
  info = null;
}
const video = info?.streams?.find((s) => s.codec_type === 'video');
const audioStream = info?.streams?.find((s) => s.codec_type === 'audio');
const qa = {
  file: out,
  sizeBytes: fs.statSync(out).size,
  durationSec: info ? +(+info.format.duration).toFixed(2) : null,
  width: video?.width ?? null,
  height: video?.height ?? null,
  fps: video?.r_frame_rate ?? null,
  videoCodec: video?.codec_name ?? null,
  audioCodec: audioStream?.codec_name ?? null,
  hasAudio: !!audioStream,
  checks: [],
  at: new Date().toISOString(),
};

const push = (name, ok, detail) => qa.checks.push({ name, ok, detail });
push('duracao > 3 s', (qa.durationSec || 0) > 3, `${qa.durationSec}s`);
push('vertical 9:16', qa.width && qa.height && qa.height > qa.width, `${qa.width}x${qa.height}`);
push('H.264', qa.videoCodec === 'h264', String(qa.videoCodec));
push('AAC quando ha audio', !audioStream || qa.audioCodec === 'aac', String(qa.audioCodec));
push('fps esperado', !qa.fps || Math.abs(parseFloat(qa.fps) - fps) < 0.6, String(qa.fps));

// amostra de quadros pretos: usa o filtro blackdetect
const bd = spawnSync(FF, ['-v', 'info', '-i', out, '-vf', 'blackdetect=d=0.5:pix_th=0.08', '-an', '-f', 'null', '-'], { encoding: 'utf8' });
const blackEvents = (bd.stderr.match(/black_start/g) || []).length;
push('sem trechos pretos longos', blackEvents === 0, `${blackEvents} trecho(s) de preto >= 0,5 s`);

qa.ok = qa.checks.every((c) => c.ok);
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify(qa, null, 2));

for (const c of qa.checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name} (${c.detail})`);
console.log(`\nMP4: ${out}\nQA: ${reportPath}`);
process.exit(qa.ok ? 0 : 2);
