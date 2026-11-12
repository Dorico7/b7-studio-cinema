/**
 * timeline.js - linha do tempo desenhada em canvas 2D.
 *
 * Faixas: cenas, atores, camera, narracao (waveform), musica, legendas.
 * Clique posiciona o cursor; arrastar faz scrub.
 */
const LABEL_W = 96;
const ROW_H = 22;
const TOP = 8;

const SET_COLORS = {
  room: '#7a5c3a',
  tunnel: '#3d5a6b',
  cavern: '#5b3f6b',
  cliff: '#5b6b3d',
  cutaway: '#6b5340',
  surface: '#3d6b5a',
};

export function createTimeline({ canvas, getProject, getTime, onSeek, getPeaks, getSceneIndex, onSelectScene }) {
  const ctx = canvas.getContext('2d');
  let dpr = 1;
  let W = 0;
  let H = 150;
  let dragging = false;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth;
    H = 150;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  const timeAtX = (x) => {
    const p = getProject();
    const total = Math.max(0.1, p.durationSec || 1);
    const usable = W - LABEL_W - 12;
    return Math.max(0, Math.min(total, ((x - LABEL_W) / usable) * total));
  };

  function draw() {
    const p = getProject();
    const total = Math.max(0.1, p.durationSec || 1);
    const t = Math.min(total, getTime());
    const usable = W - LABEL_W - 12;
    const xOf = (sec) => LABEL_W + (sec / total) * usable;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#121a23';
    ctx.fillRect(0, 0, W, H);

    // regua
    const step = total <= 20 ? 2 : total <= 60 ? 5 : 10;
    ctx.font = '10px Inter, Arial';
    ctx.textBaseline = 'top';
    for (let s = 0; s <= total; s += step) {
      const x = xOf(s);
      ctx.strokeStyle = '#1e2a38';
      ctx.beginPath();
      ctx.moveTo(x, TOP - 4);
      ctx.lineTo(x, H - 4);
      ctx.stroke();
      ctx.fillStyle = '#6b7d93';
      ctx.fillText(`${s}s`, x + 2, 2);
    }

    const rows = [
      { key: 'scenes', label: 'Cenas' },
      { key: 'actors', label: 'Atores' },
      { key: 'camera', label: 'Camera' },
      { key: 'voice', label: 'Narracao' },
      { key: 'captions', label: 'Legendas' },
    ];

    rows.forEach((row, i) => {
      const y = TOP + i * ROW_H;
      ctx.fillStyle = i % 2 ? '#131c26' : '#151f2a';
      ctx.fillRect(0, y, W, ROW_H - 2);
      ctx.fillStyle = '#75879d';
      ctx.font = '10px Inter, Arial';
      ctx.fillText(row.label, 8, y + 6);
    });
    const rowY = (i) => TOP + i * ROW_H;

    const scenes = p.scenes || [];
    const sel = getSceneIndex();
    scenes.forEach((s, i) => {
      const x = xOf(s.startSec);
      const w = Math.max(2, xOf(s.startSec + s.durationSec) - x);
      // cenas
      ctx.fillStyle = SET_COLORS[s.set] || '#3d4a5a';
      roundRect(ctx, x + 1, rowY(0) + 3, w - 2, ROW_H - 8, 4);
      ctx.fill();
      if (i === sel) {
        ctx.strokeStyle = '#ffd84a';
        ctx.lineWidth = 1.6;
        roundRect(ctx, x + 1, rowY(0) + 3, w - 2, ROW_H - 8, 4);
        ctx.stroke();
      }
      ctx.fillStyle = '#e8eef6';
      ctx.font = '9.5px Inter, Arial';
      clipText(ctx, `${i + 1}`, x + 5, rowY(0) + 7, w - 10);

      // atores
      const n = (s.actors || []).filter((a) => a.visible !== false).length;
      ctx.fillStyle = '#2c3d50';
      roundRect(ctx, x + 1, rowY(1) + 3, w - 2, ROW_H - 8, 4);
      ctx.fill();
      ctx.fillStyle = '#a9bdd4';
      clipText(ctx, `${n} ator${n > 1 ? 'es' : ''}`, x + 5, rowY(1) + 7, w - 10);

      // camera
      ctx.fillStyle = '#243244';
      roundRect(ctx, x + 1, rowY(2) + 3, w - 2, ROW_H - 8, 4);
      ctx.fill();
      ctx.fillStyle = '#9db3c9';
      clipText(ctx, s.camera?.type || 'static', x + 5, rowY(2) + 7, w - 10);

      // legendas
      if (s.caption?.text) {
        ctx.fillStyle = '#3a3320';
        roundRect(ctx, x + 1, rowY(4) + 3, w - 2, ROW_H - 8, 4);
        ctx.fill();
        ctx.fillStyle = '#ffe9a8';
        clipText(ctx, s.caption.text, x + 5, rowY(4) + 7, w - 10);
      }
    });

    // waveform da narracao
    const peaks = getPeaks ? getPeaks() : [];
    const vy = rowY(3) + 2;
    const vh = ROW_H - 6;
    ctx.strokeStyle = '#3f6f8a';
    ctx.lineWidth = 1;
    if (peaks.length) {
      const voiceDur = p.voice?.duration || total;
      const n = Math.min(peaks.length, Math.floor(usable));
      for (let i = 0; i < n; i++) {
        const idx = Math.floor((i / n) * peaks.length);
        const v = Math.min(1, peaks[idx] * 2.4);
        const x = LABEL_W + (i / n) * Math.min(usable, (voiceDur / total) * usable);
        ctx.beginPath();
        ctx.moveTo(x, vy + vh / 2 - (v * vh) / 2);
        ctx.lineTo(x, vy + vh / 2 + (v * vh) / 2);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = '#3a4a5c';
      ctx.font = '10px Inter, Arial';
      ctx.fillText('importe a narracao no painel da direita', LABEL_W + 8, vy + 5);
    }

    // playhead
    const px = xOf(t);
    ctx.strokeStyle = '#ffd84a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px, TOP - 4);
    ctx.lineTo(px, H - 6);
    ctx.stroke();
    ctx.fillStyle = '#ffd84a';
    ctx.beginPath();
    ctx.moveTo(px - 4, TOP - 6);
    ctx.lineTo(px + 4, TOP - 6);
    ctx.lineTo(px, TOP - 1);
    ctx.closePath();
    ctx.fill();
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function clipText(c, text, x, y, maxW) {
    let s = String(text);
    if (maxW < 8) return;
    while (s.length > 1 && c.measureText(s).width > maxW) s = s.slice(0, -1);
    c.fillText(s, x, y);
  }

  function handlePointer(e, isDown) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < LABEL_W) return;
    onSeek(timeAtX(x));
    if (isDown) {
      dragging = true;
      // seleciona a cena clicada
      const sec = timeAtX(x);
      const p = getProject();
      const idx = (p.scenes || []).findIndex((s) => sec >= s.startSec && sec < s.startSec + s.durationSec);
      if (idx >= 0 && onSelectScene) onSelectScene(idx);
    }
  }

  canvas.addEventListener('pointerdown', (e) => handlePointer(e, true));
  window.addEventListener('pointerup', () => { dragging = false; });
  canvas.addEventListener('pointermove', (e) => { if (dragging) handlePointer(e, false); });
  window.addEventListener('resize', resize);

  return { resize, draw };
}
